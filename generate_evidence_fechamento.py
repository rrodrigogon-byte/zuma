import asyncio
import json
import requests
from playwright.async_api import async_playwright

def login():
    res = requests.post(
        "http://localhost:3000/api/admin/login",
        json={"user": "admin", "pass": "agroopen2026"}
    )
    return res.json()

async def main():
    login_data = login()
    token = login_data.get("token")
    user = login_data.get("user")
    
    empresa_dino = {
        "id": "d0d0ac01-8e50-4b61-8c79-de4aaa916da6",
        "nome": "Barbearia Dino",
        "slug": "dino",
        "tipo": "barbearia",
        "cnpj": "14.229.191/0001-90",
    }
    loja_dino = {
        "id": "ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8",
        "nome": "Dino Matriz",
        "empresaId": "d0d0ac01-8e50-4b61-8c79-de4aaa916da6",
    }
    
    empresas_todas = [
        empresa_dino,
        {"id": "31f70c83-9172-40c2-945f-9e793b5048be", "nome": "Stallone Nutre Sport", "slug": "stallone", "tipo": "varejo"},
        {"id": "2e041110-db20-4fd1-8278-12bd3dead008", "nome": "AGRO OPEN TTC", "slug": "agroopen", "tipo": "bar"},
        {"id": "emp-kytto-001", "nome": "Kytto Clube Tangará", "slug": "kytto", "tipo": "geral"}
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 960})
        page = await context.new_page()

        # Injeta auth no localStorage antes de carregar
        await page.goto("http://localhost:5173/login")
        await page.evaluate(f"""() => {{
            localStorage.setItem('sp_token', '{token}');
            localStorage.setItem('sp_user', JSON.stringify({json.dumps(user)}));
            localStorage.setItem('sp_empresa_ativa', JSON.stringify({json.dumps(empresa_dino)}));
            localStorage.setItem('sp_loja_ativa', JSON.stringify({json.dumps(loja_dino)}));
            localStorage.setItem('sp_empresas_acessiveis', JSON.stringify({json.dumps(empresas_todas)}));
            localStorage.setItem('sp_lojas_acessiveis', JSON.stringify([{json.dumps(loja_dino)}]));
            localStorage.setItem('sp_cookies_consent', 'accepted');
        }}""")

        print("Navegando para /admin/fechamento-diario...")
        await page.goto("http://localhost:5173/admin/fechamento-diario", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        # Clica em aceitar cookies se ainda estiver visível
        btn_cookie = page.locator('button:has-text("Aceitar todos")')
        if await btn_cookie.count() > 0:
            try:
                await btn_cookie.click()
                await page.wait_for_timeout(500)
            except:
                pass

        # Print 1: Tela Principal (Dino) com Seletor Multi-Empresa, Conciliação e Ações
        await page.screenshot(path="/home/ubuntu/print-fechamento-diario-gestao-multiempresa.png", full_page=True)
        print("Salvo: print-fechamento-diario-gestao-multiempresa.png")

        # Print 2: Aba Caixas Físicos da Data
        btn_caixas = page.locator('button:has-text("Caixas Físicos da Data")')
        if await btn_caixas.count() > 0:
            await btn_caixas.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-fechamento-aba-caixas.png", full_page=True)
            print("Salvo: print-fechamento-aba-caixas.png")

        # Print 3: Aba Comandas & Vendas Fechadas
        btn_comandas = page.locator('button:has-text("Comandas & Vendas Fechadas")')
        if await btn_comandas.count() > 0:
            await btn_comandas.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-fechamento-aba-comandas.png", full_page=True)
            print("Salvo: print-fechamento-aba-comandas.png")

        # Print 4: Aba Histórico de Fechamentos
        btn_historico = page.locator('button:has-text("Histórico de Fechamentos")')
        if await btn_historico.count() > 0:
            await btn_historico.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-fechamento-aba-historico.png", full_page=True)
            print("Salvo: print-fechamento-aba-historico.png")

        # Print 5: Modal Fechamento em Lote dos Caixas da Empresa
        btn_fechar_todos = page.locator('button:has-text("Fechar Todos os Caixas da Empresa")')
        if await btn_fechar_todos.count() > 0:
            await btn_fechar_todos.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-fechamento-modal-lote.png")
            print("Salvo: print-fechamento-modal-lote.png")
            # Fecha modal
            btn_close = page.locator('button:has-text("Cancelar")')
            if await btn_close.count() > 0:
                await btn_close.first.click()
                await page.wait_for_timeout(500)

        # Print 6: Seleciona outra empresa (Stallone Nutre Sport) para demonstrar multi-empresa
        select_empresa = page.locator('select').first
        if await select_empresa.count() > 0:
            await select_empresa.select_option(value="31f70c83-9172-40c2-945f-9e793b5048be")
            await page.wait_for_timeout(2000)
            await page.screenshot(path="/home/ubuntu/print-fechamento-empresa-stallone.png", full_page=True)
            print("Salvo: print-fechamento-empresa-stallone.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
