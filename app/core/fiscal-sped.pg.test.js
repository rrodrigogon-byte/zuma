// F4 do fiscal: SPED (EFD ICMS/IPI leiaute 020 e EFD-Contribuições leiaute 006) gerado das notas
// emitidas. Confere a estrutura (quantidade de campos de cada registro conforme os guias oficiais,
// totais dos blocos e do bloco 9) e os valores (C190/E110, C101/E300/E310, C175/C170/M210/M610).
import { describe, it as test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pgDeTeste, criarBancoTeste } from './fixtures/clube-pg.js';
import { pfxDeTeste } from './nfse-teste-certificado.js';
import * as fiscal from '../modules/fiscal/servico.js';
import * as sped from '../modules/fiscal/sped.js';

const sql = (arquivo) => readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8');
const STUBS = `
CREATE TABLE empresas (id UUID PRIMARY KEY);
CREATE TABLE lojas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id UUID NOT NULL, nome VARCHAR(255), ativa BOOLEAN NOT NULL DEFAULT true);`;
const SENHA = 'senha-teste';
const PFX = pfxDeTeste(SENHA);
const EMIT = {
  cnpj: '50073355000260', razaoSocial: 'LOJA TESTE PRESUMIDO LTDA', nomeFantasia: 'Loja Teste', ie: '131234567', im: '12345', crt: '3', uf: 'MT', codigoMunicipio: '5107958',
  endereco: { logradouro: 'Rua A', numero: '80', bairro: 'Centro', cidade: 'Tangara da Serra', cep: '78300000' }, cscId: '000001', csc: 'CSC-HOMOLOG-123456',
};
const DEST_SP = {
  cpf: '52998224725', nome: 'CLIENTE SP', indIEDest: '9',
  endereco: { logradouro: 'Av Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'Sao Paulo', uf: 'SP', codigoMunicipio: '3550308', cep: '01310100' },
};
const CONTADOR = { nome: 'Maria Contadora', cpf: '52998224725', crc: 'MT-012345/O-1', cep: '78300000', endereco: 'Rua B', numero: '10', bairro: 'Centro', codigoMunicipio: '5107958', email: 'contadora@exemplo.com' };

const sefazFalsa = () => async ({ url, xml }) => {
  const tpAmb = (xml.match(/<tpAmb>(\d)<\/tpAmb>/) || [])[1] || '2';
  if (/recepcaoevento/i.test(url)) return { status: 200, corpo: `<retEnvEvento><cStat>128</cStat><retEvento><infEvento><tpAmb>${tpAmb}</tpAmb><cStat>135</cStat><xMotivo>ok</xMotivo><nProt>1</nProt></infEvento></retEvento></retEnvEvento>` };
  const chave = (xml.match(/Id="NFe(\d{44})"/) || [])[1];
  return { status: 200, corpo: `<retEnviNFe><cStat>104</cStat><xMotivo>ok</xMotivo><protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><chNFe>${chave}</chNFe><nProt>151260000000999</nProt><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protNFe></retEnviNFe>` };
};

// quantidade de campos (com o REG) de cada registro, conforme os guias práticos
const CAMPOS_ICMS = {
  '0000': 15, '0001': 2, '0005': 10, '0100': 14, '0150': 13, '0990': 2, B001: 2, B990: 2, C001: 2, C100: 29, C101: 4, C190: 12, C990: 2, D001: 2, D990: 2,
  E001: 2, E100: 3, E110: 15, E116: 10, E300: 4, E310: 22, E316: 10, E990: 2, G001: 2, G990: 2, H001: 2, H990: 2, K001: 2, K990: 2, 1001: 2, 1010: 14, 1990: 2,
  9001: 2, 9900: 3, 9990: 2, 9999: 2,
};
const CAMPOS_CONTRIB = {
  '0000': 14, '0001': 2, '0100': 14, '0110': 5, '0140': 9, '0150': 13, '0190': 3, '0200': 12, '0990': 2, A001: 2, A990: 2, C001: 2, C010: 3, C100: 29, C170: 37, C175: 18,
  C990: 2, D001: 2, D990: 2, F001: 2, F990: 2, I001: 2, I990: 2, M001: 2, M200: 13, M210: 16, M400: 5, M600: 13, M610: 16, M800: 5, M990: 2, P001: 2, P990: 2,
  1001: 2, 1990: 2, 9001: 2, 9900: 3, 9990: 2, 9999: 2,
};
function validarEstrutura(conteudo, campos, ordemBlocos) {
  assert.ok(conteudo.endsWith('\r\n'), 'linhas terminam em CRLF');
  const linhas = conteudo.slice(0, -2).split('\r\n');
  const regs = linhas.map((l) => {
    assert.match(l, /^\|.*\|$/, `linha delimitada por |: ${l}`);
    const f = l.slice(1, -1).split('|');
    assert.ok(campos[f[0]], `registro conhecido: ${f[0]}`);
    assert.equal(f.length, campos[f[0]], `quantidade de campos do ${f[0]}: ${l}`);
    return f;
  });
  // ordem dos blocos
  const blocos = [...new Set(regs.map((f) => f[0][0]))];
  assert.deepEqual(blocos, ordemBlocos);
  // X990 = linhas do bloco
  for (const b of ordemBlocos) {
    const doBloco = regs.filter((f) => f[0][0] === b);
    const fim = doBloco.find((f) => f[0] === `${b}990`);
    assert.equal(Number(fim[1]), doBloco.length, `${b}990`);
  }
  // 9900: uma linha por registro, com a quantidade certa; 9999 = total de linhas
  const cont = new Map(); for (const f of regs) cont.set(f[0], (cont.get(f[0]) || 0) + 1);
  const r9900 = regs.filter((f) => f[0] === '9900');
  assert.equal(r9900.length, cont.size);
  for (const f of r9900) assert.equal(Number(f[2]), cont.get(f[1]), `9900 de ${f[1]}`);
  assert.equal(Number(regs.at(-1)[1]), linhas.length);
  // nada fora do ISO-8859-1
  assert.ok(/^[\x00-\xff]*$/.test(conteudo), 'só caracteres ISO-8859-1');
  return regs;
}
const ORDEM_ICMS = ['0', 'B', 'C', 'D', 'E', 'G', 'H', 'K', '1', '9'];
const ORDEM_CONTRIB = ['0', 'A', 'C', 'D', 'F', 'I', 'M', 'P', '1', '9'];

describe('Fiscal F4 — SPED a partir das notas emitidas (PostgreSQL)', { skip: pgDeTeste }, () => {
  let ctx;
  const A = randomUUID(); const S = randomUUID();
  const ENV = { FISCAL_CERT_MASTER_KEY: randomBytes(32).toString('hex'), FISCAL_TRANSMITIR_HOMOLOGACAO: '1' };
  const agora = new Date();
  const ano = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric' }).format(agora));
  const mes = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', month: 'numeric' }).format(agora));
  const periodo = { ano, mes, ambiente: 'homologacao' };

  before(async () => {
    ctx = await criarBancoTeste();
    await ctx.db.query(STUBS);
    for (const m of ['081_bar_pdv_multiempresa.sql', '092_fiscal_multiempresa.sql', '100_fiscal_completo.sql', '106_fiscal_producao.sql', '108_fiscal_ibs_cbs.sql']) await ctx.db.query(sql(m));
    await ctx.db.query('INSERT INTO empresas (id) VALUES ($1), ($2)', [A, S]);
    await fiscal.salvarEmitente(ctx.db, A, EMIT, { env: ENV });
    await fiscal.salvarEmitente(ctx.db, S, { ...EMIT, crt: '1' }, { env: ENV });
    for (const e of [A, S]) await fiscal.importarCertificado(ctx.db, e, { arquivoBase64: PFX, senha: SENHA }, { env: ENV });
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'est_item', fonteId: 'perfume', ncm: '33030010', cfop: '5102', cstIcms: '00', aliquotaIcms: 17, cstPis: '01', aliquotaPis: 0.65, cstCofins: '01', aliquotaCofins: 3 });
    await fiscal.salvarClassificacao(ctx.db, A, { fonte: 'est_item', fonteId: 'pomada', ncm: '33059000', cfop: '5102', cstIcms: '20', aliquotaIcms: 17, reducaoBaseIcms: 41.1765, cstPis: '01', aliquotaPis: 0.65, cstCofins: '01', aliquotaCofins: 3 });
  });
  after(async () => { await ctx?.fechar(); });

  const emitir = (empresa, corpo) => fiscal.emitir(ctx.db, empresa, corpo, { env: ENV, transporte: sefazFalsa(), agora });

  test('sem contador cadastrado: pendência; Simples Nacional é dispensado', async () => {
    await assert.rejects(() => sped.gerarEfdIcmsIpi(ctx.db, A, periodo), (e) => e.code === 'PENDENCIAS_SPED' && /contador/.test(e.message));
    await sped.salvarConfigSped(ctx.db, S, { contador: CONTADOR });
    await assert.rejects(() => sped.gerarEfdIcmsIpi(ctx.db, S, periodo), (e) => e.code === 'SIMPLES_DISPENSADO');
    await assert.rejects(() => sped.gerarEfdContribuicoes(ctx.db, S, periodo), (e) => e.code === 'SIMPLES_DISPENSADO');
    await assert.rejects(() => sped.salvarConfigSped(ctx.db, A, { contador: { ...CONTADOR, cpf: '123' } }), (e) => /CPF/.test(e.message));
    const cfg = await sped.salvarConfigSped(ctx.db, A, { perfil: 'B', codReceitaIcms: '1112', diaVencimentoIcms: 15, codReceitaDifal: '2817', contador: CONTADOR });
    assert.equal(cfg.perfil, 'B');
    assert.equal(cfg.contador.crc, 'MT-012345/O-1');
    assert.deepEqual(await sped.obterConfigSped(ctx.db, A), cfg);
  });

  test('EFD ICMS/IPI: estrutura do leiaute 020 e apuração dos débitos das saídas', async () => {
    const n1 = await emitir(A, { modelo: '65', origem: 'manual', idempotencia: 's-1', itens: [{ fonte: 'est_item', fonteId: 'perfume', descricao: 'Perfume', quantidade: 1, valorUnitario: 100 }, { fonte: 'est_item', fonteId: 'pomada', descricao: 'Pomada', quantidade: 2, valorUnitario: 50 }] });
    const n2 = await emitir(A, { modelo: '65', origem: 'manual', idempotencia: 's-2', itens: [{ fonte: 'est_item', fonteId: 'perfume', descricao: 'Perfume', quantidade: 1, valorUnitario: 200 }] });
    const nfe = await emitir(A, { modelo: '55', origem: 'manual', idempotencia: 's-3', destinatario: DEST_SP, consumidorFinal: true, difal: { aliquotaInternaDestino: 18, fcpDestino: 2 }, itens: [{ fonte: 'est_item', fonteId: 'perfume', descricao: 'Perfume', quantidade: 1, valorUnitario: 300 }] });
    for (const d of [n1, n2, nfe]) assert.equal(d.status, 'autorizado');
    await fiscal.cancelar(ctx.db, A, n2.id, { justificativa: 'Cliente desistiu da compra no caixa', env: ENV, transporte: sefazFalsa(), agora });

    const r = await sped.gerarEfdIcmsIpi(ctx.db, A, periodo);
    const regs = validarEstrutura(r.conteudo, CAMPOS_ICMS, ORDEM_ICMS);
    const reg = (codigo) => regs.filter((f) => f[0] === codigo);
    assert.equal(reg('0000')[0][1], sped.COD_VER_EFD_ICMS_IPI[ano] || reg('0000')[0][1]);
    assert.equal(reg('0000')[0][13], 'B');
    assert.equal(reg('0000')[0][14], '1');
    assert.equal(reg('0100')[0][1], 'Maria Contadora');
    assert.equal(reg('0150').length, 1, 'participante só da NF-e');
    assert.equal(reg('C100').length, 3);
    const cancelada = reg('C100').find((f) => f[5] === '02');
    assert.equal(cancelada[7], String(n2.numero));
    assert.ok(cancelada.slice(9).every((c) => c === ''), 'cancelada só com os campos de identificação');
    const nfce = reg('C100').find((f) => f[4] === '65' && f[5] === '00');
    assert.equal(nfce[3], '', 'NFC-e sem participante');
    assert.equal(nfce[22], ''); assert.equal(nfce[25], '', 'NFC-e sem ST/PIS/COFINS no C100');
    // C190 da NFC-e 1: CST 000 (17% sobre 100 = 17) e CST 020 (base 58,82 → 10,00; redução 41,18)
    const c190 = reg('C190');
    const g000 = c190.find((f) => f[1] === '000' && f[2] === '5102');
    assert.deepEqual([g000[3], g000[4], g000[5], g000[6]], ['17,00', '100,00', '100,00', '17,00']);
    const g020 = c190.find((f) => f[1] === '020');
    assert.deepEqual([g020[4], g020[5], g020[6], g020[9]], ['100,00', '58,82', '10,00', '41,18']);
    // NF-e interestadual: CFOP 6102, C101 com o DIFAL, E300/E310 de SP
    assert.ok(c190.some((f) => f[2] === '6102'));
    assert.deepEqual(reg('C101')[0].slice(1), ['6,00', '18,00', '0,00']);
    assert.equal(reg('E300')[0][1], 'SP');
    assert.equal(reg('E310')[0][3], '18,00');
    assert.equal(reg('E310')[0][13], '6,00');
    assert.deepEqual(reg('E316').map((f) => f[1]), ['000', '006']);
    // E110: débitos = ICMS das saídas válidas (17 + 10 + ICMS da NF-e); a cancelada fica fora
    const icmsNfe = Number(c190.filter((f) => f[2] === '6102').reduce((s, f) => s + Number(f[6].replace(',', '.')), 0).toFixed(2));
    const debitos = (27 + icmsNfe).toFixed(2).replace('.', ',');
    assert.equal(reg('E110')[0][1], debitos);
    assert.equal(reg('E110')[0][12], debitos);
    assert.equal(reg('E116')[0][4], '1112');
    assert.equal(reg('E116')[0][9], `${String(mes).padStart(2, '0')}${ano}`);
    assert.ok(r.avisos.some((a) => /TESTE/.test(a)));
    assert.equal(r.resumo.documentos, 3);
    assert.equal(r.resumo.cancelados, 1);
    // download em ISO-8859-1
    const dl = sped.arquivoParaDownload(r);
    assert.equal(Buffer.from(dl.base64, 'base64').toString('latin1'), r.conteudo);
    assert.equal(dl.conteudo, undefined);
  });

  test('EFD-Contribuições: estrutura do leiaute 006, C175 da NFC-e, C170 da NF-e e apuração cumulativa', async () => {
    const r = await sped.gerarEfdContribuicoes(ctx.db, A, periodo);
    const regs = validarEstrutura(r.conteudo, CAMPOS_CONTRIB, ORDEM_CONTRIB);
    const reg = (codigo) => regs.filter((f) => f[0] === codigo);
    assert.equal(reg('0000')[0][1], '006');
    assert.deepEqual(reg('0110')[0].slice(1), ['2', '', '1', '9']);
    assert.equal(reg('C010')[0][2], '2');
    assert.ok(reg('C175').length >= 1);
    assert.equal(reg('C170').length, 1, 'item da NF-e');
    assert.equal(reg('0200').length, 1);
    assert.equal(reg('0190')[0][1], 'UN');
    // PIS 0,65% e COFINS 3% sobre as saídas válidas (a cancelada fora)
    const m210 = reg('M210')[0]; const m610 = reg('M610')[0];
    assert.equal(m210[1], '51'); assert.equal(m610[1], '51');
    assert.equal(m210[7], '0,6500'); assert.equal(m610[7], '3,0000');
    const bc = Number(m210[3].replace(',', '.'));
    assert.equal(m210[10], (Math.round(bc * 0.0065 * 100) / 100).toFixed(2).replace('.', ','));
    assert.equal(reg('M200')[0][8], m210[15]);
    assert.equal(reg('M600')[0][12], m610[15]);
    assert.equal(r.resumo.pis, Number(m210[15].replace(',', '.')));
  });
});
