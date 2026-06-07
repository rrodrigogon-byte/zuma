# SetPoint — Roteiro de Go-Live

Passo a passo para colocar o **SetPoint** (com o evento Agro Open) no ar, conectar pagamentos e rodar o primeiro torneio real.

## 0. Pré-requisitos
- Conta no GitHub (para hospedar o código).
- Conta no Render (render.com) — plano gratuito já funciona para o piloto.
- Conta no Mercado Pago (para Pix/cartão), com **Access Token** de produção.
- Domínio próprio (opcional, ex.: `setpoint.uisa.com.br`).

## 1. Publicar (deploy)
1. Suba a pasta do projeto num repositório no GitHub.
2. No Render: **New → Blueprint** e selecione o repositório (ele lê o `render.yaml`).
3. Em **Environment**, defina:
   - `ADMIN_PASS` = uma senha forte (o `JWT_SECRET` é gerado automaticamente).
   - `MP_ACCESS_TOKEN` = seu token do Mercado Pago (deixe vazio para manter o modo simulado).
   - `PLATFORM_FEE_PCT` = percentual da plataforma no split (padrão 5).
4. Clique em **Apply / Deploy**. Em poucos minutos o site responde em `https://<seu-app>.onrender.com`.
5. Teste a saúde abrindo `/api/info` (deve responder o nome SetPoint).

> Alternativa Docker: `docker build -t setpoint . && docker run -p 3000:3000 ...` (ver `README-DEPLOY.md`).

## 2. Conectar o Mercado Pago (pagamentos reais)
1. No painel do Mercado Pago, gere as credenciais de produção e copie o **Access Token**.
2. Cole em `MP_ACCESS_TOKEN` no Render e faça um novo deploy.
3. Configure o **webhook** apontando para `https://<seu-app>/api/pagamento/webhook` (eventos de pagamento).
4. Faça uma cobrança de teste de R$ 1,00 (Pix) e confirme que o status vira **aprovado** e o pedido é liberado.
5. No painel SetPoint, a aba **Pagamentos** deve mostrar “Mercado Pago conectado”.

## 3. Configurar o clube
1. Acesse `/admin.html` e entre com **admin / (sua senha)**. **Troque a senha do admin** em Usuários.
2. Crie os usuários da equipe (organizador, staff) na aba **Usuários**.
3. Cadastre **patrocinadores**, **planos de sócio**, **cardápio do bar** e **produtos da loja**.
4. Configure as **quadras** e abra horários de **reserva**.

## 4. Primeiro torneio
1. Crie o torneio (aba **Torneios**) e abra **inscrições** (o site recebe em `inscricao.html`/formulário).
2. Valide as inscrições (aba **Inscrições**) — com pagamento, a confirmação é automática.
3. Faça o **sorteio da chave** (aba **Chaveamento**) — escolha o formato (simples, dupla, grupos, liga, suíço).
4. Monte a **agenda** (order of play) por quadra/horário (aba **Agenda**).
5. Durante os jogos: lance os placares (validados pelas regras), use a **dupla validação** para confirmar.
6. **Finalize** a chave → atualiza ranking, rating Elo e campeões.

## 5. Dia do evento
- **Portaria**: valide ingressos por QR em `/portaria.html` (uso único, antifraude).
- **Bar/PDV**: opere mesas e cozinha em `/pdv.html` e `/cozinha.html`.
- **Sócios**: valide carteirinhas digitais na recepção.
- **Acompanhamento**: a aba **Início** mostra indicadores e alertas em tempo real.

## 6. Checklist de produção (segurança & dados)
- [ ] Senha do admin alterada e `JWT_SECRET` forte (gerado pelo Render)
- [ ] HTTPS ativo (Render fornece) + domínio próprio
- [ ] `MP_ACCESS_TOKEN` configurado e webhook testado
- [ ] Disco persistente montado (`/var/data`) **ou** banco Postgres provisionado
- [ ] Backup periódico do `db.json` (ou dump do Postgres)
- [ ] Rate-limit ativo no login (já incluso) e trilha de **auditoria** revisada
- [ ] Consentimento **LGPD** habilitado no cadastro (já incluso)
- [ ] Provedor de e-mail/WhatsApp conectado para a **comunicação em massa** (quando for usar envio real)
- [ ] Emissão fiscal (NFC-e/SAT) integrada, se exigida pela operação do bar

## 7. Evolução recomendada após o piloto
1. Migrar o banco JSON → **Postgres** (só o `app/db.js` muda; rotas e telas continuam iguais).
2. Conectar dados oficiais (ATP/WTA/ITF/CBT) via licenciamento.
3. App white-label e BI avançado (benchmarks entre unidades).

---
**Suporte:** toda a lógica está testada (`node --test` em `app/`). Em caso de dúvida, comece pela aba **Início** do painel — ela aponta o que precisa de atenção.
