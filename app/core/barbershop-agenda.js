// ============================================================================
// AGENDA ÚNICA DA BARBEARIA PARA A IA DO WHATSAPP
//
// A IA lia e gravava nas tabelas PostgreSQL `agendamentos`/`servicos`/`usuarios`,
// enquanto o admin, o link público e os lembretes usam a agenda da barbearia
// (barbearia-erp-kytto.js). Resultado: horário marcado pela IA não aparecia no
// admin e podia colidir com outro cliente.
//
// Este módulo escolhe a fonte pela empresa: se a empresa tem equipe ativa na
// agenda da barbearia, a IA usa ESSA agenda (mesma regra de conflito,
// calendário, jornada e lembretes). Empresas sem agenda da barbearia continuam
// no caminho PostgreSQL antigo, sem mudança.
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { db as pgDb } from './database.js';
import { db as legacyDb } from '../db.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { vincularClienteAoAtendimento } from '../dino-clientes-vinculo.js';
import * as clientesKytto from '../clientes-contas-kytto.js';
import { phoneMatchKey } from './whatsapp-phone.js';
import { cancelPendingAppointmentNotifications, queueAppointmentNotifications, queueWaitlistNotifications } from './barbershop-appointment-notifications.js';
import * as captacao from '../dino-captacao-kytto.js';
import { DINO_COMMERCE_EMPRESA_ID, DINO_COMMERCE_LOJA_ID, lojasEquivalentes } from './legacy-commerce-scope.js';
import {
  createScheduledAppointment as pgCreate,
  listSchedulingAvailability as pgAvailability,
  listSchedulingProfessionals as pgProfessionals,
  listSchedulingServices as pgServices,
  SchedulingError,
} from './barbershop-scheduling.js';
import { notificarEquipe } from '../dino-push-equipe.js';
import { matchAgendaName } from './whatsapp-ai-tools.js';
import {
  listWhatsappCustomerAppointments as pgCustomerAppointments,
  rescheduleWhatsappAppointment as pgReschedule,
  cancelWhatsappAppointment as pgCancel,
} from './whatsapp-ai-crm.js';

export { SchedulingError };

const ATIVOS = new Set(['agendado', 'confirmado']);

function limpo(valor, limite = 160) {
  return String(valor ?? '').trim().slice(0, limite);
}

/** Chave da empresa na agenda da barbearia (o mesmo UUID do Commerce). */
function chaveEmpresa(scope = {}) {
  return limpo(scope.legacyEmpresaId || scope.empresaId, 120);
}

function chaveUnidade(scope = {}) {
  return limpo(scope.lojaId, 120);
}

function instanteAgendamento(item) {
  if (item?.dataAgenda && item?.horaLocal) {
    const dataAgenda = String(item.dataAgenda).slice(0, 10);
    const horaLocal = String(item.horaLocal).slice(0, 5);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataAgenda) && /^\d{2}:\d{2}$/.test(horaLocal)) {
      return new Date(`${dataAgenda}T${horaLocal}:00-04:00`).valueOf();
    }
  }
  const raw = String(item?.dataHora || '');
  if (/Z|[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw).valueOf();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    return new Date(`${raw.replace(' ', 'T').slice(0, 19)}-04:00`).valueOf();
  }
  return new Date(raw).valueOf();
}

function exigirEscopoOperacional(scope = {}, input = {}, exigirServico = false) {
  const empresa = chaveEmpresa(scope);
  const loja = chaveUnidade(scope);
  const servico = limpo(input.serviceId ?? input.servicoId, 120);
  if (!empresa || !loja || (exigirServico && !servico)) {
    throw new SchedulingError('empresaId, lojaId e servicoId são obrigatórios para a operação da agenda', 'AGENDA_SCOPE_REQUIRED');
  }
  return { empresa, loja, servico };
}

function duracaoDoServico(empresa, servicoId) {
  return Number(barbearia.listarServicos(empresa, { incluirInativos: true }).find((item) => item.id === String(servicoId))?.duracaoMinutos || 30);
}

function temEquipeNaAgendaDaBarbearia(scope) {
  const chave = chaveEmpresa(scope);
  try {
    const profs = barbearia.listarProfissionais(chave, { incluirInativos: false });
    if (Array.isArray(profs) && profs.length > 0) return true;
  } catch {}
  try {
    const profsDino = barbearia.listarProfissionais(DINO_COMMERCE_EMPRESA_ID, { incluirInativos: false });
    if (Array.isArray(profsDino) && profsDino.length > 0) return true;
  } catch {}
  const estado = legacyDb().barbearias?.[chave] || legacyDb().barbearias?.[chave?.toLowerCase?.()];
  return Object.values(estado?.profissionais || {}).some((item) => item && item.ativo !== false);
}

const fonteCache = new Map();

function haReservaJsonNaUnidade(scope) {
  const unidade = chaveUnidade(scope);
  return barbearia.listarAgendamentos(chaveEmpresa(scope), {}).some(item => {
    if (String(item.lojaId || '') !== unidade || ['cancelado', 'nao_compareceu', 'concluido'].includes(item.status)) return false;
    const inicio = new Date(item.dataHora).valueOf();
    const duracao = Math.max(1, Number(item.duracaoMinutos) || 30) * 60000;
    return !Number.isFinite(inicio) || inicio + duracao >= Date.now();
  });
}

function conferirFontePgSemConflito(scope) {
  if (haReservaJsonNaUnidade(scope)) throw new SchedulingError('as fontes da agenda exigem conciliação nesta unidade; nenhum horário foi criado', 'AGENDA_SOURCE_CONFLICT');
}

/** Decide a fonte estrita por unidade sem converter ausência de dados em fonte conhecida. */
export function resolveStrictAgendaSource({
  mappingValid = false, forced = '', hasLegacyRows = false, hasLegacyFuture = false,
  hasPostgresFuture = false, hasPostgresRows = false,
} = {}) {
  if (forced === 'postgres') return 'postgres';
  if (!mappingValid) return forced === 'barbearia' ? 'indisponivel' : 'postgres';
  if (forced === 'barbearia') return hasLegacyRows ? 'barbearia' : 'indisponivel';
  if (hasPostgresFuture && hasLegacyFuture) return 'conflito';
  if (hasPostgresFuture) return 'postgres';
  if (hasLegacyRows) return 'barbearia';
  if (hasPostgresRows) return 'postgres';
  return 'indisponivel';
}

