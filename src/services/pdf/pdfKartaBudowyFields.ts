import { escapeHtml } from './pdfHelpers';

export const TYPE_LABELS: Record<string, string> = {
    dennica: 'Dennica',
    krag: 'Krąg',
    krag_ot: 'Krąg wiercony',
    konus: 'Konus',
    plyta_din: 'Płyta DIN',
    plyta_redukcyjna: 'Płyta redukcyjna',
    avr: 'AVR',
    styczna: 'Studnia styczna',
    uszczelka: 'Uszczelka',
    pierscien_odciazajacy: 'Pierścień odciążający',
    plyta_zamykajaca: 'Płyta zamykająca',
    plyta_najazdowa: 'Płyta najazdowa'
};

export const TYPE_ORDER = [
    'dennica',
    'krag',
    'krag_ot',
    'konus',
    'plyta_din',
    'plyta_redukcyjna',
    'avr',
    'styczna',
    'uszczelka',
    'pierscien_odciazajacy',
    'plyta_zamykajaca',
    'plyta_najazdowa'
];

export function replaceKartaBudowyFields(
    html: string,
    kb: Record<string, unknown>,
    nrZamowienia: string,
    nrOferty: string
): string {
    html = html.replace(/\{\{NR_ZAMOWIENIA\}\}/g, nrZamowienia);
    html = html.replace(/\{\{OFFER_NUMBERS\}\}/g, nrOferty);
    html = html.replace(/\{\{DATA_ZAMOWIENIA\}\}/g, escapeHtml(kb.dataZamowienia ?? '\u2014'));
    html = html.replace(/\{\{OSOBA_KONTAKT\}\}/g, escapeHtml(kb.osobaKontakt ?? '\u2014'));
    html = html.replace(/\{\{ADRES_WYSYLKI\}\}/g, escapeHtml(kb.adresWysylki ?? '\u2014'));
    html = html.replace(/\{\{EMAIL_FAKTURA\}\}/g, escapeHtml(kb.emailFaktura ?? '\u2014'));
    html = html.replace(/\{\{EMAIL_EFAKTURA\}\}/g, escapeHtml(kb.emailEfaktura ?? '\u2014'));
    html = html.replace(/\{\{WARUNKI_PLATNOSCI\}\}/g, escapeHtml(kb.warunkiPlatnosci ?? '\u2014'));
    html = html.replace(/\{\{ILOSC_DNI\}\}/g, escapeHtml(kb.iloscDni ?? '\u2014'));
    html = html.replace(/\{\{RODZAJ_TRANSPORTU\}\}/g, escapeHtml(kb.rodzajTransportu ?? '\u2014'));
    html = html.replace(
        /\{\{WYLICZONY_TRANSPORT\}\}/g,
        escapeHtml(kb.wyliczonyTransport ?? '\u2014')
    );
    html = html.replace(
        /\{\{ZABEZPIECZENIE_TRANSPORTU\}\}/g,
        escapeHtml(kb.zabezpieczenieTransportu ?? '\u2014')
    );
    html = html.replace(/\{\{UBEZPIECZENIE\}\}/g, escapeHtml(kb.ubezpieczenie ?? '\u2014'));
    html = html.replace(/\{\{RODZAJ_STUDNI\}\}/g, escapeHtml(kb.rodzajStudni ?? '\u2014'));
    html = html.replace(
        /\{\{WLASCIWOSCI_BETONU\}\}/g,
        escapeHtml(kb.wlasciwosciBetonu ?? '\u2014')
    );
    html = html.replace(
        /\{\{POZOSTALE_WLASCIWOSCI\}\}/g,
        escapeHtml(kb.pozostaleWlasciwosci ?? '\u2014')
    );
    html = html.replace(/\{\{RODZAJ_STOPNI\}\}/g, escapeHtml(kb.rodzajStopni ?? '\u2014'));
    html = html.replace(
        /\{\{RODZAJ_STOPNI_INNE\}\}/g,
        kb.rodzajStopniInne ? `(${escapeHtml(kb.rodzajStopniInne as string)})` : ''
    );
    html = html.replace(/\{\{USZCZELKA_STUDNI\}\}/g, escapeHtml(kb.uszczelkaStudni ?? '\u2014'));
    html = html.replace(
        /\{\{USZCZELKA_INNE\}\}/g,
        kb.uszczelkaStudniInne ? `(${escapeHtml(kb.uszczelkaStudniInne as string)})` : ''
    );
    html = html.replace(/\{\{KINETA\}\}/g, escapeHtml(kb.kineta ?? '\u2014'));
    html = html.replace(
        /\{\{KINETA_INNE\}\}/g,
        kb.kinetaInne ? `(${escapeHtml(kb.kinetaInne as string)})` : ''
    );
    html = html.replace(/\{\{REDUKCJA_KINETY\}\}/g, escapeHtml(kb.redukcjaKinety ?? '\u2014'));
    html = html.replace(/\{\{USYTUOWANIE\}\}/g, escapeHtml(kb.usytuowanie ?? '\u2014'));
    html = html.replace(
        /\{\{WYSOKOSC_SPOCZNIKA\}\}/g,
        escapeHtml(kb.wysokoscSpocznika ?? '\u2014')
    );
    html = html.replace(/\{\{SLEPA_KINETA\}\}/g, escapeHtml(kb.slepaKineta ?? '\u2014'));
    html = html.replace(
        /\{\{SLEPA_KINETA_UWAGI\}\}/g,
        kb.slepaKinetaUwagi ? `(${escapeHtml(kb.slepaKinetaUwagi as string)})` : ''
    );
    html = html.replace(/\{\{KASKADA\}\}/g, escapeHtml(kb.kaskada ?? '\u2014'));
    html = html.replace(
        /\{\{KASKADA_UWAGI\}\}/g,
        kb.kaskadaUwagi ? `(${escapeHtml(kb.kaskadaUwagi as string)})` : ''
    );
    html = html.replace(
        /\{\{PRZEJSCIA_SZCZELNE\}\}/g,
        escapeHtml(kb.przejsciaSzczelne ?? '\u2014')
    );
    html = html.replace(
        /\{\{PRZEJSCIA_TULEJOWE\}\}/g,
        escapeHtml(kb.przejsciaTulejowe ?? '\u2014')
    );
    html = html.replace(
        /\{\{PRZEJSCIA_ZAMOWIONE\}\}/g,
        escapeHtml(kb.przejsciaZamowione ?? '\u2014')
    );
    html = html.replace(
        /\{\{UWAGI_OGOLNE\}\}/g,
        escapeHtml(kb.uwagiOgolne ?? '\u2014').replace(/\n/g, '<br>')
    );
    return html;
}
