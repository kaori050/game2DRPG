// ============================================================================
// 3D-ДВИЖОК (Three.js): ядро — рендерер, камера в духе Warcraft 3, свет, туман, день/ночь, погода, выбор мышью
// ============================================================================
// Игровая логика (game.js) не меняется: движок каждый кадр читает её данные (worldMap, player, enemies,
// projectiles, particles, эффекты…) и рисует их в 3D. 1 тайл карты = 1 единица 3D-мира.
// Подключается обычным <script> (без ES-модулей), поэтому index.html открывается двойным кликом без ошибок CORS.

const G3 = {
    tile: 48,                   // пикселей логики в одном тайле (TILE_SIZE)
    toonRamp: null,
    matCache: new Map(),
    // Материал в духе Blizzard: мягкий toon с 4 ступенями света
    mat(color, opts) {
        const o = Object.assign({}, opts || {}), unique = !!o.unique; delete o.unique;
        const key = color + '|' + JSON.stringify(o);
        if (!unique) { const c = G3.matCache.get(key); if (c) return c; }
        // Гранёные камни и кроны — Ламберт с плоскими нормалями, остальное — toon со ступенчатым светом
        const m = o.flatShading ? new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, o))
            : new THREE.MeshToonMaterial(Object.assign({ color: new THREE.Color(color), gradientMap: G3.toonRamp }, o));
        if (!unique) { m.userData.cached = true; G3.matCache.set(key, m); }
        return m;
    },
    glowTexture: null
};

