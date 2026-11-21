// ============================================================================
// ЖАННА Д'АРК (класс «Правитель»): Святая Дева Орлеана, знаменосец
// ============================================================================
// Стойкий авангард: метки и подрывы, реактивный барьер, рывок с освящённой землёй и святое пламя.
// Не бессмертна: барьер защищает только внутри и недолго, ульта стоит четверть текущего здоровья.
// Q Суд Знаменосца — размашистый удар: урон по дуге, святая метка на врагах и освящённый след на земле.
//   Повторное попадание (Q или атака) по меченому — святая вспышка: урон вокруг, оглушение, враг обезоружен.
// W Вечная Яркость: Купол Истины — купол-щит; каждый сильный удар по нему выпускает импульс отдачи
//   (отталкивает и оглушает наседающих, очищает землю от вражеских зон).
// E Рывок Правосудия — сияющий рывок сквозь линию врагов, на финише — освящённый крест (урон и замедление).
// R Дева Орлеана: Очищающее Пламя — знамя вскинуто, рунический круг и столп святого огня: сокрушительный урон,
//   сожжённые щиты и усиления, тяжёлый ожог и ослабление выживших. Плата — много маны и 25% текущего здоровья.
const JEANNE_SKILLS = {
    q: { key: 'q', name: "Saint's Judgment", ruName: 'Суд Знаменосца', icon: '⚜️', manaCost: 22, baseCd: 3.5,
         desc: 'Размашистый удар знаменем с золотым шлейфом: урон по дуге, на врагах — святая метка, на земле — освящённый след (замедляет). Повторное попадание по меченому (этим навыком или атакой) вызывает святую вспышку: урон вокруг цели, оглушение и обезоруживание — окно для безопасной контратаки.',
         stats: l => `Удар ${50 + 24 * l} + атака • метка 5с • вспышка ${60 + 30 * l} в радиусе 95, оглушение 0.7с • след 3с` },
    w: { key: 'w', name: 'Luminosité Éternelle', ruName: 'Купол Истины', icon: '🛡️', manaCost: 70, baseCd: 18,
         desc: 'Жанна вонзает знамя — раскрывается золотой купол с рунами. Пока она внутри: урон по ней ниже, магический — ещё ниже, щит поглощает удары. Каждый сильный удар по куполу выпускает святой импульс отдачи: наседающих отбрасывает и оглушает, земля очищается от вражеских зон. Вышла из купола — защиты нет.',
         stats: l => `Купол ${(4 + 0.4 * l).toFixed(1)}с, радиус 150 • урон −${25 + 3 * l}%, магия ещё −20% • щит ${80 + 45 * l} • импульс ${30 + 15 * l}, оглушение 0.5с` },
    e: { key: 'e', name: 'Crusade Dash', ruName: 'Рывок Правосудия', icon: '🐎', manaCost: 40, baseCd: 9,
         desc: 'Стремительный рывок с сияющим золотым следом: пронзает линию врагов, на финише вспыхивает освящённый крест. Враги на пути и в кресте получают урон и замедляются. И вход в бой, и уход из опасной зоны.',
         stats: l => `Рывок ${260 + 10 * l} • урон ${50 + 24 * l} + атака • крест 110: ${15 + 8 * l}/0.5с на 3с, замедление 40% • перезарядка ${Math.max(5, 9 - 0.5 * l).toFixed(1)}с` },
    r: { key: 'r', name: 'La Pucelle', ruName: 'Очищающее Пламя', icon: '🔥', manaCost: 200, baseCd: 100,
         desc: 'Ультимейт. Жанна вскидывает знамя и взмывает над землёй — в обширной зоне загорается рунический круг, и через миг её накрывает величественный столп святого огня. Сокрушительный урон, сожжённые щиты и усиления (неуязвимость, броня, ускорения), тяжёлый ожог и ослабление ударов выживших. Плата — 200 маны и 25% текущего здоровья (не убивает).',
         stats: l => `Зона ${230 + 15 * l} • столп ${520 + 270 * l} + атака • ожог ${25 + 12 * l}/0.5с на 4с • удары врагов −30% на 6с • плата 25% здоровья • перезарядка ${100 - 5 * l}с` }
};
const JEANNE_ULT = { range: 420, wind: 1.2 };

