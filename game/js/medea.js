// ============================================================================
// МЕДЕЯ (класс «Маг»): Ведьма Предательства, магия Эпохи Богов
// ============================================================================
// Хрупкая, но смертоносная: мало здоровья и брони, много маны и урона, очень быстрые касты.
// Q Божественные Слова — почти мгновенный залп магических сфер к курсору.
// W Воины Драконьих Зубов — из засеянных клыков поднимаются скелеты-воины: отвлекают рядовых врагов (боссы их игнорируют).
// E Пространственный Скачок — телепорт к курсору, короткая неуязвимость, на месте ухода остаётся замедляющая руна.
// R Разрушитель Правил — магический шторм вокруг и удар кинжалом Rule Breaker: снимает с врагов щиты, неуязвимость,
//   ускорения и сопротивление магии, ослабляет их удары и замедляет; рассеивает вражеские заклинания в области.
const MEDEA_SKILLS = {
    q: { key: 'q', name: 'High-Speed Divine Words', ruName: 'Божественные Слова', icon: '📜', manaCost: 22, baseCd: 2.4,
         desc: 'Одно слово на языке богов — и к курсору летит плотный залп магических сфер. Каст почти мгновенный, можно стрелять на ходу.',
         stats: l => `Сфер: ${4 + Math.floor(l / 2)} • урон каждой ${26 + 13 * l} + сила • перезарядка 2.4с` },
    w: { key: 'w', name: 'Dragon Tooth Warriors', ruName: 'Воины Драконьих Зубов', icon: '🦷', manaCost: 60, baseCd: 16,
         desc: 'Медея засевает землю драконьими клыками, и из-под земли поднимаются воины-скелеты. Рядовые враги отвлекаются на них, боссы и мини-боссы — нет. Живут 12 секунд.',
         stats: l => `Воинов: ${l >= 6 ? 4 : l >= 3 ? 3 : 2} • здоровье ${90 + 45 * l} (+12 за уровень героя) • удар ${10 + 6 * l} + сила` },
    e: { key: 'e', name: 'Spatial Blink', ruName: 'Пространственный Скачок', icon: '✨', manaCost: 35, baseCd: 8,
         desc: 'Мгновенный телепорт к курсору: выход из зоны удара босса. 0.6 секунды Медея неуязвима, а на месте ухода остаётся руна, которая взрывается и замедляет врагов.',
         stats: l => `Дальность ${240 + 15 * l} • руна: ${40 + 22 * l} урона, замедление 50% на 2с • перезарядка ${Math.max(4, 8 - l * 0.5).toFixed(1)}с` },
    r: { key: 'r', name: 'Rule Breaker', ruName: 'Разрушитель Правил', icon: '🗡️', manaCost: 130, baseCd: 70,
         desc: 'Ультимейт. Магический шторм бьёт по области вокруг Медеи, затем она вонзает кинжал Rule Breaker в сильнейшего врага рядом. Снимает с врагов в области щиты, неуязвимость, ускорения, броню и сопротивление магии, рассеивает их заклинания, ослабляет удары на 35% и замедляет.',
         stats: l => `Шторм: 3 × ${60 + 30 * l} в радиусе 300 • Rule Breaker: ${260 + 130 * l} • ослабление и замедление ${4 + l}с` }
};

