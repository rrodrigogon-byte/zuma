import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

wb = openpyxl.load_workbook('/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx')

# Atualiza aba Resumo
ws_resumo = wb['Resumo']
ws_resumo['A2'] = 'KYTTO ERP ENTERPRISE — PLATAFORMA SAAS & ON-PREMISE VS MERCADO (v22)'
ws_resumo['A3'] = 'Atualização Consolidada: 09/Nov/2026 — Conciliação Bancária OFX Integrada, Briefing Matinal da Equipe, Fiscal SEFAZ-MT e On-Premise'

# Nova aba de Registro de Evoluções e Homologações v22
ws_v22 = wb.create_sheet(title='Homologação 09 Nov v22')

header_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid')
header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
border_thin = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

headers = ['ID', 'Módulo / Funcionalidade', 'Status Produção', 'Evidência / Print', 'Benefício Executivo para o Negócio']
ws_v22.append(headers)

for col_num, cell in enumerate(ws_v22[1], 1):
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center')

dados_v22 = [
    [
        'HOM-01',
        'Conciliação Bancária OFX & PIX Integrada',
        '✅ 100% Homologado em Produção (Live)',
        '17-financeiro-conciliacao-bancaria-ofx.png',
        'Importação direta de extrato bancário OFX de qualquer banco (Sicredi, Sicoob, Itaú, Bradesco, Nubank), cruzamento com o Razão e baixa de contas em 1 clique.'
    ],
    [
        'HOM-02',
        'Briefing Matinal da Equipe & Metas (08:00)',
        '✅ 100% Homologado em Produção (Live)',
        'kytto-briefing-matinal-conciliacao.test.js',
        'Disparo às 08h00 via WhatsApp para os barbeiros e gestão: horários agendados, vagas livres para encaixe, clientes VIP e progresso das metas individuais.'
    ],
    [
        'HOM-03',
        'Módulo Fiscal Oficial Dino com IM 30297',
        '✅ 100% Homologado em Produção (Live)',
        '14-fiscal-emitente-dino-oficial.png',
        'Inscrição Municipal 30297 (Prefeitura de Tangará da Serra MT), emissão autorizada de NFC-e 65 e NF-e 55 na SEFAZ-MT e pacote contábil mensal em ZIP.'
    ],
    [
        'HOM-04',
        'Isolamento Multi-Tenant Estrito por Usuário',
        '✅ 100% Homologado em Produção (Live)',
        '05-empresas-isolamento-tenant-dino.png',
        'Blindagem estrita: Dino só acessa dados e cadastros da Dino; Silvester acessa Stallone e Agro Open; Superadmin gerencia a holding completa.'
    ],
    [
        'HOM-05',
        'Comprador Inteligente & Cotações RFQ B2B',
        '✅ 100% Homologado em Produção (Live)',
        'DinoComprasEstoqueHub.jsx',
        'Ponto de reposição ROP, lote econômico EOQ, mapa comparativo entre fornecedores e aprovação com lançamento automático no Contas a Pagar.'
    ],
    [
        'HOM-06',
        'IA Kytto Advisor & Simulador What-If',
        '✅ 100% Homologado em Produção (Live)',
        '11-ia-advisor-forecast-simulador.png',
        'Forecast preditivo de receita por regressão linear ponderada, auditoria preventiva de anomalias e simulador dinâmico de ticket médio e churn.'
    ],
    [
        'HOM-07',
        'Stack On-Premise Soberana & Licenciamento',
        '✅ 100% Homologado em Produção (Live)',
        '13-licenciamento-guia-onpremise-stack.png',
        'Deploy soberano com Docker Compose, chaves HMAC-SHA256 assinadas digitalmente e instalador rápido via curl https://kytto.com.br/install.sh.'
    ]
]

for row in dados_v22:
    ws_v22.append(row)

for row in ws_v22.iter_rows(min_row=2, max_row=len(dados_v22)+1, min_col=1, max_col=5):
    for cell in row:
        cell.border = border_thin
        cell.alignment = Alignment(vertical='center', wrap_text=True)

# Ajuste de larguras de colunas
ws_v22.column_dimensions['A'].width = 12
ws_v22.column_dimensions['B'].width = 38
ws_v22.column_dimensions['C'].width = 32
ws_v22.column_dimensions['D'].width = 38
ws_v22.column_dimensions['E'].width = 50

# Salvar planilha atualizada v22
caminho_v22 = '/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v22.xlsx'
wb.save(caminho_v22)
wb.save('/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v22.xlsx')
print("Planilha v22 salva com sucesso!")
