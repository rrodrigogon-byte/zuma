# Gestão de contas e acessos multiempresa

## Objetivo
Permitir cadastrar usuários com login, clientes sem acesso administrativo, administradores empresariais e demais perfis, e atribuir acesso a uma ou várias empresas. A conta possui uma credencial; cada empresa possui vínculo, papel, unidade e validade independentes.

## Arquitetura
Preservar os usuários SQL locais, as FKs compostas e o RBAC Commerce. Adicionar uma conta canônica PostgreSQL (`commerce_accounts`) e uma ligação explícita de seu ID global aos IDs SQL locais (`commerce_account_users`). A resolução de sessão usa esses IDs, não combina pessoas automaticamente por e-mail. Logins JSON legados e convites operacionais existentes permanecem compatíveis; a gestão global pode importar uma identidade existente apenas por ID selecionado e registra a origem. Não alterar permissões das contas existentes por migração.

O administrador da plataforma/principal gerencia contas e concessões multempresa. O administrador empresarial continua limitado à sua empresa e aos papéis permitidos pelo RBAC. Os novos formulários não concedem administração da plataforma: administrador da empresa e administrador da loja são perfis empresariais.

## Interface
Reutilizar a estética e os estilos do backoffice existente: títulos claros, formulários em diálogo com avisos dentro do diálogo e lista de vínculos por empresa. Acrescentar ações distintas para criar usuário, cadastrar cliente e associar conta existente. Cada linha empresarial permite escolher perfil, unidade e validade; o resumo é explícito antes de salvar. Não compartilhar automaticamente clientes ou dados entre empresas. Estado de envio de e-mail continua separado de acesso efetivamente concedido.

## Implementação
- `app/migrations/067_commerce_accounts.sql`: conta global, ligação explícita, auditoria de gestão e constraints.
- `app/core/commerce-accounts.js`: criação, importação por ID, concessão, autenticação, sessão e revogação.
- `app/core/commerce-account-routes.js`: rotas administrativas protegidas, sem configuração externa ou credenciais no retorno.
- `app/server.js` e `commerce-identity-bridge.js`: integrar login/validação por requisição e identidade SQL local.
- `web/src/pages/admin/CommerceAccountManager.jsx`: criar usuários e clientes e selecionar múltiplas empresas com perfis independentes.

## Limites
Não executar cadastro de pessoa real, envio de e-mail real nem concessão de acesso em produção durante a implementação. Não mudar Render, WhatsApp ou migrations já aplicadas. Entregar alterações em PR para `fix/kytto-comandas-pdv-20260808`; publicação exige confirmação do payload atualizado, pois acrescenta mecanismos de acesso.

## Fluxos disponíveis nesta entrega
- **Criar usuário:** conta PostgreSQL com senha inicial informada no formulário, perfil/unidade/validade independentes em cada empresa. A senha não é retornada nem enviada por e-mail; criação direta não depende do canal transacional.
- **Cadastrar cliente:** registros comerciais separados por empresa, sem credencial, membership ou acesso ao painel. O cadastro existente da aba Clientes continua disponível aos perfis que tenham `customers.write`.
- **Associar conta existente:** importar uma identidade legada ou Commerce explicitamente pelo ID selecionado, preservando a credencial e os vínculos de origem. Não importar contas administrativas da plataforma, e-mails reservados, identidade sem bcrypt compatível, convite ainda pendente ou homônimos ambíguos.
- **Gerenciar empresas:** preservar escopos existentes, acrescentar novos vínculos e alterar perfil, estado e validade. Desativar uma conta bloqueia a sessão na próxima requisição, sem apagar histórico. O último administrador empresarial ativo não pode ser removido.
- **Perfis especializados:** catálogo, estoque, pedidos, financeiro e suporte obedecem às permissões Commerce. Não recebem automaticamente gestão do ERP legado da barbearia; esse módulo fica disponível aos administradores da empresa/loja.
- **Convite nominal:** permanece separado da criação direta, com aceite individual e papel operacional atual. A página e o e-mail foram modernizados. Senhas de conta e de convite têm mínimo de 12 caracteres, complexidade e máximo de 72 bytes UTF-8, para evitar truncamento do bcrypt.

## Validação
Testes unitários, interação React, integração de servidor com PostgreSQL local descartável, compatibilidade do login legado e build Vite. E-mails usados nos testes são sintéticos e os provedores transacionais são simulados. A inspeção visual da página/e-mail usa prévia local e token fictício; nenhum convite real é aceito ou enviado.
