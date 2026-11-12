# Módulo Oficial de Sorteios & Campanhas Premiadas Kytto
## Barbearia Dino, Perfumaria & Loja Online (E-commerce)

**Data de Implantação e Atualização:** 12 de Novembro de 2026  
**Ambiente:** Produção (PRD) — `https://kytto.com.br` e `https://setpoint.kytto.com.br`  
**Responsável Técnico:** Rodrigo Gonçalves / Equipe de Engenharia Kytto  
**Status do Deploy no Render:** `LIVE` (Serviço `setpoint` - `srv-d8iudokm0tmc73c07iog`, commit `d9af74155`)

---

## 1. Visão Geral da Solução Completa

Atendendo com excelência à solicitação de Dino para alavancar as vendas e o engajamento dos seus negócios (**Barbearia Dino**, **Loja de Produtos & Perfumaria** e **E-commerce**), o **Módulo Oficial de Sorteios & Campanhas Premiadas Kytto** foi integralmente entregue e aprimorado em ambiente de produção.

A plataforma unifica o atendimento presencial de barbearia, as compras físicas de perfumaria e o e-commerce em um ecossistema com apuração ao vivo por roleta digital auditada criptograficamente via SHA-256 (RFC 7518) e portal de transparência para os clientes.

---

## 2. Funcionalidades Completas Entregues em Produção

### 2.1. Regras de Pontuação Inteligentes e Atrativas
- **Serviços da Barbearia (Cabelo, Barba, Combos):** A cada R$ 50,00 gastos na comanda, o cliente recebe automaticamente **1 Número da Sorte**.
- **Perfumaria e Cosméticos (Loja & Balcão):** Compras de produtos pontuam **EM DOBRO (2x)**: a cada R$ 50,00, o cliente recebe **2 Números da Sorte**, alavancando a saída de perfumes e produtos de cuidado masculino.
- **Assinantes do Clube Dino:** Clientes com planos mensais ativos recebem **+3 bilhetes bônus de largada** em cada edição para valorizar a fidelidade.
- **Emissão Manual de Cortesia (Balcão):** Permite ao Dino ou gerente emitir bilhetes avulsos de cortesia no balcão com botão para **enviar imediatamente para o WhatsApp do cliente**.

### 2.2. Automação no Pós-Faturamento de Comandas
- No encerramento da comanda no PDV presencial (`posFaturamentoComanda`), o sistema calcula os bilhetes com base no mix de serviços e produtos e anexa a mensagem comemorativa no extrato.

### 2.3. Sorteador Oficial com Roleta Digital e Efeitos Sonoros
- **Roleta Digital Interativa com Áudio Sintético Web Audio:** O sorteador emite cliques mecânicos realistas desacelerando durante o suspense da roleta e fanfarra de vitória ao revelar o bilhete contemplado.
- **Auditoria Criptográfica SHA-256 (RFC 7518):** Geração de semente temporal e hash criptográfico imutável, provando a lisura do sorteio.
- **Disparo Direto para o WhatsApp do Ganhador:** Mensagem oficial formatada com código de validação e prêmio para envio em 1 clique.

### 2.4. Gestão e Exportação para Auditoria
- **Exportação de Bilhetes em CSV:** Botão exclusivo no painel administrativo para exportar todos os bilhetes emitidos com colunas auditáveis (Número, Cliente, WhatsApp, Origem, Valor da Compra, Data, Premiado e Hash SHA-256).

### 2.5. Portal Público do Cliente (`/sorteios/dino`)
- **Contagem Regressiva ao Vivo:** Exibe dias, horas e minutos restantes para o próximo sorteio.
- **Consulta com Máscara de WhatsApp:** Digitação assistida `(65) 99999-9999` para o cliente ver seus bilhetes ativos e premiados.
- **Botão "Guardar no WhatsApp":** Permite ao cliente salvar seus números ou compartilhar no status.
- **Botões de Conversão Imediata:** Links diretos para *"Agendar Horário na Barbearia"* e *"Perfumaria com 2x Bilhetes"*.
- **Hall de Ganhadores com Anonimização LGPD:** Divulgação segura preservando a privacidade do cliente.

### 2.6. Acessos e Atalhos no ERP Dino
- **Ações Rápidas Globais (`+ Criar / Lançar`):** Atalho `🎁 Sorteios & Prêmios` disponível no topo de todas as telas.
- **Menu Lateral do ERP:** Ícone de presente `🎁` com link direto.
- **Aba de Relacionamento:** Integrado dentro da área de relacionamento do `BarbeariaERP`.

---

## 3. Links Oficiais de Acesso em Produção

| Recurso | URL em Produção | Descrição |
| :--- | :--- | :--- |
| **Painel Administrativo de Sorteios** | [https://kytto.com.br/admin/sorteios](https://kytto.com.br/admin/sorteios) | Gestão de campanhas, emissão de bilhetes, exportação CSV e roleta ao vivo |
| **Portal Público de Consulta do Cliente** | [https://kytto.com.br/sorteios/dino](https://kytto.com.br/sorteios/dino) | Consulta de bilhetes por WhatsApp, regulamento e contagem regressiva |
| **Barbearia ERP Dino** | [https://kytto.com.br/admin/barbearia-erp](https://kytto.com.br/admin/barbearia-erp) | Central operacional com atalho em Ações Rápidas |
| **Agendamento Online Dino** | [https://kytto.com.br/agendar/dino](https://kytto.com.br/agendar/dino) | Agendamento público integrado aos sorteios |
| **Catálogo Perfumaria Dino** | [https://kytto.com.br/perfumaria/dino](https://kytto.com.br/perfumaria/dino) | E-commerce e catálogo de perfumes com pontuação 2x |
| **API Pública de Sorteios** | `https://kytto.com.br/api/publico/sorteios/dino` | Endpoint JSON de campanhas e prêmios |

---

## 4. Evidências Técnicas e de Homologação

1. **Deploy no Render:** Serviço `setpoint` (`srv-d8iudokm0tmc73c07iog`), commit `d9af74155`, deploy `dep-dbqqt38473hc738bqvig` finalizado com status **LIVE**.
2. **Banco de Dados PostgreSQL:** Migration 122 aplicada com sucesso com tabelas de campanhas, bilhetes e ganhadores.
3. **Testes Unitários:** 9 de 9 testes aprovados (`node --test app/modules/sorteios/sorteios.test.js`).
4. **Navegação Real:** Telas visualizadas e validadas diretamente nos domínios de produção.
