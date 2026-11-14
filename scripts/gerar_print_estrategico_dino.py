#!/usr/bin/env python3
"""
Gerador de Painel Executivo Visual (Print Estratégico Oficial)
Barbearia Dino & Perfumaria × Motor KyttoIA 2.5 Flash
Auditoria de 22.485 Atendimentos & Plano T-Rex de Ocupação da Agenda
"""

import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime

# Paleta oficial Dino Barbearia & Motor KyttoIA
BG_COLOR = "#0A1410"         # Verde petróleo escuro profundo
CARD_BG = "#12231C"          # Fundo dos cards operacionais
BORDER_COLOR = "#1D382D"     # Bordas executivas sutis
GOLD = "#F59E0B"             # Ouro âmbar (Destaques nobres)
GOLD_LIGHT = "#FDE68A"       # Ouro claro
TREX_GREEN = "#10B981"       # Verde Esmeralda T-Rex (Motor KyttoIA)
CRITICAL_RED = "#EF4444"     # Vermelho Alerta (Buracos / Ociosidade / Perda)
TEXT_WHITE = "#FFFFFF"       # Branco puro
TEXT_MUTED = "#94A3B8"       # Cinza claro legível
ACCENT_BLUE = "#38BDF8"      # Azul ciano para tecnologia

