/* ═══════════════════════════════════════════════════════════════
   ALEX — COGNITIVE COMPOUNDING ENGINE
   app.js — Complete Application Logic (No external dependencies)
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. CONSTANTS & CONFIG ─────────────────────────────────── */
const ALEX = {
    DB_NAME: 'alex_vault',
    DB_VERSION: 1,
    STORES: {
        BOOKS: 'books',
        IDEAS: 'ideas',
        INSIGHTS: 'insights',
        QUOTES: 'quotes',
        DECISIONS: 'decisions',
        FILES: 'files',
        ACTIVITY: 'activity',
        META: 'meta',
        CHATS: 'chats',
        DOWNLOADS: 'downloads',
    },
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    DOWNLOAD_SOURCES: {
        open_library: { label: 'Open Library', icon: '📚', base: 'https://openlibrary.org' },
        internet_archive: { label: 'Internet Archive', icon: '🏛️', base: 'https://archive.org' },
        project_gutenberg: { label: 'Project Gutenberg', icon: '📖', base: 'https://www.gutenberg.org' },
        standard_ebooks: { label: 'Standard Ebooks', icon: '✨', base: 'https://standardebooks.org' },
        manybooks: { label: 'ManyBooks', icon: '📕', base: 'https://manybooks.net' },
    },
    ACCEPTED_TYPES: {
        'application/pdf': { ext: 'pdf', icon: '📕', label: 'PDF' },
        'application/msword': { ext: 'word', icon: '📘', label: 'Word' },
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', icon: '📘', label: 'Word' },
    },
    STATUS_LABELS: {
        to_read: 'To Read',
        reading: 'Reading',
        finished: 'Finished',
        abandoned: 'Abandoned',
    },
    MOOD_LABELS: {
        focused: '🎯 Focused',
        breakthrough: '💡 Breakthrough',
        reflective: '🌊 Reflective',
        confused: '🌀 Confused',
        uncertain: '❓ Uncertain',
    },
    PRIORITY_LABELS: { low: 'Low', strategic: 'Strategic', dangerous: 'Dangerous 🔥' },
    API_TIMEOUT: 8000,
};

/* ── 2. STATE ──────────────────────────────────────────────── */
const State = {
    user: null,
    db: null,
    currentPage: 'dashboard',
    editingId: null,
    books: [],
    ideas: [],
    insights: [],
    quotes: [],
    decisions: [],
    files: [],
    activity: [],
    researchResults: [],
    citationSelected: new Set(),
    citationFormat: 'apa7',
    libraryView: 'grid',
    libraryFilter: '',
    libraryStatus: '',
    storageFilter: '',
    storageType: '',
    storageSort: 'date_desc',
    insightMood: '',
    graphNodes: [],
    graphEdges: [],
    // AI Chat
    chatModel: 'gpt',
    chatHistory: [],
    chatConversations: [],
    chatCurrentId: null,
    chatStreaming: false,
    // Search Engines
    engines: {},
    activeEngine: 'google_books',
    // Downloads
    downloadResults: [],
    downloadHistory: [],
    // Settings / Usage
    aiUsage: { gptCalls: 0, claudeCalls: 0, tokens: 0, downloads: 0 },
};

/* ── 3. UTILITY FUNCTIONS ──────────────────────────────────── */
const Utils = {
    id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),

    ts: () => new Date().toISOString(),

    formatDate: (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    timeAgo: (iso) => {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(mins / 60);
        const days = Math.floor(hrs / 24);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        if (hrs < 24) return `${hrs}h ago`;
        if (days < 7) return `${days}d ago`;
        return Utils.formatDate(iso);
    },

    formatBytes: (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    },

    sanitize: (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    },

    parseTagsInput: (str) =>
        (str || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),

    titleSimilarity: (a, b) => {
        if (!a || !b) return 0;
        const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        if (na === nb) return 1;
        const setA = new Set(na.split(' '));
        const setB = new Set(nb.split(' '));
        const inter = [...setA].filter(x => setB.has(x)).length;
        return inter / Math.max(setA.size, setB.size);
    },

    debounce: (fn, delay) => {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    },

    greet: () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    },

    clamp: (v, min, max) => Math.min(Math.max(v, min), max),
};

/* ── 4. TOAST SYSTEM ───────────────────────────────────────── */
const Toast = {
    show(msg, type = 'info', duration = 3500) {
        const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${Utils.sanitize(msg)}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, duration);
    },
    success: (m) => Toast.show(m, 'success'),
    error: (m) => Toast.show(m, 'error'),
    info: (m) => Toast.show(m, 'info'),
    warn: (m) => Toast.show(m, 'warning'),
};

