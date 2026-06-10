import puppeteer from 'puppeteer';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { DOCX_COLORS } from './docx/colors';

const MAX_TRANSPORT_WEIGHT = 24000;

function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Escape HTML entities w stringu przed interpolacją w szablonie HTML.
 * Zapobiega stored XSS: admin (lub inny wektor) może ustawić nazwę klienta
 * / adres / notatki na `<script>...</script>` — bez escapa wykonuje się
 * w kontekście puppeteer (headless Chromium).
 */
function escapeHtml(input: unknown): string {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Generuje PDF oferty rur na podstawie danych z bazy.
 *
 * Pobiera ofertę z bazy danych, wczytuje dane JSON z oferty (offers_rel.data),
 * pobiera dane klienta, autora i opiekuna, następnie generuje HTML z szablonu
 * ofertaRury.html i renderuje go do PDF używając Puppeteer.
 *
 * @param offerId - ID oferty w bazie danych
 * @returns Buffer zawierający wygenerowany PDF
 * @throws Error gdy oferta nie zostanie znaleziona
 */
export async function generateOfferRuryPDF(offerId: string): Promise<Buffer> {
    const ctx = await buildRuryOfferContextFromOfferId(offerId);
    return generateRuryPDFFromContext(ctx);
}

/**
 * Buduje kontekst oferty rur (RuryOfferData) z ID oferty w bazie.
 * Wspólne dla endpointu /export-pdf oferty oraz wewnętrznych wywołań.
 */
export async function buildRuryOfferContextFromOfferId(offerId: string): Promise<RuryOfferData> {
    const offer = await prisma.offers_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta nie znaleziona');
    }

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfRury', 'Nie udało się sparsować danych oferty', e);
    }

    const items = await prisma.offer_items_rel.findMany({
        where: { offerId }
    });

    const enhancedItems = (Array.isArray(offerData.items) ? offerData.items : items) as Record<string, unknown>[];

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    return {
        offerNumber: offer.offer_number || 'N/A',
        clientName: String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? offerData.clientNip ?? ''),
        clientAddress: String(client?.address ?? offerData.clientAddress ?? ''),
        clientPhone: String(offerData.clientContact ?? client?.contact ?? client?.phone ?? ''),
        investName: String(offerData.investName ?? ''),
        investAddress: String(offerData.investAddress ?? ''),
        investContractor: String(offerData.investContractor ?? ''),
        items: enhancedItems,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        authorUser,
        guardianUser
    };
}

/**
 * Buduje kontekst ZAMÓWIENIA rur (RuryOfferData z documentType='order')
 * z ID zamówienia w bazie. Czyta z orders_rury_rel, z fallbackiem na
 * offers_rel dla items (gdy w order.data brak pełnych pozycji z cenami).
 */
export async function buildRuryOrderContextFromOrderId(orderId: string): Promise<RuryOfferData> {
    const order = await prisma.orders_rury_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

    let orderData: Record<string, unknown> = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfRury', 'Błąd parsowania order.data', e);
    }

    // items: priorytet z order.data.items, fallback do oferty
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(orderData.items)) {
        items = orderData.items as Record<string, unknown>[];
    } else if (order.offerId) {
        const offerItems = await prisma.offer_items_rel.findMany({
            where: { offerId: order.offerId }
        });
        items = offerItems as Record<string, unknown>[];
        if (!Array.isArray(orderData.items) && orderData.wells) {
            // Spróbuj z orderData.wells (jeśli zapisano w takiej formie)
            items = orderData.wells as Record<string, unknown>[];
        }
    }

    const client = orderData.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: String(orderData.clientId) } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(orderData, order.userId);

    const orderNumber = String(orderData.orderNumber ?? orderId.substring(0, 8));
    return {
        documentType: 'order',
        offerNumber: orderNumber,
        orderNumber,
        productionOrderNumber: String(orderData.productionOrderNumber ?? ''),
        orderStatus: String(orderData.status ?? 'confirmed'),
        clientName: String(client?.name ?? orderData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? orderData.clientNip ?? ''),
        clientAddress: String(client?.address ?? orderData.clientAddress ?? ''),
        clientPhone:
            String(
                orderData.clientContact ??
                client?.contact ??
                client?.phone ??
                orderData.clientPhone ??
                ''
            ),
        investName: String(orderData.investName ?? orderData.budowa ?? ''),
        investAddress: String(orderData.investAddress ?? ''),
        investContractor: String(orderData.investContractor ?? ''),
        items,
        createdAt: String(orderData.date ?? order.createdAt ?? new Date().toISOString()),
        validityDays: 0,
        notes: String(orderData.notes ?? ''),
        paymentTerms: String(orderData.paymentTerms ?? ''),
        validity: '',
        authorUser,
        guardianUser
    };
}

/**
 * Generuje PDF ZAMÓWIENIA rur (wariant oferty) na podstawie orderId.
 */
export async function generateRuryOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildRuryOrderContextFromOrderId(orderId);
    return generateRuryPDFFromContext(ctx);
}

/**
 * Generuje PDF oferty rur z gotowego kontekstu (RuryOfferData).
 * Używane zarówno przez /export-pdf oferty (po zbudowaniu kontekstu z DB),
 * jak i przez endpoint /export-offer-pdf zamówienia (po zbudowaniu z payloadu klienta).
 */
export async function generateRuryPDFFromContext(data: RuryOfferData): Promise<Buffer> {
    const html = await generateRuryHTML(data);
    return generatePDF(html);
}

/**
 * Generuje PDF oferty studni używając szablonu ofertaStudnie.html.
 *
 * Oferty studni przechowują dane w polu JSON `data`, w tym:
 * - `wellsExport` - studnie z obliczonymi cenami (priorytet)
 * - `wells` - surowe dane studni (fallback)
 * - `transportKm`, `transportRate`, `totalWeight` - dane transportu
 *
 * Funkcja grupuje studnie po średnicy DN, oblicza koszty transportu
 * i generuje kompletny dokument PDF z danymi klienta oraz opiekunów.
 *
 * @param offerId - ID oferty studni w bazie danych
 * @returns Buffer zawierający wygenerowany PDF
 * @throws Error gdy oferta nie zostanie znaleziona
 *
 * @example
 * ```ts
 * const pdfBuffer = await generateOfferStudniePDF('studnie-456');
 * res.setHeader('Content-Type', 'application/pdf');
 * res.send(pdfBuffer);
 * ```
 */
export async function generateOfferStudniePDF(offerId: string): Promise<Buffer> {
    const ctx = await buildStudnieOfferContextFromOfferId(offerId);
    return generateStudniePDFFromContext(ctx);
}

/**
 * Generuje PDF oferty studni z gotowego kontekstu (StudnieOfferData).
 * Używane zarówno przez /export-pdf oferty (po zbudowaniu kontekstu z DB),
 * jak i przez endpoint /export-offer-pdf zamówienia (po zbudowaniu z payloadu klienta).
 */
export async function generateStudniePDFFromContext(data: StudnieOfferData): Promise<Buffer> {
    const html = await generateStudnieHTML(data);
    return generatePDF(html);
}

/**
 * Buduje kontekst StudnieOfferData z oferty w bazie danych.
 * Wyodrębnione z generateOfferStudniePDF, żeby umożliwić
 * generowanie PDF/DOCX z już-zbudowanego kontekstu (np. z payloadu klienta).
 */
