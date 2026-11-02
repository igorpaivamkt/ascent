# Do protótipo ao APK

Três formas de distribuição, independentes entre si. A aplicação web continua funcionando em qualquer uma.

## 1. Web responsiva (pronto)
`npm run build && npm run preview` → abra no navegador do computador ou do celular na mesma rede.

## 2. PWA instalável (pronto)
Requer HTTPS. Publique `dist/` em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, Cloudflare Pages…). No Android/Chrome: menu ⋮ → **Instalar app**. Depois da primeira visita o app abre offline (service worker com pré-cache gerado a cada build).

## 3. APK com Capacitor (preparado, **ainda não gerado nem testado**)

O que já está pronto no projeto:
- `capacitor.config.json` (`appId: br.com.ascent.app`, `webDir: dist`).
- Roteador por hash e caminhos relativos (`./assets/…`) — funcionam dentro do WebView sem servidor.
- Regras de negócio sem APIs do navegador; o acesso ao armazenamento passa por `StateRepository`, e o service worker é isolado em `src/services/pwa.ts`.
- Layout com áreas seguras (`env(safe-area-inset-*)`), navegação por toque, alvos ≥ 44 px, modo retrato.

O que você precisa fazer numa máquina com internet:

```bash
# 1. Pré-requisitos: Node 20+, JDK 17 (ou 21) e Android Studio (inclui Android SDK)
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Gerar o projeto nativo
npm run build
npx cap add android
npx cap sync android

# 3. Ícones e splash (opcional, recomendado)
npm install -D @capacitor/assets
npx capacitor-assets generate --android   # usa resources/icon.png 1024×1024 se você criar um

# 4. APK de depuração
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# 5. Instalar no aparelho (depuração USB ativada)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

A cada mudança no código: `npm run cap:sync` (build + sync) e rode de novo pelo Android Studio ou Gradle.

### Recomendações para a versão nativa
- **Armazenamento:** criar `CapacitorStateRepository` usando `@capacitor/preferences` (ou SQLite) implementando a mesma interface `StateRepository` — nenhuma tela precisa mudar.
- **Botão voltar do Android:** registrar `App.addListener('backButton', …)` (`@capacitor/app`) para fechar modais antes de navegar.
- **Barra de status:** `@capacitor/status-bar` para acompanhar o tema claro/escuro.
- **Service worker:** desnecessário dentro do APK (os arquivos já são locais); o registro só ocorre em HTTPS/localhost e falha de forma silenciosa.
- **Release:** gerar keystore, `./gradlew bundleRelease` (AAB para a Play Store) e testar em aparelho modesto (Android 9+, 2–3 GB de RAM) com as animações completas e reduzidas.
