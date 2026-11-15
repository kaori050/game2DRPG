// ============================================================================
// ЭФФЕКТЫ: снаряды, частицы, заклинания, опасные зоны, добыча и сундуки, точки интереса, порталы
// + Labels3D: подписи, урон, полоски здоровья и экранные эффекты поверх 3D
// ============================================================================
const colCache = new Map();
function col3(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0xffffff;
    let c = colCache.get(s);
    if (c === undefined) {
        const str = /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(s) ? 'rgb(' + s + ')' : s.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)');
        try { c = new THREE.Color(str).getHex(); } catch (e) { c = 0xffffff; }
        colCache.set(s, c);
    }
    return c;
}

const FX3D = {
    live: new Map(), subs: new WeakMap(), MAXP: 2500,
    init(scene) {
        this.scene = scene;
        const B = Models3D;
        this.add = (m, mat) => m;
        // Общие геометрии
        this.G = {
            ring: (() => { const g = new THREE.RingGeometry(0.9, 1, 48); g.rotateX(-Math.PI / 2); return g; })(),
            disc: (() => { const g = new THREE.CircleGeometry(1, 40); g.rotateX(-Math.PI / 2); return g; })(),
            beam: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true),
            arrow: (() => { const g = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4); g.rotateX(Math.PI / 2); return g; })(),
            arrowHead: (() => { const g = new THREE.ConeGeometry(0.04, 0.1, 4); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.34); return g; })(),
            orb: new THREE.IcosahedronGeometry(1, 1),
            crystal: new THREE.OctahedronGeometry(1, 0),
            box: new THREE.BoxGeometry(1, 1, 1),
            cone: new THREE.ConeGeometry(1, 1, 10, 1, true),
            crescent: (() => { const g = new THREE.TorusGeometry(0.6, 0.08, 4, 16, Math.PI); g.rotateX(-Math.PI / 2); return g; })()
        };
        this.add3 = (o) => { scene.add(o); return o; };
        this.basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }, o || {}));
        // Частицы: одна система Points на все искры
        const pg = new THREE.BufferGeometry();
        this.pPos = new Float32Array(this.MAXP * 3); this.pCol = new Float32Array(this.MAXP * 3);
        pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
        pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
        this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.28, map: G3.glowTexture, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
        this.points.frustumCulled = false; scene.add(this.points);
        this.tmpC = new THREE.Color();
    },

    // ---------- конструкторы объектов эффектов ----------
    build(kind, src) {
        const G = this.G, B = Models3D, g = new THREE.Group();
        const c = col3(src.color || src.glow);
        switch (kind) {
            case 'arrow': {
                g.add(new THREE.Mesh(G.arrow, G3.mat(0x8a6a3a))); g.add(new THREE.Mesh(G.arrowHead, G3.mat(0xd8dde8)));
                const gl = B.glow(c || 0xfde68a, 0.35); g.add(gl); break;
            }
            case 'ubw_blade': { const s = B.sword(0xffd0d0, 0x8a1a1a, 0.5, { emissive: 0xff6060, emissiveIntensity: 0.6 }); s.rotation.set(0, 0, 0); s.position.set(0, 0, 0); g.add(s); g.add(B.glow(0xff8080, 0.6)); break; }
            case 'saber_wave': { const m = new THREE.Mesh(G.crescent, this.basic(c)); m.scale.set(1.4, 1, 1.4); g.add(m); g.add(B.glow(c, 1.4)); break; }
            case 'orb': default: {
                const m = new THREE.Mesh(G.orb, new THREE.MeshBasicMaterial({ color: c })); m.scale.setScalar(0.12); g.add(m);
                const gl = B.glow(c, 0.9); g.add(gl); g.userData.core = m; break;
            }
            case 'ring': { const m = new THREE.Mesh(G.ring, this.basic(c, { opacity: 0.8 })); const d = new THREE.Mesh(G.disc, this.basic(c, { opacity: 0.15 })); g.add(m); g.add(d); g.userData = { m, d }; break; }
            case 'hazard': {
                const m = new THREE.Mesh(G.ring, this.basic(c, { opacity: 0.7, blending: THREE.NormalBlending }));
                const d = new THREE.Mesh(G.disc, this.basic(c, { opacity: 0.1, blending: THREE.NormalBlending }));
                const f = new THREE.Mesh(G.disc, this.basic(c, { opacity: 0.22, blending: THREE.NormalBlending }));
                g.add(m); g.add(d); g.add(f); g.userData = { m, d, f }; break;
            }
            case 'beam': { const m = new THREE.Mesh(G.beam, this.basic(c, { opacity: 0.55 })); m.position.y = 0.5; g.add(m); g.userData.m = m; break; }
            case 'tornado': { for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(G.cone, this.basic(0xbfe8ff, { opacity: 0.25 - i * 0.05 })); m.rotation.x = Math.PI; m.scale.set(0.6 + i * 0.25, 2.2, 0.6 + i * 0.25); m.position.y = 1.1; g.add(m); } break; }
            case 'meteor': { const r = new THREE.Mesh(G.orb, G3.mat(0x3a1a0a, { emissive: 0xff4a10, emissiveIntensity: 1.2, flatShading: true })); r.scale.setScalar(0.6); g.add(r); g.add(B.glow(0xff7a20, 2.6)); g.userData.r = r; break; }
            case 'icewall': { const n = 9; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.crystal, G3.mat(0xbfe8ff, { transparent: true, opacity: 0.8, emissive: 0x3a8ac8, emissiveIntensity: 0.6 })); m.scale.set(0.3, 0.8 + (i % 3) * 0.3, 0.3); m.userData.k = (i / (n - 1)) * 2 - 1; g.add(m); } break; }
            case 'sword': { const s = B.sword(0xe8e8f0, 0x8a1a1a, 0.7); s.rotation.set(Math.PI, 0, 0); s.position.set(0, 0, 0); g.add(s); break; }
            case 'shard': { const m = new THREE.Mesh(G.crystal, G3.mat(0xfff4a0, { emissive: 0xffd040, emissiveIntensity: 1.4 })); m.scale.set(0.16, 0.5, 0.16); g.add(m); g.add(B.glow(0xfde047, 1.0)); g.userData.m = m; break; }
            case 'rune': case 'runeRect': { const r = AnimFX.rune(c, { rect: kind === 'runeRect', crack: src.crack || 0, spin: src.spin }); g.add(r); g.userData.u = r.userData.rune; break; }
            case 'xbeam': {
                const cg = this.G.xcyl || (this.G.xcyl = (() => { const q = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true); q.rotateX(Math.PI / 2); return q; })());
                const m = new THREE.Mesh(cg, this.basic(c, { opacity: 0.55 })); const core = new THREE.Mesh(cg, this.basic(0xffffff, { opacity: 0.95 })); const halo = new THREE.Mesh(cg, this.basic(c, { opacity: 0.18 }));
                g.add(halo); g.add(m); g.add(core); g.userData = { m, core, halo }; break;
            }
            case 'rift': { g.userData.lines = true; break; }
            case 'spirit': { const m = new THREE.Mesh(G.orb, G3.mat(0xff7a20, { emissive: 0xff5a10, emissiveIntensity: 1.3, flatShading: true })); m.scale.set(0.25, 0.4, 0.25); m.position.y = 0.8; g.add(m); const gl = B.glow(0xff8a30, 1.6); gl.position.y = 0.8; g.add(gl); g.userData.m = m; break; }
            case 'decal': { const m = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, depthWrite: false })); m.position.y = 0.03; g.add(m); g.userData.m = m; break; }
            case 'chest': {
                const T = (typeof CAMP_TIERS !== 'undefined' && CAMP_TIERS[src.tier]) || { color: '#e2e8f0', glow: '226,232,240' };
                const wood = src.tier === 'precious' ? 0x4a2a6a : (src.tier === 'rich' ? 0x6a3a14 : 0x5a3a22), trim = col3(T.color);
                const body = new THREE.Mesh(G.box, G3.mat(wood)); body.scale.set(0.7, 0.4, 0.46); body.position.y = 0.2; body.castShadow = true; g.add(body);
                [-0.25, 0.25].forEach(x => { const b = new THREE.Mesh(G.box, G3.mat(trim, { emissive: trim, emissiveIntensity: 0.2 })); b.scale.set(0.06, 0.42, 0.48); b.position.set(x, 0.2, 0); g.add(b); });
                const lid = new THREE.Group(); lid.position.set(0, 0.4, -0.23); g.add(lid);
                const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.7, 8, 1, false, 0, Math.PI), G3.mat(wood)); lm.rotation.z = Math.PI / 2; lm.position.z = 0.23; lm.castShadow = true; lid.add(lm);
                const lock = new THREE.Mesh(G.box, G3.mat(trim, { emissive: trim, emissiveIntensity: 0.5 })); lock.scale.set(0.1, 0.12, 0.04); lock.position.set(0, 0.32, 0.24); g.add(lock);
                const gl = B.glow(col3(T.glow), 1.6); gl.position.y = 0.4; g.add(gl);
                g.userData = { lid, gl, seal: null };
                if (src.sealed) { const s = new THREE.Mesh(G.ring, this.basic(0x9a6aff, { opacity: 0.7 })); s.scale.setScalar(0.7); s.position.y = 0.05; g.add(s); g.userData.seal = s; }
                break;
            }
            case 'item': {
                const it = (typeof ITEMS_DB !== 'undefined' && ITEMS_DB[src.itemId]) || {};
                const rc = { common: 0xd6d3d1, rare: 0x38bdf8, epic: 0xc084fc, legendary: 0xfbbf24 }[it.rarity] || 0xd6d3d1;
                const m = new THREE.Mesh(G.crystal, G3.mat(rc, { emissive: rc, emissiveIntensity: 0.5 })); m.scale.set(0.12, 0.18, 0.12); m.position.y = 0.3; g.add(m);
                const beam = new THREE.Mesh(G.beam, this.basic(rc, { opacity: it.rarity === 'legendary' || it.rarity === 'epic' ? 0.35 : 0.15 })); beam.scale.set(0.05, 1.6, 0.05); beam.position.y = 0.8; g.add(beam);
                g.add(B.glow(rc, 0.6)); g.userData.m = m; break;
            }
            case 'herb': { for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(G.crystal, G3.mat(0x3a8a3a)); l.scale.set(0.05, 0.16, 0.12); l.position.set(Math.cos(i * 1.6) * 0.1, 0.12, Math.sin(i * 1.6) * 0.1); l.rotation.y = i * 1.6; g.add(l); } const f = new THREE.Mesh(G.orb, G3.mat(0xf0a0ff, { emissive: 0xc060ff, emissiveIntensity: 0.8 })); f.scale.setScalar(0.07); f.position.y = 0.3; g.add(f); g.add(B.glow(0xd080ff, 0.6)); break; }
            case 'waystatue': {
                const ped = new THREE.Mesh(G.box, G3.mat(0x6a6a74)); ped.scale.set(0.9, 0.3, 0.9); ped.position.y = 0.15; g.add(ped);
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), G3.mat(0x8a8a94, { flatShading: true })); col.position.y = 1.1; g.add(col);
                const gem = new THREE.Mesh(G.crystal, G3.mat(0x60d0ff, { emissive: 0x30a0ff, emissiveIntensity: 1.2 })); gem.scale.set(0.16, 0.26, 0.16); gem.position.y = 2.15; g.add(gem);
                const gl = B.glow(0x60d0ff, 1.4); gl.position.y = 2.15; g.add(gl); g.userData.m = gem;
                g.traverse(o => { if (o.isMesh) o.castShadow = true; });
                break;
            }
            case 'shrine': {
                for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(G.box, G3.mat(0x9a9284)); p.scale.set(0.14, 1.1, 0.14); p.position.set((i % 2 - 0.5) * 0.9, 0.55, (Math.floor(i / 2) - 0.5) * 0.9); p.castShadow = true; g.add(p); }
                const top = new THREE.Mesh(G.box, G3.mat(0x8a8274)); top.scale.set(1.2, 0.12, 1.2); top.position.y = 1.15; top.castShadow = true; g.add(top);
                const gem = new THREE.Mesh(G.orb, G3.mat(0xffd070, { emissive: 0xffa020, emissiveIntensity: 1 })); gem.scale.setScalar(0.14); gem.position.y = 0.6; g.add(gem);
                const gl = B.glow(0xffc040, 1.4); gl.position.y = 0.6; g.add(gl); g.userData.m = gem; break;
            }
            case 'obelisk': case 'tablet': {
                const m = new THREE.Mesh(kind === 'tablet' ? G.box : new THREE.CylinderGeometry(0.12, 0.26, 1.7, 4), G3.mat(0x3a3a48, { flatShading: true }));
                if (kind === 'tablet') { m.scale.set(1.2, 0.9, 0.25); m.position.y = 0.45; } else m.position.y = 0.85;
                m.castShadow = true; g.add(m);
                const rune = B.glow(0x8ab0ff, kind === 'tablet' ? 1.2 : 0.8); rune.position.y = kind === 'tablet' ? 0.6 : 1.2; g.add(rune); g.userData.gl = rune; break;
            }
            case 'cache': { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), G3.mat(0x6a6058, { flatShading: true })); m.position.y = 0.2; m.scale.set(1.2, 0.6, 1); m.castShadow = true; g.add(m); break; }
            case 'portal': {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 32), G3.mat(0x2a2030, { emissive: c, emissiveIntensity: 0.6 })); ring.position.y = 1.2; g.add(ring);
                const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.92, 32), this.basic(c, { opacity: 0.55 })); swirl.position.y = 1.2; g.add(swirl);
                const gl = B.glow(c, 3.2); gl.position.y = 1.2; g.add(gl);
                g.userData = { ring, swirl, gl }; break;
            }
        }
        this.scene.add(g);
        return g;
    },
    // Объект эффекта, привязанный к игровому объекту
    get(src, kind) {
        let o = this.live.get(src);
        if (!o || o.userData.kind !== kind) { if (o) this.kill(src, o); o = this.build(kind, src); o.userData.kind = kind; this.live.set(src, o); }
        this.seen.add(src);
        return o;
    },
    sub(src, tag, extra) { let m = this.subs.get(src); if (!m) { m = {}; this.subs.set(src, m); } return m[tag] || (m[tag] = Object.assign({}, extra)); },
    // Рунная проекция зоны поражения: круг радиуса r (или полоса w×len), прогресс до удара 0..1
    runeAt(src, color, x, z, r, prog, opts = {}) {
        const key = this.sub(src, opts.tag || 'rune', { color, crack: opts.crack, spin: opts.spin });
        const o = this.get(key, opts.rect ? 'runeRect' : 'rune'), u = o.userData.u;
        o.position.set(x, 0.05, z);
        if (opts.rect) { o.rotation.set(0, opts.ang, 0); o.scale.set(opts.w, 1, opts.len); u.uLen.value = opts.len; } else o.scale.setScalar(r);
        u.uProg.value = Math.max(0, Math.min(1, prog)); u.uTime.value = Engine3D.t; u.uOp.value = opts.op === undefined ? 1 : opts.op;
        return o;
    },
    kill(src, o) {
        const d = o.userData.onDie;
        if (d) { AnimFX.impact(o.position.x, o.position.z, d.color, d.size, d); if (d.sfx) Sfx3D.play(d.sfx, d.vol || 1); if (d.kick) AnimFX.kick(d.kick); }
        this.scene.remove(o);
        const shared = new Set(Object.values(this.G));
        o.traverse(m => {
            if (m.material && !m.material.userData.cached) m.material.dispose();
            if (m.geometry && !shared.has(m.geometry) && !m.isSprite && !m.geometry.userData.cached) m.geometry.dispose();
        });
        this.live.delete(src);
    },

    update(dt) {
        const T = G3.tile, t = Engine3D.t, px = player.x / T, pz = player.y / T;
        const near = (x, y, r = 30) => Math.abs(x / T - px) < r && Math.abs(y / T - pz) < r;
        this.seen = new Set();
        this.lights = [];
        this.nearLoot = this.nearLoot || new Set(); this.prevLoot = this.prevLoot || new Set();
        // Экскалибур: пока идёт сбор энергии — полоса-руна на земле, столб света и стягивание энергии к мечу
        const uc = player.ultCast;
        if (uc && !uc.swing) {
            const col = player.saberAlter ? 0xff2a30 : 0xffe060, L = SABER_ULT.length / T, W = SABER_ULT.width / T, k = uc.t / uc.dur;
            const a = Math.atan2(Math.cos(uc.ang), Math.sin(uc.ang)), hp = AnimFX.heroPos();
            this.runeAt(uc, col, px, pz, 0, k, { rect: true, ang: a, w: W, len: L, crack: 0.7 });
            this.runeAt(uc, col, px, pz, 1.8, k, { tag: 'circle', spin: 3 });
            const tip = { x: hp.x, y: hp.y + 2.4, z: hp.z };
            for (let q = 0; q < 3; q++) { const aa = Math.random() * 6.28, rr = 2 + Math.random() * 2.5; AnimFX.emit({ x: hp.x + Math.cos(aa) * rr, y: hp.y + 0.2 + Math.random() * 2, z: hp.z + Math.sin(aa) * rr, n: 1, color: [col, 0xffffff], speed: 0.2, life: 0.7, size: 0.1, grav: 0, drag: 1, pull: { ...tip, k: 9 } }); }
            this.lights.push({ x: hp.x, z: hp.z, h: 2.6, c: col });
        }

        // ---------- снаряды ----------
        for (const p of projectiles) {
            if (!near(p.x, p.y)) continue;
            const kind = p.kind === 'arrow' ? 'arrow' : (p.kind === 'ubw_blade' ? 'ubw_blade' : (p.kind === 'saber_wave' ? 'saber_wave' : 'orb'));
            const o = this.get(p, kind);
            const ang = Math.atan2(p.vx, p.vy);
            const h = kind === 'arrow' ? 0.7 + (p.z || 0) / T * 1.2 : (kind === 'saber_wave' ? 0.4 : 0.8);
            o.position.set(p.x / T, h, p.y / T);
            if (kind === 'arrow') { o.rotation.set(0, ang, 0); const vz = (p.vz !== undefined ? -p.vz : 0); o.rotation.x = vz / 800; }
            else if (kind === 'ubw_blade') { o.rotation.set(t * 18, ang, 0); }
            else if (kind === 'saber_wave') { o.rotation.set(0, ang + Math.PI / 2, 0); }
            else { const s = 0.9 + Math.sin(t * 20 + (p.x % 7)) * 0.1; o.scale.setScalar(Math.max(0.6, (p.radius || 7) / 9) * s); if (!p.fromPlayer || p.element === 'e') this.lights.push({ x: p.x / T, z: p.y / T, h: 0.9, c: col3(p.color) }); }
            // Шлейф за снарядом и искры при попадании
            const dir = new THREE.Vector3(p.vx, 0, p.vy).normalize(), pc = col3(p.color);
            const tc = kind === 'arrow' ? 0xffe8a0 : (kind === 'ubw_blade' ? 0xff3040 : pc);
            const head = o.position.clone(), tail = head.clone().addScaledVector(dir, -0.25);
            AnimFX.trail(p, tail.clone().add(new THREE.Vector3(0, -0.035, 0)), head.clone().add(new THREE.Vector3(0, 0.035, 0)), tc, { always: true, life: kind === 'orb' ? 0.22 : 0.14, len: 16, core: 0.4 });
            if (kind === 'orb' && Math.random() < 0.5) AnimFX.emit({ x: head.x, y: head.y, z: head.z, n: 1, color: [pc, 0xffffff], speed: 0.3, life: 0.35, size: 0.08, grav: 0, drag: 2 });
            o.userData.onDie = { color: tc, size: kind === 'orb' ? 0.7 : 0.35, dust: 0x4a4038 };
        }

        // ---------- зоны заклинаний ----------
        for (const z of activeZones) {
            if (!near(z.x, z.y)) continue;
            const x = z.x / T, y = z.y / T, r = (z.radius || 40) / T, lifeK = z.maxLife ? z.life / z.maxLife : 1;
            if (z.type === 'tornado') { const o = this.get(z, 'tornado'); o.position.set(x, 0, y); o.rotation.y = t * 9; o.children.forEach((m, i) => m.rotation.y = t * (6 + i * 3)); }
            else if (z.type === 'meteor') {
                const o = this.get(z, 'meteor');
                if (z.delay > 0) {
                    const k = 1 - z.delay / z.maxDelay; o.position.set((z.startX + (z.x - z.startX) * k) / T, 7 * (1 - k) + 0.5, (z.startY + 310 + (z.y - z.startY - 310) * k) / T);
                    this.runeAt(z, 0xff6a1a, x, y, 1.6, k, { crack: 1 });
                } else o.position.set(x + (z.vx || 0) / T * (-(z.delay || 0)), 0.55, y + (z.vy || 0) / T * (-(z.delay || 0)));
                if (z.delay <= 0 && !z.__landed) { z.__landed = true; AnimFX.impact(x, y, 0xff6a1a, 2.6); AnimFX.kick(0.9); Sfx3D.play('heavy'); }
                // Огненный хвост и дым
                AnimFX.emit({ x: o.position.x, y: o.position.y, z: o.position.z, n: 4, color: [0xff7a1a, 0xffd040, 0xff3a00], speed: 0.6, life: 0.5, size: 0.35, sizeEnd: 0.05, grav: -1, drag: 2, r: 0.2 });
                AnimFX.emit({ x: o.position.x, y: o.position.y, z: o.position.z, n: 1, color: 0x2a2220, speed: 0.3, life: 1.2, size: 0.4, sizeEnd: 0.8, grav: -0.6, drag: 1 });
                o.userData.r.rotation.x += dt * 6; this.lights.push({ x: o.position.x, z: o.position.z, h: 1.5, c: 0xff6a1a });
            }
            else if (z.type === 'sun_strike') {
                const o = this.get(z, 'beam'); o.position.set(x, 0, y);
                if (z.delay > 0) { o.scale.set(r * 0.12, 14, r * 0.12); o.userData.m.material.opacity = 0.25; this.runeAt(z, 0xffb040, x, y, r, 1 - z.delay / z.maxDelay, { crack: 0.6 }); }
                else { o.scale.set(r * 0.9, 14, r * 0.9); o.userData.m.material.opacity = 0.7; this.lights.push({ x, z: y, h: 2, c: 0xffa040 }); }
                o.userData.m.material.color.setHex(0xffb040);
                // Если игра уберёт зону в тот же кадр, когда она сработала, удар всё равно проиграется при исчезновении
                o.userData.onDie = z.__hit ? null : { color: 0xffb040, size: 1.8, sfx: 'impact', vol: 1.2, kick: 0.4 };
                if (z.delay <= 0 && !z.__hit) { z.__hit = true; AnimFX.impact(x, y, 0xffb040, 1.8); AnimFX.emit({ x, y: 0.2, z: y, n: 60, color: [0xffd070, 0xffffff], speed: 0.5, up: 8, life: 0.7, size: 0.12, grav: -2, r: r * 0.5 }); Sfx3D.play('impact', 1.2); AnimFX.kick(0.4); }
            }
            else if (z.type === 'emp') {
                const o = this.get(Object.assign(z, { color: z.color || '#e879f9' }), 'ring'); o.position.set(x, 0.05, y); const k = z.delay > 0 ? 1 - z.delay / z.maxDelay : 1; o.scale.setScalar(r * (0.3 + 0.7 * k)); o.rotation.y = t * 3;
                o.userData.onDie = z.__hit ? null : { color: 0xe879f9, size: 2.2, sfx: 'impact', kick: 0.5 };
                if (z.delay > 0) { this.runeAt(z, 0xe879f9, x, y, r, k, { spin: -2 }); if (Math.random() < 0.6) { const a = Math.random() * 6.28; AnimFX.emit({ x: x + Math.cos(a) * r, y: 0.4, z: y + Math.sin(a) * r, n: 2, color: [0xe879f9, 0xffffff], speed: 0.1, life: 0.5, size: 0.08, grav: 0, drag: 0, pull: { x, y: 0.5, z: y, k: 10 } }); } }
                else if (!z.__hit) { z.__hit = true; AnimFX.impact(x, y, 0xe879f9, 2.2); AnimFX.shock(x, 0.6, y, 0xffffff, r, 0.1, 0.4); Sfx3D.play('impact', 1); AnimFX.kick(0.5); }
            }
            else if (z.type === 'ice_wall') {
                const o = this.get(z, 'icewall'); const ang = Math.atan2(z.perpX || 0, z.perpY || 1), L = (z.halfLen || 140) / T;
                o.position.set(x, 0, y);
                o.children.forEach(m => { m.position.set(Math.sin(ang) * m.userData.k * L, m.scale.y * 0.6 * Math.min(1, lifeK * 4), Math.cos(ang) * m.userData.k * L); });
            }
            else if (z.type === 'saber_slash_fx') {
                const o = this.get(z, 'saber_wave'); o.position.set(x, 0.75, y); o.rotation.set(0, Math.atan2(Math.cos(z.ang), Math.sin(z.ang)) + Math.PI / 2, 0);
                o.scale.setScalar(r * 1.1); o.children[0].material.opacity = lifeK;
            }
            else { // afterglow, blast, прочие — светящееся кольцо
                const o = this.get(z, 'ring'); o.position.set(x, 0.05, y);
                const grow = z.type === 'afterglow' ? (1.2 - lifeK * 0.5) : 1;
                o.scale.setScalar(r * grow); o.userData.m.material.opacity = 0.8 * lifeK; o.userData.d.material.opacity = 0.18 * lifeK;
            }
        }
        // ---------- опасные зоны врагов (телеграф) ----------
        for (const h of enemyHazards) {
            if (!near(h.x, h.y)) continue;
            const r = h.radius / T, k = h.maxDelay ? 1 - h.delay / h.maxDelay : 1, c = col3(h.color || '#dc2626');
            const o = this.runeAt(h, c, h.x / T, h.y / T, r, k, { crack: 1, spin: 0.6, op: 0.8 + k * 0.4 });
            const near2 = Math.hypot(h.x / T - px, h.y / T - pz) < 6;
            o.userData.onDie = { color: c, size: Math.min(2.5, r * 0.9), sfx: near2 ? 'impact' : null, kick: near2 && r > 1.5 ? 0.35 : 0, dust: 0x3a2a24 };
        }

        // ---------- эффекты героя ----------
        for (const f of playerFx) {
            if (f.x !== undefined && !near(f.x, f.y)) continue;
            const lifeK = f.maxLife ? Math.max(0, f.life / f.maxLife) : 1;
            switch (f.type) {
                case 'volley_zone': case 'ubw_circle': {
                    const ubw = f.type === 'ubw_circle', c = ubw ? 0xef4444 : 0xfde68a;
                    this.runeAt(f, c, f.x / T, f.y / T, f.radius / T, 1 - lifeK, { spin: ubw ? 0.4 : 1.2, op: Math.min(1, lifeK * 3), crack: ubw ? 0.8 : 0 });
                    if (ubw && Math.random() < 0.7) { const a = Math.random() * 6.28, rr = Math.random() * f.radius / T; AnimFX.emit({ x: f.x / T + Math.cos(a) * rr, y: 0.1, z: f.y / T + Math.sin(a) * rr, n: 1, color: [0xff5030, 0xffb070], speed: 0.2, up: 1.5, life: 1.2, size: 0.07, grav: -0.5 }); }
                    break;
                }
                case 'volley_arrow': {
                    if (f.delay > 0.5) break; const o = this.get(f, 'arrow'); o.position.set(f.x / T, 0.1 + f.delay * 14, f.y / T); o.rotation.set(Math.PI / 2, 0, 0);
                    AnimFX.trail(f, o.position.clone().add(new THREE.Vector3(0.02, 0.4, 0)), o.position.clone().add(new THREE.Vector3(-0.02, 0, 0)), 0xffe8a0, { always: true, life: 0.12, len: 10, core: 0.3 });
                    o.userData.onDie = { color: 0xfde68a, size: 0.35 }; break;
                }
                case 'stuck_arrow': { const o = this.get(f, 'arrow'); o.position.set(f.x / T, 0.2, f.y / T); o.rotation.set(0.7, Math.atan2(Math.cos(f.ang), Math.sin(f.ang)), 0); break; }
                case 'ubw_fall': {
                    const o = this.get(f, 'sword'); o.position.set(f.x / T, 0.3 + Math.max(0, f.delay) * 16, f.y / T); o.rotation.set(f.tilt || 0, (f.seed || 0) * 0.1, 0);
                    if (f.delay < 0.6) AnimFX.trail(f, o.position.clone().add(new THREE.Vector3(0.05, 0.9, 0)), o.position.clone().add(new THREE.Vector3(-0.05, 0.1, 0)), 0xff3040, { always: true, life: 0.12, len: 10, core: 0.5 });
                    o.userData.onDie = { color: 0xff4050, size: 0.6, sfx: Math.random() < 0.3 ? 'impact' : null, vol: 0.6 }; break;
                }
                case 'ubw_sword': { const o = this.get(f, 'sword'); o.position.set(f.x / T, 0.25 - (1 - lifeK) * 0.2, f.y / T); o.rotation.set(f.tilt || 0, (f.seed || 0) * 0.1, 0); break; }
                case 'light_shard': { const o = this.get(f, 'shard'); o.position.set(f.x / T, 0.4 + Math.sin(t * 3 + f.x) * 0.08, f.y / T); o.userData.m.rotation.y = t * 2; o.scale.setScalar(Math.min(1, lifeK * 4)); this.lights.push({ x: f.x / T, z: f.y / T, h: 0.8, c: 0xfde047 }); break; }
                case 'excalibur_beam': {
                    const col = f.alter ? 0xff2a30 : 0xffe060;
                    const o = this.get(Object.assign(f, { color: f.alter ? '#ef4444' : '#fde047' }), 'xbeam'), L = f.len / T, W = f.width / T;
                    const a = Math.atan2(Math.cos(f.ang), Math.sin(f.ang)), cx = Math.cos(f.ang), cz = Math.sin(f.ang);
                    o.position.set(f.x / T + cx * L / 2, 0.9, f.y / T + cz * L / 2); o.rotation.set(0, a, 0);
                    // Вспышка выстрела: волны, свет вдоль луча, удар камеры, звук
                    if (!f.__fired) {
                        f.__fired = true; Sfx3D.play('ult'); AnimFX.kick(2);
                        const ox = f.x / T, oz = f.y / T;
                        AnimFX.shock(ox, 0.1, oz, col, 0.5, 5, 0.8); AnimFX.shock(ox, 0.1, oz, 0xffffff, 0.3, 3, 0.5);
                        for (let k = 0; k < 6; k++) AnimFX.flash(ox + cx * L * k / 5, oz + cz * L * k / 5, col, 6, 1.0, 1.5);
                    }
                    const pulse = Math.sin(Math.min(1, (1 - lifeK) * 6) * Math.PI / 2) * Math.min(1, lifeK * 2.5), wob = 1 + Math.sin(t * 40) * 0.06;
                    o.userData.halo.scale.set(W * 2.6 * pulse * wob, W * 2.0 * pulse, L); o.userData.m.scale.set(W * 1.3 * pulse * wob, W * 1.1 * pulse, L); o.userData.core.scale.set(W * 0.45 * pulse, W * 0.45 * pulse, L);
                    // Энергия срывается с луча, земля под ним горит
                    for (let k = 0; k < 6; k++) { const q = Math.random() * L, side = (Math.random() - 0.5) * W; AnimFX.emit({ x: f.x / T + cx * q - cz * side, y: 0.9 + (Math.random() - 0.5) * W, z: f.y / T + cz * q + cx * side, n: 1, color: [col, 0xffffff], speed: 1.5, up: 1, life: 0.6, size: 0.14, grav: -1, drag: 2 }); }
                    this.runeAt(f, col, f.x / T, f.y / T, 0, 1, { rect: true, ang: a, w: W * 1.3, len: L, crack: 1, op: lifeK, tag: 'scar' });
                    this.lights.push({ x: o.position.x, z: o.position.z, h: 2, c: col });
                    break;
                }
                case 'chest_pillar': { const o = this.get(f, 'beam'); o.position.set(f.x / T, 0, f.y / T); const k = Math.sin(lifeK * Math.PI); o.scale.set((f.big ? 0.8 : 0.5) * (0.4 + k), 12 * k + 0.1, (f.big ? 0.8 : 0.5) * (0.4 + k)); o.userData.m.material.color.setHex(col3(f.color)); o.userData.m.material.opacity = 0.6 * k; this.lights.push({ x: f.x / T, z: f.y / T, h: 1.5, c: col3(f.color) }); break; }
                case 'ground_rift': {
                    const o = this.get(f, 'rift');
                    if (!o.userData.lineObj && f.pts && f.pts.length > 1) {
                        const arr = []; f.pts.forEach(p => { const x = (p.x !== undefined ? p.x : p[0]) / T, y = (p.y !== undefined ? p.y : p[1]) / T; arr.push(x, 0.06, y); });
                        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
                        const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col3(f.glow), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
                        o.add(ln); o.userData.lineObj = ln;
                    }
                    if (o.userData.lineObj) o.userData.lineObj.material.opacity = lifeK;
                    break;
                }
            }
        }
        // ---------- огненные духи ----------
        for (const s of forgeSpirits) { const o = this.get(s, 'spirit'); o.position.set(s.x / T, Math.sin(t * 4 + s.x) * 0.1, s.y / T); o.userData.m.rotation.y = t * 3; this.lights.push({ x: s.x / T, z: s.y / T, h: 1, c: 0xff7a20 }); }
        // ---------- следы на земле ----------
        for (const d of groundDecals) {
            if (!near(d.x, d.y)) continue;
            const c = d.kind === 'ice' ? 0x9fe0ff : (d.kind === 'scorch' ? 0x0a0604 : (d.kind === 'blood' ? 0x5a0a0a : 0x1a1410));
            const o = this.get(Object.assign(d, { color: c }), 'decal'); o.position.set(d.x / T, 0, d.y / T); o.scale.setScalar(d.radius / T);
            o.userData.m.material.opacity = 0.55 * Math.min(1, d.life / d.maxLife * 2);
            if (d.kind === 'ice') o.userData.m.material.blending = THREE.AdditiveBlending;
        }
        // ---------- добыча и сундуки ----------
        for (const l of groundLoot) {
            if (!near(l.x, l.y, 24) || l.hidden) continue;
            if (l.kind === 'camp_chest') {
                const o = this.get(l, 'chest'); o.position.set(l.x / T, 0, l.y / T);
                const open = l.opened ? Math.min(1, l.openAnim || 1) : 0;
                o.userData.lid.rotation.x = -Actors3D.ease.back(open) * 1.75;
                const cx = l.x / T, cz = l.y / T, tc = col3((typeof CAMP_TIERS !== 'undefined' && CAMP_TIERS[l.tier] || {}).glow || '226,232,240');
                if (l.__sealed === undefined) { l.__sealed = !!l.sealed; l.__opened = !!l.opened; }
                if (l.__sealed && !l.sealed) { // печать сорвана
                    Sfx3D.play('seal'); AnimFX.shock(cx, 0.1, cz, 0x9a6aff, 0.3, 2.2, 0.6);
                    AnimFX.emit({ x: cx, y: 0.3, z: cz, n: 50, color: [0x9a6aff, 0xd8c8ff, 0xffffff], speed: 3.5, up: 2, life: 0.8, size: 0.08, grav: 6 });
                }
                if (!l.__opened && l.opened) { // крышка распахивается, сокровища вспыхивают
                    Sfx3D.play('chest'); AnimFX.kick(0.3); AnimFX.flash(cx, cz, tc, 5, 1.2, 1);
                    AnimFX.emit({ x: cx, y: 0.45, z: cz, n: 70, color: [tc, 0xffffff, 0xfde68a], speed: 1.2, up: 4.5, life: 1.3, size: 0.09, grav: 3, drag: 1, r: 0.15 });
                    AnimFX.emit({ x: cx, y: 0.45, z: cz, n: 30, color: [0xffd040, 0xffe880], speed: 2, up: 3.5, life: 1.2, size: 0.07, grav: 9, drag: 0.5 });
                    AnimFX.shock(cx, 0.1, cz, tc, 0.3, 2.5, 0.7);
                }
                l.__sealed = !!l.sealed; l.__opened = !!l.opened;
                if (l.opened && open < 1 && Math.random() < 0.6) AnimFX.emit({ x: cx, y: 0.5, z: cz, n: 2, color: [tc, 0xffffff], speed: 0.4, up: 2, life: 0.8, size: 0.06, grav: -0.5, r: 0.2 });
                o.userData.gl.material.opacity = l.opened ? 0.2 : 0.55 + Math.sin(t * 3) * 0.25;
                if (o.userData.seal) { o.userData.seal.visible = !!l.sealed; o.userData.seal.rotation.y = t; }
            } else if (l.kind === 'herb_node') { if (l.respawnTimer > 0) continue; const o = this.get(l, 'herb'); o.position.set(l.x / T, 0, l.y / T); }
            else {
                const o = this.get(l, 'item'); o.position.set(l.x / T, 0, l.y / T); o.userData.m.rotation.y = t * 2; o.userData.m.position.y = 0.3 + Math.sin(t * 3 + l.x) * 0.06;
                // Новый предмет на земле «выпрыгивает» из точки появления
                l.__age = (l.__age || 0) + dt; if (l.__age < 0.5) { const k = l.__age / 0.5; o.userData.m.position.y += Math.sin(k * Math.PI) * 0.8; o.scale.setScalar(Actors3D.ease.back(k)); } else o.scale.setScalar(1);
                if (l.kind === 'item' && Math.hypot(l.x / T - px, l.y / T - pz) < 2.5) this.nearLoot.add(l);
            }
        }
        // Подобранные предметы: искры втягиваются в героя
        for (const l of this.prevLoot) if (!groundLoot.includes(l)) {
            const it = (typeof ITEMS_DB !== 'undefined' && ITEMS_DB[l.itemId]) || {}, rc = { common: 0xd6d3d1, rare: 0x38bdf8, epic: 0xc084fc, legendary: 0xfbbf24 }[it.rarity] || 0xd6d3d1;
            const hp = AnimFX.heroPos();
            AnimFX.emit({ x: l.x / T, y: 0.35, z: l.y / T, n: 24, color: [rc, 0xffffff], speed: 1.2, up: 2, life: 0.55, size: 0.08, grav: 0, drag: 2, pull: { x: hp.x, y: hp.y + 0.8, z: hp.z, k: 14 } });
            AnimFX.shock(hp.x, hp.y + 0.05, hp.z, rc, 0.1, 0.8, 0.35); Sfx3D.play('pickup');
        }
        this.prevLoot = this.nearLoot; this.nearLoot = new Set();
        // ---------- точки интереса и порталы ----------
        if (typeof pois !== 'undefined') for (const p of pois) {
            const wx = p.wx !== undefined ? p.wx : p.x * T, wy = p.wy !== undefined ? p.wy : p.y * T;
            if (!near(wx, wy, 30)) continue;
            const o = this.get(p, p.kind === 'waystatue' || p.kind === 'shrine' || p.kind === 'obelisk' || p.kind === 'tablet' || p.kind === 'cache' ? p.kind : 'cache');
            o.position.set(wx / T, 0, wy / T);
            if (o.userData.m) o.userData.m.rotation.y = t * 1.5;
            if (p.kind === 'waystatue') this.lights.push({ x: wx / T, z: wy / T, h: 2.2, c: 0x60d0ff });
        }
        if (typeof worldPortals !== 'undefined') for (const pt of worldPortals) {
            if (!near(pt.x, pt.y, 30)) continue;
            const o = this.get(pt, 'portal'), open = pt.isOpen();
            o.position.set(pt.x / T, 0, pt.y / T);
            o.userData.swirl.rotation.z = t * 2; o.userData.swirl.visible = open; o.userData.gl.visible = open;
            if (open) this.lights.push({ x: pt.x / T, z: pt.y / T, h: 1.4, c: col3(pt.color) });
        }
        for (const [src, o] of this.live) {
            if (!this.seen.has(src)) { this.kill(src, o); continue; }
            if (o.userData.kind !== 'rift') o.position.y += World3D.hAt(o.position.x, o.position.z);  // эффекты следуют рельефу
        }

        // ---------- частицы ----------
        let n = 0;
        for (let i = 0; i < particles.length && n < this.MAXP; i++) {
            const p = particles[i];
            if (Math.abs(p.x / T - px) > 26 || Math.abs(p.y / T - pz) > 22) continue;
            const k = p.maxLife ? p.life / p.maxLife : 1;
            const o = n * 3;
            this.pPos[o] = p.x / T; this.pPos[o + 1] = 0.25 + (1 - k) * 0.9 + (p.z || 0) / T; this.pPos[o + 2] = p.y / T;
            this.tmpC.setHex(col3(p.color));
            const a = Math.max(0, Math.min(1, k * 1.3));
            this.pCol[o] = this.tmpC.r * a; this.pCol[o + 1] = this.tmpC.g * a; this.pCol[o + 2] = this.tmpC.b * a;
            n++;
        }
        this.points.geometry.setDrawRange(0, n);
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
    },
    extraLights(all) { if (this.lights) for (const l of this.lights) all.push(l); }
};

