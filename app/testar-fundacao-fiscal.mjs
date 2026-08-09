import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DB_PATH = `/tmp/kytto-fiscal-foundation-${Date.now()}.json`;
process.env.GCS_BUCKET = '';
process.env.FISCAL_CERT_MASTER_KEY = 'chave-de-teste-fiscal-com-mais-de-24-caracteres';

const fiscal = await import('./fiscal-kytto.js');
const { db } = await import('./db.js');

let total = 0;
function test(nome, fn) {
  try {
    fn();
    total += 1;
    console.log(`✓ ${nome}`);
  } catch (error) {
    console.error(`✗ ${nome}: ${error.message}`);
    process.exitCode = 1;
  }
}

const tenant = 'empresa-fiscal-teste';
const cnpj = '13246882000111';

function prepararEmpresa() {
  fiscal.salvarConfiguracaoFiscal(tenant, {
    cnpj,
    ie: '123456789',
    razaoSocial: 'Florescer Ação Social',
    nomeFantasia: 'Florescer',
    uf: 'MT',
    regimeTributario: 'simples',
    crt: '1',
    ambiente: 'homologacao',
    serieNfce: 1,
    serieNfe: 1,
    endereco: {
      logradouro: 'Rua Teste', numero: '100', bairro: 'Centro', cidade: 'Cuiabá',
      codigoMunicipio: '5103403', cep: '78000000', complemento: '',
    },
  });
  const estado = db();
  estado.fiscalKytto.certificados['cert-fiscal-teste'] = {
    id: 'cert-fiscal-teste', tenantId: tenant, nomeArquivo: 'teste.pfx', commonName: 'FLORESCER ACAO SOCIAL:13246882000111',
    cnpj, validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z',
    fingerprint: crypto.createHash('sha256').update('teste').digest('hex'), ativo: true,
  };
  estado.fiscalKytto.configuracoes[tenant].certificadoAtivoId = 'cert-fiscal-teste';
}

prepararEmpresa();

test('gera chave de acesso de 44 dígitos com DV válido', () => {
  const chave = fiscal.gerarChaveAcessoFiscal({
    uf: 'MT', dhEmi: '2026-08-09T12:00:00.000Z', cnpj, modelo: '65', serie: 1, numero: 1, codigoNumerico: '12345678',
  });
  assert.equal(chave.length, 44);
  assert.equal(fiscal.validarChaveAcessoFiscal(chave), true);
});

test('rejeita chave fiscal com DV inválido', () => {
  const chave = fiscal.gerarChaveAcessoFiscal({
    uf: 'MT', dhEmi: '2026-08-09T12:00:00.000Z', cnpj, modelo: '55', serie: 1, numero: 2, codigoNumerico: '87654321',
  });
  assert.equal(fiscal.validarChaveAcessoFiscal(`${chave.slice(0, -1)}${chave.endsWith('0') ? '1' : '0'}`), false);
});

test('reserva numeração única e sequencial por modelo e série', () => {
  const reservas = Array.from({ length: 10 }, () => fiscal.reservarNumeracaoFiscal(tenant, '65'));
  const numeros = reservas.map((item) => item.numero);
  assert.equal(new Set(numeros).size, 10);
  for (let index = 1; index < numeros.length; index += 1) assert.equal(numeros[index], numeros[index - 1] + 1);
});

test('separa numeração de NF-e e NFC-e', () => {
  const nfce = fiscal.reservarNumeracaoFiscal(tenant, '65');
  const nfe = fiscal.reservarNumeracaoFiscal(tenant, '55');
  assert.equal(nfe.modelo, '55');
  assert.equal(nfe.numero, 1);
  assert.equal(nfce.modelo, '65');
});

test('cria rascunho fiscal idempotente por origem da venda', () => {
  const primeira = fiscal.criarDocumentoFiscalRascunho(tenant, {
    valorTotal: 49.9, itens: [{ id: 'produto-1', quantidade: 1, valor: 49.9 }], pagamentos: [{ metodo: 'pix', valor: 49.9 }],
  }, { modelo: '65', origemId: 'comanda-test-001' });
  const segunda = fiscal.criarDocumentoFiscalRascunho(tenant, { valorTotal: 49.9 }, { modelo: '65', origemId: 'comanda-test-001' });
  assert.equal(primeira.id, segunda.id);
  assert.equal(primeira.status, 'rascunho');
  assert.equal(fiscal.validarChaveAcessoFiscal(primeira.chaveAcesso), true);
});

test('registra eventos auditáveis por documento e empresa', () => {
  const documento = fiscal.criarDocumentoFiscalRascunho(tenant, { valorTotal: 10 }, { modelo: '55', origemId: 'pedido-test-001' });
  const evento = fiscal.registrarEventoFiscal(tenant, documento.id, 'validacao_manual', { operador: 'admin-teste' });
  const eventos = fiscal.listarEventosFiscais(tenant, documento.id);
  assert.equal(evento.documentoId, documento.id);
  assert.equal(eventos.some((item) => item.id === evento.id), true);
});

test('mantém tabela de UF pronta para MT e estrutura de expansão', () => {
  const ufs = fiscal.listarConfiguracoesUf();
  assert.equal(ufs.some((item) => item.uf === 'MT' && item.habilitada), true);
  assert.equal(ufs.some((item) => item.uf === 'SP'), true);
});

test('importa tabela IBPT versionada e mantém isolamento por empresa', () => {
  const tabela = fiscal.importarTabelaIbpt(tenant, {
    versao: 'IBPT-Teste-2026.08', vigenciaInicio: '2026-08-01', vigenciaFim: '2026-12-31',
    linhas: [{ ncm: '22030000', nacional: 38.5, importado: 55.2, descricao: 'Bebidas de malte' }],
  });
  const aliquotas = fiscal.obterAliquotasIbpt(tenant, '22030000');
  assert.equal(tabela.ativa, true);
  assert.equal(aliquotas.nacional, 38.5);
  assert.equal(aliquotas.importado, 55.2);
  assert.equal(fiscal.obterAliquotasIbpt('empresa-sem-ibpt', '22030000'), null);
});

if (!process.exitCode) console.log(`\n✅ Fundação fiscal: ${total} testes passaram`);
process.exit(process.exitCode || 0);
