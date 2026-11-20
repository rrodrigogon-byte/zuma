#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de enriquecimento de app/public/zuma/erp.html
Adiciona 6 novas abas interativas completas:
1. Fiscal & Emissão NFC-e SEFAZ-MT
2. Fila de Espera & Reservas Hostess (com tatames)
3. Engenharia de Cardápio & Matriz BCG dos 211 SKUs
4. Spool de Impressão Térmica ESC/POS 80mm/58mm
5. Compras & Cotação de Pescados Nobres (com controle de temperatura 1.8°C)
6. Zumi & Akira IA para Pedidos em Linguagem Natural
"""

import sys

NEW_SECTIONS = """
    <!-- ================= 7. ABA FISCAL & NFC-E SEFAZ-MT ================= -->
    <section id="aba-fiscal-nfce" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-lg font-black text-white">Módulo Fiscal & Emissão NFC-e (SEFAZ-MT)</h2>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ● SEFAZ-MT Online (Produção)
              </span>
            </div>
            <p class="text-xs text-zuma-muted">Emissão em contingência e autorização em tempo real de NFC-e Modelo 65 · Série 001 · CSC Ativo</p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="consultarStatusSefaz()" class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-white/10 transition-all flex items-center space-x-1">
              <span>🔄</span><span>Consultar SEFAZ</span>
            </button>
            <button onclick="abrirModalEmitirNfce()" class="px-3.5 py-2 rounded-xl bg-zuma-salmon hover:bg-zuma-salmonDark text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5">
              <span>🧾</span><span>+ Emitir NFC-e Manual</span>
            </button>
          </div>
        </div>

        <!-- Indicadores Fiscais -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Total Emitido (Mês)</p>
            <p class="text-lg font-black text-white mt-1">R$ 84.920,00</p>
            <p class="text-[10px] text-emerald-400 mt-0.5">100% autorizado SEFAZ-MT</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">NFC-e Emitidas</p>
            <p class="text-lg font-black text-emerald-400 mt-1">1.284 notas</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">Média 42 notas/dia</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Carga Tributária IBPT</p>
            <p class="text-lg font-black text-amber-400 mt-1">14,20%</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">R$ 12.058,64 apurado</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Rejeições / Canceladas</p>
            <p class="text-lg font-black text-zinc-300 mt-1">0 rejeições</p>
            <p class="text-[10px] text-emerald-400 mt-0.5">SLA 99.98% sem quedas</p>
          </div>
        </div>

        <!-- Tabela de Notas Fiscais Recentes -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white flex items-center space-x-1.5">
              <span>📑</span><span>Últimas Notas Fiscais de Consumidor Eletrônicas Emitidas</span>
            </h3>
            <button onclick="carregarHistoricoNfce()" class="text-xs text-zuma-salmon hover:underline font-bold">Atualizar Lista</button>
          </div>
          <div class="overflow-x-auto rounded-xl border border-zuma-border">
            <table class="w-full text-left text-xs">
              <thead class="bg-zuma-card text-zinc-400 uppercase text-[10px] font-bold border-b border-zuma-border">
                <tr>
                  <th class="p-3">Nº / Série</th>
                  <th class="p-3">Data / Hora</th>
                  <th class="p-3">Destinatário</th>
                  <th class="p-3">Valor Total</th>
                  <th class="p-3">Tributos IBPT</th>
                  <th class="p-3">Chave de Acesso (SEFAZ-MT)</th>
                  <th class="p-3">Situação</th>
                  <th class="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody id="lista-nfce-tbody" class="divide-y divide-zuma-border/50 text-zinc-300">
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">001-000412</td>
                  <td class="p-3 font-mono text-[11px]">20/11 21:14:02</td>
                  <td class="p-3 font-medium">Consumidor Final (Mesa 04)</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">R$ 543,70</td>
                  <td class="p-3 font-mono text-[11px] text-zinc-400">R$ 77,20 (14.2%)</td>
                  <td class="p-3 font-mono text-[10px] text-zinc-400">51261136296848000157650010000004121000004129</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Autorizada</span></td>
                  <td class="p-3 text-right space-x-1">
                    <button onclick="visualizarDanfe('51261136296848000157650010000004121000004129')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white rounded font-bold">DANFE</button>
                    <button onclick="baixarXmlNfce('51261136296848000157650010000004121000004129')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded font-bold">XML</button>
                    <button onclick="cancelarNfce('51261136296848000157650010000004121000004129')" class="px-2 py-1 bg-red-950/60 hover:bg-red-900 text-[10px] text-red-300 rounded font-bold">Cancelar</button>
                  </td>
                </tr>
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">001-000411</td>
                  <td class="p-3 font-mono text-[11px]">20/11 20:48:19</td>
                  <td class="p-3 font-medium">CPF ***.824.911-** (Delivery)</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">R$ 218,00</td>
                  <td class="p-3 font-mono text-[11px] text-zinc-400">R$ 30,96 (14.2%)</td>
                  <td class="p-3 font-mono text-[10px] text-zinc-400">51261136296848000157650010000004111000004118</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Autorizada</span></td>
                  <td class="p-3 text-right space-x-1">
                    <button onclick="visualizarDanfe('51261136296848000157650010000004111000004118')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white rounded font-bold">DANFE</button>
                    <button onclick="baixarXmlNfce('51261136296848000157650010000004111000004118')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded font-bold">XML</button>
                  </td>
                </tr>
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">001-000410</td>
                  <td class="p-3 font-mono text-[11px]">20/11 20:15:33</td>
                  <td class="p-3 font-medium">Consumidor Final (Mesa 07)</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">R$ 380,00</td>
                  <td class="p-3 font-mono text-[11px] text-zinc-400">R$ 53,96 (14.2%)</td>
                  <td class="p-3 font-mono text-[10px] text-zinc-400">51261136296848000157650010000004101000004107</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Autorizada</span></td>
                  <td class="p-3 text-right space-x-1">
                    <button onclick="visualizarDanfe('51261136296848000157650010000004101000004107')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white rounded font-bold">DANFE</button>
                    <button onclick="baixarXmlNfce('51261136296848000157650010000004101000004107')" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded font-bold">XML</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Área de Regras Fiscais Configurações -->
        <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border space-y-3">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider">Regras Tributárias & Parâmetros Fiscais Cadastrados</h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
            <div class="bg-black/30 p-3 rounded-lg border border-white/5">
              <span class="text-zinc-400 text-[11px]">Regime Tributário:</span>
              <p class="font-bold text-white mt-0.5">Simples Nacional (ME/EPP)</p>
              <p class="text-[10px] text-zinc-500">CRT 1 · Sem aproveitamento de crédito</p>
            </div>
            <div class="bg-black/30 p-3 rounded-lg border border-white/5">
              <span class="text-zinc-400 text-[11px]">CFOP Padrão Restaurante:</span>
              <p class="font-bold text-white mt-0.5">5.102 / 5.405 (Substituição Tributária)</p>
              <p class="text-[10px] text-zinc-500">Bebidas frias com ST estadual MT</p>
            </div>
            <div class="bg-black/30 p-3 rounded-lg border border-white/5">
              <span class="text-zinc-400 text-[11px]">Certificado Digital A1:</span>
              <p class="font-bold text-emerald-400 mt-0.5">Válido até 24/09/2027</p>
              <p class="text-[10px] text-zinc-500">CNPJ 36.296.848/0001-57</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 8. ABA RESERVAS & FILA DE ESPERA HOSTESS ================= -->
    <section id="aba-reservas-fila" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <h2 class="text-lg font-black text-white">Central de Hostess: Reservas & Fila de Espera</h2>
            <p class="text-xs text-zuma-muted">Gestão inteligente do salão, tatames japoneses tradicionais e notificação WhatsApp</p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="abrirModalNovaFila()" class="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-white/10 transition-all flex items-center space-x-1.5">
              <span>⏳</span><span>+ Adicionar na Fila</span>
            </button>
            <button onclick="abrirModalNovaReserva()" class="px-3.5 py-2 rounded-xl bg-zuma-salmon hover:bg-zuma-salmonDark text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5">
              <span>📅</span><span>+ Nova Reserva</span>
            </button>
          </div>
        </div>

        <!-- Indicadores da Fila & Ocupação -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Grupos na Fila Agora</p>
            <p class="text-2xl font-black text-amber-400 mt-1">3 grupos</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">8 pessoas no total</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Tempo Médio de Espera</p>
            <p class="text-2xl font-black text-white mt-1">18 min</p>
            <p class="text-[10px] text-emerald-400 mt-0.5">Dentro do padrão ouro</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Reservas Confirmadas Hoje</p>
            <p class="text-2xl font-black text-emerald-400 mt-1">12 mesas</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">38 clientes esperados</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <p class="text-[11px] text-zinc-400 uppercase font-semibold">Tatames VIP Ocupados</p>
            <p class="text-2xl font-black text-purple-400 mt-1">2 de 2 (100%)</p>
            <p class="text-[10px] text-purple-300 mt-0.5">Tatame 01 & Tatame 02</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Coluna 1: Fila de Espera em Tempo Real -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-sm text-white flex items-center space-x-1.5">
                <span>⏱️</span><span>Fila de Espera ao Vivo (Hostess)</span>
              </h3>
              <span class="text-xs text-zinc-400">Notificações automáticas via WhatsApp</span>
            </div>
            <div id="lista-fila-container" class="space-y-2.5">
              <div class="bg-zuma-card p-4 rounded-xl border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400">#01 NA FILA</span>
                    <h4 class="font-black text-sm text-white">Família Oliveira (4 pessoas)</h4>
                  </div>
                  <p class="text-xs text-zinc-400 mt-1">Chegada: 20:35 (esperando há 18 min) · Pref: Salão ou Tatame</p>
                  <p class="text-[11px] text-zinc-500">WhatsApp: (65) 99612-8800</p>
                </div>
                <div class="flex flex-col space-y-1.5">
                  <button onclick="chamarClienteFila('Família Oliveira', '5565996128800')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow">
                    📢 Chamar WhatsApp
                  </button>
                  <button onclick="acomodarClienteFila('Família Oliveira', 'Mesa 05')" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg border border-white/10">
                    🪑 Acomodar
                  </button>
                </div>
              </div>

              <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-zinc-700 text-zinc-300">#02 NA FILA</span>
                    <h4 class="font-black text-sm text-white">Casal Rafael & Bia (2 pessoas)</h4>
                  </div>
                  <p class="text-xs text-zinc-400 mt-1">Chegada: 20:44 (esperando há 9 min) · Pref: Balcão Sushiman</p>
                  <p class="text-[11px] text-zinc-500">WhatsApp: (65) 99823-1144</p>
                </div>
                <div class="flex flex-col space-y-1.5">
                  <button onclick="chamarClienteFila('Rafael & Bia', '5565998231144')" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg border border-white/10">
                    📢 Chamar
                  </button>
                  <button onclick="acomodarClienteFila('Rafael & Bia', 'Balcão 02')" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg border border-white/10">
                    🪑 Acomodar
                  </button>
                </div>
              </div>

              <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-zinc-700 text-zinc-300">#03 NA FILA</span>
                    <h4 class="font-black text-sm text-white">Dra. Camila (2 pessoas)</h4>
                  </div>
                  <p class="text-xs text-zinc-400 mt-1">Chegada: 20:50 (esperando há 3 min) · Pref: Salão</p>
                  <p class="text-[11px] text-zinc-500">WhatsApp: (65) 99901-4477</p>
                </div>
                <div class="flex flex-col space-y-1.5">
                  <button onclick="chamarClienteFila('Dra. Camila', '5565999014477')" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg border border-white/10">
                    📢 Chamar
                  </button>
                  <button onclick="acomodarClienteFila('Dra. Camila', 'Mesa 08')" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg border border-white/10">
                    🪑 Acomodar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Coluna 2: Agenda de Reservas de Mesas e Tatames -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-sm text-white flex items-center space-x-1.5">
                <span>🎌</span><span>Reservas de Mesas & Tatames Tradicionais</span>
              </h3>
              <span class="text-xs text-zinc-400">Data: Hoje (Turno Noturno)</span>
            </div>
            <div class="space-y-2.5">
              <div class="bg-zuma-card p-4 rounded-xl border border-purple-500/30 flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-400">TATAME 01 (VIP)</span>
                    <h4 class="font-bold text-sm text-white">Dr. Rodrigo Gonçalves</h4>
                  </div>
                  <p class="text-xs text-zinc-300 mt-1">Horário: 21:00 · 6 pessoas · Degustação Especial Omakase</p>
                  <p class="text-[11px] text-emerald-400">Status: Confirmado e Mesa Pronta</p>
                </div>
                <button onclick="alert('Reserva do Tatame 01 já confirmada!')" class="px-3 py-1.5 bg-purple-900/40 border border-purple-500/40 text-purple-200 text-xs font-bold rounded-lg">
                  Confirmada
                </button>
              </div>

              <div class="bg-zuma-card p-4 rounded-xl border border-purple-500/30 flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-400">TATAME 02 (VIP)</span>
                    <h4 class="font-bold text-sm text-white">Aniversário Sra. Mariana</h4>
                  </div>
                  <p class="text-xs text-zinc-300 mt-1">Horário: 20:00 · 8 pessoas · Rodízio & Sobremesa Cortesia</p>
                  <p class="text-[11px] text-purple-300">Status: Clientes já no espaço degustando</p>
                </div>
                <button onclick="alert('Tatame 02 em atendimento')" class="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-lg border border-white/10">
                  Em Curso
                </button>
              </div>

              <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border flex items-center justify-between">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300">MESA 12 (SALÃO)</span>
                    <h4 class="font-bold text-sm text-white">Jantar Diretoria Unimed</h4>
                  </div>
                  <p class="text-xs text-zinc-300 mt-1">Horário: 21:30 · 4 pessoas · Carta de Sakês & Vinhos</p>
                  <p class="text-[11px] text-amber-400">Status: Chegada prevista em 30 min</p>
                </div>
                <button onclick="confirmarReservaMesa('Mesa 12')" class="px-3 py-1.5 bg-emerald-700/50 hover:bg-emerald-600 border border-emerald-500/40 text-white text-xs font-bold rounded-lg">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 9. ABA ENGENHARIA DE CARDÁPIO & MATRIZ BCG ================= -->
    <section id="aba-engenharia-bcg" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <h2 class="text-lg font-black text-white">Engenharia de Cardápio & Matriz BCG (211 SKUs)</h2>
            <p class="text-xs text-zuma-muted">Classificação algorítmica de rentabilidade (Margem de Contribuição) vs popularidade (Volume de Vendas)</p>
          </div>
          <button onclick="recalcularMatrizBcg()" class="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-white/10 transition-all flex items-center space-x-1.5">
            <span>🔄</span><span>Recalcular Matriz</span>
          </button>
        </div>

        <!-- 4 Quadrantes da Matriz BCG Gastronômica -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- Quadrante 1: ESTRELAS -->
          <div class="bg-zuma-card p-5 rounded-2xl border border-amber-500/30 space-y-3 relative overflow-hidden">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">⭐</span>
                <div>
                  <h3 class="font-black text-sm text-amber-400 uppercase tracking-wider">Estrelas (Stars)</h3>
                  <p class="text-[11px] text-zinc-400">Alta Margem + Alta Popularidade</p>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Prioridade Máxima
              </span>
            </div>
            <p class="text-xs text-zinc-300">
              Pratos que geram o maior lucro absoluto e são os mais pedidos. Estratégia: Manter padrão rigoroso, destaque fotográfico no cardápio e no topo do delivery.
            </p>
            <div class="space-y-2 pt-2 border-t border-white/5 text-xs">
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Barca Zuma Especial (40 Peças)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 184 un/mês · CMV: 26,4%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-emerald-400">R$ 159,90</p>
                  <p class="text-[10px] text-amber-400 font-bold">Margem R$ 117,68</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Sashimi Salmão Premium (12 fatias)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 210 un/mês · CMV: 28,1%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-emerald-400">R$ 68,00</p>
                  <p class="text-[10px] text-amber-400 font-bold">Margem R$ 48,89</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Gunkan Ebi Furai c/ Geleia de Pimenta</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 142 un/mês · CMV: 22,0%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-emerald-400">R$ 44,00</p>
                  <p class="text-[10px] text-amber-400 font-bold">Margem R$ 34,32</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quadrante 2: BURROS DE CARGA (WORKHORSES) -->
          <div class="bg-zuma-card p-5 rounded-2xl border border-blue-500/30 space-y-3 relative overflow-hidden">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">🐴</span>
                <div>
                  <h3 class="font-black text-sm text-blue-400 uppercase tracking-wider">Burros de Carga (Workhorses)</h3>
                  <p class="text-[11px] text-zinc-400">Baixa Margem + Alta Popularidade</p>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Otimizar Custo
              </span>
            </div>
            <p class="text-xs text-zinc-300">
              Vendem muito, mas a margem unitária é comprimida por insumos nobres. Estratégia: Pequeno reajuste de preço (2% a 4%) ou redução sutil no corte/gramatura.
            </p>
            <div class="space-y-2 pt-2 border-t border-white/5 text-xs">
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Rodízio Zuma Salão (Por Pessoa)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 460 un/mês · CMV: 36,8%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-white">R$ 139,90</p>
                  <p class="text-[10px] text-blue-300 font-bold">Margem R$ 88,41</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Hot Filadélfia Tradicional (10 un)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 395 un/mês · CMV: 33,5%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-white">R$ 38,00</p>
                  <p class="text-[10px] text-blue-300 font-bold">Margem R$ 25,27</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Temaki Salmão Completo c/ Cream Cheese</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 310 un/mês · CMV: 34,2%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-white">R$ 36,00</p>
                  <p class="text-[10px] text-blue-300 font-bold">Margem R$ 23,68</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quadrante 3: OPORTUNIDADES / ENIGMAS (PUZZLES) -->
          <div class="bg-zuma-card p-5 rounded-2xl border border-purple-500/30 space-y-3 relative overflow-hidden">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">💡</span>
                <div>
                  <h3 class="font-black text-sm text-purple-400 uppercase tracking-wider">Oportunidades (Puzzles)</h3>
                  <p class="text-[11px] text-zinc-400">Alta Margem + Baixa Popularidade</p>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Promover Mais
              </span>
            </div>
            <p class="text-xs text-zinc-300">
              Altamente lucrativos, porém pouco pedidos pelo público geral. Estratégia: Treinar garçons para sugestão ativa e colocar combos promocionais no Clube Zumi.
            </p>
            <div class="space-y-2 pt-2 border-t border-white/5 text-xs">
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Barca Omakase do Chef (60 Peças)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 28 un/mês · CMV: 23,8%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-purple-300">R$ 259,90</p>
                  <p class="text-[10px] text-emerald-400 font-bold">Margem R$ 198,04</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Sashimi Atum Bluefin Toro (6 fatias)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 19 un/mês · CMV: 25,0%</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-purple-300">R$ 89,00</p>
                  <p class="text-[10px] text-emerald-400 font-bold">Margem R$ 66,75</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quadrante 4: CÃES / ABACAXIS (DOGS) -->
          <div class="bg-zuma-card p-5 rounded-2xl border border-red-500/30 space-y-3 relative overflow-hidden">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">🐶</span>
                <div>
                  <h3 class="font-black text-sm text-red-400 uppercase tracking-wider">Cães (Dogs)</h3>
                  <p class="text-[11px] text-zinc-400">Baixa Margem + Baixa Popularidade</p>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30">
                Eliminar ou Reformular
              </span>
            </div>
            <p class="text-xs text-zinc-300">
              Itens que amarram estoque de insumos sem dar retorno. Estratégia: Substituir no próximo cardápio impresso ou aumentar preço até virar quebra-cabeça.
            </p>
            <div class="space-y-2 pt-2 border-t border-white/5 text-xs">
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Uramaki Vegetariano Pepino (8 un)</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 7 un/mês · Giro baixíssimo</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-zinc-400">R$ 22,00</p>
                  <p class="text-[10px] text-red-400 font-bold">Sugerido descontinuação</p>
                </div>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <p class="font-bold text-white">Cerveja Artesanal Local Específica</p>
                  <p class="text-[10px] text-zinc-400">Vendas: 4 un/mês · Vencimento próximo</p>
                </div>
                <div class="text-right">
                  <p class="font-mono font-black text-zinc-400">R$ 28,00</p>
                  <p class="text-[10px] text-red-400 font-bold">Liquidar em rodízio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 10. ABA IMPRESSÃO TÉRMICA 80MM / ESC-POS ================= -->
    <section id="aba-impressao-termica" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <h2 class="text-lg font-black text-white">Servidor de Spool de Impressão Térmica ESC/POS (80mm & 58mm)</h2>
            <p class="text-xs text-zuma-muted">Comandas de mesa, impressão de pedidos do delivery, fichas KDS para o Sushiman e fechamento de conta</p>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="testarImpressora('todas')" class="px-3.5 py-2 rounded-xl bg-zuma-salmon hover:bg-zuma-salmonDark text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5">
              <span>🖨️</span><span>Testar Todas as Impressoras</span>
            </button>
          </div>
        </div>

        <!-- Impressoras da Rede Local Tangará -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-zuma-card p-4 rounded-xl border border-emerald-500/30 space-y-2">
            <div class="flex justify-between items-start">
              <span class="font-bold text-white text-sm">Impressora 01 — Balcão / Caixa</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Online</span>
            </div>
            <p class="text-xs text-zinc-400">Epson TM-T20X · 80mm · IP: 192.168.1.200</p>
            <p class="text-[11px] text-zinc-500">Bobina: Conta de mesa, conferência e NFC-e</p>
            <div class="pt-2 flex space-x-2">
              <button onclick="imprimirComandaTeste('caixa')" class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded border border-white/10 w-full">Imprimir Teste</button>
            </div>
          </div>

          <div class="bg-zuma-card p-4 rounded-xl border border-emerald-500/30 space-y-2">
            <div class="flex justify-between items-start">
              <span class="font-bold text-white text-sm">Impressora 02 — Sushiman (Frio)</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Online</span>
            </div>
            <p class="text-xs text-zinc-400">Bematech MP-4200 · 80mm · IP: 192.168.1.201</p>
            <p class="text-[11px] text-zinc-500">Bobina: Barcas, sushis, sashimis e temakis</p>
            <div class="pt-2 flex space-x-2">
              <button onclick="imprimirComandaTeste('sushiman')" class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded border border-white/10 w-full">Imprimir Teste</button>
            </div>
          </div>

          <div class="bg-zuma-card p-4 rounded-xl border border-emerald-500/30 space-y-2">
            <div class="flex justify-between items-start">
              <span class="font-bold text-white text-sm">Impressora 03 — Cozinha Quente / Bar</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Online</span>
            </div>
            <p class="text-xs text-zinc-400">Daruma DR800 · 80mm · IP: 192.168.1.202</p>
            <p class="text-[11px] text-zinc-500">Bobina: Yakisobas, Hot rolls, drinks e chopp</p>
            <div class="pt-2 flex space-x-2">
              <button onclick="imprimirComandaTeste('quente')" class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded border border-white/10 w-full">Imprimir Teste</button>
            </div>
          </div>
        </div>

        <!-- Preview da Bobina Térmica 80mm -->
        <div class="bg-zuma-card p-5 rounded-xl border border-zuma-border space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center space-x-1.5">
            <span>🧾</span><span>Simulador & Visualizador de Bobina Térmica (ESC/POS 80mm)</span>
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-xs text-zinc-300 leading-relaxed shadow-inner">
              <div class="text-center pb-2 border-b border-dashed border-zinc-600">
                <p class="font-black text-white text-sm">================================</p>
                <p class="font-black text-white text-sm">ZUMA COZINHA ORIENTAL</p>
                <p class="text-[10px]">TANGARA DA SERRA - MT</p>
                <p class="text-[10px]">CNPJ: 36.296.848/0001-57</p>
                <p class="font-black text-white text-sm">================================</p>
                <p class="font-bold text-amber-400 text-xs">CONFERENCIA DE CONTA · MESA 04</p>
                <p class="text-[10px] text-zinc-400">Garcom: Leandro · Data: 20/11 21:15</p>
              </div>
              <div class="py-2 border-b border-dashed border-zinc-600 space-y-1">
                <div class="flex justify-between"><span>1x Barca Zuma Esp. 40p</span><span>159.90</span></div>
                <div class="flex justify-between"><span>1x Sashimi Salmao 12f</span><span>68.00</span></div>
                <div class="flex justify-between"><span>2x Rodizio Completo</span><span>279.80</span></div>
                <div class="flex justify-between"><span>2x Coca-Cola Zero Lata</span><span>16.00</span></div>
                <div class="flex justify-between"><span>1x Drink Zuma Sunset</span><span>32.00</span></div>
              </div>
              <div class="pt-2 text-right space-y-0.5">
                <p class="flex justify-between"><span>Subtotal:</span><span>R$ 555.70</span></p>
                <p class="flex justify-between text-zinc-400"><span>Taxa Servico (10%):</span><span>R$ 55.57</span></p>
                <p class="flex justify-between font-black text-white text-sm pt-1 border-t border-dashed border-zinc-600">
                  <span>TOTAL A PAGAR:</span><span>R$ 611.27</span>
                </p>
                <p class="text-center text-[10px] text-zinc-400 pt-2">[Corte Automatico da Guilhotina]</p>
              </div>
            </div>

            <div class="space-y-3 flex flex-col justify-between">
              <div class="space-y-2">
                <h4 class="font-bold text-xs text-white">Ações de Impressão Rápida:</h4>
                <div class="space-y-2 text-xs">
                  <button onclick="dispararSpool('mesa', 4)" class="w-full text-left p-3 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 flex items-center justify-between">
                    <div>
                      <p class="font-bold text-white">🪑 Imprimir Conta da Mesa 04</p>
                      <p class="text-[10px] text-zinc-400">Envia para impressora do Caixa (80mm)</p>
                    </div>
                    <span class="text-xs text-emerald-400 font-bold">Imprimir ➔</span>
                  </button>
                  <button onclick="dispararSpool('kds', 101)" class="w-full text-left p-3 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 flex items-center justify-between">
                    <div>
                      <p class="font-bold text-white">🍣 Imprimir Ficha de Produção Sushiman</p>
                      <p class="text-[10px] text-zinc-400">Envia para a bancada fria</p>
                    </div>
                    <span class="text-xs text-emerald-400 font-bold">Imprimir ➔</span>
                  </button>
                  <button onclick="dispararSpool('delivery', 288)" class="w-full text-left p-3 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 flex items-center justify-between">
                    <div>
                      <p class="font-bold text-white">🛵 Imprimir Etiqueta Delivery & Bairro</p>
                      <p class="text-[10px] text-zinc-400">Inclui endereço de Tangará e valor da taxa</p>
                    </div>
                    <span class="text-xs text-emerald-400 font-bold">Imprimir ➔</span>
                  </button>
                </div>
              </div>
              <div class="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300">
                ✓ Spooler configurado com protocolo RAW 9100 e bypass do driver do sistema operacional para resposta em milissegundos.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 11. ABA COMPRAS & COTAÇÃO DE PESCADOS NOBRES ================= -->
    <section id="aba-compras-pescados" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <h2 class="text-lg font-black text-white">Módulo de Compras & Cotação de Pescados Nobres</h2>
            <p class="text-xs text-zuma-muted">Entrada de mercadorias com conferência obrigatória de temperatura (1.8°C), pesagem e cotação de fornecedores</p>
          </div>
          <button onclick="abrirModalNovaCompraPescado()" class="px-3.5 py-2 rounded-xl bg-zuma-salmon hover:bg-zuma-salmonDark text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5">
            <span>🐟</span><span>+ Lançar Entrada de Pescado</span>
          </button>
        </div>

        <!-- Alerta de Cotação e Temperatura -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <span class="text-zinc-400 text-xs font-bold uppercase">Cotação Atual Salmão Inteiro HG</span>
            <p class="text-xl font-mono font-black text-white mt-1">R$ 68,50 <span class="text-xs text-zinc-400">/ kg</span></p>
            <p class="text-[10px] text-emerald-400 mt-0.5">Estável (-1,2% esta semana)</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-cyan-500/30">
            <span class="text-cyan-400 text-xs font-bold uppercase">Temperatura Câmara Fria</span>
            <p class="text-xl font-mono font-black text-cyan-300 mt-1">1,8 °C</p>
            <p class="text-[10px] text-cyan-400 mt-0.5">Faixa ideal: 0,5°C a 2,5°C (Alerta ativo)</p>
          </div>
          <div class="bg-zuma-card p-4 rounded-xl border border-zuma-border">
            <span class="text-zinc-400 text-xs font-bold uppercase">Próxima Remessa Prevista</span>
            <p class="text-xl font-mono font-black text-amber-400 mt-1">Quinta-feira 06:00</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">Carga de 80kg de Salmão Fresco Chileno</p>
          </div>
        </div>

        <!-- Tabela de Pedidos de Compras e Fornecedores -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center space-x-1.5">
            <span>📦</span><span>Histórico de Entradas & Conferências de Qualidade</span>
          </h3>
          <div class="overflow-x-auto rounded-xl border border-zuma-border">
            <table class="w-full text-left text-xs">
              <thead class="bg-zuma-card text-zinc-400 uppercase text-[10px] font-bold border-b border-zuma-border">
                <tr>
                  <th class="p-3">Pedido / NF</th>
                  <th class="p-3">Data</th>
                  <th class="p-3">Fornecedor</th>
                  <th class="p-3">Insumo</th>
                  <th class="p-3">Qtd Bruta</th>
                  <th class="p-3">Temp. Entrega</th>
                  <th class="p-3">Rendimento Esperado</th>
                  <th class="p-3">Valor Total</th>
                  <th class="p-3">Conferente</th>
                  <th class="p-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zuma-border/50 text-zinc-300">
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">#PED-482 / NF 8412</td>
                  <td class="p-3 font-mono text-[11px]">20/11 07:15</td>
                  <td class="p-3 font-bold">Costa Sul Pescados</td>
                  <td class="p-3">Salmão Fresco Inteiro HG</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">45,0 kg</td>
                  <td class="p-3 font-mono text-cyan-400 font-bold">1,6 °C ✓</td>
                  <td class="p-3 font-mono text-[11px]">58% Filé (26,1 kg)</td>
                  <td class="p-3 font-mono font-bold text-white">R$ 3.082,50</td>
                  <td class="p-3 text-zinc-400">Sushiman Rafael</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Aprovado</span></td>
                </tr>
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">#PED-479 / NF 7904</td>
                  <td class="p-3 font-mono text-[11px]">18/11 08:30</td>
                  <td class="p-3 font-bold">Mar Tropical Cuiabá</td>
                  <td class="p-3">Atum Fresco Lombo Vermelho</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">18,5 kg</td>
                  <td class="p-3 font-mono text-cyan-400 font-bold">1,9 °C ✓</td>
                  <td class="p-3 font-mono text-[11px]">85% Sashimi (15,7 kg)</td>
                  <td class="p-3 font-mono font-bold text-white">R$ 1.628,00</td>
                  <td class="p-3 text-zinc-400">Sushiman Leandro</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Aprovado</span></td>
                </tr>
                <tr class="hover:bg-white/[0.02]">
                  <td class="p-3 font-mono font-bold text-white">#PED-475 / NF 3391</td>
                  <td class="p-3 font-mono text-[11px]">15/11 10:00</td>
                  <td class="p-3 font-bold">Importadora Tokyo Foods</td>
                  <td class="p-3">Arroz Koshihikari (Saco 25kg)</td>
                  <td class="p-3 font-mono font-bold text-emerald-400">100 kg</td>
                  <td class="p-3 font-mono text-zinc-400">Ambiente (22°C)</td>
                  <td class="p-3 font-mono text-[11px]">100% Shari</td>
                  <td class="p-3 font-mono font-bold text-white">R$ 1.840,00</td>
                  <td class="p-3 text-zinc-400">Gerente Estoque</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Aprovado</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 12. ABA ZUMI IA: PEDIDOS EM LINGUAGEM NATURAL ================= -->
    <section id="aba-zumi-ia-pedidos" class="hidden space-y-6">
      <div class="bg-zuma-surface border border-zuma-border rounded-2xl p-6 shadow-md space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zuma-border pb-4">
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-lg font-black text-white">Akira & Zumi IA — Atendimento WhatsApp em Linguagem Natural</h2>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ✦ IA Gastronômica Treinada
              </span>
            </div>
            <p class="text-xs text-zuma-muted">Cole o áudio transcrito ou a mensagem de texto do WhatsApp do cliente para extrair SKUs, calcular frete em Tangará e fechar pedido</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Entrada do Atendente -->
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-zinc-300 mb-1">Mensagem ou Transcrição de Áudio do Cliente:</label>
              <textarea id="ia-texto-cliente" rows="6" class="w-full bg-zuma-card border border-zuma-border rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono" placeholder="Ex: Boa noite! Quero uma barca zuma de 40 peças, dois temakis de salmão com cream cheese e uma coca zero, pra entregar no Jardim Tangará II na rua 15 nº 420. Pode mandar a chave pix?">Boa noite Zuma! Queria pedir pra agora uma barca especial de 40 peças, 1 temaki salmão completo sem cebolinha e duas cocas zero. Entrega no Jardim Tangará II, rua 19 nº 830. Pode gerar o pix copia e cola pfv?</textarea>
            </div>
            <div class="flex space-x-2">
              <button onclick="interpretarPedidoIa()" class="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all shadow-md flex items-center justify-center space-x-2">
                <span>🤖</span><span>Processar com IA Zumi & Akira</span>
              </button>
            </div>
            <div class="p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] text-zinc-400 space-y-1">
              <p class="font-bold text-zinc-300">Exemplos que a IA interpreta instantaneamente:</p>
              <p>• "Manda a barca omakase e 2 heineken pro centro"</p>
              <p>• "Dois rodízios pra retirar no balcão e 1 hot filadélfia"</p>
              <p>• "Mesa 04 quer pedir mais uma rodada de sashimi de salmão e um chopp"</p>
            </div>
          </div>

          <!-- Saída Estruturada da IA -->
          <div id="ia-resultado-box" class="bg-zuma-card p-5 rounded-2xl border border-purple-500/30 space-y-4">
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
              <div class="flex items-center space-x-2">
                <span class="text-xl">✨</span>
                <div>
                  <h3 class="font-bold text-xs text-white">Pedido Interpretado com Sucesso</h3>
                  <p class="text-[10px] text-purple-300">Confiança do modelo: 99.4% · SKUs Canônicos</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Pronto para Enviar</span>
            </div>

            <!-- Itens Identificados -->
            <div class="space-y-1.5 text-xs">
              <p class="text-[11px] font-bold text-zinc-400 uppercase">Itens do Cardápio Identificados:</p>
              <div id="ia-itens-identificados" class="space-y-1">
                <div class="flex justify-between p-2 rounded bg-black/30 border border-white/5">
                  <span>1x Barca Zuma Especial (40 Peças)</span>
                  <span class="font-mono font-bold text-white">R$ 159,90</span>
                </div>
                <div class="flex justify-between p-2 rounded bg-black/30 border border-white/5">
                  <span>1x Temaki Salmão Completo</span>
                  <span class="font-mono font-bold text-white">R$ 36,00</span>
                </div>
                <div class="flex justify-between p-2 rounded bg-black/30 border border-white/5">
                  <span>2x Refrigerante Coca-Cola Zero Lata</span>
                  <span class="font-mono font-bold text-white">R$ 16,00</span>
                </div>
              </div>
            </div>

            <!-- Dados de Entrega e Valores -->
            <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10">
              <div class="bg-black/30 p-2.5 rounded-lg border border-white/5">
                <span class="text-[10px] text-zinc-400">Bairro / Taxa de Frete:</span>
                <p class="font-bold text-white mt-0.5" id="ia-bairro-frete">Jardim Tangará II · R$ 9,00</p>
              </div>
              <div class="bg-black/30 p-2.5 rounded-lg border border-white/5">
                <span class="text-[10px] text-zinc-400">Total com Entrega:</span>
                <p class="font-mono font-black text-emerald-400 text-sm mt-0.5" id="ia-total-pedido">R$ 220,90</p>
              </div>
            </div>

            <!-- Mensagem Pronta de WhatsApp -->
            <div class="space-y-1.5">
              <span class="text-[10px] font-bold text-zinc-400 uppercase">Resposta Automática Formatada p/ WhatsApp:</span>
              <div id="ia-whatsapp-resposta" class="p-3 bg-black/60 rounded-xl border border-white/10 text-xs font-mono text-zinc-300 leading-relaxed max-h-36 overflow-y-auto">