async function agendaSourceDaUnidade(scope, forced) {
  const empresa = chaveEmpresa(scope);
  const unidade = chaveUnidade(scope);
  const legacyEmpresa = limpo(scope.legacyEmpresaId, 120);
  const legacyUnidade = limpo(scope.legacyLojaId, 120);
  const mappingValid = Boolean(empresa && unidade && legacyEmpresa && legacyUnidade
    && empresa === legacyEmpresa && unidade === legacyUnidade);
  if (!mappingValid) return resolveStrictAgendaSource({ mappingValid: false, forced });
  if (forced === 'postgres') return 'postgres';

  const legacyRows = barbearia.listarAgendamentos(legacyEmpresa, {})
    .filter((item) => String(item.lojaId || '') === legacyUnidade);
  if (forced === 'barbearia') return resolveStrictAgendaSource({ mappingValid, forced, hasLegacyRows: legacyRows.length > 0 });
  const result = await pgDb.queryRead(
    `SELECT EXISTS (
              SELECT 1 FROM agendamentos
               WHERE empresa_id = $1 AND loja_id = $2 AND data_agendamento >= CURRENT_TIMESTAMP
                 AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
            ) AS has_future,
            EXISTS (SELECT 1 FROM agendamentos WHERE empresa_id = $1 AND loja_id = $2) AS has_rows`,
    [empresa, unidade],
  );
  if (!Array.isArray(result?.rows) || !result.rows[0]) throw new SchedulingError('leitura da fonte incompleta', 'AGENDA_SOURCE_UNVERIFIABLE');
  const hasPostgresFuture = result.rows[0].has_future === true || result.rows[0].has_future === 't';
  const hasPostgresRows = result.rows[0].has_rows === true || result.rows[0].has_rows === 't';
  const source = resolveStrictAgendaSource({
    mappingValid, hasLegacyRows: legacyRows.length > 0,
    hasLegacyFuture: haReservaJsonNaUnidade(scope), hasPostgresFuture, hasPostgresRows,
  });
  if (source === 'conflito') throw new SchedulingError('as fontes da agenda exigem conciliação nesta unidade; nenhum horário foi criado', 'AGENDA_SOURCE_CONFLICT');
  return source;
}

/**
 * Fonte da agenda da IA para a empresa:
 * - BARBEARIA_AGENDA_FONTE=barbearia|postgres força a fonte (operação);
 * - com equipe na agenda da barbearia e SEM agendamentos futuros no PostgreSQL,
 *   usa a agenda da barbearia (a do admin e do link público);
 * - se ainda há agendamentos futuros no PostgreSQL, continua nele até acabarem,
 *   para não esconder horários já marcados nem permitir dupla reserva.
 */
export async function agendaSource(scope = {}, { strictStoreMapping = false } = {}) {
  const forcada = String(process.env.BARBEARIA_AGENDA_FONTE || '').trim().toLowerCase();
  if (strictStoreMapping) return agendaSourceDaUnidade(scope, forcada === 'barbearia' || forcada === 'postgres' ? forcada : '');
  if (forcada === 'barbearia' || forcada === 'postgres') return forcada;
  const empresa = chaveEmpresa(scope);
  const unidade = chaveUnidade(scope);
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp-kytto-001', 'dino'].includes(String(empresa || '').toLowerCase())
    || empresa === DINO_COMMERCE_EMPRESA_ID;
  if (isDino) return 'barbearia';
  if (!empresa || !unidade || !temEquipeNaAgendaDaBarbearia(scope)) return 'postgres';
  const chave = `${empresa}:${unidade}`;
  const emCache = fonteCache.get(chave);
  if (emCache && emCache.expira > Date.now()) {
    if (emCache.fonte === 'postgres') conferirFontePgSemConflito(scope);
    return emCache.fonte;
  }
  let fonte = 'barbearia';
  try {
    const futuros = await pgDb.queryRead(
      `SELECT 1 FROM agendamentos
        WHERE empresa_id = $1 AND loja_id = $2 AND data_agendamento >= CURRENT_TIMESTAMP
          AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
        LIMIT 1`,
      [empresa, unidade],
    );
    if (!Array.isArray(futuros?.rows)) throw new SchedulingError('leitura da fonte incompleta', 'AGENDA_SOURCE_UNVERIFIABLE');
    // Uma leitura não pode mover/cancelar reservas entre motores. Enquanto houver
    // reserva futura PG nesta unidade, preserve o PG. Conciliação é uma operação
    // explícita separada; não há migração automática por este resolver.
    if (futuros.rows[0]) {
      conferirFontePgSemConflito(scope);
      fonte = 'postgres';
    }
  } catch (erro) {
    if (erro instanceof SchedulingError) throw erro;
    if (['ECONNREFUSED', 'ENOTFOUND'].includes(erro?.code) || (Array.isArray(erro?.errors) && erro.errors.some((e) => ['ECONNREFUSED', 'ENOTFOUND'].includes(e?.code)))) {
      fonte = 'barbearia';
    } else {
      throw new SchedulingError('não foi possível verificar a fonte da agenda', 'AGENDA_SOURCE_UNVERIFIABLE');
    }
  }
  fonteCache.set(chave, { fonte, expira: Date.now() + 60 * 1000 });
  return fonte;
}

