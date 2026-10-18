// Operações que a IA executa na conversa de retenção (item 4.3) e que o painel também usa:
// frequência, financeiro, link de pagamento, acordo, congelamento, motivo de saída, nota,
// ocorrência para humano e interessados. Tudo com a identidade vinda da conversa autenticada.
import { ErroDominio, transacao, exigirUuid, exigirTexto, exigirData } from '../acesso/banco.js';
import * as acesso from '../acesso/repositorio.js';
import { obterConfig, hojeNoFuso, calcularDevido, linkDePagamento } from './servico.js';
import { diasEntre, somarDias } from './gatilhos.js';
import { formatarReais } from './textos.js';

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

async function matriculaVigente(q, empresa, cliente, { travar = false } = {}) {
  const r = await q(
    `SELECT m.id, m.status, m.pago_ate::text AS pago_ate, m.inicio::text AS inicio, m.fim_fidelidade::text AS fim_fidelidade,
            m.congelada_ate::text AS congelada_ate, p.nome AS plano, p.valor_mensal, p.congelamento_max_dias_ano, p.congelamento_min_dias
       FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id
      WHERE m.empresa_id = $1 AND m.customer_id = $2 AND m.status IN ('ativa', 'congelada')
      ORDER BY (m.status = 'ativa') DESC LIMIT 1 ${travar ? 'FOR UPDATE OF m' : ''}`,
    [empresa, cliente],
  );
  return r.rows[0] || null;
}

/* ------------------------------------------------------------------ */
/* Frequência                                                          */
/* ------------------------------------------------------------------ */

export async function consultarFrequencia(db, empresaId, customerId, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const { fuso } = await obterConfig(db, empresa);
  const r = await db.query(
    `SELECT to_char(MAX(ocorrido_em) AT TIME ZONE $3, 'YYYY-MM-DD') AS ultimo,
            COUNT(DISTINCT (ocorrido_em AT TIME ZONE $3)::date) FILTER (WHERE ocorrido_em > $4::timestamptz - interval '56 days')::int AS dias8,
            COUNT(DISTINCT (ocorrido_em AT TIME ZONE $3)::date) FILTER (WHERE ocorrido_em > $4::timestamptz - interval '28 days')::int AS dias4
       FROM acesso_eventos WHERE empresa_id = $1 AND customer_id = $2 AND decisao = 'liberado' AND ocorrido_em <= $4`,
    [empresa, cliente, fuso, agora],
  );
  const h = await db.query(
    `SELECT EXTRACT(HOUR FROM ocorrido_em AT TIME ZONE $3)::int AS hora, COUNT(*)::int AS n
       FROM acesso_eventos WHERE empresa_id = $1 AND customer_id = $2 AND decisao = 'liberado'
        AND ocorrido_em > $4::timestamptz - interval '56 days' AND ocorrido_em <= $4
      GROUP BY 1 ORDER BY n DESC, hora LIMIT 2`,
    [empresa, cliente, fuso, agora],
  );
  const x = r.rows[0];
  const hoje = hojeNoFuso(agora, fuso);
  return {
    ultimoAcesso: x.ultimo,
    diasSemTreinar: x.ultimo ? diasEntre(x.ultimo, hoje) : null,
    mediaSemanal8: Math.round((x.dias8 / 8) * 10) / 10,
    mediaSemanal4: Math.round((x.dias4 / 4) * 10) / 10,
    horariosHabituais: h.rows.map((y) => `${String(y.hora).padStart(2, '0')}h`),
  };
}

/* ------------------------------------------------------------------ */
/* Financeiro, link e acordo                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {object} opcoes.externo opcional: ({ empresaId, customerId }) => { parcelas: [{ vencimento, valor }], total }
 *   para usar a cobrança real do agro-open (crediário, gateway por empresa) em vez da estimativa pelo plano.
 */