/* ── 5. INDEXEDDB ENGINE ───────────────────────────────────── */
const DB = {
    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(ALEX.DB_NAME, ALEX.DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                const stores = [
                    [ALEX.STORES.BOOKS, 'id'],
                    [ALEX.STORES.IDEAS, 'id'],
                    [ALEX.STORES.INSIGHTS, 'id'],
                    [ALEX.STORES.QUOTES, 'id'],
                    [ALEX.STORES.DECISIONS, 'id'],
                    [ALEX.STORES.FILES, 'id'],
                    [ALEX.STORES.ACTIVITY, 'id'],
                    [ALEX.STORES.META, 'key'],
                    [ALEX.STORES.CHATS, 'id'],
                    [ALEX.STORES.DOWNLOADS, 'id'],
                ];
                stores.forEach(([name, key]) => {
                    if (!db.objectStoreNames.contains(name)) {
                        db.createObjectStore(name, { keyPath: key });
                    }
                });
            };

            req.onsuccess = (e) => {
                State.db = e.target.result;
                resolve(e.target.result);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async getAll(store) {
        return new Promise((resolve, reject) => {
            const tx = State.db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    async put(store, item) {
        return new Promise((resolve, reject) => {
            const tx = State.db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async delete(store, id) {
        return new Promise((resolve, reject) => {
            const tx = State.db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async get(store, id) {
        return new Promise((resolve, reject) => {
            const tx = State.db.transaction(store, 'readonly');
            const req = tx.objectStore(store).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async clearAll() {
        const storeNames = Object.values(ALEX.STORES);
        return new Promise((resolve, reject) => {
            const tx = State.db.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => tx.objectStore(name).clear());
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getMeta(key) {
        const r = await DB.get(ALEX.STORES.META, key).catch(() => null);
        return r ? r.value : null;
    },

    async setMeta(key, value) {
        return DB.put(ALEX.STORES.META, { key, value });
    },
};

/* ── 6. ACTIVITY LOG ───────────────────────────────────────── */
const Activity = {
    async log(type, description, entityId = null) {
        const entry = {
            id: Utils.id(),
            type,
            description,
            entityId,
            created_at: Utils.ts(),
        };
        State.activity.unshift(entry);
        if (State.activity.length > 50) State.activity.length = 50;
        await DB.put(ALEX.STORES.ACTIVITY, entry);
        Render.activityFeed();
    },
};

/* ── 7. LOADING SCREEN — SPECTACULAR HEXAGON ───────────────── */
const Loader = {
    messages: [
        'Initializing neural core…',
        'Loading knowledge vault…',
        'Connecting research engines…',
        'Calibrating cognitive index…',
        'Syncing activity feed…',
        'System ready.',
    ],

    _animateHexParticles() {
        const canvas = document.getElementById('loading-hex-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = Array.from({ length: 40 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 18 + 6,
            opacity: Math.random() * 0.15 + 0.03,
            speed: Math.random() * 0.4 + 0.1,
            angle: Math.random() * Math.PI * 2,
            rotate: Math.random() * Math.PI * 2,
            rotateSpeed: (Math.random() - 0.5) * 0.01,
        }));

        let animId;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotate);
                ctx.globalAlpha = p.opacity;
                ctx.strokeStyle = '#1E90FF';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = p.size * Math.cos(angle);
                    const py = p.size * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();

                p.y -= p.speed;
                p.rotate += p.rotateSpeed;
                p.opacity += Math.sin(Date.now() * 0.002 + p.angle) * 0.001;
                if (p.y < -p.size * 2) {
                    p.y = canvas.height + p.size;
                    p.x = Math.random() * canvas.width;
                }
            });

            animId = requestAnimationFrame(draw);
        };
        draw();
        return animId;
    },

    async run() {
        const bar = document.getElementById('loading-bar-fill');
        const status = document.getElementById('loading-status');
        const total = this.messages.length;

        // Start particle animation
        const animId = this._animateHexParticles();

        // Animate central hex rings sequentially
        const rings = document.querySelectorAll('.hex-ring');
        rings.forEach((ring, i) => {
            setTimeout(() => ring.classList.add('active'), i * 180);
        });

        for (let i = 0; i < total; i++) {
            if (status) status.textContent = this.messages[i];
            if (bar) bar.style.width = `${((i + 1) / total) * 100}%`;
            await new Promise(r => setTimeout(r, i === total - 1 ? 300 : 420));
        }

        await new Promise(r => setTimeout(r, 250));

        // Cancel particle animation
        if (animId) cancelAnimationFrame(animId);

        const screen = document.getElementById('loading-screen');
        if (screen) {
            screen.classList.add('fade-out');
            setTimeout(() => screen.remove(), 800);
        }
    },
};

/* ── 8. IDENTITY GATE ──────────────────────────────────────── */
const Identity = {
    async init() {
        const savedUser = await DB.getMeta('user_name');
        if (savedUser) {
            State.user = savedUser;
            await App.loadAll();
            App.boot();
        } else {
            this.showGate();
        }
    },

    showGate() {
        const gate = document.getElementById('identity-gate');
        gate.classList.remove('hidden');

        const input = document.getElementById('user-name-input');
        const btn = document.getElementById('gate-enter-btn');

        input.addEventListener('input', () => {
            btn.disabled = input.value.trim().length < 2;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !btn.disabled) btn.click();
        });

        btn.addEventListener('click', async () => {
            const name = input.value.trim();
            if (name.length < 2) return;
            State.user = name;
            await DB.setMeta('user_name', name);
            gate.classList.add('hidden');
            await App.loadAll();
            App.boot();
        });

        setTimeout(() => input.focus(), 300);
    },
};

/* ── 9. NAVIGATION ─────────────────────────────────────────── */
const Nav = {
    pageIcons: {
        dashboard: 'fa-gauge-high',
        research: 'fa-globe',
        library: 'fa-book-open',
        bookstorage: 'fa-folder-open',
        ideas: 'fa-lightbulb',
        insights: 'fa-brain',
        quotes: 'fa-quote-left',
        decisions: 'fa-scale-balanced',
        analytics: 'fa-chart-line',
        graph: 'fa-diagram-project',
        citations: 'fa-file-lines',
        'ai-chat': 'fa-robot',
        'book-download': 'fa-cloud-arrow-down',
        'search-engines': 'fa-sliders',
        settings: 'fa-gear',
    },
    pageTitles: {
        dashboard: 'Dashboard',
        research: 'Search Web',
        library: 'My Library',
        bookstorage: 'Book Storage',
        ideas: 'Idea Pipeline',
        insights: 'Insight Journal',
        quotes: 'Quote Arsenal',
        decisions: 'Decision Intelligence',
        analytics: 'Analytics',
        graph: 'Knowledge Graph',
        citations: 'Citation Engine',
        'ai-chat': 'AI Assistant',
        'book-download': 'Book Download',
        'search-engines': 'Search Engines',
        settings: 'Settings & API',
    },

    go(page) {
        if (State.currentPage === page) return;
        State.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
            if (el.dataset.page === page) el.setAttribute('aria-current', 'page');
            else el.removeAttribute('aria-current');
        });

        document.querySelectorAll('.page').forEach(el => {
            const active = el.id === `page-${page}`;
            el.classList.toggle('active', active);
            if (active) el.style.display = 'block';
            else el.style.display = 'none';
        });

        const icon = this.pageIcons[page] || 'fa-circle';
        const topbarIcon = document.getElementById('topbar-icon');
        const topbarTitle = document.getElementById('topbar-title');
        if (topbarIcon) topbarIcon.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        if (topbarTitle) topbarTitle.textContent = this.pageTitles[page] || page;

        Sidebar.close();
        this.renderPage(page);
    },

    renderPage(page) {
        switch (page) {
            case 'dashboard':      Render.dashboard();           break;
            case 'library':        Render.library();             break;
            case 'bookstorage':    Render.storage();             break;
            case 'ideas':          Render.ideas();               break;
            case 'insights':       Render.insights();            break;
            case 'quotes':         Render.quotes();              break;
            case 'decisions':      Render.decisions();           break;
            case 'analytics':      Render.analytics();           break;
            case 'graph':          Render.graph();               break;
            case 'citations':      Render.citations();           break;
            case 'ai-chat':        AIChat.onPageEnter();         break;
            case 'book-download':  BookDownload.onPageEnter();   break;
            case 'search-engines': SearchEngines.onPageEnter();  break;
            case 'settings':       Settings.onPageEnter();       break;
        }
    },
};

/* ── 10. SIDEBAR ───────────────────────────────────────────── */
const Sidebar = {
    open() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.remove('hidden');
        document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', 'true');
    },
    close() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.add('hidden');
        const btn = document.getElementById('mobile-menu-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    },
    toggle() {
        const isOpen = document.getElementById('sidebar').classList.contains('open');
        isOpen ? this.close() : this.open();
    },
};

/* ── 11. MODAL SYSTEM ──────────────────────────────────────── */
const Modal = {
    open(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeAttribute('hidden');
        el.querySelector('.modal-backdrop')?.addEventListener('click', () => Modal.close(id), { once: true });
        el.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => Modal.close(id), { once: true });
        });
        document.addEventListener('keydown', Modal._escHandler);
        setTimeout(() => el.querySelector('input, textarea')?.focus(), 100);
    },

    close(id) {
        const el = document.getElementById(id);
        if (el) {
            el.setAttribute('hidden', '');
            if (id === 'modal-book') State.editingId = null;
        }
        document.removeEventListener('keydown', Modal._escHandler);
    },

    closeAll() {
        document.querySelectorAll('.modal:not([hidden])').forEach(el => {
            el.setAttribute('hidden', '');
        });
        State.editingId = null;
    },

    _escHandler(e) {
        if (e.key === 'Escape') Modal.closeAll();
    },
};

/* ── 12. RESEARCH ENGINE ───────────────────────────────────── */
const Research = {
    async search(query, options = {}) {
        if (!query.trim()) { Toast.warn('Enter a search query.'); return; }

        const container = document.getElementById('research-results');
        const metaEl = document.getElementById('results-meta');
        const sources = [...document.querySelectorAll('[name="source"]:checked')].map(el => el.value);

        if (!sources.length) { Toast.warn('Select at least one source.'); return; }

        container.innerHTML = this._loadingHTML(sources);
        metaEl.textContent = '';

        const filters = {
            type: document.getElementById('filter-type')?.value || '',
            yearFrom: document.getElementById('filter-year-from')?.value || '',
            yearTo: document.getElementById('filter-year-to')?.value || '',
            lang: document.getElementById('filter-lang')?.value || '',
            doiOnly: document.getElementById('filter-doi-only')?.checked || false,
        };

        const fetchers = {
            google_books: () => this._fetchGoogleBooks(query, filters),
            open_library: () => this._fetchOpenLibrary(query, filters),
            crossref: () => this._fetchCrossRef(query, filters),
            internet_archive: () => this._fetchInternetArchive(query, filters),
        };

        const promises = sources.map(src => {
            const chip = document.getElementById(`chip-${src}`);
            if (chip) chip.classList.add('loading');
            return (fetchers[src] || (() => Promise.resolve([])))()
                .then(results => {
                    if (chip) {
                        chip.classList.remove('loading');
                        chip.classList.add('done');
                        chip.textContent = `✓ ${chip.dataset.label}`;
                    }
                    return results;
                })
                .catch(() => {
                    if (chip) {
                        chip.classList.remove('loading');
                        chip.classList.add('error');
                    }
                    return [];
                });
        });

        const results = await Promise.all(promises);
        const flat = results.flat();
        const deduped = this._deduplicate(flat);
        const filtered = this._applyFilters(deduped, filters);
        const sortEl = document.getElementById('results-sort');
        const sorted = this._sort(filtered, sortEl ? sortEl.value : 'relevance');

        State.researchResults = sorted;
        metaEl.textContent = `${sorted.length} results found`;
        this._renderResults(sorted, container);
    },

    _loadingHTML(sources) {
        const chips = sources.map(s => {
            const labels = { google_books: 'Google Books', open_library: 'Open Library', crossref: 'CrossRef', internet_archive: 'Internet Archive' };
            return `<span class="source-chip loading" id="chip-${s}" data-label="${labels[s] || s}">${labels[s] || s}</span>`;
        }).join('');
        return `<div class="search-loading" style="grid-column:1/-1"><div class="search-spinner"></div><div class="source-loading-row">${chips}</div><p style="font-size:0.82rem;color:var(--text-tertiary)">Searching across sources…</p></div>`;
    },

    async _fetchGoogleBooks(query, filters) {
        try {
            const params = new URLSearchParams({ q: query, maxResults: 20, fields: 'items(volumeInfo,id)' });
            if (filters.lang) params.set('langRestrict', filters.lang);
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ALEX.API_TIMEOUT);
            const r = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!r.ok) return [];
            const data = await r.json();
            return (data.items || []).map(item => this._normalizeGoogleBook(item));
        } catch { return []; }
    },

    _normalizeGoogleBook(item) {
        const v = item.volumeInfo || {};
        return {
            id: Utils.id(),
            source: 'Google Books',
            type: v.printType === 'MAGAZINE' ? 'journal' : 'book',
            title: v.title || 'Unknown Title',
            authors: v.authors || [],
            year: v.publishedDate ? parseInt(v.publishedDate) : null,
            publisher: v.publisher || null,
            language: v.language || null,
            description: v.description || null,
            cover: v.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
            isbn: v.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || null,
            doi: null,
            pages: v.pageCount || null,
            subjects: v.categories || [],
            sourceId: item.id,
        };
    },

    async _fetchOpenLibrary(query, filters) {
        try {
            const params = new URLSearchParams({ q: query, limit: 15, fields: 'key,title,author_name,first_publish_year,publisher,language,isbn,cover_i,subject,number_of_pages_median' });
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ALEX.API_TIMEOUT);
            const r = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!r.ok) return [];
            const data = await r.json();
            return (data.docs || []).map(doc => ({
                id: Utils.id(),
                source: 'Open Library',
                type: 'book',
                title: doc.title || 'Unknown Title',
                authors: doc.author_name || [],
                year: doc.first_publish_year || null,
                publisher: doc.publisher?.[0] || null,
                language: doc.language?.[0] || null,
                description: null,
                cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
                isbn: doc.isbn?.[0] || null,
                doi: null,
                pages: doc.number_of_pages_median || null,
                subjects: doc.subject?.slice(0, 5) || [],
                sourceId: doc.key,
            }));
        } catch { return []; }
    },

    async _fetchCrossRef(query, filters) {
        try {
            const params = new URLSearchParams({ query, rows: 15, select: 'DOI,title,author,published,publisher,type,abstract,language,ISBN,subject,page' });
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ALEX.API_TIMEOUT);
            const r = await fetch(`https://api.crossref.org/works?${params}`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!r.ok) return [];
            const data = await r.json();
            return (data.message?.items || []).map(item => ({
                id: Utils.id(),
                source: 'CrossRef',
                type: item.type?.includes('journal') ? 'journal' : item.type?.includes('thesis') ? 'thesis' : 'book',
                title: item.title?.[0] || 'Unknown Title',
                authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()),
                year: item.published?.['date-parts']?.[0]?.[0] || null,
                publisher: item.publisher || null,
                language: item.language || null,
                description: item.abstract?.replace(/<[^>]+>/g, '') || null,
                cover: null,
                isbn: item.ISBN?.[0] || null,
                doi: item.DOI || null,
                pages: item.page || null,
                subjects: item.subject || [],
                sourceId: item.DOI,
            }));
        } catch { return []; }
    },

    async _fetchInternetArchive(query, filters) {
        try {
            const params = new URLSearchParams({ q: `${query} AND mediatype:texts`, output: 'json', rows: 10, fl: 'identifier,title,creator,date,publisher,language,description,subject' });
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ALEX.API_TIMEOUT);
            const r = await fetch(`https://archive.org/advancedsearch.php?${params}`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!r.ok) return [];
            const data = await r.json();
            return (data.response?.docs || []).map(doc => ({
                id: Utils.id(),
                source: 'Internet Archive',
                type: 'book',
                title: doc.title || 'Unknown Title',
                authors: doc.creator ? (Array.isArray(doc.creator) ? doc.creator : [doc.creator]) : [],
                year: doc.date ? parseInt(doc.date) : null,
                publisher: doc.publisher || null,
                language: doc.language || null,
                description: doc.description || null,
                cover: `https://archive.org/services/img/${doc.identifier}`,
                isbn: null,
                doi: null,
                pages: null,
                subjects: doc.subject ? (Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : [doc.subject]) : [],
                sourceId: doc.identifier,
            }));
        } catch { return []; }
    },

    _deduplicate(results) {
        const seen = { doi: new Set(), isbn: new Set() };
        const out = [];
        for (const item of results) {
            if (item.doi && seen.doi.has(item.doi)) {
                const existing = out.find(r => r.doi === item.doi);
                if (existing) this._merge(existing, item);
                continue;
            }
            if (item.isbn && seen.isbn.has(item.isbn)) {
                const existing = out.find(r => r.isbn === item.isbn);
                if (existing) this._merge(existing, item);
                continue;
            }
            const dup = out.find(r =>
                r.title && item.title &&
                Utils.titleSimilarity(r.title, item.title) >= 0.9 &&
                (!r.year || !item.year || r.year === item.year)
            );
            if (dup) { this._merge(dup, item); continue; }
            if (item.doi) seen.doi.add(item.doi);
            if (item.isbn) seen.isbn.add(item.isbn);
            out.push({ ...item });
        }
        return out;
    },

    _merge(primary, secondary) {
        if (!primary.doi && secondary.doi) primary.doi = secondary.doi;
        if (!primary.cover && secondary.source === 'Google Books') primary.cover = secondary.cover;
        if (secondary.source === 'Google Books' && secondary.cover) primary.cover = secondary.cover;
        if (!primary.description || (secondary.description && secondary.description.length > primary.description.length))
            primary.description = secondary.description || primary.description;
        if (!primary.publisher && secondary.publisher) primary.publisher = secondary.publisher;
        if (!primary.isbn && secondary.isbn) primary.isbn = secondary.isbn;
        primary.sources = [...new Set([...(primary.sources || [primary.source]), secondary.source])];
    },

    _applyFilters(results, filters) {
        return results.filter(r => {
            if (filters.type && r.type !== filters.type) return false;
            if (filters.yearFrom && r.year && r.year < parseInt(filters.yearFrom)) return false;
            if (filters.yearTo && r.year && r.year > parseInt(filters.yearTo)) return false;
            if (filters.yearFrom && !r.year) return false;
            if (filters.lang && r.language && r.language !== filters.lang) return false;
            if (filters.doiOnly && !r.doi) return false;
            return true;
        });
    },

    _sort(results, sortBy) {
        const arr = [...results];
        switch (sortBy) {
            case 'year_desc': return arr.sort((a, b) => (b.year || 0) - (a.year || 0));
            case 'year_asc':  return arr.sort((a, b) => (a.year || 0) - (b.year || 0));
            case 'title_asc': return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            default:          return arr;
        }
    },

    _renderResults(results, container) {
        if (!results.length) {
            container.innerHTML = `<div class="search-idle" style="grid-column:1/-1"><div class="idle-icon">🔭</div><h3>No results found</h3><p>Try different keywords, broaden your filters, or enable more sources.</p></div>`;
            return;
        }

        container.innerHTML = results.map(r => {
            const authors = (r.authors || []).join(', ') || 'Unknown author';
            const coverHTML = r.cover ?
                `<img class="result-cover" src="${Utils.sanitize(r.cover)}" alt="Cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
                `<div class="result-cover-placeholder" style="display:none">📖</div>` :
                `<div class="result-cover-placeholder">📖</div>`;

            const tags = [
                r.source ? `<span class="result-tag result-tag--source">${Utils.sanitize(r.source)}</span>` : '',
                r.doi ? `<span class="result-tag result-tag--doi">DOI</span>` : '',
                r.year ? `<span class="result-tag">${r.year}</span>` : '',
                r.type ? `<span class="result-tag">${r.type}</span>` : '',
            ].filter(Boolean).join('');

            const alreadyAdded = State.books.some(b => b.title === r.title || (r.doi && b.doi === r.doi));

            return `<div class="result-card" data-id="${r.id}">
        ${coverHTML}
        <div class="result-body">
          <div class="result-title">${Utils.sanitize(r.title)}</div>
          <div class="result-author">${Utils.sanitize(authors)}</div>
          <div class="result-meta">${tags}</div>
        </div>
        <div class="result-actions">
          ${alreadyAdded
                ? `<span style="font-size:0.78rem;color:var(--accent-green);padding:6px 8px"><i class="fa-solid fa-check"></i> In Library</span>`
                : `<button class="btn-sm" onclick="Books.addFromSearch('${r.id}')"><i class="fa-solid fa-plus"></i> Add</button>`
            }
          ${r.doi ? `<a class="btn-sm" href="https://doi.org/${r.doi}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> DOI</a>` : ''}
        </div>
      </div>`;
        }).join('');
    },
};

/* ── 13. BOOK STORAGE ENGINE ───────────────────────────────── */
const BookStorage = {
    init() {
        const zone = document.getElementById('upload-zone');
        const input = document.getElementById('file-input');
        const browseBtn = document.getElementById('upload-browse-btn');

        if (!zone || !input || !browseBtn) return;

        browseBtn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
        zone.addEventListener('click', (e) => { if (e.target !== browseBtn && !browseBtn.contains(e.target)) input.click(); });
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            this.handleFiles([...e.dataTransfer.files]);
        });
        zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
        input.addEventListener('change', () => {
            this.handleFiles([...input.files]);
            input.value = '';
        });

        document.getElementById('storage-search')?.addEventListener('input',
            Utils.debounce(() => { State.storageFilter = document.getElementById('storage-search').value; Render.storage(); }, 300)
        );

        document.getElementById('storage-sort')?.addEventListener('change', () => {
            State.storageSort = document.getElementById('storage-sort').value;
            Render.storage();
        });

        document.querySelectorAll('#storage-type-filter .filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#storage-type-filter .filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                State.storageType = tab.dataset.type;
                Render.storage();
            });
        });
    },

    async handleFiles(files) {
        const valid = files.filter(f => {
            if (!ALEX.ACCEPTED_TYPES[f.type]) { Toast.error(`${f.name}: Unsupported format. Use PDF or Word.`); return false; }
            if (f.size > ALEX.MAX_FILE_SIZE) { Toast.error(`${f.name}: File too large (max 50 MB).`); return false; }
            const dup = State.files.find(sf => sf.name === f.name && sf.size === f.size);
            if (dup) { Toast.warn(`${f.name} already exists.`); return false; }
            return true;
        });

        if (!valid.length) return;

        const progressArea = document.getElementById('upload-progress-area');
        if (progressArea) progressArea.classList.remove('hidden');

        for (const file of valid) {
            await this.uploadFile(file, progressArea);
        }

        setTimeout(() => {
            if (progressArea) { progressArea.classList.add('hidden'); progressArea.innerHTML = ''; }
        }, 2000);
        Render.storage();
        Render.updateBadges();
    },

    async uploadFile(file, progressArea) {
        const fileType = ALEX.ACCEPTED_TYPES[file.type];
        const itemId = Utils.id();

        const itemEl = document.createElement('div');
        itemEl.className = 'upload-progress-item';
        itemEl.innerHTML = `
      <span class="upload-file-icon">${fileType.icon}</span>
      <div class="upload-file-info">
        <div class="upload-file-name">${Utils.sanitize(file.name)}</div>
        <div class="upload-file-meta">${Utils.formatBytes(file.size)} · ${fileType.label}</div>
      </div>
      <div class="upload-progress-bar-wrap">
        <div class="upload-progress-bar"><div class="upload-progress-fill" id="fill-${itemId}" style="width:0%"></div></div>
        <div class="upload-status-text" id="status-${itemId}">Reading…</div>
      </div>`;
        if (progressArea) progressArea.appendChild(itemEl);

        const fill = document.getElementById(`fill-${itemId}`);
        const statusEl = document.getElementById(`status-${itemId}`);

        try {
            let prog = 0;
            const interval = setInterval(() => {
                prog = Math.min(prog + Math.random() * 15, 85);
                if (fill) fill.style.width = `${prog}%`;
            }, 100);

            const buffer = await file.arrayBuffer();
            clearInterval(interval);
            if (fill) fill.style.width = '95%';

            const fileRecord = {
                id: itemId,
                name: file.name,
                type: fileType.ext,
                mimeType: file.type,
                size: file.size,
                data: buffer,
                uploaded_at: Utils.ts(),
            };

            await DB.put(ALEX.STORES.FILES, fileRecord);

            const stateRecord = { ...fileRecord };
            delete stateRecord.data;
            State.files.push(stateRecord);

            if (fill) fill.style.width = '100%';
            if (statusEl) { statusEl.textContent = 'Saved ✓'; statusEl.className = 'upload-status-text upload-status-text--done'; }

            await Activity.log('file', `Uploaded "${file.name}"`, itemId);
            Toast.success(`"${file.name}" saved to vault.`);

        } catch (err) {
            if (statusEl) { statusEl.textContent = 'Failed'; statusEl.className = 'upload-status-text upload-status-text--error'; }
            Toast.error(`Failed to save "${file.name}".`);
        }
    },

    async openPreview(id) {
        const record = await DB.get(ALEX.STORES.FILES, id);
        if (!record) { Toast.error('File not found.'); return; }

        const modal = document.getElementById('modal-file-preview');
        const title = document.getElementById('modal-preview-title');
        const body = document.getElementById('modal-preview-body');
        const dlBtn = document.getElementById('preview-download-btn');

        if (title) title.textContent = record.name;

        const blob = new Blob([record.data], { type: record.mimeType });
        const url = URL.createObjectURL(blob);

        if (dlBtn) dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url; a.download = record.name; a.click();
        };

        if (body) {
            if (record.mimeType === 'application/pdf') {
                body.innerHTML = `<iframe class="preview-iframe" src="${url}#toolbar=1" title="${Utils.sanitize(record.name)}"></iframe>`;
            } else {
                body.innerHTML = `<div class="word-preview">
          <i class="fa-solid fa-file-word word-preview-icon"></i>
          <h3>${Utils.sanitize(record.name)}</h3>
          <p>Word documents cannot be previewed in-browser.<br>Download the file to open it in Microsoft Word or compatible software.</p>
          <button class="btn btn-primary" onclick="document.getElementById('preview-download-btn').click()">
            <i class="fa-solid fa-download"></i> Download File
          </button>
        </div>`;
            }
        }

        Modal.open('modal-file-preview');

        const closeBtn = modal?.querySelector('.modal-close');
        if (closeBtn) {
            const orig = closeBtn.onclick;
            closeBtn.onclick = () => { URL.revokeObjectURL(url); if (orig) orig(); };
        }
    },

    async deleteFile(id) {
        const file = State.files.find(f => f.id === id);
        if (!file) return;
        if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
        await DB.delete(ALEX.STORES.FILES, id);
        State.files = State.files.filter(f => f.id !== id);
        Toast.success('File deleted.');
        Render.storage();
        Render.updateBadges();
    },

    async downloadFile(id) {
        const record = await DB.get(ALEX.STORES.FILES, id);
        if (!record) { Toast.error('File not found.'); return; }
        const blob = new Blob([record.data], { type: record.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = record.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    calcTotalSize() {
        return State.files.reduce((sum, f) => sum + (f.size || 0), 0);
    },
};

/* ── 14. BOOKS MODULE ──────────────────────────────────────── */
const Books = {
    openAddModal(prefill = {}) {
        State.editingId = prefill.id || null;
        document.getElementById('modal-book-title').textContent = State.editingId ? 'Edit Book' : 'Add Book';

        const fields = ['title', 'author', 'year', 'publisher', 'isbn', 'doi', 'language', 'status', 'rating', 'difficulty', 'relevance', 'cover', 'description', 'thesis', 'methodology', 'historiography', 'notes', 'tags'];
        fields.forEach(f => {
            const el = document.getElementById(`book-${f}`);
            if (!el) return;
            const val = prefill[f] !== undefined ? prefill[f] : '';
            el.value = f === 'tags' && Array.isArray(val) ? val.join(', ') : (val || '');
        });

        Modal.open('modal-book');
    },

    async save() {
        const title = document.getElementById('book-title')?.value.trim();
        if (!title) { Toast.error('Title is required.'); return; }

        const rating = parseInt(document.getElementById('book-rating')?.value) || null;
        const difficulty = parseInt(document.getElementById('book-difficulty')?.value) || null;
        const relevance = parseInt(document.getElementById('book-relevance')?.value) || null;

        if (rating && (rating < 1 || rating > 5)) { Toast.error('Rating must be 1–5.'); return; }
        if (difficulty && (difficulty < 1 || difficulty > 10)) { Toast.error('Difficulty must be 1–10.'); return; }

        const isNew = !State.editingId;
        const book = {
            id: State.editingId || Utils.id(),
            title,
            author: document.getElementById('book-author')?.value.trim() || '',
            year: parseInt(document.getElementById('book-year')?.value) || null,
            publisher: document.getElementById('book-publisher')?.value.trim() || '',
            isbn: document.getElementById('book-isbn')?.value.trim() || '',
            doi: document.getElementById('book-doi')?.value.trim() || '',
            language: document.getElementById('book-language')?.value || 'en',
            status: document.getElementById('book-status')?.value || 'to_read',
            rating,
            difficulty_score: difficulty,
            relevance_score: relevance,
            cover: document.getElementById('book-cover')?.value.trim() || '',
            description: document.getElementById('book-description')?.value.trim() || '',
            main_thesis: document.getElementById('book-thesis')?.value.trim() || '',
            methodology_type: document.getElementById('book-methodology')?.value.trim() || '',
            historiography_school: document.getElementById('book-historiography')?.value.trim() || '',
            notes: document.getElementById('book-notes')?.value.trim() || '',
            tags: Utils.parseTagsInput(document.getElementById('book-tags')?.value || ''),
            created_at: isNew ? Utils.ts() : (State.books.find(b => b.id === State.editingId)?.created_at || Utils.ts()),
            updated_at: Utils.ts(),
            source: 'manual',
        };

        await DB.put(ALEX.STORES.BOOKS, book);

        if (isNew) {
            State.books.push(book);
            await Activity.log('book', `Added "${book.title}" to library`, book.id);
            Toast.success(`"${book.title}" added to library.`);
        } else {
            const idx = State.books.findIndex(b => b.id === book.id);
            if (idx > -1) State.books[idx] = book;
            Toast.success('Book updated.');
        }

        Modal.close('modal-book');
        Render.library();
        Render.updateBadges();
        if (State.currentPage === 'citations') Render.citations();
    },

    async addFromSearch(searchId) {
        const r = State.researchResults.find(r => r.id === searchId);
        if (!r) return;
        this.openAddModal({
            title: r.title,
            author: (r.authors || []).join(', '),
            year: r.year,
            publisher: r.publisher || '',
            isbn: r.isbn || '',
            doi: r.doi || '',
            language: r.language || 'en',
            cover: r.cover || '',
            description: r.description || '',
            tags: (r.subjects || []).slice(0, 5),
        });
    },

    async addFromDownload(book) {
        const exists = State.books.some(b => b.title?.toLowerCase() === book.title?.toLowerCase());
        if (exists) { Toast.warn(`"${book.title}" is already in your library.`); return; }
        const entry = {
            id: Utils.id(),
            title: book.title || 'Unknown Title',
            author: (book.authors || []).join(', ') || 'Unknown Author',
            year: book.year || null,
            isbn: book.isbn || null,
            publisher: null,
            status: 'to_read',
            rating: null,
            genre: (book.subjects || []).join(', ') || null,
            tags: ['downloaded'],
            notes: `Downloaded from ${book.source}`,
            cover: book.cover || null,
            doi: null,
            source: book.source,
            created_at: Utils.ts(),
        };
        State.books.push(entry);
        await DB.put(ALEX.STORES.BOOKS, entry);
        await Activity.log('book', `Added "${entry.title}" from ${book.source}`);
        Render.updateBadges();
        Toast.success(`"${entry.title}" added to library!`);
    },

    async delete(id) {
        const book = State.books.find(b => b.id === id);
        if (!book) return;
        if (!confirm(`Delete "${book.title}"?`)) return;
        await DB.delete(ALEX.STORES.BOOKS, id);
        State.books = State.books.filter(b => b.id !== id);
        Toast.success('Book removed from library.');
        Render.library();
        Render.updateBadges();
    },

    openDetail(id) {
        const book = State.books.find(b => b.id === id);
        if (!book) return;
        const body = document.getElementById('modal-book-detail-body');
        const titleEl = document.getElementById('modal-book-detail-title');
        if (titleEl) titleEl.textContent = book.title;

        const coverHTML = book.cover
            ? `<img class="book-detail-cover" src="${Utils.sanitize(book.cover)}" alt="Cover" onerror="this.textContent='📖'">`
            : `<div class="book-detail-cover">📖</div>`;

        const stars = book.rating
            ? Array.from({ length: 5 }, (_, i) => `<i class="fa-${i < book.rating ? 'solid' : 'regular'} fa-star${i < book.rating ? '' : ' empty'}"></i>`).join('')
            : '—';

        const metaItems = [
            { key: 'Author', value: book.author || '—' },
            { key: 'Year', value: book.year || '—' },
            { key: 'Publisher', value: book.publisher || '—' },
            { key: 'Status', value: ALEX.STATUS_LABELS[book.status] || book.status },
            { key: 'Rating', value: `<div class="star-rating">${stars}</div>` },
            { key: 'Difficulty', value: book.difficulty_score ? `${book.difficulty_score}/10` : '—' },
            { key: 'Relevance', value: book.relevance_score ? `${book.relevance_score}/10` : '—' },
            { key: 'Language', value: book.language || '—' },
            { key: 'ISBN', value: book.isbn || '—' },
            { key: 'DOI', value: book.doi ? `<a href="https://doi.org/${book.doi}" target="_blank" style="color:var(--accent-teal)">${book.doi}</a>` : '—' },
        ].map(m => `<div class="book-meta-item"><div class="book-meta-key">${m.key}</div><div class="book-meta-value">${m.value}</div></div>`).join('');

        const sections = [
            book.main_thesis && { title: 'Main Thesis', text: book.main_thesis },
            book.methodology_type && { title: 'Methodology', text: book.methodology_type },
            book.historiography_school && { title: 'Historiography School', text: book.historiography_school },
            book.description && { title: 'Description', text: book.description },
            book.notes && { title: 'Personal Notes', text: book.notes },
        ].filter(Boolean).map(s => `
      <div class="book-detail-section">
        <div class="book-detail-section-title">${s.title}</div>
        <div class="book-detail-text">${Utils.sanitize(s.text)}</div>
      </div>`).join('');

        const tagsHTML = book.tags?.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--space-md)">${book.tags.map(t => `<span class="tag-chip">${Utils.sanitize(t)}</span>`).join('')}</div>`
            : '';

        if (body) body.innerHTML = `
      <div style="display:flex;gap:var(--space-xl);align-items:flex-start;flex-wrap:wrap">
        ${coverHTML}
        <div style="flex:1;min-width:200px">
          <div class="book-meta-grid">${metaItems}</div>
        </div>
      </div>
      ${sections}
      ${tagsHTML}`;

        const editBtn = document.getElementById('book-detail-edit-btn');
        if (editBtn) editBtn.onclick = () => { Modal.close('modal-book-detail'); this.openAddModal(book); };

        Modal.open('modal-book-detail');
    },
};

/* ── 15. APP INIT ──────────────────────────────────────────── */
const App = {
    async loadAll() {
        const [books, ideas, insights, quotes, decisions, files, activity] = await Promise.all([
            DB.getAll(ALEX.STORES.BOOKS),
            DB.getAll(ALEX.STORES.IDEAS),
            DB.getAll(ALEX.STORES.INSIGHTS),
            DB.getAll(ALEX.STORES.QUOTES),
            DB.getAll(ALEX.STORES.DECISIONS),
            DB.getAll(ALEX.STORES.FILES).then(files => files.map(f => { const s = { ...f }; delete s.data; return s; })),
            DB.getAll(ALEX.STORES.ACTIVITY),
        ]);
        State.books = books;
        State.ideas = ideas;
        State.insights = insights;
        State.quotes = quotes;
        State.decisions = decisions;
        State.files = files;
        State.activity = activity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
        Settings.loadAiUsage();
        State.activeEngine = localStorage.getItem('alex_active_engine') || 'google_books';
    },

    boot() {
        document.getElementById('app').classList.remove('hidden');
        this.setupUser();
        this.setupNav();
        this.setupModals();
        this.setupGlobalSearch();
        this.setupResetSystem();
        BookStorage.init();
        this.setupResearch();
        this.setupLibraryFilters();
        this.setupInsightFilters();
        this.setupCitationEngine();
        AIChat.initEventListeners();
        BookDownload.initEventListeners();
        SearchEngines.initEventListeners();
        Settings.initEventListeners();
        Nav.go('dashboard');
        Render.updateBadges();
    },

    setupUser() {
        const name = State.user;
        const sidebarName = document.getElementById('sidebar-user-name');
        const avatar = document.getElementById('user-avatar');
        const greetingUser = document.getElementById('greeting-user');
        if (sidebarName) sidebarName.textContent = name;
        if (avatar) avatar.textContent = name[0].toUpperCase();
        if (greetingUser) greetingUser.textContent = name;
    },

    setupNav() {
        document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
            btn.addEventListener('click', () => Nav.go(btn.dataset.page));
        });

        document.querySelectorAll('[data-page-link]').forEach(card => {
            card.addEventListener('click', () => Nav.go(card.dataset.pageLink));
        });

        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => Sidebar.toggle());
        document.getElementById('sidebar-toggle-mobile')?.addEventListener('click', () => Sidebar.close());
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => Sidebar.close());

        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            Toast.info('Theme switching coming soon!');
        });
    },

    setupModals() {
        document.getElementById('add-book-btn')?.addEventListener('click', () => Books.openAddModal());
        document.getElementById('save-book-btn')?.addEventListener('click', () => Books.save());
        document.getElementById('add-idea-btn')?.addEventListener('click', () => Ideas.openAddModal());
        document.getElementById('save-idea-btn')?.addEventListener('click', () => Ideas.save());
        document.getElementById('add-insight-btn')?.addEventListener('click', () => Insights.openAddModal());
        document.getElementById('save-insight-btn')?.addEventListener('click', () => Insights.save());
        document.getElementById('add-quote-btn')?.addEventListener('click', () => Quotes.openAddModal());
        document.getElementById('save-quote-btn')?.addEventListener('click', () => Quotes.save());
        document.getElementById('add-decision-btn')?.addEventListener('click', () => Decisions.openAddModal());
        document.getElementById('save-decision-btn')?.addEventListener('click', () => Decisions.save());
        document.getElementById('add-option-btn')?.addEventListener('click', () => Decisions.addOptionField());
        document.getElementById('resurface-quote-btn')?.addEventListener('click', () => Render.dashboardQuote());
        document.getElementById('resurface-all-btn')?.addEventListener('click', () => Render.quotes());
    },

    setupGlobalSearch() {
        const input = document.getElementById('global-search');
        if (!input) return;
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });

        input.addEventListener('input', Utils.debounce(() => {
            const q = input.value.trim().toLowerCase();
            if (!q) return;
            Toast.info(`Searching for "${q}"…`);
        }, 400));
    },

    setupResetSystem() {
        document.getElementById('reset-data-btn')?.addEventListener('click', () => {
            const inputEl = document.getElementById('reset-confirm-input');
            const confirmBtn = document.getElementById('confirm-reset-btn');
            if (inputEl) inputEl.value = '';
            if (confirmBtn) confirmBtn.disabled = true;
            Modal.open('modal-reset');
        });

        document.getElementById('reset-confirm-input')?.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            const userName = (State.user || '').toLowerCase();
            const confirmBtn = document.getElementById('confirm-reset-btn');
            if (confirmBtn) confirmBtn.disabled = val !== userName;
        });

        document.getElementById('confirm-reset-btn')?.addEventListener('click', async () => {
            await DB.clearAll();
            State.books = []; State.ideas = []; State.insights = [];
            State.quotes = []; State.decisions = []; State.files = []; State.activity = [];
            State.user = null;
            Modal.closeAll();
            Toast.success('All data has been reset.');
            setTimeout(() => location.reload(), 1200);
        });
    },

    setupResearch() {
        const searchBtn = document.getElementById('research-search-btn');
        const queryInput = document.getElementById('research-query');

        searchBtn?.addEventListener('click', () => Research.search(queryInput?.value || ''));
        queryInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Research.search(queryInput.value);
        });

        document.getElementById('results-sort')?.addEventListener('change', () => {
            const sorted = Research._sort(State.researchResults, document.getElementById('results-sort').value);
            Research._renderResults(sorted, document.getElementById('research-results'));
        });
    },

    setupLibraryFilters() {
        document.getElementById('library-search')?.addEventListener('input',
            Utils.debounce(() => { State.libraryFilter = document.getElementById('library-search').value; Render.library(); }, 250)
        );

        document.querySelectorAll('#library-status-filter .filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#library-status-filter .filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                State.libraryStatus = tab.dataset.status;
                Render.library();
            });
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                State.libraryView = btn.dataset.view;
                Render.library();
            });
        });
    },

    setupInsightFilters() {
        document.getElementById('insight-search')?.addEventListener('input',
            Utils.debounce(() => Render.insights(), 250)
        );

        document.querySelectorAll('#insight-mood-filter .filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#insight-mood-filter .filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                State.insightMood = tab.dataset.mood;
                Render.insights();
            });
        });
    },

    setupCitationEngine() {
        document.getElementById('citation-search')?.addEventListener('input',
            Utils.debounce(() => Render.citationBookList(), 250)
        );

        // New: dropdown-based format selector
        const fmtSelect = document.getElementById('citation-format-select');
        if (fmtSelect) {
            fmtSelect.addEventListener('change', () => {
                State.citationFormat = fmtSelect.value;
                // Update badge text
                const badge = document.getElementById('citation-format-badge');
                if (badge) badge.textContent = fmtSelect.options[fmtSelect.selectedIndex].text;
                Render.citationOutput();
            });
        }

        // Legacy format-tab support (keep in case any remain)
        document.querySelectorAll('.format-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                State.citationFormat = tab.dataset.format;
                Render.citationOutput();
            });
        });

        document.getElementById('copy-citations-btn')?.addEventListener('click', () => {
            const output = document.getElementById('citation-output').textContent;
            navigator.clipboard.writeText(output).then(() => Toast.success('Citations copied!'));
        });

        document.getElementById('export-citations-btn')?.addEventListener('click', () => {
            const output = document.getElementById('citation-output').textContent;
            const blob = new Blob([output], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `citations-${State.citationFormat}.txt`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            Toast.success('Citations exported.');
        });
    },
};

