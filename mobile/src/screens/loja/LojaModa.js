/**
 * Loja de Moda — SetPoint Ultra Mobile
 * Grade Cor×Tamanho, Crediário, Condicional (malinha), Vale-Presente
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, FlatList } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27', purple: '#9b59b6' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const ABAS = [
  { id: 'grade', icon: '👗', label: 'Grade' },
  { id: 'crediario', icon: '💳', label: 'Crediário' },
  { id: 'condicional', icon: '👜', label: 'Malinha' },
  { id: 'vale', icon: '🎁', label: 'Vale-Presente' },
];

const CORES = ['Preto', 'Branco', 'Azul', 'Vermelho', 'Verde', 'Rosa', 'Amarelo', 'Cinza', 'Marrom', 'Bege'];
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG', '34', '36', '38', '40', '42', '44', '46'];

export default function LojaModa() {
  const [aba, setAba] = useState('grade');
  const [produtos, setProdutos] = useState([]);
  const [contas, setContas] = useState([]);
  const [condicionais, setCondicionais] = useState([]);
  const [busca, setBusca] = useState('');
  const [modalGrade, setModalGrade] = useState(null);
  const [modalNovaVenda, setModalNovaVenda] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [p, c, cond] = await Promise.all([
        apiMobile.get('/api/v1/loja-moda/produtos?limite=50'),
        apiMobile.get('/api/v1/crediario/contas?status=aberta'),
        apiMobile.get('/api/v1/loja-moda/condicionais?status=ativo'),
      ]);
      setProdutos(Array.isArray(p) ? p : []);
      setContas(Array.isArray(c) ? c : []);
      setCondicionais(Array.isArray(cond) ? cond : []);
    } catch { }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const produtosFiltrados = produtos.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.referencia?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>👗 Loja de Moda</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => setModalNovaVenda(true)}>
          <Text style={s.headerBtnText}>+ Venda</Text>
        </TouchableOpacity>
      </View>

      {/* Abas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {ABAS.map(a => (
          <TouchableOpacity key={a.id} onPress={() => setAba(a.id)} style={[s.tab, aba === a.id && s.tabAtivo]}>
            <Text style={{ fontSize: 16 }}>{a.icon}</Text>
            <Text style={[s.tabLabel, aba === a.id && s.tabLabelAtivo]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Aba Grade ─────────────────────────────────────────────────── */}
      {aba === 'grade' && (
        <View style={{ flex: 1 }}>
          <View style={s.buscaRow}>
            <TextInput
              style={s.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar produto ou referência..."
              placeholderTextColor={C.muted}
            />
          </View>
          <FlatList
            data={produtosFiltrados}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.produtoCard} onPress={() => setModalGrade(item)}>
                <View style={s.produtoInfo}>
                  <Text style={s.produtoNome}>{item.nome}</Text>
                  <Text style={s.produtoRef}>Ref: {item.referencia || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.produtoPreco}>{fmtR(item.preco_venda)}</Text>
                  <Text style={s.produtoEstoque}>{item.estoque_total || 0} un.</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.vazio}>Nenhum produto encontrado</Text>}
          />
        </View>
      )}

      {/* ── Aba Crediário ─────────────────────────────────────────────── */}
      {aba === 'crediario' && (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          <View style={s.resumoCard}>
            <Text style={s.resumoTitulo}>💳 Contas Abertas</Text>
            <Text style={s.resumoValor}>{contas.length} contas</Text>
          </View>
          {contas.map(c => (
            <View key={c.id} style={s.contaCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.contaNome}>{c.cliente_nome}</Text>
                <Text style={s.contaDesc}>{c.descricao}</Text>
                <Text style={s.contaInfo}>{c.parcelas_pagas}/{c.total_parcelas} parcelas · Dia {c.dia_vencimento}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.contaSaldo}>{fmtR(c.saldo_devedor)}</Text>
                <Text style={s.contaSaldoLabel}>saldo</Text>
              </View>
            </View>
          ))}
          {contas.length === 0 && <Text style={s.vazio}>Nenhuma conta aberta</Text>}
        </ScrollView>
      )}

      {/* ── Aba Condicional (Malinha) ──────────────────────────────────── */}
      {aba === 'condicional' && (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          <View style={s.resumoCard}>
            <Text style={s.resumoTitulo}>👜 Malinh as Ativas</Text>
            <Text style={s.resumoValor}>{condicionais.length} saídas</Text>
          </View>
          {condicionais.map(c => {
            const vencida = new Date(c.data_retorno) < new Date();
            return (
              <View key={c.id} style={[s.condCard, vencida && { borderColor: C.red }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.contaNome}>{c.cliente_nome}</Text>
                  <Text style={s.contaInfo}>{c.total_pecas} peças · {fmtR(c.valor_total)}</Text>
                  <Text style={[s.contaInfo, vencida && { color: C.red, fontWeight: '700' }]}>
                    {vencida ? '⚠️ VENCIDA — ' : '📅 '}Retorno: {new Date(c.data_retorno + 'T12:00').toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <TouchableOpacity style={s.retornoBtn} onPress={() => Alert.alert('Registrar Retorno', `Registrar retorno da malinha de ${c.cliente_nome}?`, [{ text: 'Cancelar' }, { text: 'Confirmar', onPress: () => { } }])}>
                  <Text style={s.retornoBtnText}>Retorno</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {condicionais.length === 0 && <Text style={s.vazio}>Nenhuma malinha ativa</Text>}
        </ScrollView>
      )}

      {/* ── Aba Vale-Presente ─────────────────────────────────────────── */}
      {aba === 'vale' && (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
          <Text style={s.sectionTitle}>🎁 Emitir Vale-Presente</Text>
          <View style={s.valeGrid}>
            {[50, 100, 150, 200, 300, 500].map(v => (
              <TouchableOpacity key={v} style={s.valeCard} onPress={() => Alert.alert('Vale-Presente', `Emitir vale de ${fmtR(v)}?\nInforme o nome do presenteado:`, [{ text: 'Cancelar' }, { text: 'Emitir', onPress: () => { } }])}>
                <Text style={s.valeValor}>{fmtR(v)}</Text>
                <Text style={s.valeLabel}>Toque para emitir</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.valeCustom}>
            <Text style={s.valeCustomText}>+ Valor personalizado</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Modal: Grade Cor×Tamanho ──────────────────────────────────── */}
      <Modal visible={!!modalGrade} animationType="slide" presentationStyle="pageSheet">
        {modalGrade && <GradeModal produto={modalGrade} onClose={() => setModalGrade(null)} />}
      </Modal>
    </View>
  );
}

function GradeModal({ produto, onClose }) {
  const [grade, setGrade] = useState({});
  const [corSel, setCorSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiMobile.get(`/api/v1/loja-moda/produtos/${produto.id}/grade`)
      .then(g => {
        setGrade(g || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [produto.id]);

  const coresDisp = Object.keys(grade);
  const tamanhosDisp = corSel ? Object.keys(grade[corSel] || {}) : [];

  const adicionarAoCarrinho = (tamanho) => {
    const estoque = grade[corSel]?.[tamanho] || 0;
    if (estoque <= 0) return Alert.alert('Sem estoque', `${produto.nome} ${corSel} ${tamanho} sem estoque`);
    Alert.alert('✅ Adicionado!', `${produto.nome}\nCor: ${corSel} | Tam: ${tamanho}\nPreço: ${fmtR(produto.preco_venda)}`);
    onClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.modalHeader}>
        <View>
          <Text style={s.modalTitulo}>{produto.nome}</Text>
          <Text style={s.modalSub}>{fmtR(produto.preco_venda)} · Ref: {produto.referencia || '—'}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.modalClose}>
          <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <Text style={s.vazio}>Carregando grade...</Text>
        ) : (
          <>
            <Text style={s.gradeLabel}>Selecione a Cor:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {coresDisp.length > 0 ? coresDisp.map(cor => (
                  <TouchableOpacity key={cor} onPress={() => setCorSel(cor)} style={[s.corBtn, corSel === cor && s.corBtnAtivo]}>
                    <Text style={[s.corBtnText, corSel === cor && { color: '#fff' }]}>{cor}</Text>
                  </TouchableOpacity>
                )) : CORES.slice(0, 5).map(cor => (
                  <TouchableOpacity key={cor} onPress={() => setCorSel(cor)} style={[s.corBtn, corSel === cor && s.corBtnAtivo]}>
                    <Text style={[s.corBtnText, corSel === cor && { color: '#fff' }]}>{cor}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {corSel && (
              <>
                <Text style={s.gradeLabel}>Selecione o Tamanho:</Text>
                <View style={s.tamGrid}>
                  {(tamanhosDisp.length > 0 ? tamanhosDisp : TAMANHOS.slice(0, 8)).map(tam => {
                    const estoque = grade[corSel]?.[tam] || 0;
                    const semEstoque = estoque === 0;
                    return (
                      <TouchableOpacity key={tam} onPress={() => adicionarAoCarrinho(tam)} disabled={semEstoque}
                        style={[s.tamBtn, semEstoque && s.tamBtnSemEstoque]}>
                        <Text style={[s.tamBtnText, semEstoque && { color: C.muted }]}>{tam}</Text>
                        {!semEstoque && <Text style={s.tamEstoque}>{estoque}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { fontSize: 18, fontWeight: '900', color: C.cream },
  headerBtn: { backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  headerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tabBar: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line, maxHeight: 56 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: C.surface },
  tabAtivo: { backgroundColor: C.green },
  tabLabel: { fontSize: 12, color: C.muted, fontWeight: '700' },
  tabLabelAtivo: { color: '#fff' },
  buscaRow: { padding: 12, backgroundColor: C.card },
  buscaInput: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, color: C.cream, fontSize: 14 },
  produtoCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  produtoInfo: { flex: 1 },
  produtoNome: { fontSize: 14, fontWeight: '700', color: C.cream },
  produtoRef: { fontSize: 11, color: C.muted, marginTop: 2 },
  produtoPreco: { fontSize: 15, fontWeight: '900', color: C.green },
  produtoEstoque: { fontSize: 11, color: C.muted, marginTop: 2 },
  resumoCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  resumoTitulo: { fontSize: 14, fontWeight: '700', color: C.cream },
  resumoValor: { fontSize: 20, fontWeight: '900', color: C.green },
  contaCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  contaNome: { fontSize: 14, fontWeight: '700', color: C.cream },
  contaDesc: { fontSize: 11, color: C.muted, marginTop: 2 },
  contaInfo: { fontSize: 11, color: C.muted, marginTop: 2 },
  contaSaldo: { fontSize: 16, fontWeight: '900', color: C.green },
  contaSaldoLabel: { fontSize: 10, color: C.muted },
  condCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line },
  retornoBtn: { backgroundColor: C.blue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  retornoBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  valeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  valeCard: { width: '30%', backgroundColor: C.card, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  valeValor: { fontSize: 16, fontWeight: '900', color: C.green },
  valeLabel: { fontSize: 9, color: C.muted, marginTop: 4, textAlign: 'center' },
  valeCustom: { backgroundColor: C.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.green, borderStyle: 'dashed' },
  valeCustomText: { color: C.green, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.cream },
  vazio: { textAlign: 'center', color: C.muted, padding: 40, fontSize: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  modalTitulo: { fontSize: 18, fontWeight: '900', color: C.cream },
  modalSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  modalClose: { padding: 8 },
  gradeLabel: { fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 10, textTransform: 'uppercase' },
  corBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  corBtnAtivo: { backgroundColor: C.purple, borderColor: C.purple },
  corBtnText: { fontSize: 12, color: C.muted, fontWeight: '700' },
  tamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tamBtn: { width: 64, height: 64, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  tamBtnSemEstoque: { opacity: 0.3 },
  tamBtnText: { fontSize: 14, fontWeight: '800', color: C.cream },
  tamEstoque: { fontSize: 9, color: C.green, marginTop: 2 },
});
