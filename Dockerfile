# KYTTO Clube — Dockerfile para GCP Cloud Run
# Multi-stage build para otimização de tamanho e segurança

# ─── Stage 1: Build do Web (React) ──────────────────────────────────────────
FROM node:22-alpine AS web-builder
WORKDIR /app
COPY shared/ ./shared/
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ─── Stage 2: Build do Backend (Node.js) ────────────────────────────────────
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY shared/ ./shared/
WORKDIR /app/api
COPY app/package*.json ./
RUN npm ci --only=production
COPY app/ ./

# ─── Stage 3: Imagem Final de Produção ──────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=8080

# Dependências de sistema para DANFE e validação XSD fiscal oficial.
RUN apk add --no-cache fontconfig ttf-dejavu libxml2-utils

WORKDIR /app

# Copiar dependências e código do backend
COPY --from=backend-builder /app/api ./
COPY --from=backend-builder /app/shared ./shared

# Copiar build do frontend para ser servido pelo backend
COPY --from=web-builder /app/web/dist ./public

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs &&     adduser -S nodejs -u 1001 &&     chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080

# Healthcheck para o Cloud Run
HEALTHCHECK --interval=30s --timeout=3s   CMD wget -qO- http://localhost:8080/health || exit 1

# Copiar e configurar entrypoint
COPY --chown=nodejs:nodejs entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Iniciar o servidor ERP principal via entrypoint
ENTRYPOINT ["./entrypoint.sh"]
