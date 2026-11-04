# Manual de Operação e Divulgação: Agendamento Online por Barbeiro

![Kytto](/home/ubuntu/manual-assets/kytto_logo.png)

---

## 1. Visão Geral da Funcionalidade

O **Kytto** disponibiliza a solução completa e responsiva de **Agendamento Online Individual por Barbeiro**, permitindo que cada profissional da barbearia tenha seu próprio canal direto de captação de clientes para divulgar no Instagram (Bio e Stories), WhatsApp e na própria bancada de atendimento.

### Principais Inovações e Ajustes Aplicados:
1. **Catálogo Exclusivo por Profissional:** Ao acessar o link de um barbeiro (ex.: Nati, Bruno, Dino, João), o catálogo de serviços filtra automaticamente e exibe **apenas os serviços que aquele barbeiro realmente executa**. Serviços exclusivos de outros barbeiros (como "Barba com Dino", "Corte do João" ou "Manicure") não poluem a tela nem correm o risco de travar o agendamento do cliente.
2. **Seleção Inversa Inteligente (Serviço Primeiro):** Quando o cliente acessa o link geral da barbearia e escolhe o serviço antes do profissional, o passo seguinte exibe unicamente os profissionais habilitados para aquele serviço específico.
3. **Blindagem Absoluta de Privacidade:** A agenda do profissional exibe apenas se cada horário está **Livre** ou **Ocupado**. Nenhum nome de outro cliente, telefone ou dado interno é exposto publicamente.
4. **Validação Rigorosa de CPF e Telefone:** O sistema valida matematicamente o CPF através do algoritmo oficial da Receita Federal (dígitos verificadores) e formata automaticamente o WhatsApp com DDD.
5. **Vínculo Automático com a Base Ativa:** O agendamento é vinculado instantaneamente ao cadastro ativo existente do cliente pelo CPF ou Telefone. Se for um cliente novo, o sistema cria o cadastro automaticamente na base Kytto com status ativo.
6. **Divulgação Multicanal Integrada:** Botões prontos para cópia do link, envio no WhatsApp, textos prontos para a Bio e Stories do Instagram e QR Code em alta definição para impressão.

---

## 2. Links Oficiais dos Barbeiros (Barbearia Dino)

Cada profissional possui sua URL canônica e responsiva:

