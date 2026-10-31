import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

export default function DinoPrecoDinamico() {
  const { toast } = useToast();
  const [ativo, setAtivo] = useState(false);
  const [regra, setRegra] = useState({ diaSemana: '2', horaInicio: '09:00', horaFim: '12:00', descontoPerc: '15' });

  function salvar() {
    toast('Preço Dinâmico atualizado! Ele será aplicado nas novas comandas nos dias e horários ociosos.', 'success');
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Preço Dinâmico (Yield Management)</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Automatize descontos em dias e horários de baixa ocupação para encher a agenda.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativar Preço Dinâmico
        </label>
      </div>

      {ativo && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--surface)', padding: 16, borderRadius: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold' }}>
            Dia da semana
            <select style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} value={regra.diaSemana} onChange={e => setRegra({...regra, diaSemana: e.target.value})}>
              <option value="1">Segunda-feira</option>
              <option value="2">Terça-feira</option>
              <option value="3">Quarta-feira</option>
              <option value="4">Quinta-feira</option>
              <option value="5">Sexta-feira</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold' }}>
            Das (Horário)
            <input type="time" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} value={regra.horaInicio} onChange={e => setRegra({...regra, horaInicio: e.target.value})} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold' }}>
            Até (Horário)
            <input type="time" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)' }} value={regra.horaFim} onChange={e => setRegra({...regra, horaFim: e.target.value})} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold' }}>
            Desconto Automático (%)
            <input type="number" min="0" max="100" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', width: 100 }} value={regra.descontoPerc} onChange={e => setRegra({...regra, descontoPerc: e.target.value})} />
          </label>
          <button onClick={salvar} style={{ background: 'var(--accent)', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
            Salvar Regra
          </button>
        </div>
      )}
    </div>
  );
}
