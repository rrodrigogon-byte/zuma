import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DB_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'venda-pacotes-')),'db.json');
process.env.BARBEARIA_AGENDA_FONTE='barbearia';
const {createWhatsappAiToolExecutor,WHATSAPP_AI_TOOL_DECLARATIONS}=await import('./whatsapp-ai-tools.js');
const {unbackedPrices}=await import('./whatsapp-ai-normalize.js');
const {validateWhatsappAiOutput}=await import('./whatsapp-ai-profile.js');
const barbearia=await import('../barbearia-erp-kytto.js');
const {db}=await import('./database.js');db.queryRead=async()=>({rows:[]});

const CONTEXTO = {
  empresaId: '11111111-1111-4111-8111-111111111111',
  lojaId: '22222222-2222-4222-8222-222222222222',
  canalId: '33333333-3333-4333-8333-333333333333',
  sessionId: '44444444-4444-4444-8444-444444444444',
  phone: '5565999887766',
  customerText: 'quero conhecer os pacotes; corto a cada 15 dias e faco a barba tambem',
  sessionSnapshot: {
    last_professional: 'Nati',
  },
};

// Valores são fixtures cadastradas explicitamente: o cálculo não presume esta tabela.
for(const [nome,preco,valores] of [['Nati',100,[360,510,640]],['David',80,[288,408,512]]]){
 const profissional=barbearia.criarProfissional(CONTEXTO.empresaId,{nome});
 const corte=barbearia.criarServico(CONTEXTO.empresaId,{nome:`Corte ${nome}`,preco,profissionaisIds:[profissional.id]});
 const barba=barbearia.criarServico(CONTEXTO.empresaId,{nome:`Barba ${nome}`,preco,profissionaisIds:[profissional.id]});
 [4,6,8].forEach((q,i)=>barbearia.criarPlano(CONTEXTO.empresaId,{nome:`Pacote ${q} ${nome}`,preco:valores[i],sessoesIncluidas:q,servicosIds:[corte.id,barba.id]}));
}

test('1. Tool calcular_pacote_frequencia está devidamente declarada na allowlist', () => {
  const tool = WHATSAPP_AI_TOOL_DECLARATIONS.find((t) => t.name === 'calcular_pacote_frequencia');
  assert.ok(tool, 'ferramenta calcular_pacote_frequencia deve existir nas declarações');
  assert.equal(tool.parameters.type, 'OBJECT');
  assert.ok(tool.description.includes('pacotes mensais'), 'descrição deve orientar o modelo');
});

test('2. Cálculo com profissional Bruno ou Nati (base R$ 100) para cliente quinzenal combo', async () => {
  const executor = createWhatsappAiToolExecutor(CONTEXTO);
  const res = await executor('calcular_pacote_frequencia', {
    profissional: 'Nati',
    frequenciaTexto: 'a cada 15 dias',
    procedimentosDesejados: 'ambos',
  });

  assert.equal(res.ok, true);
  assert.equal(res.pacotes[0].valorCheio/res.pacotes[0].procedimentos,100);
  assert.equal(res.profissional,'Nati');

  // 4 procedimentos (10% off)
  const p4 = res.pacotes.find((p) => p.procedimentos === 4);
  assert.ok(p4);
  assert.equal(p4.valorCheio, 400);
  assert.equal(p4.valorComDesconto, 360);
  assert.equal(p4.economia, 40);
  assert.equal(p4.desconto, '10%');

  // 6 procedimentos (15% off)
  const p6 = res.pacotes.find((p) => p.procedimentos === 6);
  assert.ok(p6);
  assert.equal(p6.valorCheio, 600);
  assert.equal(p6.valorComDesconto, 510);
  assert.equal(p6.economia, 90);
  assert.equal(p6.desconto, '15%');

  // 8 procedimentos (20% off)
  const p8 = res.pacotes.find((p) => p.procedimentos === 8);
  assert.ok(p8);
  assert.equal(p8.valorCheio, 800);
  assert.equal(p8.valorComDesconto, 640);
  assert.equal(p8.economia, 160);
  assert.equal(p8.desconto, '20%');

  // Recomendação inteligente para cliente a cada 15 dias com corte + barba
  assert.equal(res.recomendacao.pacote,'Pacote 4 Nati');
  assert.match(res.recomendacao.motivo,/4 procedimentos em 30 dias/i);
});

test('3. Cálculo com profissional David (base R$ 80) para cliente semanal combo', async () => {
  const executor = createWhatsappAiToolExecutor(CONTEXTO);
  const res = await executor('calcular_pacote_frequencia', {
    profissional: 'David',
    frequenciaTexto: 'toda semana',
    procedimentosDesejados: 'ambos',
  });

  assert.equal(res.ok, true);
  assert.equal(res.pacotes[0].valorCheio/res.pacotes[0].procedimentos,80);
  assert.equal(res.profissional, 'David');

  // 4 procedimentos (10% off sobre R$ 320)
  const p4 = res.pacotes.find((p) => p.procedimentos === 4);
  assert.equal(p4.valorCheio, 320);
  assert.equal(p4.valorComDesconto, 288);
  assert.equal(p4.economia, 32);

  // 6 procedimentos (15% off sobre R$ 480)
  const p6 = res.pacotes.find((p) => p.procedimentos === 6);
  assert.equal(p6.valorCheio, 480);
  assert.equal(p6.valorComDesconto, 408);
  assert.equal(p6.economia, 72);

  // 8 procedimentos (20% off sobre R$ 640)
  const p8 = res.pacotes.find((p) => p.procedimentos === 8);
  assert.equal(p8.valorCheio, 640);
  assert.equal(p8.valorComDesconto, 512);
  assert.equal(p8.economia, 128);

  // Frequência semanal pode exigir 10 procedimentos em 30 dias; não promete que 8 cobrem o mês.
  assert.equal(res.recomendacao,null);
});

