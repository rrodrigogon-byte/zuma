// Painel de retenção para o dono (item 4.4): alunos em risco hoje, funil da régua, receita
// recuperada por gatilho (conferível com os pagamentos), motivos de saída e churn mensal.
import { ErroDominio, exigirUuid } from '../acesso/banco.js';
import { instanteNoFuso } from '../acesso/regras.js';
import { obterConfig, hojeNoFuso } from './servico.js';

/** Intervalo [início, fim) de um mês AAAA-MM no fuso da academia. */
export function intervaloDoMes(mes, fuso) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) throw new ErroDominio('VALIDATION_ERROR', 'mes deve ser AAAA-MM');
  const [a, m] = mes.split('-').map(Number);
  const prox = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  return { de: instanteNoFuso(`${mes}-01`, '00:00', fuso), ate: instanteNoFuso(`${prox}-01`, '00:00', fuso) };
}
export function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export async function alunosEmRisco(db, empresaId, { agora = new Date(), limite = 50, minimo = 30 } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const { fuso } = await obterConfig(db, empresa);
  const r = await db.query(
    `SELECT s.customer_id, c.nome, c.telefone, s.risco, s.fatores, p.valor_mensal, p.nome AS plano,
            (SELECT MAX(d.enviado_em) FROM clube_retencao_disparos d WHERE d.empresa_id = s.empresa_id AND d.customer_id = s.customer_id) AS ultimo_contato
       FROM clube_retencao_score s
       JOIN commerce_customers c ON c.empresa_id = s.empresa_id AND c.id = s.customer_id
       LEFT JOIN acesso_matriculas m ON m.empresa_id = s.empresa_id AND m.customer_id = s.customer_id AND m.status = 'ativa'
       LEFT JOIN acesso_planos p ON p.id = m.plano_id
      WHERE s.empresa_id = $1 AND s.dia = $2 AND s.risco >= $3
      ORDER BY s.risco DESC, p.valor_mensal DESC NULLS LAST, c.nome LIMIT $4`,
    [empresa, hojeNoFuso(agora, fuso), minimo, Math.min(Math.max(Number(limite) || 50, 1), 500)],
  );
  return r.rows.map((x) => ({
    customerId: x.customer_id, nome: x.nome, telefone: x.telefone, risco: x.risco, fatores: x.fatores,
    plano: x.plano, valorMensal: x.valor_mensal == null ? null : Number(x.valor_mensal), ultimoContato: x.ultimo_contato,
  }));
}

/** Funil por gatilho: disparadas → respondidas → resolvidas, opt-outs e receita recuperada. */
export async function funil(db, empresaId, { mes }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const { fuso } = await obterConfig(db, empresa);
  const { de, ate } = intervaloDoMes(mes, fuso);
  const r = await db.query(
    `SELECT gatilho,
            COUNT(*) FILTER (WHERE status <> 'falhou')::int AS disparadas,
            COUNT(*) FILTER (WHERE status IN ('respondeu', 'resolvido', 'optout') OR respondido_em IS NOT NULL)::int AS respondidas,
            COUNT(*) FILTER (WHERE status = 'resolvido')::int AS resolvidas,
            COUNT(*) FILTER (WHERE status = 'optout')::int AS optouts,
            COUNT(*) FILTER (WHERE status = 'falhou')::int AS falhas,
            COALESCE(SUM(valor_recuperado), 0)::float AS recuperado
       FROM clube_retencao_disparos WHERE empresa_id = $1 AND enviado_em >= $2 AND enviado_em < $3
      GROUP BY gatilho ORDER BY recuperado DESC, disparadas DESC`,
    [empresa, de, ate],
  );
  const resultados = await db.query(
    `SELECT resultado, COUNT(*)::int AS n FROM clube_retencao_disparos
      WHERE empresa_id = $1 AND enviado_em >= $2 AND enviado_em < $3 AND resultado IS NOT NULL GROUP BY resultado ORDER BY n DESC`,
    [empresa, de, ate],
  );
  const total = r.rows.reduce((t, x) => ({
    disparadas: t.disparadas + x.disparadas, respondidas: t.respondidas + x.respondidas, resolvidas: t.resolvidas + x.resolvidas,
    optouts: t.optouts + x.optouts, recuperado: Math.round((t.recuperado + x.recuperado) * 100) / 100,
  }), { disparadas: 0, respondidas: 0, resolvidas: 0, optouts: 0, recuperado: 0 });
  return { mes, total, porGatilho: r.rows.map((x) => ({ ...x, recuperado: Math.round(x.recuperado * 100) / 100 })), resultados: resultados.rows };
}

