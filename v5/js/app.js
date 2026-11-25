import * as THREE from 'three';

/* ---------- constants ---------- */
const LOGO = '#707D6C';
const BG = ['#EADFD1', '#7E8F95', '#E3CFB8'];          // Ivory Sand → Stormy Sky → warm sand
const LIGHT = ['#fff6ec', '#e3edf2', '#ffeadb'];       // warm white → cool → sienna glow
const LOGO_VB = { x: 66, y: 80.75, w: 404, h: 449.42 };
const TIP = { x: 362.56, y: 410.37 };                  // end of the G's lower flick (from the PDF vector)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const panels = $$('.panel');
const hdr = $('#hdr');
const hint = $('#hint');
const credits = $('.credits');
const track = $('#track');
const hits = { daiana: $('#hitDaiana'), en: $('#hitEn'), de: $('#hitDe') };

/* ---------- scroll timeline (shared by 3D and fallback) ---------- */
let vh = innerHeight, segs = [], total = 0;
function layoutTimeline() {
  vh = innerHeight;
  const rest = [0.55, 0.9, 1.0].map(k => k * vh), tr = 1.55 * vh;
  segs = []; let y = 0;
  rest.forEach((r, i) => {
    segs.push({ type: 'rest', i, a: y, b: y + r }); y += r;
    if (i < rest.length - 1) { segs.push({ type: 'tr', i, a: y, b: y + tr }); y += tr; }
  });
  total = y;
  track.style.height = (total + vh) + 'px';
  const anchorAt = { top: 0, about: segs[2].a + 4, directions: segs[4].a + 4 };
  for (const [id, top] of Object.entries(anchorAt)) {
    const el = document.getElementById(id); el.style.cssText = `position:absolute;left:0;top:${top}px;width:1px;height:1px`;
  }
}
function phaseAt(s) {
  s = Math.max(0, Math.min(total, s));
  for (const g of segs) if (s <= g.b) {
    const u = (s - g.a) / (g.b - g.a);
    return g.type === 'rest' ? { f: g.i, i: g.i, u: 0, tr: false } : { f: g.i + u, i: g.i, u, tr: true };
  }
  return { f: 2, i: 2, u: 0, tr: false };
}
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);

let active = -1;
function updatePanels(ph) {
  let show = ph.i;
  if (ph.tr) show = ph.u < 0.16 ? ph.i : ph.u > 0.84 ? ph.i + 1 : -1;
  if (show === active) return;
  active = show;
  panels.forEach(p => {
    const on = +p.dataset.i === show;
    p.toggleAttribute('data-off', !on); p.inert = !on;
  });
  for (const b of Object.values(hits)) {
    const on = +b.dataset.s === show; b.style.pointerEvents = on ? 'auto' : 'none'; b.tabIndex = on ? 0 : -1;
    b.style.opacity = on ? 1 : 0;
  }
}

/* menu links: smooth jump to calm camera positions */
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (!el) { e.preventDefault(); return; }
  e.preventDefault();
  scrollTo({ top: el.offsetTop, behavior: reduce ? 'auto' : 'smooth' });
}));

