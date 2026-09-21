import './style.css';
import photos from 'virtual:photos';
import { club, prices, pricesSource, reasons, TODO } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const todoHtml = (s) => esc(s).replace(esc(TODO), `<span class="todo">${esc(TODO)}</span>`);
const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';

/* ---------- 3D-сцена (грузится отдельным чанком, чтобы заголовок появился сразу) ---------- */
const stage = $('[data-stage]');
import('./scene.js')
  .then(({ mountScene, hasWebGL }) => {
    if (!hasWebGL()) throw new Error('no webgl');
    mountScene(stage, { reducedMotion: reduced });
  })
  .catch(() => document.documentElement.classList.add('no-webgl'));

/* ---------- Почему Grafit ---------- */
$('[data-why]').innerHTML = reasons
  .map((r) => `
    <li class="why__item${r.todo ? ' why__item--todo' : ''}">
      <span class="why__big" aria-hidden="true">${esc(r.big)}</span>
      <h3>${esc(r.title)}</h3>
      <p>${todoHtml(r.text)}</p>
    </li>`)
  .join('');

/* ---------- Прайс ---------- */
const maxH = Math.max(...prices.map((p) => p.hours));
$('[data-prices]').innerHTML = prices
  .map((p, i) => `
    <article class="pcard${i === 1 ? ' pcard--hot' : ''}" data-tilt>
      <div class="pcard__in">
        <span class="pcard__hours">${esc(p.label)}</span>
        <span class="pcard__price">${p.price}<small>₽</small></span>
        <p class="pcard__note">${esc(p.note)}</p>
        <span class="pcard__bar" aria-hidden="true"><i style="--w:${(p.hours / maxH) * 100}%"></i></span>
        <span class="pcard__glare" aria-hidden="true"></span>
      </div>
    </article>`)
  .join('');
$('[data-prices-src]').innerHTML = todoHtml(pricesSource);

