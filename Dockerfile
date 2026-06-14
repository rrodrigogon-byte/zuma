# SetPoint — imagem de produção com build do frontend React incluído
# Stage 1: Build do frontend React
FROM node:20-alpine AS frontend-build
WORKDIR /workspace
# Instala deps do frontend
COPY web/package*.json ./web/
RUN cd web && npm install
# Cria diretório app/public para o outDir do vite
RUN mkdir -p app/public
# Copia o código do frontend
COPY web ./web
# Build (outDir: '../app/public' no vite.config.js → /workspace/app/public)
RUN cd web && npm run build

# Stage 2: Imagem final de produção
FROM node:20-alpine
WORKDIR /usr/src/app

# Instala dependências do backend
COPY app/package*.json ./app/
RUN cd app && npm install --omit=dev

# Copia o código do backend
COPY app ./app

# Copia o build do frontend (gerado pelo vite no stage anterior)
COPY --from=frontend-build /workspace/app/public ./app/public

# Copia o site legado (HTML estático)
COPY site ./site

# Configurações de ambiente
ENV DB_PATH=/data/db.json
ENV PORT=3000
ENV NODE_ENV=production

# Volume para dados persistentes
VOLUME ["/data"]

EXPOSE 3000

WORKDIR /usr/src/app/app
CMD ["node", "server.js"]
