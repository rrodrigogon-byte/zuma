import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleWebBookingGreetingAndHandoff, responderConfirmacaoAgendamentoExistente } from '../app/core/whatsapp-ai.js';
import * as barbearia from '../app/barbearia-erp-kytto.js';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from '../app/dino-equipe-seed.js';

describe('T-Rex - Fluxo de Agendamento Web e Chamada do Atendente Humano', () => {
  provisionarEquipeDino();

  it('1. Deve reconhecer a mensagem do botão "Falar com o estabelecimento" e responder confirmando com precisão', async () => {
    const profs = barbearia.listarProfissionais(DINO_EMPRESA_CANONICA);
    const nati = profs.find(p => /nati/i.test(p.nome)) || profs[0];
    const servicos = barbearia.listarServicos(DINO_EMPRESA_CANONICA);
    const barba = servicos.find(s => /barba/i.test(s.nome)) || servicos[0];

    const codigoTeste = `WEB${Math.floor(Math.random() * 900000 + 100000)}`;

    const ag = barbearia.criarAgendamento(DINO_EMPRESA_CANONICA, {
      clienteNome: 'Cliente Teste Web',
      clienteTelefone: '5565996219780',
      profissionalId: nati.id,
      servicoId: barba.id,
      dataAgenda: '2026-11-25',
      horaLocal: '10:00',
      dataHora: '2026-11-25T10:00:00-04:00',
      codigoConfirmacao: codigoTeste,
      status: 'agendado',
      origem: 'agendamento_online',
    });

    const context = {
      empresaId: DINO_EMPRESA_CANONICA,
      customerName: 'Cliente Teste Web',
      phone: '5565996219780',
    };

    const session = {
      id: 'sess-teste-web-01',
      empresa_id: DINO_EMPRESA_CANONICA,
      loja_id: 'loja-1',
      canal_id: 'canal-dino',
      telefone: '5565996219780',
      nome: 'Cliente Teste Web',
      status: 'ativo',
    };

    const msgTexto = `Olá! Solicitei o serviço BARBA PREMIUM para 2026-11-25 às 10:00. Código: ${codigoTeste}`;
    const resposta = await handleWebBookingGreetingAndHandoff(context, msgTexto, {
      channel: { nome: 'Barbearia Dino', configuracao: { handoff: { attendant_phone: '5565999056008' } } },
      session,
    });

    assert.ok(resposta, 'Deve retornar resposta para o cliente');
    assert.strictEqual(resposta.kind, 'web_booking_welcome_handoff');
    assert.match(resposta.text, /Confirmadíssimo/i);
    assert.match(resposta.text, /BARBA/i);
    assert.match(resposta.text, /10:00/i);
    assert.match(resposta.text, new RegExp(codigoTeste, 'i'));
    assert.match(resposta.text, /equipe de atendimento/i);
    // Verificar que a sessão foi encaminhada para atendimento humano
    assert.strictEqual(session.status, 'humano');
    assert.strictEqual(session.handoff_reason, 'solicitacao_web_atendente');
  });

  it('2. Deve responder prontamente a dúvidas de áudio/texto sobre agendamento existente confirmando a vaga', async () => {
    const context = {
      empresaId: DINO_EMPRESA_CANONICA,
      customerName: 'Cliente Teste Web',
      phone: '5565996219780',
    };

    const session = {
      id: 'sess-teste-web-02',
      empresa_id: DINO_EMPRESA_CANONICA,
      loja_id: 'loja-1',
      telefone: '5565996219780',
      nome: 'Cliente Teste Web',
    };

    const audioTranscrito = '[áudio transcrito] Olá, tudo bem? Só queria confirmar, eu fiz um agendamento pelo link com a Nati às 10:00. Eu queria ver se tá disponível mesmo.';
    const resposta = await responderConfirmacaoAgendamentoExistente(context, audioTranscrito, { session });

    assert.ok(resposta, 'Deve responder à dúvida do áudio');
    assert.strictEqual(resposta.kind, 'existing_booking_confirmation');
    assert.match(resposta.text, /confirmadíssimo/i);
    assert.match(resposta.text, /10:00/i);
    assert.match(resposta.text, /equipe/i);
  });
});
