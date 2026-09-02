import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './db.js';
import { listarDocumentosFiscais, prepararDocumentoFiscal } from './barbearia-fiscal-kytto.js';

const EMPRESA_A = 'empresa-fiscal-a';
const EMPRESA_B = 'empresa-fiscal-b';

beforeEach(() => reset());

function payload(sobrescrever = {}) {
  return {
    confirmado: true,
    lojaId: 'loja-a',
    origemTipo: 'comanda',
    origemId: 'cmd-001',
    chaveIdempotencia: 'fiscal:cmd-001',
    clienteId: 'cli-001',
    itens: [
      { tipo: 'servico', descricao: 'Corte', quantidade: 1, valorUnitario: 50, total: 50, referenciaId: 'srv-001' },
      { tipo: 'produto', descricao: 'Pomada', quantidade: 1, valorUnitario: 30, total: 30, referenciaId: 'prd-001' },
    ],
    desconto: 5,
    total: 75,
    usuario: 'operador@teste.local',
    ...sobrescrever,
  };
}

test('prepara rascunho fiscal governado sem emitir, transmitir ou numerar documento', () => {
  assert.throws(() => prepararDocumentoFiscal(EMPRESA_A, payload({ confirmado: false })), /confirmação explícita/);
  const resultado = prepararDocumentoFiscal(EMPRESA_A, payload());
  assert.equal(resultado.idempotente, false);
  assert.equal(resultado.documento.status, 'rascunho_pendente_integracao');
  assert.equal(resultado.documento.emissaoAutomatica, false);
  assert.equal(resultado.documento.transmitido, false);
  assert.equal(resultado.documento.numeroFiscal, null);
  assert.equal(resultado.documento.provedor, null);
  assert.equal(resultado.documento.total, 75);
  assert.equal(listarDocumentosFiscais(EMPRESA_A, { lojaId: 'loja-a' }).length, 1);
});

test('replay idempotente não duplica rascunho e rejeita reutilização conflitante', () => {
  const primeiro = prepararDocumentoFiscal(EMPRESA_A, payload());
  const replay = prepararDocumentoFiscal(EMPRESA_A, payload());
  assert.equal(replay.idempotente, true);
  assert.equal(replay.documento.id, primeiro.documento.id);
  assert.equal(listarDocumentosFiscais(EMPRESA_A).length, 1);
  assert.throws(() => prepararDocumentoFiscal(EMPRESA_A, payload({ origemId: 'cmd-002' })), /outro rascunho fiscal/);
});

test('isola documentos fiscais por empresa e valida a soma comercial', () => {
  prepararDocumentoFiscal(EMPRESA_A, payload());
  assert.equal(listarDocumentosFiscais(EMPRESA_B).length, 0);
  const outro = prepararDocumentoFiscal(EMPRESA_B, payload({ lojaId: 'loja-b' }));
  assert.equal(outro.documento.empresaId, EMPRESA_B);
  assert.equal(listarDocumentosFiscais(EMPRESA_A).length, 1);
  assert.equal(listarDocumentosFiscais(EMPRESA_B).length, 1);
  assert.throws(() => prepararDocumentoFiscal(EMPRESA_A, payload({ chaveIdempotencia: 'fiscal:divergente', total: 74 })), /diverge/);
});
