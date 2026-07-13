// @ts-check
/**
 * Shared UI Module — wspólne komponenty interfejsu.
 * Część 1: podstawowe narzędzia (escapeHtml, debounce, toast, modal, section).
 */

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
}
window.setText = setText;

function getUserDisplayName(user) {
    if (!user) return '';
    return user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username || '';
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
window.debounce = debounce;

function trapFocus(container) {
    const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        if (e.key === 'Escape') closeModal();
    });
}

function showToast(msg, type = 'info') {
    const container =
        document.getElementById('toast-container') || document.querySelector('.toast-container');
    if (!container) {
        logger.warn('ui', 'showToast: brak #toast-container w HTML');
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const text = document.createElement('span');
    text.style.flex = '1';
    const iconRegex = /<i\s+data-lucide="([^"]*)"\s*><\/i>/gi;
    let lastIndex = 0;
    let match;
    while ((match = iconRegex.exec(msg)) !== null) {
        if (match.index > lastIndex) {
            text.appendChild(document.createTextNode(msg.slice(lastIndex, match.index)));
        }
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', match[1]);
        text.appendChild(icon);
        lastIndex = iconRegex.lastIndex;
    }
    if (lastIndex < msg.length) {
        text.appendChild(document.createTextNode(msg.slice(lastIndex)));
    }
    toast.appendChild(text);

    const closeBtn = document.createElement('button');
    const closeIcon = document.createElement('i');
    closeIcon.setAttribute('data-lucide', 'x');
    closeIcon.setAttribute('aria-hidden', 'true');
    closeBtn.appendChild(closeIcon);
    closeBtn.style.cssText =
        'background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;padding:0 0 0 .5rem;opacity:.7;';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function closeModal(id) {
    if (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    } else {
        document.querySelectorAll('.js-modal-overlay').forEach((m) => m.remove());
    }
}

function toggleCard(contentIdOrHeader, iconId) {
    if (contentIdOrHeader instanceof HTMLElement) {
        const header = contentIdOrHeader;
        const card = header.closest('.card');
        if (!card) return;
        const body = card.querySelector('.card-body');
        if (!body) return;
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
        const icon = header.querySelector('.toggle-icon');
        if (icon) icon.textContent = body.style.display === 'none' ? '▸' : '▾';
    } else if (typeof contentIdOrHeader === 'string') {
        const content = document.getElementById(contentIdOrHeader);
        const icon = iconId ? document.getElementById(iconId) : null;
        if (content) {
            content.classList.toggle('hidden');
            if (icon) {
                const isHidden = content.classList.contains('hidden');
                icon.innerHTML = isHidden
                    ? '<i data-lucide=\"chevron-down\"></i>'
                    : '<i data-lucide=\"chevron-up\"></i>';
            }
        }
    }
}

function showSection(name) {
    document.querySelectorAll('.section').forEach((s) => {
        const isTarget = s.id === 'section-' + name;
        s.style.display = isTarget ? 'block' : 'none';
        s.classList.toggle('active', isTarget);
    });
    document.querySelectorAll('.nav-link, .nav-btn').forEach((n) => {
        n.classList.toggle('active', n.getAttribute('data-section') === name);
    });
}

window.showModal = function (opts) {
    const existing = document.getElementById(opts.id);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-modal-overlay';
    overlay.id = opts.id;
    overlay.role = 'dialog';
    overlay.ariaModal = 'true';
    if (opts.titleId) overlay.setAttribute('aria-labelledby', opts.titleId);

    overlay.innerHTML = opts.html;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    });

    overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    });

    trapFocus(overlay);

    const firstBtn = overlay.querySelector('button');
    if (firstBtn)
        setTimeout(function () {
            firstBtn.focus();
        }, 50);

    if (opts.onOpen) opts.onOpen();
    return overlay;
};

if (typeof registerCspAction === 'function') {
    registerCspAction('closeModal', closeModal);
}
