# ===============================================================================
# KYTTO CLOUD ERP — SUPERMERCADO & MULTI-PDV 360
# Script de Instalação Nativo PowerShell para Windows 10 e 11
# ===============================================================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "           KYTTO CLOUD ERP — SUPERMERCADO & MULTI-PDV 360                     " -ForegroundColor Cyan
Write-Host "             Instalador Avançado PowerShell para Windows                       " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$AppUrl = "https://setpoint.kytto.com.br/admin/supermercado?tab=pdv"
$AppName = "Kytto Supermercado PDV"
$InstallDir = "C:\KyttoPDV"
$IconUrl = "https://setpoint.kytto.com.br/favicon.svg"
$IconPath = "$InstallDir\kytto.ico"

# 1. Localizar navegador com suporte PWA
Write-Host "[1/5] Detectando navegador de alta performance..." -ForegroundColor Yellow
$BrowserExe = $null

$EdgePath1 = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
$EdgePath2 = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
$ChromePath1 = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$ChromePath2 = "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"

if (Test-Path $EdgePath1) { $BrowserExe = $EdgePath1; $BrowserName = "Microsoft Edge" }
elseif (Test-Path $EdgePath2) { $BrowserExe = $EdgePath2; $BrowserName = "Microsoft Edge" }
elseif (Test-Path $ChromePath1) { $BrowserExe = $ChromePath1; $BrowserName = "Google Chrome" }
elseif (Test-Path $ChromePath2) { $BrowserExe = $ChromePath2; $BrowserName = "Google Chrome" }
else {
    Write-Host "[ERRO] Nenhum navegador compatível encontrado." -ForegroundColor Red
    Exit 1
}

Write-Host "  -> Motor selecionado: $BrowserName ($BrowserExe)" -ForegroundColor Green

# 2. Criar diretórios
Write-Host "[2/5] Criando estrutura de pastas operacionais..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\MGV6" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\Spool" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\Backups" | Out-Null
Write-Host "  -> Pastas criadas em $InstallDir (MGV6, Spool, Backups)" -ForegroundColor Green

# 3. Criar scripts de execução
Write-Host "[3/5] Gerando inicializadores de frente de caixa..." -ForegroundColor Yellow
$NormalLauncher = @"
@echo off
start "" "$BrowserExe" --app="$AppUrl" --window-size=1280,800
"@
$NormalLauncher | Out-File -Encoding ASCII -FilePath "$InstallDir\Iniciar-PDV.bat"

$KioskLauncher = @"
@echo off
start "" "$BrowserExe" --app="$AppUrl" --kiosk --start-fullscreen
"@
$KioskLauncher | Out-File -Encoding ASCII -FilePath "$InstallDir\Iniciar-PDV-Kiosk.bat"
Write-Host "  -> Inicializadores salvos em $InstallDir" -ForegroundColor Green

# 4. Criar atalhos na Área de Trabalho e Menu Iniciar
Write-Host "[4/5] Criando atalhos na Área de Trabalho e Menu Iniciar..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ShortcutDesktop = $WshShell.CreateShortcut("$DesktopPath\$AppName.lnk")
$ShortcutDesktop.TargetPath = $BrowserExe
$ShortcutDesktop.Arguments = "--app=""$AppUrl"""
$ShortcutDesktop.WorkingDirectory = $InstallDir
$ShortcutDesktop.Description = "Kytto Supermercado & Multi-PDV 360"
$ShortcutDesktop.Save()

$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
$ShortcutMenu = $WshShell.CreateShortcut("$ProgramsPath\$AppName.lnk")
$ShortcutMenu.TargetPath = $BrowserExe
$ShortcutMenu.Arguments = "--app=""$AppUrl"""
$ShortcutMenu.WorkingDirectory = $InstallDir
$ShortcutMenu.Description = "Kytto Supermercado & Multi-PDV 360"
$ShortcutMenu.Save()

Write-Host "  -> Atalhos criados com sucesso!" -ForegroundColor Green

# 5. Conclusão
Write-Host "[5/5] Instalação finalizada com êxito!" -ForegroundColor Yellow
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "                 KYTTO PDV INSTALADO COM SUCESSO!                              " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando o Kytto Supermercado agora..." -ForegroundColor Cyan

Start-Process -FilePath $BrowserExe -ArgumentList "--app=""$AppUrl"""
