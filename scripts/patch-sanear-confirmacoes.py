import re

caminho = 'app/barbearia-erp-kytto.js'
with open(caminho, 'r', encoding='utf8') as f:
    conteudo = f.read()

# 1. Substituir o bloco que barra a confirmacao por prazo expirado
bloco_antigo = """  if (novoStatus === 'confirmado' && atual.confirmacaoAutomatica?.ativa === true
      && atual.confirmacaoAutomatica.status === 'segunda_enviada'
      && new Date(atual.confirmacaoAutomatica.prazoRespostaAte || 0).valueOf() <= Date.now()) {
    const erro = new Error('O prazo para confirmar este agendamento expirou. A equipe precisa revisar o horário.');
    erro.code = 'CONFIRMACAO_PRAZO_EXPIRADO';
    throw erro;
  }"""

bloco_novo = """  // Na Barbearia Dino e Kytto: Confirmação de cliente e recepção NUNCA expira nem é bloqueada!
  // Se o cliente ou a equipe confirmou, o agendamento é imediatamente confirmado com sucesso."""

if bloco_antigo in conteudo:
    conteudo = conteudo.replace(bloco_antigo, bloco_novo)
    print("Bloco CONFIRMACAO_PRAZO_EXPIRADO removido com sucesso!")
else:
    print("AVISO: Bloco exato nao encontrado, procurando por regex...")
    conteudo = re.sub(
        r"if\s*\(novoStatus\s*===\s*'confirmado'\s*&&[\s\S]*?CONFIRMACAO_PRAZO_EXPIRADO[\s\S]*?throw erro;\s*\}",
        bloco_novo,
        conteudo
    )
    print("Substituido por regex!")

# 2. Ao confirmar, sempre limpar qualquer prazo e registrar confirmacao
antigo_confirmado = """  if (novoStatus === 'confirmado' && atual.confirmacaoAutomatica?.ativa === true) {
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'confirmado', confirmadoEm: dataAtual(), prazoRespostaAte: null };
  } else if (novoStatus === 'cancelado' && atual.confirmacaoAutomatica) {
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'cancelado', prazoRespostaAte: null };
  }"""

novo_confirmado = """  if (novoStatus === 'confirmado') {
    if (atual.confirmacaoAutomatica) {
      atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, ativa: false, status: 'confirmado', confirmadoEm: dataAtual(), prazoRespostaAte: null };
    }
    if (atual.motivoCancelamento === 'falta_confirmacao') atual.motivoCancelamento = '';
  } else if (novoStatus === 'cancelado' && atual.confirmacaoAutomatica) {
    atual.confirmacaoAutomatica = { ...atual.confirmacaoAutomatica, status: 'cancelado', prazoRespostaAte: null };
  }"""

if antigo_confirmado in conteudo:
    conteudo = conteudo.replace(antigo_confirmado, novo_confirmado)
    print("Atualizacao de confirmacaoAutomatica ajustada com sucesso!")
else:
    print("Aviso: antigo_confirmado nao encontrado de forma literal.")

# 3. Adicionar sanearConfirmacoesDino antes de recebimentoAgendamentoVerificado
alvo_sanear = "export function recebimentoAgendamentoVerificado("
funcao_sanear = """export function sanearConfirmacoesDino(empresaId) {
  const estado = estadoEmpresa(empresaId);
  let restaurados = 0;
  let prazosLimpos = 0;
  for (const ag of Object.values(estado.agendamentos || {})) {
    // 1. Limpar travas de prazo em todos os agendamentos
    if (ag.confirmacaoAutomatica?.prazoRespostaAte || ag.confirmacaoAutomatica?.status === 'segunda_enviada') {
      ag.confirmacaoAutomatica.prazoRespostaAte = null;
      if (ag.confirmacaoAutomatica.status === 'segunda_enviada') {
        ag.confirmacaoAutomatica.status = ag.status === 'confirmado' ? 'confirmado' : 'primeira_enviada';
      }
      ag.confirmacaoAutomatica.ativa = false;
      prazosLimpos++;
    }
    // 2. Restaurar agendamentos cancelados indevidamente por falta_confirmacao
    if (ag.status === 'cancelado' && (ag.motivoCancelamento === 'falta_confirmacao' || ag.confirmacaoAutomatica?.status === 'cancelado_falta_confirmacao')) {
      const dAg = String(ag.dataAgenda || ag.dataHora || '').slice(0, 10);
      if (dAg >= '2026-11-05') {
        ag.status = (ag.observacoes && ag.observacoes.toLowerCase().includes('confirmad')) ? 'confirmado' : 'agendado';
        ag.motivoCancelamento = '';
        if (ag.confirmacaoAutomatica) {
          ag.confirmacaoAutomatica.status = ag.status === 'confirmado' ? 'confirmado' : 'aguardando';
          ag.confirmacaoAutomatica.canceladoEm = null;
          ag.confirmacaoAutomatica.prazoRespostaAte = null;
          ag.confirmacaoAutomatica.ativa = false;
        }
        ag.atualizadoEm = dataAtual();
        restaurados++;
      }
    }
  }
  if (prazosLimpos > 0 || restaurados > 0) save();
  return { prazosLimpos, restaurados };
}

export function recebimentoAgendamentoVerificado("""

if alvo_sanear in conteudo:
    conteudo = conteudo.replace(alvo_sanear, funcao_sanear)
    print("Funcao sanearConfirmacoesDino inserida com sucesso!")
else:
    print("Erro: alvo_sanear nao encontrado!")

with open(caminho, 'w', encoding='utf8') as f:
    f.write(conteudo)
print("Arquivo app/barbearia-erp-kytto.js atualizado!")
