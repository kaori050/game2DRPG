// ============================================================================
// ИНТЕРФЕЙС: круглые «соулс»-шары здоровья и маны с живой жидкостью, тёмно-серебряная тема,
// украшения под героя, очередь уведомлений (не больше 3), полноэкранный режим
// ============================================================================
const SoulsHUD = {
    orbs: {},
    init() {
        const dock = document.getElementById('bottomDock'), vit = dock && dock.querySelector('.dock-vitals');
        if (!dock || !vit || this.ready) return;
        // Блок в духе Warcraft 3 / Dota 2: [шар HP + выносливость] [живой 3D-портрет + уровень и опыт] [шар маны]
        vit.classList.add('souls-vitals');
        const sta = vit.querySelector('.vital-sta'), xp = vit.querySelector('.vital-xp');
        vit.insertAdjacentHTML('beforeend', `<div class="sv-col sv-hp">${this.orbHTML('hp', 'Здоровье')}</div>
            <div class="sv-col sv-pt" id="svPortrait">
                <div class="sv-lvl" id="ptXp"><span class="sv-lvl-badge">УР. <b id="hudLevel">1</b></span><span id="ptXpTxt" class="sv-xp-txt"></span></div>
            </div>
            <div class="souls-right">${this.orbHTML('mp', 'Мана')}
            <div class="souls-mad hidden" id="orb_mad" title="Безумие берсерка: навыки быстро наполняют шкалу, со временем она медленно спадает. На 100% герой теряет контроль">
                <canvas width="240" height="240"></canvas><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#050506" stroke-width="3.5"/><circle cx="20" cy="20" r="18" fill="none" stroke="url(#silv_mp)" stroke-width="1.8"/><path d="M21 7 L15 21 H20 L18 33 L26 17 H21 Z" fill="rgba(253,224,71,.16)"/></svg><b></b>
            </div></div>`);
        if (sta) vit.querySelector('.sv-hp').appendChild(sta);
        if (xp) document.getElementById('svPortrait').appendChild(xp);
        this.orbs.hp = this.makeOrb('hp');
        this.orbs.mp = this.makeOrb('mp');
        { const root = document.getElementById('orb_mad'), cv = root.querySelector('canvas'); this.orbs.mad = { id: 'mad', root, cv, g: cv.getContext('2d'), val: root.querySelector('b'), level: 0, vel: 0, slosh: 0, phase: 0, bubbles: [], pops: [], last: null }; }
        this.ready = true;
        FullscreenUI.init();
        requestAnimationFrame(t => this.loop(t));
    },
    // Шар: холст с жидкостью + готическая рамка SVG с украшениями всех героев (видимы только нужные)
    orbHTML(id, title) {
        const ticks = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2, r1 = 57, r2 = i % 3 ? 60 : 63; return `<line x1="${70 + Math.cos(a) * r1}" y1="${70 + Math.sin(a) * r1}" x2="${70 + Math.cos(a) * r2}" y2="${70 + Math.sin(a) * r2}"/>`; }).join('');
        const thorns = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a); return `<path d="M${70 + c * 63} ${70 + s * 63} L${70 + Math.cos(a - 0.07) * 66} ${70 + Math.sin(a - 0.07) * 66} L${70 + c * 71} ${70 + s * 71} L${70 + Math.cos(a + 0.07) * 66} ${70 + Math.sin(a + 0.07) * 66}Z"/>`; }).join('');
        const flip = id === 'mp' ? 'scale(-1,1) translate(-140,0)' : '';
        return `<div class="souls-orb souls-${id}" id="orb_${id}" title="${title}">
            <canvas width="240" height="240"></canvas>
            <svg class="souls-frame" viewBox="0 0 140 140" aria-hidden="true">
                <defs>
                    <linearGradient id="silv_${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset=".35" stop-color="#9aa1ab"/><stop offset=".6" stop-color="#4b5059"/><stop offset="1" stop-color="#c9ced6"/></linearGradient>
                    <linearGradient id="gold_${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#d4a020"/><stop offset="1" stop-color="#7a5408"/></linearGradient>
                </defs>
                <circle cx="70" cy="70" r="60" fill="none" stroke="#050506" stroke-width="7"/>
                <circle cx="70" cy="70" r="60" fill="none" stroke="url(#silv_${id})" stroke-width="4"/>
                <circle cx="70" cy="70" r="55.5" fill="none" stroke="rgba(220,225,232,.35)" stroke-width="1"/>
                <g class="sf-ticks" stroke="url(#silv_${id})" stroke-width="1.4">${ticks}</g>
                <g class="sf-thorns" fill="url(#silv_${id})" stroke="#0a0a0c" stroke-width=".6">${thorns}</g>
                <path class="sf-crest" d="M58 9 Q70 -2 82 9 L76 13 Q70 8 64 13Z" fill="url(#silv_${id})" stroke="#0a0a0c" stroke-width=".6"/>
                <circle class="sf-gem" cx="70" cy="8" r="2.6"/>
                <!-- Сейбер: золотая филигрань и силуэт Экскалибура -->
                <g class="orn orn-saber" transform="${flip}">
                    <circle cx="70" cy="70" r="64.5" fill="none" stroke="url(#gold_${id})" stroke-width="1.3" stroke-dasharray="6 3 1 3"/>
                    <path d="M11 104 L4 128" stroke="url(#gold_${id})" stroke-width="1.2" fill="none"/>
                    <g transform="translate(9 122) rotate(-160)">
                        <path d="M-1.6 0 L-1.4 34 L0 40 L1.4 34 L1.6 0Z" fill="#e8eef8" stroke="#8a95a8" stroke-width=".4"/>
                        <rect x="-6" y="-2.5" width="12" height="2.2" rx="1" fill="url(#gold_${id})"/>
                        <rect x="-1" y="-9" width="2" height="7" fill="#2a3a8a"/><circle cx="0" cy="-10" r="1.6" fill="url(#gold_${id})"/>
                    </g>
                </g>
                <!-- Арчер: изгиб чёрного лука с тетивой -->
                <g class="orn orn-archer" transform="${flip}">
                    <path d="M18 22 Q-6 70 18 118" fill="none" stroke="#141418" stroke-width="4.5" stroke-linecap="round"/>
                    <path d="M18 22 Q-6 70 18 118" fill="none" stroke="#b01820" stroke-width="1.4" stroke-linecap="round"/>
                    <path d="M18 22 Q10 18 14 13 M18 118 Q10 122 14 127" fill="none" stroke="#141418" stroke-width="3"/>
                    <line x1="18" y1="22" x2="18" y2="118" stroke="rgba(230,230,240,.55)" stroke-width=".6"/>
                </g>
                <!-- Павший Рыцарь: трещины с раскалённой кровью -->
                <g class="orn orn-knight" fill="none" stroke-linecap="round">
                    <path class="crack" d="M70 10 L66 20 L72 27 L68 36 M112 30 L104 37 L107 45 L98 50 M128 78 L118 76 L114 84 M28 116 L36 108 L33 99 L42 95 M14 60 L24 63 L22 72"/>
                    <path class="crack crack-thin" d="M66 20 L60 24 M104 37 L100 31 M36 108 L30 104 M22 72 L16 77"/>
                </g>
                <!-- Маг: три сферы стихий и руны -->
                <g class="orn orn-invoker">
                    <circle cx="20" cy="40" r="3.4" fill="#38bdf8"/><circle cx="70" cy="132" r="3.4" fill="#c084fc"/><circle cx="120" cy="40" r="3.4" fill="#fb923c"/>
                    <circle cx="70" cy="70" r="66.5" fill="none" stroke="rgba(192,132,252,.45)" stroke-width=".8" stroke-dasharray="2 5"/>
                </g>
            </svg>
            <div class="souls-val"><b></b><span></span></div>
        </div>`;
    },
    makeOrb(id) {
        const root = document.getElementById('orb_' + id);
        return { id, root, cv: root.querySelector('canvas'), g: root.querySelector('canvas').getContext('2d'), val: root.querySelector('.souls-val b'), sub: root.querySelector('.souls-val span'),
            level: 1, vel: 0, slosh: 0, phase: Math.random() * 10, bubbles: [], pops: [], last: null };
    },
    // Палитры жидкости
    LIQ: {
        blood: { top: '#b0121e', mid: '#6a0610', deep: '#1e0204', foam: 'rgba(255,120,120,.55)', glow: 'rgba(255,40,40,.35)' },
        mana: { top: '#3b6fe0', mid: '#163a9a', deep: '#050c2a', foam: 'rgba(170,210,255,.6)', glow: 'rgba(80,140,255,.35)' },
        gold: { top: '#d8a92a', mid: '#8a5a08', deep: '#2a1802', foam: 'rgba(255,236,170,.6)', glow: 'rgba(255,200,80,.3)' },
        madness: { top: '#fde047', mid: '#ca8a04', deep: '#3a2a02', foam: 'rgba(255,250,200,.75)', glow: 'rgba(255,220,60,.45)' },
        shield: { top: '#9a1a28', mid: '#4a0a12', deep: '#120204', foam: 'rgba(255,190,190,.6)', glow: 'rgba(255,80,80,.3)' }
    },
    loop(now) {
        const dt = Math.min(0.05, ((now - (this.lt || now)) / 1000) || 0.016); this.lt = now;
        if (typeof player !== 'undefined' && typeof gameState !== 'undefined' && gameState === 'playing') {
            const ht = player.heroType, theme = player.charId === 'mordred' ? 'mordred' : ht;
            if (document.body.dataset.hero !== theme) document.body.dataset.hero = theme;
            { const bf = ht === 'atalanta' && player.ataForm === 'beast'; if (document.body.classList.contains('ata-beast-form') !== bf) document.body.classList.toggle('ata-beast-form', bf); }
            const hp = this.orbs.hp, mp = this.orbs.mp;
            this.step(hp, player.hp / Math.max(1, player.maxHp), dt, this.LIQ.blood);
            hp.val.textContent = Math.ceil(player.hp); hp.sub.textContent = '/ ' + player.maxHp;
            hp.root.classList.toggle('low', player.hp / player.maxHp < 0.3);
            if (ht === 'knight') {
                const sh = player.bloodShield || 0;
                this.step(mp, sh > 0 ? sh / Math.max(1, player.bloodShieldMax) : 0, dt, this.LIQ.shield);
                mp.val.textContent = sh > 0 ? Math.ceil(sh) : '—'; mp.sub.textContent = sh > 0 ? 'щит' : 'нет маны';
                mp.root.title = 'Маны нет: навыки платят кровью. Здесь — прочность Кровавого Щита';
            } else {
                this.step(mp, player.mp / Math.max(1, player.maxMp), dt, ht === 'invoker' && player.orbLevels && player.orbLevels.r >= 4 ? this.LIQ.gold : this.LIQ.mana);
                mp.val.textContent = Math.ceil(player.mp); mp.sub.textContent = '/ ' + player.maxMp; mp.root.title = 'Мана';
            }
            // Безумие берсерка: маленький шар с жёлтой булькающей жидкостью над маной
            const mad = this.orbs.mad, berserk = typeof Frank !== 'undefined' && Frank.isBerserker();
            mad.root.classList.toggle('hidden', !berserk);
            if (berserk) {
                const m = (player.madness || 0) / 100, frenzy = !!player.frankFrenzy;
                if (Math.random() < dt * (3 + m * 14)) this.bubble(mad, true);   // жидкость сильнее бурлит у края
                this.step(mad, frenzy ? 1 : m, dt, this.LIQ.madness);
                mad.val.textContent = frenzy ? '!' : Math.round(m * 100) + '%';
                mad.root.classList.toggle('hot', m >= 0.7 && !frenzy); mad.root.classList.toggle('frenzy', frenzy);
            }
        }
        requestAnimationFrame(t => this.loop(t));
    },
    // Физика уровня: пружина с затуханием → жидкость перехлёстывает и колышется при каждом изменении
    step(o, target, dt, pal) {
        target = Math.max(0, Math.min(1, target || 0));
        if (o.last !== null) {
            const d = target - o.last;
            if (Math.abs(d) > 0.003) { o.slosh = Math.min(1, o.slosh + Math.abs(d) * 6); const n = Math.min(14, 2 + Math.round(Math.abs(d) * 60)); for (let i = 0; i < n; i++) this.bubble(o, true); }
        }
        o.last = target;
        o.vel += (target - o.level) * 40 * dt; o.vel *= Math.exp(-7 * dt); o.level += o.vel * dt * 4;
        o.level = Math.max(0, Math.min(1, o.level));
        o.slosh *= Math.exp(-1.6 * dt); o.phase += dt * (1.6 + o.slosh * 5);
        if (Math.random() < dt * (2.5 + o.slosh * 20)) this.bubble(o, false);
        this.draw(o, dt, pal);
    },
    bubble(o, burst) { if (o.bubbles.length > 60) return; o.bubbles.push({ x: 40 + Math.random() * 160, y: 225 - Math.random() * (burst ? 60 : 10), r: burst ? 1.5 + Math.random() * 4 : 1 + Math.random() * 2.5, v: 30 + Math.random() * 60, w: Math.random() * 6 }); },
    draw(o, dt, pal) {
        const g = o.g, S = 240, C = 120, R = 104, t = performance.now() / 1000;
        g.clearRect(0, 0, S, S);
        g.save(); g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
        // Пустое стекло: тёмная полость
        const bg = g.createRadialGradient(C, C - 20, 10, C, C, R); bg.addColorStop(0, '#16171c'); bg.addColorStop(1, '#030304');
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        const top = C + R - o.level * R * 2, amp = 2.5 + o.slosh * 11;
        const surf = (x, k) => top + Math.sin(x * 0.045 + o.phase * (1.3 + k * 0.4) + k * 2) * amp * (1 - k * 0.4) + Math.sin(x * 0.11 - o.phase * 2.1 + k) * amp * 0.35 + (o.slosh * 14 * Math.sin(o.phase * 0.9)) * ((x - C) / R) * (1 - k);
        // Задний слой волны — глубина
        if (o.level > 0.003) {
            for (let k = 1; k >= 0; k--) {
                g.beginPath(); g.moveTo(0, S);
                for (let x = 0; x <= S; x += 6) g.lineTo(x, surf(x, k));
                g.lineTo(S, S); g.closePath();
                const lg = g.createLinearGradient(0, top - amp, 0, C + R);
                lg.addColorStop(0, k ? pal.mid : pal.top); lg.addColorStop(0.35, pal.mid); lg.addColorStop(1, pal.deep);
                g.globalAlpha = k ? 0.55 : 1; g.fillStyle = lg; g.fill();
            }
            g.globalAlpha = 1;
            // Пена/блик по линии поверхности
            g.beginPath(); for (let x = 0; x <= S; x += 6) { const y = surf(x, 0); x ? g.lineTo(x, y) : g.moveTo(x, y); }
            g.strokeStyle = pal.foam; g.lineWidth = 2; g.stroke();
            // Каустика: мерцающие пятна в толще
            g.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 5; i++) { const x = C + Math.sin(t * 0.6 + i * 1.7) * 70, y = Math.max(top + 20, C + 30 + Math.cos(t * 0.8 + i) * 40); const cg = g.createRadialGradient(x, y, 0, x, y, 30); cg.addColorStop(0, pal.glow); cg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = cg; g.fillRect(x - 30, y - 30, 60, 60); }
            g.globalCompositeOperation = 'source-over';
        }
        // Пузыри: поднимаются, покачиваясь, и лопаются на поверхности
        for (let i = o.bubbles.length - 1; i >= 0; i--) {
            const b = o.bubbles[i]; b.y -= b.v * dt; b.w += dt * 4; const bx = b.x + Math.sin(b.w) * 3, sy = surf(bx, 0);
            if (b.y <= sy + b.r || o.level < 0.01) { if (o.level > 0.01) o.pops.push({ x: bx, y: sy, t: 0 }); o.bubbles.splice(i, 1); continue; }
            g.beginPath(); g.arc(bx, b.y, b.r, 0, Math.PI * 2); g.strokeStyle = pal.foam; g.lineWidth = 1; g.stroke();
            g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(bx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.35, 0, Math.PI * 2); g.fill();
        }
        for (let i = o.pops.length - 1; i >= 0; i--) { const p = o.pops[i]; p.t += dt; if (p.t > 0.3) { o.pops.splice(i, 1); continue; } g.beginPath(); g.ellipse(p.x, p.y, 2 + p.t * 22, 1 + p.t * 5, 0, 0, Math.PI * 2); g.strokeStyle = pal.foam.replace(/[\d.]+\)$/, (0.6 * (1 - p.t / 0.3)).toFixed(2) + ')'); g.lineWidth = 1; g.stroke(); }
        // Стекло: внутренняя тень и блик
        const vg = g.createRadialGradient(C, C, R * 0.65, C, C, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
        const hl = g.createLinearGradient(C - R, C - R, C, C); hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.fillStyle = hl; g.beginPath(); g.ellipse(C - 30, C - 42, 52, 30, -0.6, 0, Math.PI * 2); g.fill();
        g.restore();
    }
};

