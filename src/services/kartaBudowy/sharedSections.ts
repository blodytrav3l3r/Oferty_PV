import type { KartaBudowyMeta, KartaBudowyOrderData } from '../../types/kartaBudowy';

interface KartaBudowySharedRow {
    label: string;
    value: string;
}

interface KartaBudowySharedSection {
    title: string;
    rows: KartaBudowySharedRow[];
    /** Lista osób do kontaktu (jedna linia na osobę w wydrukach). */
    contacts?: Array<{ name?: string; phone?: string; email?: string }>;
}

type ContactField = 'name' | 'phone' | 'email';
type Contact = { name?: string; phone?: string; email?: string };

/**
 * Etykiety wierszy, które są tylko zbiorczym podsumowaniem listy kontaktów.
 * Wydruki DOCX pokazują osoby w tabeli (jedna linia na osobę), więc tych
 * wierszy nie powtarzają — inaczej dane firmy i NIP giną pod tabelą.
 */
export const CONTACT_ROW_LABELS: readonly string[] = [
    'Imię i nazwisko',
    'Telefon',
    'E-mail',
    'Kontakt zamawiającego — imię i nazwisko',
    'Telefon zamawiającego',
    'E-mail zamawiającego'
];

function parseLegacyContact(value: string): Contact {
    const contactText = value.trim();
    const phoneMatch = contactText.match(/^(.*?)[,;]\s*([\d+\-() ]{7,20})$/);
    return phoneMatch
        ? { name: phoneMatch[1].trim(), phone: phoneMatch[2].trim() }
        : { name: contactText };
}

function splitLegacyParties(value: string): { buyer: Contact; build: Contact | null } {
    const source = value.trim();
    const buyerText = source.match(/Zamawiający:\s*(.*?)(?=,\s*Budowa:|$)/i)?.[1] || source;
    const buildText = source.match(/Budowa:\s*(.*)$/i)?.[1]?.trim() || '';
    return {
        buyer: parseLegacyContact(buyerText),
        build: buildText ? parseLegacyContact(buildText) : null
    };
}

function formatContactField(
    contacts: Array<{ name?: string; phone?: string; email?: string }>,
    field: ContactField
) {
    return contacts
        .map((contact) => contact[field])
        .filter((value): value is string => Boolean(value))
        .join('; ');
}

function formatBuyerContacts(kb: KartaBudowyMeta, orderData: KartaBudowyOrderData) {
    if (Array.isArray(kb.kontaktZamawiajacy)) return kb.kontaktZamawiajacy;
    if (Array.isArray(kb.clientContacts)) return kb.clientContacts;
    if (Array.isArray(orderData.clientContacts)) return orderData.clientContacts;

    if (orderData.contactPerson || orderData.clientPhone || orderData.clientEmail) {
        return [
            {
                name: orderData.contactPerson,
                phone: orderData.clientPhone,
                email: orderData.clientEmail
            }
        ];
    }
    return [];
}

function formatBuyerContactList(kb: KartaBudowyMeta, orderData: KartaBudowyOrderData) {
    const hasExplicitList =
        Array.isArray(kb.kontaktZamawiajacy) ||
        Array.isArray(kb.clientContacts) ||
        Array.isArray(orderData.clientContacts);
    const contacts = formatBuyerContacts(kb, orderData);
    if (hasExplicitList || contacts.length > 0) return contacts;
    const legacyBuyer = splitLegacyParties(
        String(kb.osobaKontakt ?? orderData.clientContact ?? '')
    ).buyer;
    return Object.values(legacyBuyer).some(Boolean) ? [legacyBuyer] : [];
}

function formatBuildContacts(kb: KartaBudowyMeta, orderData: KartaBudowyOrderData) {
    if (Array.isArray(kb.kontaktyBudowa)) return kb.kontaktyBudowa;

    const legacyContact = {
        name: kb.kontaktBudowaImie,
        phone: kb.kontaktBudowaTelefon,
        email: kb.kontaktBudowaEmail
    };
    if (Object.values(legacyContact).some(Boolean)) return [legacyContact];

    const legacyParties = splitLegacyParties(
        String(kb.osobaKontakt ?? orderData.clientContact ?? '')
    );
    if (legacyParties.build) return [legacyParties.build];

    if (Array.isArray(orderData.investContacts) && orderData.investContacts.length > 0) {
        return orderData.investContacts;
    }
    const legacyInvestmentContact = orderData.investContact || orderData.investContractor || '';
    return legacyInvestmentContact ? [parseLegacyContact(legacyInvestmentContact)] : [];
}

function getFieldValue(value: string | undefined | null): string {
    return value ?? '—';
}

export function getKartaBudowySharedSections(
    kb: KartaBudowyMeta,
    orderData: KartaBudowyOrderData
): KartaBudowySharedSection[] {
    const buildContacts = formatBuildContacts(kb, orderData);
    const buyerContacts = formatBuyerContacts(kb, orderData);
    const legacyParties = splitLegacyParties(
        String(kb.osobaKontakt ?? orderData.clientContact ?? '')
    );
    const formatBuild = (field: ContactField) => formatContactField(buildContacts, field) || '—';
    const formatBuyer = (field: ContactField) =>
        formatContactField(buyerContacts, field) ||
        (field === 'name'
            ? legacyParties.buyer.name || String(kb.osobaKontakt ?? orderData.clientContact ?? '—')
            : field === 'phone'
              ? legacyParties.buyer.phone || '—'
              : '—');

    return [
        {
            title: 'Miejsce budowy / dostawy',
            rows: [
                {
                    label: 'Symbol oferty - Obiekt',
                    value: getFieldValue(kb.investName ?? orderData.investName)
                },
                {
                    label: 'Kod pocztowy',
                    value: getFieldValue(kb.investPostalCode ?? orderData.investPostalCode)
                },
                {
                    label: 'Miejscowość',
                    value: getFieldValue(kb.investCity ?? orderData.investCity)
                },
                {
                    label: 'Ulica i numer',
                    value: getFieldValue(kb.investStreet ?? orderData.investStreet)
                },
                {
                    label: 'Opis dojazdu',
                    value: getFieldValue(
                        kb.investLocationDescription ?? orderData.investLocationDescription
                    )
                }
            ]
        },
        {
            title: 'Osoby do kontaktu — budowa',
            rows: [
                { label: 'Imię i nazwisko', value: formatBuild('name') },
                { label: 'Telefon', value: formatBuild('phone') },
                { label: 'E-mail', value: formatBuild('email') }
            ],
            contacts: buildContacts
        },
        {
            title: 'Dane nabywcy',
            rows: [
                {
                    label: 'Kod kontrahenta',
                    value: getFieldValue(kb.clientNumber ?? orderData.clientNumber)
                },
                { label: 'Firma', value: getFieldValue(kb.clientName ?? orderData.clientName) },
                { label: 'NIP', value: getFieldValue(kb.clientNip ?? orderData.clientNip) },
                {
                    label: 'Adres firmy',
                    value: getFieldValue(kb.clientAddress ?? orderData.clientAddress)
                },
                {
                    label: 'Kontakt zamawiającego — imię i nazwisko',
                    value: formatBuyer('name')
                },
                { label: 'Telefon zamawiającego', value: formatBuyer('phone') },
                { label: 'E-mail zamawiającego', value: formatBuyer('email') }
            ],
            contacts: formatBuyerContactList(kb, orderData)
        }
    ];
}
