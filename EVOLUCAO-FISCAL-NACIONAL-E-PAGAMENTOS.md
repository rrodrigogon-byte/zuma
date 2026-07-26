# SetPoint · Evolução Fiscal Nacional e Integração Multiadquirente
## Arquitetura para Bares em Escala Brasil com NFC-e por UF e Múltiplas Maquininhas

**Documento preparado por:** Manus AI  
**Data:** 26 de julho de 2026  
**Versão:** 2.0 (Escopo Nacional)  
**Status:** Pronto para implementação  

---

## 1. Sumário Executivo

O projeto **SetPoint** possui uma base sólida de comanda eletrônica, TEF simulado e NFC-e em modo homologação para Mato Grosso. O objetivo desta evolução é transformá-lo em uma **plataforma fiscal nacional** capaz de operar em qualquer UF do Brasil com:

1. **NFC-e homologada por UF** (não apenas MT) com suporte a múltiplas SEFAZ
2. **Contingência offline robusta** com fila de reprocessamento e sincronização
3. **Integração com Stone, Cielo, PagBank e Pix dinâmico** (não apenas simulado)
4. **Configuração multi-estabelecimento** (múltiplas filiais, cada uma com seu CNPJ/IE/série)
5. **Auditoria, reconciliação e compliance** para operação 24/7 sem perda de dados

Este documento detalha a arquitetura proposta, as decisões técnicas, o roadmap de 4 fases (6 semanas, 2-3 devs) e os requisitos de homologação por provedor.

---

## 2. Estado Atual da Plataforma (Auditoria)

### 2.1 Fluxo de Comanda Atual

**Rota principal:** `POST /api/comanda/:id/pagar` (linhas 1533–1569 de server.js)

```
Cliente paga comanda
    ↓
Garçom seleciona meio (dinheiro, tef, pix)
    ↓
TEF: agente local captura no navegador (web/src/lib/tef.js)
    → NSU, autorização, bandeira, comprovantes
    ↓
Backend registra TEF (registrarTef) → tefTransacoes[]
    ↓
NFC-e automática (se nfceAtiva=true)
    → montarNotaComanda() → notasFiscais[]
    → processarNfce() → emitir() em background
    ↓
Comanda fecha, pagamento registrado, nota em processamento
```

**Limitações identificadas:**
- **Configuração única:** um único contexto fiscal (CNPJ, IE, série) por instalação
- **TEF simulado:** sem integração real com Stone/Cielo/PagBank
- **NFC-e MT apenas:** hardcoded para Mato Grosso, sem suporte a outras UFs
- **Numeração centralizada:** série/número incrementa globalmente, sem isolamento por estabelecimento
- **Sem contingência estruturada:** rejeições/erros não reprocessam automaticamente
- **Sem reconciliação:** nenhum matching com extrato de adquirente

### 2.2 Estrutura de Configuração Atual

**CONFIG_DEFAULT (linhas 1635–1657):**

```javascript
tef: {
  ativo: false,
  adquirente: '',        // Stone | Cielo | PagBank
  terminal: '',          // ID do terminal
  ambiente: 'homologacao',
  agenteUrl: '',         // URL do agente TEF local
  maxParcelas: 12,
  parcelaSemJuros: 1,
  valorMinParcela: 20,
  imprimirComprovante: true
},
fiscal: {
  cnpj: '',
  ie: '',
  razaoSocial: '',
  regime: 'simples',
  ambiente: 'homologacao',
  cscId: '',
  csc: '',
  serie: 1,
  proximoNumero: 1,
  nfceAtiva: false,
  enviarEmail: true,
  enviarWhatsapp: false,
  padraoCategoria: {}
}
```

**Problema:** estrutura monolítica, sem suporte a múltiplos estabelecimentos ou adquirentes.

### 2.3 Fluxo NFC-e Atual

**Função montarNotaComanda (linhas 2309–2330):**
- Incrementa `proximoNumero` globalmente
- Usa CNPJ/IE/CSC da config única
- Não valida se SEFAZ é MT ou outra UF

**Função processarNfce (linhas 2333–2345):**
- Chama `nfceEmitir()` (app/nfce.js)
- Atualiza status (autorizada/rejeitada/contingencia)
- **Sem reprocessamento automático** se contingência

