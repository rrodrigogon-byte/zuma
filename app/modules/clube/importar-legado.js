// Importação de alunos de sistemas legados para o Clube, por empresa e idempotente.
// 1) Um adaptador por origem lê os dados antigos e devolve uma lista padronizada
//    (lerSociosTtc lê os sócios do JSON do TTC). Outras origens (planilha, outro sistema)
//    só precisam produzir o mesmo formato.
// 2) importarAlunos grava na empresa escolhida: cadastro pelo resolvedor do Commerce
//    (reaproveita por telefone/e-mail), plano de acesso, matrícula com o "pago até" e o de-para
//    em clube_importacoes. Sem `aplicar`, só mostra a prévia (nada é gravado).
import { ErroDominio, exigirUuid, transacao } from '../acesso/banco.js';
import * as acessoRepo from '../acesso/repositorio.js';
import { criarClientePadrao } from '../parceiros/servico.js';
import { normalizeBrazilianPhone } from '../../core/commerce-customer-identity.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Soma meses a AAAA-MM-DD sem transbordar (31/01 + 1 = 28/02). */
export function somarMeses(data, meses) {
  const [a, m, d] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
const menosUmDia = (data) => new Date(Date.parse(`${data}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

function telefoneValido(t) {
  if (!t) return null;
  try { return normalizeBrazilianPhone(t) ? String(t) : null; } catch { return null; }
}

/**
 * "Pago até" pelas faturas: o último vencimento pago cobre até a véspera do mês seguinte;
 * sem nada pago, vale até a véspera do 1º vencimento em aberto; sem faturas, a data de entrada.
 */
export function pagoAteDasFaturas(faturas = [], desde = null) {
  const validas = faturas.filter((f) => DATA.test(String(f.venc || '')));
  const pagas = validas.filter((f) => f.paga).map((f) => f.venc).sort();
  if (pagas.length) return menosUmDia(somarMeses(pagas.at(-1), 1));
  const abertas = validas.filter((f) => !f.paga).map((f) => f.venc).sort();
  if (abertas.length) return menosUmDia(abertas[0]);
  const d = String(desde || '').slice(0, 10);
  return DATA.test(d) ? d : null;
}

/**
 * Adaptador do TTC: db().socios (+ faturas), db().mensalidades (2º controle de cobrança),
 * db().planosAssinatura e os planos fixos SOCIO_PLANOS; telefone vem do usuário vinculado.
 */
export function lerSociosTtc(snapshot = {}, { planosFixos = [] } = {}) {
  const usuarios = snapshot.usuarios || [];
  const planosAssinatura = snapshot.planosAssinatura || [];
  const mensalidades = snapshot.mensalidades || [];
  const alunos = [];
  const avisos = [];
  for (const s of snapshot.socios || []) {
    const id = String(s.id ?? '').trim();
    if (!id || !String(s.nome || '').trim()) { avisos.push({ idOrigem: id || null, aviso: 'sócio sem id ou nome: ignorado' }); continue; }
    const usuario = usuarios.find((u) => (s.usuarioId && u.id == s.usuarioId) || (s.email && u.email && String(u.email).toLowerCase() === String(s.email).toLowerCase()));
    const telefone = telefoneValido(s.telefone) || telefoneValido(usuario?.telefone);
    const fixo = planosFixos.find((p) => p.id === s.plano);
    const assinatura = planosAssinatura.find((p) => (s.planoId && p.id == s.planoId) || (!s.planoId && p.nome === s.plano));
    const nomePlano = String(s.planoNome || fixo?.nome || assinatura?.nome || s.plano || '').trim();
    const valor = Number(s.valor ?? fixo?.valor ?? assinatura?.valor);
    const faturas = [
      ...(s.faturas || []).map((f) => ({ venc: f.venc, paga: f.status === 'paga' })),
      ...mensalidades.filter((m) => m.socioId == s.id).map((m) => ({ venc: m.vencimento, paga: m.status === 'pago' || m.status === 'paga' || Boolean(m.pagoEm) })),
    ];
    const problemas = [];
    if (!telefone) problemas.push('sem telefone (não recebe WhatsApp nem código do contrato)');
    if (!s.email && !telefone) problemas.push('sem contato: cadastro só com o nome');
    if (!nomePlano) problemas.push('sem plano');
    alunos.push({
      idOrigem: id,
      nome: String(s.nome).trim().slice(0, 240),
      email: s.email ? String(s.email).trim().toLowerCase() : null,
      telefone,
      plano: nomePlano ? { nome: nomePlano.slice(0, 120), valorMensal: Number.isFinite(valor) && valor > 0 ? valor : null } : null,
      inicio: DATA.test(String(s.desde || '').slice(0, 10)) ? String(s.desde).slice(0, 10) : null,
      pagoAte: pagoAteDasFaturas(faturas, s.desde),
      ativo: s.ativo !== false,
      problemas,
    });
  }
  return { alunos, avisos };
}

/**
 * Grava (ou só prevê) os alunos na empresa.
 * @returns {{ aplicado, resumo, planos, alunos }}
 */
export async function importarAlunos(db, empresaId, { origem, alunos = [], aplicar = false, agora = new Date() }) {
  const empresa = exigirUuid(empresaId, 'empresa');
  if (!/^[a-z0-9_]{3,40}$/.test(String(origem || ''))) throw new ErroDominio('VALIDATION_ERROR', 'origem inválida');
  if (!Array.isArray(alunos) || alunos.length > 5000) throw new ErroDominio('VALIDATION_ERROR', 'lista de alunos inválida (até 5000)');
  const hoje = agora.toISOString().slice(0, 10);

  const planosExistentes = new Map((await acessoRepo.listarPlanos(db, empresa)).map((p) => [p.nome.toLowerCase(), p]));
  const planos = new Map();
  for (const a of alunos) {
    if (!a.plano) continue;
    const chave = a.plano.nome.toLowerCase();
    if (!planos.has(chave)) planos.set(chave, { nome: a.plano.nome, valorMensal: a.plano.valorMensal, existente: planosExistentes.get(chave) || null });
  }
  const mapa = new Map((await db.query(
    'SELECT id_origem, customer_id, matricula_id FROM clube_importacoes WHERE empresa_id = $1 AND origem = $2', [empresa, origem],
  )).rows.map((r) => [r.id_origem, r]));

  const resumo = { total: alunos.length, novos: 0, jaImportados: 0, semMatricula: 0, inadimplentes: 0, comProblema: 0, planosNovos: 0, erros: 0 };
  for (const p of planos.values()) if (!p.existente) resumo.planosNovos += 1;
  const linhas = [];

  if (aplicar) {
    for (const p of planos.values()) {
      if (!p.existente) p.existente = await acessoRepo.salvarPlano(db, empresa, { nome: p.nome, valorMensal: p.valorMensal ?? undefined });
    }
  }

  for (const a of alunos) {
    const ja = mapa.get(a.idOrigem);
    const linha = {
      idOrigem: a.idOrigem, nome: a.nome, plano: a.plano?.nome || null, pagoAte: a.pagoAte,
      situacao: a.pagoAte && a.pagoAte < hoje ? 'inadimplente' : 'em_dia', acao: ja ? 'ja_importado' : 'criar', problemas: a.problemas || [],
    };
    if (linha.situacao === 'inadimplente') resumo.inadimplentes += 1;
    if (linha.problemas.length) resumo.comProblema += 1;
    if (ja) resumo.jaImportados += 1; else resumo.novos += 1;
    if (!a.plano || !a.pagoAte || !a.ativo) { resumo.semMatricula += 1; linha.matricula = false; }

    if (aplicar) {
      try {
        let customerId = ja?.customer_id;
        if (!customerId) {
          // dentro de transação: a trava do resolvedor do Commerce vale contra cadastros simultâneos
          const c = await transacao(db, (q) => criarClientePadrao(q, { empresaId: empresa, nome: a.nome, telefone: a.telefone, email: a.email, origem: `clube_import_${origem}`.slice(0, 40) }));
          customerId = c.id;
        }
        let matriculaId = ja?.matricula_id || null;
        if (a.plano && a.pagoAte && a.ativo) {
          const plano = planos.get(a.plano.nome.toLowerCase()).existente;
          if (matriculaId) {
            await acessoRepo.registrarPagamento(db, empresa, matriculaId, a.pagoAte).catch((e) => { if (e?.code !== 'NOT_FOUND') throw e; matriculaId = null; });
          }
          if (!matriculaId) {
            const ativa = await db.query("SELECT id FROM acesso_matriculas WHERE empresa_id = $1 AND customer_id = $2 AND status IN ('ativa', 'congelada')", [empresa, customerId]);
            if (ativa.rows[0]) {
              matriculaId = ativa.rows[0].id;
              await acessoRepo.registrarPagamento(db, empresa, matriculaId, a.pagoAte);
            } else {
              matriculaId = (await acessoRepo.criarMatricula(db, empresa, { customerId, planoId: plano.id, pagoAte: a.pagoAte, inicio: a.inicio || undefined })).id;
            }
          }
        }
        await db.query(
          `INSERT INTO clube_importacoes (empresa_id, origem, id_origem, customer_id, plano_id, matricula_id, detalhe)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           ON CONFLICT (empresa_id, origem, id_origem) DO UPDATE SET customer_id = EXCLUDED.customer_id, plano_id = EXCLUDED.plano_id,
             matricula_id = EXCLUDED.matricula_id, detalhe = EXCLUDED.detalhe, atualizado_em = CURRENT_TIMESTAMP`,
          [empresa, origem, a.idOrigem, customerId, a.plano ? planos.get(a.plano.nome.toLowerCase()).existente?.id || null : null, matriculaId,
            JSON.stringify({ pagoAte: a.pagoAte, problemas: linha.problemas })],
        );
        linha.customerId = customerId;
        linha.matriculaId = matriculaId;
      } catch (error) {
        resumo.erros += 1;
        linha.erro = String(error?.message || error).slice(0, 200);
      }
    }
    linhas.push(linha);
  }
  return {
    aplicado: Boolean(aplicar),
    resumo,
    planos: [...planos.values()].map((p) => ({ nome: p.nome, valorMensal: p.valorMensal, acao: p.existente ? 'usar_existente' : 'criar', id: p.existente?.id || null })),
    alunos: linhas,
  };
}
