import React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  QrCode, 
  Scale, 
  Building2,
  FileText
} from 'lucide-react';

export default function TicketModal({ ticketData, onClose, onOpenDanfe }) {
  if (!ticketData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const content = `
=====================================================
      SERRANO CONCRETO & MINERAÇÃO LTDA
        Rodovia MT-358, KM 08 - Zona Rural
           Tangará da Serra - MT - Brasil
 CNPJ: 14.982.001/0001-41 · IE: 13.482.901-0
=====================================================
           TICKET DE PESAGEM RODOVIÁRIA
                 Nº ${ticketData.numero || 'TKT-2026-0075'}
-----------------------------------------------------
Data/Hora Emissão: ${new Date().toLocaleDateString('pt-BR')} 13:36:10
Balança: BAL-01 · Toledo 720i (INMETRO MT-0894/2026)
Tipo Operação: Saída de Concreto Usinado

VEÍCULO:
Placa: ${ticketData.placa || 'QBF-6M02'}
Prefixo: ${ticketData.prefixo || 'BT-05'}
Modelo: Scania P310 8x4 (Betoneira 10m³)
Motorista: Valdir Silveira (CNH: 0492819402)

DESTINATÁRIO:
Cliente: Construtora Alvorada Ltda
Obra: Residencial Manacá - Laje 4º Pavimento
Endereço: Av. Brasil, 1420 - Tangará da Serra (MT)

CARGA / PRODUTO:
Produto: Concreto Usinado FCK 30 MPa Bombeável
Traço: TR-FCK30B (Slump 16±3 cm · Brita 0/1)
Volume: 10,0 m³

PESAGENS:
1ª Pesagem (Tara):     12.920 kg  (13:30:15)
2ª Pesagem (Bruto):    33.540 kg  (13:36:10)
-----------------------------------------------------
PESO LÍQUIDO:          20.620 kg  (20,62 toneladas)
-----------------------------------------------------
MDF-e SEFAZ-MT: 5126081498200100412858001000004121100094123
Auditoria: 100% Automático via Motor KyttoIA 2.5
=====================================================
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket_pesagem_${ticketData.placa || 'QBF-6M02'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenOfficialDanfe = () => {
    if (onOpenDanfe) {
      onOpenDanfe({
        numero: ticketData.numero || '004128',
        serie: '1',
        tipo: 'NF-e / MDF-e Concreto NBR 7212',
        dataEmissao: new Date().toLocaleDateString('pt-BR'),
        horaEmissao: '13:36:10',
        status: 'autorizada',
        chaveAcesso: '5126 0814 9820 0100 0141 5500 1000 0041 2810 0941 2348',
        protocoloAutorizacao: '151260009182341 - 13/11/2026 13:36:12',
        destinatario: {
          razaoSocial: ticketData.cliente || 'Construtora Alvorada Ltda',
          cnpj: '08.214.992/0001-33',
          endereco: 'Av. Brasil, 1420 - Centro',
          municipio: 'Tangará da Serra',
          uf: 'MT'
        },
        produto: {
          descricao: ticketData.produto || 'Concreto Usinado FCK 30 MPa Bombeável (NBR 7212)',
          traco: ticketData.traco || 'TR-FCK30B',
          volumeM3: 10.0,
          slumpCm: '16 ± 3 cm',
          brita: 'Brita 0/1 Basalto Rio Sangue',
          pesoLiquidoKg: ticketData.liquidoKg || 20620
        },
        veiculo: {
          placa: ticketData.placa || 'QBF-6M02',
          prefixo: ticketData.prefixo || 'BT-05',
          motorista: ticketData.motorista || 'Valdir Silveira'
        },
        valores: {
          totalBruto: 4500.00,
          baseIcms: 0,
          valorIcms: 0,
          issqn: 225.00
        }
      });
      if (onClose) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-stone-800 font-extrabold text-sm">
            <Scale className="w-4 h-4 text-serrano-600" />
            <span>Ticket Oficial de Pesagem Rodoviária</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Printable Paper Ticket Preview */}
        <div className="my-4 p-5 bg-stone-50 rounded-xl border border-stone-300 font-mono text-xs text-stone-800 shadow-inner space-y-3">
          
          {/* Company Header */}
          <div className="text-center pb-2 border-b border-dashed border-stone-300">
            <h4 className="font-black text-sm text-stone-900 tracking-wider">
              SERRANO CONCRETO & MINERAÇÃO
            </h4>
            <p className="text-[10px] text-stone-500">
              Rodovia MT-358, KM 08 · Tangará da Serra (MT)
            </p>
            <p className="text-[9px] text-stone-400">
              CNPJ: 14.982.001/0001-41 · IE: 13.482.901-0
            </p>
          </div>

          {/* Ticket ID & Balança */}
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span>TICKET: {ticketData.numero || 'TKT-2026-0075'}</span>
            <span className="text-stone-500 font-normal">BAL-01 (Toledo 720i)</span>
          </div>

          {/* Vehicle Info */}
          <div className="pt-2 border-t border-dashed border-stone-300 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">PLACA:</span>
              <strong className="text-stone-900">{ticketData.placa || 'QBF-6M02'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">PREFIXO:</span>
              <span>{ticketData.prefixo || 'BT-05 (Betoneira 10m³)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">MOTORISTA:</span>
              <span>{ticketData.motorista || 'Valdir Silveira'}</span>
            </div>
          </div>

          {/* Destination & Product */}
          <div className="pt-2 border-t border-dashed border-stone-300 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">CLIENTE:</span>
              <strong className="text-stone-900 truncate max-w-[200px]">{ticketData.cliente || 'Construtora Alvorada'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">OBRA:</span>
              <span>{ticketData.obra || 'Residencial Manacá (Laje 4º Pav.)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">PRODUTO:</span>
              <span>{ticketData.produto || 'Concreto FCK 30 MPa Bombeável (10.0 m³)'}</span>
            </div>
          </div>

          {/* Weight Breakdown */}
          <div className="pt-2 border-t-2 border-stone-800 text-xs space-y-1">
            <div className="flex justify-between">
              <span>1ª PESAGEM (TARA):</span>
              <strong className="font-mono">{ticketData.taraKg ? ticketData.taraKg.toLocaleString('pt-BR') : '12.920'} kg</strong>
            </div>
            <div className="flex justify-between">
              <span>2ª PESAGEM (BRUTO):</span>
              <strong className="font-mono">{ticketData.brutoKg ? ticketData.brutoKg.toLocaleString('pt-BR') : '33.540'} kg</strong>
            </div>
            <div className="pt-1.5 border-t border-dashed border-stone-300 flex justify-between text-sm font-black text-stone-900">
              <span>PESO LÍQUIDO:</span>
              <span className="text-serrano-700">{ticketData.liquidoKg ? ticketData.liquidoKg.toLocaleString('pt-BR') : '20.620'} kg</span>
            </div>
          </div>

          {/* Verification QR Code & Fiscal */}
          <div className="pt-3 border-t border-dashed border-stone-300 flex items-center justify-between text-[10px] text-stone-500">
            <div>
              <div className="font-bold text-stone-800">MDF-e 582026-00412</div>
              <div>Autenticação: 5126.0814.9820.0100</div>
              <div className="text-emerald-700 font-semibold mt-0.5">Auditado pelo Motor KyttoIA 2.5</div>
            </div>
            <div className="w-12 h-12 bg-white border border-stone-300 rounded p-1 flex items-center justify-center">
              <QrCode className="w-10 h-10 text-stone-800" />
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 flex-wrap">
          <button
            onClick={handleOpenOfficialDanfe}
            className="px-3 py-2 bg-serrano-50 hover:bg-serrano-100 text-serrano-700 border border-serrano-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Abrir DANFE oficial da SEFAZ-MT e Romaneio de Carga NBR 7212"
          >
            <FileText className="w-3.5 h-3.5 text-serrano-600" />
            <span>DANFE SEFAZ / NBR 7212</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl text-stone-700 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1.5 border border-stone-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar TXT</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
