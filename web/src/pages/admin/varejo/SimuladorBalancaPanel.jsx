import React, { useState, useMemo } from 'react';
import { Scale, Zap, Copy, Check, RefreshCw, ShoppingCart, Info, ArrowRight, ShieldCheck } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';

// Itens pesáveis de exemplo da cesta Kytto
const PRODUTOS_PESAVEIS = [
  { plu: '1001', nome: 'Picanha Bovina Resfriada Fatiada', depto: 'Açougue e Carnes', precoKg: 79.90, unidade: 'KG' },
  { plu: '1002', nome: 'Alcatra Bovina com Maminha', depto: 'Açougue e Carnes', precoKg: 49.90, unidade: 'KG' },
  { plu: '2001', nome: 'Banana Prata Nacional', depto: 'Hortifrúti e Verduras', precoKg: 6.99, unidade: 'KG' },
  { plu: '2002', nome: 'Maçã Gala Nacional Cat-1', depto: 'Hortifrúti e Verduras', precoKg: 8.99, unidade: 'KG' },
  { plu: '2003', nome: 'Tomate Italiano Especial', depto: 'Hortifrúti e Verduras', precoKg: 7.49, unidade: 'KG' },
  { plu: '3001', nome: 'Pão Francês Tradicional', depto: 'Padaria e Confeitaria', precoKg: 16.90, unidade: 'KG' },
  { plu: '4001', nome: 'Queijo Mussarela Fatiado', depto: 'Frios e Laticínios', precoKg: 42.90, unidade: 'KG' },
];

