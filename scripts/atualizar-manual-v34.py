import re

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Atualizar versão do manual para 3.4
c = c.replace('Versão: 3.3', 'Versão: 3.4')
c = c.replace('Versão 3.3', 'Versão 3.4')

secao_manual_fila = '''
---
## 19. Operação da Fila de Atendimento Humano do WhatsApp (/admin/whatsapp-fila)

A Fila de Atendimento Humano do WhatsApp é a central onde os atendentes e recepcionistas da barbearia (como a operadora Ster) interagem com os clientes que solicitam intervenção humana ou quando a inteligência artificial T-Rex conclui o pré-atendimento.

### 19.1 Como Acessar e Operar a Fila
1. **Acesso Direto:** Acesse a rota `/admin/whatsapp-fila` pelo navegador. O sistema identifica automaticamente o perfil de operador e conecta a sessão à Dino Barbearia e à Matriz de Tangará da Serra MT, sem exigir parâmetros manuais.
2. **Visualização das Conversas:** As conversas ativas são exibidas em cards com o número mascarado do cliente, última mensagem enviada, transcrição de áudios em tempo real e tempo de espera.
3. **Status das Mensagens:**
   - **Coleta Urgente:** Mensagens que demandam resposta humana imediata (ex.: cancelamentos complexos, dúvidas de pagamento ou solicitações de gestores).
   - **Com T-Rex:** Atendimentos que estão sendo conduzidos de forma 100% autônoma pelo assistente de IA.
   - **Com Atendentes:** Conversas assumidas pela equipe humana.
4. **Ações Disponíveis:**
   - **Ver conversa completa:** Abre a linha do tempo com todo o histórico de mensagens trocadas entre o cliente, o T-Rex e os atendentes.
   - **Devolver ao T-Rex:** Transfere a conversa de volta para o agente autônomo continuar o fluxo de agendamento.
   - **Encerrar conversa:** Conclui o chamado arquivando o histórico no Customer 360 do cliente.

![Fila de Atendimento Humano do WhatsApp - Operadora Ster](docs/prints/49-operador-ster-fila-whatsapp-atendimento.png)
'''

# Inserir antes da conclusão ou anexos
if '## 20.' not in c and '## 19.' not in c:
    c = c + '\n' + secao_manual_fila

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print('MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md atualizado para v3.4 com sucesso!')
