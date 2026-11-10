# -*- coding: utf-8 -*-
with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Atualizar Título
c = c.replace(
    "# Manual Oficial de Operação e Administração do Sistema ERP Kytto (v3.2 - Excelência 100%)",
    "# Manual Oficial de Operação e Administração do Sistema ERP Kytto (v3.3 - Nota Geral 100% Absoluta)"
)

# 2. Atualizar Sumário
antigo_sumario = "- [16. Fila da Vez (Rodízio) & Motor de Upsell Inteligente da Barbearia Dino](#16-fila-da-vez-rodízio--motor-de-upsell-inteligente-da-barbearia-dino)"
novo_sumario = """- [16. Fila da Vez (Rodízio) & Motor de Upsell Inteligente da Barbearia Dino](#16-fila-da-vez-rodízio--motor-de-upsell-inteligente-da-barbearia-dino)
- [17. Hub de Oficinas Mecânicas, Autopeças e Ordem de Serviço Veicular](#17-hub-de-oficinas-mecânicas-autopeças-e-ordem-de-serviço-veicular)"""

if antigo_sumario in c:
    c = c.replace(antigo_sumario, novo_sumario)

# 3. Adicionar Capítulo 17
capitulo_17 = """
---

## 17. Hub de Oficinas Mecânicas, Autopeças e Ordem de Serviço Veicular

O ERP Kytto oferece em `/admin/oficina` um ambiente corporativo completo para centros automotivos, oficinas mecânicas pesadas e leves, autopeças e assistências técnicas.

### 17.1. Cadastro e Histórico Veicular por Placa e Chassi
- **Consulta Imediata por Placa (ex.: RNI-4E29):** O sistema recupera a marca, modelo, ano de fabricação/modelo, cor, combustível e o histórico completo de manutenções e ordens de serviço anteriores;
- **Garantia Rastreada por Peça:** Cada peça instalada (ex.: amortecedores, pastilhas de freio, filtros) possui vigência parametrizada em meses e data limite de garantia. Se o cliente retornar com o mesmo problema no período, o sistema alerta automaticamente que a peça está sob garantia;
- **Quilometragem de Entrada:** Registro do odômetro do veículo para alerta preventivo de troca de óleo e correias.

![Hub de Oficinas Mecânicas e OS](/home/ubuntu/agro-open/docs/prints/48-oficina-mecanica-autopecas-os-veiculos.png)

### 17.2. Discriminação de Peças e Mão de Obra
A Ordem de Serviço separa de forma clara e fiscalmente adequada:
- **Peças Aplicadas:** Quantidade, valor unitário, custo médio e valor de venda, gerando baixa automática no estoque de autopeças e apuração de ICMS/NFC-e ou NF-e modelo 55;
- **Serviços Executados:** Mão de obra mecânica com apontamento para apuração de ISSQN Tangará da Serra MT e emissão de NFS-e DPS v1.00;
- **Checklist Fotográfico de 40 Pontos:** Registro de avarias pré-existentes, estado dos pneus, estepe e ferramentas com fotos salvas em nuvem segura.

### 17.3. Aprovação Interativa de Orçamentos pelo WhatsApp
Ao clicar no botão verde **📲 Disparar Aprovação WhatsApp**:
- O Kytto envia uma mensagem personalizada para o WhatsApp do proprietário do veículo com o link seguro da OS, detalhamento dos itens e botões de **APROVAR ORÇAMENTO** e **FALAR COM O MECÂNICO**;
- Quando o cliente clica em Aprovar, o status da OS no sistema muda automaticamente para `APROVADO_WHATSAPP` e a equipe mecânica inicia a execução sem atrasos burocráticos.
"""

c = c + capitulo_17

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print("Manual oficial v33 atualizado com sucesso!")
