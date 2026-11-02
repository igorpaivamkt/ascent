// Build / dev server do ASCENT baseado em esbuild.
// Uso: node scripts/build.mjs [build|dev|preview]
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outdir = join(root, 'dist');
const mode = process.argv[2] ?? 'build';
const isDev = mode === 'dev';

const options = {
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  outdir: join(outdir, 'assets'),
  entryNames: isDev ? '[name]' : '[name]-[hash]',
  assetNames: '[name]-[hash]',
  format: 'esm',
  splitting: false,
  target: ['es2020', 'chrome90', 'safari15', 'firefox95'],
  jsx: 'automatic',
  minify: !isDev,
  sourcemap: isDev ? 'inline' : 'linked',
  metafile: true,
  loader: { '.woff': 'file', '.woff2': 'file', '.svg': 'file', '.png': 'file' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version),
    __DEV__: String(isDev),
    // Servidor na nuvem (opcional): ASCENT_SUPABASE_URL e ASCENT_SUPABASE_ANON_KEY no ambiente do build.
    __ASCENT_CLOUD__: JSON.stringify(process.env.ASCENT_SUPABASE_URL && process.env.ASCENT_SUPABASE_ANON_KEY ? { url: process.env.ASCENT_SUPABASE_URL.replace(/\/+$/, ''), anonKey: process.env.ASCENT_SUPABASE_ANON_KEY } : null),
  },
  logLevel: 'info',
};

function copyPublic() {
  cpSync(join(root, 'public'), outdir, { recursive: true });
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(p.slice(base.length + 1).split('\\').join('/'));
  }
  return out;
}

function writeHtml(result) {
  const outputs = Object.keys(result.metafile.outputs);
  const rel = (p) => p.split('\\').join('/').replace(/^.*?dist\//, '');
  const js = outputs.map(rel).find((p) => p.endsWith('.js'));
  const css = outputs.map(rel).find((p) => p.endsWith('.css'));
  if (!js) throw new Error('Bundle JS não encontrado no metafile.');
  let html = readFileSync(join(root, 'index.html'), 'utf8');
  html = html
    .replace('<!--CSS-->', css ? `<link rel="stylesheet" href="./${css}" />` : '')
    .replace('<!--JS-->', `<script type="module" src="./${js}"></script>`)
    .replace('<!--DEV-->', isDev ? `<script>new EventSource('/esbuild').addEventListener('change', () => location.reload())</script>` : '');
  writeFileSync(join(outdir, 'index.html'), html);
}

function writeServiceWorker() {
  // Lista de pré-cache gerada a partir do build: o app abre offline depois da primeira visita.
  const files = listFiles(outdir).filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !f.startsWith('android'));
  const hash = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10);
  const template = readFileSync(join(root, 'src/sw-template.js'), 'utf8');
  const sw = template
    .replace('__CACHE_VERSION__', `ascent-${hash}`)
    .replace('__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
  writeFileSync(join(outdir, 'sw.js'), sw);
}

async function build() {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  copyPublic();
  const result = await esbuild.build(options);
  writeHtml(result);
  writeServiceWorker();
  const size = Object.entries(result.metafile.outputs)
    .filter(([p]) => !p.endsWith('.map'))
    .map(([p, o]) => `${p.replace(/^.*dist\//, '')}  ${(o.bytes / 1024).toFixed(1)} KB`);
  console.log('\nBuild concluído em dist/:\n  ' + size.join('\n  '));
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

function serveStatic(port) {
  createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(outdir, url === '/' ? 'index.html' : url);
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(readFileSync(join(outdir, 'index.html')));
    }
  }).listen(port, '0.0.0.0', () => console.log(`ASCENT disponível em http://localhost:${port} (e no IP da sua rede local)`));
}

if (mode === 'build') {
  await build();
} else if (mode === 'preview') {
  serveStatic(Number(process.env.PORT ?? 4173));
} else if (mode === 'dev') {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  copyPublic();
  const ctx = await esbuild.context({
    ...options,
    plugins: [{ name: 'html', setup(b) { b.onEnd((r) => { if (r.metafile) writeHtml(r); }); } }],
  });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: Number(process.env.PORT ?? 5173), host: '0.0.0.0', fallback: join(outdir, 'index.html') });
  console.log(`Dev server: http://localhost:${port}`);
}
