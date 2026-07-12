import express from 'express';
import crudRouter from './crud';
import exportRouter from './export';

const router = express.Router();

router.use('/', crudRouter);
router.use('/', exportRouter);

export default router;
