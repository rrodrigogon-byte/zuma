# Manual Oficial do Usuário: Sorteios & Campanhas Premiadas Kytto
## Guia Operacional Executivo para Barbearia Dino, Perfumaria e E-commerce

---

**Plataforma:** Kytto Commerce & ERP Multi-Tenant  
**Módulo:** Sorteios & Campanhas Premiadas Oficiais  
**Unidade Piloto:** Barbearia Dino (Tangará da Serra / MT)  
**Versão do Documento:** 1.0 (Novembro/2026)  
**Responsável Técnico:** Rodrigo Gonçalves / Equipe de Engenharia Kytto  
**Classificação:** Documento Oficial de Treinamento e Operação  

---

## Sumário Executivo

1. [Visão Geral & Objetivos Estratégicos](#1-visão-geral--objetivos-estratégicos)
2. [Regras de Pontuação & Mecânica de Geração de Bilhetes](#2-regras-de-pontuação--mecânica-de-geração-de-bilhetes)
3. [Guia Passo a Passo no Painel Administrativo](#3-guia-passo-a-passo-no-painel-administrativo)
   * 3.1. Como Criar uma Nova Campanha
   * 3.2. Visualização de Indicadores e Métricas
   * 3.3. Emissão Manual de Bilhetes de Cortesia no Balcão
   * 3.4. Exportação de Participantes em CSV para Auditoria
   * 3.5. Realização do Sorteio ao Vivo (Roleta Digital com Som)
   * 3.6. Notificação do Ganhador Oficial via WhatsApp
4. [Guia do Cliente: Portal Público de Consulta (`/sorteios/dino`)](#4-guia-do-cliente-portal-público-de-consulta)
5. [Auditoria Criptográfica & Conformidade Jurídica](#5-auditoria-criptográfica--conformidade-jurídica)
6. [Scripts de Vendas & Abordagem para Barbeiros e Balcão](#6-scripts-de-vendas--abordagem-para-barbeiros-e-balcão)
7. [Perguntas Frequentes (FAQ) & Suporte Operacional](#7-perguntas-frequentes-faq--suporte-operacional)

---

## 1. Visão Geral & Objetivos Estratégicos

O módulo de **Sorteios & Campanhas Premiadas Kytto** foi desenvolvido especificamente para potencializar os três pilares de receita dos negócios de Dino:
1. **Barbearia Dino:** Atendimentos presenciais de cabelo, barba, sobrancelha e combos.
2. **Loja Física de Produtos & Perfumaria:** Venda no balcão de pomadas, óleos para barba, xampus especiais e perfumes finos masculinos.
3. **E-commerce & Loja Online:** Vendas digitais de cosméticos e perfumes para entrega ou retirada.

### Principais Objetivos do Módulo:
* **Elevação do Ticket Médio:** Estimular o cliente a adicionar mais serviços ou adquirir um produto no fechamento da comanda para alcançar múltiplos de R$ 50,00 e ganhar mais bilhetes.
* **Aceleração da Perfumaria (Multiplicador 2x):** Transformar a perfumaria em carro-chefe de vendas por meio de pontuação dobrada.
* **Retenção & Fidelização (Clube Dino):** Conceder vantagens automáticas para assinantes mensais.
* **Credibilidade Imutável:** Eliminar qualquer suspeita de fraude através de sorteador eletrônico auditado via criptografia segura SHA-256 (padrão RFC 7518).

---

## 2. Regras de Pontuação & Mecânica de Geração de Bilhetes

O sistema utiliza cálculo dinâmico baseado no carrinho ou comanda faturada:

| Tipo de Consumo | Regra de Pontuação | Exemplo Prático |
| :--- | :--- | :--- |
| **Serviços de Barbearia** | **1 Bilhete a cada R$ 50,00** gastos | Corte (R$ 60,00) = **1 Bilhete**.<br>Combo Corte + Barba (R$ 110,00) = **2 Bilhetes**. |
| **Perfumaria & Cosméticos** | **2 Bilhetes a cada R$ 50,00 (2x)** | Perfume Importado (R$ 250,00) = **10 Bilhetes**! |
| **Membros do Clube Dino** | **+3 Bilhetes Bônus** | Assinante ativo ganha 3 bilhetes extras de largada em toda campanha. |
| **Cortesia Gerencial** | **Definida pelo Gestor** | Emissão avulsa no balcão para premiar clientes especiais ou ações promocionais. |

### Estrutura do Número da Sorte:
* Cada bilhete emitido possui o formato oficial: `SÉRIE 01 - Nº XXXXXX` (6 dígitos sequenciais gerados unicamente por empresa).
* Cada bilhete é carimbado digitalmente com data, hora, ID da comanda/venda, dados do cliente e um hash SHA-256 anti-adulteração.

---

## 3. Guia Passo a Passo no Painel Administrativo

Acesse a interface administrativa através de:  
👉 **URL:** [https://kytto.com.br/admin/sorteios](https://kytto.com.br/admin/sorteios)  
*(Também acessível pelo menu superior `+ Criar / Lançar` > `🎁 Sorteios & Prêmios` ou pela aba de Relacionamento no ERP).*

### 3.1. Como Criar uma Nova Campanha
1. No canto superior direito da tela, clique no botão dourado **`+ Nova Campanha`**.
2. Preencha os campos obrigatórios:
   * **Título da Campanha:** Ex.: *Edição Especial de Natal: Moto 0km & Kit Perfumaria de Luxo*.
   * **Prêmio Principal:** Ex.: *Moto Honda Fan 160 0km (ou R$ 18.000 no Pix)*.
   * **R$ Mínimo por Bilhete:** Padrão R$ 50,00 (ajustável conforme estratégia).
   * **Multiplicador Perfumaria:** Padrão 2x (incentivo para venda de produtos).
   * **Bônus Clube Dino:** Padrão 3 bilhetes extras.
   * **Data Oficial do Sorteio:** Selecione a data prevista para a apuração.
3. Clique em **`Salvar e Publicar Campanha`**. A campanha entra imediatamente no ar no caixa, balcão e no portal público.

---

### 3.2. Visualização de Indicadores e Métricas
No topo da página, quatro cartões executivos informam o desempenho em tempo real:
* **Campanhas Ativas:** Quantidade de campanhas em andamento.
* **Números da Sorte:** Total consolidado de bilhetes distribuídos.
* **Perfumaria & Compras:** Multiplicador de pontuação ativo (**2x**).
* **Auditoria Kytto:** Status de integridade criptográfica (**100% Cripto SHA-256**).

---

### 3.3. Emissão Manual de Bilhetes de Cortesia no Balcão
Caso Dino ou o gerente deseje presentear um cliente no balcão:
1. Clique na aba **`Emitir Bilhete Manual (Balcão)`**.
2. Selecione a campanha ativa.
3. Informe o **Nome Completo** e o **WhatsApp com DDD** do cliente.
4. Digite a quantidade de bilhetes desejada e o motivo (ex.: *Cortesia por compra de perfume importado no balcão*).
5. Clique em **`Gerar e Emitir Números da Sorte`**.
6. **Novidade:** Um card verde comemorativo surge na tela com o botão **`Enviar no WhatsApp do Cliente`**. Ao clicar, o WhatsApp Web se abre automaticamente com o texto oficial e os números gerados para o cliente!

---

### 3.4. Exportação de Participantes em CSV para Auditoria
1. Clique na aba **`Bilhetes & Participantes`**.
2. Você pode pesquisar qualquer cliente pelo nome, telefone ou número da sorte.
3. Clique no botão **`Exportar CSV`**.
4. O sistema gera instantaneamente uma planilha estruturada contendo:
   * Número da Sorte
   * Nome do Cliente
   * Telefone / WhatsApp
   * Origem (Barbearia, Perfumaria ou Balcão)
   * Valor da Compra (R$)
   * Data e Hora de Emissão
   * Status e Hash Criptográfico

---

### 3.5. Realização do Sorteio ao Vivo (Roleta Digital com Som)
Para realizar o sorteio ao vivo (em live no Instagram, no telão da barbearia ou diante de testemunhas):
1. Clique na aba **`Sorteador ao Vivo (Roleta & Apuração)`**.
2. O palco digital exibirá o título da campanha, o prêmio em disputa e o display do tambor eletrônico luminoso.
3. Clique no botão gigante **`REALIZAR SORTEIO AO VIVO`**.
4. **Efeito Sonoro & Visual:** O tambor começará a girar em alta velocidade com cliques de áudio que desaceleram progressivamente criando suspense (3 segundos).
5. Ao parar, o sistema emite uma fanfarra triunfante e revela o **Grande Ganhador Oficial**, com nome, telefone, bilhete sorteado e o selo de auditoria criptográfica.

---

### 3.6. Notificação do Ganhador Oficial via WhatsApp
Assim que o ganhador for sorteado:
1. No card do ganhador revelado, clique em **`Notificar no WhatsApp`**.
2. O sistema gera automaticamente uma mensagem oficial comemorativa com o prêmio, número da sorte e código de autenticidade, abrindo diretamente a conversa com o ganhador.

---

## 4. Guia do Cliente: Portal Público de Consulta

Os clientes da Barbearia Dino podem consultar seus bilhetes a qualquer momento de forma independente, transparente e gratuita:

👉 **Endereço Público:** [https://kytto.com.br/sorteios/dino](https://kytto.com.br/sorteios/dino)

### O que o Cliente Encontra na Página:
1. **Contagem Regressiva ao Vivo:** Relógio marcando dias, horas e minutos para o sorteio.
2. **Card do Prêmio Principal:** Imagem em alta definição e lista completa de todos os prêmios da edição.
3. **Consulta por WhatsApp:** O cliente digita seu telefone com DDD (com máscara automática `(65) 99999-9999`) e clica em **`Ver Meus Bilhetes`**.
4. **Lista de Bilhetes:** Exibe todos os números da sorte do cliente, identificando a origem (💈 Barbearia, ✨ Perfumaria ou 🎟️ Balcão) e destacando se foi premiado.
5. **Botão "Guardar no WhatsApp":** Permite ao cliente encaminhar seus próprios bilhetes para si mesmo ou compartilhar no status.
6. **Conversão Imediata:** Botões para **Agendar Horário na Barbearia** e **Comprar Perfumes com 2x Pontos**, estimulando novas compras.
7. **Regulamento Oficial & Hall de Ganhadores:** Lista dos ganhadores anteriores com nome e telefone anonimizados para conformidade com a LGPD.

---

## 5. Auditoria Criptográfica & Conformidade Jurídica

Para garantir a total lisura e idoneidade dos sorteios, o módulo utiliza criptografia de ponta:

* **Algoritmo de Seleção:** Utiliza a função hash criptográfica **SHA-256** combinando sementes imprevisíveis (Timestamp em nanossegundos + ID único da campanha + Hash do bloco anterior + Salt aleatório criptograficamente seguro via `crypto.randomBytes`).
* **Determinismo Auditável:** O hash gerado aponta de forma estritamente uniforme para o índice exato do bilhete vencedor.
* **Imutabilidade:** O hash de auditoria é gravado no banco de dados com chave imutável, permitindo que qualquer auditor matemático ou autoridade comprove que o resultado não foi alterado nem manipulado.
* **Proteção LGPD:** No portal público e no hall de ganhadores, os nomes e telefones são parcialmente ocultados (ex.: *Rodrigo G. • (65) *****-6008*), resguardando os dados pessoais dos clientes.

---

## 6. Scripts de Vendas & Abordagem para Barbeiros e Balcão

O sucesso do sorteio depende da comunicação entusiasmada de toda a equipe. Abaixo estão scripts validados para uso no dia a dia:

### Script 1: Barbeiro na Cadeira (Aumento de Ticket Médio)
> *"Fala, [Nome do Cliente]! Sabia que a cada R$ 50 aqui na barbearia você ganha um Número da Sorte oficial para concorrer à Moto 0km e kits de perfumes? Seu corte deu R$ 60, então você já garantiu 1 número. Se você fizer a barba agora ou levar essa pomada fixadora por mais R$ 45, sua comanda vai para R$ 105 e você já sai daqui com 2 números da sorte na hora!"*

### Script 2: Atendente no Caixa / Balcão (Venda de Perfumaria 2x)
> *"Boa tarde, [Nome do Cliente]! Hoje na Barbearia Dino todos os perfumes importados e cosméticos estão pontuando **EM DOBRO** no sorteio da Moto 0km! A cada R$ 50 em perfumes você ganha 2 bilhetes em vez de 1. Se você levar esse perfume que acabou de chegar, além de ficar cheiroso para o fim de semana, você já sai com 10 bilhetes de uma vez concorrendo!"*

### Script 3: Envio de WhatsApp para Clientes que Não Retornam
> *"Olá [Nome do Cliente], tudo bem? Aqui é da Barbearia Dino! Passando para avisar que lançamos o nosso Mega Sorteio de Fim de Ano com Moto 0km, 1 ano de cortes grátis e kits de perfumes importados! Ao agendar seu horário nesta semana, sua comanda já gera seus bilhetes automaticamente. Vamos garantir seu horário com o Dino ou com a equipe? É só responder com o dia que você prefere!"*

---

## 7. Perguntas Frequentes (FAQ) & Suporte Operacional

**P: O cliente precisa guardar comprovante em papel?**  
*R: Não! O sistema é 100% digital. Basta o cliente acessar `kytto.com.br/sorteios/dino` e digitar o WhatsApp para visualizar todos os seus bilhetes a qualquer momento.*

**P: E se o cliente comprar pela loja online (e-commerce)?**  
*R: O e-commerce Kytto está integrado. Assim que o pagamento do pedido é aprovado, os bilhetes correspondentes são gerados automaticamente para o telefone cadastrado pelo comprador.*

**P: É possível sortear mais de um prêmio na mesma campanha?**  
*R: Sim! Cada campanha pode ter múltiplos prêmios cadastrados (1º, 2º, 3º e 4º lugares). A roleta pode ser acionada sequencialmente para cada posição.*

**P: Quem tem direito aos bilhetes do Clube Dino?**  
*R: Todos os clientes com assinaturas ativas no módulo de Planos & Assinaturas Kytto recebem a bonificação configurada (padrão: +3 bilhetes de largada).*

---

*Documento homologado e aprovado para operação na Barbearia Dino, Perfumaria e Loja Kytto.*
