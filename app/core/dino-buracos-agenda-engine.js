/**
 * MOTOR DE BURACOS NA AGENDA (VAGAS OCIOSAS FUTURAS) & AÇÕES OPERACIONAIS IMEDIATAS
 * Barbearia Dino & Kytto ERP - SetPoint Intelligence
 * 
 * Regras:
 * 1. Sempre exibe datas a partir de HOJE em diante (datas passadas como 09/11 são descartadas).
 * 2. Se a data for HOJE, filtra horários futuros em relação ao relógio oficial de Cuiabá.
 * 3. Encontra matches inteligentes de clientes da base em risco de churn/corte vencido.
 * 4. Oferece ações imediatas: Enviar WhatsApp, Fazer Encaixe, Bloquear Slot e Oferta Relâmpago.
 */
import { criarBloqueio, criarAgendamento, estadoEmpresa } from '../barbearia-erp-kytto.js';
import { kyttoEventBus } from './kytto-event-bus.js';
import { db, save } from '../db.js';

export const DIAS_SEMANA_EXTENSO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function obterHoraAtualCuiaba() {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Cuiaba',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch (_) {
    return '12:00';
  }
}

export function obterHojeCuiaba() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Cuiaba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Calcula os buracos na agenda da Barbearia Dino estritamente de HOJE para FRENTE
 */
