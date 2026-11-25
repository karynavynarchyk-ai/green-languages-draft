import * as THREE from 'three';

const LOGO_VB = { x: 66, y: 80.75, w: 404, h: 449.42 };
const TIP = { x: 362.56, y: 410.37 };                 // end of the G's lower flick (from the logo PDF)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAP = location.search.includes('cap');
const vertical = matchMedia('(max-width:820px),(max-height:560px)');
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const track = $('#track'), row = $('#row'), bar = $('#bar'), prog = $('#prog');
const panels = $$('.panel');

/* ---------- small UI ---------- */
$$('.flip').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true')));
const tabs = $$('.tabs button');
tabs.forEach(t => t.onclick = () => { tabs.forEach(x => x.setAttribute('aria-selected', x === t)); $$('.cards').forEach(c => c.hidden = c.dataset.p !== t.dataset.t); });
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px -4% -6% 0px' });
$$('.rv').forEach(el => CAP ? el.classList.add('in') : io.observe(el));

/* ---------- horizontal (slightly descending) scroll ---------- */
let W = innerWidth, H = innerHeight, dist = 0, stops = [], cur = scrollY, tx = 0, ty = 0;
function measure() {
  W = innerWidth; H = innerHeight;
  if (vertical.matches) { track.style.height = ''; return; }
  stops = panels.map(p => ({ x: p.offsetLeft, y: p.offsetTop }));
  dist = row.scrollWidth - W;
  track.style.height = (dist + H) + 'px';
}
function yAt(x) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (x <= b.x) { const span = Math.max(1, b.x - a.x), k = Math.max(0, (x - a.x) / span); return a.y + (b.y - a.y) * k; }
  }
  return stops[stops.length - 1]?.y || 0;
}
const go = p => scrollTo({ top: vertical.matches ? p.offsetTop : p.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
$$('a[href^="#p"]').forEach(a => a.addEventListener('click', e => { const p = document.getElementById(a.getAttribute('href').slice(1)); if (p) { e.preventDefault(); go(p); } }));
document.addEventListener('focusin', e => { if (vertical.matches) return; const p = e.target.closest('.panel'); if (p && (p.offsetLeft < tx - 2 || p.offsetLeft + p.offsetWidth > tx + W + 2)) scrollTo({ top: p.offsetLeft }); $('#view').scrollLeft = 0; $('#view').scrollTop = 0; });

/* ---------- the cord ---------- */
const canvas = $('#rope');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { canvas.remove(); }
let draw = () => {}, buildRope = () => {};
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500);
  scene.add(new THREE.HemisphereLight('#fffaf2', '#c9b9a5', 1.7));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.1); sun.position.set(-.5, .8, 1); scene.add(sun);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
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
  const U = { uX: { value: 0 }, uY: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: '#7D8A77', map: braid.color, normalMap: braid.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: braid.rough, roughness: .9, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#e3eadb') });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec2 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xy;');
    sh.fragmentShader = 'uniform float uX; uniform float uY; varying vec2 vP;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vP.x > uX || -vP.y > uY) discard;');
  };
  let mesh = null, R = 4;
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  buildRope = () => {
    renderer.setSize(W, H, false);
    cam.left = 0; cam.right = W; cam.top = 0; cam.bottom = -H; cam.updateProjectionMatrix();
    const vert = vertical.matches;
    R = vert ? 3 : 4.2;
    // positions in "page" space: the row for the horizontal layout, the document for phones
    const offX = vert ? 0 : tx, offY = vert ? scrollY : ty;
    const at = el => { const r = el.getBoundingClientRect(); return V(r.left + r.width / 2 + offX, -(r.top + r.height / 2 + offY)); };
    const lg = $('#logo').getBoundingClientRect(), lw = lg.width;
    const tip = V(lg.left + offX + (TIP.x - LOGO_VB.x) / LOGO_VB.w * lw, -(lg.top + offY + (TIP.y - LOGO_VB.y) / LOGO_VB.h * lg.height));
    const p = [tip, V(tip.x + lw * .12, tip.y - lw * .2), V(tip.x + lw * .5, tip.y - lw * .38)];
    if (!vert) {
      p.push(V(W * .44, tip.y - lw * .42));
      $$('.rp').forEach(el => p.push(at(el)));
      const l = p[p.length - 1]; p.push(V(l.x + 90, l.y - 26), V(l.x + 150, l.y + 6));
    } else {
      const ex = W - 9, box = el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: -(r.top + offY), b: -(r.bottom + offY), cx: r.left + r.width / 2, cy: -(r.top + offY + r.height / 2) }; };
      p.push(V(ex - 6, tip.y - lw * .6));
      const walk = (y0, y1) => { for (let y = y0 - 260; y > y1 + 60; y -= 260) p.push(V(ex - 3 * Math.sin(y * .01), y)); };
      let y = tip.y - lw * .6;
      for (const f of [$('.stage .flip'), ...$$('.langs .flip')]) { const c = box(f); walk(y, c.t + 40); p.push(V(ex, c.t + 40), V(c.r - 30, c.t - 40), V(c.cx, c.cy), V(c.l + 30, c.b + 50), V(ex, c.b - 30)); y = c.b - 30; }
      const end = -(document.documentElement.scrollHeight) + 160; walk(y, end); p.push(V(ex - 2, end), V(ex - 30, end - 50));
    }
    const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal', .5), len = curve.getLength();
    const seg = Math.min(12000, Math.ceil(len / R * 1.1)), rad = 12;
    const g = new THREE.TubeGeometry(curve, seg, R, rad, false);
    const pos = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3(), tIn = lw * .7 / len, tOut = 90 / len;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; let k;
      if (t < tIn) k = Math.max(.06, Math.pow(t / tIn, .6)); else if (t > 1 - tOut) k = Math.max(.06, Math.pow((1 - t) / tOut, .7)); else continue;
      curve.getPointAt(t, c);
      for (let j = 0; j <= rad; j++) { const id = i * (rad + 1) + j; v.fromBufferAttribute(pos, id).sub(c).multiplyScalar(k).add(c); pos.setXYZ(id, v.x, v.y, v.z); }
    }
    pos.needsUpdate = true; g.computeVertexNormals();
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = g; } else { mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh); }
    const tile = 2 * Math.PI * R * 2; [braid.normal, braid.color, braid.rough].forEach(t => t.repeat.set(len / tile, 1));
  };
  let shownX = 0, shownY = 0;
  const t0 = performance.now();
  draw = () => {
    const vert = vertical.matches;
    const intro = CAP || reduce ? 1 : Math.min(1, (performance.now() - t0) / 1600), e = 1 - Math.pow(1 - intro, 3);
    if (vert) { shownX = 1e9; shownY = Math.max(shownY, scrollY + H * (.2 + .65 * e)); cam.position.set(0, -scrollY, 0); }
    else { shownY = 1e9; shownX = Math.max(shownX, tx + W * (.15 + .75 * e)); cam.position.set(tx, -ty, 0); }
    U.uX.value = shownX; U.uY.value = shownY;
    cam.updateMatrixWorld(); renderer.render(scene, cam);
  };
}