test('4. Resposta com valores calculados é autorizada por unbackedPrices (sem preços inventados)', async () => {
  const executor = createWhatsappAiToolExecutor(CONTEXTO);
  const toolResult = await executor('calcular_pacote_frequencia', {
    profissional: 'Nati',
    frequenciaTexto: 'a cada 15 dias',
  });

  const textoAssistente = 'Você sabia que temos pacotes mensais para economizar e manter o visual alinhado? No pacote de 4 procedimentos com a Nati, você tem 10% de desconto: sai de R$ 400 por R$ 360, economizando R$ 40 no mês. Temos também o de 6 (15% off, de R$ 600 por R$ 510, economia de R$ 90) ou 8 procedimentos (20% off, de R$ 800 por R$ 640, economia de R$ 160). Faz sentido pra você?';

  // Verifica validação de preços: todos os preços na mensagem vieram do resultado da ferramenta!
  const violacoesPreco = unbackedPrices(textoAssistente, [toolResult]);
  assert.deepEqual(violacoesPreco, [], 'nenhum preço citado deve ser considerado inventado');

  // Se um preço arbitrário não calculado for inserido, o validador bloqueia
  const textoComPrecoInventado = `${textoAssistente} Temos outro por R$ 1.999.`;
  const violacoesComInventado = unbackedPrices(textoComPrecoInventado, [toolResult]);
  assert.deepEqual(violacoesComInventado, [199900], 'o preço inventado de R$ 1.999 deve ser detectado');
});

test('5. Mensagem consultiva de pacotes é aprovada pelo validador de saída sem censura', () => {
  const textoAssistente = 'Você sabia que temos pacotes mensais para você economizar e manter o visual sempre alinhado? Como você vem a cada 15 dias e faz cabelo e barba, você usa 4 procedimentos no mês. No pacote de 4 procedimentos com a Nati, você tem 10% de desconto: sai de R$ 400 por R$ 360 (já economiza R$ 40 no mês). Temos também de 6 (15% off) e 8 procedimentos (20% off). Faz sentido pra você garantir um pacote desse?';

  const validacao = validateWhatsappAiOutput(textoAssistente, {
    traces: [{name:'propor_oportunidade',ok:true},{ name: 'calcular_pacote_frequencia', ok: true }],
    opportunityAllowed: true,
  });

  assert.equal(validacao.ok, true);
  assert.deepEqual(validacao.violations, []);
});

test('6. Semeadura explícita na fixture cria os 6 planos sem execução na inicialização', () => {
  const EMPRESA_TESTE = 'emp-teste-pacotes-2026';
  // Garante estado inicial vazio
  barbearia.semearPacotesPadrao(EMPRESA_TESTE);
  const planos = barbearia.listarPlanos(EMPRESA_TESTE);

  assert.ok(planos.length >= 6, 'deve ter pelo menos os 6 pacotes criados');

  const p4Nati = planos.find((p) => p.nome === 'Pacote 4 Procedimentos (Bruno e Nati)');
  assert.ok(p4Nati);
  assert.equal(p4Nati.preco, 360);
  assert.equal(p4Nati.sessoesIncluidas, 4);

  const p6Nati = planos.find((p) => p.nome === 'Pacote 6 Procedimentos (Bruno e Nati)');
  assert.ok(p6Nati);
  assert.equal(p6Nati.preco, 510);
  assert.equal(p6Nati.sessoesIncluidas, 6);

  const p8Nati = planos.find((p) => p.nome === 'Pacote 8 Procedimentos (Bruno e Nati)');
  assert.ok(p8Nati);
  assert.equal(p8Nati.preco, 640);
  assert.equal(p8Nati.sessoesIncluidas, 8);

  const p4David = planos.find((p) => p.nome === 'Pacote 4 Procedimentos (David)');
  assert.ok(p4David);
  assert.equal(p4David.preco, 288);
  assert.equal(p4David.sessoesIncluidas, 4);

  const p6David = planos.find((p) => p.nome === 'Pacote 6 Procedimentos (David)');
  assert.ok(p6David);
  assert.equal(p6David.preco, 408);
  assert.equal(p6David.sessoesIncluidas, 6);

  const p8David = planos.find((p) => p.nome === 'Pacote 8 Procedimentos (David)');
  assert.ok(p8David);
  assert.equal(p8David.preco, 512);
  assert.equal(p8David.sessoesIncluidas, 8);
});
