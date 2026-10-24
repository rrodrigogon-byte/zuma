// Agenda histórica do Avec na agenda da equipe.
//
// O Avec exportou os atendimentos com o NOME COMPLETO do profissional, enquanto
// a equipe ativa foi cadastrada com o nome curto da grade da agenda. A ligação é
// explícita (sem adivinhar pelo primeiro nome: houve mais de um "Bruno"); quem
// não está na tabela continua como profissional histórico próprio.
// O Avec não exporta a hora do atendimento: quando a comanda fechou no mesmo dia,
// a hora de fechamento é exibida como referência, marcada como tal.

const ALIAS_AVEC_DINO = new Map([
  ['bruno mendes pedroso', 'bruno'],
  ['natani minanis dobler', 'natani'],
  ['guilherme cunha martins', 'dino'],
  ['david kaua araujo moraes', 'david'],
  ['joao victor domingos ruedel', 'joao'],
]);

export function normalizarNome(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Profissional ativo correspondente ao nome histórico do Avec (ou null).
export function profissionalAtivoDoHistorico(nomeHistorico, profissionais = []) {
  const alvo = ALIAS_AVEC_DINO.get(normalizarNome(nomeHistorico));
  if (!alvo) return null;
  const candidatos = profissionais.filter((item) => item && normalizarNome(item.nome) === alvo);
  return candidatos.length === 1 ? candidatos[0] : null;
}

function horaDeFechamentoMesmoDia(comanda, dia) {
  const match = String(comanda?.dataFinalizacaoOriginal || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match || `${match[3]}-${match[2]}-${match[1]}` !== dia) return '';
  return `${match[4]}:${match[5]}`;
}

/**
 * Converte o histórico Avec no formato de itens da agenda (somente leitura).
 * `profissionalId` filtra pelo profissional ativo (ou pelo id histórico).
 */
export function agendaHistoricaAvec({ historico = [], comandas = [], profissionais = [], profissionalId = '' } = {}) {
  const fechamento = new Map();
  for (const comanda of comandas) {
    const dia = String(comanda?.dataComandaIso || '').slice(0, 10);
    const hora = horaDeFechamentoMesmoDia(comanda, dia);
    if (dia && comanda?.numeroComanda && hora) fechamento.set(`${dia}|${comanda.numeroComanda}`, hora);
  }
  const filtro = String(profissionalId || '').split(',').map((item) => item.trim()).filter(Boolean);
  return historico
    .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.dataAgenda || '')))
    .map((item) => {
      const ativo = profissionalAtivoDoHistorico(item.profissionalNome, profissionais);
      const hora = fechamento.get(`${item.dataAgenda}|${item.numeroComanda}`) || '';
      return {
        id: item.id,
        historico: true,
        origem: 'avec',
        status: 'concluido',
        dataAgenda: item.dataAgenda,
        hora,
        horaReferencia: hora ? 'fechamento_comanda' : '',
        clienteNome: item.clienteNome || '',
        servicoNome: item.servicoNome || '',
        profissionalId: ativo?.id || item.profissionalId || '',
        profissionalIdHistorico: item.profissionalId || '',
        profissionalNome: ativo?.nome || item.profissionalNome || 'Não informado',
        profissionalNomeAvec: item.profissionalNome || '',
        numeroComanda: item.numeroComanda || '',
        total: item.total,
      };
    })
    .filter((item) => !filtro.length || filtro.includes(item.profissionalId) || filtro.includes(item.profissionalIdHistorico))
    .sort((a, b) => `${a.dataAgenda} ${a.hora || '99:99'}`.localeCompare(`${b.dataAgenda} ${b.hora || '99:99'}`));
}
