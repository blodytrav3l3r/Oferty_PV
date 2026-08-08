import { defineConfig } from 'vite';

export default defineConfig({
    root: 'public',
    base: '/',
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