---

## 3. Requisitos Fiscais Nacionais

### 3.1 NFC-e por UF

**NFC-e (Nota Fiscal do Consumidor Eletrônica) — Modelo 65:**

| UF | SEFAZ | Status | Observações |
|---|---|---|---|
| **AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PE, PI, PR, RJ, RN, RS, RO, RR, SC, SP, SE, TO** | Unificada (SVRS) | ✅ Ativa | Maioria usa SVRS (Sefaz Virtual) |
| **SP** | SEFAZ-SP | ✅ Ativa | Pode usar SVRS ou próprio |
| **MG** | SEFAZ-MG | ✅ Ativa | Pode usar SVRS ou próprio |
| **BA** | SEFAZ-BA | ✅ Ativa | Pode usar SVRS ou próprio |

**Requisitos por UF:**
- **Certificado digital A1** (CNPJ do estabelecimento)
- **CSC (Código de Segurança da Contribuinte)** — fornecido pela SEFAZ
- **Ambiente:** homologação (teste) → produção (real)
- **Série/número:** sequencial por UF, pode ser compartilhado entre filiais do mesmo CNPJ

### 3.2 Contingência Offline

**Resolução 14/2023 (CONFAZ):** permite emissão em contingência quando SEFAZ cai.

- **Prazo:** até 24h offline
- **Reprocessamento:** ao voltar online, enviar para SEFAZ em até 30 dias
- **Documentação:** gerar DANFE local com indicação "EMITIDA EM CONTINGÊNCIA"

### 3.3 Integração com Adquirentes

| Adquirente | TEF | Pix | Parcelamento | Conciliação | Homologação |
|---|---|---|---|---|---|
| **Stone** | ✅ SDK | ✅ Dinâmico | ✅ Até 12x | ✅ API | 1–2 semanas |
| **Cielo** | ✅ SDK | ✅ Dinâmico | ✅ Até 12x | ✅ API | 2–3 semanas |
| **PagBank** | ⚠️ Limitado | ✅ Dinâmico | ✅ Até 12x | ✅ API | 1 semana |
| **Mercado Pago** | ❌ Não | ✅ Dinâmico | ✅ Até 12x | ✅ API | Imediato |

**Recomendação:** Stone (melhor cobertura) + Cielo (fallback) + Pix (universal).

---

## 4. Arquitetura Proposta

### 4.1 Modelo de Dados Expandido

#### Estabelecimentos (Multi-filial)

```javascript
// Novo: suportar múltiplas filiais
estabelecimentos: [
  {
    id: 'est-001',
    nome: 'Bar Centro',
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.012',
    razaoSocial: 'Bar Centro LTDA',
    endereco: { rua, numero, bairro, cidade, uf, cep },
    telefone: '65 3000-0000',
    email: 'bar@example.com',
    ativo: true,
    
    // Fiscal por estabelecimento
    fiscal: {
      regime: 'simples',        // simples | lucro_presumido | lucro_real
      cscId: '123456',
      csc: 'abc123def456',
      serieNfce: 1,
      proximoNumeroNfce: 1,
      ambiente: 'homologacao',  // homologacao | producao
      nfceAtiva: true,
      ufPrincipal: 'MT',        // UF para SEFAZ
      provedor: 'focus',        // focus | plugnotas | enotas
      certificadoA1: null       // referência ao arquivo/thumbprint
    },
    
    // TEF/Adquirentes por estabelecimento
    adquirentes: [
      {
        id: 'adq-stone-001',
        tipo: 'stone',
        ativo: true,
        terminal: 'TERM001',
        ambiente: 'producao',
        chaveApi: '***',         // armazenado seguro
        chaveSecreta: '***'
      },
      {
        id: 'adq-cielo-001',
        tipo: 'cielo',
        ativo: true,
        terminal: 'TERM002',
        ambiente: 'producao',
        merchantId: '***',
        chaveApi: '***'
      }
    ],
    
    // Pix por estabelecimento
    pix: {
      chave: 'cnpj',            // cpf | cnpj | email | telefone
      valor: '12.345.678/0001-90',
      nome: 'Bar Centro LTDA',
      ativo: true
    }
  }
]
```

