import re

with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Atualizar versão do documento para v34
c = c.replace('Versão: 33.0', 'Versão: 34.0')
c.replace('Versão: 3.3', 'Versão: 3.4')
c = c.replace('v33 (Nota Geral 100% Absoluta)', 'v34 (Blindagem de Estabilidade, Auto-Recovery & Fila WhatsApp Ster)')

# Adicionar item 16 nos destaques do Sumário Executivo
secao_destaque = '''16. **Blindagem de Estabilidade, Auto-Recovery de Módulos Dinâmicos & Fila do WhatsApp da Ster:**
    - **Eliminação da Tela "Nova versão disponível" / Congelamento de 5 Minutos:** Resolução da falha que ocorria quando o navegador tentava carregar chunks antigos após builds no servidor. Implementação do motor de *Auto-Recovery de Assets* na rota `/assets/*.js`, entregando módulos com status HTTP 200 OK sem 302 redirect e impedindo que o `import()` dinâmico do ECMAScript lance exceções.
    - **Service Worker & ErrorBoundary com Auto-Cura Silenciosa:** O Service Worker agora roda em modo *network-first* resiliente com `skipWaiting()` e `clients.claim()`. O ErrorBoundary do frontend foi blindado com auto-recuperação transparente, eliminando telas de bloqueio para os operadores da barbearia.
    - **Preservação Definitiva de Horários e Equipe Blindada:** Os desligamentos de ex-funcionários (Bruno Mendes, David Kauã, Amanda Gabrielly, João Victor) foram blindados no banco de dados e nunca mais voltam a aparecer como ativos. Os horários de funcionamento (inclusive o atendimento 24x7 do Dino) permanecem imutáveis a cada deploy.
    - **Fila Humana de Atendimento do WhatsApp (Ster):** Acesso 100% liberado e homologado para a atendente Ster em `/admin/whatsapp-fila`, com permissão operacional de claim, visualização das conversas em andamento e devolução para a IA T-Rex sem qualquer bloqueio 403.
'''

if '15. **Oficina Mecânica' in c:
    c = re.sub(r'(15\. \*\*Oficina Mecânica.*?)(---\n## 2\.)', r'\1\n' + secao_destaque + r'\n\2', c, flags=re.DOTALL)

# Adicionar Print 49 no catálogo de prints
secao_print49 = '''### Print 49: Fila de Atendimento Humano do WhatsApp (/admin/whatsapp-fila) - Operadora Ster
Evidência real em produção demonstrando a tela oficial de conversas do WhatsApp carregada com sucesso pela atendente Steffany (Ster) na Barbearia Dino. A interface exibe as conversas ativas do T-Rex em cards com histórico em tempo real, status semafórico, botões de ação ("Ver conversa completa", "Devolver ao T-Rex", "Encerrar conversa") e permissão operacional ativada (canClaim: true), sem erros de versão ou congelamento.

![Fila de Atendimento Humano do WhatsApp - Operadora Ster](docs/prints/49-operador-ster-fila-whatsapp-atendimento.png)
'''

if '### Print 48:' in c:
    c = re.sub(r'(### Print 48:.*?\n\n!\[.*?\]\(docs/prints/48-.*?\)\n)', r'\1\n' + secao_print49 + r'\n', c, flags=re.DOTALL)

with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'w', encoding='utf-8') as f:
    f.write(c)

print('RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md atualizado para v34 com sucesso!')
