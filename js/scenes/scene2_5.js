/* =========================================================
 * Scene 2.5 · 城堡门口
 *   守门猛兽从天而降，挡住门。点屏幕：小黑猫瞳孔放大、眼睛一亮，
 *   猛兽先眨眼，眉毛松开，让到一边，门板升起。
 *   城堡里：白团子抱着空唱片套缩在角落。对话中报出名字（之后用 names.btReal）。
 *   转场：地面碎裂，两只猫一起往下坠，镜头跟随，接下一章。
 * 坐标：s = 沿路前进的距离（屏幕正上方），r = 横向（屏幕右为正）
 * ========================================================= */
App.director.register('scene2_5', {
  enter(ctx) {
    const U = App.util, S = App.stage, A = App.audio;
    const T = App.config.text.scene2_5;
    const N = App.config.names;
    const PAL = App.config.palettes;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const K = Math.SQRT1_2;
    const P = (s, r = 0, y = 0) => V((r - s) * K, y, (-s - r) * K);
    const arr = (v) => [v.x, v.y, v.z];
    const tmp = V(0, 0, 0);
    const fadeEl = document.getElementById('fade');

    const cam = S.camera;
    cam.zoom = 1;
    cam.updateProjectionMatrix();
    S.setView(10);

    const VOICE_BEAST = { freq: 140, type: 'sawtooth', vol: 0.03, dur: 0.09, jitter: 0.12 };
    const VOICE_PURR  = { freq: 95,  type: 'triangle', vol: 0.05, dur: 0.12, jitter: 0.15 };

    async function shake(center, n = 7, amp = 0.12) {
      for (let i = 0; i < n; i++) {
        S.focus(center.clone().add(V(U.rand(-amp, amp), U.rand(-amp, amp) * 0.5, U.rand(-amp, amp))), true);
        await U.sleep(35);
      }
      S.focus(center, true);
    }

    // ---------- 远景（门外门内共用） ----------
    S.addGlows([
      { color: '#ffffff', size: 8,  pos: [-2, -5, 3],   opacity: 0.11 },
      { color: '#d6dcff', size: 9,  pos: [4, -6, -2],   opacity: 0.09 },
      { color: '#f2d6e6', size: 9,  pos: [-6, -5, -6],  opacity: 0.10 },
      { color: '#ffffff', size: 10, pos: [-10, -4, -9], opacity: 0.08 }
    ]);
    S.addParticles({ count: 28, opacity: 0.4, size: 3 });

    const outside = new THREE.Group();
    const inside = new THREE.Group();
    inside.visible = false;
    S.layers.mid.add(outside);
    S.layers.mid.add(inside);

    // ================= 门外 =================
    outside.add(S.island({ w: 4.2, d: 4.2, h: 0.6, depth: 3 }));
    const castle = App.props.castle();
    castle.group.position.copy(P(1.1));
    castle.group.scale.setScalar(1.2);
    outside.add(castle.group);
    const winGlow = S.addGlows([
      { color: '#ffe7a8', size: 1.6, pos: arr(castle.world('window')), opacity: 0.55, amp: 0.02, speed: 0.5 }
    ], 'mid')[0];
    outside.add(winGlow);

    const cat = new App.Cat('xiaohan', 1.25).addTo(S.layers.mid).setPosition(...arr(P(-2.2)));
    const catB = App.bubble.create((o) => cat.headPos(o));

    const beast = new App.Critter(App.sprites.set('beast'), 2.4, { autoBlink: false, breathe: 0.015 }).addTo(outside);
    const beastSpot = P(-0.45);
    beast.setPosition(P(-0.45, 0, 8));
    beast.sprite.visible = false;
    const beastB = App.bubble.create((o) => beast.headPos(o));

    // 小黑猫眼睛一亮时的光晕（平时不可见）
    const halo = S.addGlows([{ color: '#f0c04e', size: 1.3, pos: [0, 0, 0], opacity: 0, amp: 0, speed: 1 }], 'mid')[0];
    halo.userData.op = 0;
    S.onUpdate(() => {
      halo.userData.base.copy(cat.sprite.position);
      halo.userData.base.y += cat.h * 0.5;
    });

    const camOut = P(-0.9, 0, 1.0);
    S.focus(camOut, true);

    // ---------- 输入：门外只等一下点击 ----------
    const ov = document.getElementById('overlay');
    const hint = U.el('div', 'soft-hint', ov, T.hint);
    let tapResolve = null;
    const waitTap = () => new Promise((r) => { tapResolve = r; });
    const onDown = () => {
      if (!tapResolve) return;
      const r = tapResolve;
      tapResolve = null;
      r();
    };
    S.el.addEventListener('pointerdown', onDown);
    this._cleanup = () => S.el.removeEventListener('pointerdown', onDown);

    // ================= 门内 =================
    const R = PAL.room;
    const tiles = [];
    let bt = null, btB = null, sleeve = null, trembling = true;

    function buildInside() {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const x = -1.35 + i * 0.9, z = -1.35 + j * 0.9;
          const m = S.shadedMesh(new THREE.BoxGeometry(0.86, 0.3, 0.86), (i + j) % 2 ? R.floorA : R.floorB);
          m.position.set(x, -0.15, z);
          inside.add(m);
          tiles.push({ m, x, z, vy: 0, spin: U.rand(-2, 2), falling: false });
        }
      }
      const wallL = S.shadedMesh(new THREE.BoxGeometry(0.2, 2.6, 3.8), R.wall);
      wallL.position.set(-1.9, 1.0, -0.1);
      const wallR = S.shadedMesh(new THREE.BoxGeometry(3.8, 2.6, 0.2), R.wall);
      wallR.position.set(-0.1, 1.0, -1.9);
      const moon = S.shadedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), R.moon, { min: 1 });
      moon.position.set(0.5, 1.45, -1.79);
      const banner = S.shadedMesh(new THREE.BoxGeometry(0.04, 0.9, 0.42), R.banner, { min: 0.8 });
      banner.position.set(-1.79, 1.35, 0.5);
      inside.add(wallL, wallR, moon, banner);
      const moonGlow = S.addGlows([{ color: '#cfe0ff', size: 1.8, pos: [0.5, 1.45, -1.7], opacity: 0.35, amp: 0.02, speed: 0.4 }], 'mid')[0];
      inside.add(moonGlow);

      // 白团子：缩在角落，抱着空唱片套
      bt = new App.Cat('baituanzi', 1.05).addTo(inside).setPosition(-1.25, 0, -1.25);
      btB = App.bubble.create((o) => bt.headPos(o));
      const sc = App.sprites.set('sleeve').sit;
      sleeve = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.pixelTexture(sc), transparent: true, alphaTest: 0.1 }));
      sleeve.center.set(0.5, App.sprites.MARGIN / (sc.height / 4));
      sleeve.scale.set(0.56, 0.56, 1);
      inside.add(sleeve);
      S.onUpdate((dt, t) => {
        if (trembling) bt.sprite.position.x += Math.sin(t * 38) * 0.012;
        sleeve.position.copy(bt.sprite.position).add(V(0.27, 0.04, 0.27));
      });

      // 小黑猫从门口进来
      cat.addTo(inside);
      cat.setPosition(1.3, 0, 1.3);
      S.setView(9.5);
      S.focus(V(0, 0.8, 0), true);
    }

    // ---------- 地面碎裂、一起往下坠 ----------
    async function collapse() {
      // 先抖
      let quake = true;
      S.onUpdate(() => {
        if (!quake) return;
        tiles.forEach((t) => {
          if (t.falling) return;
          t.m.position.x = t.x + U.rand(-0.025, 0.025);
          t.m.position.z = t.z + U.rand(-0.025, 0.025);
        });
      });
      cat.puff();
      bt.puff();
      for (let k = 0; k < 6; k++) {
        if (!ctx.alive()) return;
        A.click(0.1 + k * 0.035);
        if (k === 2) btB.say(T.uhoh, { voice: 'bt', hold: 600, speed: 50 });
        await U.sleep(150);
      }
      quake = false;
      if (!ctx.alive()) return;

      // 从两只猫中间开始往外碎
      const cx = -0.6, cz = -0.6;
      tiles.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
      tiles.forEach((t, i) => setTimeout(() => {
        t.falling = true;
        A.click(0.06);
      }, i * 45 + U.rand(0, 60)));

      const cats = [cat, bt];
      let catsFalling = false, vy = 0;
      const mid = V(0, 0, 0);
      S.onUpdate((dt, t) => {
        tiles.forEach((tl) => {
          if (!tl.falling) return;
          tl.vy -= 9 * dt;
          tl.m.position.y += tl.vy * dt;
          tl.m.rotation.x += tl.spin * dt;
          tl.m.rotation.z += tl.spin * 0.7 * dt;
        });
        if (!catsFalling) return;
        vy -= 6 * dt;
        mid.set(0, 0, 0);
        cats.forEach((c) => mid.add(c.base));
        mid.multiplyScalar(0.5);
        cats.forEach((c, i) => {
          c.base.y += vy * dt;
          // 慢慢靠到一起
          c.base.x += (mid.x - c.base.x) * (1 - Math.exp(-1.2 * dt));
          c.base.z += (mid.z - c.base.z) * (1 - Math.exp(-1.2 * dt));
          c.leanTarget = Math.sin(t * 3 + i * 1.7) * 0.4;
        });
        S.focus(tmp.set(mid.x, mid.y + 0.4, mid.z), false, 5);
      });

      await U.sleep(250);
      if (!ctx.alive()) return;
      cats.forEach((c) => { c.idle = false; c.squash = -0.8; });
      catsFalling = true;
      A.whoosh(0.08, 1.8);
      await U.sleep(500);
      if (!ctx.alive()) return;
      btB.say(T.falling, { voice: 'bt', hold: 900, speed: 45 });
      await U.sleep(1300);
      if (!ctx.alive()) return;
      ctx.next();   // 黑场时两只猫还在往下掉
    }

    // ---------- 流程 ----------
    (async () => {
      await U.sleep(1000);
      if (!ctx.alive()) return;
      cat.tilt(-1);
      await catB.say(T.door, { hold: 1200 });
      if (!ctx.alive()) return;

      // 猛兽从天而降
      beast.sprite.visible = true;
      const top = beast.base.clone();
      A.whoosh(0.05, 0.4);
      await U.tween(420, (e) => { beast.base.lerpVectors(top, beastSpot, e); }, (t) => t * t);
      if (!ctx.alive()) return;
      beast.squash = 1.2;
      A.click(0.32);
      A.blip({ freq: 70, type: 'sine', vol: 0.12, dur: 0.25, jitter: 0 });
      cat.puff();
      await shake(camOut);
      await U.sleep(400);
      if (!ctx.alive()) return;
      await catB.say(T.startle, { hold: 800 });
      await U.sleep(250);
      if (!ctx.alive()) return;
      await beastB.say(T.growl, { voice: VOICE_BEAST, hold: 900, speed: 90 });
      if (!ctx.alive()) return;

      // 等一下点击
      hint.classList.add('on');
      await waitTap();
      if (!ctx.alive()) return;
      hint.classList.remove('on');

      // 小黑猫瞳孔放大、眼睛一亮
      cat.idle = false;
      cat.flash('wide', 2.6);
      cat.squash = -0.3;
      A.blip({ freq: 1320, type: 'sine', vol: 0.05, dur: 0.18, jitter: 0 });
      setTimeout(() => A.blip({ freq: 1760, type: 'sine', vol: 0.045, dur: 0.25, jitter: 0 }), 90);
      U.tween(1800, (e) => { halo.userData.op = 0.85 * (1 - e); }, U.ease.linear);
      await U.sleep(1100);
      if (!ctx.alive()) return;

      // 猛兽先眨眼
      beast.blink();
      A.blip({ freq: 260, type: 'sine', vol: 0.04, dur: 0.06, jitter: 0 });
      await U.sleep(300);
      beast.blink();
      await U.sleep(450);
      if (!ctx.alive()) return;
      beast.setRest('soft');
      beast.autoBlink = true;
      beast.squash = -0.3;
      halo.visible = false;
      cat.idle = true;
      await beastB.say(T.purr, { voice: VOICE_PURR, hold: 900, speed: 110 });
      if (!ctx.alive()) return;

      // 让开
      A.whoosh(0.04, 0.4);
      await beast.hopTo(P(-0.75, -1.55), 520, 0.5);
      A.click(0.2);
      await U.sleep(300);
      if (!ctx.alive()) return;

      // 开门
      A.whoosh(0.05, 0.9);
      await castle.openDoor(900);
      A.click(0.18);
      await U.sleep(500);
      if (!ctx.alive()) return;
      await cat.hopTo(P(-1.25), 420, 0.5);
      await cat.hopTo(P(-0.3), 420, 0.5);
      if (!ctx.alive()) return;

      // 进门：自己黑一下场
      fadeEl.classList.add('on');
      await U.sleep(950);
      if (!ctx.alive()) return;
      outside.visible = false;
      buildInside();
      await U.sleep(80);
      fadeEl.classList.remove('on');
      await U.sleep(900);
      if (!ctx.alive()) return;

      // ---------- 门内 ----------
      await cat.hopTo(V(0.65, 0, 0.65), 420, 0.5);
      await cat.hopTo(V(0.05, 0, 0.05), 420, 0.5);
      if (!ctx.alive()) return;
      await U.sleep(400);
      trembling = false;
      bt.blink();
      await U.sleep(300);
      bt.tilt(1);
      await catB.say(T.found, { hold: 1400 });
      if (!ctx.alive()) return;

      await App.dialog.say(T.btFirst, { name: N.bt, voice: 'bt' });
      if (!ctx.alive()) return;
      cat.tilt(-1);
      await catB.say(T.princess, { hold: 1500 });
      if (!ctx.alive()) return;
      bt.puff();
      await App.dialog.say(T.flustered, { name: N.bt, voice: 'bt' });
      if (!ctx.alive()) return;

      // 从角落里出来一步，报名字
      await bt.hopTo(V(-0.75, 0, -0.75), 420, 0.4);
      await App.dialog.say(T.namePre, { name: N.bt, voice: 'bt' });
      if (!ctx.alive()) return;
      bt.hopInPlace();
      A.coin(4);
      setTimeout(() => A.coin(7), 110);
      await App.dialog.say(T.name, { name: N.btReal, voice: 'bt' });
      if (!ctx.alive()) return;
      await App.dialog.say(T.record, { name: N.btReal, voice: 'bt' });
      if (!ctx.alive()) return;

      cat.flick();
      A.meow(0.1);
      await catB.say(T.agree, { hold: 900 });
      await U.sleep(500);
      if (!ctx.alive()) return;
      await collapse();
    })();
  },

  exit() {
    this._cleanup && this._cleanup();
    const cam = App.stage.camera;
    cam.zoom = 1;
    cam.updateProjectionMatrix();
  }
});
