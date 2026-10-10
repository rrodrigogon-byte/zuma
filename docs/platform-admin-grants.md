# Administradores globais da plataforma

## Objetivo

A concessão global transforma uma identidade operacional Commerce aceita em uma **conta canônica `commerce_accounts`** com acesso administrativo a todas as empresas ativas. O fluxo é explícito, auditável e separado do formulário normal de contas: o formulário comum continua recusando `platform_owner`.

A fonte da identidade é uma linha `usuarios` com:

- usuário ativo;
- convite operacional usado (`commerce_operational_invites.status = 'used'`);
- membership operacional `store_admin` ativa e vigente; replay de `platform_owner` somente quando vinculado à mesma concessão e snapshot de origem;
- e-mail SQL único, sem homônimo no legado e sem caixa reservada.

A senha não é redefinida nem copiada em claro. A conta canônica reutiliza o hash bcrypt da identidade SQL original; respostas HTTP e auditorias são sanitizadas e não carregam senha, hash, token ou PII desnecessário.

## API de administração

Todas as rotas abaixo exigem autenticação e `Cache-Control: private, no-store`.

### Buscar candidatos e concessões

```http
GET /api/admin/platform/administrators?query=<busca>
```

A busca retorna `{ candidates, items }`. Com menos de três caracteres, `candidates` fica vazio. Candidatos são filtrados no servidor e não incluem identidades inativas, reservadas, homônimos legados ou contas com concessão global ativa. Os registros são sanitizados: não há senha, hash, token ou convite em claro.

### Conceder acesso global

```http
POST /api/admin/platform/administrators
Content-Type: application/json

{
  "sourceUserId": "<UUID>",
  "confirmGlobal": true,
  "expiresAt": null
}
```

`expiresAt` é opcional; quando informado, deve ser um timestamp ISO futuro. A confirmação booleana é obrigatória. A operação usa locks globais, de caixa postal e de empresa, cria ou reutiliza a conta canônica sem duplicar a identidade e sincroniza a membership `platform_owner` para as empresas ativas.

A resposta contém somente o resultado operacional (`ok`, `accountId`, `ativo`, `expiresAt`, `idempotent`). A repetição do mesmo grant e da mesma validade é idempotente, retorna `idempotent: true` e não cria uma nova auditoria.

Se um vínculo canônico já for o último `tenant_owner` ativo de uma empresa, ele é preservado; não se remove o proprietário para conferir acesso global. Vínculos locais necessários são derivados da mesma conta canônica, não representam contas independentes nem senhas novas.

### Revogar acesso global

```http
POST /api/admin/platform/administrators/:accountId/revoke
Content-Type: application/json

{ "confirmRevoke": true }
```

A confirmação é obrigatória. A revogação desativa o grant e restaura, a partir do snapshot persistido, a role, o estado ativo e a validade da membership anterior. Memberships e usuários locais criados exclusivamente pelo grant são desativados quando não possuem outro acesso. O próprio administrador global não pode revogar a própria conta.

## Quem pode operar

- **Administrador legado principal** (`mainAdmin`) e **administrador legado de plataforma** (`platformAdmin`) podem conceder e revogar.
- **Conta canônica global** só pode operar enquanto a consulta live confirma grant ativo e não expirado (`platformAdmin: true` e `pgPlatformAdmin: true` internamente).
- **Conta canônica tenant-bound**, `pgOperational`/`store_admin`, `tenant_owner` e demais perfis empresariais não podem conceder nem revogar.
- Uma tentativa de elevar a si mesmo é recusada antes de qualquer escrita. O próprio global também não pode executar auto-revogação.

As flags de um JWT não são autoridade. Para uma conta canônica, o servidor resolve a conta pelo `accountId` e revalida grant e memberships no PostgreSQL em cada requisição. Para uma sessão operacional antiga, uma mudança para `platform_owner` não a eleva automaticamente: o token operacional falha fechado até que a membership original seja restaurada ou que o usuário faça login canônico.

## Sessão, revogação e expiração

No login canônico durante grant ativo:

- `user.pgAccount` é `true`;
- `user.platformAdmin` é `true`;
- a sessão lista as empresas ativas sincronizadas;
- a mesma senha existente continua válida;
- a conta é tratada como global, mas ainda conserva contexto verificável por empresa/unidade para APIs que exigem escopo.

Após revogação, um JWT canônico antigo ainda pode resolver a **conta original** para endpoints permitidos ao perfil restaurado, mas não mantém poder global: rotas somente globais retornam `403`. O servidor não confia na flag antiga do token.

Após expiração, o grant continua armazenado para permitir revogação e restauração controladas, porém não concede acesso: login canônico e requisições com JWT canônico falham fechado até a revogação. A membership `platform_owner` não é tratada como fallback de autorização. A revogação restaura o snapshot original; somente então o login operacional original volta a funcionar.

## Escopo de dados e limites

O administrador global pode:

- ler `/api/admin/platform/commerce-tenants`;
- ler clientes em `/api/admin/commerce/customers` selecionando cada empresa autorizada;
- acessar a gestão de usuários/memberships (`users.write`) para cada empresa, com identidade e membership SQL verificadas live;
- usar os módulos administrativos empresariais autorizados pelo papel global.

O grant **não** elimina validações de tenant, loja ou storefront. Um `X-Empresa-Id` não autorizado, uma unidade de outra empresa ou um `storefrontId` de outra empresa/loja continua sendo recusado pelo servidor (`403`/`404`/`STORE_SCOPE_MISMATCH`, conforme o endpoint). O papel global inclui as permissões administrativas Commerce já existentes, inclusive as atribuídas ao `platform_owner`. Não há bypass para módulos financeiros legados, aprovações de operações consequentes ou validações que a rota não atribui ao contexto. Esta entrega não executa nenhuma operação financeira.

## Dados persistidos e auditoria

A migration **068** mantém:

- o grant global por `account_id`, com `ativo`, `expires_at`, ator e timestamps;
- snapshots por empresa da membership substituída/criada, incluindo role anterior, estado, validade e indicação de usuário local criado;
- auditoria append-only de concessão e revogação.

A auditoria registra somente identificadores, ação, validade e contagens necessárias para rastreabilidade. Não registra senha, hash, token, conteúdo do convite ou credencial de e-mail.

## Empresas futuras e reativação

A concessão inicial sincroniza todas as empresas ativas existentes. **Adicionar uma empresa depois não deve depender de um cache de sessão nem de uma leitura eventual do navegador.** O caminho oficial `provisionCommerceTenant` executa o sync dentro da mesma transação, sob o lock global de grants e lock da empresa, aplicando os grants ativos e não expirados antes do commit. Para administradores SQL use a fonte canônica estável `adminAccountId` / `adminSourceUserId`; múltiplas identidades com o mesmo e-mail não são escolhidas arbitrariamente.

Esse sync deve ser idempotente e manter os snapshots por `account_id`/empresa para que uma revogação posterior restaure exatamente o estado anterior. Empresas inativas não devem receber membership; uma empresa reativada deve passar pelo mesmo sync transacional antes de ser considerada disponível para a conta global.

## Evidência automatizada

`app/server-platform-grants.pg.test.js` é um harness standalone contra PostgreSQL real, opt-in por `PLATFORM_GRANTS_SERVER_TEST_DATABASE_URL`. Ele cria empresas, lojas, storefronts, clientes e identidades sintéticas locais; usa convite operacional já usado, bcrypt barato e um banco legado JSON sintético em subprocesso com `stdio: 'ignore'`. O teste cobre isolamento e negações, ausência de duplicata, preservação de senha/hash e identidades originais, idempotência sem auditoria duplicada, leitura global por empresa, validação cross-storefront, revogação de JWT antigo, auto-concessão/auto-revogação e expiração fail-closed.

O teste real também confirma concorrência de duas concessões (201 + 200, uma conta), rollback integral em falha de auditoria e provisionamento de empresa futura com fonte estável. Nenhuma concessão é semeada pela migration.