function chaveNome(valor) {
  return limpo(valor, 160).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Acha o equivalente na agenda da barbearia pelo nome (exato, depois primeiro nome). */
function porNome(itens, nome) {
  const alvo = chaveNome(nome);
  if (!alvo) return null;
  const exato = itens.filter((item) => chaveNome(item.nome) === alvo);
  if (exato.length === 1) return exato[0];
  const primeiro = alvo.split(' ')[0];
  const parcial = itens.filter((item) => chaveNome(item.nome).split(' ')[0] === primeiro);
  return parcial.length === 1 ? parcial[0] : null;
}

/**
 * Move para a agenda da barbearia os agendamentos futuros que a IA gravou no
 * PostgreSQL. Idempotente: cada linha vira um agendamento com código derivado do
 * id original e a linha antiga sai da agenda PostgreSQL (status cancelado, com nota).
 * Linha cujo serviço/profissional não tem equivalente único fica pendente.
 */
export async function migrarAgendaPostgresParaBarbearia(scope = {}, { query = pgDb.query.bind(pgDb), queryRead = pgDb.queryRead.bind(pgDb) } = {}) {
  const empresa = chaveEmpresa(scope);
  const unidade = chaveUnidade(scope);
  if (!empresa || !unidade) throw new SchedulingError('empresa e unidade são obrigatórias para migrar a agenda', 'AGENDA_SCOPE_REQUIRED');
  const linhas = await queryRead(
    `SELECT a.id, a.empresa_id, a.loja_id, a.cliente_nome, a.cliente_telefone, a.observacoes,
            l.id AS loja_meta_id, l.empresa_id AS loja_empresa_id,
            to_char(a.data_agendamento, 'YYYY-MM-DD') AS dia, to_char(a.data_agendamento, 'HH24:MI') AS hora,
            s.nome AS servico_nome, s.empresa_id AS servico_empresa_id, s.loja_id AS servico_loja_id,
            u.nome_completo AS profissional_nome, u.empresa_id AS profissional_empresa_id,
            ul.loja_id AS profissional_loja_id
       FROM agendamentos a
       LEFT JOIN lojas l ON l.id = a.loja_id AND l.empresa_id = a.empresa_id
       LEFT JOIN servicos s ON s.id = a.servico_id AND s.empresa_id = a.empresa_id AND s.loja_id = a.loja_id
       LEFT JOIN usuarios u ON u.id = a.usuario_profissional_id AND u.empresa_id = a.empresa_id
       LEFT JOIN usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = a.loja_id AND ul.ativo = true
      WHERE a.empresa_id = $1 AND a.loja_id = $2 AND a.data_agendamento >= CURRENT_TIMESTAMP
        AND a.status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
      ORDER BY a.data_agendamento ASC LIMIT 200`,
    [empresa, unidade],
  );
  if (!Array.isArray(linhas?.rows)) throw new SchedulingError('leitura da agenda incompleta', 'AGENDA_SOURCE_UNVERIFIABLE');
  const servicos = barbearia.listarServicos(empresa);
  const profissionais = barbearia.listarProfissionais(empresa).filter((item) => item.ativo !== false);
  const resultado = { migrados: 0, pendentes: 0, motivos: [] };
  for (const linha of linhas.rows || []) {
    if (String(linha.empresa_id || '') !== empresa || String(linha.loja_id || '') !== unidade) {
      resultado.pendentes += 1;
      resultado.motivos.push('linha_fora_do_escopo');
      continue;
    }
    if (String(linha.loja_meta_id || '') !== unidade || String(linha.loja_empresa_id || '') !== empresa) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_unidade_invalido');
      continue;
    }
    if (linha.servico_nome && (String(linha.servico_empresa_id || '') !== empresa || String(linha.servico_loja_id || '') !== unidade)) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_servico_invalido');
      continue;
    }
    if (linha.profissional_nome && (String(linha.profissional_empresa_id || '') !== empresa || String(linha.profissional_loja_id || '') !== unidade)) {
      resultado.pendentes += 1;
      resultado.motivos.push('metadado_profissional_invalido');
      continue;
    }
    const servico = porNome(servicos, linha.servico_nome);
    const profissional = porNome(profissionais, linha.profissional_nome);
    if (!servico || !profissional) { resultado.pendentes += 1; resultado.motivos.push(!servico ? 'servico_sem_equivalente' : 'profissional_sem_equivalente'); continue; }
    try {
      const actionId = `migracao-pg:${linha.id}`;
      const codigo = createHash('sha256').update(`whatsapp-ia:${empresa}:${actionId}`).digest('hex').slice(0, 8).toUpperCase();
      // Repetição só é segura se a reserva JSON for da mesma unidade e tiver o
      // mesmo payload. Um código existente em outra unidade é conflito.
      const jaMigrado = barbearia.listarAgendamentos(empresa, {}).find((item) => item.codigoConfirmacao === codigo);
      const notas = limpo(linha.observacoes, 500);
      const replayValido = jaMigrado
        && String(jaMigrado.lojaId || '') === unidade
        && phoneMatchKey(jaMigrado.clienteTelefone) === phoneMatchKey(linha.cliente_telefone)
        && jaMigrado.dataAgenda === linha.dia
        && jaMigrado.horaLocal === linha.hora
        && jaMigrado.servicoId === servico.id
        && jaMigrado.profissionalId === profissional.id
        && limpo(jaMigrado.clienteNome, 160) === limpo(linha.cliente_nome, 160)
        && limpo(jaMigrado.observacoes, 600) === limpo(notas, 600);
      if (jaMigrado && !replayValido) {
        resultado.pendentes += 1;
        resultado.motivos.push('replay_divergente');
        continue;
      }
      const criado = replayValido ? respostaAgendamento(empresa, jaMigrado) : criarNaAgendaDaBarbearia({ ...scope }, {
        date: linha.dia, time: linha.hora, serviceId: servico.id, professionalId: profissional.id,
        customerName: linha.cliente_nome, customerPhone: linha.cliente_telefone,
        notes: notas, actionId,
      });
      const atualizado = await query(
        `UPDATE agendamentos SET status = 'cancelado',
                observacoes = LEFT(CONCAT_WS(' ', observacoes, $2::text), 1000)
          WHERE id = $1 AND empresa_id = $3 AND loja_id = $4
            AND data_agendamento >= CURRENT_TIMESTAMP
            AND status NOT IN ('cancelado', 'nao_compareceu', 'concluido')
          RETURNING id`,
        [linha.id, `[migrado para a agenda da barbearia: ${criado.codigo || criado.id}]`, empresa, unidade],
      );
      if (atualizado?.rowCount !== 1 || String(atualizado.rows?.[0]?.id || '') !== String(linha.id)) {
        resultado.pendentes += 1;
        resultado.motivos.push('atualizacao_pg_sem_correspondencia');
        continue;
      }
      resultado.migrados += 1;
    } catch (erro) {
      resultado.pendentes += 1;
      resultado.motivos.push(limpo(erro?.code || 'falha_migracao', 60));
    }
  }
  if (resultado.migrados) fonteCache.delete(`${empresa}:${unidade}`);
  return resultado;
}

export function limparCacheFonteAgenda() {
  fonteCache.clear();
}

function traduzirErro(erro) {
  if (erro instanceof SchedulingError) return erro;
  if(['PLANO_VENCIDO','PLANO_INDISPONIVEL','LIMITE_DO_CICLO'].includes(erro?.code))return new SchedulingError(limpo(erro.message,240),erro.code);
  const mensagem = limpo(erro?.message, 240) || 'não foi possível concluir';
  const indisponivel = /indispon|conflito|fora do funcionamento|não funciona|não trabalha|feriado|jornada/i.test(mensagem);
  return new SchedulingError(mensagem, indisponivel ? 'SLOT_UNAVAILABLE' : 'SCHEDULING_ERROR');
}

function dataLocalValida(valor) {
  const data = limpo(valor, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new SchedulingError('data inválida', 'INVALID_DATE');
  return data;
}

export async function listServices(scope) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgServices(scope);
  const empresa = chaveEmpresa(scope);
  const nomes = new Map(barbearia.listarProfissionais(empresa).map((item) => [item.id, item.nome]));
  return barbearia.listarServicos(empresa)
    .filter((item) => item.ativo !== false && item.permiteAgendamentoOnline !== false)
    .map((item) => {
      const isDinoService = String(item.nome || '').toLowerCase().includes('dino');
      return {
        id: item.id,
        nome: item.nome,
        descricao: item.descricao || '',
        categoria: item.categoria || 'Geral',
        grupoServico: item.grupoServico || 'nao_classificado',
        duracaoMinutos: Number(item.duracaoMinutos || barbearia.estimarDuracaoPorNomeServico?.(item.nome) || 30),
        preco: Number(item.preco || 0),
        tipoPreco: item.tipoPreco || 'fixo',
        precoTexto: isDinoService ? 'R$ 300,00 (R$ 600,00 após as 18h09)' : barbearia.rotuloPrecoServico(item),
        avisoValorHumano: isDinoService
          ? 'Corte com Dino: R$ 300 diurno (06h às 18h09) e R$ 600 em horário extra noturno/madrugada (após 18h09). Alerte sempre o cliente com calor humano e transparência.'
          : `Valor R$ ${Number(item.preco || 0).toFixed(2).replace('.', ',')}. Alerte sempre o cliente com transparência e empatia.`,
        profissionais: Array.isArray(item.profissionaisIds) && item.profissionaisIds.length
          ? item.profissionaisIds.map((id) => nomes.get(id)).filter(Boolean)
          : 'qualquer profissional',
      };
    });
}

