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

RUN mkdir -p data && \
    chmod -R 755 data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
