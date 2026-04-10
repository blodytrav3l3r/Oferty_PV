import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = express.Router();

/* ===== YEAR LETTER (Litera roku obrotowego) ===== */

router.get('/year-letter', requireAuth as any, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const key = 'year_letter_' + year;
    const row = await prisma.settings.findUnique({
      where: { key },
    });
    res.json({ letter: row ? row.value : '', year });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put(
  '/year-letter',
  requireAuth as any,
  requireAdmin as any,
  async (req, res) => {
    try {
      const { letter } = req.body;
      if (!letter || typeof letter !== 'string' || letter.length !== 1) {
        return res
          .status(400)
          .json({ error: 'Litera musi być pojedynczym znakiem' });
      }

      const year = new Date().getFullYear();
      const key = 'year_letter_' + year;

      try {
        await prisma.settings.update({
          where: { key },
          data: { value: letter.toUpperCase() },
        });
      } catch {
        await prisma.settings.create({
          data: { key, value: letter.toUpperCase() },
        });
      }

      res.json({ ok: true, letter: letter.toUpperCase(), year });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

export default router;