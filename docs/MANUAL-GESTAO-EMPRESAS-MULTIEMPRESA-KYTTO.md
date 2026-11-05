# Manual Operacional: Gestão de Empresas & Multiempresa Kytto

**ERP Kytto · Barbearia Dino · Stallone Nutre Sport · AGRO OPEN TTC**  
*Documento Oficial de Homologação e Operação Multiempresa*  
*Versão: 2.5 · Data: Novembro/2026*

---

## 1. Visão Geral do Módulo Multiempresa

O **Módulo de Gestão de Empresas & Multiempresa Kytto** foi desenvolvido para centralizar a administração de todas as empresas e unidades da rede com **isolamento absoluto e autonomia operacional**. Cada empresa cadastrada possui regras contábeis, regimes fiscais (NFC-e/NFS-e), estoques, cardápios, planos, comandas, clientes e permissões totalmente segregados e protegidos contra vazamento de dados.

O sistema atende simultaneamente às empresas ativas no ecossistema:
1. **Barbearia Dino** (DINO BARBEARIA LTDA · CNPJ 50.073.355/0002-60 · Inscrição Estadual 14.229.191-9): Barbearia, estética e perfumaria premium.
2. **Stallone Nutre Sport** (E. P. DE SOUZA LTDA · CNPJ 56.099.531/0001-38): Loja especializada em suplementação, nutrição esportiva e produtos naturais.
3. **AGRO OPEN TTC** (AGRO OPEN TTC · CNPJ 43.084.070/0001-88): Complexo esportivo de tênis/beach tennis, bar, conveniência e eventos.

---

## 2. Visão Geral da Interface de Empresas

O gestor tem acesso à visão panorâmica em cards interativos com busca em tempo real por Nome, Razão Social, CNPJ ou Cidade, além de filtros avançados por segmento de mercado e status operacional.

![Visão Geral da Gestão de Empresas](/home/ubuntu/agro-open/docs/prints-empresas/01_gestao_empresas_visao_geral.png)

### Principais Indicadores por Empresa:
- **Identificação Completa:** Nome Fantasia comercial e Razão Social oficial registrada na Receita Federal.
- **Documentação Fiscal:** CNPJ formatado com máscara e validação de dígitos, Inscrição Estadual (IE) e Inscrição Municipal (IM).
- **Segmento & Atividade:** Barbearia & Perfumaria, Suplementos, Complexo Esportivo, Bar & Restaurante ou Varejo.
- **Unidades & Lojas:** Contador de filiais ativas associadas à matriz.
- **Endereço Completo:** Logradouro, número, complemento, bairro, cidade, UF e CEP com integração automática ViaCEP.
- **Contatos Oficiais:** Telefone / WhatsApp, E-mail corporativo e Website.
- **Sessão em Uso:** Indicador destacado da empresa ativa no momento da operação.

---

## 3. Como Cadastrar uma Nova Empresa (+ Nova Empresa)

Para cadastrar uma nova matriz ou filial com autonomia multiempresa:

1. Acesse o menu lateral em **Empresas** (ou navegue diretamente para `https://kytto.com.br/admin/empresas`).
2. Clique no botão de destaque superior **`+ Nova Empresa`**.
3. O sistema exibirá o modal inteligente organizado em 4 seções operacionais:

![Modal de Cadastro de Nova Empresa](/home/ubuntu/agro-open/docs/prints-empresas/02_modal_nova_empresa.png)

### Campos do Formulário:

