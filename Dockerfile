# SetPoint — imagem única (API + site). Roda em qualquer PaaS com suporte a Docker.
FROM node:20-alpine
WORKDIR /usr/src/app

# instala dependências do backend
COPY app/package*.json ./app/
RUN cd app && npm install --omit=dev

# copia código (backend + site)
COPY app ./app
COPY site ./site

# dados persistentes (monte um volume aqui em produção)
ENV DB_PATH=/data/db.json
VOLUME ["/data"]

ENV PORT=3000
EXPOSE 3000
WORKDIR /usr/src/app/app
CMD ["node", "server.js"]
