import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    WidthType,
    AlignmentType
} from 'docx';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_BG_SUMMARY,
    SZ_TERMS,
    SZ_TERMS_TABLE,
    SZ_TERMS_HEADER,
    SZ_THANKS
} from '../constants';
import { textCell } from '../helpers';

export function buildStaticTerms(): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Informacje dodatkowe i ogólne warunki:',
                    bold: true,
                    size: SZ_TERMS_HEADER,
                    font: FONT,
                    color: COLOR_GRAY_HEADER
                })
            ],
            spacing: { before: 150, after: 50 }
        })
    );

    const addP = (text: string, opts?: { bold?: boolean; marginTop?: number }) => {
        result.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text,
                        size: SZ_TERMS,
                        font: FONT,
                        color: '333333',
                        bold: opts?.bold
                    })
                ],
                spacing: { before: opts?.marginTop ?? 60, after: 0 },
                alignment: AlignmentType.JUSTIFIED
            })
        );
    };

    for (const term of COMMERCIAL_TERMS) {
        addP(term.text, term.opts);
        if (term.afterTable === 'transport_security') {
            result.push(buildTransportSecurityTable());
        }
    }

    result.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Dziękujemy Państwu za zainteresowanie ofertą naszej firmy i mamy nadzieję na dalszą owocną współpracę.',
                    bold: true,
                    size: SZ_THANKS,
                    font: FONT,
                    color: '333333'
                })
            ],
            spacing: { before: 100, after: 40 }
        })
    );

    return result;
}

interface TermEntry {
    text: string;
    opts?: { bold?: boolean; marginTop?: number };
    afterTable?: 'transport_security';
}

const COMMERCIAL_TERMS: TermEntry[] = [
    {
        text: 'Transport rur w średnicach DN 300 – DN 2200 odbywa się na jednorazowych podkładach drewnianych jako „Zabezpieczenie transportu". Koszt podkładów zostanie zafakturowany na fakturze VAT wg poniższego zestawienia (wartości w tabeli podają cenę Zabezpieczenia transportu do jednej sztuki rury).',
        afterTable: 'transport_security'
    },
    {
        text: 'Dla rur powyżej średnicy DN1200 oferujemy kotwy montażowe 45 PLN/szt. w rurze są montowane dwie kotwy. Sprzęgi uniwersalne mogą być przez nas dostarczane za kaucją 2300 PLN/szt., na wyraźne zamówienie. Po zwrocie w stanie nieuszkodzonym zostanie z kaucji potrącone 40% jako koszty własne P.V. Prefabet S.A. i amortyzacja.'
    },
    {
        text: 'Do montażu rur i studni P.V. Prefabet Kluczbork S.A. oferuje środek poślizgowy w wiaderkach 5kg w cenie 225 PLN. Dedykowany środek poślizgowy ułatwia montaż, nie wpływa negatywnie na uszczelki przez co gwarantujemy szczelność naszych wyrobów. W celu prawidłowego montażu rur i studni do każdego transportu studni i co do drugiego transportu rur należy uwzględnić 5kg środka poślizgowego. Koszt środka poślizgowego stanowi osobną pozycję na fakturze. Zastosowanie innych środków o nieznanym składzie chemicznym może negatywnie wpłynąć na szczelność połączeń, a tym samym wyklucza odpowiedzialność gwarancyjną Producenta.'
    },
    {
        text: 'Termin realizacji zamówienia: I partia towaru według indywidualnych ustaleń z doradcą techniczno-handlowym. Zamówienie należy złożyć w formie pisemnej z wszystkimi istotnymi parametrami potrzebnymi do zrealizowania zamówienia.',
        opts: { bold: true }
    },
    {
        text: 'Odstąpienie od złożonego zamówienia powoduje konieczność zapłaty 100% wartości wyprodukowanego towaru oraz pokrycie kosztów przygotowania produkcji.',
        opts: { marginTop: 30 }
    },
    {
        text: 'Ceny podane w ofercie uwzględniają rabat obowiązujący przy terminowym uregulowaniu należności oraz przy zamówieniu całości asortymentu objętego ofertą.'
    },
    {
        text: 'Po otrzymaniu zamówienia na kwotę wyższą niż 50 tys. PLN netto P.V. Prefabet Kluczbork S.A. przedstawi umowę określającą warunki dostaw, która zostanie podpisana przed rozpoczęciem dostaw. P.V. Prefabet Kluczbork S.A. ubezpiecza wszystkie transakcje z odroczonym terminem płatności, w związku z tym sprzedaż na przelew może nastąpić po weryfikacji przez firmę ubezpieczeniową i ubezpieczeniu transakcji. Procedura ubezpieczenia trwa do 10 dni roboczych, a wszelkie formalności i koszty leżą po stronie P.V. Prefabet Kluczbork S.A.'
    },
    {
        text: 'Wszelkie spory mogące wyniknąć w związku z realizacją zamówienia, Strony poddają pod rozstrzygnięcie sądu powszechnego właściwego dla siedziby Dostawcy.'
    },
    {
        text: 'Niewymienione elementy dodatkowe (elementy do wbudowania, powłoki itp.) nie są częścią tej oferty. Wszelkie zmiany ilościowe bądź jakościowe w zamówieniu korygowane będą poprzez wystawienie kolejnej oferty cenowej lub ustaleniach między stronami. Cena loco budowa przy zamówieniu na całość zadania i dostawie pełnych transportów 24-tonowych. W przypadku niepełnych dostaw zostanie doliczony dodatkowy koszt transportu.'
    },
    {
        text: 'Drogi dojazdowe do miejsca budowy muszą być przejezdne dla pojazdów ciężkich (ładowność 24 tony). Zleceniodawca jest odpowiedzialny za zapewnienie odpowiedniego dojazdu i miejsca rozładunku na budowie. Rozładunek oraz wynajęcie dźwigu na miejscu budowy leży po stronie zamawiającego. Oferta standardowa obejmuje jedno miejsce rozładunku. W przypadku, gdy miejsc rozładunku jest więcej - za każde dodatkowe miejsce rozładunku klient płaci 500 PLN. Standardowy czas rozładunku wyrobów wynosi maksymalnie do 1,5 godz. Za każdą następną rozpoczętą godzinę klient zapłaci 200 PLN netto. Czas liczony jest od momentu zgłoszenia przez kierowcę osobie upoważnionej gotowości do rozładunku.'
    },
    {
        text: 'W przypadku wzrostu cen materiałów wsadowych (cement, kruszywa, usługi transportowe itp.) powyżej 3 % zastrzegamy sobie prawo zmiany cen.'
    },
    {
        text: 'Na oferowane prefabrykaty betonowe i żelbetowe udzielamy 36 miesięcy gwarancji licząc od daty podpisania dokumentu WZ pod warunkiem montażu ze sztuką budowlaną i zgodnie z dokumentacją techniczną producenta (instrukcje montażu wyrobów do pobrania na stronie www.pv-prefabet.com.pl). W zamówieniach prosimy powoływać się na nr niniejszej oferty.'
    },
    {
        text: 'Parametry techniczne oferowanych wyrobów, według odpowiednich deklaracji dostępnych na https://www.pv-prefabet.com.pl lub po przesłaniu przez odpowiedni dział P.V. Prefabet Kluczbork S.A.'
    },
    {
        text: 'Obligatoryjnym załącznikiem do niniejszej oferty są Ogólne Warunki Sprzedaży dostępne na stronie internetowej www.pv-prefabet.com.pl oraz Polityka Prywatności dostępna na stronie internetowej www.pv-prefabet.com.pl/rodo-dane'
    }
];

