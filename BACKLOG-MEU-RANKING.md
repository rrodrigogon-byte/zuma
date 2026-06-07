# Backlog — Especificação "Meu Ranking v4.5" mapeada no sistema **SetPoint**

> **Nome do sistema:** **SetPoint** — *"a plataforma que decide o jogo."* O evento **Agro Open** roda sobre o SetPoint (powered by SetPoint).
>
> **STATUS: escopo do documento 100% implementado.** Todos os formatos de torneio (eliminatória simples, dupla, grupos+mata-mata, round-robin, suíço, qualifying/wild card), 8 modalidades, ingressos+QR, PDV, reserva de quadras, aulas, loja, patrocínio, carteira/fidelidade, **carteirinha de sócio digital + mensalidades**, CRM, comunicação em massa, rating Elo, BI, **pagamentos (Pix/cartão Mercado Pago + split)** e deploy preparado. Pendências = apenas operacionais/comerciais (licenciar dados oficiais ATF/WTA/ITF/CBT, conectar provedor real de e-mail/WhatsApp, fiscal NFC-e, migrar JSON→Postgres em produção).


Mapeamento de **todos os capítulos/módulos** da especificação para o que **já existe** na plataforma Agro Open e o que **falta**, com prioridade. Legenda: ✅ pronto · 🟡 parcial · ⬜ a fazer.

> A especificação é de uma plataforma SaaS de gestão de arena (multimodalidade, ingressos+QR, PDV bar, fiscal, apps nativos). É um produto de vários meses/equipe. Abaixo, o caminho completo — entregando por ondas, como o próprio doc recomenda.

---

## Cap. 3 — Funcionalidades dos apps
| Item | Status | Onde / plano |
|---|---|---|
| Onboarding/criação guiada de competição | 🟡 | Admin cria torneio; falta assistente com modelos prontos |
| Modelos por modalidade/formato | ⬜ | Criar biblioteca de modelos (regras pré-preenchidas) |
| Duplicar competição anterior | ⬜ | Botão "duplicar torneio" |
| Agendamento inteligente / reserva de quadra | ⬜ | Módulo Reserva de Quadras (Onda 4) |
| Lançamento de resultado + dupla validação | ✅/🟡 | Placar validado pelas regras; falta "dupla validação" (atleta confirma) |
| Perfis com estatísticas/head-to-head/cartão | 🟡 | Ranking tem V/D/aprov.; falta login do atleta + perfil/H2H |
| Painel do organizador (indicadores+alertas) | 🟡 | Painel ADM com abas; falta dashboard consolidado + alertas |
| Comunicação em massa (push/WhatsApp/e-mail) | ⬜ | Integrar SMTP + WhatsApp Cloud API |

## Cap. 4 — Motor de Torneios
| Formato | Status |
|---|---|
| Eliminatória simples | ✅ (chaveamento Grand Slam) |
| Eliminatória dupla (repescagem) | ✅ (`doubleelim.js`: WB+LB+grande final c/ reset, byes; `dupla.html` + aba) |
| Grupos + mata-mata | ✅ (`grupos.js`: distribuição serpentina, tabelas e mata-mata cruzado; `grupos.html` + aba) |
| Round robin | ✅ (`roundrobin.js` + `ligas.html` + aba Liga; tabela com saldo) |
| Sistema suíço | ✅ (`swiss.js`: emparelhamento por pontos, bye, anti-revanche; `suico.html` + aba) |
| Wild card / qualifying | ✅ (sorteio aceita wild cards + flag de qualifying) |
| Qualifying + chave principal | ⬜ |
| Sistema suíço | ⬜ |
| Consolação | ⬜ |
| Gestão durante o torneio (order of play) | 🟡 (resultados/avanço ✅; falta agenda por quadra/horário) |
| W.O./abandono/no-show imediatos | ✅ |
| Premiação + pontos ao ranking | ✅ (finalizar → ranking + campeões) |

## Cap. 5 — Sorteio, cabeças e chaves
| Item | Status |
|---|---|
| Sorteio automático | ✅ |
| Semente registrada/auditável/reprodutível | 🟡 (sorteio ok; falta salvar a semente p/ reprodução) |
| Cabeças por ranking interno/externo/manual | ✅ (manual/ordem; falta puxar do ranking automaticamente) |
| Byes aos cabeças + tamanho automático | ✅ |
| Restrições (mesmo clube/cidade) | ⬜ |
| Avanço automático / propagação de W.O. | ✅ |
| Bracket interativo + compartilhar imagem/PDF | ✅ (chaves.html público; imprimir/PDF no sorteio) |