export async function buildStudnieOfferContextFromOfferId(
    offerId: string
): Promise<StudnieOfferData> {
    const offer = await prisma.offers_studnie_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta studni nie znaleziona');
    }

    // Parsowanie danych oferty
    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfStudnie', 'Nie udało się sparsować danych oferty', e);
    }

    // wellsExport zawiera studnie z obliczonymi cenami (zapisane przez interfejs użytkownika)
    let wells: unknown[] = [];
    if (offerData.wellsExport && Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (offerData.wells && Array.isArray(offerData.wells)) {
        // Opcja zapasowa: użyj surowych danych studni (bez cen)
        wells = offerData.wells;
    }

    logger.info('PdfStudnie', `Generowanie PDF dla oferty ${offerId}`);
    logger.debug('PdfStudnie', `Znaleziono ${wells.length} studni w offer.data`);
    logger.debug('PdfStudnie', `Offer data keys: ${Object.keys(offerData).join(', ')}`);
    if (wells.length > 0) {
        logger.debug('PdfStudnie', 'Przykładowa studnia', wells[0]);
    }

    // Oblicz transport z danych oferty (offer.data)
    const transportKm = Number(offerData.transportKm ?? 0);
    const transportRate = Number(offerData.transportRate ?? 0);
    const totalWeight = Number(offerData.totalWeight ?? 0);
    let totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransports = Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT);
        totalTransportCost = totalTransports * transportKm * transportRate;
    }

    // Przygotuj elementy (items) dla szablonu - grupowanie po średnicy DN
    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    let grandTotal = 0;

    wells.forEach((w) => {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        grandTotal += wellPrice;

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '—'),
            transportCost: Number(well.transportCost ?? 0)
        });
    });

    // Spłaszcz elementy (items) dla szablonu
    const items: Record<string, unknown>[] = [];
    for (const [_dn, dnItems] of Object.entries(itemsByDN)) {
        items.push(...dnItems);
    }

    logger.debug('PdfStudnie', `Przygotowano ${items.length} items, grandTotal: ${grandTotal}`);

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    // Pobierz dane autora i opiekuna handlowego z bazy danych (users)
    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    return {
        offerNumber: offer.offer_number || 'N/A',
        clientName: String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? offerData.clientNip ?? ''),
        clientAddress: String(client?.address ?? offerData.clientAddress ?? ''),
        clientPhone:
            String(offerData.clientContact ??
            client?.contact ??
            client?.phone ??
            offerData.clientPhone ??
            ''),
        investName: String(offerData.investName ?? offerData.budowa ?? ''),
        investAddress: String(offerData.investAddress ?? ''),
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        authorUser,
        guardianUser
    };
}

/**
 * Buduje kontekst StudnieOfferData dla ZAMÓWIENIA (documentType='order').
 * Czyta z orders_studnie_rel, z fallbackiem na offers_studnie_rel dla
 * kalkulacji cen (gdy w order.data brak wellsExport z obliczonymi cenami).
 */
export async function buildStudnieOrderContextFromOrderId(
    orderId: string
): Promise<StudnieOfferData> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie studni nie znalezione');
    }

    let orderData: Record<string, unknown> = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfStudnie', 'Błąd parsowania order.data', e);
    }

    // wellsExport: priorytet z order.data, fallback do powiązanej oferty
    let wells: unknown[] = [];
    if (Array.isArray(orderData.wellsExport)) {
        wells = orderData.wellsExport;
    } else if (order.offerStudnieId) {
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id: order.offerStudnieId }
        });
        if (offer?.data) {
            try {
                const offerData = JSON.parse(offer.data) as Record<string, unknown>;
                if (Array.isArray(offerData.wellsExport)) wells = offerData.wellsExport;
            } catch (e) {
                logger.warn('PdfStudnie', 'Błąd parsowania offer.data (fallback)', e);
            }
        }
    }

    // Oblicz transport (mirror z buildStudnieOfferContextFromOfferId)
    const transportKm = Number(orderData.transportKm ?? 0);
    const transportRate = Number(orderData.transportRate ?? 0);
    const totalWeight = Number(orderData.totalWeight ?? 0);
    const totalTransportCost =
        transportKm > 0 && transportRate > 0
            ? Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT) * transportKm * transportRate
            : 0;

    // Mapuj wells → items (identycznie jak w offer flow)
    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    wells.forEach((w) => {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '—'),
            transportCost: Number(well.transportCost ?? 0)
        });
    });
    const items: Record<string, unknown>[] = Object.values(itemsByDN).flat();

    const client = orderData.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: String(orderData.clientId) } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(orderData, order.userId);

    const orderNumber = String(orderData.orderNumber ?? orderId.substring(0, 8));
    return {
        documentType: 'order',
        offerNumber: orderNumber,
        orderNumber,
        productionOrderNumber: String(orderData.productionOrderNumber ?? ''),
        orderStatus: String(orderData.status ?? 'confirmed'),
        clientName: String(client?.name ?? orderData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? orderData.clientNip ?? ''),
        clientAddress: String(client?.address ?? orderData.clientAddress ?? ''),
        clientPhone:
            String(
                orderData.clientContact ??
                client?.contact ??
                client?.phone ??
                orderData.clientPhone ??
                ''
            ),
        investName: String(orderData.investName ?? orderData.budowa ?? ''),
        investAddress: String(orderData.investAddress ?? ''),
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(orderData.date ?? order.createdAt ?? new Date().toISOString()),
        validityDays: 0,
        notes: String(orderData.notes ?? ''),
        paymentTerms: String(orderData.paymentTerms ?? ''),
        validity: '',
        authorUser,
        guardianUser
    };
}

/**
 * Generuje PDF ZAMÓWIENIA (wariant oferty) na podstawie orderId.
 * Thin wrapper: buduje kontekst z orders_studnie_rel, potem wywołuje
 * generateStudniePDFFromContext z documentType='order'.
 */
export async function generateStudnieOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildStudnieOrderContextFromOrderId(orderId);
    return generateStudniePDFFromContext(ctx);
}

export interface UserContactInfo {
    name: string;
    email: string;
    phone: string;
}

export interface RuryOfferData {
    offerNumber: string;
    documentType?: 'offer' | 'order';
    orderNumber?: string;
    productionOrderNumber?: string;
    orderStatus?: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    investContractor: string;
    items: Array<Record<string, unknown>>;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}

export interface UserContactInfo {
    name: string;
    email: string;
    phone: string;
}

export interface StudnieOfferData {
    offerNumber: string;
    documentType?: 'offer' | 'order';
    orderNumber?: string;
    productionOrderNumber?: string;
    orderStatus?: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    items: Array<{
        productId?: string | null;
        productName?: string | null;
        quantity?: number | null;
        discount?: number | null;
        price?: number | null;
        dodatkowe_info?: string | null;
        DN?: string | null;
        height?: number;
        zwienczenie?: string;
    }>;
    transportCost: number;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}

/**
 * Generuje HTML oferty rur z szablonu ofertaRury.html.
 * Buduje wszystkie sekcje: dane klienta, inwestycji, tabele pozycji,
 * transport, podsumowanie, uwagi oraz dane kontaktowe.
 */