/* ── 16. START ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    const failSafe = setTimeout(() => {
        const screen = document.getElementById('loading-screen');
        if (screen) { screen.classList.add('fade-out'); setTimeout(() => screen.remove(), 700); }
    }, 10000);

    try {
        await DB.init();
        await Loader.run();
        clearTimeout(failSafe);
        await Identity.init();
    } catch (err) {
        clearTimeout(failSafe);
        console.error('ALEX init error:', err);
        const screen = document.getElementById('loading-screen');
        if (screen) { screen.classList.add('fade-out'); setTimeout(() => screen.remove(), 700); }
        Toast.error('Failed to initialize. Please refresh.');
    }
});

/* ═══════════════════════════════════════════════════════════════
   ALEX — app.js Part 2
   Ideas, Insights, Quotes, Decisions, Render Engine, Analytics,
   Knowledge Graph, Citation Engine
   ═══════════════════════════════════════════════════════════════ */

/* ── 17. IDEAS MODULE ──────────────────────────────────────── */
const Ideas = {
    openAddModal(prefill = {}) {
        State.editingId = prefill.id || null;
        const titleEl = document.getElementById('modal-idea-title');
        if (titleEl) titleEl.textContent = State.editingId ? 'Edit Idea' : 'Capture Idea';
        const contentEl = document.getElementById('idea-content');
        const priorityEl = document.getElementById('idea-priority');
        const statusEl = document.getElementById('idea-status');
        const tagsEl = document.getElementById('idea-tags');
        if (contentEl) contentEl.value = prefill.content || '';
        if (priorityEl) priorityEl.value = prefill.priority || 'low';
        if (statusEl) statusEl.value = prefill.status || 'raw';
        if (tagsEl) tagsEl.value = (prefill.tags || []).join(', ');
        Modal.open('modal-idea');
    },

    async save() {
        const content = document.getElementById('idea-content')?.value.trim();
        if (!content) { Toast.error('Idea content is required.'); return; }

        const isDup = State.ideas.some(i => i.content === content && i.id !== State.editingId);
        if (isDup) { Toast.warn('An identical idea already exists.'); return; }

        const isNew = !State.editingId;
        const existing = State.ideas.find(i => i.id === State.editingId);
        const idea = {
            id: State.editingId || Utils.id(),
            content,
            priority: document.getElementById('idea-priority')?.value || 'low',
            status: document.getElementById('idea-status')?.value || 'raw',
            tags: Utils.parseTagsInput(document.getElementById('idea-tags')?.value || ''),
            maturity_score: existing?.maturity_score || 0,
            linked_books: existing?.linked_books || [],
            linked_insights: existing?.linked_insights || [],
            linked_decisions: existing?.linked_decisions || [],
            created_at: isNew ? Utils.ts() : (existing?.created_at || Utils.ts()),
            updated_at: Utils.ts(),
        };

        await DB.put(ALEX.STORES.IDEAS, idea);

        if (isNew) {
            State.ideas.push(idea);
            await Activity.log('idea', `Captured idea: "${content.slice(0, 50)}…"`, idea.id);
            Toast.success('Idea captured!');
        } else {
            const idx = State.ideas.findIndex(i => i.id === idea.id);
            if (idx > -1) State.ideas[idx] = idea;
            Toast.success('Idea updated.');
        }

        Modal.close('modal-idea');
        Render.ideas();
        Render.updateBadges();
    },

    async updateStatus(id, newStatus) {
        const idea = State.ideas.find(i => i.id === id);
        if (!idea) return;
        const maturityBonus = { developing: 20, executed: 40 };
        idea.status = newStatus;
        idea.maturity_score = Utils.clamp((idea.maturity_score || 0) + (maturityBonus[newStatus] || 0), 0, 100);
        idea.updated_at = Utils.ts();
        await DB.put(ALEX.STORES.IDEAS, idea);
        Render.ideas();
    },

    async delete(id) {
        if (!confirm('Delete this idea?')) return;
        await DB.delete(ALEX.STORES.IDEAS, id);
        State.ideas = State.ideas.filter(i => i.id !== id);
        Toast.success('Idea deleted.');
        Render.ideas();
        Render.updateBadges();
    },
};

/* ── 18. INSIGHTS MODULE ───────────────────────────────────── */
const Insights = {
    openAddModal(prefill = {}) {
        State.editingId = prefill.id || null;
        const titleEl = document.getElementById('modal-insight-title');
        if (titleEl) titleEl.textContent = State.editingId ? 'Edit Insight' : 'Log Insight';
        const contentEl = document.getElementById('insight-content');
        const moodEl = document.getElementById('insight-mood');
        const categoryEl = document.getElementById('insight-category');
        const tagsEl = document.getElementById('insight-tags');
        if (contentEl) contentEl.value = prefill.content || '';
        if (moodEl) moodEl.value = prefill.mood || 'focused';
        if (categoryEl) categoryEl.value = prefill.category || 'academic';
        if (tagsEl) tagsEl.value = (prefill.tags || []).join(', ');
        Modal.open('modal-insight');
    },

    async save() {
        const content = document.getElementById('insight-content')?.value.trim();
        if (!content) { Toast.error('Insight content is required.'); return; }

        const today = new Date().toDateString();
        const isDup = State.insights.some(i =>
            i.content === content &&
            new Date(i.date).toDateString() === today &&
            i.id !== State.editingId
        );
        if (isDup) { Toast.warn('You already logged an identical insight today.'); return; }

        const isNew = !State.editingId;
        const existing = State.insights.find(i => i.id === State.editingId);
        const insight = {
            id: State.editingId || Utils.id(),
            content,
            mood: document.getElementById('insight-mood')?.value || 'focused',
            category: document.getElementById('insight-category')?.value || 'academic',
            tags: Utils.parseTagsInput(document.getElementById('insight-tags')?.value || ''),
            linked_books: existing?.linked_books || [],
            linked_ideas: existing?.linked_ideas || [],
            linked_decisions: existing?.linked_decisions || [],
            date: isNew ? Utils.ts() : (existing?.date || Utils.ts()),
            updated_at: Utils.ts(),
        };

        await DB.put(ALEX.STORES.INSIGHTS, insight);

        if (isNew) {
            State.insights.push(insight);
            await Activity.log('insight', `Logged insight: "${content.slice(0, 50)}…"`, insight.id);
            Toast.success('Insight logged!');
        } else {
            const idx = State.insights.findIndex(i => i.id === insight.id);
            if (idx > -1) State.insights[idx] = insight;
            Toast.success('Insight updated.');
        }

        Modal.close('modal-insight');
        Render.insights();
        Render.updateBadges();
    },

    async delete(id) {
        if (!confirm('Delete this insight?')) return;
        await DB.delete(ALEX.STORES.INSIGHTS, id);
        State.insights = State.insights.filter(i => i.id !== id);
        Toast.success('Insight deleted.');
        Render.insights();
        Render.updateBadges();
    },
};

/* ── 19. QUOTES MODULE ─────────────────────────────────────── */
const Quotes = {
    openAddModal(prefill = {}) {
        State.editingId = prefill.id || null;
        const titleEl = document.getElementById('modal-quote-title');
        if (titleEl) titleEl.textContent = State.editingId ? 'Edit Quote' : 'Save Quote';
        const textEl = document.getElementById('quote-text');
        const authorEl = document.getElementById('quote-author');
        const pageEl = document.getElementById('quote-page');
        const contextEl = document.getElementById('quote-context');
        const tagsEl = document.getElementById('quote-tags');
        const influenceEl = document.getElementById('quote-influence');
        if (textEl) textEl.value = prefill.quote_text || '';
        if (authorEl) authorEl.value = prefill.author || '';
        if (pageEl) pageEl.value = prefill.page_reference || '';
        if (contextEl) contextEl.value = prefill.context_note || '';
        if (tagsEl) tagsEl.value = (prefill.tags || []).join(', ');
        if (influenceEl) influenceEl.value = prefill.influence_score || '';
        Modal.open('modal-quote');
    },

    async save() {
        const text = document.getElementById('quote-text')?.value.trim();
        if (!text) { Toast.error('Quote text is required.'); return; }

        const isDup = State.quotes.some(q => q.quote_text === text && q.id !== State.editingId);
        if (isDup) { Toast.warn('This quote already exists in your arsenal.'); return; }

        const influence = parseInt(document.getElementById('quote-influence')?.value) || null;
        if (influence && (influence < 1 || influence > 10)) { Toast.error('Influence score must be 1–10.'); return; }

        const isNew = !State.editingId;
        const existing = State.quotes.find(q => q.id === State.editingId);
        const quote = {
            id: State.editingId || Utils.id(),
            quote_text: text,
            author: document.getElementById('quote-author')?.value.trim() || '',
            page_reference: document.getElementById('quote-page')?.value.trim() || '',
            context_note: document.getElementById('quote-context')?.value.trim() || '',
            tags: Utils.parseTagsInput(document.getElementById('quote-tags')?.value || ''),
            influence_score: influence,
            saved_at: isNew ? Utils.ts() : (existing?.saved_at || Utils.ts()),
            updated_at: Utils.ts(),
        };

        await DB.put(ALEX.STORES.QUOTES, quote);

        if (isNew) {
            State.quotes.push(quote);
            await Activity.log('quote', `Saved quote by "${quote.author || 'Unknown'}"`, quote.id);
            Toast.success('Quote saved to arsenal!');
        } else {
            const idx = State.quotes.findIndex(q => q.id === quote.id);
            if (idx > -1) State.quotes[idx] = quote;
            Toast.success('Quote updated.');
        }

        Modal.close('modal-quote');
        Render.quotes();
        Render.updateBadges();
    },

    async delete(id) {
        if (!confirm('Delete this quote?')) return;
        await DB.delete(ALEX.STORES.QUOTES, id);
        State.quotes = State.quotes.filter(q => q.id !== id);
        Toast.success('Quote removed.');
        Render.quotes();
        Render.updateBadges();
    },

    random() {
        if (!State.quotes.length) return null;
        return State.quotes[Math.floor(Math.random() * State.quotes.length)];
    },
};