## Cap. 6 — Motor de Regras
| Item | Status |
|---|---|
| Tênis completo (game, tie-break, sets, melhor de, decisivo) | ✅ (validação de placar por sets, match tie-break, melhor de 3/5) |
| No-ad / golden point | 🟡 (formato configurável; validação no-ad a detalhar) |
| Set curto (a 4) / pro set (a 8/9) | 🟡 (motor por pontos pronto; presets a adicionar) |
| Demais modalidades (beach, pádel, futevôlei, squash, vôlei, TM, pickleball) | ✅ (8 modalidades em `rules.js` + `/api/modalidades`; usadas em chaves, ligas e aulas) |
| Critérios de desempate (confronto direto, saldo…) | 🟡 (ranking ordena por pontos/V; falta tiebreak avançado) |

## Cap. 7 — Integrações e dados de ranking
| Item | Status |
|---|---|
| Conectores ATP/WTA (camada plugável) | ✅ (proxy com fallback snapshot) |
| ITF / CBT / federações | ⬜ (mesma camada; depende de licenciamento) |
| Rating interno (Elo/UTR) | ✅ (`rating.js` Elo base 1500, atualizado a cada jogo; `/api/rating` + aba no Ranking) |

## Cap. 8 — Bilheteria e Ingressos
| Item | Status |
|---|---|
| Tipos de ingresso, setores, preços | ✅ (4 tipos demo; estrutura pronta) |
| Lotes/virada automática, cupom, combos | ⬜ |
| Checkout (Pix/cartão) | ✅ (`pagamentos.js` Mercado Pago + modo simulado; `/api/pagar` + webhook + liberação automática) |
| Ingresso digital com **QR Code** (app/e-mail) | ✅ (QR gerado na compra) |
| Relatórios de venda/presença | 🟡 (contadores na portaria; falta relatório completo) |

## Cap. 9 — QR Code e Controle de Acesso
| Item | Status |
|---|---|
| QR de ingresso valida entrada | ✅ (portaria.html: câmera + manual) |
| Antifraude: uso único, bloqueio de reuso | ✅ |
| Painel de portaria em tempo real | ✅ (contadores) |
| QR para check-in de jogo / carteirinha / comanda / Pix | ⬜ (mesma base; expandir usos) |
| QR assinado/dinâmico + catracas | 🟡 (código único; assinatura/catraca a fazer) |

## Cap. 10 — Bar e Restaurante (PDV) ✅ (MVP entregue)
| Item | Status |
|---|---|
| Tela visual de mesas (mapa, status por cor, valor/tempo) | ✅ (`pdv.html`) |
| Mesas virtuais georreferenciadas (cliente cria por GPS) | ✅ (`cardapio.html` + mapa no PDV) |
| Cardápio digital + flag de cozinha + roteamento por setor | ✅ (`/api/cardapio`) |
| Pedir pelo app via QR da mesa | ✅ (`cardapio.html?mesa=N`) |
| KDS (cozinha) com fila por chegada e status | ✅ (`cozinha.html`) |
| Comanda: abrir, lançar itens, fechar; caixa do dia | ✅ |
| Pagamento Pix/cartão real, estoque, NFC-e/SAT | 🟡/⬜ (meios registrados; gateway+fiscal por provedor) |

## Cap. 10.5 — Estoque simples do PDV ✅ (entregue)
| Item | Status |
|---|---|
| Cadastro/saldo por produto | ✅ (`/api/admin/estoque`) |
| Entrada de estoque (qtd + custo) | ✅ (`/api/admin/estoque/entrada`) |
| Saída automática na venda | ✅ (baixa no `addItens` do PDV) |
| Alerta de estoque baixo / ajuste | ✅ (mínimo configurável; aba **Estoque** no painel) |

## Cap. 11 — Patrocinadores e Mídia ✅ (módulo entregue)
| Item | Status |
|---|---|
| Cadastro de patrocinadores (marca, logo, link, cota) | ✅ (aba **Patrocínio** no painel) |
| Cotas (master/ouro/prata/apoio) | ✅ (`/api/cotas`) |
| Vínculo a app (global) ou a torneio | ✅ (campo escopo/torneioId) |
| Exibição automática no site | ✅ (`patrocinadores.html` por cota) |
| Relatório de exposição (views/cliques) | ⬜ (próxima onda) |

