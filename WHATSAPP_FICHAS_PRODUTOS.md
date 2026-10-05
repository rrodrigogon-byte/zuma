# Fichas de produtos no atendente Dino

## Comportamento

- `buscar_produtos` devolve atributos permitidos da variante: marca, concentração, família olfativa, apresentação e volume em ml. Não expõe campos livres internos.
- Volume vem de campo com unidade explícita ou texto do cadastro. Não assume que um número sem unidade significa ml; não escolhe um volume entre alternativas ambíguas.
- Busca específica com um único produto/variante prepara automaticamente a ficha. Nos demais casos, a IA seleciona produto e variante com `apresentar_produto`, após consultar o catálogo no mesmo turno.
- A resposta final inclui ficha montada pelo sistema: nome, descrição, volume, atributos existentes, preço, disponibilidade e link público da foto. Não cria pedido, cobrança ou envio separado. Até três fichas e 2400 caracteres de fichas por resposta; chamadas repetidas não duplicam.
- Ausência de imagem, descrição ou volume é informada. Produtos sob encomenda não ganham prazo inventado.
- Reserva de IA começa com catálogo/fichas vazios: não reaproveita seleção de tentativa anterior.

## Foto: limite atual

O contrato integrado do backend WhatsApp possui envio de texto por `/send`. O link público da foto é incluído; a prévia depende do WhatsApp. Este PR NÃO implementa envio binário de imagem/anexo, nem presume um endpoint de mídia sem documentação. Para concluir esse recurso, é necessário contrato homologado de envio de mídia do backend, com isolamento da instância e idempotência, seguido de teste pelo dono. O painel também indica sete produtos sem foto cadastrada: não usar imagem substituta sem identificar exatamente o produto.

## Aprendizado

O aprendizado diário existente respeita consentimento e revisão humana. A extração passa a distinguir interesse declarado em perfume/família olfativa de compra: perguntar preço não comprova compra. Preço, estoque, fotos, meios de pagamento e parcelamento não viram memória do cliente; vêm sempre da operação atual. Correções comerciais são propostas para revisão, nunca alterações automáticas do catálogo.

Verificação do painel em 05/10/2026: cérebro N2 ligado, cinco ciclos, um resumo por IA no ciclo de hoje e uma pergunta; zero fatos em uso. Isso não prova aprendizado permanente de cada cliente, que exige consentimento e fatos elegíveis.

## Teste após deploy aprovado

O dono envia pelo próprio celular: pergunta por produto específico; produto com variantes de 50/100 ml; kit 4x25 ml; produto sem foto/volume; encomenda; comparação de dois produtos. Conferir ficha, URL da foto e ausência de informação inventada. Nenhuma mensagem real é enviada pela suíte.

Sem variáveis novas, migrações ou alteração de configuração de produção. Merge e deploy somente após aprovação explícita do PR.
