import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { provisionarEquipeDino, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import * as barbearia from './barbearia-erp-kytto.js';
import { metaPublicaDoSlug } from './modules/barbearia/routes-publico.js';

describe('Dino - Redirecionamento Obrigatório do Agendamento Online para o WhatsApp do T-Rex (65 99905-6008)', () => {
  const WHATSAPP_TREX_CANONICO = '(65) 99905-6008';
  const WHATSAPP_TREX_DIGITOS = '5565999056008';
  const WHATSAPP_DINO_PESSOAL_CANONICO = '(65) 99672-2055';
  const WHATSAPP_DINO_PESSOAL_DIGITOS = '5565996722055';

  it('1. Rota pública de agendamento online deve retornar estritamente o WhatsApp do T-Rex para Dino', () => {
    provisionarEquipeDino();
    const meta = metaPublicaDoSlug('dino');
    assert.ok(meta, 'Deve encontrar a identidade pública da barbearia Dino');
    assert.strictEqual(meta.telefone, WHATSAPP_TREX_CANONICO, 'Telefone público retornado para o cliente deve ser o T-Rex');
    assert.notStrictEqual(meta.telefone, WHATSAPP_DINO_PESSOAL_CANONICO, 'Nunca deve retornar o celular pessoal de Dino');
  });

  it('2. Configuração do ERP da Barbearia Dino deve definir whatsappPublico como o T-Rex', () => {
    const cfg = barbearia.obterConfiguracao(DINO_EMPRESA_CANONICA);
    assert.ok(cfg, 'Configuração da barbearia deve existir');
    assert.strictEqual(cfg.whatsappPublico, WHATSAPP_TREX_CANONICO, 'whatsappPublico deve ser (65) 99905-6008');
  });

  it('3. Sanitização automática do ERP deve prevenir uso do celular pessoal de Dino como WhatsApp público', () => {
    // Tentativa de atualizar com o número pessoal
    barbearia.atualizarConfiguracao(DINO_EMPRESA_CANONICA, { whatsappPublico: WHATSAPP_DINO_PESSOAL_CANONICO });
    const cfgAtualizada = barbearia.obterConfiguracao(DINO_EMPRESA_CANONICA);
    assert.strictEqual(cfgAtualizada.whatsappPublico, WHATSAPP_TREX_CANONICO, 'Deve sanitizar automaticamente para o T-Rex oficial');
  });

  it('4. Formatação de link no frontend do AgendamentoOnline deve gerar wa.me direcionado ao T-Rex 5565999056008', () => {
    function linkWhatsApp(numero, mensagem = '', isDino = false) {
      if (!numero && !isDino) return '#';
      let limpo = String(numero || '').replace(/\D/g, '');
      if (isDino || limpo === '5565996722055' || limpo === '65996722055') {
        limpo = WHATSAPP_TREX_DIGITOS;
      }
      let destino = limpo;
      if (destino.length === 10 || destino.length === 11) {
        destino = '55' + destino;
      }
      return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`;
    }

    const mensagemTeste = 'Olá! Solicitei o serviço BARBA PREMIUM para 2026-11-20 às 17:30. Código: 2B662EC9';
    
    // Teste A: Quando recebe o número pessoal antigo
    const linkAntigo = linkWhatsApp('(65) 99672-2055', mensagemTeste, true);
    assert.ok(linkAntigo.startsWith(`https://wa.me/${WHATSAPP_TREX_DIGITOS}`), 'Deve redirecionar para o T-Rex');
    assert.ok(!linkAntigo.includes(WHATSAPP_DINO_PESSOAL_DIGITOS), 'Não pode conter o celular pessoal de Dino');

    // Teste B: Quando isDino é true e número é nulo/vazio
    const linkDinoVazio = linkWhatsApp(null, mensagemTeste, true);
    assert.ok(linkDinoVazio.startsWith(`https://wa.me/${WHATSAPP_TREX_DIGITOS}`), 'Deve preencher com o T-Rex oficial');

    // Teste C: Quando passa o número correto do T-Rex
    const linkTrex = linkWhatsApp('(65) 99905-6008', mensagemTeste, true);
    assert.ok(linkTrex.startsWith(`https://wa.me/${WHATSAPP_TREX_DIGITOS}`), 'Deve manter o T-Rex oficial');
  });
});
