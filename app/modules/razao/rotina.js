// Rotina periódica do backoffice: lê as fontes do razão (bar, clube, A2, loja online e o JSON
// liberado) e baixa o consumo de estoque das vendas pela ficha técnica, empresa por empresa,
// mesmo sem ninguém abrir o Financeiro ou o Estoque. Assim o DRE, o fechamento e o saldo de
// estoque não dependem de uma tela aberta.
//
// Uma execução por vez em todo o banco (vez gravada em sys_rotinas): com mais de uma instância, só uma lê.
import * as fontes from './fontes.js';
import { baixarConsumoDasVendas } from '../suprimentos/estoque.js';

const NOME = 'backoffice';
const VEZ_MINUTOS = 15;

/** Uma passada: devolve quantas empresas leu e os erros (por empresa e fonte), sem lançar. */
export async function executarRotina(db, { fonteJson = null, fuso = 'America/Cuiaba', razaoAtivo = () => false } = {}) {
  const resultado = { empresas: 0, erros: [], pulou: false };
  if (!(await db.query("SELECT to_regclass('sys_rotinas') AS t")).rows[0]?.t) return { ...resultado, pulou: true };
  await db.query('INSERT INTO sys_rotinas (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING', [NOME]);
  const vez = await db.query(`UPDATE sys_rotinas SET travada_ate = CURRENT_TIMESTAMP + make_interval(mins => $2) WHERE nome = $1 AND travada_ate < CURRENT_TIMESTAMP RETURNING nome`, [NOME, VEZ_MINUTOS]);
  if (!vez.rows[0]) return { ...resultado, pulou: true };
  try {
    const empresas = (await db.query("SELECT id FROM empresas e WHERE COALESCE((to_jsonb(e)->>'ativa')::boolean, (to_jsonb(e)->>'ativo')::boolean, true) ORDER BY id")).rows.map((r) => r.id);
    const temEstoque = Boolean((await db.query("SELECT to_regclass('est_itens') AS t")).rows[0]?.t);
    for (const empresa of empresas) {
      resultado.empresas += 1;
      if (razaoAtivo() === true) {
        for (const r of await fontes.sincronizarEmpresa(db, empresa, { fuso })) if (r.erro) resultado.erros.push({ empresa, fonte: r.fonte, erro: r.erro });
        try {
          const json = typeof fonteJson === 'function' ? await fonteJson(empresa) : null;
          if (json?.chaveLegada) await fontes.sincronizarJson(db, empresa, { ...json, fuso });
        } catch (error) { resultado.erros.push({ empresa, fonte: 'json', erro: String(error?.message || error).slice(0, 160) }); }
      }
      if (temEstoque) {
        try { await baixarConsumoDasVendas(db, empresa, { fuso }); }
        catch (error) { resultado.erros.push({ empresa, fonte: 'estoque', erro: String(error?.message || error).slice(0, 160) }); }
      }
    }
  } finally {
    await db.query("UPDATE sys_rotinas SET travada_ate = '-infinity', ultima_execucao = CURRENT_TIMESTAMP, ultimo_resultado = $2 WHERE nome = $1",
      [NOME, JSON.stringify({ empresas: resultado.empresas, erros: resultado.erros.slice(0, 20) })]).catch(() => {});
  }
  return resultado;
}

/** Liga a rotina a cada `minutos` (0 desliga). Devolve a função que para. */
export function iniciarRotina(db, { minutos = 5, ...opcoes } = {}) {
  const ms = Math.max(0, Number(minutos) || 0) * 60_000;
  if (!ms) return () => {};
  let rodando = false;
  const passo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await executarRotina(db, opcoes);
      if (r.erros.length) console.error('[backoffice] rotina:', r.erros.slice(0, 5).map((e) => `${e.fonte}: ${e.erro}`).join(' | '));
    } catch (error) {
      console.error('[backoffice] rotina falhou:', String(error?.message || error).slice(0, 200));
    } finally { rodando = false; }
  };
  const t = setInterval(passo, ms);
  t.unref?.();
  return () => clearInterval(t);
}
