// ============================================================================
// ОЩУЩЕНИЕ ВЕСА (Game Feel): хитстоп, направленная тряска камеры, пружинная камера с отставанием,
// покачивание камеры в такт шагам героя
// ============================================================================
// Всё считается в реальном времени (realDt), поэтому тряска и камера живут даже во время микро-фриза.
const Feel = {
    realDt: 1 / 60,
    stop: 0,          // оставшееся время хитстопа, с
    stopScale: 0.04,  // во сколько раз замедляется мир во время хитстопа
    shakes: [],       // активные импульсы тряски
    cam: null,        // состояние пружины камеры
    off: { x: 0, y: 0, z: 0 },
    // ---------- хитстоп ----------
    // sec — длительность фриза (0.033 ≈ 2 кадра, 0.066 ≈ 4 кадра). Импульсы не складываются, берётся максимум.
    hitstop(sec) { this.stop = Math.max(this.stop, Math.min(0.12, sec)); },
    // Масштаб времени игры на этот кадр; вызывается из игрового цикла с настоящим dt
    tick(dt) {
        this.realDt = dt;
        if (this.stop > 0) { this.stop = Math.max(0, this.stop - dt); return this.stopScale; }
        return 1;
    },
    // ---------- направленная тряска ----------
    // dx, dz — ось удара в мире (нормализуется), amp — амплитуда в тайлах, freq — Гц, decay — скорость затухания
    shake(dx, dz, amp, freq = 22, decay = 9) {
        const l = Math.hypot(dx, dz);
        if (l < 1e-4) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= l; dz /= l; }
        if (this.shakes.length > 6) this.shakes.shift();
        this.shakes.push({ dx, dz, amp: Math.min(0.6, amp), freq, decay, t: 0 });
    },
    // Удар по цели: фриз + тряска вдоль линии «герой → цель». heavy 0..1 — насколько тяжёлый удар
    impact(dx, dz, heavy, crit) {
        const k = Math.max(0, Math.min(1.5, heavy));
        this.hitstop(crit ? 0.066 : 0.02 + 0.03 * k);
        this.shake(dx, dz, 0.05 + 0.1 * k + (crit ? 0.06 : 0), 20, 10);
    },
    // ---------- камера ----------
    // Критически затухающая пружина вместо «гвоздей»: камера догоняет героя с отставанием на рывках
    follow(tgt, px, pz) {
        const dt = Math.min(0.05, this.realDt);
        let c = this.cam;
        if (!c || Math.hypot(px - c.x, pz - c.z) > 8) c = this.cam = { x: px, z: pz, vx: 0, vz: 0, lx: px, lz: pz, fx: 0, fz: 0 };   // телепорт — без пролёта камеры
        // Сглаженная скорость героя: на ровном беге камера её «знает» и держит героя в центре,
        // а резкий рывок (дэш, отбрасывание) в неё почти не попадает — камера отстаёт и догоняет
        const ivx = (px - c.lx) / Math.max(dt, 1e-3), ivz = (pz - c.lz) / Math.max(dt, 1e-3); c.lx = px; c.lz = pz;
        const sm = Math.min(1, dt * 3), cap = 6;
        c.fx += (Math.max(-cap, Math.min(cap, ivx)) - c.fx) * sm; c.fz += (Math.max(-cap, Math.min(cap, ivz)) - c.fz) * sm;
        const w = 6.5;   // жёсткость критически затухающей пружины
        const ax = w * w * (px - c.x) + 2 * w * (c.fx - c.vx), az = w * w * (pz - c.z) + 2 * w * (c.fz - c.vz);
        c.vx += ax * dt; c.vz += az * dt; c.x += c.vx * dt; c.z += c.vz * dt;
        tgt.x = c.x; tgt.z = c.z;
    },
    // Смещение камеры: тряска + покачивание в такт шагам (step — данные шага героя из Actors3D)
    offset(step) {
        const dt = Math.min(0.05, this.realDt);
        let x = 0, y = 0, z = 0;
        for (let i = this.shakes.length - 1; i >= 0; i--) {
            const s = this.shakes[i]; s.t += dt;
            const env = s.amp * Math.exp(-s.decay * s.t);
            if (env < 0.002) { this.shakes.splice(i, 1); continue; }
            const v = Math.sin(s.t * s.freq * Math.PI * 2) * env;   // затухающие колебания по одной оси
            x += s.dx * v; z += s.dz * v; y += v * 0.25;
        }
        let bx = 0, by = 0, bz = 0;
        if (step) {
            // Проседание в момент постановки стопы и лёгкое раскачивание вбок с частотой полного цикла шага
            const A = 0.06 * step.weight * Math.min(1, step.spd / 3);
            by = -step.dip * A;
            const sway = Math.sin(step.cycle * Math.PI * 2) * A * 0.35;
            bx = step.rx * sway; bz = step.rz * sway;
        }
        const b = this.bob || (this.bob = { x: 0, y: 0, z: 0 }), k = Math.min(1, dt * 18);
        b.x += (bx - b.x) * k; b.y += (by - b.y) * k; b.z += (bz - b.z) * k;
        const o = this.off; o.x = x + b.x; o.y = y + b.y; o.z = z + b.z;
        return o;
    }
};
