import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ConcretoChecklistFrota() {
  const [checklists, setChecklists] = useState([]);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [veiculoCodigo, setVeiculoCodigo] = useState('BT-03');
  const [motorista, setMotorista] = useState('Valdemir Oliveira');
  const [odometroKm, setOdometroKm] = useState(78500);
  const [horimetroTambor, setHorimetroTambor] = useState(2980);
  const [itens, setItens] = useState([
    { item: 'Pressão e estado dos pneus', conforme: true, obs: 'Calibrado 110 PSI' },
    { item: 'Freios pneumáticos e manômetros de ar', conforme: true, obs: '8 bar constante' },
    { item: 'Lâminas helicoidais e tambor sem crostas', conforme: true, obs: 'Lavado no pós-turno' },
    { item: 'Lacre do tanque pressurizado de água (inviolabilidade a/c)', conforme: true, obs: 'Lacre #0943 intacto' },
    { item: 'Extintor ABC e kit de emergência / cones', conforme: true, obs: 'Carga válida' },
    { item: 'Luzes, seta, giroflex e faróis de ré', conforme: true, obs: '100% funcionais' },
    { item: 'Comando hidráulico do balão e acionamento na cabine', conforme: true, obs: 'Resposta imediata' },
    { item: 'Nível de óleo do redutor do tambor e motor hidráulico', conforme: true, obs: 'Nível adequado' },
    { item: 'Rádio comunicador VHF/UHF com a central', conforme: true, obs: 'Canal 03 Usina' },
    { item: 'EPIs completos do motorista (capacete, óculos, botina de aço)', conforme: true, obs: 'Conferido' }
  ]);

  useEffect(() => {
    carregarChecklists();
  }, []);

  const carregarChecklists = async () => {
    try {
      const res = await api.get('/api/admin/concreto/frota/checklists');
      if (res && res.ok) {
        setChecklists(res.checklists || []);
      }
    } catch (e) {
      console.warn('Falha ao carregar checklists:', e);
    }
  };

  const handleSalvar = async () => {
    try {
      const payload = {
        veiculoCodigo,
        motorista,
        odometroKm,
        horimetroTambor,
        itens,
        statusGeral: itens.every(i => i.conforme) ? 'aprovado' : 'alerta'
      };
      const res = await api.post('/api/admin/concreto/frota/checklists', payload);
      if (res && res.ok) {
        setModalNovoAberto(false);
        carregarChecklists();
      }
    } catch (e) {
      alert('Erro ao salvar checklist: ' + e.message);
    }
  };

  const toggleItem = (idx) => {
    const novos = [...itens];
    novos[idx].conforme = !novos[idx].conforme;
    setItens(novos);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Header com Ação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '14px 18px', borderRadius: 8, border: '1px solid var(--joint)' }}>
        <div>
          <b style={{ fontSize: 14 }}>📋 Checklists Digitais Pré-Operacionais (NR-11 &amp; NR-12)</b>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Inspeção visual e mecânica obrigatória antes da liberação dos veículos para carregamento na usina
          </div>
        </div>
        <button 
          type="button" 
          className="btn-serrano pri"
          onClick={() => setModalNovoAberto(true)}
        >
          + Realizar Novo Checklist
        </button>
      </div>

      {/* Grid de Checklists Realizados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
        {checklists.map(c => (
          <div key={c.id} className="serrano-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid var(--joint)', paddingBottom: 8 }}>
              <div>
                <b style={{ fontSize: 14, color: 'var(--serrano-orange-text)' }}>{c.veiculoCodigo}</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{c.placa || ''}</span>
              </div>
              <span className={`serrano-pill ${c.statusGeral === 'aprovado' ? 'serrano-p-ok' : 'serrano-p-load'}`}>
                {c.statusGeral === 'aprovado' ? '✓ LIBERADO PARA TRÂNSITO' : '⚠ ATENÇÃO REQUERIDA'}
              </span>
            </div>

            <div style={{ fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              <div>Motorista: <b>{c.motorista}</b></div>
              <div>Data/Hora: <b>{c.dataHora}</b></div>
              <div>Odômetro: <b>{c.odometroKm.toLocaleString('pt-BR')} km</b></div>
              <div>Horímetro Balão: <b>{c.horimetroTambor} h</b></div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, fontSize: 11 }}>
              <b style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Itens Inspecionados ({c.itens?.filter(i => i.conforme).length}/{c.itens?.length || 10} conformes):
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(c.itens || []).slice(0, 4).map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: it.conforme ? 'var(--status-ok)' : 'var(--status-err)' }}>
                    <span>{it.conforme ? '✓' : '✗'} {it.item}</span>
                    <small style={{ color: 'var(--text-muted)' }}>{it.obs}</small>
                  </div>
                ))}
                {(c.itens?.length || 0) > 4 && (
                  <small style={{ color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                    + outros {c.itens.length - 4} itens conformes
                  </small>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Novo Checklist */}
      {modalNovoAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 640 }}>
            <h2>Checklist Digital Pré-Operacional · NR-11 / NR-12</h2>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="serrano-label">Veículo da Frota</label>
                  <select 
                    className="serrano-input"
                    value={veiculoCodigo}
                    onChange={e => setVeiculoCodigo(e.target.value)}
                  >
                    <option value="BT-01">BT-01 · Mercedes Actros 2651 8x4 (10 m³)</option>
                    <option value="BT-02">BT-02 · Scania P360 8x4 (10 m³)</option>
                    <option value="BT-03">BT-03 · Volvo VM 330 6x4 (8 m³)</option>
                    <option value="BT-04">BT-04 · Ford Cargo 2629 6x4 (8 m³)</option>
                    <option value="BT-05">BT-05 · VW Constellation 26.280 (8 m³)</option>
                    <option value="BL-01">BL-01 · Bomba Lança 32m Mercedes Atego</option>
                    <option value="BL-02">BL-02 · Bomba Lança 36m Volvo VM 270</option>
                  </select>
                </div>
                <div>
                  <label className="serrano-label">Motorista / Operador</label>
                  <input 
                    type="text" 
                    className="serrano-input"
                    value={motorista}
                    onChange={e => setMotorista(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="serrano-label">Odômetro Atual (km)</label>
                  <input 
                    type="number" 
                    className="serrano-input"
                    value={odometroKm}
                    onChange={e => setOdometroKm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="serrano-label">Horímetro do Balão (h)</label>
                  <input 
                    type="number" 
                    className="serrano-input"
                    value={horimetroTambor}
                    onChange={e => setHorimetroTambor(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <b style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Itens de Segurança e Metrologia:</b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 6 }}>
                  {itens.map((it, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: it.conforme ? 'var(--surface)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${it.conforme ? 'var(--joint)' : '#ef4444'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{idx + 1}. {it.item}</span>
                      <span style={{ fontWeight: 700, color: it.conforme ? 'var(--status-ok)' : 'var(--status-err)' }}>
                        {it.conforme ? '✓ CONFORME' : '✗ NÃO CONFORME'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="serrano-modal-footer">
                <button type="button" className="btn-serrano" onClick={() => setModalNovoAberto(false)}>Cancelar</button>
                <button type="button" className="btn-serrano pri" onClick={handleSalvar}>Gravar e Liberar Veículo</button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
