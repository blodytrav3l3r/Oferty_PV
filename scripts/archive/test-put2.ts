import { PrismaClient } from './generated/prisma';
import * as http from 'http';
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
    
    const payload = JSON.stringify({
        data: [{
            id: Date.now().toString(),
            name: 'Test',
            nip: '',
            address: '',
            contact: '',
            createdAt: new Date().toISOString()
        }]
    });

    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/clients',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'x-auth-token': token
        }
    }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            console.log('STATUS:', res.statusCode);
            console.log('BODY:', body);
            prisma.$disconnect();
        });
    });

    req.on('error', e => console.error(e));
    req.write(payload);
    req.end();
  } catch (e) {
    console.error('Fetch error:', e);
    await prisma.$disconnect();
  }
}
test();
