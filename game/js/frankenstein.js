// ============================================================================
// ФРАНКЕНШТЕЙН (класс «Берсерк»): девушка-голем с гигантской булавой и жёлтыми молниями
// ============================================================================
// Q Удар с подбросом — замах, короткая задержка (видна зона), удар по земле подбрасывает врагов рядом.
// W Бросок булавы — булава летит по направлению, пробивая врагов; затем Франкенштейн притягивается к ней.
// E Тройной удар — три удара по земле, радиус каждого вдвое больше предыдущего (×1 → ×2 → ×4).
// R Грозовое Древо — дерево из цепей жёлтых молний вырастает над ней и бьёт врагов в огромном радиусе.
// Безумие берсерка: шкала (жёлтая жидкость над маной) быстро растёт от навыков и медленно спадает.
// Переполнилась — героиня теряет контроль и носится по кругу и как попало, отскакивая от препятствий.
const FRANK_SKILLS = {
    q: { key: 'q', name: 'Ground Slam', ruName: 'Удар с подбросом', icon: '🔨', manaCost: 25, baseCd: 6,
         desc: 'Франкенштейн заносит булаву и с короткой задержкой бьёт по земле. Враги в небольшом радиусе получают урон и взлетают в воздух.',
         stats: l => `Урон ${70 + 32 * l} + сила • радиус 80 • подброс 0.7с • задержка 0.35с • безумие +10%` },
    w: { key: 'w', name: 'Mace Throw', ruName: 'Бросок булавы', icon: '⛓️', manaCost: 30, baseCd: 9,
         desc: 'Бросает булаву по направлению курсора: она пробивает врагов на пути и вонзается в землю. Затем Франкенштейн притягивается к ней и бьёт по месту приземления.',
         stats: l => `Дальность ${320 + 20 * l} • урон в полёте ${55 + 25 * l} • удар при приземлении ${40 + 20 * l} • безумие +10%` },
    e: { key: 'e', name: 'Triple Quake', ruName: 'Тройной удар', icon: '💥', manaCost: 55, baseCd: 14,
         desc: 'Три удара по земле подряд. Каждый подбрасывает врагов, и радиус каждого вдвое больше предыдущего: третий накрывает огромную область.',
         stats: l => `Радиусы 75 → 150 → 300 • урон ${60 + 25 * l} / ×1.3 / ×2 • безумие +30%` },
    r: { key: 'r', name: 'Blasted Tree', ruName: 'Грозовое Древо', icon: '⚡', manaCost: 110, baseCd: 75,
         desc: 'Ультимейт. Над Франкенштейн вырастает ветвистое дерево из цепей жёлтых молний. Три секунды разряды бьют врагов в огромном радиусе, в конце — общий удар грома с подбросом. Урон по ней на 30% меньше.',
         stats: l => `Радиус 420 • разряд ${100 + 50 * l} каждые 0.2с (до 3 целей) • финальный удар ${180 + 80 * l} • безумие +80%` }
};
// Сколько безумия даёт навык (в процентах)
const FRANK_MADNESS = { q: 10, w: 10, e: 30, r: 80 };

