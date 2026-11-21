// ============================================================================
// ДЖЕК-ПОТРОШИТЕЛЬ (класс «Саппорт»): Убийца из тумана Уайтчепела
// ============================================================================
// Тактический саппорт-ассасин: туман, дебаффы и контроль пространства вместо лечения.
// Очень хрупкий: любая ошибка вплотную к боссу дорого стоит.
// Пассив «Убийца в тумане»: в своём тумане Джек быстрее на 20% и уклоняется от 25% ударов.
// Q Туман Лондона — облако стелющегося тумана: враги внутри медленнее ходят и бьют, теряют Джека из виду.
// W Анатомия — серия точных разрезов: враги слабее бьют и теряют половину брони.
// E Тень Переулка — рывок сквозь врагов: подрезанные сухожилия (замедление) и кровотечение, клочок тумана на старте.
// R Мария Потрошительница — багровый туман, серия молниеносных разрезов по всем в зоне, кровотечение
//   и «кровавый туман»: поражённые получают на 25% больше урона. В тумане Лондона все разрезы — критические.
const JACK_SKILLS = {
    q: { key: 'q', name: 'The Mist', ruName: 'Туман Лондона', icon: '🌫️', manaCost: 30, baseCd: 10,
         desc: 'Джек выпускает плотный стелющийся туман у курсора. Враги внутри замедлены, бьют реже и теряют Джека из виду, если он не рядом. Сам Джек в тумане быстрее и уклоняется от части ударов. Граница тумана видна на земле.',
         stats: l => `Радиус ${150 + 10 * l} • ${(6 + 0.5 * l).toFixed(1)}с • враги: −30% скорости, −40% темпа атак • Джек: +20% скорости, уклонение 25% • перезарядка 10с` },
    w: { key: 'w', name: 'Information Erasure', ruName: 'Анатомия', icon: '🔪', manaCost: 35, baseCd: 8,
         desc: 'Три молниеносных разреза перед собой — по суставам и сухожилиям. Задетые враги на 5 секунд бьют слабее и теряют половину брони (боссы — меньше). Помогает пережить тяжёлые удары элиты и боссов.',
         stats: l => `3 × ${22 + 11 * l} + атака • урон врага −30% (боссы −20%), броня −50% на 5с • перезарядка ${Math.max(5, 8 - 0.3 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Mist Step', ruName: 'Тень Переулка', icon: '🌒', manaCost: 25, baseCd: 6,
         desc: 'Стремительный рывок сквозь врагов к курсору: короткая неуязвимость, всех на пути подрезает — замедление и кровотечение. На месте старта остаётся клочок тумана.',
         stats: l => `Рывок ${230 + 10 * l} • урон ${35 + 17 * l} + атака • замедление 50% на 2.5с, кровотечение • перезарядка ${Math.max(3, 6 - 0.3 * l).toFixed(1)}с` },
    r: { key: 'r', name: 'Maria the Ripper', ruName: 'Мария Потрошительница', icon: '🩸', manaCost: 150, baseCd: 85,
         desc: 'Ультимейт. «Мы — ад. Здесь — туман. Сейчас — ночь…» Область вокруг Джека накрывает багровый туман, Джек растворяется в нём и наносит серию молниеносных разрезов по всем врагам в зоне, затем — кровавый всплеск. Поражённые кровоточат, а 4 секунды «кровавого тумана» на них увеличивают весь получаемый урон на 25%. Если враг в Тумане Лондона, все разрезы — критические.',
         stats: l => `Зона 230 • 6 разрезов по ${70 + 35 * l} + атака • кровотечение ${30 + 15 * l}/с на 5с • уязвимость +25% на 4с • перезарядка ${85 - 5 * l}с` }
};

const Jack = {
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(150 + L * 22 + eq.hp);
        player.maxMp = Math.round(190 + L * 24 + (q + w + e) * 6 + eq.mp);
        player.hpRegen = +(2 + L * 0.25).toFixed(1);
        player.mpRegen = +(5.5 + L * 0.45 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(22 + L * 6 + eq.hand);
        player.spellAmp = Math.round(8 + L * 2.5 + eq.amp);
        player.armor = Math.round(2 + L * 0.35 + eq.armor);
        player.moveSpeed = Math.round(230 * (this.inMist() ? 1.2 : 1));
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        player.attackInterval = 0.4;
        player.attackRange = 80;
        player.critChance = 14 + eq.crit; player.critMult = 1.9;
    },
    pow() { return 1 + (player.spellAmp || 0) / 100; },
    ready(key) {
        const sk = JACK_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.jackQueue = player.jackQueue || []).push({ t, fn }); },
    crit(dmg, force) { const c = force || Math.random() * 100 < (player.critChance || 0); return { dmg: Math.round(dmg * (c ? player.critMult : 1)), crit: c }; },
    mists() { return player.heroType === 'jack' ? (player.jackMists || []) : []; },
    mistAt(x, y, pad = 0) { return this.mists().find(m => !m.blood && Math.hypot(x - m.x, y - m.y) < m.R + pad); },
    inMist() { return !!this.mistAt(player.x, player.y); },
    addMist(x, y, R, dur, blood) { (player.jackMists = player.jackMists || []).push({ x, y, R, t: 0, dur, blood: !!blood, uid: Math.random() }); },
    // Удар по сектору перед Джеком
    cut(ang, R, half, dmg, onEach, force) {
        let n = 0;
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
            if (d > R + en.radius) return;
            let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) > half && d > en.radius + 14) return;
            const c = this.crit(dmg, force && force(en)); damageEnemy(en, c.dmg, false, dx / (d || 1) * 4, dy / (d || 1) * 4, '#e11d48', { crit: c.crit });
            if (onEach) onEach(en); n++;
        });
        return n;
    },
    bleed(en, dps, dur) { en.jackBleed = { t: dur, dps: Math.max(dps, en.jackBleed ? en.jackBleed.dps : 0), acc: 0 }; },
    // Анатомия: ослабление удара и брони врага (возвращается по таймеру)
    weaken(en, sec) {
        if (!en.jackWeak) en.jackWeak = { dmg: en.dmg, armor: en.armor };
        en.jackWeak.t = sec;
        en.dmg = Math.round(en.jackWeak.dmg * (en.isBoss ? 0.8 : 0.7));
        en.armor = Math.round(en.jackWeak.armor * 0.5);
    },
    attack() {
        const k = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 2) + 1; player.comboTimer = 1.2;
        player.basicAttackCd = player.attackInterval;
        player.slashAnimTime = 0.26;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        this.later(0.1, () => {
            const n = this.cut(ang, 85, 0.85, player.handDmg * (k === 2 ? 1.15 : 1));
            if (typeof Jack3D !== 'undefined') Jack3D.slash(ang, k, 1);
            if (n && typeof Feel !== 'undefined') Feel.impact(Math.cos(ang), Math.sin(ang), 0.35, false);
        });
        SoundFX.play('whoosh');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
            if (d > 380) { tx = player.x + (tx - player.x) / d * 380; ty = player.y + (ty - player.y) / d * 380; }
            player.jackMists = (player.jackMists || []).filter(m => m.blood || m.small);   // одновременно — один большой туман
            this.addMist(tx, ty, 150 + 10 * lvl, 6 + 0.5 * lvl);
            player.knightAnim = { kind: 'mist', t: 0.45 };
            if (typeof Jack3D !== 'undefined') Jack3D.mistBurst(tx, ty, 150 + 10 * lvl, false);
            this.cd('q', JACK_SKILLS.q.baseCd); SoundFX.play('tornado');
        } else if (key === 'w') {
            const dmg = (22 + 11 * lvl) * P + H * 0.4;
            for (let i = 0; i < 3; i++) this.later(0.06 + i * 0.1, () => {
                const a = player.facingAngle;
                this.cut(a, 120, 0.8, dmg, en => this.weaken(en, 5));
                if (typeof Jack3D !== 'undefined') Jack3D.slash(a, i + 1, 1.2);
                if (typeof Feel !== 'undefined') Feel.impact(Math.cos(a), Math.sin(a), 0.4, false);
            });
            player.knightAnim = { kind: 'anatomy', t: 0.45 };
            this.cd('w', Math.max(5, JACK_SKILLS.w.baseCd - 0.3 * lvl)); SoundFX.play('whoosh');
        } else if (key === 'e') {
            const range = 230 + 10 * lvl, d = Math.min(range, Math.max(80, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            const m = { x: player.x, y: player.y, R: 90, t: 0, dur: 1.6, small: true, uid: Math.random() };
            (player.jackMists = player.jackMists || []).push(m);
            if (typeof Jack3D !== 'undefined') Jack3D.mistBurst(m.x, m.y, 90, false);
            player.jackDash = { t: 0, dur: 0.18, vx: cx * d / 0.18, vy: cy * d / 0.18, ang, hit: new Set(), dmg: (35 + 17 * lvl) * P + H * 0.5, bleed: (12 + 6 * lvl) * P };
            player.invulnTime = Math.max(player.invulnTime, 0.28);
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'step', t: 0.3 };
            this.cd('e', Math.max(3, JACK_SKILLS.e.baseCd - 0.3 * lvl)); SoundFX.play('tornado');
        } else if (key === 'r') {
            player.jackUlt = { t: 0, x: player.x, y: player.y, R: 230, cuts: 0, dmg: (70 + 35 * lvl) * P + H * 0.6, bleed: (30 + 15 * lvl) * P, done: false, hit: new Set() };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = { kind: 'ripper', t: 0.5 };
            this.cd('r', JACK_SKILLS.r.baseCd - 5 * lvl);
            zoneBanner = { title: 'MARIA THE RIPPER', sub: 'Мы — ад. Здесь — туман. Сейчас — ночь.', life: 2.4, maxLife: 2.4, color: '#fca5a5' };
            SoundFX.play('invoke');
            if (typeof Jack3D !== 'undefined') Jack3D.mistBurst(player.x, player.y, 230, true);
        }
        updateInvokerBarUI();
    },
    // Уклонение в тумане (из damagePlayer): true — удар прошёл мимо
    evade() { return player.heroType === 'jack' && this.inMist() && Math.random() < 0.25; },
    update(dt) {
        if (player.heroType !== 'jack') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.jackQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        // Пассив: скорость в тумане — пересчитываем, когда Джек входит/выходит
        const im = this.inMist(); if (im !== this._wasIn) { this._wasIn = im; recalcPlayerStats(); }
        // Туманы: замедление и вялые атаки врагов внутри, потеря цели
        const M = player.jackMists;
        if (M) for (let i = M.length - 1; i >= 0; i--) {
            const m = M[i]; m.t += dt;
            if (m.t >= m.dur) { M.splice(i, 1); continue; }
            if (m.blood) continue;
            for (const en of enemies) {
                if (en.deadTimer > 0 || Math.hypot(en.x - m.x, en.y - m.y) > m.R + en.radius) continue;
                en.slowTimer = Math.max(en.slowTimer || 0, 0.25); en.slowMult = Math.min(en.slowMult || 1, 0.7);
                if (en.attackCd > 0) en.attackCd += dt * 0.4;   // темп атак −40%
                if (!en.isBoss && Math.hypot(player.x - en.x, player.y - en.y) > 160 && en.aggro > 0) en.aggro = Math.min(en.aggro, 0.3);
            }
        }
        // Рывок сквозь врагов
        const D = player.jackDash;
        if (D) {
            D.t += dt; tryMoveEntity(player, D.vx * dt, D.vy * dt);
            enemies.forEach(en => {
                if (en.deadTimer > 0 || D.hit.has(en.uid) || Math.hypot(en.x - player.x, en.y - player.y) > 45 + en.radius) return;
                D.hit.add(en.uid);
                const c = this.crit(D.dmg); damageEnemy(en, c.dmg, false, 0, 0, '#e11d48', { crit: c.crit });
                en.slowTimer = Math.max(en.slowTimer || 0, 2.5); en.slowMult = Math.min(en.slowMult || 1, 0.5);
                this.bleed(en, D.bleed, 3);
                if (typeof Jack3D !== 'undefined') Jack3D.cutMark(en.x, en.y);
            });
            if (typeof Jack3D !== 'undefined') Jack3D.ghost();
            if (D.t >= D.dur) player.jackDash = null;
        }
        // Мария Потрошительница: туман сгущается → шесть разрезов с мгновенными перемещениями → кровавый всплеск
        const U = player.jackUlt;
        if (U) {
            U.t += dt;
            player.invulnTime = Math.max(player.invulnTime, 0.12);
            while (U.t >= 0.5 && U.cuts < 6 && U.t >= 0.5 + U.cuts * 0.15) {
                U.cuts++;
                const foes = enemies.filter(en => en.deadTimer <= 0 && Math.hypot(en.x - U.x, en.y - U.y) < U.R + en.radius);
                if (foes.length) {
                    const en = foes[(U.cuts - 1) % foes.length], a = Math.random() * Math.PI * 2;
                    const px = en.x + Math.cos(a) * (en.radius + 18), py = en.y + Math.sin(a) * (en.radius + 18);
                    if (!isTileBlocked(Math.floor(px / TS), Math.floor(py / TS))) { if (typeof Jack3D !== 'undefined') Jack3D.blink(player.x, player.y, px, py); player.x = px; player.y = py; }
                    player.facingAngle = Math.atan2(en.y - player.y, en.x - player.x);
                    // Разрез по цели и всем рядом с ней
                    enemies.forEach(o => {
                        if (o.deadTimer > 0 || Math.hypot(o.x - en.x, o.y - en.y) > 70 + o.radius) return;
                        const c = this.crit(U.dmg, !!this.mistAt(o.x, o.y)); damageEnemy(o, c.dmg, false, 0, 0, '#dc2626', { crit: c.crit });
                        U.hit.add(o);
                    });
                    player.knightAnim = { kind: U.cuts % 2 ? 'slash' : 'cross', t: 0.14 };
                    if (typeof Jack3D !== 'undefined') Jack3D.slash(player.facingAngle, U.cuts, 1.3);
                }
                if (typeof Feel !== 'undefined') Feel.impact(Math.cos(player.facingAngle), Math.sin(player.facingAngle), 0.6, false);
                SoundFX.play('whoosh');
            }
            if (!U.done && U.t >= 0.5 + 6 * 0.15 + 0.1) {
                U.done = true;
                U.hit.forEach(en => { if (en.deadTimer > 0) return; this.bleed(en, U.bleed, 5); en.jackMark = 4; });
                this.addMist(U.x, U.y, U.R, 4, true);   // кровавый туман: уязвимость поражённых
                spawnFloatingText(player.x, player.y - 56, '🩸 MARIA THE RIPPER', '#fca5a5');
                if (typeof Feel !== 'undefined') Feel.impact(0, 1, 1.4, true);
                if (typeof Jack3D !== 'undefined') Jack3D.bloodBurst(U.x, U.y, U.R);
                SoundFX.play('sunstrike');
            }
            if (U.done && U.t >= 1.7) player.jackUlt = null;
        }
        // Кровотечение и метка уязвимости
        for (const en of enemies) {
            if (en.jackMark > 0) en.jackMark -= dt;
            const w = en.jackWeak; if (w) { w.t -= dt; if (w.t <= 0 || en.deadTimer > 0) { en.dmg = w.dmg; en.armor = w.armor; en.jackWeak = null; } }
            const b = en.jackBleed; if (!b) continue;
            if (en.deadTimer > 0) { en.jackBleed = null; continue; }
            b.t -= dt; b.acc += dt;
            if (b.acc >= 0.5) { b.acc -= 0.5; damageEnemy(en, Math.max(1, Math.round(b.dps * 0.5)), false, 0, 0, '#9f1239'); if (typeof Jack3D !== 'undefined' && Math.random() < 0.5) Jack3D.drip(en); }
            if (b.t <= 0) en.jackBleed = null;
        }
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'jack' && !!(player.jackUlt || player.jackDash); },
    reset() { player.jackQueue = null; player.jackDash = null; player.jackUlt = null; player.jackMists = []; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('jackActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'jackActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = JACK_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnJackLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-slate-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdJack${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-rose-200' : 'text-slate-200'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsJack${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudJackHp', 'Кровь'], ['mp', '2', '🔮', 'hudJackMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'jackTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#cbd5e1">Джек:</span><span id="jackHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('jackHint');
        if (el) el.textContent = player.jackUlt ? 'Мы — ад…' : this.inMist() ? 'В тумане: +20% скорости, уклонение 25%' : 'Туман Уайтчепела';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudJackHp'), b = document.getElementById('hudJackMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ ДЖЕКА: стелющийся туман, серебряные разрезы, багровый туман и кровавый всплеск
// ============================================================================
const Jack3D = {
    T: 48,
    STEEL: [0xe2e8f0, 0xffffff, 0xcbd5e1],
    BLOOD: [0x9f1239, 0xdc2626, 0x7f1d1d, 0xfda4af],
    fx: [], clouds: new Map(), scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        // Мягкое облако тумана (радиальный градиент с клубами)
        const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
        for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 30 + Math.random() * 68, r = 20 + Math.random() * 30, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
        this.puffTex = new THREE.CanvasTexture(c);
        this.slashGeo = new THREE.RingGeometry(0.86, 1, 26, 1, -1, 2); this.slashGeo.rotateX(-Math.PI / 2);
        return true;
    },
    mat(c, op = 1, blend = THREE.AdditiveBlending) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: blend, depthWrite: false, side: THREE.DoubleSide }); },
    add(m, life, upd) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd }); },
    // Тонкие серебряные разрезы (крест-накрест)
    slash(ang, k, scale) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos(), blood = player.jackUlt;
        [[blood ? 0xdc2626 : 0xe2e8f0, 0.9], [0xffffff, 0.7]].forEach(([c, op], i) => {
            const m = new THREE.Mesh(this.slashGeo, this.mat(c, op)); m.position.set(h.x, h.y + 0.7 + i * 0.03, h.z);
            const tilt = (k % 2 ? 0.6 : -0.6) * (i ? 0.9 : 1), r = 0.95 * scale * (i ? 0.92 : 1);
            m.rotation.set(tilt, -ang, (k % 3) * 0.3); m.scale.setScalar(r);
            this.add(m, 0.18, (o, kk) => { o.m.material.opacity = op * (1 - kk); o.m.scale.setScalar(r * (1 + kk * 0.25)); });
        });
        AnimFX.emit({ x: h.x + Math.cos(ang) * 0.9, y: h.y + 0.8, z: h.z + Math.sin(ang) * 0.9, n: 6, color: blood ? this.BLOOD : this.STEEL, speed: 2, life: 0.25, size: 0.04, grav: 3 });
    },
    cutMark(x, y) { const p = this.pos(x, y); AnimFX.blood(p.x, p.y + 0.8, p.z, 8); },
    drip(en) { const p = this.pos(en.x, en.y); AnimFX.blood(p.x, p.y + 0.8, p.z, 4); },
    ghost() { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x, y: h.y + 0.3 + Math.random() * 0.9, z: h.z, n: 4, color: [0x94a3b8, 0xcbd5e1, 0x475569], speed: 0.2, life: 0.4, size: 0.12, sizeEnd: 0.25, grav: 0, drag: 2 }); },
    blink(ax, ay, bx, by) { const a = this.pos(ax, ay), b = this.pos(bx, by); AnimFX.emit({ x: a.x, y: a.y + 0.8, z: a.z, n: 10, color: [0x7f1d1d, 0x475569], speed: 1, life: 0.4, size: 0.12, sizeEnd: 0.3, grav: 0 }); AnimFX.emit({ x: b.x, y: b.y + 0.8, z: b.z, n: 8, color: this.BLOOD, speed: 1.5, life: 0.3, size: 0.06, grav: 2 }); },
    mistBurst(x, y, R, blood) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.05, p.z, blood ? 0x7f1d1d : 0x94a3b8, 0.3, R / this.T, 0.6, 0.7); },
    bloodBurst(x, y, R) {
        const p = this.pos(x, y), r = R / this.T;
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xdc2626, 0.3, r, 0.5, 1); AnimFX.shock(p.x, p.y + 0.8, p.z, 0x9f1239, 0.2, r * 0.6, 0.4, 0.8);
        AnimFX.emit({ gore: true, x: p.x, y: p.y + 0.8, z: p.z, n: 90, color: this.BLOOD, speed: 5, up: 2, life: 1, size: 0.07, grav: 9, r: r * 0.5 });
        AnimFX.flash(p.x, p.z, 0xdc2626, 8, 0.5, 2); AnimFX.kick(1.1);
    },
    // Туман: полупрозрачные клубы на земле, медленно вращаются и дышат; багровый — для кровавого тумана и ульты
    cloud(m) {
        const g = new THREE.Group(), n = Math.round(6 + m.R / 25), col = m.blood ? 0x5a0a14 : 0x8a94a8;
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + Math.random(), d = Math.sqrt(Math.random()) * m.R / this.T * 0.8;
            const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.puffTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending }));
            s.rotation.x = -Math.PI / 2; s.position.set(Math.cos(a) * d, 0.15 + Math.random() * 0.5, Math.sin(a) * d); s.userData.sz = (m.R / this.T) * (0.6 + Math.random() * 0.5); s.userData.sp = (Math.random() - 0.5) * 0.4;
            g.add(s);
        }
        const p = this.pos(m.x, m.y); g.position.set(p.x, p.y, p.z); this.scene.add(g); return g;
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'jack' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) { const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life); if (o.upd) o.upd(o, k); if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); this.fx.splice(i, 1); } }
        const live = new Set(), U = player.heroType === 'jack' ? player.jackUlt : null;
        const all = Jack.mists().concat(U ? [U.mist || (U.mist = { x: U.x, y: U.y, R: U.R, t: 0, dur: 1.7, blood: true, uid: 'ult' })] : []);
        if (U) U.mist.t = U.t;
        for (const m of all) {
            live.add(m.uid);
            let g = this.clouds.get(m.uid); if (!g) { g = this.cloud(m); this.clouds.set(m.uid, g); }
            const fade = Math.min(1, m.t / 0.4) * Math.min(1, (m.dur - m.t) / 0.6);
            g.children.forEach((s, i) => { s.rotation.z += dt * s.userData.sp; const br = 1 + Math.sin(Engine3D.t * 0.8 + i) * 0.06; s.scale.setScalar(s.userData.sz * br * (0.6 + 0.4 * Math.min(1, m.t / 0.4))); s.material.opacity = (m.blood ? 0.55 : 0.42) * fade; });
            if (m.blood && Math.random() < 0.3) { const a = Math.random() * Math.PI * 2, rr = Math.random() * m.R / this.T; AnimFX.emit({ x: g.position.x + Math.cos(a) * rr, y: g.position.y + 0.2, z: g.position.z + Math.sin(a) * rr, n: 1, color: this.BLOOD, speed: 0.1, up: 0.5, life: 0.8, size: 0.05, grav: -0.3 }); }
        }
        for (const [uid, g] of this.clouds) if (!live.has(uid)) { this.scene.remove(g); g.children.forEach(s => { s.geometry.dispose(); s.material.dispose(); }); this.clouds.delete(uid); }
        if (player.heroType !== 'jack') return;
        // Джек в тумане — полупрозрачен (маскировка); в ульте растворяется почти полностью
        const A = typeof Actors3D !== 'undefined' && Actors3D.player;
        if (A) { const want = U ? 0.35 : (Jack.inMist() ? 0.6 : 1); if (A.jackOp !== want) { A.jackOp = want; A.mats.forEach(m => { if (m.userData.t0 === undefined) m.userData.t0 = m.transparent; m.transparent = want < 1 ? true : m.userData.t0; m.opacity = want; m.needsUpdate = true; }); } }
        for (const en of enemies) if (en.jackMark > 0 && en.deadTimer <= 0 && Math.random() < 0.15) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 1.2, z: q.z, n: 1, color: this.BLOOD, speed: 0.3, up: 0.6, life: 0.6, size: 0.05, grav: 1 }); }
        if (U) { Engine3D.scene.fog.color.lerp(new THREE.Color(0x2a0508), 0.2); Engine3D.scene.background.copy(Engine3D.scene.fog.color); }
    },
    fxRunes() {
        if (player.heroType !== 'jack') return;
        for (const m of Jack.mists()) { const p = this.pos(m.x, m.y); FX3D.runeAt(m, m.blood ? 0x9f1239 : 0x64748b, p.x, p.z, m.R / this.T, Math.min(1, m.t / 0.3) * Math.min(1, (m.dur - m.t) / 0.5), { spin: 0.3, op: 0.45 }); }
        const U = player.jackUlt; if (U && !U.done) { const p = this.pos(U.x, U.y); FX3D.runeAt(U, 0xdc2626, p.x, p.z, U.R / this.T, Math.min(1, U.t / 0.5), { crack: 0.8, spin: 2 }); }
    }
};
