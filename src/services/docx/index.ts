/**
 * DOCX Generator — barrel re-export
 *
 * Eksportuje publiczne API generatorów DOCX, zachowując kompatybilność
 * z istniejącymi importami z ../services/docxGenerator.
 */
export { generateOfferRuryDOCX } from './rury';
export { generateRuryDOCXFromContext } from './rury';
export { generateRuryOrderDOCX } from './rury';
export { buildRuryOfferDocument } from './rury';
export { buildRuryOfferSection } from './rury';
export { generateOfferStudnieDOCX } from './studnie';
export { generateStudnieDOCXFromContext } from './studnie';
export { generateStudnieOrderDOCX } from './studnie';
export { buildStudnieOfferDocument } from './studnie';
export { buildStudnieOfferSection } from './studnie';
export { generateKartaBudowyDOCX } from './studnie/kartaBudowy';
export { generateKartaBudowyRuryDOCX } from './rury/kartaBudowy';
export { buildCombinedDocument, generateCombinedOfferDOCX } from './combined';
