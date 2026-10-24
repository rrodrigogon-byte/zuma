// Camada de NFC-e (Nota Fiscal de Consumidor eletrônica, modelo 65) — nota dos
// produtos do Bar/PDV. Provider-agnóstico: integra com um provedor de emissão
// (Focus NFe / PlugNotas / eNotas) quando há credenciais; sem isso, opera em
// MODO SIMULADO (autoriza com chave de acesso/protocolo fictícios) — mesmo padrão
// "simulado quando sem credencial" usado por Pix(MP)/e-mail/WhatsApp/TEF.
//
// Para produção é obrigatório (ver §1 da spec): certificado A1, credenciamento
// NFC-e na SEFAZ-MT + CSC, e a conta no provedor. Aqui o código fica pronto para
// plugar — basta configurar NFCE_PROVEDOR + NFCE_TOKEN (e o emitente/CSC na config).
import crypto from 'crypto';

const PROVEDOR     = (process.env.NFCE_PROVEDOR || '').toLowerCase(); // 'focus' | 'plugnotas' | ''
const NFCE_TOKEN   = process.env.NFCE_TOKEN || '';
const NFCE_BASEURL = process.env.NFCE_BASEURL || '';   // sobrescreve o endpoint do provedor
const NFCE_AMBIENTE= (process.env.NFCE_AMBIENTE || 'homologacao'); // homologacao | producao

export function nfceConfigurado() { return !!(PROVEDOR && NFCE_TOKEN); }

function chaveSimulada() { let s = ''; for (let i = 0; i < 44; i++) s += Math.floor(Math.random() * 10); return s; }
const protoSim = (p = 'SIM') => p + crypto.randomBytes(6).toString('hex').toUpperCase();

// Endpoints conhecidos dos provedores (referência; o adapter real usa estes).
const BASE = {
  focus:     amb => NFCE_BASEURL || (amb === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br'),
  plugnotas: ()  => NFCE_BASEURL || 'https://api.plugnotas.com.br',
};

/**
 * Emite uma NFC-e. Retorna sempre um objeto de resultado (nunca lança) — em erro
 * devolve status 'rejeitada'/'contingencia' para o chamador registrar e reprocessar.
 * @param {object} nota  { emitente, itens:[{nome,qtd,preco,fiscal}], pagamentos:[{meio,valor}], cpf, valorTotal, serie, numero, ambiente }
 */
export async function emitir(nota) {
  const ambiente = nota.ambiente || NFCE_AMBIENTE;
  try {
    if (nfceConfigurado()) {
      // ── Adapter real (exemplo Focus NFe) ──────────────────────────────────
      // Mantido enxuto e plugável; ativado quando NFCE_PROVEDOR + NFCE_TOKEN existem.
      if (PROVEDOR === 'focus') {
        const ref = 'NFCE' + (nota.refId || crypto.randomBytes(4).toString('hex'));
        const r = await fetch(`${BASE.focus(ambiente)}/v2/nfce?ref=${ref}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(NFCE_TOKEN + ':').toString('base64') },
          body: JSON.stringify(montarPayloadFocus(nota)),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return { status: 'rejeitada', ambiente, simulado: false, motivoRejeicao: d?.mensagem || `HTTP ${r.status}` };
        return {
          status: d.status === 'autorizado' ? 'autorizada' : (d.status === 'erro_autorizacao' ? 'rejeitada' : 'processando'),
          ambiente, simulado: false,
          chaveAcesso: d.chave_nfe || '', protocolo: d.protocolo || '',
          numero: d.numero || nota.numero, serie: d.serie || nota.serie,
          danfeUrl: d.caminho_danfe ? BASE.focus(ambiente) + d.caminho_danfe : null,
          xmlUrl: d.caminho_xml_nota_fiscal ? BASE.focus(ambiente) + d.caminho_xml_nota_fiscal : null,
          motivoRejeicao: d.mensagem_sefaz || '',
        };
      }
      // Outros provedores (plugnotas/enotas) entram aqui com o mesmo contrato de retorno.
    }

    // ── Modo simulado ──────────────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 250));
    const chave = chaveSimulada();
    return {
      status: 'autorizada', ambiente, simulado: true,
      chaveAcesso: chave, protocolo: protoSim(),
      numero: nota.numero, serie: nota.serie,
      danfeUrl: null, xmlUrl: null, motivoRejeicao: '',
      // QR em modo simulado aponta para o consultor da SEFAZ (apenas ilustrativo).
      qrConteudo: `https://dfe-portal.svrs.rs.gov.br/NFCe/QRCode?chNFe=${chave}&tpAmb=${ambiente === 'producao' ? 1 : 2}`,
    };
  } catch (e) {
    // Falha de rede/SEFAZ → contingência (emite e transmite depois).
    return { status: 'contingencia', ambiente, simulado: !nfceConfigurado(), motivoRejeicao: e.message || 'falha de comunicação' };
  }
}

/** Cancela uma NFC-e autorizada (dentro do prazo legal de 30 min). */
export async function cancelar(nota, justificativa = 'Cancelamento solicitado pelo emitente') {
  try {
    if (nfceConfigurado() && PROVEDOR === 'focus' && nota?.refId) {
      const r = await fetch(`${BASE.focus(nota.ambiente)}/v2/nfce/${encodeURIComponent('NFCE' + nota.refId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(NFCE_TOKEN + ':').toString('base64') },
        body: JSON.stringify({ justificativa }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { status: 'erro', motivoRejeicao: d?.mensagem || `HTTP ${r.status}` };
      return { status: 'cancelada', protocolo: d.protocolo || '' };
    }
    await new Promise(r => setTimeout(r, 150));
    return { status: 'cancelada', protocolo: protoSim('SIMCANC') };
  } catch (e) {
    return { status: 'erro', motivoRejeicao: e.message || 'falha ao cancelar' };
  }
}

// Monta o payload no formato Focus NFe (referência; expandir conforme necessidade fiscal).
function montarPayloadFocus(nota) {
  const e = nota.emitente || {};
  return {
    natureza_operacao: 'Venda ao consumidor',
    presenca_comprador: '1',
    modalidade_frete: '9',
    local_destino: '1',
    cnpj_emitente: e.cnpj,
    nome_emitente: e.nome,
    cpf_destinatario: nota.cpf || undefined,
    items: (nota.itens || []).map((it, i) => ({
      numero_item: String(i + 1),
      codigo_produto: String(it.produtoId || i + 1),
      descricao: it.nome,
      cfop: it.fiscal?.cfop || '5102',
      unidade_comercial: it.fiscal?.unidade || 'UN',
      quantidade_comercial: it.qtd,
      valor_unitario_comercial: it.preco,
      valor_bruto: +(it.preco * it.qtd).toFixed(2),
      ncm: it.fiscal?.ncm || '00000000',
      icms_origem: String(it.fiscal?.origem ?? 0),
      icms_situacao_tributaria: it.fiscal?.cstCsosn || '102',
    })),
    formas_pagamento: (nota.pagamentos || []).map(p => ({
      forma_pagamento: mapMeio(p.meio), valor_pagamento: p.valor,
    })),
  };
}
function mapMeio(meio) {
  return ({ dinheiro: '01', cartao: '03', tef: '03', pix: '17', carteira: '99' })[meio] || '99';
}