const Jeanne = {
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(240 + L * 34 + eq.hp);
        player.maxMp = Math.round(210 + L * 26 + (q + w + e) * 6 + eq.mp);
        player.hpRegen = +(2.6 + L * 0.35).toFixed(1);
        player.mpRegen = +(5 + L * 0.45 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(24 + L * 6.5 + eq.hand);
        player.spellAmp = Math.round(8 + L * 2.5 + eq.amp);
        player.armor = Math.round(6 + L * 0.6 + eq.armor);
        player.moveSpeed = 205;
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        player.attackInterval = 0.62;
        player.attackRange = 100;
        player.critChance = 6 + eq.crit; player.critMult = 1.6;
    },
    pow() { return 1 + (player.spellAmp || 0) / 100; },
    lvl(k) { return Math.max(1, player.orbLevels[k] || 1); },
    ready(key) {
        const sk = JEANNE_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.jeanQueue = player.jeanQueue || []).push({ t, fn }); },
    crit(dmg) { const c = Math.random() * 100 < (player.critChance || 0); return { dmg: Math.round(dmg * (c ? player.critMult : 1)), crit: c }; },
    arc(ang, R, half, dmg, onEach) {
        let n = 0;
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
            if (d > R + en.radius) return;
            let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) > half && d > en.radius + 16) return;
            const c = this.crit(dmg); damageEnemy(en, c.dmg, false, dx / (d || 1) * 7, dy / (d || 1) * 7, '#fde68a', { crit: c.crit });
            if (onEach) onEach(en); n++;
        });
        if (n && typeof Feel !== 'undefined') Feel.impact(Math.cos(ang), Math.sin(ang), 0.6, false);
        return n;
    },
    // Святая метка: повторное попадание — вспышка (урон вокруг, оглушение, обезоруживание)
    hitMark(en) {
        if (en.deadTimer > 0) return;
        if (en.jeanMark > 0) {
            en.jeanMark = 0;
            const l = this.lvl('q'), dmg = (60 + 30 * l) * this.pow();
            enemies.forEach(o => {
                if (o.deadTimer > 0 || Math.hypot(o.x - en.x, o.y - en.y) > 95 + o.radius) return;
                damageEnemy(o, Math.round(dmg), true, 0, 0, '#fef3c7');
                o.stunTimer = Math.max(o.stunTimer || 0, 0.7); o.disarmTimer = Math.max(o.disarmTimer || 0, 1.5);
            });
            spawnFloatingText(en.x, en.y - 46, '✨ СУД', '#fef3c7');
            if (typeof Jeanne3D !== 'undefined') Jeanne3D.judgment(en.x, en.y);
            if (typeof Feel !== 'undefined') Feel.impact(0, 1, 0.8, true);
        } else en.jeanMark = 5;
    },
    attack() {
        const step = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 2) + 1; player.comboTimer = 1.5;
        player.basicAttackCd = player.attackInterval;
        player.slashAnimTime = 0.3;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        // Атака подрывает метку, но не ставит новую
        this.later(0.14, () => { this.arc(ang, 105, 0.8, player.handDmg * (step === 2 ? 1.2 : 1), en => { if (en.jeanMark > 0) this.hitMark(en); }); if (typeof Jeanne3D !== 'undefined') Jeanne3D.sweep(ang, 1.05, step, 0.6); });
        SoundFX.play('whoosh');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            this.later(0.18, () => {
                this.arc(ang, 145, 1.05, (50 + 24 * lvl) * P + H * 0.8, en => this.hitMark(en));
                // Освящённый след: дуга сияющих рун на земле, замедляет врагов 3с
                (player.jeanGlyphs = player.jeanGlyphs || []).push({ x: player.x + cx * 95, y: player.y + cy * 95, ang, t: 0, dur: 3, R: 75 });
                if (typeof Jeanne3D !== 'undefined') { Jeanne3D.sweep(ang, 1.5, 1, 1); Jeanne3D.glyphTrail(ang); }
            });
            player.knightAnim = { kind: 'cleave', t: 0.45 };
            this.cd('q', JEANNE_SKILLS.q.baseCd); SoundFX.play('whoosh');
        } else if (key === 'w') {
            const dur = 4 + 0.4 * lvl;
            player.jeanAegis = { x: player.x, y: player.y, R: 150, t: 0, dur, red: (25 + 3 * lvl) / 100, shield: 80 + 45 * lvl, max: 80 + 45 * lvl, pulse: (30 + 15 * lvl) * P, pcd: 0 };
            player.knightAnim = { kind: 'aegis', t: 0.6 };
            spawnFloatingText(player.x, player.y - 56, '✨ LUMINOSITÉ ÉTERNELLE', '#fef3c7');
            if (typeof Jeanne3D !== 'undefined') Jeanne3D.aegisOpen();
            this.cd('w', JEANNE_SKILLS.w.baseCd); SoundFX.play('invoke');
        } else if (key === 'e') {
            const range = 260 + 10 * lvl, d = Math.min(range, Math.max(80, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            player.jeanCharge = { t: 0, dur: 0.26, vx: cx * d / 0.26, vy: cy * d / 0.26, ang, dmg: (50 + 24 * lvl) * P + H * 0.6, hit: new Set(), ox: player.x, oy: player.y, len: d, cross: (15 + 8 * lvl) * P };
            player.invulnTime = Math.max(player.invulnTime, 0.25);
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'charge', t: 0.4 };
            this.cd('e', Math.max(5, JEANNE_SKILLS.e.baseCd - 0.5 * lvl)); SoundFX.play('tornado');
        } else if (key === 'r') {
            let tx = mouseWorldX, ty = mouseWorldY; const dd = Math.hypot(tx - player.x, ty - player.y);
            if (dd > JEANNE_ULT.range) { tx = player.x + (tx - player.x) / dd * JEANNE_ULT.range; ty = player.y + (ty - player.y) / dd * JEANNE_ULT.range; }
            const cost = Math.floor(player.hp * 0.25);
            player.hp = Math.max(1, player.hp - cost);   // плата за мощь: четверть текущего здоровья, но не смерть
            player.jeanUlt = { x: tx, y: ty, R: 230 + 15 * lvl, t: 0, dmg: (520 + 270 * lvl) * P + H * 2, burn: (25 + 12 * lvl) * P, done: false, burnT: 0, tick: 0 };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = { kind: 'pucelle', t: JEANNE_ULT.wind };
            spawnFloatingText(player.x, player.y - 40, `−${cost} ❤`, '#fca5a5');
            zoneBanner = { title: 'LA PUCELLE', sub: 'Дева Орлеана — Очищающее Пламя', life: 2.4, maxLife: 2.4, color: '#fde68a' };
            this.cd('r', JEANNE_SKILLS.r.baseCd - 5 * lvl);
            SoundFX.play('invoke');
            if (typeof Jeanne3D !== 'undefined') Jeanne3D.pucelleStart();
        }
        updateInvokerBarUI();
    },
    // Щит купола (из damagePlayer): поглощение и импульс отдачи на сильный удар. Возвращает остаток урона
    absorb(dmg, kind) {
        const A = player.jeanAegis; if (!A || !this.inAegis()) return dmg;
        dmg = Math.round(dmg * (1 - A.red) * (kind === 'magic' ? 0.8 : 1));
        const take = Math.min(A.shield, dmg); A.shield -= take;
        if (take > 0 && typeof Jeanne3D !== 'undefined') Jeanne3D.ping();
        if (dmg >= player.maxHp * 0.05 && A.pcd <= 0) this.pulse(A);
        return dmg - take;
    },
    // Святой импульс отдачи: отталкивает и оглушает наседающих, очищает землю под Жанной
    pulse(A) {
        A.pcd = 0.7;
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
            if (d > A.R * 0.8 + en.radius) return;
            damageEnemy(en, Math.round(A.pulse), true, 0, 0, '#fef3c7');
            en.stunTimer = Math.max(en.stunTimer || 0, 0.5);
            if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 70, dy / d * 70);
        });
        enemyHazards = enemyHazards.filter(h => Math.hypot(h.x - player.x, h.y - player.y) > 90);
        if (typeof Jeanne3D !== 'undefined') Jeanne3D.pulse();
    },
    inAegis() { const A = player.jeanAegis; return !!A && Math.hypot(player.x - A.x, player.y - A.y) <= A.R; },
    // Сжигание усилений: неуязвимость (кроме смены фазы босса), броня, ускорения + ослабление ударов
    purge(en, sec) {
        if (en.state !== 'roar') en.invuln = 0;
        if (!en.jeanBurnt) en.jeanBurnt = { dmg: en.dmg, armor: en.armor };
        en.jeanBurnt.t = sec;
        en.dmg = Math.round(en.jeanBurnt.dmg * 0.7); en.armor = 0;
        if (en.tpl && en.speed > en.tpl.speed * (diffCfg().speed || 1)) en.speed = Math.round(en.tpl.speed * (diffCfg().speed || 1));
    },
    update(dt) {
        if (player.heroType !== 'jeanne') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.jeanQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        const A = player.jeanAegis;
        if (A) { A.t += dt; A.pcd -= dt; if (A.t >= A.dur) { player.jeanAegis = null; if (typeof Jeanne3D !== 'undefined') Jeanne3D.aegisClose(); } }
        // Освящённая земля: следы Q и кресты рывка — замедление (и урон у креста)
        const Z = player.jeanGlyphs;
        if (Z) for (let i = Z.length - 1; i >= 0; i--) {
            const z = Z[i]; z.t += dt; z.acc = (z.acc || 0) + dt;
            const tick = z.acc >= 0.5; if (tick) z.acc -= 0.5;
            enemies.forEach(en => {
                if (en.deadTimer > 0 || Math.hypot(en.x - z.x, en.y - z.y) > z.R + en.radius) return;
                en.slowTimer = Math.max(en.slowTimer || 0, 0.3); en.slowMult = Math.min(en.slowMult || 1, 0.6);
                if (tick && z.dmg) damageEnemy(en, Math.round(z.dmg), true, 0, 0, '#fde68a');
            });
            if (z.t >= z.dur) Z.splice(i, 1);
        }
        // Рывок Правосудия
        const C = player.jeanCharge;
        if (C) {
            C.t += dt; tryMoveEntity(player, C.vx * dt, C.vy * dt);
            const ca = Math.cos(C.ang), sa = Math.sin(C.ang);
            enemies.forEach(en => {
                if (en.deadTimer > 0 || C.hit.has(en.uid) || Math.hypot(en.x - player.x, en.y - player.y) > 55 + en.radius) return;
                C.hit.add(en.uid);
                const c = this.crit(C.dmg); damageEnemy(en, c.dmg, false, ca * 8, sa * 8, '#fde68a', { crit: c.crit });
                en.stunTimer = Math.max(en.stunTimer || 0, 0.3); en.slowTimer = Math.max(en.slowTimer || 0, 2); en.slowMult = Math.min(en.slowMult || 1, 0.6);
                if (!en.isBoss) { const side = (-(en.x - player.x) * sa + (en.y - player.y) * ca) >= 0 ? 1 : -1; tryMoveEntity(en, -sa * side * 50, ca * side * 50); }
                if (typeof Feel !== 'undefined') Feel.impact(ca, sa, 0.7, c.crit);
            });
            if (typeof Jeanne3D !== 'undefined') Jeanne3D.chargeTrail();
            if (C.t >= C.dur) {
                player.jeanCharge = null;
                (player.jeanGlyphs = player.jeanGlyphs || []).push({ x: player.x, y: player.y, ang: C.ang, t: 0, dur: 3, R: 110, dmg: C.cross, cross: true });
                enemies.forEach(en => { if (en.deadTimer <= 0 && Math.hypot(en.x - player.x, en.y - player.y) < 110 + en.radius) damageEnemy(en, Math.round(C.cross * 3), true, 0, 0, '#fde68a'); });
                if (typeof Jeanne3D !== 'undefined') Jeanne3D.cross(player.x, player.y, C.ang);
            }
        }
        // Очищающее Пламя: молитва → столп огня → горящая земля
        const U = player.jeanUlt;
        if (U) {
            U.t += dt;
            if (!U.done && U.t >= JEANNE_ULT.wind) {
                U.done = true;
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const dx = en.x - U.x, dy = en.y - U.y, d = Math.hypot(dx, dy);
                    if (d > U.R + en.radius) return;
                    this.purge(en, 6);
                    damageEnemy(en, Math.round(U.dmg * (1 - 0.3 * d / U.R)), true, 0, 0, '#fbbf24');
                    if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 70, dy / d * 70);
                    en.stunTimer = Math.max(en.stunTimer || 0, 0.6);
                });
                spawnFloatingText(U.x, U.y - 70, '🔥 LA PUCELLE', '#fde68a');
                if (typeof Feel !== 'undefined') Feel.impact(0, 1, 1.5, true);
                if (typeof Jeanne3D !== 'undefined') Jeanne3D.pucelleBurst(U);
                SoundFX.play('sunstrike'); SoundFX.play('meteor');
            }
            if (U.done) {   // тяжёлый ожог 4 секунды
                U.burnT += dt; U.tick += dt;
                if (U.tick >= 0.5) { U.tick -= 0.5; enemies.forEach(en => { if (en.deadTimer <= 0 && Math.hypot(en.x - U.x, en.y - U.y) < U.R * 0.9 + en.radius) damageEnemy(en, Math.round(U.burn), true, 0, 0, '#fb923c'); }); }
                if (U.burnT >= 4) player.jeanUlt = null;
            }
        }
        for (const en of enemies) {
            if (en.jeanMark > 0) en.jeanMark -= dt;
            const b = en.jeanBurnt; if (b) { b.t -= dt; if (b.t <= 0 || en.deadTimer > 0) { en.dmg = b.dmg; en.armor = b.armor; en.jeanBurnt = null; } }
        }
    },
    damageMult() { return 1; },
    // Взмывает над землёй во время молитвы ульты
    alt() { const U = player.heroType === 'jeanne' && player.jeanUlt; if (!U) return 0; return U.done ? Math.max(0, 0.6 - U.burnT * 1.5) : Math.min(0.6, U.t * 0.8); },
    locked() { return player.heroType === 'jeanne' && !!(player.jeanCharge || (player.jeanUlt && !player.jeanUlt.done)); },
    reset() { player.jeanQueue = null; player.jeanCharge = null; player.jeanUlt = null; player.jeanAegis = null; player.jeanGlyphs = []; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('jeanActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'jeanActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = JEANNE_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnJeanLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-amber-100 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdJean${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-amber-200' : 'text-amber-50'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsJean${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudJeanHp', 'Кровь'], ['mp', '2', '🔮', 'hudJeanMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'jeanTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#fde68a">Жанна:</span><span id="jeanHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('jeanHint'), A = player.jeanAegis;
        if (el) el.textContent = player.jeanUlt && !player.jeanUlt.done ? 'Молитва Девы Орлеана…' : A ? (this.inAegis() ? `Купол: щит ${Math.ceil(A.shield)} • ${(A.dur - A.t).toFixed(1)}с` : 'Вне купола — защиты нет!') : 'Святая Дева Орлеана';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudJeanHp'), b = document.getElementById('hudJeanMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ ЖАННЫ: золотой след знамени, купол света, святой натиск, столп пламени
// ============================================================================
const Jeanne3D = {
    T: 48,
    HOLY: [0xfef3c7, 0xfde68a, 0xfbbf24, 0xffffff],
    FLAME: [0xfbbf24, 0xfb923c, 0xfde68a, 0xffffff, 0xf97316],
    fx: [], scene: null, dome: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        this.arcGeo = new THREE.RingGeometry(0.8, 1, 28, 1, -1, 2); this.arcGeo.rotateX(-Math.PI / 2);
        return true;
    },
    mat(c, op = 1, extra) { return new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, extra || {})); },
    add(m, life, upd) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd }); },
    // Широкая дуга знамени: золотая полоса и белое ядро
    sweep(ang, r, step, op) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos();
        [[0xfbbf24, op, r], [0xffffff, op * 0.8, r * 0.93]].forEach(([c, o0, rr]) => {
            const m = new THREE.Mesh(this.arcGeo, this.mat(c, o0)); m.position.set(h.x, h.y + 0.7 + (step % 2 ? 0.08 : -0.04), h.z);
            m.rotation.set(step % 2 ? 0.25 : -0.25, -ang, 0); m.scale.setScalar(rr);
            this.add(m, 0.26, (o, k) => { o.m.material.opacity = o0 * (1 - k); o.m.scale.setScalar(rr * (1 + k * 0.2)); });
        });
        AnimFX.emit({ x: h.x + Math.cos(ang) * r, y: h.y + 0.8, z: h.z + Math.sin(ang) * r, n: 10, color: this.HOLY, speed: 1.8, life: 0.35, size: 0.05, grav: 2 });
    },
    purify() { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.06, h.z, 0xfef3c7, 0.2, 1.6, 0.4, 0.8); AnimFX.emit({ x: h.x, y: h.y + 0.2, z: h.z, n: 18, color: this.HOLY, speed: 0.8, up: 2.5, life: 0.7, size: 0.05, grav: -1.5, r: 0.6 }); },
    // Купол: полупрозрачная полусфера со светящимся краем; руны на земле рисует fxRunes
    aegisOpen() {
        if (!this.ensure()) return;
        this.aegisClose(true);
        const A = player.jeanAegis, p = this.pos(A.x, A.y), r = A.R / this.T;
        const g = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xfde68a, 0.14));
        const rim = new THREE.Mesh(new THREE.SphereGeometry(1.01, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xffffff, 0.12, { wireframe: true }));
        g.add(shell); g.add(rim); g.position.set(p.x, p.y, p.z); g.scale.set(0.01, 0.01, 0.01); this.scene.add(g);
        this.dome = { g, shell, rim, r, t: 0, ping: 0 };
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfde68a, 0.2, r, 0.5, 1); AnimFX.flash(p.x, p.z, 0xfef3c7, 6, 0.5, 2);
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 40, color: this.HOLY, speed: 2, up: 3, life: 0.8, size: 0.05, grav: -1, r: r * 0.6 });
    },
    aegisClose(silent) {
        const D = this.dome; if (!D) return;
        if (!silent) { const p = D.g.position; AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 30, color: this.HOLY, speed: 2.5, up: 1, life: 0.6, size: 0.05, grav: 2, r: D.r * 0.7 }); }
        this.scene.remove(D.g); D.g.traverse(m => { if (m.material) { m.material.dispose(); m.geometry.dispose(); } }); this.dome = null;
    },
    ping() { if (this.dome) this.dome.ping = 1; },
    chargeTrail() { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x, y: h.y + 0.3 + Math.random() * 1.2, z: h.z, n: 5, color: this.HOLY, speed: 0.4, life: 0.45, size: 0.08, sizeEnd: 0.01, grav: 0, drag: 2 }); AnimFX.emit({ x: h.x, y: h.y + 0.1, z: h.z, n: 2, color: 0x7a6a5a, speed: 1, up: 0.5, life: 0.6, size: 0.2, sizeEnd: 0.4, grav: -0.2, drag: 3 }); },
    pucelleStart() { const h = AnimFX.heroPos(); AnimFX.flash(h.x, h.z, 0xfde68a, 5, 1.2, 2.2); AnimFX.emit({ x: h.x, y: h.y + 1.5, z: h.z, n: 30, color: this.HOLY, speed: 1, up: 3, life: 1, size: 0.05, grav: -2 }); },
    // Столп святого пламени: колонна света, кольца, огненный выброс
    pucelleBurst(U) {
        if (!this.ensure()) return;
        const p = this.pos(U.x, U.y), r = U.R / this.T;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.75, 5, 32, 1, true), this.mat(0xfbbf24, 0.4));
        col.geometry.translate(0, 2.5, 0); col.position.set(p.x, p.y, p.z);
        this.add(col, 1.1, (o, k) => { o.m.scale.set(1 - k * 0.5, 0.2 + Math.min(1, k * 6) * 0.8, 1 - k * 0.5); o.m.material.opacity = 0.4 * (1 - k); o.m.rotation.y += 0.05; if (k >= 1) o.m.geometry.dispose(); });
        const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.22, 6, 20, 1, true), this.mat(0xfff7d6, 0.22));
        core.geometry.translate(0, 3, 0); core.position.set(p.x, p.y, p.z);
        this.add(core, 0.7, (o, k) => { o.m.material.opacity = 0.22 * (1 - k); if (k >= 1) o.m.geometry.dispose(); });
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfbbf24, 0.3, r * 1.15, 0.6, 1); AnimFX.shock(p.x, p.y + 0.08, p.z, 0xffffff, 0.2, r * 0.8, 0.45, 0.9); AnimFX.shock(p.x, p.y + 2, p.z, 0xfb923c, 0.2, r * 0.9, 0.5, 0.7);
        AnimFX.emit({ x: p.x, y: p.y + 0.5, z: p.z, n: 110, color: this.FLAME, speed: 4, up: 5, life: 1.1, size: 0.09, sizeEnd: 0.02, grav: -0.5, drag: 1, r: r * 0.6 });
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 40, color: this.HOLY, speed: 7, up: 1, life: 0.6, size: 0.06, grav: 3 });
        AnimFX.flash(p.x, p.z, 0xfb923c, 7, 0.8, 3);
        AnimFX.kick(1.4);
    },
    // Освящённый след Q: золотые руны дугой на земле
    glyphTrail(ang) { const h = AnimFX.heroPos(); for (let i = -3; i <= 3; i++) { const a = ang + i * 0.18, r = 1.9; AnimFX.emit({ x: h.x + Math.cos(a) * r, y: h.y + 0.08, z: h.z + Math.sin(a) * r, n: 3, color: this.HOLY, speed: 0.2, up: 0.6, life: 1.4, size: 0.06, grav: -0.2, drag: 3 }); } },
    // Святая вспышка подрыва метки
    judgment(x, y) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfef3c7, 0.2, 95 / this.T, 0.4, 1); AnimFX.emit({ x: p.x, y: p.y + 0.5, z: p.z, n: 30, color: this.HOLY, speed: 3, up: 4, life: 0.6, size: 0.06, grav: -1 }); AnimFX.flash(p.x, p.z, 0xfef3c7, 6, 0.3, 2); if (this.ensure()) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 4, 16, 1, true), this.mat(0xfff7d6, 0.6)); col.geometry.translate(0, 2, 0); col.position.set(p.x, p.y, p.z); this.add(col, 0.35, (o, k) => { o.m.material.opacity = 0.6 * (1 - k); o.m.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); if (k >= 1) o.m.geometry.dispose(); }); } },
    // Импульс отдачи купола
    pulse() { const D = this.dome; if (!D) return; const p = D.g.position; D.ping = 1; AnimFX.shock(p.x, p.y + 0.1, p.z, 0xfde68a, 0.3, D.r * 0.85, 0.35, 1); AnimFX.shock(p.x, p.y + 1, p.z, 0xffffff, 0.2, D.r * 0.6, 0.3, 0.7); AnimFX.emit({ x: p.x, y: p.y + 0.6, z: p.z, n: 30, color: this.HOLY, speed: 4, up: 1, life: 0.5, size: 0.05, grav: 1 }); AnimFX.kick(0.4); },
    // Освящённый крест на финише рывка
    cross(x, y, ang) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfbbf24, 0.2, 110 / this.T, 0.45, 1); AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 36, color: this.HOLY, speed: 2.5, up: 3, life: 0.7, size: 0.06, grav: -0.5 }); AnimFX.flash(p.x, p.z, 0xfde68a, 5, 0.35, 1.8); AnimFX.kick(0.5); },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'jeanne' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) { const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life); if (o.upd) o.upd(o, k); if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); this.fx.splice(i, 1); } }
        const A = player.heroType === 'jeanne' ? player.jeanAegis : null, D = this.dome;
        if (!A && D) this.aegisClose(true);
        if (A && D) {
            D.t += dt; D.ping = Math.max(0, D.ping - dt * 4);
            const open = Math.min(1, D.t / 0.25), fade = Math.min(1, (A.dur - A.t) / 0.4), inside = Jeanne.inAegis();
            D.g.scale.set(D.r * open, D.r * 0.85 * open, D.r * open);
            D.shell.material.opacity = (0.1 + D.ping * 0.25 + (A.shield / A.max) * 0.08) * fade * (inside ? 1 : 0.5);
            D.rim.material.opacity = (0.1 + D.ping * 0.3) * fade; D.rim.rotation.y += dt * 0.4;
            if (Math.random() < 0.3) { const a = Math.random() * Math.PI * 2, rr = Math.random() * D.r; AnimFX.emit({ x: D.g.position.x + Math.cos(a) * rr, y: D.g.position.y + 0.1, z: D.g.position.z + Math.sin(a) * rr, n: 1, color: this.HOLY, speed: 0.1, up: 1.2, life: 1, size: 0.04, grav: -0.6 }); }
        }
        if (player.heroType !== 'jeanne') return;
        for (const en of enemies) if (en.jeanMark > 0 && en.deadTimer <= 0 && Math.random() < 0.25) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 1.5, z: q.z, n: 1, color: this.HOLY, speed: 0.2, up: 0.4, life: 0.5, size: 0.06, grav: 0 }); }   // святая метка
        // Молитва: искры стягиваются к знамени; горящая земля после столпа
        const U = player.jeanUlt;
        if (U) {
            const p = this.pos(U.x, U.y), r = U.R / this.T;
            if (!U.done) { for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2, rr = r * (0.3 + Math.random() * 0.7); AnimFX.emit({ x: p.x + Math.cos(a) * rr, y: p.y + 0.1, z: p.z + Math.sin(a) * rr, n: 1, color: this.HOLY, speed: 0.1, up: 2 + U.t * 3, life: 0.6, size: 0.05, grav: -2 }); } }
            else if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.85; AnimFX.emit({ x: p.x + Math.cos(a) * rr, y: p.y + 0.1, z: p.z + Math.sin(a) * rr, n: 2, color: this.FLAME, speed: 0.3, up: 2.5, life: 0.7, size: 0.08, sizeEnd: 0.02, grav: -1.5 }); }
        }
    },
    fxRunes() {
        if (player.heroType !== 'jeanne') return;
        const U = player.jeanUlt;
        if (U) { const p = this.pos(U.x, U.y); FX3D.runeAt(U, U.done ? 0xfb923c : 0xfde68a, p.x, p.z, U.R / this.T, U.done ? Math.max(0, 1 - U.burnT / 3) : Math.min(1, U.t / JEANNE_ULT.wind), { crack: U.done ? 1 : U.t / JEANNE_ULT.wind, spin: 1.5 }); }
        const A = player.jeanAegis;
        if (A) { const p = this.pos(A.x, A.y); FX3D.runeAt(A, 0xfef3c7, p.x, p.z, A.R / this.T, Math.min(1, A.t / 0.3) * Math.min(1, (A.dur - A.t) / 0.4), { tag: 'aegis', spin: 0.6 }); }
        for (const z of (player.jeanGlyphs || [])) { const p = this.pos(z.x, z.y), f = Math.min(1, z.t / 0.2) * Math.min(1, (z.dur - z.t) / 0.4); if (z.cross) { const a = Math.atan2(Math.cos(z.ang), Math.sin(z.ang)); FX3D.runeAt(z, 0xfbbf24, p.x, p.z, z.R / this.T, f, { tag: 'c', spin: 0.5 }); FX3D.runeAt(z, 0xfef3c7, p.x - Math.cos(z.ang) * z.R / this.T, p.z - Math.sin(z.ang) * z.R / this.T, 0, f, { tag: 'v', rect: true, ang: a, w: 0.45, len: 2 * z.R / this.T }); FX3D.runeAt(z, 0xfef3c7, p.x + Math.sin(z.ang) * z.R / this.T * 0.6, p.z - Math.cos(z.ang) * z.R / this.T * 0.6, 0, f, { tag: 'h', rect: true, ang: a + Math.PI / 2, w: 0.45, len: 1.2 * z.R / this.T }); } else FX3D.runeAt(z, 0xfde68a, p.x, p.z, z.R / this.T, f, { spin: 0.4, op: 0.6 }); }
        const C = player.jeanCharge;
        if (C) { const o = this.pos(C.ox, C.oy), a = Math.atan2(Math.cos(C.ang), Math.sin(C.ang)); FX3D.runeAt(C, 0xfbbf24, o.x, o.z, 0, 1 - C.t / C.dur, { rect: true, ang: a, w: 110 / this.T, len: C.len / this.T, crack: 0.2 }); }
    }
};
