async function validarAutomacoesProducao() {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login Dino OK! Token obtido:', !!token);

  const headers = {
    'Authorization': 'Bearer ' + token,
    'X-Empresa-Id': 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    'X-Loja-Id': 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8'
  };

  // 1. Status das Automações
  const statusRes = await fetch('https://kytto.com.br/api/admin/automacoes/status', { headers });
  const statusData = await statusRes.json();
  console.log('1. /api/admin/automacoes/status HTTP:', statusRes.status);
  console.log('Total de automações:', statusData.totalDisponiveis, '| Ativas:', statusData.totalAtivas);
  console.log('Métricas de eventos:', statusData.metricasEventos);

  // 2. Prévia de Planos para Renovação
  const planosRes = await fetch('https://kytto.com.br/api/admin/automacoes/planos/previa', { headers });
  const planosData = await planosRes.json();
  console.log('2. /api/admin/automacoes/planos/previa HTTP:', planosRes.status, '| Total pendências:', planosData.total);

  // 3. Prévia do Briefing Noturno
  const resumoRes = await fetch('https://kytto.com.br/api/admin/automacoes/resumo-dia', { headers });
  const resumoData = await resumoRes.json();
  console.log('3. /api/admin/automacoes/resumo-dia HTTP:', resumoRes.status);
  console.log('Faturamento calculado:', resumoData.resumo?.totalFaturadoFormatado);

  // 4. Executar rodada simulada e verificar emissão de evento
  const execRes = await fetch('https://kytto.com.br/api/admin/automacoes/vencimento_planos/executar', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ disparar: false })
  });
  const execData = await execRes.json();
  console.log('4. /api/admin/automacoes/vencimento_planos/executar HTTP:', execRes.status);
  console.log('Resultado da execução:', execData.ok, '| Pendências avaliadas:', execData.resultado?.totalPendencias);

  // 5. Consultar Monitor de Eventos Internos
  const eventosRes = await fetch('https://kytto.com.br/api/admin/automacoes/eventos?limite=10', { headers });
  const eventosData = await eventosRes.json();
  console.log('5. /api/admin/automacoes/eventos HTTP:', eventosRes.status, '| Eventos no log:', eventosData.total);
}

validarAutomacoesProducao().catch(console.error);
