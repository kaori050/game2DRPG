// ============================================================================
// ПАВШИЙ РЫЦАРЬ (класс «Воин»): магия крови, навыки за здоровье, трофейные мечи с прочностью, когти
// ============================================================================
// • Маны нет: навыки тратят % ТЕКУЩЕГО здоровья и никогда не убивают (остаётся минимум 1 HP).
// • Здоровье за уровень растёт на 25% быстрее, чем у других героев.
// • Регенерация растёт по мере ранения: при критически низком HP — до 10 HP/с за каждый уровень.
// • Сражается мечом, снятым с убитого врага-мечника. Клинок быстро ломается → рукопашная: удары когтями.

// Трофейные клинки: внешний вид совпадает с оружием владельца (см. models.js), dmg — множитель урона, dur — прочность (число попаданий)
const KNIGHT_SWORDS = {
    goblin:              { name: 'Зазубренный нож гоблина', blade: 0x8a8f96, hilt: 0x5a3a20, len: 0.36, dmg: 0.95, dur: 16 },
    bandit:              { name: 'Тесак разбойника', blade: 0x9a9ea6, hilt: 0x4a3020, len: 0.42, dmg: 1.0, dur: 20 },
    skeleton:            { name: 'Ржавый гладий центуриона', blade: 0xa0a4ac, hilt: 0x5a3a20, len: 0.5, dmg: 1.1, dur: 22 },
    bone_walker:         { name: 'Костяной меч ходока', blade: 0xa0a4ac, hilt: 0x5a3a20, len: 0.5, dmg: 1.05, dur: 20 },
    crimson_knight:      { name: 'Меч Багрового Креста', blade: 0xc8ccd4, hilt: 0x8a6a2a, len: 0.62, dmg: 1.25, dur: 28 },
    blood_knight:        { name: 'Клинок Рыцаря Крови', blade: 0xc8ccd4, hilt: 0x8a6a2a, len: 0.62, dmg: 1.35, dur: 30 },
    ash_warden:          { name: 'Пепельный меч Игнара', blade: 0x8a8a8a, hilt: 0x3a3430, len: 0.7, dmg: 1.6, dur: 38 },
    crimson_warden:      { name: 'Клинок Сангвина', blade: 0xb01020, hilt: 0x1a1a1a, len: 0.8, dmg: 1.8, dur: 42 },
    saber_shadow:        { name: 'Тёмный Экскалибур Тени', blade: 0x1a0a10, hilt: 0x3a0a10, len: 0.72, dmg: 2.2, dur: 50 },
    dracula:             { name: 'Кровавый клинок Дракулы', blade: 0xb01020, hilt: 0xd4a020, len: 0.75, dmg: 2.4, dur: 55 },
    hell_lord:           { name: "Пылающий меч Ваал'Гора", blade: 0x3a0a04, hilt: 0x1a0a04, len: 1.0, dmg: 3.0, dur: 60 }
};

const KNIGHT_SKILLS = {
    q: { key: 'q', name: 'Blood Sacrifice', ruName: 'Жертвоприношение', icon: '🩸', manaCost: 0, hpPct: 25, baseCd: 12,
         desc: 'Рыцарь вонзает клинок в собственную грудь (−25% текущего здоровья) и истекает кровью, оставляя за собой кровавый след. Пока кровь льётся — атакует и бегает быстрее, а раны затягиваются быстрее.',
         stats: l => `Длительность ${(6 + l * 0.5).toFixed(1)}с • скорость атаки +${30 + l * 4}% • бег +${20 + l * 2}% • регенерация +${2 + l} HP/с` },
    w: { key: 'w', name: 'Blood Shield', ruName: 'Кровавый Щит', icon: '🛡️', manaCost: 0, hpPct: 0, baseCd: 20,
         desc: 'Запёкшаяся кровь превращается в доспех. Прочность щита тем больше, чем сильнее рыцарь уже изранен.',
         stats: l => `Щит = ${80 + l * 10}% потерянного здоровья + ${8} × уровень героя • держится 8с` },
    e: { key: 'e', name: 'Blood Dash', ruName: 'Кровавый Рывок', icon: '💨', manaCost: 0, hpPct: 15, baseCd: 4.5,
         desc: 'Цена — 15% текущего здоровья. Короткий и стремительный рывок к курсору, рассекающий всех на пути.',
         stats: l => `Дистанция ${150 + l * 10} • урон ${30 + l * 15} + 80% атаки` },
    d: { key: 'd', name: 'Flesh Feast', ruName: 'Кровавый Пир', icon: '🦷', manaCost: 0, hpPct: 0, baseCd: 14,
         desc: 'Рыцарь хватает рядового врага поблизости и пожирает его, мгновенно восстанавливая здоровье. Не действует на боссов, мини-боссов и элиту.',
         stats: () => 'Лечение: 55% макс. здоровья жертвы + 25% её текущего здоровья • дальность 90' },
    r: { key: 'r', name: 'Blood Lake', ruName: 'Озеро Крови', icon: '🌊', manaCost: 0, hpPct: 90, baseCd: 90,
         desc: 'Цена — 90% текущего здоровья. Пять секунд рыцарь разрывает себя изнутри, а затем всё вокруг заливает бурлящее озеро его крови: враги в нём горят и вязнут, а сам рыцарь крепнет.',
         stats: l => `Радиус ${300 + l * 30} • ${10 + l * 2}с • урон ${60 + l * 45} + 6 × уровень в секунду • внутри: +25% урона, −25% входящего урона, +2 HP/с × уровень` }
};

