// ============================================================================
// МАТЕРИАЛЫ И ТЕКСТУРЫ: процедурные карты (цвет, нормали, шероховатость), PBR-материалы,
// контурный свет (rim), обводка персонажей (cel-outline), отражения окружения
// ============================================================================
// Всё генерируется на холстах при запуске: никаких внешних файлов, загрузка без CORS.

const Tex3D = {
    // ---------- бесшовный шум ----------
    hash(i, j, s) { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); },
    vnoise(x, y, P, s) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const w = (a) => ((a % P) + P) % P;
        const a = this.hash(w(xi), w(yi), s), b = this.hash(w(xi + 1), w(yi), s), c = this.hash(w(xi), w(yi + 1), s), d = this.hash(w(xi + 1), w(yi + 1), s);
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    },
    fbm(x, y, P, oct = 4, s = 1) { let f = 0, amp = 0.5, k = 1, n = 0; for (let o = 0; o < oct; o++) { f += amp * this.vnoise(x * k, y * k, P * k, s + o * 13); n += amp; amp *= 0.5; k *= 2; } return f / n; },

    // Построить карту высот size×size функцией h(u, v) ∈ [0..1] (u, v — в пикселях)
    heights(size, fn) { const H = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = fn(x, y); return H; },
    // Карта нормалей из высот (бесшовно)
    normal(H, size, strength) {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
        const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            let nx = (at(x - 1, y) - at(x + 1, y)) * strength, ny = (at(x, y - 1) - at(x, y + 1)) * strength, nz = 1;
            const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
            const o = (y * size + x) * 4; d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return this.tex(c, false);
    },
    // Цветная/серая карта по функции col(x, y) → [r, g, b] (0..1)
    paint(size, fn, srgb = true) {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const v = fn(x, y), o = (y * size + x) * 4;
            d[o] = Math.max(0, Math.min(255, v[0] * 255)); d[o + 1] = Math.max(0, Math.min(255, v[1] * 255)); d[o + 2] = Math.max(0, Math.min(255, v[2] * 255)); d[o + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return this.tex(c, srgb);
    },
    tex(canvas, srgb) {
        const t = new THREE.CanvasTexture(canvas);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (srgb) t.encoding = THREE.sRGBEncoding;
        t.anisotropy = Engine3D.renderer ? Math.min(8, Engine3D.renderer.capabilities.getMaxAnisotropy()) : 1;
        return t;
    },

    build() {
        const T = this.T = {}, S = 256, f = (x, y, P, o, s) => this.fbm(x, y, P, o, s);
        // Ткань: переплетение нитей, швы
        let H = this.heights(S, (x, y) => {
            const wx = Math.sin(x / S * Math.PI * 2 * 48), wy = Math.sin(y / S * Math.PI * 2 * 48);
            const weave = ((Math.floor(x / S * 48) + Math.floor(y / S * 48)) % 2 ? wx : wy) * 0.5 + 0.5;
            const seam = (Math.abs((y % 128) - 64) < 1.5 ? -0.6 : 0) + (Math.abs((x % 128) - 2) < 1.2 ? -0.4 : 0);
            return weave * 0.45 + f(x / 32, y / 32, 8, 3, 3) * 0.55 + seam;
        });
        T.clothN = this.normal(H, S, 2.2);
        T.cloth = this.paint(S, (x, y) => { const v = 0.82 + H[y * S + x] * 0.18 - f(x / 64, y / 64, 4, 3, 9) * 0.12; return [v, v, v]; });
        // Кожа (выделанная): зерно и потёртости
        H = this.heights(S, (x, y) => f(x / 6, y / 6, 42.666, 3, 21) * 0.6 + f(x / 40, y / 40, 6.4, 3, 22) * 0.4);
        T.leatherN = this.normal(H, S, 3.5);
        T.leather = this.paint(S, (x, y) => { const v = 0.72 + H[y * S + x] * 0.3; return [v, v * 0.97, v * 0.94]; });
        // Металл: шлифовка, царапины, потёртости по краям
        const scratch = new Float32Array(S * S);
        for (let i = 0; i < 160; i++) {
            let x = Math.random() * S, y = Math.random() * S; const a = Math.random() * Math.PI, len = 10 + Math.random() * 60;
            for (let k = 0; k < len; k++) { x += Math.cos(a); y += Math.sin(a); const xi = ((Math.floor(x) % S) + S) % S, yi = ((Math.floor(y) % S) + S) % S; scratch[yi * S + xi] = 1; }
        }
        H = this.heights(S, (x, y) => f(x / 2, y / 40, 128, 2, 31) * 0.3 + f(x / 50, y / 50, 5.12, 3, 32) * 0.4 - scratch[y * S + x] * 0.5);
        T.metalN = this.normal(H, S, 1.6);
        T.metalR = this.paint(S, (x, y) => { const v = 0.55 + f(x / 30, y / 30, 8.53, 4, 33) * 0.45 + scratch[y * S + x] * 0.35; return [v, v, v]; }, false);
        T.metal = this.paint(S, (x, y) => { const v = 0.85 + f(x / 24, y / 24, 10.66, 3, 34) * 0.15 - scratch[y * S + x] * 0.05; return [v, v, v]; });
        // Камень: кладка из блоков, швы, сколы
        const brick = (x, y) => { const row = Math.floor(y / 32), off = row % 2 ? 32 : 0, bx = Math.floor((x + off) / 64), lx = (x + off) % 64, ly = y % 32; return { id: bx * 7 + row * 13, edge: Math.min(lx, 64 - lx, ly, 32 - ly) }; };
        H = this.heights(S, (x, y) => { const b = brick(x, y); const mortar = Math.min(1, b.edge / 3); return mortar * (0.6 + f(x / 10, y / 10, 25.6, 4, 41 + (b.id % 5)) * 0.4); });
        T.stoneN = this.normal(H, S, 4);
        T.stone = this.paint(S, (x, y) => { const b = brick(x, y); const tone = 0.7 + this.hash(b.id, 3, 5) * 0.25; const v = (b.edge < 2 ? 0.45 : tone) * (0.85 + f(x / 16, y / 16, 16, 3, 44) * 0.25); return [v, v * 0.98, v * 0.96]; });
        // Кора деревьев: вертикальные борозды
        H = this.heights(S, (x, y) => { const r = f(x / 6, y / 40, 42.666, 3, 51); return Math.pow(Math.abs(Math.sin(x / S * Math.PI * 2 * 9 + r * 6)), 0.6) * 0.6 + r * 0.4; });
        T.barkN = this.normal(H, S, 4.5);
        T.bark = this.paint(S, (x, y) => { const v = 0.45 + H[y * S + x] * 0.55; return [v, v * 0.9, v * 0.8]; });
        // Листва и мех
        H = this.heights(S, (x, y) => f(x / 8, y / 8, 32, 4, 61));
        T.leafN = this.normal(H, S, 3);
        T.leaf = this.paint(S, (x, y) => { const v = 0.6 + H[y * S + x] * 0.5; return [v, v, v]; });
        H = this.heights(S, (x, y) => f(x / 1.5, y / 12, 170.66, 3, 71) * 0.7 + f(x / 20, y / 20, 12.8, 2, 72) * 0.3);
        T.furN = this.normal(H, S, 3);
        T.fur = this.paint(S, (x, y) => { const v = 0.7 + H[y * S + x] * 0.4; return [v, v, v]; });
        // Кожа персонажей: еле заметные поры
        H = this.heights(128, (x, y) => this.fbm(x / 4, y / 4, 32, 2, 81));
        T.skinN = this.normal(H, 128, 0.6);
        // Земля (512): мелкие камешки, комья, травинки — умножается на цвет тайла
        const G = 512;
        H = this.heights(G, (x, y) => { const p = f(x / 7, y / 7, 73.14, 3, 91), big = f(x / 64, y / 64, 8, 3, 92); return p * 0.55 + big * 0.45 + (p > 0.72 ? 0.25 : 0); });
        T.groundN = this.normal(H, G, 3);
        T.ground = this.paint(G, (x, y) => { const v = 0.68 + H[y * G + x] * 0.45; return [v, v, v * 0.96]; });
        // Облака и лужи (по одной бесшовной маске; данные остаются в памяти для рябью на лужах)
        this.cloudData = this.heights(S, (x, y) => f(x / 48, y / 48, 5.333, 5, 101));
        T.clouds = this.paint(S, (x, y) => { const v = this.cloudData[y * S + x]; return [v, v, v]; }, false);
        // Туман у земли
        T.fog = this.paint(128, (x, y) => { const v = this.fbm(x / 24, y / 24, 5.333, 4, 111); return [v, v, v]; }, false);
        // Вода: рябь
        H = this.heights(S, (x, y) => f(x / 12, y / 12, 21.33, 4, 121));
        T.waterN = this.normal(H, S, 5);
        [T.cloth, T.clothN].forEach(t => t.repeat.set(2, 2));
        return T;
    },
    // Есть ли лужа в точке мира (для ряби от капель)
    puddleAt(x, z) {
        if (!this.cloudData) return false;
        const S = 256, u = ((x * 0.11 + 0.37) % 1 + 1) % 1, v = ((z * 0.11 + 0.37) % 1 + 1) % 1;
        return this.cloudData[Math.floor(v * S) * S + Math.floor(u * S)] > 0.6;
    }
};

