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
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 1100})
        page = await context.new_page()

        # Injeta auth no localStorage
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

        print("Navegando para /admin/ecommerce...")
        await page.goto("http://localhost:5173/admin/ecommerce", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        # Clica na aba Lojas & canais
        print("Clicando na aba 'Lojas & canais'...")
        btn_lojas = page.locator('button:has-text("Lojas & canais")')
        if await btn_lojas.count() > 0:
            await btn_lojas.click()
            await page.wait_for_timeout(2000)

        # 1. Print da Sub-Aba Identidade Visual & Cores (com simulador em tempo real)
        print("Capturando print-ecommerce-lojas-aparencia.png...")
        await page.screenshot(path="/home/ubuntu/print-ecommerce-lojas-aparencia.png", full_page=False)

        # 2. Clica na Sub-Aba Banners & Barra de Avisos
        print("Clicando em Banners...")
        btn_vitrine = page.locator('button:has-text("Banners")')
        if await btn_vitrine.count() > 0:
            await btn_vitrine.first.click()
            await page.wait_for_timeout(1000)
            print("Capturando print-ecommerce-lojas-banners.png...")
            await page.screenshot(path="/home/ubuntu/print-ecommerce-lojas-banners.png", full_page=False)

        # 3. Clica na Sub-Aba Rede de Lojas & Retirada
        print("Clicando em Rede de Lojas...")
        btn_unidades = page.locator('button:has-text("Rede de Lojas")')
        if await btn_unidades.count() > 0:
            await btn_unidades.first.click()
            await page.wait_for_timeout(1000)
            print("Capturando print-ecommerce-lojas-unidades.png...")
            await page.screenshot(path="/home/ubuntu/print-ecommerce-lojas-unidades.png", full_page=False)

        # 4. Clica na Sub-Aba WhatsApp & Atendimento
        print("Clicando em WhatsApp...")
        btn_atendimento = page.locator('button:has-text("WhatsApp")')
        if await btn_atendimento.count() > 0:
            await btn_atendimento.first.click()
            await page.wait_for_timeout(1000)
            print("Capturando print-ecommerce-lojas-atendimento.png...")
            await page.screenshot(path="/home/ubuntu/print-ecommerce-lojas-atendimento.png", full_page=False)

        # 5. Clica na Sub-Aba Canais & Domínios
        print("Clicando em Canais...")
        btn_canais = page.locator('button:has-text("Canais")')
        if await btn_canais.count() > 0:
            await btn_canais.first.click()
            await page.wait_for_timeout(1000)
            print("Capturando print-ecommerce-lojas-canais.png...")
            await page.screenshot(path="/home/ubuntu/print-ecommerce-lojas-canais.png", full_page=False)

        # 6. Captura da Loja Online Pública
        print("Navegando para /ecommerce/dino-web...")
        await page.goto("http://localhost:5173/ecommerce/dino-web", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        print("Capturando print-ecommerce-loja-publica.png...")
        await page.screenshot(path="/home/ubuntu/print-ecommerce-loja-publica.png", full_page=False)

        await browser.close()
        print("Todas as capturas concluídas com sucesso!")

if __name__ == "__main__":
    asyncio.run(main())