export function calcularBuracosAgendaDino({
  estado = {},
  hoje = obterHojeCuiaba(),
  baseClientes = [],
  config = {},
  diasAFrente = 10,
  filtroBarbeiro = '',
  limiteVagas = 30,
}) {
  const agendamentos = Object.values(estado.agendamentos || {}).filter(
    (a) => a && a.status !== 'cancelado' && a.status !== 'removido'
  );
  const bloqueios = Object.values(estado.bloqueios || {}).filter(
    (b) => b && b.ativo !== false
  );
  const profissionaisCadastrados = Object.values(estado.profissionais || {}).filter(
    (p) => p && p.ativo !== false
  );

  // Mapeamento canônico dos profissionais oficiais da Dino com IDs reais do ERP
  const barbeirosBase = [
    {
      id: 'prof-mtj69hhx-002', // Bruno Mendes Pedroso
      nome: 'Bruno',
      apelido: 'Bruno',
      diasTrabalho: [1, 2, 3, 4, 5, 6], // Seg a Sáb
      horaInicio: '08:30',
      horaFim: '19:00',
      valorMedio: 120,
      foco: 'Corte Masculino & Degradê',
    },
    {
      id: 'prof-mtj67o7r-001', // Dino (Guilherme)
      nome: 'Dino',
      apelido: 'Dino',
      diasTrabalho: [2, 3, 4, 5, 6], // Ter a Sáb
      horaInicio: '09:00',
      horaFim: '19:00',
      valorMedio: 220,
      foco: 'Visagismo & Barboterapia Dino',
    },
    {
      id: 'prof-mv1bx3sc-011', // Nati
      nome: 'Nati',
      apelido: 'Nati',
      diasTrabalho: [2, 3, 4, 5, 6], // Ter a Sáb
      horaInicio: '08:30',
      horaFim: '18:30',
      valorMedio: 120,
      foco: 'Corte Tradicional & Barboterapia',
    },
  ];

  // Mesclar com profissionais reais do banco/estado
  const barbeiros = [...barbeirosBase];
  for (const p of profissionaisCadastrados) {
    const nome = String(p.nome || '').trim();
    if (!barbeiros.some((b) => b.id === p.id || b.nome.toLowerCase() === nome.toLowerCase())) {
      barbeiros.push({
        id: p.id,
        nome,
        apelido: p.apelido || nome.split(' ')[0],
        diasTrabalho: [1, 2, 3, 4, 5, 6],
        horaInicio: '09:00',
        horaFim: '18:30',
        valorMedio: 100,
        foco: 'Atendimento & Barba',
      });
    }
  }

  // Filtrar se especificado profissional
  const barbeirosFiltrados = filtroBarbeiro
    ? barbeiros.filter(
        (b) =>
          b.id === filtroBarbeiro ||
          b.nome.toLowerCase().includes(String(filtroBarbeiro).toLowerCase())
      )
    : barbeiros;

  // Grade de horários comumente procurados para preenchimento
  const slotsGrade = [
    '08:30',
    '09:15',
    '10:00',
    '10:45',
    '11:30',
    '13:30',
    '14:15',
    '15:00',
    '15:45',
    '16:30',
    '17:15',
    '18:00',
    '18:45',
  ];

  const horaAtual = obterHoraAtualCuiaba();
  const [ano, mes, diaNum] = hoje.split('-').map(Number);
  const dataRef = new Date(Date.UTC(ano, mes - 1, diaNum, 12, 0, 0));

  const buracos = [];

  // Varrer dia a dia sempre a partir de HOJE para FRENTE (nunca datas passadas)
  for (let offset = 0; offset <= Math.max(1, diasAFrente); offset++) {
    const dataAlvo = new Date(dataRef);
    dataAlvo.setUTCDate(dataAlvo.getUTCDate() + offset);
    const dataIso = dataAlvo.toISOString().slice(0, 10);
    const diaSemanaIndex = dataAlvo.getUTCDay();

    // Domingo fechado por padrão
    if (diaSemanaIndex === 0) continue;

    const nomeDiaSemana = DIAS_SEMANA_EXTENSO[diaSemanaIndex];
    let rotuloDia = `${nomeDiaSemana} · ${dataIso.split('-').reverse().slice(0, 2).join('/')}`;
    let tagPrazo = 'futuro';

    if (offset === 0) {
      rotuloDia = `Hoje (${nomeDiaSemana})`;
      tagPrazo = 'hoje';
    } else if (offset === 1) {
      rotuloDia = `Amanhã (${nomeDiaSemana})`;
      tagPrazo = 'amanha';
    }

    for (const b of barbeirosFiltrados) {
      // Se não trabalha nesse dia da semana na escala, pula
      if (Array.isArray(b.diasTrabalho) && !b.diasTrabalho.includes(diaSemanaIndex)) {
        continue;
      }

      for (const slotHora of slotsGrade) {
        // Se for HOJE e o horário já passou em relação a Cuiabá, descarta imediatamente!
        if (offset === 0 && slotHora <= horaAtual) {
          continue;
        }

        // 1. Checar agendamentos existentes
        const agendamentoExistente = agendamentos.find((ag) => {
          const diaAg = String(ag.dataAgenda || ag.dataHora || '').slice(0, 10);
          if (diaAg !== dataIso) return false;
          const hAg = String(ag.horaLocal || ag.hora || String(ag.dataHora || '').slice(11, 16)).trim();
          const profMatch =
            !ag.profissionalId ||
            ag.profissionalId === b.id ||
            String(ag.profissionalNome || '').toLowerCase().includes(b.nome.toLowerCase());
          return profMatch && hAg === slotHora;
        });

        if (agendamentoExistente) continue;

        // 2. Checar bloqueios de agenda
        const bloqueioExistente = bloqueios.find((bl) => {
          const deBl = String(bl.dataInicio || bl.de || '').slice(0, 10);
          const ateBl = String(bl.dataFim || bl.ate || deBl).slice(0, 10);
          if (dataIso < deBl || dataIso > ateBl) return false;
          const profBlMatch =
            !bl.profissionalId ||
            bl.profissionalId === b.id ||
            String(bl.profissionalNome || '').toLowerCase().includes(b.nome.toLowerCase());
          if (!profBlMatch) return false;
          if (bl.diaTodo) return true;
          const hIni = bl.inicioHora || bl.inicio || '00:00';
          const hFim = bl.fimHora || bl.fim || '23:59';
          return slotHora >= hIni && slotHora <= hFim;
        });

        if (bloqueioExistente) continue;

        // 3. Match de cliente sugerido (IA de Encaixe & Recuperação)
        const clienteMatch = (baseClientes || []).find((c) => {
          const pref = String(c.barbeiroNomeExibicao || c.profissionalPreferido || '').toLowerCase();
          const matchBarbeiro =
            pref.includes(b.nome.toLowerCase()) || pref.includes(b.apelido.toLowerCase());
          const diasSemVir = Number(c.diasSemVir || 0);
          return matchBarbeiro && diasSemVir >= 15 && diasSemVir <= 75;
        });

        const potencial = b.nome.toLowerCase().includes('dino') ? 220 : 120;
        const linkDireto = `https://kytto.com.br/agendar/dino?prof=${encodeURIComponent(b.id)}&data=${dataIso}&hora=${encodeURIComponent(slotHora)}`;
        const agenteIaNome = config.agenteIaNome || 'T-Rex';

        const buracoItem = {
          id: `buraco-${dataIso}-${b.id}-${slotHora.replace(':', '')}`,
          data: dataIso,
          dia: rotuloDia,
          diaSemana: nomeDiaSemana,
          horario: slotHora,
          profissional: b.nome,
          profissionalId: b.id,
          tagPrazo,
          offsetDias: offset,
          potencial,
          foco: b.foco,
          dica:
            offset === 0
              ? 'Vaga ociosa para HOJE! Dispare para cliente próximo ou ofereça 15% OFF de encaixe.'
              : `Horário nobre de ${nomeDiaSemana} vago com ${b.nome}.`,
          linkAgendamento: linkDireto,
          clienteSugerido: clienteMatch
            ? {
                id: clienteMatch.key || clienteMatch.id || clienteMatch.telefone,
                nome: clienteMatch.nome,
                telefone: clienteMatch.telefoneFormatado || clienteMatch.telefone,
                diasSemVir: clienteMatch.diasSemVir || 21,
                ultimaVisita: clienteMatch.ultimaVisita || '',
              }
            : null,
          mensagemWhatsApp: clienteMatch
            ? `Fala ${clienteMatch.nome.split(' ')[0]}, tudo joia? Aqui é o ${agenteIaNome} da Barbearia Dino! 💈\n\nAbriu um horário exclusivo com o ${b.nome} ${rotuloDia} às ${slotHora}. Como faz ${clienteMatch.diasSemVir || 20} dias do seu último corte, guardei essa vaga para manter seu visual alinhado!\n\nPosso confirmar para você? Ou se preferir, toque aqui para agendar direto:\n${linkDireto}`
            : `Opa! Aqui é o ${agenteIaNome} da Barbearia Dino! 💈\n\nAbriu um horário exclusivo com o ${b.nome} ${rotuloDia} às ${slotHora}!\n\nGaranta sua cadeira em 1 toque:\n${linkDireto}`,
          mensagemOfertaRelampago: `🔥 *OFERTA RELÂMPAGO DINO (15% OFF)* 🔥\n\nOlá! Aqui é o ${agenteIaNome}. Liberamos uma condição especial para preenchimento de cadeira ${rotuloDia} às ${slotHora} com ${b.nome}: *15% de desconto* no Corte & Barba!\n\nReserve agora antes que feche:\n${linkDireto}`,
        };

        buracos.push(buracoItem);
        if (buracos.length >= limiteVagas) break;
      }
      if (buracos.length >= limiteVagas) break;
    }
    if (buracos.length >= limiteVagas) break;
  }

  // Ordenação estrita: data ASC, horário ASC
  buracos.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.horario.localeCompare(b.horario);
  });

  return buracos;
}