/* ── 20. DECISIONS MODULE ──────────────────────────────────── */
const Decisions = {
    openAddModal(prefill = {}) {
        State.editingId = prefill.id || null;
        const titleEl = document.getElementById('modal-decision-title');
        if (titleEl) titleEl.textContent = State.editingId ? 'Edit Decision' : 'Log Decision';
        const titleInput = document.getElementById('decision-title-input');
        const contextEl = document.getElementById('decision-context');
        const chosenEl = document.getElementById('decision-chosen');
        const confidenceEl = document.getElementById('decision-confidence');
        const biasEl = document.getElementById('decision-bias');
        const expectedEl = document.getElementById('decision-expected');
        if (titleInput) titleInput.value = prefill.title || '';
        if (contextEl) contextEl.value = prefill.context || '';
        if (chosenEl) chosenEl.value = prefill.chosen_option || '';
        if (confidenceEl) confidenceEl.value = prefill.confidence || '';
        if (biasEl) biasEl.value = prefill.bias_detected || '';
        if (expectedEl) expectedEl.value = prefill.expected_outcome || '';

        const list = document.getElementById('decision-options-list');
        if (list) {
            list.innerHTML = '';
            const options = prefill.options?.length ? prefill.options : ['', ''];
            options.forEach(opt => this._addOptionRow(opt));
        }

        Modal.open('modal-decision');
    },

    addOptionField() {
        this._addOptionRow('');
    },

    _addOptionRow(value = '') {
        const list = document.getElementById('decision-options-list');
        if (!list) return;
        const row = document.createElement('div');
        row.className = 'option-input-row';
        row.innerHTML = `<input type="text" class="input option-input" placeholder="Option…" value="${Utils.sanitize(value)}" />
      <button type="button" class="option-remove-btn" title="Remove option"><i class="fa-solid fa-minus"></i></button>`;
        row.querySelector('.option-remove-btn').addEventListener('click', () => {
            const rows = document.querySelectorAll('.option-input-row');
            if (rows.length > 1) row.remove();
            else Toast.warn('At least one option is required.');
        });
        list.appendChild(row);
    },

    async save() {
        const title = document.getElementById('decision-title-input')?.value.trim();
        if (!title) { Toast.error('Decision title is required.'); return; }

        const options = [...document.querySelectorAll('.option-input')].map(i => i.value.trim()).filter(Boolean);
        if (!options.length) { Toast.error('Add at least one option.'); return; }

        const confidence = parseInt(document.getElementById('decision-confidence')?.value) || null;
        if (confidence !== null && (confidence < 0 || confidence > 100)) { Toast.error('Confidence must be 0–100.'); return; }

        const chosen = document.getElementById('decision-chosen')?.value.trim() || '';
        if (chosen && !options.includes(chosen)) { Toast.warn('Chosen option must be one of the listed options.'); return; }

        const isNew = !State.editingId;
        const existing = State.decisions.find(d => d.id === State.editingId);

        const decision = {
            id: State.editingId || Utils.id(),
            title,
            context: document.getElementById('decision-context')?.value.trim() || '',
            options,
            chosen_option: chosen || null,
            confidence,
            expected_outcome: document.getElementById('decision-expected')?.value.trim() || '',
            bias_detected: document.getElementById('decision-bias')?.value.trim() || '',
            actual_outcome: existing?.actual_outcome || null,
            lesson_learned: existing?.lesson_learned || null,
            linked_books: existing?.linked_books || [],
            linked_ideas: existing?.linked_ideas || [],
            linked_insights: existing?.linked_insights || [],
            decision_score: null,
            created_at: isNew ? Utils.ts() : (existing?.created_at || Utils.ts()),
            updated_at: Utils.ts(),
        };

        decision.decision_score = this._calcScore(decision);

        await DB.put(ALEX.STORES.DECISIONS, decision);

        if (isNew) {
            State.decisions.push(decision);
            await Activity.log('decision', `Logged decision: "${title}"`, decision.id);
            Toast.success('Decision logged!');
        } else {
            const idx = State.decisions.findIndex(d => d.id === decision.id);
            if (idx > -1) State.decisions[idx] = decision;
            Toast.success('Decision updated.');
        }

        Modal.close('modal-decision');
        Render.decisions();
        Render.updateBadges();
    },

    _calcScore(decision) {
        let score = 50;
        if (decision.confidence) score += (decision.confidence - 50) * 0.2;
        if (decision.bias_detected) score -= 10;
        if (decision.expected_outcome) score += 10;
        if (decision.options.length >= 3) score += 5;
        return Math.round(Utils.clamp(score, 0, 100));
    },

    async delete(id) {
        if (!confirm('Delete this decision?')) return;
        await DB.delete(ALEX.STORES.DECISIONS, id);
        State.decisions = State.decisions.filter(d => d.id !== id);
        Toast.success('Decision deleted.');
        Render.decisions();
        Render.updateBadges();
    },
};

