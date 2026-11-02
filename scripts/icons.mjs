// Gera os ícones PNG do PWA/Android a partir dos SVGs em public/icons (usa sharp se disponível).
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
let sharp;
try { sharp = (await import('sharp')).default; } catch { sharp = (await import('/opt/npm-tools/node_modules/sharp/dist/index.cjs')).default; }
const out = (n) => resolve(root, 'public/icons', n);
await sharp(out('icon.svg')).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(out('icon.svg')).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(out('maskable.svg')).resize(512, 512).png().toFile(out('maskable-512.png'));
await sharp(out('maskable.svg')).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
console.log('Ícones gerados em public/icons');
