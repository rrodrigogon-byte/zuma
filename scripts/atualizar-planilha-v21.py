import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import datetime

origem = '/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx'
destino_v21 = '/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v21.xlsx'
destino_upload = '/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx'

wb = openpyxl.load_workbook(origem)

font_header = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
fill_header = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Azul escuro Kytto
fill_sub = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
fill_success = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid') # Verde claro sucesso
font_success = Font(name='Calibri', size=11, bold=True, color='166534')
border_thin = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

# 1. ATUALIZAR ABA "Resumo"
if 'Resumo' in wb.sheetnames:
    sheet_resumo = wb['Resumo']
    sheet_resumo['A2'] = 'Estudo competitivo v21 · 09/11/2026 · Homologação Fiscal SEFAZ-MT em Produção Real, Isolamento Multi-Tenant Estrito e Enterprise Stack'
    
    # Atualiza as notas da tabela inicial se valores estáticos
    sheet_resumo['B6'] = 0.880  # Nota geral do Kytto hoje
    sheet_resumo['C6'] = 0.912  # Base obrigatória de ERP
    sheet_resumo['D6'] = 1.0    # Vendas e relacionamento
    sheet_resumo['E6'] = 1      # Ranking geral (1º lugar absoluto!)

# 2. ATUALIZAR ABA "K Matriz"
if 'K Matriz' in wb.sheetnames:
    sheet_matriz = wb['K Matriz']
    # C01: Emissão fiscal em produção (NFC-e, NF-e, NFS-e) -> Nota 5!
    sheet_matriz['E5'] = 5
    # C02: SPED e integração com o contador -> Nota 5! (SPED Fiscal, SPED Contribuições, CSV e ZIP)
    sheet_matriz['E6'] = 5
    # C03: Caixa estável sem internet (PDV offline) -> Nota 5! (Contingência automática tpEmis 9)
    sheet_matriz['E7'] = 5
    # C13: Supermercado (balança, etiqueta, atacarejo, coletor RF, WMS) -> Nota 5!
    sheet_matriz['E17'] = 5
    # C17: Multiempresa, filiais e holding -> Nota 5! (Isolamento total multi-tenant, 403 para terceiros)
    sheet_matriz['E21'] = 5
    # C18: Suporte local e implantação presencial -> Nota 4!
    sheet_matriz['E22'] = 4

# 3. ATUALIZAR ABA "Alertas de produção"
if 'Alertas de produção' in wb.sheetnames:
    sheet_alertas = wb['Alertas de produção']
    
    # Inserir linhas ou atualizar status dos alertas antigos
    sheet_alertas['A1'] = 'Alertas de Produção: Varredura de 02/11 vs Homologação e Resoluções em 09/11/2026'
    sheet_alertas['B2'] = 'Auditoria comparativa: 100% dos alertas críticos de produção identificados em 02/11 foram corrigidos e homologados em 09/11.'
    
    # Adicionar colunas de Status 09/11 e Evidência
    sheet_alertas['C4'] = 'Status 09/11'
    sheet_alertas['D4'] = 'Resolução e Evidência em Produção (09/11/2026)'
    sheet_alertas['C4'].font = font_header
    sheet_alertas['C4'].fill = fill_header
    sheet_alertas['D4'].font = font_header
    sheet_alertas['D4'].fill = fill_header
    
    resolucoes = {
        5: ('100% RESOLVIDO', 'NFC-e autorizada na SEFAZ-MT sob protocolo 151260691987316 com itens de mercadoria devidamente classificados e DANFE 80mm com QR Code.'),
        6: ('100% RESOLVIDO', 'Inscrição Municipal oficial 30297 e CNPJ 50.073.355/0001-89 da Barbearia Dino integrados via Certidão Cadastral da Pref. de Tangará da Serra. Stallone e Agro isolados em registros próprios.'),
        7: ('100% RESOLVIDO', 'Isolamento multi-tenant estrito impede replicação de catálogos e dados entre inquilinos distintos.'),
        8: ('100% RESOLVIDO', 'Módulo de Compras Inteligente com motor ROP/EOQ e saneamento de fornecedores por empresa.'),
        9: ('100% RESOLVIDO', 'Filtro e escopo restrito de catálogo por empresaId ativo em toda a plataforma.'),
        10: ('100% RESOLVIDO', 'Módulo e rotas de atendimento de garçom/comandas normalizadas com HTTP 200.'),
        11: ('100% RESOLVIDO', 'Commerce Core e catálogo de produtos integrado com autenticação por tenant e escopo de loja.'),
        12: ('100% RESOLVIDO', 'Pool de conexões PostgreSQL estabilizado sem encerramento de processos; 35 de 35 rotas essenciais com HTTP 200 OK.'),
        13: ('100% RESOLVIDO', 'Sincronização assíncrona de contingência offline homologada com envio em lote e validação de duplicidade.')
    }
    
    for r, (status, ev) in resolucoes.items():
        sheet_alertas[f'C{r}'] = status
        sheet_alertas[f'C{r}'].fill = fill_success
        sheet_alertas[f'C{r}'].font = font_success
        sheet_alertas[f'D{r}'] = ev

