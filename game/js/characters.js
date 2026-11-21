// ============================================================================
// КЛАССЫ И ПЕРСОНАЖИ: двухэтапный выбор «Класс → Персонаж»
// ============================================================================
// Каждый персонаж принадлежит классу и наследует его боевой набор (навыки героя-основы),
// но имеет свои характеристики, пассивную черту, стиль боя и облик (палитра 3D-модели).
const CLASSES = [
    { id: 'warrior', name: 'Воин', sub: 'Сейбер-класс', icon: '⚔️', glow: '250,204,21', base: 'saber',
      desc: 'Ближний бой клинком: Сейбер, Мордред и Павший Рыцарь. Крепкая броня и сокрушительные удары — от Луча Экскалибура до магии крови.' },
    { id: 'ranger', name: 'Лучник', sub: 'Арчер-класс', icon: '🏹', glow: '239,68,68', base: 'archer',
      desc: 'Дальний бой из лука и парные клинки вблизи. Залпы, отскоки и Бесконечный Арсенал.' },
    { id: 'berserker', name: 'Берсерк', sub: 'Молотобоец', icon: '🔨', glow: '250,204,21', base: 'frankenstein',
      desc: 'Сокрушительные удары огромной булавой, подбросы и гром. Навыки разжигают безумие: переполнится шкала — герой потеряет контроль.' },
    { id: 'mage', name: 'Маг', sub: 'Заклинатель', icon: '🔮', glow: '168,85,247', base: 'invoker',
      desc: 'Инвокер со сферами стихий, Элизабет Альтер — падшая богиня Пустоты, и Медея — ведьма Эпохи Богов.' }
];

// mods: hp/mp/dmg/speed/range/mpRegen — множители; armor/crit/amp — прибавка; atk — множитель интервала атаки (меньше = быстрее)
const CHARACTERS = [
    // ---------- Воины ----------
    { id: 'saber', cls: 'warrior', key: 'saber', model: 'saber', art: 'assets/art/saber_splash.jpg', artFocus: 0.55, name: 'Сейбер', epithet: 'Король Рыцарей', role: 'Ближний бой • Танк', glow: '250,204,21', icon: '👑',
      trait: 'Сбалансированный рыцарь: надёжная броня и сильный удар.', mods: {},
      lore: 'Владычица Форта Этельгард, вернувшаяся из Авалона. Её клинок раскалывает землю, а Луч Экскалибура выжигает путь сквозь орды.',
      stats: [['Атака', 8], ['Защита', 9], ['Мобильность', 6], ['Сложность', 3]] },
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
    // ---------- Маги ----------
    { id: 'invoker', cls: 'mage', key: 'invoker', name: 'Инвокер', epithet: 'Архимаг Карл', role: 'Маг • Комбинатор', glow: '168,85,247', icon: '🔮',
      trait: 'Универсальный заклинатель: все три стихии в равновесии.', mods: {},
      lore: 'Последний хранитель Руин Голдрона. Сплетает лёд Quas, молнию Wex и огонь Exort в 27 древних заклинаний.',
      stats: [['Атака', 9], ['Защита', 3], ['Мобильность', 5], ['Сложность', 9]] },
    { id: 'elizabeth', cls: 'mage', key: 'elizabeth', model: 'elizabeth', filter: 'hue-rotate(60deg) saturate(1.8) brightness(0.8)', name: 'Элизабет Альтер', epithet: 'Падшая Богиня', role: 'Маг • Пустота • Проклятия', glow: '217,70,239', icon: '🌑',
      trait: 'Свой набор из пяти навыков Пустоты. Пассивка «Скверна»: каждое попадание навыком усиливает следующие (до +30%). Проклятые ею враги лечат её.', mods: {},
      lore: 'Богиня, низвергнутая во тьму. Глаза на её крыльях видят каждую душу на поле боя, а её песнь отворяет Пустоту.',
      stats: [['Атака', 9], ['Защита', 4], ['Мобильность', 7], ['Сложность', 7]] },
    { id: 'medea', cls: 'mage', key: 'medea', model: 'medea', filter: 'hue-rotate(250deg) saturate(1.5) brightness(0.85)', name: 'Медея', epithet: 'Ведьма Предательства', role: 'Маг • Эпоха Богов • Контроль', glow: '139,92,246', icon: '📜',
      trait: 'Хрупкая, но смертоносная: мало здоровья и брони, много маны и силы навыков, сверхбыстрые касты. Воины Драконьих Зубов отвлекают толпу, Rule Breaker ломает чужую магию.', mods: {},
      lore: 'Колхидская принцесса и маг Эпохи Богов. Её заклинание из одного слова сильнее ритуалов современных магов, а кинжал Rule Breaker разрывает любой договор и любые чары.',
      stats: [['Атака', 10], ['Защита', 2], ['Мобильность', 8], ['Сложность', 8]] },
    // ---------- Берсерки ----------
    { id: 'frankenstein', cls: 'berserker', key: 'frankenstein', model: 'frankenstein', filter: 'hue-rotate(10deg) saturate(1.6) brightness(1.05)', name: 'Франкенштейн', epithet: 'Берсерк Грозы', role: 'Берсерк • Булава • Молнии', glow: '250,204,21', icon: '⚡',
      trait: 'Огромная булава: удары подбрасывают врагов. Безумие берсерка: навыки быстро наполняют шкалу, на 100% героиня теряет контроль и носится, не разбирая дороги.', mods: {},
      lore: 'Искусственная девушка, собранная из мёртвых тел и оживлённая молнией. Её булава-громоотвод копит грозу, а гнев однажды вырывается наружу.',
      stats: [['Атака', 10], ['Защита', 8], ['Мобильность', 5], ['Сложность', 6]] },
];
// Навыки персонажа берутся из набора его класса
const CLASS_SKILLS = {
    saber: [['Q', 'Разлом и Волна'], ['W', 'Рывок Праны'], ['E', 'Колоссальный Клинок'], ['R', 'Луч Экскалибура']],
    invoker: [['Q W E', 'Сферы стихий'], ['R', 'Invoke'], ['D F', 'Призванные чары']],
    medea: [['Q', 'Божественные Слова'], ['W', 'Воины Драконьих Зубов'], ['E', 'Пространственный Скачок'], ['R', 'Разрушитель Правил']],
    frankenstein: [['Q', 'Удар с подбросом'], ['W', 'Бросок булавы'], ['E', 'Тройной удар'], ['R', 'Грозовое Древо']],
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
        if (!['saber', 'archer', 'invoker', 'knight', 'elizabeth', 'frankenstein', 'medea'].includes(s.heroType)) return 'неизвестный герой';
        for (const k of ['x', 'y', 'level', 'gold']) if (typeof s[k] !== 'number' || !isFinite(s[k])) return `нет поля «${k}»`;
        if (!Array.isArray(s.inventory)) return 'нет инвентаря';
        if (s.level < 1 || s.level > 999) return 'неверный уровень';
        return null;
    }
};
