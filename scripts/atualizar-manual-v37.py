import re

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Atualiza versao no cabecalho
c = c.replace('Versão 3.6', 'Versão 3.7')
c = c.replace('Versão: 3.6', 'Versão: 3.7')

secao_manual = """
## 15. Procedimentos de Blindagem de Equipe, Gestão de Horários & Fila Humana WhatsApp

### 15.1. Regras de Ouro da Equipe Oficial da Dino Barbearia
Para garantir a estabilidade do negócio e prevenir qualquer divergência nos agendamentos ou no atendimento automatizado da IA T-Rex:
1. **Barbeiros Titulares Homologados:**
   - **Guilherme Cunha Martins (Dino):** Master Barber & Fundador. Atendimento 24x7 (horário padrão das 00:00 às 23:59). Cobrança de tarifa especial noturna de R$ 600,00 para atendimentos solicitados entre 18:00 e 06:00.
   - **Bruno Mendes Pedroso (Bruno):** Barbeiro Especialista em Corte, Barba e Procedimentos de Pacote. Horário de funcionamento cadastrado das 08:00 às 20:00. Comissões configuradas em 40% para serviços (com bonificação progressiva de 45%, 47% e 50% nas metas de faturamento) e 10% para produtos (comissões de bebidas são R$ 0,00).
   - **Natani Minanis Dobler (Nati):** Hair Stylist Especialista em Química Capilar e Visagismo. Horário oficial das 07:00 às 19:00. Comissões de 40% a 50% de acordo com as faixas de metas.
2. **Recepção, Atendimento e Caixa:**
   - **Steffany Marielly de Oliveira (Ster):** Atendente e Operadora de Balcão (Recepção, Agenda, Comandas e Caixa). Acesso exclusivo com login `ster` e senha padrão `123456`.
   - **Jhenyffer Andrade:** Administradora Geral de Unidade.
3. **Expurgo Permanente de Ex-Funcionários:**
   - Amanda Gabrielly, David Kauã e João Victor foram definitivamente inativados no PostgreSQL (`usuarios_lojas.ativo = false`) e no ERP Kytto. Nenhuma atualização de versão ou rotina de inicialização poderá reativá-los.

### 15.2. Operação da Fila Humana de Atendimento do WhatsApp (`/admin/whatsapp-fila`)
1. **Acesso pela Atendente:**
   - A operadora de balcão (Ster) faz login no endereço `https://kytto.com.br/admin` utilizando o usuário `ster`.
   - No menu lateral ou pelo link direto `/admin/whatsapp-fila`, o painel é carregado com as conversas ativas em tempo real.
2. **Atendimento e Ações Disponíveis:**
   - **Card Vermelho (🚨 Coleta Urgente):** O cliente solicitou falar com um atendente humano ou a IA T-Rex identificou uma dúvida que requer intervenção imediata. O atendente clica em **"Assumir conversa"** para responder diretamente pelo chat lateral.
   - **Devolver ao T-Rex:** Após tirar a dúvida do cliente, o atendente pode devolver a conversa ao T-Rex clicando em **"Devolver ao T-Rex"**, permitindo que a IA retome o agendamento e a confirmação automática.
   - **Encerrar conversa:** Conversas finalizadas são arquivadas no histórico com o botão **"Encerrar conversa"**. Se o cliente enviar uma nova mensagem no WhatsApp, o T-Rex atende automaticamente.
"""

if '## 15. Procedimentos de Blindagem de Equipe' not in c:
    c += secao_manual

with open('docs/MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md', 'w', encoding='utf-8') as f:
    f.write(c)

print('MANUAL-OFICIAL-KYTTO-TEF-E-MULTIEMPRESA.md atualizado para versao 3.7 com sucesso!')
