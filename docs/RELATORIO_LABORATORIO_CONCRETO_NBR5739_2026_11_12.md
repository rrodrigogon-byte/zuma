# Módulo Completo de Laboratório & Controle Tecnológico de Concreto
## ABNT NBR 5738 · ABNT NBR 5739 · ABNT NBR 12655
**Plataforma Oficial:** Kytto ERP Industrial  
**Empresa:** Serrano Concreto & Mineração Ltda  
**Data da Implantação:** 12 de Novembro de 2026  
**Responsável Técnica:** Engª Civil Karin Prestes (CREA-MT 027300/D)  
**URL de Acesso:** [https://kytto.com.br/admin/concreto?secao=producao-laboratorio](https://kytto.com.br/admin/concreto?secao=producao-laboratorio)

---

## 1. Visão Geral da Entrega

Em atendimento à solicitação do cliente na seção `producao-laboratorio`, foi desenvolvida e integrada uma suíte completa de **Controle Tecnológico e Gestão de Laboratório de Concreto**, transformando a visualização estática anterior em um ambiente 100% operacional com recursos para:
* Visualização rica em alta densidade industrial com métricas e KPIs em tempo real.
* Cadastro e moldagem de novos lotes de Corpos de Prova (CPs).
* Edição completa de lotes existentes (cliente, obra, FCK especificado, slump test, cura, etc.).
* Lançamento e registro de ensaios de rompimento na prensa hidráulica com cálculo automático de tensão ($\sigma = \frac{F}{7,854}$ MPa) e classificação de fratura NBR 5739.
* Emissão e impressão oficial do **Laudo Tecnológico A4** com parecer conclusivo da RT.
* Exclusão segura de lotes com confirmação.

---

## 2. Normas Técnicas e Critérios Normativos Atendidos

1. **ABNT NBR 5738:** Moldagem e cura de corpos de prova cilíndricos ($10 \times 20\text{ cm}$) de concreto, com controle de câmara úmida ($\ge 95\%\text{ UR}$, $23 \pm 2^\circ\text{C}$) ou tanque de água saturada com cal.
2. **ABNT NBR 5739:** Ensaio de compressão axial de corpos de prova cilíndricos com taxa de carregamento controlada, leitura de carga em kN e classificação dos tipos de fratura (Cônica, Cônica-Cisalhada, Bipartida, Cisalhada e Colunar).
3. **ABNT NBR 12655:** Critérios de aceitação e controle estatístico de lotes de concreto, apuração do $f_{ck,\text{est}}$ aos 28 dias e validação da conformidade estrutural ($f_{ck,\text{est}} \ge f_{ck}$).
4. **ABNT NBR NM 67 / NBR 7223:** Determinação da consistência pelo abatimento do tronco de cone (*Slump Test*).

---

## 3. Arquitetura e Recursos Implementados

### 3.1. Painel de Indicadores e KPIs do Laboratório
* **Total de Lotes Monitorados:** Contagem em tempo real dos lotes cadastrados e seus respectivos CPs.
* **Corpos de Prova em Cura Normativa:** Destaque em âmbar para os CPs aguardando datas de ensaio aos 7 e 28 dias.
* **Corpos de Prova Rompidos:** Total de ensaios já executados na prensa hidráulica.
* **Taxa de Conformidade FCK:** Percentual de lotes cuja resistência estimada aos 28 dias atingiu ou superou o FCK de projeto.
* **Slump Médio Medido:** Aferição contínua da trabalhabilidade e consistência do concreto usinado entregue em obra.

### 3.2. Filtros e Pesquisa Dinâmica
* **Busca Rápida:** Filtro instantâneo por código de lote (ex: `CP-2026-088`), nome da obra ou construtora/cliente.
* **Filtro por Status:** Visualização por `Todos`, `Em Cura`, `Aprovados 28d` e `Divergentes`.
* **Filtro por Traço FCK:** Segmentação rápida por FCK 20, 25, 30, 35 e 40 MPa.

### 3.3. Formulários e Ações Operacionais (Modais)
* **Moldar Novo Lote de CPs:** Formulário completo para inclusão de lote com lote, cliente, obra, endereço, traço FCK, slump medido, tipo de cura climatizada, prensa hidráulica, operador laboratorista e notas técnicas. Geração automática dos 4 CPs padrão ($2 \times 7\text{d}$ e $2 \times 28\text{d}$).
* **Editar Lote:** Permite modificar qualquer informação do ensaio e salvar imediatamente.
* **Registrar Ruptura na Prensa:** Permite selecionar o CP específico (`CP-1` a `CP-4`), a idade (3d, 7d, 14d, 28d ou 63d), digitar a carga em kN com conversão automática instantânea para MPa ($\sigma = F / 7,854$), selecionar o tipo de fratura da NBR 5739 e recalcular o parecer da NBR 12655.
* **Excluir Lote:** Remoção com confirmação de segurança.
* **Laudo Oficial A4 para Impressão:** Geração de documento padronizado pronto para impressão ou geração de PDF com cabeçalho da Serrano Concreto, CNPJ, dados da obra, tabela de ensaios e assinaturas do Laboratorista e da RT Engª Karin Prestes (CREA-MT 027300/D).

---

## 4. Endpoints da API Disponibilizados

| Método | Endpoint HTTP | Descrição |
| :---: | :--- | :--- |
| `POST` | `/api/admin/concreto/ensaios` | Cadastra e molda novo lote de CPs. |
| `PUT` | `/api/admin/concreto/ensaios/:id` | Edita e atualiza os dados gerais do lote. |
| `DELETE` | `/api/admin/concreto/ensaios/:id` | Exclui lote de ensaio com integridade referencial. |
| `PUT` | `/api/admin/concreto/ensaios/:loteId/corpos-prova/:cpId` | Lança o rompimento de um CP na prensa e recalcula FCK. |
| `GET` | `/api/admin/concreto/ensaios/:loteId/laudo-imprimir` | Retorna o Laudo Técnico oficial em HTML diagramado A4. |
| `GET` | `/api/admin/concreto/ensaios/:lote/estatistica` | Apura o controle estatístico NBR 12655 do lote. |

---

## 5. Homologação e Testes Automatizados

* **Suíte de Testes:** `app/modules/concreto/laboratorio.test.js`
* **Testes Executados:** 22 testes unitários aprovados com 100% de sucesso.
* **Build do Frontend:** Compilação com Vite concluída sem erros (`dist/assets/ConcretoUsinaERP-*.js`).
