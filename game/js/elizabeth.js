// ============================================================================
// ЭЛИЗАБЕТ АЛЬТЕР (класс «Маг»): падшая богиня с крыльями-очами, магия Пустоты
// ============================================================================
// Пассивка «Скверна»: каждое попадание навыком даёт стак (до 10, сгорают через 5 с без попаданий), +3% к силе навыков за стак.
// Q Багровое Око — луч из глаз на крыльях; W Крылья Скверны — рывок со взрывом при приземлении;
// E Проклятие Падшей — зона по курсору: урон и проклятие (+25% урона по цели, попадания лечат Элизабет);
// D Песнь Пустоты — поддерживаемое заклинание: пульсы урона вокруг, каждый возвращает ману;
// R Падение Богини — взмывает на крыльях и обрушивает дождь копий Пустоты на огромную область.
const ELIZA_SKILLS = {
    q: { key: 'q', name: 'Crimson Gaze', ruName: 'Багровое Око', icon: '👁️', manaCost: 35, baseCd: 7,
         desc: 'Глаза на крыльях открываются разом и выжигают прямую линию лучом Пустоты. Враги на линии получают урон и замедляются.',
         stats: l => `Урон ${60 + 30 * l} + сила навыков • длина 420 • замедление 40% на 1.5с` },
    w: { key: 'w', name: 'Wings of Corruption', ruName: 'Крылья Скверны', icon: '🦇', manaCost: 40, baseCd: 9,
         desc: 'Взмах крыльев переносит Элизабет к курсору. При приземлении скверна взрывается и отбрасывает врагов.',
         stats: l => `Дальность ${200 + 15 * l} • взрыв ${50 + 25 * l} урона, радиус 110` },
    e: { key: 'e', name: 'Fallen Curse', ruName: 'Проклятие Падшей', icon: '🔮', manaCost: 50, baseCd: 12,
         desc: 'Руна Пустоты раскрывается под курсором и взрывается. Проклятые враги 6 секунд получают на 25% больше урона, а каждое попадание по ним лечит Элизабет.',
         stats: l => `Урон ${80 + 35 * l} • радиус 130 • проклятие 6с, лечение 4% урона` },
    d: { key: 'd', name: 'Void Hymn', ruName: 'Песнь Пустоты', icon: '🎶', manaCost: 30, baseCd: 10,
         desc: 'Элизабет поёт гимн Пустоты 2.4 секунды: вокруг неё расходятся волны, ранящие врагов. Каждая волна, задевшая врага, возвращает ману. Пока звучит песнь, она движется медленнее.',
         stats: () => 'Пульс каждые 0.4с • радиус 160 • урон 20 + 4×уровень + сила навыков' },
    r: { key: 'r', name: 'Goddess Fall', ruName: 'Падение Богини', icon: '🌑', manaCost: 120, baseCd: 80,
         desc: 'Элизабет взмывает на крыльях (3.6с, урон по ней вдвое меньше) и обрушивает дождь копий Пустоты на огромную область вокруг. Каждое копьё отмечено руной до удара.',
         stats: l => `${14 + 4 * l} копий • урон ${90 + 40 * l} каждое • радиус области 320` }
};