/* ---------- WebGL ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }
if (!renderer) startFallback(); else start3D();

function startFallback() {
  document.documentElement.classList.add('nogl');
  layoutTimeline();
  const sc = $('#staticDaiana'), sl = $('#slotDaiana').getBoundingClientRect();
  Object.assign(sc.style, { left: sl.left + 'px', top: sl.top + 'px', width: sl.width + 'px' });
  const tick = () => { const ph = phaseAt(scrollY); updatePanels(ph); sc.style.opacity = ph.f < 0.3 ? 1 : 0;
    document.body.style.background = BG[Math.round(ph.f)]; requestAnimationFrame(tick); };
  tick();
}

async function start3D() {
  const mobile = () => innerWidth < 760;
  const DPR = Math.min(devicePixelRatio, mobile() ? 1.6 : 2);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG[0]);
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 200);
  const D = 10;                                                   // camera distance at rest
  const S = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-6.5, -9, -6), new THREE.Vector3(7.5, -17, -2)];

  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9c8b4, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile() ? 1024 : 2048, mobile() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 0.5, far: 40 });
  sun.shadow.radius = 8; sun.shadow.bias = -0.0005; sun.shadow.normalBias = .01;
  scene.add(sun, sun.target);

  // a catcher behind every section so cards and thread throw soft shadows on the "paper"
  const catchers = S.map(c => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: 0.085 }));
    m.position.set(c.x, c.y, c.z - 0.06); m.receiveShadow = true; scene.add(m); return m;
  });

  await document.fonts.ready;
  await Promise.all(['400 40px Hand', '500 20px Manrope', '600 20px Manrope', '400 40px GLSerif'].map(f => document.fonts.load(f, 'Даяна English')));
  const [imgD, imgL, imgK, imgLogo] = await Promise.all(['img/daiana.webp', 'img/london.webp', 'img/koeln.webp', 'img/logo.svg'].map(loadImg));

  /* ---------- textures ---------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };

  function paperNoise(ctx, w, h, a = 10) {
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (let k = 0; k < d.length; k += 4) { if (!d[k + 3]) continue; const n = (Math.random() - .5) * a; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
    ctx.putImageData(id, 0, 0);
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  const CW = 1000, CH = 1200, M = 56, PH = 860;                        // instax-like proportions
  function instaxFront(drawPhoto, title, sub) {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
    rr(c, 0, 0, CW, CH, 26); c.fillStyle = '#F6EFE6'; c.fill();
    const g = c.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(180,160,135,.12)');
    c.fillStyle = g; c.fill();
    paperNoise(c, CW, CH, 9);
    c.save(); rr(c, M, M, CW - 2 * M, PH, 6); c.clip(); drawPhoto(c, M, M, CW - 2 * M, PH);
    const ig = c.createLinearGradient(0, M, 0, M + PH); ig.addColorStop(0, 'rgba(0,0,0,.05)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ig; c.fillRect(M, M, CW - 2 * M, PH); c.restore();
    c.strokeStyle = 'rgba(60,40,25,.18)'; c.lineWidth = 2; c.strokeRect(M, M, CW - 2 * M, PH);
    c.textAlign = 'center'; c.fillStyle = LOGO; c.font = '400 128px Hand'; c.fillText(title, CW / 2, M + PH + 158);
    c.fillStyle = '#5E5249'; c.font = '500 30px Manrope'; c.letterSpacing = '7px'; c.fillText(sub, CW / 2, M + PH + 222);
    return tex(cv);
  }
  function instaxBack(title, lines, foot) {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
    rr(c, 0, 0, CW, CH, 26); c.fillStyle = '#F2ECE5'; c.fill(); paperNoise(c, CW, CH, 8);
    c.fillStyle = LOGO; c.font = '400 150px Hand'; c.textAlign = 'left'; c.fillText(title, 110, 270);
    c.fillStyle = '#B9A891'; c.fillRect(110, 320, 120, 3);
    c.fillStyle = '#2A221D'; c.font = '400 46px GLSerif';
    lines.forEach((l, k) => c.fillText(l, 110, 440 + k * 92));
    c.fillStyle = '#7A6C60'; c.font = '500 26px Manrope'; c.letterSpacing = '5px'; c.fillText(foot, 110, CH - 110);
    return tex(cv);
  }
  const cover = (img, fx = .5, fy = .5) => (c, x, y, w, h) => {
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    c.drawImage(img, x + (w - iw) * fx, y + (h - ih) * fy, iw, ih);
  };
  const daianaPhoto = (c, x, y, w, h) => {
    const g = c.createRadialGradient(x + w * .5, y + h * .25, 40, x + w * .5, y + h * .45, h * .9);
    g.addColorStop(0, '#F2E6D7'); g.addColorStop(.6, '#D9C3A8'); g.addColorStop(1, '#BFA284');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    const s = (w * 1.02) / imgD.width; const iw = imgD.width * s, ih = imgD.height * s;
    c.drawImage(imgD, x + (w - iw) / 2, y + h * .03, iw, ih);
  };

  /* ---------- rope texture (3 twisted strands, tiles in both directions) ---------- */
  function ropeMaps() {
    const N = 256, hgt = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const s = (((x + y) / N) * 3) % 1;                 // 3 strands per turn
      let h = Math.pow(Math.sin(Math.PI * s), .55);
      h += .07 * Math.sin(s * Math.PI * 2 * 7 + ((x - y) / N) * Math.PI * 2 * 2);   // fibres along each strand
      h += (Math.random() - .5) * .05;
      hgt[y * N + x] = h;
    }
    const nc = document.createElement('canvas'); nc.width = nc.height = N; const nx = nc.getContext('2d'); const nd = nx.createImageData(N, N);
    const cc = document.createElement('canvas'); cc.width = cc.height = N; const cx = cc.getContext('2d'); const cd = cx.createImageData(N, N);
    const H = (x, y) => hgt[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
      nd.data[k] = (-dx / l * .5 + .5) * 255; nd.data[k + 1] = (dy / l * .5 + .5) * 255; nd.data[k + 2] = (1 / l * .5 + .5) * 255; nd.data[k + 3] = 255;
      const v = 205 + 50 * Math.min(1, H(x, y));
      cd.data[k] = cd.data[k + 1] = cd.data[k + 2] = v; cd.data[k + 3] = 255;
    }
    nx.putImageData(nd, 0, 0); cx.putImageData(cd, 0, 0);
    const n = new THREE.CanvasTexture(nc), c = new THREE.CanvasTexture(cc); c.colorSpace = THREE.SRGBColorSpace;
    for (const t of [n, c]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; }
    return { n, c };
  }
  const rope = ropeMaps();
  const ropeMat = new THREE.MeshStandardMaterial({ color: LOGO, map: rope.c, normalMap: rope.n, normalScale: new THREE.Vector2(1.1, 1.1), roughness: .82, metalness: 0, emissive: LOGO, emissiveIntensity: .22 });

  /* ---------- objects ---------- */
  const logoCv = document.createElement('canvas'); logoCv.width = 1200; logoCv.height = Math.round(1200 * LOGO_VB.h / LOGO_VB.w);
  logoCv.getContext('2d').drawImage(imgLogo, 0, 0, logoCv.width, logoCv.height);
  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(logoCv), transparent: true, depthWrite: false }));
  logoMesh.renderOrder = 2; scene.add(logoMesh);

  function makeCard(front, back) {
    const g = new THREE.Group(), w = 1, h = CH / CW, d = .022, r = .026;
    const sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 6 }), new THREE.MeshStandardMaterial({ color: '#EFE6DA', roughness: .9 }));
    body.position.z = -d / 2; body.castShadow = true; g.add(body);
    const mk = (t, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .78, alphaTest: .5, transparent: false, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .32 }));
      m.position.z = z; m.rotation.y = ry; g.add(m); return m; };
    mk(front, d / 2 + .0015, 0); mk(back, -d / 2 - .0015, Math.PI);
    g.userData = { flip: 0, flipTo: 0, base: new THREE.Euler(), size: 1 };
    scene.add(g); return g;
  }
  const cards = {
    daiana: makeCard(instaxFront(daianaPhoto, 'Даяна', 'ОСНОВАТЕЛЬНИЦА GREEN LANGUAGES'),
      instaxBack('Даяна', ['Живёт в Германии', 'Cambridge C1 · Goethe C1', 'Училась в Ирландии', 'Путешествует по Европе', 'Основала Green Languages'], 'НАЖМИТЕ, ЧТОБЫ ВЕРНУТЬ')),
    en: makeCard(instaxFront(cover(imgL, .5, .35), 'English', 'АНГЛИЙСКИЙ'),
      instaxBack('English', ['С нуля до C1', 'Индивидуально и в группе', 'Speaking Club', 'IELTS · CAE · FCE · НМТ'], 'НАЖМИТЕ, ЧТОБЫ ВЕРНУТЬ')),
    de: makeCard(instaxFront(cover(imgK, .3, .5), 'Deutsch', 'НЕМЕЦКИЙ'),
      instaxBack('Deutsch', ['С нуля до C1', 'Индивидуально и в группе', 'Sprachclub', 'Goethe · TELC · DTZ'], 'НАЖМИТЕ, ЧТОБЫ ВЕРНУТЬ')),
  };
  cards.daiana.userData.base.set(-.05, -.2, .045);
  cards.en.userData.base.set(.03, .16, -.05);
  cards.de.userData.base.set(-.04, -.14, .04);

  for (const [k, b] of Object.entries(hits)) b.addEventListener('click', () => {
    const u = cards[k].userData; u.flipTo = u.flipTo ? 0 : 1; b.setAttribute('aria-pressed', !!u.flipTo);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') for (const [k, c] of Object.entries(cards)) { c.userData.flipTo = 0; hits[k].setAttribute('aria-pressed', 'false'); } });

  let ropeMesh = null, ropeLen = 1, ropePitch = 1;
  const restCam = S.map(() => new THREE.PerspectiveCamera(35, 1, .05, 200));
  let camCurves = [], lookCurves = [];

  /* screen point (px) → world point on the plane z = S[i].z + dz, seen from the calm camera of section i */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3();
  function s2w(px, py, i, dz = 0) {
    const c = restCam[i]; ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, c); plane.set(new THREE.Vector3(0, 0, 1), -(S[i].z + dz));
    return ray.ray.intersectPlane(plane, hitP.clone()) || S[i].clone();
  }
  const rectW = (el, i, dz) => { const r = el.getBoundingClientRect(); const a = s2w(r.left, r.top, i, dz), b = s2w(r.right, r.bottom, i, dz);
    return { l: a.x, r: b.x, t: a.y, b: b.y, w: b.x - a.x, h: a.y - b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: S[i].z + dz }; };
  const laneY = (i, dz = 0) => s2w(0, $(`.lane[data-lane="${i}"]`).getBoundingClientRect().top, i, dz).y;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function build() {
    const W = innerWidth, H = innerHeight, mob = mobile();
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    restCam.forEach((c, i) => { c.aspect = W / H; c.position.copy(S[i]).add(V(0, 0, D)); c.lookAt(S[i]); c.updateProjectionMatrix(); c.updateMatrixWorld(); });
    layoutTimeline();

    // logo: exactly over its slot in the header (calm position of the first section)
    const L = rectW($('#logoSlot'), 0, .06);
    logoMesh.scale.set(L.w, L.h, 1); logoMesh.position.set(L.cx, L.cy, L.z);
    const tip = V(L.l + (TIP.x - LOGO_VB.x) / LOGO_VB.w * L.w, L.t - (TIP.y - LOGO_VB.y) / LOGO_VB.h * L.h, L.z);

    // cards
    const place = (card, el, i, dz) => { const R = rectW(el, i, dz); card.scale.setScalar(R.w); card.position.set(R.cx, R.cy, R.z); card.userData.home = card.position.clone(); return R; };
    const C = place(cards.daiana, $('#slotDaiana'), 0, .1);
    const E = place(cards.en, $('#slotEn'), 2, .1);
    const G = place(cards.de, $('#slotDe'), 2, .1);
    const half = i => { const a = s2w(0, 0, i), b = s2w(W, H, i); return { l: a.x, r: b.x, t: a.y, b: b.y }; };
    const h0 = half(0), h1 = half(1), h2 = half(2);
    const y0 = laneY(0), y1 = laneY(1), y2 = laneY(2);
    const F0 = S[0].clone().lerp(S[1], .5).add(V(mob ? 1.2 : .6, mob ? 1.5 : .8, 2.4));
    const F1 = S[1].clone().lerp(S[2], .5).add(V(mob ? -1.2 : -.4, mob ? 1.2 : .7, 2.6));
    const lw = L.w;

    // the thread: one continuous curve through all three sections
    const p = [];
    p.push(tip, V(tip.x + lw * .12, tip.y - lw * .22, L.z), V(tip.x + lw * .45, tip.y - lw * .52, .08), V(tip.x + lw * 1.3, tip.y - lw * .62, .1));
    if (!mob) {
      p.push(V((tip.x + C.l) / 2 + .6, tip.y - lw * .5, .12),
        V(C.l + C.w * .28, C.t - C.h * .04, C.z - .14),            // slips behind Daiana's card
        V(C.r + C.w * .2, C.cy, C.z - .05),
        V(C.r + C.w * .05, C.b - C.h * .1, C.z + .14),              // comes round in front, below the card
        V(C.cx - C.w * .2, y0 + .05, .12),
        V(h0.l + (h0.r - h0.l) * .22, y0 - .1, .05),
        V(h0.l - .5, y0 - .8, .35));
    } else {
      p.push(V(h0.r - .25, tip.y - lw * .55, .1),
        V(C.r + .15, C.t - C.h * .1, C.z - .16),
        V(C.cx, C.t - C.h * .25, C.z - .18),
        V(C.l - .25, C.cy - C.h * .15, C.z + .05),
        V(C.l - .45, C.b - .35, .25),
        V(h0.l - .6, C.b - 1.1, .35));
    }
    p.push(F0);
    if (!mob) p.push(V(h1.l - .3, y1 + .9, S[1].z + .4), V(h1.l + (h1.r - h1.l) * .15, y1, S[1].z + .05),
      V(h1.l + (h1.r - h1.l) * .55, y1 - .08, S[1].z + .1), V(h1.r - .3, y1 + .05, S[1].z + .05), V(h1.r + .7, y1 - .9, S[1].z + .5));
    else p.push(V(h1.r + 1.4, h1.b - 1.6, S[1].z + .6), V(h1.r + .2, y1 - .1, S[1].z + .1), V((h1.l + h1.r) / 2, y1 + .05, S[1].z + .05),
      V(h1.l - .2, y1 - .15, S[1].z + .1), V(h1.l - .6, h1.b - 1.8, S[1].z + .5), V((h1.l + h1.r) / 2 + 1, h1.b - 2.6, S[1].z + 1));
    p.push(F1);
    p.push(V(h2.l - .2, y2 + .9, S[2].z + .5), V(E.l - E.w * .25, y2 + .15, S[2].z + .1),
      V(E.cx, E.cy + E.h * .05, E.z - .2),                          // behind English
      V(E.r - E.w * .1, E.cy + E.h * .12, E.z - .16),
      V((E.r + G.l) / 2, (E.cy + G.cy) / 2 - G.h * .05, S[2].z + .45),  // in front, between the cards
      V(G.l + G.w * .1, G.cy + G.h * .12, G.z - .16),
      V(G.cx, G.cy + G.h * .08, G.z - .2),                          // behind Deutsch
      V(G.r + G.w * .4, y2 - .3, S[2].z + .2), V(h2.r + 2, y2 - 1.6, S[2].z), V(h2.r + 7, y2 - 4, S[2].z - 2));

    const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal', .5);
    ropeLen = curve.getLength();
    const radius = Math.max(lw * .02, .016);
    const segN = mob ? 700 : 1300;
    const geo = new THREE.TubeGeometry(curve, segN, radius, mob ? 8 : 12, false);
    // taper the first part so the thread grows out of the thin flick of the G
    const pos = geo.attributes.position, rs = (mob ? 8 : 12) + 1, ctr = new THREE.Vector3(), v = new THREE.Vector3();
    const taperLen = lw * .35 / ropeLen;
    for (let i = 0; i <= segN; i++) {
      const t = i / segN; if (t > taperLen) break;
      const k = Math.pow(t / taperLen, .7); curve.getPointAt(t, ctr);
      for (let j = 0; j < rs; j++) { const idx = i * rs + j; v.fromBufferAttribute(pos, idx).sub(ctr).multiplyScalar(Math.max(k, .02)).add(ctr); pos.setXYZ(idx, v.x, v.y, v.z); }
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    if (ropeMesh) { ropeMesh.geometry.dispose(); ropeMesh.geometry = geo; }
    else { ropeMesh = new THREE.Mesh(geo, ropeMat); ropeMesh.castShadow = true; scene.add(ropeMesh); }
    const pitch = radius * 2 * Math.PI * 1.15;
    ropePitch = pitch; rope.n.repeat.set(ropeLen / pitch, 1); rope.c.repeat.copy(rope.n.repeat);

    // camera flights: calm → close past the thread → calm
    const rc = restCam.map(c => c.position.clone());
    const dive = (F, side) => reduce ? null : F.clone().add(V(side * (mob ? .3 : .55), mob ? .35 : .28, mob ? 1.35 : 1.3));
    camCurves = [0, 1].map(i => { const m = dive(i ? F1 : F0, i ? -1 : 1); return new THREE.CatmullRomCurve3(m ? [rc[i], m, rc[i + 1]] : [rc[i], rc[i + 1]], false, 'centripetal'); });
    lookCurves = [0, 1].map(i => { const F = i ? F1 : F0; return new THREE.CatmullRomCurve3(reduce ? [S[i], S[i + 1]] : [S[i], F.clone().add(V(0, -.1, -.8)), S[i + 1]], false, 'centripetal'); });

    // invisible buttons over the cards
    for (const [k, el] of [['daiana', '#slotDaiana'], ['en', '#slotEn'], ['de', '#slotDe']]) {
      const r = $(el).getBoundingClientRect(); Object.assign(hits[k].style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    }
  }

  build();
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(build, 120); });

  /* ---------- loop ---------- */
  const clock = new THREE.Timer();
  let cur = scrollY, last = cur, ropeShift = 0;
  const cA = new THREE.Color(), cB = new THREE.Color(), look = new THREE.Vector3();
  function lerpColor(arr, f, out) { const i = Math.min(arr.length - 2, Math.floor(f)), t = f - i; return out.set(arr[i]).lerp(cB.set(arr[i + 1]), t); }

  function frame() {
    clock.update(); const dt = Math.min(clock.getDelta(), .05), time = clock.getElapsed();
    cur += (scrollY - cur) * (1 - Math.exp(-dt * (reduce ? 30 : 5.5)));
    if (Math.abs(scrollY - cur) < .05) cur = scrollY;
    const ph = phaseAt(cur);
    updatePanels(ph);
    hdr.classList.toggle('scrolled', ph.f > .04);
    hint.style.opacity = cur > 30 ? 0 : 1;
    credits.style.opacity = ph.f > 1.85 ? .75 : 0;

    // camera
    if (ph.tr) {
      const u = smooth(ph.u);
      camera.position.copy(camCurves[ph.i].getPoint(u));
      look.copy(lookCurves[ph.i].getPoint(u));
    } else { camera.position.copy(restCam[ph.i].position); look.copy(S[ph.i]); }
    // a breath of parallax with the pointer on desktop
    camera.position.x += mx * .05; camera.position.y += my * .03;
    camera.lookAt(look);

    // thread is pulled along as you scroll
    if (!reduce) ropeShift += (cur - last) / vh * 1.1;          // world units the thread travels per screen of scroll
    last = cur;
    rope.n.offset.x = rope.c.offset.x = -ropeShift / ropePitch;

    // light + background follow the section
    lerpColor(BG, ph.f, cA); scene.background.copy(cA); document.body.style.background = cA.getStyle(); document.documentElement.style.background = cA.getStyle();
    lerpColor(LIGHT, ph.f, cA); sun.color.copy(cA); hemi.color.copy(cA);
    sun.target.position.copy(look); sun.position.copy(look).add(V(-2.2, 3.6, 12));
    hemi.intensity = 1.35 - .25 * Math.sin(Math.min(1, Math.max(0, ph.f - 0.5)) * Math.PI);

    catchers.forEach((c, k) => { c.visible = k === Math.round(ph.f); });
    // cards: gentle float + flip
    for (const c of Object.values(cards)) {
      const u = c.userData; u.flip += (u.flipTo - u.flip) * (1 - Math.exp(-dt * 7));
      c.rotation.set(u.base.x + Math.sin(time * .6 + c.position.x) * .012, u.base.y + u.flip * Math.PI + Math.sin(time * .5) * .01, u.base.z * (1 - u.flip * 2));
      if (u.home) c.position.set(u.home.x, u.home.y + Math.sin(time * .7 + u.home.x) * .015, u.home.z + Math.sin(u.flip * Math.PI) * .35);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  let mx = 0, my = 0;
  if (matchMedia('(pointer:fine)').matches && !reduce) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = -(e.clientY / innerHeight - .5); });
  frame();
  document.documentElement.classList.add('ready');
}

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
