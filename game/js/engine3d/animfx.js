// ============================================================================
// АНИМАЦИЯ И VFX: шлейфы оружия, 3D-частицы событий, ударные волны, вспышки света,
// руны зон поражения, синтезированные звуки и «удар» камеры
// ============================================================================

// ---------- Звуки (синтез через Web Audio того же SoundFX, без файлов) ----------
const Sfx3D = {
    ok() { if (typeof SoundFX === 'undefined' || SoundFX.muted) return null; try { SoundFX.init(); } catch (e) { } return SoundFX.ctx || null; },
    tone(f0, f1, dur, type = 'sine', vol = 0.1, delay = 0, filt) {
        const c = this.ok(); if (!c) return;
        const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (filt) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); node = f; }
        node.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, type = 'bandpass', freq = 1200, vol = 0.1, delay = 0, sweep, q = 1) {
        const c = this.ok(); if (!c) return;
        if (!this.nbuf) { const n = c.sampleRate * 2; this.nbuf = c.createBuffer(1, n, c.sampleRate); const d = this.nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
        const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.nbuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.15)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, k = 1) {
        const T = this;
        switch (name) {
            case 'slash': T.noise(0.2, 'bandpass', 900, 0.09 * k, 0, 3200, 1.4); T.tone(320, 140, 0.16, 'sine', 0.03 * k); break;
            case 'heavy': T.noise(0.5, 'lowpass', 900, 0.32 * k, 0, 120); T.tone(110, 38, 0.55, 'sine', 0.35 * k); break;
            case 'whoosh': T.noise(0.14, 'bandpass', 2400, 0.05 * k, 0, 900, 2); break;
            case 'impact': T.noise(0.25, 'lowpass', 1800, 0.12 * k, 0, 200); T.tone(160, 60, 0.22, 'triangle', 0.08 * k); break;
            case 'seal': T.noise(0.35, 'highpass', 3500, 0.12, 0, 9000); T.tone(1500, 500, 0.4, 'triangle', 0.06); T.tone(2200, 900, 0.3, 'sine', 0.04, 0.05); break;
            case 'chest': T.tone(150, 105, 0.3, 'sawtooth', 0.035, 0, 700); [880, 1175, 1568, 2093].forEach((f, i) => T.tone(f, f * 1.01, 0.5, 'sine', 0.06, 0.18 + i * 0.07)); T.noise(0.6, 'highpass', 6000, 0.04, 0.2); break;
            case 'pickup': T.tone(1046, 1568, 0.12, 'sine', 0.06); T.tone(2093, 2093, 0.18, 'sine', 0.035, 0.07); break;
            case 'stance': T.tone(2600, 1900, 0.45, 'triangle', 0.06); T.noise(0.18, 'highpass', 5500, 0.07); T.tone(3200, 2400, 0.35, 'sine', 0.03, 0.06); break;
            case 'transform': T.tone(70, 28, 1.4, 'sine', 0.45); T.tone(110, 440, 1.0, 'sawtooth', 0.05, 0, 900); T.noise(1.2, 'lowpass', 400, 0.22, 0.1, 80); T.tone(880, 220, 0.9, 'triangle', 0.04, 0.4); break;
            case 'buff': [523, 659, 784, 1046].forEach((f, i) => T.tone(f, f, 0.6, 'sine', 0.05, i * 0.06)); T.noise(0.5, 'highpass', 7000, 0.03); break;
            case 'charge': T.tone(90, 520, k, 'sawtooth', 0.045, 0, 1200); T.tone(180, 1040, k, 'sine', 0.03); T.noise(k, 'bandpass', 300, 0.05, 0, 2500, 3); break;
            case 'ult': T.play('heavy', 1.3); T.tone(240, 50, 1.6, 'sawtooth', 0.08, 0, 600); T.noise(1.5, 'lowpass', 2500, 0.2, 0.05, 90); T.tone(1200, 300, 1.0, 'sine', 0.04, 0.05); break;
            case 'craft': T.tone(1850, 1800, 0.45, 'triangle', 0.08); T.tone(920, 900, 0.3, 'square', 0.025, 0, 2000); T.noise(0.12, 'highpass', 3000, 0.12); T.tone(1850, 1800, 0.35, 'triangle', 0.06, 0.32); T.noise(0.1, 'highpass', 3000, 0.09, 0.32); break;
            case 'gacha': [523, 659, 784, 988, 1175, 1568].forEach((f, i) => T.tone(f, f * 1.02, 0.7, 'sine', 0.05, i * 0.08)); T.noise(1.2, 'highpass', 8000, 0.03, 0.2); break;
            case 'death': T.tone(300, 70, 0.6, 'sawtooth', 0.04, 0, 600); T.noise(0.5, 'lowpass', 700, 0.06, 0, 100); break;
            case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => T.tone(f, f, 0.5, 'triangle', 0.05, i * 0.07)); break;
        }
    }
};

