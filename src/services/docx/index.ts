/**
 * DOCX Generator — barrel re-export
 *
 * Eksportuje publiczne API generatorów DOCX, zachowując kompatybilność
 * z istniejącymi importami z ../services/docxGenerator.
 */
export { generateOfferRuryDOCX } from './rury';
export { generateRuryDOCXFromContext } from './rury';
export { generateRuryOrderDOCX } from './rury';
export { generateOfferStudnieDOCX } from './studnie';
export { generateStudnieDOCXFromContext } from './studnie';
export { generateStudnieOrderDOCX } from './studnie';
export { generateKartaBudowyDOCX } from './studnie/kartaBudowy';
export { generateKartaBudowyRuryDOCX } from './rury/kartaBudowy';
