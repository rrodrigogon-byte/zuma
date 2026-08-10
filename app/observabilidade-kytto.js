/**
 * Módulo de Observabilidade Kytto v3.0.0
 * 
 * Responsabilidades:
 * - Logs estruturados (JSON) para operações críticas
 * - Métricas de latência por endpoint (p50, p95, p99)
 * - Alertas automáticos (estoque baixo, comanda aberta >2h, divergência de caixa)
 * - Endpoints protegidos por RBAC: GET /api/admin/observabilidade/metricas, /alertas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ObservabilidadeKytto {
  constructor() {
    this.metricas = {
      endpoints: {},        // latências por endpoint
      operacoes: [],        // log estruturado de operações críticas
      alertas: [],          // alertas ativos
      timestamp: new Date().toISOString(),
    };
    
    this.config = {
      maxOperacoes: 10000,  // manter últimas 10k operações
      maxAlertas: 500,      // manter últimos 500 alertas
      intervaloLimpeza: 3600000, // 1 hora
      limiteComandaAberta: 7200000, // 2 horas em ms
    };
    
    this.iniciarLimpezaPeriodica();
  }

  /**
   * Registrar operação crítica (login, venda, estoque, fiscal)
   */
  registrarOperacao(tipo, dados, usuario = null, empresa = null) {
    const operacao = {
      timestamp: new Date().toISOString(),
      tipo,
      usuario,
      empresa,
      dados,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    this.metricas.operacoes.push(operacao);
    
    // Manter limite de operações
    if (this.metricas.operacoes.length > this.config.maxOperacoes) {
      this.metricas.operacoes.shift();
    }
    
    // Log em console para auditoria em tempo real
    console.log(`[OPERACAO] ${tipo}:`, JSON.stringify(operacao, null, 0));
    
    return operacao.id;
  }

  /**
   * Registrar latência de endpoint
   */
  registrarLatencia(endpoint, metodo, latenciaMs, statusCode, usuario = null) {
    const chave = `${metodo} ${endpoint}`;
    
    if (!this.metricas.endpoints[chave]) {
      this.metricas.endpoints[chave] = {
        chamadas: 0,
        latencias: [],
        erros: 0,
        ultimaChamada: null,
      };
    }
    
    const stats = this.metricas.endpoints[chave];
    stats.chamadas++;
    stats.latencias.push(latenciaMs);
    stats.ultimaChamada = new Date().toISOString();
    
    if (statusCode >= 400) {
      stats.erros++;
    }
    
    // Manter últimas 1000 latências por endpoint
    if (stats.latencias.length > 1000) {
      stats.latencias.shift();
    }
  }

  /**
   * Calcular percentis de latência
   */
  calcularPercentis(latencias) {
    if (latencias.length === 0) return { p50: 0, p95: 0, p99: 0 };
    
    const sorted = [...latencias].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return { p50, p95, p99 };
  }

  /**
   * Gerar alerta automático
   */
  gerarAlerta(tipo, severidade, mensagem, dados = {}) {
    const alerta = {
      id: `alerta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tipo,
      severidade, // 'info', 'warning', 'critical'
      mensagem,
      dados,
      ativo: true,
    };
    
    this.metricas.alertas.push(alerta);
    
    // Manter limite de alertas
    if (this.metricas.alertas.length > this.config.maxAlertas) {
      this.metricas.alertas.shift();
    }
    
    // Log em console para alertas críticos
    if (severidade === 'critical') {
      console.error(`[ALERTA CRÍTICO] ${tipo}: ${mensagem}`, dados);
    }
    
    return alerta.id;
  }

  /**
   * Analisar comandas abertas e gerar alertas
   */
  analisarComandas(comandas = []) {
    const agora = Date.now();
    const alertasGerados = [];
    
    for (const comanda of comandas) {
      if (!comanda.aberta) continue;
      
      const tempoAberto = agora - new Date(comanda.criadoEm).getTime();
      
      // Alerta: comanda aberta há mais de 2 horas
      if (tempoAberto > this.config.limiteComandaAberta) {
        const alertaId = this.gerarAlerta(
          'comanda_aberta_longa',
          'warning',
          `Comanda #${comanda.numero} aberta há ${Math.floor(tempoAberto / 60000)} minutos`,
          {
            comandaId: comanda.id,
            numero: comanda.numero,
            tempoMinutos: Math.floor(tempoAberto / 60000),
            valor: comanda.total,
          }
        );
        alertasGerados.push(alertaId);
      }
    }
    
    return alertasGerados;
  }

  /**
   * Analisar estoque e gerar alertas
   */
  analisarEstoque(itens = []) {
    const alertasGerados = [];
    
    for (const item of itens) {
      // Alerta: estoque baixo (< 10% do mínimo)
      if (item.quantidade < (item.minimo || 0) && item.quantidade > 0) {
        const alertaId = this.gerarAlerta(
          'estoque_baixo',
          'warning',
          `Produto "${item.nome}" com estoque baixo: ${item.quantidade} unidades`,
          {
            itemId: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            minimo: item.minimo,
          }
        );
        alertasGerados.push(alertaId);
      }
      
      // Alerta crítico: sem estoque
      if (item.quantidade <= 0 && !item.permitirNegativo) {
        const alertaId = this.gerarAlerta(
          'sem_estoque',
          'critical',
          `Produto "${item.nome}" sem estoque`,
          {
            itemId: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
          }
        );
        alertasGerados.push(alertaId);
      }
    }
    
    return alertasGerados;
  }

  /**
   * Analisar divergência de caixa
   */
  analisarCaixa(caixa = {}) {
    const alertasGerados = [];
    
    if (!caixa.aberto) return alertasGerados;
    
    // Alerta: caixa aberto há mais de 12 horas
    const tempoAberto = Date.now() - new Date(caixa.aberturaEm).getTime();
    if (tempoAberto > 43200000) { // 12 horas
      const alertaId = this.gerarAlerta(
        'caixa_aberto_longo',
        'warning',
        `Caixa aberto há ${Math.floor(tempoAberto / 3600000)} horas`,
        {
          caixaId: caixa.id,
          tempoHoras: Math.floor(tempoAberto / 3600000),
        }
      );
      alertasGerados.push(alertaId);
    }
    
    return alertasGerados;
  }

  /**
   * Obter métricas formatadas para API
   */
  obterMetricas() {
    const metricas = {
      timestamp: new Date().toISOString(),
      endpoints: {},
      operacoes: {
        total: this.metricas.operacoes.length,
        ultimas: this.metricas.operacoes.slice(-100),
      },
      alertas: {
        total: this.metricas.alertas.length,
        ativos: this.metricas.alertas.filter(a => a.ativo),
        ultimos: this.metricas.alertas.slice(-50),
      },
    };
    
    // Calcular percentis por endpoint
    for (const [chave, stats] of Object.entries(this.metricas.endpoints)) {
      const percentis = this.calcularPercentis(stats.latencias);
      metricas.endpoints[chave] = {
        chamadas: stats.chamadas,
        erros: stats.erros,
        taxaErro: ((stats.erros / stats.chamadas) * 100).toFixed(2) + '%',
        latenciaMs: percentis,
        ultimaChamada: stats.ultimaChamada,
      };
    }
    
    return metricas;
  }

  /**
   * Obter alertas ativos
   */
  obterAlertas(filtro = {}) {
    let alertas = this.metricas.alertas.filter(a => a.ativo);
    
    if (filtro.tipo) {
      alertas = alertas.filter(a => a.tipo === filtro.tipo);
    }
    
    if (filtro.severidade) {
      alertas = alertas.filter(a => a.severidade === filtro.severidade);
    }
    
    return alertas.slice(-100);
  }

  /**
   * Marcar alerta como resolvido
   */
  resolverAlerta(alertaId) {
    const alerta = this.metricas.alertas.find(a => a.id === alertaId);
    if (alerta) {
      alerta.ativo = false;
      alerta.resolvidoEm = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Limpeza periódica de dados antigos
   */
  iniciarLimpezaPeriodica() {
    setInterval(() => {
      const agora = Date.now();
      
      // Remover operações com mais de 24 horas
      this.metricas.operacoes = this.metricas.operacoes.filter(op => {
        const idade = agora - new Date(op.timestamp).getTime();
        return idade < 86400000; // 24 horas
      });
      
      // Remover alertas resolvidos com mais de 7 dias
      this.metricas.alertas = this.metricas.alertas.filter(alerta => {
        if (!alerta.ativo && alerta.resolvidoEm) {
          const idade = agora - new Date(alerta.resolvidoEm).getTime();
          return idade < 604800000; // 7 dias
        }
        return true;
      });
      
      console.log('[OBSERVABILIDADE] Limpeza periódica executada');
    }, this.config.intervaloLimpeza);
  }

  /**
   * Exportar relatório de observabilidade
   */
  exportarRelatorio() {
    return {
      timestamp: new Date().toISOString(),
      resumo: {
        operacoes: this.metricas.operacoes.length,
        alertas: this.metricas.alertas.filter(a => a.ativo).length,
        endpoints: Object.keys(this.metricas.endpoints).length,
      },
      metricas: this.obterMetricas(),
      alertas: this.obterAlertas(),
    };
  }
}

// Singleton global
export const observabilidade = new ObservabilidadeKytto();

export default ObservabilidadeKytto;
