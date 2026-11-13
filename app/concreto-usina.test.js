import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCnpj } from './core/formatadores.js';
import {
  CONCRETO_EMPRESA_ID,
  CONCRETO_CNPJ,
  CONCRETO_DADOS_EMPRESA,
  CONCRETO_CATALOGO_INICIAL,
  CONCRETO_FROTA_INICIAL,
  CONCRETO_CARGAS_INICIAIS,
  CONCRETO_SILOS_INICIAIS,
  CONCRETO_BAIAS_INICIAIS,
  CONCRETO_TANQUES_ADITIVOS,
  CONCRETO_ENTRADAS_SUPRIMENTOS,
  CONCRETO_BATELADAS_PROCESSO,
  provisionarConcretoUsina
} from './concreto-usina-seed.js';
import { PALATARE_EMPRESA_ID, PALATARE_CNPJ, PALATARE_DADOS_EMPRESA } from './palatare-pizzaria-seed.js';

test('Empresa 2 (Serrano Concreto): CNPJ oficial e formato valido', () => {
  assert.equal(CONCRETO_CNPJ, '51.499.928/0001-01');
  assert.equal(validarCnpj(CONCRETO_CNPJ), true, 'CNPJ do Concreto deve ser matematicamente valido');
  assert.equal(CONCRETO_DADOS_EMPRESA.tipoNegocio, 'concreto');
  assert.equal(CONCRETO_DADOS_EMPRESA.segmento, 'industria_concreto');
  assert.equal(CONCRETO_DADOS_EMPRESA.enderecoCidade, 'Tangará da Serra');
  assert.equal(CONCRETO_DADOS_EMPRESA.enderecoEstado, 'MT');
});

test('Empresa 1 (Palatare Pizzaria): Gastronomia, zero barbearia', () => {
  assert.equal(PALATARE_DADOS_EMPRESA.tipoNegocio, 'restaurante');
  assert.equal(PALATARE_DADOS_EMPRESA.segmento, 'alimentacao');
  assert.notEqual(PALATARE_DADOS_EMPRESA.tipoNegocio, 'barbearia');
  assert.equal(validarCnpj(PALATARE_CNPJ), true);
});

test('Catalogo e tracos de Concreto Usinado contem FCK 20 a 40 MPa e servicos', () => {
  const fcks = CONCRETO_CATALOGO_INICIAL.map(c => c.fck).filter(Boolean);
  assert.ok(fcks.includes(20), 'Deve ter FCK 20 MPa');
  assert.ok(fcks.includes(25), 'Deve ter FCK 25 MPa');
  assert.ok(fcks.includes(30), 'Deve ter FCK 30 MPa');
  assert.ok(fcks.includes(35), 'Deve ter FCK 35 MPa');
  assert.ok(fcks.includes(40), 'Deve ter FCK 40 MPa');
  const bomba = CONCRETO_CATALOGO_INICIAL.find(c => c.id === 'srv-bomba-lanca-32');
  assert.ok(bomba, 'Deve conter servico de caminhao bomba lanca');
});

test('Frota de Betoneiras e Bombas esta devidamente cadastrada', () => {
  assert.ok(CONCRETO_FROTA_INICIAL.length >= 6, 'Deve ter frota completa de caminhoes');
  const bt01 = CONCRETO_FROTA_INICIAL.find(f => f.codigo === 'BT-01');
  assert.ok(bt01, 'BT-01 deve existir');
  assert.equal(bt01.tipo, 'betoneira');
  assert.equal(bt01.capacidadeM3, 10);
  const bl01 = CONCRETO_FROTA_INICIAL.find(f => f.codigo === 'BL-01');
  assert.ok(bl01, 'BL-01 deve existir');
  assert.equal(bl01.tipo, 'bomba_lanca');
  assert.equal(bl01.alcanceMetros, 32);
});

test('Suprimentos: Silos de Cimento e Pozolana estao configurados', () => {
  assert.ok(CONCRETO_SILOS_INICIAIS.length >= 3, 'Deve ter no minimo 3 silos');
  const silo1 = CONCRETO_SILOS_INICIAIS.find(s => s.id === 'silo-01');
  assert.ok(silo1, 'Silo 01 deve existir');
  assert.equal(silo1.capacidadeToneladas, 100);
  assert.ok(silo1.nivelAtualToneladas > 0);
  assert.ok(silo1.pressaoDespoeiramento.includes('bar'));
});

test('Suprimentos: Baias de Agregados e Umidade estao configuradas', () => {
  assert.ok(CONCRETO_BAIAS_INICIAIS.length >= 5, 'Deve ter no minimo 5 baias');
  const areiaMedia = CONCRETO_BAIAS_INICIAIS.find(b => b.id === 'baia-01');
  assert.ok(areiaMedia, 'Baia 01 de areia media deve existir');
  assert.ok(areiaMedia.umidadePercentual > 0, 'Areia media deve ter teor de umidade');
  assert.ok(areiaMedia.aguaContidaLitros > 0, 'Deve calcular agua contida no estoque de areia');
});

test('Suprimentos: Tanques de Aditivos e Agua Chiller estao configurados', () => {
  assert.ok(CONCRETO_TANQUES_ADITIVOS.length >= 4, 'Deve ter tanques de aditivo e agua');
  const agua = CONCRETO_TANQUES_ADITIVOS.find(t => t.id === 'tanque-04');
  assert.ok(agua, 'Reservatorio de agua chiller deve existir');
  assert.equal(agua.capacidadeLitros, 60000);
});

test('Controle de Processo: Bateladas NBR 7212 possuem rastreabilidade completa', () => {
  assert.ok(CONCRETO_BATELADAS_PROCESSO.length >= 2, 'Deve ter bateladas registradas');
  const bat1 = CONCRETO_BATELADAS_PROCESSO[0];
  assert.ok(bat1.numeroTicket.includes('BAT-2026-'), 'Ticket deve seguir padrao oficial');
  assert.ok(bat1.cimentoPesadoKg > 0);
  assert.ok(bat1.fatorAcReal > 0);
  assert.equal(bat1.conformidadeNBR7212, 'TOTALMENTE_CONFORME');
});

test('Provisionamento local e criacao de entidades de Concreto no datastore', async () => {
  const res = await provisionarConcretoUsina();
  assert.equal(res.ok, true);
  assert.equal(res.empresaId, CONCRETO_EMPRESA_ID);
});