const Medea = {
    amp() { return 1 + (player.spellAmp || 0) / 100; },
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(120 + L * 20 + eq.hp);                 // хрупкая
        player.maxMp = Math.round(300 + L * 34 + (q + w + e) * 10 + eq.mp);
        player.hpRegen = +(1.8 + L * 0.2).toFixed(1);
        player.mpRegen = +(8 + L * 0.55 + r * 2 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(20 + L * 5.5 + eq.hand);
        player.spellAmp = Math.round(15 + L * 3.5 + r * 6 + eq.amp);
        player.armor = Math.round(1 + L * 0.3 + eq.armor);
        player.moveSpeed = 196;
        player.cdrPct = Math.min(45, Math.round(q * 1.5 + eq.cdr));
        player.attackInterval = 0.5;
        player.attackRange = 400;
        player.critChance = 6 + eq.crit; player.critMult = 1.6;
    },
    ready(key) {
        const sk = MEDEA_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    hit(en, dmg, color) { damageEnemy(en, Math.round(dmg), true, 0, 0, color || '#c4b5fd'); },
    bolt(ang, dmg, sp = 600, r = 9, color = '#a78bfa', delay = 0) {
        const fire = () => projectiles.push({ x: player.x + Math.cos(ang) * 22, y: player.y + Math.sin(ang) * 22, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, radius: r, dmg: Math.round(dmg),
            fromPlayer: true, isSpell: true, color, life: (player.attackRange + 40) / sp });
        if (delay > 0) (player.medeaQueue = player.medeaQueue || []).push({ t: delay, fire }); else fire();
    },
    // Базовая атака: сгусток магии Эпохи Богов
    attack() {
        player.basicAttackCd = player.attackInterval;
        player.castAnimTime = 0.18;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        this.bolt(ang, player.handDmg * this.amp(), 640, 9, '#93c5fd');
        SoundFX.play('orb');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), A = this.amp();
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        if (key === 'q') {
            const n = 4 + Math.floor(lvl / 2), dmg = (26 + 13 * lvl) * A;
            for (let i = 0; i < n; i++) { const da = (i - (n - 1) / 2) * 0.07 + (Math.random() - 0.5) * 0.04; this.bolt(ang + da, dmg, 700 + Math.random() * 80, 8, i % 2 ? '#a78bfa' : '#67e8f9', i * 0.035); }
            player.knightAnim = { kind: 'volley', t: 0.3 };
            if (typeof Medea3D !== 'undefined') Medea3D.words(ang);
            this.cd('q', MEDEA_SKILLS.q.baseCd); SoundFX.play('bolt');
        } else if (key === 'w') {
            let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
            if (d > 420) { tx = player.x + (tx - player.x) / d * 420; ty = player.y + (ty - player.y) / d * 420; }
            const n = lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2, hp = 90 + 45 * lvl + player.level * 12;
            player.medeaWarriors = (player.medeaWarriors || []).filter(w => w.hp > 0);
            while (player.medeaWarriors.length + n > 6) player.medeaWarriors.shift().hp = 0;   // не больше шести одновременно
            for (let i = 0; i < n; i++) {
                const a = i / n * Math.PI * 2 + Math.random() * 0.5, p = nearestFreeTile((tx + Math.cos(a) * 34) / TS - 0.5, (ty + Math.sin(a) * 34) / TS - 0.5, WALKABLE_TILES);
                player.medeaWarriors.push({ uid: Math.random(), x: p.x, y: p.y, hp, maxHp: hp, dmg: (10 + 6 * lvl) * A, life: 12, atkCd: 0.6 + i * 0.15, rise: 0, radius: 14, face: a });
            }
            player.knightAnim = { kind: 'sow', t: 0.35 };
            if (typeof Medea3D !== 'undefined') Medea3D.sow(tx, ty);
            this.cd('w', MEDEA_SKILLS.w.baseCd - lvl * 0.5); SoundFX.play('emp');
        } else if (key === 'e') {
            const range = 240 + 15 * lvl, d = Math.min(range, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)), ox = player.x, oy = player.y;
            // Ищем дальнюю свободную точку на линии — сквозь врагов и узкие препятствия, но не в стену
            let best = null;
            for (let s = d; s >= 30; s -= 12) { const x = ox + Math.cos(ang) * s, y = oy + Math.sin(ang) * s; if (!isTileBlocked(Math.floor(x / TS), Math.floor(y / TS))) { best = { x, y }; break; } }
            if (!best) { player.mp += MEDEA_SKILLS.e.manaCost; showToast('Некуда перенестись', 'error'); return; }
            player.x = best.x; player.y = best.y; player.moveTargetX = null; player.moveTargetY = null;
            player.invulnTime = Math.max(player.invulnTime, 0.6);
            (player.medeaRunes = player.medeaRunes || []).push({ x: ox, y: oy, r: 95, delay: 0.5, max: 0.5, dmg: (40 + 22 * lvl) * A, slow: 2 });
            player.knightAnim = { kind: 'appear', t: 0.3 };
            if (typeof Medea3D !== 'undefined') Medea3D.blink(ox, oy, best.x, best.y);
            this.cd('e', Math.max(4, MEDEA_SKILLS.e.baseCd - lvl * 0.5)); SoundFX.play('tornado');
        } else if (key === 'r') {
            player.medeaUlt = { t: 0, dur: 1.15, R: 300, pulses: 0, storm: (60 + 30 * lvl) * A, stab: (260 + 130 * lvl) * A, weak: 4 + lvl, stabbed: false };
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'storm', t: 0.62 };
            this.cd('r', MEDEA_SKILLS.r.baseCd - lvl * 5); SoundFX.play('invoke'); SoundFX.play('thunder');
            if (typeof Medea3D !== 'undefined') Medea3D.storm(player.x, player.y, 300);
        }
        updateInvokerBarUI();
    },
    // Rule Breaker: снимает с врага магические щиты и усиления, ослабляет и замедляет
    breakRules(en, sec) {
        if (en.deadTimer > 0) return;
        en.invuln = 0;
        if (!en.ruleBroken) en.ruleBroken = { dmg: en.dmg, armor: en.armor, mres: en.mres, speed: en.speed };
        en.ruleBroken.t = sec;
        en.dmg = Math.round(en.ruleBroken.dmg * 0.65);
        en.armor = 0; en.mres = 0;
        if (en.tpl && en.speed > en.tpl.speed * (diffCfg().speed || 1)) en.speed = Math.round(en.tpl.speed * (diffCfg().speed || 1));   // снятое ускорение фазы
        en.slowTimer = Math.max(en.slowTimer || 0, sec); en.slowMult = Math.min(en.slowMult || 1, 0.55);
        if (typeof Medea3D !== 'undefined') Medea3D.shatter(en);
    },
    update(dt) {
        if (player.heroType !== 'medea') return;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        const Q = player.medeaQueue;
        if (Q) for (let i = Q.length - 1; i >= 0; i--) { Q[i].t -= dt; if (Q[i].t <= 0) { Q[i].fire(); Q.splice(i, 1); } }
        // Руны скачка: телеграф → взрыв и замедление
        const R = player.medeaRunes;
        if (R) for (let i = R.length - 1; i >= 0; i--) {
            const r = R[i]; r.delay -= dt; if (r.delay > 0) continue;
            enemies.forEach(en => { if (en.deadTimer > 0) return; if (Math.hypot(en.x - r.x, en.y - r.y) < r.r + en.radius) { this.hit(en, r.dmg); en.slowTimer = Math.max(en.slowTimer || 0, r.slow); en.slowMult = Math.min(en.slowMult || 1, 0.5); } });
            if (typeof Medea3D !== 'undefined') Medea3D.rune(r);
            R.splice(i, 1);
        }
        // Ульта: три импульса шторма, затем удар кинжалом
        const U = player.medeaUlt;
        if (U) {
            U.t += dt;
            while (U.pulses < 3 && U.t >= 0.12 + U.pulses * 0.17) {
                U.pulses++;
                enemies.forEach(en => { if (en.deadTimer > 0) return; if (Math.hypot(en.x - player.x, en.y - player.y) < U.R + en.radius) this.hit(en, U.storm, '#c4b5fd'); });
                if (typeof Medea3D !== 'undefined') Medea3D.pulse(player.x, player.y, U.R);
            }
            if (!U.stabbed && U.t >= 0.66) {
                U.stabbed = true;
                // Цель — сильнейший враг рядом (предпочтительно у курсора); Медея переносится к нему
                const foes = enemies.filter(en => en.deadTimer <= 0 && Math.hypot(en.x - player.x, en.y - player.y) < U.R + 60);
                const tgt = foes.sort((a, b) => (b.maxHp - Math.hypot(b.x - mouseWorldX, b.y - mouseWorldY)) - (a.maxHp - Math.hypot(a.x - mouseWorldX, a.y - mouseWorldY)))[0];
                if (tgt) {
                    const a = Math.atan2(player.y - tgt.y, player.x - tgt.x), p = { x: tgt.x + Math.cos(a) * (tgt.radius + 22), y: tgt.y + Math.sin(a) * (tgt.radius + 22) };
                    if (!isTileBlocked(Math.floor(p.x / TS), Math.floor(p.y / TS))) { if (typeof Medea3D !== 'undefined') Medea3D.blink(player.x, player.y, p.x, p.y, true); player.x = p.x; player.y = p.y; }
                    player.facingAngle = Math.atan2(tgt.y - player.y, tgt.x - player.x);
                    this.hit(tgt, U.stab, '#f0abfc');
                }
                enemies.forEach(en => { if (Math.hypot(en.x - player.x, en.y - player.y) < U.R + en.radius) this.breakRules(en, U.weak); });
                // Анти-магия: гасит вражеские заклинания и снаряды в области
                enemyHazards = enemyHazards.filter(h => Math.hypot(h.x - player.x, h.y - player.y) > U.R);
                projectiles = projectiles.filter(p => p.fromPlayer || Math.hypot(p.x - player.x, p.y - player.y) > U.R);
                player.knightAnim = { kind: 'rulebreaker', t: 0.45 };
                if (typeof Medea3D !== 'undefined') Medea3D.ruleBreaker(player.x + Math.cos(player.facingAngle) * 30, player.y + Math.sin(player.facingAngle) * 30, U.R);
                if (typeof Feel !== 'undefined') Feel.impact(Math.cos(player.facingAngle), Math.sin(player.facingAngle), 1.2, true);
                spawnFloatingText(player.x, player.y - 54, '🗡️ RULE BREAKER', '#f0abfc');
                SoundFX.play('sunstrike');
            }
            if (U.t >= U.dur) player.medeaUlt = null;
        }
        // Снятые правила: по истечении всё возвращается
        enemies.forEach(en => { const b = en.ruleBroken; if (!b) return; b.t -= dt; if (b.t <= 0 || en.deadTimer > 0) { en.dmg = b.dmg; en.armor = b.armor; en.mres = b.mres; en.ruleBroken = null; } });
        this.updateWarriors(dt);
    },
    // Воины Драконьих Зубов: поднимаются из земли, бьют ближайших врагов, держатся рядом с Медеей
    updateWarriors(dt) {
        const W = player.medeaWarriors; if (!W) return;
        for (let i = W.length - 1; i >= 0; i--) {
            const w = W[i]; w.life -= dt; w.rise = Math.min(1, w.rise + dt * 2.2); if (w.atkCd > 0) w.atkCd -= dt;
            if (w.hp <= 0 || w.life <= 0) { if (typeof Medea3D !== 'undefined') Medea3D.crumble(w); W.splice(i, 1); continue; }
            if (w.rise < 1) continue;
            let tgt = null, best = 300;
            enemies.forEach(en => { if (en.deadTimer > 0) return; const d = Math.hypot(en.x - w.x, en.y - w.y); if (d < best) { best = d; tgt = en; } });
            if (tgt) {
                w.face = Math.atan2(tgt.y - w.y, tgt.x - w.x);
                if (best > tgt.radius + 26) tryMoveEntity(w, Math.cos(w.face) * 150 * dt, Math.sin(w.face) * 150 * dt);
                else if (w.atkCd <= 0) { w.atkCd = 1.0; w.swing = (w.swing || 0) + 1; damageEnemy(tgt, Math.round(w.dmg), false, tgt.x - w.x, tgt.y - w.y, '#ddd6fe'); }
            } else {
                const dx = player.x - w.x, dy = player.y - w.y, d = Math.hypot(dx, dy);
                if (d > 110) { w.face = Math.atan2(dy, dx); tryMoveEntity(w, dx / d * 170 * dt, dy / d * 170 * dt); }
            }
        }
    },
    // Рядовые враги отвлекаются на ближнего воина (боссы, мини-боссы и обездвиженные — нет). true — ИИ врага пропускаем
    taunt(en, dt) {
        const W = player.medeaWarriors;
        if (!W || !W.length || en.isBoss || (en.tpl && en.tpl.miniBoss) || en.stunTimer > 0 || en.freezeTimer > 0 || en.knockUp) return false;
        const dp = Math.hypot(player.x - en.x, player.y - en.y);
        let w = null, best = 230;
        for (const x of W) { if (x.hp <= 0 || x.rise < 1) continue; const d = Math.hypot(x.x - en.x, x.y - en.y); if (d < best && d < dp) { best = d; w = x; } }
        if (!w) return false;
        const sp = en.speed * (en.slowTimer > 0 ? en.slowMult : 1);
        if (best > (en.attackRange || 40) + 10) tryMoveEntity(en, (w.x - en.x) / best * sp * dt, (w.y - en.y) / best * sp * dt);
        else if (en.attackCd <= 0 && en.disarmTimer <= 0) { en.attackCd = diffCfg().atkCd * (en.tpl.attackTime || 1.15); w.hp -= en.dmg; w.hitT = 0.2; }
        return true;
    },
    damageMult() { return 1; },
    locked() { return player.heroType === 'medea' && !!player.medeaUlt; },
    reset() { player.medeaUlt = null; player.medeaRunes = null; player.medeaQueue = null; player.medeaWarriors = []; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('medeaActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'medeaActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = MEDEA_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnMedeaLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-violet-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdMedea${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-violet-200' : 'text-violet-100'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsMedea${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudMedeaHp', 'Кровь'], ['mp', '2', '🔮', 'hudMedeaMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'medeaTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#c4b5fd">Медея:</span><span id="medeaHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('medeaHint'), n = (player.medeaWarriors || []).filter(w => w.hp > 0).length;
        if (el) el.textContent = n ? `Воинов Драконьих Зубов: ${n}` : 'Магия Эпохи Богов';
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudMedeaHp'), b = document.getElementById('hudMedeaMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ МЕДЕИ: магические круги, воины-скелеты, вспышки скачка, шторм и Rule Breaker
// ============================================================================
const Medea3D = {
    P: [0xa78bfa, 0x7c3aed, 0x67e8f9, 0xffffff],
    RAINBOW: [0xff5a7a, 0xffb347, 0xfff07a, 0x7affc0, 0x67e8f9, 0xa78bfa, 0xf0abfc],
    T: 48,
    actors: new Map(),
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    words(ang) { const p = this.pos(player.x, player.y); AnimFX.sigil(p.x + Math.cos(ang) * 0.5, p.y + 1, p.z + Math.sin(ang) * 0.5, Math.PI / 2 - ang, 0xa78bfa, 0.7, 0.35); AnimFX.emit({ x: p.x, y: p.y + 1.1, z: p.z, n: 12, color: this.P, speed: 1.5, life: 0.3, size: 0.04, grav: 0 }); },
    sow(x, y) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.05, p.z, 0x7c3aed, 0.2, 1.4, 0.6); AnimFX.emit({ x: p.x, y: p.y + 1.5, z: p.z, n: 16, color: [0xf5f5f4, 0xd6d3d1], speed: 0.5, life: 0.4, size: 0.06, grav: 14, r: 0.6 }); },
    blink(ox, oy, nx, ny, quick) {
        const a = this.pos(ox, oy), b = this.pos(nx, ny);
        AnimFX.emit({ x: a.x, y: a.y + 0.9, z: a.z, n: quick ? 20 : 40, color: this.P, speed: 2.5, life: 0.4, size: 0.06, grav: -1 });
        AnimFX.shock(a.x, a.y + 0.05, a.z, 0xa78bfa, 0.5, 0.1, 0.3);
        AnimFX.shock(b.x, b.y + 0.05, b.z, 0x67e8f9, 0.1, 1.2, 0.4);
        AnimFX.emit({ x: b.x, y: b.y + 0.9, z: b.z, n: quick ? 20 : 36, color: this.P, speed: 1.8, up: 1, life: 0.45, size: 0.05, grav: 0 });
        AnimFX.flash(b.x, b.z, 0xa78bfa, 4, 0.3, 1.5);
        Frank3D.bolt(new THREE.Vector3(a.x, a.y + 0.9, a.z), new THREE.Vector3(b.x, b.y + 0.9, b.z), 0.18, 0.03, 1, 'v');
    },
    rune(r) { const p = this.pos(r.x, r.y); AnimFX.impact(p.x, p.z, 0xa78bfa, 1, { dust: 0x2a1a3a }); AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 20, color: this.P, speed: 1, up: 3, life: 0.6, size: 0.05, grav: -1, r: 0.6 }); },
    storm(x, y, R) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.05, p.z, 0x7c3aed, R / this.T, 0.3, 0.6, 0.8); AnimFX.flash(p.x, p.z, 0x7c3aed, 6, 0.6, 3); },
    pulse(x, y, R) {
        const p = this.pos(x, y), r = R / this.T;
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xa78bfa, 0.3, r, 0.4); AnimFX.shock(p.x, p.y + 0.06, p.z, 0x67e8f9, 0.2, r * 0.7, 0.35, 0.6);
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r; Frank3D.bolt(new THREE.Vector3(p.x + Math.cos(a) * d, p.y + 5, p.z + Math.sin(a) * d), new THREE.Vector3(p.x + Math.cos(a) * d, p.y + 0.1, p.z + Math.sin(a) * d), 0.2, 0.04, 2, 'v'); }
        AnimFX.emit({ x: p.x, y: p.y + 0.5, z: p.z, n: 40, color: this.P, speed: 3, up: 1, life: 0.5, size: 0.05, grav: 1, r: r * 0.5 });
        AnimFX.kick(0.35); Sfx3D.play('impact', 0.7);
    },
    // Rule Breaker: радужный зигзаг кинжала, раскол магического круга, разлетающиеся осколки
    ruleBreaker(x, y, R) {
        const p = this.pos(x, y), r = R / this.T;
        this.RAINBOW.forEach((c, i) => AnimFX.shock(p.x, p.y + 0.05 + i * 0.01, p.z, c, 0.1, r * (0.45 + i * 0.09), 0.5 + i * 0.05, 0.85));
        AnimFX.emit({ x: p.x, y: p.y + 0.9, z: p.z, n: 140, color: this.RAINBOW, speed: 6, up: 1.5, life: 0.7, size: 0.06, grav: 2, drag: 1 });
        AnimFX.emit({ x: p.x, y: p.y + 0.9, z: p.z, n: 50, color: [0xffffff, 0xe0f2fe], speed: 4, up: 2, life: 0.6, size: 0.1, sizeEnd: 0.01, grav: 6 });
        AnimFX.flash(p.x, p.z, 0xf0abfc, 10, 0.5, 2.5);
        AnimFX.kick(1.1);
        // Зигзаг лезвия
        let a = new THREE.Vector3(p.x, p.y + 2.2, p.z);
        for (let i = 0; i < 5; i++) { const b = new THREE.Vector3(p.x + (i % 2 ? 0.35 : -0.35), p.y + 2.2 - (i + 1) * 0.42, p.z); Frank3D.bolt(a, b, 0.4, 0.05, 0, 'v'); a = b; }
    },
    shatter(en) { const p = this.pos(en.x, en.y); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 18, color: [0xffffff, 0xc4b5fd, 0x67e8f9], speed: 2.5, up: 1.5, life: 0.6, size: 0.07, sizeEnd: 0.01, grav: 7 }); AnimFX.shock(p.x, p.y + 1, p.z, 0xf0abfc, 0.6, 0.1, 0.35); },
    crumble(w) { const p = this.pos(w.x, w.y); AnimFX.emit({ x: p.x, y: p.y + 0.6, z: p.z, n: 26, color: [0xe7e5e4, 0xa8a29e, 0x7c3aed], speed: 1.5, up: 1, life: 0.8, size: 0.08, grav: 9 }); },
    fxRunes() {
        if (player.heroType !== 'medea') return;
        for (const r of (player.medeaRunes || [])) { const p = this.pos(r.x, r.y); FX3D.runeAt(r, 0x7c3aed, p.x, p.z, r.r / this.T, 1 - Math.max(0, r.delay) / r.max, { crack: 0.4, spin: 2 }); }
        const U = player.medeaUlt; if (U) { const p = this.pos(player.x, player.y); FX3D.runeAt(U, 0xa78bfa, p.x, p.z, U.R / this.T, Math.min(1, U.t / 0.6), { crack: U.stabbed ? 1 : 0, spin: 1.2 }); }
    },
    update(dt) {
        const W = player.heroType === 'medea' ? (player.medeaWarriors || []) : [], seen = new Set();
        for (const w of W) {
            if (w.hp <= 0) continue;
            seen.add(w.uid);
            let a = this.actors.get(w.uid);
            if (!a) {
                const m = Models3D.enemy('skeleton', { type: 'skeleton' });
                a = Actors3D.make(m, 0x8b5cf6); a.weight = 0.9; this.actors.set(w.uid, a);
                const p = this.pos(w.x, w.y); AnimFX.emit({ x: p.x, y: p.y + 0.1, z: p.z, n: 24, color: [0x6a5a48, 0x8a7a64, 0x7c3aed], speed: 1.5, up: 2.5, life: 0.7, size: 0.1, grav: 8 });
                a.mats.forEach(mt => { if (mt.emissive) { mt.emissive.setHex(0x5b21b6); mt.emissiveIntensity = 0.35; mt.userData.e0 = mt.emissive.clone(); mt.userData.i0 = 0.35; } });   // рунное фиолетовое свечение
            }
            if ((w.swing || 0) !== (a.swingN || 0)) { a.swingN = w.swing; Actors3D.attack(a, a.swingN % 2 ? 'slash' : 'slashB', 0.5); }
            if (w.hitT > 0) { w.hitT -= dt; a.flash = 1; a.hitT = 0.25; }
            Actors3D.animate(a, dt, w.x / this.T, w.y / this.T, { face: Math.PI / 2 - w.face });
            a.root.position.y += -(1 - w.rise) * 1.3;   // поднимается из-под земли
            a.flash = Math.max(0, (a.flash || 0) - dt * 4);
            if (w.life < 1.5) a.base.visible = Math.sin(w.life * 30) > -0.3;   // мерцает перед тем, как рассыпаться
        }
        for (const [uid, a] of this.actors) if (!seen.has(uid)) { Actors3D.drop(a); this.actors.delete(uid); }
        if (player.heroType !== 'medea') return;
        // Ослабленные Rule Breaker враги: осколки разбитых чар
        for (const en of enemies) if (en.ruleBroken && en.deadTimer <= 0 && Math.random() < 0.12) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 1.2, z: q.z, n: 1, color: this.RAINBOW, speed: 0.4, up: 0.5, life: 0.7, size: 0.05, grav: 1 }); }
        // Шторм ульты: тёмно-фиолетовое небо
        if (player.medeaUlt) { Engine3D.scene.fog.color.lerp(new THREE.Color(0x1e0a3a), 0.25); Engine3D.scene.background.copy(Engine3D.scene.fog.color); }
    }
};
