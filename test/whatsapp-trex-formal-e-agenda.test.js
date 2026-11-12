import { describe, it } from 'node:test';
import assert from 'node:assert';
import { personaSystemBlock, resolvePersona } from '../app/core/whatsapp-ai-persona.js';
import { availability } from '../app/core/barbershop-agenda.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from '../app/dino-equipe-seed.js';
import * as barbearia from '../app/barbearia-erp-kytto.js';

describe('T-Rex Barbearia Dino - Naturalidade Acolhedora, Regra de 2 Opções e Agenda Precisa', () => {
  it('1. O prompt do T-Rex deve banir girias e formalismo forcado ("Peço sinceras desculpas"), exigindo naturalidade', () => {
    provisionarEquipeDino();
    const persona = resolvePersona({ personaId: 'trex' }, process.env, DINO_EMPRESA_CANONICA);
    const prompt = personaSystemBlock(persona, 'Barbearia Dino');

    // Verificar se proíbe expressamente gírias informais
    assert.match(prompt, /PROIBIÇÃO TOTAL DE GÍRIAS E LINGUAJAR INFORMAL/i);
    assert.match(prompt, /"meu irmão"/i);
    assert.match(prompt, /"tá na régua"/i);
    assert.match(prompt, /"bora"/i);
    assert.match(prompt, /"show"/i);
    assert.match(prompt, /"tamo junto"/i);
    assert.match(prompt, /"de boa"/i);
    assert.match(prompt, /"foi mal"/i);

    // Verificar proibição de formalismo forçado / engessado de call center
    assert.match(prompt, /PROIBIÇÃO DE LINGUAGEM ENGESSADA DE CALL CENTER/i);
    assert.match(prompt, /"Peço sinceras desculpas pelo ocorrido"/i);
    assert.match(prompt, /"Lamento pelo mal-entendido"/i);

    // Verificar saudações naturais e acolhedoras exigidas
    assert.match(prompt, /Olá, \[Nome\]! Tudo bem\?/i);
    assert.match(prompt, /Perfeito!/i);
    assert.match(prompt, /Agendamento confirmado com sucesso!/i);

    // Garantir que NÃO instrua mais a falar "como da quebrada" ou "jeito do dino"
    assert.doesNotMatch(prompt, /JEITO DO DINO: o T-Rex é aprendiz do Dino e fala como ele/i);
    assert.doesNotMatch(prompt, /usa "meu irmão", "bora", "show demais"/i);
  });

  it('2. O prompt do T-Rex deve impor a REGRA DE DUAS OPÇÕES + LINK DE APOIO + CONDUÇÃO ATIVA NO WHATSAPP', () => {
    const persona = resolvePersona({ personaId: 'trex' }, process.env, DINO_EMPRESA_CANONICA);
    const prompt = personaSystemBlock(persona, 'Barbearia Dino');

    // Verificar regra das duas opções
    assert.match(prompt, /REGRA DAS DUAS OPÇÕES DE AGENDA/i);
    assert.match(prompt, /DUAS opções reais de horários/i);

    // Verificar link da agenda de apoio
    assert.match(prompt, /https:\/\/kytto\.com\.br\/agendar\/dino/i);

    // Verificar que NUNCA abandona o cliente no link e busca sempre finalizar no chat
    assert.match(prompt, /CONTINUIDADE TOTAL DO ATENDIMENTO \(NUNCA ABANDONE O CLIENTE NO LINK\)/i);
    assert.match(prompt, /buscar SEMPRE finalizar o agendamento completo pelo próprio chat/i);
  });

  it('3. O prompt do T-Rex deve impor fidelidade estrita aos slots da agenda', () => {
    const persona = resolvePersona({ personaId: 'trex' }, process.env, DINO_EMPRESA_CANONICA);
    const prompt = personaSystemBlock(persona, 'Barbearia Dino');

    assert.match(prompt, /FIDELIDADE CIRÚRGICA À AGENDA/i);
    assert.match(prompt, /PROIBIDO SUGERIR OU INVENTAR HORÁRIOS INEXISTENTES/i);
    assert.match(prompt, /Nati \(Natani\): atende de segunda a sábado das 08:00 às 18:00 \(último corte às 17:30\)/i);
    assert.match(prompt, /Bruno: atende de segunda a sábado das 08:00 às 19:00 \(último corte às 18:30\)/i);
    assert.match(prompt, /Encerramento da barbearia: 19:00/i);
  });

  it('4. A agenda real da Barbearia Dino deve respeitar os limites de horario de Nati e Bruno', async () => {
    provisionarEquipeDino();
    const scope = { empresaId: DINO_EMPRESA_CANONICA, lojaId: 'loja-1' };
    const profs = barbearia.listarProfissionais(DINO_EMPRESA_CANONICA);
    const nati = profs.find(p => /nati|natani/i.test(p.nome));
    const bruno = profs.find(p => /bruno/i.test(p.nome));
    const servicos = barbearia.listarServicos(DINO_EMPRESA_CANONICA);
    const corte = servicos.find(s => /corte/i.test(s.nome) && !/dino/i.test(s.nome)) || servicos[0];

    assert.ok(nati, 'Nati deve estar cadastrada e ativa');
    assert.ok(bruno, 'Bruno deve estar cadastrado e ativo');
    assert.strictEqual(nati.horarioFim, '18:00', 'Horário de término da Nati deve ser 18:00');
    assert.strictEqual(bruno.horarioFim, '19:00', 'Horário de término do Bruno deve ser 19:00');

    // Testar slots para o próximo dia útil
    const amanha = new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 10);
    const dispNati = await availability(scope, { serviceId: corte.id, professionalId: nati.id, date: amanha });
    const dispBruno = await availability(scope, { serviceId: corte.id, professionalId: bruno.id, date: amanha });

    // Slots da Nati não podem conter 18:00 nem após
    assert.ok(!dispNati.slots.includes('18:00'), 'Nati NÃO pode ter slot às 18:00');
    assert.ok(!dispNati.slots.includes('18:30'), 'Nati NÃO pode ter slot às 18:30');
    assert.ok(!dispNati.slots.includes('19:00'), 'Nati NÃO pode ter slot às 19:00');

    // Slots do Bruno não podem conter 19:00 (pois a barbearia fecha às 19:00)
    assert.ok(!dispBruno.slots.includes('19:00'), 'Bruno NÃO pode ter slot às 19:00');
    assert.ok(!dispBruno.slots.includes('19:30'), 'Bruno NÃO pode ter slot às 19:30');
    assert.ok(!dispBruno.slots.includes('20:00'), 'Bruno NÃO pode ter slot às 20:00');

    // Os últimos slots permitidos
    const ultimoSlotNati = dispNati.slots[dispNati.slots.length - 1];
    const ultimoSlotBruno = dispBruno.slots[dispBruno.slots.length - 1];

    assert.ok(ultimoSlotNati <= '17:30', `Último slot da Nati (${ultimoSlotNati}) deve ser no máximo 17:30`);
    assert.ok(ultimoSlotBruno <= '18:30', `Último slot do Bruno (${ultimoSlotBruno}) deve ser no máximo 18:30`);
  });

  it('5. A configuracao da loja Dino deve fechar as 19h00', () => {
    const config = barbearia.obterConfiguracao(DINO_EMPRESA_CANONICA);
    assert.strictEqual(config.horarioFechamento, '19:00', 'Fechamento da loja Dino deve ser 19:00');
  });
});
