// Empacota o servidor (motor de domínio + handler) num único módulo ES para a Edge Function do Supabase.
import * as esbuild from 'esbuild';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
await esbuild.build({
  entryPoints: [resolve(root, 'src/server/edgeEntry.ts')],
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', minify: false,
  outfile: resolve(root, 'supabase/functions/ascent-sync/bundle.js'),
  banner: { js: '// Gerado por scripts/build-server.mjs — não editar.' },
  logLevel: 'info',
});

// Arquivo único (para o editor do painel do Supabase)
await esbuild.build({
  entryPoints: [resolve(root, 'src/server/edgeStandalone.ts')],
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', minify: true,
  outfile: resolve(root, 'supabase/functions/ascent-sync/standalone.js'),
  banner: { js: '// ASCENT ascent-sync — arquivo único gerado por scripts/build-server.mjs' },
  logLevel: 'info',
});
