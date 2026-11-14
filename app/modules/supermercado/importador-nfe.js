/**
 * ============================================================================
 * KYTTO ERP · MÓDULO SUPERMERCADO: IMPORTADOR DE XML DE NF-E (SEFAZ v4.00)
 * ============================================================================
 * Parser nativo e resiliente de notas fiscais eletrônicas de fornecedores.
 * Atualiza estoque, cadastra novos produtos, recalcula custo médio e
 * emite evento interno de sincronização com Ultra e Nossa Gente, com cópia segura.
 */
import crypto from 'crypto';
import { db, save } from '../../db.js';
import { kyttoEventBus } from '../../core/kytto-event-bus.js';
import { armazenarCopiaSegura } from '../../core/armazenamento-seguro.js';

/**
 * Extrai conteúdo de uma tag XML de forma simples e robusta
 */
function extrairTag(xml, tag) {
  const reg = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(reg);
  return match ? match[1].trim() : null;
}

/**
 * Extrai todos os blocos de uma tag repetida (ex: <det nItem="...">)
 */
function extrairTodasTags(xml, tag) {
  const reg = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const matches = [];
  let m;
  while ((m = reg.exec(xml)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/**
 * Realiza o parse estruturado do XML da NF-e (procNFe ou NFe)
 */
export function parseXmlNFe(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Conteúdo do XML inválido ou vazio.');
  }

  // 1. Chave de acesso (44 dígitos)
  let chaveAcesso = extrairTag(xmlString, 'chNFe');
  if (!chaveAcesso) {
    const idMatch = xmlString.match(/Id="NFe(\d{44})"/i);
    if (idMatch) chaveAcesso = idMatch[1];
  }

  // 2. Dados de identificação da NF-e
  const ideXml = extrairTag(xmlString, 'ide') || '';
  const numeroNota = extrairTag(ideXml, 'nNF') || '0';
  const serie = extrairTag(ideXml, 'serie') || '1';
  const dataEmissao = extrairTag(ideXml, 'dhEmi') || extrairTag(ideXml, 'dEmi') || new Date().toISOString();

  // 3. Dados do emitente (Fornecedor)
  const emitXml = extrairTag(xmlString, 'emit') || '';
  const fornecedorNome = extrairTag(emitXml, 'xNome') || 'Fornecedor Desconhecido';
  const fornecedorFantasia = extrairTag(emitXml, 'xFant') || fornecedorNome;
  const fornecedorCnpj = extrairTag(emitXml, 'CNPJ') || extrairTag(emitXml, 'CPF') || '';
  const fornecedorIe = extrairTag(emitXml, 'IE') || '';

  // 4. Totais da Nota
  const totalXml = extrairTag(xmlString, 'total') || '';
  const icmsTotXml = extrairTag(totalXml, 'ICMSTot') || '';
  const valorProdutos = parseFloat(extrairTag(icmsTotXml, 'vProd') || '0');
  const valorFrete = parseFloat(extrairTag(icmsTotXml, 'vFrete') || '0');
  const valorTotal = parseFloat(extrairTag(icmsTotXml, 'vNF') || String(valorProdutos));

  // 5. Itens da Nota (<det>)
  const detBlocos = extrairTodasTags(xmlString, 'det');
  const itens = [];

  for (const det of detBlocos) {
    const prodXml = extrairTag(det, 'prod') || '';
    const codigoFornecedor = extrairTag(prodXml, 'cProd') || '';
    const ean = extrairTag(prodXml, 'cEAN') || extrairTag(prodXml, 'cEANTrib') || '';
    const nome = extrairTag(prodXml, 'xNome') || 'Produto sem descrição';
    const ncm = extrairTag(prodXml, 'NCM') || '';
    const cfop = extrairTag(prodXml, 'CFOP') || '';
    const unidade = extrairTag(prodXml, 'uCom') || 'UN';
    const quantidade = parseFloat(extrairTag(prodXml, 'qCom') || '1');
    const valorUnitario = parseFloat(extrairTag(prodXml, 'vUnCom') || '0');
    const valorItemTotal = parseFloat(extrairTag(prodXml, 'vProd') || '0');

    // Extrair validade se houver (<rastro>)
    const rastroXml = extrairTag(det, 'rastro');
    let dataValidade = null;
    let loteCodigo = null;
    if (rastroXml) {
      dataValidade = extrairTag(rastroXml, 'dVal');
      loteCodigo = extrairTag(rastroXml, 'nLote');
    }

    itens.push({
      codigoFornecedor,
      ean: ean && ean !== 'SEM GTIN' ? ean : '',
      nome,
      ncm,
      cfop,
      unidade,
      quantidade,
      valorUnitario,
      valorItemTotal,
      dataValidade,
      loteCodigo
    });
  }

  return {
    chaveAcesso: chaveAcesso || `NFE-LOCAL-${Date.now()}`,
    numeroNota,
    serie,
    dataEmissao,
    fornecedor: {
      nome: fornecedorNome,
      fantasia: fornecedorFantasia,
      cnpj: fornecedorCnpj,
      ie: fornecedorIe
    },
    totais: {
      valorProdutos,
      valorFrete,
      valorTotal
    },
    totalItens: itens.length,
    itens
  };
}

/**
 * Processa a entrada de estoque da NF-e no Supermercado
 */
export async function importarNFeSupermercado(xmlString, tenantId = 'supermercado_kytto_001', opcoes = {}) {
  const parsed = parseXmlNFe(xmlString);
  const data = db();

  // Inicializar coleções de supermercado
  data.supermercado_produtos ||= [];
  data.supermercado_entradas_nfe ||= [];
  data.supermercado_lotes ||= [];

  // Verificar duplicidade de importação da mesma NF-e
  const jaImportada = data.supermercado_entradas_nfe.find(
    e => e.chaveAcesso === parsed.chaveAcesso && e.tenantId === tenantId
  );
  if (jaImportada && !opcoes.permitirDuplicada) {
    throw new Error(`A NF-e nº ${parsed.numeroNota} (Chave: ${parsed.chaveAcesso}) já foi importada anteriormente em ${jaImportada.dataImportacao}.`);
  }

  const produtosAtualizados = [];
  const produtosCadastrados = [];
  const lotesCriados = [];

  for (const item of parsed.itens) {
    // 1. Localizar produto por EAN ou código interno
    let produto = null;
    if (item.ean) {
      produto = data.supermercado_produtos.find(
        p => p.tenantId === tenantId && (p.codigoBarras === item.ean || p.ean === item.ean)
      );
    }
    if (!produto && item.codigoFornecedor) {
      produto = data.supermercado_produtos.find(
        p => p.tenantId === tenantId && (p.codigoInterno === item.codigoFornecedor || p.codigoFornecedor === item.codigoFornecedor)
      );
    }

    if (produto) {
      // PRODUTO EXISTENTE: Atualizar estoque e custo médio ponderado
      const estoqueAnterior = Number(produto.estoqueAtual || produto.estoque || 0);
      const custoAnterior = Number(produto.precoCusto || 0);
      const novoEstoque = estoqueAnterior + item.quantidade;

      // Custo médio ponderado
      const custoMedio = novoEstoque > 0
        ? ((estoqueAnterior * custoAnterior) + (item.quantidade * item.valorUnitario)) / novoEstoque
        : item.valorUnitario;

      produto.estoqueAtual = novoEstoque;
      produto.estoque = novoEstoque;
      produto.precoCusto = Number(custoMedio.toFixed(2));
      produto.ultimoCusto = item.valorUnitario;
      produto.ultimaCompraEm = new Date().toISOString();
      produto.ultimoFornecedor = parsed.fornecedor.nome;

      produtosAtualizados.push({
        id: produto.id,
        nome: produto.nome,
        estoqueAnterior,
        novoEstoque,
        custoAnterior,
        novoCusto: produto.precoCusto
      });
    } else {
      // PRODUTO NOVO: Cadastrar automaticamente
      const markupPadrao = 1.35; // 35% de margem padrão
      const precoVendaSugerido = Number((item.valorUnitario * markupPadrao).toFixed(2));

      // Sugerir setor com base no NCM ou nome
      let setorSugerido = 'Mercearia Geral';
      const ncm = item.ncm;
      if (ncm.startsWith('02') || ncm.startsWith('01')) setorSugerido = 'Açougue & Carnes';
      else if (ncm.startsWith('04')) setorSugerido = 'Laticínios & Frios';
      else if (ncm.startsWith('07') || ncm.startsWith('08')) setorSugerido = 'Hortifrúti';
      else if (ncm.startsWith('19') || ncm.startsWith('20')) setorSugerido = 'Padaria & Confeitaria';
      else if (ncm.startsWith('22')) setorSugerido = 'Bebidas';
      else if (ncm.startsWith('33') || ncm.startsWith('34')) setorSugerido = 'Higiene & Perfumaria';
      else if (ncm.startsWith('38') || ncm.startsWith('28')) setorSugerido = 'Limpeza & Bazar';

      const novoProduto = {
        id: `prod-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        nome: item.nome,
        codigoBarras: item.ean || '',
        ean: item.ean || '',
        codigoInterno: item.codigoFornecedor || '',
        codigoFornecedor: item.codigoFornecedor || '',
        ncm: item.ncm,
        cfop: item.cfop,
        unidadeMedida: item.unidade,
        setor: setorSugerido,
        estoqueAtual: item.quantidade,
        estoque: item.quantidade,
        precoCusto: item.valorUnitario,
        ultimoCusto: item.valorUnitario,
        precoVenda: Math.max(precoVendaSugerido, item.valorUnitario + 0.50),
        ultimaCompraEm: new Date().toISOString(),
        ultimoFornecedor: parsed.fornecedor.nome,
        origemCadastro: 'importacao_nfe_sefaz',
        ativo: true
      };

      data.supermercado_produtos.push(novoProduto);
      produtosCadastrados.push(novoProduto);
      produto = novoProduto;
    }

    // Criar lote se houver validade
    if (item.dataValidade || item.loteCodigo) {
      const novoLote = {
        id: `lote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        produtoId: produto.id,
        produtoNome: produto.nome,
        numeroLote: item.loteCodigo || `LOTE-${parsed.numeroNota}`,
        dataValidade: item.dataValidade || null,
        quantidadeInicial: item.quantidade,
        quantidadeAtual: item.quantidade,
        chaveNfe: parsed.chaveAcesso,
        criadoEm: new Date().toISOString()
      };
      data.supermercado_lotes.push(novoLote);
      lotesCriados.push(novoLote);
    }
  }

  // Registrar histórico da entrada
  const registroEntrada = {
    id: `ent-nfe-${Date.now()}`,
    tenantId,
    chaveAcesso: parsed.chaveAcesso,
    numeroNota: parsed.numeroNota,
    serie: parsed.serie,
    dataEmissao: parsed.dataEmissao,
    dataImportacao: new Date().toISOString(),
    fornecedor: parsed.fornecedor,
    totais: parsed.totais,
    totalItens: parsed.totalItens,
    produtosAtualizadosCount: produtosAtualizados.length,
    produtosCadastradosCount: produtosCadastrados.length,
    lotesCriadosCount: lotesCriados.length,
    usuarioResponsavel: opcoes.usuario || 'Almoxarifado Supermercado'
  };

  data.supermercado_entradas_nfe.unshift(registroEntrada);
  save();

  // ── Sincronização por Evento Interno com Ultra e Nossa Gente ──
  try {
    kyttoEventBus.emitirEvento('supermercado.nfe_importada', {
      tenantId,
      chaveAcesso: parsed.chaveAcesso,
      numeroNota: parsed.numeroNota,
      fornecedorNome: parsed.fornecedor.nome,
      fornecedorCnpj: parsed.fornecedor.cnpj,
      valorTotal: parsed.totais.valorTotal,
      itensTotal: parsed.totalItens,
      atualizados: produtosAtualizados.length,
      cadastrados: produtosCadastrados.length
    }, {
      sistemaOrigem: 'Kytto Supermercado',
      sistemaDestino: 'Ultra / Nossa Gente',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (errBus) {
    console.warn('[EventBus] Alerta na emissão do evento interno:', errBus.message);
  }

  // ── Armazenamento Seguro de Cópia do XML e Metadados ──
  try {
    armazenarCopiaSegura(xmlString, {
      tipo: 'nfe_compra_xml',
      origem: 'SEFAZ NF-e XML Upload',
      nomeArquivo: `nfe-${parsed.numeroNota}-${parsed.chaveAcesso.slice(0, 8)}.xml`,
      mimeType: 'application/xml',
      empresaId: tenantId,
      metadados: {
        chaveAcesso: parsed.chaveAcesso,
        numeroNota: parsed.numeroNota,
        fornecedor: parsed.fornecedor,
        totais: parsed.totais,
        importadoEm: new Date().toISOString()
      }
    });
  } catch (errStorage) {
    console.warn('[ArmazenamentoSeguro] Alerta no arquivamento seguro do XML:', errStorage.message);
  }

  return {
    ok: true,
    mensagem: `NF-e nº ${parsed.numeroNota} importada com sucesso! ${produtosAtualizados.length} produto(s) atualizado(s) e ${produtosCadastrados.length} novo(s) produto(s) cadastrado(s).`,
    chaveAcesso: parsed.chaveAcesso,
    numeroNota: parsed.numeroNota,
    fornecedor: parsed.fornecedor.nome,
    valorTotal: parsed.totais.valorTotal,
    produtosAtualizados,
    produtosCadastrados,
    lotesCriados
  };
}
