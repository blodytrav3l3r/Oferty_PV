import express from 'express';
import ruryCrudRouter from './ruryCrud';
import studnieCrudRouter from './studnieCrud';
import crudRouter from './crud';
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

export default router;
