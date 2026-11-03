/* =========================================================
 * 3D 舞台：一个全程共用的 three.js 场景
 *   - 等距正交相机，focus() 平滑跟随
 *   - 三层视差 layers.far / mid / near，陀螺仪驱动
 *   - onUpdate(fn) 注册每帧回调；clear() 切章时清空
 *   - 全局饱和度：setSaturation()（CSS 滤镜作用在 #stage 上）
 *   - 工具：pixelTexture / island / addGlows / addParticles / project
 * 颜色管理全部关掉：写什么 hex 就显示什么颜色，对像素画最友好。
 * ========================================================= */
App.stage = (function () {
  if (!window.THREE) return null;

  let el, renderer, scene, camera;
  const layers = {};
  let updaters = [];
  let viewH = 10, followK = 3;
  let last = 0, time = 0, fps = 60;

  const camPos = new THREE.Vector3();
  const camGoal = new THREE.Vector3();
  const DIR = new THREE.Vector3(1, 1, 1).normalize();   // 相机所在方向
  const RIGHT = new THREE.Vector3(1, 0, -1).normalize(); // 屏幕向右在世界里的方向
  const UP = new THREE.Vector3(-1, 2, -1).normalize();   // 屏幕向上在世界里的方向
  const PARALLAX = { far: 0.45, mid: 0, near: -0.75 };
  const LIGHT = new THREE.Vector3(0.6, 1, 0.2).normalize();
  const tmp = new THREE.Vector3();

  function init(container) {
    el = container;

    const CM = THREE.ColorManagement;
    if (CM) {
      if ('enabled' in CM) CM.enabled = false;
      else if ('legacyMode' in CM) CM.legacyMode = true;
    }

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    else if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.LinearEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#000000', 1);
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    ['far', 'mid', 'near'].forEach((k) => {
      layers[k] = new THREE.Group();
      layers[k].name = k;
      scene.add(layers[k]);
    });

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = el.clientWidth || innerWidth;
    const h = el.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    camera.left = (-viewH * a) / 2;
    camera.right = (viewH * a) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    time += dt;
    if (dt > 0) fps = fps * 0.95 + (1 / dt) * 0.05;

    App.tilt.update(dt);

    camPos.lerp(camGoal, 1 - Math.exp(-followK * dt));
    camera.position.copy(camPos).addScaledVector(DIR, 60);
    camera.lookAt(camPos);
    camera.updateMatrixWorld();

    const tx = App.tilt.x, ty = App.tilt.y;
    for (const k in PARALLAX) {
      const p = PARALLAX[k];
      layers[k].position.set(0, 0, 0)
        .addScaledVector(RIGHT, -tx * p)
        .addScaledVector(UP, ty * p);
    }
    scene.updateMatrixWorld();

    const list = updaters.slice();
    for (let i = 0; i < list.length; i++) {
      try { list[i](dt, time); } catch (e) { console.error(e); }
    }
    renderer.render(scene, camera);
  }

  /** 每帧回调 fn(dt, time)。返回取消函数 */
  function onUpdate(fn) {
    updaters.push(fn);
    return () => { updaters = updaters.filter((f) => f !== fn); };
  }

  function disposeObj(o) {
    o.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      const mats = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
      mats.forEach((m) => {
        if (m.map && !(m.map.userData && m.map.userData.shared)) m.map.dispose();
        m.dispose();
      });
    });
  }

  /** 切章时调用：清空三层内容和所有每帧回调 */
  function clear() {
    updaters = [];
    for (const k in layers) {
      const L = layers[k];
      while (L.children.length) {
        const c = L.children[0];
        L.remove(c);
        disposeObj(c);
      }
    }
  }

  // ---------- 相机 / 外观 ----------
  function focus(v, instant = false, k = 3) {
    camGoal.copy(v);
    if (instant) camPos.copy(v);
    followK = k;
  }
  function setView(h) { viewH = h; resize(); }
  function setBackground(hex) { renderer.setClearColor(hex, 1); }
  function setVisible(v) { el.style.opacity = v ? '1' : '0'; }
  function setSaturation(s, sec = 2.5) {
    el.style.transition = `filter ${sec}s ease, opacity 1.2s ease`;
    el.style.filter = s >= 0.999 ? 'saturate(1)' : `saturate(${s})`;
  }

  /** 世界坐标 → 屏幕 CSS 像素 */
  function project(v) {
    tmp.copy(v).project(camera);
    return {
      x: ((tmp.x + 1) / 2) * el.clientWidth,
      y: ((1 - tmp.y) / 2) * el.clientHeight
    };
  }

  // ---------- 工具 ----------
  function pixelTexture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  }

  /** 按面朝向烘焙明暗（不依赖灯光，各版本 three 表现一致） */
  function shadedMesh(geo, color, { min = 0.42, opacity = 1 } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.computeVertexNormals();
    const n = g.attributes.normal;
    const cnt = n.count;
    const colors = new Float32Array(cnt * 3);
    const base = new THREE.Color(color);
    const v = new THREE.Vector3();
    for (let i = 0; i < cnt; i += 3) {
      v.fromBufferAttribute(n, i);
      const k = min + (1 - min) * Math.max(0, v.dot(LIGHT));
      for (let j = 0; j < 3; j++) {
        colors[(i + j) * 3] = base.r * k;
        colors[(i + j) * 3 + 1] = base.g * k;
        colors[(i + j) * 3 + 2] = base.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity });
    return new THREE.Mesh(g, m);
  }

  /** 悬空小岛：顶面在 y=0，下面挂一个倒金字塔 */
  function island({ w = 2, d = 2, h = 0.5, depth = 1.6, color = '#c9cad2', cap = '#e4e5ea', under = '#7d7f8c' } = {}) {
    const g = new THREE.Group();
    const body = shadedMesh(new THREE.BoxGeometry(w, h, d), color);
    body.position.y = -h / 2;
    g.add(body);
    const top = shadedMesh(new THREE.BoxGeometry(w * 1.02, 0.08, d * 1.02), cap);
    top.position.y = -0.03;
    g.add(top);
    const r = (w / 2) * Math.SQRT2 * 0.92;
    const cg = new THREE.ConeGeometry(r, depth, 4, 1);
    cg.rotateY(Math.PI / 4);
    cg.rotateX(Math.PI);
    cg.scale(1, 1, d / w);
    const cone = shadedMesh(cg, under, { min: 0.35 });
    cone.position.y = -h - depth / 2;
    g.add(cone);
    return g;
  }

  /**
   * 弥散光斑（预渲染贴图 + 叠加混合）。同屏建议不超过 6 个。
   * list: [{ color, size, pos:[x,y,z], opacity, stretch, blend:'add'|'normal', amp, speed }]
   */
  function addGlows(list, layer = 'far') {
    const sprites = list.map((o) => {
      const m = new THREE.SpriteMaterial({
        map: App.glow.texture(),
        color: o.color || '#ffffff',
        transparent: true,
        opacity: o.opacity != null ? o.opacity : 0.4,
        depthWrite: false,
        depthTest: false,
        blending: o.blend === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending
      });
      const s = new THREE.Sprite(m);
      const size = o.size || 6;
      s.scale.set(size * (o.stretch || 1), size, 1);
      s.position.set(o.pos[0], o.pos[1], o.pos[2]);
      s.renderOrder = -10;
      s.userData = {
        base: s.position.clone(),
        ph: Math.random() * Math.PI * 2,
        sp: o.speed || 0.15,
        amp: o.amp != null ? o.amp : 0.6,
        op: m.opacity
      };
      layers[layer].add(s);
      return s;
    });
    onUpdate((dt, t) => {
      sprites.forEach((s) => {
        const u = s.userData;
        s.position.x = u.base.x + Math.sin(t * u.sp + u.ph) * u.amp;
        s.position.z = u.base.z + Math.cos(t * u.sp * 0.8 + u.ph) * u.amp;
        s.material.opacity = u.op * (0.75 + 0.25 * Math.sin(t * 0.6 + u.ph));
      });
    });
    return sprites;
  }

  /** 漂浮微粒，始终围绕相机 */
  function addParticles({ count = 40, area = 14, color = '#ffffff', size = 3, opacity = 0.6, speed = 0.25, layer = 'near' } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * area;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: false,
      map: App.glow.texture(), transparent: true, opacity,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 10;
    pts.frustumCulled = false;
    layers[layer].add(pts);

    const wrap = (v, c) => {
      const lo = c - area / 2;
      return lo + ((((v - lo) % area) + area) % area);
    };
    onUpdate((dt) => {
      const a = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        a[i * 3 + 1] += speed * dt * (0.5 + (i % 5) / 5);
        if (a[i * 3 + 1] > camPos.y + 4) a[i * 3 + 1] = camPos.y - 4;
        a[i * 3] = wrap(a[i * 3], camPos.x);
        a[i * 3 + 2] = wrap(a[i * 3 + 2], camPos.z);
      }
      geo.attributes.position.needsUpdate = true;
    });
    return pts;
  }

  return {
    init, onUpdate, clear, focus, setView, setBackground, setVisible, setSaturation, project,
    pixelTexture, shadedMesh, island, addGlows, addParticles,
    layers, DIR, RIGHT, UP,
    get el() { return el; },
    get camera() { return camera; },
    get scene() { return scene; },
    get renderer() { return renderer; },
    get time() { return time; },
    get fps() { return fps; }
  };
})();
