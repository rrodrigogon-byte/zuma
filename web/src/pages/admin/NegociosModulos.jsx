import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Store,
  Scissors,
  ShoppingBag,
  UtensilsCrossed,
  Trophy,
  ShieldCheck,
  Settings,
  Lock,
  Unlock,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import Modal from '../../components/Modal';

const PACOTES_PADRAO = {
  supermercado: {
    nome: 'Supermercado & Atacarejo',
    icone: 'store',
    modulosPadrao: ['erp_comum', 'crm_whatsapp', 'pdv_balanca', 'pereciveis', 'precos_etiquetas', 'logistica_wms', 'fidelidade_clube']
  },
  barbearia: {
    nome: 'Barbearia & Salão',
    icone: 'scissors',
    modulosPadrao: ['erp_comum', 'crm_whatsapp', 'pdv_comanda', 'agenda_profissionais', 'fidelidade_clube']
  },
  loja: {
    nome: 'Loja & Moda / Suplementos',
    icone: 'shopping-bag',
    modulosPadrao: ['erp_comum', 'crm_whatsapp', 'pdv_balcao', 'precos_etiquetas', 'logistica_wms', 'fidelidade_clube']
  },
  bar: {
    nome: 'Bar & Restaurante',
    icone: 'utensils',
    modulosPadrao: ['erp_comum', 'crm_whatsapp', 'pdv_comanda', 'mesas_kds', 'fidelidade_clube']
  },
  clube: {
    nome: 'Clube Esportivo & Eventos',
    icone: 'trophy',
    modulosPadrao: ['erp_comum', 'crm_whatsapp', 'socios_catracas', 'pdv_balcao']
  }
};

const CATALOGO_MODULOS = [
  { id: 'erp_comum', nome: 'ERP Comum (Cadastros, Financeiro, Fiscal, Estoque)', sempreAtivo: true, estado: 'no_ar' },
  { id: 'crm_whatsapp', nome: 'Clientes, CRM & WhatsApp Bot', sempreAtivo: false, estado: 'no_ar' },
  { id: 'pdv_balanca', nome: 'PDV Frente de Caixa (com Balança & Pesáveis)', sempreAtivo: false, estado: 'no_ar' },
  { id: 'pdv_balcao', nome: 'PDV Balcão & Código de Barras EAN', sempreAtivo: false, estado: 'no_ar' },
  { id: 'pdv_comanda', nome: 'PDV Comanda Individual & Móvel', sempreAtivo: false, estado: 'no_ar' },
  { id: 'pereciveis', nome: 'Perecíveis (Hortifrúti, Açougue SIF, Padaria BOM, FEFO)', sempreAtivo: false, estado: 'no_ar' },
  { id: 'precos_etiquetas', nome: 'Preços por Volume (Atacarejo), Tabloides & Etiquetas ZPL', sempreAtivo: false, estado: 'no_ar' },
  { id: 'logistica_wms', nome: 'Logística, Recebimento Docas & WMS Pulmão/Gôndola', sempreAtivo: false, estado: 'homologacao' },
  { id: 'agenda_profissionais', nome: 'Agenda 24x7, Profissionais & Comissões', sempreAtivo: false, estado: 'no_ar' },
  { id: 'mesas_kds', nome: 'Mesas, Cardápio Digital & Cozinha (KDS)', sempreAtivo: false, estado: 'no_ar' },
  { id: 'socios_catracas', nome: 'Sócios, Catracas, Quadras & Aulas', sempreAtivo: false, estado: 'no_ar' },
  { id: 'fidelidade_clube', nome: 'Clube Fidelidade, Cashback & Selinhos', sempreAtivo: false, estado: 'no_ar' }
];