#### Transações de Pagamento (Estrutura Expandida)

```javascript
pagamentos: [
  {
    id: 'pag-001',
    comandaId: 'cmd-001',
    estabelecimentoId: 'est-001',
    valor: 150.00,
    desconto: 0,
    servicoPercent: 10,
    valorFinal: 165.00,
    
    // Meio de pagamento
    meio: 'tef',               // tef | pix | dinheiro | carteira
    
    // TEF
    tef: {
      adquirenteId: 'adq-stone-001',
      nsu: '123456',
      autorizacao: 'ABC123',
      bandeira: 'VISA',
      modalidade: 'credito_avista',  // credito_avista | credito_parcelado | debito
      parcelas: 1,
      valorParcela: 165.00,
      comprovante: { cliente: '...', estabelecimento: '...' }
    },
    
    // Pix
    pix: {
      txid: 'abc123def456',
      brcode: '00020126...',
      qrCode: 'data:image/png;...',
      copiaCola: '00020126...',
      status: 'pendente'        // pendente | confirmado | expirado
    },
    
    // NFC-e associada
    notaFiscalId: 'nf-001',
    
    // Auditoria
    status: 'autorizado',       // pendente | autorizado | recusado | reembolsado
    criadoEm: '2026-07-26T10:00:00Z',
    autorizadoEm: '2026-07-26T10:00:05Z',
    operador: 'garcom-001',
    ipOrigem: '192.168.1.100',
    
    // Conciliação
    reconciliadoEm: null,
    extratoId: null             // referência ao extrato da adquirente
  }
]
```

#### NFC-e por UF (Estrutura Expandida)

```javascript
notasFiscais: [
  {
    id: 'nf-001',
    tipo: 'nfce',
    estabelecimentoId: 'est-001',
    comandaId: 'cmd-001',
    
    // Numeração por UF
    uf: 'MT',
    serie: 1,
    numero: 1001,
    chaveAcesso: '35260706123456780001650010000100101234567890',
    protocolo: '135260706123456789012345678901234567890123',
    
    // Dados fiscais
    emitente: { cnpj, razaoSocial, ie, endereco },
    consumidor: { cpf, nome },
    itens: [
      {
        codigo: 'PROD001',
        descricao: 'Cerveja Premium 350ml',
        ncm: '2203000000',
        cfop: '5102',
        quantidade: 1,
        unidade: 'UN',
        precoUnitario: 15.00,
        desconto: 0,
        valorTotal: 15.00,
        icms: { aliquota: 18, valor: 2.70 },
        pis: { aliquota: 1.65, valor: 0.25 },
        cofins: { aliquota: 7.6, valor: 1.14 }
      }
    ],
    pagamentos: [
      { meio: 'tef', valor: 150.00, bandeira: 'VISA' }
    ],
    valorTotal: 150.00,
    
    // Status
    status: 'autorizada',       // processando | autorizada | rejeitada | contingencia | cancelada
    motivoRejeicao: '',
    
    // URLs
    danfeUrl: 'https://...',
    xmlUrl: 'https://...',
    qrConteudo: 'https://dfe-portal.svrs.rs.gov.br/...',
    
    // Contingência
    emitidaEmContingencia: false,
    contingenciaAte: null,
    reprocessadaEm: null,
    
    // Cancelamento
    canceladaEm: null,
    motivoCancelamento: '',
    
    // Auditoria
    criadaEm: '2026-07-26T10:00:00Z',
    autorizadaEm: '2026-07-26T10:00:10Z',
    operador: 'garcom-001'
  }
]
```

