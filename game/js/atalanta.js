// ============================================================================
// АТАЛАНТА (класс «Лучник»): Охотница Аркадии и её проклятая форма Альтер (Агрея)
// ============================================================================
// Две формы на одном уровне и одном пуле очков навыков. Ранг Q/W/E/R общий: прокачанный Q усиливает Q обеих форм.
// D — смена формы (обычный навык с перезарядкой, с 2-го уровня): меняются модель, анимации, дальность, характеристики и панель.
//
// Лучница (Tauropolos): быстрая, хрупкая, бьёт издалека.
//   Q Стрела Охотницы — сверхбыстрая прицельная стрела, пробивает двух врагов по линии.
//   W Грация Лани — рывок к курсору, короткая неуязвимость и ускорение.
//   E Пронзающий Залп — веер усиленных стрел, каждая пробивает рядовых врагов.
//   R Катастрофа Феба — стрела в небо и звёздный ливень сияющих стрел по обширной области.
// Альтер (Агрея): ближний бой когтями, высокая агрессия и риск.
//   Q Когти Агреи — серия из трёх разрывающих ударов в дуге перед собой, кровотечение.
//   W Хищный Прыжок — прыжок к курсору с ударом при приземлении (оглушение).
//   E Рёв Кабана — ярость: быстрее и сильнее удары когтями, но и входящий урон выше.
//   R Скиа Аталанта — вспышка проклятой тьмы вокруг и окно звериной силы: удары сильнее, широкая дуга, вампиризм.
const ATA_BOW = {
    q: { key: 'q', name: "Hunter's Shot", ruName: 'Стрела Охотницы', icon: '🏹', manaCost: 20, baseCd: 3,
         desc: 'Прицельный выстрел из лука Тавропол к курсору. Стрела летит очень быстро и пробивает двух врагов по линии — наказание для врагов на дистанции.',
         stats: l => `Урон ${50 + 24 * l} + атака • пробивает 2 цели • дальность 620 • перезарядка 3с` },
    w: { key: 'w', name: 'Crossing Arcadia', ruName: 'Грация Лани', icon: '🦌', manaCost: 30, baseCd: 7,
         desc: 'Стремительный рывок к курсору: на время рывка Аталанта неуязвима, после — заметно ускорена. Помогает держать дистанцию от быстрых врагов и боссов.',
         stats: l => `Рывок ${200 + 10 * l} • ускорение +35% на ${(2 + 0.3 * l).toFixed(1)}с • перезарядка ${Math.max(4, 7 - 0.4 * l).toFixed(1)}с` },
    e: { key: 'e', name: 'Piercing Volley', ruName: 'Пронзающий Залп', icon: '🎯', manaCost: 55, baseCd: 9,
         desc: 'Веер усиленных стрел в сторону курсора. Каждая стрела пробивает рядовых врагов насквозь; боссы останавливают стрелу.',
         stats: l => `Стрел: ${5 + l} • урон каждой ${40 + 18 * l} + атака • конус 44° • перезарядка 9с` },
    r: { key: 'r', name: 'Phoebus Catastrophe', ruName: 'Катастрофа Феба', icon: '🌠', manaCost: 160, baseCd: 85,
         desc: 'Ультимейт. Аталанта выпускает две стрелы в небо, моля Аполлона и Артемиду о милости, — и на выбранную область обрушивается звёздный ливень сияющих стрел. Зона поражения видна заранее.',
         stats: l => `Стрел: ${24 + 6 * l} за 1.6с • урон каждой ${45 + 22 * l} + атака в радиусе 55 • область ${200 + 15 * l} • перезарядка ${85 - 5 * l}с` }
};
const ATA_BEAST = {
    q: { key: 'q', name: 'Feral Rend', ruName: 'Когти Агреи', icon: '🐾', manaCost: 18, baseCd: 3.5,
         desc: 'Яростная серия из трёх ударов когтями в дуге перед собой. Каждый удар оставляет рану: враг кровоточит несколько секунд.',
         stats: l => `3 удара по ${24 + 12 * l} + атака • кровотечение ${10 + 6 * l}/с на 4с • перезарядка 3.5с` },
    w: { key: 'w', name: 'Predator Leap', ruName: 'Хищный Прыжок', icon: '🐆', manaCost: 35, baseCd: 8,
         desc: 'Агрессивный прыжок к курсору. В полёте Аталанта неуязвима, при приземлении бьёт по области и оглушает. Влететь в бой — или вырваться из окружения.',
         stats: l => `Дальность ${320 + 10 * l} • удар ${50 + 25 * l} + атака в радиусе 110 • оглушение 0.6с • перезарядка ${Math.max(4, 8 - 0.5 * l).toFixed(1)}с` },
    e: { key: 'e', name: "Boar's Wrath", ruName: 'Рёв Кабана', icon: '🐗', manaCost: 60, baseCd: 20,
         desc: 'Звериная ярость Калидонского вепря: атаки когтями быстрее и сильнее, вокруг — тёмная аура. Цена — Аталанта получает на 20% больше урона, следи за здоровьем.',
         stats: l => `Длительность ${(6 + 0.5 * l).toFixed(1)}с • скорость атаки +40% • урон когтей +${30 + 5 * l}% • входящий урон +20%` },
    r: { key: 'r', name: 'Skia Atalanta', ruName: 'Скиа Аталанта', icon: '🌑', manaCost: 150, baseCd: 80,
         desc: 'Ультимейт. Проклятие Калидона вырывается наружу: вспышка тьмы вокруг Аталанты наносит колоссальный урон и отбрасывает, а затем на 6 секунд удары когтями сильнее на 50%, бьют по широкой дуге и лечат её.',
         stats: l => `Взрыв ${300 + 160 * l} + атака в радиусе 260 • затем 6с: когти +50%, вампиризм 15% • перезарядка ${80 - 5 * l}с` }
};
const ATA_SWITCH = { key: 'd', ruName: 'Смена формы', cd: 8, level: 2 };

