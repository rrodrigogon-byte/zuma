@echo off
REM SetPoint - clique duas vezes para abrir no Windows.
REM (Requer o Node.js instalado: https://nodejs.org - baixe a versao "LTS".)
cd /d "%~dp0app"
echo Instalando dependencias (so na 1a vez)...
call npm install
echo Abrindo o SetPoint no navegador...
start "" "http://localhost:3000"
set JWT_SECRET=local
set ADMIN_PASS=agroopen2026
node server.js
pause
