// Скриншоты и проверка консоли: npm run build && npx vite preview --port 4173 & npm run shots
// URL можно передать аргументом: node scripts/shots.mjs https://user.github.io/grafit-demo/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/grafit-demo/';
const out = process.env.SHOTS_DIR || 'shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

async function run(name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`[${name}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${name}] failed: ${r.url()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${name}-hero.png` });
  // Прокручиваем постепенно, чтобы сработали ScrollTrigger-анимации
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 300) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  for (const id of ['why', 'price', 'gallery', 'where', 'book']) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'start' }), id);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/${name}-${id}.png` });
  }
  // Заявка
  await page.fill('input[name=name]', 'Артём');
  await page.click('button[type=submit]');
  await page.waitForTimeout(700);
  await page.locator('.book__form').screenshot({ path: `${out}/${name}-book-result.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`[${name}] horizontal overflow: ${overflow}px`);
  const webgl = await page.evaluate(() => !!document.querySelector('.hero__stage canvas'));
  console.log(`${name}: canvas=${webgl}, overflow=${overflow}`);
  await ctx.close();
}

await run('mobile', {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
await run('desktop', { viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
await run('reduced', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });

if (process.env.OG) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.topbar,.hero__scroll{display:none!important}' });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 82 });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'Консоль чистая');
