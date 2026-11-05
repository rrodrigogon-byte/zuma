import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Store,
  Globe2,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Save,
  RefreshCw,
  Palette,
  Megaphone,
  ShoppingBag,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  ShieldCheck,
  FileText,
  Sliders,
  Sparkles,
  Layers3,
  Image as ImageIcon,
  Share2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  ArrowRight
} from 'lucide-react';
import { api, fmtDate, fmtR } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { updateCoreStorefront } from './commerce-admin-adapter';
import './commerce-store-management.css';

// Paletas de cores temáticas prontas para aplicar em 1 clique
const PALETTES_PRESETS = [
  {
    nome: 'Dino Barber Dark Gold',
    badge: '💈 Barbearia Dino',
    colors: {
      accent: '#D4AF37',
      accentStrong: '#AA8C2C',
      background: '#101114',
      surface: '#181A20',
      text: '#F4F5F7'
    }
  },
  {
    nome: 'Stallone Sport Red',
    badge: '🏋️ Stallone Nutre',
    colors: {
      accent: '#E8463C',
      accentStrong: '#B5302A',
      background: '#0B0B0D',
      surface: '#17171B',
      text: '#F6F5F0'
    }
  },
  {
    nome: 'Kytto Fresh Blue',
    badge: '🌐 Kytto Pro',
    colors: {
      accent: '#2563EB',
      accentStrong: '#1D4ED8',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A'
    }
  },
  {
    nome: 'Clean Minimalist',
    badge: '✨ Minimal',
    colors: {
      accent: '#18181B',
      accentStrong: '#09090B',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#18181B'
    }
  },
  {
    nome: 'Sunset Amber & Orange',
    badge: '🔥 Sunset',
    colors: {
      accent: '#EA580C',
      accentStrong: '#C2410C',
      background: '#FFFBEB',
      surface: '#FFFFFF',
      text: '#451A03'
    }
  }
];

