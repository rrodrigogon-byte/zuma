async function testarProducao() {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', pass: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.session?.token;
  console.log('Login Dino OK! Token obtido:', !!token);

  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  // 1. Licenciamento Status
  const licStatus = await fetch('https://kytto.com.br/api/admin/licenciamento/status', { headers });
  console.log('1. /api/admin/licenciamento/status -> Status:', licStatus.status, await licStatus.json());

  // 2. Licenciamento Instancias
  const licInstancias = await fetch('https://kytto.com.br/api/admin/licenciamento/instancias', { headers });
  const instData = await licInstancias.json();
  console.log('2. /api/admin/licenciamento/instancias -> Status:', licInstancias.status, 'Total Instâncias:', instData.instancias?.length, 'Cotas:', Object.keys(instData.cotas || {}));

  // 3. IA Advisor Dashboard
  const iaDash = await fetch('https://kytto.com.br/api/admin/ia-advisor/dashboard', { headers });
  const dashData = await iaDash.json();
  console.log('3. /api/admin/ia-advisor/dashboard -> Status:', iaDash.status, 'Score Saúde:', dashData.scoreSaude, 'Forecast Projetado:', dashData.forecast?.faturamentoProjetadoFormatado);

  // 4. IA Advisor Simulador
  const iaSimul = await fetch('https://kytto.com.br/api/admin/ia-advisor/simulador-cenarios', {
    method: 'POST',
    headers,
    body: JSON.stringify({ reajustePrecoPercentual: 10, aumentoAtendimentosPercentual: 15, novosColaboradores: 1 })
  });
  const simulData = await iaSimul.json();
  console.log('4. /api/admin/ia-advisor/simulador-cenarios -> Status:', iaSimul.status, 'Delta Lucro Mensal:', simulData.simulado?.deltaLucroMensalFormatado, 'Parecer:', simulData.parecerIa);

  // 5. Cross-Selling
  const cross = await fetch('https://kytto.com.br/api/admin/ia-advisor/cross-selling?servico=corte', { headers });
  console.log('5. /api/admin/ia-advisor/cross-selling -> Status:', cross.status, await cross.json());
}

testarProducao().catch(console.error);