/* ── 21. RENDER ENGINE ─────────────────────────────────────── */
const Render = {
    updateBadges() {
        const badges = {
            'badge-library': State.books.length,
            'badge-bookstorage': State.files.length,
            'badge-ideas': State.ideas.length,
            'badge-insights': State.insights.length,
            'badge-quotes': State.quotes.length,
            'badge-decisions': State.decisions.length,
            'fstat-books': State.books.length,
            'fstat-ideas': State.ideas.length,
            'fstat-insights': State.insights.length,
        };

        Object.entries(badges).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.classList.contains('nav-badge--new')) return;
            el.textContent = val || '';
        });

        const totalSize = BookStorage.calcTotalSize();
        const usageEl = document.getElementById('storage-used-text');
        if (usageEl) usageEl.textContent = `${Utils.formatBytes(totalSize)} used`;
    },

    dashboard() {
        const now = new Date();
        const greetTimeEl = document.getElementById('greeting-time');
        const dashDateEl = document.getElementById('dashboard-date');
        if (greetTimeEl) greetTimeEl.textContent = Utils.greet();
        if (dashDateEl) dashDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        const statMap = {
            'stat-books': State.books.length,
            'stat-files': State.files.length,
            'stat-ideas': State.ideas.length,
            'stat-insights': State.insights.length,
            'stat-quotes': State.quotes.length,
            'stat-decisions': State.decisions.length,
        };
        Object.entries(statMap).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });

        this.activityFeed();
        this.dashboardQuote();
        this.cognitiveIndex();
    },

    activityFeed() {
        const feed = document.getElementById('activity-feed');
        if (!feed) return;
        if (!State.activity.length) {
            feed.innerHTML = `<div class="empty-state"><i class="fa-regular fa-clock"></i><p>No activity yet.</p></div>`;
            return;
        }

        const typeMap = {
            book: { dot: 'book', icon: '📚' },
            idea: { dot: 'idea', icon: '💡' },
            insight: { dot: 'insight', icon: '🧠' },
            quote: { dot: 'quote', icon: '💬' },
            decision: { dot: 'decision', icon: '⚖️' },
            file: { dot: 'file', icon: '📁' }
        };

        feed.innerHTML = State.activity.slice(0, 12).map(a => {
            const t = typeMap[a.type] || { dot: 'book', icon: '•' };
            return `<div class="activity-item">
        <div class="activity-dot activity-dot--${t.dot}"></div>
        <div>
          <div class="activity-text">${Utils.sanitize(a.description)}</div>
          <div class="activity-time">${Utils.timeAgo(a.created_at)}</div>
        </div>
      </div>`;
        }).join('');
    },

    dashboardQuote() {
        const card = document.getElementById('dashboard-quote-card');
        if (!card) return;
        const q = Quotes.random();
        if (!q) {
            card.innerHTML = `<div class="empty-state"><i class="fa-regular fa-quote-right"></i><p>Save quotes to surface them here.</p></div>`;
            return;
        }
        card.innerHTML = `<div class="quote-display">${Utils.sanitize(q.quote_text)}</div><div class="quote-meta">— ${Utils.sanitize(q.author || 'Unknown')}${q.page_reference ? `, ${Utils.sanitize(q.page_reference)}` : ''}</div>`;
    },

    cognitiveIndex() {
        const total = State.books.length + State.ideas.length + State.insights.length + State.quotes.length + State.decisions.length + State.files.length;
        const meterFill = document.getElementById('meter-fill');
        const meterValue = document.getElementById('meter-value');
        if (!total) {
            if (meterFill) meterFill.style.width = '0%';
            if (meterValue) meterValue.textContent = '0';
            return;
        }

        const weights = { books: 2, ideas: 1.5, insights: 2, quotes: 1, decisions: 2.5, files: 1 };
        const raw = (State.books.length * weights.books) + (State.ideas.length * weights.ideas) + (State.insights.length * weights.insights) + (State.quotes.length * weights.quotes) + (State.decisions.length * weights.decisions) + (State.files.length * weights.files);
        const index = Math.min(Math.round((raw / 200) * 100), 100);

        if (meterFill) meterFill.style.width = `${index}%`;
        if (meterValue) meterValue.textContent = index;

        const breakdown = document.getElementById('cognition-breakdown');
        if (breakdown) {
            breakdown.innerHTML = [
                { label: 'Books', val: State.books.length },
                { label: 'Ideas', val: State.ideas.length },
                { label: 'Insights', val: State.insights.length },
                { label: 'Decisions', val: State.decisions.length },
            ].map(c => `<div class="cog-chip">${c.label}: ${c.val}</div>`).join('');
        }
    },

    library() {
        const container = document.getElementById('library-container');
        if (!container) return;
        let books = [...State.books];

        if (State.libraryStatus) books = books.filter(b => b.status === State.libraryStatus);
        if (State.libraryFilter) {
            const q = State.libraryFilter.toLowerCase();
            books = books.filter(b => (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q) || (b.tags || []).some(t => t.includes(q)));
        }

        if (!books.length) {
            container.className = State.libraryView === 'list' ? 'library-list' : 'library-grid';
            container.innerHTML = `<div class="empty-state-full"><div class="empty-icon">📚</div><h3>${State.libraryFilter || State.libraryStatus ? 'No books match your filter' : 'Your library is empty'}</h3><p>${State.libraryFilter || State.libraryStatus ? 'Try adjusting your filters.' : 'Add books from Search Web or manually.'}</p></div>`;
            return;
        }

        if (State.libraryView === 'list') {
            container.className = 'library-list';
            container.innerHTML = books.map(b => this._bookListCard(b)).join('');
        } else {
            container.className = 'library-grid';
            container.innerHTML = books.map(b => this._bookGridCard(b)).join('');
        }
    },

    _bookGridCard(b) {
        const coverHTML = b.cover
            ? `<img class="book-cover" src="${Utils.sanitize(b.cover)}" alt="Cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
            `<div class="book-cover-placeholder" style="display:none">📖</div>`
            : `<div class="book-cover-placeholder">📖</div>`;

        return `<div class="book-card" onclick="Books.openDetail('${b.id}')">
      ${coverHTML}
      <div class="book-info">
        <div class="book-title-text">${Utils.sanitize(b.title)}</div>
        ${b.author ? `<div class="book-author-text">${Utils.sanitize(b.author)}</div>` : ''}
        <div class="book-status-badge status--${b.status}">${ALEX.STATUS_LABELS[b.status] || b.status}</div>
      </div>
    </div>`;
    },

    _bookListCard(b) {
        return `<div class="book-card-list" onclick="Books.openDetail('${b.id}')">
      <div class="book-cover-placeholder" style="border-radius:var(--radius-sm);width:48px;height:64px;aspect-ratio:unset;font-size:1.2rem">📖</div>
      <div style="flex:1;min-width:0">
        <div class="book-title-text">${Utils.sanitize(b.title)}</div>
        <div class="book-author-text">${Utils.sanitize(b.author || '—')}</div>
      </div>
      <div class="book-status-badge status--${b.status}">${ALEX.STATUS_LABELS[b.status]}</div>
      <div style="font-size:0.78rem;color:var(--text-tertiary);flex-shrink:0">${b.year || '—'}</div>
    </div>`;
    },

    storage() {
        const grid = document.getElementById('storage-grid');
        if (!grid) return;
        let files = [...State.files];

        if (State.storageType) files = files.filter(f => f.type === State.storageType || (State.storageType === 'word' && (f.type === 'word' || f.type === 'docx')));
        if (State.storageFilter) {
            const q = State.storageFilter.toLowerCase();
            files = files.filter(f => f.name.toLowerCase().includes(q));
        }

        switch (State.storageSort) {
            case 'name_asc': files.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'name_desc': files.sort((a, b) => b.name.localeCompare(a.name)); break;
            case 'size_desc': files.sort((a, b) => (b.size || 0) - (a.size || 0)); break;
            case 'size_asc': files.sort((a, b) => (a.size || 0) - (b.size || 0)); break;
            default: files.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        }

        if (!files.length) {
            grid.innerHTML = `<div class="empty-state-full"><div class="empty-icon">📁</div><h3>${State.storageFilter ? 'No files match' : 'No files uploaded yet'}</h3><p>${State.storageFilter ? 'Try a different search.' : 'Upload PDF or Word files above.'}</p></div>`;
            return;
        }

        grid.innerHTML = files.map(f => {
            const icon = f.type === 'pdf' ? '📕' : '📘';
            return `<div class="storage-file-card glass-card">
        <div class="storage-file-icon">${icon}</div>
        <div class="storage-file-info">
          <div class="storage-file-name" title="${Utils.sanitize(f.name)}">${Utils.sanitize(f.name)}</div>
          <div class="storage-file-meta">${Utils.formatBytes(f.size)} · ${f.type.toUpperCase()} · ${Utils.formatDate(f.uploaded_at)}</div>
        </div>
        <div class="storage-file-actions">
          <button class="btn-icon" title="Preview" onclick="BookStorage.openPreview('${f.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" title="Download" onclick="BookStorage.downloadFile('${f.id}')"><i class="fa-solid fa-download"></i></button>
          <button class="btn-icon" title="Delete" style="color:var(--accent-red)" onclick="BookStorage.deleteFile('${f.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
        }).join('');
    },

    ideas() {
        const pipeline = document.getElementById('ideas-pipeline');
        if (!pipeline) return;
        const statuses = ['raw', 'developing', 'executed'];
        const statusLabels = { raw: 'Raw', developing: 'Developing', executed: 'Executed' };

        statuses.forEach(status => {
            const col = pipeline.querySelector(`[data-status="${status}"] .kanban-cards`);
            if (!col) return;
            const ideas = State.ideas.filter(i => i.status === status);
            if (!ideas.length) {
                col.innerHTML = `<div style="font-size:0.78rem;color:var(--text-tertiary);padding:var(--space-sm);text-align:center">No ideas yet</div>`;
                return;
            }
            col.innerHTML = ideas.map(idea => {
                const priorityColor = { dangerous: 'var(--accent-red)', strategic: 'var(--accent-yellow)', low: 'var(--accent-blue)' };
                const maturity = idea.maturity_score || 0;
                return `<div class="idea-card">
          <div class="idea-priority-dot" style="background:${priorityColor[idea.priority] || 'var(--accent-blue)'}"></div>
          <div class="idea-content">${Utils.sanitize(idea.content.slice(0, 120))}${idea.content.length > 120 ? '…' : ''}</div>
          ${idea.tags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">${idea.tags.slice(0, 3).map(t => `<span class="tag-chip" style="font-size:0.68rem;padding:1px 6px">${Utils.sanitize(t)}</span>`).join('')}</div>` : ''}
          <div class="idea-maturity">
            <div class="idea-maturity-bar"><div style="width:${maturity}%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-teal));height:100%;border-radius:inherit;transition:width 0.4s ease"></div></div>
            <span style="font-size:0.68rem;color:var(--text-tertiary)">${maturity}%</span>
          </div>
          <div class="idea-actions">
            ${status !== 'developing' ? `<button class="btn-sm" onclick="Ideas.updateStatus('${idea.id}','developing')">Develop</button>` : ''}
            ${status !== 'executed' ? `<button class="btn-sm" onclick="Ideas.updateStatus('${idea.id}','executed')">Execute</button>` : ''}
            <button class="btn-sm" onclick="Ideas.openAddModal(State.ideas.find(i=>i.id==='${idea.id}'))"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-sm" style="color:var(--accent-red)" onclick="Ideas.delete('${idea.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
            }).join('');
        });
    },

    insights() {
        const list = document.getElementById('insights-list');
        if (!list) return;
        const q = document.getElementById('insight-search')?.value.toLowerCase() || '';
        let items = [...State.insights].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (State.insightMood) items = items.filter(i => i.mood === State.insightMood);
        if (q) items = items.filter(i => i.content.toLowerCase().includes(q) || (i.tags || []).some(t => t.includes(q)));

        if (!items.length) {
            list.innerHTML = `<div class="empty-state-full"><div class="empty-icon">🧠</div><h3>No insights yet</h3><p>Log your first insight to start tracking cognitive growth.</p></div>`;
            return;
        }

        list.innerHTML = items.map(ins => {
            const moodLabel = ALEX.MOOD_LABELS[ins.mood] || ins.mood;
            return `<div class="insight-card insight-card--${ins.mood}">
        <div class="insight-header">
          <span class="insight-mood-badge">${moodLabel}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="insight-date">${Utils.formatDate(ins.date)}</span>
            <button class="btn-icon" style="width:28px;height:28px;font-size:0.75rem" onclick="Insights.openAddModal(State.insights.find(i=>i.id==='${ins.id}'))"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon" style="width:28px;height:28px;font-size:0.75rem;color:var(--accent-red)" onclick="Insights.delete('${ins.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="insight-body">${Utils.sanitize(ins.content)}</div>
        ${ins.tags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${ins.tags.map(t => `<span class="tag-chip">${Utils.sanitize(t)}</span>`).join('')}</div>` : ''}
      </div>`;
        }).join('');

        const analyticsEl = document.getElementById('insight-analytics');
        if (!analyticsEl) return;
        const moodCounts = {};
        State.insights.forEach(i => { moodCounts[i.mood] = (moodCounts[i.mood] || 0) + 1; });

        analyticsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:var(--space-sm)">
      ${Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).map(([mood, count]) => `
        <div class="bar-item">
          <span class="bar-label">${(ALEX.MOOD_LABELS[mood] || mood).replace(/^[^ ]+ /, '')}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(count / State.insights.length) * 100}%"></div></div>
          <span class="bar-value">${count}</span>
        </div>`).join('')}
    </div>
    <div style="margin-top:var(--space-md);font-size:0.78rem;color:var(--text-tertiary)">
      Total: ${State.insights.length} insights
    </div>`;
    },

    quotes() {
        const masonry = document.getElementById('quotes-masonry');
        if (!masonry) return;
        const q = document.getElementById('quotes-search')?.value.toLowerCase() || '';
        let items = [...State.quotes];

        if (q) items = items.filter(qt => qt.quote_text.toLowerCase().includes(q) || (qt.author || '').toLowerCase().includes(q) || (qt.tags || []).some(t => t.includes(q)));
        if (!q) items.sort(() => Math.random() - 0.5);

        if (!items.length) {
            masonry.innerHTML = `<div class="empty-state-full" style="grid-column:1/-1"><div class="empty-icon">💬</div><h3>No quotes yet</h3><p>Save powerful quotes to build your intellectual arsenal.</p></div>`;
            return;
        }

        masonry.innerHTML = items.map(qt => {
            const stars = qt.influence_score
                ? Array.from({ length: Math.min(qt.influence_score, 10) }, () => '★').join('').slice(0, 5)
                : '';
            return `<div class="quote-card-item">
        <div class="quote-card-text">${Utils.sanitize(qt.quote_text)}</div>
        <div class="quote-card-meta">
          <span class="quote-card-author">— ${Utils.sanitize(qt.author || 'Unknown')}</span>
          ${stars ? `<div class="quote-card-influence"><i class="fa-solid fa-star"></i> ${qt.influence_score}/10</div>` : ''}
        </div>
        ${qt.page_reference ? `<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px">${Utils.sanitize(qt.page_reference)}</div>` : ''}
        <div style="display:flex;gap:4px;margin-top:var(--space-sm)">
          <button class="btn-sm" onclick="Quotes.openAddModal(State.quotes.find(q=>q.id==='${qt.id}'))"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-sm" style="color:var(--accent-red)" onclick="Quotes.delete('${qt.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
        }).join('');
    },

    decisions() {
        const list = document.getElementById('decision-list');
        if (!list) return;

        if (!State.decisions.length) {
            list.innerHTML = `<div class="empty-state-full"><div class="empty-icon">⚖️</div><h3>No decisions logged</h3><p>Track your choices to measure confidence and learn from outcomes.</p></div>`;
            return;
        }

        const sorted = [...State.decisions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        list.innerHTML = sorted.map(d => `<div class="decision-card">
      <div class="decision-header">
        <div class="decision-title-text">${Utils.sanitize(d.title)}</div>
        <span class="decision-confidence-badge">${d.confidence != null ? `${d.confidence}%` : '—'}</span>
      </div>
      ${d.context ? `<div class="decision-context-text">${Utils.sanitize(d.context)}</div>` : ''}
      <div class="decision-footer">
        ${d.chosen_option ? `<span class="tag-chip">✓ ${Utils.sanitize(d.chosen_option)}</span>` : ''}
        ${d.bias_detected ? `<span class="tag-chip" style="border-color:rgba(239,68,68,0.3);color:var(--accent-red)">⚠ ${Utils.sanitize(d.bias_detected)}</span>` : ''}
        <span style="margin-left:auto;font-size:0.72rem;color:var(--text-tertiary)">${Utils.formatDate(d.created_at)}</span>
        <button class="btn-sm" onclick="Decisions.openAddModal(State.decisions.find(d=>d.id==='${d.id}'))"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-sm" style="color:var(--accent-red)" onclick="Decisions.delete('${d.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');

        const analyticsEl = document.getElementById('decision-analytics');
        if (!analyticsEl) return;
        const avgConf = State.decisions.length
            ? Math.round(State.decisions.reduce((s, d) => s + (d.confidence || 50), 0) / State.decisions.length)
            : 0;
        const withBias = State.decisions.filter(d => d.bias_detected).length;
        analyticsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:var(--space-md)">
      <div class="bar-item">
        <span class="bar-label">Avg Confidence</span>
        <div class="bar-track"><div class="bar-fill" style="width:${avgConf}%"></div></div>
        <span class="bar-value">${avgConf}%</span>
      </div>
      <div style="font-size:0.82rem;color:var(--text-secondary)">Total: ${State.decisions.length}</div>
      <div style="font-size:0.82rem;color:var(--text-secondary)">Bias flagged: ${withBias}</div>
    </div>`;
    },

    analytics() {
        const grid = document.getElementById('analytics-grid');
        if (!grid) return;

        const readingByStatus = Object.entries(
            State.books.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {})
        );

        const ideasByPriority = Object.entries(
            State.ideas.reduce((acc, i) => { acc[i.priority] = (acc[i.priority] || 0) + 1; return acc; }, {})
        );

        const insightsByCategory = Object.entries(
            State.insights.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {})
        );

        const topTags = (() => {
            const counts = {};
            [...State.books, ...State.ideas, ...State.insights, ...State.quotes].forEach(item => {
                (item.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
            });
            return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        })();

        const avgRating = State.books.filter(b => b.rating).reduce((s, b, _, a) => s + b.rating / a.length, 0);

        const mkBar = (items, total) => items.length
            ? items.map(([label, val]) => `<div class="bar-item">
          <span class="bar-label">${Utils.sanitize(label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${total ? (val / total) * 100 : 0}%"></div></div>
          <span class="bar-value">${val}</span>
        </div>`).join('')
            : '<p style="font-size:0.82rem;color:var(--text-tertiary)">No data yet.</p>';

        grid.innerHTML = `
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-book-open"></i> Reading by Status</div>
        <div class="bar-chart">${mkBar(readingByStatus, State.books.length)}</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-lightbulb"></i> Ideas by Priority</div>
        <div class="bar-chart">${mkBar(ideasByPriority, State.ideas.length)}</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-brain"></i> Insights by Category</div>
        <div class="bar-chart">${mkBar(insightsByCategory, State.insights.length)}</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-tags"></i> Top Tags</div>
        <div class="bar-chart">${mkBar(topTags, topTags[0]?.[1] || 1)}</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-star"></i> Overall Stats</div>
        <div class="stat-ring-wrap">
          ${[
            { val: State.books.length, label: 'Books' },
            { val: State.ideas.length, label: 'Ideas' },
            { val: State.insights.length, label: 'Insights' },
            { val: State.quotes.length, label: 'Quotes' },
            { val: State.decisions.length, label: 'Decisions' },
            { val: avgRating ? avgRating.toFixed(1) : '—', label: 'Avg Rating' },
        ].map(s => `<div class="stat-ring">
            <div class="ring-circle" style="border-color:rgba(59,130,246,0.3)">
              <span class="ring-value">${s.val}</span>
            </div>
            <span class="ring-label">${s.label}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title"><i class="fa-solid fa-folder-open"></i> Book Storage</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
          <div class="bar-item">
            <span class="bar-label">Total Files</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min((State.files.length / 20) * 100, 100)}%"></div></div>
            <span class="bar-value">${State.files.length}</span>
          </div>
          <div class="bar-item">
            <span class="bar-label">Storage Used</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min((BookStorage.calcTotalSize() / (500 * 1024 * 1024)) * 100, 100)}%"></div></div>
            <span class="bar-value">${Utils.formatBytes(BookStorage.calcTotalSize())}</span>
          </div>
        </div>
      </div>`;
    },

    graph() {
        const canvas = document.getElementById('graph-canvas');
        const emptyEl = document.getElementById('graph-empty');
        const legendEl = document.getElementById('graph-legend');

        const nodes = [
            ...State.books.slice(0, 40).map(b => ({ id: `book-${b.id}`, label: b.title.slice(0, 20), type: 'book', color: '#3b82f6' })),
            ...State.ideas.slice(0, 30).map(i => ({ id: `idea-${i.id}`, label: i.content.slice(0, 20), type: 'idea', color: '#f59e0b' })),
            ...State.insights.slice(0, 20).map(i => ({ id: `ins-${i.id}`, label: i.content.slice(0, 20), type: 'insight', color: '#a855f7' })),
            ...State.decisions.slice(0, 15).map(d => ({ id: `dec-${d.id}`, label: d.title.slice(0, 20), type: 'decision', color: '#22c55e' })),
        ].slice(0, 200);

        const total = nodes.length;

        if (!total) {
            if (emptyEl) emptyEl.style.display = 'flex';
            if (legendEl) legendEl.innerHTML = '';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        const typeColors = { book: '#3b82f6', idea: '#f59e0b', insight: '#a855f7', decision: '#22c55e' };
        if (legendEl) legendEl.innerHTML = Object.entries(typeColors).map(([t, c]) =>
            `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${t}</div>`
        ).join('');

        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const wrap = canvas.parentElement;
        canvas.width = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
        const W = canvas.width, H = canvas.height;

        nodes.forEach((n, i) => {
            const angle = (i / total) * Math.PI * 2;
            const r = Math.min(W, H) * 0.35;
            n.x = W / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 60;
            n.y = H / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 60;
            n.vx = 0; n.vy = 0;
        });

        const edges = [];
        for (let i = 0; i < Math.min(nodes.length, 60); i++) {
            const j = (i + 1 + Math.floor(Math.random() * 3)) % nodes.length;
            if (i !== j) edges.push([nodes[i], nodes[j]]);
        }

        let frame = 0;
        const maxFrames = 120;

        const draw = () => {
            ctx.clearRect(0, 0, W, H);

            edges.forEach(([a, b]) => {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            nodes.forEach(n => {
                ctx.beginPath();
                ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = n.color;
                ctx.shadowBlur = 8;
                ctx.shadowColor = n.color;
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            frame++;
            if (frame < maxFrames) requestAnimationFrame(draw);
        };

        requestAnimationFrame(draw);
    },

    citations() {
        this.citationBookList();
        this.citationOutput();
    },

    citationBookList() {
        const listEl = document.getElementById('citation-book-list');
        if (!listEl) return;
        const q = document.getElementById('citation-search')?.value.toLowerCase() || '';
        const books = q ? State.books.filter(b => b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q)) : State.books;

        if (!books.length) {
            listEl.innerHTML = `<div style="font-size:0.82rem;color:var(--text-tertiary);padding:var(--space-md)">No books in library. Add books first.</div>`;
            return;
        }

        listEl.innerHTML = books.map(b => {
            const selected = State.citationSelected.has(b.id);
            return `<label class="citation-book-item ${selected ? 'selected' : ''}">
        <input type="checkbox" ${selected ? 'checked' : ''} onchange="Citations.toggle('${b.id}',this.checked)" />
        <div class="citation-book-title">${Utils.sanitize(b.title)}${b.author ? ` <span style="color:var(--text-tertiary)">· ${Utils.sanitize(b.author)}</span>` : ''}</div>
      </label>`;
        }).join('');
    },

    citationOutput() {
        const outEl = document.getElementById('citation-output');
        const actionsEl = document.getElementById('citation-actions');
        if (!outEl) return;

        if (!State.citationSelected.size) {
            outEl.innerHTML = `<div class="empty-state"><i class="fa-regular fa-file-lines"></i><p>Select books from the left panel.</p></div>`;
            actionsEl?.classList.add('hidden');
            return;
        }

        const books = [...State.citationSelected].map(id => State.books.find(b => b.id === id)).filter(Boolean);
        const lines = books.map(b => Citations.format(b, State.citationFormat));
        outEl.textContent = lines.join('\n\n');
        actionsEl?.classList.remove('hidden');
    },
};

/* ── 22. CITATIONS ENGINE ──────────────────────────────────── */
const Citations = {
    toggle(id, checked) {
        if (checked) State.citationSelected.add(id);
        else State.citationSelected.delete(id);

        document.querySelectorAll('.citation-book-item').forEach(el => {
            const cb = el.querySelector('input[type="checkbox"]');
            el.classList.toggle('selected', cb?.checked);
        });

        Render.citationOutput();
    },

    escape(str) {
        return (str || '').replace(/[{}&%$#_^~\\]/g, c => `\\${c}`);
    },

    format(book, fmt) {
        const a = book.author || 'Unknown Author';
        const t = book.title || 'Unknown Title';
        const y = book.year || 'n.d.';
        const p = book.publisher || 'Unknown Publisher';
        const doi = book.doi;
        const isbn = book.isbn;

        // Helper: last name first (for APA style)
        const authorLastFirst = () => {
            const parts = a.split(' ');
            if (parts.length > 1) {
                const last = parts.pop();
                return `${last}, ${parts.join(' ')}`;
            }
            return a;
        };

        // Helper: initials (First M. Last → F. M. Last)
        const authorInitials = () => {
            const parts = a.trim().split(/\s+/);
            if (parts.length === 1) return a;
            const last = parts.pop();
            const initials = parts.map(n => n[0].toUpperCase() + '.').join(' ');
            return `${last}, ${initials}`;
        };

        const doiStr = doi ? ` https://doi.org/${doi}` : '';
        const isbnStr = isbn ? ` ISBN: ${isbn}` : '';

        switch (fmt) {
            // ── APA family ──
            case 'apa':
            case 'apa7':
                return `${authorLastFirst()} (${y}). *${t}*. ${p}.${doi ? doiStr : isbnStr}`;
            case 'apa6':
                return `${authorLastFirst()} (${y}). ${t}. ${p}.${doi ? doiStr : isbnStr}`;
            case 'apa_narrative':
                return `${authorLastFirst()} (${y}) argued in *${t}* (${p}).`;
            case 'apa_parenthetical':
                return `${authorLastFirst()} (${y}). *${t}*. ${p}.${doiStr}`;
            case 'apa_annotated':
                return `${authorLastFirst()} (${y}). *${t}*. ${p}.${doiStr}\n  [Annotation: Describe the source's relevance and contribution here.]`;
            case 'apa_legal':
                return `${t}, ${a} (${y}). ${p}.`;
            case 'apa_json':
                return JSON.stringify({ author: a, title: t, year: y, publisher: p, doi: doi || null, isbn: isbn || null }, null, 2);

            // ── MLA family ──
            case 'mla':
            case 'mla9':
                return `${authorLastFirst()}. *${t}*. ${p}, ${y}.${doi ? ` DOI: ${doi}.` : ''}`;
            case 'mla8':
                return `${authorLastFirst()}. "${t}." ${p}, ${y}.${doi ? ` doi:${doi}.` : ''}`;
            case 'mla_parenthetical':
                return `${authorLastFirst()}. *${t}*. ${p}, ${y}.`;
            case 'mla_annotated':
                return `${authorLastFirst()}. *${t}*. ${p}, ${y}.\n  [Annotation: Summarize and evaluate the source here.]`;

            // ── Chicago family ──
            case 'chicago':
            case 'chicago_nb':
                return `${a}. *${t}*. ${p}, ${y}.${doi ? ` doi:${doi}.` : ''}`;
            case 'chicago_ad':
                return `${authorLastFirst()}. ${y}. *${t}*. ${p}.${doi ? doiStr : ''}`;
            case 'chicago18':
                return `${a}. *${t}*. ${p}, ${y}.${doi ? ` https://doi.org/${doi}.` : ''}`;
            case 'chicago_annotated':
                return `${a}. *${t}*. ${p}, ${y}.\n  [Annotation: Note relevance and argument here.]`;

            // ── Turabian ──
            case 'turabian':
            case 'turabian9':
                return `${a}. *${t}*. ${p}: ${p}, ${y}.`;
            case 'turabian8':
                return `${a}. ${t}. ${p}, ${y}.`;

            // ── Harvard family (generic + variants) ──
            case 'harvard':
            case 'harvard_anglia':
            case 'harvard_leeds':
            case 'harvard_manchester':
            case 'harvard_cite_them_right':
            case 'harvard_uts':
            case 'harvard_bath':
            case 'harvard_exeter':
            case 'harvard_oxford_brookes':
            case 'harvard_monash':
            case 'harvard_rmit':
            case 'harvard_deakin':
            case 'harvard_unsw':
            case 'harvard_uq':
            case 'harvard_qut':
            case 'harvard_swinburne':
            case 'harvard_cardiff':
            case 'harvard_sheffield':
            case 'harvard_coventry':
            case 'harvard_durham':
            case 'harvard_imperial':
            case 'harvard_birmingham':
            case 'harvard_lancaster':
            case 'harvard_portsmouth':
            case 'harvard_staffordshire':
            case 'harvard_teesside':
            case 'harvard_westminster':
            case 'harvard_york':
            case 'harvard_brighton':
            case 'harvard_uwe':
            case 'harvard_huddersfield':
            case 'harvard_northumbria':
            case 'harvard_wolverhampton':
            case 'harvard_bournemouth':
            case 'harvard_london_met':
            case 'harvard_roehampton':
            case 'harvard_greenwich':
            case 'harvard_derby':
            case 'harvard_leicester':
            case 'harvard_lincoln':
            case 'harvard_nottingham':
            case 'harvard_salford':
            case 'harvard_southampton':
            case 'harvard_surrey':
            case 'harvard_sussex':
            case 'harvard_warwick':
            case 'harvard_ulster':
            case 'harvard_queens_belfast':
            case 'harvard_edinburgh':
            case 'harvard_glasgow':
            case 'harvard_strathclyde':
            case 'harvard_stirling':
            case 'harvard_aberdeen':
            case 'harvard_dundee':
            case 'harvard_napier':
            case 'harvard_abertay':
            case 'harvard_heriot_watt':
                return `${authorLastFirst()} (${y}) *${t}*. ${p}.${doi ? doiStr : ''}`;

            // ── Humanities ──
            case 'asa':
                return `${authorLastFirst()}. ${y}. "${t}." ${p}.${doiStr}`;
            case 'apsa':
                return `${authorLastFirst()}. ${y}. *${t}*. ${p}.${doiStr}`;
            case 'mhra':
                return `${a}, *${t}* (${p}, ${y}).`;
            case 'aaa':
                return `${a}. ${y}. ${t}. ${p}.`;

            // ── Science & Engineering ──
            case 'ieee':
            case 'ieee_transactions':
            case 'ieee_access':
            case 'ieee_numeric':
            case 'ieee_annotated':
                return `[1] ${a}, *${t}*, ${p}, ${y}.${doi ? ` doi: ${doi}.` : ''}`;
            case 'ama':
            case 'ama11':
            case 'ama10':
            case 'ama_superscript':
            case 'ama_annotated':
                return `${a}. *${t}*. ${p}; ${y}.${doi ? doiStr : ''}`;
            case 'ama_legal':
                return `${a}. *${t}*. ${p}, ${y}.`;
            case 'vancouver':
            case 'nlm':
            case 'nature_vancouver':
            case 'vancouver_annotated':
                return `${authorInitials()}. ${t}. ${p}; ${y}.${doi ? doiStr : ''}`;
            case 'nature':
                return `${a}. ${t}. *${p}* (${y}).${doi ? doiStr : ''}`;
            case 'science':
            case 'cell':
                return `${a}, *${t}* (${p}, ${y}).${doi ? doiStr : ''}`;
            case 'cse_ny':
                return `${a}. ${y}. ${t}. ${p}.`;
            case 'cse_cs':
            case 'cse_cn':
                return `1. ${a}. ${t}. ${p}; ${y}.`;
            case 'acs':
            case 'acs_numeric':
            case 'acs_author_date':
                return `${a}. *${t}*; ${p}: ${y}.${doi ? doiStr : ''}`;
            case 'aip':
            case 'aip_numeric':
            case 'aip_author_title':
            case 'aip_superscript':
                return `${a}, *${t}* (${p}, ${y}).${doi ? doiStr : ''}`;
            case 'ams':
                return `${authorLastFirst()}, *${t}*, ${p}, ${y}.`;
            case 'agu':
                return `${authorLastFirst()} (${y}), ${t}, ${p},${doi ? doiStr : ''}`;
            case 'aps':
            case 'aas':
                return `${a}, *${t}* (${p}, ${y}).${doi ? doiStr : ''}`;
            case 'asme':
            case 'sae':
            case 'aiaa':
                return `${a}, "${t}," ${p}, ${y}.${doi ? doiStr : ''}`;

            // ── Legal ──
            case 'bluebook':
                return `${a}, ${t.toUpperCase()} (${p} ${y}).`;
            case 'alwd':
                return `${a}, ${t} (${p}, ${y}).`;
            case 'oscola':
            case 'oxford_oscola':
                return `${a}, *${t}* (${p} ${y}).`;
            case 'mcgill':
                return `${a}, *${t}* (${p}, ${y}).`;
            case 'aglc':
                return `${a}, *${t}* (${p}, ${y}).`;
            case 'canadian_legal':
                return `${a}, *${t}* (${p}, ${y}).`;
            case 'apa_legal':
                return `${t}, ${a} (${y}). ${p}.`;

            // ── Publisher styles ──
            case 'elsevier_harvard':
            case 'taylor_harvard':
            case 'sage_harvard':
            case 'emerald_harvard':
                return `${authorLastFirst()}, ${y}. ${t}. ${p}.${doiStr}`;
            case 'elsevier_vancouver':
            case 'springer_vancouver':
            case 'taylor_vancouver':
            case 'wiley_vancouver':
            case 'sage_vancouver':
                return `${authorInitials()}. ${t}. ${p}; ${y}.${doiStr}`;
            case 'springer_basic':
            case 'springer_mathphys':
                return `${a}: ${t}. ${p} (${y}).${doiStr}`;
            case 'wiley_author_date':
                return `${authorLastFirst()} (${y}). ${t}. ${p}.${doiStr}`;

            // ── International ──
            case 'din1505':
                return `${a}: ${t}. ${p}, ${y}.`;
            case 'iso690':
                return `${a}. ${t}. ${p}: ${p}, ${y}.`;
            case 'gost':
                return `${a}. ${t} / ${a}. — ${p}: ${p}, ${y}.`;
            case 'abnt':
                return `${a.toUpperCase()}. ${t}. ${p}: ${p}, ${y}.`;
            case 'sist02':
            case 'jis':
                return `${a}. ${t}. ${p}, ${y}.`;
            case 'sni':
                return `${a}. (${y}). ${t}. ${p}.`;
            case 'gbt7714':
                return `${a}. ${t}[M]. ${p}: ${p}, ${y}.`;
            case 'kosis':
                return `${a} (${y}). ${t}. ${p}.`;

            // ── Machine / Export ──
            case 'bibtex': {
                const key = `${(a.split(' ').pop() || 'Author').replace(/[^a-zA-Z]/g, '')}${y}`;
                const type = book.type === 'journal' ? 'article' : 'book';
                const lines = [
                    `@${type}{${key},`,
                    `  author    = {${this.escape(a)}},`,
                    `  title     = {${this.escape(t)}},`,
                    `  year      = {${y}},`,
                    `  publisher = {${this.escape(p)}},`,
                    doi ? `  doi       = {${doi}},` : '',
                    isbn ? `  isbn      = {${isbn}},` : '',
                    `}`,
                ].filter(Boolean);
                return lines.join('\n');
            }
            case 'biblatex': {
                const key2 = `${(a.split(' ').pop() || 'Author').replace(/[^a-zA-Z]/g, '')}${y}`;
                return `@book{${key2},\n  author    = {${this.escape(a)}},\n  title     = {${this.escape(t)}},\n  year      = {${y}},\n  publisher = {${this.escape(p)}},${doi ? `\n  doi       = {${doi}},` : ''}${isbn ? `\n  isbn      = {${isbn}},` : ''}\n}`;
            }
            case 'ris':
                return `TY  - BOOK\nAU  - ${a}\nTI  - ${t}\nPY  - ${y}\nPB  - ${p}\n${doi ? `DO  - ${doi}\n` : ''}${isbn ? `SN  - ${isbn}\n` : ''}ER  -`;
            case 'csl':
                return JSON.stringify({ type: 'book', author: [{ literal: a }], title: t, issued: { 'date-parts': [[y]] }, publisher: p, DOI: doi || undefined }, null, 2);
            case 'endnote':
                return `%0 Book\n%A ${a}\n%T ${t}\n%D ${y}\n%I ${p}\n${doi ? `%U https://doi.org/${doi}\n` : ''}`;
            case 'refworks':
                return `RT Book\nA1 ${a}\nT1 ${t}\nYR ${y}\nPB ${p}\n${doi ? `DO ${doi}\n` : ''}`;
            case 'mods':
                return `<mods>\n  <titleInfo><title>${t}</title></titleInfo>\n  <name><namePart>${a}</namePart></name>\n  <originInfo><publisher>${p}</publisher><dateIssued>${y}</dateIssued></originInfo>\n</mods>`;
            case 'marc':
                return `100 1_ $a ${a}\n245 10 $a ${t}\n260 __ $b ${p} $c ${y}${doi ? `\n024 7_ $a ${doi} $2 doi` : ''}`;
            case 'crossref':
                return JSON.stringify({ type: 'book', title: t, author: a, publisher: p, published: y, DOI: doi || null }, null, 2);
            case 'datacite':
                return JSON.stringify({ creators: [{ name: a }], titles: [{ title: t }], publisher: p, publicationYear: y, identifier: doi ? { identifier: doi, identifierType: 'DOI' } : null }, null, 2);
            case 'doi_format':
                return doi ? `https://doi.org/${doi}` : `No DOI available for "${t}"`;

            default:
                return `${authorLastFirst()} (${y}). *${t}*. ${p}.${doi ? doiStr : isbnStr}`;
        }
    },
};

