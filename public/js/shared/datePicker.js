// @ts-check
/**
 * datePicker.js — kalendarz S.O.K. dla input[type=date] (wszystkie moduły).
 *
 * Natywny popup Chromium nie da się ostylować ani powiększyć, więc pola
 * (readonly — blokuje natywny picker) otwierają własny popover na tokenach:
 * `--bg-card`, `--border`, `--radius-*`, `--shadow-lg`, `--accent`.
 * Wybór dnia zapisuje `input.value` (YYYY-MM-DD) i wysyła `change`,
 * więc logika filtrów i formularzy działa bez zmian.
 *
 * Pola dodane później (modale, partiale) łapie MutationObserver.
 * `datetime-local` też jest obsługiwany — popover ma dodatkowe pole godziny.
 */
(function () {
    var MONTHS = [
        'styczeń',
        'luty',
        'marzec',
        'kwiecień',
        'maj',
        'czerwiec',
        'lipiec',
        'sierpień',
        'wrzesień',
        'październik',
        'listopad',
        'grudzień'
    ];
    var MONTHS_GENITIVE = [
        'stycznia',
        'lutego',
        'marca',
        'kwietnia',
        'maja',
        'czerwca',
        'lipca',
        'sierpnia',
        'września',
        'października',
        'listopada',
        'grudnia'
    ];
    var WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

    /** @type {HTMLElement | null} */
    var panel = null;
    /** @type {HTMLInputElement | null} */
    var activeInput = null;
    var viewYear = 0;
    var viewMonth = 0;

    /** @param {number} n */
    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    /** @param {string} value */
    function parseValue(value) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    /** @param {number} y @param {number} m @param {number} d */
    function toValue(y, m, d) {
        return y + '-' + pad2(m + 1) + '-' + pad2(d);
    }

    function buildPanel() {
        var el = document.createElement('div');
        el.className = 'sok-datepicker';
        el.hidden = true;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Wybierz datę');
        el.innerHTML =
            '<div class="sok-datepicker-head">' +
            '<button type="button" class="btn btn-sm btn-secondary sok-datepicker-nav" data-nav="-1" aria-label="Poprzedni miesiąc"><i data-lucide="chevron-left"></i></button>' +
            '<div class="sok-datepicker-title" aria-live="polite"></div>' +
            '<button type="button" class="btn btn-sm btn-secondary sok-datepicker-nav" data-nav="1" aria-label="Następny miesiąc"><i data-lucide="chevron-right"></i></button>' +
            '</div>' +
            '<div class="sok-datepicker-weekdays" aria-hidden="true">' +
            WEEKDAYS.map(function (d) {
                return '<span>' + d + '</span>';
            }).join('') +
            '</div>' +
            '<div class="sok-datepicker-grid" role="grid"></div>' +
            '<div class="sok-datepicker-time" hidden>' +
            '<label>Godzina <input type="time" step="60" /></label>' +
            '</div>' +
            '<div class="sok-datepicker-foot">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-act="today">Dzisiaj</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-act="clear">Wyczyść</button>' +
            '</div>';
        el.addEventListener('click', onPanelClick);
        document.body.appendChild(el);
        return el;
    }

    function render() {
        if (!panel) return;
        var title = panel.querySelector('.sok-datepicker-title');
        if (title) title.textContent = MONTHS[viewMonth] + ' ' + viewYear;

        var selected = activeInput ? parseValue(activeInput.value) : null;
        var today = new Date();
        var firstOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
        var start = new Date(viewYear, viewMonth, 1 - firstOffset);
        var cells = [];
        for (var i = 0; i < 42; i++) {
            var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            var value = toValue(day.getFullYear(), day.getMonth(), day.getDate());
            var classes = ['sok-datepicker-day'];
            if (day.getMonth() !== viewMonth) classes.push('is-outside');
            if (
                day.getFullYear() === today.getFullYear() &&
                day.getMonth() === today.getMonth() &&
                day.getDate() === today.getDate()
            ) {
                classes.push('is-today');
            }
            if (
                selected &&
                day.getFullYear() === selected.getFullYear() &&
                day.getMonth() === selected.getMonth() &&
                day.getDate() === selected.getDate()
            ) {
                classes.push('is-selected');
            }
            cells.push(
                '<button type="button" class="' +
                    classes.join(' ') +
                    '" data-date="' +
                    value +
                    '" aria-label="' +
                    day.getDate() +
                    ' ' +
                    MONTHS_GENITIVE[day.getMonth()] +
                    ' ' +
                    day.getFullYear() +
                    '"' +
                    (classes.indexOf('is-selected') >= 0 ? ' aria-current="date"' : '') +
                    '>' +
                    day.getDate() +
                    '</button>'
            );
        }
        var grid = panel.querySelector('.sok-datepicker-grid');
        if (grid) grid.innerHTML = cells.join('');
    }

    function position() {
        if (!panel || !activeInput) return;
        var rect = activeInput.getBoundingClientRect();
        var panelRect = panel.getBoundingClientRect();
        var left = Math.min(rect.left, window.innerWidth - panelRect.width - 8);
        var top = rect.bottom + 6;
        if (top + panelRect.height > window.innerHeight - 8) {
            top = Math.max(8, rect.top - panelRect.height - 6);
        }
        panel.style.left = Math.max(8, left) + 'px';
        panel.style.top = top + 'px';
    }

    /** @param {HTMLInputElement} input */
    function openFor(input) {
        activeInput = input;
        var current = parseValue(input.value) || new Date();
        viewYear = current.getFullYear();
        viewMonth = current.getMonth();
        if (!panel) panel = buildPanel();
        var timeWrap = panel.querySelector('.sok-datepicker-time');
        var timeField = panel.querySelector('.sok-datepicker-time input');
        var wantsTime = input.type === 'datetime-local';
        if (timeWrap instanceof HTMLElement) timeWrap.hidden = !wantsTime;
        if (timeField instanceof HTMLInputElement) {
            var m = /T(\d{2}):(\d{2})/.exec(input.value || '');
            timeField.value = m
                ? m[1] + ':' + m[2]
                : pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes());
        }
        panel.hidden = false;
        render();
        position();
        var focusTarget = panel.querySelector(
            '.sok-datepicker-day.is-selected, .sok-datepicker-day.is-today'
        );
        if (focusTarget instanceof HTMLElement) focusTarget.focus();
    }

    function close() {
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        if (activeInput) {
            activeInput.focus();
        }
        activeInput = null;
    }

    /** @param {HTMLInputElement} input @param {string} value */
    function commit(input, value) {
        if (value && input.type === 'datetime-local') {
            var timeField = panel && panel.querySelector('.sok-datepicker-time input');
            var time =
                timeField instanceof HTMLInputElement && timeField.value
                    ? timeField.value
                    : '00:00';
            value += 'T' + time;
        }
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /** @param {MouseEvent} event */
    function onPanelClick(event) {
        var target = event.target instanceof Element ? event.target : null;
        if (!target || !panel) return;
        var nav = target.closest('[data-nav]');
        if (nav) {
            var step = Number(nav.getAttribute('data-nav'));
            var next = new Date(viewYear, viewMonth + step, 1);
            viewYear = next.getFullYear();
            viewMonth = next.getMonth();
            render();
            var sameNav = panel.querySelector('[data-nav="' + step + '"]');
            if (sameNav instanceof HTMLElement) sameNav.focus();
            return;
        }
        var act = target.closest('[data-act]');
        if (act && activeInput) {
            var input = activeInput;
            if (act.getAttribute('data-act') === 'today') {
                var now = new Date();
                commit(input, toValue(now.getFullYear(), now.getMonth(), now.getDate()));
            } else {
                commit(input, '');
            }
            close();
            return;
        }
        var day = target.closest('[data-date]');
        if (day && activeInput) {
            commit(activeInput, day.getAttribute('data-date') || '');
            close();
        }
    }

    /** @param {KeyboardEvent} event */
    function onPanelKeydown(event) {
        if (!panel || panel.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        var delta = moves[event.key];
        if (!delta) return;
        var days = Array.prototype.slice.call(panel.querySelectorAll('.sok-datepicker-day'));
        var index = days.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        var nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= days.length) {
            var nextMonth = new Date(viewYear, viewMonth + (nextIndex < 0 ? -1 : 1), 1);
            viewYear = nextMonth.getFullYear();
            viewMonth = nextMonth.getMonth();
            render();
            days = Array.prototype.slice.call(panel.querySelectorAll('.sok-datepicker-day'));
            nextIndex = nextIndex < 0 ? days.length + delta : delta;
        }
        var next = days[nextIndex];
        if (next instanceof HTMLElement) next.focus();
    }

    /** @param {HTMLInputElement} input */
    function bindInput(input) {
        if (input.hasAttribute('data-sok-datepicker')) return;
        input.setAttribute('data-sok-datepicker', '1');
        input.setAttribute('readonly', 'readonly');
        input.setAttribute('aria-haspopup', 'dialog');
        input.addEventListener('click', function () {
            openFor(input);
        });
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                event.preventDefault();
                openFor(input);
            }
        });
        input.addEventListener('change', function () {
            if (panel && !panel.hidden) render();
        });
    }

    /** @param {Document | Element} root */
    function bindAll(root) {
        // Węzeł dodany bezpośrednio (nie kontener) nie łapie się w querySelectorAll.
        if (root instanceof HTMLInputElement && /^(date|datetime-local)$/.test(root.type)) {
            bindInput(root);
        }
        root.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(
            function (node) {
                if (node instanceof HTMLInputElement) bindInput(node);
            }
        );
    }

    function init() {
        bindAll(document);
        document.addEventListener('mousedown', function (event) {
            if (!panel || panel.hidden) return;
            var target = event.target instanceof Node ? event.target : null;
            if (target && (panel.contains(target) || target === activeInput)) return;
            close();
        });
        document.addEventListener('keydown', onPanelKeydown);
        window.addEventListener('resize', function () {
            if (panel && !panel.hidden) position();
        });
        window.addEventListener(
            'scroll',
            function () {
                if (panel && !panel.hidden) position();
            },
            true
        );
        // Pola z modali i partiali wstawiane po starcie (print, opieka, karta budowy).
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                Array.prototype.forEach.call(record.addedNodes, function (node) {
                    if (node instanceof HTMLElement) bindAll(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
