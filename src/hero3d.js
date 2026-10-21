import * as THREE from 'three';

// Procedural city at dusk with a twisting signature tower.
// Buildings are a single InstancedMesh with a shader that draws lit windows
// in world space, so the whole skyline is one draw call.

const buildingVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uRise;
  varying vec3 vWorld;
  varying vec3 vN;
  varying vec3 vTint;
  varying float vSeed;
  varying float vDepth;
  void main() {
    vec3 p = position;
    vec3 origin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float d = length(origin.xz);
    float r = clamp((uRise * 95.0 - d) / 12.0, 0.0, 1.0);
    r = 1.0 - pow(1.0 - r, 3.0);
    p.y *= max(r, 0.001);
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vTint = aColor;
    vSeed = aSeed;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const buildingFrag = /* glsl */ `
  uniform float uTime;
  uniform float uLit;
  uniform vec3 uFog;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vN;
  varying vec3 vTint;
  varying float vSeed;
  varying float vDepth;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(0.6, 0.5, -0.4));
    float diff = max(dot(n, L), 0.0);
    vec3 col = vTint * (0.45 + 0.55 * diff);
    // warm rim from the sunset side
    col += vec3(0.9, 0.45, 0.2) * pow(max(dot(n, vec3(0.0, 0.0, -1.0)), 0.0), 2.0) * 0.08;
    if (abs(n.y) < 0.5) {
      float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
      vec2 g = vec2(u / 0.38, vWorld.y / 0.5);
      vec2 cell = floor(g);
      vec2 f = fract(g);
      float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.78);
      float side = abs(n.x) > 0.5 ? 3.1 : 7.7;
      float r = hash(vec3(cell, vSeed * 91.7 + side));
      float on = step(1.0 - uLit, r);
      float flick = 0.8 + 0.2 * sin(uTime * 0.7 + r * 50.0);
      float h2 = hash(vec3(cell.yx, vSeed + 2.0));
      vec3 warm = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.82, 0.55), h2);
      vec3 cool = vec3(0.3, 0.78, 0.95);
      vec3 wc = mix(warm, cool, step(0.86, hash(vec3(cell, vSeed + 5.0))));
      col = mix(col, col * 0.55 + vec3(0.02, 0.04, 0.05), win);
      col += win * on * wc * 1.35 * flick;
    } else {
      col = vTint * 0.6;
    }
    // ground occlusion
    col *= 0.5 + 0.5 * smoothstep(0.0, 5.0, vWorld.y);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    col = mix(col, uFog, clamp(fog, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Deterministic random so the skyline is the same on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createHero(canvas, { mobile = false, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor('#0b1215');

  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#2a2220');
  const camera = new THREE.PerspectiveCamera(mobile ? 55 : 42, 1, 0.1, 500);
  const rand = rng(7);

  // --- Sky dome with sunset horizon
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(250, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#060d10') },
        uMid: { value: new THREE.Color('#132329') },
        uHorizon: { value: new THREE.Color('#d9662f') },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uMid, uHorizon; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 c = mix(uHorizon, uMid, smoothstep(-0.03, 0.2, h));
          c = mix(c, uTop, smoothstep(0.2, 0.65, h));
          float glow = exp(-pow((vP.x - 0.25) * 2.0, 2.0)) * exp(-pow(max(h, 0.0) * 6.0, 2.0));
          c += vec3(1.0, 0.5, 0.25) * glow * 0.45;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  scene.add(sky);

  // --- Lights for standard materials (tower slabs, ground)
  scene.add(new THREE.HemisphereLight('#7fb6c9', '#1a1210', 0.9));
  const sun = new THREE.DirectionalLight('#ffb27a', 1.6);
  sun.position.set(20, 18, -40);
  scene.add(sun);

  // --- Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: '#0d1417', roughness: 0.9, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(180, 45, '#1f3a44', '#15262c');
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  // --- City
  const spacing = 4;
  const half = mobile ? 11 : 16;
  const cells = [];
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      const x = i * spacing;
      const z = j * spacing;
      if (Math.abs(x) < 9 && Math.abs(z) < 9) continue; // plaza for the tower
      if (z > 4 && Math.abs(x - 2) < 9 + z * 0.18) continue; // boulevard the camera looks down
      const d = Math.hypot(x, z);
      if (d > half * spacing) continue;
      // two buildings per block for a denser skyline
      for (let k = 0; k < 2; k++) cells.push([x + (k ? 1.1 : -1.0) + (rand() - 0.5) * 0.4, z + (rand() - 0.5) * 1.2, d]);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const uniforms = {
    uTime: { value: 0 },
    uRise: { value: reduced ? 1 : 0 },
    uLit: { value: 0.42 },
    uFog: { value: FOG },
    uFogDensity: { value: mobile ? 0.016 : 0.013 },
  };
  const bMat = new THREE.ShaderMaterial({ uniforms, vertexShader: buildingVert, fragmentShader: buildingFrag });
  const city = new THREE.InstancedMesh(box, bMat, cells.length);
  const colors = new Float32Array(cells.length * 3);
  const seeds = new Float32Array(cells.length);
  const m = new THREE.Matrix4();
  const palette = [new THREE.Color('#1c2a30'), new THREE.Color('#222b2e'), new THREE.Color('#2a2f33'), new THREE.Color('#1a2427'), new THREE.Color('#2b2623')];
  cells.forEach(([x, z, d], idx) => {
    const centre = Math.exp(-d / 28);
    const h = 1.5 + Math.pow(rand(), 2.2) * (6 + 22 * centre) + rand() * 2;
    const w = 1.3 + rand() * 1.0;
    const dpt = 1.3 + rand() * 1.4;
    m.makeScale(w, h, dpt);
    m.setPosition(x, 0, z);
    city.setMatrixAt(idx, m);
    const c = palette[Math.floor(rand() * palette.length)];
    colors.set([c.r, c.g, c.b], idx * 3);
    seeds[idx] = rand() * 100;
  });
  box.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  city.frustumCulled = false;
  scene.add(city);

  // --- Signature tower: twisting floor plates with glowing edges
  const tower = new THREE.Group();
  scene.add(tower);
  const floors = mobile ? 30 : 40;
  const fh = 0.5;
  const slabGeo = new THREE.BoxGeometry(3.6, 0.12, 3.6);
  const slabMat = new THREE.MeshStandardMaterial({ color: '#2b3438', metalness: 0.7, roughness: 0.3 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, floors);
  const coreGeo = new THREE.BoxGeometry(1, 1, 1);
  coreGeo.translate(0, 0.5, 0);
  const coreColors = new Float32Array(floors * 3);
  const coreSeeds = new Float32Array(floors);
  for (let i = 0; i < floors; i++) {
    coreColors.set([0.08, 0.13, 0.15], i * 3);
    coreSeeds[i] = 500 + i;
  }
  coreGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(coreColors, 3));
  coreGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(coreSeeds, 1));
  const cores = new THREE.InstancedMesh(coreGeo, bMat, floors);
  cores.frustumCulled = false;
  slabs.frustumCulled = false;
  tower.add(slabs, cores);

  const edgePos = new Float32Array(floors * 8 * 3);
  const twist = 0.045;
  const hs = 1.8;
  for (let i = 0; i < floors; i++) {
    const a = i * twist;
    const y = i * fh + 0.07;
    const pts = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].map(([px, pz]) => [
      px * Math.cos(a) - pz * Math.sin(a), y, px * Math.sin(a) + pz * Math.cos(a),
    ]);
    for (let e = 0; e < 4; e++) {
      const p1 = pts[e];
      const p2 = pts[(e + 1) % 4];
      edgePos.set([...p1, ...p2], (i * 8 + e * 2) * 3);
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: '#f28c4b', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  tower.add(edges);

  // spire + beacon
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 4, 6), new THREE.MeshStandardMaterial({ color: '#9fb3bb', metalness: 0.9, roughness: 0.2 }));
  tower.add(spire);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#3fc4ec', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beacon.scale.set(2.2, 2.2, 1);
  tower.add(beacon);
  const towerLight = new THREE.PointLight('#f28c4b', 30, 30, 2);
  towerLight.position.set(0, 6, 4);
  tower.add(towerLight);

  const towerState = { grow: reduced ? 1 : 0 };
  const tq = new THREE.Quaternion();
  const tp = new THREE.Vector3();
  const ts = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function layoutTower() {
    const g = towerState.grow * floors;
    for (let i = 0; i < floors; i++) {
      const t = THREE.MathUtils.clamp(g - i, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const y = i * fh + (1 - e) * 3;
      tq.setFromAxisAngle(yAxis, i * twist);
      ts.set(e || 0.0001, 1, e || 0.0001);
      tp.set(0, y, 0);
      m.compose(tp, tq, ts);
      slabs.setMatrixAt(i, m);
      // glass core sits between slabs, slightly inset
      ts.set((e || 0.0001) * 3.0, fh - 0.12, (e || 0.0001) * 3.0);
      tp.set(0, y + 0.06, 0);
      m.compose(tp, tq, ts);
      cores.setMatrixAt(i, m);
    }
    slabs.instanceMatrix.needsUpdate = true;
    cores.instanceMatrix.needsUpdate = true;
    edges.geometry.setDrawRange(0, Math.floor(g) * 8);
    const top = floors * fh;
    spire.position.y = top + 2 * towerState.grow - 0.2;
    spire.scale.y = Math.max(towerState.grow, 0.001);
    beacon.position.y = top + 4 * towerState.grow;
  }
  layoutTower();
  let laidOut = towerState.grow;

  // --- Traffic: light particles moving along the street grid
  const carCount = mobile ? 140 : 360;
  const carPos = new Float32Array(carCount * 3);
  const carCol = new Float32Array(carCount * 3);
  const cars = [];
  const lanesMax = half * spacing;
  for (let i = 0; i < carCount; i++) {
    const alongX = rand() > 0.5;
    const lane = (Math.floor(rand() * (half * 2)) - half) * spacing + spacing / 2 + (rand() > 0.5 ? 0.35 : -0.35);
    const dir = rand() > 0.5 ? 1 : -1;
    cars.push({ alongX, lane, dir, t: (rand() * 2 - 1) * lanesMax, speed: 4 + rand() * 6 });
    const head = dir > 0;
    const c = head ? new THREE.Color('#fff2d6') : new THREE.Color('#ff5a3c');
    carCol.set([c.r, c.g, c.b], i * 3);
  }
  const carGeo = new THREE.BufferGeometry();
  carGeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3));
  carGeo.setAttribute('color', new THREE.BufferAttribute(carCol, 3));
  const carMat = new THREE.PointsMaterial({ size: 0.55, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const traffic = new THREE.Points(carGeo, carMat);
  scene.add(traffic);

  // --- Floating dust / bokeh
  const dustCount = mobile ? 160 : 420;
  const dustPos = new Float32Array(dustCount * 3);
  const dustCol = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos.set([(rand() - 0.5) * 90, rand() * 30, (rand() - 0.5) * 90], i * 3);
    const c = rand() > 0.6 ? new THREE.Color('#3fc4ec') : new THREE.Color('#f7b27a');
    dustCol.set([c.r, c.g, c.b], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.28, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // --- Camera rig
  const rig = {
    base: new THREE.Vector3(mobile ? 3 : 9, mobile ? 9 : 7.5, mobile ? 40 : 34),
    look: new THREE.Vector3(mobile ? 0 : -3, mobile ? 9 : 8, 0),
    intro: reduced ? 1 : 0,
    scroll: 0,
  };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();

  function onPointer(e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }
  function onTilt(e) {
    if (e.gamma == null) return;
    pointer.tx = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
    pointer.ty = THREE.MathUtils.clamp((e.beta - 45) / 40, -1, 1);
  }
  window.addEventListener('pointermove', onPointer, { passive: true });
  if (mobile) window.addEventListener('deviceorientation', onTilt, { passive: true });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  if (import.meta.env.DEV) window.__hero = { scene, camera, tower, slabs, cores, towerState, rig };
  const clock = new THREE.Clock();
  let active = true;
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!active) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // intro swoop: from high above down to street level
    const k = 1 - Math.pow(1 - rig.intro, 3);
    const s = rig.scroll;
    camPos.copy(rig.base);
    camPos.y += (1 - k) * 45 + s * 14;
    camPos.z += (1 - k) * 30 - s * 12;
    camPos.x += pointer.x * 4 + Math.sin(t * 0.08) * 1.5;
    camPos.y += -pointer.y * 2;
    camera.position.copy(camPos);
    lookPos.copy(rig.look);
    lookPos.y += s * 4 - (1 - k) * 4;
    camera.lookAt(lookPos);

    tower.rotation.y = t * 0.06;
    if (towerState.grow !== laidOut) {
      laidOut = towerState.grow;
      layoutTower();
    }
    beacon.material.opacity = 0.55 + 0.45 * Math.sin(t * 3);

    // traffic
    for (let i = 0; i < carCount; i++) {
      const c = cars[i];
      c.t += c.dir * c.speed * dt;
      if (c.t > lanesMax) c.t = -lanesMax;
      if (c.t < -lanesMax) c.t = lanesMax;
      if (c.alongX) carPos.set([c.t, 0.15, c.lane], i * 3);
      else carPos.set([c.lane, 0.15, c.t], i * 3);
    }
    carGeo.attributes.position.needsUpdate = true;

    dust.rotation.y = t * 0.01;
    dust.position.y = Math.sin(t * 0.2) * 0.6;

    renderer.render(scene, camera);
  }
  frame();

  return {
    intro(gsap) {
      if (reduced) return;
      gsap.to(rig, { intro: 1, duration: 3.2, ease: 'power3.out' });
      gsap.to(uniforms.uRise, { value: 1, duration: 3.4, ease: 'power2.out' });
      gsap.to(towerState, { grow: 1, duration: 3.6, delay: 0.4, ease: 'power2.inOut' });
    },
    setScroll(p) { rig.scroll = p; },
    setActive(v) {
      if (v && !active) clock.getDelta();
      active = v;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
