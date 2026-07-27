#!/usr/bin/env node
/**
 * Processador transacional da fila omnichannel.
 *
 * O processo é executável em lote (`node ... --once`) para que possa ser
 * disparado por uma tarefa gerenciada em produção. Não mantém estado em memória
 * e usa `FOR UPDATE SKIP LOCKED`, o que permite concorrência segura entre
 * múltiplas execuções.
 */
import 'dotenv/config';
import crypto from 'crypto';
import * as dbPg from '../db-pg.js';

const MAX_TENTATIVAS = Math.max(1, Number.parseInt(process.env.OMNICHANNEL_MAX_TENTATIVAS || '8', 10));
const TAMANHO_LOTE = Math.min(100, Math.max(1, Number.parseInt(process.env.OMNICHANNEL_WORKER_LOTE || '20', 10)));
const TIMEOUT_MS = Math.min(60000, Math.max(2000, Number.parseInt(process.env.OMNICHANNEL_HTTP_TIMEOUT_MS || '15000', 10)));

function erroSeguro(erro) {
  const mensagem = erro instanceof Error ? erro.message : String(erro || 'Erro não identificado');
  return mensagem.slice(0, 1000);
}

function calcularAtrasoSegundos(tentativa) {
  // Backoff exponencial limitado a uma hora, com pequeno jitter determinístico.
  const base = Math.min(3600, 15 * (2 ** Math.max(0, tentativa - 1)));
  return base + Math.min(30, tentativa * 3);
}

function secretFromEnvironment(referencia) {
  if (!referencia) return null;
  const chave = String(referencia).replace(/^env:/i, '').trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(chave)) {
    throw new Error('Referência de credencial inválida; use apenas uma chave de ambiente permitida');
  }
  const valor = process.env[chave];
  if (!valor) throw new Error(`A credencial referenciada por ${chave} não está disponível no ambiente`);
  return valor;
}

function assinaturaHmac(payload, segredo) {
  return crypto.createHmac('sha256', segredo).update(JSON.stringify(payload)).digest('hex');
}

