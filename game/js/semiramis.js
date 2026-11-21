// ============================================================================
// СЕМИРАМИДА (класс «Убийца»): Ассасин Красных, Царица Ассирии, мастер ядов
// ============================================================================
// Холодный ассасин-маг: яд (накапливается до 5 стаков, разъедает и замедляет), уязвимость, контроль зоны.
// Хрупкая: ошибка в позиционировании под ударами элиты или босса стоит дорого.
// Атака — комбо из четырёх ударов шипами; четвёртый выпускает ядовитый шип вперёд.
// Q Отравленный Выпад — выпад с брызгами яда: 2 стака яда; по уже отравленным — «отклик»: остаток яда взрывается сразу.
// W Стая Голубей — Тёмный Шаг к курсору (неуязвимость, скрытность), голуби-фамильяры летят к врагам и метят их уязвимостью.
// E Сикера Ушум — ядовитые цепи и миазмы в зоне: сковывание, яд каждую секунду, замедление и ослабление ударов.
// R Висячие Сады Вавилона — магические круги над зоной, каскад лучей и детонация в центре: яд и ослабление выживших.
const SEMI_SKILLS = {
    q: { key: 'q', name: 'Poisoned Strike', ruName: 'Отравленный Выпад', icon: '🐍', manaCost: 20, baseCd: 3.5,
         desc: 'Стремительный выпад шипами к курсору со шлейфом и брызгами тёмного яда. Накладывает 2 стака яда (урон каждую секунду и замедление). Если цель уже отравлена — «отклик»: оставшийся яд взрывается сразу с добавкой 50%.',
         stats: l => `Удар ${45 + 22 * l} + атака • яд ${8 + 4 * l}/с за стак (до 5), 4с • отклик ×1.5 • перезарядка 3.5с` },
    w: { key: 'w', name: 'Familiar Doves', ruName: 'Стая Голубей', icon: '🕊️', manaCost: 45, baseCd: 10,
         desc: 'Тёмный Шаг: Семирамида растворяется и переносится к курсору (неуязвима на время шага, затем на миг скрыта от врагов). С места ухода взлетает стая серых голубей-фамильяров — они устремляются к ближайшим врагам, клюют и помечают их уязвимостью: броня −40%, весь получаемый урон +15%.',
         stats: l => `Шаг ${200 + 10 * l} • скрытность 0.8с • голубей ${6 + l}, каждый ${15 + 8 * l} • уязвимость 5с • перезарядка ${Math.max(6, 10 - 0.4 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Sikera Ušum', ruName: 'Сикера Ушум', icon: '⛓️', manaCost: 70, baseCd: 14,
         desc: 'Фантазм отравления: в зоне у курсора из ядовитой дымки вырываются цепи и сковывают врагов, а землю накрывает облако отравы. Внутри враги замедлены, каждую секунду получают стак яда и бьют слабее. Граница зоны видна на земле.',
         stats: l => `Зона ${140 + 10 * l} на 4с • сковывание 1.2с (боссы короче) • +1 стак яда/с • замедление 40% • удары врагов −20%` },
    r: { key: 'r', name: 'Hanging Gardens of Babylon', ruName: 'Висячие Сады Вавилона', icon: '🏛️', manaCost: 190, baseCd: 95,
         desc: 'Ультимейт. Над обширной зоной раскрываются царственные магические круги и тёмно-золотые рунные проекции, из них обрушивается каскад лучей с ядовитыми разрядами, а в конце центр зоны детонирует. Семирамида колдует 1 секунду неподвижно, дальше Сады бьют сами. Выжившие отравлены (3 стака) и ослаблены.',
         stats: l => `Зона 260 • ${24 + 6 * l} лучей по ${60 + 30 * l} + стак яда • детонация ${300 + 150 * l} • ослабление 30% на 5с • перезарядка ${95 - 5 * l}с` }
};
const SEMI_COMBO = [
    { style: 'slash', dur: 0.3, mult: 1, len: 90, w: 80 },
    { style: 'cross', dur: 0.32, mult: 1.1, len: 95, w: 90 },
    { style: 'spin', dur: 0.36, mult: 1.2, len: 85, w: 140 },
    { style: 'thrust', dur: 0.4, mult: 1.3, len: 100, w: 70, spike: true }
];

const Semi = {
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(150 + L * 22 + eq.hp);
        player.maxMp = Math.round(260 + L * 30 + (q + w + e) * 8 + eq.mp);
        player.hpRegen = +(1.8 + L * 0.22).toFixed(1);
        player.mpRegen = +(7 + L * 0.5 + r * 2 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(20 + L * 5.5 + eq.hand);
        player.spellAmp = Math.round(12 + L * 3 + r * 5 + eq.amp);
        player.armor = Math.round(2 + L * 0.35 + eq.armor);
        player.moveSpeed = 210;
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        player.attackInterval = 0.45;
        player.attackRange = 95;
        player.critChance = 8 + eq.crit; player.critMult = 1.7;
    },
    pow() { return 1 + (player.spellAmp || 0) / 100; },
    lvl(k) { return Math.max(1, player.orbLevels[k] || 1); },
    ready(key) {
        const sk = SEMI_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.semiQueue = player.semiQueue || []).push({ t, fn }); },
    crit(dmg) { const c = Math.random() * 100 < (player.critChance || 0); return { dmg: Math.round(dmg * (c ? player.critMult : 1)), crit: c }; },
    // Яд: стаки до 5, каждый стак — урон в секунду и −6% скорости
    poisonDps() { return (8 + 4 * this.lvl('q')) * this.pow(); },
    poison(en, n) {
        const p = en.semiPoison || (en.semiPoison = { stacks: 0, t: 0, acc: 0 });
        p.stacks = Math.min(5, p.stacks + n); p.t = 4;
    },
    // Отклик: оставшийся яд срабатывает сразу ×1.5
    burst(en) {
        const p = en.semiPoison; if (!p || p.stacks <= 0) return 0;
        const dmg = Math.round(p.stacks * this.poisonDps() * p.t * 1.5);
        damageEnemy(en, dmg, true, 0, 0, '#a3e635'); spawnFloatingText(en.x, en.y - 44, `☠ ${dmg}`, '#bef264');
        if (typeof Semi3D !== 'undefined') Semi3D.venomPop(en.x, en.y);
        en.semiPoison = null; return dmg;
    },
    expose(en, sec) {
        if (!en.semiExpose) en.semiExposeArmor = en.armor;
        en.semiExpose = sec; en.armor = Math.round((en.semiExposeArmor || 0) * 0.6);
    },
    weaken(en, sec, k) {
        if (!en.semiWeak) en.semiWeak = { dmg: en.dmg };
        en.semiWeak.t = Math.max(en.semiWeak.t || 0, sec);
        en.dmg = Math.min(en.dmg, Math.round(en.semiWeak.dmg * (1 - k)));
    },
    inLine(ox, oy, ang, len, w, fn) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const rx = en.x - ox, ry = en.y - oy, al = rx * ca + ry * sa, pp = Math.abs(-rx * sa + ry * ca);
            if (al < -en.radius || al > len + en.radius || pp > w / 2 + en.radius) return;
            fn(en);
        });
    },
    attack() {
        const k = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 4) + 1; player.comboTimer = 1.2;
        const C = SEMI_COMBO[k - 1];
        player.basicAttackCd = player.attackInterval * (k === 4 ? 1.4 : 1);
        player.slashAnimTime = C.dur;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        this.later(C.dur * 0.45, () => {
            let hit = 0;
            this.inLine(player.x - Math.cos(ang) * 12, player.y - Math.sin(ang) * 12, ang, C.len, C.w, en => {
                const c = this.crit(player.handDmg * C.mult); damageEnemy(en, c.dmg, false, Math.cos(ang) * 4, Math.sin(ang) * 4, '#c084fc', { crit: c.crit }); hit++;
                if (k >= 3) this.poison(en, 1);
            });
            if (C.spike) this.spike(ang);
            if (typeof Semi3D !== 'undefined') Semi3D.slash(ang, k);
            if (hit && typeof Feel !== 'undefined') Feel.impact(Math.cos(ang), Math.sin(ang), 0.3 + k * 0.08, false);
        });
        SoundFX.play('whoosh');
    },
    // Ядовитый шип: летит вперёд, пробивает одного врага
    spike(ang) {
        const sp = 820, range = 260;
        projectiles.push({ kind: 'semi', x: player.x + Math.cos(ang) * 30, y: player.y + Math.sin(ang) * 30, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, radius: 9,
            dmg: Math.round(player.handDmg * 0.9), fromPlayer: true, isSpell: false, color: '#a3e635', life: range / sp, pierce: 1, hitIds: new Set() });
    },
    onHit(p, en) {
        damageEnemy(en, p.dmg, false, p.vx * 0.03, p.vy * 0.03, '#a3e635');
        this.poison(en, 1); p.hitIds.add(en.uid);
        if (typeof Semi3D !== 'undefined') Semi3D.venomPop(en.x, en.y, true);
        if (p.pierce > 0) { p.pierce--; return false; }
        return true;
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            const dmg = (45 + 22 * lvl) * P + H * 0.7;
            player.knightAnim = { kind: 'strike', t: 0.36 };
            this.later(0.1, () => {
                const ox = player.x, oy = player.y;
                player.semiDash = { t: 0, dur: 0.1, vx: cx * 80 / 0.1, vy: cy * 80 / 0.1 };
                this.later(0.06, () => {
                    this.inLine(ox, oy, ang, 170, 70, en => {
                        const had = en.semiPoison && en.semiPoison.stacks > 0;
                        const c = this.crit(dmg); damageEnemy(en, c.dmg, false, cx * 6, cy * 6, '#c084fc', { crit: c.crit });
                        if (had) this.burst(en); else this.poison(en, 2);
                    });
                    if (typeof Semi3D !== 'undefined') Semi3D.lunge(ox, oy, ang, 170);
                    if (typeof Feel !== 'undefined') Feel.impact(cx, cy, 0.7, false);
                });
            });
            this.cd('q', SEMI_SKILLS.q.baseCd); SoundFX.play('bolt');
        } else if (key === 'w') {
            const range = 200 + 10 * lvl, d = Math.min(range, Math.max(60, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            const ox = player.x, oy = player.y;
            player.semiDash = { t: 0, dur: 0.15, vx: cx * d / 0.15, vy: cy * d / 0.15, shadow: true };
            player.invulnTime = Math.max(player.invulnTime, 0.3);
            player.semiVeil = 0.95;
            enemies.forEach(en => { if (en.aggro > 0 && !en.isBoss) en.aggro = 0; if (player.attackTarget === en) player.attackTarget = null; });
            // Голуби: к ближайшим врагам вокруг точки прибытия
            const tx = ox + cx * d, ty = oy + cy * d, n = 6 + lvl;
            const foes = enemies.filter(en => en.deadTimer <= 0 && Math.hypot(en.x - tx, en.y - ty) < 320).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
            player.semiDoves = (player.semiDoves || []).concat(Array.from({ length: n }, (_, i) => ({ x: ox, y: oy, h: 0.6, t: 0, delay: i * 0.05, tgt: foes.length ? foes[i % foes.length] : null, ang: ang + (i - n / 2) * 0.35, dmg: (15 + 8 * lvl) * P, uid: Math.random(), hit: false, life: 2.2 })));
            player.knightAnim = { kind: 'doves', t: 0.4 };
            if (typeof Semi3D !== 'undefined') Semi3D.shadowStep(ox, oy);
            this.cd('w', Math.max(6, SEMI_SKILLS.w.baseCd - 0.4 * lvl)); SoundFX.play('tornado');
        } else if (key === 'e') {
            let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
            if (d > 420) { tx = player.x + (tx - player.x) / d * 420; ty = player.y + (ty - player.y) / d * 420; }
            const R = 140 + 10 * lvl;
            player.semiMiasma = { x: tx, y: ty, R, t: 0, dur: 4, acc: 0, chained: [] };
            enemies.forEach(en => {
                if (en.deadTimer > 0 || Math.hypot(en.x - tx, en.y - ty) > R + en.radius) return;
                en.stunTimer = Math.max(en.stunTimer || 0, 1.2);
                damageEnemy(en, Math.round((30 + 15 * lvl) * P), true, 0, 0, '#a3e635');
                this.poison(en, 1);
                player.semiMiasma.chained.push({ en, t: en.isBoss ? 0.4 : 1.2, seed: Math.random() * 6 });
            });
            player.knightAnim = { kind: 'chains', t: 0.5 };
            if (typeof Semi3D !== 'undefined') Semi3D.miasmaOpen(tx, ty, R);
            this.cd('e', SEMI_SKILLS.e.baseCd); SoundFX.play('emp');
        } else if (key === 'r') {
            let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
            if (d > 500) { tx = player.x + (tx - player.x) / d * 500; ty = player.y + (ty - player.y) / d * 500; }
            const n = 24 + 6 * lvl, beams = [];
            for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, dd = Math.sqrt(Math.random()) * 250; beams.push({ x: tx + Math.cos(a) * dd, y: ty + Math.sin(a) * dd, at: 1.0 + i / n * 1.6, done: false, from: i % 5 }); }
            player.semiGarden = { x: tx, y: ty, R: 260, t: 0, beam: (60 + 30 * lvl) * P, boom: (300 + 150 * lvl) * P + H, beams, done: false };
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'garden', t: 1.0 };
            zoneBanner = { title: 'HANGING GARDENS OF BABYLON', sub: 'Висячие Сады — Суд Царицы', life: 2.4, maxLife: 2.4, color: '#d8b4fe' };
            this.cd('r', SEMI_SKILLS.r.baseCd - 5 * lvl);
            SoundFX.play('invoke');
            if (typeof Semi3D !== 'undefined') Semi3D.gardenOpen(player.semiGarden);
        }
        updateInvokerBarUI();
    },
    update(dt) {
        if (player.heroType !== 'semiramis') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.semiQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        if (player.semiVeil > 0) player.semiVeil = Math.max(0, player.semiVeil - dt);
        const D = player.semiDash;
        if (D) { D.t += dt; tryMoveEntity(player, D.vx * dt, D.vy * dt); if (D.shadow && typeof Semi3D !== 'undefined') Semi3D.ghost(); if (D.t >= D.dur) player.semiDash = null; }
        // Голуби: взлёт, полёт к цели по дуге, клевок
        const V = player.semiDoves;
        if (V) for (let i = V.length - 1; i >= 0; i--) {
            const v = V[i]; if (v.delay > 0) { v.delay -= dt; continue; }
            v.t += dt; v.life -= dt;
            const t = v.tgt && v.tgt.deadTimer <= 0 ? v.tgt : null;
            const gx = t ? t.x : v.x + Math.cos(v.ang) * 200, gy = t ? t.y : v.y + Math.sin(v.ang) * 200;
            const want = Math.atan2(gy - v.y, gx - v.x); let da = want - v.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            v.ang += Math.max(-dt * 7, Math.min(dt * 7, da));
            v.x += Math.cos(v.ang) * 360 * dt; v.y += Math.sin(v.ang) * 360 * dt;
            v.h = 0.6 + Math.sin(Math.min(1, v.t * 2) * Math.PI) * 0.8 * (t ? Math.min(1, Math.hypot(gx - v.x, gy - v.y) / 120) : 1);
            if (!v.hit && t && Math.hypot(t.x - v.x, t.y - v.y) < t.radius + 10) {
                v.hit = true; v.life = Math.min(v.life, 0.5); v.ang += Math.PI * 0.8;
                damageEnemy(t, Math.round(v.dmg), true, 0, 0, '#e2e8f0'); this.expose(t, 5);
                if (typeof Semi3D !== 'undefined') Semi3D.peck(t.x, t.y);
            }
            if (v.life <= 0) V.splice(i, 1);
        }
        // Сикера Ушум: цепи держат, миазмы травят и ослабляют
        const M = player.semiMiasma;
        if (M) {
            M.t += dt; M.acc += dt; const tick = M.acc >= 1; if (tick) M.acc -= 1;
            M.chained = M.chained.filter(c => (c.t -= dt) > 0 && c.en.deadTimer <= 0);
            enemies.forEach(en => {
                if (en.deadTimer > 0 || Math.hypot(en.x - M.x, en.y - M.y) > M.R + en.radius) return;
                en.slowTimer = Math.max(en.slowTimer || 0, 0.3); en.slowMult = Math.min(en.slowMult || 1, 0.6);
                this.weaken(en, 1, 0.2);
                if (tick) this.poison(en, 1);
            });
            if (M.t >= M.dur) player.semiMiasma = null;
        }
        // Висячие Сады: лучи по расписанию, затем детонация
        const G = player.semiGarden;
        if (G) {
            G.t += dt;
            for (const b of G.beams) {
                if (b.done || G.t < b.at) continue; b.done = true;
                enemies.forEach(en => { if (en.deadTimer <= 0 && Math.hypot(en.x - b.x, en.y - b.y) < 60 + en.radius) { damageEnemy(en, Math.round(G.beam), true, 0, 0, '#d8b4fe'); this.poison(en, 1); } });
                if (typeof Semi3D !== 'undefined') Semi3D.beam(G, b);
            }
            if (!G.done && G.t >= 2.75) {
                G.done = true;
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const d = Math.hypot(en.x - G.x, en.y - G.y); if (d > G.R + en.radius) return;
                    damageEnemy(en, Math.round(G.boom * (1 - 0.35 * d / G.R)), true, 0, 0, '#c084fc');
                    this.poison(en, 3); this.weaken(en, 5, 0.3);
                    if (!en.isBoss && d > 1) tryMoveEntity(en, (en.x - G.x) / d * 50, (en.y - G.y) / d * 50);
                });
                spawnFloatingText(G.x, G.y - 70, '🏛️ HANGING GARDENS', '#e9d5ff');
                if (typeof Feel !== 'undefined') Feel.impact(0, 1, 1.5, true);
                if (typeof Semi3D !== 'undefined') Semi3D.detonate(G);
                SoundFX.play('sunstrike');
            }
            if (G.t >= 3.3) player.semiGarden = null;
        }
        // Яд, уязвимость и ослабление
        for (const en of enemies) {
            if (en.semiExpose > 0) { en.semiExpose -= dt; if (en.semiExpose <= 0 || en.deadTimer > 0) { en.semiExpose = 0; if (en.semiExposeArmor !== undefined) en.armor = en.semiExposeArmor; } }
            const w = en.semiWeak; if (w) { w.t -= dt; if (w.t <= 0 || en.deadTimer > 0) { en.dmg = w.dmg; en.semiWeak = null; } }
            const p = en.semiPoison; if (!p) continue;
            if (en.deadTimer > 0) { en.semiPoison = null; continue; }
            p.t -= dt; p.acc += dt;
            en.slowTimer = Math.max(en.slowTimer || 0, 0.2); en.slowMult = Math.min(en.slowMult || 1, 1 - 0.06 * p.stacks);
            if (p.acc >= 0.5) { p.acc -= 0.5; damageEnemy(en, Math.max(1, Math.round(p.stacks * this.poisonDps() * 0.5)), true, 0, 0, '#84cc16'); }
            if (p.t <= 0) en.semiPoison = null;
        }
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'semiramis' && !!(player.semiDash || (player.semiGarden && player.semiGarden.t < 1.0)); },
    reset() { player.semiQueue = null; player.semiDash = null; player.semiDoves = []; player.semiMiasma = null; player.semiGarden = null; player.semiVeil = 0; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('semiActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'semiActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = SEMI_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnSemiLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-purple-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdSemi${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-amber-200' : 'text-purple-100'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsSemi${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudSemiHp', 'Кровь'], ['mp', '2', '🔮', 'hudSemiMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'semiTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#d8b4fe">Семирамида:</span><span id="semiHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('semiHint'), n = enemies.filter(en => en.semiPoison && en.deadTimer <= 0).length;
        if (el) el.textContent = player.semiGarden ? 'Висячие Сады раскрыты' : n ? `Отравлено врагов: ${n}` : 'Царица Ассирии';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudSemiHp'), b = document.getElementById('hudSemiMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ СЕМИРАМИДЫ: шлейфы шипов и яд, серые голуби, ядовитые цепи и миазмы, магические круги Садов
// ============================================================================
const Semi3D = {
    T: 48,
    VENOM: [0xa3e635, 0x65a30d, 0x84cc16, 0x3f6212],
    ROYAL: [0xd8b4fe, 0xa855f7, 0xfbbf24, 0xffffff],
    fx: [], doves: new Map(), chains: new Map(), scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        this.planeGeo = new THREE.PlaneGeometry(1, 1); this.planeGeo.rotateX(-Math.PI / 2); this.planeGeo.translate(0, 0, -0.5);
        this.slashGeo = new THREE.RingGeometry(0.82, 1, 26, 1, -1, 2); this.slashGeo.rotateX(-Math.PI / 2);
        this.beamGeo = new THREE.CylinderGeometry(0.08, 0.14, 1, 10, 1, true); this.beamGeo.translate(0, 0.5, 0);
        this.chainGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6, 1, true); this.chainGeo.translate(0, 0.5, 0);
        // Голубь: тельце и два крыла (крылья машут)
        this.doveBody = new THREE.SphereGeometry(0.09, 8, 6); this.doveBody.scale(1, 0.8, 1.7);
        this.doveWing = new THREE.PlaneGeometry(0.28, 0.12); this.doveWing.translate(0.14, 0, 0);
        this.doveMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 });
        this.doveMatW = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.8, side: THREE.DoubleSide });
        return true;
    },
    mat(c, op = 1) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); },
    add(m, life, upd, geo) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd, geo }); },
    slash(ang, k) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos(), col = k >= 3 ? 0x84cc16 : 0xa855f7;
        [[col, 0.85, 1], [0xfbbf24, 0.5, 0.9]].forEach(([c, op, s], i) => {
            const m = new THREE.Mesh(this.slashGeo, this.mat(c, op)); m.position.set(h.x, h.y + 0.75 + i * 0.03, h.z);
            const r = (k === 3 ? 1.3 : 1.05) * s; m.rotation.set(k % 2 ? 0.5 : -0.4, -ang, 0); m.scale.setScalar(r);
            this.add(m, 0.22, (o, kk) => { o.m.material.opacity = op * (1 - kk); o.m.scale.setScalar(r * (1 + kk * 0.2)); });
        });
        if (k >= 3) AnimFX.emit({ x: h.x + Math.cos(ang) * 0.9, y: h.y + 0.8, z: h.z + Math.sin(ang) * 0.9, n: 10, color: this.VENOM, speed: 2, life: 0.4, size: 0.05, grav: 6 });
    },
    lunge(x, y, ang, len) {
        if (!this.ensure()) return;
        const p = this.pos(x, y), L = len / this.T, yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang));
        [[0xa855f7, 0.4, 0.8], [0x84cc16, 0.18, 0.9]].forEach(([c, w, op]) => {
            const m = new THREE.Mesh(this.planeGeo, this.mat(c, op)); m.position.set(p.x, p.y + 0.8, p.z); m.rotation.y = yaw; m.scale.set(w, 1, 0.01);
            this.add(m, 0.32, (o, k) => { o.m.scale.set(w * (1 - k * 0.5), 1, L * Math.min(1, k * 6)); o.m.material.opacity = op * (1 - k); });
        });
        const tip = this.pos(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        AnimFX.emit({ x: tip.x, y: tip.y + 0.8, z: tip.z, n: 18, color: this.VENOM, speed: 2.5, life: 0.5, size: 0.06, grav: 7, dir: [Math.cos(ang), 0.3, Math.sin(ang)], spread: 0.8 });
    },
    venomPop(x, y, small) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: small ? 8 : 24, color: this.VENOM, speed: small ? 1.5 : 3, up: 1.5, life: 0.6, size: 0.06, grav: 6 }); if (!small) AnimFX.shock(p.x, p.y + 0.3, p.z, 0x84cc16, 0.2, 1.1, 0.35, 0.8); },
    shadowStep(x, y) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: 30, color: [0x3b0764, 0x581c87, 0x1f2937], speed: 1.6, up: 0.6, life: 0.6, size: 0.12, sizeEnd: 0.25, grav: -0.3, drag: 2 }); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 12, color: [0xd1d5db, 0x9ca3af], speed: 2.5, up: 2, life: 0.8, size: 0.06, grav: 1 }); },
    ghost() { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x, y: h.y + 0.3 + Math.random(), z: h.z, n: 4, color: [0x581c87, 0x3b0764, 0x84cc16], speed: 0.2, life: 0.4, size: 0.1, sizeEnd: 0.2, grav: 0, drag: 2 }); },
    peck(x, y) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 6, color: [0xe5e7eb, 0x9ca3af, 0xa855f7], speed: 1.5, life: 0.5, size: 0.05, grav: 2 }); },
    miasmaOpen(x, y, R) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.05, p.z, 0x84cc16, 0.3, R / this.T, 0.5, 0.9); AnimFX.emit({ x: p.x, y: p.y + 0.2, z: p.z, n: 40, color: [0x3f6212, 0x581c87, 0x65a30d], speed: 1.5, up: 1, life: 1.2, size: 0.2, sizeEnd: 0.5, grav: -0.2, drag: 2, r: R / this.T * 0.6 }); Sfx3D.play('impact', 0.6); },
    // Сады: парящие магические круги над зоной (вращаются), каскад лучей, детонация
    gardenOpen(G) {
        if (!this.ensure()) return;
        const p = this.pos(G.x, G.y), r = G.R / this.T;
        G.rings = [];
        for (let i = 0; i < 5; i++) {
            const a = i / 5 * Math.PI * 2, rr = i === 0 ? 0 : r * 0.55, rad = i === 0 ? r * 0.55 : r * 0.28;
            const ring = AnimFX.rune(i % 2 ? 0xfbbf24 : 0xa855f7, { spin: i % 2 ? -1.5 : 1.5 });
            ring.position.set(p.x + Math.cos(a) * rr, p.y + 4.2 + (i ? 0.4 : 0), p.z + Math.sin(a) * rr); ring.rotation.x = 0; ring.scale.setScalar(0.01);
            this.scene.add(ring); G.rings.push({ m: ring, rad, x: ring.position.x, y: ring.position.y, z: ring.position.z });
        }
        AnimFX.flash(p.x, p.z, 0xa855f7, 4, 1, 4);
    },
    beam(G, b) {
        if (!this.ensure()) return;
        const R = G.rings && G.rings[b.from % G.rings.length]; if (!R) return;
        const q = this.pos(b.x, b.y), from = new THREE.Vector3(R.x, R.y, R.z), to = new THREE.Vector3(q.x, q.y, q.z), dir = to.clone().sub(from), L = dir.length();
        [[b.from % 2 ? 0xfbbf24 : 0xc084fc, 1, 0.9], [0xffffff, 0.4, 0.8]].forEach(([c, w, op]) => {
            const m = new THREE.Mesh(this.beamGeo, this.mat(c, op)); m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); m.scale.set(w, L, w);
            this.add(m, 0.22, (o, k) => { o.m.material.opacity = op * (1 - k); o.m.scale.set(w * (1 - k * 0.5), L, w * (1 - k * 0.5)); });
        });
        AnimFX.impact(q.x, q.z, b.from % 2 ? 0xfbbf24 : 0xa855f7, 0.7, { dust: 0x2a1a3a });
        AnimFX.emit({ x: q.x, y: q.y + 0.2, z: q.z, n: 6, color: this.VENOM, speed: 1.2, up: 1, life: 0.6, size: 0.05, grav: 3 });
        if (Math.random() < 0.4) AnimFX.kick(0.12);
    },
    detonate(G) {
        const p = this.pos(G.x, G.y), r = G.R / this.T;
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xa855f7, 0.3, r, 0.6, 1); AnimFX.shock(p.x, p.y + 0.08, p.z, 0xfbbf24, 0.2, r * 0.75, 0.5, 0.9); AnimFX.shock(p.x, p.y + 0.1, p.z, 0x84cc16, 0.1, r * 0.5, 0.45, 0.8);
        AnimFX.emit({ x: p.x, y: p.y + 0.6, z: p.z, n: 120, color: this.ROYAL.concat(this.VENOM), speed: 6, up: 4, life: 1, size: 0.07, sizeEnd: 0.02, grav: 2, drag: 1 });
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 30, color: [0x3f6212, 0x581c87], speed: 3, up: 2, life: 1.4, size: 0.3, sizeEnd: 0.7, grav: -0.3, drag: 2 });
        AnimFX.flash(p.x, p.z, 0xc084fc, 9, 0.6, 2.5); AnimFX.kick(1.3);
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'semiramis' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) { const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life); if (o.upd) o.upd(o, k); if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); if (o.geo) o.geo.dispose(); this.fx.splice(i, 1); } }
        const me = player.heroType === 'semiramis';
        // Голуби
        const live = new Set();
        for (const v of (me ? player.semiDoves || [] : [])) {
            if (v.delay > 0) continue;
            live.add(v.uid);
            let g = this.doves.get(v.uid);
            if (!g) { g = new THREE.Group(); g.add(new THREE.Mesh(this.doveBody, this.doveMat)); const l = new THREE.Mesh(this.doveWing, this.doveMatW), r = new THREE.Mesh(this.doveWing, this.doveMatW); r.rotation.y = Math.PI; g.add(l); g.add(r); g.userData = { l, r, ph: Math.random() * 6 }; g.scale.setScalar(1.6); this.scene.add(g); this.doves.set(v.uid, g); }
            const p = this.pos(v.x, v.y); g.position.set(p.x, p.y + v.h, p.z); g.rotation.y = Math.PI / 2 - v.ang;
            const f = Math.sin(Engine3D.t * 28 + g.userData.ph) * 0.9; g.userData.l.rotation.z = f; g.userData.r.rotation.z = -f;
            if (v.life < 0.3) g.scale.setScalar(1.6 * Math.max(0.01, v.life / 0.3));
        }
        for (const [uid, g] of this.doves) if (!live.has(uid)) { this.scene.remove(g); this.doves.delete(uid); }
        // Ядовитые цепи Сикера Ушум: из земли к скованным врагам
        const M = me ? player.semiMiasma : null, seen = new Set();
        if (M) {
            for (const c of M.chained) {
                seen.add(c);
                let arr = this.chains.get(c);
                if (!arr) { arr = []; for (let j = 0; j < 3; j++) { const m = new THREE.Mesh(this.chainGeo, new THREE.MeshStandardMaterial({ color: 0x3f6212, emissive: 0x84cc16, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.4 })); this.scene.add(m); arr.push({ m, a: c.seed + j / 3 * Math.PI * 2, t: 0 }); } this.chains.set(c, arr); }
                const e = this.pos(c.en.x, c.en.y);
                arr.forEach(L => { L.t += dt; const from = new THREE.Vector3(e.x + Math.cos(L.a) * 1.3, e.y + 0.02, e.z + Math.sin(L.a) * 1.3), to = new THREE.Vector3(e.x, e.y + 0.7, e.z), dir = to.clone().sub(from), len = dir.length() * Math.min(1, L.t / 0.15); L.m.position.copy(from); L.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); L.m.scale.set(1, len, 1); });
            }
            if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, rr = Math.random() * M.R / this.T, p = this.pos(M.x, M.y); AnimFX.emit({ x: p.x + Math.cos(a) * rr, y: p.y + 0.1, z: p.z + Math.sin(a) * rr, n: 2, color: [0x3f6212, 0x65a30d, 0x581c87], speed: 0.2, up: 0.4, life: 1.4, size: 0.2, sizeEnd: 0.45, grav: -0.1, drag: 2 }); }
        }
        for (const [c, arr] of this.chains) if (!seen.has(c)) { arr.forEach(L => { this.scene.remove(L.m); L.m.material.dispose(); }); this.chains.delete(c); }
        // Круги Садов: раскрытие, вращение, угасание
        const G = me ? player.semiGarden : null;
        for (const o of (this._gardens || [])) if (o !== G) { o.rings.forEach(R => this.scene.remove(R.m)); }
        this._gardens = G && G.rings ? [G] : [];
        if (G && G.rings) {
            const open = Math.min(1, G.t / 0.6), fade = Math.min(1, (3.3 - G.t) / 0.4);
            G.rings.forEach(R => { R.m.scale.setScalar(Math.max(0.01, R.rad * open)); R.m.userData.rune.uProg.value = open; R.m.userData.rune.uTime.value = Engine3D.t; R.m.userData.rune.uOp.value = fade; });
            Engine3D.scene.fog.color.lerp(new THREE.Color(0x1a0a24), 0.08); Engine3D.scene.background.copy(Engine3D.scene.fog.color);
        }
        if (!me) return;
        // Яд на врагах: зелёные пузырьки; уязвимость: серые перья
        for (const en of enemies) {
            if (en.deadTimer > 0) continue;
            if (en.semiPoison && Math.random() < 0.08 * en.semiPoison.stacks) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 0.6 + Math.random() * 0.6, z: q.z, n: 1, color: this.VENOM, speed: 0.2, up: 0.6, life: 0.6, size: 0.05, grav: -0.5 }); }
            if (en.semiExpose > 0 && Math.random() < 0.1) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 1.4, z: q.z, n: 1, color: [0xe5e7eb, 0xa855f7], speed: 0.2, up: 0.3, life: 0.6, size: 0.05, grav: 0.5 }); }
        }
        // Скрытность после Тёмного Шага — полупрозрачна
        const A = typeof Actors3D !== 'undefined' && Actors3D.player;
        if (A) { const want = player.semiVeil > 0 ? 0.35 : 1; if (A.semiOp !== want) { A.semiOp = want; A.mats.forEach(m => { if (m.userData.t0 === undefined) m.userData.t0 = m.transparent; m.transparent = want < 1 ? true : m.userData.t0; m.opacity = want; m.needsUpdate = true; }); } }
    },
    fxRunes() {
        if (player.heroType !== 'semiramis') return;
        const M = player.semiMiasma; if (M) { const p = this.pos(M.x, M.y); FX3D.runeAt(M, 0x65a30d, p.x, p.z, M.R / this.T, Math.min(1, M.t / 0.3) * Math.min(1, (M.dur - M.t) / 0.4), { spin: 0.8, crack: 0.6 }); }
        const G = player.semiGarden; if (G) { const p = this.pos(G.x, G.y); FX3D.runeAt(G, 0xa855f7, p.x, p.z, G.R / this.T, Math.min(1, G.t / 1.0) * Math.min(1, (3.3 - G.t) / 0.4), { crack: G.done ? 1 : Math.min(1, G.t / 2.75), spin: 1 }); }
    }
};
