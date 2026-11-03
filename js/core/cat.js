/* =========================================================
 * 像素小猫角色（billboard 精灵）
 *   const c = new App.Cat('xiaohan', 1.25).addTo(App.stage.layers.mid);
 *   c.setPosition(x, y, z)   脚底坐标
 *   c.hopTo(vec3) / hopInPlace() / blink() / flick() / tilt() / puff()
 *   c.hit(clientX, clientY)  点击判定
 * 自带待机动画：呼吸、随机眨眼、随机甩尾巴。
 * ========================================================= */
App.Cat = class Cat {
  constructor(name, height = 1.25) {
    const U = App.util;
    const frames = App.sprites.cat(name);
    this.tex = {};
    for (const k in frames) this.tex[k] = App.stage.pixelTexture(frames[k]);
    this.mat = new THREE.SpriteMaterial({ map: this.tex.sit, transparent: true, alphaTest: 0.1 });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, App.sprites.MARGIN / App.sprites.GRID);
    this.h = height;

    this.base = new THREE.Vector3();
    this.hopY = 0;
    this.squash = 0;     // >0 压扁，<0 拉长
    this.lean = 0;
    this.leanTarget = 0;
    this.puffAmt = 0;
    this.frame = 'sit';
    this.frameUntil = 0;
    this.t = 0;
    this.idle = true;
    this.nextBlink = U.rand(1.5, 3);
    this.nextFlick = U.rand(3, 6);

    this._off = App.stage.onUpdate((dt, t) => this.update(dt, t));
    this.update(0, App.stage.time);
  }

  addTo(group) { group.add(this.sprite); return this; }
  setPosition(x, y, z) { this.base.set(x, y, z); this.update(0, this.t); return this; }

  setFrame(k) {
    if (this.frame !== k && this.tex[k]) {
      this.frame = k;
      this.mat.map = this.tex[k];
    }
  }
  flash(k, sec) { this.setFrame(k); this.frameUntil = this.t + sec; }

  update(dt, t) {
    const U = App.util;
    if (this.t === 0 && t > 0) { this.nextBlink += t; this.nextFlick += t; }
    this.t = t;

    if (this.frameUntil && t >= this.frameUntil) { this.frameUntil = 0; this.setFrame('sit'); }
    if (this.idle) {
      if (t >= this.nextBlink) {
        if (!this.frameUntil) this.flash('blink', 0.12);
        this.nextBlink = t + U.rand(2.2, 5);
      }
      if (t >= this.nextFlick) {
        if (!this.frameUntil) this.flash('tail', 0.4);
        this.nextFlick = t + U.rand(3.5, 7);
      }
    }

    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-14 * dt));
    this.squash *= Math.exp(-9 * dt);
    this.puffAmt *= Math.exp(-3.5 * dt);

    const breathe = Math.sin(t * 2.4) * 0.018;
    this.sprite.scale.set(
      this.h * (1 + this.squash * 0.22 + this.puffAmt),
      this.h * (1 - this.squash * 0.18 + breathe + this.puffAmt * 0.8),
      1
    );
    this.mat.rotation = this.lean;
    const jit = this.puffAmt > 0.04 ? (Math.random() - 0.5) * 0.06 : 0;
    this.sprite.position.set(this.base.x + jit, this.base.y + this.hopY, this.base.z);
  }

  // ---------- 动作 ----------
  blink() { this.flash('blink', 0.16); }
  flick() { this.flash('tail', 0.45); }

  tilt(dir) {
    this.leanTarget = (dir || (Math.random() < 0.5 ? -1 : 1)) * 0.24;
    clearTimeout(this._leanTimer);
    this._leanTimer = setTimeout(() => { this.leanTarget = 0; }, 700);
  }

  /** 炸毛 */
  puff() { this.puffAmt = 0.28; this.flash('tail', 0.6); }

  async hopInPlace(h = 0.35, ms = 320) {
    const U = App.util;
    this.squash = -0.5;
    await U.tween(ms, (e, k) => { this.hopY = Math.sin(Math.PI * k) * h; }, U.ease.linear);
    this.hopY = 0;
    this.squash = 0.8;
  }

  async hopTo(target, ms = 420, h = 0.6) {
    const U = App.util;
    const from = this.base.clone();
    this.squash = -0.6;
    await U.tween(ms, (e, k) => {
      this.base.lerpVectors(from, target, e);
      this.hopY = Math.sin(Math.PI * k) * h;
    }, U.ease.inOutCubic);
    this.base.copy(target);
    this.hopY = 0;
    this.squash = 1;
  }

  /** 屏幕点击判定（clientX/Y） */
  hit(x, y) {
    const p0 = App.stage.project(this.sprite.position);
    const top = this.sprite.position.clone();
    top.y += this.h;
    const p1 = App.stage.project(top);
    const r = Math.max(40, Math.abs(p1.y - p0.y) * 0.7);
    return Math.hypot(x - p0.x, y - (p0.y + p1.y) / 2) < r;
  }

  /** 头顶上方的世界坐标（给气泡用） */
  headPos(out) {
    return out.copy(this.sprite.position).add({ x: 0, y: this.h * 1.02, z: 0 });
  }
};
