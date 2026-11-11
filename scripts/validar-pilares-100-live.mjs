const BASE_URL = 'https://kytto.com.br';

async function main() {
  console.log('=== VALIDAÇÃO EM PRODUÇÃO LIVE DOS 6 PILARES (v38) ===');

  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'dino', senha: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error('Falha no login: ' + JSON.stringify(loginData));
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 1. Transmitir contingências na SEFAZ-MT
  const contRes = await fetch(`${BASE_URL}/api/admin/fiscal/contingencias/transmitir`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const contData = await contRes.json();
  console.log('[1. Contingência SEFAZ-MT]:', JSON.stringify(contData));

  // 2. Emitir NF-e modelo 55 na SEFAZ-MT
  const nfe55Res = await fetch(`${BASE_URL}/api/admin/fiscal/documentos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idempotencia: (await (await fetch(BASE_URL + '/api/admin/fiscal/documentos/88fc92d2-7847-4c64-a149-4978ffee5252', { headers })).json()).idempotencia || ('nfe55-dino-prod-' + Date.now()),
      modelo: '55',
      origem: 'manual',
      indPres: '1',
      destinatario: {
        cnpj: '50073355000189',
        nome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
        ie: '142291919',
        indIEDest: '1',
        endereco: {
          logradouro: 'Avelina Jaci Bohn, Qd 37, Lt 05',
          numero: '80',
          bairro: 'Centro',
          codigoMunicipio: '5107925',
          cidade: 'Tangara da Serra',
          uf: 'MT',
          cep: '78300060'
        }
      },
      itens: [
        {
          descricao: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          quantidade: 1,
          valorUnitario: 65.00,
          classificacao: {
            ncm: '33059000',
            cest: '2002000',
            cfop: '5102',
            csosn: '102',
            origem: '0',
            unidadeTributavel: 'UN'
          }
        }
      ],
      pagamentos: [{ meio: '01', valor: 65.00 }]
    })
  });
  const nfe55Data = await nfe55Res.json();
  console.log('[2. Emissão NF-e 55 SEFAZ-MT]:', JSON.stringify({
    statusHttp: nfe55Res.status,
    id: nfe55Data?.id,
    modelo: nfe55Data?.modelo,
    numero: nfe55Data?.numero,
    status: nfe55Data?.status,
    protocolo: nfe55Data?.protocolo,
    chave: nfe55Data?.chave,
    mensagens: nfe55Data?.mensagens,
    erro: nfe55Data?.error || nfe55Data?.message
  }));

  // 3. Agro & Balança Rodoviária + Receituário CREA
  const agroDash = await (await fetch(`${BASE_URL}/api/admin/agro/dashboard`, { headers })).json();
  const agroRec = await (await fetch(`${BASE_URL}/api/admin/agropecuaria/receituarios`, { headers })).json();
  console.log('[3. Agro & Receituário]:', JSON.stringify({
    safras: agroDash.safras?.length,
    silos: agroDash.silos?.length,
    receituariosCrea: agroRec.receituarios?.length
  }));

  // 4. CT-e 57 & MDF-e 58 SEFAZ-MT
  const ctePainel = await (await fetch(`${BASE_URL}/api/admin/cte-mdfe/painel`, { headers })).json();
  console.log('[4. CT-e 57 & MDF-e 58]:', JSON.stringify(ctePainel.resumo));

  // 5. Implantação Guiada (10 etapas)
  const impData = await (await fetch(`${BASE_URL}/api/admin/implantacao/status`, { headers })).json();
  console.log('[5. Implantação Go-Live]:', JSON.stringify({
    percentualConcluido: impData.percentualConcluido,
    statusImplantacao: impData.statusImplantacao,
    contingenciasPendentes: impData.contingenciasPendentes,
    etapasConcluidas: (impData.etapas || []).filter(e => e.concluida).length,
    totalEtapas: (impData.etapas || []).length
  }));
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
