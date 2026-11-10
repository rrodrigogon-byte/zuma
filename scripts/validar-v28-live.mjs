const loginRes = await fetch('https://kytto.com.br/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: 'dino', senha: '123456' })
});
const loginData = await loginRes.json();
const token = loginData.token;
console.log('Login Dino:', token ? 'Sucesso' : 'Falha');

const headers = { 'Authorization': 'Bearer ' + token };

// 1. SPED Download EFD
const resSpedTxt = await fetch('https://kytto.com.br/api/admin/sped/download-efd?mes=10&ano=2026', { headers });
const txt = await resSpedTxt.text();
console.log('SPED TXT Status:', resSpedTxt.status, 'Tamanho:', txt.length, 'Linhas:', txt.split('\n').length);
console.log('Primeiras 5 linhas do SPED TXT:\n' + txt.split('\r\n').slice(0, 5).join('\n'));

// 2. EFD-Reinf Salao Parceiro
const resReinf = await fetch('https://kytto.com.br/api/admin/sped/efd-reinf/salao-parceiro', { headers });
const dReinf = await resReinf.json();
console.log('EFD-Reinf Salao Parceiro:', dReinf.sucesso ? 'OK' : 'Falha', 'Economia Bitributacao: R$', dReinf.economiaTributariaBitributacaoEvitada);

// 3. KDS Fila
const resKds = await fetch('https://kytto.com.br/api/admin/delivery/kds', { headers });
const dKds = await resKds.json();
console.log('KDS Fila:', dKds.sucesso ? 'OK' : 'Falha', 'Qtd:', dKds.fila?.length);

// 4. Zonas de Frete Tangará MT
const resZon = await fetch('https://kytto.com.br/api/admin/delivery/zonas-frete', { headers });
const dZon = await resZon.json();
console.log('Zonas de Frete Tangara MT:', dZon.sucesso ? 'OK' : 'Falha', 'Qtd:', dZon.zonas?.length);

// 5. Comanda Térmica 80mm
const resCom = await fetch('https://kytto.com.br/api/admin/delivery/pedidos/ped-101/comanda-termica', { headers });
const dCom = await resCom.json();
console.log('Comanda Termica 80mm:', dCom.sucesso ? 'OK' : 'Falha', 'Tamanho Texto:', dCom.comandaTexto?.length);

// 6. Fechamento de Acerto Motoboy
const resAcerto = await fetch('https://kytto.com.br/api/admin/delivery/entregadores/moto-01/fechar-acerto', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ observacoes: 'Turno almoço' })
});
const dAcerto = await resAcerto.json();
console.log('Fechamento Acerto Motoboy:', dAcerto.sucesso ? 'OK' : 'Falha', 'Liquido: R$', dAcerto.fechamento?.totalLiquidoPago);
