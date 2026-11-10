with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf8') as f:
    text = f.read()

secoes_novas = """---

## 13. EMISSÃO DE BOLETOS BANCÁRIOS REGISTRADOS COM PIX HÍBRIDO (FEBRABAN)

O ERP Kytto agora integra nativamente a emissão de boletos bancários registrados conforme as especificações da FEBRABAN para os bancos **Sicredi (748), Sicoob (756), Itaú (341), Banco do Brasil (001) e Bradesco (237)**.

### Evidência em Produção: Painel de Boletos Registrados
![Boletos Bancários Registrados Híbridos com Pix](/home/ubuntu/agro-open/docs/prints/24-fiscal-boletos-hibridos-pix.png)

### Guia Formatada com QR Code Pix Dinâmico e Código de Barras
Cada boleto gerado conta com chave Copia e Cola Pix e código de barras padrão FEBRABAN de 44 dígitos com linha digitável validada por Módulo 10 e Módulo 11:

![Guia de Boleto FEBRABAN Sicredi](/home/ubuntu/agro-open/docs/prints/27-visualizador-boleto-sicredi-pix-hibrido.png)

### Principais Recursos do Módulo de Boletos:
* **Geração Instantânea:** Emissão a partir de comandas, mensalidades de planos ou avulsa via tela administrativa.
* **Pix Dinâmico Integrado:** Permite liquidação imediata no caixa via Pix antes mesmo da compensação bancária noturna.
* **Cálculo de Juros e Multa:** Parametrização automática de 2% de multa e 1% de juros ao mês após o vencimento.

---

## 14. SIMULADOR E APURAÇÃO DE ICMS-ST PARA MATO GROSSO (RICMS-MT)

O Kytto disponibiliza para a contabilidade e gestão de compras um motor fiscal avançado para apuração de ICMS por Substituição Tributária (ICMS-ST) em Mato Grosso.

### Evidência em Produção: Memorial de Apuração de ICMS-ST MT
![Simulador e Memorial de Apuração de ICMS-ST MT](/home/ubuntu/agro-open/docs/prints/25-fiscal-icms-st-mato-grosso.png)

### Regras Fiscais Atendidas:
1. **MVA Ajustada:** Cálculo automático da Margem de Valor Agregado ajustada para operações interestaduais com alíquotas de 7%, 12% ou 4% (bens importados).
2. **Fundo de Combate à Pobreza (FCP-MT):** Adicional de 2,00% calculado e destacado separadamente.
3. **Simples Nacional vs Regime Normal:** Suporte completo aos códigos CSOSN (201, 202, 500) e CST (10, 30, 60, 70).

---

## 15. MANIFESTAÇÃO DO DESTINATÁRIO (MD-E) E ENTRADA DE NOTAS COM CUSTO MÉDIO

Para garantir a blindagem fiscal contra notas frias e manter o inventário 100% atualizado, o módulo MD-e conecta diretamente aos Web Services da SEFAZ.

### Evidência em Produção: Gestão de Notas Destinadas e Eventos SEFAZ
![Manifestação do Destinatário MD-e](/home/ubuntu/agro-open/docs/prints/26-fiscal-mde-manifestacao-destinatario.png)

### Eventos Homologados:
* **210210 - Ciência da Emissão:** Dá ciência do documento e libera o download do XML completo.
* **210200 - Confirmação da Operação:** Confirma a realização da operação e habilita a entrada automática no estoque.
* **210220 - Desconhecimento da Operação:** Informa que a empresa desconhece a transação, protegendo contra passivo fiscal indevido.
* **210240 - Operação não Realizada:** Rejeita formalmente notas onde as mercadorias não foram entregues ou foram devolvidas (exige justificativa mínima de 15 caracteres).
* **Recálculo do Custo Médio Ponderado:** Ao dar entrada no estoque, o sistema recalcula automaticamente o custo médio contábil unitário dos produtos.

---

"""

alvo = "## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL"
if alvo in text:
    text = text.replace(alvo, secoes_novas + alvo)
    with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf8') as f:
        f.write(text)
    print('Manual atualizado com sucesso!')
else:
    print('Alvo não encontrado no manual')
