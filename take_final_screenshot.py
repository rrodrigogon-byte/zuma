import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1200, 'height': 800})
        await page.goto("http://localhost:5173/admin/barbearia-erp?area=gestao&tab=Painel+de+gestão")
        # wait for render
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/upload/evidencia-painel-kytto.png", full_page=True)
        await browser.close()

asyncio.run(main())