/**
 * AÇÃO 1: Bloquear slot de buraco na agenda
 */
export function executarBloqueioBuraco(empresaId, { profissionalId, data, horario, motivo = 'Bloqueio de Horário Ocioso' }) {
  if (!empresaId) throw new Error('empresaId obrigatório.');
  if (!data || !horario) throw new Error('Data e horário são obrigatórios para bloquear.');

  const estado = estadoEmpresa(empresaId);
  let idReal = profissionalId;
  if (idReal && !estado.profissionais?.[idReal]) {
    const achado = Object.values(estado.profissionais || {}).find((p) => {
      const pNome = (p.nome || '').toLowerCase();
      if (/dino/i.test(idReal) && /dino/i.test(pNome)) return true;
      if (/bruno/i.test(idReal) && /bruno/i.test(pNome)) return true;
      if (/nati/i.test(idReal) && /nati/i.test(pNome)) return true;
      return p.id === idReal;
    });
    if (achado) idReal = achado.id;
  }
  if (!idReal || !estado.profissionais?.[idReal]) {
    idReal = Object.keys(estado.profissionais || {}).find(k => estado.profissionais[k]?.ativo !== false) || '';
  }

  const fimHora = somarMinutosHora(horario, 45);
  const dadosBloqueio = {
    titulo: `Bloqueio ${horario}`,
    motivo: motivo || 'Horário bloqueado pela Gestão',
    inicio: `${data}T${horario}:00.000Z`,
    fim: `${data}T${fimHora}:00.000Z`,
    profissionalId: idReal || '',
    origem: 'gestao_buracos_ia',
  };

  const bloqueioCriado = criarBloqueio(empresaId, dadosBloqueio);

  kyttoEventBus.emitir('agenda.bloqueada', {
    empresaId,
    bloqueioId: bloqueioCriado?.id,
    data,
    horario,
    motivo,
  });

  return {
    ok: true,
    sucesso: true,
    bloqueio: bloqueioCriado,
    mensagem: `Horário ${horario} de ${data} bloqueado com sucesso na agenda da Dino!`,
  };
}

