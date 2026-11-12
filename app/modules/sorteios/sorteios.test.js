import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db.js';
import * as sorteiosServico from './servico.js';

test('Módulo de Sorteios Kytto - Suíte Completa', async (t) => {
  // Limpa estado para isolamento do teste
  const root = db();
  delete root.sorteiosKytto;

  const empresaDino = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

  let campInaugural = null;
  let campNatal = null;

  await t.test('1. Listar campanhas provisiona a campanha inaugural oficial do Dino', async () => {
    const campanhas = await sorteiosServico.listarCampanhas(empresaDino);
    assert.ok(Array.isArray(campanhas), 'Deve retornar uma lista');
    assert.ok(campanhas.length >= 1, 'Deve ter pelo menos uma campanha');
    
    campInaugural = campanhas.find(c => c.titulo.includes('Mega Sorteio'));
    assert.ok(campInaugural, 'Campanha inaugural deve existir');
    assert.match(campInaugural.titulo, /Mega Sorteio/i);
    assert.match(campInaugural.premioPrincipal, /Moto Honda Fan 160|Pix/i);
    assert.equal(campInaugural.status, 'ativa');
    assert.equal(campInaugural.regras.valorMinimoBilhete, 50);
    assert.equal(campInaugural.regras.multiplicadorPerfumaria, 2);
  });

  await t.test('2. Criar nova campanha personalizada com prêmios e regras', async () => {
    campNatal = await sorteiosServico.criarCampanha(empresaDino, {
      titulo: 'Sorteio Especial de Natal Dino & Perfumaria',
      premioPrincipal: 'PlayStation 5 Slim + Kit Perfumes Importados',
      premios: [
        { posicao: 1, nome: 'PlayStation 5 Slim + Kit Perfumes Importados', icone: '🎮' },
        { posicao: 2, nome: '6 Meses de Barba & Cabelo Grátis', icone: '💈' }
      ],
      regras: {
        valorMinimoBilhete: 50,
        multiplicadorPerfumaria: 2,
        bonusClube: 2
      }
    });

    assert.ok(campNatal.id, 'Deve gerar ID');
    assert.equal(campNatal.titulo, 'Sorteio Especial de Natal Dino & Perfumaria');
    assert.equal(campNatal.regras.valorMinimoBilhete, 50);
    assert.equal(campNatal.regras.multiplicadorPerfumaria, 2);
  });

  await t.test('3. Emissão automática de bilhetes por compra de serviços na Barbearia', async () => {
    // Usando campInaugural com valorMinimo 50
    const res = await sorteiosServico.emitirBilhetes({
      empresaId: empresaDino,
      campanhaId: campInaugural.id,
      cliente: {
        id: 'cli-maneco-8573',
        nome: 'Maneco Silveira',
        telefone: '65999528573'
      },
      valor: 160.00, // Dá 3 bilhetes (3 x 50 = 150)
      itens: [
        { nome: 'Corte Premium', total: 100 },
        { nome: 'Barba Premium', total: 60 }
      ],
      origem: 'barbearia_comanda',
      documentoId: 'cmd-2026-1112-001'
    });

    assert.equal(res.ok, true);
    assert.equal(res.bilhetesGerados, 3, 'R$ 160 deve gerar 3 bilhetes de R$ 50');
    assert.equal(res.numeros.length, 3);
    assert.match(res.numeros[0], /Série 01 - Nº \d{6}/);
    assert.ok(res.mensagemWhatsapp.includes('Maneco Silveira'));
  });

  await t.test('4. Emissão com pontuação dobrada em produtos de Perfumaria e Cosméticos', async () => {
    const res = await sorteiosServico.emitirBilhetes({
      empresaId: empresaDino,
      campanhaId: campInaugural.id,
      cliente: {
        id: 'cli-rodrigo-goncalves',
        nome: 'Rodrigo Gonçalves',
        telefone: '65999056008'
      },
      valor: 200.00, // R$ 200 em perfumaria com multiplicador 2x = R$ 400 equivalentes = 8 bilhetes (400 / 50)
      itens: [
        { nome: 'Perfume Dino Reserve Black 100ml', categoria: 'Perfumaria', total: 150 },
        { nome: 'Pomada Efeito Matte Dino', categoria: 'Cosméticos', total: 50 }
      ],
      origem: 'loja_perfumaria',
      documentoId: 'venda-revenda-991'
    });

    assert.equal(res.ok, true);
    assert.equal(res.bilhetesGerados, 8, 'R$ 200 em perfumaria com multiplicador 2x gera 8 bilhetes');
    assert.equal(res.numeros.length, 8);
  });

  await t.test('5. Emissão manual de bilhete de cortesia pelo balcão', async () => {
    const res = await sorteiosServico.emitirBilhetes({
      empresaId: empresaDino,
      campanhaId: campInaugural.id,
      cliente: {
        nome: 'Carlos Eduardo Barbeiro Convidado',
        telefone: '65998887766'
      },
      quantidadeManual: 2,
      motivo: 'Ação Promocional de Inauguração da Loja',
      origem: 'manual_balcao',
      emitidoPor: 'Dino Gerência'
    });

    assert.equal(res.ok, true);
    assert.equal(res.bilhetesGerados, 2);
  });

  await t.test('6. Consulta de bilhetes pelo cliente (portal público por telefone/WhatsApp)', async () => {
    const consulta = await sorteiosServico.consultarMeusBilhetes(empresaDino, {
      telefone: '65999528573' // Maneco Silveira
    });

    assert.equal(consulta.clienteIdentificado, 'Maneco Silveira');
    assert.ok(consulta.totalBilhetes >= 3, 'Deve encontrar os bilhetes do Maneco');
    assert.ok(consulta.campanhas.length >= 1);
  });

  await t.test('7. Execução de Sorteio Auditável e Geração de Prova Criptográfica', async () => {
    const resultado = await sorteiosServico.executarSorteio(empresaDino, campInaugural.id, {
      realizadoPor: 'Rodrigo Gonçalves (Dino)',
      premioIndex: 0
    });

    assert.equal(resultado.ok, true);
    assert.ok(resultado.ganhador.clienteNome, 'Deve ter um ganhador sorteado');
    assert.ok(resultado.ganhador.numeroSorte, 'Ganhador deve ter número da sorte');
    assert.ok(resultado.certificadoAuditoria.hashAuditoria, 'Deve ter hash SHA-256 de auditoria');
    assert.equal(resultado.certificadoAuditoria.provaMatematicaValida, true);
    assert.ok(resultado.mensagemWhatsapp.includes('PARABÉNS'));

    // Verifica que a campanha agora está marcada como sorteada
    const campAtualizada = await sorteiosServico.obterCampanha(empresaDino, campInaugural.id);
    assert.equal(campAtualizada.status, 'sorteada');
    assert.ok(campAtualizada.ganhadores.length >= 1);
  });

  await t.test('8. Visão pública de sorteios da empresa com transparência e proteção LGPD', async () => {
    const visao = await sorteiosServico.obterVisaoPublicaSorteios('barbearia-dino');
    assert.ok(visao.empresa.nome.includes('Barbearia Dino'));
    assert.ok(Array.isArray(visao.ganhadoresHistoricos), 'Deve listar ganhadores históricos');
    if (visao.ganhadoresHistoricos.length > 0) {
      // Telefone e nome devem estar parcialmente mascarados por LGPD
      assert.match(visao.ganhadoresHistoricos[0].ganhadorTelefone, /\*\*\*\*\*/);
    }
  });
});
