import * as THREE from 'three';

// Scroll-driven construction sequence.
// progress 0 → 1 : foundation → structure → MEP → façade → handover.

export const PHASES = [
  { at: 0.0, step: 0, label: 'Laying the foundation' },
  { at: 0.18, step: 1, label: 'Raising the structure' },
  { at: 0.55, step: 2, label: 'Services & MEP' },
  { at: 0.72, step: 3, label: 'Façade & finishes' },
  { at: 0.9, step: 4, label: 'Ready for handover' },
];

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const range = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function createBuild(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#2c3335', 40, 90);
  const camera = new THREE.PerspectiveCamera(mobile ? 50 : 38, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight('#a9d8ea', '#2a1f18', 1.1));
  const key = new THREE.DirectionalLight('#ffd2ad', 2.2);
  key.position.set(14, 22, 10);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  scene.add(key);
  const rim = new THREE.DirectionalLight('#3fc4ec', 1.2);
  rim.position.set(-14, 8, -12);
  scene.add(rim);

  // --- Site
  const siteMat = new THREE.MeshStandardMaterial({ color: '#2a3133', roughness: 1 });
  const site = new THREE.Mesh(new THREE.CircleGeometry(22, 64), siteMat);
  site.rotation.x = -Math.PI / 2;
  site.receiveShadow = true;
  scene.add(site);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(21.6, 21.8, 96),
    new THREE.MeshBasicMaterial({ color: '#f28c4b', transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);
  const siteGrid = new THREE.GridHelper(36, 36, '#25414b', '#1a2c32');
  siteGrid.position.y = 0.02;
  scene.add(siteGrid);

  // plot boundary (dashed orange)
  const plot = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(11, 0.01, 11)),
    new THREE.LineDashedMaterial({ color: '#f28c4b', dashSize: 0.4, gapSize: 0.25 })
  );
  plot.computeLineDistances();
  plot.position.y = 0.03;
  scene.add(plot);

  const building = new THREE.Group();
  scene.add(building);

  // --- Foundation raft + footings
  const concrete = new THREE.MeshStandardMaterial({ color: '#bdb6aa', roughness: 0.85 });
  const raft = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 8.6), concrete);
  raft.castShadow = raft.receiveShadow = true;
  building.add(raft);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 10), new THREE.MeshStandardMaterial({ color: '#3a2a1f', roughness: 1 }));
  pit.position.y = 0.025;
  scene.add(pit);

  // --- Structure: floors + columns
  const FLOORS = 12;
  const FH = 0.92;
  const BASE = 0.5;
  const slabGeo = new THREE.BoxGeometry(8, 0.16, 8);
  const slabs = new THREE.InstancedMesh(slabGeo, concrete, FLOORS);
  slabs.castShadow = slabs.receiveShadow = true;
  const colGeo = new THREE.BoxGeometry(0.26, FH - 0.16, 0.26);
  const cols = new THREE.InstancedMesh(colGeo, concrete, FLOORS * 9);
  cols.castShadow = true;
  building.add(slabs, cols);

  // lit interior (one per floor) — glows at handover
  const interiorMat = new THREE.MeshStandardMaterial({ color: '#1b2226', emissive: '#ffb469', emissiveIntensity: 0, roughness: 0.6 });
  const interiors = new THREE.InstancedMesh(new THREE.BoxGeometry(7.3, FH - 0.2, 7.3), interiorMat, FLOORS);
  building.add(interiors);

  // --- MEP runs (glowing lines)
  const mepPos = [];
  const mepCol = [];
  const blue = new THREE.Color('#3fc4ec');
  const orange = new THREE.Color('#f28c4b');
  for (let f = 0; f < FLOORS; f++) {
    const y = BASE + f * FH + FH - 0.28;
    // horizontal loop per floor
    const s = 3.2;
    const loop = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (let e = 0; e < 4; e++) {
      const a = loop[e];
      const b = loop[(e + 1) % 4];
      mepPos.push(a[0], y, a[1], b[0], y, b[1]);
      const c = f % 2 ? blue : orange;
      mepCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    // risers
    for (const [rx, rz, c] of [[-1.2, 0.8, blue], [1.2, -0.8, orange], [0, 0, blue]]) {
      mepPos.push(rx, BASE + f * FH, rz, rx, BASE + (f + 1) * FH, rz);
      mepCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  const mepGeo = new THREE.BufferGeometry();
  mepGeo.setAttribute('position', new THREE.Float32BufferAttribute(mepPos, 3));
  mepGeo.setAttribute('color', new THREE.Float32BufferAttribute(mepCol, 3));
  const mep = new THREE.LineSegments(mepGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  building.add(mep);
  const segsPerFloor = 7;

  // --- Façade glass
  const glassMat = new THREE.MeshStandardMaterial({ color: '#6fd3f0', metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0, envMapIntensity: 1 });
  const panelGeo = new THREE.BoxGeometry(8.1, FH - 0.16, 0.06);
  const panels = new THREE.InstancedMesh(panelGeo, glassMat, FLOORS * 4);
  building.add(panels);
  const mullionMat = new THREE.MeshStandardMaterial({ color: '#2b3236', metalness: 0.8, roughness: 0.3 });
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, FH * FLOORS, 0.14), mullionMat, 4 * 7);
  building.add(fins);

  // crown + roof garden
  const crown = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 8.2), new THREE.MeshStandardMaterial({ color: '#2b3236', metalness: 0.6, roughness: 0.4 }));
  const garden = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 5), new THREE.MeshStandardMaterial({ color: '#3f7a4a', roughness: 0.9 }));
  garden.position.y = 0.2;
  const crownEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(8.3, 0.24, 8.3)),
    new THREE.LineBasicMaterial({ color: '#f28c4b', transparent: true, opacity: 1, blending: THREE.AdditiveBlending })
  );
  crown.add(roof, garden, crownEdge);
  crown.position.y = BASE + FLOORS * FH;
  building.add(crown);

  // --- Tower crane
  const crane = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: '#f2a93b', metalness: 0.3, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.5, roughness: 0.5 });
  const MAST = 15;
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.45, MAST, 0.45), yellow);
  mast.position.y = MAST / 2;
  mast.castShadow = true;
  const mastWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.46, MAST, 0.46, 1, 30, 1)), new THREE.LineBasicMaterial({ color: '#7a5a20' }));
  mastWire.position.y = MAST / 2;
  crane.add(mast, mastWire);
  const slew = new THREE.Group();
  slew.position.y = MAST;
  crane.add(slew);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 0.35), yellow);
  jib.position.x = -5;
  jib.castShadow = true;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.35), yellow);
  counter.position.x = 2.2;
  const weight = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.8 }));
  weight.position.set(3.4, -0.5, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), steel);
  cab.position.set(0.2, -0.5, 0);
  const apex = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 4), yellow);
  apex.position.y = 1.1;
  const tie = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-10.5, 0.15, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(3.8, 0.15, 0)]);
  const ties = new THREE.Line(tie, new THREE.LineBasicMaterial({ color: '#b98a3a' }));
  const trolley = new THREE.Group();
  const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);
  const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: '#cfcfcf' }));
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.6), concrete);
  trolley.add(cable, hook);
  slew.add(jib, counter, weight, cab, apex, ties, trolley);
  crane.position.set(6.8, 0, -6.2);
  scene.add(crane);

  // warning light on the crane
  const craneLight = new THREE.PointLight('#ff4d2e', 6, 8, 2);
  craneLight.position.set(0, 2.1, 0);
  slew.add(craneLight);

  // --- Instance layout helpers
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const colOffsets = [];
  for (const x of [-3.7, 0, 3.7]) for (const z of [-3.7, 0, 3.7]) colOffsets.push([x, z]);
  const faces = [
    [0, 4.03, 0],
    [Math.PI / 2, 4.03, 0],
    [Math.PI, 4.03, 0],
    [-Math.PI / 2, 4.03, 0],
  ];
  // fins
  let fi = 0;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 7; k++) {
      const off = -3.9 + k * 1.3;
      const a = side * (Math.PI / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      pos.set(Math.sin(a) * 4.1 + Math.cos(a) * off, BASE + (FH * FLOORS) / 2, Math.cos(a) * 4.1 - Math.sin(a) * off);
      scl.set(1, 1, 1);
      m.compose(pos, q, scl);
      fins.setMatrixAt(fi++, m);
    }
  }

  const state = { p: 0, smooth: 0 };

  function apply(p) {
    // Foundation
    const pf = easeOut(range(p, 0.02, 0.16));
    raft.position.y = -0.6 + pf * 0.85;
    raft.scale.set(Math.max(pf, 0.001), 1, Math.max(pf, 0.001));
    pit.material.opacity = 1;

    // Structure, floor by floor
    const ps = range(p, 0.18, 0.55) * FLOORS;
    let topY = BASE;
    for (let f = 0; f < FLOORS; f++) {
      const t = easeOut(clamp01(ps - f));
      const visible = t > 0.001 ? 1 : 0.0001;
      const yTarget = BASE + f * FH;
      const drop = (1 - t) * 3.5;
      // columns for this floor
      for (let c = 0; c < 9; c++) {
        const [cx, cz] = colOffsets[c];
        pos.set(cx, yTarget + (FH - 0.16) / 2 + drop, cz);
        scl.set(visible, t > 0 ? t : 0.0001, visible);
        q.identity();
        m.compose(pos, q, scl);
        cols.setMatrixAt(f * 9 + c, m);
      }
      pos.set(0, yTarget + FH - 0.08 + drop, 0);
      scl.set(visible, visible, visible);
      m.compose(pos, q, scl);
      slabs.setMatrixAt(f, m);
      if (t > 0.5) topY = yTarget + FH;

      // interiors appear once the floor is placed
      pos.set(0, yTarget + FH / 2 - 0.02, 0);
      const ti = t > 0.98 ? 1 : 0.0001;
      scl.set(ti, ti, ti);
      m.compose(pos, q, scl);
      interiors.setMatrixAt(f, m);

      // façade panels grow bottom-up
      const pg = easeOut(clamp01(range(p, 0.72, 0.9) * FLOORS - f));
      for (let side = 0; side < 4; side++) {
        const a = faces[side][0];
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        pos.set(Math.sin(a) * 4.03, yTarget + FH / 2, Math.cos(a) * 4.03);
        const s = pg > 0.001 ? pg : 0.0001;
        scl.set(1, s, 1);
        m.compose(pos, q, scl);
        panels.setMatrixAt(f * 4 + side, m);
      }
      q.identity();
    }
    slabs.instanceMatrix.needsUpdate = true;
    cols.instanceMatrix.needsUpdate = true;
    interiors.instanceMatrix.needsUpdate = true;
    panels.instanceMatrix.needsUpdate = true;

    // MEP lines draw floor by floor
    const pm = range(p, 0.55, 0.72);
    mep.geometry.setDrawRange(0, Math.floor(pm * FLOORS * segsPerFloor) * 2);
    mep.material.opacity = 0.95 - range(p, 0.86, 0.95) * 0.75;

    // glass + fins
    glassMat.opacity = 0.15 + range(p, 0.72, 0.8) * 0.4;
    if (p < 0.72) glassMat.opacity = 0;
    const pfin = range(p, 0.8, 0.9);
    fins.scale.set(1, Math.max(pfin, 0.0001), 1);
    fins.position.y = (1 - pfin) * (BASE + (FH * FLOORS) / 2);

    // crown + lights at handover
    const ph = range(p, 0.88, 0.97);
    crown.scale.setScalar(Math.max(easeOut(ph), 0.0001));
    interiorMat.emissiveIntensity = range(p, 0.9, 1) * 1.4;
    crownEdge.material.opacity = ph;

    // crane: hook follows the active floor, crane retracts at the end
    const craneOut = range(p, 0.9, 1);
    crane.position.y = -craneOut * 18;
    trolley.position.x = -4.5 - (Math.sin(p * 18) * 0.5 + 0.5) * 3;
    const hookY = Math.max(topY + 1.6 - MAST, -MAST + 1);
    hook.position.y = hookY;
    cableGeo.attributes.position.setY(1, hookY);
    cableGeo.attributes.position.needsUpdate = true;
  }

  // camera
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointer(e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointer, { passive: true });

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

  const clock = new THREE.Clock();
  let active = false;
  const look = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;
    const t = clock.getElapsedTime();
    state.smooth += (state.p - state.smooth) * 0.12;
    const p = state.smooth;
    apply(p);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const angle = -0.9 + p * 1.9 + pointer.x * 0.25 + t * 0.02;
    const radius = (mobile ? 34 : 31) - p * 2;
    const height = 7 + p * 5 - pointer.y * 1.5;
    camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    // on desktop the building sits to the right of the copy column
    const shift = mobile ? 0 : -4.5;
    look.set(Math.cos(angle) * shift, 3.5 + p * 3.5, -Math.sin(angle) * shift);
    if (mobile) look.y -= 2.5;
    camera.lookAt(look);

    slew.rotation.y = Math.sin(t * 0.35) * 0.35 + p * 4;
    craneLight.intensity = 3 + Math.sin(t * 6) * 3;
    renderer.render(scene, camera);
  }
  frame();

  return {
    setProgress(p) { state.p = clamp01(p); },
    setActive(v) { active = v; },
  };
}
