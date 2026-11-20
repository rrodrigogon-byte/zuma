// ==========================================================================
// TESTE AUTOMATIZADO: CARTEIRA DE CLIENTES & REATIVAÇÃO EM LOTE MOTOR KYTTOIA
// Validação de KPIs de Retenção, Ciclo de Retorno e Conformidade Meta Anti-Bloqueio
// ==========================================================================
import assert from 'node:assert';
import * as dinoCarteiraClientes from '../app/dino-carteira-clientes.js';

const TENANT_DINO = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';

console.log('🧪 Iniciando testes de Carteira, Reativação em Lote e Anti-Bloqueio Meta...');

// 1. Teste de Resumo e Métricas RFM / Retenção
console.log('▶ Teste 1: Resumo de Carteiras e KPIs Financeiros / Retenção');
const resumo = dinoCarteiraClientes.resumoCarteirasProfissionais(TENANT_DINO, { force: true });
assert(resumo, 'Resumo deve existir');
assert(typeof resumo.totalGeralClientes === 'number', 'totalGeralClientes deve ser numérico');
assert(Array.isArray(resumo.carteiras), 'carteiras deve ser array');
assert(resumo.carteiras.length > 0, 'Deve conter carteiras de profissionais');
console.log(`  ✓ Total Clientes: ${resumo.totalGeralClientes}`);
console.log(`  ✓ Profissionais ativos: ${resumo.carteiras.length}`);
console.log(`  ✓ Faturamento Geral: R$ ${resumo.faturamentoGeralTotal || 0}`);

for (const c of resumo.carteiras) {
  assert(c.profissionalNome, 'Nome do profissional deve existir');
  assert(typeof c.totalClientes === 'number', 'totalClientes deve ser número');
}

// 2. Teste de Listagem e Filtro por Profissional e Retorno
console.log('▶ Teste 2: Listagem de Clientes e Filtro de Retorno');
const listaTodos = dinoCarteiraClientes.listarCarteiraClientes(TENANT_DINO, { filtroRetorno: 'todos', force: true });
assert(Array.isArray(listaTodos.clientes), 'lista de clientes deve ser array');
console.log(`  ✓ Clientes retornados: ${listaTodos.clientes.length}`);

// 3. Teste dos Modelos de Spintax KyttoIA
console.log('▶ Teste 3: Modelos de Mensagem com Spintax KyttoIA');
const modelos = dinoCarteiraClientes.obterModelosReativacaoSpintax({
  clienteNome: 'Rodrigo Ribeiro Gonçalves',
  barbeiroApelido: 'Dino',
  servicoFavorito: 'Corte e Barba Terapia',
  diasSemRetorno: 24,
  linkAgendamento: 'https://kytto.com.br/agendar/dino',
});
assert(Array.isArray(modelos), 'modelos deve ser array');
assert(modelos.length === 3, 'Deve conter 3 modelos oficiais');
assert(modelos[0].id === 'amigavel_titular', 'Primeiro modelo deve ser amigavel_titular');
console.log(`  ✓ Modelos carregados: ${modelos.map(m => m.nome).join(' | ')}`);

// 4. Teste de Resolução de Spintax
console.log('▶ Teste 4: Expansão e Variação de Spintax');
const templateOriginal = modelos[0].template;
const variacao1 = dinoCarteiraClientes.resolverSpintax(templateOriginal, true);
const variacao2 = dinoCarteiraClientes.resolverSpintax(templateOriginal, true);
assert(variacao1, 'Variacao 1 não pode ser vazia');
assert(variacao2, 'Variacao 2 não pode ser vazia');
assert(!variacao1.includes('{') && !variacao1.includes('}'), 'Spintax deve ter sido completamente resolvido');
console.log(`  ✓ Amostra Spintax 1: "${variacao1.slice(0, 60)}..."`);
console.log(`  ✓ Amostra Spintax 2: "${variacao2.slice(0, 60)}..."`);

// 5. Teste de Mensagem Padrão com Opt-Out e Link Oficial
console.log('▶ Teste 5: Mensagem Padrão Gerada com Opt-Out');
const msgGerada = dinoCarteiraClientes.gerarMensagemWhatsappRetorno({
  clienteNome: 'Rodrigo Ribeiro Gonçalves',
  barbeiroApelido: 'Dino',
  servicoFavorito: 'Corte',
  diasSemRetorno: 22,
});
assert(msgGerada.includes('PARAR'), 'Mensagem gerada deve conter cláusula obrigatória de opt-out PARAR');
assert(msgGerada.includes('kytto.com.br/agendar/dino'), 'Mensagem gerada deve apontar para https://kytto.com.br/agendar/dino');
console.log(`  ✓ Mensagem gerada com opt-out:\n${msgGerada}`);

// 6. Teste de Conformidade Anti-Bloqueio Meta WhatsApp
console.log('▶ Teste 6: Verificação Rigorosa Anti-Bloqueio Meta');
const avaliacaoSegura = dinoCarteiraClientes.avaliarConformidadeMetaWhatsapp(variacao1);
assert(avaliacaoSegura.valido === true, 'Mensagem padrão deve ser 100% válida e aprovada');
assert(avaliacaoSegura.temOptOut === true, 'Deve conter cláusula obrigatória de opt-out');
assert(avaliacaoSegura.temLinkValido === true, 'Deve conter link oficial kytto.com.br');
assert(avaliacaoSegura.spamEncontrado.length === 0, 'Não deve conter gatilhos de spam');
console.log('  ✓ Validação de Opt-Out: APROVADO');
console.log('  ✓ Validação de Link Seguro (kytto.com.br): APROVADO');
console.log('  ✓ Validação de Termos de Spam: 0 gatilhos detectados (APROVADO)');

// 7. Teste de Rejeição de Mensagem Insegura (Sem Opt-Out ou com Spam)
console.log('▶ Teste 7: Detecção de Não-Conformidade e Prevenção de Bloqueio');
const msgInsegura = 'Ganhe dinheiro fácil urgente compre agora venha cortar o cabelo!';
const avaliacaoInsegura = dinoCarteiraClientes.avaliarConformidadeMetaWhatsapp(msgInsegura);
assert(avaliacaoInsegura.valido === false, 'Mensagem com spam e sem opt-out deve ser rejeitada');
assert(avaliacaoInsegura.temOptOut === false, 'Deve alertar falta de opt-out');
assert(avaliacaoInsegura.spamEncontrado.length > 0, 'Deve detectar termos de spam');
console.log(`  ✓ Bloqueio preventivo ativado com sucesso: ${avaliacaoInsegura.recomendacoes.join('; ')}`);

console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO E ZERO FALHAS!');
