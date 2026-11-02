// Edge Function do ASCENT (Deno). O motor de regras é o MESMO do aplicativo, empacotado em bundle.js
// por `npm run build:server`. Variáveis SUPABASE_* são injetadas automaticamente pelo Supabase.
// @ts-nocheck — arquivo executado pelo Deno, fora do tsconfig do app.
import { createEdgeHandler } from './bundle.js';

const handler = createEdgeHandler({
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ASCENT_ALLOWED_ORIGINS: Deno.env.get('ASCENT_ALLOWED_ORIGINS') ?? '',
});

Deno.serve(handler);
