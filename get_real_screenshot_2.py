import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        await page.goto("http://localhost:5173/")
        await page.evaluate("""() => {
            localStorage.setItem('sp_user', JSON.stringify({ role: 'admin', nome: 'Mock Admin' }));
            localStorage.setItem('sp_token', 'mock');
        }""")
        
        await page.goto("http://localhost:5173/admin/barbearia-erp?area=gestao&tab=Painel+de+gest%C3%A3o", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        print("ERRORS:", errors)
        print("URL:", page.url)
        await page.screenshot(path="/home/ubuntu/upload/dashboard-real2.png")
        await browser.close()

asyncio.run(main())
