// Deklaracje dla globali Vanilla JS — cross-file referencje
// które TypeScript nie widzi (TS2304), bo nie ma importów/eksportów

// ===== KONSTANTY =====
declare var MAX_TRANSPORT_WEIGHT: number;
declare var _EXCEL_UNDO_LIMIT: number;

// ===== ZMIENNE STANU =====
declare var editingRuryOrderId: string | null;
declare var orderEditMode: any;
declare var _cspInputSelect: any;
declare var _EXCEL_FONT: any;
declare var storageService: any;

// ===== OBIEKTY GLOBALNE =====
declare var AppZlecenia: any;
declare var well: any;
declare var excelProducts: any[];

// ===== FUNKCJE (studnie) =====
declare function resolveFieldValue(el: any): void;
declare function openTransportPopup(): void;
declare function handleOfferTransportCancel(): void;
declare function handleOfferTransportSave(): void;
declare function toggleTransportMode(): void;
declare function syncTransportFromModal(): void;
declare function openGlobalRecalcModal(): void;
declare function openTransitionManagerModal(): void;
declare function toggleInneDisplay(id?: string): void;
declare function removeCurrentWell(): void;
declare function showOfferExportChoice(): void;
declare function toggleCompactMode(): void;

// ===== FUNKCJE (rury) =====
declare function toggleRuryTransportMode(): void;
declare function saveOfferOrOrder(): void;
declare function openRuryTransportPopup(): void;
declare function handleRuryTransportCancel(): void;
declare function handleRuryTransportSave(): void;
declare function onRuryTransportFormChange(): void;
declare function toggleAllItemsForOrder(checked?: boolean): void;
declare function syncRuryTransportFromModal(): void;

// ===== FUNKCJE (przejścia / transitions) =====
declare function openFlowTypePopup(index?: number): void;
declare function handlePrzDragStart(e: DragEvent): void;
declare function handlePrzDragOver(e: DragEvent): void;
declare function handlePrzDrop(e: DragEvent): void;
declare function handlePrzDragEnd(e: DragEvent): void;
declare function handleZlCfgDragOver(e: DragEvent): void;
declare function handleZlCfgDragStart(e: DragEvent): void;
declare function handleZlCfgDrop(e: DragEvent): void;
declare function handleZlCfgDragEnd(e: DragEvent): void;
declare function moveZleceniaComponent(zlIdx?: number, direction?: number): void;

// ===== FUNKCJE (offer summary rury) =====
declare function toggleAllOfferSummaryForOrder(checked?: any): void;
declare function updateOfferSummarySelectionCount(): void;
declare function onPipeCheckboxChange(t?: any): void;

// ===== FUNKCJE (audit / przywracanie wersji) =====
declare function restoreOfferVersion(...args: any[]): void;
