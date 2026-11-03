/* =========================================================
 * 通用像素角色（billboard 精灵）：小猪猪、坏猫、守门猛兽
 *   const p = new App.Critter(App.sprites.set('pig'), 0.8).addTo(group).setPosition(vec3)
 *   p.hopInPlace() / hopTo(vec3) / blink() / flash(帧名, 秒) / setRest(帧名)
 *   p.hit(clientX, clientY) / p.headPos(out)
 * 帧至少要有 sit。'blink' 是 sit 的闭眼帧，'xxxBlink' 是 xxx 的闭眼帧。
 * opts: { autoBlink = true, breathe = 0.02 }
 * ========================================================= */
App.Critter = class Critter {
  constructor(frames, height = 1, opts = {}) {
    const U = App.util;
    this.tex = {};
    for (const k in frames) this.tex[k] = App.stage.pixelTexture(frames[k]);
    const c0 = frames.sit;
    const rows = c0.height / (opts.scale || 4);
    this.aspect = c0.width / c0.height;
    this.mat = new THREE.SpriteMaterial({ map: this.tex.sit, transparent: true, alphaTest: 0.1 });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, App.sprites.MARGIN / rows);
    this.h = height;
    this.breathe = opts.breathe != null ? opts.breathe : 0.02;
    this.autoBlink = opts.autoBlink !== false;

    this.base = new THREE.Vector3();
    this.hopY = 0;
    this.squash = 0;
    this.lean = 0;
    this.leanTarget = 0;
    this.rest = 'sit';
    this.frame = 'sit';
    this.frameUntil = 0;
    this.t = App.stage.time;
    this.ph = Math.random() * 6;
    this.nextBlink = this.t + U.rand(1.2, 3.5);

    this._off = App.stage.onUpdate((dt, t) => this.update(dt, t));
    this.update(0, this.t);
  }

  addTo(group) { group.add(this.sprite); return this; }
  setPosition(x, y, z) {
    if (x && x.isVector3) this.base.copy(x); else this.base.set(x, y, z);
    this.update(0, this.t);
    return this;
  }

  setFrame(k) {
    if (this.frame !== k && this.tex[k]) { this.frame = k; this.mat.map = this.tex[k]; }
  }
  flash(k, sec) { this.setFrame(k); this.frameUntil = this.t + sec; }
  /** 换"平时的样子"（比如猛兽让开后变温柔） */
  setRest(k) { this.rest = k; if (!this.frameUntil) this.setFrame(k); }
  blinkFrame() {
    const k = this.rest === 'sit' ? 'blink' : this.rest + 'Blink';
    return this.tex[k] ? k : null;
  }

  update(dt, t) {
    const U = App.util;
    this.t = t;
    if (this.frameUntil && t >= this.frameUntil) { this.frameUntil = 0; this.setFrame(this.rest); }
    if (this.autoBlink && t >= this.nextBlink) {
      const b = this.blinkFrame();
      if (b && !this.frameUntil) this.flash(b, 0.13);
      this.nextBlink = t + U.rand(2.2, 5);
    }

    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-14 * dt));
    this.squash *= Math.exp(-9 * dt);

    const br = Math.sin(t * 2.1 + this.ph) * this.breathe;
    this.sprite.scale.set(
      this.h * this.aspect * (1 + this.squash * 0.2),
      this.h * (1 - this.squash * 0.16 + br),
      1
    );
    this.mat.rotation = this.lean;
    this.sprite.position.set(this.base.x, this.base.y + this.hopY, this.base.z);
  }

  blink() { const b = this.blinkFrame(); if (b) this.flash(b, 0.16); }

  tilt(dir) {
    this.leanTarget = (dir || (Math.random() < 0.5 ? -1 : 1)) * 0.2;
    clearTimeout(this._leanTimer);
    this._leanTimer = setTimeout(() => { this.leanTarget = 0; }, 600);
  }

  async hopInPlace(h = 0.3, ms = 300) {
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

  hit(x, y) {
    if (!this.sprite.visible) return false;
    const p0 = App.stage.project(this.sprite.position);
    const top = this.sprite.position.clone();
    top.y += this.h;
    const p1 = App.stage.project(top);
    const r = Math.max(36, Math.abs(p1.y - p0.y) * 0.7);
    return Math.hypot(x - p0.x, y - (p0.y + p1.y) / 2) < r;
  }

  headPos(out) {
    return out.copy(this.sprite.position).add({ x: 0, y: this.h * 1.02, z: 0 });
  }
};
