with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir versao
content = content.replace(
    '**Versão do Documento:** 2.5 (Edição Homologada de Produção)',
    '**Versão do Documento:** 2.7 (Edição Homologada de Produção - SPED Fiscal & Delivery Hub)'
)

# Seções 16 a 18 completas com links de prints
secoes_novas = """---

## 16. SPED FISCAL EFD ICMS/IPI, BLOCOS CONTÁBEIS E VALIDADOR PRÉ-PVA

O Kytto ERP Enterprise conta com motor nativo para geração da Escrituração Fiscal Digital (**EFD ICMS/IPI - Leiaute 020**) e **EFD Contribuições**, em total conformidade com o Guia Prático da EFD e normativas da Receita Federal do Brasil e da SEFAZ-MT.

### Estrutura de Blocos Gerados Nativamente:
* **Bloco 0 (Abertura, Identificação e Referências):** Registro 0000 (dados do declarante Dino Barbearia LTDA, período de apuração, perfil de enquadramento), 0001 (abertura), 0005 (dados complementares da entidade), 0100 (dados do contador habilitado com CRC-MT) e 0990 (encerramento do bloco).
* **Bloco C (Documentos Fiscais I - Mercadorias / ICMS e IPI):** Registro C001 (abertura), C100 (saídas de NFC-e 65, NF-e 55 e notas fiscais de entrada emitidas por terceiros via MD-e), C170 (itens de mercadorias com NCM, CST, CFOP e alíquotas) e C990 (encerramento do bloco).
* **Bloco E (Apuração do ICMS e do IPI):** Registro E001 (abertura), E100 (período de apuração), E110 (apuração mensal com total de débitos fiscais de saídas, total de créditos por entradas e saldo devedor/credor) e E990 (encerramento do bloco).
* **Bloco 1 (Outras Informações):** Registro 1001 (abertura) e 1010 (obrigatoriedade de registros complementares).
* **Bloco 9 (Controle e Encerramento):** Registro 9001 (abertura), registros 9900 (totalizadores linha a linha de cada registro gerado no arquivo) e 9999 (totalizador geral de linhas do arquivo SPED).

### Validador Pré-PVA da Receita Federal Integrado
Antes de disponibilizar o arquivo para download ou envio ao contador, o motor executa uma auditoria sintática prévia que impede a transmissão de arquivos rejeitáveis:
1. Validação de formato e dígitos verificadores do CNPJ e Inscrição Estadual (SEFAZ-MT).
2. Validação da Chave de Acesso de 44 dígitos numéricos nos registros de notas fiscais.
3. Consistência entre somatório de itens (C170), totais da nota (C100) e apuração do imposto (E110).
4. Verificação de versão do leiaute oficial (020) e estrutura de fechamento com totalizadores do Bloco 9.

---

## 17. CENTRAL DE DELIVERY MULTICANAL, DESPACHO DE MOTOBOYS E RÉGUA WHATSAPP

A **Central de Delivery & Gestão de Entregas** do Kytto (`/admin/delivery`) foi desenhada para operações de alta rotatividade, atendendo estabelecimentos gastronômicos, empórios, conveniências e barbearias com venda remota de cosméticos e bebidas.

### Evidência em Produção: Central de Pedidos e Despacho de Entregas
![Central de Delivery e Despacho](/home/ubuntu/agro-open/docs/prints/28-delivery-pedidos-multicanal-despacho.png)

### Fluxo Operacional de Pedidos:
1. **Captação Multicanal:** Pedidos chegam automaticamente à esteira a partir de mensagens recebidas no WhatsApp oficial da empresa, pedidos realizados no Cardápio Digital QR ou lançamentos diretos no balcão de vendas.
2. **Seleção e Despacho do Motoboy:** O operador seleciona o motoboy parceiro disponível no menu suspenso (ex: *Carlos Motoboy (Flash) - Honda CG 160 Fan*) e clica em **"🛵 Despachar p/ Motoboy (WhatsApp ao Cliente)"**.
3. **Disparo da Régua Automática no WhatsApp via KyttoEventBus:**
   * **Status "Em Preparo":** Envio de confirmação imediata do pedido ao cliente.
   * **Status "Saiu para Entrega":** Mensagem automática informando o nome do motoboy parceiro e a placa do veículo para maior segurança do destinatário.
   * **Status "Entregue":** Notificação de encerramento com mensagem de agradecimento e link para avaliação de satisfação (NPS).

### Evidência em Produção: Gestão de Motoboys e Controle de Repasses
![Gestão de Motoboys e Repasses](/home/ubuntu/agro-open/docs/prints/29-delivery-motoboys-repasses.png)

### Governança da Equipe de Entregadores:
* Cadastro simplificado com Nome, Telefone celular com DDD, Modelo da moto e Placa oficial do veículo.
* Controle de status em tempo real: `DISPONIVEL`, `EM_ROTA` ou `INATIVO`.
* Apuração automática do montante de repasses por corrida concluída (ex: R$ 8,00 por entrega), eliminando acertos manuais no final do expediente.

---

## 18. AUDITORIA DE CMV TEÓRICO VS REAL E APONTAMENTO DE DESPERDÍCIO

O Kytto entrega inteligência de margem de contribuição com o painel de confronto de **Custo de Mercadorias Vendidas (CMV)**:

### Evidência em Produção: Painel de CMV Teórico vs Real
![CMV Teórico vs Real e Rentabilidade](/home/ubuntu/agro-open/docs/prints/30-delivery-cmv-teorico-vs-real.png)

### Métricas Auditadas:
1. **Faturamento Total:** Receita bruta auferida com a venda de produtos e kits no período selecionado.
2. **CMV Teórico:** Custo padrão parametrizado na ficha técnica oficial de cada item (percentual meta).
3. **CMV Real:** Custo real apurado das mercadorias consumidas, ponderado pelo inventário e notas fiscais de compra (MD-e).
4. **Variação / Desperdício:** Diferença financeira entre o custo consumido e a ficha técnica padrão, com diagnóstico automático em tela (*"Alerta: Desperdício Detectado"* ou *"Excelente: Rentabilidade dentro da meta"*).

---

## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL"""

# Se já tinha inserido a versao truncada de 16, substitui
if '## 16. SPED FISCAL' in content:
    idx = content.find('## 16. SPED FISCAL')
    idx_fim = content.find('## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL')
    if idx != -1 and idx_fim != -1:
        # Encontra o último --- antes de 16
        idx_sep = content.rfind('---', 0, idx)
        content = content[:idx_sep] + secoes_novas + content[idx_fim + len('## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL'):]
else:
    content = content.replace('## CONCLUSÃO E HOMOLOGAÇÃO OFICIAL', secoes_novas)

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("MANUAL ATUALIZADO COM SUCESSO!")
