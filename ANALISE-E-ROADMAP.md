# Agro Open · Plataforma de Tênis — Análise Completa & Roadmap

*O plano para ser a melhor plataforma de torneios de tênis amador do Brasil.*

---

## 1. Sumário executivo

Hoje a plataforma já é um **sistema funcional de gestão de torneio** (back + front): site institucional, inscrições, sorteio de chaves padrão Grand Slam, controle de partidas com as regras do tênis, ranking interno, ranking ATP/WTA, notícias, regras e painel administrativo.

Para virar **referência nacional** (concorrendo com Meu Ranking, LetzPlay, Tenis Integrado), faltam três pilares de produto: **monetização por assinaturas**, **multi-torneio/temporadas** e **experiência do atleta** (perfil, histórico, app). Este documento detalha o que existe, o que falta e como chegar lá em fases.

---

## 2. Estado atual (o que já está pronto e testado)

| Módulo | Status | Observações |
|---|---|---|
| Site institucional | ✅ | Landing premium, SEO/OG, responsivo |
| Inscrições online | ✅ | Formulário → API + e-mail (rrodrigogon) |
| Categorias (incl. PRO) | ✅ | 14 categorias M/F |
| Sorteio de chaves | ✅ | Cabeças de chave + byes, padrão ITF; manual ou dos inscritos |
| Visualização de chaves | ✅ | Pública, estilo Grand Slam, placar por set |
| Controle de partidas | ✅ | Placar por sets **validado pelas regras**, W.O., abandono |
| Ranking interno | ✅ | Pontos por fase + V/D/aproveitamento, por categoria |
| Ranking ATP/WTA + notícias | ✅ | Ao vivo via API ou snapshot |
| Regras (ATP/ITF) | ✅ | Página completa |
| Melhores do Agro | ✅ | Campeões + pódio + estrelas |
| Painel ADM | ✅ | Login JWT, inscrições, chaveamento, resultados, ranking |
| Backend | ✅ | Node + Express + base JSON (trocável por SQL) |

**Limitações atuais:** banco em arquivo (single-node), torneio único (chaves por categoria, sem entidade "torneio"), sem pagamentos, sem perfil de atleta, sem deploy publicado.

---

## 3. Análise de lacunas (gap analysis)

1. **Monetização** — não há planos/assinaturas nem cobrança de inscrição. *Crítico para sustentar o produto.*
2. **Multi-torneio / temporadas** — o sistema gere um torneio por vez. Falta criar vários torneios, calendário e ranking por temporada.
3. **Pagamentos** — inscrição e mesas não têm checkout (Pix/cartão).
4. **Perfil do atleta** — sem login do jogador, histórico, confrontos, evolução de ranking.
5. **Banco de dados real** — JSON não escala para concorrência/escala.
6. **Comunicação** — sem disparo automático de e-mail/WhatsApp/push (confirmação, jogo marcado, resultado).
7. **Súmula ao vivo & ordem de jogo** — falta agenda de quadras e placar ao vivo.
8. **Deploy & domínio** — ainda roda local.

---

## 4. Visão de produto: "o melhor site de tênis"

Três públicos, um ecossistema:

- **Atleta:** inscreve-se, acompanha sua chave, recebe avisos, vê seu ranking e histórico — tudo no celular.
- **Organizador (clube/UISA):** cria torneios, gera chaves, lança resultados, gerencia financeiro e patrocínios.
- **Patrocinador:** visibilidade em torneios e ranking, leads e relatórios.

Diferenciais para liderar: **chaveamento e súmula no padrão Grand Slam**, **ranking por temporada com categorias**, **assinaturas** (clube/atleta/patrocinador), **pagamentos integrados** e **comunicação automática**.

---

## 5. Módulos a desenvolver (especificação)

### 5.1 Assinaturas & Monetização  *(prioridade 1)*
- **Planos:** Atleta (free / pro), Clube/Organizador (mensal por nº de torneios), Patrocinador (visibilidade).
- **Cobrança recorrente** via **Mercado Pago** ou **Stripe** (assinatura) — webhook para ativar/suspender.
- **Taxa de inscrição** por categoria (checkout avulso Pix/cartão).
- Painel financeiro: receitas por torneio, inadimplência, repasses.

### 5.2 Torneios (multi-evento) *(prioridade 1)*
- Entidade **Torneio**: nome, datas, local, categorias, formato, status (aberto/em andamento/encerrado).
- Inscrições e chaves **vinculadas ao torneio**.
- **Calendário** público de torneios e página de cada evento.

### 5.3 Ranking avançado *(prioridade 2)*
- **Temporadas** (ano), pontos por torneio e categoria, **descarte** dos piores resultados (como ATP).
- Histórico de posição, evolução, head-to-head.
- Ranking combinado (geral) + por categoria + por cidade/clube.

