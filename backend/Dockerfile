# Multi-stage build pentru backend NestJS
FROM node:20-alpine AS builder

WORKDIR /app

# Copiază package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Instalează dependențele
RUN npm ci --only=production=false

# Copiază Prisma schema
COPY prisma ./prisma

# Generează Prisma client
RUN npx prisma generate

# Copiază sursele
COPY src ./src

# Build aplicația
RUN npm run build

# Stage de producție
FROM node:20-alpine

WORKDIR /app

# Copiază package files
COPY package*.json ./

# Instalează doar dependențele de producție
RUN npm ci --only=production && npm cache clean --force

# Copiază build-ul din builder
COPY --from=builder /app/dist ./dist

# User non-root pentru securitate
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

USER nestjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]
