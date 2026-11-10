import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v25.xlsx')

# 1. Atualizar aba Resumo
if 'Resumo' in wb.sheetnames:
    ws = wb['Resumo']
    ws['B2'] = 'KYTTO ERP ENTERPRISE VS MERCADO - v26 (BOLETO HÍBRIDO PIX, ICMS-ST MT & MANIFESTAÇÃO MD-E)'
    ws['B3'] = f'Data da última atualização: {datetime.now().strftime("%d/%m/%Y %H:%M")} (Horário de Brasília)'
    ws.append([])
    ws.append(['BOLETO BANCÁRIO & PIX HÍBRIDO', 'Emissão oficial de boleto registrado FEBRABAN com linha digitável e QR Code Pix dinâmico integrado para Sicredi, Sicoob, Itaú, Banco do Brasil e Bradesco.'])
    ws.append(['ICMS-ST MATO GROSSO', 'Motor de Substituição Tributária com MVA Original e MVA Ajustada (Conv. 142/2018), FCP-MT (2%) e dedução de ICMS próprio.'])
    ws.append(['MANIFESTAÇÃO DO DESTINATÁRIO (MD-E)', 'Eventos 210210 (Ciência), 210200 (Confirmação), 210220 (Desconhecimento), 210240 (Operação não Realizada) e recálculo automático de Custo Médio Ponderado.'])

# 2. Atualizar aba Raio-x pendencias
for nome_aba in ['Raio-x pendencias', 'O que falta', 'Gaps do Kytto']:
    if nome_aba in wb.sheetnames:
        ws_gaps = wb[nome_aba]
        for r in range(1, ws_gaps.max_row + 1):
            val_c3 = str(ws_gaps.cell(r, 3).value or '')
            if 'Boleto registrado' in val_c3:
                ws_gaps.cell(r, 4).value = 'ENTREGUE & HOMOLOGADO'
                ws_gaps.cell(r, 5).value = 'Suporte oficial a Sicredi (748), Sicoob (756), Itaú, BB e Bradesco com Pix Copia e Cola dinâmico e código de barras FEBRABAN.'
            elif 'Cálculo de ICMS-ST' in val_c3:
                ws_gaps.cell(r, 4).value = 'ENTREGUE & HOMOLOGADO'
                ws_gaps.cell(r, 5).value = 'Motor fiscal MT com MVA Original/Ajustada, FCP-MT (2%), Simples Nacional (CSOSN 201/202/500) e Regime Normal (CST 10/60).'
            elif 'Manifestação do destinatário' in val_c3:
                ws_gaps.cell(r, 4).value = 'ENTREGUE & HOMOLOGADO'
                ws_gaps.cell(r, 5).value = 'Eventos 210210, 210200, 210220, 210240, captura de notas contra o CNPJ e entrada no estoque com Custo Médio Ponderado.'

# 3. Atualizar aba de Entregas 06-09 nov
if 'Entregas 06-09 nov' in wb.sheetnames:
    ws_entregas = wb['Entregas 06-09 nov']
    nova_linha = [
        datetime.now().strftime("%d/%m/%Y %H:%M"),
        'Fiscal & Financeiro Avançado',
        'Boleto Registrado Híbrido, ICMS-ST MT e Manifestação do Destinatário (MD-e)',
        'HOMOLOGADO EM PRODUÇÃO',
        'Emissão de boletos Sicredi/Sicoob com Pix híbrido, apuração de ICMS-ST MT com MVA ajustada e manifestação de notas de fornecedor com recálculo de custo médio ponderado.',
        '100% Concluído',
        'Rodrigo Gonçalves / Equipe Kytto'
    ]
    ws_entregas.append(nova_linha)

# 4. Salvar planilha v26
destino = '/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v26.xlsx'
wb.save(destino)
print(f'Planilha v26 salva com sucesso em: {destino}')