| Bloco | Campo | Obrigatório | Descrição / Exemplo |
| :--- | :--- | :---: | :--- |
| **1. Identificação Jurídica** | Nome Comercial (Fantasia) | **Sim** | Ex: *Stallone Nutre Sport*, *Barbearia Dino* |
| | Razão Social Oficial | **Sim** | Ex: *E. P. DE SOUZA LTDA*, *DINO BARBEARIA LTDA* |
| | CNPJ | Não (rascunho) | 14 dígitos numéricos com formatação automática |
| | Inscrição Estadual (IE) | Opcional | Ex: *14.229.191-9* (para emissão de NFC-e na SEFAZ) |
| | Inscrição Municipal (IM) | Opcional | Código de inscrição no município (NFS-e Sefin) |
| | Segmento / Tipo | **Sim** | Barbearia, Suplementos, Esporte, Bar, etc. |
| **2. Endereço Fiscal** | CEP | Opcional | 8 dígitos. O botão `🔍` busca rua, bairro e cidade no ViaCEP |
| | Logradouro e Número | Opcional | Ex: *Av. Brasil, nº 500-W* |
| | Complemento e Bairro | Opcional | Ex: *Sala 02, Centro* |
| | Cidade e Estado (UF) | **Sim** | Ex: *Tangará da Serra / MT* |
| **3. Contatos** | Telefone / WhatsApp | Opcional | Número de contato para suporte e clientes |
| | E-mail Corporativo | Opcional | E-mail oficial da empresa |
| | Website | Opcional | Link do catálogo público ou domínio próprio |
| **4. Unidade & Admin** | Criar Unidade Matriz | Opcional | Cria a loja matriz inicial no PostgreSQL automaticamente |
| | Permitir Estoque Negativo | Opcional | Habilita venda no PDV mesmo sem saldo em estoque |
| | Administrador Inicial | Opcional | Cadastra usuário com e-mail e senha inicial (mín. 6 dígitos) |

Ao clicar em **Cadastrar Empresa**, o registro é inserido no PostgreSQL, sincronizado no Datastore JSON e disparado como evento interno no barramento multiempresa.

---

## 4. Como Editar e Modificar Informações de Empresas

O sistema permite alterar livremente qualquer informação de qualquer empresa já cadastrada:

1. Na lista de empresas, localize a empresa desejada e clique em **`✏️ Editar`**.
2. O modal será carregado com todos os dados atuais previamente preenchidos:

![Modal de Edição de Empresa](/home/ubuntu/agro-open/docs/prints-empresas/03_modal_editar_empresa.png)

3. Modifique os campos desejados (telefone, endereço, razão social, CNPJ, Inscrição Estadual, etc.).
4. Clique em **`Salvar Alterações`**. As atualizações são aplicadas imediatamente em tempo real.

---

## 5. Inativação e Reativação Segura de Empresas

- Para **inativar** uma empresa temporariamente (sem perder histórico de vendas, comandas ou notas emitidas), clique no botão **`Inativar`** no card da empresa e confirme.
- Para **reativar**, utilize o filtro de status selecionando **"Somente Inativas"** e clique em **`Reativar`**.
- **Trava de Segurança:** A empresa principal da Barbearia Dino (`d0d0ac01-8e50-4b61-8c79-de4aaa916da6`) é protegida contra exclusão acidental por ser o núcleo do ERP.

---

## 6. Alternância Rápida de Empresa Ativa (Multi-Tenant)

O gestor que administra mais de um negócio não precisa fazer logout para alternar de empresa:
- Basta clicar no botão **`⚡ Operar nesta`** no card da empresa desejada.
- A sessão autenticada é imediatamente alternada para a empresa selecionada, redirecionando o escopo de comandas, estoque, financeiro e notas fiscais para a empresa escolhida.

---

## 7. Arquitetura de Sincronização por Evento Interno

Conforme os padrões de governança do Kytto, toda operação de inclusão, alteração ou inativação de empresas emite um evento no barramento interno:
```javascript
barramentoA2.emit('cadastro_atualizado', {
  empresaId,
  tipo: 'empresas',
  acao: 'inserir' | 'atualizar' | 'excluir',
  id: empresaId,
  payload: dto
});
```
Isso garante consistência instantânea entre PostgreSQL, Datastore JSON, memória de trabalho e módulos de retaguarda sem dependência de polling externo.

---

*Manual homologado para produção no ERP Kytto · 2026.*
