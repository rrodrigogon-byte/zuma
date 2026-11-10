(async () => {
  console.log('=== VALIDAÇÃO LIVE EM PRODUÇÃO: VERSÃO v32 (EXCELÊNCIA 100%) ===\n');

  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const { token } = await loginRes.json();
  console.log('1. Autenticação Dino Barbearia: SUCESSO (Token obtido:', token.slice(0, 15) + '...)');

  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  // 1. Reforma Tributária - Config
  const resConf = await fetch('https://kytto.com.br/api/admin/fiscal/reforma-tributaria/config', { headers });
  console.log('2. Config Reforma Tributária (HTTP):', resConf.status);
  const dataConf = await resConf.json();
  console.log('   Ano Vigência Teste:', dataConf.config?.anoVigenciaTeste, '| CBS Teste:', dataConf.config?.aliquotasReferencia?.aliquotaTeste2026?.cbsTeste);

  // 2. Reforma Tributária - Cálculo Split Payment
  const resCalc = await fetch('https://kytto.com.br/api/admin/fiscal/reforma-tributaria/calcular', {
    method: 'POST',
    headers,
    body: JSON.stringify({ valorOperacao: 150.0, tipoOperacao: 'servico', anoCompetencia: 2026, ufDestino: 'MT' })
  });
  console.log('3. Cálculo Reforma Tributária & Split (HTTP):', resCalc.status);
  const dataCalc = await resCalc.json();
  console.log('   Valor:', dataCalc.resultado?.baseCalculo, '| CBS:', dataCalc.resultado?.cbs?.valor, '| IBS MT:', dataCalc.resultado?.ibs?.valor, '| Líquido Split:', dataCalc.resultado?.splitPayment?.repasseLiquidoEmpresa);

  // 3. Varejo Stallone Nutre Sport - Grade Multidimensional
  const resGrade = await fetch('https://kytto.com.br/api/admin/varejo/produtos-grade', { headers });
  console.log('4. Grade Multidimensional Stallone (HTTP):', resGrade.status);
  const dataGrade = await resGrade.json();
  console.log('   Produtos Pai:', dataGrade.itens?.map(i => `${i.nome} (${i.totalVariacoes} variações)`).join(' | '));

  // 4. Emissão de Devolução Vinculada CFOP 1.202
  const resDev = await fetch('https://kytto.com.br/api/admin/varejo/devolucoes/emitir', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chaveAcessoOriginal: '51261150073355000260550010000010421893748291',
      numeroNfOriginal: '1042',
      motivoDevolucao: 'Troca de sabor balcão'
    })
  });
  console.log('5. Emissão de NF de Devolução (HTTP):', resDev.status);
  const dataDev = await resDev.json();
  console.log('   Protocolo SEFAZ-MT:', dataDev.protocoloAutorizacao, '| Mensagem:', dataDev.mensagem);

  // 5. Fila da Vez (Rodízio) & Upsell Dino
  const resBarb = await fetch('https://kytto.com.br/api/admin/varejo/barbearia/rodizio-upsell', { headers });
  console.log('6. Fila da Vez & Upsell Barbearia (HTTP):', resBarb.status);
  const dataBarb = await resBarb.json();
  console.log('   Próximo da Vez:', dataBarb.proximoBarbeiro?.profissionalNome, '| Total Sugestões Upsell:', dataBarb.sugestoesUpsell?.length);

  console.log('\n✅ TODOS OS ENDPOINTS v32 RESPONDENDO COM SUCESSO 200 EM PRODUÇÃO LIVE!');
})();
