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
        // Все «персонажные» карты — 512×512: волокна, поры, царапины. Затенение в углублениях (AO) запекается в цвет.
        const S2 = 512, f2 = (x, y, P, o, sd) => this.fbm(x, y, P, o, sd);
        const ao = (H, i, k = 1) => 1 - Math.max(0, 0.5 - H[i]) * 0.9 * k;
        // Ткань: нити основы и утка, волокна-ворсинки, швы со стежками
        let H = this.heights(S2, (x, y) => {
            const n = 96, u = x / S2 * n, v = y / S2 * n, cu = Math.floor(u), cv = Math.floor(v);
            const over = (cu + cv) % 2 === 0;
            const thread = over ? Math.sin((u - cu) * Math.PI) : Math.sin((v - cv) * Math.PI);
            const jitter = this.hash(cu, cv, 7) * 0.25;
            const fiber = this.fbm(x / 1.2, y / 9, 426.6, 2, 3) * 0.25;
            const seamY = Math.abs((y % 256) - 128) < 2 ? -0.7 : 0, stitch = Math.abs((y % 256) - 132) < 1.5 && (x % 10) < 5 ? 0.35 : 0;
            return thread * 0.55 + jitter + fiber + seamY + stitch;
        });
        T.clothN = this.normal(H, S2, 2.6);
        T.cloth = this.paint(S2, (x, y) => { const i = y * S2 + x, v = (0.8 + H[i] * 0.16 - f2(x / 90, y / 90, 5.68, 3, 9) * 0.14) * ao(H, i); return [v, v, v]; });
        // Кожа (выделанная): зерно, складки, светлые потёртости на рукоятях и сгибах, строчка
        H = this.heights(S2, (x, y) => f2(x / 5, y / 5, 102.4, 3, 21) * 0.45 + f2(x / 60, y / 14, 8.53, 3, 22) * 0.4 + (Math.abs((x % 128) - 6) < 1.2 && (y % 12) < 7 ? 0.3 : 0));
        T.leatherN = this.normal(H, S2, 3.8);
        T.leather = this.paint(S2, (x, y) => { const i = y * S2 + x, wear = Math.max(0, f2(x / 70, y / 70, 7.3, 3, 23) - 0.55) * 1.6; const v = (0.68 + H[i] * 0.28 + wear * 0.45) * ao(H, i); return [v, v * 0.96, v * 0.92]; });
        // Металл: шлифовка, сеть тонких царапин, вмятины, износ — плюс карты шероховатости и металличности
        const scratch = new Float32Array(S2 * S2);
        for (let i = 0; i < 520; i++) {
            let x = Math.random() * S2, y = Math.random() * S2; const a = Math.random() * Math.PI, len = 8 + Math.random() * 90, deep = 0.4 + Math.random() * 0.6;
            for (let k = 0; k < len; k++) { x += Math.cos(a); y += Math.sin(a); const xi = ((Math.floor(x) % S2) + S2) % S2, yi = ((Math.floor(y) % S2) + S2) % S2; scratch[yi * S2 + xi] = Math.max(scratch[yi * S2 + xi], deep); }
        }
        H = this.heights(S2, (x, y) => { const i = y * S2 + x; return f2(x / 1.5, y / 60, 341.3, 2, 31) * 0.22 + f2(x / 70, y / 70, 7.31, 3, 32) * 0.4 - scratch[i] * 0.45 - Math.max(0, f2(x / 30, y / 30, 17.06, 2, 35) - 0.7) * 1.2; });
        T.metalN = this.normal(H, S2, 1.8);
        T.metalR = this.paint(S2, (x, y) => { const i = y * S2 + x; const v = 0.5 + f2(x / 40, y / 40, 12.8, 4, 33) * 0.4 + scratch[i] * 0.3; return [v, v, v]; }, false);
        T.metalM = this.paint(S2, (x, y) => { const i = y * S2 + x, dirt = Math.max(0, f2(x / 50, y / 50, 10.24, 3, 36) - 0.6) * 2.2; const v = Math.max(0.35, 1 - dirt - scratch[i] * 0.15); return [v, v, v]; }, false);
        T.metal = this.paint(S2, (x, y) => { const i = y * S2 + x, dirt = Math.max(0, f2(x / 50, y / 50, 10.24, 3, 36) - 0.6) * 1.6; const v = (0.86 + f2(x / 24, y / 24, 21.33, 3, 34) * 0.14 + scratch[i] * 0.08 - dirt * 0.35) * ao(H, i, 0.6); return [v, v * 0.99, v * 0.97]; });
        // Камень: кладка, сколы по краям блоков, трещины, мох в швах
        const brick = (x, y) => { const row = Math.floor(y / 64), off = row % 2 ? 64 : 0, bx = Math.floor((x + off) / 128), lx = (x + off) % 128, ly = y % 64; return { id: bx * 7 + row * 13, edge: Math.min(lx, 128 - lx, ly, 64 - ly) }; };
        H = this.heights(S2, (x, y) => { const b = brick(x, y); const chip = f2(x / 9, y / 9, 56.9, 3, 45) * 6; const mortar = Math.min(1, Math.max(0, b.edge - chip * 0.6) / 5); const crack = Math.abs(f2(x / 40, y / 40, 12.8, 3, 46 + (b.id % 7)) - 0.5) < 0.012 ? -0.4 : 0; return mortar * (0.55 + f2(x / 14, y / 14, 36.57, 4, 41 + (b.id % 5)) * 0.45) + crack; });
        T.stoneN = this.normal(H, S2, 4.5);
        T.stone = this.paint(S2, (x, y) => { const b = brick(x, y), i = y * S2 + x; const tone = 0.68 + this.hash(b.id, 3, 5) * 0.26; const inMortar = H[i] < 0.2; const moss = inMortar && f2(x / 20, y / 20, 25.6, 2, 47) > 0.55; const v = (inMortar ? 0.42 : tone) * (0.85 + f2(x / 20, y / 20, 25.6, 3, 44) * 0.25) * ao(H, i); return moss ? [v * 0.7, v * 0.95, v * 0.55] : [v, v * 0.98, v * 0.95]; });
        // Гравировка лат: филигранные завитки и окантовка (карта нормалей)
        {
            const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
            g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#2a2a2a'; g.lineCap = 'round';
            for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
                const cx = col * 128 + 64, cy = row * 128 + 64; g.lineWidth = 3;
                for (let s2 = -1; s2 <= 1; s2 += 2) { g.beginPath(); for (let k = 0; k < 60; k++) { const a = k * 0.18, r = 4 + k * 0.75; const x = cx + s2 * Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
                g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 50, cy + 52); g.quadraticCurveTo(cx, cy + 30, cx + 50, cy + 52); g.stroke();
            }
            g.lineWidth = 6; g.strokeStyle = '#3a3a3a'; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); }
            const d = g.getImageData(0, 0, 512, 512).data, H2 = new Float32Array(512 * 512);
            for (let i = 0; i < H2.length; i++) H2[i] = d[i * 4] / 255 + this.fbm((i % 512) / 40, Math.floor(i / 512) / 40, 12.8, 2, 37) * 0.2;
            T.engraveN = this.normal(H2, 512, 3.5);
        }
        // Рваный край и прорехи плаща (карта прозрачности)
        {
            const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
            g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#000';
            g.beginPath(); g.moveTo(0, 256); for (let x = 0; x <= 256; x += 6) g.lineTo(x, 256 - 6 - Math.abs(Math.sin(x * 0.11)) * 22 - this.hash(x, 1, 9) * 26); g.lineTo(256, 256); g.fill();
            for (let i = 0; i < 9; i++) { const x = this.hash(i, 2, 4) * 240 + 8, y = 150 + this.hash(i, 3, 4) * 70; g.beginPath(); g.ellipse(x, y, 3 + this.hash(i, 5, 4) * 6, 2 + this.hash(i, 6, 4) * 5, this.hash(i, 7, 4) * 3, 0, 7); g.fill(); }
            T.capeA = this.tex(c, false); T.capeA.wrapS = T.capeA.wrapT = THREE.ClampToEdgeWrapping;
        }
        // Трещины в латах Павшего Рыцаря (карта свечения)
        {
            const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
            g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#ff2a20'; g.lineCap = 'round'; g.shadowColor = '#ff2a20'; g.shadowBlur = 6;
            let sd = 9; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
            const crack = (x, y, a, n, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < n; i++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (w > 1.2 && r() < 0.12) { g.stroke(); crack(x, y, a + (r() - 0.5) * 2, n * 0.5, w * 0.6); g.beginPath(); g.moveTo(x, y); g.lineWidth = w; } } g.stroke(); };
            for (let i = 0; i < 14; i++) crack(r() * 512, r() * 512, r() * 6.28, 14 + r() * 16, 2.6);
            T.knightGlow = this.tex(c, true);
        }
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
        // Кожа персонажей: поры, мелкие складки, лёгкий румянец и неравномерность тона
        H = this.heights(S2, (x, y) => { const pore = this.hash(Math.floor(x / 3), Math.floor(y / 3), 81) > 0.86 ? -0.5 : 0; return f2(x / 6, y / 6, 85.3, 2, 82) * 0.6 + pore * 0.4; });
        T.skinN = this.normal(H, S2, 1.1);
        T.skin = this.paint(S2, (x, y) => { const m = f2(x / 40, y / 40, 12.8, 3, 83), i = y * S2 + x; const v = 0.94 + H[i] * 0.06; return [v * (1 + (m - 0.5) * 0.06), v * (1 - (m - 0.5) * 0.04), v * (1 - (m - 0.5) * 0.05)]; });
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
        [T.cloth, T.clothN].forEach(t => t.repeat.set(1.5, 1.5));
        return T;
    },
    // Есть ли лужа в точке мира (для ряби от капель)
    puddleAt(x, z) {
        if (!this.cloudData) return false;
        const S = 256, u = ((x * 0.11 + 0.37) % 1 + 1) % 1, v = ((z * 0.11 + 0.37) % 1 + 1) % 1;
        return this.cloudData[Math.min(S - 1, Math.floor((1 - v) * S)) * S + Math.floor(u * S)] > 0.62;
    }
};