export async function listProfessionals(scope) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgProfessionals(scope);
  return barbearia.listarProfissionais(chaveEmpresa(scope))
    .filter((item) => {
      if (item.ativo === false) return false;
      if (item.atendeCliente === false) return false;
      if (item.id === 'prof-mvsqchmy-023') return false;
      const nome = String(item.nome || '').toLowerCase();
      const apelido = String(item.apelido || '').toLowerCase();
      // Jhenyffer e Ester/Steffany atuam na recepção/administração/caixa e não como barbeiros de corte
      if (nome.includes('jhenyffer') || nome.includes('steffany') || nome.includes('ester') || apelido === 'ster' || apelido === 'ester') return false;
      if (nome.includes('joao victor') || nome.includes('joão victor') || nome.includes('david') || nome.includes('amanda')) return false;
      return true;
    })
    .map((item) => ({ id: item.id, nome: item.nome, especialidade: item.especialidade || '' }));
}

export const BARBEIROS_ATIVOS_DINO = [
  { id: 'dino', nome: 'Guilherme Cunha Martins', apelido: 'Dino', matches: ['guilherme cunha martins', 'dino', 'guilherme', 'mestre dino', 'patrao'] },
  { id: 'bruno', nome: 'Bruno Mendes Pedroso', apelido: 'Bruno', matches: ['bruno mendes pedroso', 'bruno mendes', 'bruno', 'mendes', 'brunao', 'bruninho'] },
  { id: 'nati', nome: 'Natani Minanis Dobler', apelido: 'Nati', matches: ['natani minanis dobler', 'natani', 'nati', 'naty', 'nat', 'nato', 'nathy', 'dobler'] },
];

export const EX_BARBEIROS_DINO = [
  'gustavo',
  'vitor',
  'victor ribeiro',
  'lucas',
  'vinycius',
  'vinicius',
  'danilo',
  'bruno rafael',
  'pedrinho',
  'joao victor',
  'joao',
  'ruedel',
  'david kaua',
  'david',
  'davi',
  'amanda gabrielly',
  'amanda'
];

function categoriaServicoAgenda(nome = '') {
  const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(combo|corte e barba|barba e corte|cabelo e barba|barba e cabelo)\b/.test(n)) return 'combo';
  if (/\b(corte|cabelo|visagista)\b/.test(n) && !/\bbarba\b/.test(n)) return 'corte';
  if (/\bbarba\b/.test(n) && !/\b(corte|cabelo)\b/.test(n)) return 'barba';
  if (/\bsobrancelha\b/.test(n)) return 'sobrancelha';
  if (/\bdermaplaning\b/.test(n)) return 'dermaplaning';
  if (/\b(depilacao|nariz|orelha)\b/.test(n)) return 'depilacao';
  return n.trim();
}

function encontrarServicoCompativelMesmaCategoria(servicos = [], servicoAtual, profissional) {
  if (!servicoAtual || !profissional) return null;
  const catAtual = categoriaServicoAgenda(servicoAtual.nome);
  const ehDino = barbearia.ehProfissionalDino(profissional) || /\bdino\b/i.test(String(profissional.nome || ''));
  const candidatos = servicos.filter((s) => {
    if (!s || s.id === servicoAtual.id || s.ativo === false) return false;
    if (categoriaServicoAgenda(s.nome) !== catAtual) return false;
    const ids = Array.isArray(s.profissionaisIds) ? s.profissionaisIds : [];
    return ids.length === 0 || ids.includes(profissional.id);
  });
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => {
    const aDino = /\bdino\b/i.test(String(a.nome || ''));
    const bDino = /\bdino\b/i.test(String(b.nome || ''));
    return ehDino ? Number(bDino) - Number(aDino) : Number(aDino) - Number(bDino);
  });
  return candidatos[0];
}

/**
 * Verifica se um barbeiro ainda atua na Barbearia Dino.
 * Caso não atue mais (ex: Gustavo, Vitor, Lucas, Vinycius, etc.), marca como ex-barbeiro
 * para que mensagens e a IA ofertem os novos profissionais ativos da equipe.
 */
export function verificarStatusBarbeiroDino(nomeOuProfissional) {
  if (!nomeOuProfissional) return { ativo: false, exBarbeiro: false, nomeExibicao: 'nossa equipe' };
  const raw = typeof nomeOuProfissional === 'string' ? nomeOuProfissional : (nomeOuProfissional.nome || nomeOuProfissional.apelido || '');
  const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (!clean || clean === 'nao informado' || clean === 'qualquer' || clean === 'equipe' || clean.includes('jhenyffer')) {
    return { ativo: false, exBarbeiro: false, nomeExibicao: 'nossa equipe' };
  }

  // IDs do sistema (UUID, prefixos pro-, usr-, bar-) nunca são ex-barbeiros
  if (/^[0-9a-f-]{36}$/i.test(clean) || /^(usr|pro|bar|srv|age)-/i.test(clean)) {
    return { ativo: true, exBarbeiro: false, nomeExibicao: 'profissional' };
  }

  // Diferenciar Bruno Mendes (ativo) de Bruno Rafael (saiu da equipe)
  if (clean.includes('bruno rafael')) {
    return {
      ativo: false,
      exBarbeiro: true,
      nomeOriginal: 'Bruno Rafael',
      nomeExibicao: 'um dos nossos barbeiros (como o Bruno ou a Nati)',
      barbeirosSugeridos: ['Bruno', 'Nati', 'Dino']
    };
  }

  // 1. Barbeiro ativo titular conhecido
  const achado = BARBEIROS_ATIVOS_DINO.find((b) => b.matches.some((m) => clean === m || clean.includes(m) || m.includes(clean)));
  if (achado) {
    return { ativo: true, exBarbeiro: false, barbeiro: achado, nomeExibicao: achado.apelido };
  }

  // 2. Somente ex-barbeiros explicitamente catalogados são marcados como exBarbeiro
  const ehExBarbeiro = EX_BARBEIROS_DINO.some((ex) => {
    if (ex === 'bruno rafael') return clean.includes('bruno rafael');
    return new RegExp(`\\b${ex}\\b`, 'i').test(clean);
  });

  if (ehExBarbeiro) {
    const exNome = raw.split(' ')[0];
    return {
      ativo: false,
      exBarbeiro: true,
      nomeOriginal: exNome,
      nomeExibicao: 'um dos nossos barbeiros especialistas (como o Bruno ou a Nati)',
      barbeirosSugeridos: ['Bruno', 'Nati', 'Dino']
    };
  }

  // 3. Qualquer outro profissional não catalogado NÃO é ex-barbeiro
  return {
    ativo: true,
    exBarbeiro: false,
    nomeOriginal: raw,
    nomeExibicao: raw,
    barbeirosSugeridos: ['Bruno', 'Nati', 'Dino']
  };
}

