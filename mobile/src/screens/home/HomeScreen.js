/**
 * Home Screen — SetPoint Ultra Mobile
 * Dashboard com KPIs do dia e atalhos rápidos
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function HomeScreen({ navigation }) {
  const { user, tenant, logout } = useAuthStore();
  const [kpis, setKpis] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [k, a] = await Promise.all([
        apiMobile.get('/api/bi/dashboard?periodo=hoje'),
        apiMobile.get('/api/v1/alertas'),
      ]);
      setKpis(k);
      setAlertas(Array.isArray(a) ? a.slice(0, 5) : []);
    } catch {
      // Dados mock para demonstração
      setKpis({ vendas_hoje: 4820.50, ticket_medio: 67.0, clientes_ativos: 23, saldo_caixa: 12400 });
    }
  }, []);

  const onRefresh = async () => { setRefreshing(true); await carregar(); setRefreshing(false); };
  useEffect(() => { carregar(); }, [carregar]);

  const atalhos = [
    { icon: '🛒', label: 'PDV', onPress: () => navigation.navigate('PDV') },
    { icon: '📅', label: 'Agenda', onPress: () => navigation.navigate('Agenda') },
    { icon: '💳', label: 'Crediário', onPress: () => navigation.navigate('Crediario') },
    { icon: '🔔', label: 'Avisos', onPress: () => navigation.navigate('Notificacoes') },
  ];

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>Bom dia,</Text>
          <Text style={s.headerTitle}>{user?.nome?.split(' ')[0] || 'Usuário'} 👋</Text>
          {tenant && <Text style={s.headerTenant}>{tenant.nome}</Text>}
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Sair', 'Deseja sair do app?', [{ text: 'Cancelar' }, { text: 'Sair', onPress: logout }])}>
          <Text style={{ fontSize: 24 }}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* KPIs do dia */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>📊 Resumo de Hoje</Text>
        <View style={s.kpiGrid}>
          {[
            { label: 'Vendas', valor: fmtR(kpis?.vendas_hoje), cor: C.green, icon: '💰' },
            { label: 'Ticket Médio', valor: fmtR(kpis?.ticket_medio), cor: C.blue, icon: '🎫' },
            { label: 'Clientes', valor: kpis?.clientes_ativos || '—', cor: C.yellow, icon: '👥' },
            { label: 'Saldo Caixa', valor: fmtR(kpis?.saldo_caixa), cor: C.green, icon: '🏦' },
          ].map((k, i) => (
            <View key={i} style={[s.kpiCard, { borderLeftColor: k.cor }]}>
              <Text style={s.kpiIcon}>{k.icon}</Text>
              <Text style={[s.kpiValor, { color: k.cor }]}>{k.valor}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Atalhos rápidos */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>⚡ Acesso Rápido</Text>
        <View style={s.atalhoGrid}>
          {atalhos.map((a, i) => (
            <TouchableOpacity key={i} style={s.atalhoCard} onPress={a.onPress}>
              <Text style={s.atalhoIcon}>{a.icon}</Text>
              <Text style={s.atalhoLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Alertas */}
      {alertas.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>⚠️ Alertas</Text>
          {alertas.map((a, i) => (
            <View key={i} style={[s.alertaCard, { borderLeftColor: a.tipo === 'critico' ? C.red : C.yellow }]}>
              <Text style={s.alertaTexto}>{a.mensagem}</Text>
              <Text style={s.alertaData}>{a.criado_em}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Próximos agendamentos */}
      <View style={[s.section, { marginBottom: 32 }]}>
        <Text style={s.sectionTitle}>📅 Próximos Agendamentos</Text>
        <ProximosAgendamentos />
      </View>
    </ScrollView>
  );
}

function ProximosAgendamentos() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    apiMobile.get('/api/v1/barbearia/agendamentos?limite=5&futuro=true')
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(() => { });
  }, []);

  if (!items.length) return <Text style={{ color: '#8a8fa8', fontSize: 13, textAlign: 'center', padding: 16 }}>Nenhum agendamento próximo</Text>;

  return items.map((ag, i) => (
    <View key={i} style={{ backgroundColor: '#22263a', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 24 }}>✂️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#e8e6df', fontWeight: '700', fontSize: 13 }}>{ag.cliente_nome}</Text>
        <Text style={{ color: '#8a8fa8', fontSize: 11 }}>{ag.servico} · {ag.horario}</Text>
      </View>
      <Text style={{ color: '#5fb335', fontWeight: '800', fontSize: 12 }}>{ag.data}</Text>
    </View>
  ));
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerSub: { fontSize: 13, color: C.muted },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.cream },
  headerTenant: { fontSize: 11, color: C.green, marginTop: 2, fontWeight: '700' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.cream, marginBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  kpiIcon: { fontSize: 20, marginBottom: 6 },
  kpiValor: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  kpiLabel: { fontSize: 10, color: C.muted, fontWeight: '700', textTransform: 'uppercase' },
  atalhoGrid: { flexDirection: 'row', gap: 10 },
  atalhoCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  atalhoIcon: { fontSize: 28, marginBottom: 6 },
  atalhoLabel: { fontSize: 11, color: C.cream, fontWeight: '700' },
  alertaCard: { backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  alertaTexto: { fontSize: 12, color: C.cream, fontWeight: '600' },
  alertaData: { fontSize: 10, color: C.muted, marginTop: 3 },
});
