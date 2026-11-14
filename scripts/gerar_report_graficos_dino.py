#!/usr/bin/env python3
"""
Gerador de Painel Diário de Performance & Auditoria Operacional (Infográfico Executivo)
Barbearia Dino & Perfumaria × T-Rex (Motor KyttoIA)
Gera uma imagem PNG de altíssima definição (1920x1080) com os 4 gráficos operacionais.
"""

import sys
import os
import json
from datetime import datetime
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Paleta oficial Dino & Kytto
COR_FUNDO = "#0B1512"         # Verde escuro profundo executivo
COR_CARD = "#13231E"          # Card verde musgo escuro
COR_BORDA = "#1F3830"         # Borda sutil
COR_TEXTO_BRANCO = "#FFFFFF"  # Texto principal
COR_TEXTO_MUTED = "#8FA89B"   # Texto secundário
COR_TREX = "#10B981"          # Verde esmeralda (T-Rex KyttoIA)
COR_HUMANO = "#F59E0B"        # Laranja âmbar (Atendente Humano)
COR_CRITICO = "#EF4444"       # Vermelho alerta (Pico crítico / Cancelamento)
COR_CLIENTE = "#3B82F6"       # Azul suave (Cliente)
COR_AUDIO = "#8B5CF6"         # Roxo áudio
COR_GOLD = "#FBBF24"          # Dourado destaque