// ---------- PBR-материалы по типу поверхности ----------
G3.KIND = {
    metal:   { metalness: 0.8, roughness: 0.48, n: 'metalN', rm: 'metalR', map: 'metal', ns: 0.6, env: 0.85 },
    gold:    { metalness: 1.0, roughness: 0.36, n: 'metalN', rm: 'metalR', ns: 0.4, env: 1.1 },
    dark:    { metalness: 0.7, roughness: 0.5, n: 'metalN', rm: 'metalR', map: 'metal', ns: 0.8, env: 0.9 },
    cloth:   { metalness: 0, roughness: 0.92, n: 'clothN', map: 'cloth', ns: 0.9, env: 0.35 },
    leather: { metalness: 0, roughness: 0.62, n: 'leatherN', map: 'leather', ns: 0.7, env: 0.5 },
    skin:    { metalness: 0, roughness: 0.55, n: 'skinN', ns: 0.4, env: 0.4 },
    bone:    { metalness: 0, roughness: 0.68, n: 'leatherN', ns: 0.35, env: 0.5 },
    fur:     { metalness: 0, roughness: 0.96, n: 'furN', map: 'fur', ns: 1.0, env: 0.25 },
    wood:    { metalness: 0, roughness: 0.86, n: 'barkN', map: 'bark', ns: 1.0, env: 0.3 },
    stone:   { metalness: 0, roughness: 0.9, n: 'stoneN', map: 'stone', ns: 1.0, env: 0.35 },
    rock:    { metalness: 0, roughness: 0.93, n: 'leafN', ns: 1.2, env: 0.3 },
    leaf:    { metalness: 0, roughness: 0.8, n: 'leafN', map: 'leaf', ns: 0.9, env: 0.3 },
    gem:     { metalness: 0.2, roughness: 0.12, env: 1.8 },
    plain:   { metalness: 0, roughness: 0.7, env: 0.5 }
};
G3.mat = function (color, opts) {
    const o = Object.assign({}, opts || {}), unique = !!o.unique, kind = o.k || (o.flatShading ? 'rock' : 'plain');
    delete o.unique; delete o.k; delete o.flatShading;
    const key = color + '|' + kind + '|' + JSON.stringify(o);
    if (!unique) { const c = G3.matCache.get(key); if (c) return c; }
    const K = G3.KIND[kind] || G3.KIND.plain, T = Tex3D.T || {};
    const p = { color: new THREE.Color(color), metalness: K.metalness, roughness: K.roughness, envMapIntensity: K.env };
    if (K.n && T[K.n]) { p.normalMap = T[K.n]; p.normalScale = new THREE.Vector2(K.ns, K.ns); }
    if (K.rm && T[K.rm]) p.roughnessMap = T[K.rm];
    if (K.map && T[K.map]) p.map = T[K.map];
    const m = new THREE.MeshStandardMaterial(Object.assign(p, o));
    if (!unique) { m.userData.cached = true; G3.matCache.set(key, m); }
    return m;
};

