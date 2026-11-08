@echo off
chcp 65001 >nul
color 0B
title Instalador Oficial Kytto Supermercado & Multi-PDV — Windows

echo ===============================================================================
echo                KYTTO CLOUD ERP — SUPERMERCADO & MULTI-PDV 360
echo                  Instalador Automatizado para Windows 10 e 11
echo ===============================================================================
echo.
echo  [1/5] Verificando requisitos do sistema Windows...

set "APP_URL=https://setpoint.kytto.com.br/admin/supermercado?tab=pdv"
set "APP_NAME=Kytto Supermercado PDV"
set "INSTALL_DIR=C:\KyttoPDV"
set "BROWSER_EXE="

:: Detectar Microsoft Edge (Nativo em todos os Windows 10/11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
    goto browser_found
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
    goto browser_found
)

:: Detectar Google Chrome
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_NAME=Google Chrome"
    goto browser_found
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_NAME=Google Chrome"
    goto browser_found
)

echo [ERRO] Nem o Microsoft Edge nem o Google Chrome foram localizados.
echo Por favor, instale o Microsoft Edge ou Google Chrome e tente novamente.
pause
exit /b 1

:browser_found
echo  [OK] Motor Web local: %BROWSER_NAME%
echo.
echo  [2/5] Criando estrutura de pastas operacionais em %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\MGV6" mkdir "%INSTALL_DIR%\MGV6"
if not exist "%INSTALL_DIR%\Spool" mkdir "%INSTALL_DIR%\Spool"
if not exist "%INSTALL_DIR%\Backups" mkdir "%INSTALL_DIR%\Backups"

echo  - Pasta de Balanças Toledo MGV6 / Filizola: %INSTALL_DIR%\MGV6
echo  - Pasta de Spool Impressão Térmica: %INSTALL_DIR%\Spool
echo  - Pasta de Backups de Contingência: %INSTALL_DIR%\Backups
echo.

echo  [3/5] Criando executáveis e atalhos de Frente de Caixa...

:: Criar script lançador padrão
(
echo @echo off
echo start "" "%BROWSER_EXE%" --app="%APP_URL%" --window-size=1280,800
) > "%INSTALL_DIR%\Iniciar-Kytto-PDV.bat"

:: Criar script lançador modo Kiosk / Tela Cheia
(
echo @echo off
echo start "" "%BROWSER_EXE%" --app="%APP_URL%" --kiosk --start-fullscreen
) > "%INSTALL_DIR%\Iniciar-Kytto-PDV-Kiosk.bat"

echo.
echo  [4/5] Gerando atalhos na Área de Trabalho e Menu Iniciar...

:: VBScript temporário para gerar atalhos .lnk no Windows
set "VBS_SCRIPT=%TEMP%\create_kytto_shortcut.vbs"
(
echo Set oWS = WScript.CreateObject("WScript.Shell"^)
echo sDesktop = oWS.SpecialFolders("Desktop"^)
echo Set oLink = oWS.CreateShortcut(sDesktop ^& "\%APP_NAME%.lnk"^)
echo oLink.TargetPath = "%BROWSER_EXE%"
echo oLink.Arguments = "--app=""%APP_URL%"""
echo oLink.Description = "Kytto Supermercado & Multi-PDV 360"
echo oLink.WorkingDirectory = "%INSTALL_DIR%"
echo oLink.Save
echo sPrograms = oWS.SpecialFolders("Programs"^)
echo Set oLinkMenu = oWS.CreateShortcut(sPrograms ^& "\%APP_NAME%.lnk"^)
echo oLinkMenu.TargetPath = "%BROWSER_EXE%"
echo oLinkMenu.Arguments = "--app=""%APP_URL%"""
echo oLinkMenu.Description = "Kytto Supermercado & Multi-PDV 360"
echo oLinkMenu.WorkingDirectory = "%INSTALL_DIR%"
echo oLinkMenu.Save
) > "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" 2>nul

echo  - Atalho na Área de Trabalho: OK
echo  - Atalho no Menu Iniciar: OK
echo.

echo  [5/5] Finalizando instalação...
echo ===============================================================================
echo            INSTALAÇÃO DO KYTTO SUPERMERCADO CONCLUÍDA COM SUCESSO!
echo ===============================================================================
echo.
echo  O aplicativo está pronto para uso na sua Área de Trabalho:
echo  -> "%APP_NAME%"
echo.
echo  Para iniciar o Kytto PDV agora mesmo, pressione qualquer tecla...
pause >nul

start "" "%BROWSER_EXE%" --app="%APP_URL%"
exit /b 0
