// Edge Function do ASCENT (Deno). O motor de regras é o MESMO do aplicativo, empacotado em bundle.js
// por `npm run build:server`. Variáveis SUPABASE_* são injetadas automaticamente pelo Supabase.
// @ts-nocheck — arquivo executado pelo Deno, fora do tsconfig do app.
import { createEdgeHandler } from './bundle.js';

const handler = createEdgeHandler({
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ASCENT_ALLOWED_ORIGINS: Deno.env.get('ASCENT_ALLOWED_ORIGINS') ?? '',
  // Usuários liberados para cadastro e sincronização (só nomes, nunca senhas).
  // Um secret ASCENT_USERNAMES no painel (Edge Functions → Secrets), se existir, substitui esta lista.
  ASCENT_USERNAMES: Deno.env.get('ASCENT_USERNAMES') || 'igorpaiva,eduardogomes',
});

Deno.serve(handler);
