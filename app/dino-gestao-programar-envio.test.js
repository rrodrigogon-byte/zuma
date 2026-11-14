import test from 'node:test';
import assert from 'node:assert';
import { TELEFONE_RODRIGO_GESTAO, TELEFONES_GESTAO_DINO_OFICIAIS, compilarBriefingDiarioDino } from './core/dino-daily-briefing.js';
import { TELEFONE_RODRIGO_GESTAO as TEL_RESUMO, TELEFONES_GESTAO_PADRAO, configuracaoResumo } from './core/dino-resumo-diario.js';

test('1. Programação de Gestão: Telefone do Rodrigo cadastrado como destinatário oficial', () => {
  assert.strictEqual(TELEFONE_RODRIGO_GESTAO, '5514997462929');
  assert.strictEqual(TEL_RESUMO, '5514997462929');
  assert.ok(TELEFONES_GESTAO_DINO_OFICIAIS.includes('5514997462929'));
  assert.ok(TELEFONES_GESTAO_PADRAO.includes('5514997462929'));
});

test('2. Configuração Resumo Diário: Ativo por padrão no horário das 20h00', () => {
  const cfg = configuracaoResumo();
  assert.strictEqual(cfg.ativo, true);
  assert.strictEqual(cfg.hora, '20:00');
  assert.ok(cfg.telefones.includes('5514997462929'));
});

test('3. Briefing Matinal: Compilação executiva contém oportunidades e agenda', () => {
  const briefing = compilarBriefingDiarioDino({ empresaId: 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' });
  assert.ok(briefing.mensagem.includes('RESUMO DA EQUIPE HOJE'));
  assert.ok(briefing.mensagem.includes('CLIENTES VIP DO DINO PARA REATIVAR HOJE'));
});
