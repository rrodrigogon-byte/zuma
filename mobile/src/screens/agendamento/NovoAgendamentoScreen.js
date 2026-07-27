/**
 * Novo Agendamento — SetPoint Ultra Mobile
 * Criação rápida de agendamento pelo operador
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function NovoAgendamentoScreen({ navigation }) {
  const [passo, setPasso] = useState(1); // 1=Serviço, 2=Profissional, 3=Data/Hora, 4=Cliente
  const [servicos, setServicos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [slots, setSlots] = useState([]);
  const [sel, setSel] = useState({ servico: null, profissional: null, data: null, hora: null });
  const [cliente, setCliente] = useState({ nome: '', telefone: '' });
  const [salvando, setSalvando] = useState(false);

  // Gerar próximos 14 dias
  const diasDisponiveis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    apiMobile.get('/api/v1/barbearia/servicos').then(d => setServicos(Array.isArray(d) ? d : mockServicos())).catch(() => setServicos(mockServicos()));
    apiMobile.get('/api/v1/barbearia/profissionais').then(d => setProfissionais(Array.isArray(d) ? d : mockProfs())).catch(() => setProfissionais(mockProfs()));
  }, []);

  useEffect(() => {
    if (sel.profissional && sel.data) {
      const dataStr = sel.data.toISOString().split('T')[0];
      apiMobile.get(`/api/v1/barbearia/slots?profissional_id=${sel.profissional.id}&data=${dataStr}&servico_id=${sel.servico?.id}`)
        .then(d => setSlots(Array.isArray(d) ? d : mockSlots()))
        .catch(() => setSlots(mockSlots()));
    }
  }, [sel.profissional, sel.data]);

  const salvar = async () => {
    if (!cliente.nome || !cliente.telefone) return Alert.alert('Atenção', 'Informe nome e telefone do cliente');
    setSalvando(true);
    try {
      await apiMobile.post('/api/v1/barbearia/agendamentos', {
        servico_id: sel.servico?.id,
        profissional_id: sel.profissional?.id,
        data: sel.data?.toISOString().split('T')[0],
        hora: sel.hora,
        cliente_nome: cliente.nome,
        cliente_telefone: cliente.telefone,
      });
      Alert.alert('✅ Agendado!', `${cliente.nome} agendado para ${sel.data?.toLocaleDateString('pt-BR')} às ${sel.hora}`, [{ text: 'OK', onPress: () => navigation?.goBack() }]);
    } catch (e) {
      Alert.alert('Erro', e.message || 'Erro ao agendar');
    } finally { setSalvando(false); }
  };

  const totalServico = sel.servico?.preco || 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => passo > 1 ? setPasso(p => p - 1) : navigation?.goBack()}>
          <Text style={{ color: C.green, fontSize: 16, fontWeight: '700' }}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Novo Agendamento</Text>
        <Text style={s.passoIndicador}>{passo}/4</Text>
      </View>

      {/* Barra de progresso */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${(passo / 4) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* ── Passo 1: Serviço ─────────────────────────────────────────── */}
        {passo === 1 && (
          <>
            <Text style={s.passoTitulo}>Qual serviço?</Text>
            <View style={{ gap: 10 }}>
              {servicos.map(sv => (
                <TouchableOpacity key={sv.id} onPress={() => { setSel(p => ({ ...p, servico: sv })); setPasso(2); }} style={[s.opcaoCard, sel.servico?.id === sv.id && s.opcaoCardSel]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoNome}>{sv.nome}</Text>
                    <Text style={s.opcaoInfo}>{sv.duracao_min} min</Text>
                  </View>
                  <Text style={s.opcaoPreco}>{fmtR(sv.preco)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Passo 2: Profissional ─────────────────────────────────────── */}
        {passo === 2 && (
          <>
            <Text style={s.passoTitulo}>Qual profissional?</Text>
            <TouchableOpacity onPress={() => { setSel(p => ({ ...p, profissional: { id: null, nome: 'Qualquer disponível' } })); setPasso(3); }} style={[s.opcaoCard, !sel.profissional?.id && sel.profissional && s.opcaoCardSel]}>
              <Text style={s.opcaoNome}>⚡ Qualquer disponível</Text>
            </TouchableOpacity>
            <View style={{ gap: 10, marginTop: 10 }}>
              {profissionais.map(p => (
                <TouchableOpacity key={p.id} onPress={() => { setSel(prev => ({ ...prev, profissional: p })); setPasso(3); }} style={[s.opcaoCard, sel.profissional?.id === p.id && s.opcaoCardSel]}>
                  <View style={s.profAvatar}>
                    <Text style={{ fontSize: 20 }}>💈</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoNome}>{p.nome}</Text>
                    <Text style={s.opcaoInfo}>{p.especialidades?.join(', ') || 'Todos os serviços'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Passo 3: Data e Hora ─────────────────────────────────────── */}
        {passo === 3 && (
          <>
            <Text style={s.passoTitulo}>Quando?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {diasDisponiveis.map((d, i) => {
                  const hoje = i === 0;
                  const sel_ = sel.data?.toDateString() === d.toDateString();
                  return (
                    <TouchableOpacity key={i} onPress={() => setSel(p => ({ ...p, data: d, hora: null }))} style={[s.diaBtn, sel_ && s.diaBtnSel]}>
                      <Text style={[s.diaNome, sel_ && { color: '#fff' }]}>{hoje ? 'Hoje' : DIAS_SEMANA[d.getDay()]}</Text>
                      <Text style={[s.diaDia, sel_ && { color: '#fff' }]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {sel.data && (
              <>
                <Text style={s.sectionLabel}>Horários disponíveis</Text>
                <View style={s.slotsGrid}>
                  {slots.map((slot, i) => (
                    <TouchableOpacity key={i} onPress={() => { setSel(p => ({ ...p, hora: slot.hora })); setPasso(4); }} disabled={!slot.disponivel}
                      style={[s.slotBtn, sel.hora === slot.hora && s.slotBtnSel, !slot.disponivel && s.slotBtnOcupado]}>
                      <Text style={[s.slotHora, sel.hora === slot.hora && { color: '#fff' }, !slot.disponivel && { color: C.muted }]}>{slot.hora}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── Passo 4: Dados do Cliente ─────────────────────────────────── */}
        {passo === 4 && (
          <>
            <Text style={s.passoTitulo}>Dados do cliente</Text>
            <View style={{ gap: 14 }}>
              <View>
                <Text style={s.inputLabel}>Nome *</Text>
                <TextInput style={s.input} value={cliente.nome} onChangeText={v => setCliente(p => ({ ...p, nome: v }))} placeholder="Nome completo" placeholderTextColor={C.muted} />
              </View>
              <View>
                <Text style={s.inputLabel}>WhatsApp *</Text>
                <TextInput style={s.input} value={cliente.telefone} onChangeText={v => setCliente(p => ({ ...p, telefone: v }))} placeholder="(65) 99999-9999" placeholderTextColor={C.muted} keyboardType="phone-pad" />
              </View>
            </View>

            {/* Resumo */}
            <View style={s.resumoBox}>
              <Text style={s.resumoTitulo}>Resumo</Text>
              {[
                { l: 'Serviço', v: sel.servico?.nome },
                { l: 'Profissional', v: sel.profissional?.nome },
                { l: 'Data', v: sel.data?.toLocaleDateString('pt-BR') },
                { l: 'Horário', v: sel.hora },
                { l: 'Valor', v: fmtR(totalServico) },
              ].map((r, i) => (
                <View key={i} style={s.resumoRow}>
                  <Text style={s.resumoLabel}>{r.l}</Text>
                  <Text style={s.resumoValor}>{r.v || '—'}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={salvar} disabled={salvando} style={[s.confirmarBtn, salvando && { opacity: 0.6 }]}>
              <Text style={s.confirmarBtnText}>{salvando ? 'Agendando...' : '✅ Confirmar Agendamento'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function mockServicos() {
  return [
    { id: 1, nome: 'Corte Masculino', preco: 35, duracao_min: 30 },
    { id: 2, nome: 'Barba', preco: 25, duracao_min: 20 },
    { id: 3, nome: 'Corte + Barba', preco: 55, duracao_min: 50 },
    { id: 4, nome: 'Hidratação', preco: 45, duracao_min: 40 },
  ];
}
function mockProfs() {
  return [
    { id: 1, nome: 'João Silva', especialidades: ['Corte', 'Barba'] },
    { id: 2, nome: 'Pedro Santos', especialidades: ['Corte', 'Coloração'] },
  ];
}
function mockSlots() {
  return ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'].map((h, i) => ({ hora: h, disponivel: i % 3 !== 1 }));
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { fontSize: 16, fontWeight: '900', color: C.cream },
  passoIndicador: { fontSize: 13, color: C.muted, fontWeight: '700' },
  progressBar: { height: 3, backgroundColor: C.surface },
  progressFill: { height: '100%', backgroundColor: C.green, borderRadius: 2 },
  passoTitulo: { fontSize: 20, fontWeight: '900', color: C.cream, marginBottom: 16 },
  opcaoCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  opcaoCardSel: { borderColor: C.green, backgroundColor: `${C.green}11` },
  opcaoNome: { fontSize: 15, fontWeight: '700', color: C.cream },
  opcaoInfo: { fontSize: 12, color: C.muted, marginTop: 2 },
  opcaoPreco: { fontSize: 16, fontWeight: '900', color: C.green },
  profAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  diaBtn: { width: 56, paddingVertical: 10, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  diaBtnSel: { backgroundColor: C.green, borderColor: C.green },
  diaNome: { fontSize: 10, color: C.muted, fontWeight: '700' },
  diaDia: { fontSize: 18, fontWeight: '900', color: C.cream, marginTop: 2 },
  sectionLabel: { fontSize: 12, color: C.muted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: { width: 72, paddingVertical: 10, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  slotBtnSel: { backgroundColor: C.green, borderColor: C.green },
  slotBtnOcupado: { opacity: 0.3 },
  slotHora: { fontSize: 13, fontWeight: '700', color: C.cream },
  inputLabel: { fontSize: 11, color: C.muted, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 13, color: C.cream, fontSize: 14 },
  resumoBox: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginTop: 20, marginBottom: 16, borderWidth: 1, borderColor: C.line },
  resumoTitulo: { fontSize: 14, fontWeight: '800', color: C.cream, marginBottom: 12 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  resumoLabel: { fontSize: 13, color: C.muted },
  resumoValor: { fontSize: 13, fontWeight: '700', color: C.cream },
  confirmarBtn: { backgroundColor: C.green, borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmarBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
