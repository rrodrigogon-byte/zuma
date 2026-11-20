#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reconciliador de merge:
Une origin/fix/kytto-comandas-pdv-20260808 com as novas rotas de ERP do HEAD.
"""

import subprocess
import re

def get_git_file(ref, filepath):
    cmd = ["git", "show", f"{ref}:{filepath}"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout

def main():
    origin_js = get_git_file("origin/fix/kytto-comandas-pdv-20260808", "app/modules/restaurante-zuma.js")
    head_js = get_git_file("HEAD", "app/modules/restaurante-zuma.js")

    # Extrair os novos blocos do HEAD:
    # A partir de "// 7. ROTAS FISCAIS & EMISSÃO NFC-e SEFAZ-MT" até o final
    marker = "// 7. ROTAS FISCAIS & EMISSÃO NFC-e SEFAZ-MT"
    if marker not in head_js:
        print("Marker não encontrado no HEAD!")
        return

    novas_rotas = head_js[head_js.find(marker):]

    # No origin_js, certificar que ESTADO_ERP_ZUMA_DEFAULT possui empresaId
    if 'empresaId: "c3c3ac01-8e50-4b61-8c79-de4aaa916da3"' not in origin_js:
        origin_js = origin_js.replace(
            "const ESTADO_ERP_ZUMA_DEFAULT = {",
            'const ESTADO_ERP_ZUMA_DEFAULT = {\n  empresaId: "c3c3ac01-8e50-4b61-8c79-de4aaa916da3",\n  lojaId: "c3c3ac01-8e50-4b61-8c79-de4aaa916da0",\n  razaoSocial: "Zuma Cozinha Oriental LTDA",\n  cnpj: "36.296.848/0001-57",'
        )

    # Combinar: origin_js + "\n\n" + novas_rotas
    merged_js = origin_js.rstrip() + "\n\n" + novas_rotas.strip() + "\n"

    with open("app/modules/restaurante-zuma.js", "w", encoding="utf-8") as f:
        f.write(merged_js)
    print("app/modules/restaurante-zuma.js reconciliado com sucesso!")

    # 2. Reconciliar app/zuma-cozinha-oriental.test.js
    origin_test = get_git_file("origin/fix/kytto-comandas-pdv-20260808", "app/zuma-cozinha-oriental.test.js")
    head_test = get_git_file("HEAD", "app/zuma-cozinha-oriental.test.js")

    test_marker = 'test("Zuma Cozinha Oriental - Módulos Especializados v2'
    if test_marker not in head_test:
        print("Test marker não encontrado no HEAD!")
        return

    nosso_teste = head_test[head_test.find(test_marker):]

    merged_test = origin_test.rstrip() + "\n\n" + nosso_teste.strip() + "\n"
    with open("app/zuma-cozinha-oriental.test.js", "w", encoding="utf-8") as f:
        f.write(merged_test)
    print("app/zuma-cozinha-oriental.test.js reconciliado com sucesso!")

    # 3. Reconciliar app/public/index.html
    cmd = ["cp", "web/dist/index.html", "app/public/index.html"]
    subprocess.run(cmd, check=True)
    print("app/public/index.html atualizado do web/dist!")

if __name__ == "__main__":
    main()
