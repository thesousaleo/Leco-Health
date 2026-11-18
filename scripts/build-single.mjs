// Build alternativo: gera um único dist-single/index.html (sem Vite). Uso: node scripts/build-single.mjs
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const twDir = process.env.TW_DIR || path.join(root, 'node_modules/tailwindcss');

const js = await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  jsx: 'automatic', loader: { '.css': 'empty' },
  plugins: [{ name: 'capacitor-stub', setup(b) { b.onResolve({ filter: /^@(capacitor|capgo)\// }, () => ({ path: path.join(root, 'src/native-stub.ts') })); } }],
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
});
const jsCode = js.outputFiles[0].text;

// candidatos de classe: varre todo o código-fonte
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const candidates = new Set();
for (const f of walk(path.join(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f))) {
  for (const tok of fs.readFileSync(f, 'utf8').split(/[\s"'`{}<>;]+/)) if (tok) candidates.add(tok);
}

const inputCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const compiler = await compile(inputCss, {
  base: root,
  loadStylesheet: async (id, base) => {
    const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : path.resolve(base, id);
    return { content: fs.readFileSync(p, 'utf8'), base: path.dirname(p), path: p };
  },
});
const css = compiler.build([...candidates]);

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#E9E5DF" />
<title>Leco Health</title>
<script>
/* links de confirmação de e-mail e troca de senha (Supabase) chegam aqui: seguem para a página de conta */
(function(){var u=location.search+location.hash;if(/access_token=|error_description=|[?&#]type=(signup|recovery|email|invite|magiclink)/.test(u))location.replace('conta/'+location.search+location.hash);})();
</script>
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="description" content="Saúde, treino, refeições e hábitos num app só." />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%23F26B3A'/%3E%3Cpath d='M28 22 V68 H42 L48 56 L56 78 L62 62 H72' fill='none' stroke='white' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${jsCode.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;

fs.mkdirSync(path.join(root, 'dist-single'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist-single/index.html'), html);
console.log(`dist-single/index.html — ${(html.length / 1024).toFixed(0)} KB (css ${(css.length / 1024).toFixed(0)} KB, js ${(jsCode.length / 1024).toFixed(0)} KB)`);
