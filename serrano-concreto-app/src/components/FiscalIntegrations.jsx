import React, { useState } from 'react';
import { 
  FileCheck, 
  Download, 
  Printer, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileText, 
  RefreshCw, 
  Send,
  Eye,
  Check
} from 'lucide-react';

export default function FiscalIntegrations({ onOpenDanfe }) {
  const [documents, setDocuments] = useState([
    {
      id: 'NF-e 000.084.219',
      chaveAcesso: '51261103987456000188550010000842191987654321',
      tipo: 'NF-e Concreto Usinado',
      serie: '1',
      emissao: 'Hoje · 11:42',
      destinatario: 'Construtora Alvorada Ltda (Tangará da Serra)',
      naturezaOperacao: 'Venda de Concreto Usinado c/ Prestação de Bombeamento',
      cfop: '5.102 / 5.949',
      valorTotal: 'R$ 4.750,00',
      mdfeVinculado: 'MDF-e 5126-0004-9210 (Encerramento Pendente)',
      status: 'Autorizada SEFAZ-MT'
    },
    {
      id: 'NF-e 000.084.218',
      chaveAcesso: '51261103987456000188550010000842181876543210',
      tipo: 'NF-e Brita & Mineração',
      serie: '1',
      emissao: 'Hoje · 10:15',
      destinatario: 'Pavimentadora Pantanal Ltda',
      naturezaOperacao: 'Venda de Pedra Britada nº 1',
      cfop: '5.101',
      valorTotal: 'R$ 2.450,00',
      mdfeVinculado: 'MDF-e 5126-0004-9208 (Encerrado)',
      status: 'Autorizada SEFAZ-MT'
    },
    {
      id: 'NF-e 000.084.217',
      chaveAcesso: '51261103987456000188550010000842171765432109',
      tipo: 'NF-e Concreto FCK 25',
      serie: '1',
      emissao: 'Hoje · 08:30',
      destinatario: 'Engenharia & Obras Tangará ME',
      naturezaOperacao: 'Venda de Concreto Usinado',
      cfop: '5.102',
      valorTotal: 'R$ 3.840,00',
      mdfeVinculado: 'MDF-e 5126-0004-9205 (Encerrado)',
      status: 'Autorizada SEFAZ-MT'
    }
  ]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleSyncSefaz = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1200);
  };

  const handleDownloadXmlDirect = (doc) => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${doc.chaveAcesso}" versao="4.00">
      <ide>
        <cUF>51</cUF>
        <cNF>98765432</cNF>
        <natOp>${doc.naturezaOperacao}</natOp>
        <mod>55</mod>
        <serie>${doc.serie}</serie>
        <nNF>${doc.id.replace(/\D/g, '')}</nNF>
        <dhEmi>2026-11-13T11:42:00-04:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>5107958</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
      </ide>
      <emit>
        <CNPJ>03987456000188</CNPJ>
        <xNome>SERRANO CONCRETO E MINERACAO LTDA</xNome>
        <xFant>SERRANO CONCRETO</xFant>
        <enderEmit>
          <xLgr>RODOVIA MT-358 KM 12</xLgr>
          <nro>S/N</nro>
          <xBairro>ZONA RURAL</xBairro>
          <cMun>5107958</cMun>
          <xMun>TANGARA DA SERRA</xMun>
          <UF>MT</UF>
          <CEP>78300000</CEP>
        </enderEmit>
        <IE>139874561</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <xNome>${doc.destinatario}</xNome>
      </dest>
      <total>
        <ICMSTot>
          <vNF>${doc.valorTotal.replace('R$ ', '').replace('.', '').replace(',', '.')}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>MT_NFE_V4.00</verAplic>
      <chNFe>${doc.chaveAcesso}</chNFe>
      <dhRecbto>2026-11-13T11:42:15-04:00</dhRecbto>
      <nProt>151260098745612</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${doc.id.replace(/\s+/g, '_')}_SEFAZ_MT.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>PAINEL FISCAL &amp; EMISSÕES SEFAZ-MT</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
              Web Services Ativos · MT
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Sincronização instantânea com a Balança Rodoviária Toledo 720i · Emissão automática de NF-e, MDF-e e CT-e
          </p>
        </div>

        <button
          onClick={handleSyncSefaz}
          disabled={isSyncing}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto active:scale-98"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-300' : 'text-emerald-400'}`} />
          <span>{isSyncing ? 'Consultando SEFAZ-MT...' : 'Sincronizar Lote SEFAZ-MT'}</span>
        </button>
      </div>

      {syncSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Web Services SEFAZ-MT respondendo em 180ms. Todos os documentos fiscais encontram-se autorizados e sem pendências.</span>
        </div>
      )}

      {/* SEFAZ MT Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[10px] uppercase font-bold text-stone-400">WS AUTORIZADOR NF-E</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-lg font-black text-stone-900 font-mono">100% OPERACIONAL</div>
          <span className="text-[10px] text-stone-500 block mt-0.5">Latência média: 210 ms · SEFAZ Cuiabá</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[10px] uppercase font-bold text-stone-400">INTEGRAÇÃO MDF-E 3.00</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-lg font-black text-stone-900 font-mono">AUTORIZAÇÃO DIRETA</div>
          <span className="text-[10px] text-stone-500 block mt-0.5">Semáforo Balança Toledo sincronizado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[10px] uppercase font-bold text-stone-400">CERTIFICADO DIGITAL A1</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded font-bold">Válido</span>
          </div>
          <div className="text-lg font-black text-stone-900 font-mono">EXPIRA EM 312 DIAS</div>
          <span className="text-[10px] text-stone-500 block mt-0.5">SERRANO CONCRETO E MINERACAO LTDA</span>
        </div>
      </div>

      {/* Fiscal Documents Table */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold uppercase tracking-wide text-stone-900 text-xs">
            Notas Fiscais Eletrônicas Emitidas Hoje (Série 1)
          </h3>
          <span className="text-[11px] text-stone-400 font-mono">
            Ambiente de Produção SEFAZ-MT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                <th className="py-2">Documento</th>
                <th>Chave de Acesso</th>
                <th>Emissão</th>
                <th>Destinatário</th>
                <th>MDF-e Vinculado</th>
                <th className="text-right">Valor Total</th>
                <th className="text-right">Ações Fiscais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {documents.map((doc, idx) => (
                <tr key={idx} className="hover:bg-stone-50 transition-colors">
                  <td className="py-3">
                    <strong className="text-stone-900 font-mono block">{doc.id}</strong>
                    <span className="text-[10px] text-stone-500">{doc.tipo}</span>
                  </td>
                  <td className="font-mono text-[11px] text-stone-600">
                    <span className="truncate max-w-[140px] block" title={doc.chaveAcesso}>
                      {doc.chaveAcesso.slice(0, 15)}...{doc.chaveAcesso.slice(-6)}
                    </span>
                  </td>
                  <td className="font-mono text-stone-500 text-[11px]">{doc.emissao}</td>
                  <td>
                    <span className="font-semibold text-stone-900 block truncate max-w-[160px]">
                      {doc.destinatario}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold">{doc.status}</span>
                  </td>
                  <td className="font-mono text-[11px] text-stone-600">{doc.mdfeVinculado}</td>
                  <td className="text-right font-mono font-bold text-stone-900">{doc.valorTotal}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenDanfe && onOpenDanfe(doc)}
                        className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1"
                        title="Visualizar DANFE oficial e Romaneio NBR 7212"
                      >
                        <Eye className="w-3 h-3 text-amber-300" />
                        <span>DANFE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadXmlDirect(doc)}
                        className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold text-[11px] transition-colors flex items-center gap-1 border border-stone-300"
                        title="Baixar arquivo XML assinado pela SEFAZ-MT"
                      >
                        <Download className="w-3 h-3 text-stone-500" />
                        <span>XML</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
