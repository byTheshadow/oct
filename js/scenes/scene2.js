/* =========================================================
 * Scene 2 · 通往城堡的路（跳一跳）
 *   按住蓄力：小猫压扁、蓄力条上涨、音调升高；松手起跳，距离和按住时长成正比
 *   跳 3 格到城堡门前的岛；每跳一格，镜头拉近、城堡从剪影变亮，白团子在远处小声喊一句
 *   掉下去：软垫弹回原平台 + 字幕，不会 game over；同一格连续掉两次，蓄力条上出现参考刻度
 *   音符 ♪ 悬在路线上，跳过去就吃到；集满：画面渗进一抹粉，小黑猫头上冒出兔耳
 *   问号砖块：跳起来顶开，弹出代码彩蛋（直接点它也行）
 *   观众：小猪猪、坏猫，点了会"哼唧""喵"
 * 坐标：s = 沿路前进的距离（屏幕正上方），r = 横向（屏幕右为正）
 * ========================================================= */
App.director.register('scene2', {
  enter(ctx) {
    const U = App.util, S = App.stage, A = App.audio;
    const T = App.config.text.scene2;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const K = Math.SQRT1_2;
    const P = (s, r = 0, y = 0) => V((r - s) * K, y, (-s - r) * K);
    const arr = (v) => [v.x, v.y, v.z];
    const inQuad = (t) => t * t;
    const tmp = V(0, 0, 0);

    // ---------- 手感参数 ----------
    const CHARGE_MS = 1000;             // 蓄满要按多久
    const MIN_HOLD = 0.08;              // 低于这个蓄力比例＝没按够，不跳（避免一点一下就自动跳出去）
    const MIN = 0.5, MAX = 3.6;         // 跳远距离（按一下 ~ 蓄满）
    const arcH = (d) => 0.85 + 0.12 * d; // 跳得越远抛得越高
    const BODY = 0.55;                  // 小猫身体中心离脚底的高度（吃音符用）
    const EAT_R = 0.8;                  // 吃音符的判定半径
    const ZOOMS = [1, 1.12, 1.25, 1.38];   // 每跳一格镜头拉近
    const TONES = [0.3, 0.5, 0.72, 1];     // 每跳一格城堡变亮
    const LEADS = [2.6, 2.0, 1.5, 1.1];    // 镜头往前看多远

    const cam = S.camera;
    cam.zoom = 1;
    cam.updateProjectionMatrix();
    S.setView(13);

    const zoomTo = (z, ms = 1100) => {
      const z0 = cam.zoom;
      return U.tween(ms, (e) => {
        if (!ctx.alive()) return;
        cam.zoom = U.lerp(z0, z, e);
        cam.updateProjectionMatrix();
      }, U.ease.inOutCubic);
    };

    // ---------- 远景 ----------
    S.addGlows([
      { color: '#ffffff', size: 8,  pos: arr(P(1, -3, -4)),    opacity: 0.12 },
      { color: '#d6dcff', size: 9,  pos: arr(P(4.5, 3, -5)),   opacity: 0.10 },
      { color: '#e8deff', size: 8,  pos: arr(P(8, -3.5, -5)),  opacity: 0.10 },
      { color: '#ffffff', size: 10, pos: arr(P(12.5, 1.5, -4)), opacity: 0.09 }
    ]);
    S.addParticles({ count: 30, opacity: 0.45, size: 3 });

    // ---------- 平台 ----------
    // 第 0 格是 Scene 1 的最后一块路；第 3 格是城堡门前的岛（lo/hi 是能落脚的范围，stand 是最远站到哪）
    const PLATS = [
      { s: 0,    y: 0,  w: 1,   h: 0.35, depth: 0.8 },
      { s: 2.4,  y: 0,  w: 1.1, h: 0.4,  depth: 1.0 },
      { s: 5.4,  y: 0,  w: 1.0, h: 0.4,  depth: 1.1 },
      { s: 9.05, y: -1, w: 3.4, h: 0.6,  depth: 2.6, lo: 7.0, hi: 11.0, stand: 7.8, aim: 7.5 }
    ];
    PLATS.forEach((p) => {
      const tol = p.w * K * 0.85;         // 沿对角线走，正方形能落脚的半径
      if (p.lo == null) { p.lo = p.s - tol; p.hi = p.s + tol; }
      if (p.aim == null) p.aim = p.s;
      p.mesh = S.island({ w: p.w, d: p.w, h: p.h, depth: p.depth });
      p.mesh.position.copy(P(p.s, 0, p.y));
      S.layers.mid.add(p.mesh);
    });
    // Scene 1 走过来的路
    [1, 2].forEach((i) => {
      const b = S.island({ w: 1, d: 1, h: 0.35, depth: 0.8 });
      b.position.copy(P(-1.35 * Math.SQRT2 * i));
      S.layers.mid.add(b);
    });
    const inZone = (p, s) => s >= p.lo && s <= p.hi;

    // ---------- 城堡 ----------
    const castle = App.props.castle();
    castle.group.position.copy(P(9.4, 0, -1));
    castle.setTone(TONES[0]);
    S.layers.mid.add(castle.group);
    const winPos = castle.world('window');
    S.addGlows([{ color: '#ffe7a8', size: 1.4, pos: arr(winPos), opacity: 0.5, amp: 0.02, speed: 0.5 }], 'mid');
    let tone = TONES[0];
    const toneTo = (v) => {
      const v0 = tone;
      return U.tween(1200, (e) => { tone = U.lerp(v0, v, e); castle.setTone(tone); });
    };

    // ---------- 小猫 ----------
    const cat = new App.Cat('xiaohan', 1.25).addTo(S.layers.mid).setPosition(0, 0, 0);
    const catB = App.bubble.create((o) => cat.headPos(o));
    const btB = App.bubble.create((o) => { o.copy(winPos); o.y += 0.3; return o; });
    btB.el.classList.add('far');

    // 兔耳：单独一张精灵，贴在小猫头顶
    const earsCv = App.sprites.set('ears').sit;
    const earsMat = new THREE.SpriteMaterial({ map: S.pixelTexture(earsCv), transparent: true, alphaTest: 0.1, depthTest: false });
    const ears = new THREE.Sprite(earsMat);
    const earsRows = earsCv.height / 4;
    ears.center.set(0.5, App.sprites.MARGIN / earsRows);
    ears.renderOrder = 5;
    ears.visible = false;
    S.layers.mid.add(ears);
    let earsPop = 0;
    S.onUpdate((dt, t) => {
      if (!ears.visible) return;
      const cell = cat.sprite.scale.x / App.sprites.GRID;
      const sz = cell * (earsCv.width / 4) * earsPop;
      ears.scale.set(sz, sz * (earsCv.height / earsCv.width), 1);
      ears.position.copy(cat.sprite.position);
      ears.position.y += cat.sprite.scale.y * 11 / App.sprites.GRID;  // 接在头顶那一行
      earsMat.rotation = Math.sin(t * 9) * 0.06;
    });

    // ---------- 观众 ----------
    function spectator(name, h, s, r, y) {
      const isle = S.island({ w: 0.9, d: 0.9, h: 0.3, depth: 0.9 });
      isle.position.copy(P(s, r, y));
      S.layers.mid.add(isle);
      const c = new App.Critter(App.sprites.set(name), h).addTo(S.layers.mid).setPosition(P(s, r, y));
      c.bubble = App.bubble.create((o) => c.headPos(o));
      return c;
    }
    const pig = spectator('pig', 0.8, 3.3, 1.75, -0.6);
    const bad = spectator('badcat', 1.0, 6.6, -1.8, -0.2);
    function pigReact() {
      pig.hopInPlace(0.25, 260);
      pig.bubble.say(T.pig, { hold: 700, voice: null, speed: 60 });
      A.blip({ freq: 150, type: 'square', vol: 0.035, dur: 0.07, jitter: 0.05 });
      setTimeout(() => A.blip({ freq: 125, type: 'square', vol: 0.03, dur: 0.1, jitter: 0.05 }), 130);
    }
    function badReact() {
      bad.flash('tail', 0.5);
      bad.hopInPlace(0.15, 220);
      bad.bubble.say(T.badcat, { hold: 700, voice: null, speed: 60 });
      A.meow(0.06);
    }

    // ---------- 音符 ----------
    const noteCv = App.sprites.set('note').sit;
    const noteTex = S.pixelTexture(noteCv);
    const NOTE_H = 0.5, NOTE_W = NOTE_H * noteCv.width / noteCv.height;
    const coins = [];
    function addCoin(s, y) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, alphaTest: 0.1 }));
      sp.scale.set(NOTE_W, NOTE_H, 1);
      const pos = P(s, 0, y);
      sp.position.copy(pos);
      S.layers.mid.add(sp);
      coins.push({ sp, pos, ph: Math.random() * 6, taken: false, flying: false });
    }
    // 每段路线的半空中一个，每格落脚点上方一个，共 6 个
    for (let i = 0; i < 3; i++) {
      const a = PLATS[i], b = PLATS[i + 1];
      addCoin((a.s + b.aim) / 2, (a.y + b.y) / 2 + arcH(b.aim - a.s) + BODY);
      addCoin(b.aim, b.y + 0.95);
    }
    S.onUpdate((dt, t) => {
      coins.forEach((c) => {
        if (c.taken || c.flying) return;
        c.sp.position.y = c.pos.y + Math.sin(t * 2.2 + c.ph) * 0.07;
        c.sp.scale.x = NOTE_W * (0.78 + 0.22 * Math.cos(t * 1.7 + c.ph));
      });
    });

    let got = 0, fullP = null;
    function collect(c) {
      if (c.taken) return;
      c.taken = true;
      A.coin(got++);
      const s0 = c.sp.scale.clone();
      U.tween(260, (e) => {
        c.sp.scale.set(s0.x * (1 + e * 0.8), s0.y * (1 + e * 0.8), 1);
        c.sp.material.opacity = 1 - e;
      }).then(() => { c.sp.visible = false; });
      if (got === coins.length) fullP = fullNotes();
    }
    function checkCoins() {
      tmp.copy(cat.base);
      tmp.y += cat.hopY + BODY;
      coins.forEach((c) => {
        if (!c.taken && !c.flying && c.sp.position.distanceTo(tmp) < EAT_R) collect(c);
      });
    }
    // 没吃到的音符，最后自己飞过来
    async function gatherCoins() {
      const left = coins.filter((c) => !c.taken);
      await Promise.all(left.map(async (c, i) => {
        await U.sleep(i * 140);
        c.flying = true;
        const from = c.sp.position.clone();
        await U.tween(480, (e) => {
          cat.headPos(tmp);
          tmp.y -= 0.4;
          c.sp.position.lerpVectors(from, tmp, e);
        }, U.ease.inOutCubic);
        collect(c);
      }));
    }

    // ---------- 问号砖块 ----------
    const QB_S = (PLATS[1].s + PLATS[2].aim) / 2;
    const qb = App.props.qblock(0.55);
    const qbPos = P(QB_S, 0, arcH(PLATS[2].aim - PLATS[1].s) + 1.25 + 0.27);
    qb.mesh.position.copy(qbPos);
    S.layers.mid.add(qb.mesh);
    S.onUpdate((dt, t) => {
      if (!qb.used) qb.mesh.rotation.y = Math.sin(t * 1.3) * 0.08;
    });
    function bump() {
      if (qb.used) return;
      qb.use();
      qb.mesh.rotation.y = 0;
      A.blip({ freq: 520, type: 'square', vol: 0.04, dur: 0.06, jitter: 0 });
      setTimeout(() => A.blip({ freq: 1046, type: 'square', vol: 0.035, dur: 0.12, jitter: 0 }), 70);
      U.tween(240, (e, k) => { qb.mesh.position.y = qbPos.y + Math.sin(Math.PI * k) * 0.3; }, U.ease.linear);

      // 代码彩蛋：从砖块上方冒出来，停一会儿再淡出
      const egg = U.el('div', 'code-egg', document.getElementById('world-ui'));
      U.el('span', null, egg, T.egg);
      let rise = 0;
      const off = S.onUpdate(() => {
        tmp.copy(qbPos);
        tmp.y += 0.45 + rise;
        const p = S.project(tmp);
        egg.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      });
      requestAnimationFrame(() => egg.classList.add('on'));
      U.tween(600, (e) => { rise = e * 0.5; });
      setTimeout(() => {
        egg.classList.remove('on');
        setTimeout(() => { off(); egg.remove(); }, 500);
      }, 4200);
    }
    function qbHit(x, y) {
      const p = S.project(qb.mesh.position);
      return Math.hypot(x - p.x, y - p.y) < 34;
    }

    // ---------- 软垫 ----------
    const pad = App.props.pad();
    pad.visible = false;
    S.layers.mid.add(pad);

    // ---------- UI ----------
    const ov = document.getElementById('overlay');
    const hint = U.el('div', 'soft-hint', ov, T.hint);
    const caption = U.el('div', 'caption', ov, T.miss);
    const wash = U.el('div', 'pink-wash', ov);

    const bar = U.el('div', 'charge', document.getElementById('world-ui'));
    const barBox = U.el('div', 'charge-box', bar);
    const fill = U.el('div', 'charge-fill', barBox);
    const mark = U.el('div', 'charge-mark', barBox);
    S.onUpdate(() => {
      tmp.copy(cat.base).addScaledVector(S.RIGHT, 0.75);
      tmp.y += 0.15;
      const p = S.project(tmp);
      bar.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    });

    // ---------- 状态 ----------
    let state = 'intro';   // intro | ready | charge | busy | done
    let idx = 0;           // 现在站在第几格
    let sNow = 0;          // 小猫现在的 s
    let fails = 0;         // 这一格连续掉了几次
    let firstJump = true;
    let pid = null, t0 = 0, lastTick = 0;

    const charge = () => Math.min(1, (performance.now() - t0) / CHARGE_MS);
    const focusOn = (s, y, instant = false) =>
      S.focus(P(s + LEADS[idx], 0, y + 0.7), instant, 2.2);
    focusOn(0, 0, true);

    function showMark() {
      const nxt = PLATS[idx + 1];
      if (!nxt || fails < 2) { mark.classList.remove('on'); return; }
      const c = U.clamp((nxt.aim - sNow - MIN) / (MAX - MIN), 0, 1);
      mark.style.bottom = (c * 100).toFixed(1) + '%';
      mark.classList.add('on');
    }

    // 蓄力中：压扁、平台下沉、音调升高
    S.onUpdate(() => {
      if (state !== 'charge') return;
      const c = charge();
      cat.squash = Math.max(cat.squash, c * 0.95);
      PLATS[idx].mesh.scale.y = 1 - c * 0.14;
      fill.style.height = (c * 100).toFixed(1) + '%';
      const now = performance.now();
      if (c < 1 && now - lastTick > 90) {
        lastTick = now;
        A.blip({ freq: 300 + c * 720, type: 'triangle', vol: 0.028, dur: 0.04, jitter: 0 });
      }
    });

    function springPlat(p) {
      const s0 = p.mesh.scale.y;
      U.tween(320, (e) => { p.mesh.scale.y = U.lerp(s0, 1, e); }, U.ease.outBack);
    }
    function landFx(p) {
      cat.squash = 1;
      A.blip({ freq: 300, type: 'sine', vol: 0.05, dur: 0.08, jitter: 0.1 });
      U.tween(240, (e, k) => { p.mesh.scale.y = 1 - Math.sin(Math.PI * k) * 0.1; }, U.ease.linear);
    }

    // ---------- 输入 ----------
    const onDown = (e) => {
      if (pig.hit(e.clientX, e.clientY)) { pigReact(); return; }
      if (bad.hit(e.clientX, e.clientY)) { badReact(); return; }
      if (!qb.used && qbHit(e.clientX, e.clientY)) { bump(); return; }
      if (state !== 'ready') return;
      state = 'charge';
      pid = e.pointerId;
      t0 = performance.now();
      lastTick = 0;
      showMark();
      fill.style.height = '0%';
      bar.classList.add('on');
    };
    const endCharge = () => {
      bar.classList.remove('on');
      springPlat(PLATS[idx]);
    };
    const onUp = (e) => {
      if (state !== 'charge' || e.pointerId !== pid) return;
      if (e.type === 'pointercancel' || charge() < MIN_HOLD) { endCharge(); state = 'ready'; return; }
      jump();
    };
    const onBlur = () => {
      if (state !== 'charge') return;
      endCharge();
      state = 'ready';
    };
    const noMenu = (e) => e.preventDefault();
    S.el.addEventListener('pointerdown', onDown);
    S.el.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    this._cleanup = () => {
      S.el.removeEventListener('pointerdown', onDown);
      S.el.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
      qb.dispose();
    };

    // ---------- 跳 ----------
    function arc(from, to, y0, y1, dist) {
      const dur = 360 + dist * 85, h = arcH(dist);
      cat.squash = -0.7;
      return U.tween(dur, (e, k) => {
        if (!ctx.alive()) return;
        const s = U.lerp(from, to, k);
        cat.base.copy(P(s, 0, U.lerp(y0, y1, k)));
        cat.hopY = Math.sin(Math.PI * k) * h;
        checkCoins();
        if (!qb.used && Math.abs(s - QB_S) < 0.45 && cat.hopY > h * 0.8) bump();
      }, U.ease.linear).then(() => { cat.hopY = 0; });
    }

    async function jump() {
      const c = charge();
      state = 'busy';
      endCharge();
      if (firstJump) { firstJump = false; hint.classList.remove('on'); }

      const cur = PLATS[idx], nxt = PLATS[idx + 1];
      const dist = MIN + c * (MAX - MIN);
      const from = sNow, land = from + dist;
      let kind = 'fall', target = land, yTo = cur.y;
      if (inZone(cur, land)) {
        kind = 'stay';
      } else if (nxt && inZone(nxt, land)) {
        kind = 'land';
        yTo = nxt.y;
        if (nxt.stand != null) target = Math.min(land, nxt.stand);
      }

      A.whoosh(0.035, 0.35);
      if (kind === 'land') S.focus(P(target + LEADS[Math.min(idx + 1, 3)], 0, yTo + 0.7), false, 2.2);
      await arc(from, target, cur.y, yTo, dist);
      if (!ctx.alive()) return;

      if (kind === 'fall') {
        await fallBack(from, target, cur.y);
        if (!ctx.alive()) return;
        state = 'ready';
        return;
      }

      sNow = target;
      if (kind === 'stay') {
        landFx(cur);
        state = 'ready';
        return;
      }

      idx++;
      fails = 0;
      landFx(nxt);
      await onLanded(idx);
      if (!ctx.alive()) return;
      if (state === 'busy') state = 'ready';
    }

    // 掉下去 → 软垫 → 弹回原来站的地方
    async function fallBack(from, at, y) {
      const T_ = App.props.PAD_TOP;
      const padY = y - 2.6 - T_;
      pad.position.copy(P(at, 0, padY));
      pad.scale.set(0.01, 0.01, 0.01);
      pad.visible = true;
      U.tween(280, (e) => pad.scale.setScalar(Math.max(0.01, e)), U.ease.outBack);
      S.focus(P(at + 0.8, 0, y - 1.3), false, 3);

      cat.squash = -0.8;
      A.whoosh(0.03, 0.5);
      await U.tween(460, (e) => {
        if (!ctx.alive()) return;
        cat.base.y = y - 2.6 * e;
        checkCoins();
      }, inQuad);
      if (!ctx.alive()) return;

      // 噗——
      cat.squash = 1;
      [180, 270, 400].forEach((f, i) => setTimeout(() => A.blip({ freq: f, type: 'sine', vol: 0.07, dur: 0.1, jitter: 0 }), i * 55));
      await U.tween(260, (e, k) => {
        const sy = 1 - Math.sin(Math.PI * k) * 0.35;
        pad.scale.y = sy;
        cat.base.y = padY + T_ * sy;
      }, U.ease.linear);
      caption.classList.add('on');
      setTimeout(() => caption.classList.remove('on'), 1800);

      const a = cat.base.clone(), b = P(from, 0, y);
      cat.squash = -0.8;
      focusOn(from, y);
      await U.tween(720, (e, k) => {
        if (!ctx.alive()) return;
        cat.base.lerpVectors(a, b, k);
        cat.hopY = Math.sin(Math.PI * k) * 1.3;
      }, U.ease.linear);
      cat.hopY = 0;
      if (!ctx.alive()) return;
      landFx(PLATS[idx]);
      U.tween(220, (e) => pad.scale.setScalar(Math.max(0.01, 1 - e))).then(() => { pad.visible = false; });

      fails++;
      if (fails >= 2) showMark();
    }

    async function onLanded(i) {
      const p = PLATS[i];
      focusOn(sNow, p.y);
      zoomTo(ZOOMS[i]);
      toneTo(TONES[i]);
      if (i === 1) pig.hopInPlace(0.3, 300);
      if (i === 2) { bad.flash('tail', 0.5); bad.hopInPlace(0.15, 220); }
      if (i < 3) {
        await U.sleep(350);
        btB.say(T.calls[i - 1], { voice: 'bt', hold: 1800, speed: 60 });
        return;
      }
      pig.hopInPlace(0.3, 300);
      bad.hopInPlace(0.2, 260);
      await finish();
    }

    // ---------- 集满音符 ----------
    async function fullNotes() {
      await U.sleep(250);
      if (!ctx.alive()) return;
      [6, 7, 8, 10].forEach((n, j) => setTimeout(() => A.coin(n), j * 120));
      wash.classList.add('on');
      S.setSaturation(0.36, 3);
      A.setClarity(0.3, 3);
      const c0 = new THREE.Color(App.config.chapters.scene2.bg || '#0c0c11');
      const c1 = new THREE.Color('#160d14');
      const cc = new THREE.Color();
      U.tween(3000, (e) => { if (ctx.alive()) S.renderer.setClearColor(cc.copy(c0).lerp(c1, e), 1); });

      // 兔耳
      ears.visible = true;
      A.blip({ freq: 880, type: 'sine', vol: 0.05, dur: 0.15, jitter: 0 });
      await U.tween(380, (e) => { earsPop = e; }, U.ease.outBack);
      cat.blink();
      await U.sleep(700);
      cat.tilt(-1);
      await U.sleep(900);
      cat.tilt(1);
      await U.sleep(700);
      await U.tween(260, (e) => { earsPop = 1 - e; });
      ears.visible = false;
      if (!ctx.alive()) return;
      cat.tilt(-1);
      await catB.say(T.bunny, { hold: 900 });
    }

    async function finish() {
      state = 'done';
      await U.sleep(400);
      if (!ctx.alive()) return;
      await gatherCoins();
      if (!ctx.alive()) return;
      if (fullP) await fullP;
      if (!ctx.alive()) return;
      await U.sleep(300);
      await btB.say(T.calls[2], { voice: 'bt', hold: 1800, speed: 60 });
      if (!ctx.alive()) return;
      cat.tilt(1);
      await catB.say(T.arrive, { hold: 1400 });
      await U.sleep(700);
      if (!ctx.alive()) return;
      ctx.next();
    }

    // ---------- 流程 ----------
    (async () => {
      await U.sleep(1100);
      if (!ctx.alive()) return;
      cat.blink();
      await U.sleep(500);
      cat.tilt(-1);
      await catB.say(T.see, { hold: 1500 });
      if (!ctx.alive()) return;
      await U.sleep(300);
      hint.classList.add('on');
      state = 'ready';
    })();
  },

  exit() {
    this._cleanup && this._cleanup();
    const cam = App.stage.camera;
    cam.zoom = 1;
    cam.updateProjectionMatrix();
  }
});