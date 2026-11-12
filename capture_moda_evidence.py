import asyncio
import json
import requests
from playwright.async_api import async_playwright

async def run():
    # 1. Obter login oficial
    login_res = requests.post(
        "http://localhost:3000/api/admin/login",
        json={"user": "admin", "pass": "agroopen2026"}
    )
    data = login_res.json()
    token = data["token"]
    user_str = json.dumps(data["user"])
    empresa_str = json.dumps({
        "id": "d0d0ac01-8e50-4b61-8c79-de4aaa916da6",
        "nome": "Dino Barbearia & Moda",
        "segmento": "moda"
    })

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1
        )

        page = await context.new_page()

        # Injetar autenticação correta com sp_token, sp_user, sp_empresa_ativa
        await page.goto("http://localhost:5173/login", wait_until="domcontentloaded")
        await page.evaluate(f"""() => {{
            localStorage.setItem('sp_token', '{token}');
            localStorage.setItem('sp_user', '{user_str}');
            localStorage.setItem('sp_empresa_ativa', '{empresa_str}');
            localStorage.setItem('sp_cookie_consent', 'all');
        }}""")

        # Navegar diretamente para /admin/loja-moda
        print("Acessando /admin/loja-moda...")
        await page.goto("http://localhost:5173/admin/loja-moda", wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # Se ainda estiver em /login, preencher formulário e submeter
        if "/login" in page.url:
            print("Preenchendo formulário de login...")
            await page.fill("input[type='text'], input[placeholder*='identificador'], input[placeholder*='admin']", "admin")
            await page.fill("input[type='password']", "agroopen2026")
            await page.click("button:has-text('Entrar na Plataforma')")
            await page.wait_for_timeout(3000)
            await page.goto("http://localhost:5173/admin/loja-moda", wait_until="networkidle")
            await page.wait_for_timeout(2500)

        print(f"URL atual: {page.url}")

        # 1. Visão Geral & KPIs
        print("Capturando Visão Geral & KPIs...")
        await page.screenshot(path="/home/ubuntu/print-moda-visao-geral.png", full_page=False)

        # 2. Catálogo & Lookbook
        print("Capturando Catálogo & Lookbook...")
        btn_cat = page.locator("button.moda-tab-btn:has-text('Catálogo & Lookbook')")
        if await btn_cat.count() > 0:
            await btn_cat.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-moda-catalogo.png", full_page=False)

        # 3. Matriz Grade (Cor x Tamanho)
        print("Capturando Matriz Grade...")
        btn_grade = page.locator("button.moda-tab-btn:has-text('Matriz Grade')")
        if await btn_grade.count() > 0:
            await btn_grade.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-moda-matriz-grade.png", full_page=False)

        # 4. Fashion AI Stylist
        print("Capturando Fashion AI Stylist...")
        btn_ai = page.locator("button.moda-tab-btn:has-text('Fashion AI Stylist')")
        if await btn_ai.count() > 0:
            await btn_ai.click()
            await page.wait_for_timeout(1000)
            btn_gerar = page.locator("button:has-text('Gerar Look Completo')")
            if await btn_gerar.count() > 0:
                await btn_gerar.click()
                await page.wait_for_timeout(1500)
            await page.screenshot(path="/home/ubuntu/print-moda-fashion-ai-stylist.png", full_page=False)

        # 5. Condicional (Malinha VIP)
        print("Capturando Condicional (Malinhas)...")
        btn_cond = page.locator("button.moda-tab-btn:has-text('Condicional')")
        if await btn_cond.count() > 0:
            await btn_cond.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-moda-malinhas-condicionais.png", full_page=False)

        # 6. Crediário & Carnês
        print("Capturando Crediário & Carnês...")
        btn_cred = page.locator("button.moda-tab-btn:has-text('Crediário')")
        if await btn_cred.count() > 0:
            await btn_cred.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-moda-crediario-carne.png", full_page=False)

        # 7. Diagnóstico IA de Giro
        print("Capturando Diagnóstico IA de Giro...")
        btn_diag = page.locator("button.moda-tab-btn:has-text('Diagnóstico IA de Giro')")
        if await btn_diag.count() > 0:
            await btn_diag.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/print-moda-diagnostico-ia.png", full_page=False)

        await browser.close()
        print("Todas as capturas da Loja de Moda concluídas com sucesso!")

asyncio.run(run())
