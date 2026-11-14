import test from 'node:test';
import assert from 'node:assert';
import { parseXmlNFe, importarNFeSupermercado } from './modules/supermercado/importador-nfe.js';
import {
  listarPlanosClubDino,
  contratarPlanoClubDino,
  consultarAssinaturaCliente,
  abaterCreditoAssinatura,
  painelMetricasClubDino
} from './core/dino-club-assinaturas.js';

const XML_EXEMPLO_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe51261100012345000199550010000045891000045891" versao="4.00">
      <ide>
        <nNF>4589</nNF>
        <serie>1</serie>
        <dhEmi>2026-11-14T10:00:00-04:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>00123450000199</CNPJ>
        <xNome>DISTRIBUIDORA MATO GROSSO ALIMENTOS LTDA</xNome>
        <xFant>MT ALIMENTOS</xFant>
        <IE>134567890</IE>
      </emit>
      <total>
        <ICMSTot>
          <vProd>1250.00</vProd>
          <vFrete>50.00</vFrete>
          <vNF>1300.00</vNF>
        </ICMSTot>
      </total>
      <det nItem="1">
        <prod>
          <cProd>ALIM-001</cProd>
          <cEAN>7891000100101</cEAN>
          <xNome>ARROZ POLIDO TIPO 1 5KG TANGARA</xNome>
          <NCM>10063021</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>22.5000</vUnCom>
          <vProd>1125.00</vProd>
        </prod>
        <rastro>
          <nLote>LT-2026-NOV</nLote>
          <dVal>2027-05-30</dVal>
        </rastro>
      </det>
      <det nItem="2">
        <prod>
          <cProd>BEB-002</cProd>
          <cEAN>7892000200202</cEAN>
          <xNome>REFRIGERANTE GUARANA 2L</xNome>
          <NCM>22021000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>25.0000</qCom>
          <vUnCom>5.0000</vUnCom>
          <vProd>125.00</vProd>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

test('1. Parse de XML da NF-e SEFAZ: Extrai chave, emitente, totais e itens', () => {
  const parsed = parseXmlNFe(XML_EXEMPLO_NFE);
  assert.strictEqual(parsed.numeroNota, '4589');
  assert.strictEqual(parsed.chaveAcesso, '51261100012345000199550010000045891000045891');
  assert.strictEqual(parsed.fornecedor.cnpj, '00123450000199');
  assert.strictEqual(parsed.fornecedor.fantasia, 'MT ALIMENTOS');
  assert.strictEqual(parsed.totais.valorTotal, 1300.00);
  assert.strictEqual(parsed.itens.length, 2);
  assert.strictEqual(parsed.itens[0].ean, '7891000100101');
  assert.strictEqual(parsed.itens[0].quantidade, 50);
  assert.strictEqual(parsed.itens[0].valorUnitario, 22.50);
  assert.strictEqual(parsed.itens[0].dataValidade, '2027-05-30');
});

test('2. Importação no Supermercado: Cadastra produtos novos e cria lotes', async () => {
  const tenantId = `teste_sup_${Date.now()}`;
  const res = await importarNFeSupermercado(XML_EXEMPLO_NFE, tenantId);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.numeroNota, '4589');
  assert.strictEqual(res.produtosCadastrados.length, 2);
  assert.strictEqual(res.lotesCriados.length, 1);
  assert.ok(res.produtosCadastrados[0].precoVenda > res.produtosCadastrados[0].precoCusto);
});

test('3. Club Dino: Lista os 3 planos canônicos (Silver, Gold, Black)', () => {
  const planos = listarPlanosClubDino();
  assert.strictEqual(planos.length, 3);
  const silver = planos.find(p => p.codigo === 'silver');
  const gold = planos.find(p => p.codigo === 'gold');
  const black = planos.find(p => p.codigo === 'black');
  assert.strictEqual(silver.mensalidade, 139.00);
  assert.strictEqual(gold.mensalidade, 229.00);
  assert.strictEqual(black.mensalidade, 399.00);
});

test('4. Club Dino: Contrata plano, consulta e abate créditos na comanda', async () => {
  const tel = `65999${Date.now().toString().slice(-6)}`;
  const contrato = await contratarPlanoClubDino({
    clienteNome: 'João Silva Teste',
    clienteTelefone: tel,
    planoCodigo: 'gold'
  });
  assert.strictEqual(contrato.ok, true);
  assert.strictEqual(contrato.assinatura.creditosDisponiveis.cortes, 2);
  assert.strictEqual(contrato.assinatura.creditosDisponiveis.barbas, 2);

  // Consulta por telefone
  const consulta = consultarAssinaturaCliente(tel);
  assert.ok(consulta);
  assert.strictEqual(consulta.clienteNome, 'João Silva Teste');

  // Abater 1 crédito de corte
  const abate = abaterCreditoAssinatura(tel, 'corte', { profissionalNome: 'Nati' });
  assert.strictEqual(abate.ok, true);
  assert.strictEqual(abate.creditosRestantes.cortes, 1);
  assert.strictEqual(abate.creditosRestantes.barbas, 2);

  // Métricas do Clube
  const metricas = painelMetricasClubDino();
  assert.ok(metricas.totalAssinantes >= 1);
  assert.ok(metricas.mrr >= 229.00);
});