export async function generateRuryHTML(data: RuryOfferData): Promise<string> {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return new Date().toLocaleDateString('pl-PL');
        // Format YYYY-MM-DD z <input type="date"> traktuj jako local date (nie UTC),
        // żeby uniknąć przesunięcia dnia w strefach czasowych != UTC.
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
        try { return new Date(normalized).toLocaleDateString('pl-PL'); }
        catch { return dateStr; }
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtInt = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const validityString = data.validity || `${data.validityDays} dni`;
    const isOrder = data.documentType === 'order';
    const docNumber = isOrder && data.orderNumber ? data.orderNumber : data.offerNumber;
    const titleText = isOrder ? `ZAMÓWIENIE ${docNumber}` : `OFERTA HANDLOWA ${docNumber}`;
    const validitySection = isOrder
        ? ''
        : `<div><strong>Data ważności oferty:</strong> ${validityString}</div>`;

    // Załaduj szablon
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'ofertaRury.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Załaduj obrazy
    const naglowekPath = path.join(process.cwd(), 'public', 'images', 'letterhead-header.png');
    const stopkaPath = path.join(process.cwd(), 'public', 'images', 'letterhead-footer.png');
    let naglowekBase64 = '';
    let stopkaBase64 = '';
    try {
        const buf = fs.readFileSync(naglowekPath);
        naglowekBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) { logger.warn('PdfAssets', 'Brak letterhead-header.png', e); }
    try {
        const buf = fs.readFileSync(stopkaPath);
        stopkaBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) { logger.warn('PdfAssets', 'Brak letterhead-footer.png', e); }

    // Dane klienta
    const daneKlienta = `
    <div><strong>${escapeHtml(data.clientName)}</strong></div>
    ${data.clientAddress ? `<div>${escapeHtml(data.clientAddress)}</div>` : ''}
    ${data.clientNip ? `<div>NIP: ${escapeHtml(data.clientNip)}</div>` : ''}
    ${data.clientPhone ? `<div>Kontakt: ${escapeHtml(data.clientPhone)}</div>` : ''}
  `.trim();

    // Dane inwestycji
    const daneInwestycji = `
    ${data.investName ? `<div><strong>Budowa:</strong> ${escapeHtml(data.investName)}</div>` : '<div>\u2014</div>'}
    ${data.investAddress ? `<div>Adres: ${escapeHtml(data.investAddress)}</div>` : ''}
    ${data.investContractor ? `<div>Wykonawca: ${escapeHtml(data.investContractor)}</div>` : ''}
  `.trim();

    // Grupowanie pozycji po kategorii i średnicy
    const CATEGORY_ORDER = [
        'Rury Betonowe', 'Żelbetowe KL. A (II)', 'Żelbetowe KL. S (I)',
        'Duże Żelbetowe II', 'Rury Jajowe Betonowe', 'Rury Jajowe Żelbetowe',
        'Akcesoria PEHD', 'Uszczelki', 'Zabezpieczenie transportu'
    ];

    const getProductCategory = (item: Record<string, unknown>): string => {
        return String(item.category ?? 'Inne');
    };
    const getProductDiameter = (item: Record<string, unknown>): number => {
        const id = String(item.productId ?? '');
        const parts = id.split('-');
        if (parts.length >= 3) {
            const code = parseInt(parts[2]);
            if (!isNaN(code) && code > 0) return code * 100;
        }
        return 99999;
    };
    const isBosy = (item: Record<string, unknown>): boolean => {
        const name = String(item.name ?? '').toLowerCase();
        const id = String(item.productId ?? '');
        return name.includes('bosy') || id.endsWith('-B00');
    };

    // Grupowanie: kategoria → średnica → [items]
    const groupedByCat: Record<string, Record<string, Record<string, unknown>[]>> = {};
    for (const item of data.items) {
        const cat = getProductCategory(item);
        if (!groupedByCat[cat]) groupedByCat[cat] = {};
        const diam = getProductDiameter(item);
        const diamKey = diam < 99999 ? `DN ${diam}` : 'Inne';
        if (!groupedByCat[cat][diamKey]) groupedByCat[cat][diamKey] = [];
        groupedByCat[cat][diamKey].push(item);
    }

    // Budowanie tabeli pozycji
    let tabelaPozycji = '';
    let grandTotalNet = 0;
    let globalLp = 1;
    const sortedCats = Object.keys(groupedByCat).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    for (const cat of sortedCats) {
        const diamGroups = groupedByCat[cat];
        let catTotal = 0;

        // Sortuj średnice
        const sortedDiams = Object.keys(diamGroups).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });

        tabelaPozycji += `<div class="cat-section">
        <div class="cat-header">${cat}</div>
        <table class="offer-table">
          <thead>
            <tr>
              <th style="width:5%;">Lp.</th>
              <th>Nazwa / Indeks</th>
              <th style="width:10%;">Dł. [m]</th>
              <th style="width:10%;">Ilość [szt.]</th>
              <th style="width:11%;">Cena jedn.</th>
              <th class="nowrap">Suma netto [PLN]</th>
            </tr>
          </thead>
          <tbody>`;

        for (const diamKey of sortedDiams) {
            const itemsInDiam = diamGroups[diamKey];
            // Sortuj: bosy pierwsze, potem według długości
            itemsInDiam.sort((a, b) => {
                const aBB = isBosy(a);
                const bBB = isBosy(b);
                if (aBB !== bBB) return aBB ? -1 : 1;
                return (Number(a.lengthM ?? 0)) - (Number(b.lengthM ?? 0));
            });

            for (const item of itemsInDiam) {
                const name = String(item.name ?? '');
                const productId = String(item.productId ?? '');
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                const quantity = Number(item.quantity ?? 1);
                const discount = Number(item.discount ?? 0);
                const lengthM = Number(item.lengthM ?? 0);
                const meters = Number(item.meters ?? 0);
                const hasLength = lengthM > 0;
                const displayMeters = hasLength ? (meters > 0 ? meters : (lengthM / 1000) * quantity) : 0;
                const pehdType = String(item.pehdType ?? '');
                const pehdCost = Number(item.pehdCostPerUnit ?? 0);
                const surcharge = Number(item.surcharge ?? 0);
                const itemPrice = unitPrice * (1 - discount / 100) + pehdCost + surcharge;
                const netto = itemPrice * quantity;

                catTotal += netto;
                grandTotalNet += netto;

                let displayName = name;
                if (pehdType === 'PEHD-3MM') displayName += ' PEHD 3mm';
                if (pehdType === 'PEHD-4MM') displayName += ' PEHD 4mm';

                tabelaPozycji += `<tr>
              <td class="text-center">${globalLp}</td>
              <td>${displayName}<br><span style="font-size:6.5pt;color:#${DOCX_COLORS.headerText};">${productId}</span></td>
              <td class="text-center">${hasLength ? displayMeters.toFixed(2) : '\u2014'}</td>
              <td class="text-center">${fmtInt(quantity)}</td>
              <td class="text-right">${formatCurrency(unitPrice)}</td>
              <td class="text-right bold nowrap">${formatCurrency(netto)}</td>
            </tr>`;
                globalLp++;
            }
        }

        // Wiersz podsumowania kategorii
        tabelaPozycji += `<tr class="cat-summary-row">
          <td colspan="4"></td>
          <td class="text-right">Suma:</td>
          <td class="text-center bold">${formatCurrency(catTotal)} PLN</td>
        </tr>`;

        tabelaPozycji += '</tbody></table></div>';
    }

    // Podsumowanie
    const podsumowanie = `<div class="summary-section">
    <table class="summary-table">
      <tr class="grand-total">
        <td class="text-center" style="width:60%;">SUMA NETTO</td>
        <td class="text-center" style="width:40%;">${formatCurrency(grandTotalNet)} PLN</td>
      </tr>
    </table>
  </div>`;

    // Uwagi
    let sekcjaUwagi = '';
    if (data.notes) {
        sekcjaUwagi += `<div class="notes-section"><div class="note-box">${escapeHtml(data.notes).replace(/\n/g, '<br>')}</div></div>`;
    }
    if (data.paymentTerms) {
        sekcjaUwagi += `<div class="conditions" style="margin-top:10px;"><div><strong>Warunki płatności:</strong> ${escapeHtml(data.paymentTerms).replace(/\n/g, '<br>')}</div></div>`;
    }

    // Statyczne warunki handlowe
    const warunkiStatyczne = buildRuryStaticTermsHTML();

    // Dane kontaktowe
    const daneKontaktowe = buildContactSectionHTML(data.authorUser || null, data.guardianUser || null);

    // Zastąp placeholdery
    let html = template;
    html = html.replace(/\{\{TYTUL_DOKUMENTU\}\}/g, escapeHtml(titleText));
    html = html.replace(/\{\{VALIDITY_SECTION\}\}/g, validitySection);
    html = html.replace(/\{\{NR_OFERTY\}\}/g, docNumber);
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDate(data.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    html = html.replace(/\{\{TABELA_POZYCJI\}\}/g, tabelaPozycji);
    html = html.replace(/\{\{TABELA_TRANSPORTU\}\}/g, '');
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, podsumowanie);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{WARUNKI_STATYCZNE\}\}/g, warunkiStatyczne);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}