export default function CommerceStoreManagement({
  storefronts = [],
  activeStorefront = null,
  storefrontId = '',
  onSelectStorefront,
  onCreateStorefront,
  onActivateStorefront,
  storefrontActivationTarget,
  setStorefrontActivationTarget,
  storefrontActivationLoading = false,
  activateStorefront,
  domains = [],
  products = [],
  categories = [],
  canWrite = true,
  onRefresh,
  empresaAtiva = null,
  lojaAtiva = null,
  onNavigateTab
}) {
  const { toast } = useToast();
  const [subtab, setSubtab] = useState('aparencia'); // 'aparencia' | 'vitrine' | 'unidades' | 'atendimento' | 'politicas' | 'storefronts'
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Unidades físicas da empresa
  const [unidadesFisicas, setUnidadesFisicas] = useState([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);

  // Extrai configurações atuais do storefront ativo
  const currentConfig = useMemo(() => {
    return activeStorefront?.configuracoes || {};
  }, [activeStorefront]);

  const currentPublic = useMemo(() => {
    return currentConfig.public || {};
  }, [currentConfig]);

  // Estados locais editáveis
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');

  const [colors, setColors] = useState({
    accent: '#2E7D32',
    accentStrong: '#1B5E20',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#172033'
  });

  const [announcement, setAnnouncement] = useState({
    enabled: false,
    text: '',
    link: '',
    bgColor: '#172033',
    textColor: '#FFFFFF'
  });

  const [banners, setBanners] = useState([]);
  const [badges, setBadges] = useState([]);

  const [contact, setContact] = useState({
    phone: '',
    email: '',
    whatsapp: '',
    instagram: ''
  });

  const [address, setAddress] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
    hours: ''
  });

  const [pickup, setPickup] = useState({
    enabled: true,
    instructions: '',
    leadTimeHours: 2
  });

  const [policies, setPolicies] = useState({
    privacyUrl: '',
    returnsUrl: '',
    shippingUrl: '',
    termsUrl: ''
  });

  const [seo, setSeo] = useState({
    metaTitle: '',
    metaDescription: '',
    ogImage: ''
  });

  const [tracking, setTracking] = useState({
    metaPixelId: '',
    gaMeasurementId: ''
  });

  // Sincroniza estados quando o activeStorefront muda
  useEffect(() => {
    if (!activeStorefront) return;
    const pub = activeStorefront.configuracoes?.public || {};
    setDisplayName(pub.displayName || activeStorefront.nome || '');
    setTagline(pub.tagline || '');
    setLogoUrl(pub.logoUrl || '');
    setFaviconUrl(pub.faviconUrl || '');

    setColors({
      accent: pub.colors?.accent || '#2E7D32',
      accentStrong: pub.colors?.accentStrong || '#1B5E20',
      background: pub.colors?.background || '#F8FAFC',
      surface: pub.colors?.surface || '#FFFFFF',
      text: pub.colors?.text || '#172033'
    });

    setAnnouncement({
      enabled: Boolean(pub.announcement?.enabled),
      text: pub.announcement?.text || '',
      link: pub.announcement?.link || '',
      bgColor: pub.announcement?.bgColor || '#172033',
      textColor: pub.announcement?.textColor || '#FFFFFF'
    });

    setBanners(Array.isArray(pub.banners) ? pub.banners : []);
    setBadges(
      Array.isArray(pub.badges) && pub.badges.length
        ? pub.badges
        : [
            { id: '1', title: 'Compra 100% Segura', description: 'Criptografia e proteção total de ponta a ponta', icon: 'shield', active: true },
            { id: '2', title: 'Entrega Rápida e Rastreada', description: 'Correios, transportadoras e entregador próprio', icon: 'truck', active: true },
            { id: '3', title: 'Retire na Loja Física', description: 'Compre online e retire no balcão sem pagar frete', icon: 'store', active: true },
            { id: '4', title: 'Atendimento Humanizado', description: 'Suporte rápido direto no WhatsApp oficial da loja', icon: 'message', active: true }
          ]
    );

    setContact({
      phone: pub.contact?.phone || '',
      email: pub.contact?.email || '',
      whatsapp: pub.contact?.whatsapp || '',
      instagram: pub.contact?.instagram || ''
    });

    setAddress({
      street: pub.address?.street || '',
      number: pub.address?.number || '',
      complement: pub.address?.complement || '',
      neighborhood: pub.address?.neighborhood || '',
      city: pub.address?.city || '',
      state: pub.address?.state || '',
      postalCode: pub.address?.postalCode || '',
      hours: pub.address?.hours || ''
    });

    setPickup({
      enabled: pub.pickup?.enabled !== false,
      instructions: pub.pickup?.instructions || '',
      leadTimeHours: pub.pickup?.leadTimeHours ?? 2
    });

    setPolicies({
      privacyUrl: pub.policies?.privacyUrl || '',
      returnsUrl: pub.policies?.returnsUrl || '',
      shippingUrl: pub.policies?.shippingUrl || '',
      termsUrl: pub.policies?.termsUrl || ''
    });

    setSeo({
      metaTitle: pub.seo?.metaTitle || '',
      metaDescription: pub.seo?.metaDescription || '',
      ogImage: pub.seo?.ogImage || ''
    });

    setTracking({
      metaPixelId: pub.tracking?.metaPixelId || '',
      gaMeasurementId: pub.tracking?.gaMeasurementId || ''
    });
  }, [activeStorefront]);

  // Carrega lista de unidades físicas
  useEffect(() => {
    async function carregarUnidades() {
      try {
        setCarregandoUnidades(true);
        const res = await api.get('/api/admin/unidades?incluir_inativas=true');
        const list = Array.isArray(res) ? res : res?.unidades || res?.lojas || [];
        setUnidadesFisicas(list);
      } catch (e) {
        console.warn('Erro ao carregar unidades físicas:', e);
      } finally {
        setCarregandoUnidades(false);
      }
    }
    carregarUnidades();
  }, []);

  // Calcula URL pública da loja
  const publicStoreUrl = useMemo(() => {
    if (!activeStorefront) return '';
    const dominios = activeStorefront.dominios || [];
    const verifiedPrimary = dominios.find((d) => d.principal && d.status === 'verified');
    if (verifiedPrimary) {
      return `https://${verifiedPrimary.dominio}`;
    }
    return `${window.location.origin}/ecommerce/${activeStorefront.codigo}`;
  }, [activeStorefront]);

  // Copia o link público da loja
  const handleCopiarLink = () => {
    if (!publicStoreUrl) return;
    navigator.clipboard.writeText(publicStoreUrl);
    setCopiado(true);
    toast?.('Link da loja online copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiado(false), 2500);
  };

  // Aplica uma paleta temática pré-definida
  const aplicarPaleta = (p) => {
    setColors({ ...p.colors });
    toast?.(`Paleta “${p.nome}” aplicada! Clique em Salvar para confirmar.`, 'info');
  };

  // Salva todas as configurações no Storefront ativo
  const handleSalvarTudo = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canWrite) {
      toast?.('Seu usuário não possui permissão de edição de configurações.', 'error');
      return;
    }
    if (!activeStorefront) {
      toast?.('Nenhuma loja ativa selecionada.', 'error');
      return;
    }

    setSalvando(true);
    try {
      const nextPublic = {
        ...(activeStorefront.configuracoes?.public || {}),
        displayName: displayName.trim(),
        tagline: tagline.trim(),
        logoUrl: logoUrl.trim(),
        faviconUrl: faviconUrl.trim(),
        colors,
        announcement,
        banners,
        badges,
        contact,
        address,
        pickup,
        policies,
        seo,
        tracking
      };

      const nextConfig = {
        ...(activeStorefront.configuracoes || {}),
        public: nextPublic
      };

      await updateCoreStorefront(activeStorefront.id, {
        nome: displayName.trim() || activeStorefront.nome,
        configuracoes: nextConfig
      });

      toast?.('Configurações da loja salvas com sucesso e publicadas!', 'success');
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast?.(err.message || 'Erro ao salvar configurações da loja.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  // Adiciona novo banner
  const handleAdicionarBanner = () => {
    const novo = {
      id: String(Date.now()),
      title: 'Destaque Especial da Semana',
      subtitle: 'Confira as melhores ofertas e novidades do catálogo com entrega rápida.',
      imageUrl: '',
      linkUrl: '#catalogo',
      ctaText: 'Aproveitar Oferta',
      active: true
    };
    setBanners([...banners, novo]);
  };

  const handleRemoverBanner = (id) => {
    setBanners(banners.filter((b) => b.id !== id));
  };

  const handleAtualizarBanner = (id, campo, valor) => {
    setBanners(banners.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)));
  };

  // Adiciona badge
  const handleAdicionarBadge = () => {
    const novo = {
      id: String(Date.now()),
      title: 'Garantia de Qualidade',
      description: 'Produtos originais com garantia direto do fabricante.',
      icon: 'shield',
      active: true
    };
    setBadges([...badges, novo]);
  };

  const handleRemoverBadge = (id) => {
    setBadges(badges.filter((b) => b.id !== id));
  };

  const handleAtualizarBadge = (id, campo, valor) => {
    setBadges(badges.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)));
  };

  return (
    <div className="csm-shell">
      {/* ── BANNER EXECUTIVO DO CANAL ATIVO ────────────────────────────── */}
      <section className="csm-hero-card">
        <div className="csm-hero-info">
          <div className="csm-hero-avatar">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo da Loja" onError={(e) => (e.target.style.display = 'none')} />
            ) : (
              <Store size={28} />
            )}
          </div>
          <div className="csm-hero-titles">
            <h2>
              {displayName || activeStorefront?.nome || 'Loja On-line'}
              <span className={`csm-status-pill ${activeStorefront?.status || 'active'}`}>
                {activeStorefront?.status === 'active' ? 'Ativo no Ar' : activeStorefront?.status === 'paused' ? 'Pausado' : 'Rascunho'}
              </span>
            </h2>
            <p>
              Canal: <b>{activeStorefront?.codigo || 'web-default'}</b> · Unidade:{' '}
              <b>{activeStorefront?.loja_nome || activeStorefront?.loja_codigo || 'Matriz Geral'}</b> · Moeda:{' '}
              <b>{activeStorefront?.moeda || 'BRL'}</b> · {products.length} itens cadastrados
            </p>
          </div>
        </div>

        <div className="csm-hero-actions">
          {storefronts.length > 1 && (
            <select
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #c8ddd2',
                background: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                color: '#123026'
              }}
              value={storefrontId}
              onChange={(e) => {
                const target = storefronts.find((s) => s.id === e.target.value);
                if (target) onSelectStorefront?.(target);
              }}
            >
              {storefronts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.codigo})
                </option>
              ))}
            </select>
          )}

          <a
            href={publicStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="csm-btn-secondary"
            title="Abrir vitrine em nova aba"
          >
            <ExternalLink size={15} /> Ver Loja no Ar
          </a>

          <button
            type="button"
            className="csm-btn-secondary"
            onClick={handleCopiarLink}
            title="Copiar URL pública da loja"
          >
            {copiado ? <Check size={15} color="#2e7d32" /> : <Copy size={15} />}
            {copiado ? 'Link Copiado!' : 'Copiar Link'}
          </button>

          <button
            type="button"
            className="csm-btn-primary"
            onClick={handleSalvarTudo}
            disabled={salvando || !canWrite}
          >
            {salvando ? <RefreshCw size={15} className="ecommerce-admin-spin" /> : <Save size={15} />}
            {salvando ? 'Salvando…' : 'Salvar Loja'}
          </button>
        </div>
      </section>

      {/* ── NAVEGAÇÃO DE SUB-ABAS ────────────────────────────────────────── */}
      <nav className="csm-subtabs-nav" aria-label="Navegação de Gestão da Loja">
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'aparencia' ? 'active' : ''}`}
          onClick={() => setSubtab('aparencia')}
        >
          <Palette size={15} /> Identidade Visual &amp; Cores
        </button>
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'vitrine' ? 'active' : ''}`}
          onClick={() => setSubtab('vitrine')}
        >
          <Megaphone size={15} /> Banners &amp; Barra de Aviso
        </button>
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'unidades' ? 'active' : ''}`}
          onClick={() => setSubtab('unidades')}
        >
          <Building2 size={15} /> Rede de Lojas &amp; Retirada ({unidadesFisicas.length})
        </button>
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'atendimento' ? 'active' : ''}`}
          onClick={() => setSubtab('atendimento')}
        >
          <MessageSquare size={15} /> WhatsApp &amp; Atendimento
        </button>
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'politicas' ? 'active' : ''}`}
          onClick={() => setSubtab('politicas')}
        >
          <ShieldCheck size={15} /> Políticas &amp; SEO
        </button>
        <button
          type="button"
          className={`csm-subtab-btn ${subtab === 'storefronts' ? 'active' : ''}`}
          onClick={() => setSubtab('storefronts')}
        >
          <Globe2 size={15} /> Canais &amp; Domínios ({storefronts.length})
        </button>
      </nav>

      {/* ── SUB-ABA 1: IDENTIDADE VISUAL, BRANDING & CORES ─────────────────── */}
      {subtab === 'aparencia' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Identidade Visual &amp; Cores da Loja Online</h3>
              <p>Personalize o nome exibido, slogan, logos e paleta de cores aplicada na vitrine pública e checkout.</p>
            </div>
            <div className="csm-presets-row">
              <span style={{ fontSize: 11, fontWeight: 800, color: '#557268', textTransform: 'uppercase' }}>
                Paletas Rápidas:
              </span>
              {PALETTES_PRESETS.map((p) => (
                <button
                  key={p.nome}
                  type="button"
                  className="csm-preset-btn"
                  onClick={() => aplicarPaleta(p)}
                >
                  <span className="csm-preset-dot" style={{ background: p.colors.accent }} />
                  {p.badge}
                </button>
              ))}
            </div>
          </header>

          <form onSubmit={handleSalvarTudo}>
            <div className="csm-grid-2" style={{ marginBottom: 20 }}>
              <div className="csm-field-group">
                <label>Nome Comercial da Loja</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Barbearia Dino · Loja Oficial"
                  maxLength={120}
                  required
                />
                <span className="csm-hint">Aparece no cabeçalho da loja, títulos das páginas e comprovantes de compra.</span>
              </div>

              <div className="csm-field-group">
                <label>Slogan / Tagline Comercial</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ex: Estilo, autocuidado e presença com produtos selecionados."
                  maxLength={240}
                />
                <span className="csm-hint">Frase de impacto exibida no banner principal da home.</span>
              </div>
            </div>

            <div className="csm-grid-2" style={{ marginBottom: 24 }}>
              <div className="csm-field-group">
                <label>URL do Logotipo da Loja (PNG, SVG, WebP)</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://sua-loja.com/logo.png"
                />
                <span className="csm-hint">Recomendado fundo transparente (PNG ou SVG) com pelo menos 300px de largura.</span>
              </div>

              <div className="csm-field-group">
                <label>URL do Favicon (Ícone da Aba do Navegador)</label>
                <input
                  type="url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://sua-loja.com/favicon.png"
                />
                <span className="csm-hint">Ícone quadrado (32x32 ou 64x64) exibido ao lado do título da aba.</span>
              </div>
            </div>

            <h4 style={{ margin: '20px 0 12px 0', fontSize: 15, fontWeight: 800, color: '#123026' }}>
              Paleta de Cores da Marca
            </h4>

            <div className="csm-grid-3" style={{ marginBottom: 24 }}>
              <div className="csm-field-group">
                <label>Cor de Ação / Botão Principal</label>
                <div className="csm-color-picker-box">
                  <input
                    type="color"
                    value={colors.accent}
                    onChange={(e) => setColors({ ...colors, accent: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="text"
                    value={colors.accent}
                    onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                  />
                </div>
                <span className="csm-hint">Cor dos botões de compra, links e chamadas principais.</span>
              </div>

              <div className="csm-field-group">
                <label>Cor de Hover / Destaque Forte</label>
                <div className="csm-color-picker-box">
                  <input
                    type="color"
                    value={colors.accentStrong}
                    onChange={(e) => setColors({ ...colors, accentStrong: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="text"
                    value={colors.accentStrong}
                    onChange={(e) => setColors({ ...colors, accentStrong: e.target.value })}
                  />
                </div>
                <span className="csm-hint">Tom mais escuro para efeito hover ao passar o mouse.</span>
              </div>

              <div className="csm-field-group">
                <label>Fundo da Loja (Background)</label>
                <div className="csm-color-picker-box">
                  <input
                    type="color"
                    value={colors.background}
                    onChange={(e) => setColors({ ...colors, background: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="text"
                    value={colors.background}
                    onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  />
                </div>
                <span className="csm-hint">Fundo geral da página (escuro ou claro).</span>
              </div>

              <div className="csm-field-group">
                <label>Superfície / Cards de Produto</label>
                <div className="csm-color-picker-box">
                  <input
                    type="color"
                    value={colors.surface}
                    onChange={(e) => setColors({ ...colors, surface: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="text"
                    value={colors.surface}
                    onChange={(e) => setColors({ ...colors, surface: e.target.value })}
                  />
                </div>
                <span className="csm-hint">Cor dos cartões de produto, popups e formulários.</span>
              </div>

              <div className="csm-field-group">
                <label>Cor do Texto Principal</label>
                <div className="csm-color-picker-box">
                  <input
                    type="color"
                    value={colors.text}
                    onChange={(e) => setColors({ ...colors, text: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="text"
                    value={colors.text}
                    onChange={(e) => setColors({ ...colors, text: e.target.value })}
                  />
                </div>
                <span className="csm-hint">Contraste legível sobre a cor de fundo e superfície.</span>
              </div>
            </div>

            {/* LIVE PREVIEW DA VITRINE */}
            <div className="csm-live-preview-wrap">
              <div className="csm-preview-bar">
                <span>SIMULADOR VISUAL DA VITRINE ONLINE (TEMPO REAL)</span>
                <span style={{ fontSize: 11, color: '#557268' }}>Atualiza conforme você altera as cores acima</span>
              </div>
              <div
                className="csm-preview-body"
                style={{ backgroundColor: colors.background, color: colors.text }}
              >
                {/* Navbar simulada */}
                <div
                  className="csm-preview-nav"
                  style={{ backgroundColor: colors.surface, border: `1px solid ${colors.text}18` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ height: 26, objectFit: 'contain' }} />
                    ) : (
                      <Store size={20} color={colors.accent} />
                    )}
                    <strong style={{ fontSize: 15, color: colors.text }}>{displayName || 'Loja On-line'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: colors.accent,
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 12
                      }}
                    >
                      Carrinho (1)
                    </button>
                  </div>
                </div>

                {/* Hero simulado */}
                <div
                  className="csm-preview-hero"
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.text}15`
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: colors.accent,
                      textTransform: 'uppercase',
                      letterSpacing: 1
                    }}
                  >
                    Loja Oficial
                  </span>
                  <h3 style={{ margin: '8px 0', fontSize: 20, fontWeight: 900, color: colors.text }}>
                    {displayName || 'Sua Marca Conectada'}
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: 13, opacity: 0.85, maxWidth: 500, marginInline: 'auto' }}>
                    {tagline || 'Produtos selecionados para sua melhor experiência.'}
                  </p>
                  <button
                    type="button"
                    style={{
                      padding: '8px 20px',
                      borderRadius: 10,
                      background: colors.accent,
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: 13,
                      boxShadow: `0 4px 14px ${colors.accent}55`
                    }}
                  >
                    Explorar Catálogo →
                  </button>
                </div>

                {/* Card de produto simulado */}
                <div
                  className="csm-preview-product-card"
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.text}18`
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 120,
                      borderRadius: 10,
                      background: `${colors.accent}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12
                    }}
                  >
                    <ShoppingBag size={32} color={colors.accent} />
                  </div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.65, fontWeight: 700 }}>
                    Exemplo de Produto
                  </span>
                  <h4 style={{ margin: '4px 0 8px 0', fontSize: 14, fontWeight: 800, color: colors.text }}>
                    Pomada Modeladora Efeito Matte 80g
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 16, color: colors.accent }}>R$ 45,00</strong>
                    <button
                      type="button"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: colors.accent,
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 11
                      }}
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="csm-btn-primary"
                disabled={salvando || !canWrite}
              >
                <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar Identidade & Cores'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── SUB-ABA 2: VITRINES, BANNERS & BARRA DE AVISOS ─────────────────── */}
      {subtab === 'vitrine' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Banners Promocionais &amp; Barra de Anúncios de Topo</h3>
              <p>Configure a mensagem de destaque fixada no topo do site e os banners rotativos da página inicial.</p>
            </div>
          </header>

          <form onSubmit={handleSalvarTudo}>
            {/* BARRA DE ANÚNCIOS */}
            <div
              style={{
                padding: '20px 22px',
                borderRadius: 14,
                border: '1px solid #d4e5dc',
                background: '#f9fcfb',
                marginBottom: 28
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Megaphone size={18} color="#2e7d32" />
                  <strong style={{ fontSize: 15, color: '#123026' }}>Barra de Anúncios no Topo (Announcement Bar)</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={announcement.enabled}
                    onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })}
                  />
                  Ativar Barra no Topo
                </label>
              </div>

              {announcement.enabled && (
                <>
                  <div className="csm-grid-2" style={{ marginBottom: 16 }}>
                    <div className="csm-field-group">
                      <label>Texto da Mensagem de Topo</label>
                      <input
                        type="text"
                        value={announcement.text}
                        onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
                        placeholder="Ex: 🚀 FRETE GRÁTIS para Tangará da Serra nas compras acima de R$ 199!"
                        maxLength={200}
                      />
                    </div>
                    <div className="csm-field-group">
                      <label>Link Opcional de Destino</label>
                      <input
                        type="url"
                        value={announcement.link}
                        onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
                        placeholder="https://... ou #catalogo"
                      />
                    </div>
                  </div>

                  <div className="csm-grid-2">
                    <div className="csm-field-group">
                      <label>Cor de Fundo da Barra</label>
                      <div className="csm-color-picker-box">
                        <input
                          type="color"
                          value={announcement.bgColor}
                          onChange={(e) => setAnnouncement({ ...announcement, bgColor: e.target.value.toUpperCase() })}
                        />
                        <input
                          type="text"
                          value={announcement.bgColor}
                          onChange={(e) => setAnnouncement({ ...announcement, bgColor: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="csm-field-group">
                      <label>Cor do Texto da Barra</label>
                      <div className="csm-color-picker-box">
                        <input
                          type="color"
                          value={announcement.textColor}
                          onChange={(e) => setAnnouncement({ ...announcement, textColor: e.target.value.toUpperCase() })}
                        />
                        <input
                          type="text"
                          value={announcement.textColor}
                          onChange={(e) => setAnnouncement({ ...announcement, textColor: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prévia da barra */}
                  <div style={{ marginTop: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#557268', textTransform: 'uppercase' }}>
                      Prévia da Barra:
                    </span>
                    <div
                      style={{
                        marginTop: 6,
                        padding: '10px 16px',
                        borderRadius: 8,
                        backgroundColor: announcement.bgColor,
                        color: announcement.textColor,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {announcement.text || 'Digite o texto acima para visualizar aqui.'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* BANNERS PRINCIPAIS DA HOME */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#123026' }}>
                  Banners em Destaque da Home ({banners.length})
                </h4>
                <button
                  type="button"
                  className="csm-btn-secondary"
                  onClick={handleAdicionarBanner}
                >
                  <Plus size={15} /> Adicionar Banner
                </button>
              </div>

              {!banners.length ? (
                <div style={{ padding: 24, textAlign: 'center', border: '1px dashed #cfe0d6', borderRadius: 12, color: '#557268' }}>
                  <ImageIcon size={32} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Nenhum banner cadastrado ainda.</p>
                  <small>Clique no botão acima para adicionar um banner promocional à página inicial da loja.</small>
                </div>
              ) : (
                banners.map((b, idx) => (
                  <div key={b.id || idx} className="csm-banner-item">
                    <div style={{ flex: 1, display: 'grid', gap: 10 }}>
                      <div className="csm-grid-2">
                        <div className="csm-field-group">
                          <label>Título do Banner</label>
                          <input
                            type="text"
                            value={b.title}
                            onChange={(e) => handleAtualizarBanner(b.id, 'title', e.target.value)}
                            placeholder="Título Chamativo"
                          />
                        </div>
                        <div className="csm-field-group">
                          <label>Subtítulo / Descrição</label>
                          <input
                            type="text"
                            value={b.subtitle}
                            onChange={(e) => handleAtualizarBanner(b.id, 'subtitle', e.target.value)}
                            placeholder="Breve descrição da promoção"
                          />
                        </div>
                      </div>

                      <div className="csm-grid-3">
                        <div className="csm-field-group">
                          <label>URL da Imagem do Banner</label>
                          <input
                            type="url"
                            value={b.imageUrl}
                            onChange={(e) => handleAtualizarBanner(b.id, 'imageUrl', e.target.value)}
                            placeholder="https://.../banner.jpg"
                          />
                        </div>
                        <div className="csm-field-group">
                          <label>Link de Destino</label>
                          <input
                            type="text"
                            value={b.linkUrl}
                            onChange={(e) => handleAtualizarBanner(b.id, 'linkUrl', e.target.value)}
                            placeholder="#catalogo ou /loja"
                          />
                        </div>
                        <div className="csm-field-group">
                          <label>Texto do Botão CTA</label>
                          <input
                            type="text"
                            value={b.ctaText}
                            onChange={(e) => handleAtualizarBanner(b.id, 'ctaText', e.target.value)}
                            placeholder="Ver Ofertas"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoverBanner(b.id)}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          color: '#dc2626',
                          padding: '10px',
                          borderRadius: 10,
                          cursor: 'pointer'
                        }}
                        title="Excluir banner"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* SELOS DE CONFIANÇA */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#123026' }}>
                  Selos de Confiança &amp; Garantia ({badges.length})
                </h4>
                <button
                  type="button"
                  className="csm-btn-secondary"
                  onClick={handleAdicionarBadge}
                >
                  <Plus size={15} /> Adicionar Selo
                </button>
              </div>

              <div className="csm-grid-2">
                {badges.map((bg) => (
                  <div
                    key={bg.id}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #d4e5dc',
                      borderRadius: 12,
                      background: '#fcfdfd',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: '#123026' }}>{bg.title}</strong>
                      <button
                        type="button"
                        onClick={() => handleRemoverBadge(bg.id)}
                        style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={bg.title}
                      onChange={(e) => handleAtualizarBadge(bg.id, 'title', e.target.value)}
                      placeholder="Título do Selo"
                      style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d4e3dc', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={bg.description}
                      onChange={(e) => handleAtualizarBadge(bg.id, 'description', e.target.value)}
                      placeholder="Descrição explicativa curta"
                      style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d4e3dc', fontSize: 12 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="csm-btn-primary"
                disabled={salvando || !canWrite}
              >
                <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar Vitrine & Banners'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── SUB-ABA 3: REDE DE LOJAS FÍSICAS & RETIRADA (CLICK & COLLECT) ──── */}
      {subtab === 'unidades' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Rede de Lojas Físicas &amp; Ponto de Retirada (Click &amp; Collect)</h3>
              <p>
                Integração das unidades físicas com a loja online para permitir que o cliente compre pela web e retire
                imediatamente no balcão sem pagar frete.
              </p>
            </div>
            <button
              type="button"
              className="csm-btn-secondary"
              onClick={() => onNavigateTab?.('dominios')}
            >
              <Store size={15} /> Cadastrar Nova Unidade
            </button>
          </header>

          <form onSubmit={handleSalvarTudo}>
            {/* RETIRADA NA LOJA ONLINE */}
            <div className="csm-pickup-callout">
              <Truck size={24} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>Retirada no Local Ativa no Checkout da Loja</strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={pickup.enabled}
                      onChange={(e) => setPickup({ ...pickup, enabled: e.target.checked })}
                    />
                    Habilitar Retirada em Loja
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                  Ao habilitar a retirada, os clientes poderão escolher a opção "Retirar na Loja" sem custo de frete no
                  checkout e receberão as instruções para buscar o pedido na unidade física.
                </p>
              </div>
            </div>

            {pickup.enabled && (
              <div className="csm-grid-2" style={{ marginBottom: 28 }}>
                <div className="csm-field-group">
                  <label>Tempo Estimado de Separação (Horas)</label>
                  <select
                    value={pickup.leadTimeHours}
                    onChange={(e) => setPickup({ ...pickup, leadTimeHours: Number(e.target.value) })}
                  >
                    <option value={1}>Pronto em 1 hora</option>
                    <option value={2}>Pronto em 2 horas</option>
                    <option value={4}>Pronto em 4 horas</option>
                    <option value={12}>Pronto em 12 horas</option>
                    <option value={24}>Pronto em até 24 horas (1 dia útil)</option>
                    <option value={48}>Pronto em até 48 horas (2 dias úteis)</option>
                  </select>
                  <span className="csm-hint">Tempo para a equipe da loja física separar os itens e notificar o cliente.</span>
                </div>

                <div className="csm-field-group">
                  <label>Instruções para o Cliente na Retirada</label>
                  <textarea
                    rows={3}
                    value={pickup.instructions}
                    onChange={(e) => setPickup({ ...pickup, instructions: e.target.value })}
                    placeholder="Ex: Apresente o código do pedido e um documento com foto no balcão de atendimento."
                    maxLength={500}
                  />
                  <span className="csm-hint">Aparece na tela de confirmação do pedido e no WhatsApp do cliente.</span>
                </div>
              </div>
            )}

            {/* ENDEREÇO E HORÁRIO DA UNIDADE PRINCIPAL */}
            <h4 style={{ margin: '24px 0 12px 0', fontSize: 16, fontWeight: 800, color: '#123026' }}>
              Endereço Físico do Ponto de Retirada Principal
            </h4>

            <div className="csm-grid-3" style={{ marginBottom: 16 }}>
              <div className="csm-field-group">
                <label>Rua / Logradouro</label>
                <input
                  type="text"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  placeholder="Ex: Rua Avelina Jaci Bohn"
                />
              </div>
              <div className="csm-field-group">
                <label>Número</label>
                <input
                  type="text"
                  value={address.number}
                  onChange={(e) => setAddress({ ...address, number: e.target.value })}
                  placeholder="Ex: 80 W"
                />
              </div>
              <div className="csm-field-group">
                <label>Complemento</label>
                <input
                  type="text"
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  placeholder="Ex: Sala 02 / Centro"
                />
              </div>
            </div>

            <div className="csm-grid-3" style={{ marginBottom: 16 }}>
              <div className="csm-field-group">
                <label>Bairro</label>
                <input
                  type="text"
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                  placeholder="Ex: Centro"
                />
              </div>
              <div className="csm-field-group">
                <label>Cidade</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Ex: Tangará da Serra"
                />
              </div>
              <div className="csm-field-group">
                <label>Estado (UF) e CEP</label>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="MT"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={address.postalCode}
                    onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="78300-000"
                  />
                </div>
              </div>
            </div>

            <div className="csm-field-group" style={{ marginBottom: 28 }}>
              <label>Horário de Atendimento da Loja Física</label>
              <input
                type="text"
                value={address.hours}
                onChange={(e) => setAddress({ ...address, hours: e.target.value })}
                placeholder="Ex: Segunda a Sexta: 08h às 19h | Sábado: 08h às 14h"
              />
              <span className="csm-hint">Exibido no rodapé da loja online para consulta dos clientes.</span>
            </div>

            {/* LISTA DAS UNIDADES FÍSICAS DA REDE */}
            <h4 style={{ margin: '28px 0 14px 0', fontSize: 16, fontWeight: 800, color: '#123026' }}>
              Unidades &amp; Filiais Físicas Cadastradas no Sistema ({unidadesFisicas.length})
            </h4>

            {carregandoUnidades ? (
              <p>Carregando unidades da empresa…</p>
            ) : !unidadesFisicas.length ? (
              <p style={{ color: '#557268' }}>Nenhuma unidade física adicional cadastrada.</p>
            ) : (
              <div className="csm-grid-2">
                {unidadesFisicas.map((u) => (
                  <div key={u.id} className="csm-unidade-card">
                    <div className="csm-unidade-header">
                      <div>
                        <h5 className="csm-unidade-title">{u.nome_fantasia || u.nome}</h5>
                        <small style={{ color: '#557268', fontWeight: 600 }}>Código: {u.codigo}</small>
                      </div>
                      <span className={`csm-status-pill ${u.ativa !== false ? 'active' : 'paused'}`}>
                        {u.ativa !== false ? 'Unidade Ativa' : 'Inativa'}
                      </span>
                    </div>

                    <div className="csm-unidade-meta">
                      <span>
                        <MapPin size={14} color="#2e7d32" />{' '}
                        {u.endereco_cidade || u.cidade ? `${u.endereco_cidade || u.cidade} - ${u.endereco_estado || u.estado || 'MT'}` : 'Endereço não preenchido'}
                      </span>
                      {u.telefone && (
                        <span>
                          <Phone size={14} color="#2e7d32" /> {u.telefone}
                        </span>
                      )}
                      {u.cnpj && (
                        <span>
                          <Building2 size={14} color="#2e7d32" /> CNPJ: {u.cnpj}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="csm-btn-primary"
                disabled={salvando || !canWrite}
              >
                <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar Unidades & Retirada'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── SUB-ABA 4: CANAIS DE ATENDIMENTO, WHATSAPP & PIXELS ────────────── */}
      {subtab === 'atendimento' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Canais de Atendimento, Social Commerce &amp; Pixels</h3>
              <p>Configure o contato direto via WhatsApp, redes sociais da loja e chaves de rastreamento de anúncios (Meta / Google).</p>
            </div>
          </header>

          <form onSubmit={handleSalvarTudo}>
            <div className="csm-grid-2" style={{ marginBottom: 20 }}>
              <div className="csm-field-group">
                <label>WhatsApp Oficial da Loja</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="tel"
                    value={contact.whatsapp}
                    onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                    placeholder="+55 65 99336-0000"
                  />
                  {contact.whatsapp && (
                    <a
                      href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                        'Olá! Vim da loja online e gostaria de tirar uma dúvida.'
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="csm-btn-secondary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <MessageSquare size={14} /> Testar Chat
                    </a>
                  )}
                </div>
                <span className="csm-hint">Permite aos clientes tirarem dúvidas direto com um atendente via WhatsApp.</span>
              </div>

              <div className="csm-field-group">
                <label>Instagram Oficial da Loja</label>
                <input
                  type="text"
                  value={contact.instagram}
                  onChange={(e) => setContact({ ...contact, instagram: e.target.value })}
                  placeholder="@suamarca ou https://instagram.com/..."
                />
                <span className="csm-hint">Link direto para seu perfil e vitrine do Instagram Shopping.</span>
              </div>
            </div>

            <div className="csm-grid-2" style={{ marginBottom: 28 }}>
              <div className="csm-field-group">
                <label>E-mail do SAC / Atendimento</label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="sac@suamarca.com.br"
                />
                <span className="csm-hint">Recebe notificações e dúvidas de pedidos dos clientes.</span>
              </div>

              <div className="csm-field-group">
                <label>Telefone Fixo / PABX</label>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="(65) 3326-0000"
                />
                <span className="csm-hint">Exibido no rodapé para atendimento telefônico.</span>
              </div>
            </div>

            <h4 style={{ margin: '24px 0 12px 0', fontSize: 16, fontWeight: 800, color: '#123026' }}>
              Métricas, Pixels &amp; Rastreamento de Tráfego Pago
            </h4>

            <div className="csm-grid-2" style={{ marginBottom: 24 }}>
              <div className="csm-field-group">
                <label>Meta Pixel ID (Facebook &amp; Instagram Ads)</label>
                <input
                  type="text"
                  value={tracking.metaPixelId}
                  onChange={(e) => setTracking({ ...tracking, metaPixelId: e.target.value })}
                  placeholder="Ex: 1234567890123456"
                />
                <span className="csm-hint">Rastreia visualizações de produto, adições ao carrinho e compras para remarketing.</span>
              </div>

              <div className="csm-field-group">
                <label>Google Analytics 4 (Measurement ID)</label>
                <input
                  type="text"
                  value={tracking.gaMeasurementId}
                  onChange={(e) => setTracking({ ...tracking, gaMeasurementId: e.target.value })}
                  placeholder="Ex: G-XXXXXXXXXX"
                />
                <span className="csm-hint">Métricas avançadas de conversão, páginas visitadas e público-alvo no GA4.</span>
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="csm-btn-primary"
                disabled={salvando || !canWrite}
              >
                <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar Atendimento & Pixels'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── SUB-ABA 5: POLÍTICAS DA LOJA, SEGURANÇA & SEO ─────────────────── */}
      {subtab === 'politicas' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Políticas da Loja, Termos Oficiais &amp; SEO</h3>
              <p>
                Links para páginas aprovadas da loja exigidas por lei (CDC e LGPD) e meta tags para indexação no Google.
              </p>
            </div>
          </header>

          <form onSubmit={handleSalvarTudo}>
            <div className="csm-grid-2" style={{ marginBottom: 20 }}>
              <div className="csm-field-group">
                <label>Política de Privacidade (LGPD)</label>
                <input
                  type="url"
                  value={policies.privacyUrl}
                  onChange={(e) => setPolicies({ ...policies, privacyUrl: e.target.value })}
                  placeholder="https://suamarca.com.br/privacidade"
                />
              </div>

              <div className="csm-field-group">
                <label>Trocas e Devoluções (CDC)</label>
                <input
                  type="url"
                  value={policies.returnsUrl}
                  onChange={(e) => setPolicies({ ...policies, returnsUrl: e.target.value })}
                  placeholder="https://suamarca.com.br/trocas"
                />
              </div>
            </div>

            <div className="csm-grid-2" style={{ marginBottom: 28 }}>
              <div className="csm-field-group">
                <label>Prazos de Entrega e Envio</label>
                <input
                  type="url"
                  value={policies.shippingUrl}
                  onChange={(e) => setPolicies({ ...policies, shippingUrl: e.target.value })}
                  placeholder="https://suamarca.com.br/entrega"
                />
              </div>

              <div className="csm-field-group">
                <label>Termos e Condições de Uso</label>
                <input
                  type="url"
                  value={policies.termsUrl}
                  onChange={(e) => setPolicies({ ...policies, termsUrl: e.target.value })}
                  placeholder="https://suamarca.com.br/termos"
                />
              </div>
            </div>

            <h4 style={{ margin: '24px 0 12px 0', fontSize: 16, fontWeight: 800, color: '#123026' }}>
              Otimização para Buscadores (Google SEO) &amp; Compartilhamento
            </h4>

            <div className="csm-grid-2" style={{ marginBottom: 20 }}>
              <div className="csm-field-group">
                <label>Título para Motores de Busca (Meta Title)</label>
                <input
                  type="text"
                  value={seo.metaTitle}
                  onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })}
                  placeholder="Ex: Barbearia Dino | Loja Oficial de Cosméticos e Pomadas"
                  maxLength={120}
                />
                <span className="csm-hint">Aparece na aba do navegador e no título dos resultados do Google.</span>
              </div>

              <div className="csm-field-group">
                <label>Imagem para Compartilhamento (OpenGraph Image)</label>
                <input
                  type="url"
                  value={seo.ogImage}
                  onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
                  placeholder="https://.../preview.jpg"
                />
                <span className="csm-hint">Imagem que aparece quando você compartilha o link no WhatsApp ou redes sociais.</span>
              </div>
            </div>

            <div className="csm-field-group" style={{ marginBottom: 24 }}>
              <label>Descrição para Buscadores (Meta Description)</label>
              <textarea
                rows={2}
                value={seo.metaDescription}
                onChange={(e) => setSeo({ ...seo, metaDescription: e.target.value })}
                placeholder="Ex: Compre cosméticos masculinos, pomadas, tônicos e óleos de barba oficiais da Barbearia Dino com entrega rápida ou retirada na unidade."
                maxLength={300}
              />
              <span className="csm-hint">Resumo de 1 a 2 linhas exibido abaixo do título no Google.</span>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="csm-btn-primary"
                disabled={salvando || !canWrite}
              >
                <Save size={15} /> {salvando ? 'Salvando…' : 'Salvar Políticas & SEO'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── SUB-ABA 6: GOVERNANÇA DE STOREFRONTS & DOMÍNIOS ───────────────── */}
      {subtab === 'storefronts' && (
        <section className="csm-panel">
          <header className="csm-panel-header">
            <div>
              <h3>Canais de Venda, Storefronts &amp; Domínios</h3>
              <p>
                Gerencie todos os canais e storefronts registrados na empresa. Você pode ativar canais públicos e
                conectar domínios personalizados.
              </p>
            </div>
            <button
              type="button"
              className="csm-btn-primary"
              onClick={onCreateStorefront}
            >
              <Plus size={15} /> Criar Novo Canal
            </button>
          </header>

          <div className="commerce-storefront-grid">
            {storefronts.map((storefront) => (
              <article
                className={`commerce-storefront-card ${storefront.id === storefrontId ? 'active' : ''}`}
                key={storefront.id}
                style={{
                  border: storefront.id === storefrontId ? '2px solid #2e7d32' : '1px solid #dce8e1'
                }}
              >
                <header>
                  <div>
                    <span className={`commerce-storefront-status ${storefront.status}`}>
                      {storefront.status === 'active' ? 'Ativo' : storefront.status === 'paused' ? 'Pausado' : 'Rascunho'}
                    </span>
                    <h3>{storefront.nome}</h3>
                    <small>
                      {storefront.codigo} · {storefront.loja_nome || 'Tenant sem unidade vinculada'}
                    </small>
                  </div>
                  <div className="ecommerce-admin-header-actions">
                    <button
                      type="button"
                      className="ecommerce-admin-button ghost"
                      onClick={() => {
                        onSelectStorefront?.(storefront);
                      }}
                    >
                      {storefront.id === storefrontId ? 'Canal Ativo' : 'Selecionar'}
                    </button>
                    {storefront.status !== 'active' && (
                      <button
                        type="button"
                        className="ecommerce-admin-button primary"
                        onClick={() => onActivateStorefront?.(storefront)}
                      >
                        Ativar canal
                      </button>
                    )}
                  </div>
                </header>

                {storefrontActivationTarget?.id === storefront.id && (
                  <div className="commerce-storefront-activation" role="alert">
                    <div>
                      <strong>Confirmar ativação pública</strong>
                      <span>
                        O alias e o checkout deste canal poderão responder publicamente. Revise o catálogo e as formas
                        de atendimento antes de divulgar a URL.
                      </span>
                    </div>
                    <div className="ecommerce-admin-header-actions">
                      <button
                        type="button"
                        className="ecommerce-admin-button ghost"
                        onClick={() => setStorefrontActivationTarget?.(null)}
                        disabled={storefrontActivationLoading}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="ecommerce-admin-button primary"
                        onClick={activateStorefront}
                        disabled={storefrontActivationLoading}
                      >
                        {storefrontActivationLoading ? 'Ativando…' : 'Confirmar ativação'}
                      </button>
                    </div>
                  </div>
                )}

                <p>
                  {storefront.canal || 'web'} · {storefront.moeda || 'BRL'} · {storefront.timezone || 'America/Sao_Paulo'}
                </p>

                <div className="commerce-storefront-meta">
                  <span>
                    <b>Unidade</b>
                    {storefront.loja_codigo || 'Sem unidade'}
                  </span>
                  <span>
                    <b>Atualizado</b>
                    {storefront.atualizado_em ? fmtDate(storefront.atualizado_em) : '—'}
                  </span>
                  <span>
                    <b>Domínio</b>
                    {(storefront.dominios || []).some((domain) => domain.status === 'verified')
                      ? 'Verificado'
                      : 'Pendente'}
                  </span>
                </div>

                <div className="commerce-storefront-card-stats">
                  <span>
                    <strong>{storefront.produtos_publicados || 0}</strong> produtos publicados
                  </span>
                  <span>
                    <strong>{storefront.pedidos || 0}</strong> pedidos
                  </span>
                </div>

                <div className="commerce-storefront-domains">
                  <Globe2 size={14} />
                  {(storefront.dominios || []).length ? (
                    storefront.dominios.map((domain) => (
                      <span key={domain.id} className={domain.status}>
                        {domain.dominio}
                        {domain.principal ? ' · principal' : ''}
                      </span>
                    ))
                  ) : (
                    <span>Sem domínio customizado</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
