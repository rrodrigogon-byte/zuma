(async () => {
  const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const data = await loginRes.json();
  const token = data.token;

  const profRes = await fetch('https://kytto.com.br/api/admin/barbearia/profissionais?incluirInativos=false', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const profData = await profRes.json();
  console.log('Profissionais ATIVOS:');
  for (const p of profData.profissionais || []) {
    console.log(`- ${p.id} | ${p.nome} | Inicio: ${p.horarioInicio} | Fim: ${p.horarioFim} | Dias: ${JSON.stringify(p.diasTrabalho)} | 24x7: ${p.atendimento24x7}`);
  }
})();
