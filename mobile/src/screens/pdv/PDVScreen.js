/**
 * PDV Screen — SetPoint Ultra Mobile
 * Frente de caixa mobile com leitor de código de barras
 */
import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Vibration } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function PDVScreen({ navigation }) {
  const [itens, setItens] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [desconto, setDesconto] = useState('0');
  const [formaPgto, setFormaPgto] = useState('pix');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const descontoVal = parseFloat(desconto) || 0;
  const total = Math.max(0, subtotal - descontoVal);

  const buscarProduto = async () => {
    if (!codigo.trim()) return;
    setLoading(true);
    try {
      const p = await apiMobile.get(`/api/v1/pdv/produto?codigo=${codigo.trim()}`);
      const existente = itens.find(i => i.id === p.id);
      if (existente) {
        setItens(prev => prev.map(i => i.id === p.id ? { ...i, qtd: i.qtd + 1 } : i));
      } else {
        setItens(prev => [...prev, { ...p, qtd: 1 }]);
      }
      Vibration.vibrate(50);
      setCodigo('');
    } catch (e) {
      Alert.alert('Produto não encontrado', e.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const removerItem = (id) => setItens(prev => prev.filter(i => i.id !== id));
  const alterarQtd = (id, delta) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i).filter(i => i.qtd > 0));
  };

  const finalizarVenda = async () => {
    if (!itens.length) return Alert.alert('Atenção', 'Adicione pelo menos um item');
    setLoading(true);
    try {
      const venda = await apiMobile.post('/api/v1/pdv/venda', {
        itens: itens.map(i => ({ produto_id: i.id, quantidade: i.qtd, preco_unitario: i.preco })),
        desconto: descontoVal,
        forma_pagamento: formaPgto,
        total,
      });
      Alert.alert('✅ Venda Finalizada!', `Total: ${fmtR(total)}\nNúmero: #${venda.numero}`, [
        { text: 'Ver Cupom', onPress: () => navigation.navigate('Cupom', { vendaId: venda.id }) },
        { text: 'Nova Venda', onPress: () => { setItens([]); setDesconto('0'); } },
      ]);
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  };

  const FORMAS = [
    { v: 'pix', l: 'PIX', icon: '⚡' },
    { v: 'credito', l: 'Crédito', icon: '💳' },
    { v: 'debito', l: 'Débito', icon: '💳' },
    { v: 'dinheiro', l: 'Dinheiro', icon: '💵' },
  ];

  return (
    <View style={s.container}>
      {/* Campo de busca */}
      <View style={s.buscaArea}>
        <TextInput
          ref={inputRef}
          style={s.buscaInput}
          value={codigo}
          onChangeText={setCodigo}
          placeholder="Código de barras ou nome..."
          placeholderTextColor={C.muted}
          onSubmitEditing={buscarProduto}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={s.buscaBtn} onPress={buscarProduto}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de itens */}
      <ScrollView style={s.lista} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {itens.length === 0 ? (
          <View style={s.vazio}>
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={{ color: C.muted, marginTop: 12 }}>Escaneie ou busque um produto</Text>
          </View>
        ) : itens.map(item => (
          <View key={item.id} style={s.itemCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemNome}>{item.nome}</Text>
              <Text style={s.itemPreco}>{fmtR(item.preco)} × {item.qtd} = {fmtR(item.preco * item.qtd)}</Text>
            </View>
            <View style={s.qtdControle}>
              <TouchableOpacity style={s.qtdBtn} onPress={() => alterarQtd(item.id, -1)}>
                <Text style={s.qtdBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtdValor}>{item.qtd}</Text>
              <TouchableOpacity style={s.qtdBtn} onPress={() => alterarQtd(item.id, 1)}>
                <Text style={s.qtdBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removerItem(item.id)} style={{ padding: 8 }}>
              <Text style={{ color: C.red, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Rodapé com total e pagamento */}
      <View style={s.rodape}>
        <View style={s.descontoRow}>
          <Text style={s.descontoLabel}>Desconto (R$):</Text>
          <TextInput
            style={s.descontoInput}
            value={desconto}
            onChangeText={setDesconto}
            keyboardType="numeric"
            placeholder="0,00"
            placeholderTextColor={C.muted}
          />
        </View>

        {/* Formas de pagamento */}
        <View style={s.formasRow}>
          {FORMAS.map(f => (
            <TouchableOpacity key={f.v} onPress={() => setFormaPgto(f.v)} style={[s.formaBtn, formaPgto === f.v && s.formaBtnAtivo]}>
              <Text style={{ fontSize: 16 }}>{f.icon}</Text>
              <Text style={[s.formaBtnText, formaPgto === f.v && { color: '#fff' }]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>TOTAL</Text>
          <Text style={s.totalValor}>{fmtR(total)}</Text>
        </View>

        <TouchableOpacity style={[s.finalizarBtn, (!itens.length || loading) && s.finalizarBtnDisabled]} onPress={finalizarVenda} disabled={!itens.length || loading}>
          <Text style={s.finalizarBtnText}>{loading ? 'Processando...' : `✓ Finalizar — ${fmtR(total)}`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  buscaArea: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  buscaInput: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, color: C.cream, fontSize: 14 },
  buscaBtn: { backgroundColor: C.green, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', width: 48 },
  lista: { flex: 1 },
  vazio: { alignItems: 'center', paddingTop: 60 },
  itemCard: { backgroundColor: C.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemNome: { fontSize: 13, fontWeight: '700', color: C.cream },
  itemPreco: { fontSize: 11, color: C.muted, marginTop: 2 },
  qtdControle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtdBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  qtdBtnText: { color: C.cream, fontSize: 16, fontWeight: '800' },
  qtdValor: { fontSize: 14, fontWeight: '800', color: C.cream, minWidth: 24, textAlign: 'center' },
  rodape: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, padding: 16, gap: 10 },
  descontoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  descontoLabel: { fontSize: 13, color: C.muted, fontWeight: '700' },
  descontoInput: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8, color: C.cream, fontSize: 13, width: 100, textAlign: 'right' },
  formasRow: { flexDirection: 'row', gap: 8 },
  formaBtn: { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  formaBtnAtivo: { backgroundColor: C.green, borderColor: C.green },
  formaBtnText: { fontSize: 10, color: C.muted, fontWeight: '700', marginTop: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: C.muted, fontWeight: '800', textTransform: 'uppercase' },
  totalValor: { fontSize: 24, fontWeight: '900', color: C.green },
  finalizarBtn: { backgroundColor: C.green, borderRadius: 12, padding: 16, alignItems: 'center' },
  finalizarBtnDisabled: { opacity: 0.5 },
  finalizarBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