// ---------- PBR-материалы по типу поверхности ----------
G3.KIND = {
    metal:   { metalness: 0.85, roughness: 0.46, n: 'metalN', rm: 'metalR', mm: 'metalM', map: 'metal', ns: 0.6, env: 0.85 },
    gold:    { metalness: 1.0, roughness: 0.36, n: 'metalN', rm: 'metalR', mm: 'metalM', ns: 0.4, env: 1.1 },
    dark:    { metalness: 0.75, roughness: 0.5, n: 'metalN', rm: 'metalR', mm: 'metalM', map: 'metal', ns: 0.8, env: 0.9 },
    cloth:   { metalness: 0, roughness: 0.92, n: 'clothN', map: 'cloth', ns: 0.9, env: 0.35 },
    leather: { metalness: 0, roughness: 0.62, n: 'leatherN', map: 'leather', ns: 0.7, env: 0.5 },
    skin:    { metalness: 0, roughness: 0.52, n: 'skinN', map: 'skin', ns: 0.35, env: 0.4 },
    bone:    { metalness: 0, roughness: 0.68, n: 'leatherN', ns: 0.35, env: 0.5 },
    fur:     { metalness: 0, roughness: 0.96, n: 'furN', map: 'fur', ns: 1.0, env: 0.25 },
    wood:    { metalness: 0, roughness: 0.86, n: 'barkN', map: 'bark', ns: 1.0, env: 0.3 },
    stone:   { metalness: 0, roughness: 0.9, n: 'stoneN', map: 'stone', ns: 1.0, env: 0.35 },
    rock:    { metalness: 0, roughness: 0.93, n: 'leafN', ns: 1.2, env: 0.3 },
    leaf:    { metalness: 0, roughness: 0.8, n: 'leafN', map: 'leaf', ns: 0.9, env: 0.3 },
    gem:     { metalness: 0.2, roughness: 0.12, env: 1.8 },
    engraved: { metalness: 0.85, roughness: 0.4, n: 'engraveN', rm: 'metalR', mm: 'metalM', map: 'metal', ns: 1.1, env: 0.95 },
    engravedGold: { metalness: 1.0, roughness: 0.32, n: 'engraveN', rm: 'metalR', ns: 1.0, env: 1.1 },
    cape:    { metalness: 0, roughness: 0.92, n: 'clothN', map: 'cloth', ns: 0.9, env: 0.3, alpha: 'capeA' },
    knightPlate: { metalness: 0.75, roughness: 0.5, n: 'engraveN', rm: 'metalR', map: 'metal', ns: 0.7, env: 0.6, glow: 'knightGlow' },
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
    if (K.mm && T[K.mm]) p.metalnessMap = T[K.mm];
    if (K.alpha && T[K.alpha]) { p.alphaMap = T[K.alpha]; p.alphaTest = 0.5; }
    if (K.glow && T[K.glow]) { p.emissiveMap = T[K.glow]; p.emissive = new THREE.Color(0xff2a20); p.emissiveIntensity = 2.2; }
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

// ---------- Развевающиеся плащи: волна по ткани в вершинном шейдере ----------
G3.cape = { t: { value: 0 }, wind: { value: 0.4 } };
G3.capeify = function (m) {
    if (!m || m.userData.cape) return m;
    m.userData.cape = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        sh.uniforms.capeT = G3.cape.t; sh.uniforms.capeWind = G3.cape.wind;
        sh.vertexShader = 'uniform float capeT, capeWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            float ck = clamp(-position.y / 0.8, 0.0, 1.0); ck *= ck;
            transformed.z -= (sin(capeT * 3.1 + position.y * 7.0 + position.x * 6.0) * 0.045 + sin(capeT * 5.3 + position.x * 11.0) * 0.015) * ck * (0.6 + capeWind);
            transformed.x += sin(capeT * 2.2 + position.y * 5.0) * 0.02 * ck * (0.6 + capeWind);`);
    };
    m.customProgramCacheKey = () => (m.userData.rim ? 'rim' : '') + 'cape';
    m.needsUpdate = true;
    return m;
};
