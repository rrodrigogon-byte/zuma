/**
 * Login Screen — SetPoint Ultra Mobile
 */
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/authStore';

const C = { bg: '#0f1117', card: '#22263a', green: '#5fb335', muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248', red: '#e05c5c' };

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !senha) return Alert.alert('Atenção', 'Preencha e-mail e senha');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), senha);
    } catch (e) {
      Alert.alert('Erro ao entrar', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        {/* Logo */}
        <View style={s.logoArea}>
          <Text style={s.logoEmoji}>🎾</Text>
          <Text style={s.logoTitle}>SetPoint Ultra</Text>
          <Text style={s.logoSub}>ERP Modular Brasil</Text>
        </View>

        {/* Formulário */}
        <View style={s.form}>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.label}>Senha</Text>
          <TextInput
            style={s.input}
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••"
            placeholderTextColor={C.muted}
            secureTextEntry
          />
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>SetPoint Ultra v3.0 · © 2026</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 8 },
  logoTitle: { fontSize: 28, fontWeight: '900', color: C.cream },
  logoSub: { fontSize: 13, color: C.muted, marginTop: 4 },
  form: { backgroundColor: C.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.line },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1a1d27', borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, color: C.cream, fontSize: 15, marginBottom: 16 },
  btn: { backgroundColor: C.green, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footer: { textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 32 },
});
