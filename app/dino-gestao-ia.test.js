import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDinoGestaoSnapshot,
  buildDinoGestaoSystemPrompt,
  DINO_GESTAO_TOOLS,
  executarFerramentaGestao,
  formatBrl,
  dataHoraCuiaba,
} from './dino-gestao-ia.js';
import { createWhatsappAiToolExecutor } from './core/whatsapp-ai-tools.js';
import { managementSnapshot, managementSystemPrompt } from './core/whatsapp-ai.js';

const EMPRESA_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const LOJA_MATRIZ = 'loja-dino-matriz';

test('dataHoraCuiaba formata fuso Cuiabá corretamente', () => {
  const agora = dataHoraCuiaba(new Date('2026-10-26T20:00:00Z'));
  assert.equal(typeof agora.dataIso, 'string');
  assert.equal(agora.dataIso.length, 10);
  assert.equal(typeof agora.hora, 'string');
  assert.equal(typeof agora.diaSemana, 'string');
  assert.equal(typeof agora.dataExtenso, 'string');
});

test('buildDinoGestaoSnapshot consolida indicadores reais da Barbearia Dino', () => {
  const snap = buildDinoGestaoSnapshot({ empresaId: EMPRESA_DINO, lojaId: LOJA_MATRIZ });
  assert.ok(snap);
  assert.equal(snap.empresa.id, EMPRESA_DINO);
  assert.ok(snap.empresa.nome);
  assert.ok(snap.financeiro);
  assert.equal(typeof snap.financeiro.saldo, 'number');
  assert.ok(snap.agendaHoje);
  assert.equal(typeof snap.agendaHoje.total, 'number');
  assert.ok(Array.isArray(snap.equipe));
  assert.ok(snap.gamificacao);
  assert.ok(snap.gamificacao.regras);
  assert.equal(snap.gamificacao.regras.metaDiariaExtrasQtd, 6);
  assert.ok(Array.isArray(snap.gamificacao.premiosRoleta));
  assert.ok(snap.carteiraClientes);
  assert.ok(snap.carteiraClientes.totalGeralClientes >= 9365);
  assert.ok(snap.planosVIP);
  assert.ok(Array.isArray(snap.planosVIP.regrasPacotes));
});

test('buildDinoGestaoSystemPrompt inclui diretrizes de áudio, regras da roleta e FAQ do gestor', () => {
  const snap = buildDinoGestaoSnapshot({ empresaId: EMPRESA_DINO, lojaId: LOJA_MATRIZ });
  const prompt = buildDinoGestaoSystemPrompt({
    channel: { nome: 'WhatsApp Gestão Barbearia Dino', configuracao: { display_name: 'Dino Gestão' } },
    snapshot: snap,
  });

  assert.ok(prompt.includes('Copiloto Executivo'));
  assert.ok(prompt.includes('[áudio transcrito]'));
  assert.ok(prompt.includes('Guilherme Cunha'));
  assert.ok(prompt.includes('6 extras'));
  assert.ok(prompt.includes('Roleta'));
  assert.ok(prompt.includes('Pacotes'));
  assert.ok(prompt.includes('Club'));
  assert.ok(prompt.includes('Naty'));
  assert.ok(prompt.includes('INATIVADO'));
  assert.ok(prompt.includes('/barbeiro'));
});

