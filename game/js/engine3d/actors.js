// ============================================================================
// АКТЁРЫ: синхронизация героя, монстров, боссов и NPC с игровыми данными + анимации
// ============================================================================
// Ходьба (по фактической скорости), удар (по перезарядке атаки), вспышка урона, заморозка, смерть.
const Actors3D = {
    map: new Map(), npcMap: new Map(), player: null, playerKey: '',
    init(scene) {
        this.scene = scene;
        this.ringGeo = new THREE.RingGeometry(0.42, 0.52, 48); this.ringGeo.rotateX(-Math.PI / 2);
        this.blobGeo = new THREE.CircleGeometry(0.4, 32); this.blobGeo.rotateX(-Math.PI / 2);
        this.blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
    },
    // Склейка геометрии: все детали одного шарнира и одного материала → один меш (в разы меньше вызовов отрисовки)
    mergeGeos(list, posOnly) {
        let n = 0; list.forEach(g => n += g.attributes.position.count);
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = posOnly ? null : new Float32Array(n * 2);
        let o = 0;
        list.forEach(g => {
            const c = g.attributes.position.count;
            pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
            if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
            o += c;
        });
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        out.computeBoundingSphere();
        return out;
    },
    // Подготовка модели: склейка по шарнирам, свои материалы (вспышка урона, заморозка), контурный свет и обводка
    own(root, rig, outline) {
        const bones = new Set([root, rig.body, rig.head, rig.cape, rig.weapon, rig.offhand, rig.tail].concat(rig.legs || [], rig.arms || [], rig.wings || [], rig.orbs || []).filter(Boolean));
        root.updateMatrixWorld(true);
        const mats = [], geos = [], inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
        for (const bone of bones) {
            const meshes = [];
            const walk = o => { for (const c of o.children) { if (bones.has(c)) continue; if (c.isMesh && !c.userData.keep) meshes.push(c); walk(c); } };
            walk(bone);
            if (!meshes.length) continue;
            inv.copy(bone.matrixWorld).invert();
            const groups = new Map();
            for (const m of meshes) { const k = m.material.uuid; if (!groups.has(k)) groups.set(k, { mat: m.material, list: [] }); groups.get(k).list.push(m); }
            const outl = [];
            for (const { mat, list } of groups.values()) {
                const parts = list.map(m => { rel.multiplyMatrices(inv, m.matrixWorld); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(rel); return g; });
                const geo = this.mergeGeos(parts); parts.forEach(g => g.dispose()); geos.push(geo);
                const mt = mat.clone();
                if (mt.emissive) { mt.userData.e0 = mt.emissive.clone(); mt.userData.i0 = mt.emissiveIntensity; }
                G3.rimify(mt); if (bone === rig.cape) G3.capeify(mt); mats.push(mt);
                const mesh = new THREE.Mesh(geo, mt); mesh.castShadow = true; mesh.receiveShadow = true; bone.add(mesh);
                if (outline && !mat.transparent && mat.side !== THREE.DoubleSide) outl.push(geo);
            }
            if (outl.length) { const og = this.mergeGeos(outl, true); geos.push(og); const ol = new THREE.Mesh(og, G3.getOutlineMat()); ol.userData.outline = true; bone.add(ol); }
            const set = new Set(meshes);
            for (const m of meshes) { [...m.children].forEach(c => { if (!set.has(c)) bone.attach(c); }); m.parent.remove(m); }
        }
        root.traverse(o => { if (o.isMesh && o.userData.mdx && o.material.emissive) { const mt = o.material; mt.userData.e0 = mt.emissive.clone(); mt.userData.i0 = mt.emissiveIntensity; G3.rimify(mt); mats.push(mt); } });
        return { mats, geos };
    },
    make(model, ringColor) {
        const a = { root: model.root, rig: model.rig, mats: [], phase: Math.random() * 6, lx: null, lz: null, spd: 0, rot: 0, atk: 0, lastCd: 0, dying: 0, flash: 0, tint: 0 };
        const r = this.own(model.root, model.rig, true); a.mats = r.mats; a.geos = r.geos; a.atkStyle = null; a.atkT = 0; a.atkDur = 1;
        a.base = new THREE.Group(); a.base.add(model.root);
        const blob = new THREE.Mesh(this.blobGeo, this.blobMat); blob.position.y = 0.02; blob.renderOrder = -1; a.base.add(blob); a.blob = blob;
        if (ringColor) { const r = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); r.position.y = 0.04; a.base.add(r); a.ring = r; }
        this.scene.add(a.base);
        return a;
    },
    drop(a) {
        this.scene.remove(a.base); a.mats.forEach(m => m.dispose()); a.geos.forEach(g => g.dispose()); if (a.ring) a.ring.material.dispose();
        a.root.traverse(o => { if (o.isSprite) o.material.dispose(); else if (o.userData.keep && o.material) o.material.dispose(); });
    },

    // ---------- Плавная анимация ----------
    // Все суставы стремятся к целевой позе через критически затухающую «пружину»: никаких рывков,
    // позы (ходьба, удар, каст, натяжение лука) смешиваются по весам.
    ease: {
        out3: k => 1 - Math.pow(1 - k, 3), in2: k => k * k, inOut: k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
        back: k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
    },
    // Кривая удара: замах → резкий удар → доводка → возврат. Возвращает [фаза 0..1 по сегментам]
    swingCurve(p, wind = 0.3, hit = 0.5) {
        const E = this.ease;
        if (p < wind) return { w: E.inOut(p / wind), s: 0, r: 0 };            // замах
        if (p < hit) return { w: 1, s: E.out3((p - wind) / (hit - wind)), r: 0 }; // удар
        return { w: 1, s: 1, r: E.inOut((p - hit) / (1 - hit)) };              // возврат
    },
    pose(a, style, p) {
        // Цели для суставов: ax/az — руки, lx — ноги, by/bx — поворот/наклон корпуса, hx — голова
        const T = { a0x: 0, a0z: 0, a1x: 0, a1z: 0, by: 0, bx: 0 }, L = (x, y, k) => x + (y - x) * k;
        if (style === 'slash' || style === 'slashB') {
            const c = this.swingCurve(p, 0.32, 0.52), dir = style === 'slashB' ? -1 : 1;
            const up = -2.5, down = 0.55;
            const ax = c.r > 0 ? L(down, 0, c.r) : (c.s > 0 ? L(up, down, c.s) : L(0, up, c.w));
            const az = (c.r > 0 ? L(0.35, 0, c.r) : (c.s > 0 ? L(-0.6, 0.35, c.s) : L(0, -0.6, c.w))) * dir;
            const by = (c.r > 0 ? L(-0.6, 0, c.r) : (c.s > 0 ? L(0.4, -0.6, c.s) : L(0, 0.4, c.w))) * dir;
            T.a1x = ax; T.a1z = az; T.by = by; T.bx = c.s > 0 && c.r < 1 ? 0.18 * (1 - c.r) : 0; T.a0x = -0.4 * c.w * (1 - c.r);
        } else if (style === 'slashL') { // клинок в левой руке (связка Арчера)
            const c = this.swingCurve(p, 0.28, 0.5);
            T.a0x = c.r > 0 ? L(0.55, 0, c.r) : (c.s > 0 ? L(-2.3, 0.55, c.s) : L(0, -2.3, c.w));
            T.a0z = (c.r > 0 ? L(-0.35, 0, c.r) : (c.s > 0 ? L(0.6, -0.35, c.s) : L(0, 0.6, c.w)));
            T.by = c.r > 0 ? L(0.6, 0, c.r) : (c.s > 0 ? L(-0.4, 0.6, c.s) : L(0, -0.4, c.w)); T.bx = 0.12 * c.s * (1 - c.r);
        } else if (style === 'heavy') { // финальный двуручный взмах (Экскалибур)
            const c = this.swingCurve(p, 0.08, 0.45);
            const ax = c.r > 0 ? L(0.9, 0, c.r) : (c.s > 0 ? L(-2.95, 0.9, c.s) : -2.95);
            T.a0x = T.a1x = ax; T.a0z = 0.35; T.a1z = -0.35; T.bx = c.s > 0 ? L(-0.15, 0.35, c.s) * (1 - c.r) : -0.15;
        } else if (style === 'raise') { T.a0x = T.a1x = -2.95; T.a0z = 0.3; T.a1z = -0.3; T.bx = -0.15; }
        else if (style === 'bow') { // натяжение и выстрел: левая рука вперёд с луком, правая тянет тетиву
            const draw = p < 0.55 ? this.ease.out3(p / 0.55) : 1, rel = p > 0.55 ? this.ease.out3((p - 0.55) / 0.45) : 0;
            T.a0x = -1.5 * Math.min(1, draw * 1.6); T.a0z = 0.15; T.a1x = L(-1.5, -1.1, draw) * (1 - rel) + -0.6 * rel; T.a1z = L(0, 0.9, draw) * (1 - rel); T.by = 0.35 * draw * (1 - rel * 0.5);
        } else if (style === 'cast') { // обе руки толкают заклинание вперёд
            const c = this.swingCurve(p, 0.35, 0.6);
            const ax = c.r > 0 ? L(-1.55, 0, c.r) : (c.s > 0 ? L(-0.9, -1.55, c.s) : L(0, -0.9, c.w));
            T.a0x = T.a1x = ax; T.a0z = 0.35 * (1 - c.r); T.a1z = -0.35 * (1 - c.r); T.bx = c.s > 0 ? 0.12 * (1 - c.r) : -0.08 * c.w;
        } else if (style === 'craft') { // два удара «молотом» по наковальне
            const q = (p * 2) % 1, c = this.swingCurve(q, 0.4, 0.6);
            T.a1x = c.r > 0 ? L(0.4, -0.3, c.r) : (c.s > 0 ? L(-2.6, 0.4, c.s) : L(-0.3, -2.6, c.w)); T.bx = 0.2 * c.s * (1 - c.r); T.a0x = -0.8;
        } else if (style === 'thrust') { // 1: быстрый выпад остриём вперёд
            const c = this.swingCurve(p, 0.3, 0.5);
            T.a1x = c.r > 0 ? L(-1.6, 0, c.r) : (c.s > 0 ? L(0.5, -1.6, c.s) : L(0, 0.5, c.w)); T.a1z = 0;
            T.by = c.r > 0 ? L(-0.35, 0, c.r) : (c.s > 0 ? L(0.3, -0.35, c.s) : L(0, 0.3, c.w)); T.bx = c.s * 0.28 * (1 - c.r); T.a0x = -0.5 * c.w * (1 - c.r);
        } else if (style === 'cross') { // 2: горизонтальный перекрёстный разрез
            const c = this.swingCurve(p, 0.3, 0.52);
            T.a1x = -1.25 * (1 - c.r); T.a1z = c.r > 0 ? L(0.9, 0, c.r) : (c.s > 0 ? L(-1.5, 0.9, c.s) : L(0, -1.5, c.w));
            T.by = c.r > 0 ? L(-0.8, 0, c.r) : (c.s > 0 ? L(0.7, -0.8, c.s) : L(0, 0.7, c.w)); T.bx = 0.1 * c.s * (1 - c.r);
        } else if (style === 'spin' || style === 'twinSpin') { // 3 (Сейбер) / 4 (клинки): удар с разворота — полный оборот
            const c = this.swingCurve(p, 0.22, 0.7), E = this.ease;
            T.a1x = -1.3 * (1 - c.r); T.a1z = -0.35 * (1 - c.r);
            if (style === 'twinSpin') { T.a0x = -0.4 * (1 - c.r); T.a0z = 1.3 * (1 - c.r); T.a1x = -0.4 * (1 - c.r); T.a1z = -1.3 * (1 - c.r); }
            T.spin = c.s > 0 ? -E.inOut(c.s) * Math.PI * 2 : 0; T.by = c.w * 0.5 * (1 - c.s); T.bx = 0.15 * c.s * (1 - c.r);
        } else if (style === 'overhead') { // 4: сокрушительный финишер сверху вниз двумя руками
            const c = this.swingCurve(p, 0.36, 0.52);
            const ax = c.r > 0 ? L(0.95, 0, c.r) : (c.s > 0 ? L(-3.0, 0.95, c.s) : L(0, -3.0, c.w));
            T.a0x = T.a1x = ax; T.a0z = 0.3; T.a1z = -0.3; T.bx = c.r > 0 ? L(0.45, 0, c.r) : (c.s > 0 ? L(-0.25, 0.45, c.s) : L(0, -0.25, c.w));
        } else if (style === 'twin') { // 3 (клинки): оба клинка накрест сверху вниз
            const c = this.swingCurve(p, 0.3, 0.5);
            const ax = c.r > 0 ? L(0.5, 0, c.r) : (c.s > 0 ? L(-2.3, 0.5, c.s) : L(0, -2.3, c.w)), az = c.r > 0 ? L(-0.4, 0, c.r) : (c.s > 0 ? L(0.75, -0.4, c.s) : L(0, 0.75, c.w));
            T.a0x = T.a1x = ax; T.a0z = az; T.a1z = -az; T.bx = 0.2 * c.s * (1 - c.r);
        } else if (style === 'bowPower') { // 4 (лук): долгое натяжение с наклоном назад и мощный выстрел
            const draw = p < 0.7 ? this.ease.out3(p / 0.7) : 1, rel = p > 0.7 ? this.ease.out3((p - 0.7) / 0.3) : 0;
            T.a0x = -1.55 * Math.min(1, draw * 1.5); T.a0z = 0.15; T.a1x = L(-1.5, -1.05, draw) * (1 - rel) - 0.4 * rel; T.a1z = L(0, 1.15, draw) * (1 - rel); T.by = 0.45 * draw * (1 - rel * 0.6); T.bx = -0.15 * draw + 0.2 * rel;
        } else if (style === 'castR' || style === 'castL') { // 1–2 (маг): толчок одной рукой
            const c = this.swingCurve(p, 0.32, 0.55), right = style === 'castR';
            const ax = c.r > 0 ? L(-1.55, 0, c.r) : (c.s > 0 ? L(-0.6, -1.55, c.s) : L(0, -0.6, c.w));
            if (right) { T.a1x = ax; T.a1z = -0.25 * (1 - c.r); } else { T.a0x = ax; T.a0z = 0.25 * (1 - c.r); }
            T.by = (right ? -1 : 1) * 0.35 * c.s * (1 - c.r);
        } else if (style === 'castBig') { // 4 (маг): руки вверх, затем обрушить чары вперёд
            const c = this.swingCurve(p, 0.4, 0.6);
            const ax = c.r > 0 ? L(-1.4, 0, c.r) : (c.s > 0 ? L(-2.9, -1.4, c.s) : L(0, -2.9, c.w));
            T.a0x = T.a1x = ax; T.a0z = 0.5 * (1 - c.r); T.a1z = -0.5 * (1 - c.r); T.bx = c.s > 0 ? 0.25 * (1 - c.r) : -0.2 * c.w;
        } else if (style === 'clawR' || style === 'clawL') { // удар когтями: дикий рвущий взмах сверху наискось
            const c = this.swingCurve(p, 0.26, 0.46), R = style === 'clawR';
            const ax = c.r > 0 ? L(0.7, -0.2, c.r) : (c.s > 0 ? L(-2.1, 0.7, c.s) : L(-0.2, -2.1, c.w)), az = c.r > 0 ? L(0.6, 0, c.r) : (c.s > 0 ? L(-0.8, 0.6, c.s) : L(0, -0.8, c.w));
            if (R) { T.a1x = ax; T.a1z = az; T.a0x = -0.6; } else { T.a0x = ax; T.a0z = -az; T.a1x = -0.6; }
            T.by = (R ? 1 : -1) * (c.r > 0 ? L(-0.6, 0, c.r) : (c.s > 0 ? L(0.45, -0.6, c.s) : L(0, 0.45, c.w))); T.bx = 0.32 * c.s * (1 - c.r) + 0.12;
        } else if (style === 'clawX' || style === 'clawRend') { // обе лапы: крест-накрест / финишер, разрывающий в стороны
            const c = this.swingCurve(p, style === 'clawRend' ? 0.36 : 0.28, style === 'clawRend' ? 0.56 : 0.48), rend = style === 'clawRend';
            const ax = c.r > 0 ? L(0.8, -0.2, c.r) : (c.s > 0 ? L(rend ? -2.7 : -2.0, 0.8, c.s) : L(-0.2, rend ? -2.7 : -2.0, c.w));
            const az = rend ? (c.r > 0 ? L(-0.9, 0, c.r) : (c.s > 0 ? L(1.1, -0.9, c.s) : L(0, 1.1, c.w))) : (c.r > 0 ? L(-0.5, 0, c.r) : (c.s > 0 ? L(0.8, -0.5, c.s) : L(0, 0.8, c.w)));
            T.a0x = T.a1x = ax; T.a0z = az; T.a1z = -az; T.bx = (rend ? 0.45 : 0.3) * c.s * (1 - c.r) + (rend ? -0.2 * c.w * (1 - c.s) : 0.1);
        } else if (style === 'selfStab') { // жертва: клинок в собственную грудь, рыцаря скручивает
            const k = this.ease.out3(Math.min(1, p * 2.2)), back = p > 0.6 ? (p - 0.6) / 0.4 : 0;
            T.a1x = L(0, -1.35, k) * (1 - back); T.a1z = L(0, 1.15, k) * (1 - back); T.a0x = -0.9 * k * (1 - back); T.a0z = 0.6 * k * (1 - back); T.bx = 0.45 * k * (1 - back);
        } else if (style === 'grab') { // пир: схватить жертву и рвануть к себе
            const reach = p < 0.35 ? this.ease.out3(p / 0.35) : 1, pull = p > 0.35 ? this.ease.out3((p - 0.35) / 0.65) : 0;
            T.a0x = T.a1x = L(0, -1.6, reach) * (1 - pull) - 0.7 * pull; T.a0z = 0.3 * (1 - pull) - 0.4 * pull; T.a1z = -T.a0z; T.bx = 0.3 * reach + 0.25 * pull;
        } else if (style === 'rend') { // ульта: руки раскинуты, тело выгнуто, дрожь
            const sh = Math.sin(Engine3D.t * 41) * 0.08;
            T.a0x = T.a1x = -2.4 + sh; T.a0z = 1.0 + sh; T.a1z = -1.0 - sh; T.bx = -0.4 + sh * 0.5; T.by = sh;
        } else if (style === 'kneel') { // на колене, голова опущена, клинок опирается о землю
            T.l0 = -1.45; T.l1 = 0.55; T.bx = 0.5; T.a1x = -0.55; T.a1z = 0.15; T.a0x = 0.25; T.a0z = 0.1;
        } else if (style === 'rise') { // встаёт, выпрямляясь
            T.l0 = -0.5; T.l1 = 0.2; T.bx = 0.18; T.a1x = -0.4; T.a0x = -0.1;
        } else if (style === 'plunge') { // вонзает клинок в землю перед собой двумя руками
            T.a0x = T.a1x = -1.05; T.a0z = -0.35; T.a1z = 0.35; T.bx = 0.28; T.l0 = -0.25; T.l1 = 0.15;
        } else if (style === 'roar') { // без оружия: руки-когти разведены, рык
            T.a0x = T.a1x = -1.0; T.a0z = 0.9; T.a1z = -0.9; T.bx = -0.25;
        } else if (style === 'bowUp') { T.a0x = -2.3; T.a0z = 0.2; T.a1x = -1.6; T.a1z = 0.5; T.bx = -0.1; }
        else if (style === 'orbsUp') { T.a0x = T.a1x = -2.4; T.a0z = 0.8; T.a1z = -0.8; T.bx = -0.2; }
        else if (style === 'stance') { // боевая стойка вполоборота
            T.a1x = -0.75; T.a1z = -0.25; T.a0x = -0.4; T.a0z = 0.3; T.bx = 0.1; T.by = 0.3; T.l0 = -0.2; T.l1 = 0.25;
        } else if (style === 'pray') { const k = Math.sin(Math.min(1, p) * Math.PI); T.a0x = T.a1x = -2.7 * k; T.a0z = 0.6 * k; T.a1z = -0.6 * k; T.bx = -0.2 * k; }
        return T;
    },
    spring(a, key, target, dt, k = 22) { const j = a.j || (a.j = {}); const v = j[key] === undefined ? target : j[key]; return (j[key] = v + (target - v) * (1 - Math.exp(-k * dt))); },
    attack(a, style, dur) { a.atkStyle = style; a.atkT = 0; a.atkDur = dur; a.impDone = false; },
    // Моменты удара в анимациях комбо
    IMPACT: {
        overhead: { at: 0.52, dist: 1.0, size: 1.4, kick: 0.7, sfx: 'heavy' },
        twinSpin: { at: 0.68, dist: 0.3, size: 1.1, kick: 0.4, sfx: 'impact' },
        castBig: { at: 0.6, dist: 1.2, size: 1.2, kick: 0.35, sfx: 'impact', magic: true },
        bowPower: { at: 0.7, dist: 0.6, size: 0.5, kick: 0.25, sfx: 'whoosh', air: true },
        spin: { at: 0.45, dist: 0, size: 0.8, sfx: 'slash', ring: true },
        clawRend: { at: 0.56, dist: 0.7, size: 1.1, kick: 0.5, sfx: 'impact', blood: true },
        clawX: { at: 0.48, dist: 0.6, size: 0.6, sfx: 'slash', blood: true }
    },
    impactFx(a, I) {
        const fx = Math.sin(a.rot), fz = Math.cos(a.rot), x = a.base.position.x + fx * I.dist, z = a.base.position.z + fz * I.dist;
        const col = this.heroColor();
        if (I.blood || player.heroType === 'knight') { AnimFX.blood(x, a.base.position.y + 0.7, z, I.size * 30, fx, fz); AnimFX.shock(x, a.base.position.y + 0.05, z, 0x8a0010, 0.2, 1.2 * I.size, 0.4); }
        else if (I.ring) AnimFX.shock(a.base.position.x, a.base.position.y + 0.6, a.base.position.z, col, 0.3, 1.6, 0.3, 0.8);
        else if (I.air) AnimFX.emit({ x, y: a.base.position.y + 1.1, z, n: 18, color: [col, 0xffffff], speed: 2, life: 0.4, size: 0.07, grav: 0, dir: [fx, 0, fz] });
        else AnimFX.impact(x, z, I.magic ? col : 0xfff0c0, I.size, { dust: 0x5a4a3a });
        if (I.kick) AnimFX.kick(I.kick);
        if (I.sfx) Sfx3D.play(I.sfx, 0.9);
    },
    // Три светящихся рваных борозды от когтей на теле врага (затухают за 2.5 с)
    clawScar(a, dx, dz) {
        if (!this.scarGeo) { this.scarGeo = new THREE.PlaneGeometry(0.035, 0.42); }
        const g = new THREE.Group(), tilt = (Math.random() - 0.5) * 1.2;
        for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(this.scarGeo, new THREE.MeshBasicMaterial({ color: k === 1 ? 0xff3a2a : 0xd01018, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
            m.position.set((k - 1) * 0.07, (k - 1) * 0.02, 0); m.rotation.z = tilt; g.add(m);
        }
        const r = (a.rig.kind === 'biped' ? 0.2 : 0.3);
        g.position.set(-dx * r, 0.68, -dz * r); g.lookAt(-dx * 5, 0.68, -dz * 5);
        a.base.add(g); (a.scars = a.scars || []).push({ g, t: 0 });
        if (a.scars.length > 4) { const old = a.scars.shift(); a.base.remove(old.g); old.g.children.forEach(m => m.material.dispose()); }
    },
    heroColor() { const ht = player.heroType; if (ht === 'knight') return 0xdc1020; return ht === 'saber' ? (saberRed() ? 0xff2a3a : 0x9fd0ff) : (ht === 'archer' ? 0xff3a4a : ({ q: 0x38bdf8, w: 0xc084fc, e: 0xfb923c }[(player.activeOrbs || [])[2]] || 0xc084fc)); },
    animate(a, dt, x, z, opts) {
        const t = Engine3D.t;
        if (a.lx === null) { a.lx = x; a.lz = z; }
        const dx = x - a.lx, dz = z - a.lz, d = Math.hypot(dx, dz);
        a.spd += ((d / Math.max(dt, 1e-3)) - a.spd) * Math.min(1, dt * 8);
        a.lx = x; a.lz = z;
        let want = opts.face;
        if (want === undefined && d > 0.002) want = Math.atan2(dx, dz);
        if (want !== undefined) { let df = want - a.rot; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; a.rot += df * (1 - Math.exp(-14 * dt)); }
        a.base.position.set(x, World3D.hAt(x, z), z); a.root.rotation.y = a.rot;
        const rig = a.rig;
        // Вес ходьбы плавно растёт и спадает; фаза шага зависит от скорости
        a.walkW = (a.walkW || 0) + (Math.min(1, a.spd / 2.2) - (a.walkW || 0)) * (1 - Math.exp(-8 * dt));
        a.phase += dt * (2.2 + a.spd * 2.6);
        const W = a.walkW, sw = Math.sin(a.phase) * (0.25 + Math.min(0.6, a.spd * 0.13)) * W;
        // Атака по фазам
        let P = null;
        if (a.atkStyle) { a.atkT += dt; const p = a.atkT / a.atkDur; if (p >= 1) a.atkStyle = null; else P = this.pose(a, a.atkStyle, p); }
        if (!P && opts.hold) P = this.pose(a, opts.hold, 0);
        a.root.rotation.y = a.rot + (P && P.spin ? P.spin : 0);
        // Ключевой кадр удара: искры, волна, звук и камера синхронно с анимацией
        const IMP = this.IMPACT[a.atkStyle];
        if (P && IMP && !a.impDone && a.atkT / a.atkDur >= IMP.at) { a.impDone = true; this.impactFx(a, IMP); }
        // Реакция на попадание: отшатнуться
        a.hitT = Math.max(0, (a.hitT || 0) - dt);
        const hit = a.hitT > 0 ? Math.sin(a.hitT / 0.25 * Math.PI) : 0;
        const S = (k, v, kk) => this.spring(a, k, v, dt, kk);
        if (rig.kind === 'biped') {
            const breathe = Math.sin(t * 1.8 + a.phase * 0.1) * 0.012 * (1 - W);
            rig.legs[0].rotation.x = S('l0', P && P.l0 !== undefined ? P.l0 : sw, P && P.l0 !== undefined ? 6 : 22); rig.legs[1].rotation.x = S('l1', P && P.l1 !== undefined ? P.l1 : -sw, P && P.l1 !== undefined ? 6 : 22);
            rig.body.position.y = Math.abs(Math.cos(a.phase)) * 0.035 * W + breathe;
            const ia = P ? 1 : 0;
            rig.arms[0].rotation.x = S('a0x', P ? P.a0x : -sw * 0.75 - 0.05, P ? 26 : 14);
            rig.arms[0].rotation.z = S('a0z', P ? P.a0z : 0.08, 20);
            rig.arms[1].rotation.x = S('a1x', P ? P.a1x : sw * 0.75 - 0.05, P ? 30 : 14);
            rig.arms[1].rotation.z = S('a1z', P ? P.a1z : -0.08, 22);
            rig.body.rotation.y = S('by', P ? P.by : 0, 18);
            rig.body.rotation.x = S('bx', (P ? P.bx : 0.06 * W) - hit * 0.3, 16);
            if (rig.head) rig.head.rotation.x = S('hx', -hit * 0.25 + (ia ? 0.05 : 0), 12);
            if (rig.cape) rig.cape.rotation.x = S('cape', 0.18 + Math.min(0.8, a.spd * 0.14) + Math.sin(t * 4 + a.phase) * 0.06, 6);
            if (rig.wings) rig.wings.forEach((w, i) => w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 5 + a.phase) * 0.28));
        } else if (rig.kind === 'mdx') {
            // Родные анимации модели WC3: удары и навыки ускоряются под длительность удара в игре
            const X = rig.mdx, alt = !!opts.alt, A = a.atkStyle, SEQ = MDX3D.ANIMS[X.modelName] || MDX3D.ANIMS.mordred;
            let name = SEQ.idle || 'Stand', rate = 1, restart = false, loop;
            if (a.dying > 0) { name = SEQ.death || 'Death'; loop = false; }
            else if (A && SEQ[A]) { name = SEQ[A]; const s = X.D.sequences[MDX3D.find(X, name, alt)]; rate = s ? (s.end - s.start) / Math.max(150, a.atkDur * 1000) : 1; restart = a.atkT <= dt * 1.5; loop = false; }
            else if (A) { name = SEQ.slash || SEQ.thrust; const s = X.D.sequences[MDX3D.find(X, name, alt)]; rate = s ? (s.end - s.start) / Math.max(150, a.atkDur * 1000) : 1; restart = a.atkT <= dt * 1.5; loop = false; }
            else if (opts.hold && SEQ[opts.hold]) { name = SEQ[opts.hold]; loop = true; }
            else if (a.spd > 0.4) { name = SEQ.walk || 'Walk'; rate = Math.max(0.6, Math.min(2.2, a.spd / 1.9)); loop = true; }
            else loop = true;
            if (!MDX3D.play(X, name, { alt, rate, restart, loop })) MDX3D.play(X, SEQ.idle || 'Stand', { alt, loop: true });
            // Увеличенный клинок (3-й навык Сейбер — «Колоссальный Клинок»)
            X.boneScale = X.blade && opts.bigBlade ? { id: X.blade.node, s: 1 + opts.bigBlade } : null;
            X.forceVis = opts.vis || null;
            MDX3D.update(X, dt);
        } else if (rig.kind === 'quad') {
            rig.legs.forEach((l, i) => l.rotation.x = S('l' + i, (i === 0 || i === 3 ? sw : -sw) * 1.2));
            rig.body.position.y = Math.abs(Math.sin(a.phase)) * 0.05 * W;
            if (rig.tail) rig.tail.rotation.y = Math.sin(t * 5 + a.phase) * 0.4;
            let lunge = 0;
            if (a.atkStyle || (a.atkT !== undefined && a.atkT < a.atkDur)) { const c = this.swingCurve(Math.min(1, a.atkT / a.atkDur), 0.35, 0.55); lunge = c.r > 0 ? 1 - c.r : (c.s > 0 ? c.s : -0.4 * c.w); }
            rig.body.rotation.x = S('bx', -0.3 * lunge - hit * 0.2 + (lunge < 0 ? 0.15 : 0), 20); rig.body.position.z = S('bz', 0.3 * Math.max(0, lunge), 24);
            if (rig.head) rig.head.rotation.x = S('hx', -0.4 * Math.max(0, lunge), 20);
        } else if (rig.kind === 'slime') {
            const b = Math.sin(a.phase * 1.4); let jump = 0;
            if (a.atkStyle) { const k = a.atkT / a.atkDur; jump = Math.sin(k * Math.PI); }
            rig.body.scale.set(S('sx', 1 + b * 0.1 - jump * 0.12 + hit * 0.2), S('sy', 1 - b * 0.14 + jump * 0.25 - hit * 0.25), S('sz', 1 + b * 0.1 - jump * 0.12 + hit * 0.2));
            rig.body.position.y = jump * 0.4;
        } else if (rig.kind === 'bat') {
            rig.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(t * 20 + a.phase) * 0.85);
            let dive = 0; if (a.atkStyle) dive = Math.sin(a.atkT / a.atkDur * Math.PI);
            rig.body.position.y = 0.9 + Math.sin(t * 3 + a.phase) * 0.12 - dive * 0.4; rig.body.rotation.x = S('bx', dive * 0.6, 14);
        } else if (rig.kind === 'float') {
            rig.body.position.y = 0.15 + Math.sin(t * 2 + a.phase) * 0.08;
            const reach = a.atkStyle ? Math.sin(a.atkT / a.atkDur * Math.PI) : 0;
            rig.arms.forEach((ar, i) => ar.rotation.x = S('a' + i, -0.4 + Math.sin(t * 2.4 + i) * 0.2 - reach * 1.4, 14));
        }
        // Вспышка урона (белым) и заморозка (голубым)
        const fl = Math.max(0, a.flash), fr = opts.frozen ? 1 : 0;
        if (fl > 0 || fr || a.tint) {
            for (const m of a.mats) {
                if (!m.userData.e0) continue;
                if (fl > 0) { m.emissive.setRGB(1, 0.95, 0.9); m.emissiveIntensity = fl * 1.4; }
                else if (fr) { m.emissive.setRGB(0.25, 0.6, 1); m.emissiveIntensity = 0.7; }
                else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.i0; }
            }
            a.tint = fl > 0 || fr;
        }
    },
    // Смерть: подкошенное падение с отскоком, души улетают вверх, тело уходит в землю
    dyingPose(a, dt, en) {
        if (a.rig.kind === 'mdx') { if (a.dying < 0.001) { a.dying = 0.001; } a.dying = Math.min(1.4, a.dying + dt); this.animate(a, dt, a.base.position.x, a.base.position.z, {}); a.blob.visible = a.dying < 0.9; return; }
        if (a.dying < 0.001 && en) {
            const x = a.base.position.x, z = a.base.position.z, y = a.base.position.y;
            const undead = /skeleton|bone|wraith|ghoul|bat|vampire|dracula|gargoyle/.test(en.type), demon = /imp|hell|pit|boss|infernal|ash/.test(en.type);
            const c = undead ? [0x8affc0, 0x2a6a5a, 0xd0fff0] : (demon ? [0xff6a1a, 0x3a0a04, 0xffd040] : [0x8a1020, 0x2a0408, 0xff5060]);
            AnimFX.emit({ x, y: y + 0.6, z, n: en.isBoss ? 160 : 36, color: c, speed: 0.8, up: 2.6, life: 1.3, size: 0.1, sizeEnd: 0.02, grav: -1.2, drag: 1.5, r: 0.25 });
            AnimFX.shock(x, y + 0.05, z, c[0], 0.2, en.isBoss ? 4 : 1.2, 0.5, 0.7);
            if (en.isBoss) { AnimFX.kick(1); Sfx3D.play('ult'); } else if (Math.hypot(x - player.x / G3.tile, z - player.y / G3.tile) < 8) Sfx3D.play('death');
        }
        a.dying = Math.min(1.4, a.dying + dt);
        const k = Math.min(1, a.dying / 0.5), fall = k < 0.8 ? this.ease.in2(k / 0.8) : 1 - Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.06;
        a.rig.body.rotation.x = -fall * Math.PI / 2 * (a.rig.kind === 'biped' ? 1 : 0.45);
        if (a.rig.arms && a.rig.kind === 'biped') { a.rig.arms[0].rotation.x = -fall * 0.8; a.rig.arms[1].rotation.x = -fall * 1.2; }
        if (a.dying > 0.5 && !a.dust) { a.dust = true; AnimFX.emit({ x: a.base.position.x, y: a.base.position.y + 0.05, z: a.base.position.z, n: 14, color: 0x6a5a4a, speed: 1, up: 0.4, life: 0.8, size: 0.3, sizeEnd: 0.5, grav: -0.2, drag: 3 }); }
        a.root.position.y = a.dying > 0.9 ? -this.ease.in2((a.dying - 0.9) / 0.5) * 1.2 : 0;
        a.blob.visible = a.dying < 0.9;
    },
    // Переход (смена стойки, тёмная форма): «вспыхивающее» появление новой модели, оружие материализуется
    transition(d) { if (this.player) { this.player.trans = d; this.player.transD = d; } this.pendingTrans = d; },
    gesture(name) { if (this.player) this.attack(this.player, name, name === 'craft' ? 0.9 : 1.3); },
    // Точки оружия (основание, кончик) в мире — для шлейфов
    weaponPts(w) {
        if (!w || !w.userData.len) return null;
        w.updateWorldMatrix(true, false);
        return [new THREE.Vector3(0, 0.12, 0).applyMatrix4(w.matrixWorld), new THREE.Vector3(0, 0.1 + w.userData.len, 0).applyMatrix4(w.matrixWorld)];
    },

    update(dt) {
        const T = G3.tile, px = player.x / T, pz = player.y / T, hellRow = (typeof WORLD !== 'undefined' ? WORLD.hellRow : 1e9);
        const playerHell = pz >= hellRow;
        // ---------- герой ----------
        const ht = player.heroType || 'invoker';
        const gold = ht === 'invoker' && player.orbLevels && player.orbLevels.r >= 4;
        const ch = typeof playerChar === 'function' ? playerChar() : null;
        const key = ht + (player.saberAlter ? 'A' : '') + (player.archerStance === 'blades' ? 'B' : '') + (gold ? 'G' : '') + (ch ? ch.id : '') + (ht === 'knight' ? (player.knightSword ? player.knightSword.type : '-claw') : '');
        if (key !== this.playerKey) {
            if (this.player) this.drop(this.player);
            const mname = ht === 'saber' && player.saberAlter && ch && (ch.id === 'saber' || ch.id === 'saber_alter') ? 'saber_alter' : (ch && ch.model);
            const mx = mname && typeof MDX3D !== 'undefined' ? MDX3D.create(mname, { height: 1.25 }) : null;
            this.player = this.make(mx ? { root: mx.root, rig: { kind: 'mdx', mdx: mx, body: mx.root } } : Models3D.hero(ht, { alter: player.saberAlter, stance: player.archerStance, gold, pal: ch && ch.pal, sword: player.knightSword }), null);
            this.player.root.scale.setScalar(1.08);
            const aura = Models3D.glow(0xffd070, 1.8); aura.position.y = 0.7; aura.visible = false; this.player.base.add(aura); this.player.aura = aura;
            this.playerKey = key;
        }
        G3.cape.t.value = Engine3D.t;
        if (this.player && player.heroType === 'knight') { const pulse = 1.4 + Math.sin(Engine3D.t * 3.2) * 0.9 + Math.sin(Engine3D.t * 11) * 0.2; for (const m of this.player.mats) if (m.emissiveMap && !this.player.tint) m.emissiveIntensity = pulse; }
        const P = this.player;
        if (this.pendingTrans) { P.trans = P.transD = this.pendingTrans; this.pendingTrans = 0; }
        // Начало атаки героя → стиль и длительность удара по классу и стойке
        const slash = player.slashAnimTime || 0, cast = player.castAnimTime || 0, blades = player.archerStance === 'blades';
        if (slash > 0 && (P.lastSlash || 0) <= 0) {
            let style = 'slash', dur = 0.42;
            if (ht === 'saber' && player.ultCast && player.ultCast.swing) { style = 'heavy'; dur = 0.6; }
            else if (ht === 'saber') { const k = (player.comboStep || 1) - 1; style = ['thrust', 'cross', 'spin', 'overhead'][k]; dur = [0.34, 0.4, 0.52, 0.62][k]; }
            else if (ht === 'archer') { const k = (player.bladeComboStep || 1) - 1; style = ['slash', 'slashL', 'twin', 'twinSpin'][k]; dur = [0.32, 0.32, 0.42, 0.56][k]; }
            else if (ht === 'knight') { const k = (player.comboStep || 1) - 1; if (player.knightSword) { style = ['thrust', 'cross', 'spin', 'overhead'][k]; dur = [0.36, 0.42, 0.54, 0.64][k]; } else { style = ['clawR', 'clawL', 'clawX', 'clawRend'][k]; dur = [0.26, 0.26, 0.34, 0.48][k]; } }
            this.attack(P, style, dur);
            Sfx3D.play(style === 'heavy' ? 'heavy' : 'slash', style === 'heavy' ? 1 : 0.8);
            if (style === 'heavy') AnimFX.kick(1.2);
        }
        if (cast > 0 && (P.lastCast || 0) <= 0 && slash <= 0) {
            if (ht === 'archer' && !blades) { const k = (player.comboStep || 1) - 1; this.attack(P, ['bow', 'bow', 'bow2', 'bowPower'][k], [0.36, 0.36, 0.42, 0.62][k]); Sfx3D.play('whoosh'); }
            else { P.castN = ((P.castN || 0) % 4) + 1; this.attack(P, ['castR', 'castL', 'cast', 'castBig'][P.castN - 1], [0.42, 0.42, 0.48, 0.62][P.castN - 1]); }
        }
        P.lastSlash = slash; P.lastCast = cast;
        // Получил урон: вспышка и отшатывание
        if (P.lastHp !== undefined && player.hp < P.lastHp - 0.5) { P.flash = 0.7; P.hitT = 0.25; }
        P.lastHp = player.hp;
        P.flash = Math.max(0, (P.flash || 0) - dt * 4);
        const charging = ht === 'saber' && (player.excaliburChargeTime || 0) > 0;
        if (player.knightAnim && player.knightAnim !== P.kAnim) { P.kAnim = player.knightAnim; this.attack(P, player.knightAnim.kind, player.knightAnim.t); }
        const cine = typeof Cinema !== 'undefined' ? Cinema.heroPose() : null;
        this.animate(P, dt, px, pz, { face: Math.PI / 2 - player.facingAngle, hold: cine ? cine.hold : (charging ? 'raise' : (player.knightRend ? 'rend' : null)), alt: player.charId === 'mordred' && (player.avalonBuffTimer || 0) > 0, bigBlade: ht === 'saber' && (player.avalonBuffTimer || 0) > 0 ? 0.9 : (charging ? 0.35 : 0),
            vis: P.rig.kind === 'mdx' && P.rig.mdx.modelName === 'archer' ? (player.archerStance === 'blades' ? { 1: true, 2: false } : { 1: false, 2: true }) : null });
        // Ульта рыцаря: левитация и судороги, пока он разрывает себя
        P.root.position.y = cine ? this.spring(P, 'cineY', cine.y, dt, 6) : (player.knightRend ? Math.min(0.7, player.knightRend.t * 0.3) + Math.sin(Engine3D.t * 37) * 0.02 : 0);
        // Переход формы/стойки: импульс масштаба, оружие «проявляется»
        let wScale = 1;
        if (P.trans > 0) {
            P.trans = Math.max(0, P.trans - dt); const k = 1 - P.trans / P.transD;
            P.root.scale.setScalar(1.08 * (1 + 0.14 * Math.sin(k * Math.PI) * (1 - k)));
            wScale = Math.max(0.01, this.ease.back(Math.min(1, k * 1.4)));
        } else P.root.scale.setScalar(1.08);
        if (P.rig.offhand) P.rig.offhand.scale.setScalar(wScale);
        if (P.rig.weapon) P.rig.weapon.scale.setScalar(wScale * (ht === 'saber' && charging ? 1.25 + Math.sin(Engine3D.t * 10) * 0.04 : 1));
        P.aura.visible = (player.avalonBuffTimer || 0) > 0 || charging;
        if (P.aura.visible) { P.aura.material.color.setHex(saberRed() ? 0xff3040 : 0xffd070); P.aura.material.opacity = 0.5 + Math.sin(Engine3D.t * 4) * 0.2; P.aura.scale.setScalar(charging ? 2.6 : 1.8); }
        // Шлейфы оружия: серебристо-голубой у Сейбер (багровый у Альтер, золотой у Экскалибура), багровые у Арчера
        const heavy = P.atkStyle === 'heavy';
        const wp = P.rig.kind === 'mdx' ? MDX3D.bladePts(P.rig.mdx) : this.weaponPts(P.rig.weapon);
        if (wp) {
            // Фирменные градиенты: Сейбер — от чистого белого к жёлтому и золоту Экскалибура (Альтер — чёрно-багровый),
            // Рыцарь — густая кровь, Арчер — чёрный клинок Канто (тьма и багрянец)
            const G = ht === 'saber' ? (player.saberAlter ? [0x1a0020, 0x8a1ab0, 0xff3a6a] : (player.charId === 'mordred' ? [0x5a0006, 0xff2a1a, 0xffe0b0] : [0xb8860b, 0xffd23a, 0xffffff]))
                    : ht === 'knight' ? [0x1a0002, 0x8a0008, 0xff2a2a] : [0x100004, 0x7a0a14, 0xff4050];
            AnimFX.trail(P, wp[0], wp[1], 0, heavy ? { grad: G, life: 0.42, len: 36, fullSpeed: 12, sparks: 0.9, inner: 0.15 } : { grad: G, life: 0.22, sparks: ht === 'saber' ? 0.6 : 0.25, inner: 0.25 });
        }
        if (P.rig.claws && P.atkStyle && P.atkStyle.startsWith('claw')) P.rig.claws.forEach((c, i) => {
            c.updateWorldMatrix(true, false);
            for (let k = 0; k < 3; k++) {   // три параллельных кровавых росчерка — от каждого когтя
                const x = (k - 1) * 0.022, b = new THREE.Vector3(x, -0.06, 0.02).applyMatrix4(c.matrixWorld), tp = new THREE.Vector3(x, -0.15, 0.06).applyMatrix4(c.matrixWorld);
                AnimFX.trail(c.uuid + k, b, tp, 0, { grad: [0x2a0002, 0xa0000c, 0xff3a3a], life: 0.3, minSpeed: 1.5, inner: 0, len: 22 });
            }
        });
        const op = this.weaponPts(P.rig.offhand);
        if (op) AnimFX.trail(P.rig.offhand, op[0], op[1], 0, { grad: [0x3a5070, 0xc8d8f0, 0xffffff], life: 0.22, sparks: 0.3 }); // белый клинок Бакуя — серебристо-голубой след
        if (P.rig.orbs) {
            const ORB = { q: 0x38bdf8, w: 0xc084fc, e: 0xfb923c };
            P.rig.orbs.forEach((o, i) => {
                const a = Engine3D.t * 2.2 + i * Math.PI * 2 / 3;
                o.position.set(Math.cos(a) * 0.42, 1.45 + Math.sin(Engine3D.t * 3 + i) * 0.06, Math.sin(a) * 0.42);
                const c = ORB[(player.activeOrbs || [])[i]] || 0xffffff;
                o.userData.core.material.color.setHex(c); o.userData.core.material.emissive.setHex(c); o.userData.gl.material.color.setHex(c);
                const wpos = o.getWorldPosition(new THREE.Vector3());
                AnimFX.trail(o, wpos.clone().add(new THREE.Vector3(0, -0.05, 0)), wpos.clone().add(new THREE.Vector3(0, 0.05, 0)), c, { always: true, life: 0.3, len: 18, core: 0.3 });
            });
        }

        // ---------- монстры и боссы ----------
        const seen = new Set();
        for (const en of enemies) {
            const ex = en.x / T, ez = en.y / T;
            if (Math.abs(ex - px) > 30 || Math.abs(ez - pz) > 26 || (ez >= hellRow) !== playerHell) continue;
            let a = this.map.get(en);
            const dead = en.deadTimer > 0;
            if (!a) {
                if (dead) continue;
                const ring = en.isBoss ? 0xff2a2a : (en.tpl && en.tpl.miniBoss ? 0xff7a1a : (en.rare ? 0xc060ff : (en.elite ? 0xffd040 : null)));
                const mxe = en.type === 'saber_shadow' && typeof MDX3D !== 'undefined' ? MDX3D.create('saber_alter', { height: 1.25 }) : null;
                const m = mxe ? { root: mxe.root, rig: { kind: 'mdx', mdx: mxe, body: mxe.root } } : Models3D.enemy(en.type, en);
                a = this.make(m, ring);
                const sc = Math.max(0.7, Math.min(2.2, (en.radius || 16) / 16)) * (en.isBoss ? 1 : 1);
                a.base.scale.setScalar(sc);
                a.lastHp = en.hp; a.lastCd = en.attackCd || 0;
                this.map.set(en, a);
            }
            seen.add(en);
            if (dead) {
                if (a.dying === 0) a.dying = 0.0001;
                this.dyingPose(a, dt, en);
                a.base.visible = a.dying < 1.2;
                continue;
            } else if (a.dying > 0) { a.dying = 0; a.dust = false; a.rig.body.rotation.x = 0; a.root.position.y = 0; a.blob.visible = true; a.base.visible = true; a.lx = null; }
            if (en.hp < a.lastHp) {
                a.flash = 1; a.hitT = 0.25;
                if (Math.abs(ex - px) < 4 && Math.abs(ez - pz) < 4) { // брызги искр от удара
                    const c = this.heroColor(), hy = a.base.position.y + 0.6 * a.base.scale.x, dx = ex - px, dz = ez - pz, dl = Math.hypot(dx, dz) || 1;
                    AnimFX.emit({ x: ex, y: hy, z: ez, n: 14, color: [c, 0xffffff, 0xffe8a0], speed: 3.2, life: 0.35, size: 0.06, grav: 6, drag: 2, dir: [dx / dl, 0.4, dz / dl], spread: 1.6 });
                    AnimFX.shock(ex, hy, ez, c, 0.1, 0.5, 0.18, 0.7);
                    if (player.heroType === 'knight') { AnimFX.blood(ex, hy, ez, 22, dx / dl, dz / dl); if (!player.knightSword) this.clawScar(a, dx / dl, dz / dl); }
                }
            }
            a.lastHp = en.hp;
            if ((en.attackCd || 0) > a.lastCd + 0.05) {
                a.combo = (a.combo || 0) + 1;
                this.attack(a, a.rig.kind === 'biped' ? (a.combo % 2 ? 'slash' : 'slashB') : 'lunge', en.isBoss ? 0.7 : 0.5);
            }
            const big = en.isBoss || (en.tpl && en.tpl.miniBoss) || en.elite;
            if (big && a.atkStyle) { const wp = this.weaponPts(a.rig.weapon); if (wp) AnimFX.trail(a, wp[0], wp[1], /dracula|crimson|blood|vampire/.test(en.type) ? 0xff1a3a : (/hell|pit|infernal|ash|boss/.test(en.type) ? 0xff7a1a : 0xc0d0ff), { life: 0.22, core: 0.5 }); }
            a.lastCd = en.attackCd || 0;
            a.flash = Math.max(0, a.flash - dt * 5);
            const chasing = en.state === 'chase' || en.aggro;
            const face = (a.spd < 0.3 && chasing) ? Math.atan2(px - ex, pz - ez) : undefined;
            this.animate(a, dt, ex, ez, { face, frozen: (en.freezeTimer || 0) > 0 });
            if (a.ring) { a.ring.rotation.y += dt; a.ring.material.opacity = 0.55 + Math.sin(Engine3D.t * 4) * 0.25; }
            if (a.scars) for (let i = a.scars.length - 1; i >= 0; i--) { const sc = a.scars[i]; sc.t += dt; const k = 1 - sc.t / 2.5; if (k <= 0) { a.base.remove(sc.g); sc.g.children.forEach(m => m.material.dispose()); a.scars.splice(i, 1); continue; } sc.g.children.forEach(m => m.material.opacity = Math.min(1, k * 1.5)); sc.g.scale.y = Math.min(1, sc.t * 8); }
            a.base.visible = !en.hidden;
        }
        for (const [en, a] of this.map) if (!seen.has(en)) { this.drop(a); this.map.delete(en); }

        // ---------- NPC ----------
        for (const n of npcs) {
            const nx = n.x / T, nz = n.y / T;
            let a = this.npcMap.get(n);
            const near = Math.abs(nx - px) < 32 && Math.abs(nz - pz) < 28;
            if (!near) { if (a) { this.drop(a); this.npcMap.delete(n); } continue; }
            if (!a) { a = this.make(Models3D.npc(n), 0x60d0ff); a.ring.scale.setScalar(0.8); this.npcMap.set(n, a); }
            const d = Math.hypot(nx - px, nz - pz);
            this.animate(a, dt, nx, nz, { face: d < 6 ? Math.atan2(px - nx, pz - nz) : 0 });
        }
    }
};
