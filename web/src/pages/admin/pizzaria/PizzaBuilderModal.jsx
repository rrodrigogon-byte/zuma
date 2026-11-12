import React, { useState, useMemo } from 'react';
import Modal from '../../../components/Modal';

const TAMANHOS = [
  { id: 'gigante', nome: 'Gigante (12 Fatias)', fatias: 12, maxSabores: 4, mult: 1.25, badge: '12 Fatias' },
  { id: 'grande',  nome: 'Grande (8 Fatias)',   fatias: 8,  maxSabores: 3, mult: 1.00, badge: '8 Fatias · Padrão' },
  { id: 'media',   nome: 'Média (6 Fatias)',    fatias: 6,  maxSabores: 2, mult: 0.85, badge: '6 Fatias' },
  { id: 'broto',   nome: 'Broto (4 Fatias)',    fatias: 4,  maxSabores: 2, mult: 0.65, badge: '4 Fatias' },
];

const MASSAS = [
  { id: 'tradicional', nome: 'Tradicional Forneada', adicional: 0 },
  { id: 'crocante',    nome: 'Fina Crocante Italiana', adicional: 0 },
  { id: 'integral',    nome: 'Integral Artesanal (+R$ 5)', adicional: 5 },
];

export default function PizzaBuilderModal({
  isOpen,
  onClose,
  mesa,
  cardapioPizzas = [],
  cardapioBordas = [],
  onConfirmarPizza,
}) {
  const [tamanho, setTamanho] = useState('grande');
  const [numSabores, setNumSabores] = useState(2); // 1, 2, 3, 4
  const [saboresSelecionados, setSaboresSelecionados] = useState([null, null]);
  const [observacoes, setObservacoes] = useState(['', '', '', '']);
  const [bordaId, setBordaId] = useState('');
  const [massa, setMassa] = useState('tradicional');
  const [regraPreco, setRegraPreco] = useState('maior_valor'); // 'maior_valor' ou 'media'
  const [quantidade, setQuantidade] = useState(1);
  const [busca, setBusca] = useState('');

  const cfgTamanho = useMemo(
    () => TAMANHOS.find((t) => t.id === tamanho) || TAMANHOS[1],
    [tamanho]
  );

  // Filtro de pizzas
  const pizzasDisponiveis = useMemo(() => {
    if (!busca) return cardapioPizzas;
    const b = busca.toLowerCase();
    return cardapioPizzas.filter(
      (p) =>
        (p.nome || '').toLowerCase().includes(b) ||
        (p.descricao || '').toLowerCase().includes(b) ||
        (p.categoria || '').toLowerCase().includes(b)
    );
  }, [cardapioPizzas, busca]);

  // Ao trocar de tamanho, ajusta o número máximo de sabores permitidos
  const handleTrocarTamanho = (novoTamanhoId) => {
    setTamanho(novoTamanhoId);
    const novoCfg = TAMANHOS.find((t) => t.id === novoTamanhoId);
    if (numSabores > novoCfg.maxSabores) {
      setNumSabores(novoCfg.maxSabores);
      setSaboresSelecionados((prev) => prev.slice(0, novoCfg.maxSabores));
    }
  };

  // Ao trocar quantidade de sabores (ex: de 1 para 2 ou 3)
  const handleTrocarNumSabores = (n) => {
    setNumSabores(n);
    setSaboresSelecionados((prev) => {
      const novo = [...prev];
      while (novo.length < n) novo.push(null);
      return novo.slice(0, n);
    });
  };

  // Seleção de um sabor em uma fração específica
  const handleSelecionarSabor = (indiceFracao, pizza) => {
    setSaboresSelecionados((prev) => {
      const novo = [...prev];
      novo[indiceFracao] = pizza;
      return novo;
    });
  };

  // Cálculo do preço da pizza em tempo real
  const calculo = useMemo(() => {
    const saboresValidos = saboresSelecionados.filter(Boolean);
    if (saboresValidos.length === 0) {
      return { total: 0, precoBaseSabor: 0, subtotalSabores: 0, valorBorda: 0, pronto: false };
    }

    const precos = saboresValidos.map((s) => Number(s.preco || 0));
    let precoBase = 0;

    if (regraPreco === 'media') {
      precoBase = precos.reduce((a, b) => a + b, 0) / precos.length;
    } else {
      precoBase = Math.max(...precos);
    }

    const subtotal = precoBase * cfgTamanho.mult;
    const bordaObj = cardapioBordas.find((b) => b.id === bordaId);
    const valorBorda = bordaObj ? Number(bordaObj.preco || 0) : 0;
    const cfgMassaObj = MASSAS.find((m) => m.id === massa);
    const valorMassa = cfgMassaObj?.adicional || 0;

    const unitario = subtotal + valorBorda + valorMassa;
    const totalGeral = unitario * quantidade;

    const pronto = saboresValidos.length === numSabores;

    return {
      precoBase: Number(precoBase.toFixed(2)),
      subtotalSabores: Number(subtotal.toFixed(2)),
      valorBorda,
      valorMassa,
      unitario: Number(unitario.toFixed(2)),
      total: Number(totalGeral.toFixed(2)),
      pronto,
      bordaObj,
    };
  }, [saboresSelecionados, numSabores, regraPreco, cfgTamanho, bordaId, cardapioBordas, massa, quantidade]);

  const handleConfirmar = () => {
    if (!calculo.pronto) return;

    const payload = {
      tamanho,
      tamanhoNome: cfgTamanho.nome,
      fatias: cfgTamanho.fatias,
      quantidade,
      regraPreco,
      sabores: saboresSelecionados.map((s, idx) => ({
        id: s.id,
        nome: s.nome,
        preco: Number(s.preco || 0),
        fracao: numSabores === 1 ? 'Inteira' : `1/${numSabores}`,
        obs: observacoes[idx] || '',
      })),
      borda: calculo.bordaObj ? { id: calculo.bordaObj.id, nome: calculo.bordaObj.nome, preco: calculo.valorBorda } : null,
      massa,
      total: calculo.total,
    };

    onConfirmarPizza(payload);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🍕 Montador de Pizza · ${mesa?.nome || 'Mesa'}`} width="850px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 }}>
        
        {/* Passo 1: Tamanho da Pizza */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream, #fff)', display: 'block', marginBottom: 8 }}>
            1. Selecione o Tamanho da Pizza:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {TAMANHOS.map((t) => {
              const ativo = tamanho === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTrocarTamanho(t.id)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: ativo ? '2px solid #FF6B2C' : '1px solid var(--line, #334155)',
                    background: ativo ? 'rgba(255, 107, 44, 0.15)' : 'var(--surface, #1e293b)',
                    color: ativo ? '#FF6B2C' : 'var(--cream, #fff)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: ativo ? 800 : 500,
                  }}
                >
                  <div style={{ fontSize: 14 }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>{t.badge}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Passo 2: Quantidade de Sabores */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream, #fff)', display: 'block', marginBottom: 8 }}>
            2. Quantidade de Sabores:
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const desabilitado = n > cfgTamanho.maxSabores;
              const ativo = numSabores === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={desabilitado}
                  onClick={() => handleTrocarNumSabores(n)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: ativo ? '2px solid #10b981' : '1px solid var(--line, #334155)',
                    background: ativo ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface, #1e293b)',
                    color: desabilitado ? 'var(--muted, #64748b)' : ativo ? '#10b981' : 'var(--cream, #fff)',
                    cursor: desabilitado ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    opacity: desabilitado ? 0.4 : 1,
                  }}
                >
                  {n === 1 ? '1 Sabor (Inteira)' : `${n} Sabores (1/${n})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Passo 3: Escolha dos Sabores das Frações */}
        <div style={{ background: 'var(--card, #0f172a)', padding: 14, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream, #fff)' }}>
              3. Escolha os Sabores de Cada Fração:
            </span>
            <input
              type="text"
              placeholder="Buscar sabor (Picanha, Filé, Calabresa...)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #334155)',
                background: 'var(--surface, #1e293b)',
                color: '#fff',
                fontSize: 12,
                width: 260,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numSabores}, 1fr)`, gap: 12, marginBottom: 14 }}>
            {Array.from({ length: numSabores }).map((_, idx) => {
              const selecionado = saboresSelecionados[idx];
              const fracaoNome = numSabores === 1 ? 'Pizza Inteira' : `Metade / Fração ${idx + 1} (1/${numSabores})`;
              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--surface, #1e293b)',
                    border: selecionado ? '1px solid #10b981' : '1px dashed var(--line, #475569)',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 4 }}>
                    {fracaoNome}
                  </div>
                  {selecionado ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{selecionado.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--gold, #f59e0b)', fontWeight: 700, marginTop: 2 }}>
                        R$ {Number(selecionado.preco || 0).toFixed(2)}
                      </div>
                      <input
                        type="text"
                        placeholder="Obs: ex: sem cebola, sem alho..."
                        value={observacoes[idx]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObservacoes((prev) => {
                            const n = [...prev];
                            n[idx] = val;
                            return n;
                          });
                        }}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          padding: '4px 8px',
                          fontSize: 11,
                          borderRadius: 4,
                          border: '1px solid var(--line, #334155)',
                          background: 'var(--card, #0f172a)',
                          color: '#fff',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', fontStyle: 'italic', padding: '12px 0' }}>
                      Clique em um sabor da lista abaixo para esta fração.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lista de Sabores para Seleção */}
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {pizzasDisponiveis.map((p) => {
              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface, #1e293b)',
                    border: '1px solid var(--line, #334155)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.nome}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.descricao || p.categoria}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold, #f59e0b)', marginTop: 2 }}>
                      R$ {Number(p.preco || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Botões para selecionar na Fração 1 ou 2 ou 3 */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: numSabores }).map((_, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => handleSelecionarSabor(fIdx, p)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: saboresSelecionados[fIdx]?.id === p.id ? '#10b981' : 'var(--card, #0f172a)',
                          color: saboresSelecionados[fIdx]?.id === p.id ? '#000' : 'var(--cream, #fff)',
                          border: '1px solid var(--line, #475569)',
                          cursor: 'pointer',
                        }}
                      >
                        {numSabores === 1 ? 'Escolher' : `F${fIdx + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Passo 4: Borda e Massa */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Bordas */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream, #fff)', display: 'block', marginBottom: 6 }}>
              Borda Recheada:
            </label>
            <select
              value={bordaId}
              onChange={(e) => setBordaId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--line, #334155)',
                background: 'var(--surface, #1e293b)',
                color: '#fff',
                fontSize: 12,
              }}
            >
              <option value="">Sem Borda Recheada (R$ 0,00)</option>
              {cardapioBordas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} (+R$ {Number(b.preco || 0).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Massa */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cream, #fff)', display: 'block', marginBottom: 6 }}>
              Tipo de Massa:
            </label>
            <select
              value={massa}
              onChange={(e) => setMassa(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--line, #334155)',
                background: 'var(--surface, #1e293b)',
                color: '#fff',
                fontSize: 12,
              }}
            >
              {MASSAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Passo 5: Regra de Preço e Quantidade */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface, #1e293b)', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', fontWeight: 600 }}>Regra de Cálculo:</span>
            <button
              type="button"
              onClick={() => setRegraPreco(regraPreco === 'maior_valor' ? 'media' : 'maior_valor')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--line, #334155)',
                background: 'var(--card, #0f172a)',
                color: '#FF6B2C',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {regraPreco === 'maior_valor' ? '★ Maior Valor (Padrão MT)' : 'Média Ponderada'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--cream, #fff)', fontWeight: 700 }}>Quantidade:</span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--card)', border: '1px solid var(--line)', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
            >
              -
            </button>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', minWidth: 20, textAlign: 'center' }}>{quantidade}</span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => q + 1)}
              style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--card)', border: '1px solid var(--line)', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
            >
              +
            </button>
          </div>
        </div>

        {/* Rodapé: Resumo e Confirmação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line, #334155)', paddingTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Total da Pizza:</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
              R$ {calculo.total.toFixed(2)}
            </div>
            {calculo.valorBorda > 0 && (
              <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)' }}>
                Inclui borda de R$ {calculo.valorBorda.toFixed(2)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid var(--line, #334155)',
                background: 'var(--surface, #1e293b)',
                color: 'var(--muted, #94a3b8)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!calculo.pronto}
              onClick={handleConfirmar}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: calculo.pronto ? '#FF6B2C' : 'var(--muted, #475569)',
                color: '#fff',
                cursor: calculo.pronto ? 'pointer' : 'not-allowed',
                fontWeight: 800,
                fontSize: 14,
                boxShadow: calculo.pronto ? '0 4px 14px rgba(255, 107, 44, 0.4)' : 'none',
              }}
            >
              ✓ Lançar na Mesa
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
