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

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # 1. TOTEM QUIOSQUE TOUCH (1080x1200)
        ctx_totem = await browser.new_context(viewport={'width': 1080, 'height': 1200})
        page_totem = await ctx_totem.new_page()

        await page_totem.goto("http://localhost:5173/login")
        await page_totem.evaluate("""() => {
            localStorage.setItem('sp_cookie_consent', 'all');
        }""")

        print("1. Acessando /totem (Screensaver Inicial)...")
        await page_totem.goto("http://localhost:5173/totem", wait_until="domcontentloaded")
        await page_totem.wait_for_timeout(2000)

        # 1.1 Captura Screensaver de Descanso do Totem
        print("Capturando print-totem-screensaver.png...")
        await page_totem.screenshot(path="/home/ubuntu/print-totem-screensaver.png")

        # 1.2 Toca na tela para acordar o totem
        print("Tocando para acordar o totem...")
        await page_totem.click('.totem-screensaver')
        await page_totem.wait_for_timeout(1000)

        # 1.3 Captura Menu Inicial de Jornadas
        print("Capturando print-totem-inicio-jornadas.png...")
        await page_totem.screenshot(path="/home/ubuntu/print-totem-inicio-jornadas.png")

        # 1.4 Entra em Comprar Produtos
        print("Entrando no catálogo de produtos...")
        await page_totem.click('h3:has-text("Comprar Produtos")')
        await page_totem.wait_for_timeout(1500)

        cards = page_totem.locator('.totem-product-card')
        count = await cards.count()
        print(f"Cards de produtos visíveis: {count}")
        if count > 0:
            await cards.nth(0).click()
            await page_totem.wait_for_timeout(400)
            if count > 1:
                await cards.nth(1).click()
                await page_totem.wait_for_timeout(400)

        print("Capturando print-totem-catalogo-produtos.png...")
        await page_totem.screenshot(path="/home/ubuntu/print-totem-catalogo-produtos.png")

        # 1.5 Avançar para Identificação
        btn_pagar = page_totem.locator('button:has-text("AVANÇAR PARA PAGAR")')
        if await btn_pagar.count() > 0:
            await btn_pagar.click()
            await page_totem.wait_for_timeout(1000)

            # Digita telefone no teclado virtual touch
            teclas = ['6', '5', '9', '9', '3', '3', '6', '0', '0', '0', '0']
            for t in teclas:
                await page_totem.click(f'.totem-key:has-text("{t}")')
                await page_totem.wait_for_timeout(50)

            print("Capturando print-totem-identificacao-touch.png...")
            await page_totem.screenshot(path="/home/ubuntu/print-totem-identificacao-touch.png")

            # Confirma identificação e vai para Pagamento PIX
            await page_totem.click('button:has-text("CONFIRMAR")')
            await page_totem.wait_for_timeout(1500)

            print("Capturando print-totem-pagamento-pix.png...")
            await page_totem.screenshot(path="/home/ubuntu/print-totem-pagamento-pix.png")

            # Aguarda recibo de sucesso simulado
            await page_totem.wait_for_timeout(4500)
            print("Capturando print-totem-sucesso-recibo.png...")
            await page_totem.screenshot(path="/home/ubuntu/print-totem-sucesso-recibo.png")

        await ctx_totem.close()

        # 2. PAINEL TV DE ATENDIMENTO (1920x1080 Full HD Landscape)
        ctx_tv = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page_tv = await ctx_tv.new_page()

        await page_tv.goto("http://localhost:5173/login")
        await page_tv.evaluate("""() => {
            localStorage.setItem('sp_cookie_consent', 'all');
        }""")

        print("Acessando /painel-tv...")
        await page_tv.goto("http://localhost:5173/painel-tv", wait_until="domcontentloaded")
        await page_tv.wait_for_timeout(2000)

        print("Capturando print-painel-tv-recepcao.png...")
        await page_tv.screenshot(path="/home/ubuntu/print-painel-tv-recepcao.png")
        await ctx_tv.close()

        # 3. ADMIN DE LOJAS E TOTENS (1440x1100)
        ctx_admin = await browser.new_context(viewport={'width': 1440, 'height': 1100})
        page_admin = await ctx_admin.new_page()

        await page_admin.goto("http://localhost:5173/login")
        await page_admin.evaluate(f"""() => {{
            localStorage.setItem('sp_token', '{token}');
            localStorage.setItem('sp_user', JSON.stringify({json.dumps(user)}));
            localStorage.setItem('sp_empresa_ativa', JSON.stringify({json.dumps(empresa_dino)}));
            localStorage.setItem('sp_loja_ativa', JSON.stringify({json.dumps(loja_dino)}));
            localStorage.setItem('sp_cookie_consent', 'all');
        }}""")

        print("Navegando para /admin/ecommerce...")
        await page_admin.goto("http://localhost:5173/admin/ecommerce", wait_until="domcontentloaded")
        await page_admin.wait_for_timeout(2000)

        btn_lojas = page_admin.locator('button:has-text("Lojas & canais")')
        if await btn_lojas.count() > 0:
            await btn_lojas.click()
            await page_admin.wait_for_timeout(1500)

        btn_totens = page_admin.locator('button:has-text("Totens & Autoatendimento")')
        if await btn_totens.count() > 0:
            await btn_totens.click()
            await page_admin.wait_for_timeout(1500)

        # Rola um pouco para enquadrar perfeitamente a seção de totens e chamada de senhas
        await page_admin.evaluate("window.scrollBy(0, 320)")
        await page_admin.wait_for_timeout(800)

        print("Capturando print-admin-lojas-totens.png...")
        await page_admin.screenshot(path="/home/ubuntu/print-admin-lojas-totens.png")

        await browser.close()
        print("Todas as capturas sem cookie banner foram concluídas com perfeição!")

if __name__ == "__main__":
    asyncio.run(main())
