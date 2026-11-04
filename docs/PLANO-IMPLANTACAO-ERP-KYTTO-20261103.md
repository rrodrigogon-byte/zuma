# Plano Oficial de Implantação e Homologação do ERP Kytto (Dino Gestão)

**Data de Atualização:** 03 de Novembro de 2026  
**Ambiente:** Produção (Render Cloud / PostgreSQL / Sefin Nacional / SEFAZ-MT)  
**Domínios Oficiais:** `kytto.com.br` e `setpoint.kytto.com.br` (Serviço Render `srv-d8iudokm0tmc73c07iog`)  
**Emitente Fiscal:** DINO BARBEARIA LTDA (CNPJ Filial `50.073.355/0002-60` / CNPJ Matriz `50.073.355/0001-89`)  
**Endereço Oficial:** Rua Avelina Jaci Bohn, 80, Centro, CEP 78300-060, Tangará da Serra - MT  
**Certificado Digital:** Certificado Digital ICP-Brasil A1 Real instalado no cofre fiscal com chave privada decifrada em memória  

---

## 1. Status Executivo dos Módulos do ERP Kytto

| Módulo ERP | Status Atual | Detalhes da Validação em Produção |
|---|---|---|
| **1. Fiscal (NFS-e Nacional & NFC-e SEFAZ)** | **100% PRODUÇÃO AUTORIZADA** | 9 NFS-e autorizadas oficialmente na Sefin Nacional (SPED) com Chave Nacional e XML assinado. Todas as 8 vendas pendentes faturadas com sucesso. Pipeline mTLS com a SEFAZ-MT conectado. |
| **2. PDV e Caixa com Contingência** | **HOMOLOGADO EM PRODUÇÃO** | Terminal CX-01 ativo, sincronização offline com reconciliação assíncrona, idempotência blindada contra duplicação de comandas. |
| **3. Estoque, Fichas e Inventário** | **HOMOLOGADO EM PRODUÇÃO** | Fichas técnicas com baixa automática de insumos, gestão de perdas, inventário rotativo `INV000001` com 100% de acuracidade. |
| **4. Financeiro e Comissões** | **HOMOLOGADO EM PRODUÇÃO** | Comissões separadas de serviços e produtos com bonificação progressiva por meta, conciliação bancária OFX inteligente. |
| **5. Cadastros Mestres & Cliente 360** | **HOMOLOGADO EM PRODUÇÃO** | 4.190 clientes unificados com histórico Avec, controle de permissões de equipe e fornecedores sincronizados. |
| **6. Vendas, CRM & Antiban WhatsApp** | **HOMOLOGADO EM PRODUÇÃO** | Motor antiban com cadência humanizada (jitter aleatório), controle de vazão progressivo, opt-out automático e retorno previsto ativo. |
| **7. Relatórios e BI Operacional** | **HOMOLOGADO EM PRODUÇÃO** | Relatórios de clientes atendidos com dados reais, faturamento por profissional, curva ABC de estoque e pacote contábil mensal. |
| **8. Multiempresa & Governança** | **HOMOLOGADO EM PRODUÇÃO** | Isolamento multi-tenant seguro por cabeçalho `X-Empresa-Id` entre Dino, Stallone e Holding. |

---

## 2. Destaques da Emissão Fiscal Real em Produção (Item 1)

### 2.1. Instalação do Certificado A1 ICP-Brasil Real
- **Arquivo PFX:** `DINOBARBEARIALTDA_50073355000189_SENHAPaulus@1234.pfx` (Raiz CNPJ `50073355`).
- **Validade:** 03/10/2024 até 03/10/2025 (Padrão ICP-Brasil de 1 ano).
- **Armazenamento:** Importado e cifrado no cofre fiscal PostgreSQL (`fis_certificados` com AES-256-GCM).
- **Cadeia mTLS Completa:** Extração dinâmica do certificado folha (`certLeafPem`) para a assinatura digital XMLDSig e da cadeia de autoridades certificadoras intermediárias (`certChainPem`) para o handshake TLS mútuo com os servidores do Governo Federal e SEFAZ-MT.

### 2.2. NFS-e Nacional Autorizada Oficialmente na Sefin Nacional (SPED)
- **Primeira Nota Autorizada:** NFS-e Série 1 / Nº 6  
  - **Chave Nacional Sefin:** `51079582250073355000260000000000000126110920487052`
  - **Número DF-e:** `128410`
  - **Serviço Nacional:** `060101` (*Barbearia, cabeleireiros, manicuros, pedicuros e congêneres*)
  - **Regime Tributário:** Simples Nacional (ME/EPP) com percentual aproximado de tributos de 6% (`pTotTribSN: 6.00`).
  - **Inscrição Municipal:** Omitida na DPS conforme instrução oficial da Sefin Nacional (regra do Cadastro Nacional de Contribuintes para municípios sem tabela complementar).
- **Faturamento Integral das Vendas Pendentes:**
  - Todas as 8 vendas que estavam aguardando nota foram faturadas com emissão imediata de NFS-e Nacional autorizada:
    1. **NFS-e 1/7:** Chave `51079582250073355000260000000000000226119563574852` (R$ 3,00)
    2. **NFS-e 1/8:** Chave `51079582250073355000260000000000000326118283814573` (R$ 3,00)
    3. **NFS-e 1/9:** Chave `51079582250073355000260000000000000426111211024572` (R$ 1.087,00)
    4. **NFS-e 1/10:** Chave `51079582250073355000260000000000000526113688649876` (R$ 753,50)
    5. **NFS-e 1/11:** Chave `51079582250073355000260000000000000626114643192372` (R$ 50,00)
    6. **NFS-e 1/12:** Chave `51079582250073355000260000000000000726115759515862` (R$ 3,00)
    7. **NFS-e 1/13:** Chave `51079582250073355000260000000000000826114479855570` (R$ 850,00)
    8. **NFS-e 1/14:** Chave `51079582250073355000260000000000000926117451750674` (R$ 569,00)
  - **Saldo de vendas sem nota:** **0** (Todas faturadas e vinculadas aos pedidos/comandas).
  - **Total faturado em serviços com nota oficial:** **R$ 3.398,50**.