const Engine3D = {
    ok: false, active: false, t: 0,
    zoom: 19, zoomTarget: 19, camTarget: null,
    init() {
        if (typeof THREE === 'undefined') return false;
        if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false; // цвета в sRGB, свет — в линейном пространстве
        const cv = document.getElementById('gl3d');
        let r;
        try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL недоступен', e); return false; }
        this.renderer = r;
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        r.setSize(window.innerWidth, window.innerHeight, false);
        r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.outputEncoding = THREE.sRGBEncoding;
        r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;

        // Процедурные текстуры (цвет, нормали, шероховатость) — до создания любых материалов
        Tex3D.build();
        // Мягкое пятно для свечений
        const gc = document.createElement('canvas'); gc.width = gc.height = 64;
        const gg = gc.getContext('2d'), grd = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        gg.fillStyle = grd; gg.fillRect(0, 0, 64, 64);
        G3.glowTexture = new THREE.CanvasTexture(gc);

        this.camTarget = new THREE.Vector3(player.x / G3.tile, 0.6, player.y / G3.tile);
        const scene = this.scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0d14);
        scene.fog = new THREE.FogExp2(0x1b2230, 0.022);
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 320);

        this.hemi = new THREE.HemisphereLight(0xc8d8ff, 0x2a2016, 0.75); scene.add(this.hemi);
        const sun = this.sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
        sun.castShadow = true;
        const sm = r.capabilities.maxTextureSize >= 4096 ? 4096 : 2048; sun.shadow.mapSize.set(sm, sm);
        const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 140;
        sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
        scene.add(sun); scene.add(sun.target);
        // Тёплый свет вокруг героя ночью и пул точечных огней (костры, факелы, жаровни)
        this.heroLight = new THREE.PointLight(0xffb070, 0, 16, 2); scene.add(this.heroLight);
        this.lightPool = [];
        for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xff8a3d, 0, 11, 2); scene.add(l); this.lightPool.push(l); }

        World3D.init(scene);
        Actors3D.init(scene);
        FX3D.init(scene);
        AnimFX.init(scene);
        Weather3D.init(scene);

        window.addEventListener('resize', () => this.resize());
        // При перезагрузке/уходе со страницы сразу отдаём память видеокарты (тени, отражения, текстуры)
        window.addEventListener('pagehide', () => { try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) { } });
        document.getElementById('gameCanvas').addEventListener('wheel', e => {
            if (!this.active) return;
            e.preventDefault();
            this.zoomTarget = Math.max(9, Math.min(32, this.zoomTarget + Math.sign(e.deltaY) * 1.8));
        }, { passive: false });
        this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.ok = true; this.active = true;
        document.body.classList.add('gfx-3d');
        return true;
    },
    resize() {
        if (!this.ok) return;
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
    },
    // Уровень темноты как в 2D-версии: ночь, подземелья, шторм
    darkness() {
        const inDungeon = isDarkZone();
        let d = inDungeon ? zoneDarkness() : 0.34;
        if (!inDungeon) {
            if (worldTimeHours >= 20 || worldTimeHours < 5) d = 0.58;
            else if (worldTimeHours >= 18 && worldTimeHours < 20) d = 0.34 + ((worldTimeHours - 18) / 2) * 0.24;
            else if (worldTimeHours >= 5 && worldTimeHours < 7) d = 0.58 - ((worldTimeHours - 5) / 2) * 0.24;
            if (zoneWeather().id === 'storm') d += 0.1;
        }
        return d;
    },
    // Экран → точка на земле (в пикселях логики игры)
    pick(clientX, clientY) {
        const v = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(v, this.camera);
        const p = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.ground, p)) return [player.x, player.y];
        return [p.x * G3.tile, p.z * G3.tile];
    },
    // Мир (пиксели логики) → экран (CSS-пиксели)
    project(x, y, h) {
        const v = new THREE.Vector3(x / G3.tile, h || 0, y / G3.tile).project(this.camera);
        return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, v.z];
    },
    // Динамическое разрешение: держим 60 FPS, снижая плотность пикселей только когда нужно
    drs: { acc: 0, n: 0, pr: 0 },
    tuneResolution(dt) {
        const d = this.drs, maxPr = Math.min(window.devicePixelRatio || 1, 2);
        if (!d.pr) d.pr = maxPr;
        d.acc += dt; d.n++;
        if (d.acc < 1.5) return;
        const fps = d.n / d.acc; d.acc = 0; d.n = 0;
        let pr = d.pr;
        if (fps < 54 && pr > 1) pr = Math.max(1, pr - 0.25);
        else if (fps > 59 && pr < maxPr) pr = Math.min(maxPr, pr + 0.25);
        if (pr !== d.pr) { d.pr = pr; this.renderer.setPixelRatio(pr); this.renderer.setSize(window.innerWidth, window.innerHeight, false); }
    },
    frame(dt) {
        this.t += dt;
        this.tuneResolution(dt);
        const px = player.x / G3.tile, pz = player.y / G3.tile;
        // Камера: наклон ~56° как в Warcraft 3, мягкое следование и зум колесом
        this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6);
        const tgt = this.camTarget;
        tgt.x += (px - tgt.x) * Math.min(1, dt * 8); tgt.z += (pz - tgt.z) * Math.min(1, dt * 8); tgt.y = 0.6 + World3D.hAt(tgt.x, tgt.z);
        const shake = (typeof screenShake !== 'undefined' && screenShake > 0) ? screenShake * 0.012 : 0;
        const pitch = 0.98 + (this.zoom - 19) * 0.006, d = this.zoom * (1 - (typeof AnimFX !== 'undefined' ? AnimFX.kickAmt : 0) * 0.05);
        this.camera.position.set(tgt.x + (Math.random() - 0.5) * shake, tgt.y + Math.sin(pitch) * d, tgt.z + Math.cos(pitch) * d + (Math.random() - 0.5) * shake);
        this.camera.lookAt(tgt.x, tgt.y, tgt.z);

        // Свет по времени суток и зоне
        const zone = playerZone(), dark = this.darkness();
        const night = Math.max(0, Math.min(1, (dark - 0.34) / 0.3));
        const hell = zone === 'hell', castle = zone === 'castle' || zone === 'shadow_realm';
        // Мрачное фэнтези: низкое тёплое солнце днём, холодная луна ночью, плотный цветной туман только вдали
        const sunCol = hell ? 0xff9a6a : (night > 0.5 ? 0x9fb4ff : 0xffe2b8);
        this.sun.color.setHex(sunCol);
        this.sun.intensity = hell ? 0.9 : (2.1 - night * 1.45);
        this.hemi.intensity = hell ? 0.35 : (0.62 - night * 0.3);
        this.hemi.color.setHex(hell ? 0xb07868 : (castle ? 0x8a7ab8 : (night > 0.5 ? 0x5a6aa8 : 0xb8c8e8)));
        this.hemi.groundColor.setHex(hell ? 0x3a0a04 : 0x1e1810);
        const flash = (typeof lightningFlashAlpha !== 'undefined') ? lightningFlashAlpha : 0;
        if (flash > 0) this.hemi.intensity += flash * 3;
        this.sun.position.set(tgt.x - 12, 22, tgt.z - 14);
        this.sun.target.position.set(tgt.x, 0, tgt.z);
        this.heroLight.position.set(px, 2.2, pz);
        this.heroLight.intensity = 0.3 + night * 1.6 + (hell ? 0.4 : 0);
        // Отражения окружения и контурный свет — по зоне и времени суток
        const envMode = hell ? 'hell' : (castle ? 'castle' : (night > 0.5 ? 'night' : 'day'));
        if (envMode !== this.envMode) { this.envMode = envMode; this.scene.environment = G3.envFor(this.renderer, envMode); }
        G3.rim.color.value.setHex(hell ? 0xff7a3a : (castle ? 0xff4a6a : (night > 0.5 ? 0x7fa8ff : 0xffe8c8)));
        G3.rim.strength.value = hell || castle ? 1.1 : (night > 0.5 ? 1.2 : 0.7);
        const w = zoneWeather();
        const fogCol = hell ? 0x2a0806 : (castle ? 0x120e1e : (night > 0.5 ? 0x080c16 : (zone === 'crimson_marsh' ? 0x241a24 : 0x27313a)));
        this.scene.fog.color.setHex(fogCol);
        this.scene.background.setHex(fogCol);
        // Туман растёт с расстоянием камеры: рядом с героем картинка чистая
        this.scene.fog.density = (0.006 + Math.min(3, w.fogMult || 1) * 0.0035 + (isDarkZone() ? 0.008 : 0) + night * 0.004) * (15 / Math.max(8, this.zoom));
        this.renderer.toneMappingExposure = 1.0 + flash * 0.8;

        World3D.update(px, pz, typeof WORLD !== 'undefined' && pz >= WORLD.hellRow, dt);
        Actors3D.update(dt);
        FX3D.update(dt);
        Weather3D.update(dt, w, tgt);
        AnimFX.update(dt);
        // Ближайшие источники огня получают настоящие точечные огни
        const lights = AnimFX.flashLights().concat(World3D.nearLights(px, pz, 6)).slice(0, 6);
        this.lightPool.forEach((l, i) => {
            const s = lights[i];
            if (!s) { l.intensity = 0; return; }
            l.position.set(s.x, s.h, s.z); l.color.setHex(s.c);
            l.intensity = s.i !== undefined ? s.i : (0.9 + night * 1.4) * (0.85 + Math.sin(this.t * 9 + i * 1.7) * 0.08 + Math.sin(this.t * 23 + i) * 0.05);
        });
        this.renderer.render(this.scene, this.camera);
        Labels3D.draw();
    }
};

