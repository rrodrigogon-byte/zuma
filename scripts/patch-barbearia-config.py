with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """export function obterConfiguracao(empresaId) {
  const configuracao = estadoEmpresa(empresaId, false).configuracao;
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresaId || '').toLowerCase());
  const ativa = isDino ? configuracao.confirmacaoAutomaticaAtiva !== false : configuracao.confirmacaoAutomaticaAtiva === true;
  return { ...configuracao, confirmacaoAutomaticaAtiva: ativa, lojas: { ...(configuracao.lojas || {}) } };
}"""

replacement = """export function obterConfiguracao(empresaId) {
  const configuracao = estadoEmpresa(empresaId, false).configuracao;
  const isDino = ['d0d0ac01-8e50-4b61-8c79-de4aaa916da6', 'emp_dino', 'dino'].includes(String(empresaId || '').toLowerCase());
  // Na Dino Barbearia, NUNCA ativar cancelamento automático por falta de confirmação!
  const ativa = isDino ? false : configuracao.confirmacaoAutomaticaAtiva === true;
  return {
    ...configuracao,
    confirmacaoAutomaticaAtiva: ativa,
    cancelamentoAutomaticoPorFaltaConfirmacao: false,
    lojas: { ...(configuracao.lojas || {}) },
  };
}"""

if target in c:
    c = c.replace(target, replacement)
    with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('obterConfiguracao atualizado com sucesso!')
else:
    print('Target obterConfiguracao nao encontrado!')