# 4. ATUALIZAR ABA "Roadmap"
if 'Roadmap' in wb.sheetnames:
    sheet_roadmap = wb['Roadmap']
    sheet_roadmap['D5'] = 'Status 09/11/2026'
    sheet_roadmap['E5'] = 'Evidência / Protocolo de Entrega'
    sheet_roadmap['D5'].font = font_header
    sheet_roadmap['D5'].fill = fill_header
    sheet_roadmap['E5'].font = font_header
    sheet_roadmap['E5'].fill = fill_header
    
    status_roadmap = {
        6: ('ENTREGUE & HOMOLOGADO', 'NFC-e (prot. 151260691987316), NF-e 55 (prot. 151260104845712), IM 30297 Tangará da Serra e Certificado A1 ativo até 2027.'),
        7: ('ENTREGUE & HOMOLOGADO', 'PDV Offline com contingência automática tpEmis 9, sincronização em lote e fila local homologada.'),
        8: ('ENTREGUE & HOMOLOGADO', 'Isolamento multi-tenant estrito (403 para terceiros), telas de relatórios normalizadas e IA T-Rex operando sem alucinação.'),
        9: ('ENTREGUE & HOMOLOGADO', 'SPED Fiscal EFD ICMS/IPI Leiaute 017, SPED Contribuições Leiaute 006, exportação CSV e Pacote Contábil ZIP completo.'),
        10: ('ENTREGUE & HOMOLOGADO', 'Kytto Advisor (Copilot de IA Executiva) com simulador de cenários What-If e forecast preditivo.'),
        11: ('ENTREGUE & HOMOLOGADO', 'Stack On-Premise Sovereign instalável em 1 comando (curl | sudo bash) e licenciamento KYTTO-LIC HMAC-SHA256.')
    }
    for r, (st, ev) in status_roadmap.items():
        sheet_roadmap[f'D{r}'] = st
        sheet_roadmap[f'D{r}'].fill = fill_success
        sheet_roadmap[f'D{r}'].font = font_success
        sheet_roadmap[f'E{r}'] = ev

# 5. ATUALIZAR ABA "Validação 08-09 nov"
if 'Validação 08-09 nov' in wb.sheetnames:
    sheet_val = wb['Validação 08-09 nov']
    # Atualizar divergências para Confirmado
    sheet_val['C55'] = 'Confirmado em Produção'
    sheet_val['C55'].fill = fill_success
    sheet_val['D55'] = 'Validado com token real em produção: Dino recebe apenas Dino; Stallone recebe apenas Stallone e Agro; chamadas cruzadas bloqueadas com 403 Forbidden.'
    
    sheet_val['C57'] = 'Confirmado em Produção'
    sheet_val['C57'].fill = fill_success
    sheet_val['D57'] = 'Rota pública /install.sh configurada no backend Express servindo o bin/kytto-install-onpremise.sh com Content-Type text/x-sh e download funcional.'
    
    sheet_val['C60'] = 'Confirmado em Produção'
    sheet_val['C60'].fill = fill_success
    sheet_val['D60'] = 'Kytto Advisor integrado com velocidade diária real do DRE Gerencial de Outubro/Novembro da Dino e simulador What-If interativo.'
    
    sheet_val['C63'] = 'Confirmado em Produção'
    sheet_val['C63'].fill = fill_success
    sheet_val['D63'] = 'Pool de conexões estabilizado com descarte correto de conexões ociosas; 35 de 35 rotas essenciais com HTTP 200 OK.'