const Eliza = {
    amp() { return 1 + (player.spellAmp || 0) / 100 + (player.elizaStacks || 0) * 0.03; },
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(160 + L * 28 + q * 10 + eq.hp);
        player.maxMp = Math.round(240 + L * 28 + (q + w + e) * 8 + eq.mp);
        player.hpRegen = +(2.5 + L * 0.3).toFixed(1);
        player.mpRegen = +(7 + L * 0.4 + r * 1.5 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(18 + L * 5 + eq.hand);
        player.spellAmp = Math.round(10 + L * 3 + r * 5 + eq.amp);
        player.armor = Math.round(3 + L * 0.4 + eq.armor);
        player.moveSpeed = Math.round(190 * (player.elizaChannel ? 0.5 : 1));
        player.cdrPct = Math.min(45, Math.round(w * 2 + eq.cdr));
        player.attackInterval = 0.55;
        player.attackRange = 380;
        player.critChance = 5 + eq.crit; player.critMult = 1.5;
    },
    ready(key) {
        const sk = ELIZA_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    // Попадание навыком: стак «Скверны» и вампиризм по проклятым
    hit(en, dmg, color) {
        const mult = en.elizaCurse > 0 ? 1.25 : 1;
        damageEnemy(en, Math.round(dmg * mult), true, 0, 0, color || '#e879f9');
        if (en.elizaCurse > 0) player.hp = Math.min(player.maxHp, player.hp + dmg * mult * 0.04);
        player.elizaStacks = Math.min(10, (player.elizaStacks || 0) + 1); player.elizaStackT = 5;
    },
    // Базовая атака: тёмные снаряды; 3-й в цепочке — веер из трёх
    attack() {
        const step = (player.elizaCombo = ((player.elizaComboT > 0 ? player.elizaCombo || 0 : 0) % 3) + 1); player.elizaComboT = 1.3;
        player.basicAttackCd = player.attackInterval * (step === 3 ? 1.3 : 1);
        player.castAnimTime = 0.2;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        const dmg = Math.round(player.handDmg * this.amp());
        (step === 3 ? [-0.18, 0, 0.18] : [0]).forEach(da => {
            const a = ang + da, sp = 520;
            projectiles.push({ x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, radius: 10, dmg: step === 3 ? Math.round(dmg * 0.8) : dmg,
                fromPlayer: true, isSpell: true, color: '#e879f9', life: player.attackRange / sp });
        });
        SoundFX.play('orb');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), L = player.level, A = this.amp();
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        if (key === 'q') {
            const len = 420, w = 40, dmg = (60 + 30 * lvl) * A, cx = Math.cos(ang), cy = Math.sin(ang);
            enemies.forEach(en => {
                if (en.deadTimer > 0) return;
                const dx = en.x - player.x, dy = en.y - player.y, along = dx * cx + dy * cy, side = Math.abs(-dx * cy + dy * cx);
                if (along > -10 && along < len && side < w + en.radius) { this.hit(en, dmg, '#f0abfc'); en.slowTimer = 1.5; en.slowMult = 0.6; }
            });
            playerFx.push({ type: 'excalibur_beam', x: player.x, y: player.y, ang, len, width: w, life: 0.5, maxLife: 0.5, color: '#e879f9', small: true });
            player.knightAnim = { kind: 'spell1', t: 0.45 };
            this.cd('q', ELIZA_SKILLS.q.baseCd - lvl * 0.4); SoundFX.play('bolt'); triggerScreenShake(2);
        } else if (key === 'w') {
            const dist = 200 + 15 * lvl, steps = 14;
            player.invulnTime = Math.max(player.invulnTime, 0.3);
            for (let i = 0; i < steps; i++) tryMoveEntity(player, Math.cos(ang) * dist / steps, Math.sin(ang) * dist / steps);
            player.moveTargetX = null; player.moveTargetY = null;
            const dmg = (50 + 25 * lvl) * A;
            enemies.forEach(en => { if (en.deadTimer > 0) return; const d = Math.hypot(en.x - player.x, en.y - player.y); if (d < 110 + en.radius) { this.hit(en, dmg); if (!en.isBoss) tryMoveEntity(en, (en.x - player.x) / (d || 1) * 40, (en.y - player.y) / (d || 1) * 40); } });
            if (typeof Eliza3D !== 'undefined') Eliza3D.burst(player.x, player.y, 2.3, 1);
            player.knightAnim = { kind: 'spell1', t: 0.5 };
            this.cd('w', ELIZA_SKILLS.w.baseCd - lvl * 0.5); SoundFX.play('tornado'); triggerScreenShake(3);
        } else if (key === 'e') {
            let tx = mouseWorldX, ty = mouseWorldY; const d = Math.hypot(tx - player.x, ty - player.y);
            if (d > 450) { tx = player.x + (tx - player.x) / d * 450; ty = player.y + (ty - player.y) / d * 450; }
            player.elizaRunes = player.elizaRunes || [];
            player.elizaRunes.push({ x: tx, y: ty, r: 130, delay: 0.8, max: 0.8, dmg: (80 + 35 * lvl) * A, curse: 6, color: 0xc026d3 });
            player.knightAnim = { kind: 'spell1', t: 0.5 };
            this.cd('e', ELIZA_SKILLS.e.baseCd); SoundFX.play('emp');
        } else if (key === 'd') {
            player.elizaChannel = { t: 0, dur: 2.4, tick: 0 };
            this.cd('d', ELIZA_SKILLS.d.baseCd); SoundFX.play('invoke');
            recalcPlayerStats();
        } else if (key === 'r') {
            const n = 14 + 4 * lvl, R = 320, dmg = (90 + 40 * lvl) * A;
            player.elizaUlt = { t: 0, dur: 3.6 };
            player.elizaRunes = player.elizaRunes || [];
            for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R, dl = 0.6 + (i / n) * 2.8; player.elizaRunes.push({ x: player.x + Math.cos(a) * rr, y: player.y + Math.sin(a) * rr, r: 70, delay: dl, max: 0.6, dmg, spear: true, color: 0x9a1ab0 }); }
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            this.cd('r', ELIZA_SKILLS.r.baseCd - lvl * 6); SoundFX.play('invoke'); triggerScreenShake(4);
            spawnFloatingText(player.x, player.y - 50, '🌑 ПАДЕНИЕ БОГИНИ', '#f0abfc');
        }
        updateInvokerBarUI();
    },
    update(dt) {
        if (player.heroType !== 'elizabeth') return;
        if (player.elizaComboT > 0) player.elizaComboT -= dt;
        if (player.elizaStackT > 0) { player.elizaStackT -= dt; if (player.elizaStackT <= 0) player.elizaStacks = 0; }
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        // Песнь Пустоты
        const C = player.elizaChannel;
        if (C) {
            C.t += dt; C.tick -= dt;
            if (C.tick <= 0) {
                C.tick = 0.4; let any = false;
                enemies.forEach(en => { if (en.deadTimer > 0) return; if (Math.hypot(en.x - player.x, en.y - player.y) < 160 + en.radius) { this.hit(en, (20 + player.level * 4) * this.amp()); any = true; } });
                if (any) player.mp = Math.min(player.maxMp, player.mp + 6);
                if (typeof Eliza3D !== 'undefined') Eliza3D.pulse();
            }
            if (C.t >= C.dur) { player.elizaChannel = null; recalcPlayerStats(); }
        }
        // Ульта: героиня в воздухе, получает вдвое меньше урона
        const U = player.elizaUlt;
        if (U) { U.t += dt; if (U.t >= U.dur) player.elizaUlt = null; }
        // Руны: телеграф → удар
        const R = player.elizaRunes;
        if (R) for (let i = R.length - 1; i >= 0; i--) {
            const r = R[i]; r.delay -= dt;
            if (r.delay > 0) continue;
            enemies.forEach(en => { if (en.deadTimer > 0) return; if (Math.hypot(en.x - r.x, en.y - r.y) < r.r + en.radius) { this.hit(en, r.dmg); if (r.curse) en.elizaCurse = r.curse; } });
            if (typeof Eliza3D !== 'undefined') Eliza3D.strike(r);
            R.splice(i, 1);
        }
        enemies.forEach(en => { if (en.elizaCurse > 0) en.elizaCurse -= dt; });
    },
    // Урон по героине во время ульты — вдвое меньше
    damageMult() { return player.heroType === 'elizabeth' && player.elizaUlt ? 0.5 : 1; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('elizaActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'elizaActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['d', 'D'], ['r', 'R']].forEach(([k, K]) => {
            const sk = ELIZA_SKILLS[k], ult = k === 'r', lvlBtn = k !== 'd';
            html += `<div class="flex flex-col items-center relative z-20">
                ${lvlBtn ? `<button id="btnElizaLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>` : '<div class="mb-1 h-[18px]"></div>'}
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-fuchsia-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdEliza${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-fuchsia-200' : 'text-fuchsia-100'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsEliza${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudElizaHp', 'Кровь'], ['mp', '2', '🔮', 'hudElizaMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'elizaTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#f0abfc">Элизабет Альтер:</span><span id="elizaHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('elizaHint'); if (el) el.textContent = `Скверна ${player.elizaStacks || 0}/10 (+${(player.elizaStacks || 0) * 3}% к навыкам)${player.elizaChannel ? ' • ПЕСНЬ ПУСТОТЫ' : ''}`;
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudElizaHp'), b = document.getElementById('hudElizaMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ ЭЛИЗАБЕТ: пурпурная Пустота, руны, копья, пульсы песни, полёт
// ============================================================================
const Eliza3D = {
    P: [0xe879f9, 0xc026d3, 0x7a1a8a, 0xffffff],
    pos(x, y) { const X = x / 48, Z = y / 48; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    burst(x, y, r, k) { const p = this.pos(x, y); AnimFX.shock(p.x, p.y + 0.05, p.z, 0xc026d3, 0.2, r, 0.5); AnimFX.emit({ x: p.x, y: p.y + 0.6, z: p.z, n: 60 * k, color: this.P, speed: 3, up: 1.5, life: 0.7, size: 0.08, grav: 2 }); AnimFX.emit({ x: p.x, y: p.y + 1, z: p.z, n: 24 * k, color: [0x2a0a3a, 0x4a1a5a], speed: 1.5, up: 1, life: 1, size: 0.14, grav: 6 }); AnimFX.flash(p.x, p.z, 0xc026d3, 4, 0.4); AnimFX.kick(0.4 * k); },
    pulse() { const p = this.pos(player.x, player.y); AnimFX.shock(p.x, p.y + 0.1, p.z, 0xe879f9, 0.3, 160 / 48, 0.45, 0.8); AnimFX.emit({ x: p.x, y: p.y + 1.2, z: p.z, n: 12, color: this.P, speed: 2.5, life: 0.5, size: 0.05, grav: 0 }); Sfx3D.play('pickup', 0.6); },
    strike(r) {
        const p = this.pos(r.x, r.y), R = r.r / 48;
        if (r.spear) { AnimFX.emit({ x: p.x, y: p.y + 6, z: p.z, n: 18, color: [0xe879f9, 0xffffff], speed: 0.2, life: 0.25, size: 0.12, grav: 40, dir: [0, -1, 0], spread: 0.1 }); }
        AnimFX.impact(p.x, p.z, r.curse ? 0xc026d3 : 0xe879f9, Math.max(0.8, R * 0.9), { dust: 0x2a1a30 });
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 24, color: this.P, speed: 1, up: 4, life: 0.8, size: 0.07, grav: -1, r: R * 0.4 });
        if (Math.random() < 0.5) Sfx3D.play('impact', 0.7);
    },
    // Руны телеграфа (вызывается из прохода FX3D, до уборки объектов)
    fxRunes() {
        const R = player.elizaRunes; if (!R) return;
        for (const r of R) { const p = this.pos(r.x, r.y); FX3D.runeAt(r, r.color, p.x, p.z, r.r / 48, 1 - Math.max(0, r.delay) / r.max, { crack: r.spear ? 0.6 : 1, spin: 1.5, op: r.delay > r.max ? 0.3 : 1 }); }
    },
    update(dt) {
        if (player.heroType !== 'elizabeth') return;
        const p = this.pos(player.x, player.y), t = Engine3D.t;
        // Поющая героиня: ноты-искры и тёмная аура
        if (player.elizaChannel && Math.random() < 0.7) { const a = t * 4 + Math.random(); AnimFX.emit({ x: p.x + Math.cos(a) * 0.6, y: p.y + 1.2, z: p.z + Math.sin(a) * 0.6, n: 1, color: this.P, speed: 0.4, up: 0.8, life: 1, size: 0.07, grav: -0.5 }); }
        // Полёт в ульте: перья Пустоты, тёмное небо
        if (player.elizaUlt) {
            for (let i = 0; i < 3; i++) AnimFX.emit({ x: p.x + (Math.random() - 0.5) * 1.6, y: p.y + 1.6 + Math.random(), z: p.z + (Math.random() - 0.5) * 1.6, n: 1, color: [0x2a0a3a, 0x7a1a8a, 0xe879f9], speed: 0.3, life: 1.6, size: 0.12, grav: 0.6, drag: 1 });
            Engine3D.scene.fog.color.lerp(new THREE.Color(0x2a0a3a), 0.3); Engine3D.scene.background.copy(Engine3D.scene.fog.color);
        }
        // Проклятые враги: пурпурные искры
        for (const en of enemies) if (en.elizaCurse > 0 && en.deadTimer <= 0 && Math.random() < 0.15) { const q = this.pos(en.x, en.y); AnimFX.emit({ x: q.x, y: q.y + 1, z: q.z, n: 1, color: [0xc026d3, 0xe879f9], speed: 0.3, up: 0.6, life: 0.8, size: 0.06, grav: -0.5 }); }
    }
};
