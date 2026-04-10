import express from 'express';

/**
 * Helper do tworzenia testowego serwera Express
 */
export function createTestApp(
  routes: express.Router,
  mountPath: string = '/api'
): express.Application {
  const app = express();
  app.use(express.json());
  app.use(mountPath, routes);
  return app;
}

/**
 * Mock użytkownika do testów
 */
export const mockUser = {
  id: 'test_user_id',
  username: 'testuser',
  role: 'user',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  symbol: 'TU',
  subUsers: [],
};

export const mockAdmin = {
  id: 'test_admin_id',
  username: 'admin',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'Admin',
  email: 'admin@example.com',
  symbol: 'AD',
  subUsers: [],
};

/**
 * Token testowy (mock)
 */
export const mockToken = 'test-auth-token-12345';