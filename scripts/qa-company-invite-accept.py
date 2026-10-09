#!/usr/bin/env python3
"""Homologação local isolada; não envia convites nem cria usuários reais."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os

base = os.environ.get('INVITE_QA_BASE', 'http://127.0.0.1:5175')
output = Path(os.environ.get('INVITE_QA_OUTPUT', '/tmp/company-invite-qa'))
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1200, 'height': 850}, service_workers='block')
    requests = []
    def intercept(route):
        if route.request.url.endswith('/api/auth/operational-invite/accept'):
            requests.append(route.request.post_data_json)
            route.fulfill(status=204, body='')
        else:
            route.fulfill(status=200, content_type='application/json', body='{}')
    context.route('**/api/**', intercept)
    page = context.new_page()
    page.goto(base + '/aceitar-convite#token=' + ('A' * 43) + '&lang=pt', wait_until='networkidle')
    page.get_by_label('Nova senha', exact=False).wait_for()
    assert page.evaluate('location.hash') == '#lang=pt'
    page.get_by_label('Nova senha', exact=False).fill('abcdefghijklmnop')
    page.get_by_label('Confirme a senha').fill('abcdefghijklmnop')
    page.get_by_role('button', name='Definir senha e aceitar').click()
    assert 'maiúscula' in page.get_by_role('alert').inner_text()
    assert len(requests) == 0
    page.get_by_label('Nova senha', exact=False).fill('Senha-Sintetica-123!')
    page.get_by_label('Confirme a senha').fill('Senha-Sintetica-123!')
    page.screenshot(path=str(output / 'HOMOLOGACAO-ACEITE-CONVITE-MASCARADO.png'), full_page=True, mask=[page.locator('input')])
    page.evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));")
    page.get_by_text('Senha definida.', exact=False).wait_for()
    assert len(requests) == 1
    assert requests[0]['token'] == 'A' * 43
    assert page.evaluate('localStorage.getItem("sp_token")') is None
    assert page.evaluate('location.hash') == '#lang=pt'
    context.close()
    browser.close()
print(json.dumps({'strict_mode_token_preserved': True, 'weak_password_zero_requests': True, 'single_accept_request': True, 'no_admin_autologin': True, 'sensitive_fields_masked': True}))
