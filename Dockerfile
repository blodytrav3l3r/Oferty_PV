FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Instalujemy wszystkie zależności potrzebne do zbudowania projektu (w tym typescript)
RUN npm ci

COPY . .

# Generujemy klienta Prisma
RUN npx prisma generate

# Budujemy projekt
RUN npm run build

# Usuwamy zależności deweloperskie dla środowiska produkcyjnego
RUN npm prune --production && \
    npm cache clean --force

# Tworzymy katalog danych i kopiujemy szablon bazy (dla inicjalizacji wolumenu)
RUN mkdir -p data && \
    cp data/app_database.sqlite ./app_database.sqlite.template || touch ./app_database.sqlite.template && \
    chmod -R 755 data

# Skrypt startowy (naprawa znaków końca linii i uprawnienia)
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh && \
    chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/app_database.sqlite
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

