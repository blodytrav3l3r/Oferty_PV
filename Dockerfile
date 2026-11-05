FROM node:22-slim

# Instalacja bibliotek systemowych, PostgreSQL 18 client i Chromium (Puppeteer/PDF).
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg openssl sed \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libcairo2 libglib2.0-0 fonts-liberation \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Cache Puppeteera pod /app (nie w HOME roota) — runtime działa jako USER node
# i inaczej nie widzi binarki Chromium pobranej przez npm ci (PDF 500).
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Instalujemy wszystkie zależności
RUN npm ci --no-audit --no-fund

COPY . .

# Build potrzebuje URL ze względu na prisma.config.ts; to syntaktyczny adres
# bez sekretu i nie jest utrwalany w obrazie. Runtime wymaga DATABASE_URL z Compose.
RUN DATABASE_URL='postgresql://sok_build:sok_build@127.0.0.1:5432/sok_build?schema=public' npm run build && \
    npm run minify:css

# `npm run build` compiles the PostgreSQL Prisma client into dist/generated/prisma-postgres.

# NIE uruchamiamy npm prune --production - devDeps (ts-node, Prisma CLI)
# są potrzebne w jednorazowym db-bootstrap Compose przed startem aplikacji.

# Dane PostgreSQL i backupy mają odrębne named volumes w Compose.
RUN mkdir -p /app/data/backups && \
    chown -R node:node /app/data

# Skrypt startowy (naprawa znaków końca linii i uprawnienia)
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh ./scripts/docker-db-bootstrap.sh && \
    chmod +x ./scripts/docker-entrypoint.sh ./scripts/docker-db-bootstrap.sh

ENV NODE_ENV=production
ENV PORT=10000
ENV HOST=0.0.0.0
# Secure cookie wymagane za reverse proxy (HTTPS zakończony poza kontenerem)
ENV COOKIE_SECURE=true

EXPOSE 10000

# Uruchomienie jako nie-root (node z obrazu node:22-slim).
# Migracje, seed i serwer działają jako node; dane PostgreSQL zapisuje kontener DB.
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health/ready', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]