const AnimFX = {
    MAXP: 4000,
    init(scene) {
        this.scene = scene;
        // ---------- 3D-частицы событий: скорость, гравитация, сопротивление, притяжение, размер и цвет ----------
        const N = this.MAXP, g = new THREE.BufferGeometry();
        this.P = { pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), col: new Float32Array(N * 3), size: new Float32Array(N), alpha: new Float32Array(N),
            life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), grav: new Float32Array(N), drag: new Float32Array(N), pull: new Float32Array(N * 4), i: 0 };
        g.setAttribute('position', new THREE.BufferAttribute(this.P.pos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aColor', new THREE.BufferAttribute(this.P.col, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aSize', new THREE.BufferAttribute(this.P.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(this.P.alpha, 1).setUsage(THREE.DynamicDrawUsage));
        this.pMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uScale: { value: 600 } },
            vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
                void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); vC = aColor; vA = aAlpha; }`,
            fragmentShader: `varying vec3 vC; varying float vA;
                void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; gl_FragColor = vec4(vC * (a * vA * 1.8) + vec3(a * a * vA * 0.6), 1.0); }`
        });
        this.points = new THREE.Points(g, this.pMat); this.points.frustumCulled = false; this.points.renderOrder = 10; scene.add(this.points);
        // ---------- Ударные волны: расходящиеся светящиеся кольца ----------
        const rg = new THREE.RingGeometry(0.8, 1, 64); rg.rotateX(-Math.PI / 2);
        this.shocks = [];
        for (let i = 0; i < 28; i++) {
            const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            m.visible = false; m.frustumCulled = false; scene.add(m); this.shocks.push({ m, life: 0 });
        }
        this.flashes = [];
        this.kickAmt = 0;
        // ---------- Шлейфы ----------
        this.trails = new Map();
        // ---------- Руны зон поражения ----------
        this.runeTex = this.makeRuneTex(); this.crackTex = this.makeCrackTex();
        this.runeBase = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uColor: { value: new THREE.Color() }, uProg: { value: 0 }, uTime: { value: 0 }, uRect: { value: 0 }, uCrack: { value: 0 }, uOp: { value: 1 }, uSpin: { value: 1 }, uLen: { value: 1 }, uRune: { value: this.runeTex }, uCrackTex: { value: this.crackTex } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `uniform vec3 uColor; uniform float uProg, uTime, uRect, uCrack, uOp, uSpin, uLen; uniform sampler2D uRune, uCrackTex; varying vec2 vUv;
                mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
                void main(){
                    float pulse = 0.78 + 0.22 * sin(uTime * 9.0);
                    vec3 c;
                    if (uRect > 0.5) {
                        float x = vUv.x * 2.0 - 1.0, y = vUv.y;
                        float edge = smoothstep(0.86, 0.95, abs(x)) * (1.0 - smoothstep(0.97, 1.0, abs(x)));
                        float chev = smoothstep(0.75, 1.0, fract(y * uLen * 0.6 - abs(x) * 0.5 - uTime * 1.8)) * (1.0 - abs(x));
                        float fill = step(y, uProg) * 0.22 + smoothstep(uProg - 0.03, uProg, y) * step(y, uProg) * 1.2;
                        float crack = texture2D(uCrackTex, vec2(vUv.x, y * uLen * 0.25)).r * uCrack * step(y, uProg);
                        float endFade = smoothstep(0.0, 0.02, y) * (1.0 - smoothstep(0.97, 1.0, y));
                        c = uColor * (edge * 1.1 + chev * 0.6 * pulse + fill + crack) * endFade;
                    } else {
                        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
                        if (r > 1.0) discard;
                        float rune = texture2D(uRune, rot(uTime * 0.35 * uSpin) * p * 0.5 + 0.5).r;
                        float edge = smoothstep(0.9, 0.96, r) * (1.0 - smoothstep(0.98, 1.0, r));
                        float front = smoothstep(uProg - 0.05, uProg, r) * step(r, uProg);
                        float fill = step(r, uProg) * 0.18 + front * 1.3;
                        float crack = texture2D(uCrackTex, p * 0.5 + 0.5).r * uCrack * (0.3 + uProg);
                        c = uColor * (rune * 0.85 * pulse + edge * 1.3 + fill + crack);
                    }
                    gl_FragColor = vec4(c * uOp, 1.0);
                }`
        });
        this.discGeo = new THREE.PlaneGeometry(2, 2); this.discGeo.rotateX(-Math.PI / 2);
        this.rectGeo = new THREE.PlaneGeometry(1, 1); this.rectGeo.rotateX(Math.PI / 2); this.rectGeo.translate(0, 0, 0.5);
        this.hookGame();
    },

    // Текстура рунного круга: двойные кольца, полоса рун, гексаграмма, малые круги
    makeRuneTex() {
        const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
        g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.translate(S / 2, S / 2); g.lineCap = 'round';
        const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
        ring(246, 4); ring(232, 2); ring(186, 2); ring(174, 5); ring(90, 3);
        // Руны по кругу: процедурные знаки из штрихов
        let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 28; i++) {
            g.save(); g.rotate(i / 28 * Math.PI * 2); g.translate(0, -209); g.lineWidth = 3;
            g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12);
            for (let k = 0; k < 2; k++) { const y = -10 + rnd() * 16, s = rnd() < 0.5 ? -1 : 1; g.moveTo(0, y); g.lineTo(s * 9, y + (rnd() - 0.5) * 12); }
            g.stroke(); g.restore();
        }
        // Гексаграмма
        g.lineWidth = 3;
        [0, Math.PI].forEach(o => { g.beginPath(); for (let k = 0; k <= 3; k++) { const a = o + k / 3 * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * 174, y = Math.sin(a) * 174; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 132, Math.sin(a) * 132, 14, 0, Math.PI * 2); g.stroke(); }
        const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
    },
    // Трещины: ветвящиеся разломы от центра
    makeCrackTex() {
        const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
        g.strokeStyle = '#fff'; g.lineCap = 'round';
        let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const crack = (x, y, a, len, w, depth) => {
            g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
            for (let i = 0; i < len; i++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 5; y += Math.sin(a) * 5; g.lineTo(x, y); if (depth < 3 && rnd() < 0.08) { g.stroke(); crack(x, y, a + (rnd() - 0.5) * 1.6, len * 0.5, w * 0.6, depth + 1); g.beginPath(); g.moveTo(x, y); g.lineWidth = w; } }
            g.stroke();
        };
        for (let i = 0; i < 9; i++) crack(S / 2, S / 2, i / 9 * Math.PI * 2 + rnd() * 0.4, 22, 2.6, 0);
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    },
    // Индикатор зоны: круг (radius) или полоса (width × length) с прогрессом до удара
    rune(color, opts = {}) {
        const m = this.runeBase.clone();
        m.uniforms.uRune.value = this.runeTex; m.uniforms.uCrackTex.value = this.crackTex;
        m.uniforms.uColor.value = new THREE.Color(color); m.uniforms.uCrack.value = opts.crack || 0; m.uniforms.uSpin.value = opts.spin === undefined ? 1 : opts.spin;
        m.uniforms.uRect.value = opts.rect ? 1 : 0;
        const mesh = new THREE.Mesh(opts.rect ? this.rectGeo : this.discGeo, m); mesh.renderOrder = 3; mesh.frustumCulled = false;
        mesh.userData.rune = m.uniforms;
        return mesh;
    },

    // ---------- частицы ----------
    // o: x,y,z, n, color (число или массив), speed, up, spread (разлёт по горизонтали), life, size, sizeEnd, grav, drag, pull: {x,y,z,k}
    emit(o) {
        const P = this.P, N = this.MAXP, cols = Array.isArray(o.color) ? o.color : [o.color || 0xffffff], c = this.tc || (this.tc = new THREE.Color());
        for (let k = 0; k < (o.n || 10); k++) {
            const i = P.i; P.i = (P.i + 1) % N;
            const a = Math.random() * Math.PI * 2, sp = (o.speed || 2) * (0.4 + Math.random() * 0.8), h = o.spread === undefined ? 1 : o.spread;
            const rx = o.r ? (Math.random() - 0.5) * o.r * 2 : 0, rz = o.r ? (Math.random() - 0.5) * o.r * 2 : 0, ry = o.ry ? Math.random() * o.ry : 0;
            P.pos[i * 3] = o.x + rx; P.pos[i * 3 + 1] = (o.y || 0.5) + ry; P.pos[i * 3 + 2] = o.z + rz;
            if (o.dir) { P.vel[i * 3] = o.dir[0] * sp + (Math.random() - 0.5) * h; P.vel[i * 3 + 1] = o.dir[1] * sp + (Math.random() - 0.5) * h; P.vel[i * 3 + 2] = o.dir[2] * sp + (Math.random() - 0.5) * h; }
            else { P.vel[i * 3] = Math.cos(a) * sp * h; P.vel[i * 3 + 1] = (o.up || 0) * (0.5 + Math.random()) + (Math.random() - 0.3) * sp * (1 - h * 0.5); P.vel[i * 3 + 2] = Math.sin(a) * sp * h; }
            c.setHex(cols[Math.floor(Math.random() * cols.length)]);
            P.col[i * 3] = c.r; P.col[i * 3 + 1] = c.g; P.col[i * 3 + 2] = c.b;
            P.max[i] = P.life[i] = (o.life || 0.8) * (0.6 + Math.random() * 0.6);
            P.s0[i] = (o.size || 0.12) * (0.6 + Math.random() * 0.7); P.s1[i] = o.sizeEnd === undefined ? 0 : o.sizeEnd;
            P.grav[i] = o.grav === undefined ? 4 : o.grav; P.drag[i] = o.drag === undefined ? 1.5 : o.drag;
            if (o.pull) { P.pull[i * 4] = o.pull.x; P.pull[i * 4 + 1] = o.pull.y; P.pull[i * 4 + 2] = o.pull.z; P.pull[i * 4 + 3] = o.pull.k || 8; } else P.pull[i * 4 + 3] = 0;
        }
    },
    shock(x, y, z, color, r0, r1, life = 0.5, op = 1) {
        const s = this.shocks.find(s => s.life <= 0) || this.shocks[0];
        Object.assign(s, { x, y, z, r0, r1, life, max: life, op }); s.m.material.color.setHex(color); s.m.visible = true;
    },
    flash(x, z, color, i = 3, life = 0.35, h = 1.5) { this.flashes.push({ x, z, h, c: color, i, life, max: life }); if (this.flashes.length > 6) this.flashes.shift(); },
    kick(s) { this.kickAmt = Math.max(this.kickAmt, s); if (typeof triggerScreenShake === 'function') triggerScreenShake(s * 9); },
    // Готовый «удар» по земле: волна, искры, пыль, вспышка
    impact(x, z, color, size = 1, opts = {}) {
        const y = World3D.hAt(x, z) + 0.05;
        this.shock(x, y, z, color, 0.2 * size, 1.6 * size, 0.45);
        if (size > 1.2) this.shock(x, y, z, 0xffffff, 0.1 * size, 1.0 * size, 0.3, 0.6);
        this.emit({ x, y: y + 0.1, z, n: Math.round(18 * size), color: [color, 0xffffff], speed: 3 * size, up: 2.5, life: 0.6, size: 0.1, grav: 9, drag: 2 });
        this.emit({ x, y: y + 0.1, z, n: Math.round(10 * size), color: opts.dust || 0x6a5a4a, speed: 1.2 * size, up: 0.6, life: 0.9, size: 0.3 * size, sizeEnd: 0.5 * size, grav: -0.3, drag: 3 });
        this.flash(x, z, color, 2 + size * 1.5, 0.3 + size * 0.1);
    },

    // ---------- шлейфы ----------
    // Подать текущие точки оружия (основание и кончик); шлейф тянется, затухает и сам удаляется
    trail(key, base, tip, color, opts = {}) {
        let tr = this.trails.get(key);
        if (!tr) {
            const L = opts.len || 26, g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L * 6), 3).setUsage(THREE.DynamicDrawUsage));
            g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(L * 6), 3).setUsage(THREE.DynamicDrawUsage));
            const idx = []; for (let i = 0; i < L - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
            const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
            m.frustumCulled = false; m.renderOrder = 8; this.scene.add(m);
            tr = { m, L, s: [], color: new THREE.Color(), life: opts.life || 0.2, min: opts.minSpeed || 2.5, full: opts.fullSpeed || 9, core: opts.core === undefined ? 0.5 : opts.core, idle: 0 };
            this.trails.set(key, tr);
        }
        tr.color.setHex(color); tr.touched = true; tr.always = !!opts.always;
        const now = Engine3D.t, s = tr.s, last = s[s.length - 1];
        if (last) {
            const dTip = last.t.distanceTo(tip), sp = dTip / Math.max(1e-3, now - last.time);
            // Плавная дуга: при быстром взмахе вставляем промежуточные точки по дуге вокруг основания
            const steps = Math.min(8, Math.floor(dTip / 0.1));
            if (steps > 1) {
                const d0 = last.t.clone().sub(last.b), d1 = tip.clone().sub(base), l0 = d0.length(), l1 = d1.length();
                const q = new THREE.Quaternion().setFromUnitVectors(d0.clone().normalize(), d1.clone().normalize()), qi = new THREE.Quaternion();
                for (let k = 1; k < steps; k++) {
                    const f = k / steps; qi.identity().slerp(q, f);
                    const b = last.b.clone().lerp(base, f), d = d0.clone().normalize().applyQuaternion(qi).multiplyScalar(l0 + (l1 - l0) * f);
                    s.push({ b, t: b.clone().add(d), time: last.time + (now - last.time) * f, sp });
                }
            }
            s.push({ b: base.clone(), t: tip.clone(), time: now, sp });
        } else s.push({ b: base.clone(), t: tip.clone(), time: now, sp: 0 });
        while (s.length > tr.L) s.shift();
    },
    updateTrails() {
        const now = Engine3D.t;
        for (const [key, tr] of this.trails) {
            const s = tr.s;
            while (s.length && now - s[0].time > tr.life) s.shift();
            if (!tr.touched && !s.length) { this.scene.remove(tr.m); tr.m.geometry.dispose(); tr.m.material.dispose(); this.trails.delete(key); continue; }
            tr.touched = false;
            const pos = tr.m.geometry.attributes.position.array, col = tr.m.geometry.attributes.color.array, n = s.length;
            for (let i = 0; i < tr.L; i++) {
                const smp = s[Math.min(n - 1, i)] || null, o = i * 6;
                if (!smp || i >= n) { pos.fill(0, o, o + 6); col.fill(0, o, o + 6); if (n) { const l = s[n - 1]; pos[o] = l.b.x; pos[o + 1] = l.b.y; pos[o + 2] = l.b.z; pos[o + 3] = l.b.x; pos[o + 4] = l.b.y; pos[o + 5] = l.b.z; } continue; }
                const age = (now - smp.time) / tr.life, fade = Math.pow(Math.max(0, 1 - age), 1.6) * (i / Math.max(1, n - 1));
                const spk = tr.always ? 1 : Math.max(0, Math.min(1, (smp.sp - tr.min) / (tr.full - tr.min)));
                const a = fade * spk, w = a * tr.core;
                // Основание шлейфа тусклее, кончик ярче и белее (энергетическое ядро)
                const b = smp.b.clone().lerp(smp.t, 0.35);
                pos[o] = b.x; pos[o + 1] = b.y; pos[o + 2] = b.z; pos[o + 3] = smp.t.x; pos[o + 4] = smp.t.y; pos[o + 5] = smp.t.z;
                col[o] = tr.color.r * a * 0.25; col[o + 1] = tr.color.g * a * 0.25; col[o + 2] = tr.color.b * a * 0.25;
                col[o + 3] = Math.min(1.5, tr.color.r * a + w); col[o + 4] = Math.min(1.5, tr.color.g * a + w); col[o + 5] = Math.min(1.5, tr.color.b * a + w);
            }
            tr.m.geometry.attributes.position.needsUpdate = true; tr.m.geometry.attributes.color.needsUpdate = true;
        }
    },

    // ---------- события игры: превращения, стойки, баффы, уровень, крафт, гача ----------
    hookGame() {
        const wrap = (name, fn) => { const orig = window[name]; if (typeof orig !== 'function') return; window[name] = function () { const r = orig.apply(this, arguments); try { fn.apply(null, arguments); } catch (e) { } return r; }; };
        // init() вызывается из window.onload, когда функции game.js уже объявлены
        {
            wrap('craftRecipe', () => { Actors3D.gesture('craft'); Sfx3D.play('craft'); const p = this.heroPos(); this.emit({ x: p.x + Math.sin(Actors3D.player ? Actors3D.player.rot : 0) * 0.5, y: p.y + 0.6, z: p.z + Math.cos(Actors3D.player ? Actors3D.player.rot : 0) * 0.5, n: 40, color: [0xffb040, 0xfff0a0, 0xff6a1a], speed: 3, up: 3, life: 0.6, size: 0.06, grav: 10 }); this.flash(p.x, p.z, 0xffa040, 3, 0.25); });
            wrap('doGachaPulls', () => { Actors3D.gesture('pray'); Sfx3D.play('gacha'); const p = this.heroPos(); this.pillar = { x: p.x, z: p.z, t: 0 }; this.emit({ x: p.x, y: p.y + 0.2, z: p.z, n: 120, color: [0xfde68a, 0xffffff, 0xc084fc], speed: 2, up: 4, life: 1.4, size: 0.09, grav: -0.5, drag: 1, r: 0.6 }); this.flash(p.x, p.z, 0xfde68a, 4, 0.8, 3); });
        }
    },
    heroPos() { const x = player.x / G3.tile, z = player.y / G3.tile; return { x, y: World3D.hAt(x, z), z }; },
    watch() {
        const w = this.w || (this.w = { alter: !!player.saberAlter, stance: player.archerStance, avalon: 0, level: player.level, ult: null, hero: player.heroType });
        const p = this.heroPos();
        if (w.hero !== player.heroType) { w.hero = player.heroType; w.alter = !!player.saberAlter; w.stance = player.archerStance; }
        if (!!player.saberAlter !== w.alter) {
            w.alter = !!player.saberAlter;
            if (w.alter) { // Переход Сейбер в тёмную форму: столб тьмы, багровые искры, волна
                Sfx3D.play('transform'); this.kick(1);
                this.emit({ x: p.x, y: p.y + 0.1, z: p.z, n: 260, color: [0x1a0508, 0x5a0a14, 0xff2030], speed: 1.5, up: 5, life: 1.6, size: 0.18, sizeEnd: 0.05, grav: -1, drag: 1.2, r: 0.5 });
                this.shock(p.x, p.y + 0.05, p.z, 0xff2030, 0.3, 6, 0.9); this.shock(p.x, p.y + 0.05, p.z, 0x5a0a14, 0.2, 4, 1.2);
                this.flash(p.x, p.z, 0xff2030, 6, 1.0, 2.5); Actors3D.transition(0.9);
            }
        }
        if (player.archerStance !== w.stance) { // Смена стойки Арчера: клинки «проецируются» из света
            w.stance = player.archerStance;
            if (player.heroType === 'archer') {
                Sfx3D.play('stance');
                this.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: 70, color: [0xe0f2fe, 0xef4444, 0xffffff], speed: 2.2, up: 0.5, life: 0.5, size: 0.07, grav: 0, drag: 3, pull: { x: p.x, y: p.y + 0.8, z: p.z, k: -6 } });
                this.shock(p.x, p.y + 0.05, p.z, 0xef4444, 0.2, 1.4, 0.35); Actors3D.transition(0.45);
            }
        }
        const av = player.avalonBuffTimer || 0;
        if (av > 0 && w.avalon <= 0) { Sfx3D.play('buff'); this.shock(p.x, p.y + 0.05, p.z, 0xfde047, 0.3, 3, 0.7); this.emit({ x: p.x, y: p.y, z: p.z, n: 90, color: [0xfde047, 0xffffff], speed: 0.6, up: 3, life: 1.2, size: 0.08, grav: -1, r: 0.6 }); }
        w.avalon = av;
        if (player.level > (w.level || 0)) { if (w.level) { Sfx3D.play('levelup'); for (let k = 0; k < 3; k++) this.shock(p.x, p.y + 0.05 + k * 0.5, p.z, 0xfde68a, 0.2, 1.5, 0.6 + k * 0.2); this.emit({ x: p.x, y: p.y, z: p.z, n: 120, color: [0xfde68a, 0xfff7c0], speed: 0.4, up: 4, life: 1.4, size: 0.08, grav: -1.5, r: 0.5 }); } w.level = player.level; }
        // Экскалибур: зарядка (столб света, стягивание энергии) → удар
        const c = player.ultCast;
        if (c && !w.ult) { Sfx3D.play('charge', Math.max(0.6, c.dur - 0.3)); w.ultSwing = false; }
        if (c && c.swing && !w.ultSwing) { w.ultSwing = true; }
        w.ult = c;
    },

    update(dt) {
        const E = Engine3D, now = E.t;
        this.pMat.uniforms.uScale.value = E.renderer.domElement.height * 0.5 / Math.tan(E.camera.fov * Math.PI / 360);
        if (typeof player !== 'undefined') this.watch();
        // Частицы
        const P = this.P, N = this.MAXP;
        for (let i = 0; i < N; i++) {
            if (P.life[i] <= 0) { if (P.alpha[i] !== 0) { P.alpha[i] = 0; P.size[i] = 0; } continue; }
            P.life[i] -= dt; const k = Math.max(0, P.life[i] / P.max[i]), o = i * 3, dr = Math.max(0, 1 - P.drag[i] * dt);
            P.vel[o] *= dr; P.vel[o + 1] = P.vel[o + 1] * dr - P.grav[i] * dt; P.vel[o + 2] *= dr;
            if (P.pull[i * 4 + 3]) { const pk = P.pull[i * 4 + 3] * dt; P.vel[o] += (P.pull[i * 4] - P.pos[o]) * pk; P.vel[o + 1] += (P.pull[i * 4 + 1] - P.pos[o + 1]) * pk; P.vel[o + 2] += (P.pull[i * 4 + 2] - P.pos[o + 2]) * pk; }
            P.pos[o] += P.vel[o] * dt; P.pos[o + 1] += P.vel[o + 1] * dt; P.pos[o + 2] += P.vel[o + 2] * dt;
            const gy = World3D.hAt(P.pos[o], P.pos[o + 2]);
            if (P.pos[o + 1] < gy + 0.02 && P.grav[i] > 0) { P.pos[o + 1] = gy + 0.02; P.vel[o + 1] *= -0.35; P.vel[o] *= 0.6; P.vel[o + 2] *= 0.6; }
            P.alpha[i] = Math.min(1, k * 2.2) * (k > 0.92 ? (1 - k) * 12 : 1);
            P.size[i] = P.s1[i] + (P.s0[i] - P.s1[i]) * k;
        }
        const ga = this.points.geometry.attributes;
        ga.position.needsUpdate = ga.aColor.needsUpdate = ga.aSize.needsUpdate = ga.aAlpha.needsUpdate = true;
        // Волны
        for (const s of this.shocks) {
            if (s.life <= 0) { s.m.visible = false; continue; }
            s.life -= dt; const k = 1 - Math.max(0, s.life) / s.max, e = 1 - Math.pow(1 - k, 3);
            s.m.position.set(s.x, s.y, s.z); s.m.scale.setScalar(s.r0 + (s.r1 - s.r0) * e); s.m.material.opacity = (1 - k) * s.op;
        }
        // Вспышки света и «удар» камеры
        this.flashes = this.flashes.filter(f => (f.life -= dt) > 0);
        this.kickAmt = Math.max(0, this.kickAmt - dt * 3);
        // Столб света гачи
        if (this.pillar) {
            const pl = this.pillar; pl.t += dt;
            if (!pl.mesh) { pl.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); pl.mesh.frustumCulled = false; this.scene.add(pl.mesh); }
            const k = pl.t / 1.6; pl.mesh.position.set(pl.x, 7, pl.z); pl.mesh.scale.set(0.4 + k, 1, 0.4 + k); pl.mesh.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.45;
            if (k >= 1) { this.scene.remove(pl.mesh); pl.mesh.geometry.dispose(); pl.mesh.material.dispose(); this.pillar = null; }
        }
        this.updateTrails();
    },
    flashLights() { return this.flashes.map(f => ({ x: f.x, z: f.z, h: f.h, c: f.c, i: f.i * (f.life / f.max) })); }
};