export async function availability(scope, input = {}) {
  exigirEscopoOperacional(scope, input, true);
  if (await agendaSource(scope) === 'postgres') return pgAvailability(scope, input);
  const empresa = chaveEmpresa(scope);
  const date = dataLocalValida(input.date);
  const servicos = barbearia.listarServicos(empresa);
  let servico = servicos.find((item) => item.id === limpo(input.serviceId, 100));
  if (!servico) {
    const { item } = matchAgendaName(input.serviceId, servicos);
    if (item) servico = item;
  }
  if (!servico) throw new SchedulingError('serviço não encontrado', 'SERVICE_NOT_FOUND');
  const profs = barbearia.listarProfissionais(empresa);
  const professionalId = limpo(input.professionalId, 100) || 'qualquer';
  let profissional = professionalId === 'qualquer' ? null : profs.find((item) => item.id === professionalId);
  if (professionalId !== 'qualquer' && !profissional) {
    const { item } = matchAgendaName(professionalId, profs);
    if (item) profissional = item;
  }
  if (professionalId !== 'qualquer' && !profissional) throw new SchedulingError('profissional não encontrado', 'PROFESSIONAL_NOT_FOUND');

  // Se o profissional não realiza este serviço (ex: Dino com Corte tradicional vs Corte com Dino),
  // ajusta automaticamente para o serviço equivalente que o profissional realiza
  if (profissional && Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length > 0 && !servico.profissionaisIds.includes(profissional.id)) {
    const alternativo = encontrarServicoCompativelMesmaCategoria(servicos, servico, profissional);
    if (alternativo) servico = alternativo;
  }

  let horarios = [];
  try {
    horarios = barbearia.listarHorariosDisponiveis(empresa, {
      data: date,
      servicoId: servico.id,
      profissionalId: profissional ? profissional.id : 'qualquer',
      lojaId: scope.lojaId,
      ignorarAgendamentoId: limpo(input.ignoreAppointmentId || input.ignorarAgendamentoId, 100),
    });
  } catch (erro) {
    throw traduzirErro(erro);
  }
  const professionalByTime = {};
  const professionalsByTime = {};
  for (const item of horarios) {
    if (item.disponivel && item.profissionalNome) {
      professionalByTime[item.horario] = item.profissionalNome;
    }
    if (item.disponivel && Array.isArray(item.profissionaisDisponiveis) && item.profissionaisDisponiveis.length) {
      professionalsByTime[item.horario] = item.profissionaisDisponiveis;
    }
  }
  const nomesNoDia = [...new Set(Object.values(professionalsByTime).flat())];
  const nomesHabilitados = (() => {
    if (nomesNoDia.length) return nomesNoDia;
    const hab = Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length
      ? profs.filter((p) => p.ativo !== false && servico.profissionaisIds.includes(p.id))
      : profs.filter((p) => p.ativo !== false);
    return hab.map((p) => p.apelido || p.nome).filter(Boolean);
  })();
  const nomeProfissionalExibicao = profissional
    ? (profissional.apelido || profissional.nome)
    : (nomesHabilitados.length ? nomesHabilitados.join(' ou ') : 'Bruno ou Nati');
  const ehDino = barbearia.ehProfissionalDino(profissional) || String(servico?.nome || '').toLowerCase().includes('dino');
  const tabelaValores = ehDino ? {
    tipo: 'dino_24x7',
    diurno: 'R$ 300,00 (08h00 às 18h00)',
    noturnoExtra: 'R$ 600,00 (atendimento exclusivo fora do expediente regular)',
    orientacaoHumana: 'Sempre alerte o cliente com simpatia e transparência sobre o valor do corte com Dino (R$ 300 no expediente normal das 08h às 18h ou R$ 600 em horário extra) antes de fechar o agendamento.',
  } : {
    tipo: 'padrao',
    valor: `R$ ${Number(servico.preco || 0).toFixed(2).replace('.', ',')}`,
    orientacaoHumana: `Alerte o cliente de maneira acolhedora e transparente sobre o valor de R$ ${Number(servico.preco || 0).toFixed(2).replace('.', ',')} para este atendimento.`,
  };

  return {
    date,
    service: { id: servico.id, nome: servico.nome, duracaoMinutos: Number(servico.duracaoMinutos || 0) || (barbearia.duracaoAtendimentoProfissional ? barbearia.duracaoAtendimentoProfissional(servico, profissional, barbearia.obterConfiguracao(empresa)) : 30), preco: Number(servico.preco || 0) },
    professional: profissional ? { id: profissional.id, nome: profissional.nome, duracaoAtendimentoMinutos: profissional.duracaoAtendimentoMinutos || null } : { id: 'qualquer', nome: nomeProfissionalExibicao },
    slots: horarios.filter((item) => item.disponivel).map((item) => item.horario),
    professionalByTime,
    professionalsByTime,
    professionalsAvailable: nomesHabilitados,
    bloqueio: (() => {
      const bloqueios = barbearia.listarBloqueios(empresa, { data: date, profissionalId: profissional?.id, lojaId: scope.lojaId });
      const b = (bloqueios || []).find((item) => item.ativo !== false && (!item.profissionalId || item.profissionalId === profissional?.id));
      return b ? { ativo: true, motivo: b.motivo || b.titulo || 'Ausência programada', titulo: b.titulo } : null;
    })(),
    tabelaValores,
  };
}

// Notificação fora da transação da IA: não segura a conexão do PostgreSQL e
// não depende do commit da ação.
// A conversa do WhatsApp já confirma a ação para o cliente (com o código). Aqui
// só fica o lembrete da véspera: sem uma segunda mensagem "agendamento
// registrado/remarcado/cancelado" logo depois da confirmação. O lembrete antigo
// de horário remarcado ou cancelado é cancelado na fila (e, de todo modo, seria
// descartado no envio pela conferência da agenda).
function notificarDepois(contexto, agendamento, evento) {
  setImmediate(async () => {
    // Aviso no celular do profissional (app do barbeiro) para ações da agenda/IA.
    const legado = contexto.legacyEmpresaId || contexto.empresaId;
    const servicoNome = agendamento.servicoNome || barbearia.listarServicos(legado, { incluirInativos: true }).find((s) => s.id === agendamento.servicoId)?.nome || '';
    await notificarEquipe(legado, agendamento, evento, { servicoNome }).catch(() => null);
    if (evento === 'remarcado' || evento === 'cancelado') await cancelPendingAppointmentNotifications(contexto, agendamento.id).catch(() => null);
    // NÃO dispara lembrete imediato aqui: o agendamento acabou de ser confirmado no chat com o código.
    // O lembrete oficial de véspera e de dia é gerenciado pelo dino-confirmacao-diaria.js e pelo agendamento da fila.
  });
}

