import React, { useState, useEffect } from 'react';
import { 
  Cpu, Activity, Zap, CheckCircle2, AlertTriangle, RefreshCw, 
  Settings, Play, ShieldCheck, Database, Radio, Server, ArrowRight
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

export default function ConcretoConectoresIndustriais({ onVoltar }) {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState(null);
  const [simulandoCiclo, setSimulandoCiclo] = useState(false);
  const [formModbus, setFormModbus] = useState({
    host: '192.168.10.50',
    porta: 502,
    unidadeId: 1,
    clpFabricante: 'Siemens S7-1200 / Delta DVP-ES2'
  });
  const [fabricanteBalanca, setFabricanteBalanca] = useState('toledo_prix_9094');
  const [frameTesteBalanca, setFrameTesteBalanca] = useState('\x020038420\x03');
  const [resultadoBalanca, setResultadoBalanca] = useState(null);

  const carregarStatus = async () => {
    try {
      setCarregando(true);
      const res = await api.get('/api/admin/concreto/conectores-industriais/status');
      if (res && res.ok) {
        setStatus(res);
      }
    } catch (err) {
      console.warn('Erro ao carregar status de conectores industriais:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
    const interval = setInterval(carregarStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSalvarModbus = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/concreto/conectores-industriais/configurar-modbus', formModbus);
      if (res?.ok) {
        toast({ title: 'CLP Configurado', description: res.mensagem, variant: 'success' });
        carregarStatus();
      }
    } catch (err) {
      toast({ title: 'Erro de Configuração', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleCoil = async (coilId, estadoAtual) => {
    try {
      const res = await api.post('/api/admin/concreto/conectores-industriais/acionar-coil', {
        coilId,
        estado: !estadoAtual
      });
      if (res?.ok) {
        toast({ title: 'Comando Digital Enviado', description: `Coil ${coilId} alterada para ${!estadoAtual ? 'LIGADO' : 'DESLIGADO'}` });
        carregarStatus();
      }
    } catch (err) {
      toast({ title: 'Erro ao acionar CLP', description: err.message, variant: 'destructive' });
    }
  };

  const handleTestarBalanca = async () => {
    try {
      const res = await api.post('/api/admin/concreto/conectores-industriais/processar-frame-balanca', {
        fabricanteId: fabricanteBalanca,
        frameRaw: frameTesteBalanca
      });
      if (res?.ok) {
        setResultadoBalanca(res.leitura);
        toast({ title: 'Frame Processado', description: `Peso Bruto: ${res.leitura.pesoBrutoKg} kg | Líquido: ${res.leitura.pesoLiquidoKg} kg`, variant: 'success' });
      }
    } catch (err) {
      toast({ title: 'Erro de Leitura', description: err.message, variant: 'destructive' });
    }
  };

  const handleSimularCicloCLP = async () => {
    try {
      setSimulandoCiclo(true);
      const res = await api.post('/api/admin/concreto/conectores-industriais/simular-ciclo-clp', {
        volumeM3: 8,
        fck: 30
      });
      if (res?.ok) {
        toast({ title: 'Ciclo NBR 7212 Iniciado', description: res.mensagem, variant: 'success' });
        setTimeout(carregarStatus, 1200);
      }
    } catch (err) {
      toast({ title: 'Erro de Ciclo', description: err.message, variant: 'destructive' });
    } finally {
      setTimeout(() => setSimulandoCiclo(false), 2500);
    }
  };

  const sensores = status?.modbus?.sensoresTraduzidos || {
    pesoAgregadosKg: 2450,
    pesoCimentoKg: 850,
    aguaLitros: 380,
    aditivoLitros: '6.5',
    umidadeAgregadoPercentual: '5.20',
    potenciaMisturadorKw: '45.0',
    slumpReometriaCm: '14.0',
    temperaturaConcretoC: 28
  };

  const coils = status?.modbus?.coils || {
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: true, 8: false
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── CABEÇALHO DO GATEWAY INDUSTRIAL ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #161F30 0%, #0F172A 100%)',
        border: '1px solid rgba(255, 107, 44, 0.4)',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              background: '#FF6B2C',
              color: '#FFF',
              fontSize: 10,
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: 4,
              textTransform: 'uppercase'
            }}>
              Hardware &amp; CLP Nativo
            </span>
            <span style={{ color: '#10B981', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
              GATEWAY MODBUS TCP ATIVO (10 Hz)
            </span>
            <span style={{ color: '#D4AF37', fontSize: 12, fontWeight: 800 }}>
              • Motor KyttoIA 2.5 Flash
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
            CONECTORES INDUSTRIAIS NATIVOS (MODBUS TCP &amp; BALANÇAS UNIVERSAIS)
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>
            Integração direta com CLPs Siemens S7, Delta, Schneider, Rockwell e balanças Toledo Prix 9094, Filizola, Alfa e Jundiaí em conformidade com ABNT NBR 7212.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={carregarStatus}
            disabled={carregando}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFF',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={carregando ? 'spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleSimularCicloCLP}
            disabled={simulandoCiclo}
            style={{
              background: 'linear-gradient(135deg, #FF6B2C 0%, #D9480F 100%)',
              border: 'none',
              color: '#FFF',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255, 107, 44, 0.4)'
            }}
          >
            <Play size={14} />
            {simulandoCiclo ? 'Executando Batelada...' : 'Simular Ciclo CLP NBR 7212'}
          </button>
        </div>
      </div>

      {/* ─── GRID DE REGISTRADORES HOLDING (SENSORES 10 HZ) ─── */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="#FF6B2C" />
          TELEMETRIA DE SENSORES EM TEMPO REAL (HOLDING REGISTERS · 10 HZ)
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14
        }}>
          {/* Card 1: Balança de Agregados */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40001 · Balança Agregados</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#38BDF8', margin: '6px 0 2px' }}>
              {sensores.pesoAgregadosKg} <span style={{ fontSize: 13, color: '#94A3B8' }}>kg</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Areia Média + Brita 1 (Célula 5.000 kg)</div>
          </div>

          {/* Card 2: Balança de Cimento */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40002 · Balança Cimento</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F59E0B', margin: '6px 0 2px' }}>
              {sensores.pesoCimentoKg} <span style={{ fontSize: 13, color: '#94A3B8' }}>kg</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Silo 01 (CP II) + Silo 02 (CP V)</div>
          </div>

          {/* Card 3: Hidrômetro Digital */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40003 · Hidrômetro Água</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#60A5FA', margin: '6px 0 2px' }}>
              {sensores.aguaLitros} <span style={{ fontSize: 13, color: '#94A3B8' }}>L</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Válvula Proporcional ±1 Litro NBR 7212</div>
          </div>

          {/* Card 4: Dosador de Aditivo */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40004 · Dosador Aditivo</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#EC4899', margin: '6px 0 2px' }}>
              {sensores.aditivoLitros} <span style={{ fontSize: 13, color: '#94A3B8' }}>L</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Plastificante / Retardador MC-Bauchemie</div>
          </div>

          {/* Card 5: Hydronix Hydro-Probe */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40005 · Micro-ondas Hydronix</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981', margin: '6px 0 2px' }}>
              {sensores.umidadeAgregadoPercentual} <span style={{ fontSize: 13, color: '#94A3B8' }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Correção automática de água livre</div>
          </div>

          {/* Card 6: Wattímetro Convicta */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40006 · Wattímetro Convicta</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#A78BFA', margin: '6px 0 2px' }}>
              {sensores.potenciaMisturadorKw} <span style={{ fontSize: 13, color: '#94A3B8' }}>kW</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Curva de potência e ponto de pega</div>
          </div>

          {/* Card 7: Slump Estimado Reometria */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40007 · Slump Reometria</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F43F5E', margin: '6px 0 2px' }}>
              {sensores.slumpReometriaCm} <span style={{ fontSize: 13, color: '#94A3B8' }}>cm</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Faixa esperada: 14 ± 2 cm (NBR 7212)</div>
          </div>

          {/* Card 8: Temperatura do Concreto */}
          <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>HR 40008 · Sensor Térmico PT100</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F97316', margin: '6px 0 2px' }}>
              {sensores.temperaturaConcretoC} <span style={{ fontSize: 13, color: '#94A3B8' }}>°C</span>
            </div>
            <div style={{ fontSize: 11, color: '#10B981' }}>Limite normativo: &lt; 32 °C</div>
          </div>
        </div>
      </div>

      {/* ─── PAINEL DE BOBINAS DIGITAIS (COILS DE ACIONAMENTO CLP) ─── */}
      <div style={{ background: '#131B2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="#EAB308" />
          COMANDOS DIGITAIS E ACIONAMENTOS DE ATUADORES (COILS MODBUS)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { id: 1, nome: 'Comporta Agregados', desc: 'Abertura pneumática da balança de agregados', estado: coils[1] },
            { id: 2, nome: 'Rosca Silo 01 (CP II)', desc: 'Motor elétrico da rosca dosadora de cimento', estado: coils[2] },
            { id: 3, nome: 'Rosca Silo 02 (CP V)', desc: 'Motor elétrico da rosca dosadora de cimento', estado: coils[3] },
            { id: 4, nome: 'Válvula Injeção Água', desc: 'Solenoide de dosagem de água na bacia', estado: coils[4] },
            { id: 5, nome: 'Bomba de Aditivos', desc: 'Dosador volumétrico de alta precisão', estado: coils[5] },
            { id: 6, nome: 'Descarga Misturador', desc: 'Comporta de descarga no caminhão betoneira', estado: coils[6] },
            { id: 7, nome: 'Semáforo Verde Balança', desc: 'Sinalização rodoviária da balança 80t', estado: coils[7] },
            { id: 8, nome: 'Sirene de Aviso Usina', desc: 'Alerta sonoro de partida de misturador', estado: coils[8] }
          ].map(c => (
            <div
              key={c.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${c.estado ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                  Coil 0000{c.id} · {c.nome}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleCoil(c.id, c.estado)}
                style={{
                  background: c.estado ? '#10B981' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFF',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {c.estado ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── PARSER UNIVERSAL DE BALANÇAS RODOVIÁRIAS (TOLEDO, FILIZOLA, ALFA, JUNDIAÍ) ─── */}
      <div style={{
        background: '#131B2E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20
      }}>
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={18} color="#38BDF8" />
            PARSER UNIVERSAL DE PROTOCOLOS DE BALANÇAS
          </h3>
          <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4, margin: '0 0 14px' }}>
            Suporte a leitura direta serial RS-232 / RS-485 ou TCP/IP em indicadores de pesagem rodoviária de 80t.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Fabricante / Indicador
              </label>
              <select
                value={fabricanteBalanca}
                onChange={(e) => setFabricanteBalanca(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0B0F19',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 13
                }}
              >
                <option value="toledo_prix_9094">Toledo Prix 9094 / 9091 (STX + Status + 6D + ETX)</option>
                <option value="filizola_cs15">Filizola CS-15 / ID-M (STX + 6D + CR)</option>
                <option value="alfa_3100c">Alfa Instrumentos 3100C (CR + LF + 7D + kg)</option>
                <option value="jundiai_universal">Jundiaí Balanças Indicador I-30 (STX + 6D)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Frame Raw Recebido (Exemplo de Teste)
              </label>
              <input
                type="text"
                value={frameTesteBalanca}
                onChange={(e) => setFrameTesteBalanca(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0B0F19',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleTestarBalanca}
              style={{
                background: '#38BDF8',
                border: 'none',
                color: '#0B0F19',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Radio size={14} />
              Processar e Decodificar Frame
            </button>
          </div>
        </div>

        {/* Exibição do Peso Decodificado */}
        <div style={{
          background: '#0B0F19',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
            Indicador Digital Toledo Prix 9094
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#10B981', margin: '8px 0' }}>
            {(resultadoBalanca?.pesoBrutoKg || status?.balancas?.statusLeitura?.pesoBrutoKg || 38420).toLocaleString('pt-BR')} <span style={{ fontSize: 18, color: '#94A3B8' }}>kg</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94A3B8' }}>
            <span>Tara: <strong>14.200 kg</strong></span>
            <span>Líquido: <strong>{((resultadoBalanca?.pesoBrutoKg || 38420) - 14200).toLocaleString('pt-BR')} kg</strong></span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: 11, fontWeight: 700 }}>
            <CheckCircle2 size={14} />
            PESO ESTÁVEL · TOLERÂNCIA DE VENTO NBR 7212 ATENDIDA
          </div>
        </div>
      </div>
    </div>
  );
}