/**
 * Buduje statyczne warunki handlowe dla oferty rur (HTML).
 * Identyczne warunki jak w ofertaStudnie.html (pasują do obu typów).
 */
function buildRuryStaticTermsHTML(): string {
    return `
    <span style="font-size:9pt;font-weight:700;color:#${DOCX_COLORS.headerText};margin-bottom:5px;display:block;">Informacje dodatkowe i ogólne warunki:</span>

    <p>Transport rur w średnicach DN 300 – DN 2200 odbywa się na jednorazowych podkładach drewnianych jako „Zabezpieczenie transportu". Koszt podkładów zostanie zafakturowany na fakturze VAT wg poniższego zestawienia (wartości w tabeli podają cenę Zabezpieczenia transportu do jednej sztuki rury).</p>

    <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:7.5pt;">
      <thead>
        <tr style="background:#${DOCX_COLORS.headerBg};">
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Zabezpieczenie transportu wg średnicy rur</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Cena netto [PLN]</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Zabezpieczenie transportu wg średnicy rur</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Cena netto [PLN]</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 300</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">13,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1400</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 400</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">13,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1500</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 500</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">14,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1600</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 600</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">20,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1800</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">230,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 800</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">20,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 2000</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">310,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1000</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">40,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 2200</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">310,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1200</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">50,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu WPUST ULICZNY</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">14,00</td></tr>
      </tbody>
    </table>

    <p>Dla rur powyżej średnicy DN1200 oferujemy kotwy montażowe 45 PLN/szt. w rurze są montowane dwie kotwy.<br />Sprzęgi uniwersalne mogą być przez nas dostarczane za kaucją 2300 PLN/szt., na wyraźne zamówienie. Po zwrocie w stanie nieuszkodzonym zostanie z kaucji potrącone 40% jako koszty własne P.V. Prefabet S.A. i amortyzacja.</p>

    <p>Do montażu rur i studni P.V. Prefabet Kluczbork S.A. oferuje środek poślizgowy w wiaderkach 5kg w cenie 225 PLN.<br />Dedykowany środek poślizgowy ułatwia montaż, nie wpływa negatywnie na uszczelki przez co gwarantujemy szczelność naszych wyrobów. W celu prawidłowego montażu rur i studni do każdego transportu studni i co do drugiego transportu rur należy uwzględnić 5kg środka poślizgowego. Koszt środka poślizgowego stanowi osobną pozycję na fakturze. Zastosowanie innych środków o nieznanym składzie chemicznym może negatywnie wpłynąć na szczelność połączeń, a tym samym wyklucza odpowiedzialność gwarancyjną Producenta.</p>

    <p style="margin-top:10px;"><strong>Termin realizacji zamówienia:</strong> I partia towaru według indywidualnych ustaleń z doradcą techniczno-handlowym. Zamówienie należy złożyć w formie pisemnej z wszystkimi istotnymi parametrami potrzebnymi do zrealizowania zamówienia.</p>

    <p style="margin-top:5px;">Odstąpienie od złożonego zamówienia powoduje konieczność zapłaty 100% wartości wyprodukowanego towaru oraz pokrycie kosztów przygotowania produkcji.</p>

    <p style="margin-top:10px;">Ceny podane w ofercie uwzględniają rabat obowiązujący przy terminowym uregulowaniu należności oraz przy zamówieniu całości asortymentu objętego ofertą.</p>

    <p style="margin-top:10px;">Po otrzymaniu zamówienia na kwotę wyższą niż 50 tys. PLN netto P.V. Prefabet Kluczbork S.A. przedstawi umowę określającą warunki dostaw, która zostanie podpisana przed rozpoczęciem dostaw.<br />P.V. Prefabet Kluczbork S.A. ubezpiecza wszystkie transakcje z odroczonym terminem płatności, w związku z tym sprzedaż na przelew może nastąpić po weryfikacji przez firmę ubezpieczeniową i ubezpieczeniu transakcji. Procedura ubezpieczenia trwa do 10 dni roboczych, a wszelkie formalności i koszty leżą po stronie P.V. Prefabet Kluczbork S.A.</p>

    <p style="margin-top:10px;">Wszelkie spory mogące wyniknąć w związku z realizacją zamówienia, Strony poddają pod rozstrzygnięcie sądu powszechnego właściwego dla siedziby Dostawcy.</p>

    <p style="margin-top:10px;">Niewymienione elementy dodatkowe (elementy do wbudowania, powłoki itp.) nie są częścią tej oferty.<br />Wszelkie zmiany ilościowe bądź jakościowe w zamówieniu korygowane będą poprzez wystawienie kolejnej oferty cenowej lub ustaleniach między stronami.<br />Cena loco budowa przy zamówieniu na całość zadania i dostawie pełnych transportów 24-tonowych. W przypadku niepełnych dostaw zostanie doliczony dodatkowy koszt transportu.</p>

    <p style="margin-top:10px;">Drogi dojazdowe do miejsca budowy muszą być przejezdne dla pojazdów ciężkich (ładowność 24 tony). Zleceniodawca jest odpowiedzialny za zapewnienie odpowiedniego dojazdu i miejsca rozładunku na budowie. Rozładunek oraz wynajęcie dźwigu na miejscu budowy leży po stronie zamawiającego.<br />Oferta standardowa obejmuje jedno miejsce rozładunku. W przypadku, gdy miejsc rozładunku jest więcej - za każde dodatkowe miejsce rozładunku klient płaci 500 PLN.<br />Standardowy czas rozładunku wyrobów wynosi maksymalnie do 1,5 godz. Za każdą następną rozpoczętą godzinę klient zapłaci 200 PLN netto. Czas liczony jest od momentu zgłoszenia przez kierowcę osobie upoważnionej gotowości do rozładunku.</p>

    <p style="margin-top:10px;">W przypadku wzrostu cen materiałów wsadowych (cement, kruszywa, usługi transportowe itp.) powyżej 3 % zastrzegamy sobie prawo zmiany cen.</p>

    <p style="margin-top:10px;">Na oferowane prefabrykaty betonowe i żelbetowe udzielamy 36 miesięcy gwarancji licząc od daty podpisania dokumentu WZ pod warunkiem montażu ze sztuką budowlaną i zgodnie z dokumentacją techniczną producenta (instrukcje montażu wyrobów do pobrania na stronie <a href="http://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl</a>).<br />W zamówieniach prosimy powoływać się na nr niniejszej oferty.</p>

    <p style="margin-top:10px;">Parametry techniczne oferowanych wyrobów, według odpowiednich deklaracji dostępnych na <a href="https://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">https://www.pv-prefabet.com.pl</a> lub po przesłaniu przez odpowiedni dział P.V. Prefabet Kluczbork S.A.</p>

    <p style="margin-top:10px;">Obligatoryjnym załącznikiem do niniejszej oferty są Ogólne Warunki Sprzedaży dostępne na stronie internetowej <a href="http://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl</a> oraz Polityka Prywatności dostępna na stronie internetowej <a href="http://www.pv-prefabet.com.pl/rodo-dane" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl/rodo-dane</a></p>

    <p style="margin-top:15px;font-weight:bold;font-size:8.5pt;">Dziękujemy Państwu za zainteresowanie ofertą naszej firmy i mamy nadzieję na dalszą owocną współpracę.</p>
  `.trim();
}

