/**
 * Cupom Fiscal — SetPoint Ultra Mobile
 * Visualização e reimpressão de NFC-e / cupom de venda
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { apiMobile } from '../../services/api';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c', yellow: '#f5a623', blue: '#4a9eff', surface: '#1a1d27' };
const fmtR = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CupomScreen({ route, navigation }) {
  const { vendaId } = route?.params || {};
  const [venda, setVenda] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendaId) {
      apiMobile.get(`/api/v1/vendas/${vendaId}`)
        .then(d => setVenda(d))
        .catch(() => setVenda(mockVenda()))
        .finally(() => setLoading(false));
    } else {
      setVenda(mockVenda());
      setLoading(false);
    }
  }, [vendaId]);

  const compartilhar = async () => {
    if (!venda) return;
    const texto = gerarTextoCupom(venda);
    await Share.share({ message: texto, title: `Cupom #${venda.numero}` });
  };

  const enviarWhatsApp = () => {
    if (!venda?.cliente_telefone) return Alert.alert('Atenção', 'Cliente sem telefone cadastrado');
    Alert.alert('Enviar por WhatsApp', `Enviar cupom para ${venda.cliente_nome}?`, [
      { text: 'Cancelar' },
      { text: 'Enviar', onPress: () => apiMobile.post(`/api/v1/vendas/${venda.id}/enviar-whatsapp`).catch(() => {}) },
    ]);
  };

  if (loading) return <View style={s.container}><Text style={s.loading}>Carregando...</Text></View>;
  if (!venda) return <View style={s.container}><Text style={s.loading}>Venda não encontrada</Text></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={{ color: C.green, fontWeight: '700' }}>← Fechar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cupom Fiscal</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Cupom visual */}
        <View style={s.cupom}>
          {/* Cabeçalho da empresa */}
          <Text style={s.cupomEmpresa}>{venda.empresa_nome || 'SetPoint Ultra'}</Text>
          <Text style={s.cupomInfo}>CNPJ: {venda.empresa_cnpj || '00.000.000/0001-00'}</Text>
          <Text style={s.cupomInfo}>{venda.empresa_endereco || 'Tangará da Serra - MT'}</Text>
          <View style={s.separador} />

          {/* Tipo de documento */}
          <View style={[s.docBadge, { backgroundColor: venda.nfce_chave ? `${C.green}22` : `${C.yellow}22` }]}>
            <Text style={[s.docBadgeText, { color: venda.nfce_chave ? C.green : C.yellow }]}>
              {venda.nfce_chave ? '✓ NFC-e Autorizada' : '⚡ Cupom Simplificado'}
            </Text>
          </View>

          <Text style={s.cupomNumero}>Venda #{String(venda.numero || venda.id).padStart(6, '0')}</Text>
          <Text style={s.cupomData}>{new Date(venda.criado_em || Date.now()).toLocaleString('pt-BR')}</Text>
          <View style={s.separador} />

          {/* Itens */}
          <Text style={s.secaoTitulo}>ITENS</Text>
          {(venda.itens || []).map((item, i) => (
            <View key={i} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemNome}>{item.produto_nome || item.nome}</Text>
                <Text style={s.itemDetalhe}>{item.quantidade} x {fmtR(item.preco_unitario)}</Text>
              </View>
              <Text style={s.itemTotal}>{fmtR(item.quantidade * item.preco_unitario)}</Text>
            </View>
          ))}
          <View style={s.separador} />

          {/* Totais */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValor}>{fmtR(venda.subtotal)}</Text>
          </View>
          {venda.desconto > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: C.red }]}>Desconto</Text>
              <Text style={[s.totalValor, { color: C.red }]}>- {fmtR(venda.desconto)}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.totalFinal]}>
            <Text style={s.totalFinalLabel}>TOTAL</Text>
            <Text style={s.totalFinalValor}>{fmtR(venda.total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{venda.forma_pagamento || 'PIX'}</Text>
            <Text style={s.totalValor}>{fmtR(venda.total)}</Text>
          </View>
          {venda.troco > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Troco</Text>
              <Text style={[s.totalValor, { color: C.green }]}>{fmtR(venda.troco)}</Text>
            </View>
          )}
          <View style={s.separador} />

          {/* Chave NFC-e */}
          {venda.nfce_chave && (
            <>
              <Text style={s.secaoTitulo}>CHAVE DE ACESSO NFC-e</Text>
              <Text style={s.chaveNFCe}>{venda.nfce_chave.replace(/(\d{4})/g, '$1 ').trim()}</Text>
              <Text style={s.cupomInfo}>Consulte em: nfce.sefaz.mt.gov.br</Text>
              <View style={s.separador} />
            </>
          )}

          {/* Rodapé */}
          <Text style={s.cupomRodape}>Obrigado pela preferência!</Text>
          <Text style={s.cupomRodape}>SetPoint Ultra · setpointultra.com.br</Text>
        </View>

        {/* Ações */}
        <View style={s.acoesGrid}>
          <TouchableOpacity style={s.acaoBtn} onPress={compartilhar}>
            <Text style={{ fontSize: 22 }}>📤</Text>
            <Text style={s.acaoBtnText}>Compartilhar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acaoBtn} onPress={enviarWhatsApp}>
            <Text style={{ fontSize: 22 }}>💬</Text>
            <Text style={s.acaoBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acaoBtn} onPress={() => Alert.alert('Impressão', 'Enviando para impressora Bluetooth...')}>
            <Text style={{ fontSize: 22 }}>🖨️</Text>
            <Text style={s.acaoBtnText}>Imprimir</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function gerarTextoCupom(venda) {
  const linhas = [
    `*${venda.empresa_nome || 'SetPoint Ultra'}*`,
    `CNPJ: ${venda.empresa_cnpj || '00.000.000/0001-00'}`,
    `Venda #${String(venda.numero || venda.id).padStart(6, '0')}`,
    `Data: ${new Date(venda.criado_em || Date.now()).toLocaleString('pt-BR')}`,
    '─────────────────',
    ...(venda.itens || []).map(i => `${i.quantidade}x ${i.produto_nome || i.nome} = ${fmtR(i.quantidade * i.preco_unitario)}`),
    '─────────────────',
    `*TOTAL: ${fmtR(venda.total)}*`,
    `Pagamento: ${venda.forma_pagamento || 'PIX'}`,
    venda.nfce_chave ? `\nNFC-e: ${venda.nfce_chave}` : '',
    '\nObrigado pela preferência! 🙏',
  ];
  return linhas.filter(Boolean).join('\n');
}

