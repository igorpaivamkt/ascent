# Backend, contas e sincronização

## Como funciona

```
Aparelho                                   Supabase
────────                                   ────────
ação do usuário
  → motor valida (mesmas regras)           Auth (e-mail + senha)
  → fila local (funciona offline)
  → POST /functions/v1/ascent-sync/sync ─→ Edge Function `ascent-sync`
                                             · valida o token do usuário
                                             · reaplica o comando com o MESMO motor
                                             · ascent_commit(): transação no PostgreSQL
                                                 - versão otimista (outro aparelho gravou antes → reaplica)
                                                 - command_id único  → reenvio não duplica
                                                 - livros-razão com chave única (XP, moedas, conquistas, níveis)
                                                 - documento × livros-razão precisam bater
                                                 - saldo de moedas nunca negativo
                                                 - auditoria somente-inclusão
  ← estado confirmado + efeitos  ←──────────
XP, nível, conquistas e montanha só mudam aqui (efeitos exibidos uma única vez)
```

**Por que comandos e não "último a gravar vence":** o aparelho envia intenções ("concluí o hábito X no dia D"). O servidor as reaplica no estado mais recente. Dois aparelhos concluindo o mesmo hábito resultam em uma única recompensa, porque o motor calcula o XP líquido por ocorrência e o banco recusa chaves repetidas.

**Determinismo:** ids de entidades derivam do id do comando e a hora vem do aparelho (aceita até 30 dias no passado e 2 minutos no futuro). Aparelho e servidor chegam exatamente ao mesmo estado — verificado em teste.

## Segurança implementada

| Item | Como |
|---|---|
| Autenticação | Supabase Auth (e-mail e senha). Senha nunca é guardada no aparelho. |
| Tokens | Sessão em memória por padrão. "Manter conectado" guarda só o refresh token, com aviso. Sair remove token e cópia offline. |
| Isolamento entre usuários | RLS em todas as tabelas (`user_id = auth.uid()`), `FORCE ROW LEVEL SECURITY`. |
| Escrita | Usuários não escrevem em nenhuma tabela. Só as funções `SECURITY DEFINER`, executáveis apenas pela `service_role` (Edge Function). |
| Recompensas | Calculadas no servidor. Chaves únicas no banco; consistência documento × livros-razão verificada a cada gravação. |
| Histórico | Livros-razão, log de comandos e auditoria são imutáveis (trigger bloqueia UPDATE/DELETE, inclusive para a service_role). |
| Exclusão de conta | `DELETE …/account` → remove o usuário e todos os dados em cascata. |
| Migração do aparelho | Única por conta; recusa demonstração e recompensas fora das regras (valores, chaves, níveis, compras). |
| Chaves | A `service_role` existe só na Edge Function. O app usa a anon key, que é pública por natureza. |

**Ainda não feito (próximos passos de segurança):**
- endereço/CEP continuam dentro do documento JSON (protegidos por RLS e pela criptografia de disco do Supabase, mas não criptografados por campo — usar Supabase Vault/pgsodium);
- fotos ainda ficam só no aparelho (falta Supabase Storage com bucket privado);
- login social e MFA;
- limite de requisições por usuário na Edge Function (o Auth do Supabase já limita tentativas de login).

## Implantar (≈ 20 minutos)

Pré-requisitos: conta no Supabase, Node 20+, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Criar o projeto em https://supabase.com/dashboard (região São Paulo: sa-east-1)
#    Authentication → Providers → Email: habilitado. Recomendado: "Confirm email" ligado.

# 2. Vincular e aplicar o banco
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push                       # aplica supabase/migrations/*.sql

# 3. Empacotar e publicar a Edge Function (o motor do app vai junto)
npm run build:server                       # gera supabase/functions/ascent-sync/bundle.js
npx supabase functions deploy ascent-sync --no-verify-jwt
#    (--no-verify-jwt porque a função valida o token ela mesma e responde ao preflight CORS)

# 4. Restringir origens (opcional, recomendado)
npx supabase secrets set ASCENT_ALLOWED_ORIGINS=https://seu-dominio.com,capacitor://localhost,http://localhost

# 5. Gerar o app apontando para o projeto (Settings → API no painel)
ASCENT_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co \
ASCENT_SUPABASE_ANON_KEY=sua-anon-key \
npm run build
```

Depois, no app: **Configurações → Conta e sincronização → Criar conta**. Na primeira entrada você escolhe entre enviar a jornada deste aparelho (migração única, verificada) ou começar do zero.

> A versão publicada como página do Claude não consegue falar com servidores externos (restrição de segurança daquele ambiente). Para testar a nuvem, use `npm run preview`, uma hospedagem própria ou o APK.

## Testar sem nuvem

```bash
npm run mock:cloud                     # Supabase local em memória (Auth + a mesma Edge Function)
ASCENT_SUPABASE_URL=http://localhost:54321 ASCENT_SUPABASE_ANON_KEY=local-anon-key-local-anon-key npm run build
npm run preview
npm run check:cloud                    # E2E: conta, offline, sincronização, dois aparelhos, sair
```

`npm test` roda também os testes contra um **PostgreSQL real** (cria um cluster temporário se o PostgreSQL 15–17 estiver instalado): RLS, permissões, imutabilidade, saldo negativo, exclusão em cascata e todos os cenários de sincronização.

## Arquivos

| Caminho | Papel |
|---|---|
| `supabase/migrations/20261102120000_ascent_core.sql` | tabelas, RLS, triggers de imutabilidade, funções transacionais |
| `supabase/functions/ascent-sync/index.ts` | Edge Function (Deno) |
| `src/server/handler.ts` | lógica de sincronização independente de runtime |
| `src/server/http.ts` | rotas HTTP (status, state, sync, import, account) |
| `src/server/supabaseDb.ts` | acesso ao banco via PostgREST com service_role |
| `src/server/memoryDb.ts` | banco em memória com as mesmas garantias (testes/mock) |
| `src/domain/sync.ts` | envelope de comando, determinismo, delta dos livros-razão, validação de migração |
| `src/services/cloud/*` | login, transporte HTTP, fila offline e sincronização no aparelho |
| `tests/db.test.ts`, `tests/sync*.test.ts`, `scripts/cloud-check.cjs` | testes |
