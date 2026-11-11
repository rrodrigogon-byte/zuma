import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CommandPalette({ isOpen, onClose }) {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const comandos = [
    // Ações Rápidas
    { id: 'comanda-nova', categoria: 'Ações Rápidas', icone: '📋', titulo: 'Abrir Nova Comanda', descricao: 'Iniciar atendimento no balcão ou cadeira', rota: '/admin/barbearia-erp?area=operacao&tab=Atendimento&nova=1' },
    { id: 'fin-novo', categoria: 'Ações Rápidas', icone: '💰', titulo: 'Novo Lançamento Financeiro', descricao: 'Criar conta a pagar ou conta a receber', rota: '/admin/financeiro?acao=novo' },
    { id: 'compras-novo', categoria: 'Ações Rápidas', icone: '🛒', titulo: 'Novo Pedido de Compras (IA)', descricao: 'Calcular reposição automática e gerar cotação', rota: '/admin/comprador-inteligente' },
    { id: 'nfe-xml', categoria: 'Ações Rápidas', icone: '📦', titulo: 'Importar NF-e de Compra (XML)', descricao: 'Dar entrada de estoque e alimentar contas a pagar', rota: '/admin/compras?tab=compras' },
    { id: 'caixa-fechar', categoria: 'Ações Rápidas', icone: '🔒', titulo: 'Conferir e Fechar Caixa Diário', descricao: 'Realizar fechamento cego e conciliação', rota: '/admin/barbearia-erp?area=operacao&tab=Caixa+e+fechamento' },
    { id: 'cliente-novo', categoria: 'Ações Rápidas', icone: '👤', titulo: 'Cadastrar Novo Cliente', descricao: 'Adicionar cadastro na carteira do salão', rota: '/admin/barbearia-erp?area=relacionamento&tab=Clientes' },

    // Módulos Principais
    { id: 'mod-eventbus', categoria: 'Módulos do ERP', icone: '⚡', titulo: 'Barramento de Eventos Internos Kytto', descricao: 'Monitor em tempo real de sincronização por evento interno', rota: '/admin/barramento-eventos' },
    { id: 'mod-barbearia', categoria: 'Módulos do ERP', icone: '💈', titulo: 'Barbearia & Salão ERP', descricao: 'Agenda, atendimento, catálogo e gestão operacional', rota: '/admin/barbearia-erp' },
    { id: 'mod-financeiro', categoria: 'Módulos do ERP', icone: '📈', titulo: 'Financeiro Central (KPIs em k)', descricao: 'DRE, Fluxo de Caixa, Contas a Receber e a Pagar', rota: '/admin/financeiro' },
    { id: 'mod-comprador-ia', categoria: 'Módulos do ERP', icone: '🤖', titulo: 'Comprador Inteligente IA', descricao: 'Motor autônomo de compras, ROP, EOQ e cotações', rota: '/admin/comprador-inteligente' },
    { id: 'mod-gestao-salao', categoria: 'Módulos do ERP', icone: '🎯', titulo: 'Dashboard de Gestão do Salão', descricao: 'Metas dos profissionais, blend de vendas e IA T-Rex', rota: '/admin/gestao-salao' },
    { id: 'mod-estoque', categoria: 'Módulos do ERP', icone: '🏷️', titulo: 'Estoque de Revenda & Insumos', descricao: 'Controle de saldo, perdas, inventário e kardex', rota: '/admin/estoque' },
    { id: 'mod-fichas', categoria: 'Módulos do ERP', icone: '🧪', titulo: 'Fichas Técnicas dos Procedimentos', descricao: 'Custo de insumos por serviço e margem líquida', rota: '/admin/fichas-tecnicas' },
    { id: 'mod-fiscal', categoria: 'Módulos do ERP', icone: '📑', titulo: 'Central Fiscal SEFAZ-MT', descricao: 'Inscrição Estadual 14.229.191-9, NFC-e, NF-e e Certificado A1', rota: '/admin/fiscal' },
    { id: 'mod-crm-avec', categoria: 'Módulos do ERP', icone: '⚡', titulo: 'CRM de Recuperação Inteligente (Avec)', descricao: 'Régua automática de clientes ausentes há 30, 60 e 90+ dias', rota: '/admin/barbearia-erp?area=gestao&tab=Recupera%C3%A7%C3%A3o+de+clientes+(Avec)' },
    { id: 'mod-pdv', categoria: 'Módulos do ERP', icone: '🏪', titulo: 'Frente de Caixa PDV Varejo', descricao: 'Vendas rápidas, balança pesadora e cupom fiscal', rota: '/admin/supermercado-pdv' },
    { id: 'mod-barbeiro-pwa', categoria: 'Módulos do ERP', icone: '📱', titulo: 'App do Barbeiro PWA Mobile', descricao: 'Visão individual de metas, agenda e roleta de prêmios', rota: '/barbeiro' },
    { id: 'mod-sped-bloco-k', categoria: 'Módulos do ERP', icone: '📑', titulo: 'SPED Fiscal Bloco K', descricao: 'Registro da produção e estoque escriturado (K200, K230, K235)', rota: '/admin/sped-fiscal' },
    { id: 'mod-matriz-trib', categoria: 'Módulos do ERP', icone: '⚖️', titulo: 'Matriz Tributária Global', descricao: 'Regras de ICMS, PIS, COFINS, NCM e Substituição Tributária (ST)', rota: '/admin/matriz-tributaria' },
    { id: 'mod-dre-ebitda', categoria: 'Módulos do ERP', icone: '📈', titulo: 'DRE & EBITDA Operacional', descricao: 'Demonstrativo do resultado com CMV, margem de contribuição e quebras', rota: '/admin/dre-ebitda' },
    { id: 'mod-conc-tef', categoria: 'Módulos do ERP', icone: '💳', titulo: 'Conciliação TEF, Cartões & PIX', descricao: 'Auditoria eletrônica de taxas MDR contratuais Stone, Cielo e Rede', rota: '/admin/conciliacao-tef' },
    { id: 'mod-tesouraria-cofre', categoria: 'Módulos do ERP', icone: '🏦', titulo: 'Tesouraria & Cofre Central', descricao: 'Custódia de numerário físico, sangrias e malotes de carro-forte', rota: '/admin/tesouraria' },

    // Relatórios e Gestão
    { id: 'rel-central', categoria: 'Relatórios & Inteligência', icone: '📊', titulo: 'Central Geral de Relatórios (96 Modelos)', descricao: 'Clientes, serviços, profissionais, caixas e DRE', rota: '/admin/relatorios' },
    { id: 'rel-desempenho', categoria: 'Relatórios & Inteligência', icone: '👥', titulo: 'Relatório de Desempenho dos Profissionais', descricao: 'Comparações de entregas, comissões e produtividade', rota: '/admin/relatorios/dino/desempenho-profissional' },
    { id: 'rel-caixas', categoria: 'Relatórios & Inteligência', icone: '💵', titulo: 'Relatório de Caixas Fechados', descricao: 'Conferência de entradas, quebras e formas de pagamento', rota: '/admin/relatorios/dino/caixas-fechados' },
    { id: 'rel-retorno', categoria: 'Relatórios & Inteligência', icone: '🔄', titulo: 'Taxa de Retorno de Clientes', descricao: 'Retenção por profissional e taxa de fidelização', rota: '/admin/relatorios/dino/retorno' },
    { id: 'rel-clientes', categoria: 'Relatórios & Inteligência', icone: '📋', titulo: 'Clientes Atendidos e Ticket Médio', descricao: 'Consumo por cliente e ranking de fidelidade', rota: '/admin/relatorios/dino/clientes-atendidos' },
    { id: 'conf-empresas', categoria: 'Configurações Globais', icone: '🏢', titulo: 'Cadastro de Empresas e Filiais', descricao: 'Gestão de matriz, lojas, CNPJs e Inscrições Estaduais', rota: '/admin/empresas' },
    { id: 'conf-auditoria', categoria: 'Configurações Globais', icone: '🛡️', titulo: 'Auditoria e Logs de Sistema', descricao: 'Rastreabilidade de alterações e acessos', rota: '/admin/auditoria' }
  ];

  const itensFiltrados = comandos.filter(c => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return c.titulo.toLowerCase().includes(b) ||
           c.descricao.toLowerCase().includes(b) ||
           c.categoria.toLowerCase().includes(b);
  });

  useEffect(() => {
    if (isOpen) {
      setBusca('');
      setSelecionado(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelecionado(0);
  }, [busca]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelecionado(prev => (prev < itensFiltrados.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelecionado(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && itensFiltrados[selecionado]) {
      e.preventDefault();
      executar(itensFiltrados[selecionado]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const executar = (item) => {
    onClose();
    navigate(item.rota);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'var(--surface, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--line, #334155)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Barra de Busca */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--line, #334155)',
          background: 'var(--card, #0f172a)'
        }}>
          <span style={{ fontSize: '20px', color: 'var(--accent, #6366f1)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite para buscar clientes, módulos, comandas, relatórios ou ações..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              color: 'var(--text, #f8fafc)',
              fontFamily: 'inherit'
            }}
          />
          <kbd style={{
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--muted, #94a3b8)',
            background: 'var(--surface, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: '6px'
          }}>
            ESC
          </kbd>
        </div>

        {/* Resultados */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {itensFiltrados.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔎</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Nenhum comando ou módulo encontrado</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Tente buscar por termos como "comanda", "caixa", "relatório", "estoque" ou "sefaz"</div>
            </div>
          ) : (
            itensFiltrados.map((item, index) => {
              const ativo = index === selecionado;
              return (
                <div
                  key={item.id}
                  onClick={() => executar(item)}
                  onMouseEnter={() => setSelecionado(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: ativo ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: ativo ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                    transition: 'all 0.1s ease',
                    marginBottom: '4px'
                  }}
                >
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: ativo ? 'var(--accent, #6366f1)' : 'var(--card, #0f172a)',
                    color: ativo ? '#ffffff' : 'var(--text, #f8fafc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {item.icone}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: ativo ? 'var(--text, #ffffff)' : 'var(--text, #f8fafc)'
                      }}>
                        {item.titulo}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(148, 163, 184, 0.12)',
                        color: 'var(--muted, #94a3b8)',
                        textTransform: 'uppercase'
                      }}>
                        {item.categoria}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--muted, #94a3b8)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.descricao}
                    </div>
                  </div>
                  {ativo && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--accent, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      Enter ↵
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid var(--line, #334155)',
          background: 'var(--card, #0f172a)',
          fontSize: '11px',
          color: 'var(--muted, #94a3b8)'
        }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span><kbd style={{ padding: '2px 5px', background: 'var(--surface, #1e293b)', borderRadius: '4px', border: '1px solid var(--line, #334155)' }}>↑</kbd> <kbd style={{ padding: '2px 5px', background: 'var(--surface, #1e293b)', borderRadius: '4px', border: '1px solid var(--line, #334155)' }}>↓</kbd> Navegar</span>
            <span><kbd style={{ padding: '2px 5px', background: 'var(--surface, #1e293b)', borderRadius: '4px', border: '1px solid var(--line, #334155)' }}>↵</kbd> Selecionar</span>
            <span><kbd style={{ padding: '2px 5px', background: 'var(--surface, #1e293b)', borderRadius: '4px', border: '1px solid var(--line, #334155)' }}>ESC</kbd> Fechar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981' }}>●</span> Kytto ERP Global Search
          </div>
        </div>
      </div>
    </div>
  );
}