/**
 * AÇÃO 2: Fazer encaixe rápido de cliente na vaga ociosa
 */
export function executarEncaixeRapidoBuraco(empresaId, {
  profissionalId,
  data,
  horario,
  clienteNome = 'Cliente Encaixe Rápido',
  clienteTelefone = '',
  servicoId,
  valor,
  observacoes = 'Encaixe rápido via Painel de Buracos de Agenda',
}) {
  if (!empresaId) throw new Error('empresaId obrigatório.');
  if (!data || !horario) throw new Error('Data e horário são obrigatórios para o encaixe.');

  const estado = estadoEmpresa(empresaId);

  // Resolução inteligente do profissional real
  let profIdReal = profissionalId;
  if (profIdReal && !estado.profissionais?.[profIdReal]) {
    const achado = Object.values(estado.profissionais || {}).find((p) => {
      const pNome = (p.nome || '').toLowerCase();
      if (/dino/i.test(profIdReal) && /dino/i.test(pNome)) return true;
      if (/bruno/i.test(profIdReal) && /bruno/i.test(pNome)) return true;
      if (/nati/i.test(profIdReal) && /nati/i.test(pNome)) return true;
      return p.id === profIdReal;
    });
    if (achado) profIdReal = achado.id;
  }
  if (!profIdReal || !estado.profissionais?.[profIdReal]) {
    profIdReal = Object.keys(estado.profissionais || {}).find(k => estado.profissionais[k]?.ativo !== false) || 'prof-mtj69hhx-002';
  }

  // Resolução inteligente do serviço real
  let srvIdReal = servicoId;
  if (srvIdReal && !estado.servicos?.[srvIdReal]) {
    const achadoSrv = Object.values(estado.servicos || {}).find((s) => {
      if (s.ativo === false) return false;
      return /corte/i.test(s.nome);
    });
    if (achadoSrv) srvIdReal = achadoSrv.id;
  }
  if (!srvIdReal || !estado.servicos?.[srvIdReal]) {
    srvIdReal = Object.keys(estado.servicos || {}).find(k => estado.servicos[k]?.ativo !== false) || 'srv-mv1a0cds-029';
  }
  const servicoReal = estado.servicos?.[srvIdReal];

  const dadosAgendamento = {
    clienteNome: clienteNome || 'Cliente Encaixe',
    clienteTelefone: clienteTelefone || '',
    profissionalId: profIdReal,
    servicoId: srvIdReal,
    dataAgenda: data,
    horaLocal: horario,
    dataHora: `${data}T${horario}:00.000Z`,
    duracaoMinutos: servicoReal?.duracaoMinutos || 45,
    status: 'agendado',
    observacoes: observacoes || 'Encaixe via Painel de Vagas Ociosas',
    encaixe: true,
    permitirEncaixe: true,
    origem: 'painel_buracos_ia',
  };

  if (valor !== undefined && valor !== null && valor !== '') {
    dadosAgendamento.valor = Number(valor);
  } else if (servicoReal?.preco !== undefined) {
    dadosAgendamento.valor = Number(servicoReal.preco);
  }

  const agendamentoCriado = criarAgendamento(empresaId, dadosAgendamento, { permitirEncaixe: true });

  kyttoEventBus.emitir('agenda.encaixe_realizado', {
    empresaId,
    agendamentoId: agendamentoCriado?.id,
    clienteNome,
    data,
    horario,
  });

  return {
    ok: true,
    sucesso: true,
    agendamento: agendamentoCriado,
    mensagem: `Encaixe confirmado para ${clienteNome} em ${data} às ${horario}!`,
  };
}

function somarMinutosHora(horaStr, minutosSomar = 45) {
  const [h, m] = String(horaStr || '09:00').split(':').map(Number);
  const total = h * 60 + m + minutosSomar;
  const novoH = Math.floor(total / 60) % 24;
  const novoM = total % 60;
  return `${String(novoH).padStart(2, '0')}:${String(novoM).padStart(2, '0')}`;
}
