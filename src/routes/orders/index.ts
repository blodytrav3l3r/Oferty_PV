/**
 * Orders — barrel index
 *
 * Montuje sub-routery zamówień, zleceń produkcyjnych i numeracji
 * w jeden router kompatybilny z istniejącym importem w server.ts.
 */
import express from 'express';
import studnieOrdersRouter from './studnieOrders';
import productionRouter from './production';
import numberingRouter from './numbering';

const router = express.Router();

// Numeracja musi być PRZED parametryzowanymi trasami /:id
router.use('/', numberingRouter);

// Zlecenia produkcyjne: /production/*
router.use('/production', productionRouter);

// Zamówienia studni: / (CRUD na zamówieniach)
router.use('/', studnieOrdersRouter);

export default router;
