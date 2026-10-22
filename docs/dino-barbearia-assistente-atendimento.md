# Assistente de atendimento — Dino Barbearia

## Status desta entrega

A implementação está em uma branch de desenvolvimento baseada em `fix/kytto-comandas-pdv-20260808`. O código **não foi mesclado, publicado ou habilitado na empresa real**. A confirmação automática começa desligada por padrão e exige alteração explícita por alguém da gestão da unidade.

A importação de cadastros e do histórico do Avec para o Kytto é uma atividade separada e **não foi executada por esta mudança**. Este pacote implementa as funcionalidades que usam o histórico do Kytto e adiciona guardas para associar linhas históricas à unidade autenticada sem criar agendamentos, comandas, recebimentos ou movimentos de estoque.

## 1. Confirmação e cancelamento automático

O fluxo é opt-in por empresa. Quando ativo e havendo consentimento de atendimento por WhatsApp e canal válido, o sistema agenda a primeira confirmação para 24 horas antes do atendimento. Para reservas feitas com menos de 24 horas de antecedência, a primeira etapa pode ser enviada imediatamente, desde que ainda exista uma janela segura.

A segunda mensagem é agendada para 2 horas e 15 minutos antes do atendimento. Isso reserva uma hora para o cliente responder e deixa 1 hora e 15 minutos antes do horário marcado para a equipe reutilizar a vaga. Reservas com menos de 3 horas e 15 minutos de antecedência não entram no cancelamento automático. A etapa seguinte só é enviada se a primeira tiver sido enviada com sucesso, o atendimento continuar pendente e o cliente não tiver confirmado.

Antes de cada envio e do cancelamento, a fila revalida o opt-in, o status e a unidade. Desativar a política impede o envio das etapas automáticas que já estavam pendentes; lembretes antigos sem marca de etapa também não são enviados enquanto o fluxo em duas etapas está ativo. Após o prazo, se o atendimento continuar pendente e a política permanecer ativa, registra o motivo `falta_confirmacao`, cancela uma única vez, libera o horário e aciona os avisos existentes para o cliente elegível e a equipe/lista de espera. Mensagens respeitam o consentimento de atendimento; o sistema não usa credenciais globais para enviar em nome de uma unidade. O worker existente processa a fila quando o provedor de mensagens está pronto.

A agenda administrativa, a timeline e o Modo Barbeiro diferenciam **Confirmado**, **Aguardando confirmação** e **Cancelado por falta de confirmação**. O cancelamento permanece no histórico com motivo e horário. Um lembrete já na fila é descartado se alguém confirmar o atendimento antes do envio.

## 2. Histórico individual do cliente

O painel de atendimento e o Customer 360 apresentam a última realização por procedimento e as últimas compras, com datas, contagens e fontes disponíveis. O histórico combina atendimentos concluídos na agenda, serviços em comandas faturadas, histórico importado e revendas pagas; estornos e transações pendentes são excluídos do cálculo de oportunidades. A mesma realização no mesmo dia não é contada duas vezes quando aparece em mais de uma fonte.

O vínculo é pelo identificador individual do cliente; o sistema não deduz a identidade apenas pelo telefone. Se o vínculo não estiver confirmado, o painel oculta histórico e recomendações. O histórico detalhado é buscado por cliente antes de aplicar o limite de retorno, para não truncar os registros daquele cliente por causa do volume total da loja. Se não houver unidade selecionada na sessão, o assistente oculta os dados em vez de combinar informações de lojas diferentes. Registros sem unidade identificável podem aparecer como contexto quando a unidade ativa é conhecida, mas não provocam oferta automática.

## 3. Recomendações de serviços e produtos

Cada serviço aceita um intervalo de recomendação em dias; `0` significa não sugerir automaticamente até a periodicidade ser configurada. O cálculo ignora o serviço do atendimento em curso e serviços já agendados. O profissional vê oportunidades cujo intervalo venceu e procedimentos recentes ou sem periodicidade, para reduzir ofertas repetitivas.

Cada produto aceita intervalo de recompra; sem configuração, o cálculo usa 30 dias como padrão. Uma oportunidade só aparece para produto previamente comprado pelo cliente, ativo, com estoque disponível e unidade conhecida. Produtos inativos ou sem estoque continuam, quando aplicável, no histórico, mas não são recomendados.

As recomendações são determinísticas e explicáveis. Elas não criam venda, comanda, cobrança, desconto ou mensagem e servem como apoio para o profissional validar a necessidade com o cliente.

## 4. Importação de histórico

A rotina aceita até 1.000 registros por lote. A unidade é vinculada pelo contexto autenticado da sessão quando a origem não informa uma; uma unidade conflitante é recusada. A deduplicação é limitada à empresa e usa origem, unidade, data/hora, contato/nome do cliente e nomes do serviço/profissional normalizados. A listagem permite até 50.000 ocorrências por cliente/unidade antes de qualquer limite de resposta.

O histórico importado não recria agenda operacional, comanda, recebimento, baixa ou movimento de estoque. A implementação funcional não equivale à importação do pacote Avec: o lote de origem ainda precisa de mapeamento e prévia contra os cadastros, serviços e unidade reais da Dino.

## 5. Salvaguardas e ativação

- A confirmação automática fica desligada por padrão.
- Somente `admin`, `organizador` ou `gerente` pode alterar o opt-in; a regra é protegida também no servidor.
- O cancelamento exige segunda confirmação enviada e prazo vencido; o processo é idempotente e restringido por empresa/unidade.
- O assistente consulta somente o cliente vinculado ao atendimento e, no Modo Barbeiro, respeita o profissional autenticado.
- Consentimento de atendimento por WhatsApp e configuração válida do canal são pré-requisitos de mensagens.
- Antes de habilitar em Dino: confirmar a empresa e unidade ativas, validar o canal e os consentimentos, configurar intervalos de serviço/produto e observar uma primeira janela de teste supervisionada.

## Verificações

Verificações aprovadas nesta branch:

- Testes focados de Customer 360, importação, assistente, escopo de unidade e notificações: **44/44**.
- `npm run test:node`: **1.728 testes, 1.643 aprovados, 85 ignorados, 0 falhas**.
- `npm run build` do frontend: concluído com sucesso.
