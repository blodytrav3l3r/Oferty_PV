// @ts-check
/* ===== WELL UI — Definicje parametrów ===== */

const WELL_PARAM_DEFS = [
    {
        key: 'nadbudowa',
        label: 'Nadbudowa',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'dennicaMaterial',
        label: 'Dennica',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'wkladkaDennica',
        label: 'Wkładka PEHD (Dennica)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaNadbudowa',
        label: 'Wkładka PEHD (Nadb.)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaZwienczenie',
        label: 'Wkładka PEHD (Zwieńcz.)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'klasaBetonu',
        label: 'Klasa betonu',
        options: [
            ['C40/50', 'C40/50'],
            ['C40/50(HSR)', 'C40/50 HSR'],
            ['C45/55', 'C45/55'],
            ['C45/55(HSR)', 'C45/55 HSR'],
            ['C70/85', 'C70/85'],
            ['C70/80(HSR)', 'C70/80 HSR']
        ]
    },
    {
        key: 'agresjaChemiczna',
        label: 'Agresja chem.',
        options: [
            ['XA1', 'XA1'],
            ['XA2', 'XA2'],
            ['XA3', 'XA3']
        ]
    },
    {
        key: 'agresjaMrozowa',
        label: 'Agresja mroz.',
        options: [
            ['XF1', 'XF1'],
            ['XF2', 'XF2'],
            ['XF3', 'XF3']
        ]
    },
    {
        key: 'klasaNosnosci_korpus',
        label: 'Klasa nośności Den.+Nadb.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'klasaNosnosci_zwienczenie',
        label: 'Klasa nośności Zwieńcz.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'malowanieW',
        label: 'Malowanie wew.',
        options: [
            ['brak', 'Brak'],
            ['kineta', 'Kineta'],
            ['kineta_dennica', 'Kineta+denn.'],
            ['cale', 'Całość']
        ]
    },
    {
        key: 'malowanieZ',
        label: 'Malowanie zew.',
        options: [
            ['brak', 'Brak'],
            ['zewnatrz', 'Zewnątrz']
        ]
    },
    {
        key: 'kineta',
        label: 'Kineta',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'PrecoTop'],
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'precoFullHeight',
        label: 'Wkładka cała wys.',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
        ]
    },
    {
        key: 'spocznik',
        label: 'Spocznik',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'Preco Top'],
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'redukcjaKinety',
        label: 'Red. kinety',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
        ]
    },
    {
        key: 'stopnie',
        label: 'Stopnie',
        options: [
            ['brak', 'Brak'],
            ['drabinka', 'Drabinka'],
            ['nierdzewna', 'Nierdzewna']
        ]
    },
    {
        key: 'spocznikH',
        label: 'Spocznik wys.',
        options: [
            ['1/2', '1/2'],
            ['2/3', '2/3'],
            ['3/4', '3/4'],
            ['1/1', '1/1'],
            ['brak', 'Brak']
        ]
    },
    {
        key: 'usytuowanie',
        label: 'Usytuowanie',
        options: [
            ['linia_dolna', 'Linia dolna'],
            ['linia_gorna', 'Linia górna'],
            ['w_osi', 'W osi'],
            ['patrz_uwagi', 'Patrz uwagi']
        ]
    },
    {
        key: 'uszczelka',
        label: 'Uszczelka',
        options: [
            ['brak', 'Brak'],
            ['GSG', 'GSG'],
            ['SDV', 'SDV'],
            ['SDV PO', 'SDV PO'],
            ['NBR', 'NBR']
        ]
    },
    {
        key: 'magazyn',
        label: 'Magazyn',
        options: [
            ['Kluczbork', 'Kluczbork'],
            ['Włocławek', 'Włocławek']
        ]
    },
    {
        key: 'wkladkaOsadnikPreco',
        label: 'Wkładka PRECO osadnik',
        options: [
            ['brak', 'Brak'],
            ['tak', 'Tak']
        ]
    }
];