const Knight = {
    // ---------- характеристики (вызывается из recalcPlayerStats) ----------
    stats(L, q, w, e, r, eq) {
        const sw = player.knightSword, bleed = player.knightBleed > 0, lvlQ = player.orbLevels.q || 1;
        player.maxHp = Math.round(340 + L * 55 + e * 20 + eq.hp);     // 55 = 44 × 1.25: здоровье за уровень растёт на 25% быстрее
        player.maxMp = 0; player.mp = 0; player.mpRegen = 0;
        const base = 34 + L * 6.5 + q * 3 + eq.hand;
        player.handDmg = Math.round(sw ? base * sw.dmg : base * 0.8);
        player.spellAmp = Math.round(r * 5 + eq.amp);
        player.armor = Math.round(7 + L * 0.7 + e * 0.6 + eq.armor);
        player.moveSpeed = Math.round(186 * (bleed ? 1 + (20 + lvlQ * 2) / 100 : 1));
        player.cdrPct = Math.min(40, Math.round(w * 1.5 + eq.cdr));
        player.attackInterval = +((sw ? 0.62 : 0.42) / (bleed ? 1 + (30 + lvlQ * 4) / 100 : 1)).toFixed(2);
        player.attackRange = sw ? 72 + Math.round(((KNIGHT_SWORDS[sw.type] || {}).len || 0.5) * 30) : 46;
        player.critChance = 8 + eq.crit;
        player.critMult = 1.6;
        if (this.inLake()) player.handDmg = Math.round(player.handDmg * 1.25);
    },
    // Заплатить здоровьем: % от текущего HP, но не ниже 1
    pay(pct) {
        const cost = Math.floor(player.hp * pct);
        player.hp = Math.max(1, player.hp - cost);
        spawnFloatingText(player.x, player.y - 30, `-${cost} HP`, '#dc2626');
        if (typeof Knight3D !== 'undefined') Knight3D.bleedBurst(30);
        return cost;
    },
    cd(key, base) { const lvl = Math.max(1, player.orbLevels[key] || 1); player.saberCooldowns[key] = +(base * (1 - (player.cdrPct || 0) / 100)).toFixed(1); return lvl; },
    ready(key) { const c = player.saberCooldowns[key] || 0; if (c > 0) { showToast(`${KNIGHT_SKILLS[key].ruName} перезаряжается (${c.toFixed(1)} сек.)`, 'error'); return false; } return !player.controlLock; },
    inLake() { const L = player.bloodLake; return !!(L && Math.hypot(player.x - L.x, player.y - L.y) < L.r); },

    // ---------- навыки ----------
    cast(key) {
        if (!this.ready(key)) return;
        const lvl = Math.max(1, player.orbLevels[key] || 1), L = player.level;
        const ang = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
        if (key === 'q') {
            this.pay(0.25);
            player.knightBleed = 6 + lvl * 0.5; player.knightBleedLvl = lvl;
            player.knightAnim = { kind: 'selfStab', t: 0.5 };
            this.cd('q', KNIGHT_SKILLS.q.baseCd - lvl * 0.4);
            SoundFX.play('hit'); triggerScreenShake(3);
            for (let i = 0; i < 5; i++) addGroundDecal(player.x + (Math.random() - 0.5) * 30, player.y + (Math.random() - 0.5) * 30, 12 + Math.random() * 12, 'blood');
            spawnFloatingText(player.x, player.y - 44, '🩸 ЖЕРТВОПРИНОШЕНИЕ', '#ef4444');
            recalcPlayerStats();
        } else if (key === 'w') {
            const amount = Math.round((player.maxHp - player.hp) * (0.8 + lvl * 0.1) + L * 8);
            player.bloodShield = amount; player.bloodShieldMax = amount; player.bloodShieldT = 8;
            player.knightAnim = { kind: 'pray', t: 0.6 };
            this.cd('w', KNIGHT_SKILLS.w.baseCd);
            SoundFX.play('frost');
            spawnFloatingText(player.x, player.y - 44, `🛡️ КРОВАВЫЙ ЩИТ +${amount}`, '#fca5a5');
        } else if (key === 'e') {
            this.pay(0.15);
            const dist = 150 + lvl * 10, steps = 12, dmg = Math.round(30 + lvl * 15 + player.handDmg * 0.8), hit = new Set();
            player.facingAngle = ang; player.invulnTime = Math.max(player.invulnTime, 0.25);
            for (let i = 0; i < steps; i++) {
                tryMoveEntity(player, Math.cos(ang) * dist / steps, Math.sin(ang) * dist / steps);
                if (i % 3 === 0) addGroundDecal(player.x, player.y, 10 + Math.random() * 8, 'blood');
                enemies.forEach(en => { if (en.deadTimer > 0 || hit.has(en)) return; if (Math.hypot(en.x - player.x, en.y - player.y) < en.radius + 34) { hit.add(en); damageEnemy(en, dmg, false, Math.cos(ang) * 22, Math.sin(ang) * 22, '#ef4444'); } });
            }
            player.moveTargetX = null; player.moveTargetY = null;
            player.knightAnim = { kind: 'thrust', t: 0.3 };
            this.cd('e', KNIGHT_SKILLS.e.baseCd - lvl * 0.2);
            SoundFX.play('tornado'); triggerScreenShake(2);
        } else if (key === 'd') {
            let best = null, bd = 90;
            enemies.forEach(en => {
                if (en.deadTimer > 0 || en.isBoss || (en.tpl && en.tpl.miniBoss) || en.elite || en.rare) return;
                const d = Math.hypot(en.x - player.x, en.y - player.y) - en.radius; if (d < bd) { bd = d; best = en; }
            });
            if (!best) { showToast('Рядом нет рядовой жертвы (боссы, мини-боссы и элита не подходят)', 'error'); return; }
            const heal = Math.round(best.maxHp * 0.55 + best.hp * 0.25);
            player.facingAngle = Math.atan2(best.y - player.y, best.x - player.x);
            if (typeof Knight3D !== 'undefined') Knight3D.devour(best);
            damageEnemy(best, best.hp + 99999, false, 0, 0, '#7f1d1d');
            player.hp = Math.min(player.maxHp, player.hp + heal);
            player.knightAnim = { kind: 'grab', t: 0.7 };
            this.cd('d', KNIGHT_SKILLS.d.baseCd);
            SoundFX.play('hit'); triggerScreenShake(4);
            for (let i = 0; i < 6; i++) addGroundDecal(best.x + (Math.random() - 0.5) * 40, best.y + (Math.random() - 0.5) * 40, 14 + Math.random() * 16, 'blood');
            spawnFloatingText(player.x, player.y - 46, `🦷 +${heal} HP`, '#4ade80');
        } else if (key === 'r') {
            this.pay(0.9);
            player.knightRend = { t: 0, dur: 5, lvl };
            player.controlLock = true; player.moveTargetX = null; player.moveTargetY = null; player.attackTarget = null;
            this.cd('r', KNIGHT_SKILLS.r.baseCd - lvl * 8);
            SoundFX.play('invoke'); triggerScreenShake(4);
            spawnFloatingText(player.x, player.y - 50, '🌊 ОЗЕРО КРОВИ…', '#dc2626');
        }
        updateInvokerBarUI();
    },

    // ---------- атаки: трофейный меч или когти, цепочка из 4 ударов ----------
    attack() {
        const sw = player.knightSword, step = nextComboStep();
        const C = sw ? [null, { reach: 1.1, arc: 0.6, mult: 1, cd: 0.85 }, { reach: 0.95, arc: 1.3, mult: 1.1, cd: 0.95 }, { reach: 1.0, arc: Math.PI, mult: 1.3, cd: 1.1 }, { reach: 1.2, arc: 0.95, mult: 1.8, cd: 1.5 }][step]
                     : [null, { reach: 1, arc: 1.0, mult: 0.9, cd: 0.8 }, { reach: 1, arc: 1.0, mult: 0.9, cd: 0.8 }, { reach: 1.1, arc: 1.4, mult: 1.15, cd: 1 }, { reach: 1.25, arc: 1.6, mult: 1.6, cd: 1.35 }][step];
        player.basicAttackCd = player.attackInterval * C.cd;
        player.slashAnimTime = sw ? [0, 0.2, 0.24, 0.3, 0.36][step] : [0, 0.16, 0.16, 0.2, 0.28][step];
        SoundFX.play('bolt');
        let ax = mouseWorldX, ay = mouseWorldY; const tgt = player.attackTarget;
        if (tgt && tgt.deadTimer <= 0) { ax = tgt.x; ay = tgt.y; }
        const ang = Math.atan2(ay - player.y, ax - player.x); player.facingAngle = ang;
        const reach = player.attackRange * C.reach;
        if (step === 4) triggerScreenShake(sw ? 5 : 4);
        activeZones.push({ type: 'saber_slash_fx', x: player.x, y: player.y, ang, radius: reach, color: '#b91c1c', life: 0.18, maxLife: 0.18 });
        let hits = 0;
        enemies.forEach(en => {
            if (en.deadTimer > 0) return;
            const d = Math.hypot(en.x - player.x, en.y - player.y);
            if (d > reach + en.radius) return;
            if (d > 26 && Math.abs(angDiff(Math.atan2(en.y - player.y, en.x - player.x), ang)) > C.arc) return;
            const crit = Math.random() * 100 < player.critChance;
            damageEnemy(en, Math.round(player.handDmg * C.mult * (crit ? player.critMult : 1)), false, Math.cos(ang) * (step === 4 ? 40 : 16), Math.sin(ang) * (step === 4 ? 40 : 16), '#dc2626', { crit });
            if (Math.random() < 0.6) addGroundDecal(en.x + (Math.random() - 0.5) * 20, en.y + (Math.random() - 0.5) * 20, 8 + Math.random() * 10, 'blood');
            hits++;
        });
        // Клинок изнашивается с каждым попаданием
        if (sw && hits) { sw.dur = Math.max(0, sw.dur - hits); if (sw.dur <= 0) this.breakSword(); else if (sw.dur <= 5 && !sw.warned) { sw.warned = true; showToast(`⚠️ ${sw.name} вот-вот сломается!`, 'error'); } updateInvokerBarUI(); }
    },
    breakSword() {
        const sw = player.knightSword; if (!sw) return;
        player.knightSword = null;
        if (typeof Knight3D !== 'undefined') Knight3D.shatter(sw);
        SoundFX.play('thunder'); triggerScreenShake(4);
        spawnFloatingText(player.x, player.y - 46, '💥 КЛИНОК СЛОМАН — В ХОД ИДУТ КОГТИ', '#fca5a5');
        showToast(`${sw.name} разлетелся на куски. Рыцарь бьёт когтями — добудьте новый меч у врага-мечника!`, 'error');
        recalcPlayerStats(); updateInvokerBarUI();
    },
    // Убит враг-мечник → его клинок переходит к рыцарю (если он лучше или текущий почти сломан)
    onKill(en) {
        if (player.heroType !== 'knight') return;
        const d = KNIGHT_SWORDS[en.type]; if (!d) return;
        if (Math.hypot(en.x - player.x, en.y - player.y) > 520) return;
        const cur = player.knightSword, tier = en.isBoss ? 1.25 : (en.elite || en.rare ? 1.1 : 1);
        const cand = { type: en.type, name: (en.elite || en.rare ? 'Отличный ' : '') + d.name, dmg: +(d.dmg * tier).toFixed(2), dur: Math.round(d.dur * tier), max: Math.round(d.dur * tier) };
        if (cur && cur.dur / cur.max > 0.35 && cur.dmg >= cand.dmg) return;
        player.knightSword = cand;
        if (typeof Knight3D !== 'undefined') Knight3D.pickup(en);
        SoundFX.play('coin');
        spawnFloatingText(player.x, player.y - 50, `🗡️ ${cand.name}`, '#fca5a5');
        recalcPlayerStats(); updateInvokerBarUI();
    },
    // Щит поглощает урон до брони игрока
    absorb(dmg) {
        if (!player.bloodShield || player.bloodShield <= 0) return dmg;
        const a = Math.min(player.bloodShield, dmg);
        player.bloodShield -= a;
        if (player.bloodShield <= 0) { player.bloodShield = 0; spawnFloatingText(player.x, player.y - 36, '🛡️ щит разбит', '#fca5a5'); if (typeof Knight3D !== 'undefined') Knight3D.shieldBreak(); }
        return dmg - a;
    },

    // ---------- каждый кадр ----------
    update(dt) {
        if (player.heroType !== 'knight') return;
        const L = player.level, f = player.hp / Math.max(1, player.maxHp);
        // Кровавая регенерация: чем ниже здоровье, тем быстрее (до 10 HP/с за уровень на грани смерти)
        const low = Math.max(0, Math.min(1, (0.85 - f) / 0.7));
        const lake = this.inLake();
        player.hpRegen = +(2 + L * 0.6 + low * low * 10 * L + (player.knightBleed > 0 ? 2 + (player.knightBleedLvl || 1) : 0) + (lake ? 2 * L : 0)).toFixed(1);
        player.mp = 0;
        // Кровотечение: таймер и кровавый след при движении
        if (player.knightBleed > 0) {
            player.knightBleed -= dt;
            const moved = Math.hypot(player.x - (this.lx || player.x), player.y - (this.ly || player.y));
            this.trail = (this.trail || 0) + moved;
            if (this.trail > 16) { this.trail = 0; addGroundDecal(player.x + (Math.random() - 0.5) * 10, player.y + 10 + (Math.random() - 0.5) * 6, 7 + Math.random() * 7, 'blood'); }
            if (player.knightBleed <= 0) recalcPlayerStats();
        }
        this.lx = player.x; this.ly = player.y;
        if (player.bloodShieldT > 0) { player.bloodShieldT -= dt; if (player.bloodShieldT <= 0) player.bloodShield = 0; }
        if (player.knightAnim) { player.knightAnim.t -= dt; if (player.knightAnim.t <= 0) player.knightAnim = null; }
        // Ульта: 5 секунд разрыва, затем озеро крови
        const R = player.knightRend;
        if (R) {
            R.t += dt;
            player.invulnTime = Math.max(player.invulnTime, 0.1);
            if (Math.random() < 0.3) addGroundDecal(player.x + (Math.random() - 0.5) * 120, player.y + (Math.random() - 0.5) * 120, 10 + Math.random() * 20, 'blood');
            if (R.t >= R.dur) {
                player.knightRend = null; player.controlLock = false;
                const lvl = R.lvl;
                player.bloodLake = { x: player.x, y: player.y, r: 300 + lvl * 30, t: 0, dur: 10 + lvl * 2, dps: Math.round((60 + lvl * 45 + L * 6) * (1 + player.spellAmp / 100)), tick: 0 };
                triggerScreenShake(12); SoundFX.play('meteor');
                spawnFloatingText(player.x, player.y - 60, '🌊 ОЗЕРО КРОВИ!', '#ef4444');
                recalcPlayerStats();
            }
        }
        // Озеро крови: урон и замедление врагов каждые 0.5с
        const BL = player.bloodLake;
        if (BL) {
            BL.t += dt; BL.tick -= dt;
            if (BL.tick <= 0) {
                BL.tick = 0.5;
                enemies.forEach(en => {
                    if (en.deadTimer > 0 || Math.hypot(en.x - BL.x, en.y - BL.y) > BL.r + en.radius) return;
                    en.slowTimer = 0.6; en.slowMult = 0.55;
                    damageEnemy(en, Math.round(BL.dps * 0.5), true, 0, 0, '#b91c1c');
                });
            }
            if (BL.t >= BL.dur) { player.bloodLake = null; recalcPlayerStats(); }
        }
        if (lake !== this.wasLake) { this.wasLake = lake; recalcPlayerStats(); }
    }
};

