/**
 * Adaptador Focus NFe
 * Integração com Focus NFe para emissão de NFC-e
 */

import axios from 'axios';
import { config } from '../../config.js';
import { db } from '../../core/database.js';

const focusAPI = axios.create({
  baseURL: config.nfce.focus.apiUrl,
  auth: {
    username: config.nfce.focus.apiKey,
    password: '',
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// EMISSÃO DE NFC-E
// ============================================================================

/**
 * Emitir NFC-e via Focus NFe
 */
export const emitirNfce = async (nfceData) => {
  try {
    const {
      tenantId,
      numero,
      serie,
      dataEmissao,
      naturezaOperacao,
      cliente,
      itens,
      valorTotal,
      valorDesconto,
      valorServico,
    } = nfceData;

    // Obter configurações do tenant
    const configResult = await db.query(
      `
      SELECT c.*, e.cnpj, e.razao_social, e.endereco_estado
      FROM configuracoes_nfce c
      JOIN estabelecimentos e ON c.estabelecimento_id = e.id
      WHERE c.estabelecimento_id = $1 AND c.sefaz_uf = $2
      `,
      [tenantId, nfceData.uf]
    );

    if (configResult.rows.length === 0) {
      throw new Error('Configuração NFC-e não encontrada para este UF');
    }

    const config_nfce = configResult.rows[0];

    // Montar XML da NFC-e
    const xml = montarXmlNfce({
      numero,
      serie,
      dataEmissao,
      naturezaOperacao,
      cliente,
      itens,
      valorTotal,
      valorDesconto,
      valorServico,
      emitente: {
        cnpj: config_nfce.cnpj,
        razaoSocial: config_nfce.razao_social,
        inscricaoEstadual: config_nfce.inscricao_estadual,
      },
      certificado: {
        cscIdToken: config_nfce.csc_id_token,
        cscToken: config_nfce.csc_token,
      },
      ambiente: config_nfce.ambiente,
    });

    // Enviar para Focus NFe
    const response = await focusAPI.post('/nfce', {
      xml,
      referencia: `${tenantId}-${numero}-${serie}`,
    });

    if (response.data.status === 'autorizado') {
      return {
        sucesso: true,
        chaveNfce: response.data.chave_nfce,
        protocoloAutorizacao: response.data.numero_protocolo,
        qrCode: response.data.qr_code,
        urlConsulta: response.data.url_consulta,
      };
    } else if (response.data.status === 'rejeitado') {
      throw new Error(`NFC-e rejeitada: ${response.data.motivo}`);
    } else {
      throw new Error(`Status desconhecido: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Erro ao emitir NFC-e via Focus:', error);
    throw error;
  }
};

/**
 * Consultar status de NFC-e
 */
export const consultarNfce = async (chaveNfce) => {
  try {
    const response = await focusAPI.get(`/nfce/${chaveNfce}`);

    return {
      chaveNfce: response.data.chave_nfce,
      status: response.data.status,
      protocoloAutorizacao: response.data.numero_protocolo,
      dataAutorizacao: response.data.data_autorizacao,
      qrCode: response.data.qr_code,
    };
  } catch (error) {
    console.error('Erro ao consultar NFC-e:', error);
    throw error;
  }
};

/**
 * Cancelar NFC-e
 */
export const cancelarNfce = async (chaveNfce, justificativa) => {
  try {
    const response = await focusAPI.post(`/nfce/${chaveNfce}/cancelamento`, {
      justificativa,
    });

    return {
      chaveNfce: response.data.chave_nfce,
      status: response.data.status,
      protocoloCancelamento: response.data.numero_protocolo,
    };
  } catch (error) {
    console.error('Erro ao cancelar NFC-e:', error);
    throw error;
  }
};

// ============================================================================
// GERAÇÃO DE XML
// ============================================================================

/**
 * Montar XML da NFC-e
 */
const montarXmlNfce = (dados) => {
  const {
    numero,
    serie,
    dataEmissao,
    naturezaOperacao,
    cliente,
    itens,
    valorTotal,
    valorDesconto,
    valorServico,
    emitente,
    certificado,
    ambiente,
  } = dados;

  // Formato de data: YYYY-MM-DD HH:MM:SS
  const dataFormatada = dataEmissao.toISOString().slice(0, 19).replace('T', ' ');

  // Montar itens
  const itensXml = itens
    .map(
      (item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <code>${item.codigo || 'PROD' + (index + 1)}</code>
        <xProd>${item.descricao}</xProd>
        <NCM>${item.ncm || '00000000'}</NCM>
        <CFOP>${item.cfop || '5102'}</CFOP>
        <uCom>${item.unidade || 'un'}</uCom>
        <qCom>${item.quantidade}</qCom>
        <vUnCom>${item.valorUnitario.toFixed(2)}</vUnCom>
        <vItem>${item.valorTotal.toFixed(2)}</vItem>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <Orig>0</Orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>07</CST>
            <vBC>${item.valorTotal.toFixed(2)}</vBC>
            <pPIS>0.00</pPIS>
            <vPIS>0.00</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>07</CST>
            <vBC>${item.valorTotal.toFixed(2)}</vBC>
            <pCOFINS>0.00</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>
  `
    )
    .join('');

  // Montar XML completo
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${numero}${serie}${dataFormatada.replace(/[^0-9]/g, '')}">
    <ide>
      <cUF>35</cUF>
      <cNF>${numero}</cNF>
      <natOp>${naturezaOperacao}</natOp>
      <indPag>0</indPag>
      <mod>65</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dEmi>${dataFormatada.split(' ')[0]}</dEmi>
      <hEmi>${dataFormatada.split(' ')[1]}</hEmi>
      <cMunFG>3500105</cMunFG>
      <tpImp>2</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>0</cDV>
      <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emitente.cnpj}</CNPJ>
      <xNome>${emitente.razaoSocial}</xNome>
      <xFant>Loja</xFant>
      <IE>${emitente.inscricaoEstadual}</IE>
      <IEST></IEST>
      <IM></IM>
      <CNAE></CNAE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <CNPJ>${cliente.cnpj || '00000000000000'}</CNPJ>
      <xNome>${cliente.nome || 'Consumidor'}</xNome>
      <indIEDest>9</indIEDest>
    </dest>
    <det>
      ${itensXml}
    </det>
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUestDeson>0.00</vFCPUestDeson>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTUest>0.00</vFCPSTUest>
        <vProd>${valorTotal.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${valorDesconto.toFixed(2)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${(valorTotal - valorDesconto + valorServico).toFixed(2)}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${(valorTotal - valorDesconto + valorServico).toFixed(2)}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>Emitida por SetPoint Ultra</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

  return xml;
};

// ============================================================================
// REPROCESSAMENTO EM CONTINGÊNCIA
// ============================================================================

/**
 * Reprocessar NFC-e da fila de contingência
 */
export const reprocessarContingencia = async (tenantId) => {
  try {
    // Obter NFC-es pendentes
    const result = await db.query(
      `
      SELECT id, xml_nfce, tentativas
      FROM fila_nfce_contingencia
      WHERE estabelecimento_id = $1 AND status = 'pendente'
      AND proxima_tentativa <= NOW()
      LIMIT 10
      `,
      [tenantId]
    );

    const nfcesPendentes = result.rows;
    const resultados = [];

    for (const nfce of nfcesPendentes) {
      try {
        // Tentar enviar novamente
        const response = await focusAPI.post('/nfce', {
          xml: nfce.xml_nfce,
        });

        if (response.data.status === 'autorizado') {
          // Atualizar fila
          await db.query(
            `
            UPDATE fila_nfce_contingencia
            SET status = 'sucesso', atualizado_em = NOW()
            WHERE id = $1
            `,
            [nfce.id]
          );

          resultados.push({
            id: nfce.id,
            status: 'sucesso',
            chaveNfce: response.data.chave_nfce,
          });
        } else {
          throw new Error(`Status: ${response.data.status}`);
        }
      } catch (error) {
        // Atualizar tentativas
        const proximaTentativa = new Date();
        proximaTentativa.setSeconds(
          proximaTentativa.getSeconds() +
            config.nfce.contingencia.retryIntervalSeconds
        );

        await db.query(
          `
          UPDATE fila_nfce_contingencia
          SET tentativas = tentativas + 1,
              proxima_tentativa = $1,
              status = CASE WHEN tentativas >= $2 THEN 'erro' ELSE 'pendente' END,
              motivo_erro = $3,
              atualizado_em = NOW()
          WHERE id = $4
          `,
          [
            proximaTentativa,
            config.nfce.contingencia.maxRetries,
            error.message,
            nfce.id,
          ]
        );

        resultados.push({
          id: nfce.id,
          status: 'erro',
          erro: error.message,
        });
      }
    }

    return resultados;
  } catch (error) {
    console.error('Erro ao reprocessar contingência:', error);
    throw error;
  }
};

export default {
  emitirNfce,
  consultarNfce,
  cancelarNfce,
  reprocessarContingencia,
};
