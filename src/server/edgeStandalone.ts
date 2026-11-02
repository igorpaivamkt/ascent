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
    // Administrador: id interno da conta no Supabase Auth (não é segredo). Um secret com o mesmo nome substitui.
  ASCENT_ADMIN_IDS: Deno.env.get('ASCENT_ADMIN_IDS') || '0b72824d-1be7-46f2-8757-e088e08bd6e1',
  // Cadastro pela tela de acesso: fechado por padrão (contas novas são criadas na Administração).
  ASCENT_USERNAMES: Deno.env.get('ASCENT_USERNAMES') ?? '',
  }),
);