// ---------- Уведомления: не больше трёх, старое плавно растворяется ----------
const ToastQueue = {
    MAX: 3,
    push(el) {
        const c = document.getElementById('toastContainer'); if (!c) return;
        const live = [...c.children].filter(x => !x.classList.contains('toast-out'));
        while (live.length >= this.MAX) this.dismiss(live.shift());
        el.classList.add('toast-in'); c.appendChild(el);
        el._timer = setTimeout(() => this.dismiss(el), 2800);
    },
    dismiss(el) { if (!el || el.classList.contains('toast-out')) return; clearTimeout(el._timer); el.classList.add('toast-out'); setTimeout(() => el.remove(), 380); }
};

// ---------- Полноэкранный режим: кнопка исчезает в полном экране, Esc — выход ----------
const FullscreenUI = {
    init() {
        if (this.btn) return;
        const b = this.btn = document.createElement('button');
        b.id = 'btnFullscreen'; b.className = 'fs-btn'; b.title = 'Полноэкранный режим (Esc — выход)';
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
        b.onclick = () => this.enter();
        document.body.appendChild(b);
        const sync = () => document.body.classList.toggle('is-fullscreen', !!(document.fullscreenElement || document.webkitFullscreenElement));
        document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
        // Esc в полноэкранном режиме — только выход из него (меню при этом не открывается)
        window.addEventListener('keydown', e => { if (e.code === 'Escape' && (document.fullscreenElement || document.webkitFullscreenElement)) { e.preventDefault(); e.stopImmediatePropagation(); this.exit(); } }, true);
    },
    enter() {
        const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) { if (typeof showToast === 'function') showToast('Браузер не поддерживает полноэкранный режим', 'error'); return; }
        try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => showToast('Полноэкранный режим недоступен в этом окне', 'error')); } catch (e) { }
    },
    exit() { const ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex && (document.fullscreenElement || document.webkitFullscreenElement)) ex.call(document); }
};
