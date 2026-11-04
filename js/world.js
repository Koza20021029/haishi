/* 《海市》3D 世界　第二版
   導覽五段：序 蜃氣 → 一 龍口 → 二 樓臺 → 三 靠近 → 四 交換，之後可以自己逛。
   畫面：夜海、龍口市場、從巷子盡頭吐出的蜃氣、海上三座樓臺。
   樓臺遠看是發光的效果圖線稿，靠近一點是有人住的日常，再靠近就散成水氣。 */
(() => {
  const D = window.HAISHI;
  const $ = id => document.getElementById(id);
  if (!window.THREE) { $('nogl').hidden = false; return; }
  const T = window.THREE;
  T.ColorManagement.legacyMode = false;               // 顏色用 sRGB 輸入，內部線性計算
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = id => D.sites.find(s => s.id === id);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const lin = (r, g, b) => new T.Color().setRGB(r, g, b);   // 直接給線性值（可大於 1，給光暈用）

  /* ================= 渲染器與後製 ================= */
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { $('nogl').hidden = false; return; }
  const DPR = Math.min(1.75, devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);
  $('stage').appendChild(renderer.domElement);
  const isGL2 = renderer.capabilities.isWebGL2;

  const scene = new T.Scene();
  const FOG = lin(.016, .02, .03);
  scene.fog = new T.FogExp2(FOG, .02);
  const camera = new T.PerspectiveCamera(50, innerWidth / innerHeight, .3, 5000);

  const rtOpt = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
  let rtMain, rtA, rtB;
  function makeTargets() {
    const w = Math.floor(innerWidth * DPR), h = Math.floor(innerHeight * DPR);
    [rtMain, rtA, rtB].forEach(r => r && r.dispose());
    rtMain = new T.WebGLRenderTarget(w, h, rtOpt); if (isGL2) rtMain.samples = 4;
    rtA = new T.WebGLRenderTarget(w >> 2, h >> 2, rtOpt); rtB = new T.WebGLRenderTarget(w >> 2, h >> 2, rtOpt);
  }
  makeTargets();
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new T.PlaneGeometry(2, 2);
  const quadVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const passScene = mat => { const s = new T.Scene(); s.add(new T.Mesh(quadGeo, mat)); return s; };
  const brightMat = new T.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: quadVS,
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(.2126,.7152,.0722)); gl_FragColor = vec4(c * smoothstep(.85, 2.2, l), 1.); }' });
  const blurMat = new T.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: quadVS,
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * .227;
        c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * .316;
        c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * .070;
        gl_FragColor = vec4(c, 1.); }` });
  const compMat = new T.ShaderMaterial({
    uniforms: { tScene: { value: null }, tBloom: { value: null }, uTime: { value: 0 }, uRes: { value: new T.Vector2() }, uHorizon: { value: .5 }, uHaze: { value: 1 }, uBloom: { value: .9 }, uExpo: { value: .92 } },
    vertexShader: quadVS,
    fragmentShader: `uniform sampler2D tScene, tBloom; uniform float uTime, uHorizon, uHaze, uBloom, uExpo; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float above = smoothstep(uHorizon - .02, uHorizon + .03, uv.y) * (1. - smoothstep(uHorizon + .05, uHorizon + .32, uv.y));
        float wob = sin(uv.y * 260. + uTime * 2.4) * .0011 + sin(uv.y * 75. - uTime * 1.1) * .0018;
        uv.x += wob * above * uHaze;
        uv.y += sin(uv.x * 40. + uTime * .9) * .0009 * above * uHaze;
        float ca = .0016 * length(vUv - .5);
        vec3 col = vec3(texture2D(tScene, uv + vec2(ca, 0.)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(ca, 0.)).b);
        col += texture2D(tBloom, vUv).rgb * uBloom;
        col *= uExpo;
        col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);
        float v = smoothstep(1.05, .3, length((vUv - .5) * vec2(1., .8)));
        col *= mix(.5, 1., v);
        col = pow(max(col, 0.), vec3(1. / 2.2));
        col += (hash(vUv * uRes + fract(uTime) * 91.) - .5) * .05;
        gl_FragColor = vec4(col, 1.); }` });
  const brightScene = passScene(brightMat), blurScene = passScene(blurMat), compScene = passScene(compMat);

  function renderFrame(t) {
    renderer.setRenderTarget(rtMain); renderer.render(scene, camera);
    brightMat.uniforms.t.value = rtMain.texture; renderer.setRenderTarget(rtA); renderer.render(brightScene, quadCam);
    for (let i = 0; i < 2; i++) {
      blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.dir.value.set((1 + i) / rtA.width, 0); renderer.setRenderTarget(rtB); renderer.render(blurScene, quadCam);
      blurMat.uniforms.t.value = rtB.texture; blurMat.uniforms.dir.value.set(0, (1 + i) / rtA.height); renderer.setRenderTarget(rtA); renderer.render(blurScene, quadCam);
    }
    compMat.uniforms.tScene.value = rtMain.texture; compMat.uniforms.tBloom.value = rtA.texture;
    compMat.uniforms.uTime.value = t; compMat.uniforms.uRes.value.set(rtMain.width, rtMain.height);
    // 地平線在畫面上的高度，熱氣扭曲只發生在它上方
    const f = new T.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize().multiplyScalar(2000).add(camera.position); f.y = 0; f.project(camera);
    compMat.uniforms.uHorizon.value = Math.max(0, Math.min(1, f.y * .5 + .5));
    renderer.setRenderTarget(null); renderer.render(compScene, quadCam);
  }

  /* ================= 小工具 ================= */
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function label(text, o = {}) {
    const size = o.size || 64, font = `${o.weight || 500} ${size}px "${o.font || 'Noto Serif TC'}"`;
    const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font;
    const pad = size * .5, w = Math.ceil(x.measureText(text).width + pad * 2), h = Math.ceil(size * 1.6);
    c.width = w; c.height = h;
    const draw = s => { x.clearRect(0, 0, w, h); if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, w, h); }
      x.font = font; x.fillStyle = o.color || '#eef0f4'; x.textBaseline = 'middle'; x.shadowColor = o.bg ? 'transparent' : 'rgba(0,0,0,.6)'; x.shadowBlur = o.bg ? 0 : size * .25; x.fillText(s, pad, h / 2 + size * .05); };
    draw(text);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    if (o.boost) m.color.setScalar(o.boost);
    const s = new T.Sprite(m); const k = (o.height || 3) / h; s.scale.set(w * k, h * k, 1);
    s.userData.redraw = t2 => { draw(t2); tex.needsUpdate = true; };
    return s;
  }
  const glowTex = canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, false);
  function glow(color, size, op = 1) {
    const m = new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: true });
    const s = new T.Sprite(m); s.scale.set(size, size, 1); return s;
  }

  /* ================= 天空、月亮、海 ================= */
  const skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { uFog: { value: FOG }, uClear: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uFog; uniform float uClear; varying vec3 vD;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){ float h = vD.y;
        vec3 top = vec3(.002,.004,.009), hor = vec3(.026,.03,.045);
        vec3 col = mix(hor, top, smoothstep(0., .5, h));
        col += vec3(.16,.13,.21) * exp(-abs(h) * 26.) * .32;
        vec3 g = floor(vD * 420.); float s = hash(g); col += step(.9965, s) * smoothstep(.04, .3, h) * vec3(.9,.9,1.) * (s - .9965) * 300. * uClear;
        col = mix(uFog, col, mix(.15, 1., uClear) * smoothstep(-.03, .05, h));
        gl_FragColor = vec4(col, 1.); }` });
  scene.add(new T.Mesh(new T.SphereGeometry(2400, 48, 24), skyMat));
  const MOON_DIR = new T.Vector3(-.45, .32, -1).normalize();
  const moon = glow(lin(4, 4, 4.4), 120); moon.material.fog = false; moon.position.copy(MOON_DIR).multiplyScalar(1900); scene.add(moon);
  const halo = glow(lin(.35, .35, .45), 600, .22); halo.material.fog = false; halo.position.copy(moon.position); scene.add(halo);

  const seaGeo = new T.PlaneGeometry(4000, 4000, 300, 300); seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new T.ShaderMaterial({ fog: false,
    uniforms: { uTime: { value: 0 }, uFog: { value: FOG }, uDen: { value: .02 }, uMoon: { value: MOON_DIR }, uWarm: { value: 1 } },
    vertexShader: `uniform float uTime; varying vec3 vW;
      float wave(vec2 p){ return sin(dot(p, vec2(.05,.012)) + uTime*.55)*.5 + sin(dot(p, vec2(-.02,.07)) - uTime*.48)*.38
        + sin(dot(p, vec2(.11,.09)) + uTime*.9)*.16 + sin(dot(p, vec2(-.17,.23)) + uTime*1.3)*.07; }
      void main(){ vec3 p = position; p.y += wave(p.xz) * smoothstep(1400., 200., length(p.xz)) - .5;
        vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uDen, uWarm; uniform vec3 uFog, uMoon; varying vec3 vW;
      float wave(vec2 p){ return sin(dot(p, vec2(.05,.012)) + uTime*.55)*.5 + sin(dot(p, vec2(-.02,.07)) - uTime*.48)*.38
        + sin(dot(p, vec2(.11,.09)) + uTime*.9)*.16 + sin(dot(p, vec2(-.17,.23)) + uTime*1.3)*.07
        + sin(dot(p, vec2(.5,.31)) + uTime*2.1)*.03 + sin(dot(p, vec2(-.37,.61)) + uTime*2.7)*.02; }
      void main(){ float e = .35; float h = wave(vW.xz);
        vec3 N = normalize(vec3(-(wave(vW.xz + vec2(e,0.)) - h) / e, 1., -(wave(vW.xz + vec2(0.,e)) - h) / e));
        vec3 V = normalize(cameraPosition - vW); float fr = pow(1. - max(dot(N, V), 0.), 4.);
        vec3 R = reflect(-V, N);
        vec3 skyc = mix(vec3(.03,.034,.05) + vec3(.16,.13,.21)*.3, vec3(.003,.005,.01), smoothstep(0., .4, R.y));
        vec3 col = vec3(.006,.014,.02) + skyc * (.15 + fr * .9);
        col += vec3(1.,1.,1.1) * pow(max(dot(R, uMoon), 0.), 900.) * 1.3;
        float dm = length(vW.xz - vec2(0., 10.));
        col += vec3(1., .62, .3) * exp(-dm / 26.) * (.25 + fr) * .35 * uWarm;
        float d = length(cameraPosition - vW); float f = 1. - exp(-uDen * uDen * d * d);
        gl_FragColor = vec4(mix(col, uFog, f), 1.); }` });
  scene.add(new T.Mesh(seaGeo, seaMat));

  scene.add(new T.HemisphereLight(0x6f80a6, 0x0b1318, .62));
  const moonLight = new T.DirectionalLight(0xb9c6ea, .5); moonLight.position.copy(MOON_DIR).multiplyScalar(100); scene.add(moonLight);

  /* ================= 材質貼圖 ================= */
  const corrugated = (col1, col2) => canvasTex(128, 128, (x, w, h) => { for (let i = 0; i < w; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, col1); g.addColorStop(.5, col2); g.addColorStop(1, col1); x.fillStyle = g; x.fillRect(i, 0, 8, h); }
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(80,50,30,${Math.random() * .18})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 2 + Math.random() * 30); } });
  const roofTex = corrugated('#5d686c', '#8a9599'); roofTex.wrapS = roofTex.wrapT = T.RepeatWrapping; roofTex.repeat.set(10, 3);
  const shutterTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#8b9295'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { x.fillStyle = '#6b7275'; x.fillRect(0, y, w, 2); x.fillStyle = '#a4abad'; x.fillRect(0, y + 2, w, 1); }
    for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(90,60,40,${Math.random() * .25})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 4 + Math.random() * 30); } });

  /* ================= 合併幾何：同一材質合成一個網格，房子再多也不卡 ================= */
  const UNIT = {
    box: new T.BoxGeometry(1, 1, 1), plane: new T.PlaneGeometry(1, 1),
    cyl: new T.CylinderGeometry(.5, .5, 1, 14), cyl6: new T.CylinderGeometry(.5, .5, 1, 7),
    ico: new T.IcosahedronGeometry(.5, 1),
    // 三角柱（人字屋頂）：底在 y=0，高 1，跨度 1，沿 x 延伸
    tri: (() => { const g = new T.CylinderGeometry(.5, .5, 1, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2); g.translate(0, .25, 0); g.scale(1, 1 / .75, 1 / .866); return g; })()
  };
  function Merger() {
    const buckets = new Map(), m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
    function put(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, uv) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      m4.compose(v.set(x, y, z), q.setFromEuler(eu.set(rx, ry, rz, 'YXZ')), sc.set(sx, sy, sz)); g.applyMatrix4(m4);
      if (uv) { const a = g.attributes.uv.array; for (let i = 0; i < a.length; i += 2) { a[i] = a[i] * uv[0] + (uv[2] || 0); a[i + 1] = a[i + 1] * uv[1] + (uv[3] || 0); } }
      if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g);
    }
    const box = (mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0, uv) => put(mat, UNIT.box, x, y, z, rx, ry, rz, w, h, d, uv);
    const block = (mat, w, h, d, x, y, z, ry = 0, uv) => box(mat, w, h, d, x, y + h / 2, z, ry, 0, 0, uv);   // 底部在 y
    const prism = (mat, len, span, rise, x, y, z, ry = 0) => put(mat, UNIT.tri, x, y, z, 0, ry, 0, len, rise, span);
    const cyl = (mat, r, h, x, y, z, seg6) => put(mat, seg6 ? UNIT.cyl6 : UNIT.cyl, x, y + h / 2, z, 0, 0, 0, r * 2, h, r * 2);
    function build(parent) {
      const out = [];
      buckets.forEach((list, mat) => {
        let n = 0; list.forEach(g => { n += g.attributes.position.count; });
        const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
        list.forEach(g => { P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); });
        const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(P, 3)); bg.setAttribute('normal', new T.BufferAttribute(Nn, 3)); bg.setAttribute('uv', new T.BufferAttribute(U, 2));
        bg.computeBoundingSphere(); const m = new T.Mesh(bg, mat); parent.add(m); out.push(m);
      });
      buckets.clear(); return out;
    }
    return { put, box, block, prism, cyl, build };
  }
  // 以 (x, z) 為中心、轉 ry 之後的局部座標
  const _q = new T.Quaternion(), _e = new T.Euler(), _Y = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  function rod(mg, mat, a, b, r = .08) {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(); _d.normalize();
    _q.setFromUnitVectors(_Y, _d); _e.setFromQuaternion(_q, 'YXZ');
    mg.put(mat, UNIT.cyl6, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, _e.x, _e.y, _e.z, r * 2, L, r * 2);
  }
  // 高壓電塔：四支腳往上收、X 形斜撐、三層橫擔；回傳橫擔端點給電線用
  function pylon(mg, mat, x, z, h = 18, ry = 0) {
    const P = rot(x, z, ry), b0 = 2.2, b1 = .55, lv = [0, .3, .55, .75, 1], tips = [];
    const at = (u, sx, sz) => { const w = b0 + (b1 - b0) * u, [px, pz] = P(sx * w, sz * w); return [px, 1.4 + u * h, pz]; };
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => rod(mg, mat, at(0, sx, sz), at(1, sx, sz), .1));
    for (let i = 0; i < lv.length - 1; i++) {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let k = 0; k < 4; k++) { const [ax, az] = c[k], [bx, bz] = c[(k + 1) % 4];
        rod(mg, mat, at(lv[i], ax, az), at(lv[i + 1], bx, bz), .045); rod(mg, mat, at(lv[i], bx, bz), at(lv[i + 1], ax, az), .045); rod(mg, mat, at(lv[i + 1], ax, az), at(lv[i + 1], bx, bz), .05); }
    }
    [[.62, 4.2], [.8, 3.4], [.95, 2.6]].forEach(([u, span]) => { const y = 1.4 + u * h; const [l0, l1] = P(-span, 0), [r0, r1] = P(span, 0);
      rod(mg, mat, [l0, y, l1], [r0, y, r1], .09); tips.push([l0, y - .6, l1], [r0, y - .6, r1]); });
    return tips;
  }
  function car(mg, mats, x, z, ry, y = 1.4) {
    const P = rot(x, z, ry), m = mats[Math.floor(rnd() * mats.length)];
    let [a, b] = P(0, 0); mg.box(m, 1.8, .7, 4.2, a, y + .55, b, ry); mg.box(m, 1.6, .55, 2.2, a, y + 1.15, b, ry);
    [a, b] = P(0, 2.12); mg.box(mats.glass || m, 1.5, .2, .05, a, y + .65, b, ry);
  }
  const rot = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  // 平面形狀 → 島的地面（底 -1.2，頂 1.4）
  function landGeo(pts, top = 1.4, depth = 2.6, holes) {
    const sh = new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)));
    if (holes) holes.forEach(hp => sh.holes.push(new T.Path(hp.map(([x, z]) => new T.Vector2(x, -z)))));
    const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, top - depth, 0); return g;
  }
  function flatGeo(pts, y, holes) {
    const sh = new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)));
    if (holes) holes.forEach(hp => sh.holes.push(new T.Path(hp.map(([x, z]) => new T.Vector2(x, -z)))));
    const g = new T.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
  }
  // 沿曲線的帶子（河、路、鐵道），width 可以是函式
  function ribbon(pts, width, y, n = 80) {
    const c = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, y, z)));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = c.getPointAt(u), t = c.getTangentAt(u), wd = typeof width === 'function' ? width(u) : width;
      const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
      pos.push(p.x + nx / l * wd / 2, y, p.z + nz / l * wd / 2, p.x - nx / l * wd / 2, y, p.z - nz / l * wd / 2);
      uv.push(0, u * c.getLength() / 4, 1, u * c.getLength() / 4);
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.curve = c; return g;
  }
  const dirt = (x, w, h, n, col, maxA, sw = [1, 4], sh = [8, 40]) => { for (let k = 0; k < n; k++) { x.fillStyle = `rgba(${col},${Math.random() * maxA})`; x.fillRect(Math.random() * w, Math.random() * h, sw[0] + Math.random() * sw[1], sh[0] + Math.random() * sh[1]); } };
  const rep = (t, a = 1, b = 1) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(a, b); return t; };

  /* ================= 臺北的公寓立面：二丁掛磁磚、鋁窗、鐵窗、冷氣、水漬 ================= */
  function walkupTex(v, boarded = false) {
    const tiles = ['#b4a088', '#8e7562', '#9aa49c', '#c3beb2', '#a39a8c', '#7e888c'][v % 6];
    const lit = [];
    const map = canvasTex(256, 512, (x, w, h) => {
      x.fillStyle = tiles; x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(0, y, w, 1); for (let xx = (y / 6 % 2) * 10; xx < w; xx += 20) x.fillRect(xx, y, 1, 6); }
      for (let fl = 0; fl < 4; fl++) {
        const fy = fl * 128;
        x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, fy + 121, w, 7);
        for (let c = 0; c < 2; c++) {
          const wx = 18 + c * 124, wy = fy + 26, ww = 96, wh = 70, on = !boarded && Math.random() < .32;
          lit.push([wx, wy, ww, wh, on]);
          if (boarded) {
            x.fillStyle = '#5d554b'; x.fillRect(wx, wy, ww, wh);
            x.fillStyle = '#7b7064'; for (let k = 0; k < 5; k++) x.fillRect(wx, wy + k * 14 + 2, ww, 10);
            x.strokeStyle = 'rgba(196,54,44,.8)'; x.lineWidth = 5; if (Math.random() < .35) { x.beginPath(); x.moveTo(wx + 10, wy + 10); x.lineTo(wx + ww - 10, wy + wh - 10); x.moveTo(wx + ww - 10, wy + 10); x.lineTo(wx + 10, wy + wh - 10); x.stroke(); }
          } else {
            x.fillStyle = on ? ['#f2c27c', '#efd3a0', '#e9b56a', '#dfe8ee'][Math.floor(Math.random() * 4)] : '#151b1f'; x.fillRect(wx, wy, ww, wh);
            if (on && Math.random() < .6) { x.fillStyle = 'rgba(120,60,30,.35)'; x.fillRect(wx, wy, ww * (.3 + Math.random() * .4), wh); }
            x.fillStyle = '#c7ccd0'; x.fillRect(wx + ww / 2 - 1, wy, 2, wh); x.strokeStyle = '#aeb4b7'; x.lineWidth = 3; x.strokeRect(wx, wy, ww, wh);
          }
          x.strokeStyle = Math.random() < .5 ? '#e4e6e3' : '#4a3a2e'; x.lineWidth = 2.5;
          x.strokeRect(wx - 6, wy - 6, ww + 12, wh + 12);
          for (let k = 1; k < 9; k++) { x.beginPath(); x.moveTo(wx - 6 + k * (ww + 12) / 9, wy - 6); x.lineTo(wx - 6 + k * (ww + 12) / 9, wy + wh + 6); x.stroke(); }
          x.fillStyle = 'rgba(40,30,20,.2)'; x.fillRect(wx + Math.random() * ww, wy + wh + 6, 3, 20 + Math.random() * 40);
          if (Math.random() < .45) { const ax = c ? wx - 32 : wx + ww + 8; x.fillStyle = '#d6d8d4'; x.fillRect(ax, wy + 30, 26, 22); x.fillStyle = '#9ea2a0'; for (let k = 0; k < 4; k++) x.fillRect(ax + 2, wy + 33 + k * 5, 22, 1.5); }
          if (Math.random() < .3) { x.fillStyle = '#3e5a36'; x.beginPath(); x.arc(wx + 20 + Math.random() * 50, wy + wh + 2, 10, Math.PI, 0); x.fill(); }
        }
      }
      dirt(x, w, h, 50, '50,35,20', .16);
    });
    map.wrapT = T.RepeatWrapping;
    const emi = canvasTex(256, 512, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); lit.forEach(([wx, wy, ww, wh, on]) => { if (on) { x.fillStyle = '#ffb35c'; x.fillRect(wx, wy, ww, wh); x.fillStyle = '#000'; for (let k = 1; k < 9; k++) x.fillRect(wx - 7 + k * (ww + 12) / 9, wy, 3, wh); } }); });
    emi.wrapT = T.RepeatWrapping;
    return { map, emi };
  }
  // 老街的矮厝：紅磚、石砌、洗石子，一樓是木板門
  function oldShopTex(kind) {
    const lit = [];
    const map = canvasTex(256, 256, (x, w, h) => {
      if (kind === 0) { x.fillStyle = '#8a4a36'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let xx = (y / 8 % 2) * 12; xx < w; xx += 24) { x.fillStyle = `hsl(12,${35 + Math.random() * 15}%,${30 + Math.random() * 10}%)`; x.fillRect(xx + 1, y + 1, 22, 6); } }
      else if (kind === 1) { x.fillStyle = '#7d7564'; x.fillRect(0, 0, w, h); let y = 0; while (y < h) { const bh = 14 + Math.random() * 14; let xx = -Math.random() * 30; while (xx < w) { const bw = 26 + Math.random() * 30; x.fillStyle = `hsl(40,${10 + Math.random() * 12}%,${38 + Math.random() * 14}%)`; x.fillRect(xx + 1.5, y + 1.5, bw - 3, bh - 3); xx += bw; } y += bh; } }
      else { x.fillStyle = '#a49e8c'; x.fillRect(0, 0, w, h); for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(${Math.random() < .5 ? '60,55,45' : '220,215,200'},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }
      // 二樓窗
      for (let c = 0; c < 2; c++) { const wx = 34 + c * 112, wy = 34, on = Math.random() < .35; lit.push([wx, wy, 76, 62, on]);
        x.fillStyle = on ? '#efc07a' : '#1a1f22'; x.fillRect(wx, wy, 76, 62); x.strokeStyle = '#4b3a2c'; x.lineWidth = 5; x.strokeRect(wx, wy, 76, 62); x.beginPath(); x.moveTo(wx + 38, wy); x.lineTo(wx + 38, wy + 62); x.moveTo(wx, wy + 31); x.lineTo(wx + 76, wy + 31); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 122, w, 8);
      // 一樓：木板門或鐵捲門
      const shop = Math.random(); lit.push([20, 150, 216, 106, shop < .25]);
      if (shop < .25) { x.fillStyle = '#e8b878'; x.fillRect(20, 150, 216, 106); for (let k = 0; k < 9; k++) { x.fillStyle = `hsl(${Math.random() * 360},30%,45%)`; x.fillRect(30 + Math.random() * 190, 170 + Math.random() * 60, 10, 18); } }
      else if (shop < .7) { x.fillStyle = '#5a4030'; x.fillRect(20, 150, 216, 106); x.fillStyle = '#6e5038'; for (let k = 0; k < 9; k++) x.fillRect(22 + k * 24, 152, 20, 102); }
      else { x.fillStyle = '#7f878a'; x.fillRect(20, 150, 216, 106); for (let y = 152; y < 256; y += 6) { x.fillStyle = '#656d70'; x.fillRect(20, y, 216, 2); } }
      dirt(x, w, h, 40, '40,30,20', .2);
    });
    const emi = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); lit.forEach(([wx, wy, ww, wh, on]) => { if (on) { x.fillStyle = '#ffb35c'; x.fillRect(wx, wy, ww, wh); } }); });
    return { map, emi };
  }
  const brickTex = rep(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#6e3a2a'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let xx = (y / 8 % 2) * 8; xx < w; xx += 16) { x.fillStyle = `hsl(12,${38 + Math.random() * 14}%,${29 + Math.random() * 10}%)`; x.fillRect(xx + 1, y + 1, 14, 6); } dirt(x, w, h, 20, '20,10,5', .25); }));
  const tileRoofTex = rep(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#2b2d2e'; x.fillRect(0, 0, w, h); for (let xx = 0; xx < w; xx += 8) { const g = x.createLinearGradient(xx, 0, xx + 8, 0); g.addColorStop(0, '#26292a'); g.addColorStop(.5, '#4a4e50'); g.addColorStop(1, '#26292a'); x.fillStyle = g; x.fillRect(xx, 0, 8, h); } for (let y = 0; y < h; y += 10) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y, w, 2); } }));
  const redTileTex = rep(canvasTex(128, 128, (x, w, h) => { for (let xx = 0; xx < w; xx += 8) { const g = x.createLinearGradient(xx, 0, xx + 8, 0); g.addColorStop(0, '#6b2a1e'); g.addColorStop(.5, '#a24a32'); g.addColorStop(1, '#6b2a1e'); x.fillStyle = g; x.fillRect(xx, 0, 8, h); } for (let y = 0; y < h; y += 10) { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, y, w, 2); } }));
  const tinTex = (a, b) => rep(corrugated(a, b));
  const frpTex = rep(canvasTex(128, 128, (x, w, h) => { for (let i = 0; i < w; i += 10) { const g = x.createLinearGradient(i, 0, i + 10, 0); g.addColorStop(0, '#9fb08c'); g.addColorStop(.5, '#dfe7cc'); g.addColorStop(1, '#9fb08c'); x.fillStyle = g; x.fillRect(i, 0, 10, h); } dirt(x, w, h, 70, '60,70,40', .3, [2, 12], [2, 12]); }));
  const tarpTex = (c1, c2) => rep(canvasTex(64, 64, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 4) { x.fillStyle = c2; x.fillRect(k, 0, 1, h); x.fillRect(0, k, w, 1); } dirt(x, w, h, 20, '0,0,0', .2, [2, 8], [2, 8]); }));
  const concreteTex = rep(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#7d8284'; x.fillRect(0, 0, w, h); for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${Math.random() < .5 ? '40,45,48' : '170,175,178'},.25)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); dirt(x, w, h, 24, '40,35,25', .25, [1, 3], [10, 50]); }));
  const fenceTex = rep(canvasTex(128, 64, (x, w, h) => { for (let i = 0; i < w; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, '#2d5a3c'); g.addColorStop(.5, '#4f8a60'); g.addColorStop(1, '#2d5a3c'); x.fillStyle = g; x.fillRect(i, 0, 8, h); } x.fillStyle = '#e8ece6'; x.fillRect(0, 8, w, 6); dirt(x, w, h, 20, '30,25,15', .3, [1, 3], [10, 30]); }));
  // 招牌圖集：直式招牌
  const SIGNS = ['中藥行', '理髮廳', '五金行', '西藥房', '國術館', '鐘錶眼鏡', '修改衣服', '金紙香燭', '當舖', '麵店', '診所', '電器行'];
  const makeSignAtlas = () => canvasTex(1536, 512, (x, w, h) => {
    const cw = w / 12;
    SIGNS.forEach((s, i) => {
      const sc = [['#f3efe2', '#b8342a'], ['#b8342a', '#f6efe2'], ['#1f4a7a', '#f2f0e6'], ['#e8c547', '#1d1d1d'], ['#1e5a4a', '#f2efe2'], ['#efe9dc', '#1f4a7a']][i % 6];
      x.fillStyle = sc[0]; x.fillRect(i * cw + 4, 4, cw - 8, h - 8); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 4; x.strokeRect(i * cw + 12, 12, cw - 24, h - 24);
      x.fillStyle = sc[1]; x.textAlign = 'center'; x.textBaseline = 'middle'; const n = s.length, fs = Math.min(90, (h - 70) / n); x.font = `900 ${fs}px "Noto Serif TC"`;
      for (let k = 0; k < n; k++) x.fillText(s[k], i * cw + cw / 2, 35 + (h - 70 - fs * n) / 2 + fs * (k + .5));
      for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(70,45,25,${Math.random() * .3})`; x.fillRect(i * cw + Math.random() * cw, Math.random() * h, 1 + Math.random() * 3, 6 + Math.random() * 40); }
    });
  });
  const signUV = i => [1 / 12, 1, i / 12, 0];

  /* ================= 冰 ================= */
  const ices = [];
  const texCache = {};
  // 把照片裁成框的比例再畫（不拉長）
  function drawCover(x, img, dx, dy, dw, dh) {
    const iw = img.width, ih = img.height, a = iw / ih, b = dw / dh; let sx = 0, sy = 0, sw = iw, sh = ih;
    if (a > b) { sw = ih * b; sx = (iw - sw) / 2; } else { sh = iw / b; sy = (ih - sh) / 2; }
    x.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  function siteTextures(site) {
    if (texCache[site.id]) return texCache[site.id];
    const n = site.photos.length || 3, list = [];   // 有真照片就只輪真照片
    for (let i = 0; i < n; i++) {
      const t = new T.CanvasTexture(window.HaishiPlaceholder(site, i, 384, 512)); t.encoding = T.sRGBEncoding; list.push(t);
      if (site.photos[i]) new T.TextureLoader().load(site.photos[i], tx => { tx.encoding = T.sRGBEncoding;
        const a = tx.image.width / tx.image.height, t = .76;      // 橫的照片裁成冰面的直式，不拉長
        if (a > t) { tx.repeat.set(t / a, 1); tx.offset.set((1 - t / a) / 2, 0); } else { tx.repeat.set(1, a / t); tx.offset.set(0, (1 - a / t) / 2); }
        list[i] = tx; }, undefined, () => {});
    }
    return (texCache[site.id] = list);
  }
  const iceShell = () => new T.MeshPhysicalMaterial({ color: 0xd8f1f6, roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .18, depthWrite: false });
  const iceCore = () => new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: 1, depthWrite: false, emissive: 0x9fc6d4, emissiveIntensity: .15 });
  // 冰上的照片跟著冰化：開展前清楚，展期中慢慢糊掉、褪色，收攤後只剩一片水色
  const iceBlur = { value: 0 };
  function blurPhoto(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uMelt = iceBlur;
      sh.fragmentShader = 'uniform float uMelt;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          float br = uMelt * uMelt * .018 + uMelt * .004; vec4 acc = vec4(0.); float tw = 0.;
          for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
            vec2 o = vec2(float(i), float(j)) * br + vec2(sin(vUv.y * 40. + float(j)), cos(vUv.x * 40. + float(i))) * br * .35;
            float w = exp(-float(i * i + j * j) * .25); acc += texture2D(map, vUv + o) * w; tw += w; }
          vec4 sampledDiffuseColor = acc / tw;
          float g = dot(sampledDiffuseColor.rgb, vec3(.299, .587, .114));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, mix(vec3(g), vec3(.55, .7, .78) * (.4 + g * .6), uMelt * .8), smoothstep(.15, 1., uMelt));
          diffuseColor *= sampledDiffuseColor;
        #endif`);
    };
    return mat;
  }
  function makeIce(site, w, h, d, withTag = true) {
    const g = new T.Group(), texs = siteTextures(site);
    const melt = new T.Group(); g.add(melt);
    const photo = new T.Mesh(new T.PlaneGeometry(w * .92, h * .92), blurPhoto(new T.MeshBasicMaterial({ map: texs[0], color: lin(1, 1, 1), transparent: true, opacity: .98, toneMapped: false })));
    photo.position.set(0, h / 2, d * .2); melt.add(photo);
    const core = new T.Mesh(new T.BoxGeometry(w * .9, h * .9, d * .9), iceCore()); core.position.y = h / 2; melt.add(core);
    const shell = new T.Mesh(new T.BoxGeometry(w, h, d), iceShell()); shell.position.y = h / 2; melt.add(shell);
    const edges = new T.LineSegments(new T.EdgesGeometry(shell.geometry), new T.LineBasicMaterial({ color: lin(.8, .95, 1), transparent: true, opacity: .35 })); edges.position.y = h / 2; melt.add(edges);
    const puddle = new T.Mesh(new T.CircleGeometry(w * .8, 32), new T.MeshStandardMaterial({ color: 0x0c1418, roughness: .03, metalness: .9, transparent: true, opacity: .8 }));
    puddle.rotation.x = -Math.PI / 2; puddle.position.y = .01; g.add(puddle);
    let tag = null;
    if (withTag) { tag = label(`${site.name} 25.0 斤`, { font: 'LXGW WenKai TC', bg: '#b8342a', color: '#fff', size: 48, height: .62 }); tag.position.set(0, h + .7, d * .5); g.add(tag); }
    shell.userData.site = site.id;
    const ice = { site, g, melt, photo, shell, edges, tag, puddle, h, texs, idx: -1, last: '' };
    ices.push(ice); return ice;
  }
  let preview = null;
  function updateIces(t) {
    const st = window.HaishiIce(preview); iceBlur.value = st.p;
    ices.forEach((ice, i) => {
      const k = 1 - st.p * .85, s = 1 - st.p * .3;
      ice.melt.scale.set(s, k, s);
      if (ice.tag) ice.tag.position.y = ice.h * k + .7;
      ice.puddle.scale.setScalar(.7 + st.p * 1.6);
      const txt = `${ice.site.name} ${st.weight.toFixed(1)} 斤`;
      if (ice.tag && txt !== ice.last) { ice.tag.userData.redraw(txt); ice.last = txt; }
      const j = Math.floor(t / 7 + i * .6) % ice.texs.length;
      if (j !== ice.idx) { ice.idx = j; ice.photo.material.map = ice.texs[j]; ice.photo.material.needsUpdate = true; }
      if (ice.stall) { ice.selK += ((ice.want || 0) - ice.selK) * .08; ice.edges.material.opacity = .35 + ice.selK * .6; if (ice.tag) ice.tag.position.y += ice.selK * (.35 + Math.abs(Math.sin(t * 3)) * .15); }
      ice.photo.material.color.setScalar(1.02 + Math.sin(t * 1.7 + i * 2) * .04 + (ice.selK || 0) * .18);
    });
    return st;
  }

  /* ================= 龍口市場：汀州路一段149巷進去的低矮窄巷 =================
     參照 Koza 拍的照片。巷口掛著黃底紅字的招牌，裡面是彎來彎去、會分岔的暗巷，巷子盡頭那道光，就是蜃氣吐出來的地方。 */
  const LK = new T.Group(); scene.add(LK);
  const G0 = 1.3;                                   // 地面高度
  const M = {
    base: new T.MeshStandardMaterial({ color: 0x2a3033, roughness: .95 }),
    asphalt: new T.MeshStandardMaterial({ color: 0x15191b, roughness: .22, metalness: .35 }),
    walk: new T.MeshStandardMaterial({ map: rep(concreteTex.clone(), 1, 1), color: 0x8a8f90, roughness: .7 }),
    gutter: new T.MeshStandardMaterial({ color: 0x0b0d0e, roughness: .4, metalness: .6 }),
    wall: new T.MeshStandardMaterial({ color: 0x6f6a62, roughness: .92 }),
    wallB: new T.MeshStandardMaterial({ color: 0x575d5e, roughness: .92 }),
    column: new T.MeshStandardMaterial({ color: 0x8c857a, roughness: .85 }),
    ceiling: new T.MeshStandardMaterial({ color: 0x1d2022, roughness: 1 }),
    tin: new T.MeshStandardMaterial({ map: tinTex('#5f686b', '#8f989b'), roughness: .5, metalness: .45, side: T.DoubleSide }),
    tinRust: new T.MeshStandardMaterial({ map: tinTex('#6a4430', '#94654a'), roughness: .65, metalness: .3, side: T.DoubleSide }),
    tinBlue: new T.MeshStandardMaterial({ map: tinTex('#355a75', '#5d86a2'), roughness: .5, metalness: .35, side: T.DoubleSide }),
    frp: new T.MeshStandardMaterial({ map: frpTex, emissiveMap: frpTex, transparent: true, opacity: .6, roughness: .6, emissive: 0x5a5236, emissiveIntensity: .75, side: T.DoubleSide, depthWrite: false }),
    tarp: new T.MeshStandardMaterial({ map: tarpTex('#24508a', '#1c4274'), roughness: .8, side: T.DoubleSide }),
    tarpG: new T.MeshStandardMaterial({ map: tarpTex('#3d6a4a', '#2f563a'), roughness: .8 }),
    tarpGrey: new T.MeshStandardMaterial({ map: tarpTex('#6d7173', '#5a5e60'), roughness: .85 }),
    pipe: new T.MeshStandardMaterial({ color: 0x3b4245, roughness: .5, metalness: .7 }),
    ply: new T.MeshStandardMaterial({ color: 0x6d5a45, roughness: .85 }),
    steel: new T.MeshStandardMaterial({ color: 0xb9c3c6, roughness: .58, metalness: .5 }),
    steelDark: new T.MeshStandardMaterial({ color: 0x5c676b, roughness: .4, metalness: .7 }),
    styro: new T.MeshStandardMaterial({ color: 0xe6e8e4, roughness: .9 }),
    shutter: new T.MeshStandardMaterial({ map: rep(shutterTex.clone(), 1, 1), roughness: .6, metalness: .4 }),
    shopLit: null, store: null,
    tank: new T.MeshStandardMaterial({ color: 0xc7ccd0, roughness: .3, metalness: .85 }),
    tankBlue: new T.MeshStandardMaterial({ color: 0x3a6fa8, roughness: .5, metalness: .1 }),
    glass: null, rebar: new T.MeshStandardMaterial({ color: 0x8b8f8e, roughness: .9 }),
    tube: new T.MeshBasicMaterial({ color: lin(3.4, 3.8, 4), toneMapped: false }),
    bulb: new T.MeshBasicMaterial({ color: lin(6, 3.6, 1.6), toneMapped: false }),
    red: new T.MeshBasicMaterial({ color: lin(3, .2, .15), toneMapped: false }),
    wire: new T.LineBasicMaterial({ color: 0x15191b })
  };
  const shopLitTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#2a2420'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6dcae'); g.addColorStop(1, '#a8784a'); x.fillStyle = g; x.fillRect(10, 8, w - 20, h - 8);
    for (let s = 0; s < 4; s++) { x.fillStyle = 'rgba(60,40,25,.6)'; x.fillRect(10, 30 + s * 24, w - 20, 3); for (let k = 0; k < 14; k++) { x.fillStyle = `hsl(${Math.random() * 360},35%,${40 + Math.random() * 30}%)`; x.fillRect(16 + Math.random() * (w - 40), 13 + s * 24, 6 + Math.random() * 10, 15); } } });
  M.shopLit = new T.MeshStandardMaterial({ map: shopLitTex, emissiveMap: shopLitTex, emissive: lin(1.3, 1, .7), emissiveIntensity: 1, roughness: .8 });
  const storeTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#e9f2f4'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9d6da'; for (let s = 0; s < 4; s++) x.fillRect(0, 28 + s * 26, w, 3); for (let k = 0; k < 60; k++) { x.fillStyle = `hsl(${Math.random() * 360},45%,55%)`; x.fillRect(Math.random() * w, 12 + Math.floor(Math.random() * 4) * 26, 6, 14); } x.fillStyle = '#2f3437'; for (let k = 0; k < 5; k++) x.fillRect(k * 64, 0, 3, h); });
  M.store = new T.MeshStandardMaterial({ map: storeTex, emissiveMap: storeTex, emissive: lin(1.6, 1.75, 1.8), emissiveIntensity: 1, roughness: .5 });
  const glassTex = canvasTex(128, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b3f55'); g.addColorStop(1, '#0f1a26'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let xx = 0; xx < w; xx += 16) { if (Math.random() < .08) { x.fillStyle = 'rgba(255,225,180,.85)'; x.fillRect(xx + 1, y + 1, 14, 14); } }
    x.fillStyle = 'rgba(160,190,210,.35)'; for (let y = 0; y < h; y += 16) x.fillRect(0, y, w, 1); for (let xx = 0; xx < w; xx += 16) x.fillRect(xx, 0, 1, h); });
  M.glass = new T.MeshStandardMaterial({ map: glassTex, emissiveMap: glassTex, emissive: lin(.9, .8, .7), emissiveIntensity: .7, roughness: .15, metalness: .8 });
  const FAC = [0, 1, 2, 3, 4, 5].map(v => { const f = walkupTex(v); return new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: lin(1.1, .8, .5), emissiveIntensity: .8, roughness: .85 }); });
  const grillTex = canvasTex(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#d9dcd8'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); for (let k = 1; k < 10; k++) { x.beginPath(); x.moveTo(k * w / 10, 0); x.lineTo(k * w / 10, h); x.stroke(); } x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(w / 2, h / 2, 10 + k * 8, 0, Math.PI * 2); x.stroke(); } });
  M.grill = new T.MeshStandardMaterial({ map: grillTex, alphaTest: .5, side: T.DoubleSide, roughness: .5, metalness: .5 });
  const add = (geo, mat, x, y, z, parent = LK) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
  const B = (w, h, d) => new T.BoxGeometry(w, h, d);

  // 一棟四層樓公寓：s=1 在街的右側（面向 -x），s=-1 在左側
  function walkup(mg, s, z0, wz, floors, o = {}) {
    const FL = 3.1, GF = 3.5, xf = (o.xf || 8.5) * s, depth = o.depth || 11.5, xb = xf + s * depth, xc = (xf + xb) / 2;
    const top = G0 + GF + floors * FL;
    mg.box(M.wall, depth, floors * FL, wz - .08, xc, G0 + GF + floors * FL / 2, z0);
    mg.box(M.wall, depth - 2.6, GF, wz - .08, xc + s * 1.3, G0 + GF / 2, z0);
    mg.box(M.ceiling, 2.6, .05, wz - .08, xf + s * 1.3, G0 + GF - .03, z0);
    mg.block(M.column, .55, GF, .55, xf + s * .3, G0, z0 + wz / 2 - .3);
    mg.put(FAC[o.v ?? Math.floor(rnd() * 6)], UNIT.plane, xf - s * .01, G0 + GF + floors * FL / 2, z0, 0, -s * Math.PI / 2, 0, wz - .1, floors * FL, 1, [1, floors / 4]);
    if (o.front) mg.put(FAC[(o.v ?? 0) + 1 & 3], UNIT.plane, xc, G0 + GF + floors * FL / 2, z0 + wz / 2 + .01, 0, 0, 0, depth, floors * FL, 1, [1, floors / 4]);
    // 一樓店面
    const shop = o.store ? M.store : rnd() < .55 ? M.shutter : rnd() < .6 ? M.shopLit : M.ceiling;
    mg.put(shop, UNIT.plane, xf + s * 2.59, G0 + GF / 2 - .1, z0, 0, -s * Math.PI / 2, 0, wz - .5, GF - .2, 1, shop === M.shutter ? [1, 2] : undefined);
    // 鐵窗：凸出的籠子
    for (let f = 0; f < floors; f++) for (let c = -1; c <= 1; c += 2) {
      if (rnd() < .45) continue;
      const cz = z0 + c * wz * .24, cy = G0 + GF + f * FL + FL * .52, cw = wz * .44, ch = FL * .64;
      mg.put(M.grill, UNIT.plane, xf - s * .5, cy, cz, 0, -s * Math.PI / 2, 0, cw, ch, 1);
      mg.box(rnd() < .5 ? M.tin : M.tinRust, .55, .05, cw + .1, xf - s * .27, cy + ch / 2 + .05, cz, 0, 0, s * .15);
      mg.box(M.pipe, .5, .05, cw, xf - s * .25, cy - ch / 2, cz);
    }
    // 頂樓：女兒牆、加蓋、水塔
    mg.box(M.wall, .2, .9, wz - .1, xf + s * .1, top + .45, z0);
    if (rnd() < .65) { const ad = depth * (.45 + rnd() * .3); mg.block(rnd() < .5 ? M.tinBlue : M.tinRust, ad, 2.4, wz - .4, xb - s * ad / 2, top, z0, 0, [2, 1]);
      mg.box(M.tin, ad + .4, .06, wz, xb - s * ad / 2, top + 2.5, z0, 0, 0, s * .08, [2, 2]); }
    if (rnd() < .8) { const tx = xb - s * (1.5 + rnd() * 3); mg.block(M.pipe, 1.2, 1.2, 1.2, tx, top, z0 + (rnd() - .5) * 1.2); mg.cyl(rnd() < .7 ? M.tank : M.tankBlue, .65, 1.5, tx, top + 1.2, z0 + (rnd() - .5) * 1.2); }
    return top;
  }
  // 龍口市場的實景（Koza 拍的照片）：
  // 汀州路一段149巷口，一層樓高的鐵皮雨遮上掛著「龍口市場」，旁邊是水果攤、綠色帆布雨遮和三四層的紅磚老樓。
  // 走進去是又暗又窄的巷子，低低的鐵皮夾著透光浪板，兩旁大多是拉下的藍灰色鐵捲門，掛著白底的手寫招牌，巷子彎來彎去，中間分岔。
  const STALL_SIGNS = ['南北貨', '豬肉', '蔬菜', '雜糧', '魚丸', '豆腐', '百貨', '乾貨'];
  const makeStallSigns = () => canvasTex(1024, 128, (x, w, h) => {
    const cw = w / 8;
    STALL_SIGNS.forEach((s, i) => {
      const sc = [['#f0d44a', '#b8342a'], ['#b8342a', '#f8f0dc'], ['#f2efe4', '#1d5a3c'], ['#1f4a7a', '#f2efe4']][i % 4];
      x.fillStyle = sc[0]; x.fillRect(i * cw + 3, 3, cw - 6, h - 6);
      x.fillStyle = sc[1]; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${s.length > 2 ? 34 : 50}px "Noto Serif TC"`; x.fillText(s, i * cw + cw / 2, h / 2 + 2);
      dirt(x, w, h, 6, '70,45,25', .3, [1, 3], [6, 40]);
    });
  });
  const latticeTex = canvasTex(256, 256, (x, w, h) => {      // 老店的木格子玻璃櫃
    x.fillStyle = '#2a1a12'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const gx = 10 + c * 60, gy = 10 + r * 60;
      x.fillStyle = '#c9b48a'; x.fillRect(gx, gy, 52, 52);
      for (let k = 0; k < 6; k++) { x.fillStyle = ['#e9e1c9', '#b8342a', '#3d6a4a', '#d8a530', '#f4f0e4'][Math.floor(Math.random() * 5)]; x.fillRect(gx + 4 + k * 8, gy + 18 + Math.random() * 10, 6, 30 - Math.random() * 8); }
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(gx, gy, 52, 6);
    }
    x.fillStyle = '#b8342a'; x.fillRect(2, 0, 6, h); x.fillRect(w - 8, 0, 6, h);
  });
  const crateTex = c => rep(canvasTex(64, 64, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 6; i < w; i += 10) for (let j = 8; j < h - 6; j += 12) x.fillRect(i, j, 6, 7); }));
  const plywoodTex = rep(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#9a7b55'; x.fillRect(0, 0, w, h); for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(90,60,30,${Math.random() * .4})`; x.beginPath(); x.moveTo(0, Math.random() * h); x.bezierCurveTo(w / 3, Math.random() * h, w * .6, Math.random() * h, w, Math.random() * h); x.stroke(); } }));
  const floorTex = rep(canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#4b5052'; x.fillRect(0, 0, w, h); for (let k = 0; k < 1600; k++) { x.fillStyle = `rgba(${Math.random() < .5 ? '20,24,26' : '140,146,148'},.22)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let k = 0; k < 18; k++) { x.fillStyle = `rgba(10,12,14,${.15 + Math.random() * .25})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 6 + Math.random() * 20, Math.random() * 3, 0, 7); x.fill(); } }));

  function scooter(mg, x, z, ry, col) {
    const P = rot(x, z, ry);
    const body = col || M.scoot[Math.floor(rnd() * M.scoot.length)];
    let [a, b] = P(0, 0); mg.box(body, .62, .5, 1.5, a, G0 + .55, b, ry);
    [a, b] = P(0, -.1); mg.box(M.seat, .5, .14, .8, a, G0 + .86, b, ry);
    [a, b] = P(0, .68); mg.box(body, .6, 1, .16, a, G0 + .85, b, ry, -.18);
    [a, b] = P(0, .76); mg.box(M.pipe, .72, .06, .06, a, G0 + 1.36, b, ry);
    [a, b] = P(0, .82); mg.box(M.tube, .14, .1, .03, a, G0 + 1.1, b, ry);
    [[0, .72], [0, -.62]].forEach(([lx, lz]) => { const [wx, wz] = P(lx, lz); mg.put(M.tyre, UNIT.cyl, wx, G0 + .3, wz, 0, ry, Math.PI / 2, .56, .14, .56); });
    if (rnd() < .4) { [a, b] = P(0, -.82); mg.box(M.styro, .5, .32, .4, a, G0 + 1.05, b, ry); }
  }
  function pole(mg, x, z, h = 10) {
    mg.cyl(M.poleM, .17, h, x, G0, z);
    mg.box(M.pipe, 2.6, .12, .12, x, G0 + h - .6, z); mg.box(M.pipe, 1.8, .1, .1, x, G0 + h - 1.6, z);
    mg.cyl(M.trans, .32, 1.1, x + .45, G0 + h - 3.2, z); mg.box(M.pipe, .7, .08, .08, x + .25, G0 + h - 2.4, z);
    mg.box(M.poleBand, .36, .5, .36, x, G0 + 2.1, z); mg.box(M.styro, .36, .5, .36, x, G0 + 2.6, z);
  }

  function buildMarket() {
    const mg = Merger(), signAtlas = makeSignAtlas(), stallSigns = makeStallSigns();
    const SG = new T.MeshStandardMaterial({ map: signAtlas, roughness: .7, side: T.DoubleSide });
    const SGlit = new T.MeshStandardMaterial({ map: signAtlas, emissiveMap: signAtlas, emissive: lin(1.2, 1.2, 1.2), emissiveIntensity: 1, roughness: .7, side: T.DoubleSide });
    const SS = new T.MeshStandardMaterial({ map: stallSigns, emissiveMap: stallSigns, emissive: lin(.55, .5, .45), emissiveIntensity: 1, roughness: .7, side: T.DoubleSide });
    Object.assign(M, {
      truss: new T.MeshStandardMaterial({ color: 0x3e4a4a, roughness: .55, metalness: .6 }),
      trussRust: new T.MeshStandardMaterial({ color: 0x5a3d2c, roughness: .7, metalness: .4 }),
      floor: new T.MeshStandardMaterial({ map: floorTex, roughness: .32, metalness: .2 }),
      lattice: new T.MeshStandardMaterial({ map: latticeTex, emissiveMap: latticeTex, emissive: lin(.6, .45, .3), emissiveIntensity: .8, roughness: .6 }),
      wood: new T.MeshStandardMaterial({ map: plywoodTex, roughness: .85 }),
      woodDark: new T.MeshStandardMaterial({ color: 0x3a2618, roughness: .7 }),
      couplet: new T.MeshStandardMaterial({ color: 0xa8281e, roughness: .8, emissive: 0x2a0806 }),
      seat: new T.MeshStandardMaterial({ color: 0x141618, roughness: .6 }),
      tyre: new T.MeshStandardMaterial({ color: 0x101112, roughness: .9 }),
      scoot: [0xd9dcd8, 0x2d3a48, 0x8a1e1e, 0x5c6d72, 0xe6e1d2, 0x1d2a22, 0x9aa3a6].map(c => new T.MeshStandardMaterial({ color: c, roughness: .35, metalness: .4 })),
      poleM: new T.MeshStandardMaterial({ color: 0x8c8e88, roughness: .8 }),
      poleBand: new T.MeshStandardMaterial({ color: 0x1d1d1d, roughness: .8 }),
      trans: new T.MeshStandardMaterial({ color: 0x6f7a74, roughness: .5, metalness: .5 }),
      crates: ['#b8342a', '#2f6fa8', '#d8a530', '#3c8d5a'].map(c => new T.MeshStandardMaterial({ map: crateTex(c), roughness: .6 })),
      stool: new T.MeshStandardMaterial({ color: 0xc0392b, roughness: .5 }),
      meat: new T.MeshStandardMaterial({ color: 0xc87a6e, roughness: .6, emissive: 0x2a0a06 }),
      redLamp: new T.MeshBasicMaterial({ color: lin(3.2, .7, .4), toneMapped: false }),
      shade: new T.MeshStandardMaterial({ color: 0x2f3a36, roughness: .5, metalness: .5, side: T.DoubleSide }),
      bagCols: [0xe9e1c9, 0xd8a530, 0xb8342a, 0x8b5a2b, 0xf4f0e4, 0x6b8f3a, 0x3d2a1e].map(c => new T.MeshStandardMaterial({ color: c, roughness: .5, transparent: c === 0xf4f0e4, opacity: .85 })),
      paint: new T.MeshBasicMaterial({ color: lin(.75, .75, .72) }),
      paintY: new T.MeshBasicMaterial({ color: lin(.8, .55, .12) }),
      paintR: new T.MeshBasicMaterial({ color: lin(.6, .08, .06) }),
      brick: new T.MeshStandardMaterial({ map: rep(brickTex.clone(), 3, 1), roughness: .9 }),
      orange: new T.MeshStandardMaterial({ color: 0xe5622a, roughness: .5, emissive: 0x5a1e08, emissiveIntensity: .8 }),
      green: new T.MeshBasicMaterial({ color: lin(.1, .9, .35), toneMapped: false })
    });

    // ===== 基地、汀州路、巷口前的空地 =====
    mg.block(M.base, 68, 2.5, 96, 0, G0 - 2.5, -2);
    mg.block(M.asphalt, 68, .02, 10, 0, G0, 37);                     // 汀州路（橫過巷口）
    for (let x = -32; x < 32; x += 4) mg.block(M.paint, 2, .025, .14, x, G0, 37);
    mg.block(M.paintR, 68, .025, .14, 0, G0, 32.3);
    mg.block(M.paintY, 68, .025, .14, 0, G0, 41.7);
    for (let k = 0; k < 7; k++) mg.block(M.paint, .55, .025, 4.2, -3 + k * 1.05, G0, 37);    // 巷口前的斑馬線
    mg.block(new T.MeshStandardMaterial({ map: rep(concreteTex.clone(), 6, 3), color: 0x7a7f80, roughness: .55 }), 68, .04, 10.6, 0, G0, 26.9);

    // ===== 巷子：從 149 巷口進去，彎來彎去，中間分岔 =====
    const AL = [
      { p: [[0, 22.4], [0, 16], [-1.4, 9], [-.8, 2], [1.6, -5], [2.6, -13], [1.2, -21], [-.6, -29], [.4, -38]], w: 2.6 },
      { p: [[-1.3, 8.4], [-6, 7.3], [-11, 8.8], [-16.5, 7.1], [-23, 8.2], [-28, 7.4]], w: 2.2 },
      { p: [[2.2, -9], [7, -10.2], [12, -7.6], [17.5, -9.2], [24, -8.2], [29, -9]], w: 2.2 },
      { p: [[.9, -22.4], [-4.5, -24.2], [-9.5, -21.6], [-15, -23.4], [-20, -22]], w: 2 },
      { p: [[-11, 8.6], [-12.4, 2.5], [-10.6, -3.5], [-12.6, -10], [-11.4, -15]], w: 1.9 },
      { p: [[12, -7.7], [13.2, -14], [11.4, -20], [13.2, -28], [12, -34]], w: 1.9 }
    ].map(a => { const c = new T.CatmullRomCurve3(a.p.map(([x, z]) => new T.Vector3(x, 0, z))); return { ...a, c, L: c.getLength() }; });
    const samp = [];
    AL.forEach(a => { const n = Math.ceil(a.L / .5); for (let i = 0; i <= n; i++) { const q = a.c.getPointAt(i / n); samp.push([q.x, q.z, a.w / 2]); } });
    const clearOf = (x, z, r) => samp.every(([sx, sz, hw]) => Math.hypot(x - sx, z - sz) >= hw + r);
    const rects = [], cells = [];
    const free = (x, z, r) => rects.every(([a, b, c, d]) => x + r < a || x - r > c || z + r < b || z - r > d);
    // 地面：濕的水泥地，主巷中間一條水溝
    AL.forEach(a => mg.put(M.floor, ribbon(a.p, a.w + .4, G0 + .025, Math.ceil(a.L * 1.5))));
    mg.put(M.gutter, ribbon(AL[0].p, .2, G0 + .035, 120));

    const alleySigns = canvasTex(1024, 64, (x, w, h) => {
      ['水餃 餡餅', '化粧品 香水', '繡 莊', '豆 腐', '南 北 貨', '修改衣服', '麵 線', '魚 丸'].forEach((s, i) => {
        const x0 = i * 128; x.fillStyle = '#ecebe3'; x.fillRect(x0 + 3, 3, 122, 58); x.strokeStyle = '#3b3f40'; x.lineWidth = 3; x.strokeRect(x0 + 4, 4, 120, 56);
        x.font = `900 ${s.length > 4 ? 22 : 30}px "Noto Serif TC"`; x.textAlign = 'center'; x.textBaseline = 'middle';
        const half = Math.ceil(s.length / 2); x.fillStyle = '#1f4f9a'; x.fillText(s.slice(0, half), x0 + 64 - (s.length > 4 ? 26 : 22), 33); x.fillStyle = '#b8342a'; x.fillText(s.slice(half), x0 + 64 + (s.length > 4 ? 26 : 22), 33);
        dirt(x, w, h, 8, '70,55,35', .35, [1, 3], [4, 30]);
      });
    });
    const AS = new T.MeshStandardMaterial({ map: alleySigns, emissiveMap: alleySigns, emissive: lin(.32, .32, .3), emissiveIntensity: 1, roughness: .8, side: T.DoubleSide });
    const frontSigns = canvasTex(768, 64, (x, w, h) => {
      [['三新鮮', '#1d4a3a', '#f2ecdc'], ['水 果', '#f2ecdc', '#b8342a'], ['豆 花', '#b8342a', '#f8f0dc'], ['早 餐', '#f0d44a', '#b8342a'], ['五 金', '#1f4a7a', '#f2efe4'], ['家庭理髮', '#2a2d2f', '#f2efe4']].forEach(([s, bg, fg], i) => {
        x.fillStyle = bg; x.fillRect(i * 128 + 2, 2, 124, 60); x.fillStyle = fg; x.font = `900 ${s.length > 3 ? 24 : 32}px "Noto Serif TC"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, i * 128 + 64, 34);
        dirt(x, w, h, 6, '60,45,30', .3, [1, 3], [6, 30]); });
    });
    const FS = new T.MeshStandardMaterial({ map: frontSigns, emissiveMap: frontSigns, emissive: lin(.4, .38, .34), emissiveIntensity: 1, roughness: .8 });
    M.shutBlue = new T.MeshStandardMaterial({ map: rep(shutterTex.clone(), 1, 1), color: 0x86a6c4, roughness: .55, metalness: .45 });
    M.crateG = new T.MeshStandardMaterial({ map: crateTex('#3c8d5a'), roughness: .6 });
    M.meter = new T.MeshStandardMaterial({ color: 0x9aa59e, roughness: .5, metalness: .3 });
    const veg = [0xd9a441, 0x8fae4b, 0xc5523a, 0xe6dccb, 0x5f8f4a, 0xd0743c, 0xb9b07a, 0x9a3b4a].map(c => new T.MeshStandardMaterial({ color: c, roughness: .7 }));
    const melon = new T.MeshStandardMaterial({ color: 0x2f5a2a, roughness: .5 }), melonCut = new T.MeshStandardMaterial({ color: 0xd8443a, roughness: .6, emissive: 0x30080a });
    const tubes = [], bulbs = [];

    function bike(x, z, ry) {
      const P = rot(x, z, ry); let a, b;
      [-.52, .52].forEach(lz => { [a, b] = P(0, lz); mg.put(M.tyre, UNIT.cyl, a, G0 + .34, b, 0, ry, Math.PI / 2, .66, .04, .66); });
      [a, b] = P(0, 0); mg.box(M.pipe, .04, .04, 1.05, a, G0 + .62, b, ry); mg.box(M.pipe, .04, .5, .04, a, G0 + .5, b, ry, .3);
      [a, b] = P(0, .5); mg.box(M.pipe, .5, .04, .04, a, G0 + .98, b, ry); [a, b] = P(0, -.2); mg.box(M.seat, .14, .06, .26, a, G0 + .9, b, ry);
      if (rnd() < .5) { [a, b] = P(0, .62); mg.box(M.pipe, .32, .22, .26, a, G0 + .85, b, ry); }
    }

    // 一間攤：local +z 朝巷子
    function cell(x, z, ry, W, D) {
      const P = rot(x, z, ry), r = rnd(), H = 2.85 + rnd() * .4, fz = D / 2;
      const kind = r < .56 ? 'shut' : r < .8 ? 'open' : 'bench';
      let [a, b] = P(0, -fz + .08); mg.box(M.wallB, W, H, .16, a, G0 + H / 2, b, ry);
      [-1, 1].forEach(e => { [a, b] = P(e * (W / 2 - .06), 0); mg.box(M.wallB, .12, H, D, a, G0 + H / 2, b, ry); });
      [a, b] = P(0, .3); mg.box(rnd() < .6 ? M.tin : M.tinRust, W + .1, .05, D + .7, a, G0 + H + .14, b, ry, -.05, 0, [1, 1]);
      if (kind === 'shut') {
        [a, b] = P(0, fz - .02); mg.put(rnd() < .6 ? M.shutBlue : M.shutter, UNIT.plane, a, G0 + (H - .34) / 2, b, 0, ry, 0, W - .18, H - .34, 1, [1, 2]);
        [a, b] = P(0, fz - .12); mg.box(M.shutter, W - .12, .34, .28, a, G0 + H - .17, b, ry);
        if (rnd() < .3) { [a, b] = P(-W * .3, fz + .02); mg.box(M.styro, .5, .62, .02, a, G0 + 1.4, b, ry); }       // 貼在鐵門上的紙
      } else if (kind === 'open') {
        [a, b] = P(0, -fz + .18); mg.put(M.shopLit, UNIT.plane, a, G0 + 1.35, b, 0, ry, 0, W - .3, 2.1, 1);
        [a, b] = P(0, fz - .45); mg.block(rnd() < .5 ? M.steel : M.wood, W - .4, .86, .8, a, G0, b, ry);
        for (let k = 0; k < 7; k++) { [a, b] = P(-W / 2 + .45 + k * (W - .9) / 6, fz - .45 + (rnd() - .5) * .4); mg.put(veg[Math.floor(rnd() * veg.length)], UNIT.ico, a, G0 + 1, b, rnd() * 3, rnd() * 3, 0, .32, .22, .3); }
        for (let k = 0; k < 4; k++) { [a, b] = P(-W / 2 + .5 + k * (W - 1) / 3, fz - .25); mg.box(M.bagCols[Math.floor(rnd() * M.bagCols.length)], .22, .4, .05, a, G0 + 2.05, b, ry); }
        [a, b] = P(0, fz - .5); bulbs.push([a, G0 + H - .5, b, rnd() < .6, false, H]);
      } else {
        [a, b] = P(0, fz - .02); mg.put(M.ceiling, UNIT.plane, a, G0 + H / 2, b, 0, ry, 0, W - .2, H - .2, 1);
        [a, b] = P(0, fz + .25); mg.block(M.woodDark, W - .6, .72, 1.1, a, G0, b, ry);
        mg.box(M.wood, W - .5, .05, 1.2, a, G0 + .74, b, ry);
        for (let k = 0; k < 1 + rnd() * 3; k++) { [a, b] = P(W / 2 - .45, fz + .3); mg.block(M.crateG, .62, .34, .46, a, G0 + k * .35, b, ry + (rnd() - .5) * .2); }
      }
      if (rnd() < .4) { const i = Math.floor(rnd() * 8); [a, b] = P(W * .28, fz + .72); mg.put(AS, UNIT.plane, a, G0 + H - .62, b, 0, ry + Math.PI / 2, 0, 1.3, .64, 1, [1 / 8, 1, i / 8, 0]);
        [a, b] = P(W * .28, fz + .72); mg.box(M.pipe, .02, .3, .02, a, G0 + H - .16, b, ry); }
      if (rnd() < .28) { [a, b] = P((rnd() - .5) * W * .6, fz + .38); mg.block(M.crateG, .6, .34, .45, a, G0, b, ry + (rnd() - .5) * .4); if (rnd() < .5) mg.block(M.crateG, .6, .34, .45, a, G0 + .35, b, ry); }
      if (rnd() < .13) { [a, b] = P((rnd() - .5) * W * .5, fz + .42); bike(a, b, ry + Math.PI / 2 + (rnd() - .5) * .2); }
      if (rnd() < .18) { [a, b] = P(W / 2 - .2, fz + .06); mg.box(M.meter, .32, .44, .14, a, G0 + 2.1, b, ry); }
    }

    // ===== 臨街那一排：一層樓的鐵皮攤子，巷口在中間 =====
    const FZ = 21.4, FD = 3.6;
    rects.push([-34, FZ - FD - .3, 34, FZ + .3], [4.4, FZ - 11.5, 12.6, FZ + .3]);
    function frontStall(cx, w) {
      const H = 3.1 + rnd() * .3, r = rnd(), kind = r < .5 ? 'shut' : r < .75 ? 'fruit' : 'shop';
      mg.block(M.wallB, w - .06, H, FD, cx, G0, FZ - FD / 2);
      mg.box(rnd() < .55 ? M.tin : M.tinRust, w + .05, .05, FD + 1.3, cx, G0 + H + .12, FZ - FD / 2 + .55, 0, .1, 0, [1, 1]);
      if (kind === 'shut') mg.put(rnd() < .5 ? M.shutBlue : M.shutter, UNIT.plane, cx, G0 + (H - .4) / 2, FZ + .01, 0, 0, 0, w - .2, H - .4, 1, [1, 2]);
      else {
        mg.put(kind === 'shop' ? M.shopLit : M.ceiling, UNIT.plane, cx, G0 + H / 2 - .1, FZ + .01, 0, 0, 0, w - .2, H - .4, 1);
        bulbs.push([cx, G0 + H - .5, FZ + .5, true, false, H]);
        if (kind === 'fruit') {
          mg.block(M.woodDark, w - .5, .8, 1.2, cx, G0, FZ + .7); mg.box(M.wood, w - .4, .05, 1.3, cx, G0 + .82, FZ + .7);
          for (let k = 0; k < 5; k++) { const mx = cx - w / 2 + .5 + k * (w - 1) / 4; mg.put(k % 2 ? melonCut : melon, UNIT.ico, mx, G0 + 1.02, FZ + .55, 0, rnd() * 3, 0, .45, .4, .4); mg.put(veg[Math.floor(rnd() * 3)], UNIT.ico, mx + .2, G0 + 1, FZ + 1, 0, 0, 0, .22, .2, .22); }
          for (let k = 0; k < 3; k++) mg.block(M.styro, .55, .35, .4, cx - w / 2 + .5 + k * .62, G0, FZ + 1.6);
        }
      }
      if (rnd() < .45) mg.box(M.tarpG, w - .1, .04, 1.7, cx, G0 + 2.75, FZ + .8, 0, .28, 0, [1, 1]);     // 綠色帆布雨遮
      if (rnd() < .5) { const i = Math.floor(rnd() * 6); mg.put(FS, UNIT.plane, cx, G0 + H - .32, FZ + .03, 0, 0, 0, Math.min(w - .3, 2.6), .5, 1, [1 / 6, 1, i / 6, 0]); }
    }
    let fx = -33.5;
    while (fx < 33.5) {
      let w = 2.8 + rnd() * 1.4;
      if (fx < -1.9 && fx + w > -1.9) w = -1.9 - fx;
      if (fx >= -1.9 && fx < 1.9) { fx = 1.9; continue; }
      const cx = fx + w / 2;
      if (w > 1.2 && !(cx > 4 && cx < 13)) frontStall(cx, w);
      fx += w;
    }
    // 巷口：透光浪板的小山牆，下面掛著黃底紅字的「龍口市場」
    mg.prism(M.frp, 4.6, 4.2, 1, 0, G0 + 3.5, FZ - 1.8, Math.PI / 2);
    mg.box(M.pipe, 4.2, .1, .1, 0, G0 + 3.5, FZ + .3);
    [-1.85, 1.85].forEach(x => mg.block(M.pipe, .1, 3.5, .1, x, G0, FZ + .25));
    {
      const tex = canvasTex(640, 200, (c, w, h) => {
        c.fillStyle = '#2b4f8e'; c.fillRect(0, 0, 110, 150); c.fillStyle = '#273548'; c.fillRect(w - 110, 0, 110, 150);
        c.fillStyle = '#f2c21b'; c.fillRect(110, 0, w - 220, 150); c.fillStyle = '#2f7a45'; c.fillRect(0, 150, w, 50);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#b8342a'; c.font = '900 76px "Noto Serif TC"'; c.fillText('龍口市場', w / 2, 62);
        c.fillStyle = '#1f3f86'; c.font = '700 32px "Noto Sans TC"'; c.fillText('汀州路一段149巷', w / 2, 122);
        c.fillStyle = '#f2efe4'; c.font = '700 24px "Noto Sans TC"'; ['雜貨', '素食'].forEach((s, i) => c.fillText(s, 55, 50 + i * 46)); ['蔬果', '肉品'].forEach((s, i) => c.fillText(s, w - 55, 50 + i * 46));
        c.font = '700 28px "Noto Sans TC"'; c.fillText('傳 統 市 場', w / 2, 176);
        dirt(c, w, h, 80, '60,40,20', .3, [1, 4], [4, 40]);
      });
      const sg = add(new T.PlaneGeometry(4, 1.25), new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: lin(.5, .45, .35), emissiveIntensity: 1, roughness: .8 }), 0, G0 + 3.05, FZ + .36);
    }
    // 巷口右邊三、四層的紅磚老樓，一樓是綠色帆布雨遮的水果攤
    {
      const bx = 8.5, bw = 8.2, bd = 11.2, GF = 3.3, FL = 3, NF = 3, top = G0 + GF + NF * FL;
      mg.block(M.brick, bw, GF + NF * FL, bd, bx, G0, FZ - bd / 2, 0, [2, 3]);
      mg.put(M.ceiling, UNIT.plane, bx, G0 + GF / 2, FZ + .01, 0, 0, 0, bw - .6, GF - .3, 1);
      mg.put(M.shopLit, UNIT.plane, bx - 1.5, G0 + 1.3, FZ + .02, 0, 0, 0, 3.6, 2, 1);
      mg.box(M.tarpG, bw + .6, .05, 2.6, bx - .4, G0 + 2.85, FZ + 1.2, 0, .24, 0, [1, 1]);
      mg.block(M.woodDark, 4.8, .8, 1.1, bx - .6, G0, FZ + .7); mg.box(M.wood, 5, .05, 1.2, bx - .6, G0 + .82, FZ + .7);
      for (let k = 0; k < 8; k++) mg.put(k % 3 ? melon : melonCut, UNIT.ico, bx - 2.7 + k * .6, G0 + 1.02, FZ + .6 + (k % 2) * .3, 0, rnd() * 3, 0, .42, .38, .4);
      bulbs.push([bx - 1.6, G0 + 2.5, FZ + .9, false, false, 2.9], [bx + 1.4, G0 + 2.5, FZ + .9, false, false, 2.9]);
      for (let f = 0; f < NF; f++) for (let k = 0; k < 2; k++) {
        const wx = bx - 2 + k * 4, wy = G0 + GF + f * FL + 1.5;
        mg.put(M.ceiling, UNIT.plane, wx, wy, FZ + .02, 0, 0, 0, 2.4, 1.6, 1);
        mg.put(M.grill, UNIT.plane, wx, wy, FZ + .42, 0, 0, 0, 2.5, 1.7, 1);
        mg.box(rnd() < .5 ? M.tin : M.tinRust, 2.7, .05, .7, wx, wy + 1, FZ + .35, 0, .3, 0);
        if (rnd() < .6) mg.box(M.styro, .9, .55, .5, wx + (rnd() < .5 ? -.7 : .7), wy - 1.05, FZ + .35);
      }
      mg.block(M.tinBlue, bw * .6, 2.4, bd * .6, bx + .8, top, FZ - bd * .6, 0, [2, 1]);
      mg.cyl(M.tank, .7, 1.6, bx - 2.6, top, FZ - 2.4); mg.block(M.wall, bw, .8, .2, bx, top, FZ - .1);
      const st = canvasTex(96, 384, (c, w, h) => { c.fillStyle = '#17191b'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2efe4'; c.font = '900 50px "Noto Serif TC"'; c.textAlign = 'center';
        c.fillText('美', w / 2, 70); c.fillText('髮', w / 2, 128); c.fillStyle = '#c4362c'; c.fillRect(0, 150, w, 40); c.fillStyle = '#fff'; c.font = '700 20px "Noto Sans TC"'; c.fillText('hair salon', w / 2, 177);
        c.fillStyle = '#f2efe4'; c.font = '700 34px "Noto Serif TC"'; ['造', '型', '沙', '龍'].forEach((s, i) => c.fillText(s, w / 2, 232 + i * 40)); });
      const sm = new T.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: lin(.7, .7, .7), emissiveIntensity: 1, side: T.DoubleSide });
      [0, Math.PI].forEach(ry => mg.put(sm, UNIT.plane, bx + bw / 2 + .55, G0 + 7, FZ - 1.2 + (ry ? -.06 : .06), 0, ry + Math.PI / 2, 0, 1.1, 4.4, 1));
      mg.box(M.pipe, .1, 4.5, .2, bx + bw / 2 + .55, G0 + 7, FZ - 1.2);
    }

    // ===== 巷子兩旁的攤 =====
    AL.forEach((a, ai) => {
      let d = ai === 0 ? 5.4 : 1.6;
      while (d < a.L - .8) {
        const W = 2.5 + rnd() * .7, u = Math.min(1, (d + W / 2) / a.L);
        const p = a.c.getPointAt(u), t = a.c.getTangentAt(u), nx = -t.z, nz = t.x;
        [-1, 1].forEach(s => {
          const D = 3.1 + rnd() * .6, off = a.w / 2 + D / 2 + .05, cx = p.x + nx * s * off, cz = p.z + nz * s * off;
          if (Math.abs(cx) > 31.5 || cz < -42 || cz > FZ - FD - .3) return;
          if (!clearOf(cx, cz, D / 2 - .4)) return;
          if (cells.some(([x, z]) => Math.hypot(x - cx, z - cz) < 2.5)) return;
          if (!free(cx, cz, 1.1)) return;
          cells.push([cx, cz]); cell(cx, cz, Math.atan2(-s * nx, -s * nz), W, D);
        });
        d += W;
      }
    });
    // 巷子的頂：鐵皮夾透光浪板、橫樑、日光燈
    AL.forEach(a => { const n = Math.ceil(a.L / 1.7);
      for (let i = 0; i < n; i++) {
        const u = (i + .5) / n, p = a.c.getPointAt(u), t = a.c.getTangentAt(u), ry = Math.atan2(t.x, t.z), r = rnd();
        if (r < .04) continue;
        mg.box(r < .42 ? M.frp : r < .82 ? M.tin : M.tinRust, a.w + 1, .04, a.L / n + .18, p.x, G0 + 3.4 + Math.sin(i * 1.7) * .08, p.z, ry, 0, (rnd() - .5) * .07, [1, 1]);
        if (i % 2 === 0) mg.box(M.pipe, a.w + 1, .07, .07, p.x, G0 + 3.32, p.z, ry);
        if (i % 3 === 1 && rnd() < .85) { tubes.push([p.x, G0 + 3.02, p.z]); mg.box(M.tube, .07, .07, 1.15, p.x, G0 + 3.02, p.z, ry); mg.box(M.pipe, .14, .05, 1.25, p.x, G0 + 3.09, p.z, ry); }
      } });

    // 巷子裡吊著一串紅燈籠，門口堆著一落一落的透明收納箱（Koza 拍的巷子）
    { const lanM = new T.MeshBasicMaterial({ color: lin(1.6, .12, .05), toneMapped: false }), capM = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6 });
      const binM = new T.MeshStandardMaterial({ color: 0xdfe6ea, roughness: .35, metalness: .05, emissive: 0x1a1e20, emissiveIntensity: 1 }), lidM = new T.MeshStandardMaterial({ color: 0x8fb6c6, roughness: .4 });
      [AL[1], AL[3]].forEach(a => { for (let u = .12; u < .92; u += .16) { const p = a.c.getPointAt(u);
        mg.put(lanM, UNIT.ico, p.x, G0 + 2.75, p.z, 0, 0, 0, .42, .52, .42); mg.box(capM, .2, .06, .2, p.x, G0 + 3.03, p.z); mg.box(capM, .02, .3, .02, p.x, G0 + 3.2, p.z); } });
      [.18, .34, .52, .7].forEach((u, i) => { const a = AL[0], p = a.c.getPointAt(u), t = a.c.getTangentAt(u), s2 = i % 2 ? 1 : -1, nx = -t.z * s2, nz = t.x * s2, ry = Math.atan2(t.x, t.z);
        const bx = p.x + nx * (a.w / 2 - .32), bz = p.z + nz * (a.w / 2 - .32), n = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) { mg.box(binM, .62, .42, .5, bx, G0 + .22 + k * .45, bz, ry + (rnd() - .5) * .08); mg.box(lidM, .64, .05, .52, bx, G0 + .45 + k * .45, bz, ry); } }); }
    // ===== 巷子之間與市場外圍：一層樓的鐵皮屋頂連成一片，偶爾冒出兩三層的老房子，沒有高樓 =====
    for (let gx = -30.5; gx <= 30.5; gx += 3.1) for (let gz = 16.2; gz >= -41; gz -= 3.1) {
      const x = gx + (rnd() - .5) * .5, z = gz + (rnd() - .5) * .5;
      if (!clearOf(x, z, 1.8) || !free(x, z, 1.5) || cells.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.9)) continue;
      const edge = Math.abs(x) > 24 || z < -36, r = rnd();
      const fl = edge ? (r < .35 ? 1 : r < .8 ? 2 : 3) : (r < .87 ? 1 : r < .98 ? 2 : 3);
      const h = fl === 1 ? 3.1 + rnd() * .5 : 1 + fl * 3, w = 3.15, d = 3.15;
      if (fl === 1) {
        mg.block(M.wallB, w, h, d, x, G0, z);
        mg.box(r < .35 ? M.tinRust : r < .55 ? M.tinBlue : M.tin, w + .3, .05, d + .3, x, G0 + h + .05, z, (rnd() - .5) * .1, (rnd() - .5) * .12, 0, [1, 1]);
        if (rnd() < .12) mg.cyl(M.tank, .5, 1.1, x, G0 + h, z);
        if (rnd() < .1) mg.box(M.styro, .8, .5, .5, x + .6, G0 + h + .3, z - .5);
      } else {
        const v = Math.floor(rnd() * 6);
        mg.block(rnd() < .3 ? M.brick : M.wall, w, h, d, x, G0, z, 0, [1, fl]);
        [[0, d / 2 + .01, 0], [0, -d / 2 - .01, Math.PI], [w / 2 + .01, 0, Math.PI / 2], [-w / 2 - .01, 0, -Math.PI / 2]].forEach(([ox, oz, ry]) => mg.put(FAC[(v + Math.abs(ry) * 2 | 0) % 6], UNIT.plane, x + ox, G0 + h / 2, z + oz, 0, ry, 0, w - .05, h, 1, [.8, fl / 4]));
        if (rnd() < .6) { mg.block(rnd() < .5 ? M.tinBlue : M.tinRust, w * .8, 2.3, d * .7, x, G0 + h, z - .3, 0, [1, 1]); mg.box(M.tin, w, .06, d, x, G0 + h + 2.4, z - .3, 0, .08); }
        if (rnd() < .7) mg.cyl(rnd() < .7 ? M.tank : M.tankBlue, .55, 1.3, x + .8, G0 + h + (rnd() < .5 ? 0 : 2.4), z + .8);
      }
    }

    // 汀州路：街邊的機車、腳踏車、電線桿
    for (let x = -31; x < 31; x += .95) { if (Math.abs(x) < 4 || rnd() < .3) continue; scooter(mg, x, 33.3, Math.PI / 2 + (rnd() - .5) * .15); }
    for (let x = -30; x < 30; x += 1) { if (rnd() < .6) continue; scooter(mg, x, 41, -Math.PI / 2 + (rnd() - .5) * .15); }
    [[-12.4, 23.4, 0], [-13.4, 24.5, .2], [-10.8, 23.2, .1], [14.6, 23.5, Math.PI], [15.6, 24.6, Math.PI - .2]].forEach(([x, z, r]) => scooter(mg, x, z, r));
    [[-9.4, 22.6, 1.4], [-8.4, 22.8, 1.6], [-15.6, 22.6, 1.5]].forEach(([x, z, r]) => bike(x, z, r));
    [-15, 13].forEach(x => pole(mg, x, 32));
    mg.build(LK);

    // 燈泡、日光燈、電線
    const wirePts = [];
    const shadeGeo = new T.ConeGeometry(.3, .26, 14, 1, true);
    bulbs.forEach(([x, y, zz, shade, red, H]) => {
      add(new T.SphereGeometry(.11, 10, 8), M.bulb, x, y, zz);
      if (shade) add(shadeGeo, M.shade, x, y + .14, zz);
      const gl = glow(red ? lin(1.4, .25, .15) : lin(1.2, .7, .35), 2.4, .8); gl.position.set(x, y, zz); LK.add(gl);
      wirePts.push(x, y + .2, zz, x, G0 + (H || 3.2), zz);
    });
    tubes.forEach(([x, y, zz]) => { const gl = glow(lin(.5, .6, .62), 3, .42); gl.position.set(x, y - .05, zz); LK.add(gl); });
    const sag = (a, b, d) => { let p = a; for (let k = 1; k <= 12; k++) { const u = k / 12, q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(Math.PI * u) * d, a[2] + (b[2] - a[2]) * u]; wirePts.push(...p, ...q); p = q; } };
    for (let k = 0; k < 4; k++) { sag([-15, G0 + 9.4 - k * .3, 32], [13, G0 + 9.4 - k * .3, 32], .8 + k * .2); sag([-34, G0 + 9 - k * .3, 32.5], [-15, G0 + 9.4 - k * .3, 32], .6); sag([13, G0 + 9.4 - k * .3, 32], [34, G0 + 9 - k * .3, 32.5], .6); }
    [[-15, -6, FZ], [13, 12.6, FZ - 2], [-15, -16, FZ], [13, 4.4, FZ - 1]].forEach(([px, bx, bz]) => sag([px, G0 + 8.4, 32], [bx, G0 + (Math.abs(bx - 8.5) < 4.2 ? 9 : 3.6), bz], .5));
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wirePts, 3)); LK.add(new T.LineSegments(wg, M.wire));
    // 巷子裡的光：只有幾盞，大部分是暗的，巷尾比較亮
    [[0, 0], [0, .35], [0, .7], [1, .55], [2, .5], [3, .5]].forEach(([ai, u], i) => { const q = AL[ai].c.getPointAt(u); const l = new T.PointLight(i % 2 ? 0xdfe8ee : 0xffb070, 1.3, 13, 1.8); l.position.set(q.x, G0 + 2.7, q.z); LK.add(l); });
    const sl = new T.PointLight(0xffc98a, 1, 16, 2); sl.position.set(0, G0 + 2.6, FZ + 2.2); LK.add(sl);
    const st2 = new T.PointLight(0xffc98a, .7, 26, 2); st2.position.set(-1, G0 + 7.5, 33); LK.add(st2);      // 路燈
    LK.userData.alleys = AL;
  }

  // Koza 的攤：《海市》
  const KZ = new T.Group(); KZ.position.set(0, 1.3, 27); LK.add(KZ);
  add(B(17, .12, 3.4), M.steel, 0, 1.05, 0, KZ);
  add(B(17, 1, .1), M.steelDark, 0, .5, 1.7, KZ);
  [-8.2, 8.2].forEach(x => add(B(.15, 1, 3.2), M.steelDark, x, .5, 0, KZ));
  // 投影架
  [-8.4, 8.4].forEach(x => add(B(.12, 7.4, .12), M.steelDark, x, 3.7, -1.2, KZ));
  add(B(17, .12, .12), M.steelDark, 0, 7.4, -1.2, KZ);
  const order = ['hangkong', 'shuangxi', 'longkou', 'shezi'], xs = [-6, -2.2, 2, 6.1];
  const beamMat = new T.MeshBasicMaterial({ color: lin(.35, .4, .45), transparent: true, opacity: .045, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  order.forEach((id, i) => {
    const big = id === 'longkou', x = xs[i];
    // 秤：底座、托盤、刻度盤、指針
    add(B(big ? 3.2 : 2.6, .5, 2.4), M.steelDark, x, 1.36, 0, KZ);
    const dialTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#f2f1ea'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 2;
      for (let k = 0; k < 40; k++) { const a = -Math.PI * .75 + k / 39 * Math.PI * 1.5; c.beginPath(); c.moveTo(64 + Math.cos(a - Math.PI / 2) * 54, 64 + Math.sin(a - Math.PI / 2) * 54); c.lineTo(64 + Math.cos(a - Math.PI / 2) * (k % 5 ? 48 : 42), 64 + Math.sin(a - Math.PI / 2) * (k % 5 ? 48 : 42)); c.stroke(); }
      c.fillStyle = '#b8342a'; c.font = '700 16px "Noto Serif TC"'; c.textAlign = 'center'; c.fillText('斤', 64, 92); });
    const dial = add(new T.CircleGeometry(.42, 32), new T.MeshStandardMaterial({ map: dialTex, roughness: .4 }), x, 1.36, 1.22, KZ);
    const needle = add(B(.03, .36, .01), new T.MeshBasicMaterial({ color: 0xb8342a }), 0, .14, .01, dial); needle.geometry.translate(0, .04, 0);
    add(B(big ? 3.4 : 2.8, .06, 2.6), M.steel, x, 1.64, 0, KZ);
    const ice = makeIce(S(id), big ? 2.9 : 2.3, big ? 3.6 : 2.9, 2.0);
    ice.g.position.set(x, 1.67, 0); KZ.add(ice.g); ice.needle = needle; ice.stall = true; ice.want = 0; ice.selK = 0; ice.shell.userData.stall = true;
    // 投影機與光束
    add(B(.7, .35, .55), M.steelDark, x, 7.15, -1.2, KZ);
    const beam = new T.Mesh(new T.CylinderGeometry(.08, big ? 1.8 : 1.4, 5.2, 24, 1, true), beamMat); beam.position.set(x, 4.4, -.7); beam.rotation.x = -.18; KZ.add(beam);
  });
  // 布旗「海市」
  const flagTex = canvasTex(128, 384, (c, w, h) => { c.fillStyle = '#b8342a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f6efe2'; c.font = '900 92px "Noto Serif TC"'; c.textAlign = 'center';
    c.fillText('海', w / 2, 140); c.fillText('市', w / 2, 270); for (let k = 0; k < 80; k++) { c.fillStyle = `rgba(60,10,10,${Math.random() * .2})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 4 + Math.random() * 20); } });
  const flagGeo = new T.PlaneGeometry(1.3, 3.9, 6, 12);
  const flag = add(flagGeo, new T.MeshStandardMaterial({ map: flagTex, side: T.DoubleSide, roughness: .9, emissive: 0x401010, emissiveIntensity: .4 }), 9.6, 4.4, -.6, KZ);
  const flagBase = flagGeo.attributes.position.array.slice();
  add(B(.1, 7.6, .1), M.steelDark, 9, 3.8, -.6, KZ);
  // 紅繩與夾著的紙條（帳簿）
  const ropeCurve = new T.CatmullRomCurve3([new T.Vector3(-8.4, 6.2, -1.2), new T.Vector3(-4, 5.6, -1.25), new T.Vector3(0, 5.45, -1.25), new T.Vector3(4, 5.6, -1.25), new T.Vector3(8.4, 6.2, -1.2)]);
  add(new T.TubeGeometry(ropeCurve, 40, .025, 5), new T.MeshBasicMaterial({ color: lin(.6, .05, .04) }), 0, 0, 0, KZ);
  const notes = new T.Group(); KZ.add(notes);
  function hangNotes() {
    notes.clear();
    const list = window.HaishiLedger.all().slice(0, 14);
    list.forEach((e, i) => { const u = (i + .5) / 14, p = ropeCurve.getPoint(u);
      const tx = canvasTex(96, 128, (c, w, h) => { c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a3236'; c.font = '26px "LXGW WenKai TC"'; c.textAlign = 'center';
        const s = e.place.slice(0, 8); for (let k = 0; k < Math.min(4, s.length); k++) c.fillText(s[k], w / 2, 34 + k * 26); });
      const n = add(new T.PlaneGeometry(.42, .56), new T.MeshStandardMaterial({ map: tx, side: T.DoubleSide, roughness: .9 }), p.x, p.y - .34, p.z + .02, notes);
      n.rotation.z = (rnd() - .5) * .25; });
  }

  // 掛融水袋的架子：成交的一袋袋水掛在攤子左邊
  add(B(.1, 5.2, .1), M.steelDark, -9.2, 2.6, 0, KZ); add(B(4, .07, .07), M.steelDark, -11.1, 5.1, 0, KZ);
  const bagGroup = new T.Group(); KZ.add(bagGroup);
  const bagGeo = new T.LatheGeometry([[0, 0], [.17, .02], [.25, .1], [.27, .26], [.22, .4], [.1, .5], [.05, .56], [.08, .63], [.03, .68]].map(([r, y]) => new T.Vector2(r, y)), 22);
  const bagString = new T.LineBasicMaterial({ color: lin(.7, .06, .05) });
  function hangBags(fresh) {
    bagGroup.clear();
    window.HaishiLedger.all().filter(e => e.site).slice(0, 6).forEach((e, i) => {     // 所有人換走的水袋
      const site = S(e.site) || S('longkou'), texs = siteTextures(site), tx = texs[i % texs.length];
      const mat = new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: lin(.55, .6, .65), color: 0xd4ecf2, transparent: true, opacity: .82, roughness: .06, metalness: .1, side: T.DoubleSide });
      const hold = new T.Group(); hold.position.set(-9.6 - i * .62, 5.1, 0);
      const b = new T.Mesh(bagGeo, mat); b.position.y = -1.3; b.scale.setScalar(.85); hold.add(b);
      const lg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, -.72, 0)]); hold.add(new T.Line(lg, bagString));
      hold.userData.born = fresh && i === 0 ? clock.elapsedTime : -99; hold.userData.i = i;
      bagGroup.add(hold);
    });
  }

  /* ================= 龍口：巷子盡頭吐出蜃氣 ================= */
  function taperTube(points, rMax, segs = 140, radial = 14, pow = .6) {
    const curve = new T.CatmullRomCurve3(points), frames = curve.computeFrenetFrames(segs, false);
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, p = curve.getPointAt(u), r = rMax * (.12 + .88 * Math.pow(Math.sin(Math.PI * u), pow)) * (1 + .08 * Math.sin(u * 60));
      for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
        pos.push(p.x + n.x * r, p.y + n.y * r * 1.4, p.z + n.z * r); }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return { g, curve };
  }
  // 龍口不另外做一張嘴：市場本身就是龍的口。蜃氣從巷子盡頭那道光裡慢慢吐出來，往三座樓臺飄
  const MZ = -38;
  // 口中的光（吐氣）
  const breath = glow(lin(.95, .85, .7), 30, .0); breath.position.set(.4, 6, MZ); scene.add(breath);
  /* ================= 蜃氣（水氣粒子） ================= */
  const ISC = 3.7;    // 三座樓臺整體放大（第十版再放大約三成）
  const ISL = [
    { id: 'hangkong', pos: new T.Vector3(-475, 0, -425) },
    { id: 'shezi', pos: new T.Vector3(0, 0, -720) },
    { id: 'shuangxi', pos: new T.Vector3(475, 0, -425) }
  ];
  const N = reduce ? 500 : 2600;
  const vPos = new Float32Array(N * 3), vA = new Float32Array(N), vVel = new Float32Array(N * 3), vLife = new Float32Array(N), vDur = new Float32Array(N), vSz = new Float32Array(N);
  const MOUTH = new T.Vector3(.4, 5, MZ);
  const vGeo = new T.BufferGeometry();
  vGeo.setAttribute('position', new T.BufferAttribute(vPos, 3)); vGeo.setAttribute('aA', new T.BufferAttribute(vA, 1)); vGeo.setAttribute('aS', new T.BufferAttribute(vSz, 1));
  const vMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uScale: { value: innerHeight * DPR * .5 } },
    vertexShader: 'attribute float aA, aS; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vA = aA * smoothstep(8., 50., -mv.z); gl_PointSize = min(aS * uScale / -mv.z, 70.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vec3(.62,.6,.78) * a * a * vA * .075, 1.); }' });
  scene.add(new T.Points(vGeo, vMat));
  function spawn(i) {
    const tgt = ISL[Math.floor(rnd() * 3)].pos;
    const dir = tgt.clone().add(new T.Vector3((rnd() - .5) * 140, 60 + rnd() * 140, (rnd() - .5) * 90)).sub(MOUTH).normalize();
    const sp = 15 + rnd() * 15;
    vPos[i * 3] = MOUTH.x + (rnd() - .5) * 14; vPos[i * 3 + 1] = MOUTH.y + rnd() * 4; vPos[i * 3 + 2] = MOUTH.z + (rnd() - .5) * 8;
    vVel[i * 3] = dir.x * sp; vVel[i * 3 + 1] = dir.y * sp; vVel[i * 3 + 2] = dir.z * sp;
    vLife[i] = 0; vDur[i] = 14 + rnd() * 14; vSz[i] = 2 + rnd() * 5;
  }
  for (let i = 0; i < N; i++) { spawn(i); vLife[i] = rnd(); }
  function updateVapor(dt, t, rate) {
    for (let i = 0; i < N; i++) {
      vLife[i] += dt / vDur[i];
      if (vLife[i] >= 1) { if (rnd() < rate) spawn(i); else { vA[i] = 0; continue; } }
      const k = i * 3;
      vPos[k] += (vVel[k] + Math.sin(t * .4 + vPos[k + 1] * .05) * 2.2) * dt;
      vPos[k + 1] += (vVel[k + 1] * (1 - vLife[i] * .7)) * dt;
      vPos[k + 2] += (vVel[k + 2] + Math.cos(t * .35 + vPos[k] * .04) * 2.2) * dt;
      vSz[i] += dt * .5;
      vA[i] = Math.sin(Math.PI * vLife[i]) * rate;
    }
    vGeo.attributes.position.needsUpdate = true; vGeo.attributes.aA.needsUpdate = true; vGeo.attributes.aS.needsUpdate = true;
  }

  /* ================= 三座樓臺 =================
     每座島的「正面」(+z) 朝向龍口。島的形狀與地景參照真實的地方。 */
  const islands = [];
  const lineMat = () => new T.LineBasicMaterial({ color: lin(1.6, 1.7, 2.1), transparent: true, opacity: 1, fog: false, depthWrite: false, toneMapped: false });
  const faceMat = () => new T.MeshBasicMaterial({ color: lin(.5, .55, .7), transparent: true, opacity: .06, fog: false, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
  const SHEZI_OUT = []; for (let i = 0; i < 56; i++) { const a = i / 56 * Math.PI * 2; SHEZI_OUT.push([50 * Math.cos(a) - 2, 26 * Math.sin(a) * (.72 - .28 * Math.cos(a))]); }
  const SX_OUT = []; for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, r = 39 + Math.sin(a * 3 + 1) * 3 + Math.sin(a * 5) * 1.8; SX_OUT.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const HK_OUT = (() => { const p = [], W = 42, Dd = 30, R = 8; for (let i = 0; i < 4; i++) { const cx = (i === 0 || i === 3 ? 1 : -1) * (W - R), cz = (i < 2 ? 1 : -1) * (Dd - R); for (let k = 0; k <= 6; k++) { const a = (i * 90 + k * 15) * Math.PI / 180; p.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } } return p; })();
  const OUTLINE = { shezi: SHEZI_OUT, shuangxi: SX_OUT, hangkong: HK_OUT };
  const offsetIn = (pts, d) => pts.map((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cz = pts.reduce((s, q) => s + q[1], 0) / pts.length; if ((p[0] - cx) * nx + (p[1] - cz) * nz > 0) { nx = -nx; nz = -nz; } return [p[0] + nx * d, p[1] + nz * d]; });
  const scaleOut = (pts, k) => pts.map(([x, z]) => [x * k, z * k]);

  function buildRender(def, ii) {
    // 效果圖：乾淨的大樓、格線、整齊的行道樹，沒有人。每座島對應它真實的開發計畫
    const g = new T.Group(), lm = lineMat(), fm = faceMat(), mats = [lm, fm], L = [];
    let s2 = 31 + ii * 17; const r2 = () => { s2 = (s2 * 16807) % 2147483647; return (s2 - 1) / 2147483646; };
    let maxH = 0;
    const boxW = (x, z, w, h, d, floors = 3) => { maxH = Math.max(maxH, h); const box = new T.Mesh(B(w, h, d), fm); box.position.set(x, h / 2 + 1.4, z); g.add(box);
      const e = new T.EdgesGeometry(B(w, h, d)).attributes.position.array; for (let k = 0; k < e.length; k += 3) L.push(e[k] + x, e[k + 1] + h / 2 + 1.4, e[k + 2] + z);
      for (let f = floors; f < h; f += floors) { const y = f + 1.4, hw = w / 2, hd = d / 2; L.push(x - hw, y, z + hd, x + hw, y, z + hd, x + hw, y, z + hd, x + hw, y, z - hd); }
      for (let m = 1; m < 4; m++) { const xx = x - w / 2 + w * m / 4; L.push(xx, 1.4, z + d / 2, xx, h + 1.4, z + d / 2); } };
    const outline = (pts, y) => pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; L.push(p[0], y, p[1], q[0], y, q[1]); });
    const tree = (x, z) => { for (let q = 0; q < 6; q++) { const b = q / 6 * Math.PI * 2; L.push(x, 1.6, z, x + Math.cos(b) * 1.3, 3.8, z + Math.sin(b) * 1.3); } };
    if (def.id === 'shezi') {
      // 生態社子島：堤防加高、中央生態運河、兩岸高樓
      const o = OUTLINE.shezi; outline(o, 1.4); outline(o, 11); o.forEach((p, i) => { if (i % 4 === 0) L.push(p[0], 1.4, p[1], p[0], 11, p[1]); });
      const canal = []; for (let i = 0; i <= 30; i++) { const x = -44 + i * 3, z = Math.sin(i * .3) * 4; canal.push([x, z]); }
      [-3, 3].forEach(dz => canal.forEach((p, i) => { if (i < canal.length - 1) { const q = canal[i + 1]; L.push(p[0], 1.6, p[1] + dz, q[0], 1.6, q[1] + dz); } }));
      [[-30, -11, 7, 46], [-14, -12, 8, 58], [4, -10, 7, 40], [-22, 11, 8, 50], [-4, 11, 7, 62], [16, 9, 6, 34], [28, -4, 5, 24]].forEach(([x, z, w, h]) => boxW(x, z, w, h * (.8 + r2() * .3), w * (.8 + r2() * .3)));
      for (let x = -40; x < 38; x += 6) { tree(x, 6.5); tree(x, -6.5); }
    } else if (def.id === 'hangkong') {
      // 航空城：物流園區、商辦、第三跑道
      outline(OUTLINE.hangkong, 1.4);
      L.push(-80, 1.5, -24, 80, 1.5, -24, -80, 1.5, -18, 80, 1.5, -18); for (let x = -76; x < 80; x += 8) L.push(x, 1.5, -21, x + 4, 1.5, -21);
      [[-26, 4, 16, 10, 12], [-6, 6, 14, 9, 12], [14, 2, 18, 8, 12]].forEach(([x, z, w, h, d]) => boxW(x, z, w, h, d, 4));
      [[-18, 22, 8, 52], [2, 22, 7, 64], [22, 20, 8, 44], [34, 4, 6, 30]].forEach(([x, z, w, h]) => boxW(x, z, w, h * (.85 + r2() * .3), w));
      for (let x = -38; x <= 38; x += 5) tree(x, 13);
    } else {
      // 雙溪：老街再造的觀光規劃，一模一樣的街屋、遊客中心、停車格
      outline(OUTLINE.shuangxi, 1.4);
      for (let i = 0; i < 9; i++) { const x = -30 + i * 4.4; boxW(x, 6, 4, 6, 6, 3); L.push(x - 2, 7.4, 3, x, 9.4, 3, x, 9.4, 3, x + 2, 7.4, 3); boxW(x, 18, 4, 6, 6, 3); }
      boxW(16, -6, 18, 10, 12, 5); boxW(-6, -18, 10, 22, 10, 3);
      for (let x = 6; x < 30; x += 2.4) L.push(x, 1.5, 14, x, 1.5, 20); L.push(6, 1.5, 14, 30, 1.5, 14);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) tree(Math.cos(a) * 30, Math.sin(a) * 30);
    }
    for (let k = -30; k <= 30; k += 10) { L.push(k, 1.45, -30, k, 1.45, 30, -30, 1.45, k, 30, 1.45, k); }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(L, 3));
    g.add(new T.LineSegments(lg, lm));
    return { g, mats, maxH };
  }

  /* ---------- 島上共用的房子 ---------- */
  function islandKit(mats) {
    const reg = m => { m.transparent = true; m.userData.base = m.opacity; mats.push(m); return m; };
    const facW = [0, 1, 2, 3, 4, 5].map(v => { const f = walkupTex(v); return reg(new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: lin(1.4, 1, .6), emissiveIntensity: 1, roughness: .85 })); });
    const facBoard = [0, 2, 4].map(v => { const f = walkupTex(v, true); return reg(new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: lin(1.4, 1, .6), emissiveIntensity: 1, roughness: .85 })); });
    const K = {
      reg, facW, facBoard,
      wall: reg(new T.MeshStandardMaterial({ color: 0x6f6a62, roughness: .92 })),
      wallW: reg(new T.MeshStandardMaterial({ color: 0xbab6aa, roughness: .9 })),
      concrete: reg(new T.MeshStandardMaterial({ map: concreteTex, roughness: .9 })),
      tinBlue: reg(new T.MeshStandardMaterial({ map: tinTex('#355a75', '#5d86a2'), roughness: .5, metalness: .35 })),
      tinRust: reg(new T.MeshStandardMaterial({ map: tinTex('#6a4430', '#94654a'), roughness: .65, metalness: .3 })),
      tinGrey: reg(new T.MeshStandardMaterial({ map: tinTex('#7c8588', '#a7b0b3'), roughness: .5, metalness: .45 })),
      tank: reg(new T.MeshStandardMaterial({ color: 0xc7ccd0, roughness: .3, metalness: .85 })),
      pipe: reg(new T.MeshStandardMaterial({ color: 0x3b4245, roughness: .5, metalness: .7 })),
      tile: reg(new T.MeshStandardMaterial({ map: tileRoofTex, roughness: .7 })),
      redTile: reg(new T.MeshStandardMaterial({ map: redTileTex, roughness: .7 })),
      brick: reg(new T.MeshStandardMaterial({ map: brickTex, roughness: .9 })),
      templeRed: reg(new T.MeshStandardMaterial({ color: 0x8a2a20, roughness: .7, emissive: 0x200604, emissiveIntensity: 1 })),
      orange: reg(new T.MeshStandardMaterial({ color: 0xd9822b, roughness: .5, emissive: 0x3a1a04, emissiveIntensity: 1 })),
      water: reg(new T.MeshStandardMaterial({ color: 0x0f2129, roughness: .05, metalness: .9 })),
      lamp: reg(new T.MeshBasicMaterial({ color: lin(4, 2.6, 1.2), toneMapped: false })),
      lantern: reg(new T.MeshBasicMaterial({ color: lin(3.5, .5, .25), toneMapped: false })),
      grille: reg(new T.MeshStandardMaterial({ color: 0x2c3336, roughness: .55, metalness: .6 })),
      ac: reg(new T.MeshStandardMaterial({ color: 0xd7d9d4, roughness: .6 })),
      cloth: [0xb8342a, 0x3d6c9a, 0xe6dccb, 0xd9a441].map(c => reg(new T.MeshStandardMaterial({ color: c, roughness: .9, side: T.DoubleSide }))),
      jade: reg(new T.MeshStandardMaterial({ color: 0x2f9a6a, roughness: .4, emissive: 0x062216, emissiveIntensity: 1 })),
      cobalt: reg(new T.MeshStandardMaterial({ color: 0x2f5fb0, roughness: .4, emissive: 0x060f26, emissiveIntensity: 1 })),
      gold: reg(new T.MeshStandardMaterial({ color: 0xdcae3a, roughness: .35, metalness: .4, emissive: 0x2a1e04, emissiveIntensity: 1 }))
    };
    return K;
  }
  // 住過的痕跡：凸出來的鐵窗、冷氣室外機、曬衣桿。照台灣老街屋真的樣子
  function facadeBits(mg, K, P, w, d, y0, floors, ry) {
    for (let f = 0; f < floors; f++) { const y = y0 + f * 3, side = rnd() < .5 ? -1 : 1;
      if (rnd() < .55) { const [gx, gz] = P(side * w * .2, d / 2 + .28); mg.box(K.grille, w * .44, 1.7, .5, gx, y + 1.55, gz, ry);
        const [hx, hz] = P(side * w * .2, d / 2 + .54); for (let k = -2; k <= 2; k++) { const [vx, vz] = P(side * w * .2 + k * w * .09, d / 2 + .54); mg.box(K.grille, .04, 1.6, .04, vx, y + 1.55, vz, ry); } }
      if (rnd() < .5) { const [ax, az] = P(-side * w * .32, d / 2 + .24); mg.box(K.ac, .82, .56, .42, ax, y + .55, az, ry); }
      if (f > 0 && rnd() < .22) { const [lx, lz] = P(0, d / 2 + .7); mg.box(K.pipe, w * .8, .05, .05, lx, y + 2.5, lz, ry);
        for (let k = 0; k < 3; k++) { const [cx, cz] = P((k - 1) * w * .22 + (rnd() - .5) * .3, d / 2 + .7); mg.box(K.cloth[Math.floor(rnd() * 4)], .6, .7 + rnd() * .4, .03, cx, y + 2.05, cz, ry); } }
    }
  }
  // 透天厝：底部在地面 G，正面朝 ry
  function townhouse(mg, K, pts, x, z, w, d, floors, ry, o = {}) {
    const P = rot(x, z, ry), G = o.g ?? 1.4, base = o.raise || 0, H = floors * 3;
    if (base) { const [bx, bz] = P(0, 0); mg.block(K.concrete, w, base, d, bx, G, bz, ry); }
    let [px, pz] = P(0, 0); mg.block(K.wall, w, H, d, px, G + base, pz, ry);
    [px, pz] = P(0, d / 2 + .02);
    const fac = o.fac || (o.boarded ? K.facBoard[Math.floor(rnd() * 3)] : K.facW[Math.floor(rnd() * 6)]);
    mg.put(fac, UNIT.plane, px, G + base + H / 2, pz, 0, ry, 0, w - .05, H, 1, [1, floors / 4]);
    if (!o.boarded) facadeBits(mg, K, P, w, d, G + base, floors, ry);
    const top = G + base + H;
    [px, pz] = P(0, d / 2 - .1); mg.box(K.wall, w, .8, .2, px, top + .4, pz, ry);
    if (o.addon !== false && rnd() < .6) { const ad = d * (.45 + rnd() * .3); [px, pz] = P(0, -d / 2 + ad / 2); mg.block(rnd() < .5 ? K.tinBlue : K.tinRust, w - .3, 2.3, ad, px, top, pz, ry, [1, 1]); }
    if (rnd() < .75) { [px, pz] = P(w * .22, -d * .3); mg.cyl(K.tank, .55, 1.3, px, top + (rnd() < .5 ? 2.3 : .1), pz); }
    pts && sample(pts, x, G + base, z, w, H + 2, d, Math.round(w * H * .8));
    return top;
  }
  // 人字屋頂的矮房（老厝、工廠）
  function gableHouse(mg, K, pts, x, z, len, span, h, rise, ry, wallMat, roofMat, G = 1.4) {
    mg.block(wallMat, len, h, span, x, G, z, ry);
    mg.prism(roofMat, len + .5, span + .7, rise, x, G + h, z, ry);
    pts && sample(pts, x, G, z, len, h + rise, span, Math.round(len * h * .6));
  }
  // 廟：紅牆、燕尾脊、燈籠
  function temple(mg, K, pts, x, z, w, d, ry, big) {
    const P = rot(x, z, ry), h = big ? 4.6 : 3.6;
    const [bx, bz] = P(0, 1); mg.block(K.concrete, w + 3, .5, d + 4, bx, 1.4, bz, ry);
    mg.block(K.templeRed, w, h, d, x, 1.9, z, ry);
    mg.prism(K.tile, w + 1.6, d + 1.4, 2.2, x, 1.9 + h, z, ry);
    let [px, pz] = P(0, 0); mg.box(K.orange, w + 2, .35, .35, px, 1.9 + h + 2.25, pz, ry);
    [-1, 1].forEach(sd => { const [ex, ez] = P(sd * (w / 2 + 1.1), 0); mg.box(K.orange, 1.4, .3, .3, ex, 1.9 + h + 2.55, ez, ry, 0, sd * .5); });
    if (big) { mg.prism(K.tile, w * .6, d * .6, 1.6, x, 1.9 + h + 2.2, z, ry); }
    // 屋脊上的剪黏：一顆顆綠、藍、金、橘的瓷片，燕尾翹得更高
    { const cols = [K.jade, K.cobalt, K.gold, K.orange], ry0 = 1.9 + h + 2.45;
      for (let k = -w / 2 - .6; k <= w / 2 + .61; k += .55) { const [ox, oz] = P(k, 0); mg.put(cols[Math.floor(rnd() * 4)], UNIT.ico, ox, ry0 + rnd() * .15, oz, rnd(), rnd(), 0, .32, .4 + rnd() * .3, .32); }
      [-1, 1].forEach(sd => { const [ex, ez] = P(sd * (w / 2 + 1.9), 0); mg.box(K.orange, 1, .22, .22, ex, 1.9 + h + 3.05, ez, ry, 0, sd * 1.05);
        const [dx, dz] = P(sd * (w / 2 - .4), 0); mg.box(K.jade, 1.4, .5, .18, dx, ry0 + .45, dz, ry, 0, sd * .25); mg.put(K.gold, UNIT.ico, dx + 0, ry0 + .85, dz, 0, 0, 0, .3, .3, .3); });
      const [cx, cz] = P(0, 0); mg.put(K.gold, UNIT.cyl6, cx, ry0 + .6, cz, 0, 0, 0, .5, 1.2, .5); mg.put(K.orange, UNIT.ico, cx, ry0 + 1.35, cz, 0, 0, 0, .55, .55, .55);
      // 簷下的龍柱與彩繪樑
      [-1, 1].forEach(sd => { const [qx, qz] = P(sd * w * .32, d / 2 + .5); mg.cyl(K.wall, .26, h, qx, 1.9, qz, true); mg.put(K.jade, UNIT.ico, qx, 1.9 + h * .65, qz, 0, 0, 0, .6, h * .5, .6); });
      const [bx2, bz2] = P(0, d / 2 + .5); mg.box(K.cobalt, w + .4, .35, .25, bx2, 1.9 + h - .2, bz2, ry); }
    [-1, 1].forEach(sd => { const [lx, lz] = P(sd * w * .3, d / 2 + .6); mg.put(K.lantern, UNIT.ico, lx, 1.9 + h - .8, lz, 0, 0, 0, .55, .7, .55); });
    pts && sample(pts, x, 1.4, z, w, h + 3, d, Math.round(w * h));
    return P(0, d / 2 + .6);
  }
  function sample(pts, x, y, z, w, h, d, n) { for (let k = 0; k < n; k++) pts.push(x + (rnd() - .5) * w, y + rnd() * h, z + (rnd() - .5) * d); }
  function hill(mg, mat, x, z, r, h, seedA = 0) {
    const geo = new T.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const px = p.getX(k), py = p.getY(k), pz = p.getZ(k), n = Math.sin(px * .35 + pz * .27 + seedA) * .5 + Math.sin(px * .8 - pz * .6 + seedA * 2) * .25;
      p.setXYZ(k, px * (1 + n * .12), py * (h / r) * (1 + n * .18), pz * (1 + n * .12)); }
    geo.computeVertexNormals(); mg.put(mat, geo, x, .6, z);
  }

  /* ---------- 雙溪：淺山圍著的小鎮，兩條溪匯流，老街、三忠廟、宜蘭線 ---------- */
  // 地標牌：一條細光線往上，頂端掛名字。只在看得到日常樣子時出現
  function pin(g, mats, text, x, z, top, base = 1.4) {
    const lm = new T.LineBasicMaterial({ color: lin(1.5, 1.2, .75), transparent: true, opacity: .6, toneMapped: false, depthWrite: false }); lm.userData.base = .6; mats.push(lm);
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute([x, base, z, x, top, z], 3)); g.add(new T.LineSegments(lg, lm));
    const l = label(text, { size: 52, height: 2.5, color: '#f6e7c4', weight: 600 }); l.center.set(.5, 0); l.position.set(x, top + .35, z); l.material.userData.base = 1; mats.push(l.material); g.add(l);
    const d = glow(lin(1.8, 1.3, .7), 1.3, .9); d.position.set(x, top, z); d.material.userData.base = .9; mats.push(d.material); g.add(d);
  }
  function buildShuangxi(g, K, pts, mats) {
    const mg = Merger();
    const grass = K.reg(new T.MeshStandardMaterial({ color: 0x27342b, roughness: 1 }));
    const hillM = K.reg(new T.MeshStandardMaterial({ color: 0x1f3428, roughness: 1 }));
    mg.put(grass, landGeo(SX_OUT));
    const HILLS = [[-26, -24, 17, 19], [-5, -33, 21, 25], [17, -29, 17, 21], [33, -12, 12, 15], [-37, -5, 11, 12], [35, 16, 8, 8], [-36, 19, 8, 7], [5, -44, 18, 28]];
    HILLS.forEach(([x, z, r, h], i) => { hill(mg, hillM, x, z, r, h, i * 1.7); sample(pts, x, 1, z, r * 1.3, h * .7, r * 1.3, 110); });
    // 樹：山上一顆一顆的樹冠
    const trees = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), K.reg(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })), 520);
    const m4 = new T.Matrix4(), col = new T.Color(); let ti = 0;
    HILLS.forEach(([hx, hz, r, h], i) => { for (let k = 0; k < 65 && ti < 520; k++) { const a = rnd() * Math.PI * 2, u = Math.sqrt(rnd()) * .92, x = hx + Math.cos(a) * r * u, z = hz + Math.sin(a) * r * u, y = .6 + h * Math.sqrt(Math.max(0, 1 - u * u)) * .98;
      const sc = .9 + rnd() * 1.1; m4.makeScale(sc, sc * 1.2, sc).setPosition(x, y, z); trees.setMatrixAt(ti, m4); trees.setColorAt(ti, col.setHSL(.3 + rnd() * .08, .32, .1 + rnd() * .08)); ti++; } });
    trees.count = ti; g.add(trees);
    // 兩條溪：平林溪、牡丹溪，匯流成雙溪
    const bank = K.reg(new T.MeshStandardMaterial({ color: 0x5f625d, roughness: .9 }));
    const rivers = [[[-34, -30], [-24, -14], [-10, -3], [1, 3]], [[30, -31], [22, -14], [11, -3], [1, 3]], [[1, 3], [9, 12], [19, 20.5], [27, 27.5]]];
    rivers.forEach((r, i) => { mg.put(bank, ribbon(r, i === 2 ? 9.5 : 7, 1.415)); mg.put(K.water, ribbon(r, i === 2 ? 7.5 : 5.2, 1.43)); });
    // 老街：一條只容一輛車的巷子，石砌、紅磚的矮厝
    const lane = K.reg(new T.MeshStandardMaterial({ color: 0x3a3a36, roughness: .6, metalness: .1 }));
    mg.block(lane, 30, .04, 3, -18, 1.4, 12);
    const oldFac = [0, 1, 2, 0, 1].map(k => { const t = oldShopTex(k % 3); return K.reg(new T.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: lin(1.4, 1, .6), emissiveIntensity: 1, roughness: .9 })); });
    [-1, 1].forEach(side => { let x = -33;
      while (x < -4) { const w = 3.4 + rnd() * 1.2, d = 6.5, z = 12 + side * (1.5 + d / 2), ry = side < 0 ? 0 : Math.PI, P = rot(x + w / 2, z, ry);
        const tall = rnd() < .25;
        if (tall) townhouse(mg, K, pts, x + w / 2, z, w, d, 3, ry, { addon: true });
        else { const fac = oldFac[Math.floor(rnd() * oldFac.length)];
          mg.block(K.wall, w, 6, d, x + w / 2, 1.4, z, ry);
          const [fx, fz] = P(0, d / 2 + .02); mg.put(fac, UNIT.plane, fx, 4.4, fz, 0, ry, 0, w - .05, 6, 1);
          if (rnd() < .6) mg.prism(rnd() < .5 ? K.tile : K.redTile, w + .2, d + .8, 1.8, x + w / 2, 7.4, z, ry);
          else { const [qx, qz] = P(0, d / 2 - .1); mg.box(K.wall, w, .7, .2, qx, 7.75, qz, ry); }
          sample(pts, x + w / 2, 1.4, z, w, 7, d, 26); }
        x += w + .05; } });
    // 三忠廟在老街頭
    const [tx, tz] = temple(mg, K, pts, -38.5, 12, 6, 6, Math.PI / 2, false);
    // 長老教會
    gableHouse(mg, K, pts, -16, 27, 7, 4.6, 4, 2.2, 0, K.wallW, K.tile);
    mg.block(K.wallW, 1.6, 9, 1.6, -20.5, 1.4, 27); mg.put(K.tile, UNIT.cyl6, -20.5, 11.8, 27, 0, 0, 0, 1.2, 3, 1.2);
    mg.box(K.wallW, .12, 1.4, .12, -20.5, 14, 27); mg.box(K.wallW, .7, .12, .12, -20.5, 14.2, 27);
    // 宜蘭線：山腳的鐵道、雙溪車站、兩頭進隧道
    const trackPts = [[-30, -9], [-18, -12], [-4, -15], [10, -15], [22, -10]];
    const ballast = K.reg(new T.MeshStandardMaterial({ color: 0x3b3a37, roughness: 1 }));
    const tg = ribbon(trackPts, 3.2, 1.75); mg.put(ballast, tg); mg.put(K.pipe, ribbon(trackPts, 1.6, 1.8));
    mg.block(K.concrete, 13, .9, 2.4, -4, 1.4, -12.6); gableHouse(mg, K, pts, -4, -9.6, 7, 3.4, 3, 1.6, 0, K.wallW, K.tile);
    const portalM = K.reg(new T.MeshStandardMaterial({ color: 0x4d4f4c, roughness: .9 }));
    const holeM = K.reg(new T.MeshBasicMaterial({ color: 0x050607 }));
    [0, 1].forEach(u => { const p = tg.userData.curve.getPointAt(u), q = tg.userData.curve.getTangentAt(u), ry = Math.atan2(-q.x, -q.z);
      mg.block(portalM, 5, 5, 1.2, p.x, 1.4, p.z, ry); mg.block(holeM, 3, 3.6, 1.3, p.x, 1.4, p.z, ry); });
    // 橋與往外的路
    const road = K.reg(new T.MeshStandardMaterial({ color: 0x2c2f30, roughness: .7 }));
    const roadPts = [[-4, 12], [6, 8], [14, 3], [24, 1.2], [33, 2]];
    mg.put(road, ribbon(roadPts, 3.4, 1.44));
    { const P = rot(5.5, 8.2, .38); mg.block(K.concrete, 11, .5, 4.2, 5.5, 1.42, 8.2, .38);
      [-1, 1].forEach(sd => { for (let k = -5.2; k <= 5.21; k += .7) { const [px, pz] = P(k, sd * 1.95); mg.block(K.wallW, .2, .72, .2, px, 1.92, pz, .38); }      // 水泥欄杆（手冊照片裡那座橋）
        const [bx, bz] = P(0, sd * 1.95); mg.box(K.wallW, 11, .16, .3, bx, 2.7, bz, .38); mg.box(K.wallW, 11, .12, .26, bx, 2, bz, .38);
        [-5.5, 5.5].forEach(e => { const [qx, qz] = P(e, sd * 1.95); mg.block(K.wallW, .45, 1.1, .45, qx, 1.92, qz, .38); }); }); }
    // 河邊一層一層往後退的老公寓，陽台對著溪；旁邊一棟包紅鐵皮的
    { const X = 24, Z = 10.5, ry = -.69, P = rot(X, Z, ry), W = 10;
      [[0, 3, 9], [3, 2, 6], [5, 1, 3.4]].forEach(([f0, nf, d]) => { const [cx, cz] = P(0, -4.5 + d / 2), y0 = 1.4 + f0 * 3;
        mg.block(K.wall, W, nf * 3, d, cx, y0, cz, ry);
        const [fx, fz] = P(0, -4.5 + d + .02); mg.put(K.facW[(f0 + 2) % 6], UNIT.plane, fx, y0 + nf * 1.5, fz, 0, ry, 0, W - .1, nf * 3, 1, [1, nf / 4]);
        for (let f = 0; f < nf; f++) { const [sx, sz] = P(0, -4.5 + d + .55); mg.box(K.concrete, W, .16, 1.1, sx, y0 + f * 3 + 3, sz, ry); const [rx, rz] = P(0, -4.5 + d + 1.05); mg.box(K.wallW, W, .8, .1, rx, y0 + f * 3 + 3.48, rz, ry); }
        sample(pts, cx, y0, cz, W, nf * 3, d, Math.round(W * nf * 2.4)); });
      const [ox, oz] = P(W / 2 + 4, -1); const redTin = K.reg(new T.MeshStandardMaterial({ map: tinTex('#8a2a20', '#b0463a'), roughness: .5, metalness: .3 }));
      mg.block(K.wall, 7, 6, 8, ox, 1.4, oz, ry); mg.block(redTin, 7.2, 3.4, 8.2, ox, 7.4, oz, ry, [2, 1]); mg.prism(K.tinGrey, 7.6, 8.8, 1.2, ox, 10.8, oz, ry);
      sample(pts, ox, 1.4, oz, 7, 10, 8, 120); }
    // 新一點的透天，散在車站與路邊
    [[2, -4, .3], [8, -6, .2], [26, -3, -.4], [-30, 26, .1], [-2, 24, 0], [5, 24, 0], [-33, 3, Math.PI / 2]].forEach(([x, z, ry]) => townhouse(mg, K, pts, x, z, 4.4, 8, 3, ry));
    // 老街上伸出來的直式招牌（中藥行、理髮廳、金紙香燭⋯）與一串紅燈籠
    { const atlas = makeSignAtlas(), sm = K.reg(new T.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: lin(.6, .55, .5), emissiveIntensity: 1, roughness: .7, side: T.DoubleSide }));
      [-31, -27.4, -23, -19.6, -15, -11.2, -7.4].forEach((x, i) => { const sd = i % 2 ? 1 : -1; mg.put(sm, UNIT.plane, x, 5.6, 12 + sd * 1.15, 0, Math.PI / 2, 0, .9, 2.6, 1, signUV([0, 7, 1, 6, 5, 3, 9][i])); mg.box(K.pipe, .06, 2.7, .06, x, 5.6, 12 + sd * 1.5); });
      for (let x = -33; x < -5; x += 1.6) mg.put(K.lantern, UNIT.ico, x, 6.9 - Math.sin((x + 33) / 28 * Math.PI * 4) * .12, 12, 0, 0, 0, .34, .44, .34); }
    // 溪邊的水田：一格一格映著天光，田埂隔開
    { const paddy = K.reg(new T.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#16272c'; c.fillRect(0, 0, w, h); for (let y = 3; y < h; y += 7) for (let x = 3; x < w; x += 7) { c.fillStyle = `rgba(120,170,90,${.35 + Math.random() * .3})`; c.fillRect(x, y, 2, 2); } }), roughness: .08, metalness: .7 }));
      [[10, 31, 8, 5, .15], [-6, 32.5, 9, 4.6, 0], [-6, 27.6, 9, 4, 0]].forEach(([x, z, w, d, ry]) => { mg.block(paddy, w, .05, d, x, 1.4, z, ry); const P = rot(x, z, ry);
        [[0, d / 2], [0, -d / 2]].forEach(([lx, lz]) => { const [a, b] = P(lx, lz); mg.block(grass, w + .3, .22, .3, a, 1.4, b, ry); }); [[w / 2, 0], [-w / 2, 0]].forEach(([lx, lz]) => { const [a, b] = P(lx, lz); mg.block(grass, .3, .22, d, a, 1.4, b, ry); }); }); }
    { const cm = [0xd9dcd8, 0x8a1e1e, 0x2d3a48].map(c => K.reg(new T.MeshStandardMaterial({ color: c, roughness: .35, metalness: .45 }))); car(mg, cm, 29, -.6, Math.PI / 2 + .05); car(mg, cm, -20, 8.6, Math.PI / 2, 1.4); car(mg, cm, -8, -12.4, Math.PI / 2); }
    // ===== 走讀時看到的 =====
    // 東和戲院：雙溪最老的戲院，只剩一面牆和放映的洞
    { const thTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#8e877a'; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 260; k++) { c.fillStyle = `rgba(${40 + Math.random() * 30},${40 + Math.random() * 30},30,${Math.random() * .25})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 2 + Math.random() * 30); }
        c.fillStyle = 'rgba(150,40,30,.55)'; c.font = '900 52px "Noto Serif TC"'; c.textAlign = 'center'; c.fillText('東 和 戲 院', w / 2, 70);
        c.fillStyle = '#0b0c0d'; c.fillRect(w / 2 - 16, 112, 32, 24); c.fillRect(w / 2 - 56, 116, 18, 14); c.fillStyle = 'rgba(30,50,25,.8)'; for (let k = 0; k < 40; k++) c.fillRect(Math.random() * w, h - Math.random() * 40, 3, 40); });
      const thM = K.reg(new T.MeshStandardMaterial({ map: thTex, emissiveMap: thTex, emissive: lin(.25, .23, .2), emissiveIntensity: 1, roughness: .95 }));
      mg.block(K.wall, 7.5, 8.4, .6, -23.6, 1.4, 21.5); mg.put(thM, UNIT.plane, -23.6, 5.6, 21.18, 0, Math.PI, 0, 7.5, 8.4, 1);
      [-1, 1].forEach(e => mg.block(K.wall, .5, 2.6 + (e > 0 ? 1.2 : 0), 4, -23.6 + e * 3.5, 1.4, 23.5));
      for (let k = 0; k < 10; k++) mg.put(grass, UNIT.ico, -23.6 + (rnd() - .5) * 6, 1.6, 23.6 + (rnd() - .5) * 3, 0, rnd() * 3, 0, .6 + rnd() * .5, .4 + rnd() * .5, .6 + rnd() * .5);
      sample(pts, -23.6, 1.4, 22.5, 7.5, 8.4, 3, 90); }
    // 打鐵舖：碳爐還燒著，門口掛著刀
    { mg.block(K.brick, 1.1, 1, 1, -6.8, 1.4, 11.1); mg.cyl(K.pipe, .18, 3, -6.8, 2.4, 10.9);
      for (let k = 0; k < 6; k++) mg.box(K.wallW, .12, .9 + (k % 3) * .25, .04, -8.6 + k * .32, 3.4, 10.62);
      mg.box(K.pipe, 2.4, .08, .08, -7.8, 4, 10.62); }
    // 林益和堂中藥行：一百多年的洋樓
    { // 照 Koza 拍的照片：紅磚與白磚相間的柱子、湖綠色的木窗、彎彎的小陽台、白底黑字的「林益和藥房」
      const ylTex = canvasTex(256, 480, (c, w, h) => { c.fillStyle = '#e7e2d4'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h * .78; y += 16) { const red = Math.floor(y / 16) % 2 === 0; [[0, 34], [w - 34, 34], [w / 2 - 14, 28]].forEach(([x, cw]) => { c.fillStyle = red ? '#a8463a' : '#ece8de'; c.fillRect(x, y, cw, 15); c.fillStyle = 'rgba(60,40,30,.25)'; c.fillRect(x, y + 15, cw, 1); }); }
        c.fillStyle = '#5e5a52'; c.fillRect(0, 0, w, 18); c.fillRect(0, 196, w, 10);
        [[44, 40], [140, 40], [44, 230], [140, 230]].forEach(([x, y]) => { c.fillStyle = '#e9e6dc'; c.fillRect(x - 4, y - 4, 80, 128); c.fillStyle = '#1f9a92'; c.fillRect(x, y, 72, 120); c.fillStyle = '#0f2f30';
          for (let i = 1; i < 3; i++) c.fillRect(x + i * 24 - 2, y, 4, 120); for (let j = 1; j < 4; j++) c.fillRect(x, y + j * 30 - 2, 72, 4); c.fillStyle = 'rgba(255,220,150,.35)'; c.fillRect(x + 4, y + 4, 18, 22); });
        c.fillStyle = '#c9c4b6'; c.beginPath(); c.ellipse(w / 2, 200, 64, 14, 0, 0, Math.PI); c.fill();
        [[56, 360], [150, 360]].forEach(([x, y]) => { c.fillStyle = '#6f8f6a'; c.fillRect(x, y - 2, 52, 30); for (let k = 0; k < 14; k++) { c.fillStyle = ['#d9a441', '#b8342a', '#3d6c9a', '#e6dccb'][k % 4]; c.fillRect(x + 4 + Math.random() * 42, y + 2 + Math.random() * 22, 5, 5); } });
        c.fillStyle = '#f4f2ea'; c.fillRect(6, h - 92, w - 12, 72); c.strokeStyle = '#5e5a52'; c.lineWidth = 3; c.strokeRect(6, h - 92, w - 12, 72);
        c.fillStyle = '#141414'; c.font = '900 44px "Noto Serif TC"'; c.textAlign = 'center'; c.fillText('林 益 和 藥 房', w / 2, h - 40); c.fillStyle = '#b8342a'; c.font = '700 13px "Noto Serif TC"'; c.fillText('丙申年蒲月', w - 30, h - 74); });
      const ylM = K.reg(new T.MeshStandardMaterial({ map: ylTex, emissiveMap: ylTex, emissive: lin(.55, .45, .3), emissiveIntensity: 1, roughness: .85 }));
      mg.put(ylM, UNIT.plane, -14, 5.6, 13.38, 0, Math.PI, 0, 4.4, 8.4, 1); mg.box(K.wallW, 4.6, .5, .5, -14, 9.9, 13.5); mg.put(K.wallW, UNIT.cyl6, -14, 10.15, 13.5, Math.PI / 2, 0, 0, 2, .4, 2);
      mg.box(K.wallW, 2.2, .22, .75, -14, 6.15, 13.0); mg.box(K.wallW, 2.2, .7, .1, -14, 6.6, 12.65); mg.box(K.wallW, .1, .7, .75, -15.1, 6.6, 13.0); mg.box(K.wallW, .1, .7, .75, -12.9, 6.6, 13.0);   // 彎彎的小陽台
      mg.box(K.wallW, 4.6, .35, .9, -14, 2.9, 13.0); }
    // 碾米廠：以前皮帶從早上七點轉到晚上十點
    gableHouse(mg, K, pts, 19.5, 28.5, 6.4, 4.4, 3.8, 1.8, .2, K.wall, K.tinGrey); mg.cyl(K.brick, .55, 9, 22.4, 1.4, 30.4); mg.cyl(K.pipe, .62, .3, 22.4, 10.4, 30.4);
    // 荷花田：六到八月開
    { const padM = K.reg(new T.MeshStandardMaterial({ color: 0x3e6b3a, roughness: .7 })), lotM = K.reg(new T.MeshStandardMaterial({ color: 0xe8a0b4, emissive: lin(.4, .15, .2), roughness: .6 }));
      for (let k = 0; k < 46; k++) { const x = -6 + (rnd() - .5) * 8, z = 32.5 + (rnd() - .5) * 4; mg.put(padM, UNIT.cyl6, x, 1.52 + rnd() * .3, z, 0, rnd() * 3, 0, .5 + rnd() * .3, .04, .5 + rnd() * .3); if (k % 4 === 0) mg.put(lotM, UNIT.ico, x, 2.1 + rnd() * .3, z, 0, 0, 0, .28, .34, .28); } }
    // 礦坑口：雙溪曾經產全台最好的焦煤
    { mg.block(K.concrete, 1, 4.2, 4.2, -31.2, 1.4, -2.4, Math.PI / 2); mg.block(holeM, 1.1, 3, 2.6, -31, 1.4, -2.4, Math.PI / 2);
      mg.box(K.concrete, 1.2, .6, 5, -31.2, 5.8, -2.4); const coalM = K.reg(new T.MeshStandardMaterial({ color: 0x141414, roughness: .6, metalness: .3 }));
      for (let k = 0; k < 7; k++) mg.put(coalM, UNIT.ico, -26.5 + (rnd() - .5) * 2.4, 1.6, .2 + (rnd() - .5) * 2.4, 0, rnd() * 3, 0, 1 + rnd(), .5 + rnd() * .6, 1 + rnd());
      mg.put(K.pipe, ribbon([[-30.6, -2.4], [-28, -1.6], [-25, -3.4]], .9, 1.45), 0, 0, 0); mg.box(K.tinRust, 1.4, .8, 1, -28.4, 1.95, -1.7, .2); }
    mg.build(g);
    [['三忠廟', -38.5, 12, 12.5], ['東和戲院', -23.6, 21.5, 13.5], ['打鐵舖', -6.8, 11, 8], ['林益和堂', -14, 13.4, 14], ['雙溪車站', -4, -9.6, 9],
     ['碾米廠', 19.5, 28.5, 13], ['荷花田', -6, 32.5, 6], ['礦坑口', -30, -2.4, 10], ['平林溪', -23, -13, 5], ['牡丹溪', 21, -13, 5]].forEach(([t, x, z, h]) => pin(g, mats, t, x, z, h));
    { const fire = glow(lin(3, 1.1, .3), 3.2, 1); fire.position.set(-6.8, 2.6, 11.4); g.add(fire); mats.push(Object.assign(fire.material, { userData: { base: 1 } })); }
    // 燈：月台、廟的燈籠、街燈
    const lights = [[-9, 4, -12.4], [-4, 4, -12.4], [1, 4, -12.4], [-36, 5.4, 10.5], [-36, 5.4, 13.5], [-24, 4.5, 12], [-12, 4.5, 12]];
    lights.forEach(([x, y, z], i) => { const gl = glow(i > 2 && i < 5 ? lin(1.6, .3, .15) : lin(1.2, .8, .4), i > 2 && i < 5 ? 3 : 4, .9); gl.position.set(x, y, z); g.add(gl); mats.push(Object.assign(gl.material, { userData: { base: .9 } })); });
    // 火車：白底藍線的區間車
    const trainG = new T.Group(); g.add(trainG);
    const carTex = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#e8ebec'; x.fillRect(0, 0, w, h); x.fillStyle = '#2f5d9a'; x.fillRect(0, 40, w, 8); x.fillStyle = '#e6c04a'; x.fillRect(0, 48, w, 3); for (let k = 0; k < 7; k++) { x.fillStyle = '#ffe3b0'; x.fillRect(12 + k * 34, 12, 26, 20); } });
    const carM = K.reg(new T.MeshStandardMaterial({ map: carTex, emissiveMap: carTex, emissive: lin(.5, .45, .35), emissiveIntensity: 1, roughness: .4 }));
    const cars = [0, 1, 2].map(() => { const c = new T.Mesh(B(5.4, 1.8, 1.6), carM); trainG.add(c); return c; });
    const head = glow(lin(3, 3, 2.6), 3); trainG.add(head); mats.push(Object.assign(head.material, { userData: { base: 1 } }));
    const tc = tg.userData.curve;
    // 搬家的卡車
    const truck = new T.Group(); g.add(truck);
    const truckM = K.reg(new T.MeshStandardMaterial({ color: 0xdfe3e4, roughness: .5 })), cabM = K.reg(new T.MeshStandardMaterial({ color: 0x2f6aa8, roughness: .4 }));
    const tb = new T.Mesh(B(4, 2.2, 2), truckM); tb.position.set(-.6, 1.5, 0); truck.add(tb); const tcab = new T.Mesh(B(1.4, 1.6, 1.9), cabM); tcab.position.set(2.2, 1.2, 0); truck.add(tcab);
    const hl = glow(lin(2.5, 2.4, 2), 2.4); hl.position.set(3.1, 1, 0); truck.add(hl); mats.push(Object.assign(hl.material, { userData: { base: 1 } }));
    const rc = ribbon(roadPts, 1, 1.44).userData.curve;
    // 細雨
    // 一條條往下落的雨絲，落到地上濺一點光；雙溪一年有一百八十天在下雨
    const RN = 900, rp = new Float32Array(RN * 6), rs = new Float32Array(RN * 2), re = new Float32Array(RN * 2);
    for (let i = 0; i < RN; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 48, x = Math.cos(a) * r, z = Math.sin(a) * r, sd = rnd();
      rp.set([x, 0, z, x, 0, z], i * 6); rs.set([sd, sd], i * 2); re.set([0, 1], i * 2); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3)); rg.setAttribute('aSeed', new T.BufferAttribute(rs, 1)); rg.setAttribute('aEnd', new T.BufferAttribute(re, 1));
    const rm = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: `attribute float aSeed, aEnd; uniform float uT; varying float vE, vH;
        void main(){ float H = 44.; float y = mod(aSeed * H * 7.3 - uT * (6.5 + aSeed * 3.), H);   // 細雨落得慢
          vec3 p = position + vec3(-.18 * aEnd, y - aEnd * (.7 + aSeed * .5), 0.); vE = aEnd; vH = y / H;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: 'uniform float uA; varying float vE, vH; void main(){ float a = (1. - vE * .8) * smoothstep(0., .08, vH) * uA; gl_FragColor = vec4(vec3(.5, .58, .7) * a * .2, 1.); }' });
    rm.userData.base = 1; rm.opacity = 1; mats.push(rm);
    const rain = new T.LineSegments(rg, rm); rain.frustumCulled = false; g.add(rain);
    // 山腰的霧
    HILLS.slice(0, 5).forEach(([x, z, r, h]) => { const m = glow(lin(.5, .55, .6), r * 1.5, .07); m.material.blending = T.NormalBlending; m.position.set(x, h * .7, z - r * .1); g.add(m); mats.push(Object.assign(m.material, { userData: { base: .07 } })); });
    g.userData.anim = (t, dt) => {
      rm.uniforms.uT.value = t; rm.uniforms.uA.value = rm.opacity * (reduce ? .5 : 1);
      const u = (t % 46) / 30;                    // 30 秒過一班，之後隧道裡等一下
      trainG.visible = u < 1;
      if (u < 1) cars.forEach((c, k) => { const raw = 1.1 - u * 1.2 + k * .105, uu = Math.min(.999, Math.max(0, raw)), p = tc.getPointAt(uu), q = tc.getTangentAt(uu); c.position.set(p.x, 2.75, p.z); c.rotation.y = Math.atan2(-q.z, q.x); c.visible = raw > .03 && raw < .97; });
      if (u < 1) { const raw = 1.1 - u * 1.2, uu = Math.min(.999, Math.max(0, raw)), p = tc.getPointAt(uu), q = tc.getTangentAt(uu); head.position.set(p.x - q.x * 2.9, 2.5, p.z - q.z * 2.9); head.visible = cars[0].visible; }
      const tu = (t % 24) / 24, p = rc.getPointAt(Math.min(.999, tu)), q = rc.getTangentAt(Math.min(.999, tu));
      truck.position.set(p.x, 1.45, p.z); truck.rotation.y = Math.atan2(-q.z, q.x); truck.visible = tu < .97;
      const a = rg.attributes.position.array; for (let i = 0; i < RN; i++) { let y = a[i * 6 + 1] - dt * 26; if (y < 1.4) y += 40; a[i * 6 + 1] = y; a[i * 6 + 4] = y - 1.3; } rg.attributes.position.needsUpdate = true;
    };
  }

  /* ---------- 航空城：竹圍、海口、沙崙，每一區留著自己的記號 ----------
     參照報導者、我們的島與浪青手冊的照片：竹圍街的騎樓透天門窗封上木板、噴著拆遷編號（A7、A8、56），
     廟埕堆滿搬家留下的家具，福海宮關上大門、神明搬去鐵皮紅壇；海口的福元宮已經搬空，
     土地公廟一間間封上廟門；沙崙有油庫，埤塘多半被填平。巷口立著石敢當。 */
  const CODES = ['A7', 'A8', '56', 'B12', 'A15', 'C3', '拆', 'D9'];
  const codeTex = () => canvasTex(1024, 128, (x, w, h) => {
    CODES.forEach((s, i) => { const ox = i * 128;
      x.fillStyle = '#a0835c'; x.fillRect(ox, 0, 128, h); for (let k = 0; k < 8; k++) { x.strokeStyle = `rgba(90,60,30,${Math.random() * .4})`; x.beginPath(); x.moveTo(ox, Math.random() * h); x.lineTo(ox + 128, Math.random() * h); x.stroke(); }
      x.fillStyle = 'rgba(40,25,10,.5)'; x.fillRect(ox + 63, 0, 2, h);
      x.save(); x.translate(ox + 64, 64); x.rotate((Math.random() - .5) * .2); x.fillStyle = 'rgba(20,20,22,.85)'; x.font = `700 ${s.length > 2 ? 40 : 54}px "Noto Sans TC"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 0, 0); x.restore();
      if (i % 3 === 0) { x.strokeStyle = 'rgba(180,40,30,.8)'; x.lineWidth = 5; x.beginPath(); x.moveTo(ox + 20, 20); x.lineTo(ox + 108, 108); x.moveTo(ox + 108, 20); x.lineTo(ox + 20, 108); x.stroke(); }
    });
  });
  const stoneTex = () => canvasTex(64, 160, (x, w, h) => { x.fillStyle = '#8b8d86'; x.fillRect(0, 0, w, h); dirt(x, w, h, 40, '40,40,35', .3, [1, 4], [1, 8]);
    x.fillStyle = '#9b2a20'; x.font = '900 34px "Noto Serif TC"'; x.textAlign = 'center'; ['石', '敢', '當'].forEach((c, i) => x.fillText(c, w / 2, 46 + i * 40)); });

  function buildHangkong(g, K, pts, mats) {
    const mg = Merger();
    const ground = K.reg(new T.MeshStandardMaterial({ color: 0x2b3329, roughness: 1 }));
    mg.put(ground, landGeo(HK_OUT));
    const fieldTex = canvasTex(1024, 768, (x, w, h) => { x.fillStyle = '#26301f'; x.fillRect(0, 0, w, h);
      for (let yy = 0; yy < h; yy += 48 + Math.floor(Math.random() * 30)) for (let xx = 0; xx < w; xx += 70 + Math.floor(Math.random() * 60)) { const k = Math.random();
        x.fillStyle = k < .35 ? `hsl(${95 + Math.random() * 20},32%,${27 + Math.random() * 9}%)` : k < .6 ? `hsl(35,24%,${27 + Math.random() * 7}%)` : k < .8 ? `hsl(200,20%,${30 + Math.random() * 8}%)` : '#4a4a3c'; x.fillRect(xx + 2, yy + 2, 70, 48);
        if (k < .35) { x.fillStyle = 'rgba(0,0,0,.12)'; for (let r = 0; r < 70; r += 5) x.fillRect(xx + r, yy, 1, 48); } }
      x.strokeStyle = 'rgba(160,150,120,.25)'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(0, Math.random() * h); x.lineTo(w, Math.random() * h); x.stroke(); } });
    const fieldM = K.reg(new T.MeshStandardMaterial({ map: fieldTex, roughness: .9 }));
    mg.put(fieldM, UNIT.plane, 0, 1.415, 0, -Math.PI / 2, 0, 0, 80, 56, 1);
    const road = K.reg(new T.MeshStandardMaterial({ color: 0x2c2f30, roughness: .7 }));
    const paintY = K.reg(new T.MeshBasicMaterial({ color: lin(.8, .55, .12) })), paintW = K.reg(new T.MeshBasicMaterial({ color: lin(.7, .7, .68) }));
    const codeTx = codeTex(); const codeM = K.reg(new T.MeshStandardMaterial({ map: codeTx, emissiveMap: codeTx, emissive: lin(.55, .42, .3), emissiveIntensity: 1, roughness: .85 }));
    const shopM = K.reg(new T.MeshStandardMaterial({ color: 0xf0e2c0, emissive: lin(1.5, 1.2, .8), emissiveIntensity: 1, roughness: .6 }));
    const storeM = K.reg(new T.MeshStandardMaterial({ color: 0xeef4f2, emissive: lin(1.8, 1.9, 1.9), emissiveIntensity: 1, roughness: .5 }));
    const stTx = stoneTex(); const stoneM = K.reg(new T.MeshStandardMaterial({ map: stTx, emissiveMap: stTx, emissive: lin(.5, .45, .4), emissiveIntensity: 1, roughness: .9 }));
    const dirtM = K.reg(new T.MeshStandardMaterial({ color: 0x5a4a36, roughness: 1 }));
    const furn = [0x6b4a2e, 0x8a8f8c, 0x2e3a48, 0xb9b2a0, 0x7a2a22, 0x3c3c3a].map(c => K.reg(new T.MeshStandardMaterial({ color: c, roughness: .8 })));
    const rubbleM = [K.concrete, K.wall, K.brick, K.tinRust];

    // 跑道與進場燈（第三跑道預定地就在聚落後面）
    const rwTex = canvasTex(1024, 64, (x, w, h) => { x.fillStyle = '#26292b'; x.fillRect(0, 0, w, h); x.fillStyle = '#d9dcdc'; x.fillRect(0, 3, w, 2); x.fillRect(0, h - 5, w, 2); for (let k = 40; k < w - 80; k += 40) x.fillRect(k, h / 2 - 1, 20, 2); for (let k = 0; k < 10; k++) { x.fillRect(w - 50, 8 + k * 5, 36, 3); x.fillRect(14, 8 + k * 5, 36, 3); } });
    mg.put(K.reg(new T.MeshStandardMaterial({ map: rwTex, roughness: .6 })), UNIT.plane, 0, 1.43, -23, -Math.PI / 2, 0, 0, 96, 6, 1);
    // 台 15 線：改道之後就是機場的新邊界
    mg.block(road, 82, .04, 4.6, 0, 1.42, -12.5);
    for (let x = -40; x < 40; x += 3) mg.block(paintY, 1.6, .05, .14, x, 1.42, -12.5);
    // 徵收線：紅色虛線
    const redM = K.reg(new T.MeshBasicMaterial({ color: lin(3, .25, .18), toneMapped: false }));
    for (let x = -41; x < 41; x += 2.4) mg.box(redM, 1.4, .1, .22, x, 1.5, -16.5);

    // 騎樓透天：一樓縮進去，門窗封木板、噴編號
    function arcadeHouse(x, z, w, d, floors, ry, state) {
      const P = rot(x, z, ry), G = 1.4, GF = 3.2, H = (floors - 1) * 3;
      let [px, pz] = P(0, -1); mg.block(K.wall, w, GF, d - 2, px, G, pz, ry);
      [px, pz] = P(0, 0); mg.block(K.wall, w, H, d, px, G + GF, pz, ry);
      [-1, 1].forEach(e => { const [cx, cz] = P(e * (w / 2 - .22), d / 2 - .22); mg.block(K.wallW, .42, GF, .42, cx, G, cz, ry); });
      [px, pz] = P(0, d / 2 - 2 + .03);
      if (state === 'lit') mg.put(shopM, UNIT.plane, px, G + GF / 2, pz, 0, ry, 0, w - .5, GF - .3, 1);
      else mg.put(codeM, UNIT.plane, px, G + GF / 2, pz, 0, ry, 0, w - .5, GF - .3, 1, [1 / 8, 1, Math.floor(rnd() * 8) / 8, 0]);
      [px, pz] = P(0, d / 2 + .02);
      const fac = state === 'lit' ? K.facW[Math.floor(rnd() * 6)] : K.facBoard[Math.floor(rnd() * 3)];
      mg.put(fac, UNIT.plane, px, G + GF + H / 2, pz, 0, ry, 0, w - .05, H, 1, [1, (floors - 1) / 4]);
      facadeBits(mg, K, P, w, d, G + GF, floors - 1, ry);
      if (state === 'lit' || rnd() < .18) {           // 還住著人的：門口撐兩把陽傘、排一列瓦斯桶
        [-1, 1].forEach(e => { const [ux, uz] = P(e * w * .26, d / 2 + 1.5); mg.cyl(K.pipe, .04, 2.3, ux, G, uz);
          mg.put(K.cloth[e < 0 ? 0 : 1], UNIT.cyl, ux, G + 2.3, uz, 0, 0, 0, 2.4, .45, 2.4); mg.put(K.cloth[e < 0 ? 3 : 2], UNIT.cyl6, ux, G + 2.6, uz, 0, 0, 0, 1.2, .25, 1.2); });
        for (let k = 0; k < 4; k++) { const [gx, gz] = P(-w * .4 + k * .42, d / 2 - 1.6); mg.cyl(K.tank, .19, .95, gx, G, gz, true); } }
      const top = G + GF + H; [px, pz] = P(0, d / 2 - .1); mg.box(K.wall, w, .8, .2, px, top + .4, pz, ry);
      if (rnd() < .5) { const ad = d * .5; [px, pz] = P(0, -d / 2 + ad / 2); mg.block(rnd() < .5 ? K.tinBlue : K.tinRust, w - .3, 2.3, ad, px, top, pz, ry); }
      if (rnd() < .7) { [px, pz] = P(w * .22, -d * .3); mg.cyl(K.tank, .55, 1.3, px, top, pz); }
      sample(pts, x, G, z, w, GF + H + 2, d, Math.round(w * (GF + H) * .8));
    }
    function furniturePile(cx, cz, n = 10) { for (let k = 0; k < n; k++) mg.box(furn[Math.floor(rnd() * furn.length)], .5 + rnd() * 1.4, .3 + rnd() * .9, .5 + rnd() * .9, cx + (rnd() - .5) * 3, 1.6 + rnd() * .5, cz + (rnd() - .5) * 2, rnd() * 3, (rnd() - .5) * .4, (rnd() - .5) * .4); }
    function shrine(cx, cz, ry, sealed = true) {          // 田邊的土地公廟
      const P = rot(cx, cz, ry);
      mg.block(K.concrete, 2.4, .3, 2.4, cx, 1.4, cz, ry); mg.block(K.templeRed, 1.5, 1.5, 1.3, cx, 1.7, cz, ry); mg.prism(K.tile, 2, 1.8, .8, cx, 3.2, cz, ry);
      const [dx, dz] = P(0, .67); mg.put(sealed ? codeM : K.lantern, UNIT.plane, dx, 2.35, dz, 0, ry, 0, .8, 1, 1, sealed ? [1 / 8, 1, 6 / 8, 0] : undefined);
      sample(pts, cx, 1.4, cz, 2, 3, 2, 20);
    }
    function stone(cx, cz, ry) { mg.block(K.concrete, 1.3, .35, .8, cx, 1.4, cz, ry); mg.put(stoneM, UNIT.box, cx, 2.85, cz, 0, ry, 0, .85, 2.3, .36); stones.push([cx, cz]); }
    const stones = [];
    const holeM2 = K.reg(new T.MeshBasicMaterial({ color: 0x07090a }));

    // ===== 竹圍：竹圍街兩排騎樓透天、福海宮、廟埕、最後亮著的超商 =====
    const SZ = 16.5;
    mg.block(road, 44, .04, 3.4, -18, 1.42, SZ); for (let x = -38; x < 3; x += 2.6) mg.block(paintW, 1.2, .05, .1, x, 1.42, SZ);
    [-21.9, -3.1].forEach(x => mg.block(road, 2.4, .04, 26, x, 1.42, 2.4));            // 往台 15 線的巷子
    const zRow = { '-1': SZ - 6.4, '1': SZ + 6.4 };
    [-1, 1].forEach(side => { for (let i = 0; i < 9; i++) {
      const x = -36 + i * 4.7, z = zRow[side], ry = side < 0 ? 0 : Math.PI;
      if (Math.abs(x + 21.9) < 1 || Math.abs(x + 3.1) < 1) continue;               // 巷口
      if (side < 0 && x > -20 && x < -7) continue;                                 // 福海宮的位置
      if (side > 0 && i === 8) { arcadeHouse(x, z, 4.5, 9, 3, ry, 'lit');         // 街上只剩超商亮燈
        const [sx, sz] = rot(x, z, ry)(0, 2.55); mg.put(storeM, UNIT.plane, sx, 3, sz, 0, ry, 0, 4, 2.9, 1); continue; }
      if (rnd() < .22) {                                                          // 已經拆掉的：地基、瓦礫、殘牆
        mg.block(K.concrete, 4.4, .25, 9, x, 1.4, z, ry);
        for (let k = 0; k < 9; k++) mg.box(rubbleM[k % 4], .4 + rnd(), .3 + rnd() * .5, .4 + rnd(), x + (rnd() - .5) * 3.6, 1.8, z + (rnd() - .5) * 6, rnd() * 3, rnd(), rnd());
        if (rnd() < .6) mg.block(K.wall, .3, 3 + rnd() * 3, 6, x + 2, 1.4, z, ry);
        sample(pts, x, 1.4, z, 4, 2, 8, 20); continue;
      }
      arcadeHouse(x, z, 4.5, 9, 3 + (rnd() < .45 ? 1 : 0), ry, rnd() < .12 ? 'lit' : 'boarded');
    } });
    // 福海宮：關上大門，廟頂的福祿壽，廟埕堆著家具
    temple(mg, K, pts, -14, SZ - 9.5, 8.5, 6.5, 0, true);
    mg.block(K.concrete, 11, .06, 4.6, -14, 1.41, SZ - 4.2);
    [-1.6, 0, 1.6].forEach((dx, k) => { const c = [0xd8a530, 0xb8342a, 0x3d6a4a][k]; const m = K.reg(new T.MeshStandardMaterial({ color: c, roughness: .6 }));
      mg.cyl(m, .32, 1.1, -14 + dx, 1.9 + 4.6 + 3.3, SZ - 9.5); mg.put(K.wallW, UNIT.ico, -14 + dx, 1.9 + 4.6 + 4.7, SZ - 9.5, 0, 0, 0, .55, .55, .55); });
    furniturePile(-11, SZ - 3.6, 14); furniturePile(-17.5, SZ - 3.4, 8);
    stone(-21.9, SZ + 2.6, Math.PI); stone(-3.1, SZ + 2.6, Math.PI);                    // 巷口對著街的石敢當
    // 竹圍漁港：防波堤與漁船
    const hullM = K.reg(new T.MeshStandardMaterial({ color: 0x2f5f7a, roughness: .6 })), cabinM = K.reg(new T.MeshStandardMaterial({ color: 0xe8e6de, roughness: .6 }));
    mg.block(K.concrete, 3, 1.6, 22, -45, -.2, 16); mg.block(K.concrete, 10, 1.6, 2.6, -40.5, -.2, 28.5);
    [[-48.5, 12], [-48.6, 19], [-48.3, 25]].forEach(([bx, bz], k) => { mg.box(hullM, 2, .9, 6, bx, .25, bz); mg.box(cabinM, 1.6, 1.2, 1.8, bx, 1.2, bz - 1); mg.box(K.pipe, .08, 3, .08, bx, 2.2, bz + 1.2); });
    // 臨時紅壇：鋼構外覆鐵皮，神明暫住的地方
    const redTin = K.reg(new T.MeshStandardMaterial({ map: tinTex('#8a2a20', '#b8463a'), roughness: .5, metalness: .3, emissive: 0x2a0806 }));
    mg.block(redTin, 6, 3.4, 4, -37.5, 1.4, -5); mg.prism(redTin, 6.4, 4.6, 1.1, -37.5, 4.8, -5); mg.put(K.lantern, UNIT.plane, -37.5, 2.9, -2.98, 0, 0, 0, 2.6, 2, 1);

    // ===== 海口：搬空的福元宮、封起來的土地公廟、安置街廓 =====
    temple(mg, K, null, 30, 21, 6.5, 5.5, 0, false);
    mg.put(codeM, UNIT.plane, 30, 3.4, 23.8, 0, 0, 0, 2.6, 2.6, 1, [1 / 8, 1, 6 / 8, 0]);
    sample(pts, 30, 1.4, 21, 7, 7, 6, 50);
    shrine(16, 25, 0); furniturePile(16, 21.5, 10);
    mg.block(road, 2.4, .04, 22, 22, 1.42, 4);
    [[16.5, 12.5, Math.PI / 2], [16.5, 7.9, Math.PI / 2], [27.5, 12.5, -Math.PI / 2], [27.5, 7.9, -Math.PI / 2]].forEach(([x, z, ry]) => arcadeHouse(x, z, 4.4, 8, 2 + (rnd() < .5 ? 1 : 0), ry, 'boarded'));
    stone(22, 15.4, Math.PI);
    // 安置街廓：自己回建的骨架與買賣土地的看板
    for (let i = 0; i < 4; i++) { const x = 14 + (i % 2) * 7, z = -1 + Math.floor(i / 2) * -6, fl = 1 + Math.floor(rnd() * 3);
      for (let f = 0; f < fl; f++) { mg.block(K.concrete, 5.6, .3, 4.6, x, 1.4 + f * 3, z); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => mg.block(K.concrete, .35, 3, .35, x + a * 2.5, 1.7 + f * 3, z + b * 2)); }
      sample(pts, x, 1.4, z, 5.6, fl * 3, 4.6, 20); }
    const saleTex = canvasTex(160, 96, (c, w, h) => { c.fillStyle = '#e8c547'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8342a'; c.font = '900 34px "Noto Serif TC"'; c.textAlign = 'center'; c.fillText('土地買賣', w / 2, 44); c.font = '700 20px "Noto Sans TC"'; c.fillStyle = '#222'; c.fillText('0930-xxx-xxx', w / 2, 78); });
    const saleM = K.reg(new T.MeshStandardMaterial({ map: saleTex, roughness: .7, side: T.DoubleSide }));
    [[11, 2.6], [24.5, 4.5], [33, 3]].forEach(([x, z]) => { mg.block(K.pipe, .1, 2.6, .1, x - 1, 1.4, z); mg.block(K.pipe, .1, 2.6, .1, x + 1, 1.4, z); mg.put(saleM, UNIT.plane, x, 4.2, z, 0, 0, 0, 2.6, 1.6, 1); });

    // ===== 沙崙：油庫、填平的埤塘、盟德居古厝、田邊的土地公廟 =====
    const tankW = K.reg(new T.MeshStandardMaterial({ color: 0xd9dcd8, roughness: .5, metalness: .3 }));
    [[31, -6, 3.6], [38.5, -6, 2.6]].forEach(([x, z, r]) => { mg.cyl(tankW, r, 4.2, x, 1.4, z); mg.cyl(K.pipe, r * .3, .3, x, 5.6, z); });
    mg.block(K.concrete, 17, .8, .3, 33.5, 1.4, -1.6); mg.block(K.concrete, 17, .8, .3, 33.5, 1.4, -10.4); mg.block(K.concrete, .3, .8, 9, 25, 1.4, -6); mg.block(K.concrete, .3, .8, 9, 42, 1.4, -6);
    const pondMat = K.reg(new T.MeshStandardMaterial({ color: 0x14262c, roughness: .04, metalness: .9 }));
    const bankM = K.reg(new T.MeshStandardMaterial({ color: 0x35402e, roughness: 1 }));
    const pond = (cx, cz, r, filled) => { const p = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (1 + Math.sin(a * 3 + cx) * .12); p.push([cx + Math.cos(a) * rr * 1.2, cz + Math.sin(a) * rr]); }
      mg.put(bankM, flatGeo(p.map(([x, z]) => [cx + (x - cx) * 1.15, cz + (z - cz) * 1.15]), 1.43)); mg.put(filled ? dirtM : pondMat, flatGeo(p, filled ? 1.6 : 1.45));
      if (filled) for (let k = 0; k < 6; k++) mg.put(dirtM, UNIT.ico, cx + (rnd() - .5) * r * 1.6, 1.7, cz + (rnd() - .5) * r, 0, rnd() * 3, 0, 1.5 + rnd() * 2, .8 + rnd(), 1.5 + rnd() * 2); };
    pond(-28, -7, 4, false); pond(5, -5.5, 4.6, false);
    for (let k = 0; k < 5; k++) mg.put(dirtM, UNIT.ico, 8.5 + (rnd() - .5) * 3, 1.6, -5.5 + (rnd() - .5) * 6, 0, rnd() * 3, 0, 1.5 + rnd() * 1.5, .7 + rnd() * .8, 1.5 + rnd() * 1.5);   // 沙崙魚池：十二月要填平，邊上已經開始倒土
    // 挖土機在填埤塘
    const yel = K.reg(new T.MeshStandardMaterial({ color: 0xd8a32a, roughness: .5 }));
    mg.block(K.pipe, 2.6, .6, 3, 10, 1.4, -6); mg.block(yel, 2.2, 1.6, 2.2, 10, 2, -6, .4); mg.box(yel, .4, .4, 4.2, 9.2, 4, -4.4, .4, .7); mg.box(yel, .35, .35, 2.6, 8.4, 3.5, -2.8, .4, -.8);
    // 盟德居：九十多年的紅磚古厝與前埕
    mg.block(K.concrete, 13, .06, 8, -12, 1.4, -1.4);
    gableHouse(mg, K, pts, -12, -7.8, 13, 4.4, 3.4, 1.9, 0, K.brick, K.redTile);
    [-1, 1].forEach(sd => gableHouse(mg, K, pts, -12 + sd * 6.2, -1.6, 8, 3.6, 3, 1.6, Math.PI / 2, K.brick, K.redTile));
    [-3, 0, 3].forEach(dx => mg.box(K.lamp, 1, .9, .05, -12 + dx, 3, -5.55));
    shrine(-39, -12, Math.PI / 2); shrine(1.5, 2.5, 0); shrine(40, 3.5, -Math.PI / 2, false); shrine(-31, 1.5, 0);
    for (let x = -36; x < 4; x += 8) { mg.block(K.pipe, .12, 5, .12, x, 1.4, SZ + 1.9); mg.box(K.pipe, .9, .1, .1, x, 6.35, SZ + 1.5, Math.PI / 2); }
    // ===== 跑道後面：桃園機場的機坪、航廈、塔台 =====
    const apron = K.reg(new T.MeshStandardMaterial({ color: 0x3a3f41, roughness: .8 }));
    mg.put(apron, landGeo([[-44, -28], [44, -28], [44, -52], [-44, -52]]));
    for (let x = -36; x <= 36; x += 12) mg.block(paintY, .14, .05, 10, x, 1.42, -36);
    const termGlass = K.reg(new T.MeshStandardMaterial({ map: rep(canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#1b2a36'; c.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 8) { c.fillStyle = `rgba(255,${200 + Math.random() * 40},150,${.5 + Math.random() * .5})`; c.fillRect(k + 1, 8, 6, h - 16); } }), 8, 1), emissive: lin(.9, .8, .6), emissiveIntensity: 1, roughness: .2, metalness: .6 }));
    termGlass.emissiveMap = termGlass.map;
    mg.block(K.wallW, 58, 1.2, 10, -6, 1.4, -45); mg.block(termGlass, 58, 5, 9.4, -6, 2.6, -45);
    mg.box(K.tinGrey, 61, .4, 12, -6, 8, -45, 0, -.06, 0, [6, 1]);                                  // 航廈長長的屋頂
    for (let k = 0; k < 4; k++) { const x = -26 + k * 13; mg.box(K.wallW, 1.6, 2, 6, x, 4.4, -37.5); mg.block(K.pipe, .4, 3.2, .4, x, 1.4, -35.4); }   // 空橋
    mg.cyl(K.wallW, 1, 22, 34, 1.4, -44); mg.cyl(termGlass, 2.6, 2.6, 34, 23.4, -44, true); mg.cyl(K.tinGrey, 3, .5, 34, 26, -44); mg.block(K.pipe, .1, 3, .1, 34, 26.5, -44);   // 塔台
    // 機場的雷達：紅白格子的球，立在跑道邊，從埤塘那頭就看得到
    { const chk = canvasTex(256, 128, (c, w, h) => { const n = 16, m = 8; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { c.fillStyle = (i + j) % 2 ? '#b8342a' : '#eeeee8'; c.fillRect(i * w / n, j * h / m, w / n + 1, h / m + 1); } c.fillStyle = '#eeeee8'; c.fillRect(0, 0, w, h * .45); });
      const radM = K.reg(new T.MeshStandardMaterial({ map: chk, emissiveMap: chk, emissive: lin(.25, .22, .2), emissiveIntensity: 1, roughness: .6 }));
      mg.block(K.concrete, 3.4, .4, 3.4, -30, 1.4, -33.5); mg.cyl(radM, 1.25, 4.2, -30, 1.8, -33.5, false);
      mg.put(radM, new T.SphereGeometry(1, 20, 14), -30, 7.4, -33.5, 0, 0, 0, 2.5, 2.5, 2.5); sample(pts, -30, 1.4, -33.5, 5, 9, 5, 60); }
    // ===== 高壓電塔：電線從田上跨過去 =====
    const steelM = K.reg(new T.MeshStandardMaterial({ color: 0x9aa1a3, roughness: .5, metalness: .6 }));
    const pyl = [pylon(mg, steelM, -40, 1, 19, Math.PI / 2), pylon(mg, steelM, 8, 2.6, 19, Math.PI / 2), pylon(mg, steelM, 40.5, 1, 19, Math.PI / 2)];
    // ===== 台 15 線邊的綠色圍籬，掛著抗議的白布條 =====
    const fenceM = K.reg(new T.MeshStandardMaterial({ map: fenceTex.clone(), roughness: .7 })); fenceM.map.repeat.set(8, 1);
    [[-30, 20], [-4, 18], [22, 22]].forEach(([x, l]) => mg.block(fenceM, l, 2.2, .1, x, 1.4, -15.2, 0, [l / 4, 1]));
    const protest = canvasTex(1024, 128, (c, w, h) => { ['反迫遷', '還我家園', '拒絕強拆', '土地正義'].forEach((t, i) => { const x0 = i * 256; c.fillStyle = '#efeee8'; c.fillRect(x0 + 4, 4, 248, 120);
      c.fillStyle = i % 2 ? '#b8342a' : '#141414'; c.font = '900 58px "Noto Sans TC"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x0 + 128, 66); dirt(c, w, h, 10, '60,50,40', .25, [2, 8], [4, 30]); }); });
    const protM = K.reg(new T.MeshStandardMaterial({ map: protest, emissiveMap: protest, emissive: lin(.45, .45, .42), emissiveIntensity: 1, roughness: .9, side: T.DoubleSide }));
    [[-34, 0], [-22, 1], [-8, 2], [2, 3], [18, 0], [28, 1]].forEach(([x, i]) => mg.put(protM, UNIT.plane, x, 2.6, -15.08, 0, 0, (rnd() - .5) * .05, 5, 1.2, 1, [1 / 4, 1, i / 4, 0]));
    [[-27, 4.4, 1], [-9, 4.4, 2]].forEach(([x, y, i]) => mg.put(protM, UNIT.plane, x, y, SZ - 1.45, 0, 0, 0, 3.6, .9, 1, [1 / 4, 1, i / 4, 0]));   // 竹圍街騎樓上的布條
    // 台 15 線上的車
    const carM = [0xd9dcd8, 0x2d3a48, 0x8a1e1e, 0x5c6d72, 0x1d2a22].map(c => K.reg(new T.MeshStandardMaterial({ color: c, roughness: .35, metalness: .45 })));
    [[-33, -11.4, -Math.PI / 2], [-12, -13.6, Math.PI / 2], [9, -11.4, -Math.PI / 2], [30, -13.6, Math.PI / 2], [-20, SZ, Math.PI / 2]].forEach(([x, z, r]) => car(mg, carM, x, z, r));
    // ===== 走讀時看到的 =====
    // 海口埤：舊河道築堤蓄水。端午那天，大家回來划照古法重造的龍船
    pond(37, 15.5, 3, false);
    { const dragonM = K.reg(new T.MeshStandardMaterial({ color: 0xb8342a, roughness: .5, emissive: 0x2a0604 })), goldM = K.reg(new T.MeshStandardMaterial({ color: 0xd8a530, roughness: .4, metalness: .4 }));
      const P = rot(37, 15.5, .35); mg.box(dragonM, .9, .45, 5.6, 37, 1.62, 15.5, .35); const [hx, hz] = P(0, 3.1); mg.box(goldM, .5, .9, .7, hx, 2.05, hz, .35);
      const [tx2, tz2] = P(0, -3); mg.box(goldM, .2, .8, .4, tx2, 2, tz2, .35, -.4);
      for (let k = -2; k <= 2; k++) { const [px, pz] = P(0, k * .9); mg.box(K.wallW, .3, .55, .3, px, 2.1, pz, .35); [-1, 1].forEach(e => { const [ox, oz] = P(e * .7, k * .9); mg.box(K.wood || K.pipe, .06, .06, 1.1, ox, 1.75, oz, .35 + Math.PI / 2, 0, e * .6); }); }
      sample(pts, 37, 1.5, 15.5, 1, 1, 5.6, 20); }
    // 石敢當立在埤塘堤岸、容易潰堤的角落，像信仰上的堤防
    stone(33.2, 18.4, 2.4); stone(40.6, 12.2, -.9); stone(-23, -3.2, 2.6); stone(9.6, -.6, 3.1);
    // 空軍機堡：基地九成要拆，只留幾個
    { const shelter = new T.CylinderGeometry(3.2, 3.2, 7.5, 16, 1, true, -Math.PI / 2, Math.PI);
      const shM = K.reg(new T.MeshStandardMaterial({ color: 0x6c716a, roughness: .9, side: T.DoubleSide }));
      [[-40, -35], [40.5, -34]].forEach(([x, z]) => { mg.put(shM, shelter, x, 1.4, z, -Math.PI / 2, 0, 0); mg.put(holeM2, UNIT.plane, x, 2.9, z + 3.7, 0, 0, 0, 5.6, 2.9, 1); sample(pts, x, 1.4, z, 6.4, 3.2, 7.5, 40); }); }
    mg.build(g);
    [['福海宮', -14, SZ - 9.5, 15], ['石敢當', 22, 15.4, 7], ['紅壇', -37.5, -5, 10], ['福元宮', 30, 21, 12], ['海口埤・龍船', 37, 15.5, 5.5],
     ['沙崙魚池', 5, -5.5, 7], ['盟德居', -12, -7.8, 10], ['空軍機堡', -40, -35, 8], ['安置街廓', 17.5, -4, 12], ['竹圍漁港', -45, 18, 5]].forEach(([t, x, z, h]) => pin(g, mats, t, x, z, h));
    // 人走了、路封了之後，魚池邊最大的聲音是鳥叫
    const birds = new T.Group(); birds.position.set(5, 0, -5.5); g.add(birds);
    { const bm = K.reg(new T.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0x505050, roughness: .8, side: T.DoubleSide })), bg = new T.PlaneGeometry(.7, .22);
      for (let k = 0; k < 28; k++) { const b = new T.Mesh(bg, bm), a = rnd() * Math.PI * 2, r = 2 + rnd() * 7; b.position.set(Math.cos(a) * r, 3 + rnd() * 6, Math.sin(a) * r); b.rotation.set(-Math.PI / 2, 0, a); b.userData.ph = rnd() * 6; birds.add(b); } }
    stones.forEach(([x, z]) => { const s = glow(lin(1.6, 1.1, .6), 2.2, .7); s.position.set(x, 2.2, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .7 } })); });
    { const wl = []; for (let i = 0; i < pyl.length - 1; i++) pyl[i].forEach((a, k) => { const b = pyl[i + 1][k]; let p = a; for (let n = 1; n <= 16; n++) { const u = n / 16, q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(Math.PI * u) * 2.2, a[2] + (b[2] - a[2]) * u]; wl.push(...p, ...q); p = q; } });
      const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wl, 3)); g.add(new T.LineSegments(wg, K.reg(new T.LineBasicMaterial({ color: 0x8a9294 })))); }
    [[34, 23.4, -41.4], [-30, 7.6, -40.4], [10, 7.6, -40.4]].forEach(([x, y, z]) => { const s = glow(lin(1.3, 1.1, .8), 4, .8); s.position.set(x, y, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .8 } })); });
    [-40, 8, 40.5].forEach(x => { const s = glow(lin(3, .3, .2), 1.6, .9); s.position.set(x, 20.6, x === 8 ? 2.6 : 1); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .9 } })); });

    // 竹圍街的路燈
    for (let x = -36; x < 4; x += 8) { const s = glow(lin(1.5, 1.05, .6), 3.2, .9); s.position.set(x, 6.3, SZ + 1.4); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .9 } })); }
    // 區的名字：靠近才看得到
    [['竹圍', -18, 14, 27], ['海口', 26, 14, 27], ['沙崙', 14, 14, -6]].forEach(([t, x, y, z]) => { const l = label(t, { size: 56, height: 2.6, color: '#e9e4d6' }); l.position.set(x, y, z); g.add(l); l.material.userData.base = .85; l.material.opacity = .85; mats.push(l.material); });
    // 進場燈：一排往跑道跑的閃光
    const appr = []; for (let k = 0; k < 14; k++) { const s = glow(lin(3, 3, 3.3), 2.2, 0); s.position.set(50 + k * 3.2, 1.2, -23); g.add(s); appr.push(s); mats.push(Object.assign(s.material, { userData: { base: 1 } })); }
    for (let k = -46; k <= 46; k += 6) [-26, -20].forEach(z => { const s = glow(lin(1.6, 1.4, .8), 1.2, .8); s.position.set(k, 1.6, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .8 } })); });
    [[-12, 3.5, -5.2], [-14, 3.4, SZ - 5.6], [-37.5, 3, -2.6], [1.6, 3, SZ + 3.6]].forEach(([x, y, z]) => { const s = glow(lin(1.4, .7, .3), 1.6, .8); s.position.set(x, y, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .8 } })); });
    // 飛機：從海上壓低進場，掠過屋頂，落在跑道上
    const pm = K.reg(new T.MeshStandardMaterial({ color: 0xdfe4ea, roughness: .35, metalness: .3 })), tailM = K.reg(new T.MeshStandardMaterial({ color: 0x2c4f86, roughness: .4 }));
    const plane = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(.85, .6, 16, 16), pm); body.rotation.z = Math.PI / 2; plane.add(body);
    const nose = new T.Mesh(new T.SphereGeometry(.85, 14, 10), pm); nose.position.x = 8; nose.scale.x = 2; plane.add(nose);
    const wingGeo = new T.BoxGeometry(3, .18, 9); [-1, 1].forEach(sd => { const w = new T.Mesh(wingGeo, pm); w.position.set(.3, -.3, sd * 4.6); w.rotation.y = sd * .45; plane.add(w);
      const eng = new T.Mesh(new T.CylinderGeometry(.45, .45, 1.8, 12), pm); eng.rotation.z = Math.PI / 2; eng.position.set(1.4, -.8, sd * 3.2); plane.add(eng); });
    const tail = new T.Mesh(B(2.4, 3.2, .18), tailM); tail.position.set(-7, 1.7, 0); tail.rotation.z = .35; plane.add(tail);
    const stab = new T.Mesh(B(1.4, .12, 6), pm); stab.position.set(-7, .3, 0); plane.add(stab);
    [[-26, -33.5], [-13, -33.5], [0, -33.5], [13, -33.5]].forEach(([x, z], k) => { if (k === 2) return; const pk = plane.clone(); pk.position.set(x, 3.1, z); pk.rotation.y = Math.PI / 2; pk.scale.setScalar(.9); g.add(pk); });
    const land1 = glow(lin(4, 3.8, 3.4), 7), nav1 = glow(lin(3, .2, .2), 2.2), nav2 = glow(lin(.2, 3, .4), 2.2), strobe = glow(lin(4, 4, 4.5), 4);
    land1.position.set(9.5, -.6, 0); nav1.position.set(.3, -.3, -9); nav2.position.set(.3, -.3, 9); strobe.position.set(-.5, .9, 0); plane.add(land1, nav1, nav2, strobe);
    [land1, nav1, nav2, strobe].forEach(s => mats.push(Object.assign(s.material, { userData: { base: 1 } })));
    g.add(plane);
    g.userData.anim = t => {
      const T0 = 34, u = (t % T0) / T0;
      // 0–.55 進場下降，.55–.8 落地滑行，之後消失
      let x, y;
      if (u < .55) { const k = u / .55; x = 190 - k * 160; y = 1.8 + Math.pow(1 - k, 1.2) * 48; }
      else { const k = Math.min(1, (u - .55) / .25); x = 30 - (1 - Math.pow(1 - k, 2)) * 62; y = 1.8; }
      plane.position.set(x, y + 1.1, -23); plane.rotation.set(0, Math.PI, u < .55 ? -.05 : 0);
      plane.visible = u < .82; strobe.visible = (t * 1.1) % 1 < .07;
      const ph = (t * 1.6) % 1; appr.forEach((s, k) => { const on = Math.abs(ph - (1 - k / appr.length)) < .07; s.scale.setScalar(on ? 5 : 1.4); });
      birds.rotation.y = t * .12; birds.children.forEach(b => { b.position.y += Math.sin(t * 2 + b.userData.ph) * .004; b.scale.x = .7 + Math.abs(Math.sin(t * 6 + b.userData.ph)) * .5; });
    };
  }

  /* ---------- 社子島：堤防圍起的沙洲，鐵皮工廠、儲油槽、油桶、墊高的透天、菜園 ---------- */
  function buildShezi(g, K, pts, mats) {
    const mg = Merger();
    const inner = offsetIn(SHEZI_OUT, 1.6);
    const ground = K.reg(new T.MeshStandardMaterial({ color: 0x2b302b, roughness: 1 }));
    mg.put(ground, landGeo(inner));
    const leveeTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#7a8285'; c.fillRect(0, 0, w, h); for (let k = 0; k < w; k += 32) { c.fillStyle = '#5f676a'; c.fillRect(k, 0, 2, h); } c.fillStyle = '#9aa2a4'; c.fillRect(0, 0, w, 5);
      for (let k = 0; k < 120; k++) { c.fillStyle = `rgba(30,40,35,${Math.random() * .35})`; c.fillRect(Math.random() * w, h * .45 + Math.random() * h * .55, 1 + Math.random() * 3, 3 + Math.random() * 14); } });
    leveeTex.wrapS = leveeTex.wrapT = T.RepeatWrapping; leveeTex.repeat.set(.12, .14);
    mg.put(K.reg(new T.MeshStandardMaterial({ map: leveeTex, emissiveMap: leveeTex, emissive: lin(.12, .13, .14), emissiveIntensity: 1, roughness: .9 })), landGeo(SHEZI_OUT, 5.2, 6.4, [inner.slice().reverse()]));
    // 堤外的泥灘與蘆葦
    const mud = K.reg(new T.MeshStandardMaterial({ color: 0x2f2c25, roughness: .35, metalness: .2 }));
    const MUD = scaleOut(SHEZI_OUT, 1.2); mg.put(mud, flatGeo(MUD, .3, [SHEZI_OUT.slice().reverse()]));
    const reeds = new T.InstancedMesh(new T.ConeGeometry(.12, 1.6, 4), K.reg(new T.MeshStandardMaterial({ color: 0x8a8a5a, roughness: 1 })), 380);
    const m4 = new T.Matrix4(); for (let i = 0; i < 380; i++) { const k = Math.floor(rnd() * SHEZI_OUT.length), [x, z] = SHEZI_OUT[k], u = 1.03 + rnd() * .15; m4.makeRotationZ((rnd() - .5) * .3).setPosition(x * u, 1, z * u); reeds.setMatrixAt(i, m4); } g.add(reeds);
    // 主要道路沿著島的長軸
    const road = K.reg(new T.MeshStandardMaterial({ color: 0x2c2f30, roughness: .7 }));
    mg.put(road, ribbon([[-46, 0], [-20, -1], [0, 0], [20, 1], [36, 0]], 3.2, 1.43));
    // 墊高地基的透天厝
    [-1, 1].forEach(side => { for (let x = -24; x < 27; x += 4.6) { if (x > -8 && x < 6) continue; const ry = side < 0 ? 0 : Math.PI;
      townhouse(mg, K, pts, x, side * 5.6, 4.4, 7, rnd() < .3 ? 2 : 3, ry, { raise: .9 }); } });
    // 鐵皮工廠
    const tins = [K.tinBlue, K.tinGrey, K.tinRust];
    const litDoor = K.reg(new T.MeshStandardMaterial({ map: shopLitTex, emissiveMap: shopLitTex, emissive: lin(1.2, 1.25, 1.3), emissiveIntensity: 1 }));
    const sheds = [[-34, -11, 10, 7], [-22, -13, 11, 6], [-8, -13, 9, 7], [5, -12, 10, 6], [16, -11.5, 6, 3.5], [-36, 11, 9, 7], [-24, 13, 10, 6], [-3, 6.5, 6, 6], [8, 13, 11, 5]];
    sheds.forEach(([x, z, l, s]) => { const h = 3.6 + rnd() * 1.6, wm = tins[Math.floor(rnd() * 3)], rm = tins[Math.floor(rnd() * 3)];
      mg.block(wm, l, h, s, x, 1.4, z, 0, [l / 3, 1]); mg.prism(rm, l + .6, s + .8, 1.4 + rnd() * .6, x, 1.4 + h, z);
      if (rnd() < .5) mg.put(litDoor, UNIT.plane, x + (rnd() - .5) * l * .4, 1.4 + 1.5, z + (z < 0 ? s / 2 + .02 : -s / 2 - .02), 0, z < 0 ? 0 : Math.PI, 0, 3, 3, 1);
      sample(pts, x, 1.4, z, l, h + 1.5, s, Math.round(l * h * .5)); });
    // 生鏽的儲油槽
    const rustTank = K.reg(new T.MeshStandardMaterial({ map: rep(corrugated('#6a4a36', '#8a6448'), 3, 1), roughness: .7, metalness: .4 }));
    [[-4, -6, 2.2, 5.2], [.5, -6.5, 1.7, 4.4], [-1.5, -10.5, 1.5, 3.6]].forEach(([x, z, r, h]) => { mg.cyl(rustTank, r, h, x, 1.4, z); mg.cyl(K.pipe, r * 1.02, .2, x, 1.4 + h, z); sample(pts, x, 1.4, z, r * 2, h, r * 2, 40); });
    // 菜園（浮汕）
    const vegTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#2d2a20'; c.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 12) { c.fillStyle = `hsl(${95 + Math.random() * 25},40%,${22 + Math.random() * 10}%)`; c.fillRect(0, y, w, 7); } });
    const vegM = K.reg(new T.MeshStandardMaterial({ map: vegTex, roughness: 1 }));
    [[-42, -5, 7, 8], [-42, 6, 7, 7], [-33, 6.5, 6, 6]].forEach(([x, z, w, d]) => mg.put(vegM, UNIT.plane, x, 1.42, z, -Math.PI / 2, 0, 0, w, d, 1));
    // 坤天亭與廟埕
    temple(mg, K, pts, 31, 0, 8, 6, -Math.PI / 2, true);
    // 島頭公園的路燈
    const lampPos = [[38, -3], [41, 2], [44, -1], [35, 4]];
    lampPos.forEach(([x, z]) => mg.block(K.pipe, .12, 3.4, .12, x, 1.4, z));
    // 「吉地出售」看板
    const saleTex = canvasTex(160, 64, (c, w, h) => { c.fillStyle = '#e8c547'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8342a'; c.font = '900 40px "Noto Serif TC"'; c.textAlign = 'center'; c.fillText('吉地出售', w / 2, 46); });
    const saleM = K.reg(new T.MeshStandardMaterial({ map: saleTex, roughness: .7, side: T.DoubleSide }));
    [[-6, 2.6], [4, -2.6]].forEach(([x, z]) => { mg.block(K.pipe, .12, 3, .12, x, 1.4, z); mg.put(saleM, UNIT.plane, x, 4.6, z, 0, 0, 0, 3, 1.2, 1); });
    // 島上其實被鐵皮工廠和小工坊填滿（空拍照片裡一整片灰藍的屋頂）
    { const busy = [[-24, 27, -9.5, 9.5], [17.5, 26.5, -17, -8.5], [-34, 19, -14.5, -7.5], [-41, -30, 3, 14], [-41, -31, -9, -1], [-7, 3, -12.5, -4], [26, 36, -5, 5], [-30, -26, -7, -3], [-6, -2, 10, 14], [-16, -12, 11, 15]];
      const free = (x, z, l, d) => !busy.some(([x0, x1, z0, z1]) => x + l / 2 > x0 && x - l / 2 < x1 && z + d / 2 > z0 && z - d / 2 < z1);
      const inside = (x, z) => { let c = false; for (let i = 0, j = inner.length - 1; i < inner.length; j = i++) { const [xi, zi] = inner[i], [xj, zj] = inner[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
      for (let x = -44; x < 26; x += 5.2) for (const z of [-15.5, -11.5, 11.5, 15.5, 18]) {
        const l = 4 + rnd() * 1.6, d = 3.4 + rnd() * 1, xx = x + (rnd() - .5) * .8;
        if (!free(xx, z, l + .4, d + .4) || !inside(xx - l / 2 - 1, z + Math.sign(z) * (d / 2 + 1)) || !inside(xx + l / 2 + 1, z + Math.sign(z) * (d / 2 + 1))) continue;
        busy.push([xx - l / 2, xx + l / 2, z - d / 2, z + d / 2]);
        const h = 2.6 + rnd() * 1.8, r = rnd();
        if (r < .65) { mg.block(tins[Math.floor(rnd() * 3)], l, h, d, xx, 1.4, z, 0, [l / 3, 1]); mg.prism(tins[Math.floor(rnd() * 3)], l + .4, d + .5, .9, xx, 1.4 + h, z); }
        else { mg.block(K.wall, l, h + 1.6, d, xx, 1.4, z); mg.block(rnd() < .5 ? K.tinBlue : K.tinRust, l - .2, 2, d * .6, xx, 3 + h, z + (rnd() - .5)); }
        if (rnd() < .3) mg.put(litDoor, UNIT.plane, xx, 2.6, z + (z < 0 ? d / 2 + .02 : -d / 2 - .02), 0, z < 0 ? 0 : Math.PI, 0, Math.min(3, l - .6), 2.4, 1);
        sample(pts, xx, 1.4, z, l, h + 1, d, Math.round(l * h * .4)); } }
    // 社子大橋：從島的東邊跨過基隆河往北投
    { const deck = K.reg(new T.MeshStandardMaterial({ color: 0x8a9092, roughness: .7 }));
      mg.box(deck, 7, .9, 68, 22, 9.4, -46); for (let z = -20; z > -82; z -= 11) mg.block(deck, 1.6, 9, 1.6, 22, -1, z);
      [-1, 1].forEach(e => mg.box(K.wallW, .2, .9, 68, 22 + e * 3.4, 10.3, -46));
      mg.block(deck, 7, 8, 4, 22, 1.4, -11);
      for (let z = -16; z > -78; z -= 12) { const s = glow(lin(1.5, 1.1, .6), 2.4, .85); s.position.set(22 + 3.2, 12, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .85 } })); } }
    // 堤防上的布條：社子島自救會
    const banTex = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#3f9a3c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f2ea'; c.font = '900 60px "Noto Sans TC"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('社子島自救會', w / 2, h / 2 + 2); dirt(c, w, h, 30, '20,40,20', .3, [2, 8], [4, 30]); });
    const banM = K.reg(new T.MeshStandardMaterial({ map: banTex, emissiveMap: banTex, emissive: lin(.35, .4, .35), emissiveIntensity: 1, roughness: .9, side: T.DoubleSide }));
    [[-18, .02], [14, -.06]].forEach(([x, rz]) => { const zEdge = 26 * (.72 - .28 * Math.cos(Math.acos(Math.max(-1, Math.min(1, (x + 2) / 50))))) * Math.sin(Math.acos(Math.max(-1, Math.min(1, (x + 2) / 50)))); mg.put(banM, UNIT.plane, x, 4.1, zEdge + .5, 0, 0, rz, 9, 1.7, 1); });
    // 延平北路的路燈
    for (let x = -40; x < 26; x += 9) mg.block(K.pipe, .12, 4.4, .12, x, 1.4, 1.9);
    // 堤防上的水門：兩座水泥門柱，中間藍色的鐵閘門
    const lv = a => [50 * Math.cos(a) - 2, 26 * Math.sin(a) * (.72 - .28 * Math.cos(a))];
    const gateM = K.reg(new T.MeshStandardMaterial({ color: 0x2f5d8a, roughness: .5, metalness: .5 }));
    [.75, 2.55, 4.15, 5.35].forEach(a => { const [x, z] = lv(a), [x2, z2] = lv(a + .01), ry = Math.atan2(x2 - x, z2 - z) + Math.PI / 2, P = rot(x, z, ry);
      [-1, 1].forEach(e => { const [px, pz] = P(e * 2.6, 0); mg.block(K.concrete, 1.4, 7.4, 2.4, px, -.2, pz, ry); });
      mg.box(K.concrete, 6.6, .8, 2.6, x, 7.6, z, ry); mg.box(gateM, 3.8, 5.4, .4, x, 2.6, z, ry); mg.box(K.pipe, 3.6, .2, .2, x, 6.9, z, ry); sample(pts, x, 1, z, 6, 7, 2.4, 40); });
    // 堤外繫著的舢舨、竹筏
    const hullM = K.reg(new T.MeshStandardMaterial({ color: 0x3c5a6a, roughness: .7 })), skiffM = K.reg(new T.MeshStandardMaterial({ color: 0x8a6a48, roughness: .8 }));
    [[-30, 30, .2], [-22, 31, -.1], [36, -26, .3], [-38, -27, -.2]].forEach(([x, z, r], i) => { mg.box(i % 2 ? skiffM : hullM, 5, .7, 1.7, x, .7, z, r); if (i % 2 === 0) mg.box(K.wallW, 1.6, .9, 1.3, x - .6, 1.4, z, r); });
    // 島上的車：載貨的小貨車與機車
    { const cm = [0xd9dcd8, 0x2f6aa8, 0x8a1e1e, 0x5c6d72].map(c => K.reg(new T.MeshStandardMaterial({ color: c, roughness: .35, metalness: .45 })));
      [[-30, -1.1, Math.PI / 2], [-12, .9, -Math.PI / 2], [12, -.6, Math.PI / 2], [20, 1.6, -Math.PI / 2]].forEach(([x, z, r]) => car(mg, cm, x, z, r)); }
    // 遠方的觀音山與大屯山（只有靠近才看得到）
    const mtM = K.reg(new T.MeshStandardMaterial({ color: 0x141c22, roughness: 1 }));
    hill(mg, mtM, -240, -340, 130, 58, 3); hill(mg, mtM, 120, -430, 190, 70, 7); hill(mg, mtM, 330, -360, 110, 40, 9);
    mg.build(g);
    { const [gx, gz] = lv(.75), [bx, bz] = lv(1.65);
      [['坤天亭', 31, 0, 12], ['水門', gx, gz, 11], ['堤防', bx, bz, 9], ['鐵皮工廠', -22, -13, 9.5], ['浮汕菜園', -42, 0, 5], ['吉地出售', -6, 2.6, 8],
       ['墊高的透天', 15, 5.6, 13], ['社子大橋', 22, -30, 15], ['儲油槽', -1.5, -7.5, 9]].forEach(([t, x, z, h]) => pin(g, mats, t, x, z, h)); }
    // 油桶
    const drums = new T.InstancedMesh(new T.CylinderGeometry(.32, .32, .9, 10), K.reg(new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .3 })), 160);
    const col = new T.Color(), DC = [0xb8342a, 0x2f5d9a, 0xd8a530, 0x3c8d5a, 0xd9dcdc];
    for (let i = 0; i < 160; i++) { const c = [[-28, -5], [-4, 12], [-14, 13]][i % 3]; m4.makeTranslation(c[0] + (rnd() - .5) * 6, 1.85 + (rnd() < .15 ? .9 : 0), c[1] + (rnd() - .5) * 3); drums.setMatrixAt(i, m4); drums.setColorAt(i, col.set(DC[Math.floor(rnd() * 5)])); }
    g.add(drums);
    // 泥灘上的白鷺鷥
    const egret = new T.InstancedMesh(new T.ConeGeometry(.18, .7, 5), K.reg(new T.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0x404040, roughness: .8 })), 26);
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, [x, z] = [50 * Math.cos(a) - 2, 26 * Math.sin(a) * (.72 - .28 * Math.cos(a))], u = 1.08 + rnd() * .1; m4.makeRotationZ(.2).setPosition(x * u, .75, z * u); egret.setMatrixAt(i, m4); }
    g.add(egret);
    // 燈
    [...lampPos.map(([x, z]) => [x, 4.9, z, 0]), ...[-40, -31, -22, -13, -4, 5, 14, 23].map(x => [x, 5.9, 1.6, 0]), [27, 5, -3.5, 1], [27, 5, 3.5, 1]].forEach(([x, y, z, red]) => { const s = glow(red ? lin(1.6, .3, .15) : lin(1.2, .8, .4), red ? 2.2 : 2.4, .85); s.position.set(x, y, z); g.add(s); mats.push(Object.assign(s.material, { userData: { base: .85 } })); });
    // 潮水：漲起來時比堤內的地還高
    const tide = new T.Mesh(flatGeo(scaleOut(SHEZI_OUT, 1.42), 0, [SHEZI_OUT.slice().reverse()]), K.reg(new T.MeshStandardMaterial({ color: 0x1a2c35, roughness: .78, metalness: 0, opacity: .5 })));
    g.add(tide);
    const boat = new T.Mesh(B(5, 1, 1.8), K.reg(new T.MeshStandardMaterial({ color: 0x8a3b2c, roughness: .7 }))); g.add(boat);
    g.userData.anim = t => { const h = (Math.sin(t * .22) * .5 + .5); tide.position.y = .25 + h * 3.9; boat.position.set(18, tide.position.y + .3, 26); boat.rotation.z = Math.sin(t) * .05; };
  }

  function buildDaily(def) {
    const g = new T.Group(), mats = [], pts = [];
    const K = islandKit(mats);
    if (def.id === 'shuangxi') buildShuangxi(g, K, pts, mats);
    if (def.id === 'hangkong') buildHangkong(g, K, pts, mats);
    if (def.id === 'shezi') buildShezi(g, K, pts, mats);
    // 放大以後離月光遠，給沒有貼圖的牆、屋頂一點自己的亮度，夜裡也看得出形狀
    mats.forEach(m => { if (m.isMeshStandardMaterial && !m.map && !m.emissiveMap && m.emissive.getHex() === 0) m.emissive.copy(m.color).multiplyScalar(.26); });
    return { g, mats, pts };
  }

  function buildIsland(def, ii) {
    const site = S(def.id), root = new T.Group(); root.position.copy(def.pos); root.scale.setScalar(ISC); scene.add(root);
    const dir = def.pos.clone().negate().setY(0).normalize(); root.rotation.y = Math.atan2(dir.x, dir.z);   // 正面朝龍口
    const R = buildRender(def, ii), Dl = buildDaily(def, ii);
    root.add(R.g, Dl.g);
    // 散：水氣粒子
    const P = new Float32Array(Dl.pts), seeds = new Float32Array(Dl.pts.length);
    for (let k = 0; k < seeds.length; k++) seeds[k] = rnd();
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(P, 3)); pg.setAttribute('aSeed', new T.BufferAttribute(seeds, 3));
    const pm = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uS: { value: 0 }, uA: { value: 0 }, uT: { value: 0 }, uScale: { value: innerHeight * DPR * .5 } },
      vertexShader: `attribute vec3 aSeed; uniform float uS, uT, uScale; varying float vF;
        void main(){ vec3 p = position + vec3((aSeed.x - .5) * 50., aSeed.y * 46. + 2., (aSeed.z - .5) * 50.) * uS
          + vec3(sin(uT * .6 + aSeed.x * 20.), sin(uT * .4 + aSeed.y * 9.) * .5, cos(uT * .5 + aSeed.z * 20.)) * (1. + uS * 4.);
          vF = aSeed.y; vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = min((1.1 + uS * 2.2) * uScale / -mv.z, 9.); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform float uA; varying float vF; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(mix(vec3(1.,.75,.45), vec3(.75,.78,1.), vF) * a * uA * 1.6, 1.); }' });
    const cloud = new T.Points(pg, pm); root.add(cloud);
    // 每座樓臺前也有一塊冰，浮在水上
    const ice = makeIce(site, 2.6, 3.4, 2, false);
    ice.g.position.set(0, 1.4, { shezi: 33, hangkong: 40, shuangxi: 48 }[def.id]); root.add(ice.g);
    const iceMats = [ice.photo.material, ice.shell.material, ice.puddle.material]; iceMats.forEach(m => { m.userData.base = m.opacity; Dl.mats.push(m); });
    const name = label(site.name, { size: 96, height: 8, weight: 500 }); name.position.set(0, 34, 0); root.add(name);
    const hit = new T.Mesh(new T.SphereGeometry(52, 10, 8), new T.MeshBasicMaterial()); hit.visible = false; hit.position.y = 22; hit.userData.site = site.id; root.add(hit);
    R.mats.forEach(m => m.userData.base = m.opacity);
    // 上現蜃景：真的海市蜃樓常在遠方城鎮的正上方，浮出一個上下顛倒的影子，被熱空氣拉長又壓扁，一下出現一下不見
    const ghost = R.g.clone(), ghostMats = [];
    ghost.traverse(o => { if (!o.material) return; o.material = o.material.clone();
      if (o.material.color) o.material.color.multiply(lin(.62, .72, .95));
      o.material.userData.base = o.material.opacity * .5; ghostMats.push(o.material); });
    ghost.scale.y = -.7; root.add(ghost);
    const isl = { def, site, root, R, Dl, cloud, pm, name, hit, near: false, ghost, ghostMats, ghostTop: R.maxH + 1.4 };
    islands.push(isl); return isl;
  }
  const setOp = (list, k) => list.forEach(m => { m.opacity = m.userData.base * k; m.visible = k > .01; });

  /* ================= 觀眾的樓臺 ================= */
  const towers = [];
  function addTower(entry, idx, rise) {
    const g = new T.Group(), lm = lineMat(), fm = faceMat(); lm.color = lin(1.4, 1.2, .9);
    const a = -Math.PI / 2 + (idx % 2 ? 1 : -1) * (.22 + Math.floor(idx / 2) * .17), r = 95 + (idx % 3) * 18;
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    const lp = []; let y = .6; const levels = 2 + Math.min(4, Math.round(entry.w));
    for (let k = 0; k < levels; k++) {
      const w = 4.6 - k * .6, h = 2.8;
      const box = new T.Mesh(B(w, h, w), fm); box.position.y = y + h / 2; g.add(box);
      const e = new T.EdgesGeometry(B(w, h, w)).attributes.position.array;
      for (let q = 0; q < e.length; q += 3) lp.push(e[q], e[q + 1] + y + h / 2, e[q + 2]);
      const ew = w / 2 + .9, ey = y + h;                       // 屋簷
      lp.push(-ew, ey, -ew, ew, ey, -ew, ew, ey, -ew, ew, ey, ew, ew, ey, ew, -ew, ey, ew, -ew, ey, ew, -ew, ey, -ew,
        -ew, ey, -ew, -ew + .5, ey + .5, -ew + .5, ew, ey, ew, ew - .5, ey + .5, ew - .5);
      y += h + .2;
    }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); g.add(new T.LineSegments(lg, lm));
    const lb = label(entry.place, { font: 'LXGW WenKai TC', size: 60, height: 2.6, color: '#fff3e0' }); lb.position.y = y + 2.4; g.add(lb);
    lb.userData.sx = lb.scale.x; lb.userData.sy = lb.scale.y;
    // 成交時，地名先像水一樣從海面冒出來，一圈一圈的波紋往外散，樓臺才在它下面浮起
    const ripples = [0, 1, 2].map(() => { const m = new T.Mesh(new T.RingGeometry(1, 1.35, 64), new T.MeshBasicMaterial({ color: lin(1.1, 1.25, 1.5), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = .35; m.visible = false; g.add(m); return m; });
    const refl = glow(lin(.6, .45, .3), 10, .5); refl.position.y = .3; g.add(refl);
    g.userData = { entry, top: y, born: rise ? clock.elapsedTime : -99, mats: [lm, fm, lb.material], lb, ripples };
    g.children.forEach(c => { c.userData.tower = g; });
    scene.add(g); towers.push(g); return g;
  }

  /* ================= 相機 ================= */
  const cam = { target: new T.Vector3(0, 10, 0), theta: 0, phi: 1.54, radius: 170 };
  let fly = null;
  function applyCam() {
    const sp = Math.sin(cam.phi);
    camera.position.set(cam.target.x + cam.radius * sp * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * sp * Math.cos(cam.theta));
    if (camera.position.y < 2) camera.position.y = 2;
    camera.lookAt(cam.target);
  }
  function flyTo(goal, dur = 3, then) {
    let dth = goal.theta - cam.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    fly = { t: 0, dur: reduce ? .01 : dur, then, from: { target: cam.target.clone(), theta: cam.theta, phi: cam.phi, radius: cam.radius },
      to: { target: goal.target.clone(), theta: cam.theta + dth, phi: goal.phi, radius: goal.radius } };
  }
  function stepFly(dt) {
    if (!fly) return; fly.t += dt; const k = Math.min(1, fly.t / fly.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    cam.target.lerpVectors(fly.from.target, fly.to.target, e);
    cam.theta = fly.from.theta + (fly.to.theta - fly.from.theta) * e;
    cam.phi = fly.from.phi + (fly.to.phi - fly.from.phi) * e;
    cam.radius = fly.from.radius + (fly.to.radius - fly.from.radius) * e;
    if (k >= 1) { const th = fly.then; fly = null; if (th) th(); }
  }
  const V = (x, y, z, theta, phi, radius) => ({ target: new T.Vector3(x, y, z), theta, phi, radius });
  const VIEWS = {
    intro: V(0, 12, 0, 0, 1.54, 175),
    longkou: V(0, 12, -8, .62, 1.3, 92),
    overview: V(0, 0, -400, 0, .98, 900),
    stall: V(0, 3.9, 26, .06, 1.36, 19)
  };
  function islandView(id, radius = 100) {
    const d = ISL.find(x => x.id === id).pos, dir = d.clone().negate().setY(0).normalize();
    return V(d.x, 14 * ISC, d.z, Math.atan2(dir.x, dir.z), id === 'shezi' ? 1.12 : 1.3, radius * ISC);
  }

  // 拖曳、縮放、點選
  const pointers = new Map(); let dragged = false, pinch0 = 0, r0 = 0, userMoved = false;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); dragged = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); r0 = cam.radius; } });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) dragged = true;
    if (!started) return;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; cam.radius = Math.max(8, Math.min(1100, r0 * pinch0 / Math.hypot(a.x - b.x, a.y - b.y))); fly = null; userMoved = true; return; }
    if (!dragged) return; fly = null; userMoved = true;
    cam.theta -= dx * .004; cam.phi = Math.max(.35, Math.min(1.53, cam.phi - dy * .003));
  });
  const up = e => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (p && !dragged && pointers.size === 0) pick(e.clientX, e.clientY); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', e => pointers.delete(e.pointerId));
  el.addEventListener('wheel', e => { e.preventDefault(); if (!started) return; fly = null; userMoved = true; cam.radius = Math.max(8, Math.min(1100, cam.radius * (1 + e.deltaY * .001))); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') closePanel();
  });
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(cx, cy) {
    if (!started) return;
    ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const tm = towers.flatMap(g => g.children.filter(c => c.isMesh));
    const hits = ray.intersectObjects([...ices.map(i => i.shell), ...tm, ...islands.map(i => i.hit)], false);
    if (!hits.length) return;
    const o = hits[0].object;
    if (o.userData.tower) { const en = o.userData.tower.userData.entry; toast(`<b>${esc(en.place)}</b>${esc(en.words)}`); return; }
    if (o.userData.stall) { trade.last = null; chooseIce(o.userData.site); return; }
    if (o.userData.site) goSite(o.userData.site);
  }

  el.addEventListener('pointermove', e => {
    if (pointers.size || !started) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(ices.filter(i => i.stall).map(i => i.shell), false);
    el.style.cursor = h.length ? 'pointer' : '';
  });

  /* ================= 導覽 ================= */
  const CH = [
    { n: '序', t: '蜃氣', main: '海旁蜃氣象樓臺', sub: '《史記・天官書》。古人說，海上浮現的城郭與市井，是一種叫做蜃的生物吐出的氣。' },
    { n: '一', t: '龍口', main: '龍口，龍的嘴', sub: '蜃的樣子說法不一，有人說是大蛤，有人說是蛟龍。從汀州路一段149巷口走進龍口市場，巷子又低又暗，彎來彎去，盡頭有一點光，蜃氣就從那裡慢慢吐出來。' },
    { n: '二', t: '樓臺', main: '氣在海上浮成三座樓臺', sub: '雙溪、航空城、社子島。遠遠看，它們像規劃圖裡的樣子，乾淨、明亮、沒有人。上方有時還浮出一個倒過來的影子，真的海市蜃樓就是這樣。' },
    { n: '三', t: '靠近', main: '靠近一點，才看見有人在這裡生活', sub: '堤防、鐵皮工廠、頂樓的水塔、亮著的窗。再往前，它就散了。海市看得見，卻到不了。' },
    { n: '四', t: '交換', main: '回到市場，做一筆買賣', sub: '攤上四塊冰，照片慢慢化掉。這攤不收錢，挑一塊冰，用一個你離開過的地方來換。秤夠重了，就帶走一袋融水。' }
  ];
  const chList = $('chList');
  CH.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<span>${c.n}</span>${c.t}`; b.addEventListener('click', () => go(i)); chList.append(b); });
  let chapter = -1, started = false, free = false;
  const target = { fog: .02, clear: 0, rate: 0, reveal: 0, breath: 0, haze: 1 };
  const state = { fog: .02, clear: 0, rate: .05, reveal: 0, breath: 0, haze: 1 };
  function caption(i) {
    const c = CH[i], cap = $('caption');
    cap.classList.remove('on');
    setTimeout(() => { $('capN').textContent = `${c.n}　${c.t}`; $('capMain').textContent = c.main; $('capSub').textContent = c.sub; cap.classList.add('on'); }, reduce ? 0 : 450);
    [...chList.children].forEach((b, k) => b.toggleAttribute('aria-current', k === i));
    $('prev').disabled = i <= 0; $('next').textContent = i >= CH.length - 1 ? '自己逛' : '下一段';
  }
  function go(i) {
    if (!started) { started = true; $('intro').classList.add('gone'); $('ui').hidden = false; }
    chapter = i; caption(i); closePanel(); userMoved = false;
    if (i === 0) { Object.assign(target, { fog: .016, clear: .2, rate: .05, reveal: 0, breath: 0 }); flyTo(VIEWS.intro, 2.5); }
    if (i === 1) { Object.assign(target, { fog: .009, clear: .45, rate: 1, reveal: 0, breath: 1 }); flyTo(VIEWS.longkou, 4.5); }
    if (i === 2) { Object.assign(target, { fog: .0012, clear: 1, rate: 1, reveal: 1, breath: 1 }); flyTo(VIEWS.overview, 5.5); }
    if (i === 3) { Object.assign(target, { fog: .0012, clear: 1, rate: 1, reveal: 1, breath: 1 });
      flyTo(islandView('shezi', 110), 4.5, () => setTimeout(() => { if (chapter === 3 && !userMoved) flyTo(islandView('shezi', 16), 9); }, 2600)); }
    if (i === 4) { Object.assign(target, { fog: .0012, clear: 1, rate: 1, reveal: 1, breath: 1 }); flyTo(VIEWS.stall, 5, () => { if (chapter === 4) openPanel('longkou'); }); }
  }
  function next() { if (!started) return go(0); if (chapter < CH.length - 1) go(chapter + 1); else setFree(true); }
  function prev() { if (chapter > 0) go(chapter - 1); }
  function setFree(on) {
    free = on; document.body.classList.toggle('free', on);
    $('tourBtn').setAttribute('aria-pressed', String(!on)); $('freeBtn').setAttribute('aria-pressed', String(on));
    if (on) { $('caption').classList.remove('on'); Object.assign(target, { fog: .0012, clear: 1, rate: 1, reveal: 1, breath: 1 }); flyTo(VIEWS.overview, 4); toast('拖曳轉動視角，滾輪或雙指縮放。<br>點海上的樓臺或攤上的冰。'); }
  }
  $('next').addEventListener('click', next); $('prev').addEventListener('click', prev);
  $('tourBtn').addEventListener('click', () => { setFree(false); go(0); });
  $('freeBtn').addEventListener('click', () => { if (!started) go(2); setFree(true); });
  $('begin').addEventListener('click', () => go(0));
  $('skip').addEventListener('click', () => { go(2); setFree(true); });

  // 自己逛：四個場域
  const nav = $('siteNav');
  ['longkou', 'shuangxi', 'hangkong', 'shezi'].forEach(id => { const b = document.createElement('button'); b.type = 'button'; b.textContent = S(id).name; b.dataset.site = id; if (id === 'longkou') b.classList.add('main'); b.addEventListener('click', () => goSite(id)); nav.append(b); });
  function goSite(id) {
    if (!free) setFree(true);
    if (id === 'longkou') flyTo(VIEWS.stall, 3.5); else flyTo(islandView(id, 95), 3.5);
    openPanel(id);
  }

  /* ================= 側欄 ================= */
  let toastTimer;
  function toast(html, ms = 4500) { const t = $('toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }
  function photoStrip(site) {
    const wrap = document.createElement('div'); wrap.className = 'photos';
    const n = site.photos.length || 3;
    for (let i = 0; i < Math.min(n, 6); i++) {
      const ph = window.HaishiPlaceholder(site, i, 240, 320);
      if (site.photos[i]) { const img = new Image(); img.alt = `${site.name}的照片 ${i + 1}`; img.src = site.photos[i]; img.onerror = () => img.replaceWith(ph); wrap.append(img); }
      else { ph.setAttribute('role', 'img'); ph.setAttribute('aria-label', `${site.name}，照片 ${i + 1}`); wrap.append(ph); }
    }
    return wrap;
  }
  function openPanel(id) {
    const s = S(id), body = $('panelBody');
    nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.site === id)));
    body.innerHTML = `<div class="p-head"><h2>${s.name}</h2><div class="p-meta">${s.role}<br>${esc(s.where)}</div></div>
      <p class="p-call">「${esc(s.call)}」</p>
      <p class="p-text">${esc(s.situation)}</p>${s.id !== 'longkou' ? `<p class="p-echo">${esc(s.echo)}</p>` : ''}
      ${s.look ? `<h3>這裡的樣子</h3><p class="p-look">${esc(s.look)}</p>` : ''}
      <div id="ph"></div>`;
    $('ph').replaceWith(photoStrip(s));
    if (id === 'longkou') {
      const extra = document.createElement('div');
      extra.innerHTML = `<h3 id="tradeTop">攤上買賣</h3>
        <ol class="tsteps" aria-label="買賣的步驟"><li>挑一塊冰</li><li>上秤</li><li>成交</li></ol>
        <div id="tstage" aria-live="polite"></div>
        <details class="icetime"><summary>冰的時間</summary>
          <div class="weights" id="weights"></div>
          <div class="preview"><div class="preview-row"><span id="phase"></span><button type="button" id="now">回到現在</button></div>
          <label for="pv">拉動看看展期中冰怎麼化</label><input type="range" id="pv" min="0" max="100" value="0"></div>
        </details>`;
      body.append(extra);
      $('pv').addEventListener('input', e => { preview = e.target.value / 100; });
      $('now').addEventListener('click', () => { preview = null; $('pv').value = 0; });
      renderWeights();
      if (trade.step === 3 && trade.last) stageDone(); else if (trade.site) stageWeigh(); else stagePick();
    }
    $('panel').classList.add('open'); document.body.classList.add('panel-open');
  }
  function renderWeights() {
    const w = $('weights'); if (!w) return; const st = window.HaishiIce(preview);
    w.innerHTML = ORDER_NAMES.map(n => `<div><small>${n}</small>${st.weight.toFixed(1)}</div>`).join('');
    $('phase').textContent = preview === null ? st.phase : `預覽：化了 ${Math.round(st.p * 100)}%`;
    document.querySelectorAll('.icecard .kg').forEach(k => { k.textContent = `${st.weight.toFixed(1)} 斤`; });
  }
  function closePanel() { $('panel').classList.remove('open'); document.body.classList.remove('panel-open'); nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  $('closePanel').addEventListener('click', closePanel);

  /* ================= 攤上買賣：叫賣、挑冰、上秤、成交 =================
     跟實體攤一樣：聽到叫賣，挑一塊冰，用一個你離開過的地方來換。
     地方寫得越多越重，秤到一袋水的重量才成交。換走一袋融水，也換到繩上別人的一張紙條。 */
  const trade = { step: 1, site: null, last: null, swap: null };
  const ORDER = ['hangkong', 'shuangxi', 'longkou', 'shezi'], ORDER_NAMES = ORDER.map(id => S(id).name);
  const BAG = window.HaishiLedger.bag || 1.5;
  const stallIce = id => ices.find(i => i.stall && i.site.id === id);
  function setSteps(n) { document.querySelectorAll('.tsteps li').forEach((li, i) => { li.toggleAttribute('aria-current', i === n - 1); li.classList.toggle('done', i < n - 1); }); trade.step = n; }
  function thumb(site, w = 120, h = 160) { const ice = stallIce(site.id), img = ice && ice.texs[Math.max(0, ice.idx)].image; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    if (img) { try { drawCover(x, img, 0, 0, w, h); } catch (e) {} } return c; }
  function stagePick() {
    trade.site = null; setSteps(1); highlight(null); vendorLine = '';
    const st = window.HaishiIce(preview);
    $('tstage').innerHTML = `<p class="vendor">「這攤不收錢。看看冰上的地方，喜歡哪一塊？」</p><div class="icecards"></div><p class="hint">也可以直接點攤上的冰。</p>`;
    const wrap = $('tstage').querySelector('.icecards');
    ORDER.forEach(id => { const s = S(id), b = document.createElement('button'); b.type = 'button'; b.className = 'icecard'; b.dataset.site = id;
      b.append(thumb(s)); b.insertAdjacentHTML('beforeend', `<b>${s.name}</b><span class="kg">${st.weight.toFixed(1)} 斤</span>`);
      b.addEventListener('click', () => chooseIce(id)); wrap.append(b); });
  }
  function chooseIce(id, fly = true) {
    trade.site = id; trade.step = 2;
    if (!$('panel').classList.contains('open') || !$('tstage')) openPanel('longkou'); else stageWeigh();
    highlight(id);
    const s = S(id); speak(s.call); vendorLine = `「${s.call}」`; vendorUntil = clock.elapsedTime + 6;
    if (fly) { const ic = stallIce(id), p = new T.Vector3(); ic.g.getWorldPosition(p); flyTo(V(p.x, p.y + ic.h * .5, p.z, 0, 1.5, 5.6 + ic.h * .35), 2.4); }   // 靠到冰前面，照片佔半個畫面以上
  }
  function stageWeigh() {
    const s = S(trade.site); setSteps(2);
    $('tstage').innerHTML = `<div class="chosen"><div class="th"></div><div><b>一袋${s.name}的融水</b><span>${BAG.toFixed(1)} 斤</span></div><button type="button" class="link" id="reIce">換一塊</button></div>
      <div class="scale" aria-hidden="true">${dialSVG()}</div>
      <p class="readout"><span id="yourW">0.0</span> 斤<small>你的地方</small><span class="vs">／</span>${BAG.toFixed(1)} 斤<small>這袋水</small></p>
      <p class="vendor" id="vline">「拿一個你離開過的地方來換。」</p>
      <form id="trade" autocomplete="off">
        <label for="place">一個你離開過的地方<input type="text" id="place" maxlength="16" required placeholder="外婆家的巷口"></label>
        <label for="words">關於它，你還記得的一件事<textarea id="words" maxlength="100" required placeholder="下午三點，賣豆花的腳踏車會經過"></textarea></label>
        <button class="weigh" type="submit" id="deal" disabled>成交</button>
      </form>`;
    $('tstage').querySelector('.th').append(thumb(s, 60, 80));
    $('reIce').addEventListener('click', stagePick);
    const upd = () => {
      const place = $('place').value.trim(), words = $('words').value.trim();
      const w = place ? window.HaishiLedger.weigh(place, words) : 0, ok = place && words && w >= BAG;
      $('yourW').textContent = w.toFixed(1);
      const nd = document.querySelector('.scale .nd'); if (nd) nd.style.transform = `rotate(${-120 + Math.min(1, w / 3) * 240}deg)`;
      const line = !place ? '「拿一個你離開過的地方來換。」' : !words ? '「這是什麼地方？說說看。」' : w < BAG ? '「還輕了一點，再多說一點這個地方。」' : '「剛剛好，成交。」';
      $('vline').textContent = line; vendorLine = line; vendorUntil = clock.elapsedTime + 8;
      $('deal').disabled = !ok; document.querySelector('.scale').classList.toggle('ok', !!ok);
    };
    $('place').addEventListener('input', upd); $('words').addEventListener('input', upd);
    $('trade').addEventListener('submit', e => {
      e.preventDefault();
      const place = $('place').value.trim(), words = $('words').value.trim();
      if (!place || !words || window.HaishiLedger.weigh(place, words) < BAG) return;
      const pool = window.HaishiLedger.all();
      const entry = window.HaishiLedger.add(place, words, trade.site);
      trade.swap = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      trade.last = entry; trade.tower = null;
      speak('成交，多謝喔'); vendorLine = '「成交，多謝喔。」'; vendorUntil = clock.elapsedTime + 6;
      stageDone();
      // 樓臺、紙條、掛起來的水袋分開做，不要一次卡住畫面
      setTimeout(() => { towerKeys.add(entry.cid); trade.tower = addTower(entry, towers.length, true); }, 60);
      setTimeout(hangNotes, 240);
      setTimeout(() => hangBags(true), 420);
    });
    upd();
  }
  function dialSVG() {
    let ticks = ''; for (let k = 0; k <= 30; k++) { const a = (-120 + k * 8) * Math.PI / 180, r1 = 52, r2 = k % 5 ? 46 : 41; ticks += `<line x1="${60 + Math.sin(a) * r1}" y1="${66 - Math.cos(a) * r1}" x2="${60 + Math.sin(a) * r2}" y2="${66 - Math.cos(a) * r2}"/>`; }
    const ta = (-120 + BAG / 3 * 240) * Math.PI / 180;
    return `<svg viewBox="-2 4 124 128"><circle cx="60" cy="66" r="58" class="face"/><g class="ticks">${ticks}</g>
      <circle cx="${60 + Math.sin(ta) * 56}" cy="${66 - Math.cos(ta) * 56}" r="3" class="mark"/>
      <text x="60" y="88" class="unit">斤</text><g class="nd"><line x1="60" y1="66" x2="60" y2="20"/></g><circle cx="60" cy="66" r="4" class="hub"/></svg>`;
  }
  function stageDone() {
    const s = S(trade.last.site), e = trade.last, sw = trade.swap; setSteps(3);
    const ice = stallIce(s.id), img = ice.texs[Math.max(0, ice.idx)].image;
    const full = drawReceipt(e, s, sw, img, true), plain = drawReceipt(e, s, sw, img, false);
    $('tstage').innerHTML = `<div class="receipt"><img alt="一袋${s.name}的融水，標著${esc(e.place)}"><img alt="" class="melt"></div>
      <p class="hint">照片在水裡慢慢化開。帶回家的路上，它就只剩一袋水。</p>
      ${sw ? `<p class="swap"><small>繩上的紙條，也換一張給你</small><b>${esc(sw.place)}</b>${esc(sw.words)}</p>` : ''}
      <div class="acts"><a class="weigh" id="save" download="海市_一袋${s.name}的融水.png">存下這袋水</a><button type="button" id="seeTower">去看它浮起來</button><button type="button" id="again">再換一次</button></div>`;
    const [a, b] = $('tstage').querySelectorAll('.receipt img');
    a.src = full.toDataURL('image/png'); b.src = plain.toDataURL('image/png');
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on')));
    $('save').href = a.src;
    $('seeTower').addEventListener('click', () => { const g = trade.tower; if (!g) return; g.userData.born = clock.elapsedTime + (reduce ? 0 : 3.1);   // 飛過去的路上先沉在水裡，鏡頭到了才浮起來 if (innerWidth < 760) closePanel();
      flyTo(V(g.position.x, 8, g.position.z, Math.atan2(-g.position.x, -g.position.z), 1.32, 42), 3.5); });
    $('again').addEventListener('click', () => { trade.last = null; stagePick(); flyTo(VIEWS.stall, 2); });
    toast(`<b>${esc(e.place)}</b>秤起來 ${e.w.toFixed(1)} 斤，換走一袋${s.name}的融水。`, 5000);
  }
  function wrapText(x, text, maxW) { const out = []; let line = ''; for (const ch of text) { if (x.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }
  function drawReceipt(e, s, sw, img, withPhoto) {
    const W = 720, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#f2efe6'; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .05})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    x.fillStyle = '#1d2a30'; x.font = '900 46px "Noto Serif TC"'; x.fillText('海市', 60, 96);
    x.font = '400 19px "Noto Serif TC"'; x.fillStyle = '#6b7478'; x.fillText('龍口市場・汀州路一段149巷', 60, 132);
    const d = new Date(e.ts); x.textAlign = 'right'; x.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}　${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, W - 60, 132); x.textAlign = 'left';
    x.fillStyle = '#b8342a'; x.fillRect(60, 156, W - 120, 2);
    // 一袋水
    const cx = W / 2, top = 250, bot = 610;
    const bag = () => { x.beginPath(); x.moveTo(cx - 16, top); x.bezierCurveTo(cx - 40, top + 40, cx - 150, top + 70, cx - 150, top + 190); x.bezierCurveTo(cx - 150, bot - 30, cx - 120, bot, cx, bot); x.bezierCurveTo(cx + 120, bot, cx + 150, bot - 30, cx + 150, top + 190); x.bezierCurveTo(cx + 150, top + 70, cx + 40, top + 40, cx + 16, top); x.closePath(); };
    x.save(); bag(); x.clip();
    const wg = x.createLinearGradient(0, top, 0, bot); wg.addColorStop(0, 'rgba(210,228,234,.5)'); wg.addColorStop(.35, 'rgba(150,190,205,.55)'); wg.addColorStop(1, 'rgba(90,140,160,.7)'); x.fillStyle = wg; x.fillRect(cx - 160, top, 320, bot - top);
    if (withPhoto && img) { x.globalAlpha = .82; try { drawCover(x, img, cx - 140, top + 110, 280, 280 * 4 / 3 * .82); } catch (er) {} x.globalAlpha = 1; x.fillStyle = 'rgba(150,195,210,.28)'; x.fillRect(cx - 160, top, 320, bot - top); }
    x.fillStyle = 'rgba(240,248,250,.55)'; x.fillRect(cx - 160, top, 320, 92);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 6; x.beginPath(); x.arc(cx - 70, top + 220, 90, Math.PI * 1.05, Math.PI * 1.35); x.stroke();
    x.restore();
    x.strokeStyle = 'rgba(70,95,105,.55)'; x.lineWidth = 2; bag(); x.stroke();
    // 紅繩與價牌
    x.strokeStyle = '#b8342a'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - 18, top + 6); x.quadraticCurveTo(cx, top - 14, cx + 18, top + 6); x.moveTo(cx, top - 4); x.bezierCurveTo(cx + 30, top - 40, cx + 120, top - 30, cx + 150, top - 12); x.stroke();
    x.save(); x.translate(cx + 150, top - 30); x.rotate(.12); x.fillStyle = '#b8342a'; x.fillRect(0, 0, 210, 74); x.fillStyle = '#fff'; x.font = '400 27px "LXGW WenKai TC"'; x.fillText(`${s.name}的融水`, 16, 32); x.font = '400 24px "LXGW WenKai TC"'; x.fillText(`${BAG.toFixed(1)} 斤`, 16, 62); x.restore();
    // 換來的地方
    let y = 690;
    x.fillStyle = '#6b7478'; x.font = '400 19px "Noto Serif TC"'; x.fillText('用來換的地方', 60, y);
    x.fillStyle = '#1d2a30'; x.font = '400 40px "LXGW WenKai TC"'; x.fillText(e.place, 60, y + 52);
    x.font = '400 22px "LXGW WenKai TC"'; x.fillStyle = '#3a474d'; wrapText(x, e.words, W - 120).slice(0, 2).forEach((l, i) => x.fillText(l, 60, y + 92 + i * 32));
    x.fillStyle = '#6b7478'; x.font = '400 17px "Noto Serif TC"'; x.fillText(`秤起來 ${e.w.toFixed(1)} 斤`, 60, y + 166);
    if (sw) { x.fillStyle = 'rgba(184,52,42,.5)'; x.fillRect(60, y + 196, 60, 1.5); x.fillStyle = '#6b7478'; x.fillText('繩上換給你的紙條', 60, y + 232);
      x.fillStyle = '#1d2a30'; x.font = '400 28px "LXGW WenKai TC"'; x.fillText(sw.place.slice(0, 14), 60, y + 272); }
    // 印
    x.save(); x.translate(W - 140, H - 120); x.rotate(-.12); x.strokeStyle = 'rgba(184,52,42,.85)'; x.lineWidth = 4; x.strokeRect(-46, -46, 92, 92); x.fillStyle = 'rgba(184,52,42,.85)'; x.font = '900 34px "Noto Serif TC"'; x.textAlign = 'center'; x.fillText('海', 0, -6); x.fillText('市', 0, 32); x.restore();
    x.fillStyle = '#9aa1a4'; x.font = '400 15px "Noto Serif TC"'; x.fillText('這攤不收錢，只換一個地方。', 60, H - 60);
    return c;
  }
  function highlight(id) { ices.forEach(i => { if (i.stall) i.want = id && i.site.id === id ? 1 : 0; }); }

  // 叫賣：攤子上方的對話框，可以打開聲音
  let voiceOn = false, vendorLine = '', vendorUntil = 0, callIdx = 0, callNext = 0;
  const CALLS = ['來喔來喔，冰上的地方，看看喔', ...ORDER.map(id => S(id).call), '這攤不收錢，拿一個地方來換'];
  function speak(t) {
    if (!voiceOn || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[「」。，]/g, ' ')); u.lang = 'zh-TW';
      const vs = speechSynthesis.getVoices(), v = vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)); if (v) u.voice = v; u.rate = .95; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {}
  }
  $('voiceBtn').addEventListener('click', () => { voiceOn = !voiceOn; $('voiceBtn').setAttribute('aria-pressed', String(voiceOn)); if (voiceOn) speak(CALLS[callIdx]); else if (window.speechSynthesis) speechSynthesis.cancel(); });
  const callout = $('callout'), stallWorld = new T.Vector3();
  function updateCallout(t) {
    KZ.localToWorld(stallWorld.set(0, 9.4, 0));
    const d = camera.position.distanceTo(stallWorld), show = started && (free || chapter === 4) && d < 90;
    if (show) {
      if (t > callNext && t > vendorUntil) { callIdx = (callIdx + 1) % CALLS.length; callNext = t + 6; vendorLine = `「${CALLS[callIdx]}」`; if (d < 40) speak(CALLS[callIdx]); }
      if (callout.textContent !== vendorLine) callout.textContent = vendorLine;
      const p = stallWorld.clone().project(camera);
      if (p.z < 1) { callout.style.transform = `translate(${(p.x * .5 + .5) * innerWidth}px, ${(-p.y * .5 + .5) * innerHeight}px) translate(-50%, -100%)`; }
    }
    callout.classList.toggle('on', show && !!vendorLine);
  }

  /* ================= 主迴圈 ================= */
  const clock = new T.Clock();
  /* 共看：所有人換進來的地方都浮成樓臺。別人剛成交的，從海面浮起來 */
  let built = false; const towerKeys = new Set();
  function syncTowers() { window.HaishiLedger.all().slice(0, 40).reverse().forEach(en => { const k = en.cid || en.place; if (towerKeys.has(k)) return; towerKeys.add(k); addTower(en, towers.length, false); }); }
  addEventListener('haishi-ledger', ({ detail: { type, entry } }) => {
    if (!built) return;                                  // 場景還沒蓋好，等一下蓋的時候就會一起放進來
    if (type === 'load') { syncTowers(); hangNotes(); hangBags(false); return; }
    if (type !== 'add') return;
    const k = entry.cid || entry.place;
    if (!towerKeys.has(k) && towers.length < 60) { towerKeys.add(k); addTower(entry, towers.length, true); }
    hangNotes(); hangBags(!!entry.site);
    toast(`有人換進來一個地方：<b>${esc(entry.place)}</b><br>它正從海上浮起來。`, 4500);
  });
  const fontsReady = document.fonts ? Promise.race([
    Promise.all(['900 64px "Noto Serif TC"', '500 64px "Noto Serif TC"', '400 48px "LXGW WenKai TC"'].map(f => document.fonts.load(f, '海市龍口雙溪航空城社子島斤'))),
    new Promise(r => setTimeout(r, 3500))]) : Promise.resolve();
  fontsReady.then(() => {
    buildMarket();
    ISL.forEach(buildIsland);
    hangBags(false);
    syncTowers(); built = true;
    hangNotes();
    // 招牌與價牌等字型到了再畫，所以重新整理一次材質
    ices.forEach(i => { i.last = ''; });
    $('begin').disabled = false; $('begin').textContent = '開始';
    applyCam(); requestAnimationFrame(loop);
    const h = location.hash.slice(1);
    if (D.sites.some(s => s.id === h)) { go(2); setFree(true); setTimeout(() => goSite(h), 300); }
  });

  let lastNear = '', weightTick = 0, viewShift = 0;
  function loop() {
    const raw = clock.getDelta(), dt = Math.min(.05, raw), t = clock.elapsedTime;
    const ease = 1 - Math.pow(.25, dt);
    for (const k in target) state[k] += (target[k] - state[k]) * ease * .6;
    scene.fog.density = state.fog; seaMat.uniforms.uDen.value = state.fog; seaMat.uniforms.uTime.value = t;
    skyMat.uniforms.uClear.value = state.clear;
    stepFly(Math.min(.25, raw)); applyCam();

    // 巷子盡頭的光，像呼吸一樣一明一暗
    const br = Math.sin(t * .6) * .5 + .5;
    breath.material.opacity = (.12 + br * .22) * state.breath;
    updateVapor(dt, t, state.rate);
    updateIces(t);
    const pNow = window.HaishiIce(preview).p; ices.forEach((ice, i) => { if (ice.needle) ice.needle.rotation.z = (1 - pNow) * -2 + 1 + Math.sin(t * 3 + i) * .015; });
    if ((weightTick += dt) > .5) { weightTick = 0; renderWeights(); }
    // 布旗飄
    const fp = flagGeo.attributes.position; for (let k = 0; k < fp.count; k++) { const x0 = flagBase[k * 3], y0 = flagBase[k * 3 + 1]; fp.setZ(k, Math.sin(t * 2 + y0 * 1.5 + x0 * 2) * .08 * (x0 + .65)); } fp.needsUpdate = true;

    let nearName = '';
    islands.forEach((is, i) => {
      const d = camera.position.distanceTo(is.root.position.clone().setY(16 * ISC)) / ISC;
      const rv = state.reveal;
      const rA = smooth(115, 230, d) * rv * smooth(100, 230, camera.position.length());   // 站在市場裡看不到效果圖的高樓，退到海上才浮現
      const scat = 1 - smooth(13, 42, d);
      const dA = (1 - smooth(135, 240, d)) * (1 - smooth(.2, .75, scat)) * rv;
      setOp(is.R.mats, rA); setOp(is.Dl.mats, dA); 
      { const flick = reduce ? .6 : smooth(.15, .85, (Math.sin(t * .19 + i * 2.1) * .5 + .5) * (Math.sin(t * .47 + i * 1.3) * .35 + .65));
        const sq = reduce ? .7 : .55 + Math.sin(t * .31 + i) * .2 + Math.sin(t * .83 + i * 3) * .05, top = is.ghostTop;
        setOp(is.ghostMats, rA * flick); is.ghost.visible = rA * flick > .01;
        is.ghost.scale.y = -sq; is.ghost.position.y = top + top * .05 + sq * top;
        if (!reduce) is.ghost.position.x = Math.sin(t * .7 + i) * 1.2 + Math.sin(t * 1.9 + i) * .6; }
      is.Dl.g.visible = dA > .01; is.R.g.visible = rA > .01; 
      is.pm.uniforms.uS.value = scat; is.pm.uniforms.uT.value = t; is.pm.uniforms.uA.value = rv * (scat > .02 ? Math.min(1, scat * 2.5) * (1 - smooth(.75, 1, scat) * .6) : 0);
      is.cloud.visible = is.pm.uniforms.uA.value > .01;
      is.name.material.opacity = (free ? 1 : 0) * rv * smooth(40, 90, d) * smooth(40, 110, camera.position.distanceTo(LK.position));   // 在攤前看冰時，遠方的島名不要疊在冰上 is.name.visible = is.name.material.opacity > .01;
      if (!reduce) { is.R.g.position.x = Math.sin(t * .7 + i) * 1.2; is.R.g.scale.y = 1 + Math.sin(t * .5 + i) * .025; }
      if (is.Dl.g.userData.anim && is.Dl.g.visible) is.Dl.g.userData.anim(t, dt);
      if (d < 40 && started) nearName = is.site.name;
    });
    if (free && nearName && nearName !== lastNear) toast(`${nearName}散了。<br>一靠近，海市就到不了。`, 3800);
    lastNear = nearName;

    towers.forEach((g, i) => {
      const age = t - g.userData.born, rise = age < 5 ? smooth(0, 5, age) : 1;
      g.position.y = (-g.userData.top - 4) * (1 - rise) + Math.sin(t * .5 + i) * .5;
      g.userData.mats[0].opacity = state.reveal; g.userData.mats[2].opacity = state.reveal * (chapter >= 4 || free ? 1 : .0);
      g.visible = state.reveal > .02;
      const ud = g.userData, a2 = t - ud.born;
      if (a2 < 9) {
        const s = reduce ? 1 : smooth(.2, 3.4, a2), wob = (1 - s) * Math.sin(a2 * 9) * .12;
        ud.lb.position.y = (-g.position.y + .2) * (1 - s) + (ud.top + 2.4) * s;
        ud.lb.scale.set(ud.lb.userData.sx * (1 + wob), ud.lb.userData.sy * (.35 + .65 * s) * (1 - wob), 1);
        ud.lb.material.color.setRGB(.6 + .4 * s, .85 + .15 * s, 1.25 - .25 * s);
        if (chapter >= 4 || free) ud.lb.material.opacity = state.reveal * smooth(0, .6, a2);
        ud.ripples.forEach((m, k) => { const ra = a2 - k * .8; m.visible = !reduce && ra > 0 && ra < 4.5; if (!m.visible) return;
          m.scale.setScalar(1 + ra * 5.5); m.material.opacity = (1 - ra / 4.5) * .55 * state.reveal; });
      } else if (ud.ripples[0].visible || ud.lb.position.y !== ud.top + 2.4) { ud.ripples.forEach(m => { m.visible = false; }); ud.lb.position.y = ud.top + 2.4; ud.lb.scale.set(ud.lb.userData.sx, ud.lb.userData.sy, 1); ud.lb.material.color.setScalar(1); }
    });
    // 熱氣扭曲只在遠看海面時出現；走進市場或靠近樓臺就停掉，不然房子會晃
    const nearLK = smooth(70, 150, camera.position.distanceTo(LK.position)), nearIs = Math.min(...islands.map(is => smooth(16 * ISC, 42 * ISC, camera.position.distanceTo(is.root.position))), 1);   // 島放大以後，靠近的距離也跟著放大
    compMat.uniforms.uHaze.value = (.4 + state.clear * .8) * nearLK * nearIs;
    // 側欄打開時，把畫面中心往左移，場景不會被擋住
    const wantShift = $('panel').classList.contains('open') && innerWidth > 760 ? Math.min(410, innerWidth) / 2 : 0;
    viewShift += (wantShift - viewShift) * ease;
    if (Math.abs(viewShift) > .5) camera.setViewOffset(innerWidth, innerHeight, viewShift, 0, innerWidth, innerHeight); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    updateCallout(t);
    if (LK.userData.crane) LK.userData.crane.visible = (t % 1.6) < .8;
    bagGroup.children.forEach(h => { const age = t - h.userData.born, k = age < 6 ? 1 - age / 6 : 0; h.rotation.z = Math.sin(t * 2.2 + h.userData.i) * (.03 + k * .25); h.rotation.x = Math.sin(t * 1.7 + h.userData.i) * .02; });
    renderFrame(t);
    requestAnimationFrame(loop);
  }

  window.__haishi = { get flying() { return !!fly; }, scene, moonLight, LK,
    // 測試用：直接把鏡頭放到某個位置
    set(tx, ty, tz, th, ph, r) { fly = null; cam.target.set(tx, ty, tz); cam.theta = th; cam.phi = ph; cam.radius = r; },
    island(id, r, dth = 0, ph = 1.3) { const v = islandView(id, r); this.set(v.target.x, v.target.y, v.target.z, v.theta + dth, ph, v.radius); } };
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); makeTargets();
    vMat.uniforms.uScale.value = innerHeight * DPR * .5; islands.forEach(is => { is.pm.uniforms.uScale.value = innerHeight * DPR * .5; });
  });
})();