/* ═══════════════════════════════════════════════════════════════
   ALEX — app.js Part 3
   Settings, SearchEngines, BookDownload, AIChat
   ═══════════════════════════════════════════════════════════════ */

/* ── SETTINGS & API KEY MANAGER ────────────────────────────── */
const Settings = {
    saveKey(provider, value) {
        try {
            localStorage.setItem(`alex_key_${provider}`, value);
            this.updateKeyStatus(provider, value ? 'set' : 'unset');
            Toast.success(`${provider} API key saved.`);
        } catch (e) {
            Toast.error('Failed to save key — localStorage may be full.');
        }
    },

    getKey(provider) {
        return localStorage.getItem(`alex_key_${provider}`) || '';
    },

    removeKey(provider) {
        localStorage.removeItem(`alex_key_${provider}`);
        this.updateKeyStatus(provider, 'unset');
    },

    clearAllKeys() {
        const providers = ['openai', 'anthropic', 'serper', 'serpapi', 'tavily', 'brave', 'exa'];
        providers.forEach(p => localStorage.removeItem(`alex_key_${p}`));
        providers.forEach(p => this.updateKeyStatus(p, 'unset'));
        Toast.info('All API keys cleared.');
    },

    updateKeyStatus(provider, status) {
        const el = document.getElementById(`${provider}-key-status`) ||
            document.getElementById(`gpt-key-status`);
        if (!el) return;
        const labels = {
            set: { cls: 'key-status--set', icon: 'fa-circle-check', text: 'Configured' },
            unset: { cls: 'key-status--unset', icon: 'fa-circle', text: 'Not configured' },
            error: { cls: 'key-status--error', icon: 'fa-circle-xmark', text: 'Invalid key' },
            checking: { cls: 'key-status--checking', icon: 'fa-spinner fa-spin', text: 'Testing…' },
        };
        const cfg = labels[status] || labels.unset;
        el.className = `key-status ${cfg.cls}`;
        el.innerHTML = `<i class="fa-solid ${cfg.icon}"></i> ${cfg.text}`;
    },

    async testKey(provider) {
        const key = this.getKey(provider);
        if (!key) { Toast.warn(`No ${provider} key saved.`); return; }
        this.updateKeyStatus(provider, 'checking');

        try {
            let ok = false;
            if (provider === 'openai') {
                const r = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                    signal: AbortSignal.timeout(5000),
                });
                ok = r.status === 200;
            } else if (provider === 'anthropic') {
                const r = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
                    signal: AbortSignal.timeout(8000),
                });
                ok = r.status === 200 || r.status === 400;
            }
            this.updateKeyStatus(provider, ok ? 'set' : 'error');
            Toast[ok ? 'success' : 'error'](`${provider} key ${ok ? 'is valid ✓' : 'appears invalid ✗'}`);
        } catch {
            this.updateKeyStatus(provider, 'error');
            Toast.error(`Could not reach ${provider} API.`);
        }
    },

    getPref(key, def = null) {
        const v = localStorage.getItem(`alex_pref_${key}`);
        if (v === null) return def;
        try { return JSON.parse(v); } catch { return v; }
    },

    setPref(key, value) {
        localStorage.setItem(`alex_pref_${key}`, JSON.stringify(value));
    },

    loadAiUsage() {
        const stored = localStorage.getItem('alex_ai_usage');
        if (stored) {
            try { Object.assign(State.aiUsage, JSON.parse(stored)); } catch { }
        }
    },

    saveAiUsage() {
        localStorage.setItem('alex_ai_usage', JSON.stringify(State.aiUsage));
    },

    incrementUsage(provider, tokens = 0) {
        if (provider === 'gpt') State.aiUsage.gptCalls++;
        if (provider === 'claude') State.aiUsage.claudeCalls++;
        State.aiUsage.tokens += tokens;
        this.saveAiUsage();
        this.renderUsageStats();
    },

    incrementDownloads() {
        State.aiUsage.downloads++;
        this.saveAiUsage();
        this.renderUsageStats();
    },

    renderUsageStats() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('stat-gpt-calls', State.aiUsage.gptCalls);
        set('stat-claude-calls', State.aiUsage.claudeCalls);
        set('stat-tokens', State.aiUsage.tokens.toLocaleString());
        set('stat-dl-count', State.aiUsage.downloads);

        const max = Math.max(State.aiUsage.gptCalls, State.aiUsage.claudeCalls, 1);
        const setBar = (id, val, maxV) => {
            const el = document.getElementById(id);
            if (el) el.style.width = `${Math.min((val / maxV) * 100, 100)}%`;
        };
        setBar('bar-gpt', State.aiUsage.gptCalls, max);
        setBar('bar-claude', State.aiUsage.claudeCalls, max);
    },

    exportAllData() {
        const data = {
            exported_at: new Date().toISOString(),
            user: State.user,
            books: State.books,
            ideas: State.ideas,
            insights: State.insights,
            quotes: State.quotes,
            decisions: State.decisions,
            activity: State.activity,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `alex-export-${Date.now()}.json`;
        a.click(); URL.revokeObjectURL(url);
        Toast.success('Data exported successfully.');
    },

    async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.books && !data.ideas) { Toast.error('Invalid ALEX export file.'); return; }
            if (data.books?.length) { for (const b of data.books) await DB.put(ALEX.STORES.BOOKS, b); State.books = data.books; }
            if (data.ideas?.length) { for (const i of data.ideas) await DB.put(ALEX.STORES.IDEAS, i); State.ideas = data.ideas; }
            if (data.insights?.length) { for (const i of data.insights) await DB.put(ALEX.STORES.INSIGHTS, i); State.insights = data.insights; }
            if (data.quotes?.length) { for (const q of data.quotes) await DB.put(ALEX.STORES.QUOTES, q); State.quotes = data.quotes; }
            if (data.decisions?.length) { for (const d of data.decisions) await DB.put(ALEX.STORES.DECISIONS, d); State.decisions = data.decisions; }
            Render.updateBadges();
            Toast.success(`Imported: ${data.books?.length || 0} books, ${data.ideas?.length || 0} ideas, and more.`);
        } catch { Toast.error('Failed to import — file may be corrupted.'); }
    },

    initEventListeners() {
        document.querySelectorAll('[data-settings-section]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-settings-section]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.settingsSection;
                const sections = {
                    'ai-providers': ['settings-ai-providers', 'settings-ai-claude'],
                    'preferences': ['settings-preferences'],
                    'data': ['settings-data'],
                };
                ['settings-ai-providers', 'settings-ai-claude', 'settings-preferences', 'settings-data'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                const show = sections[target] || [];
                show.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
            });
        });

        document.getElementById('save-openai-key-btn')?.addEventListener('click', () => {
            const val = document.getElementById('settings-openai-key')?.value?.trim();
            if (!val) { Toast.warn('Enter an API key first.'); return; }
            Settings.saveKey('openai', val);
            const statusEl = document.getElementById('gpt-key-status');
            if (statusEl) { statusEl.className = 'key-status key-status--set'; statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Configured'; }
        });

        document.getElementById('test-openai-key-btn')?.addEventListener('click', () => Settings.testKey('openai'));

        document.getElementById('save-anthropic-key-btn')?.addEventListener('click', () => {
            const val = document.getElementById('settings-anthropic-key')?.value?.trim();
            if (!val) { Toast.warn('Enter an API key first.'); return; }
            Settings.saveKey('anthropic', val);
            const statusEl = document.getElementById('claude-key-status');
            if (statusEl) { statusEl.className = 'key-status key-status--set'; statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Configured'; }
        });

        document.getElementById('test-anthropic-key-btn')?.addEventListener('click', () => Settings.testKey('anthropic'));

        ['pref-auto-context', 'pref-save-chats', 'pref-auto-add-dl', 'pref-ai-summaries'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = Settings.getPref(id, el.id === 'pref-save-chats' || el.id === 'pref-auto-add-dl');
            el.addEventListener('change', () => Settings.setPref(id, el.checked));
        });

        document.getElementById('export-all-data-btn')?.addEventListener('click', () => Settings.exportAllData());

        document.getElementById('import-data-btn')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });
        document.getElementById('import-file-input')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) Settings.importData(file);
            e.target.value = '';
        });

        document.getElementById('clear-api-keys-btn')?.addEventListener('click', () => {
            if (confirm('Clear ALL API keys from this device?')) Settings.clearAllKeys();
        });
    },

    onPageEnter() {
        const loadKey = (inputId, provider) => {
            const el = document.getElementById(inputId);
            if (el) el.value = Settings.getKey(provider) ? '••••••••••••••••' : '';
        };
        loadKey('settings-openai-key', 'openai');
        loadKey('settings-anthropic-key', 'anthropic');

        ['openai', 'anthropic'].forEach(p => {
            Settings.updateKeyStatus(p, Settings.getKey(p) ? 'set' : 'unset');
        });

        const gptModel = Settings.getPref('gpt_model', 'gpt-4o');
        const claudeModel = Settings.getPref('claude_model', 'claude-sonnet-4-6');
        const gptSel = document.getElementById('settings-gpt-model');
        const claudeSel = document.getElementById('settings-claude-model');
        if (gptSel) gptSel.value = gptModel;
        if (claudeSel) claudeSel.value = claudeModel;
        gptSel?.addEventListener('change', () => Settings.setPref('gpt_model', gptSel.value));
        claudeSel?.addEventListener('change', () => Settings.setPref('claude_model', claudeSel.value));

        this.renderUsageStats();
    },
};