function calcularDvEan13(corpo12) {
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    const dig = parseInt(corpo12[i], 10);
    soma += (i % 2 === 0) ? dig : dig * 3;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

export default function SimuladorBalancaPanel({ onEnviarAoPdv }) {
  const toast = useToast();
  const [modeloBalanca, setModeloBalanca] = useState('toledo_prix3');
  const [pluSelecionado, setPluSelecionado] = useState('1001');
  const [pesoBruto, setPesoBruto] = useState(1.485);
  const [tara, setTara] = useState(0.000);
  const [estavel, setEstavel] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const produto = useMemo(() => {
    return PRODUTOS_PESAVEIS.find(p => p.plu === pluSelecionado) || PRODUTOS_PESAVEIS[0];
  }, [pluSelecionado]);

  const pesoLiquido = Math.max(0, Number((pesoBruto - tara).toFixed(3)));
  const valorTotal = Number((pesoLiquido * produto.precoKg).toFixed(2));

  // Gera código EAN-13 padrão supermercado (Prefixo 2 + 5 dig PLU + 5 dig peso em gramas)
  const barcodeEan13 = useMemo(() => {
    const prefixo = '2';
    const pluFormatado = String(produto.plu).padStart(5, '0');
    const gramasFormatadas = String(Math.round(pesoLiquido * 1000)).padStart(5, '0');
    const corpo12 = `${prefixo}${pluFormatado}${gramasFormatadas}`;
    const dv = calcularDvEan13(corpo12);
    return `${corpo12}${dv}`;
  }, [produto.plu, pesoLiquido]);

  // Frame serial STX + peso + ETX (Protocolo Toledo P03 / Filizola)
  const frameSerialHex = useMemo(() => {
    const gramasStr = String(Math.round(pesoLiquido * 1000)).padStart(5, '0');
    return `02 ${gramasStr.split('').map(c => c.charCodeAt(0).toString(16).toUpperCase()).join(' ')} 03`;
  }, [pesoLiquido]);

  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(barcodeEan13);
    setCopiado(true);
    toast('Código de barras EAN-13 copiado!', 'success');
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleEnviarPdv = () => {
    const pacote = {
      plu: produto.plu,
      nome: produto.nome,
      pesoKg: pesoLiquido,
      precoKg: produto.precoKg,
      valorTotal,
      barcode: barcodeEan13,
      dataHora: new Date().toISOString()
    };
    try {
      localStorage.setItem('kytto_balanca_ultima_leitura', JSON.stringify(pacote));
      toast(`Peso de ${pesoLiquido.toFixed(3)} kg (${produto.nome}) enviado ao barramento do PDV!`, 'success');
      if (onEnviarAoPdv) onEnviarAoPdv(pacote);
    } catch {
      toast('Erro ao comunicar com barramento local de pesagem', 'error');
    }
  };

  return (
    <div style={{ background: '#0D1726', color: '#E2E8F0', padding: 24, borderRadius: 14, border: '1px solid #1E293B' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#10B981', color: '#064E3B', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Scale size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
              Simulador de Balança Serial & Protocolo Toledo / Filizola
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
              Emulação de pesagem em tempo real, protocolo RS-232/TCP (STX/ETX) e geração de código EAN-13 Prefixo 2
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={modeloBalanca}
            onChange={e => setModeloBalanca(e.target.value)}
            style={{ background: '#1E293B', color: '#F1F5F9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
          >
            <option value="toledo_prix3">Toledo Prix 3 Fit (Protocolo P03)</option>
            <option value="toledo_prix4">Toledo Prix 4 Due (MGV6 Ethernet)</option>
            <option value="filizola_cs15">Filizola CS-15 (Protocolo Serial P03)</option>
            <option value="urano_pop">Urano Pop Light / Topmax</option>
          </select>
          <button
            type="button"
            onClick={() => { setPesoBruto(Number((Math.random() * 2.8 + 0.3).toFixed(3))); setEstavel(true); }}
            style={{ background: '#334155', color: '#E2E8F0', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Amostra Aleatória
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Painel Display Balança (Look & Feel Balança Industrial) */}
        <div style={{ background: '#020617', border: '2px solid #1E293B', borderRadius: 12, padding: 18, boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
              TOLEDO PRIX 3 • CHECKOUT CONECTADO (COM1: 9600-8-N-1)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: estavel ? '#064E3B' : '#7F1D1D', color: estavel ? '#34D399' : '#F87171' }}>
                {estavel ? '● ESTÁVEL' : '○ INSTÁVEL'}
              </span>
              {tara > 0 && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: '#1E3A8A', color: '#60A5FA' }}>
                  TARA ATIVA
                </span>
              )}
            </div>
          </div>

          {/* Displays Digitais LED */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {/* Display Peso Líquido */}
            <div style={{ background: '#0A101D', border: '1px solid #1E293B', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, display: 'block' }}>PESO LÍQUIDO (KG)</span>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#10B981', letterSpacing: 2, margin: '6px 0' }}>
                {pesoLiquido.toFixed(3)}
              </div>
              <span style={{ fontSize: 9, color: '#64748B' }}>Tara: {tara.toFixed(3)} kg</span>
            </div>

            {/* Display Preço/KG */}
            <div style={{ background: '#0A101D', border: '1px solid #1E293B', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, display: 'block' }}>PREÇO POR KG</span>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#38BDF8', letterSpacing: 2, margin: '6px 0' }}>
                {produto.precoKg.toFixed(2)}
              </div>
              <span style={{ fontSize: 9, color: '#64748B' }}>PLU: {produto.plu}</span>
            </div>

            {/* Display Total a Pagar */}
            <div style={{ background: '#0A101D', border: '1px solid #1E293B', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, display: 'block' }}>TOTAL A PAGAR (R$)</span>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#F59E0B', letterSpacing: 2, margin: '6px 0' }}>
                {valorTotal.toFixed(2)}
              </div>
              <span style={{ fontSize: 9, color: '#64748B' }}>Líquido × Preço</span>
            </div>
          </div>

          {/* Botões do Teclado da Balança */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { setPesoBruto(0); setTara(0); }}
              style={{ background: '#1E293B', color: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              ZERAR (0.000 kg)
            </button>
            <button
              type="button"
              onClick={() => setTara(prev => prev > 0 ? 0 : 0.020)}
              style={{ background: tara > 0 ? '#B45309' : '#1E293B', color: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              TARAR {tara > 0 ? 'LIMPAR TARA' : 'TARAR BANDEJA (20g)'}
            </button>
            <button
              type="button"
              onClick={() => setEstavel(!estavel)}
              style={{ background: '#1E293B', color: '#94A3B8', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Oscilar Sensor
            </button>
          </div>
        </div>

        {/* Painel de Controle de Produto & Código de Barras */}
        <div style={{ background: '#1E293B', borderRadius: 12, padding: 18, border: '1px solid #334155' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: '#F8FAFC' }}>
            Seleção do Item Pesável & Ajuste de Carga
          </h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
              Produto Pesável Cadastrado no Mix Kytto:
            </label>
            <select
              value={pluSelecionado}
              onChange={e => setPluSelecionado(e.target.value)}
              style={{ width: '100%', background: '#0F172A', color: '#F1F5F9', border: '1px solid #475569', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
            >
              {PRODUTOS_PESAVEIS.map(p => (
                <option key={p.plu} value={p.plu}>
                  [PLU {p.plu}] {p.nome} — R$ {p.precoKg.toFixed(2)}/kg ({p.depto})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
              <span>Ajustar Peso Bruto na Balança:</span>
              <strong style={{ color: '#10B981' }}>{pesoBruto.toFixed(3)} kg</strong>
            </div>
            <input
              type="range"
              min="0.050"
              max="6.000"
              step="0.005"
              value={pesoBruto}
              onChange={e => setPesoBruto(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10B981' }}
            />
          </div>

          {/* Visualizador de Código de Barras EAN-13 Padrão 2 */}
          <div style={{ background: '#0F172A', border: '1px dashed #475569', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>CÓDIGO DE BARRAS GERADO (ETIQUETA BALANÇA):</span>
              <span style={{ fontSize: 10, color: '#38BDF8', background: '#082F49', padding: '2px 6px', borderRadius: 4 }}>EAN-13 Prefixo 2</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#F8FAFC', letterSpacing: 2 }}>
                {barcodeEan13}
              </span>
              <button
                type="button"
                onClick={handleCopiarCodigo}
                style={{ background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copiado ? <Check size={14} color="#10B981" /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
              Decodificação: [2] Pesável + [{String(produto.plu).padStart(5, '0')}] PLU + [{String(Math.round(pesoLiquido * 1000)).padStart(5, '0')}] {Math.round(pesoLiquido * 1000)}g + [{barcodeEan13.slice(-1)}] DV
            </div>
          </div>

          {/* Botão de Envio ao PDV */}
          <button
            type="button"
            onClick={handleEnviarPdv}
            style={{ width: '100%', background: '#10B981', color: '#064E3B', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
          >
            <ShoppingCart size={18} /> Injetar Pesagem na Frente de Caixa PDV
          </button>
        </div>
      </div>

      {/* Rodapé Técnico: Telemetria Serial */}
      <div style={{ marginTop: 16, background: '#0F172A', borderRadius: 8, padding: 12, border: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="#10B981" />
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            Frame Serial Transmitido (STX/ETX): <code style={{ color: '#F1F5F9', background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>{frameSerialHex}</code>
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748B' }}>
          Compatível com DLL Toledo (P03/P05), Filizola e ACBrBAL
        </span>
      </div>
    </div>
  );
}
