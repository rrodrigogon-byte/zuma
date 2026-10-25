import test from 'node:test';
import assert from 'node:assert/strict';
import * as gamificacao from './dino-metas-gamificacao.js';
import * as barbearia from './barbearia-erp-kytto.js';

test('Gamificação e Metas Dino: configuração autônoma, cálculo de extras/produtos, roleta e entrega', () => {
  const empresaId = 'test-emp-gamif-' + Date.now();

  // 1. Obter configuração inicial padrão
  const cfgInicial = gamificacao.obterConfiguracao(empresaId);
  assert.equal(cfgInicial.metasDiarias.servicosExtrasQtd, 6);
  assert.equal(cfgInicial.metasDiarias.produtosValor, 100);
  assert.ok(cfgInicial.premiosRoleta.length >= 8);

  // 2. Gestor altera metas e fatias da roleta autonomamente
  const novaCfg = gamificacao.salvarConfiguracao(empresaId, {
    metasDiarias: {
      servicosExtrasAtivo: true,
      servicosExtrasQtd: 5, // alterou para 5
      produtosAtivo: true,
      produtosValor: 120, // alterou para 120
      produtosGiros: 1,
    },
    metasSemanais: {
      ativo: true,
      tituloDesafio: 'Desafio Máximo de Pomadas',
      produtosValor: 600,
      girosDesafio: 2,
    },
    premiosRoleta: [
      { id: 'custom_1', nome: 'R$ 70 no Pix', cor: '#10b981', icone: '💰', peso: 20 },
      { id: 'custom_2', nome: 'Almoço por conta da casa', cor: '#f59e0b', icone: '🍔', peso: 30 },
      { id: 'custom_3', nome: 'Folga de Sábado à tarde', cor: '#6366f1', icone: '🎉', peso: 10 },
    ],
  }, 'gestor@dino.com.br');

  assert.equal(novaCfg.metasDiarias.servicosExtrasQtd, 5);
  assert.equal(novaCfg.metasDiarias.produtosValor, 120);
  assert.equal(novaCfg.metasSemanais.tituloDesafio, 'Desafio Máximo de Pomadas');
  assert.equal(novaCfg.premiosRoleta.length, 3);
  assert.equal(novaCfg.atualizadoPor, 'gestor@dino.com.br');

  // 3. Cadastra profissionais e simula comandas com extras e produtos
  const prof1 = barbearia.criarProfissional(empresaId, { nome: 'Carlos Barbeiro', apelido: 'Carlinhos' });
  const prof2 = barbearia.criarProfissional(empresaId, { nome: 'Eduardo Mestre', apelido: 'Dudu' });
  const srvCorte = barbearia.criarServico(empresaId, { nome: 'Corte Degradê', preco: 60 });
  const srvExtra = barbearia.criarServico(empresaId, { nome: 'Sobrancelha Navalhada', preco: 25 });
  const prodPomada = barbearia.criarProdutoRevenda(empresaId, { nome: 'Pomada Matte Dino', precoVenda: 75, estoqueAtual: 20 });

  const hoje = gamificacao.dataIsoCuiaba();

  // Carlinhos faz 6 serviços extras hoje (bate a meta de 5!)
  // Cria comanda com 1 corte principal + 5 extras
  const cmd1 = barbearia.criarComandaBarbearia(empresaId, {
    lojaId: 'loja-matriz',
    profissionalId: prof1.id,
    clienteNome: 'Cliente VIP',
  });
  const itens = [{
    tipo: 'servico',
    servicoId: srvCorte.id,
    nome: 'Corte Degradê',
    subtotal: 60,
    profissionalId: prof1.id,
  }];
  // 5 serviços adicionais (extras)
  for (let i = 1; i <= 5; i++) {
    itens.push({
      tipo: 'servico',
      servicoId: srvExtra.id,
      nome: `Serviço Adicional ${i} (Sobrancelha)`,
      subtotal: 25,
      profissionalId: prof1.id,
      extra: true,
    });
  }
  // E vende R$ 150 em produtos (bate meta diária de R$ 120!)
  itens.push({
    tipo: 'produto',
    produtoId: prodPomada.id,
    nome: 'Pomada Matte Dino',
    subtotal: 150,
    quantidade: 2,
    profissionalId: prof1.id,
  });
  barbearia.adicionarItensComandaBarbearia(empresaId, cmd1.id, itens);
  barbearia.registrarPagamentoComandaBarbearia(empresaId, cmd1.id, {
    confirmado: true,
    meioPagamento: 'pix',
    valor: 335,
  });

  // 4. Avaliar metas e sincronizar giros
  const resultado = gamificacao.avaliarMetasESincronizarGiros(empresaId, { dataIso: hoje });
  assert.ok(resultado.apuracao);
  const carlosApuracao = resultado.apuracao.profissionais.find((p) => p.profissionalId === prof1.id);
  assert.ok(carlosApuracao, 'Carlos deve estar na apuração');
  assert.ok(carlosApuracao.dia.servicosExtras >= 5, 'Carlos deve ter pelo menos 5 extras');
  assert.equal(carlosApuracao.dia.produtosValor, 150, 'Carlos deve ter R$ 150 em produtos');
  assert.equal(carlosApuracao.dia.metaExtrasAtingida, true);
  assert.equal(carlosApuracao.dia.metaProdutosAtingida, true);

  // Carlos deve ter recebido 2 giros (1 por extras + 1 por produtos)
  const girosCarlos = carlosApuracao.girosPendentes;
  assert.equal(girosCarlos.length, 2, 'Carlos conquistou 2 giros na roleta hoje!');

  // 5. Executar o giro da roleta
  const primeiroGiro = girosCarlos[0];
  const giroExecutado = gamificacao.executarGiro(empresaId, {
    giroId: primeiroGiro.id,
    premioNome: 'R$ 70 no Pix',
    usuario: 'gestor@dino.com.br',
  });
  assert.equal(giroExecutado.status, 'girado');
  assert.equal(giroExecutado.premioGanho, 'R$ 70 no Pix');
  assert.ok(giroExecutado.giradoEm);

  // 6. Confirmar entrega do prêmio ao profissional
  const giroEntregue = gamificacao.confirmarEntregaPremio(empresaId, primeiroGiro.id, {
    entreguePor: 'Rodrigo Gestor',
    observacao: 'Pix transferido com sucesso',
  });
  assert.equal(giroEntregue.status, 'entregue');
  assert.equal(giroEntregue.entreguePor, 'Rodrigo Gestor');
  assert.ok(giroEntregue.entregueEm);

  // 7. Conceder giro bônus avulso pelo gestor
  const bonus = gamificacao.concederGiroBonus(empresaId, {
    profissionalId: prof2.id,
    profissionalNome: prof2.nome,
    motivo: 'Destaque no atendimento ao cliente',
    usuario: 'gestor@dino.com.br',
  });
  assert.equal(bonus.profissionalId, prof2.id);
  assert.equal(bonus.tipoOrigem, 'avulso_gestor');
  assert.equal(bonus.status, 'pendente_giro');

  // 8. Relatório e histórico completo
  const historico = gamificacao.listarHistoricoGiros(empresaId);
  assert.ok(historico.length >= 3);
  assert.ok(historico.some((g) => g.status === 'entregue'));
  assert.ok(historico.some((g) => g.tipoOrigem === 'avulso_gestor'));
});