const Frank = {
    // Берсерк — любой персонаж класса «Берсерк» (сейчас это Франкенштейн)
    isBerserker() { const c = typeof playerChar === 'function' ? playerChar() : null; return !!(c && c.cls === 'berserker'); },
    amp() { return 1 + (player.spellAmp || 0) / 100; },
    stats(L, q, w, e, r, eq) {
        player.maxHp = Math.round(230 + L * 38 + q * 12 + eq.hp);
        player.maxMp = Math.round(170 + L * 18 + (q + w + e) * 6 + eq.mp);
        player.hpRegen = +(3.5 + L * 0.45).toFixed(1);
        player.mpRegen = +(4.5 + L * 0.3 + eq.mpRegen).toFixed(1);
        player.handDmg = Math.round(28 + L * 6.5 + eq.hand);
        player.spellAmp = Math.round(6 + L * 2.5 + r * 5 + eq.amp);
        player.armor = Math.round(7 + L * 0.7 + eq.armor);
        player.moveSpeed = Math.round(182 * (player.frankFrenzy ? 1.4 : 1));
        player.cdrPct = Math.min(40, Math.round(w * 1.5 + eq.cdr));
        player.attackInterval = 0.85;
        player.attackRange = 82;
        player.critChance = 8 + eq.crit; player.critMult = 1.75;
    },
    ready(key) {
        const sk = FRANK_SKILLS[key], c = player.saberCooldowns[key] || 0;
        if (!sk || player.controlLock) return false;
        if (c > 0) { showToast(`${sk.ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; }
        if (player.mp < sk.manaCost) { showToast(`Недостаточно маны (нужно ${sk.manaCost} MP)!`, 'error'); return false; }
        player.mp -= sk.manaCost; return true;
    },
    cd(key, base) { player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); },
    hit(en, dmg, color) { damageEnemy(en, Math.round(dmg), true, 0, 0, color || '#fde047'); },
    // Подброс: враг взлетает и беспомощен, пока не упадёт (боссы — ниже и короче)
    knockUp(en, dur, h) {
        if (en.deadTimer > 0) return;
        const k = en.isBoss ? 0.4 : 1;
        en.knockUp = { t: 0, dur: dur * (en.isBoss ? 0.6 : 1), h: h * k };
        en.stunTimer = Math.max(en.stunTimer || 0, en.knockUp.dur + 0.15);
    },
    // Удар по земле: урон и подброс в радиусе
    slamAt(x, y, r, dmg, lift, big) {
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const d = Math.hypot(en.x - x, en.y - y);
            if (d < r + en.radius) { this.hit(en, dmg); this.knockUp(en, 0.55 + lift * 0.35, 0.6 + lift * 0.9); }
        });
        if (typeof Frank3D !== 'undefined') Frank3D.slam(x, y, r, big);
        if (typeof Feel !== 'undefined') Feel.shake(Math.cos(player.facingAngle), Math.sin(player.facingAngle), 0.08 + r / 1400, 14, 6);
        triggerScreenShake(3 + r / 40);
        SoundFX.play('hit');
    },
    addMadness(v) {
        if (!this.isBerserker() || player.frankFrenzy) return;
        player.madness = Math.min(100, (player.madness || 0) + v);
        player.madnessCalm = 2.5;   // сразу после навыка шкала не спадает
        if (player.madness >= 100) player.madPending = true;   // срыв — как только навык доиграет (см. updateMadness)
    },
    goMad() {
        player.madPending = false; player.madness = 100;
        player.frankFrenzy = { t: 0, dur: 4.5, ang: Math.random() * Math.PI * 2, turn: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5), turnT: 1, stagger: 0 };
        player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
        this.warn();
        SoundFX.play('thunder'); triggerScreenShake(5);
        recalcPlayerStats();
    },
    // Компактное предупреждение у шкалы безумия (не на весь экран)
    warn() {
        let el = document.getElementById('madnessWarn');
        if (!el) { el = document.createElement('div'); el.id = 'madnessWarn'; el.className = 'madness-warn'; document.body.appendChild(el); }
        el.innerHTML = '<b>⚡ Безумие!</b> Франкенштейн потеряла контроль: носится кругами и бьётся о препятствия';
        el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
        clearTimeout(this.warnT); this.warnT = setTimeout(() => el.classList.remove('show'), 3600);
    },
    // Базовая атака: тяжёлые взмахи булавой (удар приходится чуть позже замаха)
    attack() {
        const step = player.comboStep = ((player.comboTimer > 0 ? player.comboStep || 0 : 0) % 2) + 1; player.comboTimer = 1.6;
        player.basicAttackCd = player.attackInterval * (step === 2 ? 1.15 : 1);
        player.slashAnimTime = 0.3;
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        (player.frankPending = player.frankPending || []).push({ t: 0.2, ang, dmg: player.handDmg * (step === 2 ? 1.3 : 1) });
        SoundFX.play('whoosh');
    },
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), A = this.amp();
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); player.facingAngle = ang;
        player.frankSlams = player.frankSlams || [];
        if (key === 'q') {
            player.frankSlams.push({ t: 0.35, max: 0.35, x: player.x + Math.cos(ang) * 30, y: player.y + Math.sin(ang) * 30, r: 80, dmg: (70 + 32 * lvl) * A, lift: 1 });
            player.knightAnim = { kind: 'slam', t: 0.7 };
            player.frankLock = 0.45;
            this.cd('q', FRANK_SKILLS.q.baseCd - lvl * 0.3);
        } else if (key === 'w') {
            const range = 320 + 20 * lvl, d = Math.min(range, Math.max(120, Math.hypot(mouseWorldX - player.x, mouseWorldY - player.y)));
            player.frankMace = { x: player.x, y: player.y, sx: player.x, sy: player.y, ang, dist: d, travel: 0, phase: 'fly', t: 0, hit: new Set(),
                dmg: (55 + 25 * lvl) * A, land: (40 + 20 * lvl) * A, spin: 0 };
            player.knightAnim = { kind: 'throw', t: 0.5 };
            this.cd('w', FRANK_SKILLS.w.baseCd - lvl * 0.4); SoundFX.play('whoosh');
        } else if (key === 'e') {
            const base = (60 + 25 * lvl) * A;
            [[0.35, 75, 1, 1], [0.95, 150, 1.3, 1.4], [1.6, 300, 2, 2]].forEach(([t, r, m, lift], i) => player.frankSlams.push({ t, max: 0.35, x: null, y: null, r, dmg: base * m, lift, big: i === 2, anim: i }));
            player.frankLock = 1.8;
            player.knightAnim = { kind: 'slam', t: 0.6 };
            this.cd('e', FRANK_SKILLS.e.baseCd - lvl * 0.5);
        } else if (key === 'r') {
            player.frankUlt = { t: 0, dur: 3.0, tick: 0.35, R: 420, dmg: (100 + 50 * lvl) * A, fin: (180 + 80 * lvl) * A, done: false };
            player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            if (typeof Frank3D !== 'undefined') Frank3D.growTree(player.x, player.y, 420);
            this.cd('r', FRANK_SKILLS.r.baseCd - lvl * 5); SoundFX.play('thunder'); SoundFX.play('sunstrike');
            spawnFloatingText(player.x, player.y - 56, '⚡ ГРОЗОВОЕ ДРЕВО', '#fde047');
            if (typeof AnimFX !== 'undefined') AnimFX.kick(1);
        }
        this.addMadness(FRANK_MADNESS[key]);
        updateInvokerBarUI();
    },
    update(dt) {
        if (player.heroType !== 'frankenstein') return;
        if (player.comboTimer > 0) player.comboTimer -= dt;
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        if (player.frankLock > 0) player.frankLock -= dt;
        // Отложенные удары базовой атаки: дуга перед героиней
        const PD = player.frankPending;
        if (PD) for (let i = PD.length - 1; i >= 0; i--) {
            const p = PD[i]; p.t -= dt; if (p.t > 0) continue;
            let any = false;
            enemies.forEach(en => {
                if (en.deadTimer > 0) return;
                const dx = en.x - player.x, dy = en.y - player.y, d = Math.hypot(dx, dy);
                let da = Math.atan2(dy, dx) - p.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                if (d < player.attackRange + en.radius && Math.abs(da) < 1.1) {
                    const crit = Math.random() * 100 < player.critChance;
                    damageEnemy(en, Math.round(p.dmg * (crit ? player.critMult : 1)), false, dx, dy, null, { crit }); any = true;
                }
            });
            if (any && typeof Frank3D !== 'undefined') Frank3D.spark(player.x + Math.cos(p.ang) * 50, player.y + Math.sin(p.ang) * 50);
            PD.splice(i, 1);
        }
        // Удары по земле с задержкой (Q и E)
        const S = player.frankSlams;
        if (S) for (let i = S.length - 1; i >= 0; i--) {
            const s = S[i]; s.t -= dt;
            if (s.x === null && s.t < s.max) { s.x = player.x; s.y = player.y; if (s.anim !== undefined) player.knightAnim = { kind: s.anim === 1 ? 'slam2' : 'slam', t: 0.55 }; }
            if (s.t > 0) continue;
            this.slamAt(s.x, s.y, s.r, s.dmg, s.lift, s.big);
            S.splice(i, 1);
        }
        // Подброшенные враги
        enemies.forEach(en => { const k = en.knockUp; if (k) { k.t += dt; if (k.t >= k.dur) { en.knockUp = null; if (typeof Frank3D !== 'undefined' && en.deadTimer <= 0) Frank3D.land(en); } } });
        // Брошенная булава
        const M = player.frankMace;
        if (M) {
            M.t += dt; M.spin += dt * 18;
            if (M.phase === 'fly') {
                const sp = 950 * dt, nx = M.x + Math.cos(M.ang) * sp, ny = M.y + Math.sin(M.ang) * sp;
                const blocked = isTileBlocked(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE));
                if (!blocked) { M.x = nx; M.y = ny; M.travel += sp; }
                enemies.forEach(en => { if (en.deadTimer > 0 || M.hit.has(en)) return; if (Math.hypot(en.x - M.x, en.y - M.y) < 34 + en.radius) { M.hit.add(en); this.hit(en, M.dmg); en.stunTimer = Math.max(en.stunTimer || 0, 0.4); } });
                if (blocked || M.travel >= M.dist) { M.phase = 'stuck'; M.t = 0; if (typeof Frank3D !== 'undefined') Frank3D.slam(M.x, M.y, 50, false); SoundFX.play('hit'); triggerScreenShake(3); }
            } else if (M.phase === 'stuck') {
                if (M.t > 0.18) { M.phase = 'pull'; M.t = 0; player.knightAnim = { kind: 'pull', t: 0.5 }; SoundFX.play('whoosh'); }
            } else if (M.phase === 'pull') {
                const dx = M.x - player.x, dy = M.y - player.y, d = Math.hypot(dx, dy), sp = Math.min(d, 1150 * dt);
                player.invulnTime = Math.max(player.invulnTime, 0.1);
                const bx = player.x, by = player.y;
                if (d > 1) tryMoveEntity(player, dx / d * sp, dy / d * sp);
                player.facingAngle = Math.atan2(dy, dx);
                const stuck = Math.hypot(player.x - bx, player.y - by) < sp * 0.3 && d > 24;
                if (d < 24 || stuck || M.t > 0.7) {
                    this.slamAt(player.x, player.y, 85, M.land, 0.8, false);
                    player.frankMace = null; player.knightAnim = { kind: 'slam', t: 0.4 };
                }
            }
        }
        // Грозовое Древо
        const U = player.frankUlt;
        if (U) {
            U.t += dt; U.tick -= dt;
            if (U.tick <= 0 && U.t < U.dur - 0.3) {
                U.tick = 0.2;
                const foes = enemies.filter(en => en.deadTimer <= 0 && Math.hypot(en.x - player.x, en.y - player.y) < U.R + en.radius).sort(() => Math.random() - 0.5).slice(0, 3);
                foes.forEach(en => { this.hit(en, U.dmg, '#fef08a'); en.stunTimer = Math.max(en.stunTimer || 0, 0.35); if (typeof Frank3D !== 'undefined') Frank3D.strike(en.x, en.y); });
                if (!foes.length && typeof Frank3D !== 'undefined') { const a = Math.random() * Math.PI * 2, r = Math.random() * U.R; Frank3D.strike(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r); }
                if (Math.random() < 0.5) SoundFX.play('thunder');
            }
            if (!U.done && U.t >= U.dur - 0.3) {
                U.done = true;
                enemies.forEach(en => { if (en.deadTimer > 0) return; if (Math.hypot(en.x - player.x, en.y - player.y) < U.R + en.radius) { this.hit(en, U.fin, '#fef08a'); this.knockUp(en, 0.8, 1.6); } });
                if (typeof Frank3D !== 'undefined') Frank3D.thunderclap(player.x, player.y, U.R);
                if (typeof AnimFX !== 'undefined') AnimFX.kick(1.4);
                SoundFX.play('sunstrike');
            }
            if (U.t >= U.dur) { player.frankUlt = null; if (typeof Frank3D !== 'undefined') Frank3D.tree = null; }
        }
        this.updateMadness(dt);
    },
    // Шкала безумия и само безумие
    updateMadness(dt) {
        if (!this.isBerserker()) { player.madness = 0; player.frankFrenzy = null; return; }
        const F = player.frankFrenzy;
        // Шкала переполнена: срыв, как только закончится текущий навык
        if (!F && player.madPending && !player.frankUlt && !(player.frankLock > 0) && !player.frankMace && !(player.frankSlams && player.frankSlams.length)) { this.goMad(); return; }
        if (!F) {
            if (player.madPending) return;
            if (player.madnessCalm > 0) player.madnessCalm -= dt;
            else player.madness = Math.max(0, (player.madness || 0) - dt * 1.6);   // очень медленно: ~60 секунд с полной шкалы
            return;
        }
        F.t += dt;
        if (F.stagger > 0) { F.stagger -= dt; }
        else {
            // Носится: то по кругу, то зигзагами — поворот меняется случайно
            F.turnT -= dt;
            if (F.turnT <= 0) { F.turnT = 0.6 + Math.random() * 1.2; F.turn = Math.random() < 0.35 ? (Math.random() - 0.5) * 1.2 : (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2); }
            F.ang += F.turn * dt;
            const sp = player.moveSpeed * dt, cx = Math.cos(F.ang), cy = Math.sin(F.ang), bx = player.x, by = player.y;
            tryMoveEntity(player, cx * sp, cy * sp);
            player.facingAngle = F.ang;
            const moved = Math.hypot(player.x - bx, player.y - by);
            // Врезалась в стену или врага: удар, отлёт назад, разворот
            const foe = enemies.find(en => en.deadTimer <= 0 && Math.hypot(en.x - player.x, en.y - player.y) < en.radius + 18);
            if (moved < sp * 0.4 || foe) {
                tryMoveEntity(player, -cx * 26, -cy * 26);
                F.ang += Math.PI + (Math.random() - 0.5) * 1.6; F.stagger = 0.28;
                if (foe) { this.hit(foe, player.handDmg * 0.8); this.knockUp(foe, 0.4, 0.5); }
                spawnFloatingText(player.x, player.y - 40, foe ? 'БАМ!' : 'БУМ!', '#fde047');
                if (typeof Feel !== 'undefined') { Feel.shake(-cx, -cy, 0.16, 18, 8); Feel.hitstop(0.04); }
                if (typeof Frank3D !== 'undefined') Frank3D.spark(player.x + cx * 20, player.y + cy * 20);
                SoundFX.play('hit');
            }
        }
        if (F.t >= F.dur) { player.frankFrenzy = null; player.madness = 40; recalcPlayerStats(); showToast('Франкенштейн пришла в себя', 'info'); }
    },
    damageMult() { return player.heroType === 'frankenstein' && player.frankUlt ? 0.7 : 1; },
    locked() { return player.heroType === 'frankenstein' && !!(player.frankFrenzy || player.frankUlt || player.frankLock > 0 || (player.frankMace && player.frankMace.phase === 'pull')); },
    reset() { player.madPending = false; player.frankUlt = null; player.frankFrenzy = null; player.frankMace = null; player.frankSlams = null; player.frankPending = null; player.frankLock = 0; player.madness = 0; },

    // ---------- панель навыков ----------
    buildBar() {
        if (document.getElementById('frankActionBar')) return;
        const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill'); if (!ref || !pillRef) return;
        const bar = document.createElement('div');
        bar.id = 'frankActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2';
        let html = '';
        [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R']].forEach(([k, K]) => {
            const sk = FRANK_SKILLS[k], ult = k === 'r';
            html += `<div class="flex flex-col items-center relative z-20">
                <button id="btnFrankLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>
                <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                    <span class="hotkey-badge">${K}</span>
                    <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                    <span class="text-[9px] font-rpg font-bold text-yellow-200 mt-0.5">${sk.manaCost} MP</span>
                    <div id="cdFrank${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
                </button>
                <span class="text-[9px] font-rpg ${ult ? 'font-bold text-yellow-200' : 'text-yellow-100'} mt-1">${sk.ruName.split(' ')[0]}</span>
                <div id="pipsFrank${K}" class="level-pips"></div>
            </div>`;
        });
        html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>` + [['hp', '1', '🧪', 'hudFrankHp', 'Кровь'], ['mp', '2', '🔮', 'hudFrankMp', 'Мана']].map(([kind, hk, ic, id, lbl]) => `
            <div class="flex flex-col items-center relative z-20">
                <button onclick="useQuickPotion('${kind}')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                    <span class="hotkey-badge">${hk}</span><span class="text-lg sm:text-xl">${ic}</span><span id="${id}" class="text-[10px] font-bold">x0</span>
                </button><span class="text-[9px] text-stone-500 mt-1">${lbl}</span>
            </div>`).join('');
        bar.innerHTML = html; ref.insertAdjacentElement('afterend', bar);
        const pill = document.createElement('div');
        pill.id = 'frankTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 shadow-2xl';
        pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider relative z-20" style="color:#fde047">Франкенштейн:</span><span id="frankHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
        pillRef.insertAdjacentElement('afterend', pill);
    },
    refreshBar() {
        const el = document.getElementById('frankHint');
        if (el) el.textContent = player.frankFrenzy ? '⚡ БЕЗУМИЕ — контроль потерян!' : `Безумие ${Math.round(player.madness || 0)}%${(player.madness || 0) >= 70 ? ' — близко к срыву!' : ''}`;
        const cnt = id => ((player.inventory.find(i => i.id === id) || {}).count || 0);
        const a = document.getElementById('hudFrankHp'), b = document.getElementById('hudFrankMp'); if (a) a.textContent = 'x' + cnt('hp_pot'); if (b) b.textContent = 'x' + cnt('mp_pot');
    }
};

// ============================================================================
// 3D-ЭФФЕКТЫ ФРАНКЕНШТЕЙН: удары по земле, брошенная булава, жёлтые молнии и Грозовое Древо
// ============================================================================
const Frank3D = {
    Y: [0xfff7b0, 0xfde047, 0xfacc15, 0xffffff],
    T: 48,
    bolts: [],
    tree: null,
    pos(x, y) { const X = x / this.T, Z = y / this.T; return { x: X, y: World3D.hAt(X, Z), z: Z }; },
    // Пул отрезков молний: тонкие светящиеся цилиндры (ядро + ореол), без новых объектов каждый кадр
    // Пулы по цветам: 'y' — жёлтые молнии Франкенштейн, 'v' — фиолетовые разряды магии Медеи
    init() {
        if (this.pools) return;
        this.geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
        this.group = new THREE.Group(); Engine3D.scene.add(this.group); this.pools = {};
        this.makePool('y', 0xfffbe0, 0xffc81a, 640); this.makePool('v', 0xf8eeff, 0x9a4aff, 260);
        this.up = new THREE.Vector3(0, 1, 0); this.v = new THREE.Vector3(); this.q = new THREE.Quaternion();
        this.maceObj = this.buildMace(); this.maceObj.visible = false; Engine3D.scene.add(this.maceObj);
    },
    makePool(key, coreC, glowC, n) {
        const core = new THREE.MeshBasicMaterial({ color: coreC, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const glow = new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const list = [];
        for (let i = 0; i < n; i++) { const c = new THREE.Mesh(this.geo, core), g = new THREE.Mesh(this.geo, glow); c.visible = g.visible = false; c.frustumCulled = g.frustumCulled = false; this.group.add(c); this.group.add(g); list.push([c, g]); }
        this.pools[key] = { list, n: 0, last: 0 };
    },
    // Булава для броска: рукоять и шипастое навершие
    buildMace() {
        const g = new THREE.Group(), steel = G3.mat(0x5a5e68, { metalness: 0.8, roughness: 0.35 }), dark = G3.mat(0x2a2a30, { metalness: 0.6 });
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 8), dark); h.position.y = -0.4; g.add(h);
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), steel); head.position.y = 0.35; g.add(head);
        for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), steel); const a = i * 2.4, b = Math.acos(1 - 2 * (i + 0.5) / 10); s.position.set(Math.sin(b) * Math.cos(a) * 0.32, 0.35 + Math.cos(b) * 0.32, Math.sin(b) * Math.sin(a) * 0.32); s.lookAt(0, 0.35, 0); s.rotateX(-Math.PI / 2); g.add(s); }
        const gl = Models3D.glow(0xfde047, 1.2); gl.position.y = 0.35; g.add(gl);
        g.scale.setScalar(1.3); return g;
    },
    // Ломаная молния между двумя точками (в тайлах); jag — сила изломов
    zig(a, b, jag = 0.18, n) {
        const d = a.distanceTo(b); n = n || Math.max(4, Math.min(14, Math.round(d * 3)));
        const pts = [a.clone()], dir = b.clone().sub(a);
        for (let i = 1; i < n; i++) { const k = i / n, p = a.clone().addScaledVector(dir, k), e = Math.sin(k * Math.PI) * d * jag; p.x += (Math.random() - 0.5) * e; p.y += (Math.random() - 0.5) * e * 0.7; p.z += (Math.random() - 0.5) * e; pts.push(p); }
        pts.push(b.clone()); return pts;
    },
    bolt(a, b, life = 0.22, w = 0.035, branches = 2, pal = 'y') {
        this.init();
        const bl = { a, b, life, max: life, w, pal, pts: this.zig(a, b), kids: [], re: 0 };
        for (let i = 0; i < branches; i++) { const k = 0.3 + Math.random() * 0.5, p = bl.pts[Math.floor(k * (bl.pts.length - 1))], end = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, -Math.random() * 1.2, (Math.random() - 0.5) * 1.6)); bl.kids.push(this.zig(p, end, 0.3, 4)); }
        this.bolts.push(bl);
    },
    // Разряд в цель: с неба или с ветви Древа
    strike(x, y) {
        this.init();
        const p = this.pos(x, y), to = new THREE.Vector3(p.x, p.y + 0.3, p.z);
        let from;
        if (this.tree && this.tree.tips.length) { const t = this.tree.tips[Math.floor(Math.random() * this.tree.tips.length)]; from = t.clone(); }
        else from = new THREE.Vector3(p.x + (Math.random() - 0.5), p.y + 7, p.z + (Math.random() - 0.5));
        this.bolt(from, to, 0.24, 0.05, 3);
        AnimFX.impact(p.x, p.z, 0xfde047, 0.9, { dust: 0x3a3420 });
        AnimFX.emit({ x: p.x, y: p.y + 0.4, z: p.z, n: 22, color: this.Y, speed: 3.5, up: 2.5, life: 0.4, size: 0.05, grav: 6 });
        AnimFX.flash(p.x, p.z, 0xfde047, 5, 0.25, 1.5);
    },
    // Грозовое Древо: ствол из молний над героиней, ветви расходятся и спускаются к земле
    growTree(x, y, R) {
        this.init();
        const p = this.pos(x, y), base = new THREE.Vector3(p.x, p.y, p.z), top = new THREE.Vector3(p.x, p.y + 4.6, p.z);
        const lines = [], tips = [], reach = R / this.T;
        const trunk = [base, new THREE.Vector3(p.x, p.y + 2.2, p.z), top];
        lines.push({ pts: trunk, w: 0.09 });
        const branch = (from, ang, len, drop, depth, w) => {
            const to = new THREE.Vector3(from.x + Math.cos(ang) * len, Math.max(p.y + 0.2, from.y - drop), from.z + Math.sin(ang) * len);
            lines.push({ pts: [from, to], w }); tips.push(to);
            if (depth > 0) for (let i = 0; i < 2; i++) branch(to, ang + (Math.random() - 0.5) * 1.3, len * 0.62, drop * 0.8, depth - 1, w * 0.62);
        };
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.random() * 0.3; branch(new THREE.Vector3(p.x, p.y + 3.2 + Math.random() * 1.2, p.z), a, reach * 0.28, 1.0, 2, 0.06); }
        // Корни: молнии ползут по земле от ствола
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, to = new THREE.Vector3(p.x + Math.cos(a) * reach * 0.45, p.y + 0.05, p.z + Math.sin(a) * reach * 0.45); lines.push({ pts: [base.clone().add(new THREE.Vector3(0, 0.05, 0)), to], w: 0.04, ground: true }); }
        this.tree = { lines: lines.map(l => ({ src: l.pts, w: l.w, ground: l.ground, pts: null })), tips, t: 0, re: 0, R: reach, x: p.x, y: p.y, z: p.z };
        AnimFX.shock(p.x, p.y + 0.05, p.z, 0xfde047, 0.3, reach, 0.9);
        AnimFX.flash(p.x, p.z, 0xfde047, 9, 0.8, 4);
    },
    thunderclap(x, y, R) {
        const p = this.pos(x, y), r = R / this.T;
        AnimFX.shock(p.x, p.y + 0.06, p.z, 0xfde047, 0.4, r, 0.7); AnimFX.shock(p.x, p.y + 0.06, p.z, 0xffffff, 0.2, r * 0.7, 0.5, 0.8);
        AnimFX.flash(p.x, p.z, 0xfff3a0, 12, 0.6, 5);
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, q = new THREE.Vector3(p.x + Math.cos(a) * r * 0.8, p.y + 0.2, p.z + Math.sin(a) * r * 0.8); this.bolt(new THREE.Vector3(p.x, p.y + 4.6, p.z), q, 0.35, 0.06, 2); }
        AnimFX.emit({ x: p.x, y: p.y + 2, z: p.z, n: 160, color: this.Y, speed: 7, up: 2, life: 0.8, size: 0.07, grav: 3, drag: 1 });
    },
    // Удар булавы по земле: волна, трещины, пыль, искры; big — огромный третий удар
    slam(x, y, r, big) {
        const p = this.pos(x, y), R = r / this.T;
        AnimFX.impact(p.x, p.z, 0xfacc15, Math.max(0.8, R * 0.8), { dust: 0x4a4030 });
        AnimFX.shock(p.x, p.y + 0.05, p.z, 0xfde047, 0.2, R, 0.45);
        AnimFX.shock(p.x, p.y + 0.04, p.z, 0x6a5a40, 0.1, R * 0.9, 0.7, 0.6);
        AnimFX.emit({ x: p.x, y: p.y + 0.2, z: p.z, n: Math.min(90, 20 + r / 3), color: [0x5a4a38, 0x7a6a50, 0x3a3020], speed: 2 + R, up: 3, life: 0.9, size: 0.1, grav: 9, r: R * 0.5 });
        AnimFX.emit({ x: p.x, y: p.y + 0.3, z: p.z, n: 26, color: this.Y, speed: 4, up: 3, life: 0.35, size: 0.045, grav: 8 });
        if (big) { this.init(); for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, q = new THREE.Vector3(p.x + Math.cos(a) * R, p.y + 0.1, p.z + Math.sin(a) * R); this.bolt(new THREE.Vector3(p.x, p.y + 0.3, p.z), q, 0.3, 0.04, 1); } AnimFX.kick(0.9); }
        Sfx3D.play('impact', big ? 1 : 0.8);
    },
    spark(x, y) { const p = this.pos(x, y); AnimFX.emit({ x: p.x, y: p.y + 0.7, z: p.z, n: 14, color: this.Y, speed: 3, up: 1, life: 0.25, size: 0.04, grav: 5 }); },
    land(en) { const p = this.pos(en.x, en.y); AnimFX.emit({ x: p.x, y: p.y + 0.1, z: p.z, n: 10, color: [0x5a4a38, 0x7a6a50], speed: 1.2, up: 0.8, life: 0.5, size: 0.12, grav: 4 }); },
    // Зоны ударов с задержкой (вызывается из прохода FX3D, до уборки объектов)
    fxRunes() {
        const S = player.frankSlams; if (!S || player.heroType !== 'frankenstein') return;
        for (const s of S) {
            const x = s.x === null ? player.x : s.x, y = s.x === null ? player.y : s.y, p = this.pos(x, y);
            FX3D.runeAt(s, 0xfacc15, p.x, p.z, s.r / this.T, 1 - Math.max(0, Math.min(s.max, s.t)) / s.max, { crack: 1, spin: 0.6, op: s.t > s.max ? 0.35 : 1 });
        }
    },
    update(dt) {
        if (!this.pools && player.heroType !== 'frankenstein' && player.heroType !== 'medea' && player.heroType !== 'gilgamesh' && player.heroType !== 'atalanta' && player.heroType !== 'astolfo') return;
        this.init();
        const t = Engine3D.t, hp = this.pos(player.x, player.y);
        for (const k in this.pools) this.pools[k].n = 0;
        const draw = (pts, w, pal = 'y') => {
            const P = this.pools[pal];
            for (let i = 0; i < pts.length - 1 && P.n < P.list.length; i++) {
                const a = pts[i], b = pts[i + 1], [c, g] = P.list[P.n++];
                const len = a.distanceTo(b); if (len < 1e-3) { c.visible = g.visible = false; continue; }
                this.v.subVectors(b, a).normalize(); this.q.setFromUnitVectors(this.up, this.v);
                for (const [m, k] of [[c, 1], [g, 3.2]]) { m.visible = true; m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.copy(this.q); m.scale.set(w * k, len, w * k); }
            }
        };
        // Короткие разряды (мерцают — изломы перестраиваются)
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i]; b.life -= dt; if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
            b.re -= dt; if (b.re <= 0) { b.re = 0.05; b.pts = this.zig(b.a, b.b); }
            const k = b.life / b.max; draw(b.pts, b.w * (0.4 + k), b.pal); b.kids.forEach(kd => draw(kd, b.w * 0.5 * k, b.pal));
        }
        // Грозовое Древо: живое, ветви трещат и перестраиваются
        const T = this.tree;
        if (T) {
            T.t += dt; T.re -= dt;
            const grow = Math.min(1, T.t / 0.45);
            if (T.re <= 0) { T.re = 0.06; T.lines.forEach(l => { const a = l.src[0], b = l.src[l.src.length - 1], end = a.clone().lerp(b, grow); l.pts = l.src.length > 2 ? l.src.map((q, i) => i ? q.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15)) : q) : this.zig(a, end, l.ground ? 0.12 : 0.22, l.ground ? 8 : 6); }); }
            T.lines.forEach(l => { if (l.pts) draw(l.pts, l.w * (0.8 + Math.sin(t * 30 + l.w * 99) * 0.25)); });
            if (Math.random() < 0.6) { const tip = T.tips[Math.floor(Math.random() * T.tips.length)]; AnimFX.emit({ x: tip.x, y: tip.y, z: tip.z, n: 2, color: this.Y, speed: 1.5, life: 0.3, size: 0.05, grav: 2 }); }
            AnimFX.flash(T.x, T.z, 0xfde047, 3 + Math.random() * 3, 0.08, 3);
            Engine3D.scene.fog.color.lerp(new THREE.Color(0x2a2a10), 0.2); Engine3D.scene.background.copy(Engine3D.scene.fog.color);
        }
        for (const k in this.pools) { const P = this.pools[k]; for (let i = P.n; i < P.last; i++) { const [c, g] = P.list[i]; c.visible = g.visible = false; } P.last = P.n; }
        this.lastN = this.pools.y.n;
        // Брошенная булава: летит, вращаясь, со шлейфом и цепью молний к героине
        const M = player.heroType === 'frankenstein' && player.frankMace;
        this.maceObj.visible = !!M;
        if (M) {
            const p = this.pos(M.x, M.y), h = M.phase === 'fly' ? 1.0 : 0.55;
            this.maceObj.position.set(p.x, p.y + h, p.z);
            this.maceObj.rotation.set(M.phase === 'fly' ? M.spin : 2.2, -M.ang + Math.PI / 2, 0);
            if (M.phase === 'fly') AnimFX.trail(M, this.maceObj.position.clone().add(new THREE.Vector3(0, 0.4, 0)), this.maceObj.position.clone().add(new THREE.Vector3(0, -0.3, 0)), 0xfde047, { always: true, life: 0.12, len: 8, core: 0.6 });
            if (Math.random() < 0.5) this.bolt(new THREE.Vector3(hp.x, hp.y + 1, hp.z), new THREE.Vector3(p.x, p.y + h, p.z), 0.06, 0.02, 0);
        }
        // Безумие: жёлтые искры по телу, при срыве — разряды вокруг
        if (player.heroType === 'frankenstein') {
            const mad = (player.madness || 0) / 100;
            if (Math.random() < mad * 0.5 || player.frankFrenzy) AnimFX.emit({ x: hp.x + (Math.random() - 0.5) * 0.5, y: hp.y + 0.6 + Math.random() * 0.8, z: hp.z + (Math.random() - 0.5) * 0.5, n: 1, color: this.Y, speed: 1, life: 0.25, size: 0.04, grav: 0 });
            if (player.frankFrenzy && Math.random() < 0.25) { const a = Math.random() * Math.PI * 2; this.bolt(new THREE.Vector3(hp.x, hp.y + 1.1, hp.z), new THREE.Vector3(hp.x + Math.cos(a) * 1.2, hp.y + 0.2, hp.z + Math.sin(a) * 1.2), 0.1, 0.025, 0); }
        }
    }
};
