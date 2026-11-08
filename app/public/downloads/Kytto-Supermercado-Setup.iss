; ===============================================================================
; KYTTO CLOUD ERP — SUPERMERCADO & MULTI-PDV 360
; Script de Compilação Inno Setup 6 para Gerar Instalador Executável (.exe)
; ===============================================================================

#define MyAppName "Kytto Supermercado PDV"
#define MyAppVersion "5.5"
#define MyAppPublisher "Kytto Cloud ERP"
#define MyAppURL "https://setpoint.kytto.com.br/admin/supermercado"
#define MyAppExeName "Iniciar-Kytto-PDV.bat"

[Setup]
AppId={{D37F7361-9B5A-4B7C-A20D-1B2F6E367A81}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\KyttoPDV
DisableDirPage=no
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=Kytto-Supermercado-PDV-Setup-v5.5
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "kioskmode"; Description: "Habilitar atalho em Modo Kiosk / Tela Cheia (Frente de Caixa Dedicada)"; GroupDescription: "Configurações Operacionais:"; Flags: unchecked

[Dirs]
Name: "{app}\MGV6"; Permissions: users-modify
Name: "{app}\Spool"; Permissions: users-modify
Name: "{app}\Backups"; Permissions: users-modify

[Files]
Source: "Instalar-Kytto-PDV-Windows.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "Instalar-Kytto-PDV-Windows.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "README-INSTALACAO-WINDOWS.txt"; DestDir: "{app}"; Flags: isreadme

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall skipifsilent
