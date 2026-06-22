FROM node:22-slim

# Instalacja bibliotek systemowych potrzebnych dla Prisma (OpenSSL)
RUN apt-get update && apt-get install -y openssl sed && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Instalujemy wszystkie zależności
RUN npm ci

COPY . .

# Generujemy klienta Prisma
RUN npx prisma generate

# Budujemy projekt
RUN npm run build

# Symlink: compiled code in dist/src/ imports '../generated/prisma' → dist/generated/prisma
# Actual Prisma client is at /app/generated/prisma — symlink bridges the path
RUN ln -sf /app/generated /app/dist/generated

# Usuwamy zależności deweloperskie dla środowiska produkcyjnego
RUN npm prune --production && \
    npm cache clean --force

# Tworzymy katalog danych i kopiujemy szablon bazy (dla inicjalizacji wolumenu)
# Na Render.com Persistent Disk montowany jest w /var/data
RUN mkdir -p /var/data && \
    chmod -R 755 /var/data

# Skrypt startowy (naprawa znaków końca linii i uprawnienia)
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh && \
    chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATABASE_URL=file:/var/data/app_database.sqlite
ENV PORT=10000
ENV HOST=0.0.0.0

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]


