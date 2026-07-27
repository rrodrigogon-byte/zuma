/**
 * API Service — Mobile
 * Axios com interceptor de token e tratamento de erros
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://192.168.1.100:3000'  // IP local em desenvolvimento
  : 'https://api.setpointultra.com.br';

export const apiMobile = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Interceptor: adiciona token em todas as requisições
apiMobile.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: trata erros de autenticação
apiMobile.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user', 'tenant']);
      // Forçar logout via store
    }
    throw new Error(err.response?.data?.error || err.response?.data?.erro || 'Erro de conexão');
  }
);
