import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'public',
    base: '/',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, 'public/index.html'),
                rury: path.resolve(__dirname, 'public/rury.html'),
                studnie: path.resolve(__dirname, 'public/studnie.html'),
                kartoteka: path.resolve(__dirname, 'public/kartoteka.html'),
                zlecenia: path.resolve(__dirname, 'public/zlecenia.html'),
                app: path.resolve(__dirname, 'public/app.html'),
            },
            output: {
                entryFileNames: 'js/[name]-[hash].js',
                chunkFileNames: 'js/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('xlsx')) return 'vendor-xlsx';
                        return 'vendor';
                    }
                },
            },
        },
        target: 'es2015',
        minify: 'esbuild',
    },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
    esbuild: {
        legalComments: 'none',
    },
});
