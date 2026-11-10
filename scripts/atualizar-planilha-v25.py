import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v24.xlsx')

# 1. Atualizar aba Resumo
if 'Resumo' in wb.sheetnames:
    ws = wb['Resumo']
    ws['B2'] = 'KYTTO ERP ENTERPRISE VS MERCADO - v25 (MANUAL OFICIAL PDF & SUÍTE TEF COMPLETA)'
    ws['B3'] = f'Data da última atualização: {datetime.now().strftime("%d/%m/%Y %H:%M")} (Horário de Brasília)'
    ws.append([])
    ws.append(['MANUAL OFICIAL EM PDF', 'Manual Operacional e Administrativo completo (19 páginas, 1.7 MB) com prints reais de produção, arquitetura de rede em malha fechada, parametrização de pinpads, matriz MDR, cancelamento/estorno e conciliação bancária OFX.'])

# 2. Atualizar aba de Entregas 06-09 nov
if 'Entregas 06-09 nov' in wb.sheetnames:
    ws_entregas = wb['Entregas 06-09 nov']
    nova_linha = [
        datetime.now().strftime("%d/%m/%Y %H:%M"),
        'Documentação & Engenharia',
        'Manual Operacional e Administrativo Kytto Enterprise em PDF Executivo',
        'HOMOLOGADO EM PRODUÇÃO',
        'Documentação diagramada em padrão ABNT contendo 12 capítulos, tabelas de adquirentes e bancos, prints em alta resolução da Barbearia Dino e códigos de resposta TEF.',
        '100% Concluído',
        'Rodrigo Gonçalves / Equipe Kytto'
    ]
    ws_entregas.append(nova_linha)

# 3. Salvar nova planilha v25
destino = '/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v25.xlsx'
wb.save(destino)
print(f'Planilha v25 salva com sucesso em: {destino}')
