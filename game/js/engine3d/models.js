// ============================================================================
// ДЕТАЛЬНЫЕ МОДЕЛИ (процедурные, high-poly): герои, монстры, боссы, NPC, оружие
// ============================================================================
// Плавная геометрия: скруглённые блоки, капсулы, тела вращения, выдавленные клинки, изогнутые рога.
// У каждой детали свой тип поверхности (металл, ткань, кожа, мех, кость…) → свой PBR-материал.
// Возвращает { root, rig }: rig — шарниры для анимации. Рост человека ≈ 1.15 тайла.
const Models3D = {
    gc: new Map(),
    geo(key, make) { let g = this.gc.get(key); if (!g) { g = make(); g.userData.cached = true; this.gc.set(key, g); } return g; },

    // ---------- плавные примитивы ----------
    // Скруглённый блок: вершины подразбитого куба «надуваются» к скруглённым рёбрам
    rboxGeo(w, h, d, r) {
        return this.geo(`rb${w}|${h}|${d}|${r}`, () => {
            r = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
            const g = new THREE.BoxGeometry(w, h, d, 8, 8, 8), p = g.attributes.position, n = g.attributes.normal;
            const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
                v.sub(c); const l = v.length() || 1; v.multiplyScalar(1 / l);
                n.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
            }
            return g;
        });
    },
    capsGeo(r, len) { return this.geo(`cp${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 8, 20)); },
    sphGeo(r, sx = 1, sy = 1, sz = 1, part) {
        return this.geo(`sp${r}|${sx}|${sy}|${sz}|${part || ''}`, () => {
            const g = part === 'top' ? new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 28, 20);
            g.scale(sx, sy, sz); return g;
        });
    },
    cylGeo(rt, rb, h, seg = 24, open = false) { return this.geo(`cy${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 2, open)); },
    coneGeo(r, h, seg = 20) { return this.geo(`co${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg, 4)); },
    latheGeo(key, pts, seg = 28, phiStart = 0, phiLen = Math.PI * 2) { return this.geo('la' + key, () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg, phiStart, phiLen)); },
    // Изогнутый конус (рог, коготь, хвост): тело вращения, согнутое назад
    hornGeo(r, h, bend) {
        return this.geo(`hn${r}|${h}|${bend}`, () => {
            const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (1 - t) * (1 - t * 0.15) + 0.002, t * h)); }
            const g = new THREE.LatheGeometry(pts, 16), p = g.attributes.position;
            for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / h; p.setZ(i, p.getZ(i) - bend * t * t * h); p.setY(i, y * (1 - bend * 0.25 * t)); }
            g.computeVertexNormals(); return g;
        });
    },

    // ---------- меш с материалом ----------
    m(geo, color, k, extra) { const mesh = new THREE.Mesh(geo, G3.mat(color, Object.assign({ k }, extra || {}))); mesh.castShadow = true; return mesh; },
    at(o, x, y, z, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; },
    glow(c, s) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: G3.glowTexture, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.set(s, s, s); return m; },
    pivot(x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); return p; },

    // ---------- гуманоид ----------
    // o: skin, body, legs, arms, robe, cape, chest, shoulders, helm, crest, hair, bun, spiky, hood, hat, crown, horns,
    //    ears, beard, collar, wings, eyes, skull, weapon, offhand, bulk, scale, armor (корпус — металл), boots, belt
    humanoid(o) {
        const B = this, root = new THREE.Group(), body = new THREE.Group(), rig = { kind: 'biped' };
        const bk = o.bulk || 1, skinK = o.skull ? 'bone' : 'skin', bodyK = o.armor ? 'metal' : 'cloth';
        root.add(body); rig.body = body;
        const skin = o.skin || 0xe0b090;
        // Ноги: бедро, голень, сапог; шарнир в тазу
        rig.legs = [-1, 1].map(s => {
            const p = B.pivot(s * 0.095 * bk, 0.47, 0);
            p.add(B.at(B.m(B.capsGeo(0.068 * bk, 0.17), o.legs || 0x3a3a46, o.armor ? 'metal' : 'cloth'), 0, -0.12, 0));
            p.add(B.at(B.m(B.capsGeo(0.056 * bk, 0.13), o.legs || 0x3a3a46, o.armor ? 'metal' : 'cloth'), 0, -0.29, 0));
            p.add(B.at(B.m(B.rboxGeo(0.12 * bk, 0.13, 0.21 * bk, 0.045), o.boots || 0x2a2018, o.armor ? 'dark' : 'leather'), 0, -0.4, 0.03));
            if (o.armor) p.add(B.at(B.m(B.sphGeo(0.05, 1, 0.8, 0.9), o.shoulders || o.body || 0x8a8a94, 'metal'), 0, -0.21, 0.05));
            body.add(p); return p;
        });
        // Корпус: тело вращения (грудь шире, талия уже), чуть сплющено спереди-назад
        const torso = B.m(B.latheGeo('torso', [[0.0, 0], [0.13, 0.0], [0.15, 0.06], [0.125, 0.15], [0.155, 0.27], [0.18, 0.35], [0.165, 0.4], [0.08, 0.43], [0, 0.44]]), o.body || 0x6b6b7a, bodyK);
        torso.scale.set(bk, 1, bk * 0.72); torso.position.y = 0.44; body.add(torso);
        body.add(B.at(B.m(B.cylGeo(0.045, 0.05, 0.08), skin, skinK), 0, 0.9, 0));
        if (o.chest) {
            // Нагрудник: выпуклая пластина по форме груди + окантовка
            const c = B.m(B.geo('chestplate', () => new THREE.SphereGeometry(0.16, 28, 16, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.5)), o.chest, o.chestK || 'metal', { side: THREE.DoubleSide });
            c.scale.set(1.12 * bk, 1.05, 0.62 * bk); c.position.set(0, 0.7, 0.0); body.add(c);
        }
        const belt = B.m(B.geo('belt', () => new THREE.TorusGeometry(0.14, 0.022, 10, 32)), o.belt || 0x3a2a1a, 'leather'); belt.rotation.x = Math.PI / 2; belt.position.y = 0.48; belt.scale.set(bk, bk * 0.74, 1); body.add(belt);
        body.add(B.at(B.m(B.rboxGeo(0.06, 0.05, 0.02, 0.01), 0xd4a020, 'gold'), 0, 0.48, 0.105 * bk));
        // Набедренные пластины (тассеты)
        if (o.tassets || o.armor) for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.55; const t = B.m(B.rboxGeo(0.1, 0.13, 0.018, 0.008), o.shoulders || o.chest || 0x8a8a94, 'metal'); t.position.set(Math.sin(a) * 0.15 * bk, 0.4, Math.cos(a) * 0.11 * bk); t.rotation.set(0.25, a, 0); body.add(t); }
        // Ножны на левом бедре
        if (o.scabbard) { const sc = B.m(B.rboxGeo(0.05, 0.55, 0.025, 0.012), 0x2a1a10, 'leather'); sc.position.set(-0.17 * bk, 0.34, -0.05); sc.rotation.set(0.5, 0, 0.35); body.add(sc); body.add(B.at(B.m(B.coneGeo(0.03, 0.06, 12), 0xd4a020, 'gold'), -0.25 * bk, 0.1, -0.2, 0.5 + Math.PI, 0, 0.35)); }
        // Колчан за спиной со стрелами
        if (o.quiver) { const q = B.m(B.cylGeo(0.05, 0.045, 0.42, 16), 0x3a2414, 'leather'); q.position.set(0.08, 0.72, -0.15 * bk); q.rotation.z = -0.35; body.add(q); for (let i = 0; i < 4; i++) body.add(B.at(B.m(B.coneGeo(0.018, 0.06, 6), i % 2 ? 0xe8e2d4 : 0xa01818, 'cloth'), 0.17 + i * 0.012, 0.95 + i * 0.01, -0.15 * bk + (i - 1.5) * 0.015, 0, 0, -0.35)); }
        // Подсумки на поясе и книга заклинаний
        if (o.pouch) [-1, 1].forEach(s => body.add(B.at(B.m(B.rboxGeo(0.06, 0.07, 0.04, 0.015), 0x4a3020, 'leather'), s * 0.13 * bk, 0.44, 0.07 * bk)));
        if (o.tome) { body.add(B.at(B.m(B.rboxGeo(0.12, 0.15, 0.04, 0.01), 0x3a1a4a, 'leather'), 0.17 * bk, 0.38, -0.02, 0, 0.2, 0.15)); body.add(B.at(B.m(B.rboxGeo(0.06, 0.06, 0.045, 0.008), 0xd4a020, 'gold'), 0.17 * bk, 0.38, -0.02, 0, 0.2, 0.15)); }
        // Юбка/мантия с волнистым подолом
        if (o.robe) {
            const g = B.geo('robe', () => { const g = new THREE.LatheGeometry([[0.13, 0.5], [0.16, 0.38], [0.22, 0.2], [0.29, 0.02]].map(p => new THREE.Vector2(p[0], p[1])), 32), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < 0.1) { const a = Math.atan2(pa.getZ(i), pa.getX(i)); pa.setY(i, y + Math.sin(a * 7) * 0.025); } } g.computeVertexNormals(); return g; });
            const r = B.m(g, o.robe, 'cloth', { side: THREE.DoubleSide }); r.scale.set(bk, 1, bk * 0.85); body.add(r);
        }
        // Наплечники: слоистые полусферы
        if (o.shoulders) [-1, 1].forEach(s => {
            const a = B.m(B.sphGeo(0.075, 1.25, 0.8, 1.15, 'top'), o.shoulders, o.shoulderK || 'metal', { side: THREE.DoubleSide }); a.position.set(s * 0.2 * bk, 0.84, 0); a.rotation.z = -s * 0.45; a.scale.multiplyScalar(bk); body.add(a);
            const b = B.m(B.sphGeo(0.062, 1.25, 0.8, 1.15, 'top'), o.shoulders, o.shoulderK || 'metal', { side: THREE.DoubleSide }); b.position.set(s * 0.235 * bk, 0.795, 0); b.rotation.z = -s * 0.75; b.scale.multiplyScalar(bk); body.add(b);
        });
        // Руки: плечо, предплечье (наруч), кисть; шарнир в плече
        rig.arms = [-1, 1].map(s => {
            const p = B.pivot(s * 0.215 * bk, 0.83, 0);
            p.add(B.at(B.m(B.capsGeo(0.05 * bk, 0.12), o.arms || o.body || 0x6b6b7a, o.armor ? 'metal' : 'cloth'), 0, -0.1, 0));
            p.add(B.at(B.m(B.capsGeo(0.047 * bk, 0.1), o.bracers || o.arms || o.body || 0x6b6b7a, o.armor ? 'metal' : 'leather'), 0, -0.24, 0));
            p.add(B.at(B.m(B.sphGeo(0.05 * bk, 1, 1.1, 0.9), o.gloves || skin, o.gloves ? 'leather' : skinK), 0, -0.34, 0));
            p.add(B.at(B.m(B.capsGeo(0.015, 0.03), o.gloves || skin, o.gloves ? 'leather' : skinK), -s * 0.035, -0.33, 0.03, 0.4, 0, s * 0.5));
            body.add(p); return p;
        });
        // Голова
        const head = new THREE.Group(); head.position.set(0, 0.99, 0); body.add(head); rig.head = head;
        if (o.skull) {
            head.add(B.at(B.m(B.sphGeo(0.1, 0.95, 1.05, 1), skin, 'bone'), 0, 0.03, 0));
            head.add(B.at(B.m(B.rboxGeo(0.12, 0.06, 0.1, 0.02), skin, 'bone'), 0, -0.05, 0.02));
            [-1, 1].forEach(s => head.add(B.at(B.m(B.sphGeo(0.026), 0x050505, 'plain'), s * 0.04, 0.03, 0.082)));
        } else {
            head.add(B.at(B.m(B.sphGeo(0.105, 0.92, 1.06, 1), skin, 'skin'), 0, 0.03, 0));
            head.add(B.at(B.m(B.coneGeo(0.016, 0.04, 10), skin, 'skin'), 0, 0.02, 0.105, Math.PI / 2));
            // Лицо: глаза (белок + радужка), брови, губы, уши, скулы
            if (!o.eyes) [-1, 1].forEach(s => {
                head.add(B.at(B.m(B.sphGeo(0.017, 1.25, 0.8, 0.6), 0xf4f0ea, 'skin'), s * 0.038, 0.045, 0.088));
                head.add(B.at(B.m(B.sphGeo(0.01), o.iris || 0x3a5a8a, 'gem'), s * 0.038, 0.045, 0.097));
                head.add(B.at(B.m(B.rboxGeo(0.034, 0.008, 0.012, 0.003), o.hair || 0x3a2a1a, 'fur'), s * 0.039, 0.07, 0.092, 0, 0, -s * 0.12));
            });
            head.add(B.at(B.m(B.rboxGeo(0.036, 0.008, 0.01, 0.003), 0xb06a5a, 'skin'), 0, -0.022, 0.095));
            [-1, 1].forEach(s => head.add(B.at(B.m(B.sphGeo(0.022, 0.5, 1, 0.8), skin, 'skin'), s * 0.1, 0.03, 0.0)));
        }
        if (o.eyes) [-1, 1].forEach(s => head.add(B.at(B.m(B.sphGeo(0.016, 1.3, 0.8, 0.6), o.eyes, 'gem', { emissive: o.eyes, emissiveIntensity: 3 }), s * 0.038, 0.045, 0.09)));
        if (o.hair) {
            head.add(B.at(B.m(B.sphGeo(0.118, 0.95, 0.85, 1.05, 'top'), o.hair, 'fur', { side: THREE.DoubleSide }), 0, 0.045, -0.008));
            head.add(B.at(B.m(B.capsGeo(0.075, 0.08), o.hair, 'fur'), 0, -0.01, -0.06));
            if (!o.spiky) { // чёлка и боковые пряди
                for (let i = 0; i < 4; i++) head.add(B.at(B.m(B.capsGeo(0.022, 0.06), o.hair, 'fur'), (i - 1.5) * 0.04, 0.1, 0.085, 0.5, 0, (i - 1.5) * 0.3));
                [-1, 1].forEach(s => head.add(B.at(B.m(B.capsGeo(0.02, 0.11), o.hair, 'fur'), s * 0.098, -0.02, 0.03, 0, 0, s * 0.1)));
            }
        }
        if (o.bun) head.add(B.at(B.m(B.sphGeo(0.055), o.hair, 'fur'), 0, 0.09, -0.12));
        if (o.spiky) for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4; const c = B.m(B.hornGeo(0.035, 0.17, 0.5), o.hair, 'fur'); c.position.set(Math.sin(a) * 0.07, 0.1, -0.03 + Math.cos(a) * 0.01); c.rotation.set(-0.9 - Math.abs(a) * 0.1, 0, -a * 0.5); head.add(c); }
        if (o.hood) {
            head.add(B.at(B.m(B.geo('hood', () => new THREE.SphereGeometry(0.135, 28, 18, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.62)), o.hood, 'cloth', { side: THREE.DoubleSide }), 0, 0.04, -0.01));
            head.add(B.at(B.m(B.hornGeo(0.06, 0.16, 0.9), o.hood, 'cloth'), 0, 0.12, -0.07, -0.5));
        }
        if (o.helm) {
            head.add(B.at(B.m(B.sphGeo(0.125, 1, 1.05, 1.08, 'top'), o.helm, 'metal', { side: THREE.DoubleSide }), 0, 0.02, 0));
            head.add(B.at(B.m(B.rboxGeo(0.2, 0.09, 0.05, 0.02), o.helm, 'metal'), 0, -0.02, 0.1));
            head.add(B.at(B.m(B.rboxGeo(0.03, 0.12, 0.22, 0.012), o.crest || o.helm, o.crest ? 'cloth' : 'metal'), 0, 0.15, -0.02));
        }
        if (o.hat) {
            head.add(B.at(B.m(B.cylGeo(0.24, 0.25, 0.018, 40), o.hat, 'cloth'), 0, 0.11, 0));
            head.add(B.at(B.m(B.hornGeo(0.12, 0.42, 0.45), o.hat, 'cloth'), 0, 0.11, 0));
        }
        if (o.crown) {
            const cr = B.m(B.geo('crown', () => new THREE.TorusGeometry(0.105, 0.014, 10, 36)), o.crown, 'gold'); cr.rotation.x = Math.PI / 2; cr.position.y = 0.12; head.add(cr);
            for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; head.add(B.at(B.m(B.coneGeo(0.018, 0.07, 10), o.crown, 'gold'), Math.cos(a) * 0.105, 0.16, Math.sin(a) * 0.105)); }
            head.add(B.at(B.m(B.sphGeo(0.016), 0xff1a2a, 'gem', { emissive: 0x8a0010 }), 0, 0.13, 0.112));
        }
        if (o.horns) [-1, 1].forEach(s => { const h = B.m(B.hornGeo(0.04, 0.3, 0.7), o.horns, 'bone'); h.position.set(s * 0.075, 0.11, 0.0); h.rotation.set(0.2, 0, -s * 0.55); head.add(h); });
        if (o.ears) [-1, 1].forEach(s => { const h = B.m(B.hornGeo(0.025, 0.12, 0.3), skin, 'skin'); h.position.set(s * 0.1, 0.05, -0.01); h.rotation.set(0, 0, -s * 1.25); head.add(h); });
        if (o.beard) { const bd = B.m(B.hornGeo(0.075, 0.24, -0.25), o.beard, 'fur'); bd.position.set(0, -0.02, 0.06); bd.rotation.x = Math.PI; head.add(bd); }
        // Плащ: изогнутая ткань с волнистым краем
        if (o.cape) {
            const g = B.geo('cape' + bk, () => { const g = new THREE.PlaneGeometry(0.44 * bk, 0.78, 12, 20), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, -x * x * 2.2 + (y < -0.25 ? Math.sin(x * 30) * 0.02 : 0)); pa.setY(i, y - 0.39); pa.setX(i, x * (1 + (-y + 0.39) * 0.25)); } g.computeVertexNormals(); return g; });
            const cp = B.m(g, o.cape, 'cloth', { side: THREE.DoubleSide }); cp.rotation.y = Math.PI;
            const cpv = B.pivot(0, 0.89, -0.11 * bk); cpv.add(cp); cpv.rotation.x = 0.18; body.add(cpv); rig.cape = cpv;
            [-1, 1].forEach(s => body.add(B.at(B.m(B.sphGeo(0.022), 0xd4a020, 'gold'), s * 0.13 * bk, 0.88, -0.06 * bk)));
        }
        if (o.collar) body.add(B.at(B.m(B.latheGeo('collar', [[0.1, 0], [0.12, 0.07], [0.16, 0.17]], 28, Math.PI * 0.8, Math.PI * 1.4), o.collar, 'cloth', { side: THREE.DoubleSide }), 0, 0.88, -0.02));
        if (o.wings) rig.wings = [-1, 1].map(s => { const p = B.pivot(s * 0.07, 0.8, -0.1); p.add(B.wing(s, o.wings, 0.8)); body.add(p); return p; });
        if (o.weapon) { o.weapon.position.y -= 0.35; rig.arms[1].add(o.weapon); rig.weapon = o.weapon; }
        if (o.offhand) { o.offhand.position.y -= 0.35; rig.arms[0].add(o.offhand); rig.offhand = o.offhand; }
        root.scale.setScalar(o.scale || 1);
        return { root, rig };
    },
    // Перепончатое крыло: зубчатая мембрана и кости-спицы
    wing(s, color, size) {
        const B = this, g = new THREE.Group();
        const geo = B.geo('wing', () => {
            const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.35, 0.35, 0.8, 0.25);
            for (let i = 0; i < 4; i++) { const x0 = 0.8 - i * 0.2, x1 = x0 - 0.2; sh.quadraticCurveTo((x0 + x1) / 2, 0.02 - i * 0.03, x1, -0.12 - i * 0.04); }
            sh.lineTo(0, 0);
            return new THREE.ShapeGeometry(sh, 10);
        });
        const mem = B.m(geo, color, 'leather', { side: THREE.DoubleSide }); mem.scale.set(s * size, size, size); mem.rotation.y = s * 0.3; g.add(mem);
        for (let i = 0; i < 3; i++) { const b = B.m(B.cylGeo(0.012, 0.018, 0.55 * size, 10), color, 'bone'); b.position.set(s * (0.2 + i * 0.12) * size, (0.12 - i * 0.04) * size, 0); b.rotation.z = -s * (1.0 + i * 0.35); g.add(b); }
        return g;
    },

    // ---------- оружие ----------
    // Клинок: выдавленный профиль с фаской и острием; гарда, рукоять в коже, навершие
    sword(blade = 0xd8dde8, hilt = 0x8a6a2a, len = 0.6, o) {
        const B = this, g = new THREE.Group();
        const bg = B.geo('blade' + len, () => { const w = 0.035, sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.lineTo(-w * 0.85, len * 0.8); sh.lineTo(0, len); sh.lineTo(w * 0.85, len * 0.8); sh.lineTo(w, 0); sh.lineTo(-w, 0);
            const e = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.01, bevelSegments: 3, curveSegments: 4 }); e.translate(0, 0, -0.003); return e; });
        g.add(B.at(B.m(bg, blade, 'metal', o), 0, 0.1, 0));
        g.add(B.at(B.m(B.rboxGeo(0.2, 0.035, 0.05, 0.015), hilt, 'gold'), 0, 0.09, 0));
        g.add(B.at(B.m(B.cylGeo(0.018, 0.02, 0.13, 16), 0x3a2414, 'leather'), 0, 0.02, 0));
        g.add(B.at(B.m(B.sphGeo(0.026), hilt, 'gold'), 0, -0.055, 0));
        g.rotation.x = Math.PI / 2; g.position.z = 0.04; g.userData.len = len + 0.1;
        return g;
    },
    axe(c = 0x8a8f96) {
        const B = this, g = new THREE.Group();
        g.add(B.at(B.m(B.cylGeo(0.022, 0.026, 0.8, 16), 0x4a3020, 'wood'), 0, 0.3, 0));
        const hg = B.geo('axehead', () => { const sh = new THREE.Shape(); sh.moveTo(0, -0.06); sh.quadraticCurveTo(0.12, -0.16, 0.24, -0.18); sh.quadraticCurveTo(0.17, 0, 0.24, 0.18); sh.quadraticCurveTo(0.12, 0.16, 0, 0.06); sh.lineTo(0, -0.06);
            const e = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 }); e.translate(0, 0, -0.006); return e; });
        [0, Math.PI].forEach(ry => { const h = B.m(hg, c, 'metal'); h.position.set(0, 0.6, 0); h.rotation.y = ry; g.add(h); });
        g.rotation.x = Math.PI / 2; g.position.z = 0.04; g.userData.len = 0.78; return g;
    },
    staff(top = 0x8b5cf6, wood = 0x5a3a22) {
        const B = this, g = new THREE.Group();
        const sg = B.geo('staff', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0.02, 0.2, 0), new THREE.Vector3(-0.02, 0.6, 0), new THREE.Vector3(0.04, 0.82, 0)]), 24, 0.022, 10));
        g.add(B.m(sg, wood, 'wood'));
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const c = B.m(B.hornGeo(0.012, 0.16, 0.6), wood, 'wood'); c.position.set(0.04 + Math.cos(a) * 0.03, 0.8, Math.sin(a) * 0.03); c.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5); g.add(c); }
        g.add(B.at(B.m(B.geo('gem', () => new THREE.IcosahedronGeometry(0.06, 2)), top, 'gem', { emissive: top, emissiveIntensity: 2 }), 0.04, 0.9, 0));
        g.add(B.at(B.glow(top, 0.5), 0.04, 0.9, 0));
        g.position.z = 0.02; return g;
    },
    bow(c = 0x5a3a22) {
        const B = this, g = new THREE.Group();
        const bg = B.geo('bow', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.36, 0.06), new THREE.Vector3(0, -0.28, 0), new THREE.Vector3(0, -0.1, -0.1), new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0, 0.1, -0.1), new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0, 0.36, 0.06)]), 40, 0.016, 10));
        g.add(B.m(bg, c, 'wood'));
        g.add(B.at(B.m(B.cylGeo(0.022, 0.022, 0.1, 14), 0x2a1a10, 'leather'), 0, 0, -0.12));
        const str = new THREE.Mesh(B.cylGeo(0.0025, 0.0025, 0.72, 6), new THREE.MeshBasicMaterial({ color: 0xe8e2d4 })); str.position.z = 0.06; g.add(str);
        g.rotation.y = Math.PI / 2; g.position.z = 0.04;
        return g;
    },
    shield(c = 0x6b6b7a, emblem = 0xc0a040) {
        const B = this, g = new THREE.Group();
        const sg = B.geo('shield', () => { const sh = new THREE.Shape(); sh.moveTo(-0.17, 0.2); sh.lineTo(0.17, 0.2); sh.quadraticCurveTo(0.18, -0.08, 0, -0.24); sh.quadraticCurveTo(-0.18, -0.08, -0.17, 0.2);
            const e = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.018, bevelSegments: 4, curveSegments: 16 }); e.rotateY(Math.PI / 2); return e; });
        g.add(B.m(sg, c, 'metal'));
        g.add(B.at(B.m(B.sphGeo(0.05, 0.6, 1, 1), emblem, 'gold'), -0.035, 0.02, 0));
        g.add(B.at(B.m(B.rboxGeo(0.02, 0.3, 0.05, 0.008), emblem, 'gold'), -0.03, 0, 0));
        g.position.set(-0.07, 0.06, 0); return g;
    },
    crossbow() {
        const B = this, g = new THREE.Group();
        g.add(B.m(B.rboxGeo(0.05, 0.05, 0.5, 0.018), 0x4a3020, 'wood'));
        const lg = B.geo('xbowlimb', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.25, 0, 0.1), new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0.25, 0, 0.1)]), 20, 0.014, 8));
        g.add(B.m(lg, 0x6b6b7a, 'metal'));
        g.rotation.x = -Math.PI / 2 + 0.3; g.position.z = 0.15; return g;
    },

    // ---------- четвероногий (волки, гончие) ----------
    quadruped(o) {
        const B = this, root = new THREE.Group(), body = new THREE.Group(), rig = { kind: 'quad' };
        root.add(body); rig.body = body;
        body.add(B.at(B.m(B.sphGeo(0.22, 1, 1, 1.35), o.fur, 'fur'), 0, 0.55, 0.12));
        body.add(B.at(B.m(B.sphGeo(0.18, 1, 0.95, 1.3), o.fur, 'fur'), 0, 0.5, -0.22));
        // Грива: «лохматая» сфера
        const mg = B.geo('mane', () => { const g = new THREE.IcosahedronGeometry(0.26, 3), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + Tex3D.fbm(v.x * 30 + 9, v.y * 30 + v.z * 20, 1e4, 2, 5) * 0.35; p.setXYZ(i, v.x * k, v.y * k, v.z * k); } g.computeVertexNormals(); return g; });
        const mane = B.m(mg, o.mane || o.fur, 'fur'); mane.position.set(0, 0.62, 0.25); mane.scale.set(0.9, 0.9, 0.8); body.add(mane);
        const head = new THREE.Group(); head.position.set(0, 0.72, 0.48); body.add(head); rig.head = head;
        head.add(B.m(B.sphGeo(0.13, 1, 0.95, 1.1), o.fur, 'fur'));
        head.add(B.at(B.m(B.capsGeo(0.065, 0.12), o.snout || o.fur, 'fur'), 0, -0.04, 0.15, Math.PI / 2));
        head.add(B.at(B.m(B.sphGeo(0.028), 0x101010, 'gem'), 0, -0.02, 0.27));
        [-1, 1].forEach(s => {
            head.add(B.at(B.m(B.hornGeo(0.04, 0.13, 0.2), o.fur, 'fur'), s * 0.07, 0.09, -0.03, -0.2, 0, -s * 0.3));
            head.add(B.at(B.m(B.sphGeo(0.018, 1.3, 0.8, 0.7), o.eyes || 0xffd040, 'gem', { emissive: o.eyes || 0xffd040, emissiveIntensity: 3 }), s * 0.065, 0.03, 0.1));
            for (let k = 0; k < 2; k++) head.add(B.at(B.m(B.coneGeo(0.008, 0.04, 8), 0xf0ead8, 'bone'), s * (0.03 + k * 0.02), -0.09, 0.22, Math.PI));
        });
        rig.legs = [[-1, 0.3], [1, 0.3], [-1, -0.28], [1, -0.28]].map(([s, z]) => {
            const p = B.pivot(s * 0.13, 0.48, z);
            p.add(B.at(B.m(B.capsGeo(0.06, 0.16), o.legs || o.fur, 'fur'), 0, -0.1, 0));
            p.add(B.at(B.m(B.capsGeo(0.045, 0.14), o.legs || o.fur, 'fur'), 0, -0.3, -0.02));
            p.add(B.at(B.m(B.sphGeo(0.055, 1, 0.6, 1.3), o.legs || o.fur, 'fur'), 0, -0.42, 0.03));
            body.add(p); return p;
        });
        const tp = B.pivot(0, 0.58, -0.42); const tail = B.m(B.hornGeo(0.06, 0.45, 0.6), o.fur, 'fur'); tail.rotation.x = -2.0; tp.add(tail); body.add(tp); rig.tail = tp;
        if (o.flames) body.add(B.at(B.glow(0xff5a1a, 1.0), 0, 0.75, 0.1));
        if (o.spikes) for (let i = 0; i < 5; i++) body.add(B.at(B.m(B.hornGeo(0.035, 0.18, 0.6), 0x2a0a04, 'bone'), 0, 0.75 - i * 0.02, 0.25 - i * 0.14, -0.4));
        root.scale.setScalar(o.scale || 1);
        return { root, rig };
    },

    slime(c) {
        const B = this, root = new THREE.Group(), body = new THREE.Group(), rig = { kind: 'slime', body };
        const g = B.geo('slime', () => new THREE.SphereGeometry(0.34, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62));
        const m = B.m(g, c, 'gem', { transparent: true, opacity: 0.78, emissive: c, emissiveIntensity: 0.35 }); m.scale.set(1, 1.15, 1); body.add(m);
        body.add(B.at(B.m(B.geo('gem', () => new THREE.IcosahedronGeometry(0.06, 2)), 0xffffff, 'gem', { emissive: c, emissiveIntensity: 1.5 }), 0, 0.16, 0));
        [-1, 1].forEach(s => body.add(B.at(B.m(B.sphGeo(0.035, 1, 1.3, 0.6), 0x101010, 'gem'), s * 0.09, 0.24, 0.27)));
        root.add(body); return { root, rig };
    },
    bat() {
        const B = this, root = new THREE.Group(), body = new THREE.Group(), rig = { kind: 'bat', body };
        body.position.y = 0.9; root.add(body);
        body.add(B.m(B.sphGeo(0.1, 1, 1.2, 1), 0x2a1a2a, 'fur'));
        body.add(B.at(B.m(B.sphGeo(0.075), 0x2a1a2a, 'fur'), 0, 0.11, 0.03));
        [-1, 1].forEach(s => { body.add(B.at(B.m(B.hornGeo(0.03, 0.1, 0.2), 0x2a1a2a, 'fur'), s * 0.04, 0.16, 0.02, 0, 0, -s * 0.3)); body.add(B.at(B.m(B.sphGeo(0.014), 0xff2020, 'gem', { emissive: 0xff2020, emissiveIntensity: 3 }), s * 0.03, 0.12, 0.09)); });
        rig.wings = [-1, 1].map(s => { const p = new THREE.Group(); p.add(B.wing(s, 0x3a1a2a, 0.55)); body.add(p); return p; });
        return { root, rig };
    },
    wraith() {
        const B = this, root = new THREE.Group(), body = new THREE.Group(), rig = { kind: 'float', body };
        root.add(body);
        const ex = { transparent: true, opacity: 0.62, emissive: 0x4fa0c8, emissiveIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide };
        const rg = B.geo('wraithRobe', () => { const g = new THREE.LatheGeometry([[0.06, 1.15], [0.2, 1.0], [0.24, 0.7], [0.3, 0.3], [0.34, 0.0]].map(p => new THREE.Vector2(p[0], p[1])), 36), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < 0.15) { const a = Math.atan2(pa.getZ(i), pa.getX(i)); pa.setY(i, y + Math.abs(Math.sin(a * 6)) * 0.2); } } g.computeVertexNormals(); return g; });
        body.add(B.at(B.m(rg, 0x9fc8d8, 'cloth', ex), 0, 0.1, 0));
        body.add(B.at(B.m(B.geo('hood', () => new THREE.SphereGeometry(0.135, 28, 18, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.62)), 0x9fc8d8, 'cloth', ex), 0, 1.2, 0));
        [-1, 1].forEach(s => body.add(B.at(B.m(B.sphGeo(0.02, 1.4, 0.7, 0.6), 0xa0ffff, 'gem', { emissive: 0xa0ffff, emissiveIntensity: 4 }), s * 0.04, 1.2, 0.1)));
        rig.arms = [-1, 1].map(s => { const p = B.pivot(s * 0.22, 0.98, 0.02); p.add(B.at(B.m(B.hornGeo(0.06, 0.45, 0.2), 0x9fc8d8, 'cloth', ex), 0, 0, 0, Math.PI)); body.add(p); return p; });
        body.add(B.at(B.glow(0x6fd8ff, 1.3), 0, 0.8, 0));
        return { root, rig };
    },

    // ---------- каталог героев ----------
    hero(type, st) {
        const H = this, pal = Object.assign({}, st.pal || {});
        const take = k => { const v = pal[k]; delete pal[k]; return v; };
        if (type === 'saber') {
            const alter = !!st.alter;
            const glowC = alter ? 0xff2030 : (take('glowC') || 0x9fc8ff), blade = take('blade');
            const sw = H.sword(alter ? 0x1a0a10 : (blade || 0xeaf2ff), alter ? 0x3a0a10 : 0xd4a020, 0.72, { emissive: glowC, emissiveIntensity: alter ? 1.2 : 0.4 });
            sw.add(H.at(H.glow(glowC, 0.6), 0, 0.5, 0));
            const o = { skin: alter ? 0xe8dcd8 : 0xf3cfaa, body: alter ? 0x15151c : 0x2a4aa0, arms: alter ? 0x15151c : 0x2a4aa0, bracers: alter ? 0x2a2a34 : 0xc8d0e0,
                chest: alter ? 0x2a2a34 : 0xc8d0e0, chestK: alter ? 'dark' : 'metal', legs: alter ? 0x15151c : 0x2a4aa0, robe: alter ? 0x15151c : 0x2848b0, shoulders: alter ? 0x2a2a34 : 0xc8d0e0,
                shoulderK: alter ? 'dark' : 'metal', hair: alter ? 0xf0ecd8 : 0xf2d070, bun: true, eyes: alter ? 0xffd040 : null, weapon: sw, belt: alter ? 0x5a0a14 : 0x3a2414,
                boots: alter ? 0x1a1a22 : 0xa8b0c4, gloves: alter ? 0x2a2a34 : 0xc8d0e0, scabbard: true, tassets: true };
            if (!alter) Object.assign(o, pal);
            return H.humanoid(o);
        }
        if (type === 'archer') {
            const blades = st.stance === 'blades';
            return H.humanoid(Object.assign({ skin: 0xc89870, body: 0x1a1a1e, arms: 0xa01818, bracers: 0x2a2a30, legs: 0x1a1a1e, robe: 0xa01818, chest: 0x2a2a30, chestK: 'leather',
                shoulders: 0xb02020, shoulderK: 'cloth', hair: 0xf0f0f0, spiky: true, belt: 0x3a3a3a, boots: 0x2a2a2a, gloves: 0x1a1a1e, quiver: !blades, pouch: true },
                pal, { weapon: blades ? H.sword(0x202024, 0x101010, 0.42) : null, offhand: blades ? H.sword(0xe8e8f0, 0xc0c0c8, 0.42) : H.bow(0x2a2a2a) }));
        }
        if (type === 'knight') return H.knight(st);
        // Маг (обычный или золотой) с тремя сферами
        const gold = !!st.gold;
        const m = H.humanoid(Object.assign({ skin: 0xe8c8a8, body: gold ? 0xb08a20 : 0x4a2a70, arms: gold ? 0xd4a020 : 0x5a3a80, legs: 0x2a1a3a, robe: gold ? 0xd4a020 : 0x3a1a5a,
            chest: gold ? 0xfff0a0 : 0xc8a040, chestK: 'gold', shoulders: gold ? 0xffe070 : 0xc8a040, shoulderK: 'gold', hair: 0xf0f0f0, cape: gold ? 0xffd040 : 0x2a1040,
            collar: gold ? 0xffe070 : 0xc8a040, belt: 0xc8a040, gloves: 0x2a1a3a, pouch: true, tome: true }, gold ? {} : pal));
        m.rig.orbs = [0, 1, 2].map(() => {
            const g = new THREE.Group();
            const core = new THREE.Mesh(H.geo('orb', () => new THREE.IcosahedronGeometry(0.07, 3)), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5, roughness: 0.1 }));
            const gl = H.glow(0xffffff, 0.55);
            core.userData.keep = true; g.add(core); g.add(gl); g.userData = { core, gl }; m.root.add(g); return g;
        });
        return m;
    },

    // Павший Рыцарь: готические латы, закрытый шлем, раскалённая кровь в стыках, трофейный меч в крови или когти
    knight(st) {
        const H = this, sw = st.sword, glowM = { emissive: 0xff1020, emissiveIntensity: 4.5, envMapIntensity: 0 };
        let weapon = null;
        if (sw) {
            const d = (typeof KNIGHT_SWORDS !== 'undefined' && KNIGHT_SWORDS[sw.type]) || {};
            const blade = new THREE.Color(d.blade || 0xa0a4ac).lerp(new THREE.Color(0x4a0006), 0.5).getHex();
            weapon = H.sword(blade, d.hilt || 0x3a2414, d.len || 0.55, { emissive: 0x7a0010, emissiveIntensity: 0.6, roughness: 0.25 });
            // Сгустки крови на клинке
            for (let i = 0; i < 5; i++) weapon.add(H.at(H.m(H.sphGeo(0.016 + Math.random() * 0.012, 1, 1.6, 0.6), 0x5a0006, 'gem', { emissive: 0x3a0004 }), (Math.random() - 0.5) * 0.04, 0.2 + i * (d.len || 0.55) / 6, 0.01));
        }
        const m = H.humanoid({ armor: true, bulk: 1.25, skin: 0x0e0b0e, body: 0x0c0c10, arms: 0x0b0b0e, legs: 0x09090c, chest: 0x121216, chestK: 'dark', shoulders: 0x101014, shoulderK: 'dark',
            boots: 0x08080a, gloves: 0x0b0b0e, bracers: 0x111115, belt: 0x2a0004, cape: 0x2a0306, weapon, tassets: true });
        const { body, head, arms, legs } = m.rig;
        // Закрытый готический шлем с прорезью, из которой бьёт красный свет
        head.add(H.at(H.m(H.sphGeo(0.135, 1, 1.12, 1.08), 0x0c0c10, 'dark'), 0, 0.03, 0));
        head.add(H.at(H.glow(0xff1a2a, 0.35), 0, 0.045, 0.15));
        head.add(H.at(H.m(H.rboxGeo(0.16, 0.025, 0.02, 0.008), 0xff1a2a, 'gem', glowM), 0, 0.045, 0.13));
        head.add(H.at(H.m(H.rboxGeo(0.02, 0.07, 0.02, 0.006), 0xff1a2a, 'gem', glowM), 0, -0.01, 0.135));
        head.add(H.at(H.m(H.rboxGeo(0.03, 0.14, 0.26, 0.01), 0x101014, 'dark'), 0, 0.17, -0.01));
        [-1, 1].forEach(s => head.add(H.at(H.m(H.hornGeo(0.03, 0.2, 0.8), 0x101014, 'dark'), s * 0.11, 0.12, -0.04, -0.3, 0, -s * 0.7)));
        // Шипы на наплечниках
        [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) body.add(H.at(H.m(H.hornGeo(0.025, 0.14, 0.2), 0x101014, 'dark'), s * (0.24 + k * 0.03), 0.9 - k * 0.03, -0.02 + k * 0.03, 0, 0, -s * (0.6 + k * 0.2))); });
        // Раскалённая кровь в стыках лат: шея, пояс, локти, колени, крест на груди
        const seam = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => H.at(H.m(geo, 0xff1020, 'gem', glowM), x, y, z, rx, ry, rz);
        const ring = (r) => H.geo('seam' + r, () => new THREE.TorusGeometry(r, 0.008, 6, 32));
        body.add(seam(ring(0.06), 0, 0.92, 0, Math.PI / 2));
        body.add(seam(ring(0.15), 0, 0.5, 0, Math.PI / 2));
        body.add(seam(H.rboxGeo(0.012, 0.22, 0.012, 0.004), 0, 0.72, 0.105));
        body.add(seam(H.rboxGeo(0.18, 0.012, 0.012, 0.004), 0, 0.76, 0.1));
        arms.forEach(a => a.add(seam(ring(0.045), 0, -0.18, 0, Math.PI / 2)));
        legs.forEach(l => l.add(seam(ring(0.055), 0, -0.21, 0.01, Math.PI / 2)));
        body.add(H.at(H.glow(0xff1a2a, 0.5), 0, 0.75, 0.12));
        // Когти, когда меча нет
        if (!sw) m.rig.claws = arms.map((a, i) => { const g = new THREE.Group(); g.position.set(0, -0.38, 0.03); for (let k = 0; k < 3; k++) { const c = H.m(H.hornGeo(0.012, 0.13, -0.9), 0x2a2a30, 'dark'); c.position.set((k - 1) * 0.022, 0, 0); c.rotation.x = Math.PI - 0.3; g.add(c); g.add(H.at(H.m(H.coneGeo(0.006, 0.03, 6), 0xff1a2a, 'gem', glowM), (k - 1) * 0.022, -0.115, 0.04, Math.PI - 0.3)); } a.add(g); return g; });
        return m;
    },

    enemy(type, en) {
        const H = this, tpl = en.tpl || {}, col = new THREE.Color(tpl.color || '#888888').getHex();
        switch (type) {
            case 'slime': return H.slime(0x22c55e);
            case 'bat': return H.bat();
            case 'wraith': return H.wraith();
            case 'werewolf': return H.quadruped({ fur: 0x5a4a3a, mane: 0x4a3a2a, snout: 0x6a5a4a });
            case 'werewolf_alpha': return H.quadruped({ fur: 0x3a3a42, mane: 0x2a2a30, snout: 0x4a4a52, eyes: 0xff3020, scale: 1.4, spikes: true });
            case 'hellhound': return H.quadruped({ fur: 0x3a0e06, mane: 0x1a0402, snout: 0x5a1a0a, eyes: 0xff8020, flames: true, spikes: true, scale: 1.1 });
            case 'goblin': return H.humanoid({ skin: 0x6a9a3a, body: 0x5a4a2a, legs: 0x3a2a1a, ears: true, eyes: 0xffe040, weapon: H.sword(0x8a8f96, 0x5a3a20, 0.36), scale: 0.78 });
            case 'skeleton': case 'bone_walker': return H.humanoid({ skin: 0xe8e2d4, skull: true, body: 0xd8d2c4, arms: 0xd8d2c4, legs: 0xd8d2c4, eyes: 0x60ff90, belt: 0x5a4a3a,
                shoulders: type === 'skeleton' ? 0x8a6a2a : null, shoulderK: 'dark', helm: type === 'skeleton' ? 0x8a6a2a : null, crest: 0xa01818, weapon: H.sword(0xa0a4ac, 0x5a3a20, 0.5), offhand: type === 'skeleton' ? H.shield(0x6a4a2a, 0xa01818) : null, bulk: 0.8 });
            case 'dark_mage': return H.humanoid({ skin: 0xa8b0c0, body: 0x2a1040, robe: 0x1a0a2a, hood: 0x2a1040, eyes: 0xc060ff, cape: 0x1a0a2a, weapon: H.staff(0xc060ff) });
            case 'imp': return H.humanoid({ skin: 0xc03a1a, body: 0xa02a10, arms: 0xc03a1a, legs: 0x5a1a0a, horns: 0x2a0a04, eyes: 0xffe040, wings: 0x5a1a0a, scale: 0.72, weapon: H.staff(0xff6a1a, 0x2a0a04) });
            case 'ghoul': return H.humanoid({ skin: 0x7a8a6a, body: 0x5a6a4a, arms: 0x7a8a6a, legs: 0x3a3a2a, eyes: 0xd0ff40, bulk: 1.1, belt: 0x3a2a1a, ears: true });
            case 'gargoyle': return H.humanoid({ skin: 0x6a6a74, body: 0x5a5a64, arms: 0x5a5a64, legs: 0x4a4a54, horns: 0x3a3a44, eyes: 0xff6020, wings: 0x4a4a54, bulk: 1.15 });
            case 'vampire_thrall': return H.humanoid({ skin: 0xd8d0d8, body: 0x2a0a14, legs: 0x1a0a10, hair: 0x101010, eyes: 0xff2020, cape: 0x5a0a14, belt: 0x1a1a1a, collar: 0x1a0a10 });
            case 'blood_knight': case 'crimson_knight': return H.humanoid({ armor: true, skin: 0xd8b090, body: 0x7a7a84, arms: 0x6a6a74, legs: 0x5a5a64, chest: type === 'blood_knight' ? 0x8a0a14 : 0xe8e8e8, chestK: 'cloth',
                helm: 0x8a8a94, crest: 0xb01020, shoulders: 0x9a9aa4, cape: 0x8a0a14, weapon: H.sword(0xc8ccd4, 0x8a6a2a, 0.62), offhand: H.shield(type === 'blood_knight' ? 0x5a0a14 : 0xe8e8e8, 0xb01020), bulk: 1.1 });
            case 'crimson_crossbow': return H.humanoid({ skin: 0xe0b090, body: 0xe8e8e8, chest: 0xb01020, chestK: 'cloth', legs: 0x4a4a54, helm: 0x7a7a84, weapon: H.crossbow() });
            case 'bandit': return H.humanoid({ skin: 0xd0a080, body: 0x5a4a3a, legs: 0x3a3028, hood: 0x3a3028, chest: 0x4a3a2a, chestK: 'leather', weapon: H.sword(0x9a9ea6, 0x4a3020, 0.42) });
            case 'bandit_archer': return H.humanoid({ skin: 0xd0a080, body: 0x4a5a3a, legs: 0x3a3028, hood: 0x3a4a2a, offhand: H.bow() });
            case 'pit_demon': return H.humanoid({ skin: 0x8a1a0a, body: 0x6a1408, arms: 0x8a1a0a, legs: 0x3a0a04, horns: 0x1a0a04, eyes: 0xffd040, shoulders: 0x2a0a04, shoulderK: 'dark', weapon: H.axe(0x3a3a3a), bulk: 1.45, scale: 1.25 });
            case 'boss': return H.humanoid({ skin: 0x5a3a2a, body: 0x3a2a2a, arms: 0x4a3030, legs: 0x2a1a1a, horns: 0x1a1a1a, eyes: 0xff6020, shoulders: 0x6a2a10, shoulderK: 'dark', cape: 0x3a1408, weapon: H.axe(0x5a5a5a), bulk: 1.4, scale: 1.45 });
            case 'ash_warden': return H.humanoid({ armor: true, skin: 0x6a6a6a, body: 0x4a4440, chest: 0xff6a1a, chestK: 'cloth', helm: 0x3a3430, crest: 0xff6a1a, shoulders: 0x5a544e, weapon: H.sword(0x8a8a8a, 0x3a3430, 0.7), offhand: H.shield(0x3a3430, 0xff6a1a), bulk: 1.3, scale: 1.25 });
            case 'crimson_warden': return H.humanoid({ skin: 0xd8d0d8, body: 0x5a0a14, chest: 0x1a0a10, chestK: 'dark', hair: 0xe8e8e8, eyes: 0xff2020, cape: 0x8a0a14, collar: 0x2a0a10, shoulders: 0x3a0a14, shoulderK: 'dark', weapon: H.sword(0xb01020, 0x1a1a1a, 0.8, { emissive: 0x8a0010 }), bulk: 1.15, scale: 1.2 });
            case 'infernal_gatekeeper': return H.humanoid({ armor: true, skin: 0x3a1a10, body: 0x2a1a1a, arms: 0x3a2a2a, chest: 0xff4a10, chestK: 'cloth', horns: 0x1a0a04, eyes: 0xff8020, shoulders: 0x4a3a3a, helm: 0x2a1a1a, crest: 0xff4a10, weapon: H.axe(0x2a2a2a), offhand: H.shield(0x2a1a1a, 0xff4a10), bulk: 1.6, scale: 1.45 });
            case 'dracula': { // Граф Дракула: бледный, высокий воротник, корона, кровавый клинок
                const m = H.humanoid({ skin: 0xece4ec, body: 0x15101a, arms: 0x15101a, legs: 0x101014, chest: 0x8a0a14, chestK: 'cloth', hair: 0x0a0a0a, eyes: 0xff1a1a,
                    cape: 0x8a0a14, collar: 0x1a0a14, shoulders: 0x2a0a14, shoulderK: 'dark', crown: 0xd4a020, gloves: 0x101014, weapon: H.sword(0xb01020, 0xd4a020, 0.75, { emissive: 0x6a0010 }), bulk: 1.15, scale: 1.35 });
                m.rig.body.add(H.at(H.glow(0xff1a3a, 0.7), 0, 0.9, -0.2));
                return m;
            }
            case 'hell_lord': { // Ваал'Гор: исполинский демон с крыльями и пылающим мечом
                const sw = H.sword(0x3a0a04, 0x1a0a04, 0.75, { emissive: 0xff3a00, emissiveIntensity: 1.2 }); sw.add(H.at(H.glow(0xff5a1a, 0.5), 0, 0.5, 0));
                const m = H.humanoid({ skin: 0x6a0a04, body: 0x3a0604, arms: 0x6a0a04, legs: 0x2a0402, chest: 0x2a0a0a, chestK: 'dark', horns: 0x0a0a0a, eyes: 0xffe040, shoulders: 0x1a0a0a, shoulderK: 'dark', wings: 0x2a0604, weapon: sw, bulk: 1.7, scale: 1.5 });
                m.rig.body.add(H.at(H.glow(0xff4a10, 0.8), 0, 0.8, -0.2));
                return m;
            }
            case 'saber_shadow': return H.hero('saber', { alter: true });
            default: return H.humanoid({ skin: 0xd0a080, body: col, legs: 0x3a3a3a, weapon: H.sword() });
        }
    },

    npc(n) {
        const H = this, id = n.id;
        const P = {
            elder: { skin: 0xe0b090, robe: 0x3a3a8a, body: 0x4a4aa0, hat: 0x2a2a6a, beard: 0xf0f0f0, weapon: H.staff(0x60a0ff) },
            merlin: { skin: 0xe0b090, robe: 0xe8e8f0, body: 0xd8d8e0, hat: 0xe8e8f0, beard: 0xf0f0f0, weapon: H.staff(0xffffff) },
            merchant: { skin: 0xd0a080, body: 0x6a3a1a, robe: 0x5a2a10, beard: 0x5a3a1a, belt: 0xd4a020, bulk: 1.2 },
            alchemist: { skin: 0xf0d0b0, body: 0x2a6a4a, robe: 0x1a5a3a, hair: 0xe8d070, ears: true },
            gawain: { armor: true, skin: 0xe0b090, body: 0x9aa4b8, chest: 0xd4a020, chestK: 'gold', shoulders: 0xc8d0e0, hair: 0xc8a040, weapon: H.sword(), offhand: H.shield(0x2848b0, 0xd4a020) },
            kay: { skin: 0xe0b090, body: 0x2848b0, robe: 0x2040a0, hair: 0x5a3a1a, crown: 0xd4a020, cape: 0xa01818 },
            vanhelsing: { skin: 0xd0a080, body: 0x3a3028, legs: 0x2a2018, hat: 0x2a2018, cape: 0x2a2018, beard: 0x8a6a4a, chest: 0x4a3a2a, chestK: 'leather', weapon: H.crossbow() }
        };
        return H.humanoid(P[id] || { skin: 0xd0a080, body: 0x6a5a4a, robe: 0x5a4a3a });
    }
};
