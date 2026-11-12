import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(err.message))
        
        # Inject local storage for auth to bypass login
        await page.goto("https://setpoint.kytto.com.br/login", wait_until="networkidle")
        await page.evaluate("""() => {
            localStorage.setItem('sp_user', JSON.stringify({ role: 'admin', nome: 'Mock Admin' }));
            localStorage.setItem('sp_token', 'mock');
        }""")
        
        await page.goto("https://setpoint.kytto.com.br/admin/barbearia-erp?area=gestao&tab=Painel+de+gest%C3%A3o", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        print("ERRORS:", errors)
        await page.screenshot(path="/home/ubuntu/upload/dashboard-prod.png")
        await browser.close()

asyncio.run(main())