### 5.4 Inscrições & Pagamentos *(prioridade 1)*
- Checkout no ato da inscrição; confirmação automática; lista de espera; descontos/cupom.

### 5.5 Perfil do Atleta / App *(prioridade 2)*
- Login do jogador, carteira de inscrições, próximos jogos, resultados, ranking pessoal, conquistas.
- PWA (instalável no celular) + notificações push.

### 5.6 Comunicação *(prioridade 2)*
- E-mail (SMTP) + WhatsApp (API oficial) + push: confirmação de inscrição, jogo marcado, resultado, lembrete.

### 5.7 Súmula ao vivo & Ordem de jogo *(prioridade 3)*
- Agenda por quadra/horário; placar ao vivo; tela pública de transmissão.

---

## 6. Arquitetura técnica recomendada

- **Frontend:** manter HTML/CSS/JS atual; evoluir para PWA. (Opcional: migrar para React/Next se a equipe crescer.)
- **Backend:** Node + Express (já temos). Modularizar por domínio.
- **Banco:** migrar de JSON → **PostgreSQL** (Supabase ou Neon — free tier) mantendo a interface do `db.js`.
- **Auth:** JWT (admin) + login do atleta (e-mail/senha ou OAuth Google).
- **Pagamentos:** Mercado Pago (Pix nativo, ideal Brasil) e/ou Stripe.
- **Mensageria:** SMTP (Resend/SendGrid) + WhatsApp Cloud API.
- **Deploy:** Render/Railway (app) + Supabase (banco) + domínio próprio + HTTPS.
- **Segurança:** rate limit, validação, hashing (bcrypt — já), variáveis de ambiente, backups do banco.

---

## 7. Modelo de dados (entidades principais)

```
Tournament(id, nome, slug, inicio, fim, local, status, categorias[], formato)
Athlete(id, nome, cpf, nasc, sexo, cidade, email, senha_hash, telefone)
Inscricao(id, tournamentId, athleteId, categoria, status, pagamento)
Chave(tournamentId, categoria, size, seeds, regras, rounds[], placares{})
Match(chaveRef, round, idx, sets[], vencedor, tipo)
RankingPoint(athleteId, temporada, categoria, torneioId, pontos)
Subscription(id, tipo[atleta|clube|patrocinador], plano, status, inicio, gateway, externalId)
Payment(id, refTipo, refId, valor, metodo, status, gatewayId)
Admin(user, passHash, role)
```

---

## 8. Roadmap em fases

**Fase 0 — Publicar (1 semana)**
Deploy do que já existe (Render + Postgres), domínio, HTTPS. *Sair do "roda local".*

**Fase 1 — Monetizar & Multi-torneio (3–4 semanas)**
Entidade Torneio + calendário; checkout de inscrição (Mercado Pago Pix); módulo de Assinaturas (planos + recorrência). → *Já incluído nesta entrega: estrutura de Torneios e Assinaturas (com pagamento em modo stub).*

**Fase 2 — Atleta & Ranking por temporada (3–4 semanas)**
Login do atleta, perfil/histórico, ranking por temporada com descarte, comunicação automática.

**Fase 3 — Ao vivo & App (4+ semanas)**
Ordem de jogo, súmula ao vivo, PWA + push, painel financeiro completo.

---

## 9. Custos estimados (mensal, início)

| Item | Opção | Custo |
|---|---|---|
| Hospedagem app | Render/Railway | US$ 0–7 |
| Banco Postgres | Supabase/Neon free | US$ 0 (escala depois) |
| Domínio | .com.br | ~R$ 40/ano |
| E-mail transacional | Resend free (3k/mês) | US$ 0 |
| Ranking ATP/WTA API | RapidAPI | US$ 0–30 |
| Pagamentos | Mercado Pago | % por transação |
| WhatsApp API | Cloud API | por conversa |

*Início viável praticamente sem custo fixo; pagamentos só cobram sobre o que entra.*

---

## 10. Próximos passos imediatos

1. **Publicar** a plataforma atual (deploy) — destrava testes reais com atletas.
2. Ativar **Torneios** e **Assinaturas** (entregues nesta versão em modo funcional/stub) e ligar o **gateway de pagamento** (Mercado Pago) com suas credenciais.
3. Migrar o banco para **Postgres** quando o volume justificar.
4. Fase 2: **login do atleta** + ranking por temporada.

> Entregue nesta versão, além do que já existia: **módulo de Torneios (criar/listar)**, **módulo de Assinaturas (planos + adesão, pagamento pronto para integrar)** e a página pública **Planos**.