const Ata = {
    beast() { return player.heroType === 'atalanta' && player.ataForm === 'beast'; },
    skills() { return this.beast() ? ATA_BEAST : ATA_BOW; },
    stats(L, q, w, e, r, eq) {
        if (player.ataForm === 'beast') {
            player.maxHp = Math.round(200 + L * 30 + eq.hp);
            player.armor = Math.round(4 + L * 0.5 + eq.armor);
            player.handDmg = Math.round(30 + L * 8 + eq.hand);
            player.attackInterval = 0.46;
            player.attackRange = 80;
            player.moveSpeed = 225;
            player.critChance = 10 + eq.crit; player.critMult = 1.7;
        } else {
            player.maxHp = Math.round(160 + L * 24 + eq.hp);
            player.armor = Math.round(2 + L * 0.4 + eq.armor);
            player.handDmg = Math.round(22 + L * 6 + eq.hand);
            player.attackInterval = 0.55;
            player.attackRange = 460;
            player.moveSpeed = 215;
            player.critChance = 12 + eq.crit; player.critMult = 1.8;
        }
        player.maxMp = Math.round(200 + L * 26 + (q + w + e) * 6 + eq.mp);
        player.hpRegen = +(2 + L * 0.3).toFixed(1);
        player.mpRegen = +(5 + L * 0.4 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.spellAmp = Math.round(5 + L * 2 + eq.amp);
        player.cdrPct = Math.min(40, Math.round(eq.cdr));
        if (player.ataHaste > 0) player.moveSpeed = Math.round(player.moveSpeed * 1.35);
        if (player.ataWrath > 0) player.attackInterval = +(player.attackInterval / 1.4).toFixed(3);
    },
    // Сила навыков: атака героя + усиление
    pow() { return 1 + (player.spellAmp || 0) / 100; },
    clawMult() { return (player.ataWrath > 0 ? 1 + (player.ataWrathPct || 30) / 100 : 1) * (player.ataFury > 0 ? 1.5 : 1); },
    ready(key) {
        const sk = this.skills()[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    later(t, fn) { (player.ataQueue = player.ataQueue || []).push({ t, fn }); },
    crit(dmg) { const c = Math.random() * 100 < (player.critChance || 0); return { dmg: Math.round(dmg * (c ? player.critMult : 1)), crit: c }; },
    // Стрела Тавропола
    arrow(ang, dmg, o = {}) {
        const sp = o.sp || 1000, range = o.range || player.attackRange + 80, c = this.crit(dmg);
        projectiles.push({ kind: 'ata', x: player.x + Math.cos(ang) * 20, y: player.y + Math.sin(ang) * 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, radius: o.r || 8,
            dmg: c.dmg, crit: c.crit, fromPlayer: true, isSpell: false, color: o.color || '#d9f99d', life: range / sp, pierce: o.pierce || 0, bossStop: !!o.bossStop, hitIds: new Set(), big: !!o.big });
    },
    onHit(p, en) {
        damageEnemy(en, p.dmg, false, p.vx * 0.04, p.vy * 0.04, p.color, { crit: p.crit });
        p.hitIds.add(en.uid);
        if (typeof Ata3D !== 'undefined') Ata3D.spark(en.x, en.y, p.big);
        if (p.bossStop && (en.isBoss || (en.tpl && en.tpl.miniBoss))) return true;
        if (p.pierce > 0) { p.pierce--; return false; }
        return true;
    },
    // Удар когтями по дуге перед героем
    claws(ang, R, half, dmg, onEach) {
        let hit = 0;
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
            if (d > R + en.radius) return;
            let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) > half && d > en.radius + 14) return;
            const c = this.crit(dmg), before = en.hp;
            damageEnemy(en, c.dmg, false, dx / (d || 1) * 6, dy / (d || 1) * 6, '#e11d48', { crit: c.crit });
            if (player.ataFury > 0) player.hp = Math.min(player.maxHp, player.hp + Math.max(0, before - Math.max(0, en.hp)) * 0.15);
            if (onEach) onEach(en);
            hit++;
        });
        if (hit && typeof Feel !== 'undefined') Feel.impact(Math.cos(ang), Math.sin(ang), player.ataWrath > 0 || player.ataFury > 0 ? 0.9 : 0.5, false);
        return hit;
    },
    bleed(en, dps) { en.ataBleed = { t: 4, dps, acc: 0 }; },
    attack() {
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        if (this.beast()) {
            const step = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 2) + 1; player.comboTimer = 1.4;
            player.basicAttackCd = player.attackInterval;
            player.slashAnimTime = 0.26;
            const wide = player.ataFury > 0 ? 1.4 : 0.95;
            this.later(0.1, () => { this.claws(ang, 85 + (player.ataFury > 0 ? 25 : 0), wide, player.handDmg * this.clawMult() * (step === 2 ? 1.2 : 1)); if (typeof Ata3D !== 'undefined') Ata3D.claw(ang, step, 1); });
            SoundFX.play('whoosh');
        } else {
            player.basicAttackCd = player.attackInterval;
            player.castAnimTime = 0.2;
            this.later(0.06, () => this.arrow(ang, player.handDmg, { sp: 950 }));
            SoundFX.play('orb');
        }
    },
    cast(key) {
        if (key === 'd') return this.switchForm();
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), P = this.pow(), H = player.handDmg;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        if (!this.beast()) {
            if (key === 'q') {
                this.later(0.12, () => { this.arrow(ang, (50 + 24 * lvl) * P + H * 0.6, { sp: 1500, range: 620, pierce: 2, r: 10, color: '#fef08a', big: true }); if (typeof Ata3D !== 'undefined') Ata3D.muzzle(ang); });
                player.knightAnim = { kind: 'hunt', t: 0.32 };
                this.cd('q', ATA_BOW.q.baseCd); SoundFX.play('bolt');
            } else if (key === 'w') {
                const range = 200 + 10 * lvl, d = Math.min(range, Math.max(80, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
                player.ataDash = { t: 0, dur: 0.2, vx: cx * d / 0.2, vy: cy * d / 0.2 };
                player.invulnTime = Math.max(player.invulnTime, 0.35);
                player.ataHaste = 2 + 0.3 * lvl; recalcPlayerStats();
                player.moveTargetX = null; player.moveTargetY = null;
                player.knightAnim = { kind: 'dash', t: 0.4 };
                if (typeof Ata3D !== 'undefined') Ata3D.dash(player.x, player.y, ang);
                this.cd('w', Math.max(4, ATA_BOW.w.baseCd - 0.4 * lvl)); SoundFX.play('tornado');
            } else if (key === 'e') {
                const n = 5 + lvl, spread = 0.77;
                for (let i = 0; i < n; i++) { const a = ang + (i / (n - 1) - 0.5) * spread; this.later(0.1 + Math.abs(i - (n - 1) / 2) * 0.02, () => this.arrow(a, (40 + 18 * lvl) * P + H * 0.4, { sp: 1100, range: 560, pierce: 99, bossStop: true, color: '#bef264' })); }
                player.knightAnim = { kind: 'volley', t: 0.4 };
                this.cd('e', ATA_BOW.e.baseCd); SoundFX.play('bolt');
            } else if (key === 'r') {
                let tx = mouseWorldX, ty = mouseWorldY; const dd = Math.hypot(tx - player.x, ty - player.y);
                if (dd > 650) { tx = player.x + (tx - player.x) / dd * 650; ty = player.y + (ty - player.y) / dd * 650; }
                const R = 200 + 15 * lvl, n = 24 + 6 * lvl, dur = 1.6, drops = [];
                for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.95; drops.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, at: 0.9 + i / n * dur, done: false }); }
                player.ataRain = { x: tx, y: ty, R, t: 0, end: 0.9 + dur + 0.4, dmg: (45 + 22 * lvl) * P + H * 0.3, drops };
                player.knightAnim = { kind: 'sky', t: 0.75 };
                this.cd('r', ATA_BOW.r.baseCd - 5 * lvl);
                SoundFX.play('invoke');
                spawnFloatingText(player.x, player.y - 56, '🌠 PHOEBUS CATASTROPHE', '#fef08a');
                if (typeof Ata3D !== 'undefined') Ata3D.skyShot();
            }
        } else {
            if (key === 'q') {
                const dmg = (24 + 12 * lvl) * P + H * 0.5;
                for (let k = 0; k < 3; k++) this.later(0.08 + k * 0.14, () => {
                    const a = player.facingAngle;
                    this.claws(a, 105 + (player.ataFury > 0 ? 25 : 0), 0.9, dmg * this.clawMult() * (k === 2 ? 1.3 : 1), en => this.bleed(en, (10 + 6 * lvl) * P));
                    if (typeof Ata3D !== 'undefined') Ata3D.claw(a, k + 1, 1.3);
                    tryMoveEntity(player, Math.cos(a) * 10, Math.sin(a) * 10);
                });
                player.knightAnim = { kind: 'rend', t: 0.55 };
                this.cd('q', ATA_BEAST.q.baseCd); SoundFX.play('whoosh');
            } else if (key === 'w') {
                const range = 320 + 10 * lvl, d = Math.min(range, Math.max(60, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
                player.ataLeap = { t: 0, dur: 0.42, vx: cx * d / 0.42, vy: cy * d / 0.42, dmg: (50 + 25 * lvl) * P + H * 0.6 };
                player.invulnTime = Math.max(player.invulnTime, 0.45);
                player.moveTargetX = null; player.moveTargetY = null;
                player.knightAnim = { kind: 'leap', t: 0.5 };
                this.cd('w', Math.max(4, ATA_BEAST.w.baseCd - 0.5 * lvl)); SoundFX.play('whoosh');
            } else if (key === 'e') {
                player.ataWrath = 6 + 0.5 * lvl; player.ataWrathPct = 30 + 5 * lvl; recalcPlayerStats();
                player.knightAnim = { kind: 'roar', t: 0.6 };
                spawnFloatingText(player.x, player.y - 50, '🐗 РЁВ КАБАНА', '#fb7185');
                if (typeof Ata3D !== 'undefined') Ata3D.roar();
                this.cd('e', ATA_BEAST.e.baseCd); SoundFX.play('thunder');
            } else if (key === 'r') {
                player.ataSkia = { t: 0, wind: 0.55, R: 260, dmg: (300 + 160 * lvl) * P + H * 1.5, done: false };
                player.moveTargetX = null; player.moveTargetY = null;
                player.knightAnim = { kind: 'skia', t: 0.9 };
                this.cd('r', ATA_BEAST.r.baseCd - 5 * lvl);
                SoundFX.play('invoke');
                if (typeof Ata3D !== 'undefined') Ata3D.skiaStart();
            }
        }
        updateInvokerBarUI();
    },
    // Смена формы: сохраняем долю здоровья и маны, перестраиваем характеристики, модель и панель
    switchForm() {
        if (!adminMode && player.level < ATA_SWITCH.level) { showToast(`Смена формы откроется на ${ATA_SWITCH.level} уровне`, 'error'); return; }
        const c = player.saberCooldowns.d || 0;
        if (c > 0) { showToast(`Смена формы перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return; }
        if (player.controlLock || player.ataLeap || player.ataDash) return;
        const hr = player.hp / Math.max(1, player.maxHp), mr = player.mp / Math.max(1, player.maxMp);
        player.ataForm = player.ataForm === 'beast' ? 'bow' : 'beast';
        player.ataWrath = 0; player.ataFury = 0; player.comboStep = 0;
        recalcPlayerStats();
        player.hp = Math.max(1, Math.round(hr * player.maxHp)); player.mp = Math.round(mr * player.maxMp);
        player.saberCooldowns.d = +(ATA_SWITCH.cd * (1 - (player.cdrPct || 0) / 100)).toFixed(1);
        player.attackTarget = null;
        const beast = player.ataForm === 'beast';
        spawnFloatingText(player.x, player.y - 56, beast ? '🌑 АГРЕЯ — АТАЛАНТА АЛЬТЕР' : '🏹 ОХОТНИЦА АРКАДИИ', beast ? '#c084fc' : '#d9f99d');
        if (typeof Actors3D !== 'undefined') Actors3D.transition(0.4);
        if (typeof Ata3D !== 'undefined') Ata3D.morph(beast);
        if (typeof Portraits !== 'undefined' && Portraits.react) Portraits.react.cast = 1;
        SoundFX.play(beast ? 'thunder' : 'levelup');
        if (typeof updateHeroPortraitHUD === 'function') updateHeroPortraitHUD();
        updateInvokerBarUI();
    },
    update(dt) {
        if (player.heroType !== 'atalanta') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.ataQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { const f = Q[i].fn; Q.splice(i, 1); f(); } }
        // Таймеры баффов: по окончании пересчитываем характеристики
        const tick = k => { if (player[k] > 0) { player[k] -= dt; if (player[k] <= 0) { player[k] = 0; recalcPlayerStats(); } } };
        tick('ataHaste'); tick('ataWrath'); tick('ataFury');
        // Рывок Лани
        const D = player.ataDash;
        if (D) { D.t += dt; tryMoveEntity(player, D.vx * dt, D.vy * dt); if (typeof Ata3D !== 'undefined') Ata3D.ghost(); if (D.t >= D.dur) player.ataDash = null; }
        // Хищный прыжок: полёт по дуге и удар при приземлении
        const L = player.ataLeap;
        if (L) {
            L.t += dt; tryMoveEntity(player, L.vx * dt, L.vy * dt);
            if (L.t >= L.dur) {
                player.ataLeap = null;
                enemies.forEach(en => {
                    if (en.deadTimer > 0 || Math.hypot(en.x - player.x, en.y - player.y) > 110 + en.radius) return;
                    damageEnemy(en, Math.round(L.dmg * this.clawMult()), false, 0, 0, '#e11d48');
                    en.stunTimer = Math.max(en.stunTimer || 0, 0.6);
                });
                if (typeof Ata3D !== 'undefined') Ata3D.land(player.x, player.y);
                if (typeof Feel !== 'undefined') Feel.impact(0, 1, 1, false);
                SoundFX.play('meteor');
            }
        }
        // Кровотечение
        for (const en of enemies) {
            const b = en.ataBleed; if (!b) continue;
            if (en.deadTimer > 0) { en.ataBleed = null; continue; }
            b.t -= dt; b.acc += dt;
            if (b.acc >= 0.5) { b.acc -= 0.5; damageEnemy(en, Math.max(1, Math.round(b.dps * 0.5)), false, 0, 0, '#9f1239'); if (typeof Ata3D !== 'undefined') Ata3D.drip(en); }
            if (b.t <= 0) en.ataBleed = null;
        }
        // Катастрофа Феба: звёздные стрелы падают по расписанию
        const Rn = player.ataRain;
        if (Rn) {
            Rn.t += dt;
            for (const d of Rn.drops) {
                if (d.done || Rn.t < d.at) continue;
                d.done = true;
                enemies.forEach(en => { if (en.deadTimer <= 0 && Math.hypot(en.x - d.x, en.y - d.y) < 55 + en.radius) damageEnemy(en, Math.round(Rn.dmg), true, 0, 0, '#fef08a'); });
                if (typeof Ata3D !== 'undefined') Ata3D.starHit(d);
            }
            if (Rn.t >= Rn.end) player.ataRain = null;
        }
        // Скиа Аталанта: сбор тьмы → вспышка → окно звериной силы
        const S = player.ataSkia;
        if (S) {
            S.t += dt;
            if (!S.done && S.t >= S.wind) {
                S.done = true;
                enemies.forEach(en => {
                    if (en.deadTimer > 0) return;
                    const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                    if (d > S.R + en.radius) return;
                    damageEnemy(en, Math.round(S.dmg * (1 - 0.35 * d / S.R)), true, 0, 0, '#a21caf');
                    if (!en.isBoss && d > 1) tryMoveEntity(en, dx / d * 70, dy / d * 70);
                    en.stunTimer = Math.max(en.stunTimer || 0, 0.5);
                });
                player.ataFury = 6; recalcPlayerStats();
                spawnFloatingText(player.x, player.y - 60, '🌑 SKIA ATALANTA', '#e879f9');
                if (typeof Feel !== 'undefined') Feel.impact(0, 1, 1.5, true);
                if (typeof Ata3D !== 'undefined') Ata3D.skiaBurst(S.R);
                SoundFX.play('sunstrike');
            }
            if (S.t >= S.wind + 0.35) player.ataSkia = null;
        }
    },
    damageMult() { return player.heroType === 'atalanta' && player.ataWrath > 0 ? 1.2 : 1; },
    locked() { return player.heroType === 'atalanta' && !!(player.ataSkia || player.ataLeap || player.ataDash); },
    reset() { player.ataQueue = null; player.ataDash = null; player.ataLeap = null; player.ataRain = null; player.ataSkia = null; player.ataWrath = 0; player.ataFury = 0; player.ataHaste = 0; },

    // ---------- панель навыков: одна панель, содержимое меняется вместе с формой ----------
    buildBar() {
        if (document.getElementById('ataActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'ataActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnAtaLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button id="ataBtn${K}" onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group">
                    <span class="hotkey-badge">${K}</span>
                    <span id="ataIcon${K}" class="text-xl sm:text-2xl group-hover:scale-110 transition-transform"></span>
                    <span id="ataCost${K}" class="text-[9px] font-rpg font-bold text-lime-200 mt-0.5"></span>
                    <div id="cdAta${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span id="ataName${K}" class="text-[9px] font-rpg ${ult ? 'font-bold' : ''} text-lime-100 mt-1"></span>
                <div id="pipsAta${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>
            <div class="flex flex-col items-center relative z-20">
                <button id="ataBtnD" onclick="castHeroSkill('d')" class="relative w-12 h-12 sm:w-14 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center group" title="Смена формы (D)">
                    <span class="hotkey-badge">D</span><span id="ataIconD" class="text-lg sm:text-xl group-hover:scale-110 transition-transform">🌑</span>
                    <span class="text-[8px] font-rpg font-bold text-stone-300 mt-0.5">${ATA_SWITCH.cd}с</span>
                    <div id="cdAtaD" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button><span id="ataNameD" class="text-[9px] font-rpg text-stone-300 mt-1">Форма</span>
            </div>` + [['hp', '1', '🧪', 'hudAtaHp', 'Кровь'], ['mp', '2', '🔮', 'hudAtaMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'ataTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span id="ataPillName" class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#d9f99d">Аталанта:</span><span id="ataHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const beast = this.beast(), S = this.skills();
        const bar = document.getElementById('ataActionBar'); if (bar) bar.classList.toggle('ata-beast', beast);
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = S[k], set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
            set('ataIcon' + K, sk.icon); set('ataCost' + K, sk.manaCost + ' MP'); set('ataName' + K, sk.ruName.split(' ')[0]);
            const b = document.getElementById('ataBtn' + K); if (b && b.title !== sk.ruName) b.title = sk.ruName;
        });
        const ic = document.getElementById('ataIconD'); if (ic) ic.textContent = beast ? '🏹' : '🌑';
        const nm = document.getElementById('ataNameD'); if (nm) nm.textContent = beast ? 'Лучница' : 'Альтер';
        updateCooldownBadge('cdAtaD', player.saberCooldowns.d || 0);
        const pn = document.getElementById('ataPillName'); if (pn) { pn.textContent = beast ? 'Аталанта Альтер:' : 'Аталанта:'; pn.style.color = beast ? '#e879f9' : '#d9f99d'; }
        const h = document.getElementById('ataHint');
        if (h) h.textContent = beast ? (player.ataFury > 0 ? `Проклятие Калидона: ${player.ataFury.toFixed(1)}с` : player.ataWrath > 0 ? `Рёв Кабана: ${player.ataWrath.toFixed(1)}с` : 'Звериная форма • ближний бой')
            : (player.ataHaste > 0 ? `Грация Лани: ${player.ataHaste.toFixed(1)}с` : 'Лук Тавропол • дальний бой');
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudAtaHp'), b = document.getElementById('hudAtaMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ АТАЛАНТЫ: звёздные стрелы, след рывка, удары когтей, проклятая тьма
// ============================================================================
const Ata3D = {
    T: 48,
    STAR: [0xfef08a, 0xd9f99d, 0xbef264, 0xffffff],
    DARK: [0xa21caf, 0x7e22ce, 0xe11d48, 0x581c87],
    fx: [], scene: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    ensure() {
        if (this.scene) return true;
        if (typeof Engine3D === 'undefined' || !Engine3D.scene) return false;
        this.scene = Engine3D.scene;
        // Дуга когтя: тонкий серп, три параллельных
        this.clawGeo = new THREE.RingGeometry(0.85, 1, 24, 1, -0.9, 1.8); this.clawGeo.rotateX(-Math.PI / 2);
        this.streakGeo = new THREE.CylinderGeometry(0.02, 0.06, 1, 6, 1, true); this.streakGeo.translate(0, 0.5, 0);
        return true;
    },
    add(m, life, upd) { this.scene.add(m); this.fx.push({ m, t: 0, life, upd }); },
    mat(c, op = 1) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); },
    spark(x, y, big) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.8, z: p.z, n: big ? 16 : 8, color: this.STAR, speed: big ? 2.6 : 1.8, up: 1, life: 0.35, size: 0.045, grav: 4 }); },
    muzzle(ang) { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x + Math.cos(ang) * 0.5, y: h.y + 1, z: h.z + Math.sin(ang) * 0.5, n: 14, color: this.STAR, speed: 2, life: 0.3, size: 0.05, grav: 0, dir: [Math.cos(ang), 0, Math.sin(ang)], spread: 0.4 }); AnimFX.flash(h.x, h.z, 0xd9f99d, 2.5, 0.15, 1.2); },
    dash(x, y, ang) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.5, z: p.z, n: 22, color: [0xd9f99d, 0x86efac, 0xfef08a], speed: 1.5, up: 0.8, life: 0.5, size: 0.06, grav: -0.5 }); AnimFX.shock(p.x, p.y + 0.05, p.z, 0xbef264, 0.2, 1, 0.3, 0.7); },
    ghost() { const h = AnimFX.heroPos(); AnimFX.emit({ x: h.x, y: h.y + 0.3 + Math.random() * 0.9, z: h.z, n: 3, color: [0xd9f99d, 0xbef264, 0xffffff], speed: 0.3, life: 0.45, size: 0.07, sizeEnd: 0.01, grav: 0, drag: 2 }); },
    // Удар когтями: три багрово-фиолетовых серпа перед героиней
    claw(ang, step, scale = 1) {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos(), fury = player.ataFury > 0, col = fury ? 0xe879f9 : 0xe11d48;
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(this.clawGeo, this.mat(i === 1 ? 0xffffff : col, i === 1 ? 0.7 : 0.9));
            const r = (1.05 + i * 0.16) * scale * (fury ? 1.25 : 1);
            m.position.set(h.x + Math.cos(ang) * 0.2, h.y + 0.75 + (step % 2 ? 0.1 : -0.05) + i * 0.04, h.z + Math.sin(ang) * 0.2);
            m.rotation.set(step % 2 ? 0.35 : -0.35, -ang, 0); m.scale.setScalar(r);
            this.add(m, 0.22, (o, k) => { o.m.material.opacity = (i === 1 ? 0.7 : 0.9) * (1 - k); o.m.scale.setScalar(r * (1 + k * 0.25)); });
        }
        AnimFX.emit({ x: h.x + Math.cos(ang) * 0.9, y: h.y + 0.8, z: h.z + Math.sin(ang) * 0.9, n: 8, color: this.DARK, speed: 1.6, life: 0.3, size: 0.05, grav: 2 });
    },
    drip(en) { const p = this.pos(en.x, en.y); AnimFX.blood(p.x, p.y + 0.8, p.z, 5); },
    land(x, y) { const p = this.pos(x, y); AnimFX.impact(p.x, p.z, 0xa21caf, 1.4, { dust: 0x3a2030 }); AnimFX.shock(p.x, p.y + 0.06, p.z, 0xe11d48, 0.2, 2.3, 0.4, 0.8); AnimFX.kick(0.5); },
    roar() { const h = AnimFX.heroPos(); AnimFX.shock(h.x, h.y + 0.06, h.z, 0x9f1239, 0.3, 2.4, 0.5, 0.9); AnimFX.shock(h.x, h.y + 1, h.z, 0x7e22ce, 0.2, 1.6, 0.4, 0.7); AnimFX.emit({ x: h.x, y: h.y + 1, z: h.z, n: 40, color: this.DARK, speed: 3, up: 1, life: 0.6, size: 0.07, grav: 1 }); AnimFX.kick(0.45); },
    morph(beast) {
        const h = AnimFX.heroPos();
        if (beast) { AnimFX.shock(h.x, h.y + 0.06, h.z, 0x7e22ce, 0.2, 2, 0.5, 0.9); AnimFX.emit({ x: h.x, y: h.y + 0.6, z: h.z, n: 60, color: this.DARK, speed: 2.4, up: 2, life: 0.8, size: 0.09, sizeEnd: 0.02, grav: -0.5 }); AnimFX.flash(h.x, h.z, 0xa21caf, 5, 0.4, 1.6); AnimFX.kick(0.4); }
        else { AnimFX.shock(h.x, h.y + 0.06, h.z, 0xbef264, 0.2, 1.8, 0.45, 0.9); AnimFX.emit({ x: h.x, y: h.y + 0.6, z: h.z, n: 50, color: this.STAR, speed: 2, up: 2.5, life: 0.8, size: 0.05, grav: -0.8 }); AnimFX.flash(h.x, h.z, 0xd9f99d, 4, 0.35, 1.6); }
    },
    // Две стрелы в небо: сияющие лучи вверх из рук героини
    skyShot() {
        if (!this.ensure()) return;
        const h = AnimFX.heroPos();
        for (let i = 0; i < 2; i++) this.later(0.3 + i * 0.18, () => {
            const m = new THREE.Mesh(this.streakGeo, this.mat(0xfef08a, 0.95)); m.position.set(h.x + (i ? 0.15 : -0.15), h.y + 1.2, h.z);
            this.add(m, 0.5, (o, k) => { o.m.position.y = h.y + 1.2 + k * 14; o.m.scale.set(2, 2.5, 2); o.m.material.opacity = 0.95 * (1 - k * 0.6); });
            AnimFX.emit({ x: h.x, y: h.y + 1.3, z: h.z, n: 16, color: this.STAR, speed: 1.5, up: 4, life: 0.5, size: 0.05, grav: -2 });
            AnimFX.flash(h.x, h.z, 0xfef08a, 4, 0.25, 2);
        });
    },
    later(t, fn) { this.fx.push({ t: 0, life: t, done: fn }); },
    // Звёздная стрела: падает из неба под углом и вспыхивает звездой
    starHit(d) {
        const p = this.pos(d.x, d.y);
        AnimFX.impact(p.x, p.z, 0xfef08a, 0.8, { dust: 0x4a4a30 });
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 12, color: this.STAR, speed: 2.4, up: 2, life: 0.6, size: 0.05, grav: 3 });
        AnimFX.emit({ x: p.x, y: p.y + 0.2, z: p.z, n: 4, color: [0xffffff, 0xfef08a], speed: 0.2, up: 0.3, life: 1.4, size: 0.06, grav: -0.1, drag: 3 });   // звёздный след остаётся мерцать
        if (Math.random() < 0.35) AnimFX.kick(0.12);
        Sfx3D.play('impact', 0.35);
    },
    skiaStart() { const h = AnimFX.heroPos(); AnimFX.flash(h.x, h.z, 0x7e22ce, 5, 0.55, 2); },
    skiaBurst(R) {
        const h = AnimFX.heroPos(), r = R / this.T;
        AnimFX.shock(h.x, h.y + 0.06, h.z, 0x7e22ce, 0.3, r, 0.6, 1); AnimFX.shock(h.x, h.y + 0.08, h.z, 0xe11d48, 0.2, r * 0.75, 0.5, 0.9); AnimFX.shock(h.x, h.y + 1, h.z, 0xe879f9, 0.2, r * 0.5, 0.4, 0.8);
        AnimFX.emit({ x: h.x, y: h.y + 0.8, z: h.z, n: 140, color: this.DARK, speed: 7, up: 1.5, life: 0.8, size: 0.09, sizeEnd: 0.02, grav: 1, drag: 1 });
        AnimFX.emit({ x: h.x, y: h.y + 0.3, z: h.z, n: 40, color: [0x2a0a2a, 0x581c87], speed: 3, up: 3, life: 1.2, size: 0.3, sizeEnd: 0.7, grav: -0.4, drag: 2 });
        AnimFX.flash(h.x, h.z, 0xa21caf, 12, 0.6, 2.5);
        AnimFX.kick(1.3);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; Frank3D.bolt(new THREE.Vector3(h.x, h.y + 1, h.z), new THREE.Vector3(h.x + Math.cos(a) * r * 0.9, h.y + 0.1, h.z + Math.sin(a) * r * 0.9), 0.3, 0.05, 2, 'v'); }
    },
    update(dt) {
        if (!this.scene) { if (player.heroType !== 'atalanta' || !this.ensure()) return; }
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const o = this.fx[i]; o.t += dt; const k = Math.min(1, o.t / o.life);
            if (o.done) { if (k >= 1) { this.fx.splice(i, 1); o.done(); } continue; }
            if (o.upd) o.upd(o, k);
            if (k >= 1) { this.scene.remove(o.m); o.m.traverse(x => { if (x.material) x.material.dispose(); }); this.fx.splice(i, 1); }
        }
        if (player.heroType !== 'atalanta') return;
        const h = AnimFX.heroPos();
        // Ливень Феба: светящиеся штрихи стрел, падающих наискосок за ~0.25с до удара
        const Rn = player.ataRain;
        if (Rn && this.ensure()) for (const d of Rn.drops) {
            if (d.spawned || Rn.t < d.at - 0.25) continue;
            d.spawned = true;
            const p = this.pos(d.x, d.y), m = new THREE.Mesh(this.streakGeo, this.mat(Math.random() < 0.5 ? 0xfef08a : 0xd9f99d, 0.95));
            const from = new THREE.Vector3(p.x - 2.2, p.y + 9, p.z - 1.2), to = new THREE.Vector3(p.x, p.y + 0.1, p.z), dir = to.clone().sub(from).normalize();
            m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
            const gl = Models3D.glow(0xfef08a, 0.55); gl.scale.set(0.55, 0.4, 0.55); m.add(gl);   // звезда на наконечнике
            this.add(m, 0.25, (o, k) => { o.m.position.lerpVectors(from, to, k); o.m.scale.set(1.6, 2.2, 1.6); });
        }
        // Тёмная аура ярости и проклятия
        if (player.ataWrath > 0 || player.ataFury > 0) { if (Math.random() < (player.ataFury > 0 ? 0.7 : 0.35)) AnimFX.emit({ x: h.x + (Math.random() - 0.5) * 0.7, y: h.y + 0.2 + Math.random() * 1.2, z: h.z + (Math.random() - 0.5) * 0.7, n: 1, color: this.DARK, speed: 0.3, up: 1, life: 0.6, size: 0.08, sizeEnd: 0.02, grav: -1 }); }
        else if (player.ataForm !== 'beast' && Math.random() < 0.05) AnimFX.emit({ x: h.x + (Math.random() - 0.5) * 0.6, y: h.y + 0.4 + Math.random(), z: h.z + (Math.random() - 0.5) * 0.6, n: 1, color: this.STAR, speed: 0.1, up: 0.5, life: 0.9, size: 0.03, grav: -0.2 });
        // Сбор тьмы перед Скиа: частицы стягиваются к героине
        const S = player.ataSkia;
        if (S && !S.done) for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3; AnimFX.emit({ x: h.x + Math.cos(a) * r, y: h.y + 0.3 + Math.random() * 1.5, z: h.z + Math.sin(a) * r, n: 1, color: this.DARK, speed: 0.2, life: 0.5, size: 0.08, grav: 0, pull: { x: h.x, y: h.y + 0.9, z: h.z, k: 12 } }); }
        if (S || player.ataFury > 0) { Engine3D.scene.fog.color.lerp(new THREE.Color(0x1a0620), S ? 0.25 : 0.06); Engine3D.scene.background.copy(Engine3D.scene.fog.color); }
    },
    fxRunes() {
        if (player.heroType !== 'atalanta') return;
        const Rn = player.ataRain; if (Rn) { const p = this.pos(Rn.x, Rn.y); FX3D.runeAt(Rn, 0xd9f99d, p.x, p.z, Rn.R / this.T, Math.min(1, Rn.t / 0.9), { spin: 0.8, crack: Math.min(1, Rn.t / Rn.end) }); }
        const S = player.ataSkia; if (S) { const h = AnimFX.heroPos(); FX3D.runeAt(S, 0x7e22ce, h.x, h.z, S.R / this.T, Math.min(1, S.t / S.wind), { crack: S.done ? 1 : 0.5, spin: 3 }); }
    }
};
