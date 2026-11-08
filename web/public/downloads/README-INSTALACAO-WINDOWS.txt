===============================================================================
             KYTTO CLOUD ERP — SUPERMERCADO & MULTI-PDV 360
         Guia de Instalação e Configuração para Windows 10 e 11
===============================================================================

Este pacote contém todas as ferramentas para instalar e rodar o Kytto Supermercado
como uma aplicação desktop nativa (PWA de Alta Performance / Kiosk) no Windows.

-------------------------------------------------------------------------------
1. INSTALAÇÃO RÁPIDA (RECOMENDADA — 1 CLIQUE)
-------------------------------------------------------------------------------
1. Dê um duplo-clique no arquivo:
   -> "Instalar-Kytto-PDV-Windows.bat"
2. O instalador detectará automaticamente o Microsoft Edge ou Google Chrome.
3. Criará os atalhos na Área de Trabalho e no Menu Iniciar.
4. Criará as pastas estruturadas em C:\KyttoPDV:
   - C:\KyttoPDV\MGV6\ (para arquivos TXITENS.TXT de balança Toledo e Filizola)
   - C:\KyttoPDV\Spool\ (para arquivos de impressão térmica direta ESC/POS)
   - C:\KyttoPDV\Backups\ (para arquivos de contingência offline .json)
5. O Kytto Supermercado abrirá automaticamente em janela própria de PDV!

-------------------------------------------------------------------------------
2. INSTALAÇÃO VIA PWA DIRETO NO NAVEGADOR (EDGE OU CHROME)
-------------------------------------------------------------------------------
1. Acesse: https://setpoint.kytto.com.br/admin/supermercado
2. Na barra de endereço do navegador, clique no ícone "Instalar Aplicativo"
   (ou no botão "📱 Instalar App / PWA" dentro do cabeçalho do Kytto).
3. Confirme a instalação.
4. O Windows criará um aplicativo nativo que roda independente do navegador,
   com atalho na barra de tarefas, suporte a tela cheia (F11) e offline total.

-------------------------------------------------------------------------------
3. MODO QUIOSQUE / KIOSK (PARA FRENTE DE CAIXA DEDICADA OU TOTEM)
-------------------------------------------------------------------------------
Se a máquina for um PDV exclusivo ou Totem de Autoatendimento que não deve
permitir fechar ou minimizar a janela:
1. Execute o arquivo: C:\KyttoPDV\Iniciar-Kytto-PDV-Kiosk.bat
2. O sistema abrirá em tela cheia travada sem barras de navegação.

-------------------------------------------------------------------------------
4. SUPORTE A HARDWARE DE SUPERMERCADO
-------------------------------------------------------------------------------
- Balanças Toledo (MGV6 / MGV5) e Filizola:
  Exporte a carga pela aba "Carga Balanças" e salve em C:\KyttoPDV\MGV6\TXITENS.TXT.
  O software MGV6 da Toledo enviará automaticamente para as balanças via rede.
- Leitores de Código de Barras (Honeywell, Elgin, Zebra, Datalogic):
  Conecte via USB (modo teclado / emulação HID). O Kytto captura instantaneamente
  a bipagem em qualquer tela com retorno sonoro de confirmação.
- Impressoras Térmicas Não-Fiscais (Epson TM-T20, Bematech MP-4200, Elgin i9):
  Imprima normalmente via diálogo nativo do Windows ou spool térmico 80mm/58mm.

-------------------------------------------------------------------------------
SUPORTE TÉCNICO E ENGENHARIA KYTTO:
Site: https://kytto.com.br
Responsável Técnico: Rodrigo Gonçalves
===============================================================================
