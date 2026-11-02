// Versão em arquivo único da Edge Function, para colar no editor do painel do Supabase
// (Edge Functions → Deploy a new function → Via editor). Gerada por `npm run build:server`.
import { createEdgeHandler } from './edgeEntry';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

Deno.serve(
  createEdgeHandler({
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    ASCENT_ALLOWED_ORIGINS: Deno.env.get('ASCENT_ALLOWED_ORIGINS') ?? '',
  }),
);