/* 3D-наклон карточек: курсор на десктопе, палец на телефоне */
if (!reduced) {
  $$('[data-tilt]').forEach((card) => {
    const move = (x, y) => {
      const r = card.getBoundingClientRect();
      const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
      card.style.setProperty('--ry', `${(px - 0.5) * 16}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.classList.add('is-tilting');
    };
    const reset = () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };
    card.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    card.addEventListener('pointerleave', reset);
    card.addEventListener('touchstart', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchend', reset);
  });
}

/* ---------- Галерея: любые файлы из public/photos ---------- */
const base = import.meta.env.BASE_URL;
const gallery = $('[data-gallery]');
if (photos.length) {
  gallery.innerHTML = photos
    .map((f, i) => `
      <figure class="shot">
        <img src="${base}photos/${encodeURIComponent(f)}" alt="Зал клуба Grafit, фото ${i + 1}"
             loading="lazy" decoding="async" width="800" height="1000" />
      </figure>`)
    .join('');
} else {
  const tones = [
    ['rgba(52,228,255,.45)', 'rgba(124,77,255,.35)', 'Игровой зал'],
    ['rgba(255,61,154,.4)', 'rgba(124,77,255,.3)', 'Места и железо'],
    ['rgba(124,77,255,.5)', 'rgba(52,228,255,.25)', 'Зона отдыха'],
    ['rgba(52,228,255,.35)', 'rgba(255,61,154,.35)', 'Вход с проспекта'],
    ['rgba(255,181,71,.3)', 'rgba(124,77,255,.35)', 'Ночью'],
  ];
  gallery.innerHTML = tones
    .map(([c1, c2, t], i) => `
      <figure class="shot shot--ph" style="--c1:${c1};--c2:${c2};--gx:${20 + i * 15}%;--gy:${15 + (i % 3) * 20}%">
        <span class="ph__icon" aria-hidden="true">
          <svg viewBox="0 0 40 40"><use href="#logo" /></svg>
        </span>
        <figcaption>${t}<span class="todo">Фото ${TODO}</span></figcaption>
      </figure>`)
    .join('');
}

/* ---------- Как найти ---------- */
$('[data-2gis]').href = club.twoGis;

/* ---------- Бронь ---------- */
const form = $('[data-book]');
$('[data-hours]').innerHTML = prices
  .map((p, i) => `
    <label>
      <input type="radio" name="hours" value="${p.hours}" ${i === 0 ? 'checked' : ''} />
      <span><b>${esc(p.label)}</b><small>${rub(p.price)}</small></span>
    </label>`)
  .join('');

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
form.date.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
form.date.value = form.date.min;
const soon = new Date(now.getTime() + 60 * 60 * 1000);
form.time.value = `${pad(soon.getHours())}:00`;

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ничего */ }
    ta.remove();
    return ok;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-error]');
  const name = form.name.value.trim();
  const missing = [];
  [['name', !name, 'имя'], ['date', !form.date.value, 'дату'], ['time', !form.time.value, 'время']].forEach(([f, bad, label]) => {
    form[f].setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (bad) missing.push(label);
  });
  if (missing.length) {
    err.textContent = `Укажите ${missing.join(', ')}.`;
    err.hidden = false;
    form[['name', 'date', 'time'].find((f) => form[f].getAttribute('aria-invalid') === 'true')].focus();
    return;
  }
  err.hidden = true;

  const p = prices.find((x) => String(x.hours) === form.hours.value) || prices[0];
  const [y, m, d] = form.date.value.split('-');
  const date = new Date(+y, +m - 1, +d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
  const text = [
    `Здравствуйте! Хочу забронировать место в ${club.name}.`,
    `Имя: ${name}`,
    `Когда: ${date}, ${form.time.value}`,
    `На сколько: ${p.label} (${rub(p.price)})`,
  ].join('\n');

  const ok = await copy(text);
  $('[data-text]').textContent = text;
  $('[data-done]').textContent = ok ? 'Текст заявки скопирован' : 'Скопируйте текст заявки вручную';
  const res = $('[data-result]');
  res.hidden = false;
  res.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
});

/* ---------- Шапка и нижняя панель ---------- */
const topbar = $('[data-topbar]');
const dock = $('.dock');
const book = $('#book');
let bookVisible = false;
new IntersectionObserver(([e]) => { bookVisible = e.isIntersecting; onScroll(); }, { threshold: 0.15 }).observe(book);
function onScroll() {
  const y = window.scrollY;
  topbar.classList.toggle('is-solid', y > 40);
  dock.classList.toggle('is-on', y > window.innerHeight * 0.6 && !bookVisible);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Анимации на скролле ---------- */
if (!reduced) {
  Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
    gsap.registerPlugin(ScrollTrigger);

    // Hero уходит вглубь при прокрутке
    gsap.to('.hero__content', {
      yPercent: -30, opacity: 0, scale: 0.94, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true },
    });
    gsap.to('.hero__stage', {
      yPercent: 25, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    // Параллакс шестигранной решётки
    $$('[data-parallax]').forEach((el) => {
      gsap.fromTo(el, { yPercent: 12 }, {
        yPercent: parseFloat(el.dataset.parallax) * 60, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Заголовки секций
    $$('.section .h2').forEach((h) => {
      gsap.from(h, {
        y: 40, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 88%' },
      });
    });

    // Факты — вылетают из глубины
    gsap.from('.why__item', {
      opacity: 0, z: -200, rotateX: -35, y: 40, transformPerspective: 800,
      duration: 0.9, ease: 'power3.out', stagger: 0.07,
      scrollTrigger: { trigger: '.why__grid', start: 'top 82%' },
    });

    // Карточки цен — разворачиваются в 3D
    gsap.from('.pcard', {
      opacity: 0, rotateY: (i) => (i - 1) * -40, rotateX: 25, y: 80, z: -150,
      duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'transform,opacity',
      scrollTrigger: { trigger: '.price__row', start: 'top 85%' },
    });
    gsap.from('.pcard__bar i', {
      scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power2.out', stagger: 0.12,
      scrollTrigger: { trigger: '.price__row', start: 'top 75%' },
    });

    // Галерея: на десктопе лента едет вбок, внутри кадров — параллакс
    const mm = gsap.matchMedia();
    mm.add('(min-width: 960px)', () => {
      const track = $('.gallery__track');
      gsap.to(track, {
        x: () => -Math.max(0, track.scrollWidth - window.innerWidth + 64),
        ease: 'none',
        scrollTrigger: { trigger: '.gallery', start: 'top 70%', end: 'bottom 20%', scrub: 0.6, invalidateOnRefresh: true },
      });
    });
    $$('.shot img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    gsap.from('.shot', {
      opacity: 0, y: 60, rotate: (i) => (i % 2 ? 3 : -3), duration: 0.9, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: '.gallery__track', start: 'top 85%' },
    });

    // Метка на «карте»
    gsap.from('.where__pin', {
      scale: 0.7, opacity: 0, rotate: -12, duration: 1.2, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '.where', start: 'top 70%' },
    });
    gsap.from('.book__form', {
      y: 60, opacity: 0, rotateX: 12, transformPerspective: 900, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.book', start: 'top 75%' },
    });

    // Картинки догружаются лениво — пересчитываем позиции
    $$('.shot img').forEach((img) => img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true }));
  });
}