| Profissional | Link Direto de Agendamento | Link WhatsApp Direto |
| :--- | :--- | :--- |
| **Natani (Nati)** | `https://kytto.com.br/agendar/dino/nati` | [Agendar com Nati](https://kytto.com.br/agendar/dino/nati) |
| **Bruno Mendes** | `https://kytto.com.br/agendar/dino/bruno` | [Agendar com Bruno](https://kytto.com.br/agendar/dino/bruno) |
| **Dino** | `https://kytto.com.br/agendar/dino/dino` | [Agendar com Dino](https://kytto.com.br/agendar/dino/dino) |
| **Ester Oliveira** | `https://kytto.com.br/agendar/dino/ester` | [Agendar com Ester](https://kytto.com.br/agendar/dino/ester) |
| **João Victor** | `https://kytto.com.br/agendar/dino/joao-victor-domingos-ruedel` | [Agendar com João Victor](https://kytto.com.br/agendar/dino/joao-victor-domingos-ruedel) |
| **David Kauã** | `https://kytto.com.br/agendar/dino/david` | [Agendar com David](https://kytto.com.br/agendar/dino/david) |
| **Amanda Gabrielly** | `https://kytto.com.br/agendar/dino/amanda` | [Agendar com Amanda](https://kytto.com.br/agendar/dino/amanda) |
| **Link Geral Barbearia** | `https://kytto.com.br/agendar/dino` | [Ver Equipe Completa](https://kytto.com.br/agendar/dino) |

---

## 3. O App do Barbeiro (`/barbeiro`) e o Painel "Meu Link"

Os barbeiros acessam sua rotina diária através do **App da Equipe** no celular (`https://kytto.com.br/barbeiro`), que pode ser instalado como aplicativo (PWA) direto na tela inicial.

![App da Equipe](/home/ubuntu/manual-assets/app_barbeiro_login.png)

### Nova Aba "Meu Link":
Dentro do App, o barbeiro acessa a aba **🔗 Meu Link** (no topo ou no menu inferior), onde encontra:
- **Copiar Link:** copia o link direto para a área de transferência do celular com 1 toque.
- **Enviar no WhatsApp:** abre o WhatsApp com mensagem amigável convidando o cliente a agendar.
- **Texto para Bio do Instagram:** copia a chamada perfeita para colocar na Bio do perfil profissional:
  > *✂️ Agende seu corte ou barba direto comigo pelo link:*  
  > *👉 https://kytto.com.br/agendar/dino/nati*
- **Texto para Stories do Instagram:** texto pronto para colar junto com a figurinha de link dos Stories:
  > *🔥 Horários disponíveis para esta semana! Toque no link abaixo e garanta sua vaga:*  
  > *👉 https://kytto.com.br/agendar/dino/nati*
- **QR Code Exclusivo:** exibição do QR Code na tela para o cliente escanear na bancada ou no espelho.

![Painel Meu Link](/home/ubuntu/manual-assets/painel_meu_link_barbeiro.png)

### Troca de Senha pelo Próprio Profissional no Aplicativo:
Para garantir total privacidade e segurança no acesso diário, o profissional pode alterar sua própria senha diretamente no aplicativo:
1. **Onde Acessar:** tocando no botão **🔑 Senha** no cabeçalho superior do aplicativo, ou na seção **🔐 Segurança da Conta** dentro de **⭐ Perfil**.
2. **Formulário de 3 Etapas Consecutivas:**
   - **Senha Atual:** digita a senha atual cadastrada (validada no servidor);
   - **Nova Senha:** digita a nova combinação (mínimo de 6 caracteres, com indicador dinâmico de conformidade);
   - **Confirmar Nova Senha:** digita a nova senha novamente (com validação em tempo real que avisa se houver divergência).
3. **Alternador de Visibilidade:** todos os três campos possuem o botão de visualização (🔒 / 👁️) para conferência antes de salvar.
4. **Atualização Imediata:** ao clicar em **"Salvar Nova Senha"**, a senha é criptografada e salva, e o token do aplicativo é renovado na hora, mantendo o barbeiro logado normalmente.

![Modal de Troca de Senha](/home/ubuntu/manual-assets/card_trocar_senha.png)

### Lançamento de Itens Adicionais e Serviços Extras na Comanda
Cada profissional (a exemplo da Nati, Bruno, Dino, David, etc.) pode adicionar itens a mais na comanda do cliente ou lançar produtos adicionais vendidos na bancada:
1. **Como Lançar:** no card do atendimento em andamento, clicar em **+ Extra / Produto** (ou no botão flutuante **+ Venda**).
2. **Catálogo Integrado:** buscar pelo serviço ou produto desejado (ex.: Limpeza de Pele, Barboterapia, Pomadas, etc.).
3. **Ajuste de Quantidade:** usar os botões **+** e **−** ou digitar diretamente o número no campo de quantidade (ex.: 6 unidades).
4. **Subtotal Automático:** o app calcula o valor unitário e o total (ex.: 6 × R$ 60,00 = R$ 360,00).
5. **Contabilização Precisa:** o sistema computa **todas as unidades individuais** vendidas:
   - Se a comanda contém 6 limpezas de pele, o sistema soma **6 serviços extras** na meta diária da profissional, no ranking e no Desafio Semanal.
   - Ao atingir a meta diária (ex.: 6 ou 7 extras no dia), o sistema libera automaticamente um **Giro na Roleta de Prêmios Dino** no aplicativo da profissional.
6. **Conferência no Caixa:** o caixa recebe a comanda com a quantidade exata de cada item para conferência e recebimento.

#### Prints das Melhorias em Produção:

**1. Lançamento com Controle de Quantidade na Comanda:**
![Lançamento de Múltiplos Extras na Comanda](/home/ubuntu/manual-assets/print_comanda_multiplos_extras.png)

**2. Metas Diárias com 6 Extras Computados (86%):**
![Metas com Extras Computados](/home/ubuntu/manual-assets/print_metas_extras_nati.png)

**3. Painel Administrativo de Auditoria com Coluna de Quantidade (Qtd):**
![Painel de Auditoria de Metas com Quantidades](/home/ubuntu/manual-assets/print_admin_detalhes_roleta_nati.png)

---

## 4. Passo a Passo do Cliente ao Agendar

### Passo 1: Seleção de Serviço (Exclusivo do Barbeiro)
Ao abrir o link do barbeiro (por exemplo, da **Nati**), o cliente visualiza o cabeçalho personalizado *"Agendamento com Nati"* e a indicação *"Serviços de Nati (15)"*. Apenas os serviços que a Nati realiza são exibidos. Procedimentos de outros barbeiros são automaticamente omitidos.

![Passo 1 - Serviços da Nati](/home/ubuntu/screenshots/kytto_br_2026-11-03_02-24-13_8024.webp)

---

### Passo 2: Navegação por Datas e Horários Livres (Com Blindagem de Privacidade)
O cliente conta com:
- **Carrossel horizontal dos próximos 14 dias:** botões rápidos (*Hoje*, *Amanhã*, *SEX*, *SÁB*...) para troca imediata de data.
- **Calendário completo:** para selecionar qualquer data futura.
- **Slots de Horário:** o cliente visualiza estritamente os horários **Livre** (clicáveis em roxo/azul) e **Ocupado** (bloqueados e em cinza). A privacidade da barbearia é 100% preservada — nenhum dado de outros clientes é visível.

![Passo 2 - Horários e Privacidade](/home/ubuntu/manual-assets/passo2_horarios_privacidade.png)

---

### Passo 3: Dados do Cliente e Vínculo Automático por CPF
Após escolher o horário, o cliente preenche:
1. **Nome Completo**
2. **CPF:** validado matematicamente em tempo real (dígitos verificadores da Receita Federal). Caso o cliente digite um número errado, o sistema avisa imediatamente antes do envio.
3. **WhatsApp com DDD:** formatado automaticamente `(00) 00000-0000`.
4. **Consentimento LGPD:** opção para receber lembretes e confirmações por WhatsApp.

![Passo 3 - Cadastro e CPF](/home/ubuntu/manual-assets/passo3_cadastro_cpf.png)

---

## 5. Como o Sistema Vincula o Agendamento ao Cadastro Ativo

Ao clicar em **"✅ Confirmar Agendamento"**:
1. O backend do Kytto busca clientes existentes na empresa:
   - **1ª Verificação:** busca por correspondência exata do **CPF**.
   - **2ª Verificação:** busca por correspondência do **WhatsApp/Telefone**.
2. **Se o cliente já existir na base:**
   - O agendamento é vinculado ao cadastro existente (`clienteId`).
   - Se o cadastro antigo não possuía CPF registrado, o sistema completa a ficha cadastral do cliente com o novo CPF validado.
   - Não são gerados cadastros duplicados.
3. **Se for um cliente novo:**
   - É criado automaticamente um cadastro ativo com Nome, CPF, WhatsApp e etiqueta de origem `agendamento_online`.
4. O horário é reservado na agenda do barbeiro em tempo real e o cliente recebe seu código de agendamento alfanumérico para consultar, remarcar ou cancelar quando desejar.

---

## 6. Boas Práticas para a Equipe de Barbeiros

1. **Fixar na Bio do Instagram:** todo barbeiro deve manter o link no campo "Site" ou "Links" do seu perfil profissional no Instagram.
2. **Postar nos Stories da Manhã:** ao iniciar o dia, compartilhe os horários vagos e adicione a figurinha de link apontando para o seu link individual.
3. **Imprimir o QR Code para a Bancada:** imprima o QR Code gerado e deixe visível na sua bancada. Quando o cliente estiver finalizando o corte, convide-o a escanear e já garantir o próximo atendimento para dali a 15 ou 20 dias.
4. **Status do WhatsApp:** divulgue o link semanalmente no status do WhatsApp para os contatos que já cortam cabelo com você.

---

*Documento gerado pelo Kytto — Plataforma de Inteligência e Gestão Comercial.*  
*Versão do Sistema: Produção (Live) | Novembro/2026*
