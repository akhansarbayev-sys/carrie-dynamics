(async () => {
  const canvas = document.getElementById('scene');
  if (!window.THREE) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch (e) { return; }

  // ---------- Earth model: one source for the cut face, the seismic and the map ----------
  // World: x -5..5, z -3..3, depth d 0..5 (y = -d). 1 unit = 500 m depth, 400 ms TWT.
  const BASES = [0, .12, .45, .95, 1.5, 2.05, 2.55, 2.95, 3.35, 3.85, 4.4, 6];
  const LAYERS = [
    { ix: 'Q',  col: '#b5a47e', pat: 'dots' },
    { ix: 'N',  col: '#8c876c', pat: 'hlines' },
    { ix: '₽',  col: '#78836f', pat: 'marl' },
    { ix: 'K', sub: '2', col: '#a6a493', pat: 'brick' },
    { ix: 'K', sub: '1', col: '#6d786a', pat: 'dash' },
    { ix: 'J', sub: '3', col: '#878c83', pat: 'brick' },
    { ix: 'J', sub: '2', col: '#4d5856', pat: 'dash' },
    { ix: 'J', sub: '2', col: '#b99a5c', pat: 'dots', res: true },
    { ix: 'J', sub: '1', col: '#756e5c', pat: 'dash' },
    { ix: 'T',  col: '#6b5a52', pat: 'hlines' },
    { ix: 'PZ', col: '#4a4a52', pat: 'cross' }
  ];
  const IMP = [3.2, 4.0, 4.6, 6.8, 5.2, 7.4, 5.6, 4.4, 5.8, 6.4, 9.0];
  const OIL = '#e3a63b', WATER = '#56727c', OWC = 2.75, FX0 = 1.2, DIP = .35, MAP_FAULT = 2.05;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const G = (x, z) => Math.exp(-((x + 1) ** 2 / 9.68 + (z - 2) ** 2 / 9.68)) + .45 * Math.exp(-((x - 4.2) ** 2 / 3.92 + (z + 1.4) ** 2 / 4.5));
  function horizon(i, x, z, hang) {
    const b = BASES[i]; if (i === 0) return 0;
    const u = sstep(.2, 1, b);
    let h = b - .75 * sstep(.3, 3, b) * G(x, z) + .03 * u * Math.sin(x * 1.7 + b * 2) + .02 * u * Math.sin(z * 2.3 + b);
    if (hang) h += .35 * sstep(.8, 1.8, b);
    return h;
  }
  const inOil = (x, z, d, hang) => d > horizon(7, x, z, hang) && d < horizon(8, x, z, hang) && d < OWC;

  try { await Promise.race([document.fonts.load('500 24px "IBM Plex Mono"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function patterns(g) {
    const out = {};
    const make = (draw) => { const c = mk(24, 24), p = c.getContext('2d'); p.strokeStyle = p.fillStyle = 'rgba(14,18,18,.32)'; p.lineWidth = 1.2; draw(p); return g.createPattern(c, 'repeat'); };
    out.dots = make(p => { [[6, 6], [18, 18]].forEach(([x, y]) => { p.beginPath(); p.arc(x, y, 1.4, 0, 7); p.fill(); }); });
    out.hlines = make(p => { p.beginPath(); p.moveTo(0, 8); p.lineTo(24, 8); p.moveTo(0, 20); p.lineTo(24, 20); p.stroke(); });
    out.dash = make(p => { p.beginPath(); p.moveTo(2, 6); p.lineTo(10, 6); p.moveTo(14, 18); p.lineTo(22, 18); p.stroke(); });
    out.brick = make(p => { p.beginPath(); p.moveTo(0, .5); p.lineTo(24, .5); p.moveTo(0, 12.5); p.lineTo(24, 12.5); p.moveTo(.5, 0); p.lineTo(.5, 12); p.moveTo(12.5, 12); p.lineTo(12.5, 24); p.stroke(); });
    out.marl = make(p => { p.beginPath(); p.moveTo(0, .5); p.lineTo(24, .5); p.moveTo(.5, 0); p.lineTo(.5, 12); p.stroke(); p.beginPath(); p.arc(18, 18, 1.3, 0, 7); p.fill(); });
    out.cross = make(p => { p.beginPath(); [[6, 6], [18, 18]].forEach(([x, y]) => { p.moveTo(x - 3, y); p.lineTo(x + 3, y); p.moveTo(x, y - 3); p.lineTo(x, y + 3); }); p.stroke(); });
    return out;
  }
  function label(g, s, sub, x, y) {
    g.font = `600 26px ${MONO}`; g.fillText(s, x, y);
    if (sub) { const w = g.measureText(s).width; g.font = `600 17px ${MONO}`; g.fillText(sub, x + w + 1, y + 7); }
  }

  // Front face (z = 3): lithology cut, fault, OWC, depth scale
  function frontTexture() {
    const c = mk(2048, 1024), g = c.getContext('2d'), S = 204.8, z = 3, P = patterns(g);
    const X = x => (x + 5) * S, Y = d => d * S, N = 240;
    const blocks = [
      { hang: false, clip: [[-5, 0], [FX0, 0], [FX0 + 5 * DIP, 5], [-5, 5]] },
      { hang: true, clip: [[FX0, 0], [5, 0], [5, 5], [FX0 + 5 * DIP, 5]] }
    ];
    for (const bl of blocks) {
      g.save(); g.beginPath(); bl.clip.forEach(([x, d], k) => k ? g.lineTo(X(x), Y(d)) : g.moveTo(X(x), Y(d))); g.closePath(); g.clip();
      for (let i = 0; i < LAYERS.length; i++) {
        const p = new Path2D(), top = new Path2D();
        for (let k = 0; k <= N; k++) { const x = -5 + 10 * k / N, y = Y(horizon(i, x, z, bl.hang)); k ? (p.lineTo(X(x), y), top.lineTo(X(x), y)) : (p.moveTo(X(x), y), top.moveTo(X(x), y)); }
        for (let k = N; k >= 0; k--) { const x = -5 + 10 * k / N; p.lineTo(X(x), Y(horizon(i + 1, x, z, bl.hang))); }
        p.closePath();
        g.fillStyle = LAYERS[i].col; g.fill(p);
        if (LAYERS[i].res) {
          g.save(); g.clip(p);
          g.fillStyle = OIL; g.fillRect(0, 0, 2048, Y(OWC));
          g.fillStyle = WATER; g.fillRect(0, Y(OWC), 2048, 1024);
          g.strokeStyle = 'rgba(240,232,214,.85)'; g.lineWidth = 2; g.setLineDash([12, 8]);
          g.beginPath(); g.moveTo(0, Y(OWC)); g.lineTo(2048, Y(OWC)); g.stroke(); g.setLineDash([]);
          g.restore();
        }
        g.fillStyle = P[LAYERS[i].pat]; g.fill(p);
        if (i > 0) { g.strokeStyle = 'rgba(10,14,15,.55)'; g.lineWidth = 1.6; g.stroke(top); }
      }
      g.restore();
    }
    // fault plane
    g.strokeStyle = 'rgba(10,12,13,.9)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(X(FX0), Y(.6)); g.lineTo(X(FX0 + 5 * DIP), Y(5)); g.stroke();
    // stratigraphic indices along the left flank
    g.fillStyle = 'rgba(8,12,14,.72)'; g.textBaseline = 'middle';
    for (let i = 0; i < LAYERS.length; i++) {
      const x = -4.25, d = (horizon(i, x, z, false) + Math.min(5, horizon(i + 1, x, z, false))) / 2;
      if (d < 4.97) label(g, LAYERS[i].ix, LAYERS[i].sub, X(x), Y(d));
    }
    // OWC tag
    g.font = `600 22px ${MONO}`; g.fillStyle = 'rgba(244,236,218,.95)'; g.textBaseline = 'top';
    g.fillText('ВНК 1375 м', X(-3.75), Y(OWC) + 8);
    // depth scale
    g.fillStyle = 'rgba(10,13,14,.8)'; g.fillRect(0, 0, 64, 1024);
    g.strokeStyle = 'rgba(231,224,209,.8)'; g.fillStyle = 'rgba(231,224,209,.9)'; g.lineWidth = 2; g.textBaseline = 'middle';
    for (let d = .25; d < 5; d += .25) {
      const major = Math.abs(d % 1) < 1e-6, y = Y(d);
      g.beginPath(); g.moveTo(64, y); g.lineTo(64 - (major ? 22 : 10), y); g.stroke();
      if (major) { g.font = `500 17px ${MONO}`; g.textAlign = 'right'; g.fillText(String(d * 500), 38, y); g.textAlign = 'left'; }
    }
    g.font = `500 15px ${MONO}`; g.textAlign = 'center'; g.fillText('м', 30, 20); g.textAlign = 'left';
    return c;
  }

  // Side face (x = 5): synthetic seismic from the same horizons, Ricker-convolved
  function seismicTexture() {
    const N = 1024, M = 1024, out = new Float32Array(N * M);
    let s = 20111; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const micro = [];
    for (let i = 0; i < 11; i++) for (let m = 1; m < 12; m++) micro.push({ i, f: m / 12 + (rnd() - .5) * .04, a: (rnd() - .5) * .18, ph: rnd() * 6.28, k: .6 + rnd() * 1.4 });
    const L = 24, fq = 1 / 13, wav = new Float32Array(2 * L + 1);
    for (let t = -L; t <= L; t++) { const a = Math.PI * Math.PI * fq * fq * t * t; wav[t + L] = (1 - 2 * a) * Math.exp(-a); }
    const refl = new Float32Array(M), hz = new Float32Array(12);
    let sum = 0;
    for (let c = 0; c < N; c++) {
      const z = 3 - 6 * c / (N - 1); refl.fill(0);
      for (let i = 0; i < 12; i++) hz[i] = horizon(i, 5, z, true);
      const add = (d, v) => { const q = d / 5 * M, q0 = Math.floor(q), fr = q - q0; if (q0 >= 0 && q0 < M - 1) { refl[q0] += v * (1 - fr); refl[q0 + 1] += v * fr; } };
      for (let i = 1; i < 11; i++) add(hz[i], (IMP[i] - IMP[i - 1]) / (IMP[i] + IMP[i - 1]));
      for (const r of micro) add(hz[r.i] + (hz[r.i + 1] - hz[r.i]) * r.f, r.a * (.75 + .25 * Math.sin(z * r.k + r.ph)));
      for (let q = 0; q < M; q++) refl[q] += (rnd() - .5) * .006;
      for (let q = 0; q < M; q++) {
        let acc = 0; const lo = Math.max(-L, q - M + 1), hi = Math.min(L, q);
        for (let t = lo; t <= hi; t++) acc += refl[q - t] * wav[t + L];
        out[q * N + c] = acc; sum += acc * acc;
      }
    }
    const rms = Math.sqrt(sum / (N * M)) || 1;
    const cv = mk(N, M), g = cv.getContext('2d'), img = g.createImageData(N, M), px = img.data;
    const mid = [44, 54, 60], neg = [58, 105, 166], pos = [236, 229, 212];
    for (let k = 0; k < N * M; k++) {
      const v = Math.tanh(out[k] / (2.2 * rms)), a = Math.pow(Math.abs(v), .8), c = v < 0 ? neg : pos;
      px[k * 4] = mid[0] + (c[0] - mid[0]) * a; px[k * 4 + 1] = mid[1] + (c[1] - mid[1]) * a; px[k * 4 + 2] = mid[2] + (c[2] - mid[2]) * a; px[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // TWT scale on the back edge (squeeze text: 170.7 px/unit across, 204.8 down)
    const sy = 204.8, sq = 170.7 / 204.8;
    g.fillStyle = 'rgba(10,13,14,.8)'; g.fillRect(N - 64, 0, 64, M);
    g.strokeStyle = 'rgba(231,224,209,.8)'; g.fillStyle = 'rgba(231,224,209,.9)'; g.lineWidth = 2; g.textBaseline = 'middle';
    for (let d = .25; d < 5; d += .25) {
      const major = Math.abs(d % 1) < 1e-6, y = d * sy;
      g.beginPath(); g.moveTo(N - 64, y); g.lineTo(N - 64 + (major ? 22 : 10), y); g.stroke();
      if (major) { g.save(); g.translate(N - 6, y); g.scale(sq, 1); g.font = `500 17px ${MONO}`; g.textAlign = 'right'; g.fillText(String(d * 400), 0, 0); g.restore(); }
    }
    g.save(); g.translate(N - 32, 20); g.scale(sq, 1); g.font = `500 15px ${MONO}`; g.textAlign = 'center'; g.fillText('мс', 0, 0); g.restore();
    return cv;
  }

  // Top face: structure map on top of the J2 reservoir
  function mapTexture() {
    const c = mk(2048, 1024), g = c.getContext('2d');
    const X = x => (x + 5) * 204.8, Z = z => (z + 3) / 6 * 1024, sq = 170.7 / 204.8;
    g.fillStyle = '#1d2624'; g.fillRect(0, 0, 2048, 1024);
    g.strokeStyle = 'rgba(231,224,209,.06)'; g.lineWidth = 1;
    for (let x = -4; x < 5; x++) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), 1024); g.stroke(); }
    for (let z = -2; z < 3; z++) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(2048, Z(z)); g.stroke(); }
    const nx = 320, nz = 192;
    const field = hang => { const F = []; for (let j = 0; j <= nz; j++) { const r = new Float32Array(nx + 1); for (let i = 0; i <= nx; i++) r[i] = horizon(7, -5 + 10 * i / nx, -3 + 6 * j / nz, hang); F.push(r); } return F; };
    const gx = i => -5 + 10 * i / nx, gz = j => -3 + 6 * j / nz;
    const TABLE = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };
    function contour(F, lev) {
      const p = new Path2D();
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const a = F[j][i], b = F[j][i + 1], cc = F[j + 1][i + 1], d = F[j + 1][i];
        const idx = (a > lev) | (b > lev) << 1 | (cc > lev) << 2 | (d > lev) << 3;
        if (!TABLE[idx]) continue;
        const e = k => { const t = (u, v) => (lev - u) / (v - u);
          if (k === 0) return [gx(i + t(a, b)), gz(j)]; if (k === 1) return [gx(i + 1), gz(j + t(b, cc))];
          if (k === 2) return [gx(i + 1 - t(cc, d)), gz(j + 1)]; return [gx(i), gz(j + 1 - t(d, a))]; };
        for (const [u, v] of TABLE[idx]) { const A = e(u), B = e(v); p.moveTo(X(A[0]), Z(A[1])); p.lineTo(X(B[0]), Z(B[1])); }
      }
      return p;
    }
    for (const hang of [false, true]) {
      const F = field(hang);
      g.save(); g.beginPath(); hang ? g.rect(X(MAP_FAULT), 0, 2048, 1024) : g.rect(0, 0, X(MAP_FAULT), 1024); g.clip();
      // oil area
      const oc = mk(nx + 1, nz + 1), og = oc.getContext('2d'), od = og.createImageData(nx + 1, nz + 1);
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const k = (j * (nx + 1) + i) * 4; od.data[k] = 227; od.data[k + 1] = 166; od.data[k + 2] = 59; od.data[k + 3] = F[j][i] < OWC ? 70 : 0; }
      og.putImageData(od, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, 2048, 1024);
      for (let m = 1100; m <= 1800; m += 50) {
        const major = m % 100 === 0;
        g.strokeStyle = major ? 'rgba(231,224,209,.62)' : 'rgba(231,224,209,.3)'; g.lineWidth = major ? 2.2 : 1.3;
        g.stroke(contour(F, m / 500));
      }
      if (!hang) { g.strokeStyle = OIL; g.lineWidth = 3; g.setLineDash([14, 9]); g.stroke(contour(F, OWC)); g.setLineDash([]); }
      g.restore();
      // labels along the crest line, west flank
      if (!hang) {
        g.font = `500 19px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const j = Math.round((2 + 3) / 6 * nz);
        for (let m = 1200; m <= 1600; m += 100) {
          for (let i = Math.round(4 / 10 * nx); i > 0; i--) {
            if (F[j][i] < m / 500 && F[j][i - 1] >= m / 500) {
              const x = X(gx(i)), y = Z(gz(j));
              g.save(); g.translate(x, y); g.scale(1, sq);
              g.fillStyle = '#1d2624'; g.fillRect(-28, -13, 56, 26); g.fillStyle = 'rgba(231,224,209,.85)'; g.fillText('−' + m, 0, 1); g.restore();
              break;
            }
          }
        }
      }
    }
    // fault trace with ticks on the downthrown side
    g.strokeStyle = 'rgba(231,224,209,.85)'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(X(MAP_FAULT), 0); g.lineTo(X(MAP_FAULT), 1024); g.stroke();
    g.lineWidth = 2.5; for (let z = -2.8; z < 3; z += .35) { g.beginPath(); g.moveTo(X(MAP_FAULT), Z(z)); g.lineTo(X(MAP_FAULT) + 16, Z(z)); g.stroke(); }
    g.save(); g.translate(X(-4.9), Z(-2.75)); g.scale(1, sq); g.font = `500 20px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(231,224,209,.75)'; g.fillText('Структурная карта по кровле J2 · изогипсы 50 м', 0, 0); g.restore();
    return c;
  }

  // ---------- Scene ----------
  const BG = 0x0b1316, BONE = 0xe7e0d1, AMBER = 0xe3a63b;
  renderer.setClearColor(BG, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 22, 48);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xfff4e0, .75); sun.position.set(6, 10, 8); scene.add(sun);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = aniso; return t; };
  const tFront = tex(frontTexture()), tSide = tex(seismicTexture()), tTop = tex(mapTexture());

  const seisMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: tSide }, reveal: { value: reduce ? 1.05 : 0 }, time: { value: 0 }, scan: { value: -1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tex; uniform float reveal; uniform float time; uniform float scan; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 pro = texture2D(tex, vUv).rgb;
        vec2 q = (floor(vUv * vec2(48.0, 110.0)) + 0.5) / vec2(48.0, 110.0);
        float l = dot(texture2D(tex, q).rgb, vec3(0.333));
        float n = hash(floor(vUv * vec2(256.0, 512.0)) + floor(time * 6.0));
        vec3 raw = mix(vec3(l) * 0.55 + vec3(0.07, 0.09, 0.1), vec3(n) * 0.45 + 0.1, 0.55);
        float e = smoothstep(reveal - 0.004, reveal + 0.004, vUv.x);
        vec3 col = mix(pro, raw, e) * 0.92;
        col += vec3(0.95, 0.85, 0.65) * exp(-pow((vUv.x - reveal) * 160.0, 2.0)) * 0.55;
        col += vec3(0.9) * exp(-pow((vUv.x - scan) * 260.0, 2.0)) * 0.14;
        gl_FragColor = vec4(col, 1.0);
      }`,
    fog: false
  });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0e171a });
  const block = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 6), [
    seisMat, dark,
    new THREE.MeshBasicMaterial({ map: tTop, color: 0xdedede }), dark,
    new THREE.MeshBasicMaterial({ map: tFront }), dark
  ]);
  block.position.y = -2.5; scene.add(block);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 5, 6)), new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: .5 }));
  edges.position.y = -2.5; scene.add(edges);
  const grid = new THREE.GridHelper(90, 90, 0x1e2b31, 0x16222a); grid.position.y = -.02; scene.add(grid);

  // Rigs: lattice derrick, drill floor, substructure, doghouse, mud tanks, pipe rack, travelling block
  const steel = new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: .9 });
  const fill = new THREE.MeshLambertMaterial({ color: 0x2a3438 });
  function boxSolid(grp, w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, fill); m.position.set(x, y + h / 2, z); grp.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), steel); e.position.copy(m.position); grp.add(e);
  }
  const blocksTravel = [];
  function rig(x, z, scale) {
    const grp = new THREE.Group(), P = [], seg = (a, b) => P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const b0 = .24, t0 = .055, y0 = .27, y1 = 2.2, n = 10;
    const lvl = k => { const w = b0 + (t0 - b0) * k / n; return { w, y: y0 + (y1 - y0) * k / n }; };
    const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let k = 0; k <= n; k++) {
      const { w, y } = lvl(k);
      for (let c = 0; c < 4; c++) { const A = C[c], B = C[(c + 1) % 4]; seg([A[0] * w, y, A[1] * w], [B[0] * w, y, B[1] * w]); }
      if (k < n) {
        const L2 = lvl(k + 1);
        for (let c = 0; c < 4; c++) {
          const A = C[c], B = C[(c + 1) % 4];
          seg([A[0] * w, y, A[1] * w], [A[0] * L2.w, L2.y, A[1] * L2.w]);
          const [P0, P1] = (k + c) % 2 ? [A, B] : [B, A];
          seg([P0[0] * w, y, P0[1] * w], [P1[0] * L2.w, L2.y, P1[1] * L2.w]);
        }
      }
    }
    // pipe rack and catwalk
    for (let r = 0; r < 5; r++) seg([-.75, .07 + r * .012, -.42 + r * .035], [-.2, .07 + r * .012, -.42 + r * .035]);
    seg([-.75, 0, -.47], [-.75, .07, -.47]); seg([-.2, 0, -.47], [-.2, .07, -.47]);
    seg([-.32, .27, 0], [-.75, .09, 0]);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(P, 3)), steel);
    grp.add(lines);
    boxSolid(grp, .62, .22, .58, 0, 0, 0);          // substructure
    boxSolid(grp, .7, .04, .66, 0, .22, 0);         // drill floor
    boxSolid(grp, .16, .08, .16, 0, y1, 0);         // crown block
    boxSolid(grp, .26, .16, .2, .5, 0, .14);        // doghouse
    boxSolid(grp, .5, .14, .16, .1, 0, -.5);        // mud tank
    boxSolid(grp, .5, .14, .16, .1, 0, -.7);        // mud tank
    const tb = new THREE.Group(); boxSolid(tb, .09, .14, .09, 0, 0, 0); grp.add(tb);
    const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, y1, 0, 0, 1, 0], 3));
    grp.add(new THREE.Line(lineGeo, steel));
    blocksTravel.push({ tb, lineGeo, y1, ph: x });
    grp.position.set(x, 0, z); grp.scale.setScalar(scale); scene.add(grp);
  }

  // Wells drawn on the cut face, with the bit position from the same model
  const FZ = 3.025, V = (x, d) => new THREE.Vector3(x, -d, FZ);
  const wellMat = new THREE.MeshBasicMaterial({ color: BONE });
  const wells = [];
  function well(path, x0, delay, dur) {
    const segs = 160, rad = 6, geo = new THREE.TubeGeometry(path, segs, .024, rad, false);
    const mesh = new THREE.Mesh(geo, wellMat); scene.add(mesh);
    const bit = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), new THREE.MeshBasicMaterial({ color: BONE }));
    scene.add(bit);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .06, 16), fill); head.position.set(x0, .03, FZ - .01); scene.add(head);
    wells.push({ path, geo, segs, rad, bit, delay, dur });
  }
  rig(-3.6, 2.7, .92);
  rig(-1.0, 2.7, 1);
  rig(0.8, 2.7, 1);
  well(new THREE.LineCurve3(V(-3.6, 0), V(-3.6, 4.25)), -3.6, .6, 15);
  well(new THREE.LineCurve3(V(-1.0, 0), V(-1.0, 2.55)), -1.0, 1.6, 10);
  const w2 = new THREE.CurvePath();
  w2.add(new THREE.LineCurve3(V(.8, 0), V(.8, 1.3)));
  w2.add(new THREE.QuadraticBezierCurve3(V(.8, 1.3), V(.8, 2.45), V(0, 2.45)));
  w2.add(new THREE.LineCurve3(V(0, 2.45), V(-.5, 2.45)));
  well(w2, .8, 3, 16);

  // Vibroseis source rings on the surface
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96), new THREE.MeshBasicMaterial({ color: BONE, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(-2.6, .006, -.9); scene.add(m); rings.push(m);
  }
  const src = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .04, 20), new THREE.MeshBasicMaterial({ color: BONE }));
  src.position.set(-2.6, .02, -.9); scene.add(src);

  // ---------- Camera, input, loop ----------
  let W = 0, H = 0, baseR = 22, shift = 0;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const wide = W >= 900;
    shift = wide ? W * .21 : 0;
    baseR = wide ? 29 * Math.max(1, 1.6 / camera.aspect) : 27 * Math.min(2.1, Math.max(1, 1.25 / camera.aspect));
    if (shift) camera.setViewOffset(W, H, -shift, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    dirty = true;
  }
  let dirty = true, mx = 0, my = 0, cx = 0, cy = 0, sp = 0;
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
  resize();

  const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const T = new THREE.Vector3();
  let start = null, last = 0, raf = 0;
  function setWells(t) {
    for (const w of wells) {
      const p = reduce ? 1 : ease(clamp((t - w.delay) / w.dur));
      w.geo.setDrawRange(0, Math.max(1, Math.floor(p * w.segs)) * w.rad * 6);
      const pt = w.path.getPointAt(Math.max(.001, p));
      w.bit.position.copy(pt);
      const d = -pt.y, hang = pt.x > FX0 + d * DIP;
      w.bit.material.color.setHex(inOil(pt.x, 3, d, hang) ? AMBER : BONE);
      w.bit.scale.setScalar(p < 1 ? 1 : 1 + .25 * Math.sin(t * 2.4) * (reduce ? 0 : 1));
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (start === null) start = now;
    const t = (now - start) / 1000, dt = Math.min(1 / 30, (now - last) / 1000 || 0); last = now;
    const hidden = scrollY > innerHeight * 2.4;
    if (hidden && !dirty) return;
    const k = 1 - Math.exp(-dt / .35);
    cx += (mx - cx) * k; cy += (my - cy) * k;
    sp += (clamp(scrollY / innerHeight) - sp) * (1 - Math.exp(-dt / .25));
    if (reduce) { cx = cy = 0; sp = 0; }
    const az = .62 + (reduce ? 0 : .1 * Math.sin(t * .06)) + .07 * cx;
    const el = .4 - .025 * cy - .08 * sp;
    const r = baseR * (1 - .2 * sp);
    T.set(0, -2.9 - .4 * sp, 0);
    camera.position.set(T.x + r * Math.sin(az) * Math.cos(el), T.y + r * Math.sin(el), T.z + r * Math.cos(az) * Math.cos(el));
    camera.lookAt(T);

    setWells(t);
    if (!reduce) {
      seisMat.uniforms.time.value = t;
      const rv = clamp((t - 1) / 7) * 1.05;
      seisMat.uniforms.reveal.value = rv;
      seisMat.uniforms.scan.value = rv >= 1.05 ? ((t - 8) / 11 % 1) * 1.3 - .15 : -1;
      rings.forEach((m, i) => { const a = ((t / 3.6 + i / 3) % 1); m.scale.setScalar(.15 + a * 2.6); m.material.opacity = (1 - a) * .55 * clamp(a * 8); });
      blocksTravel.forEach(b => { const y = 1.35 + .55 * Math.sin(t * .4 + b.ph); b.tb.position.y = y; const pa = b.lineGeo.attributes.position; pa.setY(1, y + .14); pa.needsUpdate = true; });
    }
    renderer.render(scene, camera);
    dirty = false;
    if (reduce) { cancelAnimationFrame(raf); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  addEventListener('resize', () => { if (reduce) requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add('ready'));
})().catch(e => console.error('scene:', e));