export async function consultarFinanceiro(db, empresaId, customerId, { agora = new Date(), externo = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const cfg = await obterConfig(db, empresa);
  if (externo) {
    const e = await externo({ empresaId: empresa, customerId: cliente });
    if (e) return { fonte: 'cobranca', ...e };
  }
  const m = await matriculaVigente((t, v) => db.query(t, v), empresa, cliente);
  if (!m) return { fonte: 'plano', semMatricula: true };
  const hoje = hojeNoFuso(agora, cfg.fuso);
  const d = calcularDevido({
    pagoAte: m.pago_ate, valorMensal: m.valor_mensal == null ? null : Number(m.valor_mensal), hoje,
    multaPercentual: cfg.multaPercentual, jurosMesPercentual: cfg.jurosMesPercentual,
  });
  return {
    fonte: 'plano',
    plano: m.plano,
    pagoAte: m.pago_ate,
    proximoVencimento: d.diasAtraso ? null : somarDias(m.pago_ate, 1),
    valorMensal: m.valor_mensal == null ? null : Number(m.valor_mensal),
    ...d,
    regra: { multaPercentual: cfg.multaPercentual, jurosMesPercentual: cfg.jurosMesPercentual, acordoMaxParcelas: cfg.acordoMaxParcelas, acordoMaxDiasPromessa: cfg.acordoMaxDiasPromessa },
  };
}

export async function gerarLink(db, empresaId, customerId, { agora = new Date(), gerarLinkPagamento, externo = null, parcelas = 1 } = {}) {
  if (!gerarLinkPagamento) throw new ErroDominio('PAGAMENTO_INDISPONIVEL', 'Link de pagamento não está ativo nesta academia.', 503);
  const cfg = await obterConfig(db, empresaId);
  // parcelamento só até o limite da academia (o modelo ou a recepção não passam por cima)
  const n = Number(parcelas);
  if (!Number.isInteger(n) || n < 1 || n > cfg.acordoMaxParcelas) {
    throw new ErroDominio('FORA_DA_REGRA', `Parcelamento de 1 a ${cfg.acordoMaxParcelas} vezes nesta academia.`, 409);
  }
  parcelas = n;
  const fin = await consultarFinanceiro(db, empresaId, customerId, { agora, externo });
  const valor = fin.total || fin.valorMensal;
  if (!valor) throw new ErroDominio('SEM_VALOR', 'Não há valor em aberto nem mensalidade cadastrada para gerar o link.', 409);
  const link = await linkDePagamento(db, {
    empresaId, customerId, valor, parcelas, descricao: fin.diasAtraso ? 'Mensalidade em atraso' : 'Mensalidade', gerar: gerarLinkPagamento, agora,
  });
  if (!link) throw new ErroDominio('PAGAMENTO_INDISPONIVEL', 'Link de pagamento não está ativo nesta academia.', 503);
  return { link, valor, valorFormatado: formatarReais(valor), parcelas };
}

/**
 * Acordo dentro da regra da academia (parcelamento até N vezes ou promessa até N dias).
 * Fora da regra: não promete nada, abre ocorrência e devolve `humano: true`.
 */
export async function proporAcordo(db, empresaId, customerId, dados = {}, { agora = new Date(), gerarLinkPagamento = null, externo = null, notificarGestor = null } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const cfg = await obterConfig(db, empresa);
  const tipo = dados.tipo;
  if (!['parcelamento', 'promessa'].includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', 'tipo deve ser parcelamento ou promessa');
  const fin = await consultarFinanceiro(db, empresa, cliente, { agora, externo });
  if (!fin.diasAtraso && !fin.total) throw new ErroDominio('SEM_DEBITO', 'Não há valor em atraso para acordo.', 409);
  if (!fin.total) throw new ErroDominio('SEM_VALOR', 'Mensalidade sem valor cadastrado: passe para a recepção.', 409);
  const hoje = hojeNoFuso(agora, cfg.fuso);
  const parcelas = tipo === 'parcelamento' ? Number(dados.parcelas) : 1;
  const promessaAte = tipo === 'promessa' ? exigirData(dados.promessaAte, 'promessaAte') : null;
  const dentro = tipo === 'parcelamento'
    ? Number.isInteger(parcelas) && parcelas >= 2 && parcelas <= cfg.acordoMaxParcelas
    : diasEntre(hoje, promessaAte) >= 0 && diasEntre(hoje, promessaAte) <= cfg.acordoMaxDiasPromessa;
  if (!dentro) {
    const o = await abrirOcorrencia(db, empresa, cliente, {
      tipo: 'acordo',
      descricao: tipo === 'parcelamento'
        ? `Pediu parcelar ${formatarReais(fin.total)} em ${dados.parcelas}x (regra: até ${cfg.acordoMaxParcelas}x).`
        : `Pediu prazo até ${promessaAte} para ${formatarReais(fin.total)} (regra: até ${cfg.acordoMaxDiasPromessa} dias).`,
    }, { notificarGestor });
    return { humano: true, ocorrenciaId: o.id, regra: { acordoMaxParcelas: cfg.acordoMaxParcelas, acordoMaxDiasPromessa: cfg.acordoMaxDiasPromessa } };
  }
  let link = null;
  if (tipo === 'parcelamento') {
    if (!gerarLinkPagamento) throw new ErroDominio('PAGAMENTO_INDISPONIVEL', 'Parcelamento precisa do link de pagamento ativo.', 503);
    link = await gerarLinkPagamento({ empresaId: empresa, customerId: cliente, valor: fin.total, parcelas, descricao: `Acordo em ${parcelas}x`, origem: 'acordo' });
    if (!link) throw new ErroDominio('PAGAMENTO_INDISPONIVEL', 'Parcelamento precisa do link de pagamento ativo.', 503);
  }
  return transacao(db, async (q) => {
    const aberto = await q("SELECT id FROM clube_retencao_acordos WHERE empresa_id = $1 AND customer_id = $2 AND status = 'aberto' FOR UPDATE", [empresa, cliente]);
    if (aberto.rows[0]) throw new ErroDominio('ACORDO_ABERTO', 'Já existe um acordo em aberto para este aluno.', 409);
    const r = await q(
      `INSERT INTO clube_retencao_acordos (empresa_id, customer_id, tipo, valor_total, parcelas, promessa_ate, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [empresa, cliente, tipo, fin.total, parcelas, promessaAte, link],
    );
    if (promessaAte) {
      await q(
        `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, promessa_ate) VALUES ($1, $2, $3)
         ON CONFLICT (empresa_id, customer_id) DO UPDATE SET promessa_ate = EXCLUDED.promessa_ate`,
        [empresa, cliente, promessaAte],
      );
    }
    await q(
      `UPDATE clube_retencao_disparos SET status = 'resolvido', resultado = 'acordo', resolvido_em = $3
        WHERE id = (SELECT id FROM clube_retencao_disparos WHERE empresa_id = $1 AND customer_id = $2 AND gatilho = 'inadimplente'
                     AND status IN ('enviado', 'respondeu') ORDER BY enviado_em DESC LIMIT 1)`,
      [empresa, cliente, agora],
    );
    return { acordoId: r.rows[0].id, tipo, valor: fin.total, valorFormatado: formatarReais(fin.total), parcelas, promessaAte, link };
  });
}

/* ------------------------------------------------------------------ */
/* Congelamento                                                        */
/* ------------------------------------------------------------------ */

/**
 * Congela o plano dentro da regra (mínimo por vez e máximo por 12 meses, do plano).
 * Os dias congelados são devolvidos no "pago até" e na fidelidade, e a pessoa sai da catraca
 * até o fim do congelamento. Começo hoje ou em até 30 dias (a rotina aplica na data).
 */
export async function congelarPlano(db, empresaId, customerId, dados = {}, { agora = new Date(), origem = 'whatsapp' } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const cfg = await obterConfig(db, empresa);
  const hoje = hojeNoFuso(agora, cfg.fuso);
  const dias = Number(dados.dias);
  const inicio = dados.inicio ? exigirData(dados.inicio, 'inicio') : hoje;
  if (diasEntre(hoje, inicio) < 0 || diasEntre(hoje, inicio) > 30) throw new ErroDominio('VALIDATION_ERROR', 'O congelamento começa hoje ou em até 30 dias.');
  const r = await transacao(db, async (q) => {
    const m = await matriculaVigente(q, empresa, cliente, { travar: true });
    if (!m || m.status !== 'ativa') throw new ErroDominio('SEM_MATRICULA', 'Não há matrícula ativa para congelar.', 409);
    if (diasEntre(m.pago_ate, hoje) > 0) throw new ErroDominio('EM_ATRASO', 'Com mensalidade em atraso não dá para congelar; regularize primeiro.', 409);
    const usados = await q(
      `SELECT COALESCE(SUM(dias), 0)::int AS n FROM clube_congelamentos
        WHERE empresa_id = $1 AND matricula_id = $2 AND status <> 'cancelado' AND inicio > $3::date - 365`,
      [empresa, m.id, inicio],
    );
    const restante = m.congelamento_max_dias_ano - usados.rows[0].n;
    if (!Number.isInteger(dias) || dias < m.congelamento_min_dias || dias > restante) {
      throw new ErroDominio('FORA_DA_REGRA', restante < m.congelamento_min_dias
        ? 'O limite de congelamento dos últimos 12 meses já foi usado.'
        : `Pode congelar de ${m.congelamento_min_dias} a ${restante} dias.`, 409);
    }
    const futuro = await q("SELECT 1 FROM clube_congelamentos WHERE empresa_id = $1 AND matricula_id = $2 AND status = 'ativo'", [empresa, m.id]);
    if (futuro.rows[0]) throw new ErroDominio('JA_CONGELADO', 'Já existe um congelamento agendado ou em andamento.', 409);
    const fim = somarDias(inicio, dias - 1);
    const c = await q(
      `INSERT INTO clube_congelamentos (empresa_id, matricula_id, customer_id, inicio, fim, dias, origem, iniciado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $4::date <= $8::date THEN $9::timestamptz END) RETURNING id`,
      [empresa, m.id, cliente, inicio, fim, dias, origem, hoje, agora],
    );
    // devolve os dias: o aluno não perde o que pagou nem a fidelidade anda durante a pausa
    await q(
      `UPDATE acesso_matriculas SET pago_ate = pago_ate + $3::int,
              fim_fidelidade = CASE WHEN fim_fidelidade IS NULL THEN NULL ELSE fim_fidelidade + $3::int END,
              status = CASE WHEN $4::date <= $5::date THEN 'congelada' ELSE status END,
              congelada_ate = CASE WHEN $4::date <= $5::date THEN $6::date ELSE congelada_ate END,
              atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2`,
      [m.id, empresa, dias, inicio, hoje, fim],
    );
    await q(
      `UPDATE clube_retencao_disparos SET status = 'resolvido', resultado = 'congelou', resolvido_em = $3
        WHERE id = (SELECT id FROM clube_retencao_disparos WHERE empresa_id = $1 AND customer_id = $2
                     AND gatilho IN ('faltante_serio', 'faltante_leve', 'risco_cancelar') AND status IN ('enviado', 'respondeu')
                     ORDER BY enviado_em DESC LIMIT 1)`,
      [empresa, cliente, agora],
    );
    return { congelamentoId: c.rows[0].id, matriculaId: m.id, plano: m.plano, inicio, fim, dias, voltaEm: somarDias(fim, 1), restanteNoAno: restante - dias };
  });
  await acesso.sincronizarPessoa(db, empresa, cliente);
  return r;
}

/** Encerra antes da data (volta a treinar): devolve os dias não usados e reativa. */
export async function encerrarCongelamento(db, empresaId, congelamentoId, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await obterConfig(db, empresa);
  const hoje = hojeNoFuso(agora, cfg.fuso);
  const r = await transacao(db, async (q) => {
    const c = await q(
      "SELECT id, matricula_id, customer_id, inicio::text AS inicio, fim::text AS fim FROM clube_congelamentos WHERE empresa_id = $1 AND id = $2 AND status = 'ativo' FOR UPDATE",
      [empresa, exigirUuid(congelamentoId, 'congelamento')],
    );
    const x = c.rows[0];
    if (!x) throw new ErroDominio('NOT_FOUND', 'Congelamento ativo não encontrado', 404);
    const naoUsados = diasEntre(hoje, x.fim) + 1 - Math.max(0, diasEntre(hoje, x.inicio));
    const devolver = Math.max(0, Math.min(naoUsados, diasEntre(x.inicio, x.fim) + 1));
    await q(
      `UPDATE acesso_matriculas SET pago_ate = pago_ate - $3::int,
              fim_fidelidade = CASE WHEN fim_fidelidade IS NULL THEN NULL ELSE fim_fidelidade - $3::int END,
              status = CASE WHEN status = 'congelada' THEN 'ativa' ELSE status END, congelada_ate = NULL, atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1 AND empresa_id = $2`,
      [x.matricula_id, empresa, devolver],
    );
    await q(
      "UPDATE clube_congelamentos SET status = CASE WHEN $3::date <= inicio THEN 'cancelado' ELSE 'encerrado' END, fim = GREATEST(inicio, LEAST(fim, $3::date - 1)), dias = GREATEST(1, dias - $4::int) WHERE id = $1 AND empresa_id = $2",
      [x.id, empresa, hoje, devolver],
    );
    return { customerId: x.customer_id, diasDevolvidos: devolver };
  });
  await acesso.sincronizarPessoa(db, empresa, r.customerId);
  return r;
}

/** Encerra o congelamento ativo ou agendado do aluno (botão "Encerrar congelamento" da recepção). */
export async function encerrarCongelamentoDoAluno(db, empresaId, customerId, opcoes = {}) {
  const r = await db.query(
    "SELECT id FROM clube_congelamentos WHERE empresa_id = $1 AND customer_id = $2 AND status = 'ativo' ORDER BY inicio DESC LIMIT 1",
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente')],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Este aluno não tem congelamento ativo', 404);
  return encerrarCongelamento(db, empresaId, r.rows[0].id, opcoes);
}

/** Rotina: começa os congelamentos agendados e encerra os vencidos. */
export async function aplicarCongelamentos(db, { agora = new Date() } = {}) {
  const afetados = new Set();
  const r1 = await db.query(
    `WITH alvo AS (
       SELECT c.id, c.empresa_id, c.customer_id, c.matricula_id, c.fim
         FROM clube_congelamentos c LEFT JOIN clube_retencao_config cfg ON cfg.empresa_id = c.empresa_id
        WHERE c.status = 'ativo' AND c.iniciado_em IS NULL
          AND c.inicio <= (($1::timestamptz) AT TIME ZONE COALESCE(cfg.fuso, 'America/Cuiaba'))::date),
     marcados AS (UPDATE clube_congelamentos c SET iniciado_em = $1 FROM alvo WHERE c.id = alvo.id RETURNING c.matricula_id, c.fim)
     UPDATE acesso_matriculas m SET status = 'congelada', congelada_ate = marcados.fim, atualizado_em = CURRENT_TIMESTAMP
       FROM marcados WHERE m.id = marcados.matricula_id AND m.status = 'ativa'
     RETURNING m.empresa_id, m.customer_id`,
    [agora],
  );
  const r2 = await db.query(
    `WITH alvo AS (
       SELECT c.id, c.matricula_id FROM clube_congelamentos c LEFT JOIN clube_retencao_config cfg ON cfg.empresa_id = c.empresa_id
        WHERE c.status = 'ativo' AND c.fim < (($1::timestamptz) AT TIME ZONE COALESCE(cfg.fuso, 'America/Cuiaba'))::date),
     fim AS (UPDATE clube_congelamentos c SET status = 'encerrado' FROM alvo WHERE c.id = alvo.id RETURNING c.matricula_id)
     UPDATE acesso_matriculas m SET status = 'ativa', congelada_ate = NULL, atualizado_em = CURRENT_TIMESTAMP
       FROM fim WHERE m.id = fim.matricula_id AND m.status = 'congelada'
     RETURNING m.empresa_id, m.customer_id`,
    [agora],
  );
  for (const x of [...r1.rows, ...r2.rows]) afetados.add(`${x.empresa_id}|${x.customer_id}`);
  for (const k of afetados) {
    const [e, c] = k.split('|');
    await acesso.sincronizarPessoa(db, e, c);
  }
  return { iniciados: r1.rowCount, encerrados: r2.rowCount };
}

/* ------------------------------------------------------------------ */
/* Motivo de saída, nota, ocorrência, interessados                     */
/* ------------------------------------------------------------------ */

export const CATEGORIAS_MOTIVO = ['preco', 'horario', 'mudanca', 'saude', 'resultado', 'atendimento', 'estrutura', 'tempo', 'outro'];

export async function registrarMotivoSaida(db, empresaId, customerId, { categoria, detalhe = '' } = {}) {
  if (!CATEGORIAS_MOTIVO.includes(categoria)) throw new ErroDominio('VALIDATION_ERROR', `categoria deve ser: ${CATEGORIAS_MOTIVO.join(', ')}`);
  const r = await db.query(
    'INSERT INTO clube_retencao_motivos (empresa_id, customer_id, categoria, detalhe) VALUES ($1, $2, $3, $4) RETURNING id',
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente'), categoria, String(detalhe || '').slice(0, 300) || null],
  );
  return { registrado: true, id: Number(r.rows[0].id) };
}

/**
 * Ocorrência para humano. O gestor recebe aviso curto no WhatsApp (sem detalhe de saúde, que fica
 * só no painel). A régua pausa para o aluno enquanto a conversa vira atendimento.
 */
export async function abrirOcorrencia(db, empresaId, customerId, { tipo, descricao }, { notificarGestor = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const tipos = ['cancelamento', 'reclamacao', 'saude', 'nota_baixa', 'acordo', 'outro'];
  if (!tipos.includes(tipo)) throw new ErroDominio('VALIDATION_ERROR', `tipo deve ser: ${tipos.join(', ')}`);
  const texto = exigirTexto(descricao, 'descricao', { min: 3, max: 500 });
  const r = await db.query(
    'INSERT INTO clube_retencao_ocorrencias (empresa_id, customer_id, tipo, descricao) VALUES ($1, $2, $3, $4) RETURNING id, criado_em',
    [empresa, cliente, tipo, texto],
  );
  await db.query(
    `INSERT INTO clube_retencao_contatos (empresa_id, customer_id, ultima_resposta_em) VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET ultima_resposta_em = EXCLUDED.ultima_resposta_em`,
    [empresa, cliente, agora],
  );
  const protocolo = String(r.rows[0].id).slice(0, 8).toUpperCase();
  if (notificarGestor) {
    const c = await db.query('SELECT nome FROM commerce_customers WHERE empresa_id = $1 AND id = $2', [empresa, cliente]);
    const rotulo = { cancelamento: 'pedido de cancelamento', reclamacao: 'reclamação', saude: 'assunto de saúde', nota_baixa: 'nota baixa na pesquisa', acordo: 'acordo fora da regra', outro: 'atendimento' }[tipo];
    const resumo = tipo === 'saude' ? 'Detalhes no painel.' : texto.slice(0, 200);
    await notificarGestor({ empresaId: empresa, texto: `Kytto: ${c.rows[0]?.nome || 'aluno'} precisa de atendimento humano (${rotulo}). ${resumo} Protocolo ${protocolo}.` }).catch(() => {});
  }
  return { id: r.rows[0].id, protocolo };
}

export async function registrarNota(db, empresaId, customerId, { nota, comentario = '' } = {}, { notificarGestor = null, agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const n = Number(nota);
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new ErroDominio('VALIDATION_ERROR', 'nota deve ser de 0 a 10');
  await db.query(
    'INSERT INTO clube_retencao_notas (empresa_id, customer_id, nota, comentario, criado_em) VALUES ($1, $2, $3, $4, $5)',
    [empresa, cliente, n, String(comentario || '').slice(0, 500) || null, agora],
  );
  let ocorrencia = null;
  if (n <= 6) {
    ocorrencia = await abrirOcorrencia(db, empresa, cliente, {
      tipo: 'nota_baixa', descricao: `Nota ${n} na pesquisa da primeira semana.${comentario ? ` Comentário: ${String(comentario).slice(0, 300)}` : ''}`,
    }, { notificarGestor, agora });
  }
  return { registrada: true, ocorrencia };
}

export async function listarOcorrencias(db, empresaId, { status = 'abertas' } = {}) {
  const r = await db.query(
    `SELECT o.id, o.customer_id, c.nome, c.telefone, o.tipo, o.descricao, o.status, o.responsavel, o.criado_em, o.resolvido_em, o.solucao
       FROM clube_retencao_ocorrencias o JOIN commerce_customers c ON c.empresa_id = o.empresa_id AND c.id = o.customer_id
      WHERE o.empresa_id = $1 AND ($2 = 'todas' OR ($2 = 'abertas' AND o.status <> 'resolvida') OR o.status = $2)
      ORDER BY o.criado_em DESC LIMIT 200`,
    [exigirUuid(empresaId, 'empresa'), status],
  );
  return r.rows.map((x) => ({
    id: x.id, protocolo: String(x.id).slice(0, 8).toUpperCase(), customerId: x.customer_id, nome: x.nome, telefone: x.telefone,
    tipo: x.tipo, descricao: x.descricao, status: x.status, responsavel: x.responsavel, criadoEm: x.criado_em, resolvidoEm: x.resolvido_em, solucao: x.solucao,
  }));
}

export async function atualizarOcorrencia(db, empresaId, id, { status, responsavel, solucao } = {}) {
  if (!['aberta', 'em_andamento', 'resolvida'].includes(status)) throw new ErroDominio('VALIDATION_ERROR', 'status inválido');
  if (status === 'resolvida') exigirTexto(solucao, 'solucao', { min: 3, max: 500 });
  const r = await db.query(
    `UPDATE clube_retencao_ocorrencias SET status = $3, responsavel = COALESCE($4, responsavel), solucao = COALESCE($5, solucao),
            resolvido_em = CASE WHEN $3::varchar = 'resolvida' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE empresa_id = $1 AND id = $2 RETURNING id`,
    [exigirUuid(empresaId, 'empresa'), exigirUuid(id, 'ocorrência'), status, responsavel ? String(responsavel).slice(0, 120) : null, solucao ? String(solucao).slice(0, 500) : null],
  );
  if (!r.rows[0]) throw new ErroDominio('NOT_FOUND', 'Ocorrência não encontrada', 404);
  return { atualizada: true };
}

export async function registrarInteresse(db, empresaId, customerId, { origem = 'preco', interesse = '' } = {}) {
  const origens = ['visita', 'preco', 'experimental', 'indicacao', 'parceiro', 'outro'];
  if (!origens.includes(origem)) throw new ErroDominio('VALIDATION_ERROR', `origem deve ser: ${origens.join(', ')}`);
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const ativa = await db.query("SELECT 1 FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2 AND status IN ('ativa', 'congelada')", [empresa, cliente]);
  if (ativa.rows[0]) return { registrado: false, motivo: 'já é aluno' };
  const r = await db.query(
    `INSERT INTO clube_prospects (empresa_id, customer_id, origem, interesse) VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, customer_id) WHERE convertido_em IS NULL AND perdido_em IS NULL
     DO UPDATE SET interesse = COALESCE(EXCLUDED.interesse, clube_prospects.interesse) RETURNING id`,
    [empresa, cliente, origem, String(interesse || '').slice(0, 200) || null],
  );
  return { registrado: true, prospectId: r.rows[0].id };
}

/** Matrícula nova fecha o interessado em aberto (chamar ao criar matrícula). */
export async function converterInteressado(db, empresaId, customerId, agora = new Date()) {
  await db.query(
    'UPDATE clube_prospects SET convertido_em = $3 WHERE empresa_id = $1 AND customer_id = $2 AND convertido_em IS NULL AND perdido_em IS NULL',
    [empresaId, customerId, agora],
  );
}

/** Atualiza só os campos enviados (campo ausente mantém o valor; string vazia apaga). */
export async function salvarPerfil(db, empresaId, customerId, dados = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cliente = exigirUuid(customerId, 'cliente');
  const campo = (k, max) => (dados[k] === undefined ? undefined : (String(dados[k] ?? '').trim().slice(0, max) || null));
  const nasc = dados.dataNascimento === undefined ? undefined : (dados.dataNascimento ? exigirData(dados.dataNascimento, 'dataNascimento') : null);
  const objetivo = campo('objetivo', 200);
  const observacoes = campo('observacoes', 500);
  await db.query(
    `INSERT INTO clube_pessoas (empresa_id, customer_id, data_nascimento, objetivo, observacoes) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empresa_id, customer_id) DO UPDATE SET
       data_nascimento = CASE WHEN $6 THEN EXCLUDED.data_nascimento ELSE clube_pessoas.data_nascimento END,
       objetivo = CASE WHEN $7 THEN EXCLUDED.objetivo ELSE clube_pessoas.objetivo END,
       observacoes = CASE WHEN $8 THEN EXCLUDED.observacoes ELSE clube_pessoas.observacoes END,
       atualizado_em = CURRENT_TIMESTAMP`,
    [empresa, cliente, nasc ?? null, objetivo ?? null, observacoes ?? null, nasc !== undefined, objetivo !== undefined, observacoes !== undefined],
  );
  return obterPerfil(db, empresa, cliente);
}

export async function obterPerfil(db, empresaId, customerId) {
  const r = await db.query(
    'SELECT data_nascimento::text AS data_nascimento, objetivo, observacoes FROM clube_pessoas WHERE empresa_id = $1 AND customer_id = $2',
    [exigirUuid(empresaId, 'empresa'), exigirUuid(customerId, 'cliente')],
  );
  const x = r.rows[0] || {};
  return { dataNascimento: x.data_nascimento || null, objetivo: x.objetivo || null, observacoes: x.observacoes || null };
}

export { primeiroNome };