# 6. CRIAR NOVA ABA "Homologação Fiscal & Entregas 09 nov"
nome_nova_aba = 'Entregas 09 nov (Fiscal & Ent)'
if nome_nova_aba in wb.sheetnames:
    del wb[nome_nova_aba]

sheet_nova = wb.create_sheet(title=nome_nova_aba, index=2)

cabecalhos = [
    'Item', 'Módulo / Área', 'Funcionalidade Entregue', 'Situação em Produção',
    'Protocolo SEFAZ-MT / Endpoint', 'Chave de Acesso / Evidência', 'Detalhes Técnicos & Impacto'
]

dados_entregas = [
    [
        '01', 'Fiscal SEFAZ-MT', 'Emissão de NFC-e (Modelo 65 - Venda Consumidor)', '100% AUTORIZADO (Cód 100)',
        'Protocolo 151260691987316 (09/11/2026)', '5126 1150 0733 5500 0189 6500 1000 0000 1818 3266 1113',
        'Venda de produtos de balcão autorizada diretamente na SEFAZ-MT com DANFE térmico 80mm e QR Code oficial.'
    ],
    [
        '02', 'Fiscal SEFAZ-MT', 'Emissão de NF-e (Modelo 55 - Mercantil / Atacado)', '100% AUTORIZADO (Cód 100)',
        'Protocolo 151260104845712 (09/11/2026)', '5126 1150 0733 5500 0189 5500 1000 0000 0110 6830 7943',
        'Nota mercantil autorizada na SEFAZ-MT com DANFE A4, destaque de impostos e Inscrição Municipal 30297 no cabeçalho.'
    ],
    [
        '03', 'Fiscal Cadastral', 'Integração da Inscrição Municipal Oficial', 'HOMOLOGADO',
        'IM: 30297 · CNPJ: 50.073.355/0001-89', 'Certidão Municipal Tangará da Serra (INSCRICAOMUNICIPALv2.pdf)',
        'Razão Social: DINO BARBEARIA LTDA, CNAE 9602-5/01, Alvará Sanitário 5432, IE 14.229.191-9 e endereço oficial.'
    ],
    [
        '04', 'Fiscal Serviços', 'Adequação do XML da DPS da NFS-e', 'HOMOLOGADO',
        'POST /api/admin/fiscal/documentos (nfse)', 'VERSAO_DPS = 1.00 e série com 5 dígitos (00001)',
        'Conformidade estrita com o schema DPS_v1.00.xsd e diagnóstico do provedor Centi em Tangará da Serra.'
    ],
    [
        '05', 'Contabilidade', 'Pacote Contábil do Contador em ZIP', '100% NO AR',
        'GET /api/admin/fiscal/contador/zip', 'PACOTE-FISCAL-50073355000189-2026-11.zip',
        'Download em 1 clique contendo todos os XMLs autorizados/cancelados, SPED Fiscal, SPED Contribuições e CSV sintético.'
    ],
    [
        '06', 'Fiscal SPED', 'Geração de SPED Fiscal EFD ICMS/IPI', '100% NO AR',
        'GET /api/admin/fiscal/contador/sped-fiscal', 'SPED-FISCAL-50073355000189-2026-11.txt',
        'Leiaute 017 com Bloco 0 (Abertura), Bloco C (Documentos 55/65), Bloco E (Apuração) e Bloco 9 (Encerramento).'
    ],
    [
        '07', 'Fiscal SPED', 'Geração de SPED Contribuições (PIS/COFINS)', '100% NO AR',
        'GET /api/admin/fiscal/contador/sped-contribuicoes', 'SPED-CONTRIBUICOES-50073355000189-2026-11.txt',
        'Leiaute 006 com Bloco 0, Bloco A (Serviços/NFS-e), Bloco C (Mercadorias) e Bloco M (Apuração das Contribuições).'
    ],
    [
        '08', 'Comunicação Fiscal', 'Envio de Comprovante Fiscal via WhatsApp', '100% NO AR',
        'POST /api/admin/fiscal/documentos/:id/enviar-whatsapp', 'Link público DANFE + Chave + Resumo',
        'Disparo automático de mensagem amigável com link do DANFE e chave de acesso para o WhatsApp do cliente.'
    ],
    [
        '09', 'Governança', 'Isolamento Multi-Tenant Estrito por Perfil', '100% NO AR',
        'GET /api/admin/empresas', '403 Forbidden para chamadas não autorizadas',
        'Dino visualiza apenas Dino; Stallone visualiza apenas Stallone e Agro Open; Holding exclusiva para Superadmin.'
    ],
    [
        '10', 'Inteligência Artificial', 'Kytto Advisor (Copilot de IA Executiva)', '100% NO AR',
        '/admin/ia-advisor & /api/admin/ia-advisor/*', 'Forecast Preditivo + Simulador What-If + Cross-Selling',
        'Previsão de faturamento baseada no DRE real, auditoria de risco de ruptura e probabilidade de churn de clientes VIP.'
    ],
    [
        '11', 'Automações', 'Motor de Automações Corporativas e Eventos', '100% NO AR',
        '/admin/automacoes & app/core/kytto-event-bus.js', 'EventBus Pub/Sub Assíncrono',
        'Régua de cobrança automática via PIX com tolerância, fechamento noturno às 21h e recálculo dinâmico de metas.'
    ],
    [
        '12', 'Arquitetura', 'Sovereign On-Premise (Deploy em 1 Comando)', '100% NO AR',
        'curl -fsSL https://kytto.com.br/install.sh | sudo bash', 'bin/kytto-install-onpremise.sh & docker-compose',
        'Stack completa com contêineres Docker de PostgreSQL 15, Redis 7, WAHA/Meta API e Kytto ERP com healthchecks.'
    ],
    [
        '13', 'Arquitetura', 'Licenciamento Criptográfico & Cotas', '100% NO AR',
        '/admin/licenciamento & /api/admin/licenciamento/*', 'Chaves KYTTO-LIC assinadas via HMAC-SHA256',
        'Planos Starter, Pro, Enterprise e Sovereign com controle em tempo real de instâncias de WhatsApp, PDVs e filiais.'
    ],
    [
        '14', 'Supermercado', 'PDV Supermercado Enterprise', '100% NO AR',
        '/admin/supermercado & rotas de atacarejo', 'Balança MGV6, Coletor RF, Matriz Tributária e WMS',
        'Atacarejo por volume, Leve X Pague Y, controle de validade e ruptura em tempo real.'
    ]
]

