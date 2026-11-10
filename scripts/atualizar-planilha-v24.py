import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v23.xlsx')

# 1. Atualizar aba Resumo
if 'Resumo' in wb.sheetnames:
    ws = wb['Resumo']
    ws['B2'] = 'KYTTO ERP ENTERPRISE VS MERCADO - v24 (HOMOLOGAÇÃO TEF & PINPADS BALCÃO)'
    ws['B3'] = f'Data da última atualização: {datetime.now().strftime("%d/%m/%Y %H:%M")} (Horário de Brasília)'
    
    # Adicionar linha de destaque do TEF
    ws.append([])
    ws.append(['MODALIDADE TEF HOMOLOGADA', 'Área de parametrização multi-adquirente oficial (Stone, PagBank, Sicredi Vero, Cielo, Rede, Getnet) com 3 pinpads provisionados para Barbearia Dino e teste de conectividade Ping em tempo real.'])

# 2. Atualizar aba de Entregas 06-09 nov
if 'Entregas 06-09 nov' in wb.sheetnames:
    ws_entregas = wb['Entregas 06-09 nov']
    nova_linha = [
        datetime.now().strftime("%d/%m/%Y %H:%M"),
        'Financeiro & TEF',
        'Área Administrativa de Parametrização TEF & Pinpads da Barbearia Dino',
        'HOMOLOGADO EM PRODUÇÃO',
        'Provisionamento de 3 terminais (Caixa Central, Bar/Recepção, Gerência Sicredi), teste de Ping em tempo real, matriz de taxas MDR negociadas e modal de novo pinpad.',
        '100% Concluído',
        'Rodrigo Gonçalves / Equipe Kytto'
    ]
    ws_entregas.append(nova_linha)

# 3. Salvar nova planilha v24
destino = '/home/ubuntu/agro-open/docs/Kytto_e_Plataforma_vs_Mercado_v24.xlsx'
wb.save(destino)
print(f'Planilha v24 salva com sucesso em: {destino}')