### 4.2 Arquitetura de Integrações

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Comanda → Pagamento → NFC-e (UI unificada)        │   │
│  │  - Seletor de estabelecimento                       │   │
│  │  - Seletor de adquirente (Stone/Cielo/PagBank)    │   │
│  │  - Pix dinâmico com QR                             │   │
│  │  - Dinheiro + Serviço                              │   │
│  └─────────────────────────────────────────────────────┘   │
└────────┬──────────────────────────────────────────────┬─────┘
         │                                              │
    ┌────▼──────────────────────────────────────────────▼────┐
    │              API Express (Node.js)                     │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Camada de Negócio                             │   │
    │  │  - Comanda (abrir/fechar/divisão)             │   │
    │  │  - Pagamento (checkout, reembolso)            │   │
    │  │  - NFC-e (emitir, cancelar, reprocessar)      │   │
    │  │  - Estoque (bebidas, receitas, movimentação)  │   │
    │  └────────────────────────────────────────────────┘   │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Camada de Adaptadores (Padrão Strategy)       │   │
    │  │  ┌──────────────────────────────────────────┐ │   │
    │  │  │ Adaptador Fiscal (por UF)                │ │   │
    │  │  │ - Focus NFe (principal)                  │ │   │
    │  │  │ - PlugNotas (fallback)                   │ │   │
    │  │  │ - Contingência (buffer local)            │ │   │
    │  │  └──────────────────────────────────────────┘ │   │
    │  │  ┌──────────────────────────────────────────┐ │   │
    │  │  │ Adaptador de Pagamento (por adquirente)  │ │   │
    │  │  │ - Stone (TEF + Pix)                      │ │   │
    │  │  │ - Cielo (TEF + Pix)                      │ │   │
    │  │  │ - PagBank (Pix)                          │ │   │
    │  │  │ - Mercado Pago (Pix)                     │ │   │
    │  │  └──────────────────────────────────────────┘ │   │
    │  │  ┌──────────────────────────────────────────┐ │   │
    │  │  │ Fila de Reprocessamento                  │ │   │
    │  │  │ - Contingência NFC-e                     │ │   │
    │  │  │ - Pagamentos pendentes                   │ │   │
    │  │  │ - Reconciliação com extrato              │ │   │
    │  │  └──────────────────────────────────────────┘ │   │
    │  └────────────────────────────────────────────────┘   │
    │  ┌────────────────────────────────────────────────┐   │
    │  │  Auditoria & Compliance                        │   │
    │  │  - Log de todas as operações                   │   │
    │  │  - Rastreamento de pagamentos                  │   │
    │  │  - Reconciliação com adquirentes               │   │
    │  │  - LGPD & Conformidade                         │   │
    │  └────────────────────────────────────────────────┘   │
    └────┬──────────────────────────────────────────────┬────┘
         │                                              │
    ┌────▼──────────────────────┐  ┌─────────────────┐ │
    │  PostgreSQL (Produção)    │  │  GCS (Backups)  │ │
    │  - Estabelecimentos       │  │  - XML NFC-e    │ │
    │  - Pagamentos             │  │  - Logs         │ │
    │  - NFC-e                  │  │  - Backups      │ │
    │  - Auditoria              │  └─────────────────┘ │
    │  - Fila de reprocessamento│                       │
    └───────────────────────────┘                       │
                                                        │
    ┌────────────────────────────────────────────────────┘
    │
    ▼ (Integrações Externas)
  ┌─────────────────────────────────────────────────────┐
  │ Provedores Fiscais                                  │
  │ ├─ Focus NFe (principal)                           │
  │ ├─ PlugNotas (fallback)                            │
  │ └─ SEFAZ-MT / SVRS (autorização)                   │
  ├─────────────────────────────────────────────────────┤
  │ Adquirentes de Pagamento                            │
  │ ├─ Stone (TEF + Pix)                               │
  │ ├─ Cielo (TEF + Pix)                               │
  │ ├─ PagBank (Pix)                                   │
  │ └─ Mercado Pago (Pix)                              │
  ├─────────────────────────────────────────────────────┤
  │ Comunicação                                         │
  │ ├─ WhatsApp (notificações)                         │
  │ ├─ E-mail (comprovantes)                           │
  │ └─ SMS (alertas)                                   │
  └─────────────────────────────────────────────────────┘
```

### 4.3 Padrão Strategy para Adaptadores

```javascript
// Exemplo: Adaptador de Fiscal

class FiscalAdapter {
  constructor(tipo, config) {
    this.tipo = tipo;        // 'focus' | 'plugnotas' | 'enotas'
    this.config = config;    // { token, baseUrl, ambiente }
  }

