import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Base-путь для GitHub Pages: https://<user>.github.io/<repo>/
// Меняйте здесь или передавайте BASE_PATH=/ при сборке для своего домена.
const BASE = process.env.BASE_PATH ?? '/grafit-demo/';

const PHOTOS_DIR = resolve(import.meta.dirname, 'public/photos');
const VIRTUAL_ID = 'virtual:photos';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// Собирает список всех jpg/jpeg/webp/png из public/photos при каждой сборке.
function photosPlugin() {
  const list = () =>
    existsSync(PHOTOS_DIR)
      ? readdirSync(PHOTOS_DIR)
          .filter((f) => /\.(jpe?g|webp|png|avif)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))
      : [];
  return {
    name: 'grafit-photos',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) return `export default ${JSON.stringify(list())};`;
    },
    configureServer(server) {
      server.watcher.add(PHOTOS_DIR);
      const reload = (file) => {
        if (!file.startsWith(PHOTOS_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

// Абсолютный адрес сайта для og:image (соцсети не понимают относительные ссылки).
const SITE_URL = process.env.SITE_URL ?? '';

function ogPlugin() {
  return {
    name: 'grafit-og',
    transformIndexHtml: (html) =>
      html.replace('%OG_IMAGE%', (SITE_URL ? SITE_URL.replace(/\/?$/, '/') : BASE) + 'og.jpg'),
  };
}

export default defineConfig({
  base: BASE,
  plugins: [photosPlugin(), ogPlugin()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
  },
});
