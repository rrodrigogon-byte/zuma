import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_PRODUTOS_LTK,
  COLECOES_LTK,
  MODELO_GESTAO_INSTAGRAM,
  gerarLinkRastreadoLTK,
  registrarCliqueLTK,
  registrarConversaoLTK,
  obterMetricasConsolidadasLTK,
  formatarPautaDiariaWhatsApp
} from './dino-ltk-commerce-engine.js';

test('dino-ltk: catalogo possui produtos fisicos, servicos e assinaturas com atributos completos', () => {
  assert.ok(Array.isArray(CATALOGO_PRODUTOS_LTK));
  assert.ok(CATALOGO_PRODUTOS_LTK.length >= 7, 'Catalogo deve ter no minimo 7 produtos');

  for (const item of CATALOGO_PRODUTOS_LTK) {
    assert.ok(item.id, 'Item deve ter ID');
    assert.ok(item.nome, 'Item deve ter Nome');
    assert.ok(item.precoFrasco > 0, 'Item deve ter precoFrasco positivo');
    assert.ok(Array.isArray(item.colecoes) && item.colecoes.length > 0, 'Item deve pertencer a ao menos uma colecao');
    assert.ok(item.notasOlfativas && item.notasOlfativas.saida, 'Item deve ter notas olfativas detalhadas');
  }

  // Verifica existência de decants e serviços
  const temDecants = CATALOGO_PRODUTOS_LTK.some(p => p.permiteDecant === true && p.precoDecant10ml > 0);
  assert.ok(temDecants, 'Deve haver produtos com opcao de Decant de 10ml');

  const temServicoBarbearia = CATALOGO_PRODUTOS_LTK.some(p => p.categoria.includes('Barbearia'));
  assert.ok(temServicoBarbearia, 'Deve haver servico de Barbearia com consultoria visagista');
});

test('dino-ltk: colecoes oficiais estao estruturadas e com titulos atrativos', () => {
  assert.ok(Array.isArray(COLECOES_LTK));
  assert.ok(COLECOES_LTK.length >= 5);
  const ids = COLECOES_LTK.map(c => c.id);
  assert.ok(ids.includes('destaques'));
  assert.ok(ids.includes('vistos_reels'));
  assert.ok(ids.includes('calor_mt'));
  assert.ok(ids.includes('arabes_luxo'));
  assert.ok(ids.includes('barbearia'));
});

test('dino-ltk: modelo de gestao possui calendario semanal 7 dias, matriz RACI, esteira de lote e SLAs', () => {
  const { calendarioSemanal, matrizRACI, esteiraGravacaoEmLote, slasAtendimento, rituaisGovernanca } = MODELO_GESTAO_INSTAGRAM;

  assert.equal(calendarioSemanal.length, 7, 'Calendario deve cobrir os 7 dias da semana');
  assert.ok(matrizRACI.length >= 4, 'Matriz RACI deve ter no minimo 4 papeis definidos');
  assert.ok(esteiraGravacaoEmLote.etapas.length >= 3, 'Esteira de lote deve ter etapas estruturadas');
  assert.ok(slasAtendimento.length >= 3, 'Deve haver no minimo 3 SLAs definidos');
  assert.ok(rituaisGovernanca.length >= 3, 'Deve haver rituais de Daily, Noturno e Weekly');

  // Verifica que segunda-feira e o dia de gravacao em lote
  const segunda = calendarioSemanal.find(c => c.dia.includes('Segunda'));
  assert.ok(segunda);
  assert.ok(segunda.foco.includes('Gravação') || segunda.foco.includes('Planejamento'));
});

test('dino-ltk: gerarLinkRastreadoLTK gera parametros UTM validos para Instagram', () => {
  const url = gerarLinkRastreadoLTK({
    produtoId: 'p1_lattafa_asad',
    canal: 'stories',
    campanha: 'arabe_luxo',
    termo: 'decant_10ml'
  });

  assert.ok(url.startsWith('https://kytto.com.br/dino'));
  assert.ok(url.includes('p=p1_lattafa_asad'));
  assert.ok(url.includes('utm_source=instagram'));
  assert.ok(url.includes('utm_medium=stories'));
  assert.ok(url.includes('utm_campaign=arabe_luxo'));
  assert.ok(url.includes('utm_term=decant_10ml'));
});

test('dino-ltk: tracking de cliques e conversoes atualiza metricas com integridade', () => {
  const antesMetricas = obterMetricasConsolidadasLTK();
  const cliquesAntes = antesMetricas.cliquesTotais;
  const conversoesAntes = antesMetricas.conversoesTotais;

  registrarCliqueLTK({ produtoId: 'p1_lattafa_asad', colecaoId: 'destaques' });
  registrarConversaoLTK({ produtoId: 'p1_lattafa_asad', valor: 79.00, tipo: 'decant' });

  const depoisMetricas = obterMetricasConsolidadasLTK();
  assert.equal(depoisMetricas.cliquesTotais, cliquesAntes + 1);
  assert.equal(depoisMetricas.conversoesTotais, conversoesAntes + 1);
  assert.ok(depoisMetricas.rankingProdutos.length > 0);
});

test('dino-ltk: formatarPautaDiariaWhatsApp gera texto executivo estruturado com gatilhos e SLAs', () => {
  const textoSegunda = formatarPautaDiariaWhatsApp({ diaSemana: 'Segunda-feira' });
  assert.ok(textoSegunda.includes('PAUTA DIÁRIA DO INSTAGRAM'));
  assert.ok(textoSegunda.includes('Segunda-feira'));
  assert.ok(textoSegunda.includes('FOCO DO DIA'));
  assert.ok(textoSegunda.includes('GATILHO NO DIRECT'));
  assert.ok(textoSegunda.includes('VITRINE LTK'));
  assert.ok(textoSegunda.includes('LEMBRETE DE SLA'));
});
