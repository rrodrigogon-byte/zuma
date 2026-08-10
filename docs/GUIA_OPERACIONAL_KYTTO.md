# Guia Operacional Kytto — Plataforma de Gestão Integrada v3.0.0

**Versão:** 3.0.0  
**Data:** 10/08/2026  
**Fuso Horário:** America/Cuiaba (UTC-4)  
**Ambiente:** Produção (GCP Cloud Run)  
**URL:** https://setpoint.kytto.com.br

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Papéis e Permissões](#papéis-e-permissões)
3. [Procedimentos por Papel](#procedimentos-por-papel)
4. [Módulos Operacionais](#módulos-operacionais)
5. [Procedimentos Críticos](#procedimentos-críticos)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

A plataforma Kytto é um sistema integrado de gestão multientidade que centraliza operações de bar, restaurante, cozinha, estoque e financeiro. Todos os dados são compartilhados em tempo real entre módulos, garantindo uma única fonte de verdade (SSOT).

### Características Principais

- **Multientidade:** Cada empresa vê apenas seus dados
- **Tempo Real:** Sincronização instantânea entre PDV, KDS, Estoque e Financeiro
- **Offline-First:** Funciona sem internet (sincroniza quando conectado)
- **Observabilidade:** Logs estruturados, métricas e alertas automáticos
- **Backup Automático:** Snapshots diários com retenção de 30 dias

---

## 👥 Papéis e Permissões

### Administrador (Admin Full)

**Permissões:**
- Acesso completo a todos os módulos
- Configuração de usuários e perfis
- Gestão de estoque e preços
- Emissão de notas fiscais
- Backup e recuperação
- Observabilidade e alertas

**Usuários Padrão:**
- `admin@setpoint-ultra.local` / `SetPoint@2026Temp`
- `rrodrigogon@gmail.com` / `#080581Verdao`
- `caua.goncalves@uisa.com.br` / `SetPoint@2026Temp`

### Gerente de Loja

**Permissões:**
- Visualização de Dashboard e BI
- Gestão de mesas e comandas
- Fechamento diário
- Relatórios de vendas
- Não pode: alterar preços, emitir notas fiscais, gerenciar usuários

### Garçom / Atendente

**Permissões:**
- Lançamento de itens em comandas
- Visualização de mesas
- Divisão de conta
- Não pode: alterar preços, visualizar financeiro, gerenciar estoque

### Cozinha / Bar

**Permissões:**
- Visualização de pedidos no KDS
- Marcação de itens prontos
- Não pode: lançar itens, alterar preços, visualizar financeiro

---

## 📱 Procedimentos por Papel

### 1️⃣ Administrador

#### Abertura de Turno

```
1. Acessar https://setpoint.kytto.com.br/login
2. Fazer login com credenciais de admin
3. Ir para Dashboard
4. Verificar:
   - Mesas disponíveis (devem estar todas livres)
   - Estoque OK (sem itens baixos ou sem estoque)
   - Caixa anterior fechado
5. Clicar em "Iniciar Turno"
6. Confirmar abertura de caixa
```

#### Gestão de Usuários

```
1. Dashboard → Administração → Usuários
2. Para adicionar novo usuário:
   - Clicar em "Novo Usuário"
   - Preencher email e nome
   - Selecionar perfil (Admin, Gerente, Garçom, Cozinha)
   - Definir senha temporária
   - Clicar em "Salvar"
3. Usuário receberá email com link de primeiro acesso
```

#### Configuração de Estoque

```
1. Dashboard → Estoque
2. Para adicionar item:
   - Clicar em "Novo Item"
   - Preencher nome, categoria, preço de custo
   - Definir quantidade inicial
   - Marcar "permitir estoque negativo" se necessário
   - Clicar em "Salvar"
3. Para editar item:
   - Clicar no item
   - Alterar dados
   - Clicar em "Salvar"
```

#### Emissão de Nota Fiscal

```
1. Dashboard → Notas Fiscais
2. Selecionar período (hoje, semana, mês)
3. Clicar em "Gerar NFC-e"
4. Revisar dados:
   - Empresa (Kytto ou Florescer)
   - Itens vendidos
   - Valor total
   - Impostos calculados
5. Clicar em "Emitir"
6. Nota fiscal será salva localmente (SEM transmissão à SEFAZ)
7. Clicar em "Baixar XML" para guardar cópia
```

#### Backup Manual

```
1. Dashboard → Administração → Backup
2. Clicar em "Criar Snapshot"
3. Adicionar descrição (ex: "Backup pré-auditoria")
4. Clicar em "Confirmar"
5. Sistema criará cópia do banco de dados
6. Snapshot será salvo localmente e no GCS
```

#### Monitoramento de Observabilidade

```
1. Dashboard → Administração → Observabilidade
2. Visualizar:
   - Latência de endpoints (p50, p95, p99)
   - Alertas ativos (estoque baixo, comanda aberta >2h)
   - Operações críticas (logins, vendas, alterações fiscais)
3. Resolver alertas:
   - Clicar no alerta
   - Revisar detalhes
   - Clicar em "Resolver"
```

#### Fechamento de Turno

```
1. Dashboard → Caixa
2. Revisar:
   - Total de vendas do dia
   - Número de comandas fechadas
   - Divergências de caixa
3. Clicar em "Fechar Caixa"
4. Confirmar valores
5. Sistema gerará relatório de fechamento
6. Backup automático será criado
```

---

### 2️⃣ Gerente de Loja

#### Visualização de Dashboard

```
1. Acessar https://setpoint.kytto.com.br/login
2. Fazer login com credenciais de gerente
3. Dashboard mostra:
   - Comandas abertas (quantidade e valor em aberto)
   - Mesas ocupadas
   - Estoque (itens OK, baixos, sem estoque)
   - Faturamento do dia
   - KPIs operacionais
```

#### Gestão de Mesas

```
1. Dashboard → Mesas
2. Visualizar mapa de mesas:
   - Verde: livre
   - Amarelo: ocupada
   - Vermelho: com comanda aberta há >2h
3. Clicar em mesa para ver detalhes:
   - Comanda aberta
   - Itens pedidos
   - Tempo de ocupação
```

#### Fechamento Diário

```
1. Dashboard → Fechamento Diário
2. Revisar:
   - Total de vendas
   - Número de transações
   - Métodos de pagamento
   - Divergências
3. Clicar em "Gerar Relatório"
4. Exportar como PDF
```

#### Relatórios de Vendas

```
1. Dashboard → BI / Relatórios
2. Selecionar período (hoje, semana, mês, personalizado)
3. Visualizar:
   - Produtos mais vendidos
   - Horários de pico
   - Curva ABC
   - Margem por produto
4. Exportar dados em CSV/PDF
```

---

### 3️⃣ Garçom / Atendente

#### Abertura de Comanda

```
1. Acessar https://setpoint.kytto.com.br/pdv (modo garçom)
2. Clicar em "Nova Comanda"
3. Selecionar mesa
4. Clicar em "Abrir"
5. Comanda está pronta para receber itens
```

#### Lançamento de Itens

```
1. Comanda aberta
2. Clicar em "Adicionar Item"
3. Selecionar produto do cardápio
4. Se houver adicionais/modificadores:
   - Selecionar opções
   - Confirmar
5. Quantidade aparece automaticamente
6. Clicar em "Confirmar"
7. Item aparece na comanda e no KDS
```

#### Visualização de Cardápio

```
1. Clicar em "Cardápio"
2. Filtrar por categoria:
   - Bebidas (cervejas, refrigerantes, água)
   - Espetinhos
   - Combos
3. Buscar por nome
4. Ver preço e disponibilidade
5. Clicar para adicionar à comanda
```

#### Divisão de Conta

```
1. Comanda aberta com múltiplos itens
2. Clicar em "Dividir Conta"
3. Selecionar itens para primeira parte
4. Clicar em "Dividir"
5. Sistema cria duas comandas:
   - Comanda A: itens selecionados
   - Comanda B: itens restantes
6. Processar pagamento separadamente
```

#### Pagamento Parcial

```
1. Comanda aberta
2. Clicar em "Pagamento Parcial"
3. Inserir valor a pagar
4. Selecionar método (dinheiro, PIX, cartão)
5. Clicar em "Confirmar"
6. Comanda permanece aberta com saldo restante
7. Cliente pode pagar restante depois
```

#### Reabertura de Comanda

```
1. Comanda fechada
2. Clicar em "Histórico"
3. Localizar comanda
4. Clicar em "Reabrir"
5. Comanda volta ao status aberto
6. Pode adicionar mais itens
```

---

### 4️⃣ Cozinha / Bar

#### Visualização de Pedidos (KDS)

```
1. Acessar https://setpoint.kytto.com.br/kds
2. Tela mostra fila de pedidos por categoria:
   - Bebidas (bar)
   - Espetinhos (cozinha)
3. Cada pedido mostra:
   - Número da mesa
   - Itens solicitados
   - Tempo decorrido
   - Modificadores/adicionais
```

#### Marcação de Itens Prontos

```
1. Preparar item
2. Clicar em item na tela KDS
3. Clicar em "Pronto"
4. Item sai da fila
5. Garçom recebe notificação
6. Item aparece em "Prontos para Servir"
```

#### Gestão de Fila

```
1. KDS mostra SLA (tempo máximo para preparar):
   - Bebidas: 2 minutos
   - Espetinhos: 10 minutos
2. Itens em vermelho: ultrapassaram SLA
3. Priorizar itens em vermelho
4. Clicar em "Pausar" se necessário
```

---

## 🏪 Módulos Operacionais

### PDV (Ponto de Venda)

**Funcionalidades:**
- Lançamento de itens em comandas
- Visualização de estoque em tempo real
- Modificadores e adicionais
- Divisão de conta
- Pagamento parcial
- Reabertura de comanda

**Acesso:** `/pdv` ou `/garcom`

---

### KDS (Kitchen Display System)

**Funcionalidades:**
- Fila de pedidos por categoria
- SLA por praça
- Marcação de itens prontos
- Histórico de produção
- Métricas de performance

**Acesso:** `/kds`

---

### Dashboard

**Funcionalidades:**
- Visão geral de operações
- KPIs em tempo real
- Alertas automáticos
- Acesso a todos os módulos
- Observabilidade

**Acesso:** `/admin/dashboard`

---

### Estoque

**Funcionalidades:**
- CRUD de itens
- Controle de quantidade
- Estoque mínimo com alertas
- Inventário rotativo
- Perdas e quebras

**Acesso:** `/admin/estoque`

---

### Financeiro

**Funcionalidades:**
- Recebimentos automáticos de vendas
- Contas a pagar
- Contas a receber
- Fluxo de caixa
- Relatórios financeiros

**Acesso:** `/admin/financeiro`

---

### Notas Fiscais

**Funcionalidades:**
- Emissão de NFC-e (local)
- Geração de XML
- Assinatura digital
- QR Code
- Guarda legal

**Acesso:** `/admin/notas-fiscais`

---

### Clientes

**Funcionalidades:**
- Cadastro de clientes
- Contas a receber
- Alertas de vencimento
- Histórico de compras

**Acesso:** `/admin/clientes`

---

### Pagamentos

**Funcionalidades:**
- Integração com Mercado Pago
- PIX
- Cartão de crédito/débito
- Webhook de confirmação
- Histórico de transações

**Acesso:** `/admin/pagamentos`

---

### BI / Relatórios

**Funcionalidades:**
- Análise de vendas
- Produtos mais vendidos
- Horários de pico
- Curva ABC
- Margem por produto

**Acesso:** `/admin/bi`

---

## 🔒 Procedimentos Críticos

### Recuperação de Backup

**Situação:** Sistema corrompido ou dados perdidos

```
1. Acessar Dashboard → Administração → Backup
2. Clicar em "Listar Snapshots"
3. Selecionar snapshot desejado
4. Clicar em "Restaurar"
5. Confirmar (criará backup do estado atual antes de restaurar)
6. Sistema será restaurado
7. Recarregar página
```

### Emissão Fiscal com Contingência

**Situação:** Certificado A1 expirado ou indisponível

```
1. Dashboard → Notas Fiscais
2. Clicar em "Emitir NFC-e"
3. Se certificado indisponível:
   - Sistema entrará em modo contingência
   - Gerará rascunho fiscal
   - Exibirá aviso de contingência
4. Após resolver certificado:
   - Clicar em "Sair de Contingência"
   - Notas em contingência serão regularizadas
```

### Sincronização Offline

**Situação:** Sistema sem internet

```
1. PDV continuará funcionando normalmente
2. Itens lançados ficarão em fila offline
3. Quando internet retornar:
   - Fila será sincronizada automaticamente
   - Todos os itens serão lançados em produção
   - Notificação de sucesso aparecerá
```

### Alertas Críticos

**Estoque Sem Estoque:**
```
1. Alerta aparece no Dashboard
2. Clicar em alerta
3. Ir para Estoque
4. Repor item
5. Alerta será resolvido automaticamente
```

**Comanda Aberta >2h:**
```
1. Alerta aparece no Dashboard
2. Clicar em alerta
3. Ir para Mesas
4. Localizar mesa
5. Fechar comanda ou reabrir para novo pagamento
6. Alerta será resolvido
```

---

## 🆘 Troubleshooting

### Problema: PDV não carrega

**Solução:**
1. Recarregar página (F5)
2. Limpar cache do navegador (Ctrl+Shift+Delete)
3. Fazer logout e login novamente
4. Se persistir: contatar administrador

---

### Problema: Estoque não sincroniza

**Solução:**
1. Verificar conexão com internet
2. Recarregar página
3. Se offline: aguardar conexão e sincronizar manualmente
4. Dashboard → Administração → Observabilidade
5. Verificar se há alertas de latência

---

### Problema: KDS não mostra pedidos

**Solução:**
1. Verificar se PDV está lançando itens
2. Recarregar página KDS
3. Verificar filtro de categoria
4. Se persistir: verificar logs em Observabilidade

---

### Problema: Nota fiscal não emite

**Solução:**
1. Verificar se certificado A1 está válido
2. Verificar data/hora do servidor (deve estar sincronizada)
3. Revisar dados da empresa (CNPJ, razão social)
4. Se persistir: contatar administrador

---

### Problema: Usuário não consegue fazer login

**Solução:**
1. Verificar se email está correto
2. Verificar se usuário está ativo (admin pode verificar em Usuários)
3. Clicar em "Esqueci a senha"
4. Resetar senha
5. Fazer login com nova senha

---

## 📞 Contatos de Suporte

| Papel | Contato | Disponibilidade |
|-------|---------|-----------------|
| Administrador | admin@setpoint-ultra.local | 24/7 |
| Suporte Técnico | rodrigo.goncalves@uisa.com.br | Seg-Sex 8h-18h |
| Fiscal | caua.goncalves@uisa.com.br | Seg-Sex 9h-17h |

---

## 📊 Métricas Operacionais

### KPIs do Dashboard

| Métrica | Descrição | Alerta |
|---------|-----------|--------|
| Comandas Abertas | Número de mesas com comanda aberta | >5 |
| Valor em Aberto | Valor total em aberto | >R$ 500 |
| Estoque OK | Itens com quantidade adequada | <80% |
| Estoque Baixo | Itens abaixo do mínimo | >5 |
| Faturamento | Total vendido no período | Informativo |
| Mesas Ocupadas | Número de mesas em uso | Informativo |

---

## 🔐 Segurança

### Boas Práticas

1. **Senhas:** Usar senhas fortes (mínimo 8 caracteres, maiúscula, minúscula, número, símbolo)
2. **Logout:** Sempre fazer logout ao sair do sistema
3. **Backup:** Backup automático ocorre a cada 1 hora
4. **Logs:** Todas as operações críticas são registradas
5. **Certificado:** A1 deve ser renovado antes de expirar

---

## 📝 Versão

**Versão:** 3.0.0  
**Data de Atualização:** 10/08/2026  
**Próxima Revisão:** 30/09/2026

---

*Este documento é confidencial e destinado apenas aos usuários autorizados da plataforma Kytto.*
