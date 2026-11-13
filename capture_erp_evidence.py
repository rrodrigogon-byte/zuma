import asyncio
import json
import requests
from playwright.async_api import async_playwright

async def run():
    print("Iniciando captura de evidências do Kytto ERP 360...")
    
    # 1. Login local
    login_res = requests.post("http://localhost:3000/api/admin/login", json={
        "user": "admin",
        "pass": "agroopen2026"
    })
    data = login_res.json()
    token = data.get("token")
    user = data.get("usuario") or data.get("user") or {}
    
    # Contexto da empresa Dino Barbearia & Holding Kytto
    empresa = {
        "id": "d0d0ac01-8e50-4b61-8c79-de4aaa916da6",
        "nome": "Barbearia Dino",
        "razao_social": "Barbearia Dino & Kytto Gestao Integrada Ltda"
    }
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1
        )
        page = await context.new_page()

        # Configura localStorage antes da navegação
        await page.goto("http://localhost:3000/login", wait_until="domcontentloaded")
        await page.evaluate("""({ token, user, empresa }) => {
            localStorage.setItem('sp_token', token);
            localStorage.setItem('sp_site_token', token);
            localStorage.setItem('sp_user', JSON.stringify(user));
            localStorage.setItem('sp_empresa_ativa', JSON.stringify(empresa));
            localStorage.setItem('sp_cookie_consent', 'all');
            document.cookie = 'sp_cookie_consent=all; path=/; max-age=31536000';
        }""", {"token": token, "user": user, "empresa": empresa})

        # 1. Hub Central ERP 360 (/admin/erp)
        print("1. Capturando Hub Central ERP 360...")
        await page.goto("http://localhost:3000/admin/erp", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/print-erp-hub-central.png", full_page=False)

        # 2. Propostas Comerciais (/admin/propostas)
        print("2. Capturando Propostas Comerciais...")
        await page.goto("http://localhost:3000/admin/propostas", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/print-erp-propostas-comerciais.png", full_page=False)

        # 3. Ordens de Serviço (/admin/ordens-servico)
        print("3. Capturando Ordens de Serviço...")
        await page.goto("http://localhost:3000/admin/ordens-servico", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/print-erp-ordens-servico.png", full_page=False)

        # 4. Expedição & Romaneios (/admin/expedicao)
        print("4. Capturando Expedição & Romaneios...")
        await page.goto("http://localhost:3000/admin/expedicao", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/print-erp-expedicao-logistica.png", full_page=False)

        # 5. Patrimônio & Ativos (/admin/patrimonio)
        print("5. Capturando Patrimônio & Ativos...")
        await page.goto("http://localhost:3000/admin/patrimonio", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/print-erp-patrimonio-ativos.png", full_page=False)

        await browser.close()
        print("Todas as capturas foram concluídas com sucesso!")

asyncio.run(run())