function respostaAgendamento(empresa, agendamento) {
  const servico = barbearia.listarServicos(empresa, { incluirInativos: true }).find((item) => item.id === agendamento.servicoId);
  const profissional = barbearia.listarProfissionais(empresa, { incluirInativos: true }).find((item) => item.id === agendamento.profissionalId);
  return {
    id: agendamento.id,
    codigo: agendamento.codigoConfirmacao,
    status: agendamento.status,
    dataHora: agendamento.dataHora,
    dataAgenda: agendamento.dataAgenda,
    horaLocal: agendamento.horaLocal,
    servico: servico?.nome || 'Serviço',
    profissional: profissional?.nome || 'Profissional da equipe',
    duracaoMinutos: agendamento.duracaoMinutos,
    valor: Number(agendamento.valor || 0),
    cliente: agendamento.clienteNome,
    slotFingerprint: agendamento.slotFingerprint || captacao.fingerprintSlot({ empresaId: empresa, ...agendamento }),
  };
}

export async function createAppointment(trx, scope, input = {}) {
  exigirEscopoOperacional(scope, input, true);
  if (await agendaSource(scope) === 'postgres') return pgCreate(trx, scope, input);
  return criarNaAgendaDaBarbearia(scope, input);
}

function criarNaAgendaDaBarbearia(scope, input = {}) {
  const empresa = chaveEmpresa(scope);
  const servicos = barbearia.listarServicos(empresa, { incluirInativos: true });
  let servico = servicos.find((item) => item.id === limpo(input.serviceId, 100));
  if (!servico) {
    const { item } = matchAgendaName(input.serviceId, servicos);
    if (item) {
      servico = item;
      input.serviceId = item.id;
    }
  }
  const profs = barbearia.listarProfissionais(empresa, { incluirInativos: true });
  const rawProf = limpo(input.professionalId, 100) || 'qualquer';
  let profissional = rawProf === 'qualquer' ? null : profs.find((item) => item.id === rawProf);
  if (rawProf !== 'qualquer' && !profissional) {
    const { item } = matchAgendaName(rawProf, profs);
    if (item) {
      profissional = item;
      input.professionalId = item.id;
    }
  }
  if (profissional && servico && Array.isArray(servico.profissionaisIds) && servico.profissionaisIds.length > 0 && !servico.profissionaisIds.includes(profissional.id)) {
    const alternativo = encontrarServicoCompativelMesmaCategoria(servicos, servico, profissional);
    if (alternativo) {
      servico = alternativo;
      input.serviceId = alternativo.id;
    }
  }
  const servicoId = servico?.id || limpo(input.serviceId, 100);
  const profissionalId = profissional?.id || 'qualquer';
  // Idempotência precisa preceder a resolução do slot: numa repetição depois de
  // uma resposta perdida, o próprio atendimento já ocupa o horário e não pode
  // ser confundido com um novo conflito.
  const codigo = input.actionId
    ? createHash('sha256').update(`whatsapp-ia:${empresa}:${input.actionId}`).digest('hex').slice(0, 8).toUpperCase()
    : randomBytes(4).toString('hex').toUpperCase();
  const existente = input.actionId
    ? barbearia.listarAgendamentos(empresa, {}).find((item) => item.codigoConfirmacao === codigo)
    : null;
  if (existente) {
    const profissionalSolicitado = limpo(input.professionalId, 100) || 'qualquer';
    const mesmoPedido = String(existente.lojaId || '') === String(scope.lojaId || '')
      && phoneMatchKey(existente.clienteTelefone) === phoneMatchKey(input.customerPhone)
      && existente.dataAgenda === dataLocalValida(input.date)
      && existente.horaLocal === limpo(input.time, 5)
      && existente.servicoId === limpo(input.serviceId, 100)
      && (profissionalSolicitado === 'qualquer' || existente.profissionalId === profissionalSolicitado)
      && limpo(existente.clienteNome, 160) === limpo(input.customerName, 160)
      && limpo(existente.observacoes, 600) === limpo(input.notes, 600);
    if (!mesmoPedido) throw new SchedulingError('a confirmação já foi usada em outro contexto; revise a ação antes de confirmar novamente', 'IDEMPOTENCY_CONFLICT');
    return respostaAgendamento(empresa, existente);
  }
  try {
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId,
      profissionalId,
      lojaId: scope.lojaId,
    });
    // Limite por VISITA (dia + pessoa), não por serviço: no WhatsApp o mesmo número marca
    // para a família ("eu e o Pedro") e vários serviços na mesma ida (barba + manicure).
    const futurosDoTelefone = agendamentosDoTelefone(empresa, input.customerPhone, { lojaId: scope.lojaId }).filter((item) => ATIVOS.has(item.status));
    const visitas = new Set(futurosDoTelefone.map((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}`));
    const estaVisita = `${dataLocalValida(input.date)}|${limpo(input.customerName, 160).toLowerCase()}`;
    const limite = Math.max(1, Number.parseInt(process.env.WHATSAPP_AGENDAMENTO_MAX_VISITAS_POR_TELEFONE || process.env.AGENDAMENTO_PUBLICO_MAX_POR_TELEFONE || '4', 10));
    const servicosNaVisita = futurosDoTelefone.filter((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}` === estaVisita).length;
    if ((!visitas.has(estaVisita) && visitas.size >= limite) || servicosNaVisita >= 4) throw new SchedulingError('este telefone já tem horários marcados; remarque ou cancele um deles antes', 'PHONE_LIMIT');
    const ehItemComboSecundario = String(input.actionId || '').includes(':');
    const permiteMultiplosCortesVisita = ehItemComboSecundario || input.allowSameServiceInVisit === true || input.confirmarOutroHorario === true || (Array.isArray(input.combo) && input.combo.length > 0);
    const mesmoServico = !permiteMultiplosCortesVisita && futurosDoTelefone.some((item) => `${item.dataAgenda}|${limpo(item.clienteNome, 160).toLowerCase()}` === estaVisita && item.servicoId === limpo(servicoId, 100));
    if (mesmoServico) throw new SchedulingError('este cliente já tem este serviço marcado neste dia', 'ALREADY_BOOKED');
    const vinculo = vincularClienteAoAtendimento(empresa, { clienteNome: input.customerName, clienteTelefone: input.customerPhone }, { origem: 'whatsapp_ia' });
    // O cliente iniciou a conversa no WhatsApp para marcar: os avisos do próprio
    // agendamento fazem parte do atendimento pedido (nunca reativa quem revogou).
    captacao.registrarConsentimentoAtendimento(empresa, vinculo.clienteId, 'conversa_whatsapp_iniciada_pelo_cliente');
    const servicosEmpresa = barbearia.listarServicos(empresa, { incluirInativos: true });
    let servicoObj = servicosEmpresa.find((s) => s.id === limpo(input.serviceId, 100));
    if (!servicoObj) {
      const { item } = matchAgendaName(input.serviceId, servicosEmpresa);
      if (item) {
        servicoObj = item;
        input.serviceId = item.id;
      }
    }
    const duracaoServico = Number(servicoObj?.duracaoMinutos || 0) || duracaoDoServico(empresa, input.serviceId);
    const agendamento = barbearia.criarAgendamento(empresa, {
      clienteId: vinculo.clienteId || undefined,
      clienteNome: limpo(input.customerName, 160),
      clienteTelefone: limpo(input.customerPhone, 30),
      profissionalId: livre.profissional.id,
      servicoId,
      dataHora: livre.dataHora,
      dataAgenda: livre.dataAgenda,
      horaLocal: livre.horaLocal,
      duracaoMinutos: duracaoServico,
      lojaId: scope.lojaId,
      observacoes: limpo(input.notes, 600),
      origem: 'whatsapp_ia',
      usarPlano: input.usePlan===true,
      status: 'agendado',
      codigoConfirmacao: codigo,
    });
    agendamento.slotFingerprint = captacao.fingerprintSlot({ empresaId: empresa, ...agendamento });
    captacao.marcarListaEsperaAgendada(empresa, {
      telefone: agendamento.clienteTelefone,
      data: agendamento.dataAgenda,
      lojaId: agendamento.lojaId,
      servicoId: agendamento.servicoId,
      profissionalId: agendamento.profissionalId,
      dataHora: agendamento.dataHora,
      horaLocal: agendamento.horaLocal,
      duracaoMinutos: agendamento.duracaoMinutos,
      slotFingerprint: agendamento.slotFingerprint,
      agendamentoId: agendamento.id,
    });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, agendamento, 'criado');
    return respostaAgendamento(empresa, agendamento);
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