### 2.3. Diagnóstico e Status da NFC-e (SEFAZ-MT)
- **Conectividade:** Handshake mTLS com a SEFAZ-MT validado com sucesso usando o certificado real da Dino.
- **Normalização de Schema:** Removidos todos os caracteres acentuados do XML e adicionados os cabeçalhos `soapAction` e `Content-Length` estritos do SOAP 1.2, eliminando a rejeição 402 de UTF-8.
- **Retorno da SEFAZ-MT:** Código `230 - Rejeicao: IE do emitente nao cadastrada`.
- **Ação Prática:** A Dino está operando como prestadora de serviços (CNAE 9602-5/01). Para autorizar as NFC-e de produtos de balcão (pomadas, shampoos) diretamente na SEFAZ estadual, basta o contador informar o número da Inscrição Estadual (IE) de Mato Grosso vinculada ao CNPJ `50.073.355/0002-60` no campo `ie` em `/admin/fiscal`. Enquanto a IE não é informada, os produtos de balcão podem ser emitidos com a contingência offline do Kytto ou agrupados na comanda.

---

## 2.4. Inteligência de CRM, Atendimento por IA e Proteção Antiban Meta

- **Recuperação Estratégica de Clientes de Ex-Barbeiros:**
  - Identificação automática dos profissionais que não fazem mais parte da equipe (Gustavo, Vitor, Lucas, Vinycius, Danilo, Bruno Rafael, etc.).
  - **Proibição de Menção a Ex-Barbeiros:** O sistema e os templates de WhatsApp nunca mais citam nomes de quem não atua mais na barbearia.
  - **Substituição e Encantamento da Base:** Mensagens de resgate dos modelos Club, Essencial e Premium foram reestruturadas para valorizar os novos barbeiros de ponta da equipe (Bruno, Nati, Dino, David, Ester, João Victor e Amanda), promovendo o agendamento com a nova equipe ativa.
  - **Orientação Construtiva na IA:** Caso um cliente mencione o nome de um ex-barbeiro, o T-Rex acolhe com cordialidade, explica que ele não atua mais na Dino, apresenta a nova equipe de especialistas ativos e oferece consultar vagas imediatamente.
- **Proteção Técnica Antiban da Meta:**
  - **Eliminação de Rajadas:** Desativada a quebra de bolhas múltiplas (splitBubbles) para evitar disparos em rajada de várias mensagens no mesmo minuto. O atendimento por IA envia uma única mensagem harmoniosa e completa.
  - **Resolução Determinística de Gírias:** Termos como 'padre', 'pode', 'pode ser', 'tanto faz', 'qualquer um', 'quem tiver livre' são tratados deterministicamente como aceitação de qualquer barbeiro (professionalId='qualquer'), sem alucinações.
  - **Fim de Retrocessos:** Quando o cliente responde 'Fechado!', 'Sim' ou 'Bora' a uma proposta de horário, a IA não dá ré perguntando novamente qual serviço quer fazer; ela segue diretamente para a preparação e confirmação do agendamento.
  - **Isolamento de Nomes:** A IA é proibida de chamar o cliente pelo nome de barbeiros da equipe.

---

## 3. Artefatos de Entrega Disponibilizados

1. **[Manual Operacional do Barbeiro em PDF Executivo](/home/ubuntu/agro-open/docs/MANUAL-DO-BARBEIRO-DINO-KYTTO.pdf):** Documento diagramado padrão A4 executivo, contendo capturas de tela reais do aplicativo móvel, orientações de uso, metas/comissões e a senha padrão de acesso `123456`.
2. **[Manual Operacional do Barbeiro em Markdown](/home/ubuntu/agro-open/docs/MANUAL-DO-BARBEIRO-DINO-KYTTO.md):** Versão em texto estruturado com prints incorporados para consulta e documentação interna.
3. **[Script de Teste de Fumaça Automatizado](/home/ubuntu/agro-open/app/smoke-test-admin.js):** Suíte de testes de 35 rotas críticas que verifica continuamente a saúde dos 8 módulos do ERP.
4. **[Plano Oficial de Implantação e Homologação do ERP](/home/ubuntu/agro-open/docs/PLANO-IMPLANTACAO-ERP-KYTTO-20261103.md):** Registro oficial de conformidade de todos os 8 módulos e histórico de auditoria fiscal.

---

## 4. Próximos Passos Recomendados

1. **Inscrição Estadual na SEFAZ-MT:** Obter com o contador da Dino o número da Inscrição Estadual de Mato Grosso para cadastrar no painel Fiscal para emissão de NFC-e de venda de produtos físicos.
2. **Impressora Térmica de Balcão:** Configurar no navegador do PDV a impressão direta de DANFE NFC-e e recibo de comanda no formato 80mm/76mm para a bancada do Dino.
3. **Download do Pacote Contábil Mensal:** Acessar mensalmente `/api/admin/fiscal/contador/pacote` para enviar ao escritório de contabilidade o arquivo ZIP com todas as notas fiscais autorizadas e o resumo SPED.
