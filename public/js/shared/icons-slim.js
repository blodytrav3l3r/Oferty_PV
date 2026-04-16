/**
 * icons-slim.js — Lekka biblioteka ikon SVG (tylko 76 używanych ikon).
 * Zastępuje lucide.min.js (388KB) — ten plik waży ~15KB.
 * API kompatybilne z lucide: window.lucide.createIcons()
 *
 * Generowany automatycznie — nie edytuj ręcznie.
 */
(function(global) {
    'use strict';

    // Mapa ikon: nazwa -> tablica elementów SVG (innerHTML)
    var ICONS = {
        'alert-circle': ['<circle cx="12" cy="12" r="10"/>','<line x1="12" x2="12" y1="8" y2="12"/>','<line x1="12" x2="12.01" y1="16" y2="16"/>'],
        'alert-triangle': ['<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>','<path d="M12 9v4"/>','<path d="M12 17h.01"/>'],
        'archive': ['<rect width="20" height="5" x="2" y="3" rx="1"/>','<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>','<path d="M10 12h4"/>'],
        'arrow-right': ['<path d="M5 12h14"/>','<path d="m12 5 7 7-7 7"/>'],
        'ban': ['<circle cx="12" cy="12" r="10"/>','<path d="m4.9 4.9 14.2 14.2"/>'],
        'banknote': ['<rect width="20" height="12" x="2" y="6" rx="2"/>','<circle cx="12" cy="12" r="2"/>','<path d="M6 12h.01M18 12h.01"/>'],
        'bar-chart-2': ['<line x1="18" x2="18" y1="20" y2="10"/>','<line x1="12" x2="12" y1="20" y2="4"/>','<line x1="6" x2="6" y1="20" y2="14"/>'],
        'book-open': ['<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>','<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'],
        'bot': ['<path d="M12 8V4H8"/>','<rect width="16" height="12" x="4" y="8" rx="2"/>','<path d="M2 14h2"/>','<path d="M20 14h2"/>','<path d="M15 13v2"/>','<path d="M9 13v2"/>'],
        'brain': ['<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>','<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>','<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>','<path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>','<path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>','<path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>','<path d="M19.938 10.5a4 4 0 0 1 .585.396"/>','<path d="M6 18a4 4 0 0 1-1.967-.516"/>','<path d="M19.967 17.484A4 4 0 0 1 18 18"/>'],
        'brick-wall': ['<rect width="18" height="18" x="3" y="3" rx="2"/>','<path d="M12 9v6"/>','<path d="M16 15v6"/>','<path d="M8 15v6"/>','<path d="M3 15h18"/>','<path d="M3 9h18"/>'],
        'briefcase': ['<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>','<rect width="20" height="14" x="2" y="6" rx="2"/>'],
        'building-2': ['<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>','<path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>','<path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>','<path d="M10 6h4"/>','<path d="M10 10h4"/>','<path d="M10 14h4"/>','<path d="M10 18h4"/>'],
        'calendar': ['<path d="M8 2v4"/>','<path d="M16 2v4"/>','<rect width="18" height="18" x="3" y="4" rx="2"/>','<path d="M3 10h18"/>'],
        'check': ['<path d="M20 6 9 17l-5-5"/>'],
        'check-check': ['<path d="M18 6 7 17l-5-5"/>','<path d="m22 10-7.5 7.5L13 16"/>'],
        'check-circle-2': ['<circle cx="12" cy="12" r="10"/>','<path d="m9 12 2 2 4-4"/>'],
        'chevron-down': ['<path d="m6 9 6 6 6-6"/>'],
        'chevron-left': ['<path d="m15 18-6-6 6-6"/>'],
        'chevron-right': ['<path d="m9 18 6-6-6-6"/>'],
        'chevron-up': ['<path d="m18 15-6-6-6 6"/>'],
        'chevrons-down': ['<path d="m7 6 5 5 5-5"/>','<path d="m7 13 5 5 5-5"/>'],
        'circle': ['<circle cx="12" cy="12" r="10"/>'],
        'circle-check': ['<circle cx="12" cy="12" r="10"/>','<path d="m9 12 2 2 4-4"/>'],
        'circle-dot': ['<circle cx="12" cy="12" r="10"/>','<circle cx="12" cy="12" r="1"/>'],
        'circle-x': ['<circle cx="12" cy="12" r="10"/>','<path d="m15 9-6 6"/>','<path d="m9 9 6 6"/>'],
        'clipboard-list': ['<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>','<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>','<path d="M12 11h4"/>','<path d="M12 16h4"/>','<path d="M8 11h.01"/>','<path d="M8 16h.01"/>'],
        'cylinder': ['<ellipse cx="12" cy="5" rx="9" ry="3"/>','<path d="M3 5v14a9 3 0 0 0 18 0V5"/>'],
        'diamond': ['<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"/>'],
        'dog': ['<path d="M11.25 16.25h1.5L12 17z"/>','<path d="M16 14v.5"/>','<path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/>','<path d="M8 14v.5"/>','<path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/>'],
        'download': ['<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>','<polyline points="7 10 12 15 17 10"/>','<line x1="12" x2="12" y1="15" y2="3"/>'],
        'droplets': ['<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>','<path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>'],
        'dumbbell': ['<path d="M14.4 14.4 9.6 9.6"/>','<path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/>','<path d="m21.5 21.5-1.4-1.4"/>','<path d="M3.9 3.9 2.5 2.5"/>','<path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>'],
        'edit': ['<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>','<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'],
        'eye': ['<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>','<circle cx="12" cy="12" r="3"/>'],
        'factory': ['<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>','<path d="M17 18h1"/>','<path d="M12 18h1"/>','<path d="M7 18h1"/>'],
        'file-text': ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>','<path d="M14 2v4a2 2 0 0 0 2 2h4"/>','<path d="M10 9H8"/>','<path d="M16 13H8"/>','<path d="M16 17H8"/>'],
        'folder-open': ['<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'],
        'hand': ['<path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>','<path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/>','<path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/>','<path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'],
        'hard-hat': ['<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/>','<path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/>','<path d="M4 15v-3a6 6 0 0 1 6-6"/>','<path d="M14 6a6 6 0 0 1 6 6v3"/>'],
        'help-circle': ['<circle cx="12" cy="12" r="10"/>','<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>','<path d="M12 17h.01"/>'],
        'home': ['<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>','<polyline points="9 22 9 12 15 12 15 22"/>'],
        'hourglass': ['<path d="M5 22h14"/>','<path d="M5 2h14"/>','<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>','<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'],
        'hourglass-2': ['<path d="M5 22h14"/>','<path d="M5 2h14"/>','<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>','<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'],
        'key': ['<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/>','<path d="m21 2-9.6 9.6"/>','<circle cx="7.5" cy="15.5" r="5.5"/>'],
        'layers': ['<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>','<path d="m22.54 12.43-10 4.55a2 2 0 0 1-1.07 0l-10-4.55"/>','<path d="m22.54 16.43-10 4.55a2 2 0 0 1-1.07 0l-10-4.55"/>'],
        'link': ['<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>','<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'],
        'lock': ['<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>','<path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
        'log-out': ['<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>','<polyline points="16 17 21 12 16 7"/>','<line x1="21" x2="9" y1="12" y2="12"/>'],
        'map-pin': ['<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>','<circle cx="12" cy="10" r="3"/>'],
        'monitor': ['<rect width="20" height="14" x="2" y="3" rx="2"/>','<line x1="8" x2="16" y1="21" y2="21"/>','<line x1="12" x2="12" y1="17" y2="21"/>'],
        'package': ['<path d="m7.5 4.27 9 5.15"/>','<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>','<path d="m3.3 7 8.7 5 8.7-5"/>','<path d="M12 22V12"/>'],
        'pencil': ['<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>','<path d="m15 5 4 4"/>'],
        'pen-tool': ['<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/>','<path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/>','<path d="m2.3 2.3 7.286 7.286"/>','<circle cx="11" cy="11" r="2"/>'],
        'phone': ['<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'],
        'plug': ['<path d="M12 22v-5"/>','<path d="M9 8V2"/>','<path d="M15 8V2"/>','<path d="M18 8v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z"/>'],
        'plus': ['<path d="M5 12h14"/>','<path d="M12 5v14"/>'],
        'printer': ['<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>','<path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/>','<rect x="6" y="14" width="12" height="8" rx="1"/>'],
        'recycle': ['<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>','<path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>','<path d="m14 16-3 3 3 3"/>','<path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>','<path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>','<path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>'],
        'refresh-cw': ['<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>','<path d="M21 3v5h-5"/>','<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>','<path d="M3 21v-5h5"/>'],
        'route': ['<circle cx="6" cy="19" r="3"/>','<path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>','<circle cx="18" cy="5" r="3"/>'],
        'ruler': ['<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>','<path d="m14.5 12.5 2-2"/>','<path d="m11.5 9.5 2-2"/>','<path d="m8.5 6.5 2-2"/>','<path d="m17.5 15.5 2-2"/>'],
        'save': ['<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>','<path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>','<path d="M7 3v4a1 1 0 0 0 1 1h7"/>'],
        'scroll-text': ['<path d="M15 12h-5"/>','<path d="M15 8h-5"/>','<path d="M19 17V5a2 2 0 0 0-2-2H4"/>','<path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2"/>'],
        'search': ['<circle cx="11" cy="11" r="8"/>','<path d="m21 21-4.3-4.3"/>'],
        'settings': ['<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>','<circle cx="12" cy="12" r="3"/>'],
        'shield': ['<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'],
        'sparkles': ['<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>','<path d="M20 3v4"/>','<path d="M22 5h-4"/>'],
        'square': ['<rect width="18" height="18" x="3" y="3" rx="2"/>'],
        'tag': ['<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>','<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'],
        'trash-2': ['<path d="M3 6h18"/>','<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>','<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>','<line x1="10" x2="10" y1="11" y2="17"/>','<line x1="14" x2="14" y1="11" y2="17"/>'],
        'triangle-right': ['<path d="M22 18a2 2 0 0 1-2 2H3c-1.1 0-1.3-.6-.4-1.3L20.4 4.3c.9-.7 1.6-.4 1.6.7Z"/>'],
        'truck': ['<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>','<path d="M15 18H9"/>','<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>','<circle cx="17" cy="18" r="2"/>','<circle cx="7" cy="18" r="2"/>'],
        'unlock': ['<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>','<path d="M7 11V7a5 5 0 0 1 9.9-1"/>'],
        'upload': ['<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>','<polyline points="17 8 12 3 7 8"/>','<line x1="12" x2="12" y1="3" y2="15"/>'],
        'user': ['<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>','<circle cx="12" cy="7" r="4"/>'],
        'users': ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>','<circle cx="9" cy="7" r="4"/>','<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>','<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
        'x': ['<path d="M18 6 6 18"/>','<path d="m6 6 12 12"/>'],
        'x-circle': ['<circle cx="12" cy="12" r="10"/>','<path d="m15 9-6 6"/>','<path d="m9 9 6 6"/>'],
        'zap': ['<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'],
    };

    // Domyślne atrybuty SVG (identyczne z Lucide)
    var SVG_ATTRS = {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '24',
        height: '24',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    };

    /**
     * Zastępuje element <i data-lucide="name"> gotowym <svg>.
     * @param {HTMLElement} el - Element do zamiany
     */
    function replaceElement(el) {
        var name = el.getAttribute('data-lucide');
        if (!name || !ICONS[name]) return;

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        // Ustaw atrybuty bazowe
        for (var attr in SVG_ATTRS) {
            svg.setAttribute(attr, SVG_ATTRS[attr]);
        }

        // Dodaj klasy CSS (jak Lucide: 'lucide lucide-icon-name')
        var existingClass = el.getAttribute('class') || '';
        svg.setAttribute('class', ('lucide lucide-' + name + ' ' + existingClass).trim());

        // Zachowaj atrybuty stylowe z oryginalnego elementu
        if (el.hasAttribute('style')) {
            svg.setAttribute('style', el.getAttribute('style'));
        }

        // Wstaw ścieżki SVG
        svg.innerHTML = ICONS[name].join('');

        // Zamień element
        el.replaceWith(svg);
    }

    /**
     * Skanuje DOM i zamienia wszystkie tagi <i data-lucide> na <svg>.
     * Bezpieczna do wielokrotnego wywołania (idempotentna).
     * @param {Object} [opts] - Opcje (kompatybilność z Lucide API)
     */
    function createIcons(opts) {
        var root = (opts && opts.root) || document;
        var pending = root.querySelectorAll('i[data-lucide]');
        for (var i = 0; i < pending.length; i++) {
            replaceElement(pending[i]);
        }
    }

    // Ekspozycja API (kompatybilna z window.lucide)
    global.lucide = {
        createIcons: createIcons,
        icons: ICONS
    };

    // Automatyczna hydracja po załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { createIcons(); });
    } else {
        createIcons();
    }

    // MutationObserver — automatyczna hydracja dynamicznie dodawanych ikon
    // Zastępuje stary setInterval(hydrateLucideIcons, 800) z iconMap.js
    if (typeof MutationObserver !== 'undefined') {
        var debounceTimer = null;
        var observer = new MutationObserver(function(mutations) {
            var hasPending = false;
            for (var m = 0; m < mutations.length; m++) {
                var added = mutations[m].addedNodes;
                for (var n = 0; n < added.length; n++) {
                    var node = added[n];
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === 'I' && node.hasAttribute('data-lucide')) {
                        hasPending = true;
                        break;
                    }
                    if (node.querySelector && node.querySelector('i[data-lucide]')) {
                        hasPending = true;
                        break;
                    }
                }
                if (hasPending) break;
            }
            if (hasPending) {
                // Debounce — zbiera wiele mutacji w jedno wywołanie (16ms = 1 klatka)
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(createIcons, 16);
            }
        });
        // Obserwuj tylko dodawanie nowych elementów (childList), nie atrybuty
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    }

})(typeof window !== 'undefined' ? window : this);
