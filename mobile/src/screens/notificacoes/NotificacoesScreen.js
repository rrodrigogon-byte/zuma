/**
 * Notificações — SetPoint Ultra Mobile
 * Alertas internos, push notifications e central de avisos
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27', purple: '#9b59b6' };

const TIPO_CONFIG = {
  agendamento: { icon: '📅', cor: C.blue, label: 'Agendamento' },
  pagamento: { icon: '💰', cor: C.green, label: 'Pagamento' },
  estoque: { icon: '📦', cor: C.yellow, label: 'Estoque' },
  vencimento: { icon: '⚠️', cor: C.red, label: 'Vencimento' },
  sistema: { icon: '⚙️', cor: C.muted, label: 'Sistema' },
  crediario: { icon: '💳', cor: C.purple, label: 'Crediário' },
  os: { icon: '🔧', cor: C.yellow, label: 'Oficina' },
};

export default function NotificacoesScreen() {
  const [notifs, setNotifs] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const data = await apiMobile.get('/api/v1/notificacoes');
      setNotifs(Array.isArray(data) ? data : mockNotifs());
    } catch {
      setNotifs(mockNotifs());
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  useEffect(() => { carregar(); }, [carregar]);

  const marcarLida = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    await apiMobile.patch(`/api/v1/notificacoes/${id}/lida`).catch(() => {});
  };

  const marcarTodasLidas = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
    await apiMobile.post('/api/v1/notificacoes/marcar-todas-lidas').catch(() => {});
  };

  const naoLidas = notifs.filter(n => !n.lida).length;
  const filtradas = filtro === 'todas' ? notifs : filtro === 'nao-lidas' ? notifs.filter(n => !n.lida) : notifs.filter(n => n.tipo === filtro);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>🔔 Notificações</Text>
          {naoLidas > 0 && <Text style={s.headerSub}>{naoLidas} não lida{naoLidas > 1 ? 's' : ''}</Text>}
        </View>
        {naoLidas > 0 && (
          <TouchableOpacity onPress={marcarTodasLidas} style={s.lerTudoBtn}>
            <Text style={s.lerTudoText}>Ler todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {[{ id: 'todas', label: 'Todas' }, { id: 'nao-lidas', label: `Não lidas (${naoLidas})` }, ...Object.entries(TIPO_CONFIG).map(([id, v]) => ({ id, label: v.label }))].map(f => (
          <TouchableOpacity key={f.id} onPress={() => setFiltro(f.id)} style={[s.filtroBtn, filtro === f.id && s.filtroBtnAtivo]}>
            <Text style={[s.filtroLabel, filtro === f.id && s.filtroLabelAtivo]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {filtradas.map(n => {
          const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.sistema;
          return (
            <TouchableOpacity key={n.id} onPress={() => marcarLida(n.id)} style={[s.notifCard, !n.lida && s.notifNaoLida]}>
              <View style={[s.notifIconBox, { backgroundColor: `${cfg.cor}22` }]}>
                <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[s.notifTitulo, !n.lida && { color: C.cream }]}>{n.titulo}</Text>
                  {!n.lida && <View style={s.badgeNaoLida} />}
                </View>
                <Text style={s.notifMsg}>{n.mensagem}</Text>
                <Text style={s.notifTempo}>{formatarTempo(n.criado_em)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {filtradas.length === 0 && (
          <View style={s.vazio}>
            <Text style={{ fontSize: 40 }}>🔕</Text>
            <Text style={s.vazioText}>Nenhuma notificação</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatarTempo(data) {
  if (!data) return '';
  const diff = Date.now() - new Date(data).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(data).toLocaleDateString('pt-BR');
}

function mockNotifs() {
  return [
    { id: 1, tipo: 'agendamento', titulo: 'Novo agendamento', mensagem: 'Carlos Silva agendou Corte + Barba para hoje às 14:30', lida: false, criado_em: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: 2, tipo: 'estoque', titulo: 'Estoque crítico', mensagem: 'Pomada Modeladora restam apenas 2 unidades', lida: false, criado_em: new Date(Date.now() - 30 * 60000).toISOString() },
    { id: 3, tipo: 'crediario', titulo: 'Parcela vencendo', mensagem: 'Ana Oliveira — parcela 3/6 vence amanhã (R$ 150,00)', lida: false, criado_em: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 4, tipo: 'pagamento', titulo: 'Pagamento recebido', mensagem: 'Venda #1047 — R$ 85,00 via PIX confirmado', lida: true, criado_em: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 5, tipo: 'os', titulo: 'OS aprovada', mensagem: 'Cliente João aprovou orçamento da OS #0042 — R$ 1.200,00', lida: true, criado_em: new Date(Date.now() - 24 * 3600000).toISOString() },
    { id: 6, tipo: 'vencimento', titulo: 'Lote vencendo', mensagem: 'Produto "Leite Integral" lote #L2024-08 vence em 3 dias', lida: false, criado_em: new Date(Date.now() - 6 * 3600000).toISOString() },
  ];
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { fontSize: 18, fontWeight: '900', color: C.cream },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  lerTudoBtn: { padding: 8 },
  lerTudoText: { color: C.green, fontWeight: '700', fontSize: 13 },
  filtroBar: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line, maxHeight: 52 },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface },
  filtroBtnAtivo: { backgroundColor: C.green },
  filtroLabel: { fontSize: 11, color: C.muted, fontWeight: '700' },
  filtroLabelAtivo: { color: '#fff' },
  notifCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line },
  notifNaoLida: { borderColor: C.green + '44', backgroundColor: C.surface },
  notifIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifTitulo: { fontSize: 13, fontWeight: '700', color: C.muted, flex: 1 },
  notifMsg: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 18 },
  notifTempo: { fontSize: 10, color: C.muted, marginTop: 6 },
  badgeNaoLida: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 3 },
  vazio: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vazioText: { color: C.muted, fontSize: 15 },
});
