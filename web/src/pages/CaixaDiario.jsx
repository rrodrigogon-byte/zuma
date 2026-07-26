/**
 * ============================================================================
 * PÁGINA: CAIXA DIÁRIO - FECHAMENTO E MOVIMENTOS
 * ============================================================================
 * Arquivo: web/src/pages/CaixaDiario.jsx
 * Descrição: Tela de abertura, fechamento, sangria e suprimento de caixa
 * Versão: 1.0 (Kytto ERP)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './CaixaDiario.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function CaixaDiario() {
  const [caixas, setCaixas] = useState([]);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('abrir'); // abrir, sangria, suprimento, fechar, relatorio

  // Form states
  const [formAbertura, setFormAbertura] = useState({
    numero_caixa: '',
    valor_abertura: 0,
    observacoes: ''
  });

  const [formMovimentacao, setFormMovimentacao] = useState({
    valor: '',
    descricao: ''
  });

  const [formFechamento, setFormFechamento] = useState({
    valor_contado: '',
    observacoes: ''
  });

  const [resultado, setResultado] = useState(null);

  // ============================================================================
  // CARREGAMENTO DE DADOS
  // ============================================================================

  useEffect(() => {
    carregarCaixasAbertos();
  }, []);

  const carregarCaixasAbertos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/caixa-diario/aberto`);
      setCaixas(response.data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar caixas abertos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoes = async (caixaId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/caixa-diario/${caixaId}/movimentacoes`);
      setMovimentacoes(response.data);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ABERTURA DE CAIXA
  // ============================================================================

  const handleAbrirCaixa = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/caixa-diario/abrir`, formAbertura);
      setResultado({
        tipo: 'sucesso',
        mensagem: response.data.mensagem,
        dados: response.data.caixa
      });
      setFormAbertura({ numero_caixa: '', valor_abertura: 0, observacoes: '' });
      carregarCaixasAbertos();
      setTimeout(() => setResultado(null), 3000);
    } catch (err) {
      setResultado({
        tipo: 'erro',
        mensagem: err.response?.data?.erro || 'Erro ao abrir caixa'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SANGRIA
  // ============================================================================

  const handleRegistrarSangria = async (e) => {
    e.preventDefault();
    if (!caixaSelecionado) {
      setResultado({ tipo: 'erro', mensagem: 'Selecione um caixa' });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/caixa-diario/sangria`, {
        caixa_id: caixaSelecionado.id,
        valor: parseFloat(formMovimentacao.valor),
        descricao: formMovimentacao.descricao
      });
      setResultado({
        tipo: 'sucesso',
        mensagem: response.data.mensagem
      });
      setFormMovimentacao({ valor: '', descricao: '' });
      carregarMovimentacoes(caixaSelecionado.id);
      setTimeout(() => setResultado(null), 3000);
    } catch (err) {
      setResultado({
        tipo: 'erro',
        mensagem: err.response?.data?.erro || 'Erro ao registrar sangria'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SUPRIMENTO
  // ============================================================================

  const handleRegistrarSuprimento = async (e) => {
    e.preventDefault();
    if (!caixaSelecionado) {
      setResultado({ tipo: 'erro', mensagem: 'Selecione um caixa' });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/caixa-diario/suprimento`, {
        caixa_id: caixaSelecionado.id,
        valor: parseFloat(formMovimentacao.valor),
        descricao: formMovimentacao.descricao
      });
      setResultado({
        tipo: 'sucesso',
        mensagem: response.data.mensagem
      });
      setFormMovimentacao({ valor: '', descricao: '' });
      carregarMovimentacoes(caixaSelecionado.id);
      setTimeout(() => setResultado(null), 3000);
    } catch (err) {
      setResultado({
        tipo: 'erro',
        mensagem: err.response?.data?.erro || 'Erro ao registrar suprimento'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FECHAMENTO DE CAIXA
  // ============================================================================

  const handleFecharCaixa = async (e) => {
    e.preventDefault();
    if (!caixaSelecionado) {
      setResultado({ tipo: 'erro', mensagem: 'Selecione um caixa' });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/caixa-diario/fechar`, {
        caixa_id: caixaSelecionado.id,
        valor_contado: parseFloat(formFechamento.valor_contado),
        observacoes: formFechamento.observacoes
      });
      setResultado({
        tipo: 'sucesso',
        mensagem: response.data.mensagem,
        dados: response.data
      });
      setFormFechamento({ valor_contado: '', observacoes: '' });
      carregarCaixasAbertos();
      setTimeout(() => setResultado(null), 5000);
    } catch (err) {
      setResultado({
        tipo: 'erro',
        mensagem: err.response?.data?.erro || 'Erro ao fechar caixa'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDERIZAÇÃO
  // ============================================================================

  return (
    <div className="caixa-diario-container">
      <header className="caixa-header">
        <h1>💰 Caixa Diário</h1>
        <p>Gestão de abertura, fechamento, sangria e suprimento</p>
      </header>

      {/* Mensagem de resultado */}
      {resultado && (
        <div className={`resultado-alert resultado-${resultado.tipo}`}>
          <span>{resultado.mensagem}</span>
        </div>
      )}

      {/* Abas de navegação */}
      <div className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'abrir' ? 'active' : ''}`}
          onClick={() => setActiveTab('abrir')}
        >
          Abrir Caixa
        </button>
        <button
          className={`tab-btn ${activeTab === 'sangria' ? 'active' : ''}`}
          onClick={() => setActiveTab('sangria')}
        >
          Sangria
        </button>
        <button
          className={`tab-btn ${activeTab === 'suprimento' ? 'active' : ''}`}
          onClick={() => setActiveTab('suprimento')}
        >
          Suprimento
        </button>
        <button
          className={`tab-btn ${activeTab === 'fechar' ? 'active' : ''}`}
          onClick={() => setActiveTab('fechar')}
        >
          Fechar Caixa
        </button>
        <button
          className={`tab-btn ${activeTab === 'relatorio' ? 'active' : ''}`}
          onClick={() => setActiveTab('relatorio')}
        >
          Relatório
        </button>
      </div>

      <div className="caixa-content">
        {/* ===== ABRIR CAIXA ===== */}
        {activeTab === 'abrir' && (
          <section className="tab-section">
            <h2>Abrir Novo Caixa</h2>
            <form onSubmit={handleAbrirCaixa} className="form-caixa">
              <div className="form-group">
                <label>Número do Caixa *</label>
                <input
                  type="number"
                  min="1"
                  value={formAbertura.numero_caixa}
                  onChange={(e) =>
                    setFormAbertura({ ...formAbertura, numero_caixa: parseInt(e.target.value) })
                  }
                  placeholder="Ex: 1, 2, 3"
                  required
                />
              </div>

              <div className="form-group">
                <label>Valor de Abertura (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAbertura.valor_abertura}
                  onChange={(e) =>
                    setFormAbertura({ ...formAbertura, valor_abertura: parseFloat(e.target.value) })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formAbertura.observacoes}
                  onChange={(e) =>
                    setFormAbertura({ ...formAbertura, observacoes: e.target.value })
                  }
                  placeholder="Observações adicionais (opcional)"
                  rows="3"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Abrindo...' : 'Abrir Caixa'}
              </button>
            </form>
          </section>
        )}

        {/* ===== SANGRIA ===== */}
        {activeTab === 'sangria' && (
          <section className="tab-section">
            <h2>Registrar Sangria</h2>

            {/* Seleção de caixa */}
            <div className="caixa-selector">
              <h3>Selecione um Caixa Aberto</h3>
              {caixas.length === 0 ? (
                <p className="no-data">Nenhum caixa aberto</p>
              ) : (
                <div className="caixa-list">
                  {caixas.map((caixa) => (
                    <div
                      key={caixa.id}
                      className={`caixa-card ${caixaSelecionado?.id === caixa.id ? 'selected' : ''}`}
                      onClick={() => {
                        setCaixaSelecionado(caixa);
                        carregarMovimentacoes(caixa.id);
                      }}
                    >
                      <h4>Caixa #{caixa.numero_caixa}</h4>
                      <p>Operador: {caixa.operador_nome}</p>
                      <p>Abertura: R$ {parseFloat(caixa.valor_abertura).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulário de sangria */}
            {caixaSelecionado && (
              <form onSubmit={handleRegistrarSangria} className="form-caixa">
                <div className="form-group">
                  <label>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formMovimentacao.valor}
                    onChange={(e) =>
                      setFormMovimentacao({ ...formMovimentacao, valor: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Descrição/Motivo</label>
                  <input
                    type="text"
                    value={formMovimentacao.descricao}
                    onChange={(e) =>
                      setFormMovimentacao({ ...formMovimentacao, descricao: e.target.value })
                    }
                    placeholder="Ex: Retirada para banco"
                  />
                </div>

                <button type="submit" className="btn-danger" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Sangria'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* ===== SUPRIMENTO ===== */}
        {activeTab === 'suprimento' && (
          <section className="tab-section">
            <h2>Registrar Suprimento</h2>

            {/* Seleção de caixa */}
            <div className="caixa-selector">
              <h3>Selecione um Caixa Aberto</h3>
              {caixas.length === 0 ? (
                <p className="no-data">Nenhum caixa aberto</p>
              ) : (
                <div className="caixa-list">
                  {caixas.map((caixa) => (
                    <div
                      key={caixa.id}
                      className={`caixa-card ${caixaSelecionado?.id === caixa.id ? 'selected' : ''}`}
                      onClick={() => {
                        setCaixaSelecionado(caixa);
                        carregarMovimentacoes(caixa.id);
                      }}
                    >
                      <h4>Caixa #{caixa.numero_caixa}</h4>
                      <p>Operador: {caixa.operador_nome}</p>
                      <p>Abertura: R$ {parseFloat(caixa.valor_abertura).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulário de suprimento */}
            {caixaSelecionado && (
              <form onSubmit={handleRegistrarSuprimento} className="form-caixa">
                <div className="form-group">
                  <label>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formMovimentacao.valor}
                    onChange={(e) =>
                      setFormMovimentacao({ ...formMovimentacao, valor: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Descrição/Motivo</label>
                  <input
                    type="text"
                    value={formMovimentacao.descricao}
                    onChange={(e) =>
                      setFormMovimentacao({ ...formMovimentacao, descricao: e.target.value })
                    }
                    placeholder="Ex: Reposição de troco"
                  />
                </div>

                <button type="submit" className="btn-success" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Suprimento'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* ===== FECHAR CAIXA ===== */}
        {activeTab === 'fechar' && (
          <section className="tab-section">
            <h2>Fechar Caixa</h2>

            {/* Seleção de caixa */}
            <div className="caixa-selector">
              <h3>Selecione um Caixa Aberto</h3>
              {caixas.length === 0 ? (
                <p className="no-data">Nenhum caixa aberto</p>
              ) : (
                <div className="caixa-list">
                  {caixas.map((caixa) => (
                    <div
                      key={caixa.id}
                      className={`caixa-card ${caixaSelecionado?.id === caixa.id ? 'selected' : ''}`}
                      onClick={() => {
                        setCaixaSelecionado(caixa);
                        carregarMovimentacoes(caixa.id);
                      }}
                    >
                      <h4>Caixa #{caixa.numero_caixa}</h4>
                      <p>Operador: {caixa.operador_nome}</p>
                      <p>Abertura: R$ {parseFloat(caixa.valor_abertura).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo de movimentações */}
            {caixaSelecionado && movimentacoes.length > 0 && (
              <div className="movimentacoes-summary">
                <h3>Movimentações do Dia</h3>
                <table className="table-movimentacoes">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Descrição</th>
                      <th>Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentacoes.map((mov) => (
                      <tr key={mov.id}>
                        <td>
                          <span className={`badge badge-${mov.tipo}`}>{mov.tipo}</span>
                        </td>
                        <td>R$ {parseFloat(mov.valor).toFixed(2)}</td>
                        <td>{mov.descricao || '-'}</td>
                        <td>{new Date(mov.data_operacao).toLocaleTimeString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulário de fechamento */}
            {caixaSelecionado && (
              <form onSubmit={handleFecharCaixa} className="form-caixa">
                <div className="form-group">
                  <label>Valor Contado (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formFechamento.valor_contado}
                    onChange={(e) =>
                      setFormFechamento({ ...formFechamento, valor_contado: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Observações</label>
                  <textarea
                    value={formFechamento.observacoes}
                    onChange={(e) =>
                      setFormFechamento({ ...formFechamento, observacoes: e.target.value })
                    }
                    placeholder="Observações sobre o fechamento"
                    rows="3"
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Fechando...' : 'Fechar Caixa'}
                </button>
              </form>
            )}

            {/* Resultado do fechamento */}
            {resultado?.tipo === 'sucesso' && resultado?.dados?.resumo && (
              <div className="fechamento-resultado">
                <h3>Resumo do Fechamento</h3>
                <div className="resumo-grid">
                  <div className="resumo-item">
                    <span>Abertura:</span>
                    <strong>R$ {resultado.dados.resumo.valor_abertura.toFixed(2)}</strong>
                  </div>
                  <div className="resumo-item">
                    <span>Sangria:</span>
                    <strong>-R$ {resultado.dados.resumo.total_sangria.toFixed(2)}</strong>
                  </div>
                  <div className="resumo-item">
                    <span>Suprimento:</span>
                    <strong>+R$ {resultado.dados.resumo.total_suprimento.toFixed(2)}</strong>
                  </div>
                  <div className="resumo-item">
                    <span>Esperado:</span>
                    <strong>R$ {resultado.dados.resumo.valor_esperado.toFixed(2)}</strong>
                  </div>
                  <div className="resumo-item">
                    <span>Contado:</span>
                    <strong>R$ {resultado.dados.resumo.valor_contado.toFixed(2)}</strong>
                  </div>
                  <div className={`resumo-item divergencia-${resultado.dados.resumo.status_divergencia}`}>
                    <span>Divergência:</span>
                    <strong>R$ {resultado.dados.resumo.divergencia.toFixed(2)}</strong>
                    <small>{resultado.dados.resumo.status_divergencia}</small>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===== RELATÓRIO ===== */}
        {activeTab === 'relatorio' && (
          <section className="tab-section">
            <h2>Relatório Diário de Caixas</h2>
            <p className="info-text">Resumo de todos os caixas abertos e fechados hoje</p>
            {caixas.length === 0 ? (
              <p className="no-data">Nenhum caixa aberto</p>
            ) : (
              <table className="table-relatorio">
                <thead>
                  <tr>
                    <th>Caixa</th>
                    <th>Operador</th>
                    <th>Abertura</th>
                    <th>Movimentações</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {caixas.map((caixa) => (
                    <tr key={caixa.id}>
                      <td>#{caixa.numero_caixa}</td>
                      <td>{caixa.operador_nome}</td>
                      <td>R$ {parseFloat(caixa.valor_abertura).toFixed(2)}</td>
                      <td>
                        <button
                          className="btn-link"
                          onClick={() => {
                            setCaixaSelecionado(caixa);
                            carregarMovimentacoes(caixa.id);
                          }}
                        >
                          Ver
                        </button>
                      </td>
                      <td>
                        <span className={`badge badge-${caixa.status}`}>{caixa.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