// ---------- Панель навыков и верхняя плашка ----------
Knight.buildBar = function () {
    if (document.getElementById('knightActionBar')) return;
    const ref = document.getElementById('archerActionBar'), pillRef = document.getElementById('archerTopPill');
    if (!ref || !pillRef) return;
    const bar = document.createElement('div');
    bar.id = 'knightActionBar'; bar.className = 'hidden rpg-panel p-2.5 rounded-2xl items-end gap-2 sm:gap-3 border-2 border-red-800/80';
    let html = '';
    [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['d', 'D'], ['r', 'R']].forEach(([k, K]) => {
        const sk = KNIGHT_SKILLS[k], ult = k === 'r', lvlBtn = k !== 'd';
        html += `<div class="flex flex-col items-center relative z-20">
            ${lvlBtn ? `<button id="btnKnightLvl${K}" onclick="levelUpOrb('${k}')" class="hidden mb-1 w-full py-0.5 bg-gradient-to-b from-amber-400 to-amber-600 text-stone-950 font-extrabold rounded text-[10px]">+ УР</button>` : '<div class="mb-1 h-[18px]"></div>'}
            <button onclick="castHeroSkill('${k}')" class="relative ${ult ? 'w-14 h-14 sm:w-16 sm:h-16 rpg-btn-gold border-2 border-red-500' : 'w-13 h-13 sm:w-15 sm:h-15 saber-btn-skill'} rounded-xl flex flex-col items-center justify-center group" title="${sk.ruName}">
                <span class="hotkey-badge">${K}</span>
                <span class="text-xl sm:text-2xl group-hover:scale-110 transition-transform">${sk.icon}</span>
                <span class="text-[9px] font-rpg font-bold text-red-300 mt-0.5">${sk.hpPct ? sk.hpPct + '% HP' : 'кровь'}</span>
                <div id="cdKnight${K}" class="absolute inset-0 bg-black/85 rounded-xl hidden items-center justify-center text-xs font-bold text-amber-300"></div>
            </button>
            <span class="text-[9px] font-rpg ${ult ? 'font-bold text-red-300' : 'text-red-200'} mt-1">${sk.ruName.split(' ')[0]}</span>
            <div id="pipsKnight${K}" class="level-pips"></div>
        </div>`;
    });
    html += `<div class="h-12 w-[2px] bg-stone-800 mx-0.5 self-center relative z-20"></div>
        <div class="flex flex-col items-center relative z-20">
            <button onclick="useQuickPotion('hp')" class="relative w-11 h-12 sm:w-12 sm:h-14 rpg-btn rounded-xl flex flex-col items-center justify-center">
                <span class="hotkey-badge">1</span><span class="text-lg sm:text-xl">🧪</span><span id="hudKnightHp" class="text-[10px] font-bold text-rose-300">x0</span>
            </button><span class="text-[9px] text-stone-500 mt-1">Кровь</span>
        </div>`;
    bar.innerHTML = html;
    ref.insertAdjacentElement('afterend', bar);
    const pill = document.createElement('div');
    pill.id = 'knightTopPill'; pill.className = 'hidden rpg-panel px-4 py-1.5 rounded-full items-center gap-3 border border-red-800 shadow-2xl';
    pill.innerHTML = `<span class="text-[10px] font-rpg font-bold uppercase tracking-wider text-red-400 relative z-20">🩸 Павший Рыцарь:</span><span id="knightWeaponHint" class="text-[11px] font-rpg font-bold text-amber-300 relative z-20"></span>`;
    pillRef.insertAdjacentElement('afterend', pill);
};
Knight.refreshBar = function () {
    const sw = player.knightSword, el = document.getElementById('knightWeaponHint');
    if (el) el.textContent = sw ? `🗡️ ${sw.name} • прочность ${sw.dur}/${sw.max}` : '🩸 Когти — убейте врага-мечника, чтобы забрать его клинок';
    const hp = document.getElementById('hudKnightHp'); if (hp) hp.textContent = 'x' + ((player.inventory.find(i => i.id === 'hp_pot') || {}).count || 0);
};