/**
 * Pobiera dane autora i opiekuna oferty z bazy users
 */
export async function lookupOfferUsers(
    offerData: Record<string, unknown>,
    offerUserId?: string | null
): Promise<{ authorUser: UserContactInfo | null; guardianUser: UserContactInfo | null }> {
    const formatUserName = (u: Record<string, unknown>): string =>
        u.firstName && u.lastName ? `${String(u.firstName)} ${String(u.lastName)}` : String(u.username);

    let guardianUser: UserContactInfo | null = null;
    let authorUser: UserContactInfo | null = null;

    // Opiekun handlowy: userId z oferty
    const guardianId = typeof offerData.userId === 'string' ? offerData.userId : offerUserId;
    if (guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: guardianId } });
            if (u)
                guardianUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać opiekuna (guardian)', e);
        }
    }

    // Autor oferty: createdByUserId
    const authorId = typeof offerData.createdByUserId === 'string' ? offerData.createdByUserId : undefined;
    if (authorId && authorId !== guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: authorId } });
            if (u)
                authorUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać autora', e);
        }
    } else if (authorId && authorId === guardianId) {
        // Jeżeli autor = opiekun, nie duplikuj
        authorUser = null;
    }

    return { authorUser, guardianUser };
}

/**
 * Buduje sekcję kontaktową HTML z danymi autora i opiekuna.
 * Identyczna struktura jak w frontend offerPrintManager.js → renderUser().
 */
export function buildContactSectionHTML(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): string {
    const renderUser = (title: string, u: UserContactInfo): string => {
        let ht = '<td style="vertical-align:top; width:50%; padding:4px 8px;">';
        ht += `<strong style="color:#${DOCX_COLORS.headerText};">${title}:</strong><br>`;
        ht += `<strong>${u.name}</strong><br>`;
        if (u.email)
            ht += `Email: <a href="mailto:${u.email}" style="color:#${DOCX_COLORS.labelText};text-decoration:none;">${u.email}</a><br>`;
        if (u.phone) ht += `Telefon: ${u.phone}`;
        ht += '</td>';
        return ht;
    };

    let html =
        '<div style="margin-top:20px; padding-top:10px; border-top:1.5px solid #${DOCX_COLORS.headerText}; font-size:9pt;">';

    if (!guardianUser && !authorUser) {
        html += '<p>W razie pytań prosimy o kontakt z opiekunem oferty.</p>';
    } else {
        html += '<table style="width:100%; border:none;"><tr>';
        if (authorUser) {
            html += renderUser('Ofertę przygotował(-a)', authorUser);
        }
        if (guardianUser) {
            html += renderUser('Opiekun handlowy (kontakt)', guardianUser);
        }
        html += '</tr></table>';
    }

    html += '</div>';
    return html;
}

