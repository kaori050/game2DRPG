// ============================================================================
// КЛАССЫ И ПЕРСОНАЖИ: двухэтапный выбор «Класс → Персонаж»
// ============================================================================
// Каждый персонаж принадлежит классу и наследует его боевой набор (навыки героя-основы),
// но имеет свои характеристики, пассивную черту, стиль боя и облик (палитра 3D-модели).
const CLASSES = [
    { id: 'warrior', name: 'Воин', sub: 'Сейбер-класс', icon: '⚔️', glow: '250,204,21', base: 'saber',
      desc: 'Ближний бой клинком. Крепкая броня и сокрушительные удары — от Луча Экскалибура до магии крови Павшего Рыцаря.' },
    { id: 'ranger', name: 'Лучник', sub: 'Арчер-класс', icon: '🏹', glow: '239,68,68', base: 'archer',
      desc: 'Дальний бой из лука и парные клинки вблизи. Залпы, отскоки и Бесконечный Арсенал.' },
    { id: 'mage', name: 'Маг', sub: 'Заклинатель', icon: '🔮', glow: '168,85,247', base: 'invoker',
      desc: 'Сферы стихий Quas, Wex и Exort складываются в 27 заклинаний. Мощь, контроль и мана.' }
];

// mods: hp/mp/dmg/speed/range/mpRegen — множители; armor/crit/amp — прибавка; atk — множитель интервала атаки (меньше = быстрее)
const CHARACTERS = [
    // ---------- Воины ----------
    { id: 'saber', cls: 'warrior', key: 'saber', model: 'saber', art: 'assets/art/saber_splash.jpg', artFocus: 0.55, name: 'Сейбер', epithet: 'Король Рыцарей', role: 'Ближний бой • Танк', glow: '250,204,21', icon: '👑',
      trait: 'Сбалансированный рыцарь: надёжная броня и сильный удар.', mods: {},
      lore: 'Владычица Форта Этельгард, вернувшаяся из Авалона. Её клинок раскалывает землю, а Луч Экскалибура выжигает путь сквозь орды.',
      stats: [['Атака', 8], ['Защита', 9], ['Мобильность', 6], ['Сложность', 3]] },
    { id: 'saber_alter', cls: 'warrior', key: 'saber', alter: true, model: 'saber_alter', art: 'assets/art/saber_splash.jpg', artFocus: 0.55,
      artFilter: 'grayscale(0.55) hue-rotate(200deg) saturate(2.2) brightness(0.62) contrast(1.25)', filter: 'grayscale(1) brightness(0.5) sepia(0.4) hue-rotate(230deg) saturate(2.5)',
      name: 'Сейбер Альтер', epithet: 'Тёмный Король', role: 'Ближний бой • Вампиризм • Тени', glow: '168,40,220', icon: '🖤',
      trait: 'Тёмная форма с самого начала: +30% урона и +25 к силе навыков. Вампиризм — удары и навыки лечат её. Финишер комбо и «Разлом» выпускают теневые клинки.', mods: {},
      lore: 'Король Рыцарей, поглощённая тьмой. Её чёрный Экскалибур Морган пылает багрово-фиолетовым светом, а жалость она оставила в прошлом.',
      stats: [['Атака', 10], ['Защита', 8], ['Мобильность', 6], ['Сложность', 5]] },
    { id: 'isolde', filter: 'hue-rotate(110deg) saturate(0.8) brightness(1.05)', cls: 'warrior', key: 'saber', name: 'Изольда', epithet: 'Стальная Роза', role: 'Латница • Несокрушимый танк', glow: '244,114,182', icon: '🌹',
      trait: 'Стальная Роза: +30% здоровья, +4 брони и +5% урона, но шаг и замах медленнее.', mods: { hp: 1.3, armor: 4, dmg: 1.05, speed: 0.9, atk: 1.12 },
      lore: 'Наследница павшего ордена Розы. Носит латы, выкованные из колоколов сожжённого собора, и не отступает ни на шаг.',
      stats: [['Атака', 8], ['Защита', 10], ['Мобильность', 4], ['Сложность', 2]],
      pal: { body: 0x8a8f9c, arms: 0x8a8f9c, legs: 0x5a5e6a, robe: 0x6a1a3a, chest: 0xd8dce4, shoulders: 0xd8dce4, hair: 0x2a1a14, cape: 0x8a1a4a, belt: 0x4a1020, blade: 0xe8e8f0, glowC: 0xff7ab0, armor: true } },
    { id: 'kaiden', filter: 'hue-rotate(-25deg) saturate(1.2) brightness(0.9)', cls: 'warrior', key: 'saber', name: 'Кайден', epithet: 'Буревестник', role: 'Дуэлянт • Натиск', glow: '56,189,248', icon: '⚡',
      trait: 'Буревестник: атакует на 15% быстрее, +12% скорости и +10% крита, но здоровья и брони меньше.', mods: { hp: 0.85, armor: -2, speed: 1.12, atk: 0.85, crit: 10 },
      lore: 'Странствующий фехтовальщик с северных утёсов. Говорят, его клинок звенит громом за миг до удара.',
      stats: [['Атака', 9], ['Защита', 5], ['Мобильность', 9], ['Сложность', 6]],
      pal: { body: 0x1a2a4a, arms: 0x1a2a4a, legs: 0x101a30, robe: 0x0e1a30, chest: 0x5a6a8a, shoulders: 0x3a4a6a, hair: 0xe0e0f0, cape: 0x3a7ac8, belt: 0x2a2a3a, blade: 0xbfe0ff, glowC: 0x5ab8ff, bun: false, spiky: true } },
    { id: 'mordred', cls: 'warrior', key: 'saber', model: 'mordred', art: 'assets/art/mordred_helm.jpg', artFocus: 0.7, filter: 'hue-rotate(150deg) saturate(1.6) brightness(0.95)', name: 'Мордред', epithet: 'Рыцарь Кларента', role: 'Мечник • Натиск • Алое пламя', glow: '220,38,38', icon: '⚔️',
      trait: 'Клинок Кларент: все навыки Сейбер, но в багровом пламени. +10% урона и +5% шанса крита, чуть меньше здоровья. Под «Колоссальным Клинком» — альтернативный облик модели.', mods: { dmg: 1.1, crit: 5, hp: 0.95 },
      lore: 'Рыцарь в серебряно-алых латах, рождённая, чтобы занять трон Камелота. Её Кларент горит красным, а ярость не знает пощады.',
      stats: [['Атака', 9], ['Защита', 7], ['Мобильность', 7], ['Сложность', 4]] },
    { id: 'fallen_knight', cls: 'warrior', key: 'knight', filter: 'grayscale(1) brightness(0.42) contrast(1.5) sepia(0.35) hue-rotate(-30deg) saturate(3)', name: 'Павший Рыцарь', epithet: 'Магия Крови', role: 'Мечник • Без маны • Кровь', glow: '220,38,38', icon: '🩸',
      trait: 'Нет маны: навыки тратят % текущего здоровья (но не убивают). Здоровье растёт на 25% быстрее, регенерация тем выше, чем тяжелее раны. Меч снимает с убитых мечников — он ломается, и тогда в ход идут когти.', mods: {},
      lore: 'Рыцарь ордена, которого не приняла даже смерть. Его латы налиты раскалённой кровью, а клинок он вырывает из рук убитых — и ломает о следующего врага.',
      stats: [['Атака', 9], ['Защита', 8], ['Мобильность', 6], ['Сложность', 9]] },
    // ---------- Лучники ----------
    { id: 'archer', cls: 'ranger', key: 'archer', model: 'archer', name: 'Арчер', epithet: 'Страж Клинков', role: 'Стрелок • Мечник', glow: '239,68,68', icon: '🏹',
      trait: 'Мастер двух стоек: лук вдали, парные клинки вблизи.', mods: {},
      lore: 'Воин в алом плаще, разящий из чёрного лука. В ближнем бою призывает клинки Канто и Бакуя, а в час нужды — Бесконечный Арсенал.',
      stats: [['Атака', 8], ['Защита', 4], ['Мобильность', 8], ['Сложность', 6]] },
    { id: 'lirel', filter: 'hue-rotate(115deg) saturate(0.9)', cls: 'ranger', key: 'archer', name: 'Лирель', epithet: 'Тихая Стрела', role: 'Снайпер • Дальний бой', glow: '74,222,128', icon: '🍃',
      trait: 'Тихая Стрела: +25% дальности и +20% урона, но стреляет медленнее и здоровья меньше.', mods: { range: 1.25, dmg: 1.2, atk: 1.2, hp: 0.9 },
      lore: 'Следопыт Шепчущего Леса. Её стрела настигает цель прежде, чем та услышит тетиву.',
      stats: [['Атака', 10], ['Защита', 3], ['Мобильность', 7], ['Сложность', 7]],
      pal: { body: 0x2a3a22, arms: 0x2a5a2a, legs: 0x1e2a18, robe: 0x1e4a22, chest: 0x5a4a2a, shoulders: 0x3a6a2a, hair: 0xe8d070, spiky: false, hood: 0x1e4a22 } },
    { id: 'raven', filter: 'grayscale(0.85) brightness(0.75) contrast(1.2)', cls: 'ranger', key: 'archer', name: 'Ворон', epithet: 'Багряного Креста', role: 'Охотник • Критические удары', glow: '148,163,184', icon: '🐦‍⬛',
      trait: 'Охотник: +12% шанса крита, +30% силы крита и +10% скорости, но меньше здоровья.', mods: { crit: 12, critMult: 0.3, speed: 1.1, hp: 0.9 },
      lore: 'Бывший палач Багряного Креста. Выслеживает нечисть по запаху крови и бьёт без промаха.',
      stats: [['Атака', 9], ['Защита', 3], ['Мобильность', 9], ['Сложность', 8]],
      pal: { body: 0x141418, arms: 0x1a1a1e, legs: 0x101014, robe: 0x101014, chest: 0x3a0a10, shoulders: 0x3a3a42, hair: 0x101010, cape: 0x2a0a10 } },
    // ---------- Маги ----------
    { id: 'invoker', cls: 'mage', key: 'invoker', name: 'Инвокер', epithet: 'Архимаг Карл', role: 'Маг • Комбинатор', glow: '168,85,247', icon: '🔮',
      trait: 'Универсальный заклинатель: все три стихии в равновесии.', mods: {},
      lore: 'Последний хранитель Руин Голдрона. Сплетает лёд Quas, молнию Wex и огонь Exort в 27 древних заклинаний.',
      stats: [['Атака', 9], ['Защита', 3], ['Мобильность', 5], ['Сложность', 9]] },
    { id: 'elizabeth', cls: 'mage', key: 'elizabeth', model: 'elizabeth', filter: 'hue-rotate(60deg) saturate(1.8) brightness(0.8)', name: 'Элизабет Альтер', epithet: 'Падшая Богиня', role: 'Маг • Пустота • Проклятия', glow: '217,70,239', icon: '🌑',
      trait: 'Свой набор из пяти навыков Пустоты. Пассивка «Скверна»: каждое попадание навыком усиливает следующие (до +30%). Проклятые ею враги лечат её.', mods: {},
      lore: 'Богиня, низвергнутая во тьму. Глаза на её крыльях видят каждую душу на поле боя, а её песнь отворяет Пустоту.',
      stats: [['Атака', 9], ['Защита', 4], ['Мобильность', 7], ['Сложность', 7]] },
    { id: 'morven', filter: 'hue-rotate(110deg) saturate(1.4)', cls: 'mage', key: 'invoker', name: 'Морвен', epithet: 'Пепельная', role: 'Пиромант • Урон', glow: '249,115,22', icon: '🔥',
      trait: 'Пепельная: +25% силы заклинаний, но на 15% меньше здоровья.', mods: { amp: 25, hp: 0.85 },
      lore: 'Ведьма, пережившая сожжение на костре. С тех пор пламя слушается её, а не палачей.',
      stats: [['Атака', 10], ['Защита', 2], ['Мобильность', 5], ['Сложность', 8]],
      pal: { body: 0x6a1a0a, arms: 0x7a2a10, legs: 0x2a0a04, robe: 0x4a0a04, chest: 0xff7a2a, shoulders: 0x3a1a10, cape: 0x2a0a04, collar: 0xff7a2a, hair: 0xd0401a } },
    { id: 'eldrin', filter: 'hue-rotate(-50deg) saturate(0.6) brightness(1.25)', cls: 'mage', key: 'invoker', name: 'Элдрин', epithet: 'Ледяной Шёпот', role: 'Хранитель • Мана и защита', glow: '125,211,252', icon: '❄️',
      trait: 'Ледяной Шёпот: +30% маны, +40% её восстановления и +3 брони, но заклинания слабее на 10%.', mods: { mp: 1.3, mpRegen: 1.4, armor: 3, amp: -10 },
      lore: 'Отшельник ледяных пиков Гримволта. Его тишина холоднее любой метели.',
      stats: [['Атака', 7], ['Защита', 6], ['Мобильность', 5], ['Сложность', 7]],
      pal: { body: 0xd8e8f0, arms: 0xc8d8e8, legs: 0x3a5a7a, robe: 0x6aa8d8, chest: 0xe8f4ff, shoulders: 0xbfe0ff, cape: 0x2a5a8a, collar: 0xbfe0ff, hair: 0xf0f8ff } }
];
// Навыки персонажа берутся из набора его класса
const CLASS_SKILLS = {
    saber: [['Q', 'Разлом и Волна'], ['W', 'Рывок Праны'], ['E', 'Колоссальный Клинок'], ['R', 'Луч Экскалибура']],
    invoker: [['Q W E', 'Сферы стихий'], ['R', 'Invoke'], ['D F', 'Призванные чары']],
    elizabeth: [['Q', 'Багровое Око'], ['W', 'Крылья Скверны'], ['E', 'Проклятие Падшей'], ['D', 'Песнь Пустоты'], ['R', 'Падение Богини']],
    knight: [['Q', 'Жертвоприношение'], ['W', 'Кровавый Щит'], ['E', 'Кровавый Рывок'], ['D', 'Кровавый Пир'], ['R', 'Озеро Крови']],
    archer: [['Q', 'Ледяная стрела'], ['W', 'Залп'], ['E', 'Отскок'], ['D', 'Лук ↔ Клинки'], ['R', 'Бесконечный Арсенал']]
};
CHARACTERS.forEach(c => { c.skills = CLASS_SKILLS[c.key]; });
const charById = id => CHARACTERS.find(c => c.id === id) || null;
// Текущий персонаж игрока (с запасным вариантом — основа класса)
function playerChar() {
    const c = charById(player.charId);
    return c && c.key === player.heroType ? c : charById(player.heroType);
}
// Модификаторы персонажа поверх характеристик класса (вызывается из recalcPlayerStats)
function applyCharacterMods() {
    const c = playerChar(); if (!c || !c.mods) return;
    const m = c.mods;
    if (m.hp) player.maxHp = Math.round(player.maxHp * m.hp);
    if (m.mp) player.maxMp = Math.round(player.maxMp * m.mp);
    if (m.mpRegen) player.mpRegen = +(player.mpRegen * m.mpRegen).toFixed(1);
    if (m.dmg) player.handDmg = Math.round(player.handDmg * m.dmg);
    if (m.armor) player.armor = Math.max(0, player.armor + m.armor);
    if (m.speed) player.moveSpeed = Math.round(player.moveSpeed * m.speed);
    if (m.atk && player.attackInterval) player.attackInterval = +(player.attackInterval * m.atk).toFixed(2);
    if (m.range && player.attackRange) player.attackRange = Math.round(player.attackRange * m.range);
    if (m.crit && player.heroType !== 'invoker') player.critChance += m.crit;
    if (m.critMult && player.heroType !== 'invoker') player.critMult = +(player.critMult + m.critMult).toFixed(2);
    if (m.amp) player.spellAmp = Math.max(0, player.spellAmp + m.amp);
}

