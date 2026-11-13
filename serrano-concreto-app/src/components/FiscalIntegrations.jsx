import React, { useState } from 'react';
import { 
  Receipt, 
  FileText, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  Download, 
  Eye, 
  ShieldCheck, 
  Zap,
  Server
} from 'lucide-react';

export default function FiscalIntegrations() {
  const [selectedDoc, setSelectedDoc] = useState(null);

  const FISCAL_DOCS = [
    {
      id: 'MDF-2026-00412',
      tipo: 'MDF-e 58',
      placa: 'NJW-5410',
      cliente: 'ConstruMais Tangará',
      produto: 'Pedrisco (Brita 0) · 14.550 kg',
      chave: '5126081498200100412858001000004121100094123',
      hora: '13:28',
      status: 'Autorizado SEFAZ-MT',
      protocolo: '151260009841249'
    },
    {
      id: 'NFE-2026-08912',
      tipo: 'NF-e 55',
      placa: 'OBX-9K31',
      cliente: 'Empreiteira MT-Norte',
      produto: 'Concreto Usinado FCK 25 · 8.0 m³',
      chave: '5126081498200100412855001000008912100089125',
      hora: '13:08',
      status: 'Autorizado SEFAZ-MT',
      protocolo: '151260009840118'
    },
    {
      id: 'MDF-2026-00411',
      tipo: 'MDF-e 58',
      placa: 'OBX-9K31',
      cliente: 'Empreiteira MT-Norte',
      produto: 'Transporte Carga Própria Betoneira',
      chave: '5126081498200100412858001000004111100094118',
      hora: '13:06',
      status: 'Autorizado SEFAZ-MT',
      protocolo: '151260009839942'
    },
    {
      id: 'CTE-2026-01209',
      tipo: 'CT-e 57',
      placa: 'KAP-8192',
      cliente: 'Agropecuária Rio Bonito',
      produto: 'Frete Terceirizado Agregado Areia Média',
      chave: '5126081498200100412857001000001209100012096',
      hora: '12:45',
      status: 'Autorizado SEFAZ-MT',
      protocolo: '151260009838110'
    }
  ];

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>FISCAL & INTEGRAÇÕES SEFAZ-MT</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Emissão automatizada de MDF-e, NF-e de Concreto Usinado e CT-e integrada à pesagem das balanças
          </p>
        </div>

        {/* SEFAZ MT Status Pill */}
        <div className="flex items-center gap-3 text-xs bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-stone-600 font-semibold">Webservice SEFAZ-MT:</span>
          </div>
          <span className="font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            118 ms (Online)
          </span>
        </div>
      </div>

      {/* Fiscal Emission Stream Table */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 mb-3 flex items-center justify-between">
          <span>Últimos Documentos Fiscais Emitidos Automaticamente</span>
          <span className="text-[10px] text-stone-500 font-normal">Transmissão sem intervenção do operador</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                <th className="py-2">Tipo / Número</th>
                <th>Horário</th>
                <th>Placa</th>
                <th>Destinatário</th>
                <th>Carga / Volume</th>
                <th>Chave de Acesso</th>
                <th>Status SEFAZ</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {FISCAL_DOCS.map(doc => (
                <tr key={doc.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="py-3 font-mono font-bold text-stone-900">
                    <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-[11px] mr-1">
                      {doc.tipo}
                    </span>
                    {doc.id}
                  </td>
                  <td className="font-mono text-stone-500">{doc.hora}</td>
                  <td className="font-mono font-bold text-stone-800">{doc.placa}</td>
                  <td className="font-semibold text-stone-900">{doc.cliente}</td>
                  <td className="text-stone-600">{doc.produto}</td>
                  <td className="font-mono text-[10px] text-stone-400 truncate max-w-[140px]" title={doc.chave}>
                    {doc.chave.slice(0, 16)}...
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      {doc.status}
                    </span>
                  </td>
                  <td className="text-right space-x-1">
                    <button 
                      onClick={() => alert(`Visualizando DANFE do documento ${doc.id}\nChave: ${doc.chave}`)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                      title="Visualizar DANFE"
                    >
                      DANFE
                    </button>
                    <button 
                      onClick={() => alert(`Baixando XML oficial da SEFAZ para ${doc.id}`)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                      title="Baixar XML"
                    >
                      XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environmental & City Hall Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs space-y-2">
          <h4 className="font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Licenciamento Ambiental & Lavagem (SEMA-MT)</span>
          </h4>
          <p className="text-stone-600 text-[11px] leading-relaxed">
            MTR (Manifesto de Transporte de Resíduos) e outorga do sistema de decantação de água para lavagem de betoneiras 100% regularizados junto à SEMA-MT (Licença de Operação LO-2025/0819).
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs space-y-2">
          <h4 className="font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Integração ERP Central Kytto</span>
          </h4>
          <p className="text-stone-600 text-[11px] leading-relaxed">
            Sincronização em tempo real de faturamento, estoque de cimento dos silos e custos de dosagem com o plano de contas financeiro da Kytto Tecnologia.
          </p>
        </div>

      </div>

    </div>
  );
}
