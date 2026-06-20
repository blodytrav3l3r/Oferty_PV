// @ts-check
/* ===== Kalkulator wyrażeń w polach input ===== */

/* Bezpieczny parser CSP — nie używa eval/new Function */
(function () {
    const EXPR_RE = /^[\d\s+\-*/().]+$/;

    /* Recursive descent parser: +, -, *, /, (), unary -, liczby */
    function safeEval(expr) {
        expr = expr.replace(/\s/g, '');
        if (expr === '') return null;
        let pos = 0;

        function peek() { return pos < expr.length ? expr[pos] : '\0'; }
        function consume() { return pos < expr.length ? expr[pos++] : '\0'; }

        function parseNumber() {
            let start = pos;
            if (peek() === '-' || peek() === '+') pos++;
            while (pos < expr.length && /\d/.test(expr[pos])) pos++;
            if (pos < expr.length && expr[pos] === '.') {
                pos++;
                while (pos < expr.length && /\d/.test(expr[pos])) pos++;
            }
            if (start === pos) return NaN;
            return parseFloat(expr.slice(start, pos));
        }

        function parseFactor() {
            if (peek() === '(') {
                consume();
                const val = parseExpression();
                if (peek() !== ')') return NaN;
                consume();
                return val;
            }
            if (peek() === '-') {
                consume();
                return -parseFactor();
            }
            if (peek() === '+') {
                consume();
                return parseFactor();
            }
            return parseNumber();
        }

        function parseTerm() {
            let left = parseFactor();
            if (!isFinite(left)) return NaN;
            while (peek() === '*' || peek() === '/') {
                const op = consume();
                const right = parseFactor();
                if (!isFinite(right)) return NaN;
                if (op === '*') left *= right;
                else {
                    if (right === 0) return NaN;
                    left /= right;
                }
            }
            return left;
        }

        function parseExpression() {
            let left = parseTerm();
            if (!isFinite(left)) return NaN;
            while (peek() === '+' || peek() === '-') {
                const op = consume();
                const right = parseTerm();
                if (!isFinite(right)) return NaN;
                if (op === '+') left += right;
                else left -= right;
            }
            return left;
        }

        const result = parseExpression();
        if (!isFinite(result)) return null;
        return result;
    }

    window.parseCalcExpression = function (str) {
        if (str === null || str === undefined) return null;
        str = String(str).trim();
        if (str === '') return null;
        str = str.replace(/,/g, '.');

        if (!str.startsWith('=')) return parseFloat(str);

        const expr = str.slice(1).trim();
        if (expr === '') return null;
        if (!EXPR_RE.test(expr)) return null;

        const result = safeEval(expr);
        if (result === null) return null;
        return Math.round(result * 1000) / 1000;
    };

    /* Pomocnicza: wartość z pola → wynik liczbowy */
    window.resolveFieldValue = function (inputEl) {
        if (!inputEl) return null;
        const raw = inputEl.value;
        const parsed = window.parseCalcExpression(raw);
        if (parsed !== null) {
            /* Zamień wyrażenie na wynik w polu — pokaż użytkownikowi wartość */
            inputEl.value = String(parsed);
        }
        return parsed;
    };
})();