/* ---------- loop ---------- */
let last = performance.now(), needs = true;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!vertical.matches) {
    const target = Math.min(scrollY, dist);
    cur += (target - cur) * (CAP || reduce ? 1 : 1 - Math.exp(-dt * 7));
    if (Math.abs(target - cur) < .1) cur = target;
    tx = cur; ty = yAt(cur);
    row.style.transform = `translate3d(${-tx}px,${-ty}px,0)`;
    prog.style.width = (dist ? tx / dist * 100 : 0) + '%';
    bar.classList.toggle('on', tx > W * .45);
  } else { bar.classList.toggle('on', scrollY > H * .6); prog.style.width = '0'; }
  draw();
  requestAnimationFrame(frame);
}
let rt; const rebuild = () => { clearTimeout(rt); rt = setTimeout(() => { measure(); cur = vertical.matches ? 0 : Math.min(scrollY, dist); tx = cur; ty = yAt(cur); row.style.transform = vertical.matches ? '' : `translate3d(${-tx}px,${-ty}px,0)`; buildRope(); }, 120); };
addEventListener('resize', rebuild); vertical.addEventListener('change', rebuild);
document.fonts.ready.then(rebuild); addEventListener('load', rebuild);
new ResizeObserver(rebuild).observe(row);
measure(); rebuild(); requestAnimationFrame(frame);