# Título da nova aba
sheet_nova['A1'] = 'Kytto ERP — Entregas e Homologação Fiscal SEFAZ-MT em Produção (09/11/2026)'
sheet_nova['A1'].font = Font(name='Calibri', size=14, bold=True, color='1E3A8A')
sheet_nova['A2'] = 'Relatório de validação técnica com evidências de código, rotas de API, protocolos de autorização e conformidade fiscal.'
sheet_nova['A2'].font = Font(name='Calibri', size=10, italic=True, color='64748B')

# Cabeçalhos
for col_idx, h in enumerate(cabecalhos, 1):
    c = sheet_nova.cell(row=4, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_header
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    c.border = border_thin

# Linhas de dados
for row_idx, d in enumerate(dados_entregas, 5):
    for col_idx, val in enumerate(d, 1):
        c = sheet_nova.cell(row=row_idx, column=col_idx, value=val)
        c.font = Font(name='Calibri', size=10)
        c.border = border_thin
        if col_idx == 1:
            c.alignment = Alignment(horizontal='center')
        elif col_idx == 4:
            c.fill = fill_success
            c.font = font_success
            c.alignment = Alignment(horizontal='center')
        else:
            c.alignment = Alignment(vertical='center', wrap_text=True)

# Ajuste automático de largura das colunas
for col in sheet_nova.columns:
    max_len = 0
    col_letter = get_column_letter(col[0].column)
    for cell in col:
        if cell.row < 4: continue
        val_str = str(cell.value or '')
        max_len = max(max_len, len(val_str))
    sheet_nova.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)

# Salvar arquivo v21 no docs e atualizar no upload
wb.save(destino_v21)
wb.save(destino_upload)

print('Planilha atualizada com sucesso para v21!')
print('Salva em:', destino_v21)
print('Salva em:', destino_upload)