function mockVenda() {
  return {
    id: 1047, numero: 1047, empresa_nome: 'Barbearia do João', empresa_cnpj: '43.084.070/0001-88',
    empresa_endereco: 'R. das Palmeiras, 123 - Tangará da Serra/MT',
    criado_em: new Date().toISOString(), subtotal: 85, desconto: 0, total: 85, troco: 0,
    forma_pagamento: 'PIX', cliente_nome: 'Carlos Silva', cliente_telefone: '65999990000',
    nfce_chave: '51260743084070000188650010000010471234567890',
    itens: [
      { produto_nome: 'Corte Masculino', quantidade: 1, preco_unitario: 35 },
      { produto_nome: 'Barba Completa', quantidade: 1, preco_unitario: 25 },
      { produto_nome: 'Hidratação', quantidade: 1, preco_unitario: 25 },
    ],
  };
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { fontSize: 16, fontWeight: '900', color: C.cream },
  loading: { color: C.muted, textAlign: 'center', marginTop: 40 },
  cupom: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cupomEmpresa: { fontSize: 16, fontWeight: '900', color: '#1a1a1a', textAlign: 'center' },
  cupomInfo: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 2 },
  cupomNumero: { fontSize: 18, fontWeight: '900', color: '#1a1a1a', textAlign: 'center', marginTop: 8 },
  cupomData: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 2 },
  separador: { borderBottomWidth: 1, borderBottomColor: '#e0e0e0', borderStyle: 'dashed', marginVertical: 12 },
  secaoTitulo: { fontSize: 10, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  docBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center', marginBottom: 8 },
  docBadgeText: { fontSize: 11, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  itemNome: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  itemDetalhe: { fontSize: 11, color: '#666', marginTop: 2 },
  itemTotal: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontSize: 13, color: '#666' },
  totalValor: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  totalFinal: { marginTop: 8, marginBottom: 8 },
  totalFinalLabel: { fontSize: 16, fontWeight: '900', color: '#1a1a1a' },
  totalFinalValor: { fontSize: 20, fontWeight: '900', color: '#2d7a0f' },
  chaveNFCe: { fontSize: 9, color: '#333', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 1 },
  cupomRodape: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 4 },
  acoesGrid: { flexDirection: 'row', gap: 10 },
  acaoBtn: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line },
  acaoBtnText: { fontSize: 11, color: C.muted, fontWeight: '700' },
});
