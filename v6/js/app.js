import * as THREE from 'three';
import { EffectComposer } from './addons/postprocessing/EffectComposer.js';
import { RenderPass } from './addons/postprocessing/RenderPass.js';
import { BokehPass } from './addons/postprocessing/BokehPass.js';
import { OutputPass } from './addons/postprocessing/OutputPass.js';

/* ---------- constants ---------- */
const LOGO = '#707D6C';
const BG = ['#EFE6DA', '#EEE4D7', '#ECE3D6'];
const LOGO_VB = { x: 66, y: 80.75, w: 404, h: 449.42 };
const TIP = { x: 362.56, y: 410.37 };                       // end of the G's lower flick (from the PDF vector)
const CAP = location.search.includes('cap');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const panels = $$('.panel'), hdr = $('#hdr'), hint = $('#hint'), credits = $('.credits'), track = $('#track');
const hits = { daiana: $('#hitDaiana'), en: $('#hitEn'), de: $('#hitDe') };

/* ---------- scroll timeline ---------- */
let vh = innerHeight, segs = [], total = 0;
function layoutTimeline() {
  vh = innerHeight;
  const rest = [0.45, 0.9, 1.0].map(k => k * vh), tr = 2.1 * vh;
  segs = []; let y = 0;
  rest.forEach((r, i) => { segs.push({ type: 'rest', i, a: y, b: y + r }); y += r; if (i < rest.length - 1) { segs.push({ type: 'tr', i, a: y, b: y + tr }); y += tr; } });
  total = y; track.style.height = (total + vh) + 'px';
  const at = { top: 0, directions: segs[2].a + 4, about: segs[4].a + 4 };
  for (const [id, top] of Object.entries(at)) document.getElementById(id).style.cssText = `position:absolute;left:0;top:${top}px;width:1px;height:1px`;
}
function phaseAt(s) {
  s = Math.max(0, Math.min(total, s));
  for (const g of segs) if (s <= g.b) { const u = (s - g.a) / (g.b - g.a); return g.type === 'rest' ? { f: g.i, i: g.i, u: 0, tr: false } : { f: g.i + u, i: g.i, u, tr: true }; }
  return { f: 2, i: 2, u: 0, tr: false };
}
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
let active = -1;
function updatePanels(ph) {
  let show = ph.i; if (ph.tr) show = ph.u < 0.07 ? ph.i : ph.u > 0.9 ? ph.i + 1 : -1;
  if (show === active) return; active = show;
  panels.forEach(p => { const on = +p.dataset.i === show; p.toggleAttribute('data-off', !on); p.inert = !on; });
  for (const b of Object.values(hits)) { const on = +b.dataset.s === show; b.style.pointerEvents = on ? 'auto' : 'none'; b.tabIndex = on ? 0 : -1; b.style.opacity = on ? 1 : 0; }
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const el = document.getElementById(a.getAttribute('href').slice(1)); e.preventDefault(); if (el) scrollTo({ top: el.offsetTop, behavior: reduce ? 'auto' : 'smooth' }); }));

