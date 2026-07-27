/**
 * Service: Fiscal Nacional Completo (MOTOR PRÓPRIO)
 * SetPoint Ultra — NFC-e, NF-e, NF-Se, CT-e
 * Sem dependência de provedores externos. Comunicação direta com SEFAZ.
 */
import { db } from '../../core/database.js';
import * as motor from '../../core/fiscal-engine.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CERT_DIR = path.join(__dirname, '../../data/certificados');

// ============================================================================
// CONFIGURAÇÃO FISCAL DO TENANT E CERTIFICADO
// ============================================================================

export async function obterConfigFiscal(tenantId) {
  const result = await db.query('SELECT * FROM fiscal_configuracoes WHERE tenant_id = $1', [tenantId]);
  return result.rows[0] || null;
}

export async function salvarConfigFiscal(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO fiscal_configuracoes
      (tenant_id, cnpj, ie, im, razao_social, nome_fantasia, regime_tributario,
       ambiente, uf, csc_id, csc, serie_nfce, serie_nfe)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (tenant_id) DO UPDATE SET
       cnpj=$2, ie=$3, im=$4, razao_social=$5, nome_fantasia=$6,
       regime_tributario=$7, ambiente=$8, uf=$9, csc_id=$10, csc=$11,
       serie_nfce=$12, serie_nfe=$13, updated_at=NOW()
     RETURNING *`,
    [tenantId, dados.cnpj, dados.ie, dados.im, dados.razao_social, dados.nome_fantasia,
     dados.regime_tributario || 'simples', dados.ambiente || 'homologacao',
     dados.uf, dados.csc_id, dados.csc, dados.serie_nfce || 1, dados.serie_nfe || 1]
  );
  return result.rows[0];
}

export async function uploadCertificadoA1(tenantId, base64Pfx, senha) {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

  const pfxPath = path.join(CERT_DIR, `cert_${tenantId}.pfx`);
  fs.writeFileSync(pfxPath, Buffer.from(base64Pfx, 'base64'));

  // Testar leitura e extração para garantir que a senha está correta
  try {
    motor.extrairChavesCertificado(pfxPath, senha);
  } catch (err) {
    fs.unlinkSync(pfxPath);
    throw new Error('Certificado inválido ou senha incorreta: ' + err.message);
  }

  await db.query(
    `UPDATE fiscal_configuracoes SET certificado_senha = $1, certificado_valido = TRUE WHERE tenant_id = $2`,
    [senha, tenantId]
  );
  return { sucesso: true, mensagem: 'Certificado A1 configurado com sucesso' };
}

// ============================================================================
// EMISSÃO DE NFC-e (MOTOR PRÓPRIO)
// ============================================================================

export async function emitirNFCe(tenantId, dadosVenda) {
  const config = await obterConfigFiscal(tenantId);
  if (!config || !config.certificado_valido) throw new Error('Configuração fiscal ou certificado ausente');

  const pfxPath = path.join(CERT_DIR, `cert_${tenantId}.pfx`);

  // Obter próximo número
  const numeroResult = await db.query(
    `UPDATE fiscal_configuracoes SET proximo_numero_nfce = proximo_numero_nfce + 1 WHERE tenant_id = $1 RETURNING proximo_numero_nfce - 1 AS numero`,
    [tenantId]
  );
  const numero = numeroResult.rows[0].numero;

  // Gerar Chave de Acesso
  const codigoAleatorio = Math.floor(Math.random() * 99999999);
  const ufCodigo = '51'; // MT
  const anoMes = new Date().toISOString().slice(2,7).replace('-','');
  const chaveAcesso = motor.gerarChaveAcesso(ufCodigo, anoMes, config.cnpj, '65', config.serie_nfce, numero, '1', codigoAleatorio);

  // Registrar documento
  const docResult = await db.query(
    `INSERT INTO fiscal_documentos
      (tenant_id, tipo, numero, serie, status, ambiente, valor_total,
       destinatario_nome, destinatario_cpf_cnpj, chave_acesso)
     VALUES ($1,'nfce',$2,$3,'processando',$4,$5,$6,$7,$8)
     RETURNING *`,
    [tenantId, numero, config.serie_nfce, config.ambiente, dadosVenda.valor_total,
     dadosVenda.destinatario_nome, dadosVenda.destinatario_cpf, chaveAcesso]
  );
  const docId = docResult.rows[0].id;

  // Emissão Assíncrona
  setImmediate(async () => {
    try {
      // 1. Montar XML
      const xmlOriginal = montarXMLNFCe(config, dadosVenda, numero, chaveAcesso, codigoAleatorio);

      // 2. Assinar XML com A1
      const xmlAssinado = motor.assinarXml(xmlOriginal, 'infNFe', pfxPath, config.certificado_senha);

      // 3. Montar Lote
      const idLote = Date.now().toString();
      const xmlLote = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${xmlAssinado}</enviNFe>`;

      // 4. Enviar SEFAZ
      const respostaSefaz = await motor.enviarSefaz(config.uf, config.ambiente, 'NfeAutorizacao', xmlLote, pfxPath, config.certificado_senha);

      // 5. Processar Retorno (Síncrono)
      const retEnviNFe = respostaSefaz?.['soapenv:Envelope']?.['soapenv:Body']?.['nfeResultMsg']?.['retEnviNFe'];
      const protNFe = retEnviNFe?.protNFe?.infProt;

      if (protNFe && protNFe.cStat === '100') { // Autorizado
        await db.query(
          `UPDATE fiscal_documentos SET status = 'autorizado', protocolo = $1, data_autorizacao = $2, xml_retorno = $3 WHERE id = $4`,
          [protNFe.nProt, protNFe.dhRecbto, xmlAssinado, docId]
        );
      } else { // Rejeitado
        const motivo = protNFe?.xMotivo || retEnviNFe?.xMotivo || 'Rejeição Desconhecida';
        await db.query(
          `UPDATE fiscal_documentos SET status = 'rejeitado', motivo_rejeicao = $1 WHERE id = $2`,
          [motivo, docId]
        );
      }
    } catch (err) {
      console.error(`[FISCAL PRÓPRIO] Erro ao emitir NFC-e ${numero}:`, err.message);
      await db.query(
        `UPDATE fiscal_documentos SET status = 'contingencia', motivo_rejeicao = $1 WHERE id = $2`,
        [err.message, docId]
      );
    }
  });

  return docResult.rows[0];
}

