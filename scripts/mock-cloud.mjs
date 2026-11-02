// Sobe um "Supabase" local em memória (Auth + Edge Function) para testar login e sincronização sem nuvem.
// Uso: npm run mock:cloud   e, em outro terminal:
//      ASCENT_SUPABASE_URL=http://localhost:54321 ASCENT_SUPABASE_ANON_KEY=local-anon-key-local-anon-key npm run build && npm run preview
import * as esbuild from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.test-dist/mock-cloud.mjs');
await esbuild.build({ entryPoints: [resolve(root, 'tests/support/mockCloud.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning' });
const { startMockCloud } = await import(pathToFileURL(out).href);
const port = Number(process.env.PORT ?? 54321);
startMockCloud(port);
console.log(`Supabase local (memória) em http://localhost:${port}`);