/* ---------- WebGL ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer) startFallback(); else start3D();

function startFallback() {
  document.documentElement.classList.add('nogl'); layoutTimeline();
  const sc = $('#staticDaiana'), sl = $('#slotDaiana').getBoundingClientRect();
  Object.assign(sc.style, { left: sl.left + 'px', top: sl.top + 'px', width: sl.width + 'px' });
  const tick = () => { const ph = phaseAt(scrollY); updatePanels(ph); sc.style.opacity = ph.f < 0.3 ? 1 : 0; requestAnimationFrame(tick); }; tick();
}

async function start3D() {
  const mobile = () => innerWidth < 760;
  const DPR = Math.min(devicePixelRatio, mobile() ? 1.6 : 2);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG[0]);
  scene.fog = new THREE.Fog(BG[0], 13, 29);                   // the next section waits in the haze ahead
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.03, 200);
  const D = 10;
  const S = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(.6, -1.2, -24), new THREE.Vector3(-.4, -2.2, -48)];

  const hemi = new THREE.HemisphereLight('#fff7ee', '#d8c6b2', 1.35);
  const sun = new THREE.DirectionalLight('#fff3e6', 2.0);
  sun.castShadow = true; const sm = mobile() ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 0.5, far: 40 });
  sun.shadow.radius = 8; sun.shadow.bias = -0.0005; sun.shadow.normalBias = .01;
  const rim = new THREE.DirectionalLight('#ffe2bf', 1.1);
  scene.add(hemi, sun, sun.target, rim, rim.target);
  const catchers = S.map(c => { const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: .1 })); m.position.set(c.x, c.y, c.z - .06); m.receiveShadow = true; scene.add(m); return m; });

  /* depth of field: sharp when calm, the world melts behind the rope in flight */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0, maxblur: .012 });
  composer.addPass(bokeh); composer.addPass(new OutputPass());

  await document.fonts.ready;
  await Promise.all(['400 40px Hand', '500 20px Manrope', '400 40px GLSerif'].map(f => document.fonts.load(f, 'Даяна English')));
  const files = ['daiana', 'london', 'koeln', 'muenchen'], IM = {};
  (await Promise.all([...files.map(f => loadImg(`img/${f}.webp`)), loadImg('img/logo.svg')])).forEach((im, k) => { IM[files[k] || 'logo'] = im; });

  /* ---------- textures ---------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const paperNoise = (ctx, w, h, a = 10) => { const id = ctx.getImageData(0, 0, w, h), d = id.data; for (let k = 0; k < d.length; k += 4) { if (!d[k + 3]) continue; const n = (Math.random() - .5) * a; d[k] += n; d[k + 1] += n; d[k + 2] += n; } ctx.putImageData(id, 0, 0); };
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const CW = 1000, CH = 1200, M = 56, PH = 860;
  function instaxFront(drawPhoto, title, sub) {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
    rr(c, 0, 0, CW, CH, 26); c.fillStyle = '#F7F1E9'; c.fill();
    const g = c.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(180,160,135,.1)'); c.fillStyle = g; c.fill();
    paperNoise(c, CW, CH, 8);
    c.save(); rr(c, M, M, CW - 2 * M, PH, 6); c.clip(); drawPhoto(c, M, M, CW - 2 * M, PH); c.restore();
    c.strokeStyle = 'rgba(60,40,25,.16)'; c.lineWidth = 2; c.strokeRect(M, M, CW - 2 * M, PH);
    c.textAlign = 'center'; c.fillStyle = LOGO; c.font = '400 128px Hand'; c.fillText(title, CW / 2, M + PH + 158);
    if (sub) { c.fillStyle = '#5E5249'; c.font = '500 30px Manrope'; c.letterSpacing = '7px'; c.fillText(sub, CW / 2, M + PH + 222); }
    return tex(cv);
  }
  function instaxBack(title, lines, foot) {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const c = cv.getContext('2d');
    rr(c, 0, 0, CW, CH, 26); c.fillStyle = '#F3EDE6'; c.fill(); paperNoise(c, CW, CH, 8);
    if (title) {
      c.fillStyle = LOGO; c.font = '400 150px Hand'; c.textAlign = 'left'; c.fillText(title, 110, 270);
      c.fillStyle = '#B9A891'; c.fillRect(110, 320, 120, 3);
      c.fillStyle = '#2A221D'; c.font = '400 46px GLSerif'; lines.forEach((l, k) => c.fillText(l, 110, 440 + k * 92));
      c.fillStyle = '#7A6C60'; c.font = '500 26px Manrope'; c.letterSpacing = '5px'; c.fillText(foot, 110, CH - 110);
    }
    return tex(cv);
  }
  const cover = (img, fx = .5, fy = .5) => (c, x, y, w, h) => { const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s; c.drawImage(img, x + (w - iw) * fx, y + (h - ih) * fy, iw, ih); };
  const daianaPhoto = (c, x, y, w, h) => {
    const g = c.createRadialGradient(x + w * .5, y + h * .25, 40, x + w * .5, y + h * .45, h * .9);
    g.addColorStop(0, '#F2E6D7'); g.addColorStop(.6, '#D9C3A8'); g.addColorStop(1, '#BFA284'); c.fillStyle = g; c.fillRect(x, y, w, h);
    const s = (w * 1.02) / IM.daiana.width; c.drawImage(IM.daiana, x + (w - IM.daiana.width * s) / 2, y + h * .03, IM.daiana.width * s, IM.daiana.height * s);
  };

  /* ---------- braided cord: diamond weave, like a real paracord ---------- */
  function braidMaps() {
    const W = 512, Hh = 256, n = 4;                    // texture spans one circumference (v) and two circumferences of length (u)
    const hgt = new Float32Array(W * Hh), shade = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const u = x / Hh, v = y / Hh;                        // square units: 1 unit = one circumference
      const a = (u + v) * n, b = (u - v) * n + 64;
      const fa = a - Math.floor(a), fb = b - Math.floor(b);
      const pa = Math.pow(Math.sin(Math.PI * fa), .6), pb = Math.pow(Math.sin(Math.PI * fb), .6);
      const aTop = ((Math.floor(a) + Math.floor(b)) & 1) === 0;
      // fibres run along each strand
      const fibA = .06 * Math.sin((u - v) * n * Math.PI * 2 * 7), fibB = .06 * Math.sin((u + v) * n * Math.PI * 2 * 7);
      const ha = pa * (aTop ? 1 : .55) + fibA * pa, hb = pb * (aTop ? .55 : 1) + fibB * pb;
      const h = Math.max(ha, hb) + (Math.random() - .5) * .03;
      hgt[y * W + x] = h; shade[y * W + x] = Math.min(1, h);
    }
    const mk = fn => { const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d'), d = c.createImageData(W, Hh);
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) fn(d.data, (y * W + x) * 4, x, y); c.putImageData(d, 0, 0); return cv; };
    const H = (x, y) => hgt[((y + Hh) % Hh) * W + ((x + W) % W)];
    const nCv = mk((D, k, x, y) => { const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2, dy = (H(x, y + 1) - H(x, y - 1)) * 3.2, l = Math.hypot(dx, dy, 1);
      D[k] = (-dx / l * .5 + .5) * 255; D[k + 1] = (dy / l * .5 + .5) * 255; D[k + 2] = (1 / l * .5 + .5) * 255; D[k + 3] = 255; });
    const cCv = mk((D, k, x, y) => { const v = 120 + 135 * Math.pow(shade[y * W + x], .8); D[k] = D[k + 1] = D[k + 2] = v; D[k + 3] = 255; });
    const rCv = mk((D, k, x, y) => { const v = 255 - 70 * shade[y * W + x]; D[k] = D[k + 1] = D[k + 2] = v; D[k + 3] = 255; });
    const out = [nCv, cCv, rCv].map(cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; return t; });
    out[1].colorSpace = THREE.SRGBColorSpace;
    return { normal: out[0], color: out[1], rough: out[2] };
  }
  const braid = braidMaps();
  const ropeU = { uReveal: { value: reduce || CAP ? 1 : 0 } };
  const ropeMat = new THREE.MeshPhysicalMaterial({ color: '#7E8C79', map: braid.color, normalMap: braid.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: braid.rough,
    roughness: .9, metalness: 0, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#d9e2cf') });
  const reveal = sh => { Object.assign(sh.uniforms, ropeU);
    sh.vertexShader = 'varying float vS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = uv.x;');
    sh.fragmentShader = 'uniform float uReveal; varying float vS;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vS > uReveal) discard;'); };
  ropeMat.onBeforeCompile = reveal;
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); depthMat.onBeforeCompile = reveal;
  const ropeTex = [braid.normal, braid.color, braid.rough];

  /* ---------- objects ---------- */
  const logoCv = document.createElement('canvas'); logoCv.width = 1200; logoCv.height = Math.round(1200 * LOGO_VB.h / LOGO_VB.w);
  logoCv.getContext('2d').drawImage(IM.logo, 0, 0, logoCv.width, logoCv.height);
  const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(logoCv), transparent: true, depthWrite: false, fog: false }));
  logoMesh.renderOrder = 2; scene.add(logoMesh);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.5, 96), new THREE.MeshStandardMaterial({ color: '#AAB09C', roughness: 1 }));
  disc.receiveShadow = true; scene.add(disc);

  const cardShape = (() => { const w = 1, h = CH / CW, r = .026, sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return sh; })();
  const bodyGeo = new THREE.ExtrudeGeometry(cardShape, { depth: .024, bevelEnabled: false, curveSegments: 6 }), faceGeo = new THREE.PlaneGeometry(1, CH / CW);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#EFE6DA', roughness: .9 });
  function makeCard(front, back) {
    const g = new THREE.Group(), d = .024;
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.z = -d / 2; body.castShadow = true; g.add(body);
    const mk = (t, z, ry) => { const m = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: t, roughness: .78, alphaTest: .5, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .3 })); m.position.z = z; m.rotation.y = ry; g.add(m); };
    mk(front, d / 2 + .0015, 0); mk(back, -d / 2 - .0015, Math.PI);
    g.userData = { flip: 0, flipTo: 0, base: new THREE.Euler() }; scene.add(g); return g;
  }
  const back = 'НАЖМИТЕ, ЧТОБЫ ВЕРНУТЬ';
  const cards = {
    daiana: makeCard(instaxFront(daianaPhoto, 'Даяна', 'ОСНОВАТЕЛЬНИЦА GREEN LANGUAGES'), instaxBack('Даяна', ['Живёт в Германии', 'Cambridge C1 · Goethe C1', 'Училась в Ирландии', 'Путешествует по Европе', 'Основала Green Languages'], back)),
    en: makeCard(instaxFront(cover(IM.london, .5, .35), 'English', 'АНГЛИЙСКИЙ'), instaxBack('English', ['С нуля до C1', 'Индивидуально и в группе', 'Speaking Club', 'IELTS · CAE · FCE · НМТ'], back)),
    de: makeCard(instaxFront(cover(IM.koeln, .3, .5), 'Deutsch', 'НЕМЕЦКИЙ'), instaxBack('Deutsch', ['С нуля до C1', 'Индивидуально и в группе', 'Sprachclub', 'Goethe · TELC · DTZ'], back)),
    city: makeCard(instaxFront(cover(IM.muenchen, .5, .5), 'München', ''), instaxBack()),
  };
  cards.daiana.userData.base.set(-.05, -.22, .05);
  cards.en.userData.base.set(.04, .22, -.06);
  cards.de.userData.base.set(-.05, -.2, .05);
  cards.city.userData.base.set(-.03, -.24, .06);
  for (const [k, b] of Object.entries(hits)) b.addEventListener('click', () => { const u = cards[k].userData; u.flipTo = u.flipTo ? 0 : 1; b.setAttribute('aria-pressed', !!u.flipTo); });
  addEventListener('keydown', e => { if (e.key === 'Escape') for (const [k, b] of Object.entries(hits)) { cards[k].userData.flipTo = 0; b.setAttribute('aria-pressed', 'false'); } });

  let ropeMesh = null, ropeCurve = null, ropeLen = 1, ropeR = .08, rails = [];
  const restCam = S.map(() => new THREE.PerspectiveCamera(35, 1, .05, 200));
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3();
  function s2w(px, py, i, dz = 0) { ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); ray.setFromCamera(ndc, restCam[i]); plane.set(new THREE.Vector3(0, 0, 1), -(S[i].z + dz)); return ray.ray.intersectPlane(plane, hitP.clone()) || S[i].clone(); }
  const rectW = (el, i, dz) => { const r = el.getBoundingClientRect(); const a = s2w(r.left, r.top, i, dz), b = s2w(r.right, r.bottom, i, dz); return { l: a.x, r: b.x, t: a.y, b: b.y, w: b.x - a.x, h: a.y - b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: S[i].z + dz }; };
  const laneY = i => s2w(0, $(`.lane[data-lane="${i}"]`).getBoundingClientRect().top, i).y;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function tubeTapered(curve, R, taperLen, mob) {
    const L = curve.getLength(), seg = Math.min(4000, Math.ceil(L / R * (mob ? 1.6 : 2.4))), rad = mob ? 12 : 18;
    const g = new THREE.TubeGeometry(curve, seg, R, rad, false), pos = g.attributes.position, ctr = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) { const t = i / seg; if (t > taperLen) break; const k = Math.max(.04, Math.pow(t / taperLen, .6)); curve.getPointAt(t, ctr);
      for (let j = 0; j <= rad; j++) { const id = i * (rad + 1) + j; v.fromBufferAttribute(pos, id).sub(ctr).multiplyScalar(k).add(ctr); pos.setXYZ(id, v.x, v.y, v.z); } }
    pos.needsUpdate = true; g.computeVertexNormals(); return g;
  }

  const introAt = performance.now();
  function build() {
    const W = innerWidth, H = innerHeight, mob = mobile();
    renderer.setSize(W, H, false); composer.setSize(W, H); composer.setPixelRatio(DPR);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    restCam.forEach((c, i) => { c.aspect = W / H; c.position.copy(S[i]).add(V(0, 0, D)); c.lookAt(S[i]); c.updateProjectionMatrix(); c.updateMatrixWorld(); });
    layoutTimeline();

    const L = rectW($('#logoSlot'), 0, .06);
    logoMesh.scale.set(L.w, L.h, 1); logoMesh.position.set(L.cx, L.cy, L.z);
    const tip = V(L.l + (TIP.x - LOGO_VB.x) / LOGO_VB.w * L.w, L.t - (TIP.y - LOGO_VB.y) / LOGO_VB.h * L.h, L.z);
    const place = (card, el, i, dz) => { const R = rectW(el, i, dz); card.scale.setScalar(R.w); card.position.set(R.cx, R.cy, R.z); card.userData.home = card.position.clone(); return R; };
    const C = place(cards.daiana, $('#slotDaiana'), 0, .14), E = place(cards.en, $('#slotEn'), 1, .14), G = place(cards.de, $('#slotDe'), 1, .14), K = place(cards.city, $('#slotCity'), 2, .14);
    disc.scale.setScalar(C.w * (mob ? .95 : 1.05)); disc.position.set(C.l + C.w * .08, C.cy + C.h * .18, .0);
    const half = i => { const a = s2w(0, 0, i), b = s2w(W, H, i); return { l: a.x, r: b.x, t: a.y, b: b.y }; };
    const h0 = half(0), h1 = half(1), h2 = half(2), y0 = laneY(0), y1 = laneY(1), y2 = laneY(2);
    const hdrB = s2w(0, $('#hdr').getBoundingClientRect().bottom + (mob ? 10 : 24), 0).y;
    ropeR = mob ? .042 : .056; const lw = L.w;

    // one cord through the whole site. Index marks tell where each flight's rail starts and ends.
    const p = [tip, V(tip.x + lw * .1, tip.y - lw * .2, L.z), V(tip.x + lw * .45, Math.min(tip.y - lw * .42, hdrB), .1)];
    if (!mob) p.push(V(C.l - C.w * .1, hdrB - .05, .1), V(C.r + C.w * .35, C.t - C.h * .02, C.z - .2), V(C.r + C.w * .3, C.cy + C.h * .1, C.z - .25));
    else p.push(V(h0.r - .25, hdrB - .2, .1), V(C.r + C.w * .2, C.t + C.h * .02, C.z - .2), V(C.r + C.w * .15, C.cy, C.z - .25));
    // swings out in front of the card, under the caption, and away along the floor of the page
    p.push(V(C.r + C.w * .05, C.b - C.h * .02, C.z + .45), V(C.cx, C.b - C.h * .12, C.z + .7));
    const r0 = p.length - 1;
    p.push(V(C.l - C.w * .2, C.b - C.h * .05, C.z + .55));
    if (!mob) p.push(V((h0.l + C.l) / 2, y0 + .1, .3), V(h0.l + .3, y0 - .05, .25));
    p.push(V(h0.l - 1.4, y0 - .4, -1.5), V(h0.l + 1.2, y0 - .9, -6), V(h0.r - 2.5, y0 - .6, -11), V(h1.l + 2.5, y1 - .3, S[1].z + 7), V(h1.l - .6, y1 + .2, S[1].z + 2.2));
    const r0e = p.length - 1;
    // section 2: between the two language cards
    p.push(V(h1.l + .3, y1, S[1].z + .4), V(E.l - E.w * .15, y1 + .05, S[1].z + .2), V(E.cx, E.cy + E.h * .02, E.z - .22), V((E.r + G.l) / 2, (E.cy + G.cy) / 2 + G.h * .05, S[1].z + .5),
      V(G.l - G.w * .05, G.cy, G.z - .2), V(G.cx, G.cy + G.h * .05, G.z - .24), V(G.r + G.w * .3, y1 - .2, S[1].z + .3), V(h1.r - .2, y1 - .3, S[1].z + .25));
    const r1 = p.length - 1;
    p.push(V(h1.r + 1.2, y1 - .8, S[1].z - 1.8), V(h1.r - 1.5, y1 - 1.2, S[1].z - 7), V(h1.l + 2.2, y1 - .9, S[1].z - 12), V(h2.r - 2.2, y2 - .2, S[2].z + 7), V(h2.r + .6, y2 + .3, S[2].z + 2.2));
    const r1e = p.length - 1;
    // section 3: along the floor, in front of the city card, and on into the haze
    p.push(V(h2.r - .3, y2 + .1, S[2].z + .4), V(K.r - K.w * .1, K.b - K.h * .08, K.z + .5), V(K.l - K.w * .3, y2 + .05, S[2].z + .3),
      V((h2.l + K.l) / 2, y2 - .05, S[2].z + .25), V(h2.l - .6, y2 - .3, S[2].z), V(h2.l + 1, y2 - .8, S[2].z - 6), V(h2.r - 1, y2 - .6, S[2].z - 14), V(0, y2, S[2].z - 26));

    ropeCurve = new THREE.CatmullRomCurve3(p, false, 'centripetal', .5);
    ropeLen = ropeCurve.getLength();
    // where (0..1 along the cord) each control point sits
    const ts = (() => { const lens = ropeCurve.getLengths(p.length * 60); return p.map((_, k) => lens[Math.round(k * 60)] / ropeLen); })();
    rails = [[ts[r0], ts[r0e]], [ts[r1], ts[r1e]]];
    const geo = tubeTapered(ropeCurve, ropeR, lw * .65 / ropeLen, mob);
    if (ropeMesh) { ropeMesh.geometry.dispose(); ropeMesh.geometry = geo; }
    else { ropeMesh = new THREE.Mesh(geo, ropeMat); ropeMesh.castShadow = true; ropeMesh.customDepthMaterial = depthMat; ropeMesh.frustumCulled = false; scene.add(ropeMesh); }
    const circ = 2 * Math.PI * ropeR;                       // one texture tile = two circumferences of length
    ropeTex.forEach(t => t.repeat.set(ropeLen / (circ * 2), 1));

    for (const [k, el] of [['daiana', '#slotDaiana'], ['en', '#slotEn'], ['de', '#slotDe']]) { const r = $(el).getBoundingClientRect(); Object.assign(hits[k].style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
  }
  build();
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(build, 120); });

  /* ---------- camera rides the cord between sections ---------- */
  const P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), Tg = new THREE.Vector3(), Up = new THREE.Vector3(0, 1, 0), Side = new THREE.Vector3();
  let aheadTo = null, aheadK = 0;
  const railPose = (t, outPos, outLook, mob) => {
    ropeCurve.getPointAt(t, P1); ropeCurve.getTangentAt(t, Tg);
    Side.crossVectors(Tg, Up).normalize();
    outPos.copy(P1).addScaledVector(Tg, -(mob ? .9 : 1.15)).addScaledVector(Up, mob ? .3 : .36).addScaledVector(Side, mob ? .12 : .18);
    ropeCurve.getPointAt(Math.min(1, t + (mob ? .018 : .022)), P2); outLook.copy(P2).addScaledVector(Up, .05);
    if (aheadTo) outLook.lerp(aheadTo, aheadK);
    return P1;
  };
  const camA = new THREE.Vector3(), lookA = new THREE.Vector3(), camB = new THREE.Vector3(), lookB = new THREE.Vector3(), look = new THREE.Vector3();
  function flight(i, u, mob) {
    // 0 … .28: push in from the calm view to the cord · .28 … .78: ride along it · .78 … 1: settle on the next section
    const [ta, tb] = rails[i], rest0 = restCam[i].position, rest1 = restCam[i + 1].position;
    let focusP;
    if (u < .28) {
      const k = ease(u / .28); focusP = railPose(ta, camA, lookA, mob);
      camera.position.lerpVectors(rest0, camA, k); look.lerpVectors(S[i], lookA, k);
      return { focus: camera.position.distanceTo(focusP), blur: k };
    }
    if (u < .78) {
      const k = (u - .28) / .5; aheadTo = S[i + 1]; aheadK = .1 + .3 * k; focusP = railPose(ta + (tb - ta) * k, camA, lookA, mob); aheadTo = null;
      camera.position.copy(camA); look.copy(lookA); return { focus: camera.position.distanceTo(focusP), blur: 1 };
    }
    const k = ease((u - .78) / .22); focusP = railPose(tb, camA, lookA, mob);
    camera.position.lerpVectors(camA, rest1, k); look.lerpVectors(lookA, S[i + 1], k);
    return { focus: THREE.MathUtils.lerp(camera.position.distanceTo(focusP), D, k), blur: 1 - k };
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Timer();
  let cur = scrollY, last = cur, shift = 0, mx = 0, my = 0;
  if (matchMedia('(pointer:fine)').matches && !reduce) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = -(e.clientY / innerHeight - .5); });
  const cA = new THREE.Color(), cB = new THREE.Color();
  const lerpC = (arr, f, out) => { const i = Math.min(arr.length - 2, Math.floor(f)), t = f - i; return out.set(arr[i]).lerp(cB.set(arr[i + 1]), t); };

  function frame() {
    clock.update(); const dt = Math.min(clock.getDelta(), .05), time = clock.getElapsed(), mob = mobile();
    cur += (scrollY - cur) * (1 - Math.exp(-dt * (reduce ? 30 : 4.2)));
    if (Math.abs(scrollY - cur) < .05 || CAP) cur = scrollY;
    const ph = phaseAt(cur);
    updatePanels(ph);
    hdr.classList.toggle('scrolled', ph.f > .02);
    hint.style.opacity = cur > 30 ? 0 : 1;
    credits.style.opacity = ph.f > .9 ? .75 : 0;

    const it = CAP || reduce ? 1 : clamp01((performance.now() - introAt) / 2600);
    if (!CAP && !reduce) ropeU.uReveal.value = Math.max(ropeU.uReveal.value, smooth(clamp01((performance.now() - introAt - 150) / 2800)) * .45);
    if (ph.f > .02) ropeU.uReveal.value = 1;

    let dof = { focus: D, blur: 0 };
    if (ph.tr && !reduce) dof = flight(ph.i, ph.u, mob);
    else if (ph.tr) { const k = smooth(ph.u); camera.position.lerpVectors(restCam[ph.i].position, restCam[ph.i + 1].position, k); look.lerpVectors(S[ph.i], S[ph.i + 1], k); }
    else { camera.position.copy(restCam[ph.i].position); look.copy(S[ph.i]); }
    const calm = ph.tr ? 0 : 1;
    camera.position.x += mx * .05 * calm; camera.position.y += my * .03 * calm;
    camera.lookAt(look);

    // the cord is pulled along as you scroll
    if (!reduce) shift += (cur - last) / vh * 1.4 + dt * .03;
    last = cur;
    const tile = 2 * Math.PI * ropeR * 2;
    ropeTex.forEach(t => { t.offset.x = -shift / tile; });

    lerpC(BG, ph.f, cA); scene.background.copy(cA); scene.fog.color.copy(cA);
    document.body.style.background = document.documentElement.style.background = cA.getStyle();
    sun.target.position.copy(look); sun.position.copy(look).add(new THREE.Vector3(-2.2, 3.6, 12));
    rim.target.position.copy(look); rim.position.copy(look).add(new THREE.Vector3(4, 3, -6));
    catchers.forEach((c, k) => { c.visible = k === Math.round(ph.f); });

    for (const c of Object.values(cards)) {
      const u = c.userData; u.flip += (u.flipTo - u.flip) * (1 - Math.exp(-dt * 7));
      c.rotation.set(u.base.x + Math.sin(time * .6 + c.position.x) * .012, u.base.y + u.flip * Math.PI + Math.sin(time * .5) * .01, u.base.z * (1 - u.flip * 2));
      if (u.home) c.position.set(u.home.x, u.home.y + Math.sin(time * .7 + u.home.x) * .015, u.home.z + Math.sin(u.flip * Math.PI) * .35);
    }
    const iu = smooth(clamp01((it - .1) / .9));
    if (iu < 1) { const dc = cards.daiana; dc.position.y -= (1 - iu) * 2.4; dc.position.z += (1 - iu) * 1.6; dc.rotation.x += (1 - iu) * .9; dc.rotation.z -= (1 - iu) * .35; }
    disc.scale.setScalar(disc.scale.x); disc.material.opacity = 1;

    if (dof.blur > .01 && !mob) {
      bokeh.uniforms.focus.value = dof.focus; bokeh.uniforms.aperture.value = .006 * dof.blur; bokeh.uniforms.maxblur.value = .014;
      composer.render();
    } else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
