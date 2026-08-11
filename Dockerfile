FROM node:22-slim

# Instalacja bibliotek systemowych: OpenSSL (Prisma) + zaleznosci Chromium (Puppeteer, generowanie PDF)
RUN apt-get update && apt-get install -y \
    openssl sed \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libcairo2 libglib2.0-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Instalujemy wszystkie zależności
RUN npm ci --no-audit --no-fund

COPY . .

# Generujemy klienta Prisma
RUN npx prisma generate

# Budujemy projekt
RUN npm run build

# Symlink: compiled code in dist/src/ imports '../generated/prisma' → dist/generated/prisma
# Actual Prisma client is at /app/generated/prisma — symlink bridges the path
RUN ln -sf /app/generated /app/dist/generated

# NIE uruchamiamy npm prune --production - devDeps (ts-node, Prisma CLI)
# sa potrzebne w runtime do seedowania (prisma/seed.ts) i db push (docker-entrypoint.sh).

# Tworzymy katalog danych dla trwałego wolumenu Docker (/var/data)
RUN mkdir -p /var/data && \
    chmod -R 755 /var/data

# Skrypt startowy (naprawa znaków końca linii i uprawnienia)
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh && \
    chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATABASE_URL=file:/var/data/app_database.sqlite
ENV PORT=10000
ENV HOST=0.0.0.0
# Secure cookie wymagane za reverse proxy (HTTPS zakończony poza kontenerem)
ENV COOKIE_SECURE=true

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]


