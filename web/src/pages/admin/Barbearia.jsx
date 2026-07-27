/**
 * ============================================================================
 * TELA ADMINISTRATIVA DE BARBEARIA — KYTTO ERP v4.0
 * ============================================================================
 * Componente React para gerenciamento completo de barbearia:
 * - Agenda inteligente com bloqueios
 * - Fila eletrônica em tempo real
 * - Cadastro de clientes com histórico
 * - Avaliações e NPS
 * - Profissionais e comissões
 */

import React, { useState, useEffect } from 'react';
import styles from './Barbearia.module.css';

const Barbearia = () => {
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState({
    clientes: [],
    bloqueios: [],
    fila: [],
    avaliacoes: [],
    profissionais: [],
  });

  // Buscar dados iniciais
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [clientes, fila, avaliacoes] = await Promise.all([
        fetch('/api/barbearia/clientes', { headers }).then(r => r.json()),
        fetch('/api/barbearia/fila', { headers }).then(r => r.json()),
        fetch('/api/barbearia/avaliacoes/nps', { headers }).then(r => r.json()),
      ]);

      setDados({
        clientes: clientes.clientes || [],
        fila: fila.fila || [],
        avaliacoes: avaliacoes || {},
      });
    } catch (err) {
      setErro(err.message);
      console.error('Erro ao carregar dados:', err);
    } finally {
      setCarregando(false);
    }
  };

  // =========================================================================
  // ABA 1: AGENDA
  // =========================================================================

  const renderAgenda = () => (
    <div className={styles.abaConteudo}>
      <h2>Agenda Inteligente</h2>
      <div className={styles.secao}>
        <h3>Bloqueios de Agenda</h3>
        <button className={styles.btnPrimario} onClick={() => alert('Criar novo bloqueio')}>
          + Novo Bloqueio
        </button>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Data Início</th>
              <th>Data Fim</th>
              <th>Motivo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>João Silva</td>
              <td>2026-08-01</td>
              <td>2026-08-15</td>
              <td>Férias</td>
              <td>
                <button className={styles.btnPequeno}>Editar</button>
                <button className={styles.btnPequeno}>Remover</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // =========================================================================
  // ABA 2: FILA ELETRÔNICA
  // =========================================================================

  const renderFila = () => (
    <div className={styles.abaConteudo}>
      <h2>Fila de Atendimento</h2>
      <div className={styles.filaContainer}>
        {dados.fila.length === 0 ? (
          <p className={styles.mensagemVazia}>Nenhum cliente na fila</p>
        ) : (
          <div className={styles.filaLista}>
            {dados.fila.map((item, idx) => (
              <div key={item.id} className={styles.filaItem}>
                <div className={styles.posicao}>#{item.posicao}</div>
                <div className={styles.info}>
                  <p className={styles.cliente}>{item.cliente_nome}</p>
                  <p className={styles.status}>{item.status}</p>
                </div>
                <div className={styles.acoes}>
                  {item.status === 'aguardando' && (
                    <button className={styles.btnChamar} onClick={() => chamarCliente(item.id)}>
                      Chamar
                    </button>
                  )}
                  {item.status === 'chamado' && (
                    <button className={styles.btnConcluir} onClick={() => concluirAtendimento(item.id)}>
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const chamarCliente = async (filaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/barbearia/fila/${filaId}/chamar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        carregarDados();
      }
    } catch (err) {
      console.error('Erro ao chamar cliente:', err);
    }
  };

  const concluirAtendimento = async (filaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/barbearia/fila/${filaId}/concluir`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        carregarDados();
      }
    } catch (err) {
      console.error('Erro ao concluir atendimento:', err);
    }
  };

  // =========================================================================
  // ABA 3: CLIENTES
  // =========================================================================

  const renderClientes = () => (
    <div className={styles.abaConteudo}>
      <h2>Clientes da Barbearia</h2>
      <button className={styles.btnPrimario} onClick={() => alert('Criar novo cliente')}>
        + Novo Cliente
      </button>
      <div className={styles.filtro}>
        <input type="text" placeholder="Buscar por nome, CPF ou telefone..." className={styles.inputBusca} />
      </div>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>CPF</th>
            <th>Total Gasto</th>
            <th>Última Visita</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {dados.clientes.length === 0 ? (
            <tr>
              <td colSpan="6" className={styles.mensagemVazia}>
                Nenhum cliente cadastrado
              </td>
            </tr>
          ) : (
            dados.clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nome}</td>
                <td>{cliente.telefone}</td>
                <td>{cliente.cpf || '-'}</td>
                <td>R$ {parseFloat(cliente.total_gasto).toFixed(2)}</td>
                <td>{cliente.ultima_visita ? new Date(cliente.ultima_visita).toLocaleDateString('pt-BR') : '-'}</td>
                <td>
                  <button className={styles.btnPequeno}>Ver Histórico</button>
                  <button className={styles.btnPequeno}>Editar</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // =========================================================================
  // ABA 4: AVALIAÇÕES E NPS
  // =========================================================================

  const renderAvaliacoes = () => (
    <div className={styles.abaConteudo}>
      <h2>Avaliações e NPS</h2>
      <div className={styles.npsContainer}>
        <div className={styles.npsCard}>
          <h3>NPS (Últimos 30 dias)</h3>
          <div className={styles.npsScore}>
            {dados.avaliacoes.nps !== undefined ? (
              <>
                <span className={styles.numero}>{dados.avaliacoes.nps}</span>
                <span className={styles.unidade}>%</span>
              </>
            ) : (
              <span>-</span>
            )}
          </div>
        </div>
        <div className={styles.npsCard}>
          <h3>Média Geral</h3>
          <div className={styles.npsScore}>
            {dados.avaliacoes.media_geral !== undefined ? (
              <>
                <span className={styles.numero}>{parseFloat(dados.avaliacoes.media_geral).toFixed(1)}</span>
                <span className={styles.unidade}>/5</span>
              </>
            ) : (
              <span>-</span>
            )}
          </div>
        </div>
        <div className={styles.npsCard}>
          <h3>Total de Avaliações</h3>
          <div className={styles.npsScore}>
            <span className={styles.numero}>{dados.avaliacoes.total_avaliacoes || 0}</span>
          </div>
        </div>
      </div>

      <div className={styles.secao}>
        <h3>Detalhamento de Notas</h3>
        <table className={styles.tabela}>
          <tbody>
            <tr>
              <td>Atendimento</td>
              <td>{parseFloat(dados.avaliacoes.media_atendimento || 0).toFixed(1)}/5</td>
            </tr>
            <tr>
              <td>Pontualidade</td>
              <td>{parseFloat(dados.avaliacoes.media_pontualidade || 0).toFixed(1)}/5</td>
            </tr>
            <tr>
              <td>Limpeza</td>
              <td>{parseFloat(dados.avaliacoes.media_limpeza || 0).toFixed(1)}/5</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // =========================================================================
  // ABA 5: PROFISSIONAIS
  // =========================================================================

  const renderProfissionais = () => (
    <div className={styles.abaConteudo}>
      <h2>Profissionais e Comissões</h2>
      <button className={styles.btnPrimario} onClick={() => alert('Adicionar profissional')}>
        + Adicionar Profissional
      </button>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Comissão Serviço</th>
            <th>Comissão Produto</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>João Silva</td>
            <td>Funcionário</td>
            <td>50%</td>
            <td>30%</td>
            <td>Ativo</td>
            <td>
              <button className={styles.btnPequeno}>Editar</button>
              <button className={styles.btnPequeno}>Extratos</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================

  return (
    <div className={styles.container}>
      <h1>Gestão de Barbearia</h1>

      {erro && <div className={styles.alerta}>{erro}</div>}

      <div className={styles.abas}>
        <button
          className={`${styles.abaBtn} ${abaAtiva === 'agenda' ? styles.ativo : ''}`}
          onClick={() => setAbaAtiva('agenda')}
        >
          📅 Agenda
        </button>
        <button
          className={`${styles.abaBtn} ${abaAtiva === 'fila' ? styles.ativo : ''}`}
          onClick={() => setAbaAtiva('fila')}
        >
          📋 Fila
        </button>
        <button
          className={`${styles.abaBtn} ${abaAtiva === 'clientes' ? styles.ativo : ''}`}
          onClick={() => setAbaAtiva('clientes')}
        >
          👥 Clientes
        </button>
        <button
          className={`${styles.abaBtn} ${abaAtiva === 'avaliacoes' ? styles.ativo : ''}`}
          onClick={() => setAbaAtiva('avaliacoes')}
        >
          ⭐ Avaliações
        </button>
        <button
          className={`${styles.abaBtn} ${abaAtiva === 'profissionais' ? styles.ativo : ''}`}
          onClick={() => setAbaAtiva('profissionais')}
        >
          💼 Profissionais
        </button>
      </div>

      {carregando ? (
        <div className={styles.carregando}>Carregando...</div>
      ) : (
        <>
          {abaAtiva === 'agenda' && renderAgenda()}
          {abaAtiva === 'fila' && renderFila()}
          {abaAtiva === 'clientes' && renderClientes()}
          {abaAtiva === 'avaliacoes' && renderAvaliacoes()}
          {abaAtiva === 'profissionais' && renderProfissionais()}
        </>
      )}
    </div>
  );
};

export default Barbearia;
