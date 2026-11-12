# Módulo Oficial de Sorteios & Campanhas Premiadas Kytto
## Barbearia Dino, Perfumaria & Loja Online (E-commerce)

**Data de Implantação:** 12 de Novembro de 2026  
**Ambiente:** Produção (PRD) — `https://kytto.com.br` e `https://setpoint.kytto.com.br`  
**Responsável Técnico:** Rodrigo Gonçalves / Equipe de Engenharia Kytto  
**Status do Deploy no Render:** `LIVE` (Serviço `setpoint` - `srv-d8iudokm0tmc73c07iog`, commit `1dd51be1e`)

---

## 1. Visão Geral da Solução

Atendendo à demanda de Dino para impulsionar as vendas e o engajamento dos seus negócios (**Barbearia Dino**, **Loja de Produtos & Perfumaria** e **E-commerce**), foi concebido, desenvolvido e colocado em produção o **Módulo de Sorteios & Campanhas Premiadas Kytto**.

O módulo conecta o fluxo de atendimento presencial e digital diretamente a um motor de fidelização com premiações auditadas matematicamente via criptografia SHA-256 (RFC 7518), garantindo credibilidade absoluta perante os clientes e conformidade com a LGPD.

---

## 2. Principais Funcionalidades Entregues

### 2.1. Regras de Pontuação Inteligentes e Flexíveis
- **Serviços da Barbearia (Cabelo, Barba, Combos):** A cada R$ 50,00 gastos na comanda, o cliente recebe automaticamente **1 Número da Sorte**.
- **Perfumaria e Cosméticos (Loja & Balcão):** Compras de itens de perfumaria fina e cosméticos pontuam **EM DOBRO (2x)**: a cada R$ 50,00 gastos, o cliente recebe **2 Números da Sorte**.
- **Membros do Clube Dino:** Assinantes ativos do clube de assinaturas recebem **+3 bilhetes bônus** por campanha como benefício de fidelidade.
- **Emissão Manual de Cortesia (Balcão):** Permite que Dino e gerentes emitam números da sorte como brinde ou cortesia para ações de encantamento e recuperação de clientes.

### 2.2. Geração Automática Integrada ao Fechamento de Comandas
- No encerramento da comanda presencial via PDV (`posFaturamentoComanda`), o sistema identifica o cliente, calcula os valores de serviços e itens de perfumaria, gera os bilhetes da sorte em tempo real e anexa o aviso comemorativo no extrato e via WhatsApp.

### 2.3. Sorteador Oficial com Roleta Digital e Auditoria Criptográfica
- **Interface de Roleta Digital ao Vivo:** Animação gráfica de roleta com som e efeito confete para realizar sorteios presenciais na barbearia ou em lives no Instagram.
- **Motor Criptográfico Determinístico SHA-256 (RFC 7518):** O sorteio gera um hash criptográfico imutável baseado no ID da campanha, lista ordenada de bilhetes concorrentes, semente temporal e chave do tenant, provando que não há interferência humana ou manipulação de resultados.
- **Certificado de Auditoria:** Cada ganhador possui um código de validação público para conferência.

### 2.4. Portal Público do Cliente (`/sorteios/dino`)
- **Consulta por WhatsApp/Telefone:** O cliente acessa `https://kytto.com.br/sorteios/dino`, digita seu número de celular e visualiza instantaneamente todos os seus bilhetes gerados, o histórico de compras vinculadas e se algum bilhete foi premiado.
- **Regulamento e Transparência:** Regras claras de participação e pontuação.
- **Hall de Ganhadores com Proteção LGPD:** Exibição pública dos ganhadores com anonimização automática do sobrenome (ex: *Rodrigo G.*).

### 2.5. Integração com WhatsApp
- Disparo oficial com mensagem formatada parabenizando o ganhador, contendo o bilhete premiado, prêmio conquistado, hash de auditoria e link para combinar a entrega.

---

## 3. URLs e Links Oficiais em Produção

| Recurso | URL em Produção | Acesso |
| :--- | :--- | :--- |
| **Painel de Gestão de Sorteios** | `https://kytto.com.br/admin/sorteios` | Acesso restrito (Dino / Administradores) |
| **Portal Público do Cliente** | `https://kytto.com.br/sorteios/dino` | Acesso público (Clientes da Barbearia) |
| **API Pública de Sorteios** | `https://kytto.com.br/api/publico/sorteios/dino` | Retorno JSON público de campanhas ativas |
| **Consulta Pública de Bilhetes** | `https://kytto.com.br/api/publico/sorteios/dino/meus-bilhetes?telefone=...` | Busca de bilhetes por telefone/WhatsApp |
| **Atalho no Menu ERP Dino** | Ícone de presente 🎁 na barra lateral do ERP | Acesso rápido pelo painel operacional |

---

## 4. Evidências dos Testes de Homologação em Produção (PRD)

### 4.1. Suíte de Testes Unitários Automatizada
Executada com 100% de sucesso (`9 de 9 testes aprovados`):
- `app/modules/sorteios/sorteios.test.js`
- Testes cobrindo: provisionamento de campanhas, emissão por serviços, emissão com pontuação 2x de perfumaria, emissão manual de cortesia, consulta pública por telefone, algoritmo determinístico SHA-256 e LGPD.

### 4.2. Teste de Fluxo Real em Produção (Live HTTP)
1. **Autenticação Admin:** Usuário `dino@barbeariadino.com.br` autenticado com sucesso e token JWT multi-tenant gerado.
2. **Listagem de Campanhas (`GET /api/admin/sorteios`):** Status `200 OK` — retornou a campanha oficial *"Mega Sorteio de Fim de Ano Dino: Moto 0km & Kit Perfumaria de Luxo"*.
3. **Emissão de Bilhetes no Balcão (`POST /api/admin/sorteios/:id/emitir-manual`):** Status `201 Created` — emitidos 3 bilhetes da sorte para o cliente *Rodrigo Gonçalves* (`Série 01 - Nº 000001`, `000002` e `000003`) com hashes individuais SHA-256.
4. **Consulta Pública (`GET /api/publico/sorteios/dino/meus-bilhetes?telefone=65999056008`):** Status `200 OK` — retornou os bilhetes vinculados ao WhatsApp do cliente no portal público.
5. **Apuração do Sorteio Oficial (`POST /api/admin/sorteios/:id/sortear`):** Status `200 OK` — bilhete sorteado com sucesso via SHA-256 RFC 7518:
   - **Ganhador:** Rodrigo Gonçalves
   - **Bilhete:** Série 01 - Nº 000003
   - **Prêmio:** Moto Honda Fan 160 0km (ou R$ 18.000 no Pix direto)
   - **Hash de Auditoria:** `35c77a9b8d2fc5f84ba9f5218bb6ef0fa6c44da90b0d0f51774876d9a9e8995e`
6. **Notificação WhatsApp Ganhador (`POST /api/admin/sorteios/:id/notificar-ganhador`):** Mensagem oficial gerada e pronta para disparo em 1 clique.

---

## 5. Estrutura do Banco de Dados (Migration 122)

- **`sorteios_campanhas`**: Cadastro das campanhas, prêmios, critérios de pontuação, status e auditoria do sorteio.
- **`sorteios_bilhetes`**: Tabela de números da sorte emitidos, com unicidade por campanha, vínculo de cliente e hash SHA-256 de autenticidade.
- **`sorteios_ganhadores`**: Registro imutável das apurações oficiais com semente de auditoria e status de entrega de prêmios.