// ---------- Экран выбора класса ----------
let classIdx = 0;
// При входе на экран подсвечиваем класс последнего выбранного персонажа
function syncClassFromChar() { const cur = (charById(gameSettings.selectedChar) || {}).cls; if (cur) classIdx = Math.max(0, CLASSES.findIndex(c => c.id === cur)); }
function renderClassCards() {
    const grid = document.getElementById('classGrid'); if (!grid) return;
    grid.innerHTML = CLASSES.map((c, i) => {
        const chars = CHARACTERS.filter(h => h.cls === c.id);
        return `<button class="class-card ${i === classIdx ? 'on' : ''}" style="--hero-glow:${c.glow}" onclick="pickClass(${i})" ondblclick="confirmClass()">
            <span class="class-icon">${c.icon}</span>
            <span class="class-name">${c.name}</span>
            <span class="class-sub">${c.sub}</span>
            <span class="class-desc">${c.desc}</span>
            <span class="class-roster">${chars.map(h => `<i style="--c:${h.glow}">${h.name}</i>`).join('')}</span>
        </button>`;
    }).join('');
}
function pickClass(i) { classIdx = i; renderClassCards(); if (typeof SoundFX !== 'undefined') SoundFX.play('orb'); }
function confirmClass() {
    const cls = CLASSES[classIdx];
    HERO_MENU = CHARACTERS.filter(h => h.cls === cls.id);
    const prev = HERO_MENU.findIndex(h => h.id === gameSettings.selectedChar);
    heroIdx = prev >= 0 ? prev : 0;
    const track = document.getElementById('heroTrack'); if (track) { track.innerHTML = ''; delete track.dataset.built; }
    const t = document.getElementById('heroScreenTitle'); if (t) t.textContent = `${cls.name}: выберите персонажа`;
    setGameState('char_select');
}

