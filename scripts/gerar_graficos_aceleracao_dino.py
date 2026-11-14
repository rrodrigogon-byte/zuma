import matplotlib.pyplot as plt
import numpy as np

# Configuração de estilo de alta fidelidade
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#cccccc'
plt.rcParams['axes.linewidth'] = 0.8

# -------------------------------------------------------------
# GRÁFICO 1: Diagnóstico SocialBlade & Curva de Reversão (@odinovisagista)
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 5), dpi=300)

dias_historico = np.array([-14, -10, -7, -4, -2, 0])
seguidores_historico = np.array([17061, 17043, 17035, 17025, 17020, 17020])

dias_projetado_passivo = np.array([0, 15, 30, 60, 90])
seguidores_passivo = np.array([17020, 16960, 16896, 16770, 16650])

dias_projetado_ativo = np.array([0, 15, 30, 60, 90])
seguidores_ativo = np.array([17020, 17400, 18100, 19800, 22500])

# Curva Real Auditada
ax.plot(dias_historico, seguidores_historico, 'o-', color='#d32f2f', linewidth=2.5, label='Histórico Real Auditado (-4 seg/dia)')

# Curva Cenário Passivo (Sem Mudança)
ax.plot(dias_projetado_passivo, seguidores_passivo, '--', color='#757575', linewidth=2.0, label='Tendência Atual (Inércia Stories: -124/mês)')

# Curva Cenário Acelerado KyttoIA
ax.plot(dias_projetado_ativo, seguidores_ativo, 's-', color='#1b5e20', linewidth=2.8, label='Projeção Aceleração KyttoIA (Reels + Visagismo + Árabes)')

ax.axvline(0, color='#0f2f57', linestyle=':', linewidth=1.5, alpha=0.8)
ax.text(1, 17100, 'INÍCIO DO PLANO DE ACELERAÇÃO', fontsize=8, color='#0f2f57', fontweight='bold')

ax.set_title('AUDITORIA SOCIALBLADE & CURVA DE RECUPERAÇÃO DO PERFIL @ODINOVISAGISTA', fontsize=12, fontweight='bold', pad=15, color='#0f2f57')
ax.set_xlabel('Linha do Tempo em Dias (0 = Hoje)', fontsize=10, labelpad=10)
ax.set_ylabel('Total de Seguidores Reais', fontsize=10, labelpad=10)
ax.grid(True, linestyle='--', alpha=0.3)
ax.legend(loc='center left', frameon=True, facecolor='#f8f9fa', edgecolor='#dddddd')

plt.tight_layout()
plt.savefig('/home/ubuntu/relatorio_dino_barbearia/grafico_socialblade_reversao.png')
plt.close()

# -------------------------------------------------------------
# GRÁFICO 2: Triângulo de Ouro Dino - Composição do Novo Faturamento
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)

categorias = [
    'Barbearia\n(Recuperação T-Rex\nBuracos de Agenda)',
    'Perfumaria na Cadeira\n(Ritual Borrifada\n150 un/mês)',
    'Instagram Direct\n(Social Commerce\nTGA e Região)',
    'Clube Dino Híbrido\n(Assinatura VIP\nRecorrente)',
    'TOTAL NOVO\nFATURAMENTO\n(Impacto Mensal)'
]

valores = [17000.0, 57000.0, 14400.0, 19920.0, 108320.0]
cores = ['#0288d1', '#7b1fa2', '#e65100', '#2e7d32', '#0f2f57']

barras = ax.bar(categorias, valores, color=cores, width=0.55, edgecolor='#333333', linewidth=0.8)

for bar in barras:
    yval = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2.0, yval + 1800, f'R$ {yval:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), ha='center', va='bottom', fontsize=9, fontweight='bold', color='#111111')

ax.set_ylim(0, 125000)
ax.set_title('PROJEÇÃO DE NOVO FATURAMENTO MENSAL — O TRIÂNGULO DE OURO DINO 360°', fontsize=12, fontweight='bold', pad=15, color='#0f2f57')
ax.set_ylabel('Receita Mensal Adicional (R$)', fontsize=10, labelpad=10)
ax.grid(axis='y', linestyle='--', alpha=0.3)

plt.tight_layout()
plt.savefig('/home/ubuntu/relatorio_dino_barbearia/grafico_triangulo_faturamento.png')
plt.close()

print("[OK] Gráficos de aceleração gerados com sucesso!")
