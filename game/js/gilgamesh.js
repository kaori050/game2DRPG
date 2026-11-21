// ============================================================================
// ГИЛЬГАМЕШ (класс «Лучник»): Король Героев, Врата Вавилона
// ============================================================================
// Стрелок без лука: каждый выстрел — легендарное оружие из золотого портала-ряби в воздухе.
// Хрупкий (мало брони), но с огромной огневой мощью издалека. Навыки открываются по уровням героя.
// Q Врата Вавилона — порталы позади и по бокам; залп клинков и копий к курсору. Каждый Фантазм пробивает одного врага.
// W Цепи Небес: Энкиду — порталы вокруг области, цепи сковывают врагов, сбивают замахи и касты (боссов — втрое короче).
//   Скованные получают на 20% больше урона от Фантазмов.
// E Сокровищница Царя — полукруг порталов над полем, дождь крупных Фантазмов: золотые взрывы, оглушение, отбрасывание.
// R Эа: Энума Элиш — Царь извлекает меч разрыва, раскручивает три цилиндра и выпускает багрово-чёрный поток по широкой линии.
const GIL_SKILLS = {
    q: { key: 'q', name: 'Gate of Babylon', ruName: 'Врата Вавилона', icon: '🌀', manaCost: 28, baseCd: 4,
         desc: 'Позади и по бокам от Царя в воздухе открываются золотые порталы, и из них к курсору летит залп легендарных клинков и копий. Каждый Фантазм пробивает одного врага насквозь. С ростом навыка — больше порталов и плотнее залп.',
         stats: l => `Порталов: ${Gil.gates(l)} • Фантазмов: ${Gil.gates(l) * Gil.perGate(l)} • урон каждого ${32 + 14 * l} + сила • перезарядка 4с` },
    w: { key: 'w', name: 'Enkidu — Chains of Heaven', ruName: 'Цепи Небес: Энкиду', icon: '⛓️', manaCost: 75, baseCd: 15,
         desc: 'Из порталов вокруг указанной области вырываются золотые цепи и сковывают врагов: они не двигаются и не бьют, их замахи и касты сбиваются. Боссов цепи держат втрое короче, но каст всё равно прерывают. Скованные получают на 20% больше урона от Врат.',
         stats: l => `Сковывание ${(1.3 + 0.2 * l).toFixed(1)}с • урон ${45 + 22 * l} + сила • радиус ${100 + 8 * l} • перезарядка ${Math.max(9, 15 - 0.5 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Royal Treasury', ruName: 'Сокровищница Царя', icon: '💰', manaCost: 100, baseCd: 18,
         desc: 'Царь раскрывает полукруг порталов над полем боя, и на выбранную зону обрушивается дождь особо крупных Фантазмов. Каждый взрывается золотом, оглушает и отбрасывает врагов.',
         stats: l => `Фантазмов: ${8 + 2 * l} • взрыв ${60 + 30 * l} + сила в радиусе 70 • оглушение 0.5с • зона ${150 + 10 * l} • перезарядка ${18 - l}с` },
    r: { key: 'r', name: 'Ea — Enuma Elish', ruName: 'Эа: Энума Элиш', icon: '🌌', manaCost: 220, baseCd: 100,
         desc: 'Ультимейт. Звезда Творения, Разделившая Небо и Землю: Царь извлекает из Врат меч разрыва Эа, раскручивает три цилиндра в багрово-золотой вихрь и выпускает разрывающий пространство поток вперёд по широкой линии. Пока меч раскручивается, Царь не может двигаться — целься заранее.',
         stats: l => `Раскрутка 1.4с • поток ${GIL_EA.len} × ${150 + 20 * l} • урон ${700 + 350 * l} + сила за 0.9с • отбрасывание • перезарядка ${100 - 5 * l}с` }
};
const GIL_EA = { len: 640, wind: 1.4, fire: 0.9, ticks: 6 };

const Gil = {
    gates(l) { return Math.min(10, 3 + l); },
    perGate(l) { return 1 + Math.floor(l / 3); },
    amp() { return 1 + (player.spellAmp || 0) / 100; },
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(150 + L * 24 + eq.hp);
        player.maxMp = Math.round(240 + L * 28 + (q + w + e) * 8 + eq.mp);
        player.hpRegen = +(2 + L * 0.25).toFixed(1);
        player.mpRegen = +(6 + L * 0.45 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(24 + L * 6 + eq.hand);
        player.spellAmp = Math.round(10 + L * 3 + r * 5 + eq.amp);
        player.armor = Math.round(2 + L * 0.35 + eq.armor);
        player.moveSpeed = 200;
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        player.attackInterval = 0.62;
        player.attackRange = 430;
        player.critChance = 8 + eq.crit; player.critMult = 1.75;
    },
    ready(key) {
        const sk = GIL_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.gilQueue = player.gilQueue || []).push({ t, fn }); },
    clampTo(range) {
        let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
        if (d > range) { tx = player.x + (tx - player.x) / d * range; ty = player.y + (ty - player.y) / d * range; }
        return { x: tx, y: ty };
    },
    // Фантазм из портала: летит к точке, пробивает pierce врагов
    shoot(x, y, h0, tx, ty, dmg, o = {}) {
        const ang = Math.atan2(ty - y, tx - x), sp = o.sp || 780, range = o.range || player.attackRange + 140;
        const crit = Math.random() * 100 < (player.critChance || 0);
        projectiles.push({ kind: 'gob', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, radius: o.r || 10, dmg: Math.round(dmg * (crit ? player.critMult : 1)), crit,
            fromPlayer: true, isSpell: false, color: '#fde047', life: range / sp, life0: range / sp, h0: h0 || 60, pierce: o.pierce === undefined ? 1 : o.pierce,
            hitIds: new Set(), wtype: o.wtype === undefined ? Math.floor(Math.random() * 4) : o.wtype, big: !!o.big });
    },
    // Попадание Фантазма (вызывается из onPlayerProjectileHit); true — снаряд исчезает
    onHit(p, en) {
        let dmg = p.dmg; if (en.enkidu > 0) dmg *= 1.2;
        damageEnemy(en, Math.round(dmg), false, p.vx * 0.05, p.vy * 0.05, '#fde047', { crit: p.crit });
        p.hitIds.add(en.uid);
        if (typeof Gil3D !== 'undefined') Gil3D.spark(en.x, en.y, p.crit);
        if (p.pierce > 0) { p.pierce--; return false; }
        return true;
    },
    // Базовая атака: один Фантазм из портала у плеча
    attack() {
        player.basicAttackCd = player.attackInterval;
        player.castAnimTime = 0.2;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        const side = (this.side = -(this.side || 1)), px = player.x - Math.cos(ang) * 14 - Math.sin(ang) * 26 * side, py = player.y - Math.sin(ang) * 14 + Math.cos(ang) * 26 * side;
        if (typeof Gil3D !== 'undefined') Gil3D.portal(px, py, 62, ax, ay, 0.4, 0.55);
        this.later(0.08, () => this.shoot(px, py, 62, ax, ay, player.handDmg, { pierce: 0, sp: 820 }));
        SoundFX.play('orb');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), A = this.amp();
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            // Порталы дугой позади и по бокам; все бьют в точку курсора — сходящийся веер
            const n = this.gates(lvl), per = this.perGate(lvl), dmg = (32 + 14 * lvl) * A, tx = mouseWorldX, ty = mouseWorldY;
            for (let i = 0; i < n; i++) {
                const s = n > 1 ? i / (n - 1) * 2 - 1 : 0, back = 18 + 30 * (1 - Math.abs(s)), wide = 34 + 18 * n;
                const px = player.x - cx * back - cy * s * wide * 0.5, py = player.y - cy * back + cx * s * wide * 0.5, h = 46 + ((i * 37) % 60);
                const d0 = 0.05 + i * 0.045;
                this.later(d0 * 0.6, () => { if (typeof Gil3D !== 'undefined') Gil3D.portal(px, py, h, tx, ty, 0.55 + per * 0.18, 0.75); });
                for (let k = 0; k < per; k++) this.later(d0 + 0.1 + k * 0.16, () => this.shoot(px, py, h, tx + (Math.random() - 0.5) * 40, ty + (Math.random() - 0.5) * 40, dmg));
            }
            player.knightAnim = { kind: 'gate', t: 0.4 };
            this.cd('q', GIL_SKILLS.q.baseCd); SoundFX.play('bolt');
        } else if (key === 'w') {
            const p = this.clampTo(480), R = 100 + 8 * lvl, dur = 1.3 + 0.2 * lvl, dmg = (45 + 22 * lvl) * A;
            const caught = enemies.filter(en => en.deadTimer <= 0 && Math.hypot(en.x - p.x, en.y - p.y) < R + en.radius);
            player.gilChains = (player.gilChains || []).filter(c => c.t > 0);
            caught.forEach((en, i) => {
                this.interrupt(en);
                en.stunTimer = Math.max(en.stunTimer || 0, dur);   // у боссов таймер контроля тает втрое быстрее
                en.enkidu = dur + 0.6;
                damageEnemy(en, Math.round(dmg), true, 0, 0, '#fde68a');
                const t = en.isBoss ? dur / 3 : dur;
                player.gilChains.push({ en, t, max: t, seed: i * 1.7 + Math.random() });
            });
            if (typeof Gil3D !== 'undefined') Gil3D.enkidu(p.x, p.y, R, caught.length);
            if (caught.length) spawnFloatingText(p.x, p.y - 50, caught.some(e => e.isBoss) ? '⛓️ ЭНКИДУ — КАСТ СБИТ' : `⛓️ СКОВАНО: ${caught.length}`, '#fde68a');
            player.knightAnim = { kind: 'chains', t: 0.45 };
            this.cd('w', Math.max(9, GIL_SKILLS.w.baseCd - 0.5 * lvl)); SoundFX.play('emp');
        } else if (key === 'e') {
            const p = this.clampTo(520), R = 150 + 10 * lvl, n = 8 + 2 * lvl, dmg = (60 + 30 * lvl) * A, span = 1.1;
            const drops = [];
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.92;
                drops.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, at: 0.4 + i * span / n + Math.random() * 0.05, gate: i % Math.min(9, 5 + lvl), done: false, wtype: i % 4 });
            }
            player.gilRain = { x: p.x, y: p.y, R, t: 0, dur: 0.4 + span + 0.7, dmg, drops, gates: Math.min(9, 5 + lvl), fromAng: Math.atan2(player.y - p.y, player.x - p.x) };
            if (typeof Gil3D !== 'undefined') Gil3D.treasury(player.gilRain);
            player.knightAnim = { kind: 'treasury', t: 0.85 };
            this.cd('e', GIL_SKILLS.e.baseCd - lvl); SoundFX.play('invoke');
        } else if (key === 'r') {
            player.gilUlt = { t: 0, wind: GIL_EA.wind, fire: GIL_EA.fire, ang, len: GIL_EA.len, W: 150 + 20 * lvl, dmg: (700 + 350 * lvl) * A, ticks: 0, fired: false };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = { kind: 'eaDraw', t: 0.6 };
            this.cd('r', GIL_SKILLS.r.baseCd - 5 * lvl);
            SoundFX.play('invoke'); SoundFX.play('thunder');
            zoneBanner = { title: 'ЭА', sub: 'Звезда Творения, Разделившая Небо и Землю', life: 2.4, maxLife: 2.4, color: '#fca5a5' };
            if (typeof Gil3D !== 'undefined') Gil3D.eaStart();
        }
        updateInvokerBarUI();
    },
    // Энкиду сбивает замахи и касты: обезоруживание, сброс особых атак, прерывание поглощения/заряда боссов
    interrupt(en) {
        en.disarmTimer = Math.max(en.disarmTimer || 0, en.isBoss ? 0.7 : 1.3);
        en.attackCd = Math.max(en.attackCd || 0, 0.8);
        if (en.specialCd !== undefined) en.specialCd = Math.max(en.specialCd, 2.2);
        en.leapT = 0;
        if (en.state === 'drain' || en.state === 'charge') { en.state = 'chase'; en.stateT = 0; spawnFloatingText(en.x, en.y - 44, 'ПРЕРВАНО!', '#fde047'); }
    },
    update(dt) {
        if (player.heroType !== 'gilgamesh') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.gilQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        for (const en of enemies) if (en.enkidu > 0) en.enkidu -= dt;
        const C = player.gilChains;
        if (C) for (let i = C.length - 1; i >= 0; i--) { const c = C[i]; c.t -= dt; if (c.t <= 0 || c.en.deadTimer > 0) C.splice(i, 1); }
        // Сокровищница: Фантазмы падают по расписанию
        const Rn = player.gilRain;
        if (Rn) {
            Rn.t += dt;
            for (const d of Rn.drops) {
                if (d.done || Rn.t < d.at) continue;
                d.done = true;
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const dx = en.x - d.x, dy = en.y - d.y, dist = Math.hypot(dx, dy);
                    if (dist > 70 + en.radius) return;
                    damageEnemy(en, Math.round(Rn.dmg * (en.enkidu > 0 ? 1.2 : 1)), true, 0, 0, '#fbbf24');
                    en.stunTimer = Math.max(en.stunTimer || 0, 0.5);
                    if (!en.isBoss && dist > 1) tryMoveEntity(en, dx / dist * 34, dy / dist * 34);
                });
                if (typeof Gil3D !== 'undefined') Gil3D.boom(d);
            }
            if (Rn.t >= Rn.dur) player.gilRain = null;
        }
        // Эа: раскрутка → поток
        const U = player.gilUlt;
        if (U) {
            U.t += dt;
            if (U.t < U.wind) {   // пока меч раскручивается, можно чуть довернуть прицел
                const want = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
                let d = want - U.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
                U.ang += Math.max(-dt * 1.2, Math.min(dt * 1.2, d));
            }
            player.facingAngle = U.ang;
            if (!U.fired && U.t >= U.wind) {
                U.fired = true;
                player.knightAnim = { kind: 'ultcast', t: U.fire };
                spawnFloatingText(player.x, player.y - 60, '🌌 ENUMA ELISH', '#fca5a5');
                SoundFX.play('sunstrike'); SoundFX.play('meteor');
                if (typeof Feel !== 'undefined') Feel.impact(Math.cos(U.ang), Math.sin(U.ang), 1.5, true);
                if (typeof Gil3D !== 'undefined') Gil3D.eaFire(U);
            }
            const ft = U.t - U.wind;
            while (U.fired && U.ticks < GIL_EA.ticks && ft >= U.ticks * U.fire / GIL_EA.ticks) {
                U.ticks++;
                const ca = Math.cos(U.ang), sa = Math.sin(U.ang), ox = player.x + ca * 30, oy = player.y + sa * 30;
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const rx = en.x - ox, ry = en.y - oy, along = rx * ca + ry * sa, perp = Math.abs(-rx * sa + ry * ca);
                    const half = U.W / 2 * (0.6 + 0.4 * Math.max(0, along) / U.len);
                    if (along < -en.radius || along > U.len + en.radius || perp > half + en.radius) return;
                    damageEnemy(en, Math.round(U.dmg / GIL_EA.ticks), true, ca * 4, sa * 4, '#f87171');
                    if (!en.isBoss) tryMoveEntity(en, ca * 26, sa * 26);
                });
                // Поток рвёт вражеские снаряды и заклинания на своём пути
                const inBeam = (x, y) => { const rx = x - ox, ry = y - oy, al = rx * ca + ry * sa; return al > -20 && al < U.len && Math.abs(-rx * sa + ry * ca) < U.W / 2 + 20; };
                projectiles = projectiles.filter(p => p.fromPlayer || !inBeam(p.x, p.y));
                enemyHazards = enemyHazards.filter(h => !inBeam(h.x, h.y));
                if (typeof Feel !== 'undefined') Feel.shake(ca, sa, 0.22, 16, 5);
                triggerScreenShake(6);
            }
            if (U.t >= U.wind + U.fire + 0.25) player.gilUlt = null;
        }
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'gilgamesh' && !!player.gilUlt; },
    reset() { player.gilUlt = null; player.gilRain = null; player.gilQueue = null; player.gilChains = []; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('gilActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'gilActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = GIL_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnGilLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-amber-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdGil${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-amber-200' : 'text-amber-100'} mt-1">${sk.ruName.split(/[ :]/)[0]}</span>
                <div id="pipsGil${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudGilHp', 'Кровь'], ['mp', '2', '🔮', 'hudGilMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'gilTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#fde68a">Гильгамеш:</span><span id="gilHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('gilHint'), n = (player.gilChains || []).length;
        if (el) el.textContent = player.gilUlt ? 'Эа пробуждается…' : n ? `Скованы Энкиду: ${n}` : 'Врата Вавилона открыты';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudGilHp'), b = document.getElementById('hudGilMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ ГИЛЬГАМЕША: золотые порталы-рябь, цепи Энкиду, дождь Фантазмов, меч Эа и поток Энума Элиш
// ============================================================================
const Gil3D = {
    T: 48,
    GOLD: [0xfde047, 0xfbbf24, 0xf59e0b, 0xffffff],
    CRIMSON: [0xdc2626, 0x7f1d1d, 0xf87171, 0xfbbf24],
    portals: [], chains: new Map(), falls: [], scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        // Текстура портала: концентрические золотые кольца ряби, яркий обод, тёмная глубина в центре
        const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        const rg = g.createRadialGradient(128, 128, 4, 128, 128, 126);
        rg.addColorStop(0, 'rgba(40,20,0,0)'); rg.addColorStop(0.35, 'rgba(120,70,0,0.35)'); rg.addColorStop(0.78, 'rgba(255,200,60,0.85)'); rg.addColorStop(0.9, 'rgba(255,245,190,1)'); rg.addColorStop(1, 'rgba(255,200,60,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(128, 128, 30 + i * 16, 0, Math.PI * 2); g.strokeStyle = `rgba(255,${200 + i * 8},${80 + i * 20},${0.25 + i * 0.05})`; g.lineWidth = 2.5; g.stroke(); }
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 40, 128 + Math.sin(a) * 40); g.quadraticCurveTo(128 + Math.cos(a + 0.5) * 80, 128 + Math.sin(a + 0.5) * 80, 128 + Math.cos(a + 0.9) * 112, 128 + Math.sin(a + 0.9) * 112); g.strokeStyle = 'rgba(255,220,120,0.22)'; g.lineWidth = 2; g.stroke(); }
        this.portalTex = new THREE.CanvasTexture(c); this.portalTex.encoding = THREE.sRGBEncoding;
        this.portalGeo = new THREE.PlaneGeometry(1, 1);
        // Звенья цепи
        const k = document.createElement('canvas'); k.width = 32; k.height = 64; const q = k.getContext('2d');
        q.fillStyle = '#5a3a08'; q.fillRect(0, 0, 32, 64);
        const link = (y, w) => { q.beginPath(); q.ellipse(16, y, w, 13, 0, 0, Math.PI * 2); q.strokeStyle = '#ffe9a0'; q.lineWidth = 5; q.stroke(); q.strokeStyle = '#b8860b'; q.lineWidth = 2; q.stroke(); };
        link(16, 9); link(48, 5);
        this.chainTex = new THREE.CanvasTexture(k); this.chainTex.wrapS = this.chainTex.wrapT = THREE.RepeatWrapping; this.chainTex.encoding = THREE.sRGBEncoding;
        this.chainGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 8, 1, true); this.chainGeo.translate(0, 0.5, 0);
        // Спиральная текстура потока Эа
        const s = document.createElement('canvas'); s.width = 128; s.height = 256; const h = s.getContext('2d');
        h.fillStyle = '#000'; h.fillRect(0, 0, 128, 256);
        for (let i = 0; i < 7; i++) { const y0 = i * 40; const gr = h.createLinearGradient(0, y0, 128, y0 + 60); gr.addColorStop(0, 'rgba(255,40,30,0)'); gr.addColorStop(0.5, 'rgba(255,60,40,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); h.strokeStyle = gr; h.lineWidth = 10; h.beginPath(); h.moveTo(0, y0); h.lineTo(128, y0 + 60); h.stroke(); }
        this.spiralTex = new THREE.CanvasTexture(s); this.spiralTex.wrapS = this.spiralTex.wrapT = THREE.RepeatWrapping;
        return true;
    },
    // Портал-рябь в точке (x, y) на высоте h (пиксели), повёрнутый к цели (tx, ty)
    portal(x, y, h, tx, ty, life = 0.6, size = 0.7, opts = {}) {
        if (!this.ensure()) return null;
        const p = this.pos(x, y), g = new THREE.Group();
        const mk = (op, sc, col) => { const m = new THREE.Mesh(this.portalGeo, new THREE.MeshBasicMaterial({ map: this.portalTex, color: col || 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.scale.setScalar(sc); g.add(m); return m; };
        const a = mk(1, 1, opts.color), b = mk(0.7, 0.72, opts.color2 || 0xffd27a);
        g.position.set(p.x, p.y + h / this.T * 1.2, p.z);
        if (opts.down) g.lookAt(p.x + (opts.lx || 0), p.y - 10, p.z + (opts.lz || 0));
        else { const q = this.pos(tx, ty); g.lookAt(q.x, g.position.y - 0.25, q.z); }
        g.scale.setScalar(0.01); this.scene.add(g);
        const o = { g, a, b, t: 0, life, size, op: opts.op || 1, spin: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2) };
        this.portals.push(o);
        AnimFX.emit({ x: g.position.x, y: g.position.y, z: g.position.z, n: 8, color: this.GOLD, speed: 1.2, life: 0.35, size: 0.04, grav: 0, drag: 2 });
        return o;
    },
    spark(x, y, crit) {
        const p = this.pos(x, y);
        AnimFX.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: crit ? 22 : 10, color: this.GOLD, speed: crit ? 3 : 2, up: 1, life: 0.35, size: 0.05, grav: 5 });
        if (crit) AnimFX.shock(p.x, p.y + 0.8, p.z, 0xfde047, 0.1, 0.7, 0.25);
    },
    // Энкиду: кольцо порталов вокруг области; цепи к каждому скованному врагу рисует update()
    enkidu(x, y, R, n) {
        if (!this.ensure()) return;
        const p = this.pos(x, y), r = R / this.T, k = Math.max(6, Math.min(10, 4 + n * 2));
        for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; this.portal(x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * 1.05, 40 + (i % 2) * 30, x, y, 1.2, 0.6); }
        AnimFX.shock(p.x, p.y + 0.05, p.z, 0xfde047, r * 1.1, r * 0.2, 0.5, 0.9);
        AnimFX.flash(p.x, p.z, 0xfbbf24, 4, 0.4, 1.6);
        Sfx3D.play('impact', 0.6);
    },
    // Сокровищница: полукруг порталов над полем, обращённых вниз к зоне
    treasury(Rn) {
        if (!this.ensure()) return;
        const p = this.pos(Rn.x, Rn.y), R = Rn.R;
        Rn.gatePos = [];
        for (let i = 0; i < Rn.gates; i++) {
            const a = Rn.fromAng + (i / Math.max(1, Rn.gates - 1) - 0.5) * Math.PI * 1.1, gx = Rn.x + Math.cos(a) * R * 0.85, gy = Rn.y + Math.sin(a) * R * 0.85;
            const gh = 120 + (i % 3) * 18, o = this.portal(gx, gy, gh, 0, 0, Rn.dur, 0.85, { down: true, op: 0.6, lx: (Rn.x - gx) / this.T * 0.9, lz: (Rn.y - gy) / this.T * 0.9 });
            Rn.gatePos.push({ x: gx, y: gy, h: gh / this.T * 1.2, o });
        }
        for (const d of Rn.drops) this.falls.push({ d, Rn, m: null });
        AnimFX.flash(p.x, p.z, 0xfbbf24, 3, 0.5, 4);
    },
    boom(d) {
        const p = this.pos(d.x, d.y);
        AnimFX.impact(p.x, p.z, 0xfbbf24, 1.3, { dust: 0x6a5020 });
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfbbf24, 0.1, 1.4, 0.35, 0.6);
        AnimFX.emit({ x: p.x, y: p.y + 0.5, z: p.z, n: 26, color: this.GOLD, speed: 4, up: 2.5, life: 0.55, size: 0.06, grav: 8 });
        AnimFX.flash(p.x, p.z, 0xfbbf24, 3, 0.2, 1.2);
        AnimFX.kick(0.3); Sfx3D.play('impact', 0.8);
    },
    // Крупный Фантазм для дождя Сокровищницы
    bigWeapon(wtype) {
        const B = Models3D, w = wtype % 4;
        const m = w === 1 ? this.spear(1.9) : w === 2 ? B.axe(0xe8c860) : B.sword(0xf4f1e6, 0xd4a020, w === 3 ? 1.5 : 1.1, { emissive: 0xffb020, emissiveIntensity: 0.45 });
        const g = new THREE.Group(); m.scale.multiplyScalar(w === 2 ? 1.6 : 1.5); g.add(m); g.add(B.glow(0xffc84a, 1.4));
        return g;
    },
    spear(len = 1.1) {
        const B = Models3D, g = new THREE.Group();
        g.add(B.at(B.m(B.cylGeo(0.018, 0.022, len, 10), 0xc8a040, 'gold'), 0, len * 0.5 - 0.1, 0));
        const head = B.m(B.geo('gilSpearHead', () => new THREE.ConeGeometry(0.06, 0.32, 4)), 0xf0f4ff, 'metal', { emissive: 0xffd060, emissiveIntensity: 0.4 });
        head.position.y = len - 0.02; g.add(head);
        g.add(B.at(B.m(B.sphGeo(0.04), 0xd4a020, 'gold'), 0, len * 0.72, 0));
        g.rotation.x = Math.PI / 2; g.userData.len = len; return g;
    },
    // ---------- Эа ----------
    eaStart() {
        if (!this.ensure()) return;
        const g = new THREE.Group(), B = Models3D;
        const dark = (r0, r1, l) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, l, 18, 1), new THREE.MeshStandardMaterial({ color: 0x1a0c0a, metalness: 0.8, roughness: 0.35, emissive: 0xc0101a, emissiveMap: this.spiralTex, emissiveIntensity: 1.6 })); return m; };
        const segs = [dark(0.12, 0.1, 0.36), dark(0.1, 0.075, 0.34), dark(0.075, 0.035, 0.34)];
        segs.forEach((m, i) => { m.position.y = 0.22 + i * 0.355; g.add(m); });
        g.add(B.at(B.m(B.cylGeo(0.03, 0.03, 0.22, 10), 0xd4a020, 'gold'), 0, -0.02, 0));
        g.add(B.at(B.m(B.rboxGeo(0.28, 0.05, 0.07, 0.02), 0xd4a020, 'gold'), 0, 0.06, 0));
        const glow = B.glow(0xff3020, 2.2); glow.position.y = 0.6; g.add(glow);
        const pivot = new THREE.Group(); g.rotation.x = Math.PI / 2; pivot.add(g); pivot.scale.setScalar(0.01);
        this.scene.add(pivot);
        this.ea = { pivot, g, segs, glow, t: 0, rings: [], beam: null };
        const hp = AnimFX.heroPos();
        this.portal(player.x - Math.cos(player.facingAngle) * 20, player.y - Math.sin(player.facingAngle) * 20, 70, player.x + Math.cos(player.facingAngle) * 100, player.y + Math.sin(player.facingAngle) * 100, 0.9, 1.4);
        AnimFX.flash(hp.x, hp.z, 0xff3020, 4, 0.6, 2);
    },
    eaFire(U) {
        if (!this.ea) return;
        const mk = (r0, r1, col, op, blend) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, map: this.spiralTex, transparent: true, opacity: op, blending: blend, depthWrite: false, side: THREE.DoubleSide })); m.geometry.translate(0, 0.5, 0); m.geometry.rotateX(Math.PI / 2); return m; };
        const W = U.W / this.T, beam = new THREE.Group();
        const core = mk(W * 0.12, W * 0.26, 0x1a0303, 0.72, THREE.NormalBlending);
        const red = mk(W * 0.32, W * 0.52, 0xff2a1a, 0.85, THREE.AdditiveBlending);
        const gold = mk(W * 0.22, W * 0.4, 0xffc040, 0.55, THREE.AdditiveBlending);
        const halo = mk(W * 0.45, W * 0.62, 0x7f0a0a, 0.35, THREE.AdditiveBlending);
        [halo, red, gold, core].forEach(m => beam.add(m));
        beam.scale.set(1, 1, 0.01); this.scene.add(beam);
        this.ea.beam = { g: beam, core, red, gold, halo, t: 0, len: U.len / this.T };
        const hp = AnimFX.heroPos();
        AnimFX.flash(hp.x, hp.z, 0xff2020, 12, 0.9, 3);
        AnimFX.kick(1.4);
    },
    eaEnd() {
        const E = this.ea; if (!E) return;
        this.scene.remove(E.pivot); if (E.beam) this.scene.remove(E.beam.g);
        E.rings.forEach(r => this.scene.remove(r.m));
        [E.pivot, E.beam && E.beam.g].forEach(o => o && o.traverse(m => { if (m.material && !m.material.userData.cached) m.material.dispose(); }));
        this.ea = null;
    },
    updateEa(dt) {
        const U = player.heroType === 'gilgamesh' ? player.gilUlt : null, E = this.ea;
        if (!U) { if (E) this.eaEnd(); return; }
        if (!E) return;
        E.t += dt;
        const hp = AnimFX.heroPos(), ca = Math.cos(U.ang), sa = Math.sin(U.ang), yaw = Math.atan2(ca, sa);
        const wind = Math.min(1, U.t / U.wind), tip = new THREE.Vector3(hp.x + ca * 0.55, hp.y + 1.05, hp.z + sa * 0.55);
        // Меч: появляется из портала, нацелен вперёд; цилиндры раскручиваются всё быстрее и в разные стороны
        E.pivot.position.copy(tip); E.pivot.rotation.set(0, yaw, 0);
        E.pivot.scale.setScalar(Math.min(1.6, 0.01 + E.t * 3.5));
        const spin = 2 + wind * wind * 40;
        E.segs.forEach((m, i) => { m.rotation.y += dt * spin * (i % 2 ? -1 : 1) * (1 + i * 0.35); m.material.emissiveIntensity = 1.2 + wind * 2.5 + Math.sin(E.t * 30) * 0.3; });
        E.glow.scale.setScalar(1.5 + wind * 3);
        // Вихрь: частицы и пыль стягиваются к острию, вертикальные кольца искажения
        const front = tip.clone().add(new THREE.Vector3(ca * 1.2, 0, sa * 1.2));
        if (!U.fired) {
            for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2.5; AnimFX.emit({ x: front.x + Math.cos(a) * r, y: hp.y + 0.2 + Math.random() * 2, z: front.z + Math.sin(a) * r, n: 1, color: Math.random() < 0.6 ? this.CRIMSON : this.GOLD, speed: 0.3, life: 0.6, size: 0.08, grav: 0, drag: 1, pull: { x: front.x, y: front.y, z: front.z, k: 6 + wind * 10 } }); }
            if (Math.random() < dt * (4 + wind * 14)) {
                const m = new THREE.Mesh(this.portalGeo, new THREE.MeshBasicMaterial({ map: this.portalTex, color: Math.random() < 0.5 ? 0xff3020 : 0x8a0a0a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
                m.position.copy(front); m.lookAt(front.x + ca, front.y, front.z + sa); m.scale.setScalar(3.5 - wind * 1.5); this.scene.add(m);
                E.rings.push({ m, t: 0, life: 0.45, s0: m.scale.x });
            }
            if (Math.random() < dt * 10 * wind) Frank3D.bolt(front.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2)), front.clone(), 0.12, 0.03, 1, 'v');
            if (Math.random() < dt * 6) AnimFX.kick(0.12 + wind * 0.25);
        }
        for (let i = E.rings.length - 1; i >= 0; i--) { const r = E.rings[i]; r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(r.s0 * (1 - k * 0.8)); r.m.material.opacity = 0.8 * (1 - k); r.m.rotation.z += dt * 6; if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); E.rings.splice(i, 1); } }
        // Поток: растёт на всю длину, спираль бежит вперёд, к концу тает
        const B = E.beam;
        if (B) {
            B.t += dt;
            const grow = Math.min(1, B.t / 0.14), fade = Math.max(0, Math.min(1, (U.wind + U.fire + 0.25 - U.t) / 0.3));
            B.g.position.copy(tip); B.g.rotation.set(0, yaw, 0);
            B.g.scale.set(0.6 + 0.4 * fade + Math.sin(B.t * 40) * 0.04, 0.6 + 0.4 * fade + Math.cos(B.t * 37) * 0.04, B.len * grow);
            this.spiralTex.offset.y -= dt * 4;
            B.red.material.opacity = 0.85 * fade; B.gold.material.opacity = 0.55 * fade; B.halo.material.opacity = 0.35 * fade; B.core.material.opacity = 0.72 * fade;
            B.red.rotation.z += dt * 9; B.gold.rotation.z -= dt * 13;
            // Земля трескается вдоль потока: вспышки и куски грунта
            if (fade > 0.2) for (let i = 0; i < 2; i++) {
                const d = Math.random() * B.len * grow, x = tip.x + ca * d, z = tip.z + sa * d, off = (Math.random() - 0.5) * U.W / this.T * 0.7;
                AnimFX.emit({ x: x - sa * off, y: World3D.hAt(x, z) + 0.1, z: z + ca * off, n: 3, color: [0x3a1a10, 0x6a2a18, 0xff4020], speed: 2, up: 3, life: 0.8, size: 0.1, grav: 9 });
            }
            if (Math.random() < 0.4) AnimFX.flash(tip.x + ca * B.len * 0.5, tip.z + sa * B.len * 0.5, 0xff2010, 8 * fade, 0.15, 2);
        }
        // Небо темнеет до багрово-чёрного
        Engine3D.scene.fog.color.lerp(new THREE.Color(U.fired ? 0x2a0204 : 0x1a0608), 0.15 + wind * 0.15); Engine3D.scene.background.copy(Engine3D.scene.fog.color);
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'gilgamesh') return; if (!this.ensure()) return; }
        // Порталы: раскрытие с перелётом, вращение ряби, угасание
        for (let i = this.portals.length - 1; i >= 0; i--) {
            const o = this.portals[i]; o.t += dt;
            const open = Math.min(1, o.t / 0.14), close = Math.max(0, Math.min(1, (o.life - o.t) / 0.2));
            const s = o.size * (open < 1 ? Actors3D.ease ? Actors3D.ease.back(open) : open : 1) * (0.25 + 0.75 * close);
            o.g.scale.setScalar(Math.max(0.01, s));
            o.a.rotation.z += dt * o.spin; o.b.rotation.z -= dt * o.spin * 1.6;
            o.a.material.opacity = close * o.op; o.b.material.opacity = 0.7 * close * o.op * (0.8 + Math.sin(o.t * 18) * 0.2);
            if (o.t >= o.life) { this.scene.remove(o.g); o.a.material.dispose(); o.b.material.dispose(); this.portals.splice(i, 1); }
        }
        // Цепи Энкиду: из трёх порталов вокруг скованного врага
        const C = player.heroType === 'gilgamesh' ? (player.gilChains || []) : [], seen = new Set();
        for (const c of C) {
            const en = c.en; if (en.deadTimer > 0) continue;
            const p = this.pos(en.x, en.y);
            for (let j = 0; j < 3; j++) {
                const id = j; let e = this.chains.get(c);
                if (!e) { e = { links: [], gates: [] }; this.chains.set(c, e); }
                seen.add(c);
                if (!e.links[id]) {
                    const a = c.seed + j / 3 * Math.PI * 2, gx = en.x + Math.cos(a) * 80, gy = en.y + Math.sin(a) * 80, gh = 50 + j * 22;
                    e.gates[id] = { a, h: gh / this.T * 1.2, o: this.portal(gx, gy, gh, en.x, en.y, c.max + 0.3, 0.45) };
                    const m = new THREE.Mesh(this.chainGeo, new THREE.MeshStandardMaterial({ map: this.chainTex, color: 0xffe9a8, metalness: 0.85, roughness: 0.25, emissive: 0xd09a18, emissiveIntensity: 0.9 }));
                    m.material.map = this.chainTex.clone(); m.material.map.needsUpdate = true;
                    this.scene.add(m); e.links[id] = { m, t: 0 };
                }
                const L = e.links[id], G = e.gates[id]; L.t += dt / 3;
                const from = new THREE.Vector3(p.x + Math.cos(G.a) * 80 / this.T, p.y + G.h, p.z + Math.sin(G.a) * 80 / this.T), to = new THREE.Vector3(p.x, p.y + 0.75, p.z);
                const dir = to.clone().sub(from), len = dir.length() * Math.min(1, L.t / 0.15);
                L.m.position.copy(from); L.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); L.m.scale.set(1, len, 1);
                L.m.material.map.repeat.set(1, Math.max(1, len * 7)); L.m.material.emissiveIntensity = 0.8 + Math.sin(Engine3D.t * 8 + j) * 0.25;
                L.m.visible = c.t > 0.02;
            }
            if (Math.random() < 0.15) AnimFX.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: 1, color: this.GOLD, speed: 0.6, up: 0.4, life: 0.4, size: 0.04, grav: 0 });
        }
        for (const [c, e] of this.chains) if (!seen.has(c)) { e.links.forEach(L => { if (L) { this.scene.remove(L.m); L.m.material.map.dispose(); L.m.material.dispose(); } }); this.chains.delete(c); }
        // Падающие Фантазмы Сокровищницы: из портала острием к точке удара, после удара торчат из земли и уходят в неё
        for (let i = this.falls.length - 1; i >= 0; i--) {
            const f = this.falls[i], d = f.d, Rn = f.Rn, t = Rn.t;
            const stale = player.gilRain !== Rn && !d.done;
            if (stale || t > d.at + 0.9) { if (f.m) this.scene.remove(f.m); this.falls.splice(i, 1); continue; }
            if (t < d.at - 0.28) continue;
            const gp = Rn.gatePos && Rn.gatePos[d.gate % Rn.gatePos.length]; if (!gp) continue;
            if (!f.m) { f.m = this.bigWeapon(d.wtype); this.scene.add(f.m); }
            const a = this.pos(gp.x, gp.y), b = this.pos(d.x, d.y);
            const from = new THREE.Vector3(a.x, a.y + gp.h, a.z), to = new THREE.Vector3(b.x, b.y + 0.35, b.z);
            const k = Math.min(1, Math.max(0, (t - (d.at - 0.28)) / 0.28));
            f.m.position.lerpVectors(from, to, k * k);
            f.m.lookAt(to.x + (to.x - from.x), to.y + (to.y - from.y), to.z + (to.z - from.z));
            if (t > d.at) { const s = Math.min(1, (t - d.at) / 0.9); f.m.position.y -= s * s * 1.2; }
        }
        this.updateEa(dt);
        // Золотое свечение Царя
        if (player.heroType === 'gilgamesh' && Math.random() < 0.08) { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x + (Math.random() - 0.5) * 0.6, y: h.y + 0.3 + Math.random(), z: h.z + (Math.random() - 0.5) * 0.6, n: 1, color: this.GOLD, speed: 0.15, up: 0.6, life: 0.9, size: 0.035, grav: -0.3 }); }
    },
    fxRunes() {
        if (player.heroType !== 'gilgamesh') return;
        const Rn = player.gilRain; if (Rn) { const p = this.pos(Rn.x, Rn.y); FX3D.runeAt(Rn, 0xfbbf24, p.x, p.z, Rn.R / this.T, Math.min(1, Rn.t / 0.4), { crack: Math.min(1, Rn.t / Rn.dur), spin: 1.5 }); }
        const U = player.gilUlt;
        if (U && !U.fired) {
            const hp = AnimFX.heroPos(), a = Math.atan2(Math.cos(U.ang), Math.sin(U.ang));
            FX3D.runeAt(U, 0xdc2626, hp.x, hp.z, 0, U.t / U.wind, { rect: true, ang: a, w: U.W / this.T, len: U.len / this.T, crack: 0.8 });
        }
    }
};
