#!/bin/bash
# SetPoint — clique duas vezes para abrir no seu Mac.
# (Requer o Node.js instalado: https://nodejs.org — baixe a versão "LTS".)
cd "$(dirname "$0")/app" || exit 1
echo "Instalando dependências (só na 1ª vez)..."
npm install
echo "Abrindo o SetPoint no navegador..."
( sleep 3 && open "http://localhost:3000" ) &
JWT_SECRET=local ADMIN_PASS=agroopen2026 npm start
