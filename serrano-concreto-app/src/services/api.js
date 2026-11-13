// Cliente de API Real do Sistema de Concreto e Torre de Pesagem Serrano CCO
const API_BASE = '/api/concreto-torre';

function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  try {
    const token = localStorage.getItem('token') || (new URLSearchParams(window.location.search)).get('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {}
  return headers;
}

export async function getBalancaStatus() {
  try {
    const res = await fetch(`${API_BASE}/balanca/status`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha na leitura da balança ao vivo:', e.message);
    return null;
  }
}

export async function enviarComandoBalanca(comando, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/balanca/comando`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ comando, payload })
    });
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha no comando da balança:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function getTickets() {
  try {
    const res = await fetch(`${API_BASE}/balanca/tickets`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tickets || data || [];
  } catch (e) {
    console.warn('[Torre API] Falha ao buscar tickets:', e.message);
    return [];
  }
}

export async function criarTicket(ticketData) {
  try {
    const res = await fetch(`${API_BASE}/balanca/tickets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(ticketData)
    });
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao criar ticket:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function registrarEntradaVeiculo(dados) {
  try {
    const res = await fetch(`${API_BASE}/balanca/entrada`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dados)
    });
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao registrar entrada:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function registrarSaidaVeiculo(dados) {
  try {
    const res = await fetch(`${API_BASE}/balanca/saida`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dados)
    });
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao registrar saída:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function getSilosSuprimentos() {
  try {
    const res = await fetch(`${API_BASE}/suprimentos-silos`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao buscar dados de silos:', e.message);
    return null;
  }
}

export async function getNotasFiscais() {
  try {
    const res = await fetch(`${API_BASE}/vendas/notas`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notas || data || [];
  } catch (e) {
    console.warn('[Torre API] Falha ao buscar notas fiscais:', e.message);
    return [];
  }
}

export async function emitirNotaFiscal(payload) {
  try {
    const res = await fetch(`${API_BASE}/vendas/emitir-nota`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao emitir nota fiscal:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function consultarKyttoIA(pergunta, contexto = {}) {
  try {
    const res = await fetch(`${API_BASE}/ia/consultar`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pergunta, contexto })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao consultar KyttoIA:', e.message);
    return null;
  }
}

export async function getTelemetriaCelulas(pesoKg = 12920) {
  try {
    const res = await fetch(`${API_BASE}/balanca/celulas/telemetria?peso=${pesoKg}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao ler telemetria das células:', e.message);
    return null;
  }
}

export async function getDadosGerais() {
  try {
    const res = await fetch(`${API_BASE}/dados`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[Torre API] Falha ao ler dados gerais:', e.message);
    return null;
  }
}
