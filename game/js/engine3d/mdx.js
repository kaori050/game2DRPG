// ============================================================================
// ПРОИГРЫВАТЕЛЬ МОДЕЛЕЙ WARCRAFT 3 (MDX → JSON, см. js/models/*.js)
// ============================================================================
// Кости с ключевыми кадрами (перенос/поворот/масштаб, линейная/эрмитова/безье интерполяция, глобальные
// последовательности), скиннинг «группами матриц» как в WC3, видимость частей (GEOA), родные анимации модели.
const MDX3D = {
    texCache: {},
    // Действие игры → имя анимации в модели (у каждой модели свои имена)
    ANIMS: {
        mordred: { idle: 'Stand', walk: 'walk', thrust: 'attack 1', slash: 'attack 1', cross: 'attack 2', slashB: 'attack 2', spin: 'spell one', overhead: 'spell', heavy: 'spell', cast: 'spell', raise: 'spell channel', kneel: 'spell channel', rise: 'spell ready', plunge: 'attack 2', stance: 'spell ready', death: 'death' },
        saber: { idle: 'Stand', walk: 'Walk', thrust: 'Attack - 1', slash: 'Attack - 1', cross: 'Attack - 2', slashB: 'Attack - 2', spin: 'Spell One', overhead: 'Spell Two', heavy: 'Spell Four', cast: 'Spell Three', raise: 'Stand Ready', kneel: 'Stand Ready', rise: 'Stand Ready', plunge: 'Spell Two', stance: 'Stand Ready', death: 'Death' },
        saber_alter: { idle: 'Stand', walk: 'Walk', thrust: 'Attack 1', slash: 'Attack 1', cross: 'Attack 2', slashB: 'Attack 2', spin: 'Attack 3', overhead: 'Attack 4', heavy: 'Spell Four', cast: 'Spell One', raise: 'Spell Three', kneel: 'Stand', rise: 'Morph', plunge: 'Spell Slam', stance: 'Stand', death: 'Death' },
        elizabeth: { idle: 'stand', walk: 'walk', castR: 'attack - 1', castL: 'attack - 2', cast: 'attack - 3', castBig: 'attack - 3', slash: 'attack - 1', thrust: 'attack - 1', cross: 'attack - 2', spin: 'attack - 3', overhead: 'spell - 1',
            spell1: 'spell - 1', channel: 'spell channel', ultcast: 'spell - 2', raise: 'spell channel', kneel: 'stand ready', rise: 'stand ready', plunge: 'spell - 1', stance: 'stand ready', pray: 'spell - 1', craft: 'attack - 1', death: 'death' },
        archer: { idle: 'Stand', walk: 'Walk', bow: 'Spell Throw', bow2: 'Spell Throw', bowPower: 'Spell Throw', slash: 'Attack 1', slashL: 'Attack 2', twin: 'Attack Slam', twinSpin: 'Spell Slam', cast: 'Spell Two', throw: 'Spell Throw', raise: 'Spell Gold', kneel: 'Stand', rise: 'Stand', bowUp: 'Spell Gold', stance: 'Stand', death: 'Death' }
    },
    // Матрица перехода из осей WC3 (X — вперёд, Y — влево, Z — вверх) в оси движка (Y — вверх, Z — вперёд)
    AXES: null,
    create(name, opts = {}) {
        const D = (window.MDX_MODELS || {})[name]; if (!D) return null;
        if (!this.AXES) this.AXES = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
        const root = new THREE.Group(), axes = new THREE.Group(); axes.matrixAutoUpdate = false; axes.matrix.copy(this.AXES);
        // Рост модели берём из габаритов стойки: приводим к ~1.15 тайла
        const ext = D.sequences[0].extent, height = Math.max(50, ext[6] - ext[3]);
        const sc = (opts.height || 1.2) / height; axes.matrix.premultiply(new THREE.Matrix4().makeScale(sc, sc, sc));
        root.add(axes);
        const inst = { modelName: name, D, root, axes, meshes: [], world: [], seq: 0, time: D.sequences[0].start, gtime: 0, rate: 1, loop: true, done: false, mats: [] };
        // Текстуры (цвет команды — красный)
        const tex = D.textures.map((t, i) => {
            if (t.repl || t.missing) return null;
            const key = name + i; if (this.texCache[key]) return this.texCache[key];
            const tx = new THREE.TextureLoader().load(t.png); tx.flipY = false; tx.wrapS = tx.wrapT = THREE.RepeatWrapping;   // WC3 повторяет текстуры за пределами 0..1 tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8;
            return (this.texCache[key] = tx);
        });
        const team = opts.team || 0xb01020;
        D.geosets.forEach((G, gi) => {
            const n = G.pos.length / 3, g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G.pos), 3).setUsage(THREE.DynamicDrawUsage));
            g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(G.nrm), 3).setUsage(THREE.DynamicDrawUsage));
            g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(G.uv), 2));
            g.setIndex(G.idx);
            const L = (D.materials[G.mat] || { layers: [{ filter: 0, tex: 0 }] }).layers[0];
            const map = tex[L.tex];
            const p = { roughness: 0.62, metalness: 0.25, envMapIntensity: 0.6, side: THREE.DoubleSide };
            const T = D.textures[L.tex] || {};
            // Нет текстуры: цвет команды или «свечение» по имени встроенной текстуры WC3
            if (map) p.map = map; else p.color = new THREE.Color(T.missing ? (/purple/i.test(T.file) ? 0x9a3aff : /red/i.test(T.file) ? 0xff2a2a : /blue/i.test(T.file) ? 0x3a8aff : 0xffffff) : team);
            if (L.filter === 1) { p.alphaTest = 0.5; p.transparent = false; }
            else if (L.filter >= 2) { p.transparent = true; p.depthWrite = false; if (L.filter === 3 || L.filter === 4) p.blending = THREE.AdditiveBlending; }
            const m = new THREE.MeshStandardMaterial(p);
            if (L.filter === 3 || L.filter === 4) m.emissive = new THREE.Color(0xffffff), m.emissiveMap = map || null, m.emissiveIntensity = 1;
            const mesh = new THREE.Mesh(g, m); mesh.castShadow = L.filter < 2; mesh.receiveShadow = true; mesh.frustumCulled = false;
            mesh.userData.keep = true; mesh.userData.mdx = true;
            axes.add(mesh); inst.meshes.push({ index: gi, mesh, G, bind: new Float32Array(G.pos), bindN: new Float32Array(G.nrm), anim: D.geosetAnims.find(a => a.geoset === gi) });
            inst.mats.push(m);
        });
        // Точки клинка: самая вытянутая часть модели на одной кости (обычно меч); основание — у пивота кости, кончик — дальше всех
        let best = null, bestR = 0;
        D.geosets.forEach(G => {
            const bones = [...new Set(G.groups.flat())]; if (bones.length !== 1) return;
            const n = G.pos.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
            for (let k = 0; k < n; k++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], G.pos[k * 3 + a]); mx[a] = Math.max(mx[a], G.pos[k * 3 + a]); }
            const ext = mx.map((v, a) => v - mn[a]).sort((a, b) => b - a), r = ext[0] / Math.max(1, ext[1]);
            if (ext[0] > 50 && r > bestR) { bestR = r; best = { G, bone: bones[0] }; }
        });
        if (best && bestR > 3) {
            const piv = D.pivots[best.bone] || [0, 0, 0], G = best.G; let tip = null, tipD = -1;
            for (let k = 0; k < G.pos.length / 3; k++) { const x = G.pos[k * 3], y = G.pos[k * 3 + 1], z = G.pos[k * 3 + 2], d = Math.hypot(x - piv[0], y - piv[1], z - piv[2]); if (d > tipD) { tipD = d; tip = [x, y, z]; } }
            inst.blade = { node: best.bone, base: piv, tip };
        }
        this.play(inst, 'Stand');
        this.update(inst, 0);
        return inst;
    },
    // Найти последовательность по имени (без учёта регистра); alt — альтернативный набор
    find(inst, name, alt) {
        const S = inst.D.sequences, low = name.toLowerCase();
        const want = alt ? S.findIndex(s => s.name.toLowerCase().startsWith(low) && /alter|altrer/i.test(s.name)) : -1;
        if (want >= 0) return want;
        return S.findIndex(s => s.name.toLowerCase() === low || (s.name.toLowerCase().startsWith(low) && !/alter|altrer/i.test(s.name)));
    },
    play(inst, name, opts = {}) {
        const i = this.find(inst, name, opts.alt); if (i < 0) return false;
        if (i === inst.seq && !opts.restart && !inst.done) { inst.rate = opts.rate || inst.rate; return true; }
        const s = inst.D.sequences[i];
        if (inst.world.length) { inst.prev = { seq: inst.seq, time: inst.time }; inst.blend = 0; inst.blendDur = opts.blend !== undefined ? opts.blend : 0.18; }
        inst.seq = i; inst.time = s.start; inst.rate = opts.rate || 1; inst.loop = opts.loop !== undefined ? opts.loop : !(s.flags & 1); inst.done = false; inst.name = name;
        return true;
    },
    // ---------- выборка трека ----------
    sample(tr, t, s, size, def) {
        if (!tr) return def;
        let keys = tr.keys, time = t;
        if (tr.gs >= 0) { const len = this.cur.D.globalSeqs[tr.gs] || 0; time = len ? this.cur.gtime % len : 0; }
        else { keys = keys.filter(k => k.t >= s.start && k.t <= s.end); if (!keys.length) return def; }
        if (keys.length === 1 || time <= keys[0].t) return keys[0].v;
        const last = keys[keys.length - 1]; if (time >= last.t) return last.v;
        let a = 0; while (a < keys.length - 2 && keys[a + 1].t <= time) a++;
        const A = keys[a], B = keys[a + 1], f = (time - A.t) / Math.max(1, B.t - A.t);
        if (tr.interp === 0) return A.v;
        if (size === 4) { const qa = this.qa || (this.qa = new THREE.Quaternion()), qb = this.qb || (this.qb = new THREE.Quaternion()); qa.set(A.v[0], A.v[1], A.v[2], A.v[3]); qb.set(B.v[0], B.v[1], B.v[2], B.v[3]); qa.slerp(qb, f); return [qa.x, qa.y, qa.z, qa.w]; }
        const out = [];
        for (let i = 0; i < size; i++) {
            if (tr.interp === 1 || !A.o) out.push(A.v[i] + (B.v[i] - A.v[i]) * f);
            else if (tr.interp === 2) { const f2 = f * f, f3 = f2 * f; out.push(A.v[i] * (2 * f3 - 3 * f2 + 1) + A.o[i] * (f3 - 2 * f2 + f) + B.i[i] * (f3 - f2) + B.v[i] * (-2 * f3 + 3 * f2)); }
            else { const g = 1 - f; out.push(A.v[i] * g * g * g + 3 * A.o[i] * f * g * g + 3 * B.i[i] * f * f * g + B.v[i] * f * f * f); }
        }
        return out;
    },
    // ---------- кадр: кости → скиннинг → видимость частей ----------
    update(inst, dt) {
        const D = inst.D, s = D.sequences[inst.seq];
        inst.gtime += dt * 1000;
        inst.time += dt * 1000 * inst.rate;
        if (inst.time > s.end) { if (inst.loop) inst.time = s.start + (inst.time - s.end) % Math.max(1, s.end - s.start); else { inst.time = s.end; inst.done = true; } }
        this.cur = inst;
        // Плавная функция смешивания (ease in-out)
        let blendK = 1, prevT = 0, ps = s;
        if (inst.prev) {
            inst.blend += dt; const k = Math.min(1, inst.blend / Math.max(0.01, inst.blendDur)); blendK = k * k * (3 - 2 * k);
            ps = D.sequences[inst.prev.seq]; prevT = Math.min(ps.end, inst.prev.time += dt * 1000);
            if (k >= 1) inst.prev = null;
        }
        const v2 = new THREE.Vector3(), q2 = new THREE.Quaternion();
        const W = inst.world, done = new Uint8Array(D.nodes.length + 64), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), piv = new THREE.Vector3(), tmp = new THREE.Matrix4();
        const byId = inst.byId || (inst.byId = (() => { const o = {}; D.nodes.forEach(nd => o[nd.id] = nd); return o; })());
        const calc = id => {
            if (done[id]) return W[id];
            const nd = byId[id]; if (!nd) return (W[id] = new THREE.Matrix4());
            const tr = this.sample(nd.tr, inst.time, s, 3, [0, 0, 0]), rt = this.sample(nd.rot, inst.time, s, 4, [0, 0, 0, 1]), sl = this.sample(nd.sc, inst.time, s, 3, [1, 1, 1]);
            const p = D.pivots[id] || [0, 0, 0]; piv.set(p[0], p[1], p[2]);
            q.set(rt[0], rt[1], rt[2], rt[3]).normalize(); sc.set(sl[0], sl[1], sl[2]); v.set(tr[0], tr[1], tr[2]);
            if (blendK < 1) { // смешиваем с позой предыдущей анимации — без рывков при смене состояния
                const ptr = this.sample(nd.tr, prevT, ps, 3, [0, 0, 0]), prt = this.sample(nd.rot, prevT, ps, 4, [0, 0, 0, 1]), psl = this.sample(nd.sc, prevT, ps, 3, [1, 1, 1]);
                v.lerp(v2.set(ptr[0], ptr[1], ptr[2]), 1 - blendK); sc.lerp(v2.set(psl[0], psl[1], psl[2]), 1 - blendK);
                q2.set(prt[0], prt[1], prt[2], prt[3]).normalize(); q.copy(q2.slerp(q, blendK));
            }
            if (inst.boneScale && inst.boneScale.id === id) sc.multiplyScalar(inst.boneScale.s);   // увеличенный клинок
            v.add(piv);
            const L = (W[id] || (W[id] = new THREE.Matrix4())).compose(v, q, sc).multiply(tmp.makeTranslation(-piv.x, -piv.y, -piv.z));
            if (nd.parent >= 0 && byId[nd.parent]) L.premultiply(calc(nd.parent));
            done[id] = 1; return L;
        };
        D.nodes.forEach(nd => calc(nd.id));
        // Скиннинг: каждой группе вершин — среднее матриц её костей
        const e = new Float32Array(16);
        for (const M of inst.meshes) {
            const G = M.G, pos = M.mesh.geometry.attributes.position.array, nrm = M.mesh.geometry.attributes.normal.array;
            const gm = G.groups.map(list => { e.fill(0); for (const id of list) { const w = (W[id] || m.identity()).elements; for (let k = 0; k < 16; k++) e[k] += w[k]; } const inv = 1 / Math.max(1, list.length); return Array.from(e, x => x * inv); });
            for (let i = 0, n = G.grp.length; i < n; i++) {
                const a = gm[G.grp[i]]; if (!a) continue;
                const o = i * 3, x = M.bind[o], y = M.bind[o + 1], z = M.bind[o + 2];
                pos[o] = a[0] * x + a[4] * y + a[8] * z + a[12]; pos[o + 1] = a[1] * x + a[5] * y + a[9] * z + a[13]; pos[o + 2] = a[2] * x + a[6] * y + a[10] * z + a[14];
                const nx = M.bindN[o], ny = M.bindN[o + 1], nz = M.bindN[o + 2];
                let X = a[0] * nx + a[4] * ny + a[8] * nz, Y = a[1] * nx + a[5] * ny + a[9] * nz, Z = a[2] * nx + a[6] * ny + a[10] * nz; const l = Math.hypot(X, Y, Z) || 1;
                nrm[o] = X / l; nrm[o + 1] = Y / l; nrm[o + 2] = Z / l;
            }
            M.mesh.geometry.attributes.position.needsUpdate = true; M.mesh.geometry.attributes.normal.needsUpdate = true;
            // Видимость части в этой анимации
            if (M.anim) { const al = this.sample(M.anim.alphaTrack, inst.time, s, 1, [M.anim.alpha])[0]; M.mesh.visible = al > 0.05; }
            // Принудительная видимость частей (например, лук или клинки Арчера по стойке)
            if (inst.forceVis && inst.forceVis[M.index] !== undefined) M.mesh.visible = inst.forceVis[M.index];
        }
    },
    // Точки клинка в мире (для шлейфа)
    bladePts(inst) {
        const b = inst.blade; if (!b || !inst.world[b.node]) return null;
        inst.axes.updateWorldMatrix(true, false);
        const M = new THREE.Matrix4().multiplyMatrices(inst.axes.matrixWorld, inst.world[b.node]);
        return [new THREE.Vector3(...b.base).applyMatrix4(M), new THREE.Vector3(...b.tip).applyMatrix4(M)];
    }
};
