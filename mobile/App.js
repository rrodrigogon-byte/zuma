/**
 * SetPoint Ultra — App Mobile
 * React Native + Expo
 * Navegação principal com tabs e stacks
 */
import { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from './src/store/authStore';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import HomeScreen from './src/screens/home/HomeScreen';
import AgendaScreen from './src/screens/agendamento/AgendaScreen';
import NovoAgendamentoScreen from './src/screens/agendamento/NovoAgendamentoScreen';
import PDVScreen from './src/screens/pdv/PDVScreen';
import CupomScreen from './src/screens/pdv/CupomScreen';
import CrediarioScreen from './src/screens/crediario/CrediarioScreen';
import CarneScreen from './src/screens/crediario/CarneScreen';
import NotificacoesScreen from './src/screens/notificacoes/NotificacoesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const COLORS = {
  bg: '#0f1117', card: '#22263a', green: '#5fb335',
  muted: '#8a8fa8', cream: '#e8e6df', line: '#2e3248',
};

function AgendaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.cream, headerTitleStyle: { fontWeight: '800' } }}>
      <Stack.Screen name="AgendaList" component={AgendaScreen} options={{ title: 'Agenda' }} />
      <Stack.Screen name="NovoAgendamento" component={NovoAgendamentoScreen} options={{ title: 'Novo Agendamento' }} />
    </Stack.Navigator>
  );
}

function PDVStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.cream, headerTitleStyle: { fontWeight: '800' } }}>
      <Stack.Screen name="PDVMain" component={PDVScreen} options={{ title: 'Frente de Caixa' }} />
      <Stack.Screen name="Cupom" component={CupomScreen} options={{ title: 'Cupom Fiscal' }} />
    </Stack.Navigator>
  );
}

function CrediarioStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.cream, headerTitleStyle: { fontWeight: '800' } }}>
      <Stack.Screen name="CrediarioList" component={CrediarioScreen} options={{ title: 'Crediário' }} />
      <Stack.Screen name="Carne" component={CarneScreen} options={{ title: 'Carnê' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.line, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color }) => {
          const icons = { Home: '🏠', Agenda: '📅', PDV: '🛒', Crediario: '💳', Notificacoes: '🔔' };
          return <View style={{ marginTop: 4 }}><Text style={{ fontSize: 20 }}>{icons[route.name]}</Text></View>;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Agenda" component={AgendaStack} options={{ title: 'Agenda' }} />
      <Tab.Screen name="PDV" component={PDVStack} options={{ title: 'PDV' }} />
      <Tab.Screen name="Crediario" component={CrediarioStack} options={{ title: 'Crediário' }} />
      <Tab.Screen name="Notificacoes" component={NotificacoesScreen} options={{ title: 'Avisos' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { user, loading, checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <NavigationContainer theme={{
        dark: true,
        colors: { primary: COLORS.green, background: COLORS.bg, card: COLORS.card, text: COLORS.cream, border: COLORS.line, notification: COLORS.green },
      }}>
        {user ? <MainTabs /> : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

// Importação necessária para o Text no tabBarIcon
import { Text } from 'react-native';
