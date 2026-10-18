// Painel inicial do clube (/admin com a empresa de um clube): números do dia da própria empresa.
// Cada bloco é independente: se uma tabela ainda não existir num banco antigo, aquele número
// volta como null e o painel mostra "—", sem derrubar o resto.
import express from 'express';
import { exigirUuid, responderErro } from '../acesso/banco.js';
import { instanteNoFuso } from '../acesso/regras.js';
import * as quadras from '../quadras/servico.js';

const dataNoFuso = (d, fuso) => new Date(d).toLocaleDateString('en-CA', { timeZone: fuso });
const horaNoFuso = (d, fuso) => new Date(d).toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

async function seguro(fn) {
  try { return await fn(); } catch { return null; }
}

export async function resumoDoClube(db, empresaId, { agora = new Date() } = {}) {
  const empresa = exigirUuid(empresaId, 'empresa');
  const cfg = await seguro(() => quadras.obterConfig(db, empresa));
  const fuso = cfg?.fuso || 'America/Cuiaba';
  const hoje = dataNoFuso(agora, fuso);
  const inicioDia = instanteNoFuso(hoje, '00:00', fuso);
  const fimDia = new Date(inicioDia.getTime() + 86400000);
  const inicioMes = instanteNoFuso(`${hoje.slice(0, 8)}01`, '00:00', fuso);
  const q = (t, v) => db.query(t, v);

  // sem valores recebidos aqui: o painel abre com customers.read (recepção); dinheiro fica em Cobranças (payments.*)
  const [socios, entradas, aulas, pix, contratos, grade] = await Promise.all([
    seguro(async () => (await q(
      `SELECT COUNT(*) FILTER (WHERE m.status = 'ativa')::int AS ativos,
              COUNT(*) FILTER (WHERE m.status = 'congelada')::int AS congelados,
              COUNT(*) FILTER (WHERE m.status = 'ativa' AND (m.pago_ate + p.tolerancia_dias) < $2::date)::int AS inadimplentes,
              COUNT(*) FILTER (WHERE m.status = 'ativa' AND m.criado_em >= $3)::int AS novos_mes
         FROM acesso_matriculas m JOIN acesso_planos p ON p.id = m.plano_id WHERE m.empresa_id = $1`,
      [empresa, hoje, inicioMes],
    )).rows[0]),
    seguro(async () => (await q(
      `SELECT COUNT(*) FILTER (WHERE decisao = 'liberado')::int AS liberadas, COUNT(*) FILTER (WHERE decisao = 'negado')::int AS negadas
         FROM acesso_eventos WHERE empresa_id = $1 AND ocorrido_em >= $2 AND ocorrido_em < $3`,
      [empresa, inicioDia, fimDia],
    )).rows[0]),
    seguro(async () => (await q(
      `SELECT COUNT(DISTINCT o.id)::int AS aulas, COUNT(r.id) FILTER (WHERE r.status IN ('reservada', 'presente'))::int AS reservas
         FROM aulas_ocorrencias o LEFT JOIN aulas_reservas r ON r.ocorrencia_id = o.id
        WHERE o.empresa_id = $1 AND o.status = 'ativa' AND o.inicio >= $2 AND o.inicio < $3`,
      [empresa, inicioDia, fimDia],
    )).rows[0]),
    seguro(async () => (await q(
      // só Pix já enviados e ainda válidos: parcela futura de acordo (sem link) e Pix vencido não contam
      "SELECT COUNT(*)::int AS n FROM clube_cobrancas WHERE empresa_id = $1 AND status = 'pendente' AND token_hash IS NOT NULL AND expira_em > $2",
      [empresa, agora],
    )).rows[0]),
    seguro(async () => (await q(
      "SELECT COUNT(*)::int AS n FROM clube_contratos WHERE empresa_id = $1 AND status = 'enviado'",
      [empresa],
    )).rows[0]),
    seguro(() => quadras.grade(db, empresa, { data: hoje, agora })),
  ]);

  // próximas reservas de quadra de hoje, a partir de agora
  let proximas = [];
  if (grade) {
    const agoraHora = horaNoFuso(agora, fuso);
    proximas = grade.quadras
      .flatMap((qd) => qd.reservas.map((r) => ({ quadra: qd.nome, inicio: r.inicio, fim: r.fim, quem: r.nome || r.titulo || r.tipoRotulo, tipo: r.tipo })))
      .filter((r) => r.fim > agoraHora)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .slice(0, 8);
  }
  return {
    data: hoje,
    fuso,
    socios: socios && { ativos: socios.ativos, congelados: socios.congelados, inadimplentes: socios.inadimplentes, novosNoMes: socios.novos_mes },
    entradasHoje: entradas && { liberadas: entradas.liberadas, negadas: entradas.negadas },
    aulasHoje: aulas && { aulas: aulas.aulas, reservas: aulas.reservas },
    pixPendentes: pix && { quantidade: pix.n },
    contratosPendentes: contratos ? contratos.n : null,
    quadras: grade && {
      quantidade: grade.quadras.length,
      aberto: grade.aberto,
      faixas: grade.faixas,
      ocupacao: grade.ocupacao,
      proximas,
    },
  };
}

export function createPainelResumoRouter({ db, empresaDaRequisicao }) {
  const router = express.Router();
  router.get('/resumo', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(await resumoDoClube(db, await empresaDaRequisicao(req))); }
    catch (error) { responderErro(res, error); }
  });
  return router;
}