// ============================================================================
// HELPERS XML
// ============================================================================

function montarXMLNFCe(config, venda, numero, chave, cNF) {
  // Simplificação didática do layout XML da NFe 4.00
  return `
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="4.00">
    <ide>
      <cUF>51</cUF>
      <cNF>${String(cNF).padStart(8,'0')}</cNF>
      <natOp>VENDA AO CONSUMIDOR</natOp>
      <mod>65</mod>
      <serie>${config.serie_nfce}</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${new Date().toISOString()}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>5107909</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>${config.ambiente === 'producao' ? 1 : 2}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>SetPointUltra-3.0</verProc>
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g,'')}</CNPJ>
      <xNome>${config.razao_social}</xNome>
      <enderEmit>
        <xLgr>Rua Exemplo</xLgr>
        <nro>123</nro>
        <xBairro>Centro</xBairro>
        <cMun>5107909</cMun>
        <xMun>Tangara da Serra</xMun>
        <UF>MT</UF>
        <CEP>78300000</CEP>
      </enderEmit>
      <IE>${config.ie.replace(/\D/g,'')}</IE>
      <CRT>${config.regime_tributario === 'simples' ? 1 : 3}</CRT>
    </emit>
    ${venda.destinatario_cpf ? `
    <dest>
      <CPF>${venda.destinatario_cpf.replace(/\D/g,'')}</CPF>
      <xNome>${venda.destinatario_nome}</xNome>
      <indIEDest>9</indIEDest>
    </dest>` : ''}
    ${venda.itens.map((i, idx) => `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${i.codigo || i.produto_id}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${i.descricao}</xProd>
        <NCM>00000000</NCM>
        <CFOP>5102</CFOP>
        <uCom>${i.unidade || 'UN'}</uCom>
        <qCom>${i.quantidade}</qCom>
        <vUnCom>${i.valor_unitario}</vUnCom>
        <vProd>${i.valor_total}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${i.unidade || 'UN'}</uTrib>
        <qTrib>${i.quantidade}</qTrib>
        <vUnTrib>${i.valor_unitario}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS><PISNT><CST>07</CST></PISNT></PIS>
        <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
      </imposto>
    </det>`).join('')}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${venda.valor_total}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${venda.valor_total}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${venda.valor_total}</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`.trim();
}

// ============================================================================
// CONSULTAS
// ============================================================================

export async function listarDocumentos(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE tenant_id = $1';
  if (filtros.tipo) { params.push(filtros.tipo); where += ` AND tipo = $${params.length}`; }
  if (filtros.status) { params.push(filtros.status); where += ` AND status = $${params.length}`; }

  const result = await db.query(
    `SELECT id, tipo, numero, serie, status, ambiente, chave_acesso, protocolo,
            data_emissao, data_autorizacao, valor_total, destinatario_nome, motivo_rejeicao
     FROM fiscal_documentos ${where} ORDER BY data_emissao DESC LIMIT 200`,
    params
  );
  return result.rows;
}
