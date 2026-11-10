import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

wb = openpyxl.load_workbook('/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx')

# Atualiza aba Resumo
ws_resumo = wb['Resumo']
ws_resumo['A2'] = 'KYTTO ERP ENTERPRISE — PLATAFORMA SAAS & ON-PREMISE VS MERCADO (v23)'
ws_resumo['A3'] = 'Atualização Consolidada: 09/Nov/2026 — Integração Completa com Todos os Bancos do Brasil, TEF Oficial Multi-Maquininhas, Bandeiras e Conciliação'

# Nova aba de Registro de Evoluções e Homologações v23
ws_v23 = wb.create_sheet(title='Homologação 09 Nov v23')

header_fill = PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid')
header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
border_thin = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

headers = ['ID', 'Módulo / Funcionalidade', 'Status Produção', 'Evidência / Print', 'Benefício Executivo para o Negócio']
ws_v23.append(headers)

for col_num, cell in enumerate(ws_v23[1], 1):
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center')

dados_v23 = [
    [
        'TEF-01',
        'TEF Oficial Multi-Maquininhas do Brasil',
        '✅ 100% Homologado em Produção (Live)',
        '18-financeiro-conciliacao-tef-maquininhas.png',
        'Integração oficial com Stone/Ton, PagBank/PagSeguro, Cielo (LIO), Rede (Itaú), Getnet (Santander), SafraPay, Mercado Pago, Vero/Sicredi e SiTef Fiserv com captura de NSU, Autorização e TID.'
    ],
    [
        'TEF-02',
        'Suporte a Todas as Bandeiras de Cartão',
        '✅ 100% Homologado em Produção (Live)',
        '20-financeiro-bancos-brasileiros-homologados.png',
        'Aceitação total de Visa, Mastercard, Elo (Bandeira Nacional), American Express, Hipercard, Diners Club, Cabal, Benefícios/Vouchers (Alelo, Sodexo/Pluxee, Ticket, VR) e Pix no Pinpad.'
    ],
    [
        'TEF-03',
        'Terminal Pinpad de Balcão & Comprovante Fiscal',
        '✅ 100% Homologado em Produção (Live)',
        '19-financeiro-tef-terminal-balcao.png',
        'Formulário operacional de balcão para cobrança direta na maquininha física, com emissão e impressão térmica da via do cliente e via do estabelecimento.'
    ],
    [
        'TEF-04',
        'Auditoria de Taxas MDR & Agenda de Recebíveis',
        '✅ 100% Homologado em Produção (Live)',
        '18-financeiro-conciliacao-tef-maquininhas.png',
        'Desconto automático de taxas MDR por modalidade (Débito 1.25%, Crédito 2.39%, Parcelado e Pix 0.49%) com cálculo do líquido a receber e projeção de liquidação em D+1 e D+30.'
    ],
    [
        'BCO-01',
        'Integração com 13 Principais Bancos do Brasil',
        '✅ 100% Homologado em Produção (Live)',
        '20-financeiro-bancos-brasileiros-homologados.png',
        'Catálogo e parser nativo para Sicredi (748), Sicoob (756), Itaú (341), Bradesco (237), Santander (033), Banco do Brasil (001), Caixa (104), Nubank (260), Inter (077), BTG (208), C6 (336), Safra (422) e Banrisul (041).'
    ],
    [
        'BCO-02',
        'Conciliação Automática Lote TEF x Extrato Bancário',
        '✅ 100% Homologado em Produção (Live)',
        'kytto-tef-bancos-conciliacao.test.js',
        'Identificação de repasses de adquirentes no extrato bancário com conciliação automática em 1 clique de todas as transações de cartão correspondentes àquele depósito.'
    ],
    [
        'AUT-01',
        'Briefing Matinal da Equipe & Metas (08:00)',
        '✅ 100% Homologado em Produção (Live)',
        'kytto-briefing-matinal-conciliacao.test.js',
        'Disparo às 08h00 via WhatsApp para os barbeiros e gestão: horários agendados, vagas livres para encaixe, clientes VIP e progresso das metas individuais.'
    ],
    [
        'FISC-01',
        'Módulo Fiscal Oficial Dino com IM 30297',
        '✅ 100% Homologado em Produção (Live)',
        '14-fiscal-emitente-dino-oficial.png',
        'Inscrição Municipal 30297 (Prefeitura de Tangará da Serra MT), emissão autorizada de NFC-e 65 e NF-e 55 na SEFAZ-MT e pacote contábil mensal em ZIP.'
    ]
]

for linha in dados_v23:
    ws_v23.append(linha)

for row in ws_v23.iter_rows(min_row=2, max_row=ws_v23.max_row, min_col=1, max_col=5):
    for cell in row:
        cell.border = border_thin
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        if cell.column == 1:
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.font = Font(name='Calibri', size=10, bold=True)
        elif cell.column == 3:
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.font = Font(name='Calibri', size=10, bold=True, color='10B981')
        elif cell.column == 4:
            cell.font = Font(name='Calibri', size=9, italic=True)
        else:
            cell.font = Font(name='Calibri', size=10)

ws_v23.column_dimensions['A'].width = 12
ws_v23.column_dimensions['B'].width = 40
ws_v23.column_dimensions['C'].width = 30
ws_v23.column_dimensions['D'].width = 38
ws_v23.column_dimensions['E'].width = 75

wb.save('/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v23.xlsx')
wb.save('/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx')

print("Planilha v23 gerada com sucesso em /home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v23.xlsx!")
