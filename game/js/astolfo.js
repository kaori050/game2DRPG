// ============================================================================
// АСТОЛЬФО (класс «Райдер»): Рыцарь Карла Великого, наездник Гиппогрифа
// ============================================================================
// Самый быстрый герой: копьё и рапира вблизи, рывки, контроль и срыв вражеских баффов.
// Умеренная живучесть — играет скоростью и позиционированием, а не лобовым разменом.
// Q Ловушка Аргалии — стремительный выпад к курсору: урон по линии, снимает с врагов защиту и усиления.
// W Рог Отчаяния (La Black Luna) — звуковая волна конусом: урон, оглушение, отбрасывание, срыв замахов.
// E Книга Исчезновения — рывок к курсору, фантомный след, короткая невидимость и ускорение.
// R Гиппогриф — призыв Гиппогрифа и таранный прорыв по линии с ударом при приземлении.
const ASTO_SKILLS = {
    q: { key: 'q', name: 'Trap of Argalia', ruName: 'Ловушка Аргалии', icon: '🗡️', manaCost: 22, baseCd: 4,
         desc: 'Стремительный выпад копьём к курсору с ярким следом. Бьёт всех на линии и ломает их защиту: снимает неуязвимость (кроме смены фазы босса), броню и сопротивление магии, отменяет ускорения на 4 секунды. Отличное начало комбинации.',
         stats: l => `Урон ${45 + 22 * l} + атака • линия 190 • снятие защиты 4с • перезарядка 4с` },
    w: { key: 'w', name: 'La Black Luna', ruName: 'Рог Отчаяния', icon: '📯', manaCost: 55, baseCd: 12,
         desc: 'Астольфо трубит в рог, и звуковая волна сметает всё перед ним: урон, оглушение и отбрасывание, замахи и касты врагов срываются. Зона поражения видна на земле.',
         stats: l => `Урон ${40 + 20 * l} + атака • конус 270 / 80° • оглушение ${(0.8 + 0.1 * l).toFixed(1)}с • перезарядка ${Math.max(7, 12 - 0.5 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Book of Vanishing', ruName: 'Книга Исчезновения', icon: '📖', manaCost: 30, baseCd: 7,
         desc: 'Мгновенный рывок к курсору под магической завесой. После рывка Астольфо на мгновение исчезает из виду врагов (они теряют цель) и ускоряется. Зайти за спину, уйти из зоны босса, не застрять в толпе.',
         stats: l => `Рывок ${240 + 12 * l} • невидимость 0.9с • ускорение +30% на 2.5с • перезарядка ${Math.max(4, 7 - 0.4 * l).toFixed(1)}с` },
    r: { key: 'r', name: 'Hippogriff', ruName: 'Гиппогриф', icon: '🦅', manaCost: 170, baseCd: 90,
         desc: 'Ультимейт. Астольфо призывает Гиппогрифа и верхом таранит по линии к курсору: всё на пути получает тяжёлый урон, отлетает в стороны и оглушается, а в конце прорыва — пикирующий удар по области. Во время тарана Астольфо неуязвим. Траектория и место удара видны заранее.',
         stats: l => `Таран ${520} × 140: ${180 + 90 * l} + атака, оглушение 1с • удар в конце ${220 + 110 * l} в радиусе 170 • перезарядка ${90 - 5 * l}с` }
};
const ASTO_ULT = { len: 520, width: 140, wind: 0.6, charge: 0.55 };

const Asto = {
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(170 + L * 26 + eq.hp);
        player.maxMp = Math.round(180 + L * 24 + (q + w + e) * 6 + eq.mp);
        player.hpRegen = +(2.2 + L * 0.3).toFixed(1);
        player.mpRegen = +(5 + L * 0.45 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(26 + L * 7 + eq.hand);
        player.spellAmp = Math.round(5 + L * 2 + eq.amp);
        player.armor = Math.round(3 + L * 0.4 + eq.armor);
        player.moveSpeed = 240 * (player.astoHaste > 0 ? 1.3 : 1) | 0;
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        player.attackInterval = 0.5;
        player.attackRange = 90;
        player.critChance = 10 + eq.crit; player.critMult = 1.7;
    },
    pow() { return 1 + (player.spellAmp || 0) / 100; },
    ready(key) {
        const sk = ASTO_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.astoQueue = player.astoQueue || []).push({ t, fn }); },
    crit(dmg) { const c = Math.random() * 100 < (player.critChance || 0); return { dmg: Math.round(dmg * (c ? player.critMult : 1)), crit: c }; },
    // Враги в прямоугольнике от точки (ox, oy) вдоль угла ang
    inLine(ox, oy, ang, len, w, fn) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const rx = en.x - ox, ry = en.y - oy, al = rx * ca + ry * sa, pp = Math.abs(-rx * sa + ry * ca);
            if (al < -en.radius || al > len + en.radius || pp > w / 2 + en.radius) return;
            fn(en, al, -rx * sa + ry * ca);
        });
    },
    // Ловушка Аргалии: снимает защиту и усиления врага на время
    sunder(en, sec) {
        if (en.state !== 'roar') en.invuln = 0;   // неуязвимость смены фазы босса — механика боя, её не трогаем
        if (!en.astoBreak) en.astoBreak = { armor: en.armor, mres: en.mres };
        en.astoBreak.t = sec;
        en.armor = 0; en.mres = 0;
        if (en.tpl && en.speed > en.tpl.speed * (diffCfg().speed || 1)) en.speed = Math.round(en.tpl.speed * (diffCfg().speed || 1));
        if (typeof Asto3D !== 'undefined') Asto3D.shatter(en);
    },
    // Рог: сбивает замахи и касты так же, как цепи Энкиду
    interrupt(en) {
        en.disarmTimer = Math.max(en.disarmTimer || 0, en.isBoss ? 0.6 : 1.1);
        en.attackCd = Math.max(en.attackCd || 0, 0.7);
        if (en.specialCd !== undefined) en.specialCd = Math.max(en.specialCd, 1.8);
        en.leapT = 0;
        if (en.state === 'drain' || en.state === 'charge') { en.state = 'chase'; en.stateT = 0; spawnFloatingText(en.x, en.y - 44, 'ПРЕРВАНО!', '#f9a8d4'); }
    },
    attack() {
        const step = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 2) + 1; player.comboTimer = 1.4;
        player.basicAttackCd = player.attackInterval;
        player.slashAnimTime = 0.28;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        this.later(0.12, () => {
            let hit = 0;
            this.inLine(player.x, player.y, ang, 95, 80, en => { const c = this.crit(player.handDmg * (step === 2 ? 1.2 : 1)); damageEnemy(en, c.dmg, false, Math.cos(ang) * 5, Math.sin(ang) * 5, '#f9a8d4', { crit: c.crit }); hit++; });
            if (hit && typeof Feel !== 'undefined') Feel.impact(Math.cos(ang), Math.sin(ang), 0.45, false);
        });
        SoundFX.play('whoosh');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            const ox = player.x, oy = player.y, dmg = (45 + 22 * lvl) * P + H * 0.7;
            player.astoDash = { t: 0, dur: 0.14, vx: cx * 110 / 0.14, vy: cy * 110 / 0.14 };   // выпад: короткий рывок вперёд
            this.later(0.1, () => {
                this.inLine(ox, oy, ang, 190, 60, en => { const c = this.crit(dmg); damageEnemy(en, c.dmg, false, cx * 8, cy * 8, '#f472b6', { crit: c.crit }); this.sunder(en, 4); });
                if (typeof Feel !== 'undefined') Feel.impact(cx, cy, 0.8, false);
            });
            if (typeof Asto3D !== 'undefined') Asto3D.thrust(ox, oy, ang, 190);
            player.knightAnim = { kind: 'thrust', t: 0.32 };
            this.cd('q', ASTO_SKILLS.q.baseCd); SoundFX.play('bolt');
        } else if (key === 'w') {
            const R = 270, half = 0.7, dmg = (40 + 20 * lvl) * P + H * 0.5, st = 0.8 + 0.1 * lvl;
            player.astoHorn = { t: 0, ang, R, half };
            this.later(0.15, () => {
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                    if (d > R + en.radius) return;
                    let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                    if (Math.abs(da) > half && d > en.radius + 20) return;
                    damageEnemy(en, Math.round(dmg), true, 0, 0, '#f0abfc');
                    en.stunTimer = Math.max(en.stunTimer || 0, st);
                    this.interrupt(en);
                    if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 70, dy / d * 70);
                });
                if (typeof Asto3D !== 'undefined') Asto3D.horn(ang, R, half);
                if (typeof Feel !== 'undefined') Feel.shake(cx, cy, 0.2, 18, 7);
            });
            player.knightAnim = { kind: 'horn', t: 0.55 };
            this.cd('w', Math.max(7, ASTO_SKILLS.w.baseCd - 0.5 * lvl)); SoundFX.play('thunder');
        } else if (key === 'e') {
            const range = 240 + 12 * lvl, d = Math.min(range, Math.max(80, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            if (typeof Asto3D !== 'undefined') Asto3D.vanish(player.x, player.y);
            player.astoDash = { t: 0, dur: 0.16, vx: cx * d / 0.16, vy: cy * d / 0.16, ghost: true };
            player.invulnTime = Math.max(player.invulnTime, 0.3);
            player.astoVanish = 0.9; player.astoHaste = 2.5; recalcPlayerStats();
            enemies.forEach(en => { if (en.aggro > 0) en.aggro = 0; if (player.attackTarget === en) player.attackTarget = null; });
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'dash', t: 0.3 };
            this.cd('e', Math.max(4, ASTO_SKILLS.e.baseCd - 0.4 * lvl)); SoundFX.play('tornado');
        } else if (key === 'r') {
            player.astoUlt = { t: 0, ang, len: ASTO_ULT.len, W: ASTO_ULT.width, dmg: (180 + 90 * lvl) * P + H, slam: (220 + 110 * lvl) * P + H, hit: new Set(), ox: player.x, oy: player.y, charging: false, done: false };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = { kind: 'summon', t: ASTO_ULT.wind };
            this.cd('r', ASTO_SKILLS.r.baseCd - 5 * lvl);
            SoundFX.play('invoke');
            zoneBanner = { title: 'ГИППОГРИФ', sub: 'Полёт Неукротимого Зверя', life: 2.2, maxLife: 2.2, color: '#f9a8d4' };
            if (typeof Asto3D !== 'undefined') Asto3D.summon();
        }
        updateInvokerBarUI();
    },
    update(dt) {
        if (player.heroType !== 'astolfo') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.astoQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        if (player.astoVanish > 0) player.astoVanish = Math.max(0, player.astoVanish - dt);
        if (player.astoHaste > 0) { player.astoHaste -= dt; if (player.astoHaste <= 0) { player.astoHaste = 0; recalcPlayerStats(); } }
        if (player.astoHorn) { player.astoHorn.t += dt; if (player.astoHorn.t > 0.4) player.astoHorn = null; }
        const D = player.astoDash;
        if (D) { D.t += dt; tryMoveEntity(player, D.vx * dt, D.vy * dt); if (D.ghost && typeof Asto3D !== 'undefined') Asto3D.ghost(); if (D.t >= D.dur) player.astoDash = null; }
        // Снятая защита возвращается
        for (const en of enemies) { const b = en.astoBreak; if (!b) continue; b.t -= dt; if (b.t <= 0 || en.deadTimer > 0) { en.armor = b.armor; en.mres = b.mres; en.astoBreak = null; } }
        // Гиппогриф: призыв → таран по линии → пикирующий удар
        const U = player.astoUlt;
        if (U) {
            U.t += dt;
            const ca = Math.cos(U.ang), sa = Math.sin(U.ang);
            if (U.t < ASTO_ULT.wind) {   // пока Гиппогриф раскрывает крылья, можно чуть довернуть курс
                const want = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
                let d = want - U.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
                U.ang += Math.max(-dt * 1.5, Math.min(dt * 1.5, d));
            } else if (!U.done) {
                if (!U.charging) { U.charging = true; U.ox = player.x; U.oy = player.y; player.knightAnim = { kind: 'ride', t: ASTO_ULT.charge }; SoundFX.play('tornado'); if (typeof Asto3D !== 'undefined') Asto3D.charge(U); }
                player.invulnTime = Math.max(player.invulnTime, 0.15);
                const sp = U.len / ASTO_ULT.charge;
                tryMoveEntity(player, ca * sp * dt, sa * sp * dt);
                // Таран: каждого врага на пути — один раз, отбрасываем в сторону от линии
                this.inLine(U.ox, U.oy, U.ang, Math.hypot(player.x - U.ox, player.y - U.oy) + 40, U.W, (en, al, side) => {
                    if (U.hit.has(en.uid)) return; U.hit.add(en.uid);
                    damageEnemy(en, Math.round(U.dmg), false, ca * 6, sa * 6, '#f472b6');
                    en.stunTimer = Math.max(en.stunTimer || 0, 1);
                    if (!en.isBoss) { const s = side >= 0 ? 1 : -1; tryMoveEntity(en, -sa * s * 80 + ca * 30, ca * s * 80 + sa * 30); }
                    if (typeof Asto3D !== 'undefined') Asto3D.trample(en.x, en.y);
                });
                if (typeof Feel !== 'undefined' && Math.random() < 0.4) Feel.shake(ca, sa, 0.12, 14, 6);
                if (U.t >= ASTO_ULT.wind + ASTO_ULT.charge) {
                    U.done = true;
                    enemies.forEach(en => {
                        if (en.deadTimer > 0) return;
                        const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                        if (d > 170 + en.radius) return;
                        damageEnemy(en, Math.round(U.slam), true, 0, 0, '#f0abfc');
                        en.stunTimer = Math.max(en.stunTimer || 0, 0.8);
                        if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 60, dy / d * 60);
                    });
                    player.knightAnim = { kind: 'land', t: 0.35 };
                    spawnFloatingText(player.x, player.y - 60, '🦅 HIPPOGRIFF', '#f9a8d4');
                    if (typeof Feel !== 'undefined') Feel.impact(ca, sa, 1.5, true);
                    if (typeof Asto3D !== 'undefined') Asto3D.slam(player.x, player.y);
                    SoundFX.play('meteor');
                }
            }
            if (U.done && U.t >= ASTO_ULT.wind + ASTO_ULT.charge + 0.35) player.astoUlt = null;
        }
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'astolfo' && !!(player.astoUlt || player.astoDash); },
    reset() { player.astoQueue = null; player.astoDash = null; player.astoUlt = null; player.astoHorn = null; player.astoVanish = 0; player.astoHaste = 0; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('astoActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'astoActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = ASTO_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnAstoLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-pink-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdAsto${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-pink-200' : 'text-pink-100'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsAsto${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudAstoHp', 'Кровь'], ['mp', '2', '🔮', 'hudAstoMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'astoTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#f9a8d4">Астольфо:</span><span id="astoHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('astoHint');
        if (el) el.textContent = player.astoUlt ? 'Гиппогриф в небе!' : player.astoVanish > 0 ? 'Исчез из виду…' : player.astoHaste > 0 ? `Ускорение: ${player.astoHaste.toFixed(1)}с` : 'Рыцарь Карла Великого';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudAstoHp'), b = document.getElementById('hudAstoMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ АСТОЛЬФО: след выпада, звуковые кольца рога, фантомы, крылья и вихрь Гиппогрифа
// ============================================================================
const Asto3D = {
    T: 48,
    PINK: [0xf9a8d4, 0xf472b6, 0xfde68a, 0xffffff],
    fx: [], scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        this.planeGeo = new THREE.PlaneGeometry(1, 1); this.planeGeo.rotateX(-Math.PI / 2); this.planeGeo.translate(0, 0, -0.5);   // полоса от начала вдоль -Z → вращаем по курсу
        this.arcGeo = new THREE.RingGeometry(0.9, 1, 32, 1, -0.7, 1.4); this.arcGeo.rotateX(-Math.PI / 2);
        return true;
    },
    mat(c, op = 1) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); },
    add(m, life, upd) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd }); },
    // Выпад: светящаяся розово-золотая полоса по линии удара
    thrust(x, y, ang, len) {
        if (!this.ensure()) return;
        const p = this.pos(x, y), L = len / this.T, yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang));
        [[0xf472b6, 0.42, 0.8], [0xffffff, 0.14, 0.9]].forEach(([c, w, op]) => {
            const m = new THREE.Mesh(this.planeGeo, this.mat(c, op)); m.position.set(p.x, p.y + 0.85, p.z); m.rotation.y = yaw; m.scale.set(w, 1, 0.01);
            this.add(m, 0.3, (o, k) => { o.m.scale.set(w * (1 - k * 0.6), 1, L * Math.min(1, k * 5)); o.m.material.opacity = op * (1 - k); });
        });
        const tip = this.pos(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        AnimFX.emit({ x: tip.x, y: tip.y + 0.85, z: tip.z, n: 14, color: this.PINK, speed: 2.4, life: 0.35, size: 0.05, grav: 2, dir: [Math.cos(ang), 0.2, Math.sin(ang)], spread: 0.6 });
    },
    shatter(en) { const p = this.pos(en.x, en.y); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 14, color: [0xffffff, 0xf9a8d4, 0xfde68a], speed: 2.2, up: 1.4, life: 0.5, size: 0.06, sizeEnd: 0.01, grav: 6 }); AnimFX.shock(p.x, p.y + 1, p.z, 0xf472b6, 0.5, 0.1, 0.3); },
    // Рог: расходящиеся звуковые дуги и пыль
    horn(ang, R, half) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos(), r = R / this.T, yaw = -ang;
        // Зона поражения на земле: сектор конуса с ярким краем
        const sg = new THREE.CircleGeometry(1, 28, -half, half * 2); sg.rotateX(-Math.PI / 2);
        const sec = new THREE.Mesh(sg, this.mat(0xbe185d, 0.55)); sec.position.set(h.x, h.y + 0.06, h.z); sec.rotation.y = yaw; sec.scale.setScalar(r);
        this.add(sec, 0.5, (o, k) => { o.m.material.opacity = 0.55 * (1 - k); if (k >= 1) o.m.geometry.dispose(); });
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(this.arcGeo, this.mat(i % 2 ? 0xf0abfc : 0xf472b6, 0.85)); m.position.set(h.x, h.y + 0.5 + i * 0.12, h.z); m.rotation.y = yaw;
            const d = i * 0.06;
            this.add(m, 0.45 + d, (o, k) => { const kk = Math.max(0, (o.t - d) / 0.45); o.m.scale.setScalar(0.3 + r * Math.min(1, kk)); o.m.material.opacity = kk <= 0 ? 0 : 0.85 * (1 - kk); });
        }
        for (let i = 0; i < 14; i++) { const a = ang + (Math.random() - 0.5) * half * 2, d = Math.random() * r; AnimFX.emit({ x: h.x + Math.cos(a) * d, y: h.y + 0.1, z: h.z + Math.sin(a) * d, n: 2, color: 0x7a6a5a, speed: 1.2, up: 0.6, life: 0.7, size: 0.18, sizeEnd: 0.35, grav: -0.2, drag: 3 }); }
        AnimFX.kick(0.4); Sfx3D.play('impact', 0.7);
    },
    vanish(x, y) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.9, z: p.z, n: 34, color: [0xf9a8d4, 0xe9d5ff, 0xffffff], speed: 1.6, up: 0.6, life: 0.6, size: 0.07, sizeEnd: 0.01, grav: -0.5 }); AnimFX.shock(p.x, p.y + 0.05, p.z, 0xf0abfc, 0.2, 1.3, 0.35, 0.8); },
    ghost() { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x, y: h.y + 0.2 + Math.random() * 1.1, z: h.z, n: 4, color: [0xf9a8d4, 0xe9d5ff, 0xfde68a], speed: 0.25, life: 0.5, size: 0.08, sizeEnd: 0.01, grav: 0, drag: 2 }); },
    summon() { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.06, h.z, 0xf9a8d4, 0.3, 2.2, 0.6, 0.9); AnimFX.emit({ x: h.x, y: h.y + 1, z: h.z, n: 50, color: [0xfde68a, 0xf9a8d4, 0xffffff, 0xa8a29e], speed: 3, up: 2, life: 0.8, size: 0.06, grav: 1 }); AnimFX.flash(h.x, h.z, 0xf9a8d4, 6, 0.6, 2); },
    charge(U) { AnimFX.kick(0.6); },
    trample(x, y) { const p = this.pos(x, y); AnimFX.impact(p.x, p.z, 0xf472b6, 0.9, { dust: 0x5a4a3a }); },
    slam(x, y) {
        const p = this.pos(x, y), r = 170 / this.T;
        AnimFX.impact(p.x, p.z, 0xf9a8d4, 2.2, { dust: 0x5a4a3a });
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfde68a, 0.2, r, 0.5, 1); AnimFX.shock(p.x, p.y + 0.08, p.z, 0xf472b6, 0.1, r * 0.7, 0.45, 0.8);
        AnimFX.emit({ x: p.x, y: p.y + 0.6, z: p.z, n: 40, color: [0xffffff, 0xf5f5f4, 0xf9a8d4], speed: 4, up: 3, life: 1, size: 0.07, grav: 3 });   // перья
        AnimFX.flash(p.x, p.z, 0xf9a8d4, 9, 0.5, 2.2); AnimFX.kick(1.3);
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'astolfo' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) { const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life); if (o.upd) o.upd(o, k); if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); this.fx.splice(i, 1); } }
        if (player.heroType !== 'astolfo') return;
        const U = player.astoUlt, h = AnimFX.heroPos();
        if (U && U.charging && !U.done) {
            // Вихрь от крыльев: перья и пыль вдоль прорыва
            for (let i = 0; i < 3; i++) { const s = (Math.random() - 0.5) * 3; AnimFX.emit({ x: h.x - Math.sin(U.ang) * s, y: h.y + 0.3 + Math.random() * 1.6, z: h.z + Math.cos(U.ang) * s, n: 1, color: [0xffffff, 0xf9a8d4, 0xfde68a], speed: 1.5, up: 1, life: 0.6, size: 0.06, grav: 1.5, drag: 1 }); }
            AnimFX.emit({ x: h.x, y: h.y + 0.1, z: h.z, n: 3, color: 0x7a6a5a, speed: 1.5, up: 0.5, life: 0.8, size: 0.25, sizeEnd: 0.5, grav: -0.2, drag: 3 });
        }
        if (player.astoVanish > 0 && Math.random() < 0.5) AnimFX.emit({ x: h.x + (Math.random() - 0.5) * 0.6, y: h.y + 0.3 + Math.random(), z: h.z + (Math.random() - 0.5) * 0.6, n: 1, color: [0xe9d5ff, 0xf9a8d4], speed: 0.2, up: 0.4, life: 0.5, size: 0.06, grav: 0 });
        // Полупрозрачный Астольфо, пока он невидим для врагов
        const A = typeof Actors3D !== 'undefined' && Actors3D.player;
        if (A) { const inv = player.astoVanish > 0, want = inv ? 0.35 : 1; if (A.astoOp !== want) { A.astoOp = want; A.mats.forEach(m => { if (m.userData.t0 === undefined) m.userData.t0 = m.transparent; m.transparent = inv ? true : m.userData.t0; m.opacity = want; m.needsUpdate = true; }); } }
    },
    fxRunes() {
        if (player.heroType !== 'astolfo') return;
        const U = player.astoUlt;
        if (U && !U.done) {
            const h = AnimFX.heroPos(), a = Math.atan2(Math.cos(U.ang), Math.sin(U.ang));
            const ox = U.charging ? U.ox : player.x, oy = U.charging ? U.oy : player.y, o = this.pos(ox, oy);
            FX3D.runeAt(U, 0xf472b6, o.x, o.z, 0, Math.min(1, U.t / ASTO_ULT.wind), { rect: true, ang: a, w: U.W / this.T, len: U.len / this.T, crack: 0.5 });
            const e = this.pos(ox + Math.cos(U.ang) * U.len, oy + Math.sin(U.ang) * U.len);
            FX3D.runeAt(U, 0xfde68a, e.x, e.z, 170 / this.T, Math.min(1, U.t / ASTO_ULT.wind), { tag: 'end', spin: 2 });
        }
    }
};
