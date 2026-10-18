// Liga o Clube à IA do WhatsApp do agro-open (core/whatsapp-ai-extensoes.js).
// A academia é a empresa da conversa; o aluno é o cadastro do Commerce com o telefone da conversa
// (telefone_normalizado, índice único por empresa). Nada vem de argumento escrito pelo modelo.
import { declaracoesClube } from './ferramentas-ia.js';
import { criarClientePadrao } from '../parceiros/servico.js';
import { transacao } from '../acesso/banco.js';
import * as aulas from '../aulas/servico.js';
import * as quadras from '../quadras/servico.js';
import { canonicalWhatsappPhone, phoneMatchKeySql } from '../../core/whatsapp-phone.js';

// Quem ainda não é aluno pode ver as vagas (sem virar cadastro) e, se pedir, deixar interesse:
// só aí vira cadastro do Commerce (lead). Minimização (LGPD): conversa não cria cadastro sozinha.
const FERRAMENTA_DE_INTERESSE = 'clube_registrar_interesse';

/** Telefone da conversa na forma canônica do WhatsApp (55 + DDD + número, com o 9º dígito). */
export function telefoneNormalizado(telefone) {
  return canonicalWhatsappPhone(telefone) || null;
}

/**
 * Aluno pelo telefone da conversa. O JID do WhatsApp pode vir sem o 9º dígito (12 dígitos) e o
 * cadastro com ele (13): compara pela chave DDD + 8 últimos dígitos, igual ao núcleo da IA.
 * Mais de um cadastro com a mesma chave: prefere o número idêntico; senão, não chuta.
 */
export async function clienteDaConversa(db, empresaId, telefone) {
  const fone = telefoneNormalizado(telefone);
  if (!empresaId || !fone) return null;
  const r = await db.query(
    `SELECT id, nome, telefone_normalizado FROM commerce_customers
      WHERE empresa_id = $1 AND NOT bloqueado AND telefone_normalizado IS NOT NULL
        AND ${phoneMatchKeySql('telefone_normalizado')} = ${phoneMatchKeySql('$2::text')}
      LIMIT 3`,
    [empresaId, fone],
  );
  const exato = r.rows.find((c) => canonicalWhatsappPhone(c.telefone_normalizado) === fone);
  if (exato) return exato;
  return r.rows.length === 1 ? r.rows[0] : null;
}

/** A academia usa o Clube quando tem plano de acesso ativo, turma ativa ou quadra ativa. */
export async function clubeAtivoNaEmpresa(db, empresaId) {
  if (!empresaId) return false;
  const r = await db.query(
    `SELECT EXISTS (SELECT 1 FROM acesso_planos WHERE empresa_id = $1 AND ativo)
         OR EXISTS (SELECT 1 FROM aulas_turmas WHERE empresa_id = $1 AND ativa) AS ativo`,
    [empresaId],
  );
  if (r.rows[0]?.ativo === true) return true;
  // quadras vêm da migration 080; sem a tabela (banco antigo), segue como antes
  return quadras.temQuadras(db, empresaId).catch(() => false);
}

const ORIENTACAO = [
  'Esta empresa é uma academia/clube.',
  'Para aulas, vagas, reservas, lista de espera, entrada na catraca, mensalidade, congelamento, contrato e QR de entrada, use as ferramentas clube_*.',
  'Para jogar (quadra de tênis, beach tennis, padel): clube_quadras_livres mostra os horários; confirme quadra, dia e hora com a pessoa e use clube_reservar_quadra.',
  'Nunca invente horário, vaga, valor ou situação do aluno: consulte a ferramenta.',
  'Assunto de saúde, reclamação ou pedido de cancelamento com conflito: clube_transferir_para_humano.',
  'Diária, upgrade ou plano só quando o aluno precisar para entrar ou perguntar; fale de forma direta (ex.: "Se quiser, libero uma diária."), sem "recomendo", "sugiro", "oferta" ou "promoção".',
].join(' ');

/**
 * Monta a extensão da IA para o Clube.
 * @param {object} o
 * @param {object} o.db           adaptador { query }
 * @param {object} o.integracao   retorno de montarClube (executarFerramenta, aoReceberMensagem)
 */
export function extensaoIaClube({ db, integracao }) {
  if (!integracao?.executarFerramenta) throw new Error('integração do Clube não montada');
  return {
    nome: 'clube',
    declaracoes: declaracoesClube,
    orientacao: ORIENTACAO,
    ativaPara: ({ empresaId }) => clubeAtivoNaEmpresa(db, empresaId),
    executar: async (contexto, nome, args) => {
      let cliente = await clienteDaConversa(db, contexto.empresaId, contexto.phone);
      if (!cliente && nome === 'clube_listar_vagas') {
        // vagas são públicas: responde sem cadastrar ninguém
        const fuso = (await db.query('SELECT fuso FROM aulas_turmas WHERE empresa_id = $1 AND ativa ORDER BY criado_em LIMIT 1', [contexto.empresaId])).rows[0]?.fuso || 'America/Cuiaba';
        const vagas = await aulas.listarVagas(db, contexto.empresaId, { dia: args?.dia, modalidade: args?.modalidade || '', agora: new Date(), fuso });
        return { ok: true, aulas: vagas.map((v) => ({ aula: v.rotulo, professor: v.professor, vagas: v.vagasAlunos })), observacao: 'Para reservar, a pessoa precisa ser aluna: ofereça registrar o interesse ou falar com a recepção.' };
      }
      if (!cliente && nome === 'clube_quadras_livres') {
        // horários livres são públicos (sem nomes de quem reservou); reservar pede cadastro de sócio
        let r;
        try {
          r = await quadras.horariosLivres(db, contexto.empresaId, {
            data: args?.dia, modalidade: quadras.normalizarModalidade(args?.modalidade), aPartirDe: args?.hora || '', duracaoMin: args?.duracao_min || null, agora: new Date(), respeitarAntecedencia: true,
          });
        } catch (error) {
          if (error?.code && error?.status) return { ok: false, erro: error.message };
          throw error;
        }
        return { ok: true, dia: r.diaRotulo, fechado: !r.aberto, horarios: r.horarios.map((h) => ({ hora: h.hora, quadras: h.quadras.map((q) => q.nome) })), observacao: 'Para reservar, a pessoa precisa ser sócia: ofereça registrar o interesse ou falar com a recepção.' };
      }
      if (!cliente && nome === FERRAMENTA_DE_INTERESSE && telefoneNormalizado(contexto.phone)) {
        const r = await transacao(db, (q) => criarClientePadrao(q, {
          empresaId: contexto.empresaId, nome: contexto.customerName || 'Interessado WhatsApp', telefone: telefoneNormalizado(contexto.phone), origem: 'clube_whatsapp',
        }));
        cliente = { id: r.id };
      }
      if (!cliente) {
        return { ok: false, erro: 'Este número não está no cadastro da academia. Peça o nome completo e ofereça falar com a recepção para a matrícula.' };
      }
      return integracao.executarFerramenta({ empresaId: contexto.empresaId, customerId: cliente.id }, nome, args);
    },
    aoReceber: async ({ empresaId, phone, text }) => {
      const cliente = await clienteDaConversa(db, empresaId, phone);
      if (!cliente) return;
      await integracao.aoReceberMensagem({ empresaId, customerId: cliente.id, texto: String(text || '') });
    },
  };
}
