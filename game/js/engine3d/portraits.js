// ============================================================================
// ЖИВЫЕ 3D-ПОРТРЕТЫ (в духе Warcraft 3 / Dota 2): HUD и карточки выбора персонажа
// ============================================================================
// Один маленький WebGL-рендерер на все окошки: модель рендерится в квадрат 320×320 и копируется
// в 2D-холст окошка (drawImage сразу после рендера). Окошек может быть сколько угодно, а контекст один.
// Модели создаются один раз на персонажа и переиспользуют текстуры/материалы игры. Обновление
// ограничено: HUD — 30 кадров/с, активная карточка — 30, остальные — 10–20; невидимые не рисуются.
const Portraits = {
    S: 320,
    actors: new Map(),   // ключ модели → { a, box, last }
    slots: [],
    init() {
        if (this.r) return true;
        try {
            const r = this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
            r.setPixelRatio(1); r.setSize(this.S, this.S, false);
            r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
            r.setClearColor(0x000000, 0);
        } catch (e) { this.failed = true; return false; }
        const sc = this.scene = new THREE.Scene();
        // Окружение для металла и кожи: своё (карты окружения привязаны к рендереру)
        try { const keep = G3.envCache; G3.envCache = {}; sc.environment = G3.envFor(this.r, 'day'); G3.envCache = keep; } catch (e) {}
        sc.add(new THREE.HemisphereLight(0xc8d0e8, 0x1a140c, 0.9));
        const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(1.6, 3, 3.2); sc.add(key);
        const fill = new THREE.DirectionalLight(0x8aa0ff, 0.6); fill.position.set(-2.5, 1.5, 2); sc.add(fill);
        this.rim = new THREE.DirectionalLight(0xffffff, 2.6); this.rim.position.set(-0.6, 2.4, -3); sc.add(this.rim);
        this.flashL = new THREE.PointLight(0xffffff, 0, 4); this.flashL.position.set(0, 1.2, 1.2); sc.add(this.flashL);
        this.cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
        this.mouse = { x: 0.5, y: 0.5 };
        window.addEventListener('pointermove', e => { this.mouse.x = e.clientX / innerWidth; this.mouse.y = e.clientY / innerHeight; }, { passive: true });
        this.react = { hit: 0, cast: 0, lastHp: null, prevCd: null, frenzy: false };
        requestAnimationFrame(t => this.loop(t));
        return true;
    },
    // Ключ модели персонажа: модель WC3 или процедурный герой (Инвокер, Павший Рыцарь)
    keyFor(c, live) {
        if (live && c.key === 'saber' && player.saberAlter) return 'mdx:saber_alter';
        if (live && c.key === 'atalanta' && player.ataForm === 'beast') return 'mdx:atalanta_alter';
        return c.model ? 'mdx:' + c.model : 'hero:' + c.key + ':' + c.id;
    },
    actorFor(c, live) {
        const k = this.keyFor(c, live);
        let e = this.actors.get(k);
        if (e) return e;
        let m = null, X = null;
        if (k.startsWith('mdx:') && typeof MDX3D !== 'undefined') {
            X = MDX3D.create(k.slice(4), { height: 1.25 });
            if (X) { Actors3D.prepMdx(X, k.slice(4)); m = { root: X.root, rig: { kind: 'mdx', mdx: X, body: X.root } }; }
        }
        if (!m) m = Models3D.hero(c.key, { pal: c.pal, gold: false, stance: 'bow', alter: false });
        const a = Actors3D.make(m, null);
        Actors3D.scene.remove(a.base); this.scene.add(a.base);
        a.blob.visible = false; a.weight = 1; a.base.visible = false;
        Actors3D.animate(a, 0.016, 0, 0, { face: 0 }); a.base.position.set(0, 0, 0);
        a.base.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(a.root);
        e = { a, X, top: Math.max(0.9, Math.min(2.2, box.max.y)), last: 0, glow: c.glow };
        this.actors.set(k, e);
        return e;
    },
    // Окошко: canvas внутри рамки. framing: 'bust' — по грудь, 'full' — в полный рост
    add(cv, opts) {
        const slot = Object.assign({ cv, ctx: cv.getContext('2d'), fps: 20, framing: 'bust', last: 0 }, opts);
        this.slots = this.slots.filter(s => s.cv !== cv && s.cv.isConnected);
        this.slots.push(slot); this.init();
        return slot;
    },
    visible(cv) {
        if (!cv.isConnected || !cv.offsetParent) return false;
        const r = cv.getBoundingClientRect();
        return r.width > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    },
    loop(now) {
        requestAnimationFrame(t => this.loop(t));
        if (!this.r || document.hidden) return;
        const dtAll = Math.min(0.1, ((now - (this.lt || now)) / 1000) || 0.016); this.lt = now;
        this.reactions(dtAll);
        const done = new Map();
        for (const s of this.slots) {
            const fps = typeof s.fps === 'function' ? s.fps() : s.fps;
            if (now - s.last < 1000 / fps - 2 || !this.visible(s.cv)) continue;
            const c = typeof s.char === 'function' ? s.char() : s.char; if (!c) continue;
            const k = this.keyFor(c, s.live) + '|' + s.framing;
            // Одинаковые окошки (например, два портрета героя в HUD) — один рендер на кадр
            if (!done.has(k)) { this.renderSlot(s, c, now); done.set(k, true); }
            s.last = now;
            // Квадратный рендер обрезается по центру под пропорции окошка (готическая арка выше, чем шире)
            const w = s.cv.width, h = s.cv.height, S = this.S, sw = w < h ? S * w / h : S, sh = h < w ? S * h / w : S;
            s.ctx.clearRect(0, 0, w, h); s.ctx.drawImage(this.r.domElement, (S - sw) / 2, (S - sh) / 2, sw, sh, 0, 0, w, h);
        }
    },
    renderSlot(s, c, now) {
        const e = this.actorFor(c, s.live), a = e.a;
        const dt = Math.min(0.1, e.last ? (now - e.last) / 1000 : 0.016); e.last = now;
        for (const x of this.actors.values()) x.a.base.visible = x === e;
        // Взгляд в камеру с лёгким поворотом головы за курсором (относительно окошка)
        const R = s.cv.getBoundingClientRect(), mx = (this.mouse.x * innerWidth - (R.left + R.width / 2)) / innerWidth, my = (this.mouse.y * innerHeight - (R.top + R.height / 2)) / innerHeight;
        const live = s.live && this.react, frenzy = live && this.react.frenzy;
        const yaw = Math.max(-0.45, Math.min(0.45, mx * 1.4)) + (frenzy ? Math.sin(now / 40) * 0.12 : 0);
        Actors3D.animate(a, dt, 0, 0, { face: yaw, vis: c.model === 'archer' ? (s.live && player.archerStance === 'blades' ? { 1: true, 2: false } : { 1: false, 2: true }) : null });
        a.base.position.set(0, 0, 0);
        a.base.scale.set(1, 1 + Math.sin(now / 560) * 0.006, 1);   // дыхание
        a.flash = Math.max(0, (a.flash || 0) - dt * 4);
        // Кадр: по грудь (HUD) или в полный рост (карточки)
        const top = e.top, full = s.framing === 'full', visH = full ? top * 1.12 : top * 0.56, ty = full ? top * 0.5 : top * 0.78 - my * 0.05;
        const d = (visH / 2) / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
        const shake = live ? this.react.hit * 0.03 : 0;
        this.cam.position.set(Math.sin(-mx * 0.5) * 0.15 + (Math.random() - 0.5) * shake, ty + 0.03 + (Math.random() - 0.5) * shake, d);
        this.cam.lookAt(0, ty, 0);
        // Свет: контровой в цвет героя, вспышка при касте, красный при уроне, жёлтый при безумии
        const glow = (c.glow || '200,200,220').split(',').map(v => +v / 255);
        this.rim.color.setRGB(glow[0], glow[1], glow[2]);
        let fi = 0, fc = 0xffffff;
        if (live) {
            if (this.react.cast > 0) { fi = this.react.cast * 6; fc = typeof Actors3D !== 'undefined' ? Actors3D.heroColor() : 0xffffff; }
            if (this.react.hit > 0) { fi = Math.max(fi, this.react.hit * 7); fc = 0xff2a2a; }
            if (frenzy) { fi = 3 + Math.random() * 5; fc = 0xfde047; }
        }
        this.flashL.color.setHex(fc); this.flashL.intensity = fi;
        this.r.render(this.scene, this.cam);
    },
    // Реакции портрета героя: урон, каст навыка, безумие берсерка, низкое здоровье
    reactions(dt) {
        const R = this.react;
        R.hit = Math.max(0, R.hit - dt * 3.5); R.cast = Math.max(0, R.cast - dt * 3);
        if (typeof player === 'undefined' || typeof gameState === 'undefined' || gameState !== 'playing') { R.lastHp = null; return; }
        const e = this.actors.get(this.keyFor(playerChar() || {}, true));
        if (R.lastHp !== null && player.hp < R.lastHp - 0.5) { R.hit = 1; if (e) { e.a.hitT = 0.25; e.a.flash = 0.8; } }
        R.lastHp = player.hp;
        // Новый каст: выросла перезарядка любого навыка (или Invoke)
        const cur = Object.assign({ inv: player.invokeCd || 0 }, player.saberCooldowns || {}), prev = R.prevCd || cur;
        if (Object.keys(cur).some(k => (cur[k] || 0) > (prev[k] || 0) + 0.3)) { R.cast = 1; if (e) Actors3D.attack(e.a, 'castR', 0.45); }
        R.prevCd = cur;
        R.frenzy = !!player.frankFrenzy;
        document.querySelectorAll('.pt-frame.pt-live').forEach(f => {
            f.classList.toggle('pt-hit', R.hit > 0.3); f.classList.toggle('pt-cast', R.cast > 0.3);
            f.classList.toggle('pt-frenzy', R.frenzy); f.classList.toggle('pt-low', player.hp / Math.max(1, player.maxHp) < 0.3);
        });
    },
    // ---------- окошки в интерфейсе ----------
    frameHTML(cls, c) { return `<div class="pt-frame ${cls}" data-hero="${c ? c.id : ''}"><canvas width="${this.S}" height="${this.S}"></canvas><i class="pt-corner tl"></i><i class="pt-corner tr"></i><i class="pt-corner bl"></i><i class="pt-corner br"></i></div>`; },
    // HUD: готическое окошко с героем строго между шарами здоровья и маны; под ним — уровень и опыт
    mountHud() {
        if (!this.init()) return;
        if (!document.getElementById('ptHud')) {
            const box = document.getElementById('svPortrait'); if (!box) return;
            box.insertAdjacentHTML('afterbegin', `<div id="ptHud" class="pt-frame pt-live pt-hud"><canvas width="208" height="236"></canvas><i class="pt-corner tl"></i><i class="pt-corner tr"></i><i class="pt-corner bl"></i><i class="pt-corner br"></i><i class="pt-crest"></i></div>`);
            this.add(document.querySelector('#ptHud canvas'), { live: true, char: () => playerChar(), fps: 30, framing: 'bust' });
        }
        this.syncHud();
    },
    syncHud() {
        const c = typeof playerChar === 'function' ? playerChar() : null; if (!c) return;
        document.querySelectorAll('.pt-frame.pt-live').forEach(f => { f.dataset.hero = c.id; f.style.setProperty('--hero-glow', c.glow); f.title = typeof heroDisplayName === 'function' ? heroDisplayName() : c.name; });
        const l = document.getElementById('hudLevel'); if (l) l.textContent = player.level;
    },
    // Карточки персонажей: квадратное окно с моделью в полный рост справа на карточке
    mountHeroCards() {
        if (!this.init()) return;
        document.querySelectorAll('#heroTrack .hero-card').forEach(card => {
            if (card.querySelector('.pt-card')) return;
            const c = HERO_MENU[+card.dataset.i]; if (!c) return;
            card.classList.add('has-3d');
            card.insertAdjacentHTML('beforeend', this.frameHTML('pt-card', c));
            const cv = card.querySelector('.pt-card canvas');
            this.add(cv, { char: c, framing: 'full', fps: () => card.classList.contains('is-active') ? 30 : 10 });
        });
    }
};
