import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const t = {
  bg: '#0E1014',
  surface: '#161922',
  card: '#1C202B',
  accent: '#6E7CE0',
  muted: '#A4AABE',
  cream: '#E8EAF2',
  line: '#2B3140',
  red: '#F27A89',
  green: '#3CC48B',
  yellow: '#E0B24B',
  blue: '#5AA9F0',
};

const reais = (v) =>
  `R$\u00a0${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const dataBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

export default function BarbeiroClienteDetalhe({ clienteId, clienteFallback = null, profissionalNome = 'Barbeiro', onEncaixar }) {
  const [loading, setLoading] = useState(Boolean(clienteId));
  const [detalhes, setDetalhes] = useState(clienteFallback || null);
  const chaveStorage = `kytto_nota_corte_${clienteId || clienteFallback?.telefone || clienteFallback?.nome || 'anon'}`;
  const [notaCorte, setNotaCorte] = useState(() => {
    try {
      return localStorage.getItem(chaveStorage) || clienteFallback?.observacao || '';
    } catch {
      return '';
    }
  });
  const [salvouNota, setSalvouNota] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get(`/api/admin/barbearia/clientes-360/${clienteId}`)
      .then((res) => {
        const cli = res?.cliente || res;
        if (cli && typeof cli === 'object') {
          setDetalhes((prev) => ({ ...(prev || {}), ...cli }));
          if (cli.preferencias && !notaCorte) {
            setNotaCorte(cli.preferencias);
          }
        }
      })
      .catch(() => {
        // Fallback silencioso para os dados já disponíveis no app
      })
      .finally(() => setLoading(false));
  }, [clienteId]);

  function salvarNotaTecnica() {
    try {
      localStorage.setItem(chaveStorage, notaCorte);
      setSalvouNota(true);
      setTimeout(() => setSalvouNota(false), 2500);
    } catch {}
  }

  const tagsRapidas = [
    'Degradê Navalhado',
    'Social Tesoura',
    'Pente 1.5 na lateral',
    'Barba Alinhada + Toalha Quente',
    'Sobrancelha na Navalha',
    'Usa Pomada Matte',
  ];

  if (loading && !detalhes) {
    return <div style={{ color: t.muted, padding: 20, textAlign: 'center' }}>Carregando prontuário 360º...</div>;
  }

  const cli = detalhes || clienteFallback || { nome: 'Cliente', telefone: '' };
  const telLimpo = soDigitos(cli.telefone);
  const linkZap = telLimpo.length >= 10
    ? `https://wa.me/${telLimpo.startsWith('55') ? telLimpo : `55${telLimpo}`}?text=${encodeURIComponent(`Olá ${String(cli.nome || '').split(' ')[0]}! Aqui é o ${String(profissionalNome || '').split(' ')[0]} da Barbearia Dino 💈 Tudo certo?`)}`
    : '';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* HEADER DO CLIENTE */}
      <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#fff' }}>{cli.nome || 'Cliente'}</h2>
            <p style={{ margin: '4px 0 0', color: t.muted, fontSize: 13 }}>{cli.telefone || 'Telefone não informado'}</p>
          </div>
          <span style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '4px 10px',
            borderRadius: 99,
            fontSize: 11.5,
            fontWeight: 800,
          }}>
            ✂️ {cli.visitasHistoricas || cli.totalAtendimentos || cli.visitas || 1} visita(s)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Serviço Favorito</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.cream, marginTop: 2 }}>
              {cli.ultimoServico || cli.servicoFavorito || 'Corte & Barba'}
            </div>
          </div>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Última Visita</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.cream, marginTop: 2 }}>
              {dataBR(cli.ultimaData || cli.ultimaVisita)}
            </div>
          </div>
          <div style={{ background: t.surface, padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, color: t.muted }}>Total Investido</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: t.green, marginTop: 2 }}>
              {reais(cli.totalGasto || cli.ltv || cli.valor || 0)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {linkZap && (
            <a
              href={linkZap}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                background: '#16A34A',
                color: '#fff',
                textDecoration: 'none',
                padding: '10px 12px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              💬 Chamar no WhatsApp
            </a>
          )}
          {onEncaixar && (
            <button
              type="button"
              onClick={() => onEncaixar(cli)}
              style={{
                flex: 1,
                background: t.accent,
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ➕ Encaixar na Agenda
            </button>
          )}
        </div>
      </div>

      {/* FICHA TÉCNICA DE CORTE INTERATIVA */}
      <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 13.5, color: '#fff' }}>📝 Ficha Técnica & Preferências do Corte</strong>
          {salvouNota && <span style={{ fontSize: 11.5, color: t.green, fontWeight: 800 }}>✓ Salvo!</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tagsRapidas.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setNotaCorte((atual) => (atual.includes(tag) ? atual : atual ? `${atual} · ${tag}` : tag))}
              style={{
                background: notaCorte.includes(tag) ? 'rgba(110, 124, 224, 0.25)' : t.surface,
                border: `1px solid ${notaCorte.includes(tag) ? t.accent : t.line}`,
                color: notaCorte.includes(tag) ? '#fff' : t.muted,
                borderRadius: 99,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + {tag}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={notaCorte}
          onChange={(e) => setNotaCorte(e.target.value)}
          placeholder="Anote altura do pente, redemoinho, estilo de barba, bebida favorita..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: t.surface,
            border: `1px solid ${t.line}`,
            borderRadius: 10,
            padding: 10,
            color: t.cream,
            font: 'inherit',
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={salvarNotaTecnica}
          style={{
            background: 'rgba(110, 124, 224, 0.18)',
            border: `1px solid ${t.accent}`,
            color: '#c7d2fe',
            padding: '8px 12px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          💾 Salvar Ficha Técnica do Cliente
        </button>
      </div>

      {/* RECOMENDAÇÃO DE UPSELL DA IA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>🤖</span>
        <div style={{ fontSize: 12.5, color: '#d1fae5', lineHeight: 1.45 }}>
          <strong>Sugestão T-Rex IA para hoje:</strong> Ofereça <em>Sobrancelha na Navalha (+R$ 25)</em> ou <em>Pomada Modeladora Dino</em> na finalização. Isso conta +1 ponto direto na sua meta diária da Roleta!
        </div>
      </div>
    </div>
  );
}