// ============================================================================
// 3D-ЭФФЕКТЫ РЫЦАРЯ: озеро крови, кровавый щит, капли с клинка, кровотечение, пир, разлом клинка, ритуал ульты
// ============================================================================
const Knight3D = {
    T: 48,
    hero() { const x = player.x / this.T, z = player.y / this.T; return { x, y: World3D.hAt(x, z), z }; },
    chest() { const h = this.hero(); return { x: h.x, y: h.y + 0.8, z: h.z }; },
    init() {
        if (this.ready || typeof THREE === 'undefined' || !Engine3D.scene) return;
        const scene = this.scene = Engine3D.scene;
        // Озеро крови: тёмная глянцевая жидкость, бурлящая шумом, светящиеся прожилки, мягкий край
        this.lakeMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { t: { value: 0 }, op: { value: 0 }, noise: { value: Tex3D.T.fog }, c: { value: new THREE.Vector2() }, r: { value: 1 } },
            vertexShader: 'varying vec2 vUv; varying vec3 wp; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: `uniform float t, op, r; uniform sampler2D noise; uniform vec2 c; varying vec2 vUv; varying vec3 wp;
                void main(){
                    vec2 p = vUv * 2.0 - 1.0; float d = length(p); if (d > 1.0) discard;
                    vec2 q = wp.xz * 0.11;
                    float n1 = texture2D(noise, q + vec2(t * 0.03, t * 0.017)).r, n2 = texture2D(noise, q * 2.3 - vec2(t * 0.05, -t * 0.02)).r;
                    float boil = texture2D(noise, q * 5.0 + vec2(sin(t * 0.7), cos(t * 0.5)) * 0.2).r;
                    vec3 col = mix(vec3(0.07, 0.0, 0.005), vec3(0.42, 0.01, 0.03), smoothstep(0.25, 0.85, n1 * n2 * 1.8));
                    float vein = smoothstep(0.035, 0.0, abs(n2 - 0.52)) * (0.55 + 0.45 * sin(t * 3.0 + n1 * 12.0));
                    col += vec3(1.0, 0.08, 0.06) * vein * 0.9;
                    col += vec3(1.0, 0.55, 0.55) * pow(boil, 9.0) * 1.4;      // блики на пузырях
                    float rim = smoothstep(0.82, 1.0, d);
                    col = mix(col, vec3(0.16, 0.0, 0.01), rim * 0.6);
                    float a = op * smoothstep(1.0, 0.94, d) * (0.88 + 0.12 * n1);
                    gl_FragColor = vec4(col, a);
                }`
        });
        const lg = new THREE.CircleGeometry(1, 96); lg.rotateX(-Math.PI / 2);
        this.lake = new THREE.Mesh(lg, this.lakeMat); this.lake.renderOrder = 2; this.lake.visible = false; this.lake.frustumCulled = false; scene.add(this.lake);
        // Кровавый щит: сфера с френелем и текущими прожилками
        this.shieldMat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { t: { value: 0 }, op: { value: 0 }, noise: { value: Tex3D.T.fog } },
            vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
            fragmentShader: `uniform float t, op; uniform sampler2D noise; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
                void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float n = texture2D(noise, vUv * vec2(3.0, 2.0) + vec2(t * 0.1, -t * 0.25)).r;
                    float vein = smoothstep(0.04, 0.0, abs(n - 0.5)); vec3 c = vec3(0.9, 0.05, 0.08) * (f * 1.4 + vein * 0.6) + vec3(1.0, 0.4, 0.4) * pow(f, 6.0);
                    gl_FragColor = vec4(c * op, 1.0); }`
        });
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(0.85, 40, 28), this.shieldMat); this.shield.visible = false; scene.add(this.shield);
        this.ready = true;
    },
    // ---------- события из логики ----------
    bleedBurst(n) { if (!this.ready) return; const c = this.chest(); AnimFX.blood(c.x, c.y, c.z, n); AnimFX.shock(c.x, c.y - 0.75, c.z, 0x8a0010, 0.2, 1.4, 0.45); },
    devour(en) {
        if (!this.ready) return;
        const x = en.x / this.T, z = en.y / this.T, y = World3D.hAt(x, z) + 0.6, c = this.chest();
        AnimFX.blood(x, y, z, 120);
        AnimFX.emit({ gore: true, x, y, z, n: 60, color: [0x8a0008, 0x5a0005, 0xc8101a], speed: 1.5, life: 0.6, size: 0.09, grav: 0, drag: 2, pull: { x: c.x, y: c.y, z: c.z, k: 16 } });
        AnimFX.emit({ x, y, z, n: 40, color: [0xff2030, 0xff8080], speed: 1, life: 0.5, size: 0.07, grav: 0, pull: { x: c.x, y: c.y, z: c.z, k: 18 } });
        AnimFX.shock(x, y - 0.55, z, 0xb0101a, 0.2, 2.2, 0.6); AnimFX.flash(x, z, 0xff2020, 4, 0.5); AnimFX.kick(0.6); Sfx3D.play('death');
    },
    shatter(sw) {
        if (!this.ready) return;
        const c = this.chest();
        AnimFX.emit({ x: c.x, y: c.y + 0.2, z: c.z, n: 50, color: [0xb0b4bc, 0xe0e4ec, 0x8a8f96], speed: 4, up: 2, life: 0.8, size: 0.06, grav: 12, drag: 1 });
        AnimFX.blood(c.x, c.y + 0.2, c.z, 30); AnimFX.shock(c.x, c.y, c.z, 0xffffff, 0.1, 1.4, 0.3); AnimFX.kick(0.5); Sfx3D.play('seal');
    },
    pickup(en) {
        if (!this.ready) return;
        const x = en.x / this.T, z = en.y / this.T, y = World3D.hAt(x, z) + 0.7, c = this.chest();
        AnimFX.emit({ gore: true, x, y, z, n: 40, color: [0x8a0008, 0xc8101a], speed: 1, life: 0.7, size: 0.07, grav: 0, pull: { x: c.x + 0.3, y: c.y - 0.3, z: c.z, k: 12 } });
        AnimFX.shock(c.x, c.y - 0.75, c.z, 0xc8101a, 0.2, 1.2, 0.4); Sfx3D.play('stance');
    },
    shieldBreak() { if (!this.ready) return; const c = this.chest(); AnimFX.emit({ x: c.x, y: c.y, z: c.z, n: 80, color: [0xff2030, 0xff8080], speed: 3, life: 0.6, size: 0.06, grav: 4 }); AnimFX.shock(c.x, c.y, c.z, 0xff2030, 0.6, 2, 0.35); Sfx3D.play('seal'); },

    // Вызывается из FX3D.update (до уборки неиспользуемых объектов): руна будущего озера под рыцарем
    fxRunes() {
        const R = player.knightRend; if (!R) return;
        const h = this.hero();
        FX3D.runeAt(R, 0xc8101a, h.x, h.z, (300 + R.lvl * 30) / this.T, R.t / R.dur, { crack: 1, spin: 1.5, op: 0.9 });
    },
    update(dt) {
        this.init(); if (!this.ready) return;
        const t = Engine3D.t, knight = player.heroType === 'knight', h = this.hero();
        // Озеро крови
        const BL = player.bloodLake;
        if (BL) {
            const x = BL.x / this.T, z = BL.y / this.T, R = BL.r / this.T;
            const grow = 1 - Math.pow(1 - Math.min(1, BL.t / 0.7), 3), fade = Math.min(1, (BL.dur - BL.t) / 1.2);
            this.lake.visible = true; this.lake.position.set(x, World3D.hAt(x, z) + 0.04, z); this.lake.scale.setScalar(R * grow);
            this.lakeMat.uniforms.t.value = t; this.lakeMat.uniforms.op.value = Math.max(0, fade);
            if (!this.lakeOn) { // всплеск при появлении
                this.lakeOn = true; AnimFX.shock(x, h.y + 0.1, z, 0xc8101a, 0.5, R, 0.9); AnimFX.shock(x, h.y + 0.1, z, 0x5a0006, 0.3, R * 0.7, 1.2);
                AnimFX.blood(x, h.y + 0.8, z, 260); AnimFX.kick(2); Sfx3D.play('ult');
            }
            // Пузыри, всплески и алый туман над поверхностью
            for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R * grow; AnimFX.emit({ gore: true, x: x + Math.cos(a) * rr, y: h.y + 0.08, z: z + Math.sin(a) * rr, n: 1, color: [0x6a0006, 0x9a0a12], speed: 0.1, up: 0.6, life: 0.5, size: 0.12, sizeEnd: 0.02, grav: 1.5 }); }
            if (Math.random() < 0.5) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R * grow; AnimFX.emit({ x: x + Math.cos(a) * rr, y: h.y + 0.25, z: z + Math.sin(a) * rr, n: 1, color: [0x3a0004, 0x2a0003], speed: 0.15, life: 2.5, size: 1.3, sizeEnd: 2.4, grav: -0.08, drag: 1 }); }
            if (Math.random() < 0.15) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R; AnimFX.shock(x + Math.cos(a) * rr, h.y + 0.06, z + Math.sin(a) * rr, 0xc8101a, 0.05, 0.6, 0.6, 0.6); }
            Engine3D.scene.fog.color.lerp(new THREE.Color(0x3a0006), 0.25);
            if (World3D.nearLights) AnimFX.flashes.length < 6 && Math.random() < 0.05 && AnimFX.flash(x, z, 0xff1020, 2.5, 0.8, 1.2);
        } else { this.lake.visible = false; this.lakeOn = false; }
        if (!knight) { this.shield.visible = false; return; }
        // Кровавый щит
        const sh = player.bloodShield || 0;
        this.shield.visible = sh > 0;
        if (sh > 0) { this.shield.position.set(h.x, h.y + 0.75, h.z); this.shieldMat.uniforms.t.value = t; this.shieldMat.uniforms.op.value = 0.35 + 0.65 * sh / Math.max(1, player.bloodShieldMax); this.shield.scale.setScalar(1 + Math.sin(t * 4) * 0.02); }
        // Капли крови с трофейного клинка
        const P = Actors3D.player;
        if (player.knightSword && P && P.rig.weapon && Math.random() < 0.35) {
            const wp = Actors3D.weaponPts(P.rig.weapon);
            if (wp) { const tip = wp[0].clone().lerp(wp[1], 0.4 + Math.random() * 0.6); AnimFX.emit({ gore: true, stick: true, x: tip.x, y: tip.y, z: tip.z, n: 1, color: [0x6a0006, 0x8a0008], speed: 0.05, life: 1.4, size: 0.045, grav: 6, drag: 0 }); }
        }
        // Кровотечение: струйки из раны
        if (player.knightBleed > 0 && Math.random() < 0.6) { const c = this.chest(); AnimFX.emit({ gore: true, stick: true, x: c.x + (Math.random() - 0.5) * 0.2, y: c.y, z: c.z + (Math.random() - 0.5) * 0.2, n: 2, color: [0x6a0006, 0x9a0a12], speed: 0.6, life: 1.2, size: 0.05, grav: 9 }); }
        // Ритуал ульты: руна будущего озера, потоки крови вихрем из тела
        const R = player.knightRend;
        if (R) {
            const k = R.t / R.dur, Rr = (300 + R.lvl * 30) / this.T, c = this.chest();
            for (let i = 0; i < 6; i++) { const a = t * 5 + i * 1.05, rr = 0.3 + k * 1.5; AnimFX.emit({ gore: i % 2 === 0, x: c.x + Math.cos(a) * rr, y: c.y + (Math.random() - 0.3) * 0.8, z: c.z + Math.sin(a) * rr, n: 1, color: [0x9a0a12, 0xff2030, 0x5a0005], speed: 1.5, up: 2.5, life: 0.9, size: 0.08, grav: 3, dir: [Math.cos(a + 1.57), 0.6, Math.sin(a + 1.57)] }); }
            if (Math.random() < 0.08) { AnimFX.blood(c.x, c.y, c.z, 30); AnimFX.kick(0.25); }
            this.lights = true;
        }
    }
};