const TRANSPORT_SECURITY_DATA: [string, string][] = [
    ['DN 300', '13,00'],
    ['DN 400', '13,00'],
    ['DN 500', '14,00'],
    ['DN 600', '20,00'],
    ['DN 800', '20,00'],
    ['DN 1000', '40,00'],
    ['DN 1200', '50,00'],
    ['DN 1400', '90,00'],
    ['DN 1500', '90,00'],
    ['DN 1600', '90,00'],
    ['DN 1800', '230,00'],
    ['DN 2000', '310,00'],
    ['DN 2200', '310,00'],
    ['WPUST ULICZNY', '14,00']
];

function buildTransportSecurityTable(): Table {
    const thStyle = {
        bold: true,
        size: SZ_TERMS_TABLE,
        fill: COLOR_BG_SUMMARY,
        alignment: AlignmentType.CENTER
    };
    const tdStyle = { size: SZ_TERMS_TABLE };
    const tdcStyle = { size: SZ_TERMS_TABLE, alignment: AlignmentType.CENTER };

    const rows: TableRow[] = [
        new TableRow({
            children: [
                textCell('Zabezpieczenie transportu wg średnicy rur', { ...thStyle, width: 35 }),
                textCell('Cena netto [PLN]', { ...thStyle, width: 15 }),
                textCell('Zabezpieczenie transportu wg średnicy rur', { ...thStyle, width: 35 }),
                textCell('Cena netto [PLN]', { ...thStyle, width: 15 })
            ]
        })
    ];

    const half = 7;
    for (let i = 0; i < half; i++) {
        const left = TRANSPORT_SECURITY_DATA[i];
        const right = i + half < TRANSPORT_SECURITY_DATA.length
            ? TRANSPORT_SECURITY_DATA[i + half]
            : null;

        rows.push(
            new TableRow({
                children: [
                    textCell(`Zabezpieczenie transportu ${left[0]}`, { ...tdStyle }),
                    textCell(left[1], { ...tdcStyle }),
                    textCell(right ? `Zabezpieczenie transportu ${right[0]}` : '', { ...tdStyle }),
                    textCell(right ? right[1] : '', { ...tdcStyle })
                ]
            })
        );
    }

    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}
