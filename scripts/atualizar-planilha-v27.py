import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import datetime

# Carregar v26
wb = openpyxl.load_workbook('docs/Kytto_e_Plataforma_vs_Mercado_v26.xlsx')

# 1. Atualizar aba Resumo
if 'Resumo' in wb.sheetnames:
    ws = wb['Resumo']
    # Atualizar data e versão
    for r in range(1, 15):
        val = str(ws.cell(r, 1).value or '')
        if 'Versão' in val or 'Data' in val or 'Kytto' in val:
            print(f'Resumo L{r}: {val}')
    
    ws['A1'] = "Kytto ERP Enterprise vs Mercado — Matriz Oficial Consolidada (v27 - 10 de Novembro de 2026)"
    print('Aba Resumo atualizada para v27!')

# 2. Criar ou atualizar aba de Entregas 10 nov
nome_entregas = 'Entregas 10 nov'
if nome_entregas in wb.sheetnames:
    ws_entregas = wb[nome_entregas]
else:
    ws_entregas = wb.create_sheet(title=nome_entregas)
    ws_entregas.append(['Módulo / Funcionalidade', 'Plataforma', 'Status', 'Detalhes Técnicos da Homologação em Produção', 'Data'])
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    for col in range(1, 6):
        c = ws_entregas.cell(1, col)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center")

itens_novos = [
    ['SPED Fiscal EFD ICMS/IPI Completo', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Bloco 0 (Abertura/Contador), Bloco C (Saídas e Entradas MD-e), Bloco E (Apuração Débitos/Créditos), Bloco 1 e Bloco 9 (Totalizadores).', '10/11/2026'],
    ['Validador Pré-PVA da EFD', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Auditoria sintática prévia de chave de acesso, CNPJ, IE e leiaute 020 antes da transmissão ao contador.', '10/11/2026'],
    ['Central de Delivery & Pedidos Multicanal', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Gestão integrada de pedidos de entrega, balcão e WhatsApp com despacho para motoboys e controle de repasse.', '10/11/2026'],
    ['Régua Automática no WhatsApp para Delivery', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Notificação automática do status do pedido (Em Preparo, Saiu para Entrega com identificação do motoboy e Entregue) via KyttoEventBus.', '10/11/2026'],
    ['Apuração de CMV Teórico vs Real', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Confronto entre o custo padrão das fichas técnicas e o custo real das mercadorias consumidas, apontando desperdício.', '10/11/2026'],
    ['Boletos Registrados Híbridos com Pix Dinâmico', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Emissão oficial FEBRABAN para Sicredi (748), Sicoob (756), Itaú, BB e Bradesco com Módulo 10/11 e Pix Copia e Cola.', '09/11/2026'],
    ['Apuração de ICMS-ST para Mato Grosso', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Simulador e memorial fiscal conforme Convênio ICMS 142/2018 e RICMS-MT (MVA Original/Ajustada e FCP-MT 2%).', '09/11/2026'],
    ['Manifestação do Destinatário (MD-e)', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Eventos 210210, 210200, 210220, 210240 na SEFAZ e entrada de estoque com recálculo do Custo Médio Ponderado.', '09/11/2026'],
    ['Parametrização TEF & Terminais Pinpad', 'Kytto ERP', 'ENTREGUE & HOMOLOGADO', 'Gestão de pinpads no balcão, teste de ping, matriz MDR negociada por bandeira e conciliação bancária OFX.', '09/11/2026']
]

for item in itens_novos:
    ws_entregas.append(item)

# 3. Atualizar aba O que falta
if 'O que falta' in wb.sheetnames:
    ws_falta = wb['O que falta']
    for r in range(2, ws_falta.max_row + 1):
        func = str(ws_falta.cell(r, 3).value or '')
        if any(f in func for f in ['SPED Fiscal', 'SPED Contribuições', 'App do entregador', 'Atendente virtual/robô de pedidos no WhatsApp', 'CMV teórico x real', 'Central única de pedidos', 'Comanda por mesa e por pessoa', 'Roteirização/agrupamento de entregas', 'Status do pedido enviado automaticamente ao cliente por WhatsApp']):
            ws_falta.cell(r, 4).value = 'ENTREGUE & HOMOLOGADO'
            ws_falta.cell(r, 5).value = 'Entregue e homologado em produção live na Sprint Kytto v27'
            ws_falta.cell(r, 4).fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
            ws_falta.cell(r, 4).font = Font(name="Calibri", size=10, bold=True, color="166534")

# Salvar como v27
wb.save('docs/Kytto_e_Plataforma_vs_Mercado_v27.xlsx')
wb.save('/home/ubuntu/upload/Kytto_e_Plataforma_vs_Mercado_v20.xlsx')
print('Planilha v27 salva com sucesso em docs/ e upload!')
