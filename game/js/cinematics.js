// ============================================================================
// КИНЕМАТОГРАФИЯ: кат-сцена появления героя, землетрясение при победе над боссом,
// катаклизм после гибели Владыки Ада (вулканы, лава, разломы, багровый шторм)
// ============================================================================
const Cinema = {
    active: false, t: 0, dur: 6.6, quake: null, cata: null,

    // ---------- оркестровая нота (синтез): низкие струнные, хор, литавры ----------
    note(kind) {
        if (typeof Sfx3D === 'undefined') return;
        const T = Sfx3D;
        if (kind === 'swell') { [73.4, 87.3, 110, 146.8].forEach((f, i) => { T.tone(f, f * 1.003, 4.2, 'sawtooth', 0.035, i * 0.15, 520 + i * 120); T.tone(f * 2, f * 2.004, 4.0, 'triangle', 0.015, 0.4 + i * 0.1); }); T.noise(3.5, 'bandpass', 900, 0.025, 0.2, 2400, 3); }
        if (kind === 'timpani') { T.tone(65, 38, 1.4, 'sine', 0.5); T.noise(0.5, 'lowpass', 300, 0.25, 0, 60); T.tone(130, 70, 0.6, 'triangle', 0.08); }
        if (kind === 'resolve') { [146.8, 174.6, 220, 293.7].forEach((f, i) => T.tone(f, f, 2.2, 'sawtooth', 0.03, i * 0.05, 1400)); T.tone(587, 587, 1.6, 'sine', 0.03, 0.2); }
        if (kind === 'rumble') { T.noise(3.5, 'lowpass', 160, 0.35, 0, 50); T.tone(42, 30, 3.5, 'sine', 0.35); }
        if (kind === 'doom') { [55, 65.4, 82.4].forEach((f, i) => T.tone(f, f * 0.98, 6, 'sawtooth', 0.05, i * 0.3, 380)); T.noise(6, 'lowpass', 220, 0.3, 0, 40); }
    },
    // ---------- полосы кино и титр ----------
    bars(on, title, sub) {
        let el = document.getElementById('cineBars');
        if (!el) { el = document.createElement('div'); el.id = 'cineBars'; el.innerHTML = '<div class="cb-top"></div><div class="cb-bot"></div><div class="cb-title"><b></b><span></span></div><div class="cb-skip">Пробел / клик — пропустить</div>'; document.body.appendChild(el); }
        if (title !== undefined) { el.querySelector('.cb-title b').textContent = title; el.querySelector('.cb-title span').textContent = sub || ''; }
        el.classList.toggle('on', on); el.classList.toggle('no-skip', !this.active);
        document.body.classList.toggle('cine-on', on);
    },
    title(on) { const el = document.getElementById('cineBars'); if (el) el.classList.toggle('show-title', on); },

    // ================== 1. Кат-сцена появления ==================
    start() {
        if (typeof Engine3D === 'undefined' || !Engine3D.active) return;
        const c = typeof playerChar === 'function' ? playerChar() : null;
        this.active = true; this.t = 0; this.fired = {};
        this.hero = player.heroType;
        this.bars(true, c ? c.name : '', c ? c.epithet : '');
        this.note('swell');
        const skip = e => { if (!this.active) return; if (e.type === 'keydown' && !['Space', 'Escape', 'Enter'].includes(e.code)) return; e.preventDefault(); e.stopImmediatePropagation(); this.finish(); };
        this.skipFn = skip;
        setTimeout(() => { window.addEventListener('keydown', skip, true); window.addEventListener('mousedown', skip, true); }, 300);
    },
    finish() {
        if (!this.active) return;
        this.active = false; this.pose = null; this.bars(false); this.title(false);
        window.removeEventListener('keydown', this.skipFn, true); window.removeEventListener('mousedown', this.skipFn, true);
    },
    // Поза героя по ходу сцены (читается в Actors3D)
    heroPose() {
        if (!this.active) return null;
        const t = this.t, h = this.hero, sword = h === 'saber' || (h === 'knight' && player.knightSword);
        if (t < 1.8) return { hold: 'kneel', y: -0.3 };
        if (t < 3.1) return { hold: 'rise', y: -0.3 * (1 - (t - 1.8) / 1.3) };
        if (t < 4.4) return { hold: h === 'archer' ? 'bowUp' : (h === 'invoker' ? 'orbsUp' : (sword ? 'plunge' : 'roar')), y: 0 };
        return { hold: 'stance', y: 0 };
    },
    // Камера: низкий ракурс спереди с облётом → подъём к игровой камере
    camera(cam, tgt) {
        if (!this.active) return;
        const t = this.t, fa = Math.PI / 2 - player.facingAngle, hx = player.x / 48, hz = player.y / 48, hy = World3D.hAt(hx, hz);
        const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const orbit = fa + 0.5 - Math.min(1, t / 4.4) * 1.1;
        const close = { x: hx + Math.sin(orbit) * 3.6, y: hy + 1.0 + Math.min(1, t / 4.4) * 0.8, z: hz + Math.cos(orbit) * 3.6 };
        const k = ease(Math.max(0, Math.min(1, (t - 5.0) / 1.6)));
        cam.position.set(close.x + (cam.position.x - close.x) * k, close.y + (cam.position.y - close.y) * k, close.z + (cam.position.z - close.z) * k);
        const look = { x: hx, y: hy + 0.85 - k * 0.25, z: hz };
        cam.lookAt(look.x + (tgt.x - look.x) * k, look.y + (tgt.y - look.y) * k, look.z + (tgt.z - look.z) * k);
    },
    // Эффекты по ключевым кадрам
    beat(name, fn) { if (!this.fired[name]) { this.fired[name] = true; fn(); } },
    updateSpawn(dt) {
        this.t += dt;
        const t = this.t, h = this.hero, p = { x: player.x / 48, z: player.y / 48 }; p.y = World3D.hAt(p.x, p.z);
        const red = h === 'knight', col = h === 'saber' ? 0xffd23a : (h === 'archer' ? 0xc4323c : (red ? 0xd8202c : 0xb98af0));
        // Мгла и угли, пока герой на коленях
        if (t < 1.8 && Math.random() < 0.6) AnimFX.emit({ x: p.x + (Math.random() - 0.5) * 3, y: p.y + 0.1, z: p.z + (Math.random() - 0.5) * 3, n: 1, color: [0x2a2630, 0x1a161e], speed: 0.1, life: 2.2, size: 0.8, sizeEnd: 1.5, grav: -0.08 });
        if (t < 3 && Math.random() < 0.4) AnimFX.emit({ x: p.x + (Math.random() - 0.5) * 2, y: p.y + 0.1, z: p.z + (Math.random() - 0.5) * 2, n: 1, color: [col, 0xff8a3a], speed: 0.2, up: 1.2, life: 1.5, size: 0.05, grav: -0.6 });
        if (t > 1.8) this.beat('rise', () => { AnimFX.emit({ x: p.x, y: p.y + 0.1, z: p.z, n: 24, color: 0x6a5a4a, speed: 1.2, up: 0.4, life: 1, size: 0.35, sizeEnd: 0.6, grav: -0.2, drag: 3 }); Sfx3D.play('whoosh', 1.2); });
        if (t > 3.45) this.beat('strike', () => {
            const fx = Math.cos(player.facingAngle), fz = Math.sin(player.facingAngle), ix = p.x + fx * 0.55, iz = p.z + fz * 0.55;
            this.note('timpani'); AnimFX.kick(1.2);
            if (h === 'archer') { AnimFX.emit({ x: p.x, y: p.y + 2, z: p.z, n: 40, color: [col, 0xffffff], speed: 3, life: 0.6, size: 0.06, grav: 2 }); AnimFX.shock(p.x, p.y + 0.05, p.z, col, 0.3, 3, 0.7); }
            else if (h === 'invoker') { [0x38bdf8, 0xc084fc, 0xfb923c].forEach((c, i) => AnimFX.shock(p.x, p.y + 0.05 + i * 0.4, p.z, c, 0.3, 2.5 + i, 0.8)); AnimFX.emit({ x: p.x, y: p.y + 1.6, z: p.z, n: 90, color: [0x38bdf8, 0xc084fc, 0xfb923c, 0xffffff], speed: 2.5, life: 0.9, size: 0.07, grav: -0.5 }); }
            else {
                AnimFX.impact(ix, iz, col, 2.2, { dust: 0x4a3a2a });
                FX3D.runeAt && (this.crack = { x: ix, z: iz, t: 0 });
                if (red) AnimFX.blood(ix, p.y + 0.4, iz, 90);
            }
            AnimFX.flash(p.x, p.z, col, 6, 1.2, 1.5);
        });
        if (t > 4.4) this.beat('stance', () => { this.note('resolve'); this.title(true); AnimFX.shock(p.x, p.y + 0.05, p.z, col, 0.2, 1.8, 0.5, 0.7); });
        if (t > 6.0) this.title(false);
        if (t >= this.dur) this.finish();
    },

    // ================== 2. Победа над боссом: землетрясение, камни и пыль с потолка ==================
    onKill(en) {
        if (typeof Engine3D === 'undefined' || !Engine3D.active) return;
        const near = Math.hypot(en.x - player.x, en.y - player.y) < 900;
        if (!near) return;
        if (en.type === 'hell_lord') { this.startCataclysm(en); return; }
        if (en.isBoss || (en.tpl && en.tpl.miniBoss)) this.startQuake(en, en.isBoss ? 1 : 0.6);
    },
    startQuake(en, power) {
        this.quake = { t: 0, dur: 3.2 + power * 1.5, power, x: en.x / 48, z: en.y / 48 };
        this.note('rumble'); AnimFX.kick(1.5 * power);
        this.bars(true, en.name || 'Босс повержен', 'Повержен'); this.title(true);
        setTimeout(() => { if (!this.active && !this.cata) { this.bars(false); this.title(false); } }, 2600);
    },
    initDebris() {
        if (this.debris) return;
        const geo = new THREE.DodecahedronGeometry(0.22, 1), mat = G3.mat(0x5a544c, { k: 'rock' });
        this.debris = [];
        for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.visible = false; Engine3D.scene.add(m); this.debris.push({ m, live: false }); }
    },
    dropRock(cx, cz, spread, big) {
        this.initDebris();
        const d = this.debris.find(d => !d.live); if (!d) return;
        const x = cx + (Math.random() - 0.5) * spread * 2, z = cz + (Math.random() - 0.5) * spread * 2;
        Object.assign(d, { live: true, x, z, y: 9 + Math.random() * 5, vy: -2 - Math.random() * 3, rx: Math.random() * 3, ry: Math.random() * 3, s: (big ? 1.4 : 0.5) + Math.random() * (big ? 1.8 : 1.2) });
        d.m.visible = true; d.m.scale.setScalar(d.s);
    },
    updateDebris(dt) {
        if (!this.debris) return;
        for (const d of this.debris) {
            if (!d.live) continue;
            d.vy -= 22 * dt; d.y += d.vy * dt; d.rx += dt * 5; d.ry += dt * 4;
            const gy = World3D.hAt(d.x, d.z) + 0.2 * d.s;
            if (d.y <= gy) {   // удар о землю: пыль, осколки, волна
                d.live = false; d.m.visible = false;
                AnimFX.emit({ x: d.x, y: gy, z: d.z, n: 10, color: [0x6a6056, 0x8a8076], speed: 1.4 * d.s, up: 0.6, life: 1.1, size: 0.3 * d.s, sizeEnd: 0.6 * d.s, grav: -0.15, drag: 2.5 });
                AnimFX.emit({ x: d.x, y: gy, z: d.z, n: 6, color: [0x5a544c, 0x3a342e], speed: 2.5, up: 2, life: 0.7, size: 0.07, grav: 12 });
                AnimFX.shock(d.x, gy - 0.15, d.z, 0x8a8076, 0.1, 0.8 * d.s, 0.4, 0.5);
                if (Math.random() < 0.3) Sfx3D.play('impact', 0.5);
                continue;
            }
            d.m.position.set(d.x, d.y, d.z); d.m.rotation.set(d.rx, d.ry, 0);
        }
    },
    updateQuake(dt) {
        const q = this.quake; if (!q) return;
        q.t += dt; const k = 1 - q.t / q.dur, px = player.x / 48, pz = player.y / 48;
        if (typeof triggerScreenShake === 'function') triggerScreenShake(10 * q.power * k + 2);
        if (Math.random() < 6 * dt * q.power * k + 0.05) this.dropRock(px, pz, 9, Math.random() < 0.25);
        // Пыль сыплется сверху
        for (let i = 0; i < 3; i++) AnimFX.emit({ x: px + (Math.random() - 0.5) * 20, y: 8 + Math.random() * 3, z: pz + (Math.random() - 0.5) * 16, n: 1, color: [0x8a8076, 0x6a6056], speed: 0.1, life: 2.4, size: 0.18, sizeEnd: 0.4, grav: 2.5, drag: 0.8 });
        if (q.t >= q.dur) this.quake = null;
    },

    // ================== 3. Финал: катаклизм после гибели Владыки Ада ==================
    startCataclysm(en) {
        this.cata = { t: 0, dur: 14, x: en.x / 48, z: en.y / 48, vol: [], rifts: [], next: 0 };
        this.startQuake(en, 1.6); this.quake.dur = 14;
        this.note('doom'); this.bars(true, 'Ваал’Гор пал', 'Преисподняя рушится'); this.title(true);
        setTimeout(() => this.title(false), 3500);
        // Вулканы на горизонте (за спиной у камеры их не видно — ставим «вглубь» кадра)
        const geo = new THREE.ConeGeometry(1, 1, 24, 6, true), mat = G3.mat(0x1a0806, { k: 'rock' });
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(geo, mat), a = -Math.PI / 2 + (i - 1.5) * 0.55, R = 12 + i % 2 * 4;
            const x = this.cata.x + Math.cos(a) * R, z = this.cata.z + Math.sin(a) * R;
            m.position.set(x, -6, z); m.scale.set(4 + i, 7 + i * 1.5, 4 + i); Engine3D.scene.add(m);
            this.cata.vol.push({ m, x, z, h: 7 + i * 1.5, rise: 0, delay: i * 0.8 });
        }
    },
    updateCataclysm(dt) {
        const C = this.cata; if (!C) return;
        C.t += dt; const fade = Math.min(1, (C.dur - C.t) / 2), px = player.x / 48, pz = player.y / 48;
        // Багровый шторм: туман и небо краснеют, вспышки алых молний
        Engine3D.scene.fog.color.lerp(new THREE.Color(0x4a0804), 0.5 * fade); Engine3D.scene.background.copy(Engine3D.scene.fog.color);
        if (Math.random() < dt * 1.2) { AnimFX.flash(px + (Math.random() - 0.5) * 16, pz - 6 - Math.random() * 8, 0xff3020, 10, 0.35, 6); if (typeof lightningFlashAlpha !== 'undefined') lightningFlashAlpha = 0.35; Sfx3D.play('heavy', 0.5); }
        for (let i = 0; i < 6; i++) AnimFX.emit({ x: px + (Math.random() - 0.5) * 24, y: 0.3, z: pz + (Math.random() - 0.5) * 18, n: 1, color: [0xff6a1a, 0xffb040, 0xff2a00], speed: 0.4, up: 2.5, life: 2, size: 0.09, grav: -0.4 });
        // Вулканы вырастают и извергаются: столбы огня, лавовые бомбы по дуге
        for (const v of C.vol) {
            if (C.t < v.delay) continue;
            v.rise = Math.min(1, v.rise + dt * 0.5);
            const top = -6 + v.rise * (6 + v.h * 0.5);
            v.m.position.y = top - v.h * 0.5;
            if (v.rise > 0.6) {
                const ty = top + 0.2;
                AnimFX.emit({ x: v.x, y: ty, z: v.z, n: 6, color: [0xff5a10, 0xffb040, 0xff2a00, 0xffe080], speed: 1.5, up: 9, life: 1.8, size: 0.6, sizeEnd: 0.1, grav: 4, r: 0.5 });
                AnimFX.emit({ gore: true, x: v.x, y: ty + 1, z: v.z, n: 2, color: [0x2a201c, 0x1a1412], speed: 0.6, up: 3, life: 4, size: 1.5, sizeEnd: 3.5, grav: -0.3, drag: 0.4 });
                if (Math.random() < dt * 4) { const a = Math.random() * 6.28; AnimFX.emit({ x: v.x, y: ty, z: v.z, n: 1, color: [0xff7a20, 0xffc060], speed: 6 + Math.random() * 5, life: 2.4, size: 0.35, grav: 9, drag: 0.1, dir: [Math.cos(a) * 0.6, 1.4, Math.sin(a) * 0.6], spread: 0.3 }); }
                if (Math.random() < 0.05) AnimFX.flash(v.x, v.z, 0xff5010, 12, 0.6, 4);
            }
        }
        // Взрывы вокруг и раскрывающиеся разломы с лавой
        C.next -= dt;
        if (C.next <= 0 && C.t < C.dur - 2) {
            C.next = 0.25 + Math.random() * 0.4;
            const a = Math.random() * 6.28, r = 3 + Math.random() * 9, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
            AnimFX.impact(x, z, 0xff6a1a, 1.5 + Math.random() * 1.5, { dust: 0x3a2a24 }); AnimFX.emit({ x, y: World3D.hAt(x, z) + 0.3, z, n: 30, color: [0xff7a20, 0xffd060, 0xff3000], speed: 3, up: 4, life: 0.8, size: 0.1, grav: 8 });
            if (Math.random() < 0.4) Sfx3D.play('impact', 0.8);
            if (C.rifts.length < 10) C.rifts.push({ x, z, ang: Math.random() * 6.28, len: 3 + Math.random() * 5, t: 0 });
        }
        for (const r of C.rifts) { r.t += dt; if (Math.random() < 0.5) { const q = Math.random() * r.len * Math.min(1, r.t); AnimFX.emit({ x: r.x + Math.cos(r.ang) * q, y: World3D.hAt(r.x, r.z) + 0.1, z: r.z + Math.sin(r.ang) * q, n: 1, color: [0xff5a10, 0xffb040], speed: 0.2, up: 1.5, life: 0.8, size: 0.12, grav: -1 }); } }
        if (C.t >= C.dur) { C.vol.forEach(v => Engine3D.scene.remove(v.m)); this.cata = null; this.bars(false); this.title(false); }
    },
    // Разломы рисуются как рунные полосы с трещинами (из прохода FX3D, чтобы не пересоздавались)
    fxRunes() {
        const C = this.cata;
        if (C) for (const r of C.rifts) FX3D.runeAt(r, 0xff5a10, r.x, r.z, 0, 1, { rect: true, ang: Math.PI / 2 - r.ang, w: 0.5, len: r.len * Math.min(1, r.t * 1.5), crack: 1, op: Math.min(1, (C.dur - C.t) / 2) });
        if (this.crack) { const k = this.crack; k.t += 1 / 60; if (k.t > 5) this.crack = null; else FX3D.runeAt(k, player.heroType === 'knight' ? 0xd8202c : 0xffd23a, k.x, k.z, 1.4, 1, { crack: 1, spin: 0, op: Math.min(1, (5 - k.t) / 1.5) }); }
    },
    update(dt) {
        if (this.active) this.updateSpawn(dt);
        this.updateQuake(dt); this.updateCataclysm(dt); this.updateDebris(dt);
    }
};
