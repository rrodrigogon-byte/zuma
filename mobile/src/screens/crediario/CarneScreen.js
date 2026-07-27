/**
 * Carnê Screen — SetPoint Ultra Mobile
 * Visualização e pagamento de parcelas do crediário
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CarneScreen({ route }) {
  const { contaId } = route.params || {};
  const [carne, setCarne] = useState(null);

  const carregar = async () => {
    try {
      const r = await apiMobile.get(`/api/v1/crediario/contas/${contaId}/carne`);
      setCarne(r);
    } catch { }
  };

  useEffect(() => { if (contaId) carregar(); }, [contaId]);

  const pagar = async (parcela) => {
    Alert.prompt('Pagamento', `Valor atualizado: ${fmtR(parcela.valor_atualizado || parcela.valor)}\nInforme o valor pago:`,
      async (valorStr) => {
        if (!valorStr) return;
        try {
          await apiMobile.post(`/api/v1/crediario/parcelas/${parcela.id}/pagar`, {
            valor_pago: parseFloat(valorStr.replace(',', '.')),
            forma_pagamento: 'dinheiro',
          });
          Alert.alert('✅ Pagamento registrado!');
          carregar();
        } catch (e) { Alert.alert('Erro', e.message); }
      }, 'plain-text', String(parcela.valor_atualizado || parcela.valor)
    );
  };

  if (!carne) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.muted }}>Carregando...</Text></View>;

  const { conta, parcelas = [] } = carne;
  const pagas = parcelas.filter(p => p.status === 'paga').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* Cabeçalho do carnê */}
      <View style={s.header}>
        <Text style={s.clienteNome}>{conta.cliente_nome}</Text>
        <Text style={s.descricao}>{conta.descricao}</Text>
        <View style={s.progressRow}>
          <Text style={s.progressText}>{pagas}/{parcelas.length} parcelas pagas</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${(pagas / parcelas.length) * 100}%` }]} />
          </View>
        </View>
      </View>

      {/* Parcelas */}
      {parcelas.map(p => {
        const vencida = new Date(p.data_vencimento) < new Date() && p.status === 'aberta';
        const cor = p.status === 'paga' ? C.green : vencida ? C.red : C.blue;
        return (
          <View key={p.id} style={[s.parcelaCard, { borderLeftColor: cor }]}>
            <View style={s.parcelaInfo}>
              <View style={[s.numCircle, { backgroundColor: `${cor}22` }]}>
                <Text style={[s.numText, { color: cor }]}>{p.numero}</Text>
              </View>
              <View>
                <Text style={s.parcelaValor}>{fmtR(p.valor_atualizado || p.valor)}</Text>
                <Text style={s.parcelaVenc}>Vence: {new Date(p.data_vencimento + 'T12:00').toLocaleDateString('pt-BR')}</Text>
                {vencida && <Text style={{ color: C.red, fontSize: 10, fontWeight: '700' }}>{p.dias_atraso || '?'} dias em atraso</Text>}
              </View>
            </View>
            {p.status === 'paga' ? (
              <Text style={{ color: C.green, fontWeight: '800', fontSize: 12 }}>✓ Pago</Text>
            ) : (
              <TouchableOpacity style={[s.pagarBtn, { backgroundColor: cor }]} onPress={() => pagar(p)}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Pagar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: C.card, borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.line },
  clienteNome: { fontSize: 18, fontWeight: '900', color: C.cream },
  descricao: { fontSize: 12, color: C.muted, marginTop: 4 },
  progressRow: { marginTop: 12 },
  progressText: { fontSize: 11, color: C.muted, marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: C.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.green, borderRadius: 3 },
  parcelaCard: { backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parcelaInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numText: { fontWeight: '900', fontSize: 14 },
  parcelaValor: { fontSize: 15, fontWeight: '800', color: C.cream },
  parcelaVenc: { fontSize: 11, color: C.muted, marginTop: 2 },
  pagarBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
});
