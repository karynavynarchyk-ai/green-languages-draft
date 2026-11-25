import * as THREE from 'three';

const LOGO_VB = { x: 66, y: 80.75, w: 404, h: 449.42 };
const TIP = { x: 362.56, y: 410.37 };                 // end of the G's lower flick (from the logo PDF)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAP = location.search.includes('cap');
const canvas = document.getElementById('rope');

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { canvas.remove(); }
if (renderer) start();

function start() {
  const mob = () => innerWidth < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mob() ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500);
  scene.add(new THREE.HemisphereLight('#fffaf2', '#c9b9a5', 1.6));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.set(-.5, .8, 1); scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffe7c8', .8); rim.position.set(.7, -.2, .6); scene.add(rim);

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
  const U = { uLine: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: '#7E8C79', map: braid.color, normalMap: braid.normal, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: braid.rough,
    roughness: .9, sheen: 1, sheenRoughness: .4, sheenColor: new THREE.Color('#dfe7d4') });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying float vY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    sh.fragmentShader = 'uniform float uLine; varying float vY;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (-vY > uLine) discard;');
  };
  const tex = [braid.normal, braid.color, braid.rough];
  let mesh = null, R = 9, len = 1;

  const pt = el => { const r = el.getBoundingClientRect(); return new THREE.Vector3(r.left + r.width / 2, -(r.top + scrollY + r.height / 2), 0); };
  function build() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    cam.left = 0; cam.right = W; cam.top = 0; cam.bottom = -H; cam.updateProjectionMatrix();
    R = mob() ? 5.5 : 8.5;
    const lg = document.getElementById('logo').getBoundingClientRect();
    const tip = new THREE.Vector3(lg.left + (TIP.x - LOGO_VB.x) / LOGO_VB.w * lg.width, -(lg.top + scrollY + (TIP.y - LOGO_VB.y) / LOGO_VB.h * lg.height), 0);
    const hb = -(document.querySelector('header').getBoundingClientRect().bottom + scrollY + (mob() ? 6 : 14));
    const lw = lg.width;
    const p = [tip, new THREE.Vector3(tip.x + lw * .12, tip.y - lw * .2, 0), new THREE.Vector3(tip.x + lw * .55, Math.min(hb, tip.y - lw * .4), 0)];
    if (!mob()) {
      p.push(new THREE.Vector3(W * .42, hb + 4, 0));
      document.querySelectorAll('.rp').forEach(el => p.push(pt(el)));
    } else {
      // phones: the cord runs down the right margin and only dives behind the cards
      const ex = W - 11, V = (x, y) => new THREE.Vector3(x, y, 0);
      const box = el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: -(r.top + scrollY), b: -(r.bottom + scrollY), cx: r.left + r.width / 2, cy: -(r.top + scrollY + r.height / 2) }; };
      p.push(V(ex - 6, hb - 30));
      const dive = (el, side) => { const c = box(el); p.push(V(ex, c.t + 40), V(c.r - 30, c.t - 40), V(c.cx + side * c.r * .1, c.cy), V(c.l + 30, c.b + 50), V(ex, c.b - 30)); };
      const walk = (y0, y1) => { for (let y = y0 - 260; y > y1 + 60; y -= 260) p.push(V(ex - 4 * Math.sin(y * .01), y)); };
      const flips = [document.querySelector('.stage .flip'), ...document.querySelectorAll('.langs .flip')];
      let y = hb - 30;
      for (const f of flips) { const c = box(f); walk(y, c.t + 40); dive(f, 1); y = c.b - 30; }
      const end = -(document.querySelector('footer').getBoundingClientRect().top + scrollY) + 120;
      walk(y, end); p.push(V(ex - 2, end));
    }
    const last = p[p.length - 1]; if (!mob()) p.push(new THREE.Vector3(last.x + W * .12, last.y - 40, 0), new THREE.Vector3(last.x + W * .2, last.y + 10, 0)); else p.push(new THREE.Vector3(last.x - 30, last.y - 60, 0));
    const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal', .5);
    len = curve.getLength();
    const seg = Math.min(9000, Math.ceil(len / R * 1.6)), rad = mob() ? 12 : 16;
    const g = new THREE.TubeGeometry(curve, seg, R, rad, false);
    // grow out of the thin flick of the G, and taper off at the end
    const pos = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3(), tIn = lw * .7 / len, tOut = 120 / len;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; let k = 1;
      if (t < tIn) k = Math.max(.05, Math.pow(t / tIn, .6)); else if (t > 1 - tOut) k = Math.max(.05, Math.pow((1 - t) / tOut, .7)); else continue;
      curve.getPointAt(t, c);
      for (let j = 0; j <= rad; j++) { const id = i * (rad + 1) + j; v.fromBufferAttribute(pos, id).sub(c).multiplyScalar(k).add(c); pos.setXYZ(id, v.x, v.y, v.z); }
    }
    pos.needsUpdate = true; g.computeVertexNormals();
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = g; } else { mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh); }
    const tile = 2 * Math.PI * R * 2; tex.forEach(t => t.repeat.set(len / tile, 1));
    dirty = true;
  }

  let dirty = true, shown = reduce || CAP ? 1e9 : 0, t0 = performance.now(), lastY = scrollY, shift = 0;
  const target = () => scrollY + innerHeight * .82;
  function frame() {
    const intro = Math.min(1, (performance.now() - t0) / 1800);
    const want = Math.max(target(), (reduce || CAP) ? 1e9 : 0);
    const introLine = intro < 1 ? innerHeight * .82 * (1 - Math.pow(1 - intro, 3)) : Infinity;
    const line = Math.min(want, introLine === Infinity ? want : Math.max(introLine, 0));
    const nl = Math.max(shown, line);                    // the cord only ever grows; scrolling back keeps it
    if (nl !== shown) { shown = nl; dirty = true; }
    if (scrollY !== lastY) { if (!reduce) shift += (scrollY - lastY) * .9; lastY = scrollY; dirty = true; }
    if (dirty) {
      U.uLine.value = shown;
      cam.position.y = -scrollY; cam.updateMatrixWorld();
      const tile = 2 * Math.PI * R * 2; tex.forEach(t => { t.offset.x = -shift / tile; });
      renderer.render(scene, cam); dirty = false;
    }
    requestAnimationFrame(frame);
  }
  let rt; const rebuild = () => { clearTimeout(rt); rt = setTimeout(build, 150); };
  addEventListener('resize', rebuild); addEventListener('layout', rebuild);
  new ResizeObserver(rebuild).observe(document.body);
  document.fonts.ready.then(build); addEventListener('load', build);
  build(); frame();
}