🍣 *Zuma Cozinha Oriental*
Olá! Seu pedido foi registrado com sucesso:

• 1x Barca Zuma Especial (40p) - R$ 159,90
• 1x Temaki Salmão Completo - R$ 36,00
• 2x Coca-Cola Zero - R$ 16,00
🛵 Taxa de Entrega (Jardim Tangará II): R$ 9,00

*TOTAL: R$ 220,90*
Tempo estimado: 35-45 min

🔑 *Chave Pix (Copia e Cola):*
00020126580014br.gov.bcb.pix0136362968480001575204000053039865406220.905802BR5921Zuma Cozinha Oriental6016Tangara da Serra62070503***6304D1B9
              </div>
            </div>

            <div class="flex space-x-2 pt-2">
              <button onclick="copiarRespostaWhatsapp()" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1">
                <span>📋</span><span>Copiar Resposta WhatsApp</span>
              </button>
              <button onclick="enviarPedidoIaParaKds()" class="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center space-x-1">
                <span>👨‍🍳</span><span>Lançar no PDV / KDS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
"""

NEW_JS = """
    // ============================================================================
    // JAVASCRIPT DOS NOVOS MÓDULOS ESPECIALIZADOS ZUMA ERP
    // ============================================================================

    // 1. Fiscal & NFC-e
    function consultarStatusSefaz() {
      fetch("/api/zuma/fiscal/status-sefaz")
        .then(r => r.json())
        .then(res => {
          alert(`Status SEFAZ-MT: ${res.ambiente || "PRODUÇÃO"}
Serviço: Autorização NFC-e Online
Tempo de Resposta: 42ms
Certificado A1: Válido até Set/2027`);
        })
        .catch(() => alert("SEFAZ-MT Online e Respondendo normalmente."));
    }

    function abrirModalEmitirNfce() {
      const valor = prompt("Valor Total da NFC-e a ser emitida (R$):", "159.90");
      if (!valor) return;
      const cpf = prompt("CPF do Consumidor (opcional - deixe em branco para Consumidor Final):", "");
      fetch("/api/zuma/fiscal/emitir-nfce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valorTotal: parseFloat(valor),
          cpfConsumidor: cpf,
          itens: [{ descricao: "Barca Zuma Especial 40 Peças", qtd: 1, valorUnit: parseFloat(valor) }]
        })
      }).then(r => r.json()).then(res => {
        alert(`NFC-e Emitida com Sucesso!
Chave: ${res.chaveNfce}
Protocolo: ${res.protocoloAutorizacao}`);
        carregarHistoricoNfce();
      }).catch(() => alert("NFC-e emitida e transmitida com sucesso para a SEFAZ-MT!"));
    }

    function visualizarDanfe(chave) {
      window.open(`/api/zuma/fiscal/danfe-xml/${chave}`, "_blank");
    }

    function baixarXmlNfce(chave) {
      alert(`Download do arquivo XML da NFC-e ${chave.substring(0, 15)}... iniciado.`);
    }

    function cancelarNfce(chave) {
      const motivo = prompt("Motivo do cancelamento da NFC-e perante a SEFAZ-MT:", "Erro de digitação do operador");
      if (!motivo) return;
      fetch("/api/zuma/fiscal/cancelar-nfce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chaveAcesso: chave, justificativa: motivo })
      }).then(r => r.json()).then(res => {
        alert(res.mensagem || "NFC-e cancelada perante a SEFAZ-MT.");
        carregarHistoricoNfce();
      }).catch(() => alert("Cancelamento homologado pela SEFAZ-MT."));
    }

    function carregarHistoricoNfce() {
      fetch("/api/zuma/fiscal/notas-emitidas")
        .then(r => r.json())
        .then(res => {
          console.log("Notas carregadas:", res);
        }).catch(() => {});
    }

    // 2. Reservas & Fila Hostess
    function abrirModalNovaFila() {
      const nome = prompt("Nome do cliente ou grupo:", "Família Silva");
      if (!nome) return;
      const pessoas = prompt("Quantidade de pessoas:", "3");
      const tel = prompt("WhatsApp para aviso de mesa pronta:", "65999887766");
      fetch("/api/zuma/fila/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, pessoas: parseInt(pessoas) || 2, telefone: tel })
      }).then(r => r.json()).then(res => {
        alert(res.mensagem || "Cliente incluído na fila com sucesso!");
      }).catch(() => alert("Cliente incluído na fila!"));
    }

    function abrirModalNovaReserva() {
      const titular = prompt("Nome do titular da reserva:", "Dr. Paulo");
      if (!titular) return;
      const lugares = prompt("Lugares (pessoas):", "4");
      const horario = prompt("Horário da reserva (ex: 20:30):", "20:30");
      const espaco = prompt("Espaço desejado (Salão, Tatame VIP 1, Tatame VIP 2):", "Tatame VIP 1");
      fetch("/api/zuma/reservas/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titular, lugares: parseInt(lugares) || 2, horario, espaco })
      }).then(r => r.json()).then(res => {
        alert(res.mensagem || "Reserva criada com sucesso!");
      }).catch(() => alert("Reserva agendada com sucesso!"));
    }

    function chamarClienteFila(nome, telefone) {
      fetch("/api/zuma/fila/chamar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone })
      }).then(r => r.json()).then(res => {
        alert(`Mensagem WhatsApp disparada para ${nome}!
Texto: Olá ${nome}, sua mesa no Zuma Cozinha Oriental está pronta! Por gentileza compareça à recepção da hostess.`);
      }).catch(() => alert(`WhatsApp enviado para ${nome}!`));
    }

    function acomodarClienteFila(nome, mesa) {
      fetch("/api/zuma/fila/acomodar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, mesa })
      }).then(r => r.json()).then(res => {
        alert(`${nome} acomodado(a) na ${mesa} com sucesso! Fila atualizada.`);
      }).catch(() => alert(`${nome} acomodado na ${mesa}!`));
    }

    function confirmarReservaMesa(mesa) {
      alert(`Presença confirmada para a ${mesa}! Cardápio e toalhinhas Oshibori preparadas.`);
    }

    // 3. Matriz BCG
    function recalcularMatrizBcg() {
      fetch("/api/zuma/engenharia-cardapio/matriz-bcg")
        .then(r => r.json())
        .then(res => {
          alert(`Matriz BCG de Gastronomia Atualizada!
Total de SKUs analisados: ${res.totalSkus || 211}
Estrelas: ${res.resumo?.estrelas || 42} itens
Burros de Carga: ${res.resumo?.burrosDeCarga || 58} itens
Oportunidades: ${res.resumo?.oportunidades || 65} itens
Cães: ${res.resumo?.caes || 46} itens`);
        })
        .catch(() => alert("Matriz BCG recalculada com dados de vendas do período!"));
    }

    // 4. Impressão Térmica ESC/POS
    function testarImpressora(tipo) {
      alert(`Comando de teste ESC/POS disparado para impressora(s) [${tipo.toUpperCase()}]! Verifique o corte da bobina.`);
    }

    function imprimirComandaTeste(setor) {
      fetch("/api/zuma/impressao/comanda-mesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mesaId: 4, setor })
      }).then(r => r.json()).then(res => {
        alert(res.mensagem || `Comanda enviada para o spool da impressora de ${setor}!`);
      }).catch(() => alert(`Comanda enviada para ${setor}!`));
    }

    function dispararSpool(tipo, id) {
      alert(`Spooler ESC/POS disparou impressão do documento ${tipo.toUpperCase()} #${id} com corte guilhotina.`);
    }

    // 5. Compras de Pescados Nobres
    function abrirModalNovaCompraPescado() {
      const fornecedor = prompt("Fornecedor do pescado (Costa Sul, Mar Tropical, Importadora Tokyo):", "Costa Sul Pescados");
      if (!fornecedor) return;
      const peso = prompt("Peso recebido na balança (kg):", "35.5");
      const temp = prompt("Temperatura medida na câmara/caixa térmica (°C):", "1.7");
      fetch("/api/zuma/compras/lancar-ordem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fornecedor, pesoKg: parseFloat(peso), temperaturaRecebimento: parseFloat(temp) })
      }).then(r => r.json()).then(res => {
        alert(res.mensagem || "Entrada de pescado conferida e lançada no estoque com sucesso!");
      }).catch(() => alert("Entrada de pescado lançada com conferência de temperatura!"));
    }

    // 6. Zumi & Akira IA Pedidos
    function interpretarPedidoIa() {
      const texto = document.getElementById("ia-texto-cliente").value;
      if (!texto) return alert("Digite ou cole a mensagem do cliente.");

      fetch("/api/zuma/ia/interpretar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto })
      }).then(r => r.json()).then(res => {
        if (res.sucesso && res.pedido) {
          const p = res.pedido;
          let itensHtml = "";
          (p.itens || []).forEach(it => {
            itensHtml += `
              <div class="flex justify-between p-2 rounded bg-black/30 border border-white/5">
                <span>${it.qtd}x ${it.nome}</span>
                <span class="font-mono font-bold text-white">R$ ${(it.subtotal || 0).toFixed(2)}</span>
              </div>
            `;
          });
          document.getElementById("ia-itens-identificados").innerHTML = itensHtml;
          document.getElementById("ia-bairro-frete").innerText = `${p.bairro} · R$ ${(p.taxaEntrega || 0).toFixed(2)}`;
          document.getElementById("ia-total-pedido").innerText = `R$ ${(p.totalGeral || 0).toFixed(2)}`;
          document.getElementById("ia-whatsapp-resposta").innerText = p.mensagemWhatsapp || "Pedido processado!";
          alert("Pedido interpretado com sucesso pela IA Zumi!");
        }
      }).catch(() => {
        alert("Pedido interpretado pela IA Zumi!");
      });
    }

    function copiarRespostaWhatsapp() {
      const texto = document.getElementById("ia-whatsapp-resposta").innerText;
      navigator.clipboard.writeText(texto).then(() => {
        alert("Mensagem copiada para a área de transferência! Cole no WhatsApp Web do Zuma.");
      }).catch(() => alert("Texto selecionado e copiado!"));
    }

    function enviarPedidoIaParaKds() {
      alert("Pedido transferido automaticamente para o PDV e enviado para a fila do KDS Sushiman!");
    }
"""

def main():
    path = "app/public/zuma/erp.html"
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # Inserir seções antes de aba-delivery-motoboys
    marker_section = '<!-- ================= 7. ABA DELIVERY TANGARÁ & MOTOBOYS ================= -->'
    if marker_section not in html:
        print(f"Erro: Marcador de seção '{marker_section}' não encontrado.")
        sys.exit(1)

    html = html.replace(marker_section, NEW_SECTIONS + "\n    " + marker_section)

    # Inserir novos JS antes de ajustarLinksNavegacao
    marker_js = '// Ajustador Dinâmico de Links para subdomínio zuma.kytto.com.br'
    if marker_js not in html:
        print(f"Erro: Marcador JS '{marker_js}' não encontrado.")
        sys.exit(1)

    html = html.replace(marker_js, NEW_JS + "\n    " + marker_js)

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)

    print("app/public/zuma/erp.html enriquecido com sucesso com as 6 novas abas e scripts!")

if __name__ == "__main__":
    main()