export async function generateStudnieHTML(data: StudnieOfferData): Promise<string> {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return new Date().toLocaleDateString('pl-PL');
        // Format YYYY-MM-DD z <input type="date"> traktuj jako local date (nie UTC).
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
        try {
            return new Date(normalized).toLocaleDateString('pl-PL');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const validityString = data.validity || '30 dni';
    const isOrder = data.documentType === 'order';
    const docNumber = isOrder && data.orderNumber ? data.orderNumber : data.offerNumber;
    const titleText = isOrder ? `ZAMÓWIENIE ${docNumber}` : `OFERTA HANDLOWA ${docNumber}`;
    const validitySection = isOrder
        ? ''
        : `<div><strong>Data ważności oferty:</strong> ${validityString}</div>`;

    // Załaduj szablon
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'ofertaStudnie.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Załaduj obrazy nagłówka i stopki jako URI danych base64
    const naglowekPath = path.join(process.cwd(), 'public', 'images', 'letterhead-header.png');
    const stopkaPath = path.join(process.cwd(), 'public', 'images', 'letterhead-footer.png');
    let naglowekBase64 = '';
    let stopkaBase64 = '';
    try {
        const naglowekBuf = fs.readFileSync(naglowekPath);
        naglowekBase64 = `data:image/png;base64,${naglowekBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować letterhead-header.png', e);
    }
    try {
        const stopkaBuf = fs.readFileSync(stopkaPath);
        stopkaBase64 = `data:image/png;base64,${stopkaBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować letterhead-footer.png', e);
    }

    // Budowanie danych klienta
    const daneKlienta = `
    <div><strong>${escapeHtml(data.clientName)}</strong></div>
    ${data.clientAddress ? `<div>${escapeHtml(data.clientAddress)}</div>` : ''}
    ${data.clientNip ? `<div>NIP: ${escapeHtml(data.clientNip)}</div>` : ''}
    ${data.clientPhone ? `<div>Kontakt: ${escapeHtml(data.clientPhone)}</div>` : ''}
  `.trim();

    // Budowanie danych inwestycji
    const daneInwestycji = `
    ${data.investName ? `<div><strong>Budowa:</strong> ${escapeHtml(data.investName)}</div>` : '<div>—</div>'}
    ${data.investAddress ? `<div>Adres: ${escapeHtml(data.investAddress)}</div>` : ''}
  `.trim();

    // Grupowanie elementów według średnicy DN
    const itemsByDN: Record<string, typeof data.items> = {};
    for (const item of data.items) {
        const dn = item.DN || item.dodatkowe_info || 'Inne';
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push(item);
    }

    // Buduj tabele dla każdej średnicy DN - zgodnie z formatem buildDiameterTableHtml z frontendu
    let tabeleDN = '';
    let grandTotal = 0;
    const dnOrder = ['1000', '1200', '1500', '2000', '2500', 'styczna', 'Inne'];

    for (const dn of dnOrder) {
        if (!itemsByDN[dn]) continue;
        const dnItems = itemsByDN[dn];
        const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;

        const dnTotal = dnItems.reduce((sum, item) => {
            return sum + (item.price || 0);
        }, 0);
        grandTotal += dnTotal;

        const rows = dnItems
            .map((item, idx) => {
                const price = item.price || 0;
                const wellName = item.productName || '—';
                const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
                const height = item.height || 0;
                const zwienczenie = item.zwienczenie || '—';

                return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td class="text-center bold">${wellName}</td>
          <td class="text-center">${dnDisplay}</td>
          <td class="text-center">${fmtInt(height)}</td>
          <td class="zwienczenie-cell text-center">${zwienczenie}</td>
          <td class="text-center bold">${formatCurrency(price)}</td>
        </tr>
      `;
            })
            .join('');

        tabeleDN += `
      <div class="dn-section">
        <div class="dn-header">${dnLabel}</div>
        <table class="offer-table">
          <thead>
            <tr>
              <th style="width:5%;">Lp.</th>
              <th style="width:30%;">Nr studni</th>
              <th style="width:10%;">Średnica</th>
              <th style="width:8%;">H [mm]</th>
              <th style="width:32%;">Zwieńczenie</th>
              <th style="width:15%;">Cena netto [PLN]</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="dn-summary-row">
              <td colspan="4"></td>
              <td class="text-right">Razem ${dnLabel} (${dnItems.length} szt.):</td>
              <td class="text-center">${formatCurrency(dnTotal)} PLN</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }

    const summariesForTotal: Array<{ label: string; count: number; totalPrice: number }> = [];
    for (const dn of dnOrder) {
        if (itemsByDN[dn]) {
            const label = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
            const total = itemsByDN[dn].reduce(
                (sum, it) => sum + (Number((it as Record<string, unknown>).price ?? 0)),
                0
            );
            summariesForTotal.push({ label, count: itemsByDN[dn].length, totalPrice: total });
        }
    }

    // Budowanie podsumowania - zgodne z formatem frontend offerPrintManager.js → buildOfferSummaryHtml()

    let summaryRows = '';
    for (const s of summariesForTotal) {
        summaryRows += `<tr>
      <td class="text-center">${s.label}</td>
      <td class="text-center">${s.count} szt.</td>
      <td class="text-center bold">${formatCurrency(s.totalPrice)} PLN</td>
    </tr>`;
    }
    summaryRows += `<tr class="grand-total">
    <td class="text-center">RAZEM NETTO</td>
    <td class="text-center">${summariesForTotal.reduce((s, x) => s + x.count, 0)} szt.</td>
    <td class="text-center">${formatCurrency(grandTotal)} PLN</td>
  </tr>`;

    const podsumowanie = `
    <div class="summary-section">
      <h3>Podsumowanie oferty</h3>
      <table class="summary-table">
        ${summaryRows}
      </table>
    </div>
  `;

    // Budowanie sekcji uwag i warunków płatności
    let sekcjaUwagi = '';
    if (data.notes) {
        sekcjaUwagi += `
    <div class="notes-section">
      <div class="note-box">${escapeHtml(data.notes).replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }
    if (data.paymentTerms) {
        sekcjaUwagi += `
    <div class="conditions" style="margin-top: 10px;">
      <div><strong>Warunki płatności:</strong> ${escapeHtml(data.paymentTerms).replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }

    // Budowanie sekcji danych kontaktowych — autor + opiekun
    const daneKontaktowe = buildContactSectionHTML(
        data.authorUser || null,
        data.guardianUser || null
    );

    // Zastąp symbole zastępcze (placeholders) - użyj obrazów base64 dla nagłówka/stopki
    let html = template;
    html = html.replace(/\{\{TYTUL_DOKUMENTU\}\}/g, escapeHtml(titleText));
    html = html.replace(/\{\{VALIDITY_SECTION\}\}/g, validitySection);
    html = html.replace(/\{\{NR_OFERTY\}\}/g, docNumber);
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDate(data.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    html = html.replace(/\{\{TABELE_DN\}\}/g, tabeleDN);
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, podsumowanie);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    // Zastąp {{BASE_URL}} rzeczywistymi obrazami base64
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);
    // Fallback: usuń pozostałe symbole zastępcze {{BASE_URL}}
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}

async function generatePDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '15mm',
                bottom: '10mm',
                left: '15mm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

export async function generateKartaBudowyPDF(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_studnie_rel.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        throw new Error('Zamówienie studni nie znaleziona');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('PdfKartaBudowy', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'kartaBudowy.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    const nrZamowienia = String(orderData.orderNumber || orderData.id || String(order.id).substring(0, 8));
    const nrOferty = String(orderData.offerNumber || orderData.number || (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '—'));

    html = html.replace(/\{\{NR_ZAMOWIENIA\}\}/g, nrZamowienia);
    html = html.replace(/\{\{OFFER_NUMBERS\}\}/g, nrOferty);
    html = html.replace(/\{\{DATA_ZAMOWIENIA\}\}/g, String(kb.dataZamowienia || '—'));
    html = html.replace(/\{\{OSOBA_KONTAKT\}\}/g, String(kb.osobaKontakt || '—'));
    html = html.replace(/\{\{ADRES_WYSYLKI\}\}/g, String(kb.adresWysylki || '—'));
    html = html.replace(/\{\{EMAIL_FAKTURA\}\}/g, String(kb.emailFaktura || '—'));
    html = html.replace(/\{\{EMAIL_EFAKTURA\}\}/g, String(kb.emailEfaktura || '—'));
    
    html = html.replace(/\{\{WARUNKI_PLATNOSCI\}\}/g, String(kb.warunkiPlatnosci || '—'));
    html = html.replace(/\{\{ILOSC_DNI\}\}/g, String(kb.iloscDni || '—'));
    html = html.replace(/\{\{RODZAJ_TRANSPORTU\}\}/g, String(kb.rodzajTransportu || '—'));
    html = html.replace(/\{\{WYLICZONY_TRANSPORT\}\}/g, String(kb.wyliczonyTransport || '—'));
    html = html.replace(/\{\{ZABEZPIECZENIE_TRANSPORTU\}\}/g, String(kb.zabezpieczenieTransportu || '—'));
    html = html.replace(/\{\{UBEZPIECZENIE\}\}/g, String(kb.ubezpieczenie || '—'));
    
    html = html.replace(/\{\{RODZAJ_STUDNI\}\}/g, String(kb.rodzajStudni || '—'));
    html = html.replace(/\{\{WLASCIWOSCI_BETONU\}\}/g, String(kb.wlasciwosciBetonu || '—'));
    html = html.replace(/\{\{POZOSTALE_WLASCIWOSCI\}\}/g, String(kb.pozostaleWlasciwosci || '—'));
    html = html.replace(/\{\{RODZAJ_STOPNI\}\}/g, String(kb.rodzajStopni || '—'));
    html = html.replace(/\{\{RODZAJ_STOPNI_INNE\}\}/g, kb.rodzajStopniInne ? `(${kb.rodzajStopniInne})` : '');
    html = html.replace(/\{\{USZCZELKA_STUDNI\}\}/g, String(kb.uszczelkaStudni || '—'));
    html = html.replace(/\{\{USZCZELKA_INNE\}\}/g, kb.uszczelkaStudniInne ? `(${kb.uszczelkaStudniInne})` : '');
    
    html = html.replace(/\{\{KINETA\}\}/g, String(kb.kineta || '—'));
    html = html.replace(/\{\{KINETA_INNE\}\}/g, kb.kinetaInne ? `(${kb.kinetaInne})` : '');
    html = html.replace(/\{\{REDUKCJA_KINETY\}\}/g, String(kb.redukcjaKinety || '—'));
    html = html.replace(/\{\{USYTUOWANIE\}\}/g, String(kb.usytuowanie || '—'));
    html = html.replace(/\{\{WYSOKOSC_SPOCZNIKA\}\}/g, String(kb.wysokoscSpocznika || '—'));
    html = html.replace(/\{\{SLEPA_KINETA\}\}/g, String(kb.slepaKineta || '—'));
    html = html.replace(/\{\{SLEPA_KINETA_UWAGI\}\}/g, kb.slepaKinetaUwagi ? `(${kb.slepaKinetaUwagi})` : '');
    html = html.replace(/\{\{KASKADA\}\}/g, String(kb.kaskada || '—'));
    html = html.replace(/\{\{KASKADA_UWAGI\}\}/g, kb.kaskadaUwagi ? `(${kb.kaskadaUwagi})` : '');
    
    html = html.replace(/\{\{PRZEJSCIA_SZCZELNE\}\}/g, String(kb.przejsciaSzczelne || '—'));
    html = html.replace(/\{\{PRZEJSCIA_TULEJOWE\}\}/g, String(kb.przejsciaTulejowe || '—'));
    html = html.replace(/\{\{PRZEJSCIA_ZAMOWIONE\}\}/g, String(kb.przejsciaZamowione || '—'));
    
    html = html.replace(/\{\{UWAGI_OGOLNE\}\}/g, String(kb.uwagiOgolne || '—').replace(/\n/g, '<br>'));

    // Tabela przejść
    let tabelaPrzejsciaHTML = '';
    const pd = kb.przejsciaDetails;
    if (Array.isArray(pd) && pd.length > 0) {
        let trs = pd.map((p, idx) => {
            const pp = p as Record<string, unknown>;
            return `<tr>
                <td>${idx + 1}</td>
                <td>${pp.rodzaj || '—'}</td>
                <td>${pp.dnOd || '—'}</td>
                <td>${pp.dnDo || '—'}</td>
                <td>${pp.uwagi || '—'}</td>
                <td>${pp.czyPrzejscie || '—'}</td>
            </tr>`;
        }).join('');
        
        tabelaPrzejsciaHTML = `
        <div class="section-header">Szczegóły przejść</div>
        <table class="przejscia-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Lp.</th>
                    <th style="width: 28%;">Rodzaj przejścia</th>
                    <th style="width: 14%;">DN OD</th>
                    <th style="width: 14%;">DN DO</th>
                    <th style="width: 26%;">Uwagi</th>
                    <th style="width: 10%;">Czy przejście?</th>
                </tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>`;
    }
    html = html.replace(/\{\{TABELA_PRZEJSCIA\}\}/g, tabelaPrzejsciaHTML);

    // ── Products catalog ──────────────────────────────────────
    const allProducts = new Map<string, { componentType: string; category: string; dn: number | string; height: number }>();
    try {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'products_studnie.json');
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const products: any[] = JSON.parse(raw);
      for (const p of products) {
        allProducts.set(p.id, { componentType: p.componentType || '', category: p.category || '', dn: p.dn || 0, height: p.height || 0 });
      }
    } catch (e) {
      logger.warn('PdfKartaBudowy', 'Nie udało się załadować produktów', e);
    }

    function _findPrzejscieByIdPrefix(products: Map<string, { componentType: string; category: string; dn: number | string; height: number }>, productId: string): { componentType: string; category: string; dn: number | string; height: number } | undefined {
      for (const [id, p] of products) {
        if (id.startsWith(productId) && p.componentType === 'przejscie') return p;
      }
      return undefined;
    }

    const wsz = (Array.isArray(orderData.wells) ? orderData.wells : []) as any[];

    // ── Rzeczywista ilość przejść w zamówieniu ────────────────
    interface TransSummary { cat: string; dn: number | string; cntD: number; cntOT: number; cntTotal: number; }
    const tCounts = new Map<string, TransSummary>();

    for (const w of wsz) {
      const segments: { start: number; end: number; isDennica: boolean; isOT: boolean }[] = [];
      const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
      const relevant = cfg.filter((item: any) => {
        const prod = allProducts.get(item.productId);
        return prod && (prod.componentType === 'dennica' || prod.componentType === 'krag' || prod.componentType === 'krag_ot');
      });
      let y = 0;
      for (const item of [...relevant].reverse()) {
        const prod = allProducts.get(item.productId);
        if (!prod || !prod.height) continue;
        const h = prod.height * (item.quantity || 1);
        segments.push({ start: y, end: y + h, isDennica: prod.componentType === 'dennica', isOT: prod.componentType === 'krag_ot' });
        y += h;
      }

      const rzdDna = parseFloat(w.rzednaDna);
      if (isNaN(rzdDna)) continue;

      const pjs = (Array.isArray(w.przejscia) ? w.przejscia : []) as any[];
      for (const pj of pjs) {
        let prod = allProducts.get(pj.productId);
        if (!prod || prod.componentType !== 'przejscie') {
          prod = _findPrzejscieByIdPrefix(allProducts, pj.productId);
          if (!prod) continue;
        }
        const rzdPj = parseFloat(pj.rzednaWlaczenia);
        if (isNaN(rzdPj)) continue;
        const mmFromBottom = (rzdPj - rzdDna) * 1000;

        let inD = false, inOT = false;
        for (const seg of segments) {
          if (mmFromBottom >= seg.start && mmFromBottom < seg.end) {
            if (seg.isDennica) inD = true;
            else if (seg.isOT) inOT = true;
            break;
          }
        }

        const cat = prod.category || 'Nieznany';
        const dn = prod.dn || 0;
        const key = `${cat}_${dn}`;
        let ex = tCounts.get(key);
        if (!ex) { ex = { cat, dn, cntD: 0, cntOT: 0, cntTotal: 0 }; tCounts.set(key, ex); }
        ex.cntTotal++;
        if (inD) ex.cntD++;
        if (inOT) ex.cntOT++;
      }
    }

    let realTransHTML = '';
    if (tCounts.size > 0) {
      const sorted = [...tCounts.values()].sort((a, b) => {
        if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
        const dnA = typeof a.dn === "string" ? parseFloat(a.dn.split("/")[0]) || 0 : a.dn;
        const dnB = typeof b.dn === "string" ? parseFloat(b.dn.split("/")[0]) || 0 : b.dn;
        return dnA - dnB;
      });
      let gD = 0, gOT = 0, gTotal = 0;
      for (const r of sorted) { gD += r.cntD; gOT += r.cntOT; gTotal += r.cntTotal; }
      const rows = sorted.map((row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${row.cat}</td>
        <td>DN${row.dn}</td>
        <td>${row.cntD}</td>
        <td>${row.cntOT}</td>
        <td>${row.cntTotal}</td>
      </tr>`).join('');
      realTransHTML = `
        <div class="page-break"></div>
        <div class="section-header">Rzeczywista ilość przejść w zamówieniu</div>
        <table class="przejscia-table">
          <thead>
            <tr>
              <th style="width:8%;">Lp.</th>
              <th style="width:30%;">Rodzaj przejścia</th>
              <th style="width:14%;">Średnica (DN)</th>
              <th style="width:16%;">Dennica</th>
              <th style="width:16%;">Kręgi wiercone</th>
              <th style="width:16%;">Suma</th>
            </tr>
          </thead>
          <tbody>${rows}
            <tr class="total-row">
              <td></td>
              <td style="text-align:center;font-weight:700;">Razem</td>
              <td></td>
              <td style="font-weight:700;">${gD}</td>
              <td style="font-weight:700;">${gOT}</td>
              <td style="font-weight:700;">${gTotal}</td>
            </tr>
          </tbody>
        </table>`;
    }
    html = html.replace(/\{\{RZECZYWISTA_ILOSC_PRZEJSC\}\}/g, realTransHTML);

    // ── Ilość elementów w zamówieniu ──────────────────────────
    const TYPE_LABELS: Record<string, string> = {
      dennica: 'Dennica', krag: 'Krąg', krag_ot: 'Krąg wiercony',
      konus: 'Konus', plyta_din: 'Płyta DIN', plyta_redukcyjna: 'Płyta redukcyjna',
      avr: 'AVR', styczna: 'Studnia styczna',
      uszczelka: 'Uszczelka',
      pierscien_odciazajacy: 'Pierścień odciążający',
      plyta_zamykajaca: 'Płyta zamykająca', plyta_najazdowa: 'Płyta najazdowa',
    };
    const TYPE_ORDER = ['dennica', 'krag', 'krag_ot', 'konus', 'plyta_din', 'plyta_redukcyjna',
      'avr', 'styczna', 'uszczelka', 'pierscien_odciazajacy',
      'plyta_zamykajaca', 'plyta_najazdowa'];

    const elemMap = new Map<string, { pid: string; type: string; desc: string; qty: number }>();
    for (const w of wsz) {
      const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
      for (const item of cfg) {
        const prod = allProducts.get(item.productId);
        const ct = prod?.componentType || '';
        if (ct === 'wlaz' || ct === 'kineta') continue;
        const key = item.productId;
        const ex = elemMap.get(key);
        if (ex) { ex.qty += (item.quantity || 1); continue; }
        const label = TYPE_LABELS[ct] || ct || '—';
        const dnStr = prod?.dn ? `DN${prod.dn}` : '';
        const hStr = prod?.height ? `H=${prod.height}mm` : '';
        const desc = [dnStr, hStr].filter(Boolean).join(', ') || item.frozenName || item.productId;
        elemMap.set(key, { pid: item.productId, type: label, desc, qty: item.quantity || 1 });
      }
    }

    let elemHTML = '';
    if (elemMap.size > 0) {
      const sorted = [...elemMap.values()].sort((a, b) => {
        const aCt = allProducts.get(a.pid)?.componentType || '';
        const bCt = allProducts.get(b.pid)?.componentType || '';
        const r = TYPE_ORDER.indexOf(aCt) - TYPE_ORDER.indexOf(bCt);
        return r !== 0 ? r : a.pid.localeCompare(b.pid);
      });
      let totalQty = 0;
      for (const r of sorted) totalQty += r.qty;
      const rows = sorted.map((row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${row.pid}</td>
        <td style="text-align:left;">${row.type}</td>
        <td style="text-align:left;">${row.desc}</td>
        <td>${row.qty}</td>
      </tr>`).join('');
      elemHTML = `
        <div class="section-header">Ilość elementów w zamówieniu</div>
        <table class="przejscia-table">
          <thead>
            <tr>
              <th style="width:8%;">Lp.</th>
              <th style="width:22%;">Indeks</th>
              <th style="width:20%;">Typ elementu</th>
              <th style="width:30%;">Opis</th>
              <th style="width:20%;">Ilość</th>
            </tr>
          </thead>
          <tbody>${rows}
            <tr class="total-row">
              <td></td>
              <td></td>
              <td style="text-align:center;font-weight:700;">Razem</td>
              <td></td>
              <td style="font-weight:700;">${totalQty}</td>
            </tr>
          </tbody>
        </table>`;
    }
    html = html.replace(/\{\{ILOSC_ELEMENTOW_ZAMOWIENIA\}\}/g, elemHTML);

    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return generatePDF(html);
}

export async function generateKartaBudowyRuryPDF(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_rury_rel.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('PdfKartaBudowyRury', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'kartaBudowy.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    const nrZamowienia = String(orderData.orderNumber || orderData.id || String(order.id).substring(0, 8));
    const nrOferty = String(orderData.offerNumber || orderData.number || (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '—'));

    html = html.replace(/\{\{NR_ZAMOWIENIA\}\}/g, nrZamowienia);
    html = html.replace(/\{\{OFFER_NUMBERS\}\}/g, nrOferty);
    html = html.replace(/\{\{DATA_ZAMOWIENIA\}\}/g, String(kb.dataZamowienia || '—'));
    html = html.replace(/\{\{OSOBA_KONTAKT\}\}/g, String(kb.osobaKontakt || '—'));
    html = html.replace(/\{\{ADRES_WYSYLKI\}\}/g, String(kb.adresWysylki || '—'));
    html = html.replace(/\{\{EMAIL_FAKTURA\}\}/g, String(kb.emailFaktura || '—'));
    html = html.replace(/\{\{EMAIL_EFAKTURA\}\}/g, String(kb.emailEfaktura || '—'));
    
    html = html.replace(/\{\{WARUNKI_PLATNOSCI\}\}/g, String(kb.warunkiPlatnosci || '—'));
    html = html.replace(/\{\{ILOSC_DNI\}\}/g, String(kb.iloscDni || '—'));
    html = html.replace(/\{\{RODZAJ_TRANSPORTU\}\}/g, String(kb.rodzajTransportu || '—'));
    html = html.replace(/\{\{WYLICZONY_TRANSPORT\}\}/g, String(kb.wyliczonyTransport || '—'));
    html = html.replace(/\{\{ZABEZPIECZENIE_TRANSPORTU\}\}/g, String(kb.zabezpieczenieTransportu || '—'));
    html = html.replace(/\{\{UBEZPIECZENIE\}\}/g, String(kb.ubezpieczenie || '—'));
    
    html = html.replace(/\{\{RODZAJ_STUDNI\}\}/g, String(kb.rodzajStudni || '—'));
    html = html.replace(/\{\{WLASCIWOSCI_BETONU\}\}/g, String(kb.wlasciwosciBetonu || '—'));
    html = html.replace(/\{\{POZOSTALE_WLASCIWOSCI\}\}/g, String(kb.pozostaleWlasciwosci || '—'));
    html = html.replace(/\{\{RODZAJ_STOPNI\}\}/g, String(kb.rodzajStopni || '—'));
    html = html.replace(/\{\{RODZAJ_STOPNI_INNE\}\}/g, kb.rodzajStopniInne ? `(${kb.rodzajStopniInne})` : '');
    html = html.replace(/\{\{USZCZELKA_STUDNI\}\}/g, String(kb.uszczelkaStudni || '—'));
    html = html.replace(/\{\{USZCZELKA_INNE\}\}/g, kb.uszczelkaStudniInne ? `(${kb.uszczelkaStudniInne})` : '');
    
    html = html.replace(/\{\{KINETA\}\}/g, String(kb.kineta || '—'));
    html = html.replace(/\{\{KINETA_INNE\}\}/g, kb.kinetaInne ? `(${kb.kinetaInne})` : '');
    html = html.replace(/\{\{REDUKCJA_KINETY\}\}/g, String(kb.redukcjaKinety || '—'));
    html = html.replace(/\{\{USYTUOWANIE\}\}/g, String(kb.usytuowanie || '—'));
    html = html.replace(/\{\{WYSOKOSC_SPOCZNIKA\}\}/g, String(kb.wysokoscSpocznika || '—'));
    html = html.replace(/\{\{SLEPA_KINETA\}\}/g, String(kb.slepaKineta || '—'));
    html = html.replace(/\{\{SLEPA_KINETA_UWAGI\}\}/g, kb.slepaKinetaUwagi ? `(${kb.slepaKinetaUwagi})` : '');
    html = html.replace(/\{\{KASKADA\}\}/g, String(kb.kaskada || '—'));
    html = html.replace(/\{\{KASKADA_UWAGI\}\}/g, kb.kaskadaUwagi ? `(${kb.kaskadaUwagi})` : '');
    
    html = html.replace(/\{\{PRZEJSCIA_SZCZELNE\}\}/g, String(kb.przejsciaSzczelne || '—'));
    html = html.replace(/\{\{PRZEJSCIA_TULEJOWE\}\}/g, String(kb.przejsciaTulejowe || '—'));
    html = html.replace(/\{\{PRZEJSCIA_ZAMOWIONE\}\}/g, String(kb.przejsciaZamowione || '—'));
    
    html = html.replace(/\{\{UWAGI_OGOLNE\}\}/g, String(kb.uwagiOgolne || '—').replace(/\n/g, '<br>'));

    // Tabela przejść
    let tabelaPrzejsciaHTML = '';
    const pd = kb.przejsciaDetails;
    if (Array.isArray(pd) && pd.length > 0) {
        let trs = pd.map((p: any, idx: number) => {
            return `<tr>
                <td>${idx + 1}</td>
                <td>${p.rodzaj || '—'}</td>
                <td>${p.dnOd || '—'}</td>
                <td>${p.dnDo || '—'}</td>
                <td>${p.uwagi || '—'}</td>
                <td>${p.czyPrzejscie || '—'}</td>
            </tr>`;
        }).join('');
        
        tabelaPrzejsciaHTML = `
        <div class="section-header">Szczegóły przejść</div>
        <table class="przejscia-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Lp.</th>
                    <th style="width: 28%;">Rodzaj przejścia</th>
                    <th style="width: 14%;">DN OD</th>
                    <th style="width: 14%;">DN DO</th>
                    <th style="width: 26%;">Uwagi</th>
                    <th style="width: 10%;">Czy przejście?</th>
                </tr>
            </thead>
            <tbody>${trs}</tbody>
        </table>`;
    }
    html = html.replace(/\{\{TABELA_PRZEJSCIA\}\}/g, tabelaPrzejsciaHTML);

    // Usuń sekcje specyficzne dla studni (wells) - nie są używane dla rur
    html = html.replace(/\{\{RZECZYWISTA_ILOSC_PRZEJSC\}\}/g, '');
    html = html.replace(/\{\{ILOSC_ELEMENTOW_ZAMOWIENIA\}\}/g, '');

    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return generatePDF(html);
}
