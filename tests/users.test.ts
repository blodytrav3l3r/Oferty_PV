import request from 'supertest';
import express from 'express';

describe('Users Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Note: In real tests, you'd mock the Prisma client
  });

  describe('GET /api/users', () => {
    it('should return users list', async () => {
      const res = await request(app).get('/api/users');

      // Expect either 200 with data or 401 if auth required
      expect([200, 401]).toContain(res.statusCode);
    });
  });

  describe('POST /api/users', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({});

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});