def gerar_print_estrategico(output_path):
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=BG_COLOR)
    
    # ── 1. CABEÇALHO EXECUTIVO ────────────────────────────────────────────────
    ax_header = fig.add_axes([0.04, 0.88, 0.92, 0.10], facecolor='none')
    ax_header.axis('off')
    
    ax_header.text(0.0, 0.75, "BARBEARIA DINO & PERFUMARIA  •  TANGARÁ DA SERRA / MT", 
                   color=GOLD, fontsize=13, weight='bold')
    ax_header.text(0.0, 0.25, "Plano Estratégico de Ocupação da Agenda & Resgate T-Rex", 
                   color=TEXT_WHITE, fontsize=21, weight='heavy')
    
    data_hoje = datetime.now().strftime('%d/%m/%Y')
    ax_header.text(1.0, 0.75, f"Canal: Gestão Dino (WhatsApp)  •  Data: {data_hoje}", 
                   color=GOLD_LIGHT, fontsize=12, weight='bold', ha='right')
    ax_header.text(1.0, 0.25, "Base Auditada: 22.485 Atendimentos • 15.468 Comandas • Motor KyttoIA 2.5 Flash", 
                   color=TEXT_MUTED, fontsize=11, ha='right')
    
    # Linha divisória dourada
    div_header = patches.Rectangle((0.04, 0.87), 0.92, 0.003, transform=fig.transFigure,
                                   color=GOLD, alpha=0.8, clip_on=False)
    fig.patches.append(div_header)

    # ── 2. CARD 1: MAPA DE OCUPAÇÃO DA SEMANA (SUPERIOR ESQUERDO) ───────────
    ax1 = fig.add_axes([0.04, 0.50, 0.44, 0.34], facecolor=CARD_BG)
    for s in ax1.spines.values(): s.set_color(BORDER_COLOR)
    ax1.set_title("1. Taxa de Ocupação Semanal — Segunda é Crítica (7,6%)", 
                  color=TEXT_WHITE, fontsize=12, weight='bold', pad=12, loc='left')
    
    dias = ['Segunda\n(Crítico)', 'Terça\n(Fraco)', 'Quarta\n(Médio)', 'Quinta\n(Regular)', 'Sexta\n(Forte)', 'Sábado\n(Lotado)']
    ocupacao = [7.6, 28.4, 44.2, 58.6, 88.5, 96.2]
    cores_dias = [CRITICAL_RED, '#F97316', '#EAB308', '#84CC16', TREX_GREEN, '#059669']
    
    bars1 = ax1.bar(dias, ocupacao, color=cores_dias, width=0.55, edgecolor=BORDER_COLOR, linewidth=1.2)
    ax1.grid(axis='y', linestyle='--', alpha=0.15, color=TEXT_MUTED)
    ax1.tick_params(colors=TEXT_MUTED, labelsize=9.5)
    ax1.set_ylabel("Ocupação da Agenda (%)", color=TEXT_MUTED, fontsize=9.5)
    ax1.set_ylim(0, 115)
    
    for bar in bars1:
        y = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2.0, y + 2.5, f"{y:.1f}%", 
                 ha='center', va='bottom', color=TEXT_WHITE, fontsize=10, weight='bold')

    # ── 3. CARD 2: DINHEIRO NA MESA (SUPERIOR DIREITO) ─────────────────────
    ax2 = fig.add_axes([0.52, 0.50, 0.44, 0.34], facecolor=CARD_BG)
    for s in ax2.spines.values(): s.set_color(BORDER_COLOR)
    ax2.set_title("2. Dinheiro Deixado na Mesa por Mês: R$ 42.500,00", 
                  color=TEXT_WHITE, fontsize=12, weight='bold', pad=12, loc='left')
    
    perdas_rotulos = ['Segundas-feiras\nVazias (Dia Todo)', 'Terça a Quinta\nManhãs (8h30-11h)', 'Terça a Quinta\nAlmoço (11h30-13h30)', 'No-shows e\nDesistências']
    perdas_valores = [18200, 11400, 7800, 5100]
    cores_perdas = [CRITICAL_RED, '#F97316', '#EAB308', '#64748B']
    
    bars2 = ax2.barh(perdas_rotulos[::-1], perdas_valores[::-1], color=cores_perdas[::-1], height=0.52, edgecolor=BORDER_COLOR, linewidth=1.2)
    ax2.grid(axis='x', linestyle='--', alpha=0.15, color=TEXT_MUTED)
    ax2.tick_params(colors=TEXT_MUTED, labelsize=9.5)
    ax2.set_xlabel("Receita Não Capturada (R$ / Mês)", color=TEXT_MUTED, fontsize=9.5)
    ax2.set_xlim(0, 22000)
    
    for bar in bars2:
        w = bar.get_width()
        ax2.text(w + 350, bar.get_y() + bar.get_height()/2.0, f"R$ {w:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'), 
                 ha='left', va='center', color=GOLD_LIGHT, fontsize=10, weight='bold')

    # ── 4. CARD 3: ESTRATÉGIA T-REX: 30% OFF HORÁRIOS FRACOS (INFERIOR ESQ) ───
    ax3 = fig.add_axes([0.04, 0.08, 0.44, 0.36], facecolor=CARD_BG)
    ax3.axis('off')
    
    card_rect1 = patches.FancyBboxPatch((0.02, 0.02), 0.96, 0.96, boxstyle="round,pad=0.03", 
                                        facecolor=CARD_BG, edgecolor=BORDER_COLOR, linewidth=1.5)
    ax3.add_patch(card_rect1)
    
    ax3.text(0.06, 0.88, "3. ESTRATÉGIA T-REX & CONDICIONAMENTO DE DESCONTOS", 
             color=GOLD, fontsize=11.5, weight='bold')
    
    linhas_estrategia = [
        ("• Publico-Alvo:", "Clientes ausentes ha mais de 60 dias da base auditada."),
        ("• 30% DE DESCONTO:", "RESTRITO EXCLUSIVAMENTE AOS HORARIOS FRACOS:"),
        ("   - Segunda-feira:", "O dia todo liberado (combate a ociosidade de 7,6%)."),
        ("   - Terca a Quinta:", "Manhas (08h30 as 11h00) ou Almoco Executivo (11h30 as 13h30)."),
        ("• Sexta e Sabado:", "ZERO desconto (preserva margem de 100% no pico)."),
        ("• +10% OFF NO CARTAO:", "Ao assinar Clube Dino (recorrencia garantida)."),
        ("• Mimo de Retorno:", "Cafe gourmet ou cerveja artesanal na chopeira.")
    ]
    
    y_pos = 0.74
    for rotulo, detalhe in linhas_estrategia:
        cor_rot = TREX_GREEN if "30%" in rotulo or "10%" in rotulo else TEXT_WHITE
        ax3.text(0.06, y_pos, rotulo, color=cor_rot, fontsize=9.5, weight='bold')
        ax3.text(0.38, y_pos, detalhe, color=TEXT_MUTED if "•" in rotulo and "30%" not in rotulo and "10%" not in rotulo else TEXT_WHITE, fontsize=9.2)
        y_pos -= 0.10

    # ── 5. CARD 4: METAS DE RECUPERAÇÃO & ANTI-BAN META (INFERIOR DIR) ─────
    ax4 = fig.add_axes([0.52, 0.08, 0.44, 0.36], facecolor=CARD_BG)
    ax4.axis('off')
    
    card_rect2 = patches.FancyBboxPatch((0.02, 0.02), 0.96, 0.96, boxstyle="round,pad=0.03", 
                                        facecolor=CARD_BG, edgecolor=BORDER_COLOR, linewidth=1.5)
    ax4.add_patch(card_rect2)
    
    ax4.text(0.06, 0.88, "4. META DE RESGATE & BLINDAGEM ANTI-BAN DA META", 
             color=GOLD, fontsize=11.5, weight='bold')
    
    linhas_metas = [
        ("• Meta Financeira:", "Resgatar R$ 26.500,00/mes dos R$ 42.500,00 perdidos."),
        ("• Meta de Ocupacao:", "Elevar Segunda-feira de 7,6% para 60,0% de ocupacao."),
        ("• Jitter Humanizado:", "Intervalo aleatorio de 45s a 90s entre disparos."),
        ("• 5 Variacoes Spintax:", "Copys dinamicas diferentes para cada cliente."),
        ("• Lotes Diarios:", "20 a 30 contatos/dia em horario comercial (09h30 as 17h)."),
        ("• Clausula Opt-out:", "Se cliente responder 'PARAR', descadastro instantaneo."),
        ("• Report Diario 20h:", "Disparo automatico no WhatsApp da Gestao Dino.")
    ]
    
    y_pos = 0.74
    for rotulo, detalhe in linhas_metas:
        cor_rot = ACCENT_BLUE if "Meta" in rotulo else (TREX_GREEN if "Jitter" in rotulo or "Spintax" in rotulo else TEXT_WHITE)
        ax4.text(0.06, y_pos, rotulo, color=cor_rot, fontsize=9.5, weight='bold')
        ax4.text(0.38, y_pos, detalhe, color=TEXT_WHITE if "R$" in detalhe else TEXT_MUTED, fontsize=9.2)
        y_pos -= 0.10

    # Salvar imagem
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=100, facecolor=BG_COLOR, bbox_inches='tight')
    plt.close()
    print(f"[OK] Print Estratégico gerado com sucesso: {output_path}")

if __name__ == '__main__':
    caminho = sys.argv[1] if len(sys.argv) > 1 else '/home/ubuntu/relatorio_dino_barbearia/print_estrategico_gestao_dino.png'
    gerar_print_estrategico(caminho)