// ---------- Экспорт и импорт сохранений в файл ----------
const SaveIO = {
    FORMAT: 'eldoria-save',
    // Скачать текущий прогресс как .json
    exportFile() {
        if (gameStarted && typeof saveGame === 'function') saveGame(false);
        let raw = null; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { }
        if (!raw) { showToast('Нет сохранения для экспорта — начните игру', 'error'); return; }
        const data = JSON.parse(raw), c = charById(data.charId) || charById(data.heroType) || {};
        let controls = null; try { controls = JSON.parse(localStorage.getItem(Controls.STORE) || 'null'); } catch (e) { }
        const pack = { format: this.FORMAT, version: 1, exportedAt: new Date().toISOString(), hero: `${c.name || data.heroType} • ур. ${data.level}`, save: data, controls };
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const d = new Date(), pad = n => String(n).padStart(2, '0');
        const name = `eldoria_${(c.id || data.heroType)}_lv${data.level}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        showToast(`💾 Сейв экспортирован: ${name}`, 'gold');
    },
    // Выбрать файл на компьютере
    pickFile() {
        let inp = document.getElementById('saveImportInput');
        if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'saveImportInput'; inp.style.display = 'none'; inp.onchange = () => { if (inp.files[0]) this.importFile(inp.files[0]); inp.value = ''; }; document.body.appendChild(inp); }
        inp.click();
    },
    importFile(file) {
        const rd = new FileReader();
        rd.onload = () => {
            let pack;
            try { pack = JSON.parse(rd.result); } catch (e) { showToast('Файл повреждён: это не JSON', 'error'); return; }
            const save = pack && pack.format === this.FORMAT ? pack.save : pack;   // принимаем и «голый» сейв
            const err = this.validate(save);
            if (err) { showToast('Сейв не подходит: ' + err, 'error'); return; }
            const c = charById(save.charId) || charById(save.heroType) || {};
            if (!confirm(`Загрузить сейв «${c.name || save.heroType}», уровень ${save.level}, золото ${save.gold}?\nТекущий прогресс в этом браузере будет заменён.`)) return;
            localStorage.setItem(SAVE_KEY, JSON.stringify(save));
            if (pack.controls && pack.controls.binds) { try { localStorage.setItem(Controls.STORE, JSON.stringify(pack.controls)); } catch (e) { } }
            showToast('Сейв импортирован — загружаю…', 'gold');
            setTimeout(() => location.reload(), 600);
        };
        rd.onerror = () => showToast('Не удалось прочитать файл', 'error');
        rd.readAsText(file);
    },
    validate(s) {
        if (!s || typeof s !== 'object') return 'пустой файл';
        if (!['saber', 'archer', 'invoker', 'knight', 'elizabeth'].includes(s.heroType)) return 'неизвестный герой';
        for (const k of ['x', 'y', 'level', 'gold']) if (typeof s[k] !== 'number' || !isFinite(s[k])) return `нет поля «${k}»`;
        if (!Array.isArray(s.inventory)) return 'нет инвентаря';
        if (s.level < 1 || s.level > 999) return 'неверный уровень';
        return null;
    }
};