export default function NegociosModulos() {
  const toast = useToast();
  const { isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [negocios, setNegocios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalEditarModulos, setModalEditarModulos] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Form novo negócio
  const [novoNegocio, setNovoNegocio] = useState({
    empresa_id: '',
    tipo: 'supermercado',
    nome: ''
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/empresas/negocios');
      setNegocios(res.negocios || []);
      setEmpresas(res.empresas || []);
      if (!novoNegocio.empresa_id && res.empresas?.length > 0) {
        setNovoNegocio(prev => ({ ...prev, empresa_id: res.empresas[0].id }));
      }
    } catch (e) {
      toast(e.message || 'Erro ao carregar lista de negócios', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleCriarNegocio = async (e) => {
    e.preventDefault();
    if (!novoNegocio.nome) {
      return toast('Informe o nome do negócio', 'error');
    }
    setSalvando(true);
    try {
      const padrao = PACOTES_PADRAO[novoNegocio.tipo]?.modulosPadrao || ['erp_comum'];
      await api.post('/api/admin/empresas/negocios', {
        ...novoNegocio,
        modulos_ligados: padrao
      });
      toast('Negócio criado com sucesso!', 'success');
      setModalCriar(false);
      setNovoNegocio({ empresa_id: empresas[0]?.id || '', tipo: 'supermercado', nome: '' });
      carregarDados();
    } catch (e) {
      toast(e.message || 'Erro ao criar negócio', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarModulos = async () => {
    if (!modalEditarModulos) return;
    setSalvando(true);
    try {
      await api.put(`/api/admin/empresas/negocios/${modalEditarModulos.id}/modulos`, {
        modulos_ligados: modalEditarModulos.modulos_ligados
      });
      toast('Módulos atualizados com sucesso!', 'success');
      setModalEditarModulos(null);
      carregarDados();
    } catch (e) {
      toast(e.message || 'Erro ao atualizar módulos do negócio', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const toggleModulo = (moduloId) => {
    if (!modalEditarModulos) return;
    const mod = CATALOGO_MODULOS.find(m => m.id === moduloId);
    if (mod?.sempreAtivo) return; // ERP comum não desativa

    const current = new Set(modalEditarModulos.modulos_ligados || []);
    if (current.has(moduloId)) {
      current.delete(moduloId);
    } else {
      current.add(moduloId);
    }
    setModalEditarModulos({
      ...modalEditarModulos,
      modulos_ligados: Array.from(current)
    });
  };

  const getIconeNegocio = (tipo) => {
    switch (tipo) {
      case 'supermercado': return <Store size={18} style={{ color: '#10b981' }} />;
      case 'barbearia': return <Scissors size={18} style={{ color: '#0284c7' }} />;
      case 'loja': return <ShoppingBag size={18} style={{ color: '#f59e0b' }} />;
      case 'bar': return <UtensilsCrossed size={18} style={{ color: '#ec4899' }} />;
      case 'clube': return <Trophy size={18} style={{ color: '#8b5cf6' }} />;
      default: return <Building2 size={18} style={{ color: '#64748b' }} />;
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 107, 44, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} style={{ color: '#FF6B2C' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy, #12283F)', margin: 0 }}>
                Governança de Negócios & Módulos
              </h1>
              <p style={{ fontSize: 13, color: 'var(--muted, #64748b)', margin: '4px 0 0' }}>
                Novo nível Negócio entre Empresa (CNPJ) e Unidades (Lojas) — Arquitetura Kytto Onda 1 (@Rodrigo Gonçalves)
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={carregarDados}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--line, #EADFD4)',
              background: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Atualizar
          </button>

          {isPlatformAdmin && (
            <button
              onClick={() => setModalCriar(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#FF6B2C',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Novo Negócio
            </button>
          )}
        </div>
      </div>

      {/* Regras e Governança */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(18, 40, 63, 0.03), rgba(255, 107, 44, 0.05))',
        border: '1px solid var(--line, #EADFD4)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <ShieldCheck size={28} style={{ color: '#10b981', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--navy, #12283F)', lineHeight: 1.5 }}>
          <strong>Isolamento Estrito de Negócios:</strong> Cada venda, caixa, estoque e movimentação contábil pertence a um negócio dono. O servidor valida os módulos ativos em cada requisição e responde <strong>HTTP 403 MODULO_NAO_LIBERADO</strong> caso o negócio ativo não possua a licença contratada.
        </div>
      </div>

      {/* Tabela de Negócios */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--line, #EADFD4)',
        borderRadius: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, #EADFD4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--navy, #12283F)' }}>
            Negócios Cadastrados no Grupo ({negocios.length})
          </h3>
          <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
            Empresa › Negócio › Unidades
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2, #FFF9F5)', borderBottom: '1px solid var(--line, #EADFD4)', color: 'var(--muted, #64748b)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 18px' }}>Negócio & Tipo</th>
                <th style={{ padding: '12px 18px' }}>Empresa Proprietária (CNPJ)</th>
                <th style={{ padding: '12px 18px' }}>Unidades (Lojas)</th>
                <th style={{ padding: '12px 18px' }}>Módulos Ligados</th>
                <th style={{ padding: '12px 18px', textAlign: 'center' }}>Situação</th>
                <th style={{ padding: '12px 18px', textAlign: 'center' }}>Configuração</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map(n => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--line, #EADFD4)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getIconeNegocio(n.tipo)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--navy, #12283F)' }}>{n.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', textTransform: 'capitalize' }}>
                          Tipo: {PACOTES_PADRAO[n.tipo]?.nome || n.tipo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy, #12283F)' }}>{n.empresa_nome || 'Empresa Kytto'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>CNPJ: {n.empresa_cnpj || '—'}</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', padding: '4px 10px', borderRadius: 20 }}>
                      {n.total_unidades || 1} unidade(s)
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 360 }}>
                      {(n.modulos_ligados || []).map(mId => {
                        const info = CATALOGO_MODULOS.find(c => c.id === mId);
                        return (
                          <span
                            key={mId}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {info?.nome?.split('(')[0] || mId}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: n.situacao === 'ativo' ? 'rgba(16, 185, 129, 0.12)' : '#f1f5f9',
                      color: n.situacao === 'ativo' ? '#10b981' : '#64748b'
                    }}>
                      {n.situacao === 'ativo' ? '● Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <button
                      onClick={() => setModalEditarModulos(n)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--line, #EADFD4)',
                        background: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--navy, #12283F)',
                        cursor: 'pointer'
                      }}
                    >
                      <Sliders size={14} />
                      Módulos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Negócio */}
      {modalCriar && (
        <Modal onClose={() => setModalCriar(false)} title="Novo Negócio Corporativo">
          <form onSubmit={handleCriarNegocio} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Empresa Proprietária (CNPJ)</label>
              <select
                value={novoNegocio.empresa_id}
                onChange={e => setNovoNegocio({ ...novoNegocio, empresa_id: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome} ({emp.cnpj})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Segmento / Tipo de Negócio</label>
              <select
                value={novoNegocio.tipo}
                onChange={e => setNovoNegocio({ ...novoNegocio, tipo: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                {Object.entries(PACOTES_PADRAO).map(([key, item]) => (
                  <option key={key} value={key}>{item.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Nome do Negócio</label>
              <input
                type="text"
                value={novoNegocio.nome}
                onChange={e => setNovoNegocio({ ...novoNegocio, nome: e.target.value })}
                placeholder="Ex: Supermercado Kytto Filial Centro"
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setModalCriar(false)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#FF6B2C', color: '#fff', fontWeight: 800 }}
              >
                {salvando ? 'Criando...' : 'Criar Negócio'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Módulos */}
      {modalEditarModulos && (
        <Modal onClose={() => setModalEditarModulos(null)} title={`Módulos Ativos: ${modalEditarModulos.nome}`}>
          <div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Ligue ou desligue módulos para este negócio. O ERP comum permanece sempre ativo para garantir integridade fiscal e contábil.
            </p>

            <div style={{ display: 'grid', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 6 }}>
              {CATALOGO_MODULOS.map(mod => {
                const ativo = (modalEditarModulos.modulos_ligados || []).includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModulo(mod.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: `1px solid ${ativo ? '#10b981' : '#e2e8f0'}`,
                      background: ativo ? 'rgba(16, 185, 129, 0.04)' : '#fff',
                      cursor: mod.sempreAtivo ? 'default' : 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{mod.nome}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Estado: {mod.estado === 'no_ar' ? '🟢 No ar' : '🟡 Homologação'} {mod.sempreAtivo && '• Módulo Central Obrigatório'}
                      </div>
                    </div>
                    <div>
                      {mod.sempreAtivo ? (
                        <Lock size={18} style={{ color: '#10b981' }} />
                      ) : ativo ? (
                        <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid #cbd5e1' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setModalEditarModulos(null)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarModulos}
                disabled={salvando}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800 }}
              >
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
