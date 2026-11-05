import React, { useState } from 'react';
import Modal from '../../../components/Modal';
import { fmtR } from '../../../lib/api';

export default function DinoFichaItemModal({ item, onClose, onSalvar, salvando }) {
  if (!item) return null;

  const [form, setForm] = useState({
    id: item.id,
    nome: item.nome || '',
    sku: item.sku || '',
    tipo: item.tipo || 'produto', // 'produto' | 'servico' | 'plano' | 'insumo'
    categoria: item.categoria || 'Geral',
    marca: item.marca || 'Dino Barber',
    unidade: item.unidade || 'UN',
    ean: item.ean || item.barcode || '',
    descricao: item.descricao || '',
    // Fiscal
    ncm: item.ncm || (item.tipo === 'servico' ? '' : '33059000'),
    cest: item.cest || '',
    cfop: item.cfop || '5405',
    csosn: item.csosn || '500',
    origem: item.origem ?? 0,
    cstPis: item.cstPis || '49',
    cstCofins: item.cstCofins || '49',
    cTribNac: item.cTribNac || (item.tipo === 'servico' ? '060101' : ''),
    aliquotaIss: item.aliquotaIss || 2.0,
    // Estoque e Custo
    estoqueAtual: Number(item.estoqueAtual ?? item.qtd ?? 0),
    estoqueMinimo: Number(item.estoqueMinimo ?? item.min ?? 5),
    custoCompra: Number(item.custoCompra ?? item.custoUnitario ?? item.custo ?? 0),
    custoMedio: Number(item.custoMedio ?? item.custoUnitario ?? item.custo ?? 0),
    precoVenda: Number(item.precoVenda ?? item.preco ?? 0),
    permiteSemEstoque: Boolean(item.permiteSemEstoque),
    // Canais
    canais: item.canais || { balcao: true, ecommerce: true, pdv: true }
  });

  const [abaAtiva, setAbaAtiva] = useState('geral'); // 'geral' | 'fiscal' | 'estoque' | 'canais' | 'historico'

  const margemBruta = form.precoVenda > 0
    ? (((form.precoVenda - form.custoMedio) / form.precoVenda) * 100).toFixed(1)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar?.(form);
  };

  const estiloAba = (aba) => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: abaAtiva === aba ? '#0284c7' : 'transparent',
    color: abaAtiva === aba ? '#fff' : 'var(--muted, #64748b)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  });

  const estiloInput = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--line, #e2e8f0)',
    background: 'var(--card, #fff)',
    color: 'var(--fg, #0f172a)',
    fontSize: 13,
    marginTop: 4
  };

  const estiloLabel = {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--muted, #64748b)',
    display: 'block'
  };

  return (
    <Modal title={`Ficha Técnica do Item: ${form.nome || 'Novo Item'}`} onClose={onClose} width={840}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Sub-header com Identificação e Tipo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2, #f8fafc)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
              SKU: {form.sku || 'SEM SKU'} • ID: {form.id || 'NOVO'}
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>{form.nome || 'Sem nome cadastrado'}</h3>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Tipo Obrigatório:</span>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              style={{ ...estiloInput, width: 'auto', marginTop: 0, fontWeight: 800, color: '#0284c7' }}
            >
              <option value="produto">📦 Produto (Revenda / Bar)</option>
              <option value="servico">✂️ Serviço (Cadeira / Barba)</option>
              <option value="plano">⭐ Plano / Pacote VIP</option>
              <option value="insumo">🧪 Insumo (Uso Interno)</option>
            </select>
          </div>
        </div>

        {/* Abas da Ficha do Item */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line, #e2e8f0)', paddingBottom: 6 }}>
          <button type="button" style={estiloAba('geral')} onClick={() => setAbaAtiva('geral')}>
            1. Dados Gerais & EAN
          </button>
          <button type="button" style={estiloAba('fiscal')} onClick={() => setAbaAtiva('fiscal')}>
            2. Regras Fiscais (NCM/CEST/ISS)
          </button>
          <button type="button" style={estiloAba('estoque')} onClick={() => setAbaAtiva('estoque')}>
            3. Estoque, Custos & Margem
          </button>
          <button type="button" style={estiloAba('canais')} onClick={() => setAbaAtiva('canais')}>
            4. Canais de Venda (Comanda/Web)
          </button>
          <button type="button" style={estiloAba('historico')} onClick={() => setAbaAtiva('historico')}>
            5. Histórico & Auditoria
          </button>
        </div>

        {/* ── ABA 1: GERAL ── */}
        {abaAtiva === 'geral' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={estiloLabel}>Nome Completo do Item *</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>SKU / Código Interno *</label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  style={estiloInput}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={estiloLabel}>Categoria</label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>Marca / Fabricante</label>
                <input
                  type="text"
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>Unidade Comercial</label>
                <select
                  value={form.unidade}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                  style={estiloInput}
                >
                  <option value="UN">UN — Unidade</option>
                  <option value="KG">KG — Quilograma (Granel)</option>
                  <option value="L">L — Litro</option>
                  <option value="CX">CX — Caixa</option>
                  <option value="PC">PC — Pacote</option>
                  <option value="DOSE">DOSE — Dose de Bar / Insumo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={estiloLabel}>Código de Barras / GTIN / EAN</label>
                <input
                  type="text"
                  placeholder="Ex: 7891234567890 (ou deixe em branco se não houver)"
                  value={form.ean}
                  onChange={(e) => setForm({ ...form, ean: e.target.value })}
                  style={estiloInput}
                />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Leitura automática por leitor laser no PDV</span>
              </div>
              <div>
                <label style={estiloLabel}>Conteúdo Líquido / Embalagem</label>
                <input
                  type="text"
                  placeholder="Ex: 100g, 250ml, 120g"
                  value={form.descricaoCurta || ''}
                  onChange={(e) => setForm({ ...form, descricaoCurta: e.target.value })}
                  style={estiloInput}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 2: FISCAL ── */}
        {abaAtiva === 'fiscal' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ padding: '10px 14px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: 10, border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: 12, color: 'var(--fg)' }}>
              <strong>Compliance Fiscal Simples Nacional:</strong> Para produtos com Substituição Tributária (CSOSN 500), o preenchimento do CEST é obrigatório conforme o Convênio ICMS 142/2018.
            </div>

            {form.tipo === 'servico' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={estiloLabel}>Código de Tributação Nacional (cTribNac) *</label>
                  <input
                    type="text"
                    required
                    placeholder="060101 (Barbearia/Cabelereiro)"
                    value={form.cTribNac}
                    onChange={(e) => setForm({ ...form, cTribNac: e.target.value })}
                    style={estiloInput}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Padrão Dino: 060101 (Cabelereiro/Barbearia)</span>
                </div>
                <div>
                  <label style={estiloLabel}>Alíquota de ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.aliquotaIss}
                    onChange={(e) => setForm({ ...form, aliquotaIss: parseFloat(e.target.value) || 0 })}
                    style={estiloInput}
                  />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={estiloLabel}>NCM (8 Dígitos) *</label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="Ex: 33059000 ou 22030000"
                      value={form.ncm}
                      onChange={(e) => setForm({ ...form, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      style={{ ...estiloInput, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>8 dígitos numéricos válidos</span>
                  </div>
                  <div>
                    <label style={estiloLabel}>CEST (Convênio 142/2018)</label>
                    <input
                      type="text"
                      placeholder="Ex: 2002000 ou 0302101"
                      value={form.cest}
                      onChange={(e) => setForm({ ...form, cest: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                      style={estiloInput}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Obrigatório com ST (CSOSN 500)</span>
                  </div>
                  <div>
                    <label style={estiloLabel}>Origem da Mercadoria</label>
                    <select
                      value={form.origem}
                      onChange={(e) => setForm({ ...form, origem: parseInt(e.target.value) || 0 })}
                      style={estiloInput}
                    >
                      <option value="0">0 — Nacional</option>
                      <option value="1">1 — Estrangeira (Importação Direta)</option>
                      <option value="2">2 — Estrangeira (Adquirida no Mercado Interno)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={estiloLabel}>CFOP Padrão</label>
                    <select
                      value={form.cfop}
                      onChange={(e) => setForm({ ...form, cfop: e.target.value })}
                      style={estiloInput}
                    >
                      <option value="5405">5405 — Venda c/ ST (Cosméticos/Bebidas)</option>
                      <option value="5102">5102 — Venda Tributada Integral</option>
                    </select>
                  </div>
                  <div>
                    <label style={estiloLabel}>CSOSN (Simples Nacional)</label>
                    <select
                      value={form.csosn}
                      onChange={(e) => setForm({ ...form, csosn: e.target.value })}
                      style={estiloInput}
                    >
                      <option value="500">500 — ICMS cobrado anteriormente por ST</option>
                      <option value="102">102 — Tributada pelo Simples sem permissão de crédito</option>
                      <option value="101">101 — Com permissão de crédito</option>
                    </select>
                  </div>
                  <div>
                    <label style={estiloLabel}>CST PIS / COFINS</label>
                    <select
                      value={form.cstPis}
                      onChange={(e) => setForm({ ...form, cstPis: e.target.value, cstCofins: e.target.value })}
                      style={estiloInput}
                    >
                      <option value="49">49 — Outras Operações de Saída</option>
                      <option value="04">04 — Monofásica (Alíquota Zero)</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ABA 3: ESTOQUE E CUSTO ── */}
        {abaAtiva === 'estoque' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={estiloLabel}>Saldo em Estoque Atual</label>
                <input
                  type="number"
                  value={form.estoqueAtual}
                  onChange={(e) => setForm({ ...form, estoqueAtual: parseFloat(e.target.value) || 0 })}
                  style={{ ...estiloInput, fontWeight: 800, fontSize: 16 }}
                />
              </div>
              <div>
                <label style={estiloLabel}>Estoque Mínimo (Ponto de Reposição)</label>
                <input
                  type="number"
                  min="0"
                  value={form.estoqueMinimo}
                  onChange={(e) => setForm({ ...form, estoqueMinimo: parseFloat(e.target.value) || 0 })}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>Venda Sem Estoque</label>
                <select
                  value={form.permiteSemEstoque ? 'sim' : 'nao'}
                  onChange={(e) => setForm({ ...form, permiteSemEstoque: e.target.value === 'sim' })}
                  style={estiloInput}
                >
                  <option value="nao">Bloquear venda quando zerado (Padrão)</option>
                  <option value="sim">Permitir venda sem estoque</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, background: 'var(--card2, #f8fafc)', padding: 14, borderRadius: 12, border: '1px solid var(--line, #e2e8f0)' }}>
              <div>
                <label style={estiloLabel}>Último Custo de Compra</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.custoCompra}
                  onChange={(e) => setForm({ ...form, custoCompra: parseFloat(e.target.value) || 0 })}
                  style={estiloInput}
                />
              </div>
              <div>
                <label style={estiloLabel}>Custo Médio Ponderado</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.custoMedio}
                  onChange={(e) => setForm({ ...form, custoMedio: parseFloat(e.target.value) || 0 })}
                  style={{ ...estiloInput, fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={estiloLabel}>Preço de Venda Praticado *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.precoVenda}
                  onChange={(e) => setForm({ ...form, precoVenda: parseFloat(e.target.value) || 0 })}
                  style={{ ...estiloInput, fontWeight: 800, color: '#10b981', fontSize: 16 }}
                />
              </div>
              <div>
                <label style={estiloLabel}>Margem Bruta Projetada</label>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, color: Number(margemBruta) > 30 ? '#10b981' : '#f59e0b' }}>
                  {margemBruta}%
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Lucro unitário: {fmtR(form.precoVenda - form.custoMedio)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 4: CANAIS DE VENDA ── */}
        {abaAtiva === 'canais' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Selecione em quais frentes de atendimento e canais comerciais este item está habilitado para faturamento:
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--card2, #f8fafc)', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.canais.balcao !== false}
                  onChange={(e) => setForm({ ...form, canais: { ...form.canais, balcao: e.target.checked } })}
                />
                <div>
                  <strong>Barbearia Dino (Comandas & Bar Balcão)</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Aparece no modal de comandas, barbearia e consumação rápida</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--card2, #f8fafc)', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.canais.ecommerce !== false}
                  onChange={(e) => setForm({ ...form, canais: { ...form.canais, ecommerce: e.target.checked } })}
                />
                <div>
                  <strong>Loja Virtual & E-commerce Omnichannel</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Publicado na vitrine digital para compra online ou retirada balcão</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--card2, #f8fafc)', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.canais.pdv !== false}
                  onChange={(e) => setForm({ ...form, canais: { ...form.canais, pdv: e.target.checked } })}
                />
                <div>
                  <strong>PDV Varejo & Leitor de Código de Barras</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Disponível para bipagem rápida e venda balcão</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ── ABA 5: HISTÓRICO & AUDITORIA ── */}
        {abaAtiva === 'historico' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--card2, #f8fafc)', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Item criado em:</span>
                <strong>{item.criadoEm ? new Date(item.criadoEm).toLocaleString('pt-BR') : 'Original do Sistema'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Última atualização cadastral:</span>
                <strong>{new Date().toLocaleString('pt-BR')}</strong>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              Todas as movimentações de estoque deste item (entradas por NF-e, inventários e saídas em comanda) são rastreadas pelo Kardex oficial.
            </p>
          </div>
        )}

        {/* Ações do Modal */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line, #e2e8f0)' }}>
          <button type="button" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontWeight: 700 }} onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontWeight: 800 }} disabled={salvando}>
            {salvando ? 'Salvando Ficha...' : '💾 Salvar Ficha do Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
