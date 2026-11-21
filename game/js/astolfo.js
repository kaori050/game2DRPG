// ============================================================================
// АСТОЛЬФО (класс «Райдер»): Рыцарь Карла Великого, наездник Гиппогрифа
// ============================================================================
// Самый быстрый герой: копьё вблизи, рывки, контроль и срыв вражеских баффов. Умеренная живучесть —
// играет скоростью и позиционированием. Гиппогриф — настоящий скакун из модели: Астольфо садится на него
// верхом (родные анимации посадки и полёта модели), взлетает над полем, летит над препятствиями и пикирует.
// Атака — комбо из четырёх ударов: рубящий → выпад → удар с разворота → летящий выпад (отбрасывает).
// Q Ловушка Аргалии — молниеносный выпад к курсору: урон по линии, ломает защиту и баффы, сбивает касты, отбрасывает.
// W Рог Отчаяния (La Black Luna) — пауза, вдох — и звуковая волна конусом: урон, оглушение, отбрасывание.
// E Книга Исчезновения — Гиппогриф подхватывает Астольфо: короткий бросок по воздуху над препятствиями,
//   неуязвимость в полёте, затем невидимость и ускорение.
// R Гиппогриф — посадка верхом, взлёт, полёт к цели над полем (порывы крыльев сбивают врагов) и пике.
const ASTO_SKILLS = {
    q: { key: 'q', name: 'Trap of Argalia', ruName: 'Ловушка Аргалии', icon: '🗡️', manaCost: 22, baseCd: 4,
         desc: 'Короткая пауза — и молниеносный выпад копьём к курсору с ярким следом. Бьёт всех на линии, слегка отбрасывает и ломает их защиту: снимает неуязвимость (кроме смены фазы босса), броню, сопротивление магии и ускорения на 4 секунды, сбивает замахи и касты.',
         stats: l => `Урон ${45 + 22 * l} + атака • линия 200 • снятие защиты 4с • перезарядка 4с` },
    w: { key: 'w', name: 'La Black Luna', ruName: 'Рог Отчаяния', icon: '📯', manaCost: 55, baseCd: 12,
         desc: 'Астольфо пригибается за огромным кольцевым рогом La Black Luna и трубит. Главная волна бьёт конусом вперёд (урон, оглушение, отбрасывание), а отголосок рёва сбивает с ног всех вплотную вокруг. Замахи и касты врагов срываются. Обе зоны видны на земле ещё до звука.',
         stats: l => `Конус 300 / 115°: ${40 + 20 * l} + атака, оглушение ${(0.8 + 0.1 * l).toFixed(1)}с • вокруг 150: половина урона и оглушения • перезарядка ${Math.max(7, 12 - 0.5 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Book of Vanishing', ruName: 'Книга Исчезновения', icon: '📖', manaCost: 30, baseCd: 7,
         desc: 'Луна Брейк Мануал: страницы книги разлетаются, Астольфо полностью исчезает и появляется у курсора — сквозь деревья, скалы и врагов, без застревания — с эффектным разворотом. В переносе неуязвим, после появления на миг скрыт от врагов и ускорен.',
         stats: l => `Бросок ${250 + 12 * l} по воздуху • неуязвимость в полёте • невидимость 0.8с • ускорение +30% на 2.5с • перезарядка ${Math.max(4, 7 - 0.4 * l).toFixed(1)}с` },
    r: { key: 'r', name: 'Hippogriff', ruName: 'Гиппогриф', icon: '🦅', manaCost: 170, baseCd: 90,
         desc: 'Ультимейт. Астольфо запрыгивает верхом на Гиппогрифа, взмывает в воздух и летит к цели над полем боя: порывы крыльев сбивают врагов под ним. В конце — пике и сокрушительный таран в зоне удара. Посадка — 1.3 секунды (Астольфо прыгает, под ним появляется Гиппогриф), в полёте он держит копьё Аргалии и неуязвим. Путь и место удара видны заранее.',
         stats: l => `Полёт до ${ASTO_ULT.range} • порывы крыльев ${90 + 45 * l} • пике ${300 + 150 * l} + атака в радиусе 190, оглушение 1.2с • перезарядка ${90 - 5 * l}с` }
};
const ASTO_ULT = { range: 560, mount: 1.3, fly: 1.1, dive: 0.3, land: 0.4, alt: 2.6, width: 130 };
// Комбо атаки: анимация, урон, рывок вперёд, ширина и отбрасывание
const ASTO_COMBO = [
    { style: 'slash', dur: 0.3, mult: 1, step: 10, len: 95, w: 90, kb: 0 },
    { style: 'cross', dur: 0.32, mult: 1.1, step: 22, len: 110, w: 60, kb: 0 },
    { style: 'spin', dur: 0.4, mult: 1.25, step: 8, len: 100, w: 130, kb: 0 },
    { style: 'dash', dur: 0.38, mult: 1.6, step: 55, len: 125, w: 70, kb: 45 }
];

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
        player.attackInterval = 0.42;
        player.attackRange = 95;
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
    inLine(ox, oy, ang, len, w, fn) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const rx = en.x - ox, ry = en.y - oy, al = rx * ca + ry * sa, pp = Math.abs(-rx * sa + ry * ca);
            if (al < -en.radius || al > len + en.radius || pp > w / 2 + en.radius) return;
            fn(en, al, -rx * sa + ry * ca);
        });
    },
    // Дальняя свободная точка на линии полёта (над препятствиями можно, приземляться — только на землю)
    landing(ox, oy, ang, dist) {
        for (let s = dist; s >= 20; s -= 12) { const x = ox + Math.cos(ang) * s, y = oy + Math.sin(ang) * s; if (!isTileBlocked(Math.floor(x / TS), Math.floor(y / TS))) return { x, y, d: s }; }
        return { x: ox, y: oy, d: 0 };
    },
    sunder(en, sec) {
        if (en.state !== 'roar') en.invuln = 0;   // неуязвимость смены фазы босса — механика боя, её не трогаем
        if (!en.astoBreak) en.astoBreak = { armor: en.armor, mres: en.mres };
        en.astoBreak.t = sec;
        en.armor = 0; en.mres = 0;
        if (en.tpl && en.speed > en.tpl.speed * (diffCfg().speed || 1)) en.speed = Math.round(en.tpl.speed * (diffCfg().speed || 1));
        if (typeof Asto3D !== 'undefined') Asto3D.shatter(en);
    },
    interrupt(en) {
        en.disarmTimer = Math.max(en.disarmTimer || 0, en.isBoss ? 0.6 : 1.1);
        en.attackCd = Math.max(en.attackCd || 0, 0.7);
        if (en.specialCd !== undefined) en.specialCd = Math.max(en.specialCd, 1.8);
        en.leapT = 0;
        if (en.state === 'drain' || en.state === 'charge') { en.state = 'chase'; en.stateT = 0; spawnFloatingText(en.x, en.y - 44, 'ПРЕРВАНО!', '#f9a8d4'); }
    },
    // Комбо из четырёх ударов с шагом вперёд; четвёртый — летящий выпад с отбрасыванием
    attack() {
        const k = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 4) + 1; player.comboTimer = 1.1;
        const C = ASTO_COMBO[k - 1];
        player.basicAttackCd = player.attackInterval * (k === 4 ? 1.45 : 1);
        player.slashAnimTime = C.dur;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        const ca = Math.cos(ang), sa = Math.sin(ang), hitAt = C.dur * 0.45;
        player.astoStep = { t: 0, dur: hitAt, vx: ca * C.step / hitAt, vy: sa * C.step / hitAt };   // шаг вперёд под удар
        this.later(hitAt, () => {
            let hit = 0;
            this.inLine(player.x - ca * 15, player.y - sa * 15, ang, C.len, C.w, en => {
                const c = this.crit(player.handDmg * C.mult); damageEnemy(en, c.dmg, false, ca * 5, sa * 5, '#f9a8d4', { crit: c.crit }); hit++;
                if (C.kb && !en.isBoss) tryMoveEntity(en, ca * C.kb, sa * C.kb);
            });
            if (typeof Asto3D !== 'undefined') Asto3D.slashFx(ang, k);
            if (hit && typeof Feel !== 'undefined') Feel.impact(ca, sa, k === 4 ? 0.9 : 0.35 + k * 0.1, false);
        });
        SoundFX.play('whoosh');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (key === 'q') {
            // Пауза-прицел 0.12с → молниеносный выпад на 120 вперёд → удар по линии
            const dmg = (45 + 22 * lvl) * P + H * 0.7;
            player.knightAnim = { kind: 'thrust', t: 0.42 };
            this.later(0.12, () => {
                const ox = player.x, oy = player.y;
                player.astoDash = { t: 0, dur: 0.12, vx: cx * 120 / 0.12, vy: cy * 120 / 0.12 };
                if (typeof Asto3D !== 'undefined') Asto3D.thrust(ox, oy, ang, 200);
                this.later(0.08, () => {
                    this.inLine(ox, oy, ang, 200, 64, en => {
                        const c = this.crit(dmg); damageEnemy(en, c.dmg, false, cx * 8, cy * 8, '#f472b6', { crit: c.crit });
                        this.sunder(en, 4); this.interrupt(en);
                        if (!en.isBoss) tryMoveEntity(en, cx * 28, cy * 28);
                    });
                    if (typeof Feel !== 'undefined') Feel.impact(cx, cy, 0.9, false);
                });
            });
            this.cd('q', ASTO_SKILLS.q.baseCd); SoundFX.play('bolt');
        } else if (key === 'w') {
            // Подносит рог (0.28с, зона уже видна) → звуковая волна
            const R = 300, half = 1.0, ring = 150, dmg = (40 + 20 * lvl) * P + H * 0.5, st = 0.8 + 0.1 * lvl;
            player.astoHorn = { t: 0, ang, R, half, blown: false };
            player.knightAnim = { kind: 'horn', t: 0.95 };
            player.astoRoot = 0.6;   // не сдвинуть, пока трубит
            if (typeof Asto3D !== 'undefined') { Asto3D.hornTell(ang, R, half, 0.42); Asto3D.hornTell(ang, ring / 1, Math.PI, 0.42, 0x6b2150); }
            this.later(0.42, () => {
                player.astoHorn && (player.astoHorn.blown = true);
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                    if (d > R + en.radius) return;
                    let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                    const front = Math.abs(da) <= half || d <= en.radius + 20;
                    if (!front && d > ring + en.radius) return;
                    const k = front ? 1 : 0.5;   // отголосок вокруг — половина силы
                    damageEnemy(en, Math.round(dmg * k), true, 0, 0, '#f0abfc');
                    en.stunTimer = Math.max(en.stunTimer || 0, st * k);
                    this.interrupt(en);
                    if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 80, dy / d * 80);
                });
                if (typeof Asto3D !== 'undefined') { Asto3D.horn(ang, R, half); Asto3D.hornRing(ring); }
                if (typeof Feel !== 'undefined') Feel.shake(cx, cy, 0.25, 18, 7);
                SoundFX.play('thunder');
            });
            this.cd('w', Math.max(7, ASTO_SKILLS.w.baseCd - 0.5 * lvl));
        } else if (key === 'e') {
            // Бросок верхом: Гиппогриф уносит по воздуху над препятствиями к свободной точке
            const range = 250 + 12 * lvl, want = Math.min(range, Math.max(90, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            const L = this.landing(player.x, player.y, ang, want);
            if (L.d < 30) { player.mp += ASTO_SKILLS.e.manaCost; showToast('Некуда приземлиться', 'error'); return; }
            if (typeof Asto3D !== 'undefined') Asto3D.vanish(player.x, player.y);
            player.astoGlide = { t: 0, dur: 0.4, ox: player.x, oy: player.y, tx: L.x, ty: L.y, ang };
            player.astoVanishing = true;
            player.invulnTime = Math.max(player.invulnTime, 0.6);
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = null;
            this.cd('e', Math.max(4, ASTO_SKILLS.e.baseCd - 0.4 * lvl)); SoundFX.play('tornado');
        } else if (key === 'r') {
            const want = Math.min(ASTO_ULT.range, Math.max(160, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            const L = this.landing(player.x, player.y, ang, want);
            player.astoUlt = { t: 0, phase: 'mount', ang, ox: player.x, oy: player.y, tx: L.x, ty: L.y, dist: L.d, gust: (90 + 45 * lvl) * P, slam: (300 + 150 * lvl) * P + H * 1.2, hit: new Set(), alt: 0 };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            player.knightAnim = { kind: 'mount', t: ASTO_ULT.mount };
            this.cd('r', ASTO_SKILLS.r.baseCd - 5 * lvl);
            SoundFX.play('invoke');
            zoneBanner = { title: 'ГИППОГРИФ', sub: 'Неукротимый Полёт', life: 2.4, maxLife: 2.4, color: '#f9a8d4' };
            if (typeof Asto3D !== 'undefined') Asto3D.summon();
        }
        updateInvokerBarUI();
    },
    // Высота над землёй (тайлы) для 3D: бросок и полёт верхом
    alt() {
        const U = player.astoUlt; return U ? U.alt : 0;
    },
    // Поза на скакуне: пока летим — родная анимация полёта верхом
    mounted() { const U = player.astoUlt; return !!(U && U.phase !== 'mount' && U.phase !== 'land'); },
    update(dt) {
        if (player.heroType !== 'astolfo') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.astoQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        if (player.astoVanish > 0) player.astoVanish = Math.max(0, player.astoVanish - dt);
        if (player.astoRoot > 0) player.astoRoot = Math.max(0, player.astoRoot - dt);
        if (player.astoHaste > 0) { player.astoHaste -= dt; if (player.astoHaste <= 0) { player.astoHaste = 0; recalcPlayerStats(); } }
        if (player.astoHorn) { player.astoHorn.t += dt; if (player.astoHorn.t > 0.7) player.astoHorn = null; }
        const S = player.astoStep;
        if (S) { S.t += dt; tryMoveEntity(player, S.vx * dt, S.vy * dt); if (S.t >= S.dur) player.astoStep = null; }
        const D = player.astoDash;
        if (D) { D.t += dt; tryMoveEntity(player, D.vx * dt, D.vy * dt); if (D.t >= D.dur) player.astoDash = null; }
        // Бросок верхом: по воздуху (сквозь препятствия) к точке приземления
        const G = player.astoGlide;
        if (G) {
            G.t += dt; const k = Math.min(1, G.t / G.dur), e = k * k * (3 - 2 * k);
            player.x = G.ox + (G.tx - G.ox) * e; player.y = G.oy + (G.ty - G.oy) * e; player.facingAngle = G.ang;
            if (typeof Asto3D !== 'undefined') Asto3D.ghost();
            if (k >= 1) {
                player.astoGlide = null; player.astoVanishing = false;
                player.knightAnim = { kind: 'reappear', t: 0.32 };
                player.astoVanish = 0.8; player.astoHaste = 2.5; recalcPlayerStats();
                enemies.forEach(en => { if (en.aggro > 0) en.aggro = 0; });
                if (typeof Asto3D !== 'undefined') Asto3D.touchdown(player.x, player.y, false);
            }
        }
        // Гиппогриф: посадка → взлёт и полёт → пике → приземление
        const U = player.astoUlt;
        if (U) {
            U.t += dt; player.facingAngle = U.ang;
            const ca = Math.cos(U.ang), sa = Math.sin(U.ang), M = ASTO_ULT;
            if (U.phase === 'mount') {
                // Пока Астольфо садится верхом, курс можно довернуть
                const want = Math.atan2(mouseWorldY - U.oy, mouseWorldX - U.ox);
                let d = want - U.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
                U.ang += Math.max(-dt * 1.4, Math.min(dt * 1.4, d));
                const dd = Math.min(M.range, Math.max(160, Math.hypot(mouseWorldX - U.ox, mouseWorldY - U.oy))), L = this.landing(U.ox, U.oy, U.ang, dd);
                U.tx = L.x; U.ty = L.y; U.dist = L.d;
                if (U.t >= M.mount) { U.phase = 'fly'; U.t0 = U.t; player.knightAnim = null; SoundFX.play('tornado'); if (typeof Asto3D !== 'undefined') Asto3D.takeoff(); }
            }
            if (U.phase === 'fly' || U.phase === 'dive') {
                player.invulnTime = Math.max(player.invulnTime, 0.15);
                const ft = U.t - U.t0, total = M.fly + M.dive, k = Math.min(1, ft / total);
                // Путь: плавный разгон; высота — быстрый взлёт, парение, резкое пике в конце
                const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                player.x = U.ox + (U.tx - U.ox) * e; player.y = U.oy + (U.ty - U.oy) * e;
                const up = Math.min(1, ft / 0.35), down = ft > M.fly ? Math.min(1, (ft - M.fly) / M.dive) : 0;
                U.alt = M.alt * (1 - (1 - up) * (1 - up)) * (1 - down * down) + Math.sin(ft * 9) * 0.06 * (1 - down);
                if (ft > M.fly && U.phase === 'fly') { U.phase = 'dive'; if (typeof Asto3D !== 'undefined') Asto3D.diveStart(); }
                // Порывы крыльев: враги под траекторией сбиты в стороны (один раз каждый)
                if (U.phase === 'fly') this.inLine(U.ox, U.oy, U.ang, Math.hypot(player.x - U.ox, player.y - U.oy) + 30, M.width, (en, al, side) => {
                    if (U.hit.has(en.uid)) return; U.hit.add(en.uid);
                    damageEnemy(en, Math.round(U.gust), true, 0, 0, '#fbcfe8');
                    if (!en.isBoss) { const s = side >= 0 ? 1 : -1; tryMoveEntity(en, -sa * s * 70, ca * s * 70); }
                    en.slowTimer = Math.max(en.slowTimer || 0, 1.5); en.slowMult = Math.min(en.slowMult || 1, 0.6);
                    if (typeof Asto3D !== 'undefined') Asto3D.gust(en.x, en.y);
                });
                if (k >= 1) {
                    U.phase = 'land'; U.t0 = U.t; U.alt = 0;
                    enemies.forEach(en => {
                        if (en.deadTimer > 0) return;
                        const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                        if (d > 190 + en.radius) return;
                        damageEnemy(en, Math.round(U.slam * (1 - 0.3 * d / 190)), false, 0, 0, '#f472b6');
                        en.stunTimer = Math.max(en.stunTimer || 0, 1.2);
                        if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 90, dy / d * 90);
                    });
                    player.knightAnim = { kind: 'land', t: M.land };
                    spawnFloatingText(player.x, player.y - 60, '🦅 HIPPOGRIFF', '#f9a8d4');
                    if (typeof Feel !== 'undefined') Feel.impact(ca, sa, 1.5, true);
                    if (typeof Asto3D !== 'undefined') Asto3D.slam(player.x, player.y);
                    SoundFX.play('meteor');
                }
            }
            if (U.phase === 'land' && U.t - U.t0 >= M.land) player.astoUlt = null;
        }
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'astolfo' && !!(player.astoUlt || player.astoDash || player.astoGlide || player.astoRoot > 0); },
    reset() { player.astoQueue = null; player.astoDash = null; player.astoStep = null; player.astoGlide = null; player.astoUlt = null; player.astoHorn = null; player.astoVanish = 0; player.astoHaste = 0; player.astoRoot = 0; player.astoVanishing = false; },

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
        if (el) el.textContent = player.astoUlt ? (player.astoUlt.phase === 'mount' ? 'Верхом на Гиппогрифа…' : 'Гиппогриф в небе!') : player.astoGlide ? 'Полёт!' : player.astoVanish > 0 ? 'Исчез из виду…' : player.astoHaste > 0 ? `Ускорение: ${player.astoHaste.toFixed(1)}с` : 'Рыцарь Карла Великого';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudAstoHp'), b = document.getElementById('hudAstoMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ АСТОЛЬФО: дуги комбо, след выпада, рог, вихрь крыльев Гиппогрифа, пике
// ============================================================================
const Asto3D = {
    T: 48,
    PINK: [0xf9a8d4, 0xf472b6, 0xfde68a, 0xffffff],
    FEATHER: [0xffffff, 0xf5f5f4, 0xfbcfe8, 0xfde68a],
    fx: [], scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        this.planeGeo = new THREE.PlaneGeometry(1, 1); this.planeGeo.rotateX(-Math.PI / 2); this.planeGeo.translate(0, 0, -0.5);
        this.arcGeo = new THREE.RingGeometry(0.9, 1, 32, 1, -0.7, 1.4); this.arcGeo.rotateX(-Math.PI / 2);
        this.slashGeo = new THREE.RingGeometry(0.78, 1, 30, 1, -1.1, 2.2); this.slashGeo.rotateX(-Math.PI / 2);
        return true;
    },
    mat(c, op = 1) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); },
    add(m, life, upd, geo) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd, geo }); },
    // Дуги комбо: у каждого удара свой наклон и размах; четвёртый — длинный розово-золотой выпад
    slashFx(ang, k) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos();
        if (k === 2 || k === 4) { const p = this.pos(player.x - Math.cos(ang) * 15, player.y - Math.sin(ang) * 15); this.thrust(player.x - Math.cos(ang) * 15, player.y - Math.sin(ang) * 15, ang, k === 4 ? 125 : 110, k === 4 ? 1.3 : 0.8); return; }
        const tilt = k === 1 ? 0.45 : -0.15, r = k === 3 ? 1.35 : 1.1;
        [[0xf472b6, 0.85, r], [0xfde68a, 0.6, r * 0.9], [0xffffff, 0.5, r * 0.8]].forEach(([c, op, rr], i) => {
            const m = new THREE.Mesh(this.slashGeo, this.mat(c, op)); m.position.set(h.x, h.y + 0.8 + i * 0.03, h.z);
            m.rotation.set(tilt, -ang, k === 3 ? 0.25 : 0); m.scale.setScalar(rr);
            this.add(m, 0.24, (o, kk) => { o.m.material.opacity = op * (1 - kk); o.m.scale.setScalar(rr * (1 + kk * 0.2)); o.m.rotation.y = -ang + (kk - 0.5) * (k === 3 ? 1.4 : 0.6); });
        });
        AnimFX.emit({ x: h.x + Math.cos(ang) * r, y: h.y + 0.8, z: h.z + Math.sin(ang) * r, n: 8, color: this.PINK, speed: 1.8, life: 0.3, size: 0.045, grav: 2 });
    },
    // Выпад: светящаяся полоса по линии удара
    thrust(x, y, ang, len, w = 1) {
        if (!this.ensure()) return;
        const p = this.pos(x, y), L = len / this.T, yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang));
        [[0xf472b6, 0.42 * w, 0.85], [0xfde68a, 0.22 * w, 0.7], [0xffffff, 0.1 * w, 0.95]].forEach(([c, ww, op]) => {
            const m = new THREE.Mesh(this.planeGeo, this.mat(c, op)); m.position.set(p.x, p.y + 0.85, p.z); m.rotation.y = yaw; m.scale.set(ww, 1, 0.01);
            this.add(m, 0.32, (o, k) => { o.m.scale.set(ww * (1 - k * 0.6), 1, L * Math.min(1, k * 6)); o.m.material.opacity = op * (1 - k); });
        });
        const tip = this.pos(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        AnimFX.emit({ x: tip.x, y: tip.y + 0.85, z: tip.z, n: 14, color: this.PINK, speed: 2.4, life: 0.35, size: 0.05, grav: 2, dir: [Math.cos(ang), 0.2, Math.sin(ang)], spread: 0.6 });
    },
    shatter(en) { const p = this.pos(en.x, en.y); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 14, color: [0xffffff, 0xf9a8d4, 0xfde68a], speed: 2.2, up: 1.4, life: 0.5, size: 0.06, sizeEnd: 0.01, grav: 6 }); AnimFX.shock(p.x, p.y + 1, p.z, 0xf472b6, 0.5, 0.1, 0.3); },
    sector(ang, r, half, col, op, life, fadeIn) {
        const h = AnimFX.heroPos(), sg = new THREE.CircleGeometry(1, 28, -half, half * 2); sg.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(sg, this.mat(col, op)); m.position.set(h.x, h.y + 0.06, h.z); m.rotation.y = -ang; m.scale.setScalar(r);
        this.add(m, life, (o, k) => { o.m.material.opacity = fadeIn ? op * Math.min(1, k * 2) * (0.7 + Math.sin(o.t * 30) * 0.3) : op * (1 - k); }, sg);
    },
    // Рог: сначала зона на земле (пока Астольфо набирает воздух), затем звуковые дуги и пыль
    horn(ang, R, half) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos(), r = R / this.T;
        this.sector(ang, r, half, 0xbe185d, 0.55, 0.5, false);
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(this.arcGeo, this.mat(i % 2 ? 0xf0abfc : 0xf472b6, 0.85)); m.position.set(h.x, h.y + 0.5 + i * 0.12, h.z); m.rotation.y = -ang;
            const d = i * 0.06;
            this.add(m, 0.45 + d, (o, k) => { const kk = Math.max(0, (o.t - d) / 0.45); o.m.scale.setScalar(0.3 + r * Math.min(1, kk)); o.m.material.opacity = kk <= 0 ? 0 : 0.85 * (1 - kk); });
        }
        for (let i = 0; i < 14; i++) { const a = ang + (Math.random() - 0.5) * half * 2, d = Math.random() * r; AnimFX.emit({ x: h.x + Math.cos(a) * d, y: h.y + 0.1, z: h.z + Math.sin(a) * d, n: 2, color: 0x7a6a5a, speed: 1.2, up: 0.6, life: 0.7, size: 0.18, sizeEnd: 0.35, grav: -0.2, drag: 3 }); }
        AnimFX.kick(0.45); Sfx3D.play('impact', 0.7);
    },
    hornTell(ang, R, half, t = 0.28, col = 0x9d174d) { if (this.ensure()) this.sector(ang, R / this.T, half, col, 0.35, t, true); },
    hornRing(R) { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.06, h.z, 0xf9a8d4, 0.2, R / this.T, 0.4, 0.9); AnimFX.shock(h.x, h.y + 1.2, h.z, 0xfde68a, 0.3, R / this.T * 1.3, 0.5, 0.6); },
    pages(p, n) { AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n, color: [0xfffbeb, 0xfef3c7, 0xfde68a], speed: 2.2, up: 1.5, life: 1.1, size: 0.09, sizeEnd: 0.07, grav: 0.4, drag: 2.5 }); },
    vanish(x, y) { const p = this.pos(x, y); this.pages(p, 20); AnimFX.emit({ x: p.x, y: p.y + 0.9, z: p.z, n: 34, color: [0xf9a8d4, 0xe9d5ff, 0xffffff], speed: 1.6, up: 0.6, life: 0.6, size: 0.07, sizeEnd: 0.01, grav: -0.5 }); AnimFX.shock(p.x, p.y + 0.05, p.z, 0xf0abfc, 0.2, 1.3, 0.35, 0.8); this.feathers(p, 12, 1.5); },
    ghost() { const h = AnimFX.heroPos(), a = this.alt(); AnimFX.emit({ x: h.x, y: h.y + a + 0.2 + Math.random() * 1.1, z: h.z, n: 4, color: [0xf9a8d4, 0xe9d5ff, 0xfde68a], speed: 0.25, life: 0.5, size: 0.08, sizeEnd: 0.01, grav: 0, drag: 2 }); },
    alt() { return typeof Asto !== 'undefined' ? Asto.alt() : 0; },
    feathers(p, n, sp, y = 0.8) { AnimFX.emit({ x: p.x, y: p.y + y, z: p.z, n, color: this.FEATHER, speed: sp, up: 1, life: 1.2, size: 0.07, sizeEnd: 0.05, grav: 0.6, drag: 2 }); },
    touchdown(x, y, big) { const p = this.pos(x, y); if (!big) this.pages(p, 14); AnimFX.shock(p.x, p.y + 0.05, p.z, 0xf9a8d4, 0.2, big ? 2.4 : 1.3, 0.35, 0.8); this.feathers(p, big ? 30 : 14, big ? 3 : 1.8); AnimFX.emit({ x: p.x, y: p.y + 0.1, z: p.z, n: 10, color: 0x7a6a5a, speed: 1.6, up: 0.6, life: 0.8, size: 0.22, sizeEnd: 0.45, grav: -0.2, drag: 3 }); },
    // Посадка: золотой круг призыва и кружащиеся перья, Гиппогриф появляется из анимации модели
    summon() { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.06, h.z, 0xf9a8d4, 0.3, 2.4, 0.7, 0.9); AnimFX.shock(h.x, h.y + 0.08, h.z, 0xfde68a, 2.4, 0.4, 0.8, 0.7); AnimFX.emit({ x: h.x, y: h.y + 1, z: h.z, n: 40, color: this.FEATHER, speed: 2.4, up: 2.5, life: 1.2, size: 0.07, grav: 0.5, drag: 1.5 }); AnimFX.flash(h.x, h.z, 0xf9a8d4, 5, 0.8, 2); },
    // Взлёт: мощный взмах — кольцо пыли, перья, тряска
    takeoff() { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.05, h.z, 0xe7e5e4, 0.4, 3.2, 0.6, 0.8); AnimFX.emit({ x: h.x, y: h.y + 0.1, z: h.z, n: 30, color: 0x7a6a5a, speed: 3, up: 0.8, life: 1, size: 0.3, sizeEnd: 0.6, grav: -0.2, drag: 3 }); this.feathers(h, 30, 3.5, 1.2); AnimFX.kick(0.7); },
    gust(x, y) { const p = this.pos(x, y); AnimFX.impact(p.x, p.z, 0xf9a8d4, 0.8, { dust: 0x5a4a3a }); this.feathers(p, 6, 2); },
    diveStart() { AnimFX.kick(0.35); Sfx3D.play('whoosh', 1); },
    slam(x, y) {
        const p = this.pos(x, y), r = 190 / this.T;
        AnimFX.impact(p.x, p.z, 0xf9a8d4, 2.4, { dust: 0x5a4a3a });
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfde68a, 0.2, r, 0.55, 1); AnimFX.shock(p.x, p.y + 0.08, p.z, 0xf472b6, 0.1, r * 0.7, 0.45, 0.9); AnimFX.shock(p.x, p.y + 0.1, p.z, 0xffffff, 0.1, r * 0.45, 0.3, 0.8);
        this.feathers(p, 60, 4.5, 0.6);
        AnimFX.emit({ x: p.x, y: p.y + 0.2, z: p.z, n: 24, color: 0x6a5a4a, speed: 3, up: 1.5, life: 1.1, size: 0.3, sizeEnd: 0.7, grav: -0.2, drag: 3 });
        AnimFX.flash(p.x, p.z, 0xf9a8d4, 9, 0.5, 2.2); AnimFX.kick(1.4);
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'astolfo' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) { const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life); if (o.upd) o.upd(o, k); if (k >= 1) { this.scene.remove(o.m); o.m.material.dispose(); if (o.geo) o.geo.dispose(); this.fx.splice(i, 1); } }
        if (player.heroType !== 'astolfo') return;
        const U = player.astoUlt, h = AnimFX.heroPos(), a = this.alt();
        if (U) {
            if (U.phase === 'mount' && Math.random() < 0.6) { const an = Math.random() * Math.PI * 2, rr = 1.5 + Math.random() * 1.5; AnimFX.emit({ x: h.x + Math.cos(an) * rr, y: h.y + 0.3 + Math.random() * 1.5, z: h.z + Math.sin(an) * rr, n: 1, color: this.FEATHER, speed: 0.2, life: 0.6, size: 0.06, grav: 0, pull: { x: h.x, y: h.y + 1, z: h.z, k: 7 } }); }
            if (U.phase === 'fly' || U.phase === 'dive') {
                // Вихрь крыльев: перья и пыль под летящим скакуном, тень-след на земле
                const s = (Math.random() - 0.5) * 3;
                AnimFX.emit({ x: h.x - Math.sin(U.ang) * s, y: h.y + a + 0.5 + Math.random(), z: h.z + Math.cos(U.ang) * s, n: 2, color: this.FEATHER, speed: 1.4, up: 0.3, life: 0.9, size: 0.06, grav: 0.8, drag: 1.5 });
                if (Math.random() < 0.5) AnimFX.emit({ x: h.x, y: h.y + 0.1, z: h.z, n: 2, color: 0x7a6a5a, speed: 1.6, up: 0.4, life: 0.8, size: 0.25, sizeEnd: 0.5, grav: -0.2, drag: 3 });
                if (Math.random() < 0.15) AnimFX.shock(h.x, h.y + 0.05, h.z, 0xd6d3d1, 0.3, 1.6, 0.4, 0.4);
                Engine3D.extraZoomTarget = 6; Engine3D.camLift = a * 0.5;   // камера отъезжает и поднимается за полётом
            }
        }
        if (player.astoGlide) Engine3D.extraZoomTarget = 2;
        if (player.astoVanish > 0 && Math.random() < 0.5) AnimFX.emit({ x: h.x + (Math.random() - 0.5) * 0.6, y: h.y + 0.3 + Math.random(), z: h.z + (Math.random() - 0.5) * 0.6, n: 1, color: [0xe9d5ff, 0xf9a8d4], speed: 0.2, up: 0.4, life: 0.5, size: 0.06, grav: 0 });
        // Полупрозрачный Астольфо, пока он невидим для врагов; в переносе Книги — исчезает совсем
        const A = typeof Actors3D !== 'undefined' && Actors3D.player;
        if (A) A.root.visible = !player.astoVanishing;
        if (A) { const inv = player.astoVanish > 0, want = inv ? 0.35 : 1; if (A.astoOp !== want) { A.astoOp = want; A.mats.forEach(m => { if (m.userData.t0 === undefined) m.userData.t0 = m.transparent; m.transparent = inv ? true : m.userData.t0; m.opacity = want; m.needsUpdate = true; }); } }
    },
    fxRunes() {
        if (player.heroType !== 'astolfo') return;
        const U = player.astoUlt;
        if (U && U.phase !== 'land') {
            const o = this.pos(U.ox, U.oy), a = Math.atan2(Math.cos(U.ang), Math.sin(U.ang)), prog = U.phase === 'mount' ? U.t / ASTO_ULT.mount : 1;
            FX3D.runeAt(U, 0xf472b6, o.x, o.z, 0, prog, { rect: true, ang: a, w: ASTO_ULT.width / this.T, len: U.dist / this.T, crack: 0.4 });
            const e = this.pos(U.tx, U.ty);
            FX3D.runeAt(U, 0xfde68a, e.x, e.z, 190 / this.T, prog, { tag: 'end', spin: 2, crack: U.phase === 'dive' ? 1 : 0.3 });
        }
    }
};
