import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Resolução idêntica à do print do usuário (2048 x 1167)
        ctx = await browser.new_context(viewport={'width': 2048, 'height': 1167})
        page = await ctx.new_page()

        await page.goto("http://localhost:5173/login")
        await page.evaluate("""() => {
            localStorage.setItem('sp_cookie_consent', 'all');
        }""")

        print("1. Acessando /totem...")
        await page.goto("http://localhost:5173/totem", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)

        # Acorda do screensaver
        print("Acordando do screensaver...")
        await page.click('.totem-screensaver')
        await page.wait_for_timeout(800)

        # Entra em Comprar Produtos
        print("Entrando no catálogo de produtos...")
        await page.click('h3:has-text("Comprar Produtos")')
        await page.wait_for_timeout(1500)

        # Adiciona 2 produtos ao carrinho para popular o painel direito
        cards = page.locator('.totem-product-card')
        count = await cards.count()
        print(f"Cards encontrados: {count}")
        if count > 0:
            await cards.nth(0).click()
            await page.wait_for_timeout(300)
            if count > 1:
                await cards.nth(1).click()
                await page.wait_for_timeout(300)
            if count > 4:
                await cards.nth(4).click()
                await page.wait_for_timeout(300)

        # Captura 1: Visão Geral com busca, categorias e carrinho estruturado
        print("Capturando print-totem-produtos-ux-melhorado.png...")
        await page.screenshot(path="/home/ubuntu/print-totem-produtos-ux-melhorado.png")

        # Captura 2: Pesquisa ativa com busca instantânea
        print("Testando busca instantânea 'cerveja'...")
        input_busca = page.locator('.totem-search-input')
        await input_busca.fill('cerveja')
        await page.wait_for_timeout(600)
        print("Capturando print-totem-pesquisa-filtro.png...")
        await page.screenshot(path="/home/ubuntu/print-totem-pesquisa-filtro.png")

        # Captura 3: Teclado Virtual Touch aberto na tela
        print("Abrindo teclado virtual touch...")
        await input_busca.fill('')
        btn_teclado = page.locator('button:has-text("Teclado Touch")')
        if await btn_teclado.count() > 0:
            await btn_teclado.click()
            await page.wait_for_timeout(600)
            print("Capturando print-totem-teclado-touch.png...")
            await page.screenshot(path="/home/ubuntu/print-totem-teclado-touch.png")

        await browser.close()
        print("Todas as capturas de UX foram concluídas com perfeição!")

if __name__ == "__main__":
    asyncio.run(main())