// ---------- Подписи поверх 3D: урон, имена, полоски здоровья, баннеры, экранные эффекты ----------
const Labels3D = {
    draw() {
        const lc = document.getElementById('labelCanvas');
        if (!lc) return;
        const W = canvas.width, H = canvas.height;
        if (lc.width !== W || lc.height !== H) { lc.width = W; lc.height = H; }
        const c = lc.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
        const kx = W / window.innerWidth, ky = H / window.innerHeight;
        const P = (x, y, h) => { const p = Engine3D.project(x, y, h); return [p[0] * kx, p[1] * ky, p[2]]; };
        const T = G3.tile, px = player.x, py = player.y;
        c.textAlign = 'center';
        // Полоски здоровья и имена врагов
        for (const en of enemies) {
            if (en.deadTimer > 0 || en.hidden) continue;
            if (Math.abs(en.x - px) > 20 * T || Math.abs(en.y - py) > 16 * T) continue;
            const special = en.isBoss || en.elite || en.rare || (en.tpl && en.tpl.miniBoss);
            if (en.hp >= en.maxHp && !special) continue;
            const sc = Math.max(0.7, Math.min(2.2, (en.radius || 16) / 16));
            const [sx, sy, sz] = P(en.x, en.y, 1.55 * sc * (en.type === 'bat' ? 1.3 : 1));
            if (sz > 1 || sx < -50 || sx > W + 50 || sy < -30 || sy > H + 30) continue;
            const bw = en.isBoss ? 90 : 48, f = Math.max(0, en.hp / en.maxHp);
            c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(sx - bw / 2 - 1, sy - 1, bw + 2, 6);
            c.fillStyle = en.isBoss ? '#dc2626' : (en.rare ? '#a855f7' : (en.elite ? '#f59e0b' : '#ef4444')); c.fillRect(sx - bw / 2, sy, bw * f, 4);
            if (special) {
                c.font = 'bold 11px Cinzel, Georgia, serif';
                c.fillStyle = '#000'; c.fillText(en.name || '', sx + 1, sy - 4);
                c.fillStyle = en.isBoss ? '#fca5a5' : (en.rare ? '#d8b4fe' : '#fde68a'); c.fillText(en.name || '', sx, sy - 5);
            }
        }
        // Имена NPC
        c.font = 'bold 11px Cinzel, Georgia, serif';
        for (const n of npcs) {
            if (Math.abs(n.x - px) > 14 * T || Math.abs(n.y - py) > 12 * T) continue;
            const [sx, sy] = P(n.x, n.y, 1.65);
            c.fillStyle = '#000'; c.fillText(n.name, sx + 1, sy + 1); c.fillStyle = '#7dd3fc'; c.fillText(n.name, sx, sy);
        }
        // Всплывающий урон и надписи
        c.font = 'bold 14px Cinzel, Inter, sans-serif';
        for (const ft of floatingTexts) {
            const [sx, sy, sz] = P(ft.x, ft.y, 1.3);
            if (sz > 1) continue;
            const a = Math.max(0, Math.min(1, ft.life * 2));
            c.globalAlpha = a;
            c.fillStyle = '#000'; c.fillText(ft.text, sx + 1, sy + 1);
            c.fillStyle = ft.color; c.fillText(ft.text, sx, sy);
        }
        c.globalAlpha = 1;
        // Тонировка зоны и молния
        const zone = playerZone();
        if (zone === 'hell') { c.fillStyle = 'rgba(150,30,0,0.08)'; c.fillRect(0, 0, W, H); }
        // Виньетка в духе тёмного фэнтези
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // Экранные эффекты игры (низкое здоровье, каст Экскалибура, баннеры зон)
        if (typeof drawScreenFX25 === 'function') { try { drawScreenFX25(c, performance.now(), 0, 0); } catch (e) { } }
    }
};
