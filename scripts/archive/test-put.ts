import { PrismaClient } from './generated/prisma';
import fetch from 'node-fetch';
import { createSession } from './src/middleware/auth';

const prisma = new PrismaClient();

async function test() {
  try {
    let u = await prisma.users.findUnique({where: {username: 'admin'}});
    if (!u) {
       console.log('No admin user');
       return;
    }
    const token = await createSession(u.id);
    
    const payload = {
        data: [{
            id: Date.now().toString(),
            name: 'Test',
            nip: '123',
            address: 'Warszawa',
            contact: 'Jan',
            createdAt: new Date().toISOString()
        }]
    };

    const res = await fetch('http://localhost:3000/api/clients', {
      method: 'PUT',
      headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('PUT STATUS:', res.status);
    const text = await res.text();
    console.log('PUT BODY:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
