// Low-poly 3D-сцена для первого экрана. Без постпроцессинга и внешних моделей:
// всё собрано из примитивов, поэтому весит несколько килобайт поверх three.js.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D,
  BoxGeometry, CylinderGeometry, IcosahedronGeometry, OctahedronGeometry, TetrahedronGeometry,
  ExtrudeGeometry, Shape, EdgesGeometry, LineSegments, LineBasicMaterial, BufferGeometry,
  Float32BufferAttribute, Points, PointsMaterial, MeshStandardMaterial, MeshBasicMaterial,
  PlaneGeometry, CanvasTexture, SRGBColorSpace, AmbientLight, HemisphereLight, PointLight,
  DirectionalLight, Fog, MathUtils,
} from 'three';

const CYAN = 0x34e4ff, VIOLET = 0x7c4dff, PINK = 0xff3d9a;

export function mountScene(host, { reducedMotion = false } = {}) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new WebGLRenderer({
    antialias: dpr < 1.5,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new Fog(0x15171c, 9, 17);
  const camera = new PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0.4, 10);

  // ---------- свет ----------
  scene.add(new AmbientLight(0x404a66, 0.9));
  scene.add(new HemisphereLight(0x8fa6ff, 0x1a0f22, 0.8));
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 6);
  scene.add(key);
  const cyanL = new PointLight(CYAN, 40, 14, 1.6);
  cyanL.position.set(-3.5, 1.5, 3);
  const pinkL = new PointLight(PINK, 34, 14, 1.6);
  pinkL.position.set(3.5, -1.5, 2.5);
  scene.add(cyanL, pinkL);

  // ---------- материалы ----------
  const graphite = new MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.42, metalness: 0.75, flatShading: true });
  const graphiteDark = new MeshStandardMaterial({ color: 0x23262e, roughness: 0.55, metalness: 0.6, flatShading: true });
  const edgeMat = (c, o = 0.9) => new LineBasicMaterial({ color: c, transparent: true, opacity: o });
  const withEdges = (mesh, color, o) => {
    mesh.add(new LineSegments(new EdgesGeometry(mesh.geometry, 20), edgeMat(color, o)));
    return mesh;
  };

  const root = new Group();
  scene.add(root);
  const items = []; // { obj, base, phase, amp, intro }

  const addItem = (obj, pos, rot, phase, amp = 0.12) => {
    obj.position.set(...pos);
    obj.rotation.set(...rot);
    root.add(obj);
    items.push({
      obj, phase, amp,
      base: obj.position.clone(),
      baseRot: obj.rotation.clone(),
      from: obj.position.clone().multiplyScalar(2.4).add({ x: 0, y: -3, z: -4 }),
    });
  };

  // 1) Стопка графитовых шестигранных пластин — «материал» бренда
  const hexStack = new Group();
  [[1.25, 0.2, 0], [1.05, 0.2, 0.3], [0.82, 0.2, 0.6]].forEach(([r, h, y], i) => {
    const m = new Mesh(new CylinderGeometry(r, r, h, 6), i === 1 ? graphiteDark : graphite);
    m.position.y = y;
    m.rotation.y = i * 0.18;
    withEdges(m, [CYAN, VIOLET, PINK][i], 0.95);
    hexStack.add(m);
  });
  addItem(hexStack, [0, -1.55, 0], [0.18, 0.4, 0], 0, 0.06);

  // 2) Монитор с неоновым экраном (текстура рисуется на canvas)
  const monitor = new Group();
  const body = withEdges(new Mesh(new BoxGeometry(2.3, 1.36, 0.1), graphiteDark), VIOLET, 0.6);
  const screen = new Mesh(new PlaneGeometry(2.14, 1.2), new MeshBasicMaterial({ map: screenTexture() }));
  screen.position.z = 0.052;
  const neck = new Mesh(new BoxGeometry(0.14, 0.5, 0.1), graphite);
  neck.position.set(0, -0.9, -0.06);
  const foot = withEdges(new Mesh(new CylinderGeometry(0.45, 0.5, 0.06, 6), graphite), CYAN, 0.5);
  foot.position.set(0, -1.15, -0.06);
  monitor.add(body, screen, neck, foot);
  addItem(monitor, [0.1, 0.55, -0.6], [0, -0.28, 0], 1.2, 0.08);

  // 3) Клавиатура: корпус + инстансы клавиш (один draw call)
  const kb = new Group();
  const kbBody = withEdges(new Mesh(new BoxGeometry(2.1, 0.09, 0.72), graphiteDark), CYAN, 0.55);
  kb.add(kbBody);
  const cols = 14, rows = 4;
  const keys = new InstancedMesh(
    new BoxGeometry(0.12, 0.06, 0.12),
    new MeshStandardMaterial({ color: 0x2e3340, emissive: 0x3a1f8a, emissiveIntensity: 0.55, roughness: 0.4, flatShading: true }),
    cols * rows,
  );
  const d = new Object3D();
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    d.position.set(-0.91 + c * 0.14 + (r % 2) * 0.03, 0.07, -0.23 + r * 0.155);
    d.updateMatrix();
    keys.setMatrixAt(k++, d.matrix);
  }
  kb.add(keys);
  addItem(kb, [-0.35, -0.55, 1.35], [0.55, 0.35, -0.06], 2.4, 0.07);

  // 4) Геймпад из выдавленного контура
  const pad = new Group();
  const s = new Shape();
  s.moveTo(-0.55, 0.32);
  s.lineTo(0.55, 0.32);
  s.quadraticCurveTo(0.95, 0.32, 1.02, -0.05);
  s.quadraticCurveTo(1.1, -0.55, 0.78, -0.6);
  s.quadraticCurveTo(0.55, -0.62, 0.4, -0.3);
  s.lineTo(-0.4, -0.3);
  s.quadraticCurveTo(-0.55, -0.62, -0.78, -0.6);
  s.quadraticCurveTo(-1.1, -0.55, -1.02, -0.05);
  s.quadraticCurveTo(-0.95, 0.32, -0.55, 0.32);
  const padGeo = new ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 5 });
  padGeo.center();
  pad.add(withEdges(new Mesh(padGeo, graphite), PINK, 0.8));
  const btnMat = (c) => new MeshBasicMaterial({ color: c });
  [[0.62, 0.1, CYAN], [0.76, -0.04, PINK], [0.48, -0.04, VIOLET], [0.62, -0.18, 0xffb547]].forEach(([x, y, c]) => {
    const b = new Mesh(new IcosahedronGeometry(0.055, 0), btnMat(c));
    b.position.set(x, y, 0.17);
    pad.add(b);
  });
  [-0.62, -0.2].forEach((x, i) => {
    const st = new Mesh(new CylinderGeometry(0.1, 0.12, 0.1, 8), graphiteDark);
    st.rotation.x = Math.PI / 2;
    st.position.set(x, i ? -0.15 : 0.08, 0.18);
    pad.add(st);
  });
  addItem(pad, [2.05, -0.35, 0.9], [0.5, -0.5, 0.25], 3.6, 0.16);

  // 5) Неоновые кристаллы вокруг
  const crystals = [
    [new OctahedronGeometry(0.32, 0), CYAN, [-2.3, 1.2, 0.4]],
    [new TetrahedronGeometry(0.3, 0), PINK, [2.1, 1.55, -0.4]],
    [new IcosahedronGeometry(0.22, 0), VIOLET, [-1.95, -1.35, 1.2]],
    [new OctahedronGeometry(0.18, 0), PINK, [1.3, 1.9, 1.1]],
  ];
  crystals.forEach(([g, c, p], i) => {
    const m = new Mesh(g, new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }));
    withEdges(m, 0xffffff, 0.35);
    addItem(m, p, [i, i * 0.7, 0], 4 + i * 1.3, 0.22);
  });

  // 6) Пыль/искры
  const N = isTouch ? 160 : 300;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = MathUtils.randFloatSpread(14);
    pos[i * 3 + 1] = MathUtils.randFloatSpread(9);
    pos[i * 3 + 2] = MathUtils.randFloat(-6, 3);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ color: 0x9fb4ff, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(dust);

  // ---------- раскладка под экран ----------
  let w = 1, h = 1, layout = { x: 0, y: 0, s: 1 };
  function resize() {
    w = host.clientWidth; h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // На узком экране сцена сверху (текст — снизу), на широком — справа от заголовка
    if (camera.aspect < 0.8) layout = { x: -0.3, y: 2.25, s: 0.66 };
    else if (camera.aspect < 1.25) layout = { x: 0.6, y: 0.9, s: 0.75 };
    else layout = { x: 2.7, y: 0.05, s: 0.95 };
    root.scale.setScalar(layout.s);
    root.position.set(layout.x, layout.y, 0);
    camera.updateProjectionMatrix();
    if (!running) renderer.render(scene, camera);
  }

  // ---------- ввод: курсор, касание, гироскоп ----------
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const onPointer = (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onTouch = (e) => {
    const t = e.touches[0];
    if (!t) return;
    target.x = MathUtils.clamp((t.clientX / window.innerWidth) * 2 - 1, -1, 1);
    target.y = MathUtils.clamp((t.clientY / window.innerHeight) * 2 - 1, -1, 1);
  };
  let gyroBase = null;
  const onOrient = (e) => {
    if (e.beta == null) return;
    if (!gyroBase) gyroBase = { b: e.beta, g: e.gamma };
    target.x = MathUtils.clamp((e.gamma - gyroBase.g) / 25, -1, 1);
    target.y = MathUtils.clamp((e.beta - gyroBase.b) / 25, -1, 1);
  };
  if (!reducedMotion) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    if (isTouch) {
      host.parentElement.addEventListener('touchmove', onTouch, { passive: true });
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        // iOS: доступ к гироскопу — только после касания пользователя
        const ask = (e) => {
          if (e.target.closest('a, button')) return;
          DOE.requestPermission().then((r) => r === 'granted' && window.addEventListener('deviceorientation', onOrient)).catch(() => {});
        };
        host.parentElement.addEventListener('touchend', ask, { once: true });
      } else if (DOE) {
        window.addEventListener('deviceorientation', onOrient);
      }
    }
  }

  // ---------- цикл ----------
  const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const INTRO = reducedMotion ? 0 : 1.8;
  let running = false, raf = 0, t0 = performance.now(), last = t0;
  let frames = 0, slow = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - t0) / 1000;

    // Адаптивное качество: если кадры долгие — снижаем pixelRatio
    if (frames < 120) {
      frames++;
      if (dt > 0.024) slow++;
      if (frames === 120 && slow > 40 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.75);
        renderer.setPixelRatio(dpr);
        resize();
      }
    }

    items.forEach((it, i) => {
      const p = INTRO ? MathUtils.clamp((t - i * 0.08) / (INTRO * 0.7), 0, 1) : 1;
      const e = easeOutBack(p);
      it.obj.position.lerpVectors(it.from, it.base, e);
      it.obj.position.y += Math.sin(t * 1.1 + it.phase) * it.amp;
      it.obj.rotation.x = it.baseRot.x + Math.sin(t * 0.6 + it.phase) * 0.06;
      it.obj.rotation.y = it.baseRot.y + (1 - e) * 2.5 + Math.sin(t * 0.4 + it.phase) * 0.1;
      it.obj.scale.setScalar(Math.max(0.001, Math.min(1, p * 1.4)));
    });
    hexStack.children.forEach((m, i) => { m.rotation.y += dt * (0.15 + i * 0.12) * (i % 2 ? -1 : 1); });

    cur.x += (target.x - cur.x) * Math.min(1, dt * 3);
    cur.y += (target.y - cur.y) * Math.min(1, dt * 3);
    root.rotation.y = Math.sin(t * 0.25) * 0.18 + cur.x * 0.35;
    root.rotation.x = cur.y * 0.18;
    camera.position.x = cur.x * 0.6;
    camera.position.y = 0.4 - cur.y * 0.4;
    camera.lookAt(layout.x * 0.5, layout.y * 0.6, 0);
    dust.rotation.y = t * 0.02 + cur.x * 0.1;
    cyanL.position.x = -3.5 + Math.sin(t * 0.7) * 1.2;
    pinkL.position.y = -1.5 + Math.cos(t * 0.6) * 1.2;

    renderer.render(scene, camera);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Рендерим только когда hero виден и вкладка активна
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  window.addEventListener('resize', resize, { passive: true });

  resize();
  if (reducedMotion) {
    // статичный кадр
    frame(t0 + 4000);
    cancelAnimationFrame(raf);
  } else {
    start();
  }
  host.classList.add('is-live');
}