  async emitir(nota) {
    // Implementação específica do provedor
    // Retorna: { status, chaveAcesso, protocolo, danfeUrl, ... }
  }

  async cancelar(notaId, justificativa) {
    // Cancelamento específico do provedor
  }

  async consultar(chaveAcesso) {
    // Consulta status da nota
  }
}

// Exemplo: Adaptador de Pagamento

class PagamentoAdapter {
  constructor(tipo, config) {
    this.tipo = tipo;        // 'stone' | 'cielo' | 'pagbank'
    this.config = config;    // { chaveApi, terminal, ... }
  }

  async autorizar(valor, modalidade, parcelas) {
    // Autorização específica do adquirente
    // Retorna: { nsu, autorizacao, bandeira, ... }
  }

  async reembolsar(nsu, valor) {
    // Reembolso específico
  }

  async reconciliar(dataInicio, dataFim) {
    // Extrato e reconciliação
  }
}
```

---

## 5. Roadmap de Implementação (4 Fases, 6 Semanas)

### Fase 1: Fundação Multi-Estabelecimento e Configuração (1.5 semanas)

**Objetivo:** Refatorar a estrutura de configuração para suportar múltiplos estabelecimentos e adquirentes.

**Tarefas:**
1. Migrar `db.js` para PostgreSQL (se ainda não feito)
2. Criar tabelas: `estabelecimentos`, `adquirentes`, `pagamentos_expandido`, `nfce_por_uf`
3. Refatorar `CONFIG_DEFAULT` → estrutura por estabelecimento
4. Criar rotas de CRUD de estabelecimentos (`/api/admin/estabelecimentos`)
5. Criar rotas de CRUD de adquirentes (`/api/admin/estabelecimentos/:id/adquirentes`)
6. Atualizar frontend (Configuracoes.jsx) com seletor de estabelecimento
7. Testes de integridade de dados

**Entregas:**
- Banco com suporte a múltiplos estabelecimentos
- UI de configuração multi-estabelecimento
- Testes de CRUD

**Esforço:** 60h (1.5 devs)

---

### Fase 2: Adaptadores Fiscais Nacionais (1.5 semanas)

**Objetivo:** Implementar suporte a NFC-e em todas as UFs com contingência offline.

**Tarefas:**
1. Criar `FiscalAdapter` (padrão Strategy)
2. Implementar adaptador Focus NFe (principal)
3. Implementar adaptador PlugNotas (fallback)
4. Criar tabela `nfce_buffer` para contingência
5. Implementar fila de reprocessamento (processarNfceBuffer)
6. Validação de UF e SEFAZ correto
7. Testes com SEFAZ-MT (homologação)
8. Documentação de setup por UF

**Entregas:**
- NFC-e emitindo em múltiplas UFs
- Contingência offline testada
- Fila de reprocessamento funcional

**Esforço:** 60h (1.5 devs)

---

### Fase 3: Adaptadores de Pagamento (1.5 semanas)

**Objetivo:** Integrar Stone, Cielo, PagBank e Pix dinâmico com suporte a fallback.

**Tarefas:**
1. Criar `PagamentoAdapter` (padrão Strategy)
2. Integrar Stone SDK (TEF + Pix)
3. Integrar Cielo SDK (TEF + Pix)
4. Integrar PagBank API (Pix)
5. Manter Mercado Pago (Pix) como fallback
6. Implementar seletor de adquirente no checkout
7. Testes com maquininhas reais (homologação)
8. Documentação de credenciais por adquirente

**Entregas:**
- Pagamento via Stone/Cielo/PagBank
- Pix dinâmico com QR por transação
- Seletor de adquirente no PDV

**Esforço:** 60h (1.5 devs)

---

### Fase 4: Auditoria, Reconciliação e Hardening (1.5 semanas)

**Objetivo:** Fortalecer contingência, auditoria e reconciliação com adquirentes.

**Tarefas:**
1. Expandir auditoria (log de todas as operações)
2. Implementar reconciliação com extrato de adquirente
3. Criar painel de reconciliação (admin)
4. Testes de falha de rede (offline → online)
5. Testes de rejeição e reprocessamento
6. Testes de carga (100+ transações/hora)
7. Documentação de operação 24/7
8. Plano de disaster recovery

**Entregas:**
- Auditoria completa e rastreável
- Reconciliação automática
- Painel de monitoramento

**Esforço:** 60h (1.5 devs)

---

## 6. Implementação Detalhada (Exemplos de Código)

### 6.1 Adaptador Fiscal (Focus NFe)

```javascript
// app/fiscal-adapters/focus-nfe.js