test('executarFerramentaGestao - consultar_indicadores_hoje retorna resumo do dia', async () => {
  const res = await executarFerramentaGestao('consultar_indicadores_hoje', {}, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(res);
  assert.ok(res.data);
  assert.ok(res.faturamentoHoje);
  assert.equal(typeof res.totalAtendimentos, 'number');
  assert.equal(typeof res.concluidos, 'number');
});

test('executarFerramentaGestao - consultar_faturamento_periodo apura faturamento e saldo', async () => {
  const res = await executarFerramentaGestao('consultar_faturamento_periodo', { periodo: 'mes_atual' }, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(res);
  assert.equal(res.periodo, 'mes_atual');
  assert.ok(res.receitasMes);
  assert.ok(res.saldoAtual);
});

test('executarFerramentaGestao - consultar_desempenho_equipe filtra e lista profissionais', async () => {
  const resToda = await executarFerramentaGestao('consultar_desempenho_equipe', {}, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(resToda.equipe.length > 0);

  const resNaty = await executarFerramentaGestao('consultar_desempenho_equipe', { profissionalNome: 'Natani' }, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(resNaty.equipe.length > 0);
  assert.ok(resNaty.equipe[0].nome.includes('Natani'));
});

test('executarFerramentaGestao - consultar_metas_roleta traz apuracao, giros e link', async () => {
  const res = await executarFerramentaGestao('consultar_metas_roleta', {}, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(res);
  assert.ok(res.regras);
  assert.equal(res.regras.metaDiariaExtrasQtd, 6);
  assert.ok(Array.isArray(res.premiosRoleta));
  assert.ok(res.linkPainelMetas.includes('Metas+%26+roleta'));
});

test('executarFerramentaGestao - consultar_carteira_clientes traz 9.365 clientes e resumo por barbeiro', async () => {
  const res = await executarFerramentaGestao('consultar_carteira_clientes', {}, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(res);
  assert.ok(res.totalGeralClientes >= 9365);
  assert.ok(Array.isArray(res.distribuicaoPorBarbeiro));
  assert.ok(res.linkCarteira.includes('Carteira+de+clientes'));
});

test('executarFerramentaGestao - consultar_planos_e_clubes traz regras de descontos e restrições', async () => {
  const res = await executarFerramentaGestao('consultar_planos_e_clubes', {}, {
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
  });
  assert.ok(res);
  assert.ok(res.regrasPacotes.some(p => p.procedimentos === 4 && p.desconto.includes('10%')));
  assert.ok(res.regrasPacotes.some(p => p.procedimentos === 6 && p.desconto.includes('15%')));
  assert.ok(res.regrasPacotes.some(p => p.procedimentos === 8 && p.desconto.includes('20%')));
  assert.ok(res.regrasPrecosDiferenciados.includes('Naty e Bruno'));
  assert.ok(res.regraPlanoClub.includes('SEGUNDA A QUARTA-FEIRA'));
});

test('executarFerramentaGestao - consultar_guia_e_procedimentos responde duvidas reais de Dino', async () => {
  const duvidaInativar = await executarFerramentaGestao('consultar_guia_e_procedimentos', {
    topico: 'como tirar quem não está mais na empresa',
  }, { empresaId: EMPRESA_DINO });
  assert.ok(duvidaInativar.titulo.includes('inativar'));
  assert.ok(duvidaInativar.explicacao.includes('não exclui'));
  assert.ok(duvidaInativar.passoAPasso.some(p => p.includes('Inativo')));

  const duvidaPacotes = await executarFerramentaGestao('consultar_guia_e_procedimentos', {
    topico: 'quais as regras dos pacotes de procedimentos',
  }, { empresaId: EMPRESA_DINO });
  assert.ok(duvidaPacotes.regras.some(r => r.includes('10%')));
  assert.ok(duvidaPacotes.regras.some(r => r.includes('R$ 100,00')));

  const duvidaApp = await executarFerramentaGestao('consultar_guia_e_procedimentos', {
    topico: 'como os barbeiros acessam no celular',
  }, { empresaId: EMPRESA_DINO });
  assert.ok(duvidaApp.linkAcesso.includes('/barbeiro'));
});

test('createWhatsappAiToolExecutor executa ferramentas de gestao no canal gestao', async () => {
  const toolContext = {
    channelType: 'gestao',
    empresaId: EMPRESA_DINO,
    lojaId: LOJA_MATRIZ,
    phone: '5565999999999',
    capabilities: {},
  };
  const executor = createWhatsappAiToolExecutor(toolContext);

  const res = await executor('consultar_indicadores_hoje', {});
  assert.ok(res);
  assert.ok(res.data);
  assert.ok(res.faturamentoHoje);

  await assert.rejects(async () => {
    await executor('buscar_produtos', {});
  }, /não está disponível no canal interno de gestão/);
});

test('managementSnapshot e managementSystemPrompt funcionam integrados em whatsapp-ai.js', () => {
  const snap = managementSnapshot(EMPRESA_DINO, LOJA_MATRIZ);
  assert.ok(snap);
  assert.ok(snap.empresa);
  assert.ok(snap.financeiro);

  const prompt = managementSystemPrompt({ nome: 'WhatsApp Gestão Dino' }, snap);
  assert.ok(prompt.includes('Copiloto Executivo'));
  assert.ok(prompt.includes('Barbearia Dino'));
});
