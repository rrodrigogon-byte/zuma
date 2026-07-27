/**
 * Agenda Screen — SetPoint Ultra Mobile
 * Visualização e gestão de agendamentos
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27' };

const STATUS_COR = { confirmado: C.green, aguardando: C.yellow, cancelado: C.red, concluido: C.muted, em_atendimento: C.blue };
const STATUS_LABEL = { confirmado: 'Confirmado', aguardando: 'Aguardando', cancelado: 'Cancelado', concluido: 'Concluído', em_atendimento: 'Em Atendimento' };

export default function AgendaScreen({ navigation }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSel, setDataSel] = useState(new Date().toISOString().split('T')[0]);

  const carregar = useCallback(async () => {
    try {
      const r = await apiMobile.get(`/api/v1/barbearia/agendamentos?data=${dataSel}`);
      setAgendamentos(Array.isArray(r) ? r : []);
    } catch { setAgendamentos([]); }
  }, [dataSel]);

  const onRefresh = async () => { setRefreshing(true); await carregar(); setRefreshing(false); };
  useEffect(() => { carregar(); }, [carregar]);

  const alterarStatus = async (id, novoStatus) => {
    try {
      await apiMobile.patch(`/api/v1/barbearia/agendamentos/${id}/status`, { status: novoStatus });
      carregar();
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  // Gerar 7 dias para seleção
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i - 1);
    return { iso: d.toISOString().split('T')[0], label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }) };
  });

  return (
    <View style={s.container}>
      {/* Seletor de data */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.datePicker} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {dias.map(d => (
          <TouchableOpacity key={d.iso} onPress={() => setDataSel(d.iso)} style={[s.dateBtn, dataSel === d.iso && s.dateBtnAtivo]}>
            <Text style={[s.dateBtnText, dataSel === d.iso && s.dateBtnTextAtivo]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista de agendamentos */}
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {agendamentos.length === 0 ? (
          <View style={s.vazio}>
            <Text style={{ fontSize: 40 }}>📅</Text>
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>Nenhum agendamento para este dia</Text>
          </View>
        ) : agendamentos.map(ag => (
          <View key={ag.id} style={[s.card, { borderLeftColor: STATUS_COR[ag.status] || C.muted }]}>
            <View style={s.cardHeader}>
              <View>
                <Text style={s.cardNome}>{ag.cliente_nome}</Text>
                <Text style={s.cardServico}>{ag.servico} · {ag.profissional}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.cardHorario}>{ag.horario}</Text>
                <View style={[s.statusBadge, { backgroundColor: `${STATUS_COR[ag.status]}22` }]}>
                  <Text style={[s.statusText, { color: STATUS_COR[ag.status] }]}>{STATUS_LABEL[ag.status]}</Text>
                </View>
              </View>
            </View>
            {ag.status === 'confirmado' && (
              <View style={s.acoes}>
                <TouchableOpacity style={[s.acaoBtn, { borderColor: C.blue }]} onPress={() => alterarStatus(ag.id, 'em_atendimento')}>
                  <Text style={[s.acaoBtnText, { color: C.blue }]}>▶ Iniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.acaoBtn, { borderColor: C.red }]} onPress={() => alterarStatus(ag.id, 'cancelado')}>
                  <Text style={[s.acaoBtnText, { color: C.red }]}>✕ Cancelar</Text>
                </TouchableOpacity>
              </View>
            )}
            {ag.status === 'em_atendimento' && (
              <TouchableOpacity style={[s.acaoBtn, { borderColor: C.green, marginTop: 10 }]} onPress={() => alterarStatus(ag.id, 'concluido')}>
                <Text style={[s.acaoBtnText, { color: C.green }]}>✓ Concluir</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('NovoAgendamento')}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  datePicker: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 12, maxHeight: 60 },
  dateBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface },
  dateBtnAtivo: { backgroundColor: C.green },
  dateBtnText: { fontSize: 11, color: C.muted, fontWeight: '700' },
  dateBtnTextAtivo: { color: '#fff' },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNome: { fontSize: 14, fontWeight: '800', color: C.cream },
  cardServico: { fontSize: 11, color: C.muted, marginTop: 2 },
  cardHorario: { fontSize: 18, fontWeight: '900', color: C.green },
  statusBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acaoBtn: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  acaoBtnText: { fontSize: 12, fontWeight: '700' },
  vazio: { alignItems: 'center', paddingTop: 60 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
