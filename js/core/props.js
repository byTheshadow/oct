/* =========================================================
 * 场景道具（Scene 2 / 2.5 共用）
 *   App.props.castle()  城堡。正面朝向镜头，返回 { group, setTone, world, openDoor }
 *   App.props.qblock()  问号砖块。返回 { mesh, use, dispose }
 *   App.props.pad()     掉下去时接住小猫的软垫。原点在底面，顶面高 PAD_TOP
 * ========================================================= */
App.props = (function () {
  const ROT = Math.PI / 4, C = Math.cos(ROT), SN = Math.sin(ROT);
  // 城堡先按"正面朝 +z"搭，再整体转 45°，正面就朝向镜头（世界的 +x+z）
  const rot = (x, y, z) => new THREE.Vector3(x * C + z * SN, y, -x * SN + z * C);

  function castle() {
    const S = App.stage, P = App.config.palettes.castle;
    const group = new THREE.Group();
    const toned = [];

    // 先转几何体再烘焙明暗，这样明暗按世界方向算
    function part(geo, color, x, y, z, tone = true, min) {
      geo.rotateY(ROT);
      const m = S.shadedMesh(geo, color, min != null ? { min } : undefined);
      m.position.copy(rot(x, y, z));
      group.add(m);
      if (tone) toned.push(m.material);
      return m;
    }
    const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const Cyl = (r, h) => new THREE.CylinderGeometry(r, r * 1.06, h, 8);
    const Cone = (r, h) => new THREE.ConeGeometry(r, h, 8);

    // 主楼 + 正面垛口
    part(Box(1.6, 1.5, 1.6), P.wall, 0, 0.75, 0);
    [-0.48, -0.16, 0.16, 0.48].forEach((x) => part(Box(0.2, 0.22, 0.16), P.wall, x, 1.61, 0.72));
    // 四角塔楼
    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([x, z]) => {
      part(Cyl(0.3, 2.0), P.tower, x, 1.0, z);
      part(Cone(0.42, 0.75), P.roof, x, 2.375, z, true, 0.5);
    });
    // 中间高塔 + 小旗
    part(Cyl(0.42, 2.6), P.tower, 0, 1.3, -0.2);
    part(Cone(0.58, 1.0), P.roof, 0, 3.1, -0.2, true, 0.5);
    part(Box(0.03, 0.5, 0.03), P.trim, 0, 3.85, -0.2);
    part(Box(0.3, 0.17, 0.03), P.flag, 0.15, 3.98, -0.2);
    // 门：后面一块亮的门洞，前面一块暗的门板（openDoor 时门板往上收）
    part(Box(0.44, 0.66, 0.02), P.doorway, 0, 0.33, 0.81, false, 1);
    const door = part(Box(0.5, 0.72, 0.06), P.door, 0, 0.36, 0.83);
    // 高塔上亮着的小窗（白团子在里面）
    part(Box(0.18, 0.26, 0.04), P.window, 0, 2.1, 0.25, false, 1);

    const anchors = { window: rot(0, 2.1, 0.3), gate: rot(0, 0.36, 0.9) };

    return {
      group,
      /** 0..1，越小越像剪影（窗户和门洞不受影响） */
      setTone(v) { toned.forEach((m) => m.color.setScalar(v)); },
      /** 锚点的世界坐标（只算了 group 的位置和统一缩放） */
      world(name, out = new THREE.Vector3()) {
        return out.copy(anchors[name]).multiplyScalar(group.scale.x).add(group.position);
      },
      openDoor(ms = 900) {
        return App.util.tween(ms, (e) => {
          const sy = 1 - 0.95 * e;
          door.scale.y = sy;
          door.position.y = 0.72 - 0.36 * sy;
        }, App.util.ease.inOutCubic);
      }
    };
  }

  function faceTexture(palName) {
    const map = App.sprites.ART.QBLOCK;
    const t = App.stage.pixelTexture(App.sprites.render(map, App.config.palettes[palName]));
    const n = map.length + 2;               // 裁掉 render 四周留的那一格
    t.repeat.set((n - 2) / n, (n - 2) / n);
    t.offset.set(1 / n, 1 / n);
    return t;
  }

  function qblock(size = 0.55) {
    const t1 = faceTexture('qblock'), t2 = faceTexture('qblockUsed');
    // 面的顺序：+x -x +y -y +z -z。镜头看得到 +x +y +z
    const mats = [0.8, 0.5, 1, 0.45, 0.64, 0.5].map(
      (k) => new THREE.MeshBasicMaterial({ map: t1, color: new THREE.Color(k, k, k) })
    );
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
    return {
      mesh,
      used: false,
      use() {
        if (this.used) return;
        this.used = true;
        mats.forEach((m) => { m.map = t2; m.needsUpdate = true; });
      },
      dispose() { t1.dispose(); t2.dispose(); }
    };
  }

  const PAD_TOP = 0.34;
  function pad() {
    const S = App.stage, P = App.config.palettes.pad;
    const g = new THREE.Group();
    const body = S.shadedMesh(new THREE.CylinderGeometry(0.72, 0.78, 0.28, 8), P.body);
    body.position.y = 0.14;
    g.add(body);
    const cap = S.shadedMesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 8), P.cap);
    cap.position.y = 0.31;
    g.add(cap);
    return g;
  }

  return { castle, qblock, pad, PAD_TOP };
})();