/* ── SEARCH ENGINE MANAGER ─────────────────────────────────── */
const SearchEngines = {
    load() {
        const engines = ['google_books', 'open_library', 'serper', 'serpapi', 'tavily', 'brave', 'exa'];
        engines.forEach(id => {
            const enabled = localStorage.getItem(`alex_engine_${id}_enabled`);
            const toggle = document.getElementById(`toggle-${id}`);
            if (toggle && enabled !== null) toggle.checked = JSON.parse(enabled);

            const key = Settings.getKey(id);
            const keyInput = document.getElementById(`key-${id}`);
            if (keyInput && key) keyInput.value = '••••••••••••••••';
            if (key) {
                const statusEl = document.getElementById(`status-${id}`);
                if (statusEl) {
                    statusEl.className = 'engine-api-status engine-api-status--ok';
                    statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Key saved';
                }
            }
        });

        const custom = JSON.parse(localStorage.getItem('alex_custom_engines') || '[]');
        custom.forEach(eng => this.renderCustomEngineCard(eng));

        State.activeEngine = localStorage.getItem('alex_active_engine') || 'google_books';
        this.updateActiveIndicator();
    },

    save(engineId) {
        const toggle = document.getElementById(`toggle-${engineId}`);
        if (toggle) localStorage.setItem(`alex_engine_${engineId}_enabled`, JSON.stringify(toggle.checked));

        const keyInput = document.getElementById(`key-${engineId}`);
        if (keyInput && keyInput.value && !keyInput.value.includes('•')) {
            Settings.saveKey(engineId, keyInput.value);
            const statusEl = document.getElementById(`status-${engineId}`);
            if (statusEl) {
                statusEl.className = 'engine-api-status engine-api-status--ok';
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Key saved';
            }
        }
    },

    updateActiveIndicator() {
        const nameEl = document.getElementById('active-engine-name');
        const labels = {
            google_books: 'Google Books (free)', open_library: 'Open Library (free)',
            serper: 'Serper', serpapi: 'SerpAPI', tavily: 'Tavily AI',
            brave: 'Brave Search', exa: 'Exa AI',
        };
        if (nameEl) nameEl.textContent = labels[State.activeEngine] || State.activeEngine;
    },

    saveCustomEngine(eng) {
        const existing = JSON.parse(localStorage.getItem('alex_custom_engines') || '[]');
        existing.push(eng);
        localStorage.setItem('alex_custom_engines', JSON.stringify(existing));
        this.renderCustomEngineCard(eng);
        Toast.success(`Engine "${eng.name}" added.`);
    },

    renderCustomEngineCard(eng) {
        const grid = document.getElementById('engine-grid');
        if (!grid) return;
        const card = document.createElement('div');
        card.className = 'engine-card';
        card.dataset.engine = eng.id;
        card.innerHTML = `
      <div class="engine-header">
        <div class="engine-logo engine-logo--custom">${eng.icon || '🔍'}</div>
        <div class="engine-meta">
          <div class="engine-name">${Utils.sanitize(eng.name)}</div>
          <div class="engine-provider">${Utils.sanitize(eng.endpoint || 'Custom endpoint')}</div>
        </div>
        <label class="engine-toggle">
          <input type="checkbox" id="toggle-${eng.id}" checked />
          <div class="engine-toggle-track"></div>
        </label>
      </div>`;
        const addCard = document.getElementById('add-engine-card');
        if (addCard) grid.insertBefore(card, addCard);
        else grid.appendChild(card);
    },

    initEventListeners() {
        document.querySelectorAll('.engine-save-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.engine-card');
                if (card) this.save(card.dataset.engine);
            });
        });

        document.querySelectorAll('.engine-toggle input').forEach(toggle => {
            toggle.addEventListener('change', () => {
                const card = toggle.closest('.engine-card');
                if (card) this.save(card.dataset.engine);
            });
        });

        document.getElementById('add-custom-engine-btn')?.addEventListener('click', () => Modal.open('modal-custom-engine'));
        document.getElementById('add-engine-card')?.addEventListener('click', () => Modal.open('modal-custom-engine'));

        document.getElementById('save-custom-engine-btn')?.addEventListener('click', () => {
            const name = document.getElementById('ce-name')?.value?.trim();
            const endpoint = document.getElementById('ce-endpoint')?.value?.trim();
            if (!name || !endpoint) { Toast.warn('Name and endpoint URL are required.'); return; }
            const eng = {
                id: Utils.id(),
                name, endpoint,
                icon: document.getElementById('ce-icon')?.value?.trim() || '🔍',
                key: document.getElementById('ce-key')?.value?.trim() || '',
                queryParam: document.getElementById('ce-query-param')?.value?.trim() || 'q',
                notes: document.getElementById('ce-notes')?.value?.trim() || '',
            };
            this.saveCustomEngine(eng);
            Modal.close('modal-custom-engine');
            ['ce-name', 'ce-endpoint', 'ce-icon', 'ce-key', 'ce-notes'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const qpEl = document.getElementById('ce-query-param');
            if (qpEl) qpEl.value = 'q';
        });
    },

    onPageEnter() {
        this.load();
    },
};

/* ── BOOK DOWNLOAD ENGINE ──────────────────────────────────── */
const BookDownload = {
    _currentBook: null,
    _selectedFormat: null,

    async search(query) {
        if (!query.trim()) { Toast.warn('Enter a search query.'); return; }

        const sources = [...document.querySelectorAll('[name="dl-source"]:checked')].map(el => el.value);
        if (!sources.length) { Toast.warn('Select at least one source.'); return; }

        const container = document.getElementById('download-results');
        const header = document.getElementById('download-results-header');
        const meta = document.getElementById('download-results-meta');
        const format = document.getElementById('dl-format-filter')?.value || '';
        const lang = document.getElementById('dl-lang-filter')?.value || '';

        if (container) container.innerHTML = `<div class="search-loading" style="grid-column:1/-1">
      <div class="search-spinner"></div>
      <p style="font-size:0.85rem;color:var(--text-tertiary);margin-top:8px">Searching open-access sources…</p>
    </div>`;

        const fetchers = {
            open_library: () => this._searchOpenLibrary(query, { format, lang }),
            internet_archive: () => this._searchInternetArchive(query, { format, lang }),
            project_gutenberg: () => this._searchGutenberg(query),
            standard_ebooks: () => Promise.resolve([]),
            manybooks: () => Promise.resolve([]),
        };

        const promises = sources.map(src => (fetchers[src] || (() => Promise.resolve([])))().catch(() => []));
        const results = (await Promise.all(promises)).flat();
        State.downloadResults = results;

        if (!results.length) {
            if (container) container.innerHTML = `<div class="search-idle" style="grid-column:1/-1">
        <div class="idle-icon">😕</div>
        <h3>No results found</h3>
        <p>Try different keywords or enable more sources.</p>
      </div>`;
            if (header) header.style.display = 'none';
            return;
        }

        if (header) header.style.display = 'flex';
        if (meta) meta.textContent = `${results.length} books found across ${sources.length} source${sources.length > 1 ? 's' : ''}`;
        if (container) this._renderResults(results, container);
    },

    async _searchOpenLibrary(query, filters) {
        const params = new URLSearchParams({
            q: query, limit: 15, has_fulltext: 'true',
            fields: 'key,title,author_name,first_publish_year,publisher,cover_i,isbn,language,subject,number_of_pages_median'
        });
        const r = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return [];
        const data = await r.json();
        return (data.docs || []).map(doc => ({
            id: Utils.id(),
            source: 'Open Library',
            sourceKey: 'open_library',
            olKey: doc.key,
            title: doc.title || 'Unknown Title',
            authors: doc.author_name || [],
            year: doc.first_publish_year || null,
            cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
            isbn: doc.isbn?.[0] || null,
            language: doc.language?.[0] || null,
            subjects: doc.subject?.slice(0, 3) || [],
            pages: doc.number_of_pages_median || null,
            formats: ['PDF', 'ePub', 'Plain Text'],
            downloadUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
            free: true,
        }));
    },

    async _searchInternetArchive(query, filters) {
        const q = `${query} AND mediatype:texts AND subject:book`;
        const params = new URLSearchParams({
            q, output: 'json', rows: 12,
            fl: 'identifier,title,creator,date,publisher,language,description,downloads'
        });
        const r = await fetch(`https://archive.org/advancedsearch.php?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return [];
        const data = await r.json();
        return (data.response?.docs || []).map(doc => ({
            id: Utils.id(),
            source: 'Internet Archive',
            sourceKey: 'internet_archive',
            iaId: doc.identifier,
            title: doc.title || 'Unknown Title',
            authors: doc.creator ? (Array.isArray(doc.creator) ? doc.creator : [doc.creator]) : [],
            year: doc.date ? parseInt(doc.date) : null,
            cover: doc.identifier ? `https://archive.org/services/img/${doc.identifier}` : null,
            language: Array.isArray(doc.language) ? doc.language[0] : (doc.language || null),
            description: doc.description || null,
            formats: ['PDF', 'ePub', 'Plain Text', 'Kindle'],
            downloadUrl: `https://archive.org/details/${doc.identifier}`,
            free: true,
            downloads: doc.downloads || 0,
        }));
    },

    async _searchGutenberg(query) {
        const params = new URLSearchParams({ search: query, mime_type: 'application/pdf' });
        const r = await fetch(`https://gutendex.com/books?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return [];
        const data = await r.json();
        return (data.results || []).slice(0, 10).map(book => {
            const formats = [];
            if (book.formats['application/pdf']) formats.push('PDF');
            if (book.formats['application/epub+zip']) formats.push('ePub');
            if (book.formats['text/plain']) formats.push('Plain Text');
            return {
                id: Utils.id(),
                source: 'Project Gutenberg',
                sourceKey: 'project_gutenberg',
                gutenbergId: book.id,
                title: book.title || 'Unknown Title',
                authors: (book.authors || []).map(a => a.name),
                year: null,
                cover: book.formats['image/jpeg'] || null,
                language: book.languages?.[0] || null,
                subjects: book.subjects?.slice(0, 3) || [],
                formats: formats.length ? formats : ['Plain Text'],
                formatUrls: book.formats,
                downloadUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
                free: true,
            };
        });
    },

    _renderResults(results, container) {
        container.innerHTML = results.map(book => {
            const authors = (book.authors || []).join(', ') || 'Unknown Author';
            const coverHTML = book.cover
                ? `<img class="result-cover" src="${Utils.sanitize(book.cover)}" alt="Cover" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
           <div class="result-cover-placeholder" style="display:none">📖</div>`
                : `<div class="result-cover-placeholder">📖</div>`;

            const formatPills = (book.formats || []).map(f =>
                `<span class="format-pill format-pill--${f.toLowerCase().replace(/[^a-z]/g, '')}">${f}</span>`
            ).join('');

            const alreadyIn = State.books.some(b =>
                b.title?.toLowerCase() === book.title?.toLowerCase() ||
                (book.isbn && b.isbn === book.isbn)
            );

            return `<div class="download-card" data-id="${book.id}">
        <div style="position:relative;">
          ${coverHTML}
          <span class="download-free-badge">FREE</span>
          <span class="download-source-badge">${Utils.sanitize(book.source)}</span>
        </div>
        <div class="result-body">
          <div class="result-title">${Utils.sanitize(book.title)}</div>
          <div class="result-author">${Utils.sanitize(authors)}</div>
          ${book.year ? `<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:2px">${book.year}</div>` : ''}
          <div class="download-formats">${formatPills}</div>
        </div>
        <div class="download-card-actions">
          ${alreadyIn
                ? `<span style="font-size:0.78rem;color:var(--accent-green);padding:6px 8px;text-align:center;flex:1"><i class="fa-solid fa-check"></i> In Library</span>`
                : `<button class="btn-download-quick" onclick="BookDownload.openDownloadModal('${book.id}')">
                 <i class="fa-solid fa-download"></i> Download
               </button>`
            }
          <button class="btn-sm" onclick="window.open('${Utils.sanitize(book.downloadUrl || '#')}','_blank')" title="Open source page">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
        </div>
      </div>`;
        }).join('');
    },

    openDownloadModal(bookId) {
        const book = State.downloadResults.find(b => b.id === bookId);
        if (!book) return;
        this._currentBook = book;
        this._selectedFormat = null;

        const titleEl = document.getElementById('dl-modal-title');
        const authorEl = document.getElementById('dl-modal-author');
        const descEl = document.getElementById('dl-modal-desc');
        const metaEl = document.getElementById('dl-modal-meta');
        const coverEl = document.getElementById('dl-modal-cover');
        const formatEl = document.getElementById('dl-format-options');
        const dlBtn = document.getElementById('dl-download-btn');

        if (titleEl) titleEl.textContent = book.title;
        if (authorEl) authorEl.textContent = (book.authors || []).join(', ') || 'Unknown Author';
        if (descEl) descEl.textContent = book.description || `Available from ${book.source}. Click a format below to download.`;
        if (coverEl) {
            coverEl.innerHTML = book.cover
                ? `<img src="${Utils.sanitize(book.cover)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md);" alt="Cover" onerror="this.parentElement.textContent='📖'">`
                : '📖';
        }
        if (metaEl) {
            metaEl.innerHTML = [
                `<span class="result-tag result-tag--source">${book.source}</span>`,
                book.year ? `<span class="result-tag">${book.year}</span>` : '',
                book.language ? `<span class="result-tag">${book.language.toUpperCase()}</span>` : '',
                `<span class="tag-chip" style="background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:var(--accent-green)">Free</span>`,
            ].filter(Boolean).join('');
        }

        if (formatEl) {
            const formatDetails = {
                PDF: { icon: '📕', desc: 'Best for reading on screen or printing', ext: 'pdf' },
                ePub: { icon: '📱', desc: 'Ideal for e-readers and mobile apps', ext: 'epub' },
                'Plain Text': { icon: '📄', desc: 'Universal format, smallest file size', ext: 'txt' },
                Kindle: { icon: '📲', desc: 'For Amazon Kindle devices', ext: 'mobi' },
                HTML: { icon: '🌐', desc: 'Read directly in browser', ext: 'html' },
            };
            formatEl.innerHTML = (book.formats || ['PDF']).map((fmt, i) => {
                const info = formatDetails[fmt] || { icon: '📄', desc: 'Document format', ext: fmt.toLowerCase() };
                return `<label class="dl-format-row" id="fmt-row-${i}">
          <input type="radio" class="dl-format-radio" name="dl-format" value="${fmt}" onchange="BookDownload.selectFormat('${fmt}', ${i})" />
          <div class="dl-format-info">
            <div class="dl-format-name">${info.icon} ${fmt}</div>
            <div class="dl-format-details">${info.desc}</div>
          </div>
        </label>`;
            }).join('');
        }

        if (dlBtn) dlBtn.disabled = true;
        Modal.open('modal-book-download');
    },

    selectFormat(fmt, idx) {
        this._selectedFormat = fmt;
        document.querySelectorAll('.dl-format-row').forEach((row, i) => {
            row.classList.toggle('selected', i === idx);
        });
        const dlBtn = document.getElementById('dl-download-btn');
        if (dlBtn) dlBtn.disabled = false;
    },

    async downloadSelected() {
        const book = this._currentBook;
        const fmt = this._selectedFormat;
        if (!book || !fmt) { Toast.warn('Select a format first.'); return; }
        Modal.close('modal-book-download');
        await this.downloadBook(book, fmt);
    },

    async downloadBook(book, fmt) {
        const modalEl = document.getElementById('modal-dl-progress');
        const titleEl = document.getElementById('dlp-filename');
        const sourceEl = document.getElementById('dlp-source');
        const barEl = document.getElementById('dlp-bar');
        const statusEl = document.getElementById('dlp-status');
        const iconEl = document.getElementById('dlp-icon');

        if (modalEl) {
            modalEl.removeAttribute('hidden');
            if (titleEl) titleEl.textContent = book.title;
            if (sourceEl) sourceEl.textContent = `From: ${book.source}`;
            if (barEl) barEl.style.width = '0%';
            if (statusEl) statusEl.textContent = 'Connecting to source…';
            if (iconEl) iconEl.textContent = '📥';
        }

        const animateBar = (pct, msg) => {
            if (barEl) barEl.style.width = `${pct}%`;
            if (statusEl) statusEl.textContent = msg;
        };

        animateBar(20, 'Locating file…');
        await new Promise(r => setTimeout(r, 400));
        animateBar(50, 'Preparing download…');
        await new Promise(r => setTimeout(r, 500));
        animateBar(80, 'Initiating download…');
        await new Promise(r => setTimeout(r, 300));

        let dlUrl = null;
        try { dlUrl = this._buildDownloadUrl(book, fmt); }
        catch (e) { dlUrl = book.downloadUrl; }

        animateBar(100, 'Opening download…');
        await new Promise(r => setTimeout(r, 300));

        if (iconEl) iconEl.innerHTML = '<span class="dl-success-icon">✅</span>';
        if (statusEl) statusEl.textContent = 'Download started!';

        if (dlUrl) window.open(dlUrl, '_blank', 'noopener');

        await new Promise(r => setTimeout(r, 1200));
        if (modalEl) modalEl.setAttribute('hidden', '');

        Settings.incrementDownloads();
        State.downloadHistory.push({ ...book, format: fmt, downloadedAt: Utils.ts() });

        if (Settings.getPref('pref-auto-add-dl', true)) {
            const exists = State.books.some(b => b.title?.toLowerCase() === book.title?.toLowerCase());
            if (!exists) await Books.addFromDownload(book);
        }

        await Activity.log('file', `Downloaded "${book.title}" (${fmt}) from ${book.source}`);
        Toast.success(`"${book.title}" download started!`);
    },

    _buildDownloadUrl(book, fmt) {
        const extMap = { 'PDF': 'pdf', 'ePub': 'epub', 'Plain Text': 'txt', 'Kindle': 'mobi' };
        const ext = extMap[fmt] || 'pdf';

        if (book.sourceKey === 'project_gutenberg' && book.formatUrls) {
            if (fmt === 'PDF') return book.formatUrls['application/pdf'] || book.downloadUrl;
            if (fmt === 'ePub') return book.formatUrls['application/epub+zip'] || book.downloadUrl;
            if (fmt === 'Plain Text') return book.formatUrls['text/plain; charset=utf-8'] || book.formatUrls['text/plain'] || book.downloadUrl;
        }

        if (book.sourceKey === 'internet_archive' && book.iaId) {
            return `https://archive.org/download/${book.iaId}/${book.iaId}.${ext}`;
        }

        if (book.sourceKey === 'open_library' && book.isbn) {
            return `https://openlibrary.org/api/books?bibkeys=ISBN:${book.isbn}&format=json&jscmd=data`;
        }

        return book.downloadUrl || '#';
    },

    initEventListeners() {
        const searchBtn = document.getElementById('download-search-btn');
        const searchInput = document.getElementById('download-search-input');

        searchBtn?.addEventListener('click', () => {
            BookDownload.search(searchInput?.value?.trim() || '');
        });
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') BookDownload.search(searchInput.value.trim());
        });

        document.getElementById('dl-download-btn')?.addEventListener('click', () => BookDownload.downloadSelected());

        document.getElementById('dl-add-library-btn')?.addEventListener('click', async () => {
            if (!BookDownload._currentBook) return;
            await Books.addFromDownload(BookDownload._currentBook);
            Modal.close('modal-book-download');
        });
    },

    onPageEnter() {
        const hasApiKey = Settings.getKey('serper') || Settings.getKey('serpapi');
        const statusEl = document.getElementById('download-api-status');
        if (statusEl) {
            if (hasApiKey) {
                statusEl.className = 'key-status key-status--set';
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> API Connected';
            } else {
                statusEl.className = 'key-status';
                statusEl.innerHTML = '<i class="fa-solid fa-book"></i> Free sources active';
            }
        }
    },
};

