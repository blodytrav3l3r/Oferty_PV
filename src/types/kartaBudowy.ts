export interface KartaBudowyMeta {
    dataZamowienia?: string;
    osobaKontakt?: string;
    adresWysylki?: string;
    emailFaktura?: string;
    emailEfaktura?: string;
    warunkiPlatnosci?: string;
    iloscDni?: string;
    rodzajTransportu?: string;
    wyliczonyTransport?: string;
    zabezpieczenieTransportu?: string;
    ubezpieczenie?: string;
    rodzajStudni?: string;
    wlasciwosciBetonu?: string;
    pozostaleWlasciwosci?: string;
    rodzajStopni?: string;
    rodzajStopniInne?: string;
    uszczelkaStudni?: string;
    uszczelkaStudniInne?: string;
    kineta?: string;
    kinetaInne?: string;
    redukcjaKinety?: string;
    usytuowanie?: string;
    wysokoscSpocznika?: string;
    slepaKineta?: string;
    slepaKinetaUwagi?: string;
    kaskada?: string;
    kaskadaUwagi?: string;
    przejsciaSzczelne?: string;
    przejsciaTulejowe?: string;
    przejsciaZamowione?: string;
    uwagiOgolne?: string;
    przejsciaDetails?: PrzejscieDetail[];
    offerNumbers?: string[];
}

export interface PrzejscieDetail {
    rodzaj?: string;
    dnOd?: string;
    dnDo?: string;
    uwagi?: string;
    czyPrzejscie?: string;
}

export interface ConfigItem {
    productId: string;
    quantity?: number;
    frozenName?: string;
}

export interface PrzejscieItem {
    productId: string;
    rzednaWlaczenia?: string;
}

export interface WellItem {
    config?: ConfigItem[];
    przejscia?: PrzejscieItem[];
    rzednaDna?: string;
}

export interface OrderItem {
    name?: string;
    productId?: string;
    orderedQuantity?: number;
    quantity?: number;
    autoAdded?: boolean;
}

export interface KartaBudowyOrderData {
    kartaBudowy?: KartaBudowyMeta;
    wells?: WellItem[];
    items?: OrderItem[];
    orderNumber?: string;
    productionOrderNumber?: string;
    id?: string;
    offerNumber?: string;
    number?: string;
}
