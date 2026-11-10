with open('app/dino-captacao-kytto.js', 'r', encoding='utf8') as f:
    code = f.read()

target = """  if (resumo.situacaoPagamento === 'inadimplente') throw new CaptacaoError('Assinatura com pagamento em atraso: regularize antes de usar o plano.', 'ASSINATURA_INADIMPLENTE', 409);
  if (resumo.situacaoPagamento === 'aguardando_pagamento') throw new CaptacaoError('A assinatura ainda não tem pagamento confirmado.', 'ASSINATURA_SEM_PAGAMENTO', 409);"""

replacement = """  const permitirVencido = dados.permitirVencido === true || dados.toleranciaVencido === true || dados.origemComanda === true || Boolean(dados.comandaId);
  if (!permitirVencido) {
    if (resumo.situacaoPagamento === 'inadimplente') throw new CaptacaoError('Assinatura com pagamento em atraso: regularize antes de usar o plano.', 'ASSINATURA_INADIMPLENTE', 409);
    if (resumo.situacaoPagamento === 'aguardando_pagamento') throw new CaptacaoError('A assinatura ainda não tem pagamento confirmado.', 'ASSINATURA_SEM_PAGAMENTO', 409);
  }"""

code = code.replace(target, replacement)

target2 = """  if (resumo.situacaoPagamento !== 'em_dia') throw new CaptacaoError('O pacote não está disponível nesta data. Verifique o início e o vencimento.', 'ASSINATURA_FORA_DA_VALIDADE',409);"""

replacement2 = """  if (resumo.situacaoPagamento !== 'em_dia' && !permitirVencido) throw new CaptacaoError('O pacote não está disponível nesta data. Verifique o início e o vencimento.', 'ASSINATURA_FORA_DA_VALIDADE',409);"""

code = code.replace(target2, replacement2)

with open('app/dino-captacao-kytto.js', 'w', encoding='utf8') as f:
    f.write(code)

print("dino-captacao-kytto.js atualizado com sucesso!")