// Экран монитора: неоновый «интерфейс» игры, нарисованный на canvas 512×288
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 512, 288);
  bg.addColorStop(0, '#0e2a4a');
  bg.addColorStop(0.5, '#2a1260');
  bg.addColorStop(1, '#4a0f3a');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 288);
  // горизонт и сетка
  g.strokeStyle = 'rgba(52,228,255,.55)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const y = 170 + i * i * 1.1;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    g.beginPath(); g.moveTo(256 + i * 12, 170); g.lineTo(256 + i * 70, 288); g.stroke();
  }
  // солнце
  const sun = g.createLinearGradient(0, 60, 0, 170);
  sun.addColorStop(0, '#ffd36b');
  sun.addColorStop(1, '#ff3d9a');
  g.fillStyle = sun;
  g.beginPath(); g.arc(256, 170, 78, Math.PI, 0); g.fill();
  g.fillStyle = '#2a1260';
  for (let i = 0; i < 5; i++) g.fillRect(170, 120 + i * 11, 172, 3 + i);
  // шестигранник-логотип
  g.strokeStyle = '#e9edf3';
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](60 + Math.cos(a) * 26, 52 + Math.sin(a) * 26);
  }
  g.closePath(); g.stroke();
  // полоски HUD
  g.fillStyle = 'rgba(233,237,243,.8)';
  g.fillRect(400, 36, 80, 6);
  g.fillStyle = '#34e4ff';
  g.fillRect(400, 50, 56, 6);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