/* ── AI CHAT MODULE ────────────────────────────────────────── */
const AIChat = {
    _abortController: null,

    setModel(model) {
        State.chatModel = model;
        document.querySelectorAll('.chat-model-tab').forEach(tab => {
            const m = tab.dataset.model;
            tab.className = 'chat-model-tab' + (m === model ? ` active--${model}` : '');
        });
        const gptSel = document.getElementById('gpt-model-select');
        const claudeSel = document.getElementById('claude-model-select');
        if (gptSel) gptSel.classList.toggle('hidden', model === 'claude');
        if (claudeSel) claudeSel.classList.toggle('hidden', model === 'gpt');
    },

    newConversation() {
        State.chatHistory = [];
        State.chatCurrentId = Utils.id();
        this.renderMessages();
        document.getElementById('chat-welcome')?.style.setProperty('display', 'flex');
        document.getElementById('chat-input')?.focus();
    },

    async saveConversation() {
        if (!State.chatHistory.length) return;
        if (!Settings.getPref('pref-save-chats', true)) return;
        const conv = {
            id: State.chatCurrentId || Utils.id(),
            title: State.chatHistory[0]?.content?.slice(0, 50) || 'Conversation',
            model: State.chatModel,
            messages: State.chatHistory,
            created_at: Utils.ts(),
            updated_at: Utils.ts(),
        };
        State.chatCurrentId = conv.id;
        await DB.put(ALEX.STORES.CHATS, conv);
        State.chatConversations = await DB.getAll(ALEX.STORES.CHATS);
        this.renderHistory();
    },

    async loadHistory() {
        State.chatConversations = await DB.getAll(ALEX.STORES.CHATS).catch(() => []);
        this.renderHistory();
    },

    renderHistory() {
        const list = document.getElementById('chat-history-list');
        if (!list) return;
        const convs = [...State.chatConversations].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 50);

        if (!convs.length) {
            list.innerHTML = `<div class="empty-state" style="padding:2rem 1rem"><i class="fa-regular fa-comment"></i><p>No conversations yet.</p></div>`;
            return;
        }
        list.innerHTML = convs.map(c => {
            const iconMap = { gpt: 'chat-history-icon--gpt', claude: 'chat-history-icon--claude', both: 'chat-history-icon--mixed' };
            const emojiMap = { gpt: '🤖', claude: '✨', both: '⚖️' };
            return `<div class="chat-history-item ${c.id === State.chatCurrentId ? 'active' : ''}" onclick="AIChat.loadConversation('${c.id}')">
        <div class="chat-history-icon ${iconMap[c.model] || iconMap.gpt}">${emojiMap[c.model] || '🤖'}</div>
        <div class="chat-history-meta">
          <div class="chat-history-title">${Utils.sanitize(c.title)}</div>
          <div class="chat-history-preview">${c.messages?.length || 0} messages</div>
        </div>
        <div class="chat-history-time">${Utils.timeAgo(c.updated_at)}</div>
      </div>`;
        }).join('');
    },

    async loadConversation(id) {
        const conv = State.chatConversations.find(c => c.id === id);
        if (!conv) return;
        State.chatCurrentId = id;
        State.chatHistory = conv.messages || [];
        State.chatModel = conv.model || 'gpt';
        this.setModel(State.chatModel);
        this.renderMessages();
        this.renderHistory();
    },

    renderMessages() {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const welcome = document.getElementById('chat-welcome');
        if (!State.chatHistory.length) {
            if (welcome) welcome.style.display = 'flex';
            container.querySelectorAll('.chat-message').forEach(el => el.remove());
            return;
        }
        if (welcome) welcome.style.display = 'none';

        container.querySelectorAll('.chat-message').forEach(el => el.remove());

        State.chatHistory.forEach(msg => {
            const el = this._buildMessageEl(msg);
            container.appendChild(el);
        });

        this.scrollToBottom();
    },

    _buildMessageEl(msg) {
        const isUser = msg.role === 'user';
        const provider = msg.provider || State.chatModel;

        const wrap = document.createElement('div');
        wrap.className = `chat-message chat-message--${isUser ? 'user' : 'assistant'}`;
        wrap.dataset.msgId = msg.id || '';

        const avatarIcon = isUser ? `<i class="fa-solid fa-user"></i>`
            : (provider === 'claude' ? `<i class="fa-solid fa-wand-magic-sparkles"></i>` : `<i class="fa-solid fa-circle-nodes"></i>`);

        const bubble = this._renderMarkdown(msg.content || '');

        wrap.innerHTML = `
      <div class="chat-avatar chat-avatar--${isUser ? 'user' : provider}">${avatarIcon}</div>
      <div>
        <div class="chat-bubble chat-bubble--${isUser ? 'user' : provider}">${bubble}</div>
        <div class="bubble-actions">
          <button class="bubble-action-btn" onclick="AIChat.copyMessage(this)"><i class="fa-regular fa-copy"></i> Copy</button>
          ${!isUser ? `<span class="model-badge model-badge--${provider}">${provider === 'gpt' ? 'ChatGPT' : 'Claude'}</span>` : ''}
        </div>
      </div>`;
        return wrap;
    },

    _renderMarkdown(text) {
        return Utils.sanitize(text)
            .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`)
            .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[hup]|<\/[hup]|<li|<ul)(.+)$/gm, '<p>$1</p>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    },

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    },

    async send() {
        const input = document.getElementById('chat-input');
        const content = input?.value?.trim();
        if (!content || State.chatStreaming) return;

        if (input) { input.value = ''; input.style.height = 'auto'; }
        this.updateCharCount();
        this.setSendState(true);

        const userMsg = { id: Utils.id(), role: 'user', content, created_at: Utils.ts() };
        State.chatHistory.push(userMsg);

        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.style.display = 'none';

        const container = document.getElementById('chat-messages');
        container?.appendChild(this._buildMessageEl(userMsg));
        this.scrollToBottom();

        let systemPrompt = `You are ALEX's AI assistant — a brilliant, knowledgeable, and concise intellectual companion. Be direct and insightful.`;
        if (Settings.getPref('pref-auto-context', false) && State.books.length) {
            const bookList = State.books.slice(0, 20).map(b => `- "${b.title}" by ${b.author || 'Unknown'} (${b.status})`).join('\n');
            systemPrompt += `\n\nUser's library (${State.books.length} books):\n${bookList}`;
        }

        if (State.chatModel === 'both') {
            await this._sendCompare(content, systemPrompt);
        } else if (State.chatModel === 'gpt') {
            await this._sendGPT(content, systemPrompt);
        } else {
            await this._sendClaude(content, systemPrompt);
        }

        this.setSendState(false);
        await this.saveConversation();
    },

    async _sendGPT(content, systemPrompt) {
        const key = Settings.getKey('openai');
        if (!key) { this._showError('OpenAI API key not configured. Go to Settings & API to add your key.'); return; }

        const model = document.getElementById('gpt-model-select')?.value || Settings.getPref('gpt_model', 'gpt-4o');
        const messages = [
            { role: 'system', content: systemPrompt },
            ...State.chatHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
        ];

        const typingEl = this._addTyping('gpt');
        this._abortController = new AbortController();

        try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({ model, messages, stream: true }),
                signal: this._abortController.signal,
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${resp.status}`);
            }

            const assistantMsg = { id: Utils.id(), role: 'assistant', provider: 'gpt', content: '', created_at: Utils.ts() };
            State.chatHistory.push(assistantMsg);
            typingEl?.remove();

            const msgEl = this._buildMessageEl(assistantMsg);
            document.getElementById('chat-messages')?.appendChild(msgEl);
            const bubbleEl = msgEl.querySelector('.chat-bubble');

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
                for (const line of lines) {
                    try {
                        const delta = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content || '';
                        fullText += delta;
                        assistantMsg.content = fullText;
                        if (bubbleEl) bubbleEl.innerHTML = this._renderMarkdown(fullText) + '<span class="stream-cursor"></span>';
                        this.scrollToBottom();
                    } catch { }
                }
            }

            if (bubbleEl) bubbleEl.innerHTML = this._renderMarkdown(fullText);
            Settings.incrementUsage('gpt', 0);

        } catch (err) {
            typingEl?.remove();
            if (err.name !== 'AbortError') this._showError(`GPT error: ${err.message}`);
        }
    },

    async _sendClaude(content, systemPrompt) {
        const key = Settings.getKey('anthropic');
        if (!key) { this._showError('Anthropic API key not configured. Go to Settings & API to add your key.'); return; }

        const model = document.getElementById('claude-model-select')?.value || Settings.getPref('claude_model', 'claude-sonnet-4-6');
        const messages = State.chatHistory.slice(-20)
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content }));

        const typingEl = this._addTyping('claude');
        this._abortController = new AbortController();

        try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'messages-2023-12-15',
                },
                body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages, stream: true }),
                signal: this._abortController.signal,
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${resp.status}`);
            }

            const assistantMsg = { id: Utils.id(), role: 'assistant', provider: 'claude', content: '', created_at: Utils.ts() };
            State.chatHistory.push(assistantMsg);
            typingEl?.remove();

            const msgEl = this._buildMessageEl(assistantMsg);
            document.getElementById('chat-messages')?.appendChild(msgEl);
            const bubbleEl = msgEl.querySelector('.chat-bubble');

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
                for (const line of lines) {
                    try {
                        const ev = JSON.parse(line.slice(6));
                        if (ev.type === 'content_block_delta') {
                            fullText += ev.delta?.text || '';
                            assistantMsg.content = fullText;
                            if (bubbleEl) bubbleEl.innerHTML = this._renderMarkdown(fullText) + '<span class="stream-cursor"></span>';
                            this.scrollToBottom();
                        }
                    } catch { }
                }
            }

            if (bubbleEl) bubbleEl.innerHTML = this._renderMarkdown(fullText);
            Settings.incrementUsage('claude', 0);

        } catch (err) {
            typingEl?.remove();
            if (err.name !== 'AbortError') this._showError(`Claude error: ${err.message}`);
        }
    },

    async _sendCompare(content, systemPrompt) {
        const container = document.getElementById('chat-messages');
        const wrapEl = document.createElement('div');
        wrapEl.className = 'chat-message chat-message--compare';
        wrapEl.innerHTML = `<div style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:var(--space-sm);padding:0 4px">Comparing responses…</div>
      <div class="compare-row">
        <div class="compare-pane">
          <div class="compare-pane-header compare-pane-header--gpt"><i class="fa-solid fa-circle-nodes"></i> ChatGPT</div>
          <div class="compare-pane-body" id="compare-gpt">
            <div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
          </div>
        </div>
        <div class="compare-pane">
          <div class="compare-pane-header compare-pane-header--claude"><i class="fa-solid fa-wand-magic-sparkles"></i> Claude</div>
          <div class="compare-pane-body" id="compare-claude">
            <div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
          </div>
        </div>
      </div>`;
        container?.appendChild(wrapEl);
        this.scrollToBottom();

        const gptKey = Settings.getKey('openai');
        const claudeKey = Settings.getKey('anthropic');

        const promises = [];

        if (gptKey) {
            promises.push(this._streamToElement('gpt', content, systemPrompt, document.getElementById('compare-gpt')));
        } else {
            const el = document.getElementById('compare-gpt');
            if (el) el.innerHTML = '<p style="color:var(--text-tertiary);font-size:0.82rem;">No OpenAI key configured.</p>';
        }

        if (claudeKey) {
            promises.push(this._streamToElement('claude', content, systemPrompt, document.getElementById('compare-claude')));
        } else {
            const el = document.getElementById('compare-claude');
            if (el) el.innerHTML = '<p style="color:var(--text-tertiary);font-size:0.82rem;">No Anthropic key configured.</p>';
        }

        await Promise.all(promises);
    },

    async _streamToElement(provider, content, systemPrompt, targetEl) {
        const key = provider === 'gpt' ? Settings.getKey('openai') : Settings.getKey('anthropic');
        if (!key || !targetEl) return;

        let fullText = '';
        const update = () => {
            targetEl.innerHTML = this._renderMarkdown(fullText) + '<span class="stream-cursor"></span>';
            this.scrollToBottom();
        };

        try {
            if (provider === 'gpt') {
                const model = document.getElementById('gpt-model-select')?.value || 'gpt-4o';
                const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                    body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content }] }),
                });
                const reader = resp.body.getReader();
                const dec = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    for (const line of dec.decode(value).split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]')) {
                        try { fullText += JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content || ''; update(); } catch { }
                    }
                }
            } else {
                const model = document.getElementById('claude-model-select')?.value || 'claude-sonnet-4-6';
                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'messages-2023-12-15' },
                    body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, stream: true, messages: [{ role: 'user', content }] }),
                });
                const reader = resp.body.getReader();
                const dec = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    for (const line of dec.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
                        try { const ev = JSON.parse(line.slice(6)); if (ev.type === 'content_block_delta') { fullText += ev.delta?.text || ''; update(); } } catch { }
                    }
                }
            }
            targetEl.innerHTML = this._renderMarkdown(fullText);
        } catch (e) {
            targetEl.innerHTML = `<p style="color:var(--accent-red);font-size:0.82rem;">Error: ${Utils.sanitize(e.message)}</p>`;
        }
    },

    _addTyping(provider) {
        const container = document.getElementById('chat-messages');
        const el = document.createElement('div');
        el.className = 'chat-message chat-message--assistant chat-typing';
        el.id = 'typing-indicator';
        const iconMap = { gpt: 'fa-circle-nodes', claude: 'fa-wand-magic-sparkles' };
        el.innerHTML = `
      <div class="chat-avatar chat-avatar--${provider}"><i class="fa-solid ${iconMap[provider] || iconMap.gpt}"></i></div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
        container?.appendChild(el);
        this.scrollToBottom();
        return el;
    },

    _showError(msg) {
        const container = document.getElementById('chat-messages');
        const el = document.createElement('div');
        el.className = 'chat-message chat-message--assistant';
        el.innerHTML = `
      <div class="chat-avatar" style="background:rgba(239,68,68,0.15);color:var(--accent-red);"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="chat-bubble" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);">
        <p style="color:var(--accent-red)">${Utils.sanitize(msg)}</p>
        <p style="font-size:0.8rem;color:var(--text-tertiary);margin-top:8px">Go to <button onclick="Nav.go('settings')" class="btn-sm" style="display:inline">Settings &amp; API</button> to add your keys.</p>
      </div>`;
        container?.appendChild(el);
        this.scrollToBottom();
    },

    setSendState(sending) {
        State.chatStreaming = sending;
        const btn = document.getElementById('chat-send-btn');
        if (!btn) return;
        if (sending) {
            btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            btn.classList.add('chat-send-btn--active');
            btn.title = 'Stop generation';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            btn.classList.remove('chat-send-btn--active');
            btn.title = 'Send message';
        }
    },

    stopGeneration() {
        this._abortController?.abort();
        this.setSendState(false);
        document.getElementById('typing-indicator')?.remove();
    },

    copyMessage(btn) {
        const bubble = btn.closest('div')?.previousElementSibling;
        const text = bubble?.textContent?.trim();
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
            }).catch(() => Toast.error('Copy failed'));
        }
    },

    updateCharCount() {
        const input = document.getElementById('chat-input');
        const counter = document.getElementById('chat-char-count');
        if (input && counter) {
            const len = input.value.length;
            counter.textContent = `${len.toLocaleString()} / 32,000`;
            counter.style.color = len > 28000 ? 'var(--accent-red)' : len > 20000 ? 'var(--accent-yellow)' : '';
        }
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn && !State.chatStreaming) {
            sendBtn.disabled = !input?.value?.trim();
        }
    },

    exportConversation() {
        if (!State.chatHistory.length) { Toast.warn('No conversation to export.'); return; }
        const lines = State.chatHistory.map(m =>
            `[${m.role.toUpperCase()}${m.provider ? ` / ${m.provider}` : ''}]\n${m.content}`
        ).join('\n\n---\n\n');
        const blob = new Blob([lines], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `alex-chat-${Date.now()}.txt`;
        a.click(); URL.revokeObjectURL(url);
        Toast.success('Conversation exported.');
    },

    initEventListeners() {
        document.querySelectorAll('.chat-model-tab').forEach(tab => {
            tab.addEventListener('click', () => this.setModel(tab.dataset.model));
        });

        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.newConversation());

        const sendBtn = document.getElementById('chat-send-btn');
        sendBtn?.addEventListener('click', () => {
            if (State.chatStreaming) this.stopGeneration();
            else this.send();
        });

        const input = document.getElementById('chat-input');
        input?.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 160) + 'px';
            this.updateCharCount();
        });
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!State.chatStreaming && input.value.trim()) this.send();
            }
        });

        document.querySelectorAll('.chat-suggestion').forEach(chip => {
            chip.addEventListener('click', () => {
                if (input) { input.value = chip.dataset.prompt; this.updateCharCount(); }
                this.send();
            });
        });

        document.getElementById('chat-attach-context-btn')?.addEventListener('click', () => {
            if (!State.books.length) { Toast.warn('Your library is empty.'); return; }
            const currentVal = input?.value || '';
            const ctx = `[Library context: ${State.books.length} books including: ${State.books.slice(0, 5).map(b => b.title).join(', ')}]\n\n`;
            if (input && !currentVal.includes('[Library context')) {
                input.value = ctx + currentVal;
                this.updateCharCount();
                Toast.info('Library context attached.');
            }
        });

        document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
            if (State.chatHistory.length && confirm('Clear current conversation?')) this.newConversation();
        });

        document.getElementById('export-chat-btn')?.addEventListener('click', () => this.exportConversation());

        document.getElementById('chat-sidebar-toggle')?.addEventListener('click', () => {
            document.getElementById('chat-sidebar')?.classList.toggle('collapsed');
        });
    },

    onPageEnter() {
        this.loadHistory();
        if (!State.chatCurrentId) this.newConversation();
        document.getElementById('chat-input')?.focus();
    },
};

/* ── PWA INSTALL MODULE ────────────────────────────────────── */
/* ── GLOBAL HELPER FUNCTIONS ───────────────────────────────── */
function toggleKeyVisibility(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
    const iconEl = el.closest('.engine-api-row, .api-key-wrap')?.querySelector('button i.fa-eye, button i.fa-eye-slash');
    if (iconEl) iconEl.className = el.type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
}

function testEngineKey(engineId) {
    Settings.testKey(engineId);
}

function setActiveEngine(engineId) {
    State.activeEngine = engineId;
    localStorage.setItem('alex_active_engine', engineId);
    SearchEngines.updateActiveIndicator();
    document.querySelectorAll('.engine-card').forEach(card => {
        card.classList.toggle('engine-card--active', card.dataset.engine === engineId);
    });
    const labels = { google_books: 'Google Books', open_library: 'Open Library', serper: 'Serper', serpapi: 'SerpAPI', tavily: 'Tavily AI', brave: 'Brave Search', exa: 'Exa AI' };
    Toast.success(`Active engine set to ${labels[engineId] || engineId}.`);
}

function copyKey(inputId) {
    const el = document.getElementById(inputId);
    const val = el?.value;
    if (!val || val.includes('•')) { Toast.warn('Key is hidden — reveal it first to copy.'); return; }
    navigator.clipboard.writeText(val).then(() => Toast.success('Key copied to clipboard.')).catch(() => Toast.error('Copy failed.'));
}

/* ── EXPOSE GLOBALS ────────────────────────────────────────── */
window.Books = Books;
window.Ideas = Ideas;
window.Insights = Insights;
window.Quotes = Quotes;
window.Decisions = Decisions;
window.Citations = Citations;
window.BookStorage = BookStorage;
window.Modal = Modal;
window.State = State;
window.Nav = Nav;
window.Render = Render;
window.AIChat = AIChat;
window.BookDownload = BookDownload;
window.SearchEngines = SearchEngines;
window.Settings = Settings;
window.toggleKeyVisibility = toggleKeyVisibility;
window.testEngineKey = testEngineKey;
window.setActiveEngine = setActiveEngine;
window.copyKey = copyKey;

/* ── SERVICE WORKER REGISTER ─────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.error('SW registration failed:', err));
  });
}