function agendamentosDoTelefone(empresa, phone, { includePast = false, lojaId, toleranceHours = 4, includeCancelled = false } = {}) {
  const chave = phoneMatchKey(phone);
  const unidade = limpo(lojaId, 120);
  if (!chave) return [];
  const agora = Date.now();
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(agora));
  const limitePassado = includePast ? 0 : agora - (Number(toleranceHours) || 0) * 3600000;
  return barbearia.listarAgendamentos(empresa, {})
    .filter((item) => !unidade || lojasEquivalentes(empresa, item.lojaId, unidade))
    .filter((item) => phoneMatchKey(item.clienteTelefone) === chave)
    .filter((item) => includeCancelled || !['cancelado', 'nao_compareceu'].includes(item.status))
    .filter((item) => includePast || item.dataAgenda === diaHoje || instanteAgendamento(item) >= limitePassado)
    .sort((a, b) => instanteAgendamento(a) - instanteAgendamento(b));
}

function horarioLocalLegivel(dataHora) {
  const data = new Date(dataHora || '');
  if (Number.isNaN(data.valueOf())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data).replace(',', ' às');
}

export async function listCustomerAppointments(scope, { includePast = false, limit = 8, toleranceHours = 4 } = {}) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgCustomerAppointments(scope, { includePast, limit });
  const empresa = chaveEmpresa(scope);
  const servicos = new Map(barbearia.listarServicos(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  const profissionais = new Map(barbearia.listarProfissionais(empresa, { incluirInativos: true }).map((item) => [item.id, item]));
  return agendamentosDoTelefone(empresa, scope.phone, { includePast, lojaId: scope.lojaId, toleranceHours })
    .slice(0, Math.min(20, Math.max(1, Number(limit) || 8)))
    .map((item) => ({
      id: item.id,
      // Código mostrado na confirmação ("Código 5D0FDE32"): o cliente cancela por ele.
      codigo: item.codigoConfirmacao || null,
      dataHora: item.dataHora,
      dataAgenda: item.dataAgenda,
      diaSemana: item.dataAgenda ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${String(item.dataAgenda).slice(0, 10)}T12:00:00Z`)) : '',
      horaLocal: item.horaLocal,
      status: item.status,
      duracaoMinutos: Number(item.duracaoMinutos || 30),
      valor: Number(item.valor || 0),
      observacoes: item.observacoes || '',
      cliente: item.clienteNome || '',
      // Remarcação feita pela equipe (balcão/admin): a IA explica em vez de contradizer o cliente.
      remarcacaoAnterior: Array.isArray(item.historicoRemarcacoes) && item.historicoRemarcacoes[0]
        ? { de: horarioLocalLegivel(item.historicoRemarcacoes[0].antes?.dataHora), origem: item.historicoRemarcacoes[0].origem || 'admin', feitaPelaEquipe: !['whatsapp_ia', 'cliente_site'].includes(item.historicoRemarcacoes[0].origem) }
        : null,
      servico: { id: item.servicoId, nome: servicos.get(item.servicoId)?.nome || 'Serviço' },
      profissional: { id: item.profissionalId, nome: profissionais.get(item.profissionalId)?.nome || 'Profissional da equipe' },
    }));
}

function agendamentoDoContato(empresa, phone, appointmentId, lojaId, { permitirCancelado = false } = {}) {
  const agendamento = agendamentosDoTelefone(empresa, phone, { includePast: true, lojaId, includeCancelled: permitirCancelado }).find((item) => item.id === limpo(appointmentId, 120));
  if (!agendamento) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  if (!ATIVOS.has(agendamento.status) && !(permitirCancelado && agendamento.status === 'cancelado')) {
    throw new SchedulingError('este agendamento já não está ativo', 'APPOINTMENT_NOT_ACTIVE');
  }
  return agendamento;
}

/**
 * Cliente confirma presença (ex.: respondendo ao lembrete da véspera).
 * Só no horário do próprio telefone e ainda ativo; idempotente.
 */
export async function confirmAttendance(scope, appointmentId) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') throw new SchedulingError('confirmação de presença disponível apenas na agenda da barbearia', 'NOT_BARBERSHOP_AGENDA');
  const empresa = chaveEmpresa(scope);
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresa || '').toLowerCase());
  const agendamento = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId, { permitirCancelado: isDino });
  const diaHoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date());
  const ehHoje = agendamento.dataAgenda === diaHoje;
  if (!ehHoje && instanteAgendamento(agendamento) < Date.now() - 30 * 60 * 1000) throw new SchedulingError('este horário já passou', 'APPOINTMENT_PAST');
  const atualizado = agendamento.status === 'confirmado'
    ? agendamento
    : barbearia.alterarStatusAgendamento(empresa, agendamento.id, 'confirmado', {
        lojaId: scope.lojaId,
        origem: 'cliente',
        canceladoPor: null,
        motivoCancelamento: '',
        observacoes: limpo(`${agendamento.observacoes || ''} · Presença confirmada pelo cliente no WhatsApp`.replace(/^ · /, ''), 600),
      });
  if (!atualizado) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');

  // Se o cliente tem mais de um agendamento na mesma data (ex.: barba + corte), confirma todos
  const diaAlvo = agendamento.dataAgenda || (new Date(agendamento.dataHora).toISOString().split('T')[0]);
  const outrosDoMesmoDia = agendamentosDoTelefone(empresa, scope.phone, { includePast: true, lojaId: scope.lojaId })
    .filter((outro) => outro.id !== agendamento.id && (outro.dataAgenda || new Date(outro.dataHora).toISOString().split('T')[0]) === diaAlvo && outro.status === 'agendado');
  for (const outro of outrosDoMesmoDia) {
    barbearia.alterarStatusAgendamento(empresa, outro.id, 'confirmado', { lojaId: scope.lojaId, observacoes: limpo(`${outro.observacoes || ''} · Presença confirmada pelo cliente no WhatsApp (serviço conjunto)`.replace(/^ · /, ''), 600) });
  }

  return { ...respostaAgendamento(empresa, atualizado), jaEstavaConfirmado: agendamento.status === 'confirmado' };
}

/** Cliente avisa atraso: anota no horário para a equipe ver na agenda (não move o horário). */
export async function noteDelay(scope, appointmentId, minutes) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') throw new SchedulingError('aviso de atraso disponível apenas na agenda da barbearia', 'NOT_BARBERSHOP_AGENDA');
  const empresa = chaveEmpresa(scope);
  const agendamento = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId);
  const min = Math.round(Number(minutes));
  if (!Number.isFinite(min) || min < 1 || min > 120) throw new SchedulingError('informe o atraso em minutos (1 a 120)', 'INVALID_DELAY');
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const nota = `Cliente avisou atraso de ~${min} min às ${hora} (WhatsApp)`;
  const atualizado = barbearia.alterarStatusAgendamento(empresa, agendamento.id, agendamento.status, { lojaId: scope.lojaId, observacoes: limpo(`${agendamento.observacoes || ''} · ${nota}`.replace(/^ · /, ''), 600) });
  if (!atualizado) throw new SchedulingError('agendamento não encontrado para este contato', 'APPOINTMENT_NOT_FOUND');
  return { ...respostaAgendamento(empresa, atualizado), atrasoMinutos: min };
}

export async function rescheduleAppointment(trx, scope, input = {}) {
  exigirEscopoOperacional(scope, input);
  if (await agendaSource(scope) === 'postgres') return pgReschedule(trx, scope, input);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, input.appointmentId, scope.lojaId);
    const requestedProfId = limpo(input.professionalId, 100);
    const targetProfId = requestedProfId && requestedProfId !== 'qualquer'
      ? requestedProfId
      : (atual.profissionalId || 'qualquer');
    const livre = barbearia.resolverProfissionalDisponivel(empresa, {
      data: dataLocalValida(input.date),
      horario: limpo(input.time, 5),
      servicoId: atual.servicoId,
      profissionalId: targetProfId,
      lojaId: scope.lojaId,
      ignorarAgendamentoId: atual.id,
    });
    const atualizado = barbearia.atualizarAgendamento(empresa, atual.id, {
      lojaId: scope.lojaId,
      dataHora: livre.dataHora,
      dataAgenda: livre.dataAgenda,
      horaLocal: livre.horaLocal,
      profissionalId: livre.profissional.id,
      origem: 'whatsapp_ia',
    });
    atualizado.slotFingerprint = captacao.fingerprintSlot({ empresaId: empresa, ...atualizado, lojaId: scope.lojaId });
    // A remarcação muda a identidade do slot; o profissional escolhido permanece
    // sendo a preferência do agendamento original.
    captacao.marcarListaEsperaAgendada(empresa, {
      telefone: atualizado.clienteTelefone,
      data: atualizado.dataAgenda,
      lojaId: atualizado.lojaId,
      servicoId: atualizado.servicoId,
      profissionalId: atualizado.profissionalId,
      dataHora: atualizado.dataHora,
      horaLocal: atualizado.horaLocal,
      duracaoMinutos: atualizado.duracaoMinutos,
      slotFingerprint: atualizado.slotFingerprint,
      agendamentoId: atualizado.id,
    });
    notificarDepois({ empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa }, atualizado, 'remarcado');
    return { ...respostaAgendamento(empresa, atualizado), profissional: livre.profissional.nome };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

export async function cancelAppointment(trx, scope, appointmentId, options = {}) {
  exigirEscopoOperacional(scope);
  if (await agendaSource(scope) === 'postgres') return pgCancel(trx, scope, appointmentId);
  const empresa = chaveEmpresa(scope);
  try {
    const atual = agendamentoDoContato(empresa, scope.phone, appointmentId, scope.lojaId);
    const motivo = limpo(options.motivo || 'Cancelado pelo cliente no WhatsApp', 120);
    const canceladoPor = limpo(options.canceladoPor || 'cliente', 80);
    const canalCancelamento = limpo(options.canalCancelamento || 'whatsapp_ia', 60);
    const cancelado = barbearia.alterarStatusAgendamento(empresa, atual.id, 'cancelado', {
      lojaId: scope.lojaId,
      origem: canalCancelamento,
      canalCancelamento,
      canceladoPor,
      motivoCancelamento: motivo,
      observacoes: `${atual.observacoes ? `${atual.observacoes} · ` : ''}${motivo}`,
    });
    const contexto = { empresaId: scope.empresaId, lojaId: scope.lojaId, legacyEmpresaId: empresa };
    if (options.silencioso !== true) {
      notificarDepois(contexto, cancelado, 'cancelado');
    }
    const candidatos = captacao.candidatosParaVaga(empresa, atual);
    setImmediate(() => { avisarListaEspera(contexto, cancelado, candidatos).catch(() => null); });
    return { ...respostaAgendamento(empresa, cancelado), listaEsperaCandidatos: candidatos.length };
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/**
 * Enfileira o aviso de vaga para a lista de espera e só então registra quem foi
 * avisado (sem fila/canal, ninguém fica marcado como avisado).
 */
export async function avisarListaEspera(contexto, agendamentoLiberado, candidatos) {
  if (!candidatos?.length) return { queued: 0, skipped: true, reason: 'no_candidates' };
  return queueWaitlistNotifications(contexto, agendamentoLiberado, candidatos);
}
