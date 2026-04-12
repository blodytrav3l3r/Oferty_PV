/**
 * Oferty — indeks zbiorczy (barrel index)
 *
 * Montuje sub-routery CRUD i eksportu dokumentów
 * w jeden router kompatybilny z istniejącym importem w server.ts.
 */
import express from 'express';
import crudRouter from './crud';
import exportsRouter from './exports';

const router = express.Router();

// Eksporty (PDF/DOCX) MUSZĄ być przed CRUD, bo /:id/export-* by kolidowało z /:id
router.use('/', exportsRouter);

// CRUD ofert (rury + studnie)
router.use('/', crudRouter);

export default router;
