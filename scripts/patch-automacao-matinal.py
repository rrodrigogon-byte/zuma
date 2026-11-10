with open('app/core/automacao-resumo-gestao.js', 'r', encoding='utf8') as f:
    code = f.read()

nova_funcao = '''

/**
 * Consolida o briefing operacional matinal da equipe (agenda do dia e metas).
 */
export function consolidarBriefingMatinalEquipe(empresaId = EMPRESA_DINO_ID, dataFiltro = null) {
  const diaAlvo = dataFiltro || new Date().toISOString().split('T')[0];
  const agendamentos = barbearia.listarAgendamentos ? barbearia.listarAgendamentos(empresaId, { data: diaAlvo }) : [];
  const profissionais = barbearia.listarProfissionais ? barbearia.listarProfissionais(empresaId) : [];

  const ativos = agendamentos.filter(a => ['agendado', 'confirmado'].includes(a.status));
  const confirmados = ativos.filter(a => a.status === 'confirmado');
  const pendentesConfirmacao = ativos.filter(a => a.status === 'agendado');

  const gradePorProfissional = {};
  for (const prof of profissionais) {
    gradePorProfissional[prof.id] = {
      id: prof.id,
      nome: prof.nome,
      apelido: prof.apelido || prof.nome.split(' ')[0],
      totalAgendados: 0,
      horarios: []
    };
  }

  for (const a of ativos) {
    const pId = a.profissionalId;
    if (!gradePorProfissional[pId]) {
      gradePorProfissional[pId] = {
        id: pId,
        nome: a.profissionalNome || 'Barbeiro',
        apelido: (a.profissionalNome || 'Barbeiro').split(' ')[0],
        totalAgendados: 0,
        horarios: []
      };
    }
    gradePorProfissional[pId].totalAgendados++;
    gradePorProfissional[pId].horarios.push({
      horario: (a.dataHora || '').split('T')[1]?.slice(0, 5) || a.horario || '—',
      clienteNome: a.clienteNome || 'Cliente',
      servicoNome: a.servicoNome || 'Serviço',
      status: a.status
    });
  }

  const [ano, mes, dia] = diaAlvo.split('-');
  const dataBr = `${dia}/${mes}/${ano}`;

  return {
    empresaId,
    data: diaAlvo,
    dataBr,
    totalAgendamentos: ativos.length,
    totalConfirmados: confirmados.length,
    totalPendentes: pendentesConfirmacao.length,
    equipe: Object.values(gradePorProfissional).filter(p => p.totalAgendados > 0 || profissionais.some(pr => pr.id === p.id))
  };
}

/**
 * Formata mensagem de briefing matinal para WhatsApp.
 */
export function formatarMensagemBriefingMatinal(briefing) {
  const linhasEquipe = briefing.equipe.map(p => {
    const horariosTxt = p.horarios.length > 0 
      ? p.horarios.slice(0, 4).map(h => `${h.horario} (${h.clienteNome.split(' ')[0]})`).join(', ') + (p.horarios.length > 4 ? ` +${p.horarios.length - 4}` : '')
      : 'Vagas livres para encaixe';
    return `  • *${p.apelido || p.nome}:* ${p.totalAgendados} cliente(s) · _${horariosTxt}_`;
  }).join('\\n');

  return `🌅 *BRIEFING MATINAL DA EQUIPE — ${briefing.dataBr}* 💈\\nBarbearia Dino · Kytto ERP\\n\\n📅 *Agenda Total do Dia:* ${briefing.totalAgendamentos} agendamentos\\n  ✅ Confirmados: ${briefing.totalConfirmados}\\n  ⏳ Pendentes de confirmação: ${briefing.totalPendentes}\\n\\n✂️ *Escala dos Profissionais:*\\n${linhasEquipe}\\n\\n🎯 *Foco do Dia:* Oferecer barba ou hidratação no atendimento para alavancar a meta da semana!\\n\\n✨ _Tenham um dia de muito sucesso e cortes impecáveis!_`;
}

/**
 * Envia o briefing matinal para a equipe/gestão.
 */
export async function enviarBriefingMatinalEquipe(empresaId = EMPRESA_DINO_ID, dataFiltro = null, telefoneDestino = null) {
  const briefing = consolidarBriefingMatinalEquipe(empresaId, dataFiltro);
  const mensagem = formatarMensagemBriefingMatinal(briefing);

  const conexaoGestao = obterConexao(empresaId, 'gestao');
  const instance = conexaoGestao?.instance || 'barbearia-dino-gestao';
  const telefone = telefoneDestino || conexaoGestao?.phone || '5565999990000';

  let enviado = false;
  let erro = null;

  try {
    await enviarMensagem({
      empresaId,
      instance,
      telefone,
      mensagem
    });
    enviado = true;
  } catch (err) {
    erro = err.message;
  }

  kyttoEventBus.emitir('agenda.briefing_matinal', {
    data: briefing.data,
    totalAgendamentos: briefing.totalAgendamentos,
    enviado,
    erro
  }, { empresaId, origem: 'automacao-resumo-gestao' });

  return {
    ok: true,
    briefing,
    mensagem,
    enviado,
    erro
  };
}
'''

with open('app/core/automacao-resumo-gestao.js', 'a', encoding='utf8') as f:
    f.write(nova_funcao)

print("Briefing matinal adicionado com sucesso em automacao-resumo-gestao.js!")