// ---------- Контурный свет (rim light): персонажи «отделяются» от тёмного фона ----------
G3.rim = { color: { value: new THREE.Color(0x9fc0ff) }, strength: { value: 0.9 } };
G3.rimify = function (m) {
    if (!m || !m.isMeshStandardMaterial || m.userData.rim) return m;
    m.userData.rim = true;
    m.onBeforeCompile = sh => {
        sh.uniforms.rimColor = G3.rim.color; sh.uniforms.rimStrength = G3.rim.strength;
        sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace('#include <output_fragment>',
            `float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
            outgoingLight += rimColor * pow(rimF, 2.6) * rimStrength;
            #include <output_fragment>`);
    };
    m.customProgramCacheKey = () => 'rim';
    m.needsUpdate = true;
    return m;
};

// ---------- Обводка (cel-outline): выдавленная оболочка с обратными гранями ----------
G3.outline = { width: { value: 0.022 } };
G3.outlineMat = null;
G3.getOutlineMat = function () {
    if (G3.outlineMat) return G3.outlineMat;
    const m = new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.BackSide });
    m.onBeforeCompile = sh => {
        sh.uniforms.outlineW = G3.outline.width;
        sh.vertexShader = 'uniform float outlineW;\n' + sh.vertexShader.replace('#include <begin_vertex>',
            'vec3 transformed = position + normalize(normal) * outlineW / max(0.001, length(modelMatrix[0].xyz));');
    };
    m.customProgramCacheKey = () => 'outline';
    return (G3.outlineMat = m);
};

// ---------- Отражения окружения: небо по зоне → PMREM ----------
G3.envCache = {};
G3.envFor = function (renderer, mode) {
    if (G3.envCache[mode]) return G3.envCache[mode];
    const P = {
        day:    [0x9ab8d8, 0x5a6a70, 0x2a2418, 0xfff0d0],
        night:  [0x1a2440, 0x101420, 0x080808, 0x9fb4ff],
        hell:   [0x5a1206, 0x3a0a04, 0x100202, 0xff7a3a],
        castle: [0x3a1430, 0x1c1020, 0x080608, 0xff4a5a]
    }[mode] || [0x9ab8d8, 0x5a6a70, 0x2a2418, 0xfff0d0];
    const sc = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16), col = [], pos = geo.attributes.position, c = new THREE.Color(), top = new THREE.Color(P[0]), hor = new THREE.Color(P[1]), bot = new THREE.Color(P[2]);
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 3)); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(P[3]).multiplyScalar(4) }));
    sun.position.set(-5, 6, -4); sc.add(sun);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.02);
    pm.dispose(); geo.dispose();
    return (G3.envCache[mode] = rt.texture);
};
