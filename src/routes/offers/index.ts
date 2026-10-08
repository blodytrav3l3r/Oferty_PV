import express from 'express';
import ruryCrudRouter from './ruryCrud';
import studnieCrudRouter from './studnieCrud';
import crudRouter from './crud';
import followUpsRouter from './followUps';
import exportsRouter from './exports';

const router = express.Router();

// Eksporty PDF/DOCX muszą być przed CRUD (/:id/export-* vs /:id)
router.use('/', exportsRouter);

// Rury: GET /, POST /, PUT /
router.use('/', ruryCrudRouter);

// Studnie: GET /studnie, POST /studnie, PUT /studnie, DELETE /studnie/:id
router.use('/', studnieCrudRouter);

// Dispatch: GET /:id, DELETE /:id (obsługuje zarówno rury jak i studnie)
router.use('/', crudRouter);

// Opieka nad ofertą: POST/GET /:kind/:id/followups (przed /:id nie ma kolizji — 3 segmenty)
router.use('/', followUpsRouter);

export default router;
