// ============================================================================
// ПОГОДА В РЕАЛЬНОМ ВРЕМЕНИ: ливень с брызгами и рябью на лужах, стелющийся туман, тени облаков,
// пыль в лучах света, угли, багровое зарево у замка, мокрая земля
// ============================================================================
const Weather3D = {
    N: 3600, MAXS: 1200, MAXR: 260, MAXD: 700,
    wet: 0, prof: null, cloudOff: null,
    init(scene) {
        this.scene = scene; this.cloudOff = new THREE.Vector2();
        // ---------- Капли дождя: отрезки, у каждой своя скорость ----------
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.N * 6); this.seed = new Float32Array(this.N * 4);
        for (let i = 0; i < this.N; i++) { this.seed[i * 4] = Math.random() * 64 - 32; this.seed[i * 4 + 1] = Math.random() * 22; this.seed[i * 4 + 2] = Math.random() * 64 - 32; this.seed[i * 4 + 3] = 0.8 + Math.random() * 0.4; }
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8d4f0, transparent: true, opacity: 0.42 }));
        this.lines.frustumCulled = false; scene.add(this.lines);
        // ---------- Брызги: капельки, отскакивающие от земли ----------
        this.sp = { pos: new Float32Array(this.MAXS * 3), vel: new Float32Array(this.MAXS * 3), life: new Float32Array(this.MAXS), n: 0 };
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
        this.splash = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8ecff, size: 0.07, map: G3.glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.splash.frustumCulled = false; scene.add(this.splash);
        // ---------- Рябь: расходящиеся кольца на лужах ----------
        const rg = new THREE.RingGeometry(0.8, 1, 28); rg.rotateX(-Math.PI / 2);
        this.ripples = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), this.MAXR);
        this.ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.ripples.frustumCulled = false;
        this.rip = []; for (let i = 0; i < this.MAXR; i++) { this.rip.push({ x: 0, z: 0, t: 9, d: 1 }); this.ripples.setColorAt(i, new THREE.Color(0, 0, 0)); }
        scene.add(this.ripples);
        // ---------- Стелющийся туман: три слоя с разной скоростью ----------
        this.fogLayers = [0.18, 0.5, 0.95].map((h, i) => {
            const m = new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, fog: false,
                uniforms: { tex: { value: Tex3D.T.fog }, t: { value: 0 }, col: { value: new THREE.Color() }, op: { value: 0 }, c: { value: new THREE.Vector2() }, k: { value: i } },
                vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
                fragmentShader: `uniform sampler2D tex; uniform float t, op, k; uniform vec3 col; uniform vec2 c; varying vec3 wp;
                    void main(){
                        vec2 uv = wp.xz * (0.03 + k * 0.012);
                        float n = texture2D(tex, uv + vec2(t * 0.012, t * 0.005) * (1.0 + k)).r * texture2D(tex, uv * 2.3 - vec2(t * 0.007, -t * 0.011)).r * 2.2;
                        float a = smoothstep(0.18, 0.85, n) * op * (1.0 - smoothstep(22.0, 40.0, distance(wp.xz, c)));
                        gl_FragColor = vec4(col, a);
                    }`
            });
            const p = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), m); p.rotation.x = -Math.PI / 2; p.position.y = h; p.renderOrder = 5; p.frustumCulled = false;
            scene.add(p); return p;
        });
        // ---------- Пыль в лучах и угли ----------
        this.dpos = new Float32Array(this.MAXD * 3); this.dvel = new Float32Array(this.MAXD * 3);
        for (let i = 0; i < this.MAXD; i++) { this.dpos[i * 3] = Math.random() * 50 - 25; this.dpos[i * 3 + 1] = Math.random() * 6; this.dpos[i * 3 + 2] = Math.random() * 50 - 25; this.dvel[i * 3] = Math.random() - 0.5; this.dvel[i * 3 + 1] = Math.random() - 0.5; this.dvel[i * 3 + 2] = Math.random() - 0.5; }
        const dg = new THREE.BufferGeometry(); this.dposW = new Float32Array(this.MAXD * 3); dg.setAttribute('position', new THREE.BufferAttribute(this.dposW, 3));
        this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.09, map: G3.glowTexture, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.dust.frustumCulled = false; scene.add(this.dust);
        // ---------- Лучи света сквозь кроны и окна ----------
        const sc = document.createElement('canvas'); sc.width = 64; sc.height = 256; const sx = sc.getContext('2d');
        const gr = sx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 256);
        sx.globalCompositeOperation = 'destination-in'; const gh = sx.createLinearGradient(0, 0, 64, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gh; sx.fillRect(0, 0, 64, 256);
        const stex = new THREE.CanvasTexture(sc);
        this.shafts = [];
        for (let i = 0; i < 7; i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + Math.random() * 1.6, 11), new THREE.MeshBasicMaterial({ map: stex, color: 0xffe8b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
            m.userData = { ox: (Math.random() - 0.5) * 30, oz: (Math.random() - 0.5) * 22, ph: Math.random() * 6 };
            m.frustumCulled = false; scene.add(m); this.shafts.push(m);
        }
    },

    // Атмосфера по зоне, погоде и времени суток
    profile(w, zone, night) {
        const rain = Math.min(1.3, (w.rainCount || 0) / 220);
        const forest = zone === 'forest' || zone === 'clawhold' || zone === 'boneswoods' || zone === 'serpent_coast';
        const crimson = zone === 'castle' || zone === 'sanguinia_heights' || zone === 'crimson_marsh';
        const hell = zone === 'hell', grim = zone === 'dreadlands' || zone === 'shadowlands' || zone === 'forsaken_hills' || zone === 'abyss';
        const P = { rain, forest, crimson, hell, groundFog: 0.15, fogCol: 0x8a98a8, dust: 0, embers: 0, shafts: 0, cloud: 0.25, glow: 0 };
        if (w.id === 'fog') P.groundFog = 0.85;
        if (forest) { P.groundFog = Math.max(P.groundFog, night > 0.5 ? 0.75 : 0.5); P.fogCol = night > 0.5 ? 0x4a5a70 : 0x9aa8a8; P.shafts = 1 - night; P.dust = 1 - night; }
        if (grim) { P.groundFog = Math.max(P.groundFog, 0.55); P.fogCol = 0x6a6878; P.embers = w.id === 'ash' ? 0.6 : 0; }
        if (crimson) { P.groundFog = Math.max(P.groundFog, 0.6); P.fogCol = 0x7a1a24; P.embers = 0.5; P.glow = 1; P.shafts = zone === 'castle' ? 0.6 : 0; }
        if (hell) { P.groundFog = 0.45; P.fogCol = 0xa8401a; P.embers = 1; P.glow = 0.6; P.cloud = 0; }
        if (zone === 'castle' || zone === 'shadow_realm') { P.cloud = 0; P.dust = Math.max(P.dust, 0.6); }
        if (rain > 0) { P.cloud = Math.max(P.cloud, 0.45 + rain * 0.35); P.dust = 0; P.shafts *= 0.2; }
        if (night > 0.5) { P.cloud *= 0.3; P.fogCol = new THREE.Color(P.fogCol).multiplyScalar(0.45).getHex(); }
        return P;
    },

    update(dt, w, tgt) {
        const E = Engine3D, t = E.t, zone = playerZone(), night = Math.max(0, Math.min(1, (E.darkness() - 0.34) / 0.3));
        const P = this.prof = this.profile(w, zone, night);
        const wind = (w.windX || 0) / 200;
        // ---------- Влажность земли и облака ----------
        this.wet += ((P.rain > 0.05 ? 1 : 0) - this.wet) * Math.min(1, dt * (P.rain > 0.05 ? 0.25 : 0.05));
        this.cloudOff.x += dt * (0.004 + wind * 0.006); this.cloudOff.y += dt * 0.0025;
        if (World3D.U) { World3D.U.uWet.value = this.wet; World3D.U.uCloud.value = P.cloud * (1 - night * 0.7); World3D.U.uCloudOff.value.copy(this.cloudOff); }
        // Облачность приглушает солнце; багровое зарево у замка
        E.sun.intensity *= 1 - Math.min(0.55, P.rain * 0.45);
        if (P.glow > 0) {
            E.scene.fog.color.lerp(new THREE.Color(0x3a0810), 0.55 * P.glow); E.scene.background.copy(E.scene.fog.color);
            E.hemi.color.lerp(new THREE.Color(0xff3a4a), 0.35 * P.glow);
        }
        // ---------- Дождь ----------
        const count = Math.min(this.N, Math.round(P.rain * this.N * 0.8));
        this.lines.visible = count > 0;
        if (count) {
            const sp = 22 + (w.speedY || 700) / 45, len = 0.45 + sp * 0.025;
            for (let i = 0; i < count; i++) {
                const s4 = i * 4; let y = this.seed[s4 + 1] - dt * sp * this.seed[s4 + 3];
                const x = tgt.x + this.seed[s4] - wind * (22 - y) * 0.35, z = tgt.z + this.seed[s4 + 2];
                if (y < 0) {
                    // Удар о землю: брызги и рябь на лужах
                    if (i % 3 === 0) this.spawnSplash(x, z, Tex3D.puddleAt(x, z));
                    y += 22; this.seed[s4] = Math.random() * 64 - 32; this.seed[s4 + 2] = Math.random() * 64 - 32;
                }
                this.seed[s4 + 1] = y;
                const o = i * 6;
                this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
                this.pos[o + 3] = x + wind * len * 0.5; this.pos[o + 4] = y + len; this.pos[o + 5] = z;
            }
            this.lines.geometry.setDrawRange(0, count * 2);
            this.lines.geometry.attributes.position.needsUpdate = true;
            this.lines.material.opacity = 0.3 + Math.min(0.25, P.rain * 0.2);
        }
        // Брызги
        const S = this.sp; let alive = 0;
        for (let i = 0; i < S.n; i++) {
            if (S.life[i] <= 0) continue;
            S.life[i] -= dt; S.vel[i * 3 + 1] -= 14 * dt;
            S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] = Math.max(0.01, S.pos[i * 3 + 1] + S.vel[i * 3 + 1] * dt); S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
            if (S.life[i] <= 0) S.pos[i * 3 + 1] = -50;
            alive++;
        }
        if (!alive) S.n = 0;
        this.splash.geometry.setDrawRange(0, S.n);
        this.splash.geometry.attributes.position.needsUpdate = true;
        // Рябь
        const dummy = this.dummy || (this.dummy = new THREE.Object3D()), c = this.tmpC || (this.tmpC = new THREE.Color());
        for (let i = 0; i < this.MAXR; i++) {
            const r = this.rip[i];
            if (r.t > r.d) { if (r.vis) { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); this.ripples.setMatrixAt(i, dummy.matrix); r.vis = false; } continue; }
            r.t += dt; const k = r.t / r.d;
            dummy.position.set(r.x, 0.03, r.z); dummy.scale.setScalar(0.05 + k * r.s); dummy.updateMatrix(); this.ripples.setMatrixAt(i, dummy.matrix);
            const a = (1 - k) * 0.55; c.setRGB(a * 0.8, a * 0.9, a); this.ripples.setColorAt(i, c); r.vis = true;
        }
        this.ripples.instanceMatrix.needsUpdate = true; this.ripples.instanceColor.needsUpdate = true;
        // ---------- Туман у земли ----------
        const fc = new THREE.Color(P.fogCol);
        this.fogLayers.forEach((l, i) => {
            l.position.x = tgt.x; l.position.z = tgt.z;
            const u = l.material.uniforms; u.t.value = t; u.c.value.set(tgt.x, tgt.z); u.col.value.copy(fc);
            u.op.value += ((P.groundFog * (0.55 - i * 0.14)) - u.op.value) * Math.min(1, dt * 0.8);
            l.visible = u.op.value > 0.01;
        });
        // ---------- Пыль в лучах / угли ----------
        const embers = P.embers > P.dust;
        const amount = Math.round(this.MAXD * Math.max(P.dust * 0.6, P.embers));
        this.dust.visible = amount > 0;
        if (amount) {
            this.dust.material.color.setHex(embers ? 0xff7a2a : 0xfff0c8);
            this.dust.material.size = embers ? 0.13 : 0.07;
            for (let i = 0; i < amount; i++) {
                const o = i * 3;
                if (embers) { this.dpos[o + 1] += dt * (0.8 + Math.abs(this.dvel[o + 1]) * 1.5); this.dpos[o] += dt * (wind * 2 + Math.sin(t + i) * 0.3); }
                else { this.dpos[o] += dt * this.dvel[o] * 0.25; this.dpos[o + 1] += dt * this.dvel[o + 1] * 0.12; this.dpos[o + 2] += dt * this.dvel[o + 2] * 0.25; }
                if (this.dpos[o + 1] > 6 || this.dpos[o + 1] < 0) { this.dpos[o + 1] = embers ? 0 : Math.random() * 6; this.dpos[o] = Math.random() * 50 - 25; this.dpos[o + 2] = Math.random() * 50 - 25; }
                this.dposW[o] = tgt.x + this.dpos[o]; this.dposW[o + 1] = 0.2 + this.dpos[o + 1]; this.dposW[o + 2] = tgt.z + this.dpos[o + 2];
            }
            this.dust.geometry.setDrawRange(0, amount);
            this.dust.geometry.attributes.position.needsUpdate = true;
        }
        // ---------- Лучи света ----------
        const yaw = Math.atan2(E.camera.position.x - tgt.x, E.camera.position.z - tgt.z);
        this.shafts.forEach(s => {
            const d = s.userData;
            s.visible = P.shafts > 0.05;
            if (!s.visible) return;
            s.position.set(tgt.x + d.ox, 4.6, tgt.z + d.oz);
            s.rotation.set(0, yaw, 0); s.rotateZ(-0.45); s.rotateX(0.25);
            s.material.color.setHex(P.crimson ? 0xff5a6a : 0xffe8b0);
            s.material.opacity = P.shafts * (0.05 + Math.sin(t * 0.4 + d.ph) * 0.025);
        });
    },
    spawnSplash(x, z, puddle) {
        const S = this.sp;
        for (let k = 0; k < 3; k++) {
            let i = S.n < this.MAXS ? S.n++ : Math.floor(Math.random() * this.MAXS);
            const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 0.8;
            S.pos[i * 3] = x; S.pos[i * 3 + 1] = 0.02; S.pos[i * 3 + 2] = z;
            S.vel[i * 3] = Math.cos(a) * v; S.vel[i * 3 + 1] = 1.6 + Math.random() * 1.8; S.vel[i * 3 + 2] = Math.sin(a) * v;
            S.life[i] = 0.25 + Math.random() * 0.15;
        }
        if (puddle || Math.random() < 0.12) {
            this.ripI = ((this.ripI || 0) + 1) % this.MAXR;
            const r = this.rip[this.ripI]; r.x = x; r.z = z; r.t = 0; r.d = 0.5 + Math.random() * 0.4; r.s = puddle ? 0.45 : 0.22;
        }
    }
};
