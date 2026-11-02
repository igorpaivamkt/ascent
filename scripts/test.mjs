// Executa os testes de domínio (tests/*.test.ts) com o runner nativo do Node.
// Os arquivos TypeScript são empacotados com esbuild e executados com `node --test`.
import * as esbuild from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const outdir = join(root, '.test-dist');
rmSync(outdir, { recursive: true, force: true });
const entries = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts')).map((f) => join(root, 'tests', f));
await esbuild.build({
  entryPoints: entries, bundle: true, platform: 'node', format: 'esm', outdir, outExtension: { '.js': '.mjs' },
  sourcemap: 'inline', logLevel: 'warning', target: 'node20',
});
const files = readdirSync(outdir).map((f) => join(outdir, f));
const r = spawnSync(process.execPath, ['--test', '--enable-source-maps', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
