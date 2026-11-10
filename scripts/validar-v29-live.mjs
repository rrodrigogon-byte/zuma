const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: 'dino', senha: '123456' })
});
const loginData = await loginRes.json();
const token = loginData.token;
console.log('Login Dino:', token ? 'Sucesso' : 'Falha');

const headers = { 'Authorization': 'Bearer ' + token };

// 1. Auditoria DIMP vs Fiscal
const resDimp = await fetch('https://kytto.com.br/api/admin/dimp-auditoria/auditar?mes=10&ano=2026', { headers });
const dDimp = await resDimp.json();
console.log('Auditoria DIMP Status:', resDimp.status, 'Sucesso:', dDimp.sucesso);
console.log('Total Meios Pagamento (DIMP): R$', dDimp.totaisMeiosPagamento?.totalGeral);
console.log('Total Notas Fiscais: R$', dDimp.totaisDocumentosFiscais?.totalGeral);
console.log('Divergência: R$', dDimp.analiseDivergencia?.diferencaNaoFaturada, 'Risco:', dDimp.analiseDivergencia?.nivelRisco);
console.log('Vendas Pendentes:', dDimp.vendasPendentesEmissao?.length);

// 2. Supply Chain - Cotações RFQ
const resCot = await fetch('https://kytto.com.br/api/admin/supply-chain/cotacoes', { headers });
const dCot = await resCot.json();
console.log('Supply Chain Cotações:', dCot.sucesso ? 'OK' : 'Falha', 'Total:', dCot.total);
console.log('Primeira Cotação:', dCot.cotacoes[0]?.numero, 'Itens:', dCot.cotacoes[0]?.itensSolicitados?.length, 'Fornecedores:', dCot.cotacoes[0]?.propostasFornecedores?.length);

// 3. Supply Chain - Pedidos de Compra (PO)
const resPed = await fetch('https://kytto.com.br/api/admin/supply-chain/pedidos-compra', { headers });
const dPed = await resPed.json();
console.log('Pedidos de Compra (PO):', dPed.sucesso ? 'OK' : 'Falha', 'Total:', dPed.total);
console.log('Primeiro Pedido:', dPed.pedidos[0]?.numero, 'Valor: R$', dPed.pedidos[0]?.valorTotal);

// 4. Conferência 3-Way Matching
const resMatch = await fetch(`https://kytto.com.br/api/admin/supply-chain/pedidos-compra/${dPed.pedidos[0]?.id}/3-way-matching`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
const dMatch = await resMatch.json();
console.log('3-Way Matching:', dMatch.sucesso ? 'OK' : 'Falha', 'Status:', dMatch.statusMatching);

// 5. Regularização DIMP em Lote
const resReg = await fetch('https://kytto.com.br/api/admin/dimp-auditoria/regularizar-lote', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ itens: dDimp.vendasPendentesEmissao })
});
const dReg = await resReg.json();
console.log('Regularização Lote DIMP:', dReg.sucesso ? 'OK' : 'Falha', 'Novo Risco:', dReg.novoNivelRisco, 'Notas Emitidas:', dReg.quantidadeNotasEmitidas);