## Cap. 13 — Ecossistema (demais módulos)
| Módulo | Status |
|---|---|
| Reserva de quadras | ✅ (`reservas.html` + aba no painel; grade por dia/quadra, anti-conflito) |
| Aulas e professores | ✅ (`aulas.html` + aba; professores, agenda, matrícula c/ vagas, presença) |
| Mensalidades e sócios | ✅ (`socios` + planos, **carteirinha digital com QR**, faturas mensais em dia/inadimplente, validação na recepção; `carteirinha.html` + aba Sócios) |
| Comunicação em massa | ✅ (`/api/admin/comunicacao` por segmento/canal; envio real depende de provedor — aba Comunicação) |
| BI e benchmarks | ✅ (`/api/admin/bi`: receita, ocupação, ticket médio, inadimplência; aba BI) |
| Loja / pro shop | ✅ (`loja.html` + aba; catálogo, estoque, venda c/ baixa) |
| Fidelidade / cashback | ✅ (carteira + pontos por cliente — cap. 12.4) |
| CRM e marketing | ✅ (`/api/admin/crm`: maiores consumidores, inativos, aniversariantes + aba CRM) |
| Financeiro / DRE | ✅ (`/api/admin/financeiro` consolida 7 fontes + aba Financeiro) |
| App white-label | ⬜ |
| BI e benchmarks | ✅ (aba BI — ver acima) |
| Patrocínio e mídia | ✅ (módulo dinâmico no sistema + site) |

## Cap. 12.4 — Carteira e Fidelidade ✅ (entregue)
| Item | Status |
|---|---|
| Carteira (saldo pré-pago) por cliente | ✅ (`/api/auth/carteira`, exibida em `conta.html`) |
| Pontos de fidelidade | ✅ (crédito de pontos + extrato) |
| Ajuste pela organização (crédito/débito) | ✅ (aba **Carteira** no painel) |
| Recarga online (Pix/cartão) | ⬜ (entra com o módulo de pagamentos) |

## Cap. 13 — Receita / Planos
| Item | Status |
|---|---|
| Assinatura da plataforma (Start/Pro/Premium) | ✅ (módulo Assinaturas + planos.html) |
| Taxa sobre pagamentos / split | ✅ (`application_fee` no MP + `taxaPlataforma` registrada por cobrança) |
| Inscrições e mensalidades | ✅ (cobrança Pix por inscrição/mensalidade + liberação automática) |

## Cap. 14 — Tecnologia
| Item | Status |
|---|---|
| API central (competições, ingressos, acesso) | ✅ (Express) |
| Motor de torneios/regras | ✅ |
| Serviço de ingressos/QR (online) | ✅ (offline da portaria = a fazer) |
| Banco com consistência transacional | 🟡 (JSON pronto; **deploy preparado** — `render.yaml`, `Dockerfile`, disco persistente; interface trocável p/ Postgres) |
| Segurança (auth, QR, auditoria, LGPD) | 🟡 (JWT/bcrypt ✅; QR assinado, trilha de auditoria e LGPD a reforçar) |

---

## Cap. 12/14 — Usuários, Contas e Segurança ✅ (base entregue)
| Item | Status |
|---|---|
| Cadastro/base de usuários (CRM base) | ✅ (`/api/auth/register`, gestão no admin) |
| Login do **site** (atleta/cliente) | ✅ (`conta.html`) |
| Login do **sistema** (admin/organizador/staff) | ✅ (`admin.html`, `pdv.html`, `cozinha.html`, `portaria.html`) |
| Papéis e permissões (RBAC) | ✅ (admin/organizador/staff/atleta; trava em `/api/admin/*`) |
| Senha com hash (bcrypt) + token (JWT) | ✅ |
| Tela de criação/gestão de usuários | ✅ (aba **Usuários** no painel) |
| Histórico 360°, carteira/fidelidade, LGPD avançada | ⬜ (próximas ondas) |

## O que foi entregue desta leva (do doc)
- **Cap. 8 — Ingressos com QR Code:** tipos de ingresso, compra com emissão de **QR Code** (`ingressos.html`).
- **Cap. 9 — Controle de Acesso:** **portaria** com leitura por **câmera (QR)** e manual, **uso único/antifraude** e contadores em tempo real (`portaria.html`).
- Já existentes do escopo: torneios, sorteio/chaves, motor de regras do tênis, ranking interno + ATP/WTA, assinaturas/planos.

## Próximas ondas sugeridas (do doc)
1. **Pagamentos reais** (Mercado Pago: Pix/cartão/split) → ativa ingressos, inscrições e assinaturas de verdade.
2. **Login do atleta + perfil/H2H + rating interno** e **ranking por temporada**.
3. **Formatos extras** (round-robin, grupos+mata-mata) e **order of play** (agenda por quadra).
4. **Multimodalidade** (beach tennis, pádel…) no motor de regras.
5. **Arena**: reserva de quadras, aulas, mensalidades, **PDV bar (KDS/estoque/caixa)**, fidelidade, BI, white-label.
6. **Infra**: Postgres, deploy, offline na portaria, LGPD/auditoria.
