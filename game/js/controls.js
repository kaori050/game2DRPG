// ============================================================================
// УПРАВЛЕНИЕ: пресеты «Dota» и «WASD + ZXCV», переназначение клавиш и кнопок мыши, сохранение
// ============================================================================
// Каждое действие игры привязано к одному коду: 'KeyW', 'Digit1', 'Space', 'ShiftLeft', 'Mouse0' (ЛКМ),
// 'Mouse1' (колесо), 'Mouse2' (ПКМ)… Пустая строка — действие не назначено.
const Controls = {
    STORE: 'eldoria_controls_v1',
    // Действия: id → [название, группа]
    ACTIONS: [
        ['move_up', 'Вперёд (вверх)', 'move'], ['move_down', 'Назад (вниз)', 'move'], ['move_left', 'Влево', 'move'], ['move_right', 'Вправо', 'move'],
        ['sprint', 'Бег (выносливость)', 'move'], ['command', 'Приказ: идти / цель / подойти', 'move'], ['stop', 'Стоп (отмена каста)', 'move'],
        ['skill1', 'Навык 1 (Q · Квас)', 'skill'], ['skill2', 'Навык 2 (W · Векс)', 'skill'], ['skill3', 'Навык 3 (E · Экзорт)', 'skill'], ['skill4', 'Ультимейт / Инвок (R)', 'skill'],
        ['skill5', 'Доп. навык 1 (D: стойка / слот 1 / Пир)', 'skill'], ['skill6', 'Доп. навык 2 (F: бросок / слот 2)', 'skill'],
        ['primary', 'Основное действие (атака к курсору / цель)', 'combat'], ['attack', 'Атака к курсору', 'combat'], ['attack_move', 'Атака с ходу (A-клик)', 'combat'],
        ['interact', 'Взаимодействие', 'combat'], ['pot_hp', 'Зелье здоровья', 'combat'], ['pot_mp', 'Зелье маны', 'combat'],
        ['inventory', 'Котомка / снаряжение', 'ui'], ['spellbook', 'Гримуар', 'ui'], ['craft', 'Алтарь (крафт)', 'ui'], ['worldmap', 'Карта мира', 'ui'],
        ['gacha', 'Звёздная Молитва', 'ui'], ['menu', 'Закрыть окна / меню', 'ui'],
        ['admin_teleport', 'Админ: телепорт к курсору', 'admin'], ['admin_panel', 'Админ: свернуть панель', 'admin']
    ],
    GROUPS: { move: 'Передвижение', skill: 'Навыки', combat: 'Бой и предметы', ui: 'Интерфейс', admin: 'Режим администратора' },
    PRESETS: {
        dota: { name: 'Dota-style', desc: 'Клик ПКМ — движение и цель, навыки Q W E R D F, стрелки — прямое движение.', aim: 'click',
            binds: { move_up: 'ArrowUp', move_down: 'ArrowDown', move_left: 'ArrowLeft', move_right: 'ArrowRight', sprint: 'ShiftLeft', command: 'Mouse2', stop: 'KeyS',
                skill1: 'KeyQ', skill2: 'KeyW', skill3: 'KeyE', skill4: 'KeyR', skill5: 'KeyD', skill6: 'KeyF',
                primary: 'Mouse0', attack: 'Space', attack_move: 'KeyA', interact: 'KeyG', pot_hp: 'Digit1', pot_mp: 'Digit2',
                inventory: 'KeyC', spellbook: 'KeyB', craft: 'KeyK', worldmap: 'KeyM', gacha: 'KeyP', menu: 'Escape', admin_teleport: 'KeyT', admin_panel: 'Backquote' } },
        wasd: { name: 'WASD + ZXCV', desc: 'W A S D — свободное движение, навыки Z X C V (+ Q, E), прицел — курсор мыши.', aim: 'mouse',
            binds: { move_up: 'KeyW', move_down: 'KeyS', move_left: 'KeyA', move_right: 'KeyD', sprint: 'ShiftLeft', command: 'Mouse2', stop: 'KeyH',
                skill1: 'KeyZ', skill2: 'KeyX', skill3: 'KeyC', skill4: 'KeyV', skill5: 'KeyQ', skill6: 'KeyE',
                primary: 'Mouse0', attack: 'Space', attack_move: '', interact: 'KeyF', pot_hp: 'Digit1', pot_mp: 'Digit2',
                inventory: 'KeyI', spellbook: 'KeyB', craft: 'KeyK', worldmap: 'KeyM', gacha: 'KeyP', menu: 'Escape', admin_teleport: 'KeyT', admin_panel: 'Backquote' } }
    },
    preset: 'dota', aim: 'click', binds: {}, byCode: {}, capture: null, mouse: null, aimHold: 0,

    init() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(this.STORE) || 'null'); } catch (e) { }
        if (saved && saved.binds && this.PRESETS[saved.base || 'dota']) {
            this.preset = saved.preset || 'custom'; this.base = saved.base || 'dota';
            this.binds = Object.assign({}, this.PRESETS[this.base].binds, saved.binds);
            this.aim = saved.aim || this.PRESETS[this.base].aim;
        } else this.applyPreset('dota', true);
        this.index();
        // Перехват клавиши при переназначении — раньше всех остальных обработчиков
        window.addEventListener('keydown', e => {
            if (!this.capture) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (e.code === 'Escape') this.endCapture();
            else if (e.code === 'Backspace' || e.code === 'Delete') this.assign(this.capture, '');
            else this.assign(this.capture, e.code);
        }, true);
        window.addEventListener('mousedown', e => {
            if (!this.capture) return;
            const btn = e.target.closest && e.target.closest('[data-bind-btn]');
            if (btn && btn.dataset.bindBtn === this.capture) { e.preventDefault(); e.stopImmediatePropagation(); this.assign(this.capture, 'Mouse' + e.button); }
            else this.endCapture();
        }, true);
        window.addEventListener('mousemove', e => { this.mouse = { clientX: e.clientX, clientY: e.clientY }; });
    },
    index() { this.byCode = {}; for (const a in this.binds) if (this.binds[a]) this.byCode[this.binds[a]] = a; },
    save() { try { localStorage.setItem(this.STORE, JSON.stringify({ preset: this.preset, base: this.base, aim: this.aim, binds: this.binds })); } catch (e) { } },
    applyPreset(id, silent) {
        const P = this.PRESETS[id]; if (!P) return;
        this.preset = id; this.base = id; this.aim = P.aim; this.binds = Object.assign({}, P.binds);
        this.index(); this.save(); this.releaseAll();
        if (!silent) { this.renderUI(); this.refreshHints(); if (typeof showToast === 'function') showToast(`Управление: ${P.name}`, 'gold'); }
    },
    // Назначить код действию. Если код уже занят — у прежнего действия он снимается
    assign(action, code) {
        let note = '';
        if (code) for (const a in this.binds) if (a !== action && this.binds[a] === code) { this.binds[a] = ''; note = ` (снято с «${this.label(a)}»)`; }
        this.binds[action] = code; this.preset = 'custom';
        this.index(); this.save(); this.releaseAll(); this.endCapture(); this.refreshHints();
        if (typeof showToast === 'function') showToast(`${this.label(action)}: ${code ? this.keyName(code) : 'не назначено'}${note}`, note ? 'error' : 'info');
    },
    setAim(v) { this.aim = v === 'mouse' ? 'mouse' : 'click'; this.preset = 'custom'; this.save(); this.renderUI(); },
    resetToBase() { this.applyPreset(this.base || 'dota'); },
    startCapture(action) { this.capture = action; this.renderUI(); },
    endCapture() { if (!this.capture) return; this.capture = null; this.renderUI(); },
    // Отпустить все зажатые клавиши (иначе после смены биндов герой «залипнет» в движении)
    releaseAll() { if (typeof keys !== 'undefined') for (const k in keys) keys[k] = false; },
    label(a) { const r = this.ACTIONS.find(x => x[0] === a); return r ? r[1] : a; },
    key(a) { return this.binds[a] || ''; },
    keyName(code) {
        if (!code) return '—';
        const M = { Mouse0: 'ЛКМ', Mouse1: 'СКМ', Mouse2: 'ПКМ', Mouse3: 'Мышь 4', Mouse4: 'Мышь 5', Space: 'Пробел', Escape: 'Esc', Backquote: '`', Tab: 'Tab', Enter: 'Enter',
            ShiftLeft: 'Shift', ShiftRight: 'Правый Shift', ControlLeft: 'Ctrl', ControlRight: 'Правый Ctrl', AltLeft: 'Alt', AltRight: 'Правый Alt', CapsLock: 'Caps',
            ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
        if (M[code]) return M[code];
        if (code.startsWith('Key')) return code.slice(3);
        if (code.startsWith('Digit')) return code.slice(5);
        if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
        return code;
    },
    short(a) { return this.keyName(this.key(a)); },
    // Состояние ввода
    isDown(a) { const c = this.binds[a]; return !!(c && typeof keys !== 'undefined' && keys[c]); },
    axis() { return { x: (this.isDown('move_right') ? 1 : 0) - (this.isDown('move_left') ? 1 : 0), y: (this.isDown('move_down') ? 1 : 0) - (this.isDown('move_up') ? 1 : 0) }; },
    actionFor(code) { return this.byCode[code] || null; },
    // Прицел мышью: курсор переводится в точку мира каждый кадр (в WASD герой движется, а курсор стоит)
    refreshAim(dt) {
        this.aimHold = Math.max(0, this.aimHold - dt);
        if (!this.mouse || typeof scrPick !== 'function') return;
        const s = scrPick(this.mouse), cx = canvas.width / 2, cy = canvas.height / 2;
        mouseWorldX = player.x + (s[0] - cx); mouseWorldY = player.y + (s[1] - cy);
    },
    faceCursor() { player.facingAngle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x); this.aimHold = 0.6; },

    // ---------- Подсказки клавиш в интерфейсе ----------
    refreshHints() {
        const map = { Q: 'skill1', W: 'skill2', E: 'skill3', R: 'skill4', D: 'skill5', F: 'skill6', 1: 'pot_hp', 2: 'pot_mp' };
        document.querySelectorAll('.hotkey-badge').forEach(b => {
            if (!b.dataset.orig) b.dataset.orig = b.textContent.trim();
            const a = map[b.dataset.orig]; if (a) b.textContent = this.short(a);
        });
        const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        const p = s => `(${this.short(s)})`;
        set('btnGrimoireLabel', (document.getElementById('btnGrimoireLabel') || { textContent: '' }).textContent.replace(/\s*\([^)]*\)\s*$/, '') + ' ' + p('spellbook'));
        set('lblInventoryBtn', 'Котомка ' + p('inventory'));
        set('lblCraftBtn', 'Алтарь ' + p('craft'));
        set('archerHint', `${this.short('primary')} / ${this.short('attack')} — атака • ${this.short('command')} по врагу — цель • ${this.short('skill5')} — лук / клинки • ${this.short('skill6')} — метнуть клинок`);
        set('adminHint', `${this.short('admin_teleport')} — к курсору • на карте ${this.short('worldmap')} клик — в любую точку`);
        set('controlsSchemeBadge', this.preset === 'custom' ? 'Своя раскладка' : this.PRESETS[this.preset].name);
    },

    // ---------- Раздел «Управление» в настройках ----------
    renderUI() {
        const root = document.getElementById('controlsPane'); if (!root) return;
        const card = (id) => { const P = this.PRESETS[id], on = this.preset === id;
            return `<button onclick="Controls.applyPreset('${id}')" class="ctl-preset ${on ? 'on' : ''}"><b>${P.name}</b><span>${P.desc}</span>${on ? '<i>✓ активен</i>' : ''}</button>`; };
        let html = `<div class="ctl-presets">${card('wasd')}${card('dota')}</div>
            <div class="ctl-row ctl-aim"><span>Прицеливание навыков</span>
                <select onchange="Controls.setAim(this.value)" class="bg-stone-900 text-amber-300 font-bold px-2 py-1 rounded-lg border border-stone-700">
                    <option value="mouse" ${this.aim === 'mouse' ? 'selected' : ''}>Всегда по курсору мыши</option>
                    <option value="click" ${this.aim === 'click' ? 'selected' : ''}>Как в Dota (по курсору, разворот при движении)</option>
                </select></div>
            <div class="ctl-note">Нажмите на клавишу действия, затем нужную клавишу клавиатуры. Кнопку мыши назначьте щелчком по этой же клавише. Esc — отмена, Backspace — снять привязку. ${this.preset === 'custom' ? `<b class="text-amber-300">Своя раскладка на основе «${this.PRESETS[this.base || 'dota'].name}».</b>` : ''}</div>`;
        for (const g in this.GROUPS) {
            if (g === 'admin' && !(typeof adminMode !== 'undefined' && adminMode)) continue;
            html += `<div class="ctl-group">${this.GROUPS[g]}</div>`;
            this.ACTIONS.filter(a => a[2] === g).forEach(([id, name]) => {
                const cap = this.capture === id;
                html += `<div class="ctl-row"><span>${name}</span><button data-bind-btn="${id}" onclick="Controls.startCapture('${id}')" class="ctl-key ${cap ? 'cap' : ''} ${this.binds[id] ? '' : 'empty'}">${cap ? 'Нажмите клавишу…' : this.short(id)}</button></div>`;
            });
        }
        html += `<div class="ctl-foot"><button onclick="Controls.resetToBase()" class="rpg-btn px-3 py-1.5 rounded-lg text-xs font-bold">↺ Сбросить к пресету</button></div>`;
        root.innerHTML = html;
    },

    // ---------- Выполнение действий ----------
    // Возвращает true, если действие обработано
    run(a, e) {
        if (a === 'menu') { if (isAnyModalOpen()) closeAllModals(); else openSettingsModal(); return true; }
        if (a === 'spellbook') { toggleModal('spellbook'); return true; }
        if (a === 'inventory') { toggleModal('char'); return true; }
        if (a === 'craft') { toggleModal('craft'); return true; }
        if (a === 'worldmap') { toggleModal('worldmap'); return true; }
        if (a === 'gacha') { toggleModal('gacha'); return true; }
        if (a === 'admin_teleport') { if (adminMode) adminTeleportCursor(); return true; }
        if (a === 'admin_panel') { if (adminMode) toggleAdminPanelCollapse(); return true; }
        if (isAnyModalOpen()) return false;
        const mouseAim = this.aim === 'mouse';
        const aimed = () => { if (mouseAim) this.faceCursor(); };
        const ht = player.heroType;
        const sk = { skill1: 'q', skill2: 'w', skill3: 'e', skill4: 'r' }[a];
        if (sk) {
            aimed();
            if (ht === 'invoker') { if (sk === 'r') invokeSpell(); else pressOrb(sk); }
            else castHeroSkill(sk);
            return true;
        }
        if (a === 'skill5') { aimed(); if (ht === 'invoker') castInvokedSpell(0); else if (ht === 'archer') toggleArcherStance(); else if (ht === 'knight') castHeroSkill('d'); return true; }
        if (a === 'skill6') { aimed(); if (ht === 'invoker') castInvokedSpell(1); else if (ht === 'archer') throwUbwSword(); return true; }
        if (a === 'attack') { aimed(); performMageBasicAttack(); return true; }
        if (a === 'attack_move') { player.attackMoveMode = !player.attackMoveMode; return true; }
        if (a === 'stop') { stopHero(); return true; }
        if (a === 'interact') { triggerInteraction(); return true; }
        if (a === 'pot_hp') { useQuickPotion('hp'); return true; }
        if (a === 'pot_mp') { useQuickPotion('mp'); return true; }
        if (a === 'command') { if (e) mouseCommand(e); return true; }
        if (a === 'primary') { if (e) mousePrimary(e); else { aimed(); performMageBasicAttack(); } return true; }
        return false;
    }
};
