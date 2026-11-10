# -*- coding: utf-8 -*-
with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'r', encoding='utf-8') as f:
    c = f.read()

# Substituir o trecho 11
antigo_item11 = "11. **Perfil de Operador de Balcão e Atendimento da Dino Barbearia (Usuário Ster):** Criação e homologação do perfil oficial de operadora/atendente para Steffany Marielly de Oliveira (Ster) com credenciais ( / ), papel restrito  com escopo exclusivo na Barbearia Dino (), redirecionamento automático para a Agenda operacional, acesso liberado a comandas, agendamentos, clientes e caixa físico, e bloqueio de relatórios corporativos confidenciais da holding."

novo_item11 = "11. **Perfil de Operador de Balcão e Atendimento da Dino Barbearia (Usuário Ster):** Criação e homologação do perfil oficial de operadora/atendente para Steffany Marielly de Oliveira (Ster) com credenciais (`ster` / `123456`), papel restrito `operador` com escopo exclusivo na Barbearia Dino (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`), redirecionamento automático para a Agenda operacional, acesso liberado a comandas, agendamentos, clientes e caixa físico, e bloqueio de relatórios corporativos confidenciais da holding."

c = c.replace(antigo_item11, novo_item11)

# Substituir a seção 2.1 com a imagem correta
antiga_secao21 = """### 2.1. Painel do Operador — Sessão de Atendente da Ster (Barbearia Dino)
Tela operacional em produção () capturada na sessão oficial da operadora Ster (Steffany Marielly de Oliveira), exibindo o badge oficial OPERADOR, a grade completa da agenda de atendimentos, botões de agendamento e bloqueios, e isolamento total contra outras empresas da holding.


---"""

nova_secao21 = """### 2.1. Painel do Operador — Sessão de Atendente da Ster (Barbearia Dino)
Tela operacional em produção (`https://kytto.com.br/admin/barbearia-erp?area=operacao&tab=Agenda`) capturada na sessão oficial da operadora Ster (Steffany Marielly de Oliveira), exibindo o badge oficial OPERADOR, a grade completa da agenda de atendimentos da semana, botões de agendamento e bloqueios, e isolamento total contra outras empresas da holding.

![Painel do Operador - Sessão de Atendente da Ster](/home/ubuntu/agro-open/docs/prints/44-operador-atendente-ster-sessao-dino.png)

---"""

c = c.replace(antiga_secao21, nova_secao21)

with open('docs/RELATORIO-ISOLAMENTO-MULTITENANT-KYTTO.md', 'w', encoding='utf-8') as f:
    f.write(c)

print("Relatório v31 corrigido e salvo com sucesso!")
