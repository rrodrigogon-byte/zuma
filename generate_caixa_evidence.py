import asyncio
import requests
import json
from playwright.async_api import async_playwright

EMPRESA_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'
LOJA_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8'

def setup_backend_data():
    base_url = 'http://localhost:3000'
    login_res = requests.post(f'{base_url}/api/admin/login', json={'user': 'admin', 'pass': 'agroopen2026'}).json()
    token = login_res['token']
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'X-Empresa-Id': EMPRESA_ID,
        'X-Loja-Id': LOJA_ID
    }
    
    # 1. Obter serviços e profissionais existentes
    overview = requests.get(f'{base_url}/api/admin/barbearia/overview', headers=headers).json()
    servicos = overview.get('servicos', [])
    profissionais = overview.get('profissionais', [])
    
    # Se não tiver profissionais, criar
    prof_id = profissionais[0]['id'] if profissionais else None
    if not prof_id:
        p_res = requests.post(f'{base_url}/api/admin/barbearia/profissionais', headers=headers, json={'nome': 'Dino Master'}).json()
        prof_id = p_res.get('profissional', {}).get('id')
        
    s1 = servicos[0] if servicos else {'id': 'serv-1', 'nome': 'Corte Cabelo Dino', 'preco': 80}
    s2 = servicos[1] if len(servicos) > 1 else {'id': 'serv-2', 'nome': 'Barba Completa', 'preco': 65}
    
    # 2. Abrir Caixa 1 e Caixa 2 se necessário
    caixas_res = requests.get(f'{base_url}/api/admin/barbearia/operacao/caixas', headers=headers).json()
    caixas = caixas_res.get('caixas', [])
    abertos = [c for c in caixas if c.get('status') == 'aberto']
    
    cx1 = next((c for c in abertos if c.get('numeroCaixa') == 1), None)
    if not cx1:
        cx1 = requests.post(f'{base_url}/api/admin/barbearia/operacao/caixas', headers=headers, json={
            'numeroCaixa': 1,
            'nomeCaixa': 'Balcão 1 Principal',
            'valorAbertura': 150.0,
            'observacao': 'Turno manhã - Balcão 1',
            'lojaId': LOJA_ID,
            'confirmado': True
        }).json().get('caixa')
        
    cx2 = next((c for c in abertos if c.get('numeroCaixa') == 2), None)
    if not cx2:
        cx2 = requests.post(f'{base_url}/api/admin/barbearia/operacao/caixas', headers=headers, json={
            'numeroCaixa': 2,
            'nomeCaixa': 'Recepção 2 & Bar',
            'valorAbertura': 200.0,
            'observacao': 'Turno manhã - Recepção',
            'lojaId': LOJA_ID,
            'confirmado': True
        }).json().get('caixa')

    # 3. Criar comanda finalizada com serviços, produtos e pagamento
    cmd_res = requests.post(f'{base_url}/api/admin/barbearia/comandas', headers=headers, json={
        'clienteNome': 'Rodrigo Gonçalves',
        'clienteTelefone': '65999887766',
        'profissionalId': prof_id,
        'lojaId': LOJA_ID,
        'itens': [
            {'tipo': 'servico', 'servicoId': s1.get('id'), 'nome': s1.get('nome', 'Corte Cabelo Dino'), 'preco': 80.0, 'precoUnitario': 80.0, 'quantidade': 1, 'subtotal': 80.0},
            {'tipo': 'servico', 'servicoId': s2.get('id'), 'nome': s2.get('nome', 'Barba Terapêutica'), 'preco': 65.0, 'precoUnitario': 65.0, 'quantidade': 1, 'subtotal': 65.0},
            {'tipo': 'produto', 'nome': 'Pomada Modeladora Dino Matte', 'preco': 55.0, 'precoUnitario': 55.0, 'quantidade': 1, 'subtotal': 55.0}
        ]
    }).json()
    comanda = cmd_res.get('comanda')
    
    if comanda and comanda.get('status') == 'aberta':
        # Registrar pagamento no Caixa 1: R$ 80 Dinheiro + R$ 120 PIX
        requests.post(f'{base_url}/api/admin/barbearia/comandas/{comanda["id"]}/pagamento', headers=headers, json={
            'confirmado': True,
            'lojaId': LOJA_ID,
            'caixaId': cx1.get('id') if cx1 else None,
            'pagamentos': [
                {'meio': 'dinheiro', 'valor': 80.0, 'caixaId': cx1.get('id') if cx1 else None},
                {'meio': 'pix', 'valor': 120.0}
            ]
        })

    return token