def gerar_infografico(dados, output_path):
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=COR_FUNDO)
    
    # Grid de 2x2 para os gráficos, deixando espaço para cabeçalho e rodapé
    
    # ── 1. CABEÇALHO EXECUTIVO ────────────────────────────────────────────────
    ax_header = fig.add_axes([0.04, 0.88, 0.92, 0.10], facecolor='none')
    ax_header.axis('off')
    
    data_formatada = dados.get('dataFormatada', datetime.now().strftime('%d/%m/%Y'))
    total_msgs = dados.get('totalMensagens', 591)
    total_clientes = dados.get('totalClientes', 82)
    
    ax_header.text(0.0, 0.70, "BARBEARIA DINO & PERFUMARIA", 
                   color=COR_GOLD, fontsize=14, weight='bold')
    ax_header.text(0.0, 0.25, "Relatório Diário de Performance & Auditoria Operacional", 
                   color=COR_TEXTO_BRANCO, fontsize=22, weight='heavy')
    
    meta_info = f"Auditado às 08h00 (Cuiabá/MT) • Base: {total_msgs} mensagens • {total_clientes} clientes • Motor KyttoIA"
    ax_header.text(1.0, 0.65, f"Data: {data_formatada}", 
                   color=COR_GOLD, fontsize=14, weight='bold', ha='right')
    ax_header.text(1.0, 0.25, meta_info, 
                   color=COR_TEXTO_MUTED, fontsize=11, ha='right')
    
    # Linha divisória sutil
    line = patches.Rectangle((0.04, 0.87), 0.92, 0.002, transform=fig.transFigure,
                             color=COR_BORDA, clip_on=False)
    fig.patches.append(line)

    # ── 2. GRÁFICO 1: DISTRIBUIÇÃO DE MENSAGENS (SUPERIOR ESQUERDO) ─────────
    ax1 = fig.add_axes([0.05, 0.52, 0.42, 0.31], facecolor=COR_CARD)
    for spine in ax1.spines.values():
        spine.set_color(COR_BORDA)
    ax1.set_title("1. Distribuição de Mensagens por Emissor", 
                  color=COR_TEXTO_BRANCO, fontsize=13, weight='bold', pad=12, loc='left')
    
    cat1 = ['Cliente\n(Texto)', 'T-Rex\n(KyttoIA)', 'Recepção\nHumana', 'Cliente\n(Áudio)']
    val1 = [dados.get('msgsClienteTexto', 257), 
            dados.get('msgsTrex', 204), 
            dados.get('msgsHumano', 95), 
            dados.get('msgsClienteAudio', 35)]
    cores1 = [COR_CLIENTE, COR_TREX, COR_HUMANO, COR_AUDIO]
    tot1 = sum(val1) or 1
    
    bars1 = ax1.bar(cat1, val1, color=cores1, width=0.55, edgecolor=COR_BORDA, linewidth=1.5)
    ax1.grid(axis='y', linestyle='--', alpha=0.15, color=COR_TEXTO_MUTED)
    ax1.tick_params(colors=COR_TEXTO_MUTED, labelsize=10)
    ax1.set_ylim(0, max(val1) * 1.25)
    
    for bar in bars1:
        yval = bar.get_height()
        pct = (yval / tot1) * 100
        ax1.text(bar.get_x() + bar.get_width()/2.0, yval + (max(val1)*0.03), 
                 f"{int(yval)}\n({pct:.1f}%)", ha='center', va='bottom', 
                 color=COR_TEXTO_BRANCO, fontsize=10.5, weight='bold')

    # ── 3. GRÁFICO 2: TEMPO MÉDIO DE RESPOSTA (SUPERIOR DIREITO) ─────────────
    ax2 = fig.add_axes([0.53, 0.52, 0.42, 0.31], facecolor=COR_CARD)
    for spine in ax2.spines.values():
        spine.set_color(COR_BORDA)
    ax2.set_title("2. Velocidade de Resposta ao Cliente (TMR)", 
                  color=COR_TEXTO_BRANCO, fontsize=13, weight='bold', pad=12, loc='left')
    
    cat2 = ['T-Rex (IA)\nInstantâneo', 'Humano\nMédia Geral', 'Humano\nPico Crítico']
    val2 = [dados.get('tmrTrexSegundos', 1.8) / 60.0,  # em minutos para escala
            dados.get('tmrHumanoMinutos', 11.7), 
            dados.get('tmrPicoMinutos', 62.0)]
    cores2 = [COR_TREX, COR_HUMANO, COR_CRITICO]
    
    bars2 = ax2.bar(cat2, val2, color=cores2, width=0.48, edgecolor=COR_BORDA, linewidth=1.5)
    ax2.grid(axis='y', linestyle='--', alpha=0.15, color=COR_TEXTO_MUTED)
    ax2.tick_params(colors=COR_TEXTO_MUTED, labelsize=10)
    ax2.set_ylabel("Minutos de Espera", color=COR_TEXTO_MUTED, fontsize=9.5)
    ax2.set_ylim(0, max(val2) * 1.22)
    
    labels2 = [f"1,8 seg\n(Instantâneo)", f"{dados.get('tmrHumanoMinutos', 11.7):.1f} min", f"{int(dados.get('tmrPicoMinutos', 62))} min\n(1h 02m)"]
    for i, bar in enumerate(bars2):
        yval = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2.0, yval + (max(val2)*0.03), 
                 labels2[i], ha='center', va='bottom', 
                 color=COR_TEXTO_BRANCO, fontsize=10.5, weight='bold')

    # ── 4. GRÁFICO 3: FUNIL COMERCIAL & OPERACIONAL (INFERIOR ESQUERDO) ─────
    ax3 = fig.add_axes([0.05, 0.12, 0.42, 0.32], facecolor=COR_CARD)
    for spine in ax3.spines.values():
        spine.set_color(COR_BORDA)
    ax3.set_title("3. Funil Comercial & Conversão de Agendamentos", 
                  color=COR_TEXTO_BRANCO, fontsize=13, weight='bold', pad=12, loc='left')
    
    cat3 = ['Contatos Totais', 'Interesse Agenda', 'Handoff Humano', 
            'Agendamentos OK', 'Cancelamentos', 'Upsell / Produtos']
    val3 = [dados.get('funilContatos', 82),
            dados.get('funilInteresse', 48),
            dados.get('funilHandoff', 39),
            dados.get('funilAgendados', 27),
            dados.get('funilCancelados', 11),
            dados.get('funilUpsell', 1)]
    cores3 = [COR_CLIENTE, '#0284C7', COR_HUMANO, COR_TREX, COR_CRITICO, COR_GOLD]
    
    bars3 = ax3.barh(cat3[::-1], val3[::-1], color=cores3[::-1], height=0.55, edgecolor=COR_BORDA, linewidth=1.5)
    ax3.grid(axis='x', linestyle='--', alpha=0.15, color=COR_TEXTO_MUTED)
    ax3.tick_params(colors=COR_TEXTO_MUTED, labelsize=9.5)
    ax3.set_xlim(0, max(val3) * 1.25)
    
    for bar in bars3:
        wval = bar.get_width()
        ax3.text(wval + (max(val3)*0.02), bar.get_y() + bar.get_height()/2.0, 
                 f"{int(wval)}", ha='left', va='center', 
                 color=COR_TEXTO_BRANCO, fontsize=10, weight='bold')

    # ── 5. GRÁFICO 4: DIAGNÓSTICO FINANCEIRO & DINHEIRO NA MESA (INFERIOR DIREITO) ──
    ax4 = fig.add_axes([0.53, 0.12, 0.42, 0.32], facecolor=COR_CARD)
    for spine in ax4.spines.values():
        spine.set_color(COR_BORDA)
    
    total_deixado = dados.get('perdaCancelamento', 800) + dados.get('perdaProdutos', 215) + dados.get('perdaUpsell', 336)
    ax4.set_title(f"4. Diagnóstico Financeiro • R$ {total_deixado:,.2f} Deixados na Mesa (48h)".replace(',', 'X').replace('.', ',').replace('X', '.'), 
                  color=COR_GOLD, fontsize=13, weight='bold', pad=12, loc='left')
    
    cat4 = ['Receita Confirmada\n(27 serviços)', 'Cancelamentos\nsem Remarcação', 'Produtos sem\nFechamento', 'Falta de Upsell\nem Agendados']
    val4 = [dados.get('receitaConfirmada', 3150.0),
            dados.get('perdaCancelamento', 800.0),
            dados.get('perdaProdutos', 215.0),
            dados.get('perdaUpsell', 336.0)]
    cores4 = [COR_TREX, COR_CRITICO, '#F97316', '#A855F7']
    
    bars4 = ax4.bar(cat4, val4, color=cores4, width=0.52, edgecolor=COR_BORDA, linewidth=1.5)
    ax4.grid(axis='y', linestyle='--', alpha=0.15, color=COR_TEXTO_MUTED)
    ax4.tick_params(colors=COR_TEXTO_MUTED, labelsize=9.5)
    ax4.set_ylabel("Valor Total (R$)", color=COR_TEXTO_MUTED, fontsize=9.5)
    ax4.set_ylim(0, max(val4) * 1.25)
    
    for bar in bars4:
        yval = bar.get_height()
        fmt_brl = f"R$ {yval:,.0f}".replace(',', '.')
        ax4.text(bar.get_x() + bar.get_width()/2.0, yval + (max(val4)*0.03), 
                 fmt_brl, ha='center', va='bottom', 
                 color=COR_TEXTO_BRANCO, fontsize=10, weight='bold')

    # ── 6. RODAPÉ DE DIRETRIZES DE SEGURANÇA & AÇÕES DIÁRIAS ────────────────
    ax_footer = fig.add_axes([0.04, 0.02, 0.92, 0.06], facecolor='none')
    ax_footer.axis('off')
    
    dica = "⚡ PLANO DO DIA: 1. Agilidade de Resposta Humana (Meta < 3 min) • 2. Resgate de Cancelamentos (Oferecer 2 opções) • 3. Oferta Ativa de Pomadas & Perfumaria"
    ax_footer.text(0.0, 0.5, dica, color=COR_GOLD, fontsize=10.5, weight='bold')
    ax_footer.text(1.0, 0.5, "Kytto ERP × WhatsApp Corporativo • Proteção Meta Anti-Ban Ativa", 
                   color=COR_TEXTO_MUTED, fontsize=9.5, ha='right')

    plt.savefig(output_path, dpi=100, facecolor=COR_FUNDO, edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"Infográfico salvo com sucesso em: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
        with open(sys.argv[2], 'r', encoding='utf-8') as f:
            dados = json.load(f)
    else:
        dados = {
            "dataFormatada": datetime.now().strftime("%d/%m/%Y"),
            "totalMensagens": 591,
            "totalClientes": 82,
            "msgsClienteTexto": 257,
            "msgsTrex": 204,
            "msgsHumano": 95,
            "msgsClienteAudio": 35,
            "tmrTrexSegundos": 1.8,
            "tmrHumanoMinutos": 11.7,
            "tmrPicoMinutos": 62.0,
            "funilContatos": 82,
            "funilInteresse": 48,
            "funilHandoff": 39,
            "funilAgendados": 27,
            "funilCancelados": 11,
            "funilUpsell": 1,
            "receitaConfirmada": 3150.0,
            "perdaCancelamento": 800.0,
            "perdaProdutos": 215.0,
            "perdaUpsell": 336.0
        }
    
    out_file = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/report_diario_trex_graficos.png"
    gerar_infografico(dados, out_file)
