/**
 * Auth Store — Zustand
 * Gerencia autenticação, tenant e perfil do usuário
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiMobile } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  tenant: null,
  token: null,
  loading: true,

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      const tenantStr = await AsyncStorage.getItem('tenant');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr), tenant: tenantStr ? JSON.parse(tenantStr) : null, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  login: async (email, senha) => {
    const res = await apiMobile.post('/api/auth/login', { email, senha });
    await AsyncStorage.setItem('token', res.token);
    await AsyncStorage.setItem('user', JSON.stringify(res.usuario));
    if (res.tenant) await AsyncStorage.setItem('tenant', JSON.stringify(res.tenant));
    set({ token: res.token, user: res.usuario, tenant: res.tenant });
    return res;
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['token', 'user', 'tenant']);
    set({ user: null, token: null, tenant: null });
  },
}));