async def main():
    token = setup_backend_data()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1366, 'height': 900})
        page = await context.new_page()
        
        # Iniciar no domínio local para carregar o localStorage
        await page.goto("http://localhost:5173/")
        await page.evaluate(f"""(token) => {{
            localStorage.setItem('sp_token', token);
            localStorage.setItem('sp_user', JSON.stringify({{ id: 1, nome: 'Administrador', email: 'admin', role: 'admin', ativo: true }}));
            localStorage.setItem('sp_empresa_ativa', JSON.stringify({{ id: '{EMPRESA_ID}', nome: 'Barbearia Dino', brandKey: 'dino' }}));
            localStorage.setItem('sp_loja_ativa', JSON.stringify({{ id: '{LOJA_ID}', nome: 'Barbearia Dino Matriz', empresaId: '{EMPRESA_ID}' }}));
            localStorage.setItem('sp_lojas_acessiveis', JSON.stringify([{{ id: '{LOJA_ID}', nome: 'Barbearia Dino Matriz', empresaId: '{EMPRESA_ID}' }}]));
        }}""", token)
        
        # Navegar para o ERP na aba Caixa e Fechamento
        await page.goto("http://localhost:5173/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        
        # 1. Print 1: Topo do Caixa com Múltiplos Caixas Abertos
        await page.screenshot(path="/home/ubuntu/print-1-multi-caixas-abertos.png")
        print("Salvo: print-1-multi-caixas-abertos.png")
        
        # 2. Print 2: Modal de Abertura de Novo Caixa (clicar no botão '+ Abrir novo caixa')
        btn_abrir = page.locator("button:has-text('+ Abrir novo caixa')")
        if await btn_abrir.count() > 0:
            await btn_abrir.first.click()
            await page.wait_for_timeout(600)
            await page.screenshot(path="/home/ubuntu/print-2-modal-abrir-novo-caixa.png")
            print("Salvo: print-2-modal-abrir-novo-caixa.png")
            
            btn_cancelar = page.locator("button:has-text('Cancelar')")
            if await btn_cancelar.count() > 0:
                await btn_cancelar.first.click()
                await page.wait_for_timeout(400)
        
        # 3. Print 3: Rolar até Comandas Fechadas no Caixa e expandir itens da comanda
        comandas_section = page.locator("h3:has-text('Comandas Fechadas no Caixa')")
        if await comandas_section.count() > 0:
            await comandas_section.first.scroll_into_view_if_needed()
            await page.wait_for_timeout(500)
            
            btn_ver = page.locator("button:has-text('Ver o que foi fechado')")
            if await btn_ver.count() > 0:
                await btn_ver.first.click()
                await page.wait_for_timeout(600)
                await page.screenshot(path="/home/ubuntu/print-3-comanda-fechada-detalhes.png")
                print("Salvo: print-3-comanda-fechada-detalhes.png")
                
                # 4. Print 4: Clicar no botão Cancelar Comanda Finalizada para abrir o modal formal
                btn_cancelar_comanda = page.locator("button:has-text('Cancelar comanda finalizada')")
                if await btn_cancelar_comanda.count() > 0:
                    await btn_cancelar_comanda.first.click()
                    await page.wait_for_timeout(600)
                    await page.screenshot(path="/home/ubuntu/print-4-procedimento-cancelamento-formal.png")
                    print("Salvo: print-4-procedimento-cancelamento-formal.png")
                    
        await browser.close()

asyncio.run(main())
