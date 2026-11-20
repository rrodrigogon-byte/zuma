#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess

def get_git_file(ref, filepath):
    cmd = ["git", "show", f"{ref}:{filepath}"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout

def main():
    head_js = get_git_file("HEAD", "app/modules/restaurante-zuma.js")
    origin_js = get_git_file("origin/fix/kytto-comandas-pdv-20260808", "app/modules/restaurante-zuma.js")

    # Extrair os blocos exclusivos do origin que não estão no HEAD:
    # 1. ESTOQUE_PESCADOS_ZUMA, TEMPERATURAS_CAMARAS_IOT, HISTORICO_KARDEX_ZUMA, MESAS_SALAO_ZUMA, HISTORICO_NOTAS_FISCAIS_ZUMA e suas rotas
    # No origin_js, localizar o marcador:
    origin_marker = "// 7. MOTOR DE ESTOQUE DE PESCADOS, FICHAS TÉCNICAS E SIMULAÇÃO DE PEDIDO ZUMI"
    if origin_marker not in origin_js:
        print("origin_marker não encontrado!")
        return

    origin_extras = origin_js[origin_js.find(origin_marker):]

    # Juntar: head_js + "\n\n" + origin_extras
    # Mas para evitar rota duplicada /fiscal/cancelar se houver:
    # no head temos /fiscal/cancelar-nfce e no origin temos /fiscal/cancelar - não há conflito de rota!
    # No head temos /caixa/abrir-turno e no origin /caixa/abrir - sem conflito!

    merged_js = head_js.rstrip() + "\n\n" + origin_extras.strip() + "\n"

    with open("app/modules/restaurante-zuma.js", "w", encoding="utf-8") as f:
        f.write(merged_js)

    print("app/modules/restaurante-zuma.js criado com sucesso combinando HEAD e ORIGIN!")

if __name__ == "__main__":
    main()
