# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code & configs
COPY . .

# Generate Prisma Client dengan dummy URL agar proses build tidak gagal
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate

# Build aplikasi NestJS
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy hasil build dan dependency dari stage 1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma.config.mjs ./

# Jalankan worker dengan pengecekan struktur direktori NestJS+Prisma
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]