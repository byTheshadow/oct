/* =========================================================
 * Scene 1 · 小猫
 * 悬空小岛上坐着黑色小猫（小寒）。
 *   点小猫：随机眨眼 / 歪头 / 甩尾巴 / 原地蹦一下
 *   连点十下：炸毛 + "喵？"
 * 想完两句话后，路块从下方升起、咔哒拼接，小猫自己蹦上去。
 * ========================================================= */
App.director.register('scene1', {
  enter(ctx) {
    const U = App.util, S = App.stage, A = App.audio;
    const T = App.config.text.scene1;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    S.setView(9.5);
    S.focus(V(0, 0.7, 0), true);

    // ---------- 远景：弥散光斑 + 云 ----------
    S.addGlows([
      { color: '#ffffff', size: 7,  pos: [-2, -4, 3],    opacity: 0.16 },
      { color: '#d6dcff', size: 9,  pos: [4, -5, -2],    opacity: 0.12 },
      { color: '#ffffff', size: 6,  pos: [-6, -3, -5],   opacity: 0.14 },
      { color: '#e8deff', size: 8,  pos: [-4, -5, -10],  opacity: 0.12 },
      { color: '#ffffff', size: 10, pos: [-11, -6, -9],  opacity: 0.10 },
      { color: '#ffffff', size: 5,  pos: [-10, -2, -12], opacity: 0.18, amp: 0.2 }
    ]);
    S.addGlows([
      { color: '#ffffff', size: 4, stretch: 3, pos: [1, -6, 1],    opacity: 0.08, blend: 'normal', amp: 1.2, speed: 0.05 },
      { color: '#ffffff', size: 5, stretch: 3, pos: [-7, -7, -6],  opacity: 0.07, blend: 'normal', amp: 1.2, speed: 0.04 },
      { color: '#ffffff', size: 4, stretch: 3, pos: [-12, -6, -13], opacity: 0.07, blend: 'normal', amp: 1.0, speed: 0.05 }
    ]);
    S.addParticles({ count: 36, opacity: 0.5, size: 3 });

    // ---------- 中景：小岛 + 小猫 ----------
    S.layers.mid.add(S.island({ w: 2.2, d: 2.2, h: 0.5, depth: 1.8 }));
    const cat = new App.Cat('xiaohan', 1.25).addTo(S.layers.mid).setPosition(0, 0, 0);
    const bubble = App.bubble.create((out) => cat.headPos(out));

    // ---------- 点小猫 ----------
    const ov = document.getElementById('overlay');
    const hint = U.el('div', 'soft-hint', ov, T.hint);
    let taps = 0, walking = false;

    const reactions = [
      () => cat.blink(),
      () => cat.tilt(),
      () => cat.flick(),
      () => { if (!walking) cat.hopInPlace(); }
    ];

    const onDown = (e) => {
      if (!cat.hit(e.clientX, e.clientY)) return;
      hint.classList.remove('on');
      taps++;
      if (taps >= 10) {
        taps = 0;
        cat.puff();
        A.meow();
        bubble.say(T.puff, { hold: 900, speed: 40 });
      } else {
        U.pick(reactions)();
        A.blip({ freq: 480 + taps * 40, type: 'sine', vol: 0.04, dur: 0.06 });
      }
    };
    S.el.addEventListener('pointerdown', onDown);
    this._cleanup = () => S.el.removeEventListener('pointerdown', onDown);

    // ---------- 路块 ----------
    const N = 6;
    const blocks = [];
    for (let i = 0; i < N; i++) {
      const d = 1.75 + i * 1.35;
      const b = S.island({ w: 1, d: 1, h: 0.35, depth: 0.8 });
      b.visible = false;
      b.position.set(-d, -9, -d);
      S.layers.mid.add(b);
      blocks.push({ b, p: V(-d, 0, -d) });
    }
    // 路的尽头有一点微光，像在叫小猫过去
    const lure = S.addGlows([
      { color: '#ffffff', size: 1.6, pos: [-1.75 - (N + 0.6) * 1.35, 0.9, -1.75 - (N + 0.6) * 1.35], opacity: 0, amp: 0.05, speed: 0.6 }
    ], 'mid')[0];

    async function raisePath() {
      for (const { b, p } of blocks) {
        if (!ctx.alive()) return;
        b.visible = true;
        A.whoosh(0.03, 0.45);
        U.tween(560, (e) => { b.position.y = U.lerp(-9, p.y, e); }, U.ease.outBack).then(() => {
          A.click();
          U.tween(220, (e, k) => {
            const s = 1 + Math.sin(Math.PI * k) * 0.08;
            b.scale.set(s, 1 / s, s);
          }, U.ease.linear);
        });
        await U.sleep(280);
      }
      await U.sleep(700);
      lure.userData.op = 0.55;
    }

    async function walk() {
      walking = true;
      cat.idle = false;
      for (const { p } of blocks) {
        if (!ctx.alive()) return;
        S.focus(V(p.x, 0.7, p.z), false, 2.5);
        await cat.hopTo(p, 430, 0.6);
        A.blip({ freq: 300, type: 'sine', vol: 0.05, dur: 0.08, jitter: 0.1 });
        await U.sleep(200);
      }
      cat.idle = true;
    }

    // ---------- 流程 ----------
    (async () => {
      await U.sleep(1400);
      if (!ctx.alive()) return;
      hint.classList.add('on');
      cat.blink();
      await U.sleep(800);
      cat.tilt(-1);
      await bubble.say(T.thoughts[0], { hold: 1700 });
      await U.sleep(800);
      if (!ctx.alive()) return;
      cat.tilt(1);
      await bubble.say(T.thoughts[1], { hold: 1500 });
      hint.classList.remove('on');
      await U.sleep(500);
      if (!ctx.alive()) return;

      await raisePath();
      await U.sleep(400);
      await walk();
      if (!ctx.alive()) return;
      await U.sleep(1100);
      ctx.next();
    })();
  },

  exit() {
    this._cleanup && this._cleanup();
  }
});