export async function motivosDeSaida(db, empresaId, { mes }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const { fuso } = await obterConfig(db, empresa);
  const { de, ate } = intervaloDoMes(mes, fuso);
  const r = await db.query(
    `SELECT categoria, COUNT(*)::int AS n FROM clube_retencao_motivos
      WHERE empresa_id = $1 AND criado_em >= $2 AND criado_em < $3 GROUP BY categoria ORDER BY n DESC`,
    [empresa, de, ate],
  );
  return r.rows;
}

/**
 * Churn do mês = matrículas canceladas no mês ÷ matrículas ativas no 1º dia do mês.
 * (Congelada conta como ativa: o aluno não saiu.)
 */
export async function churn(db, empresaId, { mes }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const { fuso } = await obterConfig(db, empresa);
  const calcula = async (m) => {
    const { de, ate } = intervaloDoMes(m, fuso);
    const r = await db.query(
      `SELECT COUNT(*) FILTER (WHERE m.criado_em < $2 AND (m.cancelada_em IS NULL OR m.cancelada_em >= $2))::int AS base,
              COUNT(*) FILTER (WHERE m.cancelada_em >= $2 AND m.cancelada_em < $3)::int AS saidas,
              COUNT(*) FILTER (WHERE m.criado_em >= $2 AND m.criado_em < $3)::int AS entradas
         FROM acesso_matriculas m WHERE m.empresa_id = $1`,
      [empresa, de, ate],
    );
    const x = r.rows[0];
    return { mes: m, base: x.base, saidas: x.saidas, entradas: x.entradas, taxa: x.base ? Math.round((x.saidas / x.base) * 1000) / 10 : null };
  };
  const atual = await calcula(mes);
  const anterior = await calcula(mesAnterior(mes));
  return { atual, anterior, variacao: atual.taxa !== null && anterior.taxa !== null ? Math.round((atual.taxa - anterior.taxa) * 10) / 10 : null };
}

/** Lista de disparos recentes (auditoria do que a IA mandou). */
export async function disparosRecentes(db, empresaId, { limite = 100, customerId = null } = {}) {
  const r = await db.query(
    `SELECT d.id, d.customer_id, c.nome, d.gatilho, d.texto, d.status, d.resultado, d.valor_recuperado, d.enviado_em, d.respondido_em, d.resolvido_em, d.erro
       FROM clube_retencao_disparos d JOIN commerce_customers c ON c.empresa_id = d.empresa_id AND c.id = d.customer_id
      WHERE d.empresa_id = $1 AND ($2::uuid IS NULL OR d.customer_id = $2)
      ORDER BY d.enviado_em DESC LIMIT $3`,
    [exigirUuid(empresaId, 'empresa'), customerId ? exigirUuid(customerId, 'cliente') : null, Math.min(Math.max(Number(limite) || 100, 1), 500)],
  );
  return r.rows.map((x) => ({
    id: x.id, customerId: x.customer_id, nome: x.nome, gatilho: x.gatilho, texto: x.texto, status: x.status, resultado: x.resultado,
    valorRecuperado: x.valor_recuperado == null ? null : Number(x.valor_recuperado), enviadoEm: x.enviado_em,
    respondidoEm: x.respondido_em, resolvidoEm: x.resolvido_em, erro: x.erro,
  }));
}

export async function resumoPainel(db, empresaId, { mes, agora = new Date() }) {
  const [risco, f, motivos, c] = await Promise.all([
    alunosEmRisco(db, empresaId, { agora, limite: 20 }),
    funil(db, empresaId, { mes }),
    motivosDeSaida(db, empresaId, { mes }),
    churn(db, empresaId, { mes }),
  ]);
  return { mes, emRisco: risco, funil: f, motivos, churn: c };
}