import crypto from 'crypto';

export class FocusNFeAdapter {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'https://homologacao.focusnfe.com.br';
    this.token = config.token;
    this.ambiente = config.ambiente || 'homologacao';
  }

  async emitir(nota) {
    const ref = 'NFCE' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    try {
      const response = await fetch(`${this.baseUrl}/v2/nfce?ref=${ref}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(this.token + ':').toString('base64')
        },
        body: JSON.stringify(this.montarPayload(nota))
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          status: 'rejeitada',
          ambiente: this.ambiente,
          simulado: false,
          motivoRejeicao: data.mensagem || `HTTP ${response.status}`
        };
      }

      return {
        status: data.status === 'autorizado' ? 'autorizada' : 'processando',
        ambiente: this.ambiente,
        simulado: false,
        chaveAcesso: data.chave_nfe || '',
        protocolo: data.protocolo || '',
        numero: data.numero || nota.numero,
        serie: data.serie || nota.serie,
        danfeUrl: data.caminho_danfe ? `${this.baseUrl}${data.caminho_danfe}` : null,
        xmlUrl: data.caminho_xml_nota_fiscal ? `${this.baseUrl}${data.caminho_xml_nota_fiscal}` : null,
        motivoRejeicao: data.mensagem_sefaz || ''
      };
    } catch (e) {
      return {
        status: 'contingencia',
        ambiente: this.ambiente,
        simulado: false,
        motivoRejeicao: e.message || 'Falha de comunicação'
      };
    }
  }

  montarPayload(nota) {
    // Montar payload Focus NFe conforme documentação
    return {
      natureza_operacao: 'VENDA',
      serie: nota.serie,
      numero_nf: nota.numero,
      data_emissao: new Date().toISOString(),
      tipo_documento: 'NFC-e',
      
      emitente: {
        cnpj: nota.emitente.cnpj.replace(/\D/g, ''),
        razao_social: nota.emitente.razaoSocial,
        nome_fantasia: nota.emitente.razaoSocial,
        inscricao_estadual: nota.emitente.ie.replace(/\D/g, ''),
        endereco: {
          logradouro: nota.emitente.endereco.rua,
          numero: nota.emitente.endereco.numero,
          bairro: nota.emitente.endereco.bairro,
          municipio: nota.emitente.endereco.cidade,
          uf: nota.emitente.endereco.uf,
          cep: nota.emitente.endereco.cep.replace(/\D/g, '')
        }
      },
      
      consumidor: nota.consumidor ? {
        tipo_documento: 'CPF',
        numero_documento: nota.consumidor.cpf.replace(/\D/g, ''),
        nome: nota.consumidor.nome
      } : undefined,
      
      itens: nota.itens.map(item => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade || 'UN',
        valor_unitario: item.precoUnitario,
        valor_total: item.valorTotal,
        ncm: item.ncm || '2203000000',
        cfop: item.cfop || '5102',
        icms: {
          origem: '0',
          cst: '00',
          aliquota: item.icms?.aliquota || 18,
          valor: item.icms?.valor || 0
        }
      })),
      
      pagamentos: nota.pagamentos.map(pag => ({
        meio: pag.meio === 'tef' ? '01' : pag.meio === 'pix' ? '26' : '01',
        valor: pag.valor
      })),
      
      valor_total: nota.valorTotal,
      valor_desconto: 0,
      valor_frete: 0,
      valor_seguro: 0,
      valor_outras_despesas: 0
    };
  }

  async cancelar(notaId, justificativa) {
    // Implementar cancelamento
    // POST /v2/nfce/{notaId}/cancelamento
  }

  async consultar(chaveAcesso) {
    // Implementar consulta de status
    // GET /v2/nfce/{chaveAcesso}
  }
}
```

### 6.2 Adaptador de Pagamento (Stone)

```javascript
// app/payment-adapters/stone.js

export class StoneAdapter {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.stone.com.br/v1';
    this.ambiente = config.ambiente || 'homologacao';
    this.terminal = config.terminal;
  }

  async autorizar(valor, modalidade, parcelas) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(valor * 100),
          payment_method: modalidade === 'debito' ? 'debit_card' : 'credit_card',
          installments: parcelas || 1,
          description: 'Comanda Bar',
          capture: true,
          customer: {
            name: 'Cliente'
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          status: 'recusado',
          erro: data.message || `HTTP ${response.status}`,
          nsu: null,
          autorizacao: null
        };
      }

      return {
        status: data.status === 'approved' ? 'autorizado' : 'pendente',
        nsu: data.id || '',
        autorizacao: data.authorization_code || '',
        bandeira: data.card?.brand || 'DESCONHECIDA',
        modalidade: modalidade,
        parcelas: parcelas || 1,
        transactionId: data.id,
        comprovante: {
          cliente: this.gerarComprovante(data, 'cliente'),
          estabelecimento: this.gerarComprovante(data, 'estabelecimento')
        }
      };
    } catch (e) {
      return {
        status: 'erro',
        erro: e.message,
        nsu: null,
        autorizacao: null
      };
    }
  }

  async reembolsar(transactionId, valor) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(valor * 100)
        })
      });

      const data = await response.json();
      return {
        status: data.status === 'approved' ? 'reembolsado' : 'pendente',
        refundId: data.id
      };
    } catch (e) {
      return { status: 'erro', erro: e.message };
    }
  }

  async reconciliar(dataInicio, dataFim) {
    // Implementar reconciliação com extrato
    // GET /v1/transactions?created_at_from=...&created_at_to=...
  }

  gerarComprovante(transacao, tipo) {
    // Gerar comprovante formatado para impressão
    return `
NSU: ${transacao.id}
Autorização: ${transacao.authorization_code}
Bandeira: ${transacao.card?.brand}
Valor: R$ ${(transacao.amount / 100).toFixed(2)}
Data: ${new Date().toLocaleString('pt-BR')}
    `.trim();
  }
}
```

### 6.3 Fila de Reprocessamento

```javascript
// app/fila-reprocessamento.js

export class FilaReprocessamento {
  constructor(db) {
    this.db = db;
    this.processando = false;
  }

  async adicionarNfce(notaId) {
    const fila = this.db().nfceBuffer || [];
    fila.push({
      id: Math.random().toString(36).substr(2, 9),
      notaId,
      tipo: 'nfce',
      tentativas: 0,
      maxTentativas: 3,
      criadoEm: new Date().toISOString(),
      ultimaTentativaEm: null,
      status: 'pendente'
    });
    this.db().nfceBuffer = fila;
  }

  async adicionarPagamento(pagamentoId) {
    const fila = this.db().pagamentoBuffer || [];
    fila.push({
      id: Math.random().toString(36).substr(2, 9),
      pagamentoId,
      tipo: 'pagamento',
      tentativas: 0,
      maxTentativas: 3,
      criadoEm: new Date().toISOString(),
      ultimaTentativaEm: null,
      status: 'pendente'
    });
    this.db().pagamentoBuffer = fila;
  }

  async processar() {
    if (this.processando) return;
    this.processando = true;

    try {
      const nfceBuffer = (this.db().nfceBuffer || []).filter(
        item => item.status === 'pendente' && item.tentativas < item.maxTentativas
      );

      for (const item of nfceBuffer) {
        try {
          const nota = (this.db().notasFiscais || []).find(n => n.id === item.notaId);
          if (!nota) continue;

          // Tentar reemitir
          const resultado = await emitirNfce(nota);

          if (resultado.status === 'autorizada') {
            Object.assign(nota, resultado);
            item.status = 'sucesso';
          } else if (resultado.status === 'contingencia') {
            item.tentativas++;
            item.ultimaTentativaEm = new Date().toISOString();
            // Manter na fila para próxima tentativa
          } else {
            item.status = 'erro';
            item.motivo = resultado.motivoRejeicao;
          }
        } catch (e) {
          item.tentativas++;
          item.ultimaTentativaEm = new Date().toISOString();
        }
      }

      // Limpar itens antigos (> 24h)
      const agora = new Date();
      this.db().nfceBuffer = (this.db().nfceBuffer || []).filter(item => {
        const criacao = new Date(item.criadoEm);
        return (agora - criacao) < 24 * 60 * 60 * 1000;
      });
    } finally {
      this.processando = false;
    }
  }

  iniciarProcessamento(intervaloMs = 30000) {
    setInterval(() => this.processar(), intervaloMs);
  }
}
```

---

## 7. Requisitos de Homologação

### 7.1 NFC-e (Focus NFe)

**Pré-requisitos:**
- Certificado digital A1 (CNPJ)
- CSC (Código de Segurança da Contribuinte) — solicitar na SEFAZ-MT
- Credenciais Focus NFe (token)

**Processo:**
1. Criar conta em https://focusnfe.com.br
2. Fazer login e solicitar credenciais de teste
3. Testar emissão em homologação (ambiente=homologacao)
4. Validar com SEFAZ-MT
5. Solicitar produção (ambiente=producao)
6. Testar com 10 notas reais
7. Publicar

**Tempo estimado:** 2–3 semanas

### 7.2 Stone (TEF + Pix)

**Pré-requisitos:**
- Conta Stone (https://stone.com.br)
- CNPJ do estabelecimento
- Chave API

**Processo:**
1. Criar conta e solicitar integração
2. Gerar chave API
3. Testar em homologação (ambiente=test)
4. Validar transações com maquininha
5. Solicitar produção
6. Testar com transações reais
7. Publicar

**Tempo estimado:** 1–2 semanas

### 7.3 Cielo (TEF + Pix)

**Pré-requisitos:**
- Conta Cielo (https://www.cielo.com.br)
- CNPJ e dados bancários
- Credenciais API

**Processo:**
1. Criar conta e solicitar integração
2. Gerar credenciais
3. Testar em homologação
4. Validar com maquininha
5. Solicitar produção
6. Testar com transações reais
7. Publicar

**Tempo estimado:** 2–3 semanas

---

## 8. Checklist de Implementação

- [ ] Fase 1: Multi-estabelecimento
  - [ ] Tabelas PostgreSQL criadas
  - [ ] CRUD de estabelecimentos
  - [ ] CRUD de adquirentes
  - [ ] UI de configuração
  - [ ] Testes de integridade

- [ ] Fase 2: Adaptadores Fiscais
  - [ ] FiscalAdapter (padrão Strategy)
  - [ ] Focus NFe integrado
  - [ ] PlugNotas integrado
  - [ ] Fila de contingência
  - [ ] Reprocessamento automático
  - [ ] Testes com SEFAZ-MT

- [ ] Fase 3: Adaptadores de Pagamento
  - [ ] PagamentoAdapter (padrão Strategy)
  - [ ] Stone integrado
  - [ ] Cielo integrado
  - [ ] PagBank integrado
  - [ ] Pix dinâmico
  - [ ] Seletor de adquirente
  - [ ] Testes com maquininhas

- [ ] Fase 4: Auditoria e Reconciliação
  - [ ] Auditoria expandida
  - [ ] Reconciliação com adquirente
  - [ ] Painel de monitoramento
  - [ ] Testes de falha/recuperação
  - [ ] Documentação operacional

---

## 9. Próximos Passos

1. **Validar requisitos:** revisar com stakeholders (donos de bar, contadores)
2. **Obter credenciais:** solicitar certificado A1, CSC, contas Focus/Stone/Cielo
3. **Iniciar Fase 1:** refatorar configuração para multi-estabelecimento
4. **Paralelizar Fase 2 + 3:** adaptadores fiscais e de pagamento
5. **Testar em homologação:** validar com SEFAZ-MT e adquirentes
6. **Publicar em produção:** deploy com monitoramento 24/7

---

**Documento preparado por:** Manus AI  
**Revisão:** Pendente de aprovação  
**Próxima atualização:** Após Fase 1
