import React from 'react';
import { FileText, X, Printer, Download, Share2, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';

export default function DanfeModal({ isOpen, onClose, docData }) {
  if (!isOpen || !docData) return null;

  const doc = {
    numero: docData.id || 'NFE-2026-08912',
    tipo: docData.tipo || 'NF-e 55',
    serie: '001',
    dataEmissao: new Date().toLocaleDateString('pt-BR'),
    horaEmissao: docData.hora || '13:36:00',
    chave: docData.chave || '5126081498200100412855001000008912100089125',
    protocolo: docData.protocolo || '151260009840118',
    status: 'AUTORIZADA SEFAZ-MT',
    emitente: {
      razao: 'SERRANO CONCRETO & MINERAÇÃO LTDA',
      fantasia: 'SERRANO CONCRETO CCO',
      cnpj: '14.982.001/0001-41',
      ie: '13.482.901-0',
      endereco: 'Rodovia MT-358, KM 08 — Zona Rural / Distrito Industrial',
      municipio: 'Tangará da Serra',
      uf: 'MT',
      cep: '78300-000',
      telefone: '(65) 3326-8800'
    },
    destinatario: {
      razao: docData.cliente || 'CONSTRUTORA ALVORADA LTDA',
      cnpj: '08.412.981/0001-92',
      ie: '13.912.441-2',
      endereco: docData.endereco || 'Av. Brasil, 1420 — Canteiro Residencial Manacá',
      municipio: 'Tangará da Serra',
      uf: 'MT',
      cep: '78300-000'
    },
    transporte: {
      modalidade: '0 - Transporte por Conta do Remetente (CIF)',
      placa: docData.placa || 'QBF-6M02',
      uf: 'MT',
      rntrc: '04918290',
      motorista: docData.motorista || 'Valdir Silveira',
      pesoBrutoKg: docData.brutoKg || 33540,
      taraKg: docData.taraKg || 12920,
      pesoLiquidoKg: (docData.brutoKg || 33540) - (docData.taraKg || 12920)
    },
    itens: [
      {
        codigo: 'CNC-FCK30B',
        descricao: docData.produto || 'CONCRETO USINADO FCK 30 MPA BOMBEÁVEL - ABNT NBR 7212',
        ncm: '3824.50.00',
        cfop: '5102',
        unidade: 'M3',
        quantidade: docData.volumeM3 || 10.0,
        valorUnitario: 485.00,
        valorTotal: (docData.volumeM3 || 10.0) * 485.00
      }
    ]
  };

  const valorTotalNF = doc.itens.reduce((acc, it) => acc + it.valorTotal, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadXml = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${doc.chave}" versao="4.00">
      <ide>
        <cUF>51</cUF>
        <cNF>00008912</cNF>
        <natOp>Venda de Concreto Usinado Industrial</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>${doc.numero.replace(/\D/g, '')}</nNF>
        <dhEmi>${new Date().toISOString()}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>5107909</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>${doc.emitente.cnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${doc.emitente.razao}</xNome>
        <xFant>${doc.emitente.fantasia}</xFant>
        <enderEmit>
          <xLgr>${doc.emitente.endereco}</xLgr>
          <xMun>${doc.emitente.municipio}</xMun>
          <UF>${doc.emitente.uf}</UF>
          <CEP>${doc.emitente.cep.replace(/\D/g, '')}</CEP>
        </enderEmit>
        <IE>${doc.emitente.ie.replace(/\D/g, '')}</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${doc.destinatario.cnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${doc.destinatario.razao}</xNome>
        <enderDest>
          <xLgr>${doc.destinatario.endereco}</xLgr>
          <xMun>${doc.destinatario.municipio}</xMun>
          <UF>${doc.destinatario.uf}</UF>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>${doc.destinatario.ie.replace(/\D/g, '')}</IE>
      </dest>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vProd>${valorTotalNF.toFixed(2)}</vProd>
          <vNF>${valorTotalNF.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SEFAZ-MT_4.00</verAplic>
      <chNFe>${doc.chave}</chNFe>
      <dhRecbto>${new Date().toISOString()}</dhRecbto>
      <nProt>${doc.protocolo}</nProt>
      <digVal>KyttoIA-SEFAZ-VERIFIED</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.chave}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-serrano-500 flex items-center justify-center text-white font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                <span>DANFE / ROMANEIO FISCAL DE CONCRETO</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  {doc.status}
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Documento Auxiliar SEFAZ-MT · ABNT NBR 7212 / MDF-e Integrado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadXml}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-700"
              title="Baixar arquivo XML assinado pela SEFAZ"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar XML</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-serrano-500 hover:bg-serrano-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Imprimir documento em formato A4"
            >
              <Printer className="w-3.5 h-3.5 text-amber-200" />
              <span>Imprimir A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DANFE Paper Container (A4 Printable Layout) */}
        <div className="p-6 bg-white overflow-y-auto max-h-[75vh] text-stone-900 font-sans text-xs space-y-4">
          {/* Canhoto de Recebimento */}
          <div className="border border-stone-400 p-2 rounded text-[10px] space-y-1">
            <div className="flex justify-between items-center border-b border-stone-300 pb-1">
              <span>RECEBEMOS DE SERRANO CONCRETO &amp; MINERAÇÃO LTDA OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span>
              <span className="font-bold text-xs">{doc.numero}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 text-[9px]">
              <div>DATA DO RECEBIMENTO: ___/___/______</div>
              <div className="col-span-2">NOME E ASSINATURA DO RECEBEDOR NO CANTEIRO: _________________________________</div>
              <div className="text-right font-mono font-bold">HORA DESCARGA: ____:____</div>
            </div>
          </div>

          {/* Emitente & Dados da NF-e */}
          <div className="grid grid-cols-12 border border-stone-400 rounded">
            {/* Logo / Dados Emitente */}
            <div className="col-span-5 p-3 border-r border-stone-400 space-y-1">
              <h2 className="font-black text-sm text-stone-900 leading-tight">
                {doc.emitente.razao}
              </h2>
              <p className="text-[10px] text-stone-600">{doc.emitente.endereco}</p>
              <p className="text-[10px] text-stone-600">{doc.emitente.municipio} - {doc.emitente.uf} · CEP: {doc.emitente.cep}</p>
              <p className="text-[10px] text-stone-600 font-semibold">Fone: {doc.emitente.telefone}</p>
            </div>

            {/* Caixa Central DANFE */}
            <div className="col-span-3 p-3 text-center border-r border-stone-400 flex flex-col justify-center">
              <span className="font-black text-base tracking-wider block">DANFE</span>
              <span className="text-[9px] text-stone-500 block leading-tight">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</span>
              <div className="my-1 py-0.5 bg-stone-100 font-mono font-bold text-xs border border-stone-300 rounded">
                1 - SAÍDA
              </div>
              <span className="font-mono font-bold text-[11px]">{doc.numero}</span>
              <span className="text-[9px] text-stone-500">SÉRIE: {doc.serie} · FOLHA 1/1</span>
            </div>

            {/* Chave de Acesso e Código de Barras */}
            <div className="col-span-4 p-3 flex flex-col justify-between text-[10px]">
              <div>
                <span className="font-bold text-stone-700 block text-[9px]">CHAVE DE ACESSO:</span>
                <span className="font-mono text-[9px] font-bold tracking-tight block text-stone-900 select-all">
                  {doc.chave.replace(/(\d{4})/g, '$1 ').trim()}
                </span>
                {/* Simulated Barcode */}
                <div className="h-7 w-full bg-stone-900 mt-1 flex items-center justify-around px-2">
                  <div className="h-full w-0.5 bg-white" />
                  <div className="h-full w-1 bg-white" />
                  <div className="h-full w-0.5 bg-white" />
                  <div className="h-full w-1.5 bg-white" />
                  <div className="h-full w-0.5 bg-white" />
                  <div className="h-full w-2 bg-white" />
                  <div className="h-full w-0.5 bg-white" />
                  <div className="h-full w-1 bg-white" />
                  <div className="h-full w-2 bg-white" />
                </div>
              </div>
              <div className="pt-1 border-t border-stone-200 text-[9px] text-stone-600">
                Consulta de autenticidade no portal nacional da NF-e ou SEFAZ-MT
              </div>
            </div>
          </div>

          {/* Destinatário */}
          <div className="border border-stone-400 rounded p-2 text-[10px] space-y-1">
            <span className="font-bold text-[9px] text-stone-500 uppercase block border-b border-stone-200 pb-0.5">
              DESTINATÁRIO / REMETENTE
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-stone-500 block text-[9px]">NOME / RAZÃO SOCIAL</span>
                <strong className="text-stone-900 text-xs">{doc.destinatario.razao}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">CNPJ / CPF</span>
                <strong className="text-stone-900 font-mono">{doc.destinatario.cnpj}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">DATA DA EMISSÃO</span>
                <strong className="text-stone-900 font-mono">{doc.dataEmissao}</strong>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-stone-100">
              <div className="col-span-2">
                <span className="text-stone-500 block text-[9px]">ENDEREÇO DA OBRA / CANTEIRO</span>
                <span className="text-stone-900">{doc.destinatario.endereco}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">MUNICÍPIO / UF</span>
                <span className="text-stone-900">{doc.destinatario.municipio} - {doc.destinatario.uf}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">INSCRIÇÃO ESTADUAL</span>
                <span className="text-stone-900 font-mono">{doc.destinatario.ie}</span>
              </div>
            </div>
          </div>

          {/* Dados dos Produtos e Serviços */}
          <div className="border border-stone-400 rounded overflow-hidden text-[10px]">
            <div className="bg-stone-100 p-1 font-bold text-[9px] text-stone-600 uppercase border-b border-stone-300">
              DADOS DO PRODUTO / SERVIÇO (CONCRETO DOSADO EM CENTRAL NBR 7212)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-300 text-stone-600 font-bold text-[9px]">
                  <th className="p-1.5">CÓDIGO</th>
                  <th className="p-1.5">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                  <th className="p-1.5">NCM/SH</th>
                  <th className="p-1.5">CFOP</th>
                  <th className="p-1.5">UNID</th>
                  <th className="p-1.5 text-right">QTD</th>
                  <th className="p-1.5 text-right">V. UNIT</th>
                  <th className="p-1.5 text-right">V. TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {doc.itens.map((it, idx) => (
                  <tr key={idx} className="font-mono text-stone-800">
                    <td className="p-1.5">{it.codigo}</td>
                    <td className="p-1.5 font-sans font-semibold text-stone-900">{it.descricao}</td>
                    <td className="p-1.5">{it.ncm}</td>
                    <td className="p-1.5">{it.cfop}</td>
                    <td className="p-1.5">{it.unidade}</td>
                    <td className="p-1.5 text-right font-bold">{it.quantidade.toFixed(2)}</td>
                    <td className="p-1.5 text-right">R$ {it.valorUnitario.toFixed(2)}</td>
                    <td className="p-1.5 text-right font-bold text-stone-900">R$ {it.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dados do Transporte & Pesagem Oficial */}
          <div className="border border-stone-400 rounded p-2 text-[10px] space-y-1 bg-stone-50/50">
            <span className="font-bold text-[9px] text-stone-500 uppercase block border-b border-stone-200 pb-0.5">
              DADOS DO TRANSPORTE &amp; PESAGEM RODOVIÁRIA (TOLEDO 720i · BALANÇA BAL-01)
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="text-stone-500 block text-[9px]">PLACA VEÍCULO</span>
                <strong className="text-stone-900 font-mono text-xs">{doc.transporte.placa}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">MOTORISTA RESPONSÁVEL</span>
                <strong className="text-stone-900">{doc.transporte.motorista}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">TARA DA BETONEIRA</span>
                <strong className="text-stone-900 font-mono">{doc.transporte.taraKg.toLocaleString('pt-BR')} kg</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px]">PESO BRUTO MEDIDO</span>
                <strong className="text-stone-900 font-mono">{doc.transporte.pesoBrutoKg.toLocaleString('pt-BR')} kg</strong>
              </div>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-stone-200 text-stone-700">
              <span className="text-[10px]">
                PESO LÍQUIDO EXPEDIDO: <strong className="text-serrano-700 font-mono text-xs">{doc.transporte.pesoLiquidoKg.toLocaleString('pt-BR')} kg</strong> ({doc.itens[0]?.quantidade} m³ calculados)
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Auditoria Forense Motor KyttoIA 2.5 Flash Aprovada
              </span>
            </div>
          </div>

          {/* Dados Adicionais */}
          <div className="border border-stone-400 rounded p-2 text-[9px] text-stone-600 space-y-1">
            <span className="font-bold text-stone-700 uppercase block">INFORMAÇÕES COMPLEMENTARES</span>
            <p>
              Emissão de Concreto Usinado conforme ABNT NBR 7212:2021. Slump especificado em 16±3 cm. Tempo limite de transporte e início da concretagem: 150 minutos a partir do horário de carregamento.
              Protocolo de Autorização SEFAZ-MT nº {doc.protocolo} em {doc.dataEmissao} às {doc.horaEmissao}.
              MDF-e nº {doc.numero.replace('NFE', 'MDF')} emitido para transporte em frota própria.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento fiscal oficial válido em todo o território nacional (SEFAZ-MT)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Fechar Visualizador
          </button>
        </div>
      </div>
    </div>
  );
}