async function requisicaoExterna({ canal, acao, payload }) {
  // Canais internos não fazem tráfego externo e são confirmados de forma
  // determinística. Integrações de terceiros só são ativadas após configuração
  // explícita de endpoint e referência de segredo no ambiente de produção.
  if (['web', 'app', 'telefone', 'manual', 'outro'].includes(canal.provedor)) {
    return { codigo: 200, corpo: { processado_localmente: true, acao } };
  }

  if (!canal.api_base_url) {
    throw new Error('Canal externo não possui endpoint de API configurado');
  }

  const credencial = secretFromEnvironment(canal.credencial_referencia);
  const corpo = { acao, ...payload };
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (credencial) headers.authorization = `Bearer ${credencial}`;
  if (canal.algoritmo_assinatura === 'hmac_sha256' && credencial) {
    headers['x-kytto-signature'] = assinaturaHmac(corpo, credencial);
  }

  const resposta = await fetch(canal.api_base_url, {
    method: 'POST',
    headers,
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const texto = await resposta.text();
  let corpoResposta = texto;
  try { corpoResposta = texto ? JSON.parse(texto) : {}; } catch { /* resposta não JSON preservada como texto */ }
  if (!resposta.ok) {
    throw new Error(`Provedor respondeu HTTP ${resposta.status}: ${typeof corpoResposta === 'string' ? corpoResposta.slice(0, 300) : JSON.stringify(corpoResposta).slice(0, 300)}`);
  }
  return { codigo: resposta.status, corpo: corpoResposta };
}

async function reservarAcoes(limite) {
  const client = await dbPg.beginTransaction();
  try {
    const resultado = await dbPg.queryInTransaction(client, `
      WITH candidatas AS (
        SELECT a.id
          FROM acoes_externas_pedido a
         WHERE a.status IN ('pendente', 'falha')
           AND a.tentativas < $1
           AND (a.proxima_tentativa_em IS NULL OR a.proxima_tentativa_em <= CURRENT_TIMESTAMP)
         ORDER BY a.solicitado_em ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
      )
      UPDATE acoes_externas_pedido a
         SET status = 'processando',
             tentativas = a.tentativas + 1,
             erro = NULL
        FROM candidatas c
       WHERE a.id = c.id
      RETURNING a.*`, [MAX_TENTATIVAS, limite]);
    await dbPg.commit(client);
    return resultado.rows;
  } catch (erro) {
    await dbPg.rollback(client);
    throw erro;
  }
}

async function carregarCanal(canalId, empresaId, lojaId) {
  if (!canalId) return null;
  const resultado = await dbPg.query(
    `SELECT id, empresa_id, loja_id, provedor, status, algoritmo_assinatura,
            credencial_referencia, api_base_url, configuracao
       FROM canais_integracao
      WHERE id = $1 AND empresa_id = $2 AND loja_id = $3`,
    [canalId, empresaId, lojaId],
  );
  return resultado.rows[0] || null;
}

async function concluirAcao(acaoId, resposta) {
  await dbPg.query(
    `UPDATE acoes_externas_pedido
        SET status = 'concluida', resposta = $2::jsonb, erro = NULL,
            proxima_tentativa_em = NULL, concluido_em = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'processando'`,
    [acaoId, JSON.stringify(resposta)],
  );
}

async function reagendarAcao(acao, erro) {
  const esgotada = Number(acao.tentativas) >= MAX_TENTATIVAS;
  const atraso = calcularAtrasoSegundos(Number(acao.tentativas));
  await dbPg.query(
    `UPDATE acoes_externas_pedido
        SET status = 'falha',
            erro = $2,
            resposta = NULL,
            proxima_tentativa_em = CASE
              WHEN $3 THEN NULL
              ELSE CURRENT_TIMESTAMP + ($4::text || ' seconds')::interval
            END
      WHERE id = $1 AND status = 'processando'`,
    [acao.id, erroSeguro(erro), esgotada, atraso],
  );
}

async function processarAcao(acao) {
  const canal = await carregarCanal(acao.canal_id, acao.empresa_id, acao.loja_id);
  if (!canal || canal.status !== 'ativo') {
    throw new Error('Canal de integração indisponível ou não ativo');
  }

  const resposta = await requisicaoExterna({
    canal,
    acao: acao.acao,
    payload: {
      idempotency_key: acao.id,
      pedido_id: acao.pedido_id,
      empresa_id: acao.empresa_id,
      loja_id: acao.loja_id,
      ...acao.payload,
    },
  });

  await concluirAcao(acao.id, resposta);
  await dbPg.query(
    `UPDATE canais_integracao
        SET ultima_sincronizacao_em = CURRENT_TIMESTAMP,
            ultimo_erro = NULL,
            data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [canal.id],
  );
  return { id: acao.id, sucesso: true };
}

export async function executarLote({ limite = TAMANHO_LOTE } = {}) {
  const acoes = await reservarAcoes(limite);
  const resultado = { reservadas: acoes.length, concluidas: 0, falhas: 0, detalhes: [] };

  for (const acao of acoes) {
    try {
      const detalhe = await processarAcao(acao);
      resultado.concluidas += 1;
      resultado.detalhes.push(detalhe);
    } catch (erro) {
      resultado.falhas += 1;
      resultado.detalhes.push({ id: acao.id, sucesso: false, erro: erroSeguro(erro) });
      await reagendarAcao(acao, erro);
      if (acao.canal_id) {
        await dbPg.query(
          `UPDATE canais_integracao
              SET ultimo_erro = $2, data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = $1`,
          [acao.canal_id, erroSeguro(erro)],
        ).catch(() => null);
      }
    }
  }

  return resultado;
}

async function principal() {
  const resultado = await executarLote();
  console.log(JSON.stringify({ worker: 'omnichannel', ...resultado, executado_em: new Date().toISOString() }));
  process.exitCode = resultado.falhas > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((erro) => {
    console.error(JSON.stringify({ worker: 'omnichannel', erro: erroSeguro(erro) }));
    process.exitCode = 1;
  });
}
