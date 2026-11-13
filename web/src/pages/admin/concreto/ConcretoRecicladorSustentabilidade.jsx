import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ConcretoRecicladorSustentabilidade() {
  const [reciclador, setReciclador] = useState(null);
  const [modalDevolucaoAberto, setModalDevolucaoAberto] = useState(false);
  const [betoneira, setBetoneira] = useState('BT-02');
  const [motorista, setMotorista] = useState('Carlos Eduardo Santos');
  const [obraOrigem, setObraOrigem] = useState('Edifício Residencial Serra Dourada');
  const [volumeResidualM3, setVolumeResidualM3] = useState(0.5);
  const [motivo, setMotivo] = useState('Sobra operacional de cota na laje');

  useEffect(() => {
    carregarReciclador();
  }, []);

  const carregarReciclador = async () => {
    try {
      const res = await api.get('/api/admin/concreto/sustentabilidade/reciclador');
      if (res && res.ok) {
        setReciclador(res.reciclador);
      }
    } catch (e) {
      console.warn('Falha ao carregar reciclador:', e);
    }
  };

  const handleRegistrar = async () => {
    try {
      const payload = {
        betoneira,
        motorista,
        obraOrigem,
        volumeResidualM3: Number(volumeResidualM3),
        motivo
      };
      const res = await api.post('/api/admin/concreto/sustentabilidade/reciclador/registrar', payload);
      if (res && res.ok) {
        setModalDevolucaoAberto(false);
        carregarReciclador();
      }
    } catch (e) {
      alert('Erro ao registrar concreto residual: ' + e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Cards de Métricas Ecológicas */}
      <div className="serrano-kpi-strip">
        <div className="serrano-kpi-card">
          <small>Concreto Reciclado Hoje</small>
          <b>{reciclador?.concretoRecicladoHojeM3 || 0} m³</b>
          <span style={{ color: 'var(--status-ok)', fontSize: 11 }}>● Lavador Helicoidal Convicta</span>
        </div>
        <div className="serrano-kpi-card">
          <small>Agregados Recuperados</small>
          <b>{reciclador?.agregadosRecuperadosTon || 0} ton</b>
          <span style={{ color: 'var(--status-info)', fontSize: 11 }}>Areia e Brita reusadas em artefatos</span>
        </div>
        <div className="serrano-kpi-card">
          <small>Água Clarificada em Circuito</small>
          <b>{(reciclador?.aguaClarificadaLitros || 0).toLocaleString('pt-BR')} L</b>
          <span style={{ color: 'var(--status-ok)', fontSize: 11 }}>pH {reciclador?.phAguaClarificada || 8.4} · Bacia Decantação</span>
        </div>
        <div className="serrano-kpi-card">
          <small>Pegada Ambiental</small>
          <b style={{ color: '#10b981' }}>Zero Descarte</b>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>100% de efluente reaproveitado</span>
        </div>
      </div>

      {/* Painel do Separador Mecânico & Decantador */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="serrano-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontSize: 13, textTransform: 'uppercase' }}>🌀 Separador Mecânico de Agregados</b>
            <span style={{ fontSize: 11, background: 'var(--status-ok-bg)', color: 'var(--status-ok)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              Operando · 15 m³/h
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            O caminhão descarrega o concreto residual na moega com injeção de água sob alta pressão. A rosca transportadora inclinada separa mecanicamente a brita (fração &gt; 4,75 mm) e a areia média lavada, devolvendo-as às baias secundárias para produção de blocos de concreto e guias pré-moldadas.
          </p>
          <div style={{ marginTop: 14, background: 'var(--surface-2)', padding: 12, borderRadius: 6, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>Brita 1 Recuperada: <b>+2.940 kg</b></div>
            <div>Areia Sepotuba Recuperada: <b>+2.290 kg</b></div>
          </div>
        </div>

        <div className="serrano-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontSize: 13, textTransform: 'uppercase' }}>💧 Bacia de Decantação &amp; Circuito Fechado</b>
            <span style={{ fontSize: 11, background: 'var(--status-ok-bg)', color: 'var(--status-ok)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              18.500 L em Estoque
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            A calda de cimento restante é encaminhada para 3 tanques decantadores sequenciais em cascata com agitadores submersos. A água clarificada no topo é reaproveitada na lavagem das betoneiras e como água de amassamento para concretos não estruturais (NBR 15900-1).
          </p>
          <div style={{ marginTop: 14, background: 'var(--surface-2)', padding: 12, borderRadius: 6, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>Turbidez da Água: <b>12 NTU (Ótima)</b></div>
            <div>Controle de Alcalinidade: <b>pH 8,4</b></div>
          </div>
        </div>
      </div>

      {/* Tabela de Devoluções & Ação */}
      <div className="serrano-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <b style={{ fontSize: 14 }}>Histórico de Concreto Residual &amp; Sobras de Obra</b>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Registro de devoluções processadas no reciclador mecânico</div>
          </div>
          <button 
            type="button" 
            className="btn-serrano pri"
            onClick={() => setModalDevolucaoAberto(true)}
          >
            + Registrar Concreto Devolvido
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="serrano-table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Betoneira</th>
                <th>Motorista</th>
                <th>Obra de Origem</th>
                <th>Volume (m³)</th>
                <th>Brita / Areia Recuperadas</th>
                <th>Processamento Ecológico</th>
              </tr>
            </thead>
            <tbody>
              {(reciclador?.registrosDevolucao || []).map(r => (
                <tr key={r.id}>
                  <td><b>{r.dataHora}</b></td>
                  <td><span className="serrano-pill serrano-p-load">{r.betoneira}</span></td>
                  <td>{r.motorista}</td>
                  <td>{r.obraOrigem}</td>
                  <td><b style={{ color: 'var(--serrano-orange-text)' }}>{r.volumeResidualM3} m³</b></td>
                  <td>{r.britaRecuperadaKg} kg brita · {r.areiaRecuperadaKg} kg areia</td>
                  <td><span style={{ color: 'var(--status-ok)', fontWeight: 600 }}>✓ {r.processamento}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Concreto Devolvido */}
      {modalDevolucaoAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 520 }}>
            <h2>Registrar Concreto Residual · Reciclador</h2>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="serrano-label">Betoneira Retornando</label>
                  <select 
                    className="serrano-input"
                    value={betoneira}
                    onChange={e => setBetoneira(e.target.value)}
                  >
                    <option value="BT-01">BT-01</option>
                    <option value="BT-02">BT-02</option>
                    <option value="BT-03">BT-03</option>
                    <option value="BT-04">BT-04</option>
                    <option value="BT-05">BT-05</option>
                  </select>
                </div>
                <div>
                  <label className="serrano-label">Volume Estimado (m³)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0.1"
                    max="8"
                    className="serrano-input"
                    value={volumeResidualM3}
                    onChange={e => setVolumeResidualM3(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="serrano-label">Obra de Origem</label>
                <input 
                  type="text" 
                  className="serrano-input"
                  value={obraOrigem}
                  onChange={e => setObraOrigem(e.target.value)}
                />
              </div>

              <div>
                <label className="serrano-label">Motorista</label>
                <input 
                  type="text" 
                  className="serrano-input"
                  value={motorista}
                  onChange={e => setMotorista(e.target.value)}
                />
              </div>

              <div>
                <label className="serrano-label">Motivo da Devolução / Sobra</label>
                <input 
                  type="text" 
                  className="serrano-input"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                ℹ O concreto será lavado imediatamente no reciclador mecânico, gerando aproximadamente <b>{Math.round(volumeResidualM3 * 1050)} kg de brita</b> e <b>{Math.round(volumeResidualM3 * 820)} kg de areia limpa</b>.
              </div>

              <div className="serrano-modal-footer">
                <button type="button" className="btn-serrano" onClick={() => setModalDevolucaoAberto(false)}>Cancelar</button>
                <button type="button" className="btn-serrano pri" onClick={handleRegistrar}>Iniciar Lavagem &amp; Reciclagem</button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
