// Kölcsönadlak (kolcsonadlak.hu) - Közösségi Eszközmegosztó Platform Logika

// Firebase Konfiguráció (kolcsonadlak-7212a projekt)
const firebaseConfig = {
    apiKey: "AIzaSyBS2jmQJxScHT8x_QPS_i8dVMqXCqI9bV0",
    authDomain: "kolcsonadlak-7212a.firebaseapp.com",
    projectId: "kolcsonadlak-7212a",
    storageBucket: "kolcsonadlak-7212a.firebasestorage.app",
    messagingSenderId: "627046212899",
    appId: "1:627046212899:web:764f654d4712f757985896",
    measurementId: "G-3QKTNS3R0Z"
};

let fbApp = null;
let fbAuth = null;
let fbDb = null;

function initClientFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            if (!firebase.apps.length) {
                fbApp = firebase.initializeApp(firebaseConfig);
            } else {
                fbApp = firebase.app();
            }
            fbAuth = firebase.auth();
            fbDb = firebase.firestore();
            console.log('🔥 [Firebase Client] Sikeresen inicializálva a kolcsonado projekthez!');
        } catch (e) {
            console.warn('[Firebase Client] Inicializálási megjegyzés:', e);
        }
    }
}

const DEFAULT_PLANS = [
    {
        id: "free",
        name: "Ingyenes",
        price: 0,
        max_items: 1,
        featured_items: 0,
        badge: "Ingyenes",
        features: ["1 termék feltöltés", "0 db kiemelt termék"]
    },
    {
        id: "starter_3",
        name: "Kezdő",
        price: 1490,
        max_items: 3,
        featured_items: 0,
        badge: "1 490 Ft",
        features: ["3 termék feltöltés", "0 db kiemelt termék"]
    },
    {
        id: "pro_10",
        name: "Haladó",
        price: 4490,
        max_items: 10,
        featured_items: 1,
        badge: "4 490 Ft",
        features: ["10 termék feltöltés", "1 db kiemelt termék"]
    },
    {
        id: "unlimited",
        name: "Korlátlan",
        price: 14990,
        max_items: 9999,
        featured_items: 3,
        badge: "14 990 Ft",
        features: ["Bármennyi termék feltöltés", "3 db kiemelt termék"]
    }
];

const state = {
    currentUser: null,
    items: [],
    plans: [...DEFAULT_PLANS],
    categories: ['Mind', 'Szolgáltatás', 'Műszaki eszköz', 'Ingatlan', 'Garázs', 'Kertészet', 'Barkácsolás', 'Takarítás', 'Építkezés', 'Jármű & Autó', 'Rendezvény & Hobbi', 'Egyéb'],
    selectedCategory: 'Mind',
    selectedUnit: 'Mind',
    searchQuery: '',
    maxPrice: '',
    locationFilter: '',
    activeTab: 'browse', // 'browse', 'dashboard', 'admin', 'messages'
    dashboardSubTab: 'incoming', // 'incoming', 'outgoing'
    selectedItem: null,
    selectedImageFile: null,
    croppedImageDataUrl: null,
    croppedImageBlob: null,
    originalImageSource: null,
    cropperTarget: 'new', // 'new' | 'edit'
    cropperInstance: null,
    editSelectedImageFile: null,
    editCroppedImageDataUrl: null,
    editCroppedImageBlob: null,
    editOriginalImageSource: null,
    messagesFolder: 'inbox', // 'inbox', 'archived'
    conversations: [],
    activeConversationId: null,
    activeConversation: null,
    activeMessages: [],
    unreadMessagesCount: 0,
    pendingRentalsCount: 0,
    draftPartner: null,
    newLocations: [],
    editLocations: [],
    calendarDate: null,
    calculator: {
        units: 1,
        startDate: '',
        endDate: '',
        note: ''
    },
    adminSubTab: 'items', // 'items', 'stats', 'users'
    adminOverviewData: null,
    adminAllItems: [],
    adminAllUsers: [],
    adminItemSearch: '',
    adminItemCategory: 'Mind',
    adminItemStatus: 'Mind',
    adminUserSearch: ''
};

// --- INICIALIZÁLÁS ---
document.addEventListener('DOMContentLoaded', async () => {
    try { initClientFirebase(); } catch (e) { console.warn('Firebase init:', e); }
    try { setInitialDates(); } catch (e) {}
    try { setupEventListeners(); } catch (e) { console.error('Setup listeners:', e); }
    try { await loadPlans(); } catch (e) {}
    try { await loadCities(); } catch (e) {}
    try { await initAuth(); } catch (e) {}
    try { await checkEmailVerification(); } catch (e) {}
    try { await loadItems(); } catch (e) { console.error('Load items error:', e); }

    // Rendszeres értesítés és olvasatlan üzenet / új bérlés számláló frissítés (10 másodpercenként)
    setInterval(() => {
        if (state.currentUser) {
            try { fetchNotifications(); } catch (e) {}
            if (state.activeTab === 'messages' && state.activeConversationId) {
                try { refreshActiveChatSilently(); } catch (e) {}
            }
        }
    }, 10000);
});


let hungarianCities = [];

function normalizeHungarian(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

const POPULAR_CITIES = [
    'Budapest (Összes kerület)',
    'Budapest, XI. kerület (Újbuda)',
    'Budapest, XIII. kerület (Angyalföld)',
    'Budapest, XIV. kerület (Zugló)',
    'Budapest, III. kerület (Óbuda)',
    'Debrecen',
    'Szeged',
    'Miskolc',
    'Pécs',
    'Győr',
    'Nyíregyháza',
    'Kecskemét',
    'Székesfehérvár',
    'Szombathely',
    'Szolnok',
    'Szentendre',
    'Érd',
    'Gödöllő',
    'Veszprém',
    'Tatabánya'
];

async function loadCities() {
    try {
        let res = await fetch('/api/cities');
        if (!res.ok) {
            res = await fetch('/static/cities.json');
        }
        hungarianCities = await res.json();
        
        // Datalist feltöltés fallbackként
        const datalist = document.getElementById('hungarian-cities');
        if (datalist && hungarianCities.length > 0) {
            datalist.innerHTML = hungarianCities.map(city => `<option value="${city}">`).join('');
        }

        // Egyedi, reszponzív autocomplete inicializálása minden helyiség mezőre
        initAllCityAutocompletes();
    } catch (err) {
        console.error('Települések betöltési hiba:', err);
        try {
            const fallbackRes = await fetch('/static/cities.json');
            hungarianCities = await fallbackRes.json();
            initAllCityAutocompletes();
        } catch (e) {
            console.error('Végső fallback betöltési hiba:', e);
        }
    }
}

function setupCityAutocomplete(inputElement, onSelectCallback) {
    if (!inputElement || inputElement.dataset.autocompleteBound) return;
    inputElement.dataset.autocompleteBound = "true";

    // Böngésző alapértelmezett buborékjának felülbírálása az egyedi szép listához
    inputElement.removeAttribute('list');
    inputElement.setAttribute('autocomplete', 'off');

    // Csomagoljuk be a beviteli mezőt egy relatív konténerbe
    let wrapper = inputElement.parentElement;
    if (!wrapper.classList.contains('city-autocomplete-wrapper')) {
        const newWrapper = document.createElement('div');
        newWrapper.className = 'city-autocomplete-wrapper';
        inputElement.parentNode.insertBefore(newWrapper, inputElement);
        newWrapper.appendChild(inputElement);
        wrapper = newWrapper;
    }

    // Létrehozzuk a lenyíló lebegő listát
    const dropdown = document.createElement('div');
    dropdown.className = 'city-autocomplete-dropdown hidden';
    wrapper.appendChild(dropdown);

    let activeIndex = -1;
    let currentItems = [];

    function renderSuggestions(items, isPopular = false) {
        currentItems = items;
        activeIndex = -1;

        if (items.length === 0) {
            dropdown.innerHTML = `
                <div class="px-4 py-3 text-xs text-slate-400 text-center italic">
                    <i class="fa-solid fa-magnifying-glass mr-1 text-slate-300"></i> Nincs ilyen település a listában
                </div>
            `;
            dropdown.classList.remove('hidden');
            return;
        }

        const headerHtml = `
            <div class="city-autocomplete-header flex items-center justify-between">
                <span><i class="fa-solid ${isPopular ? 'fa-star text-amber-500' : 'fa-location-dot text-emerald-600'} mr-1"></i> ${isPopular ? 'Gyakori települések' : `Találatok (${items.length} db)`}</span>
                <span class="text-[10px] text-slate-400 font-normal">3 178 település</span>
            </div>
        `;

        const queryNorm = normalizeHungarian(inputElement.value);

        const listHtml = items.map((city, idx) => {
            let label = city;
            if (queryNorm && !isPopular) {
                const normCity = normalizeHungarian(city);
                const pos = normCity.indexOf(queryNorm);
                if (pos !== -1) {
                    const matchedChunk = city.substring(pos, pos + inputElement.value.trim().length);
                    label = city.substring(0, pos) + `<strong class="text-emerald-700 font-extrabold bg-emerald-100/80 px-0.5 rounded">${matchedChunk}</strong>` + city.substring(pos + inputElement.value.trim().length);
                }
            }

            return `
                <div class="city-autocomplete-item" data-index="${idx}" data-value="${city}">
                    <i class="fa-solid fa-location-dot text-emerald-600 text-xs shrink-0"></i>
                    <span class="truncate flex-1">${label}</span>
                </div>
            `;
        }).join('');

        dropdown.innerHTML = headerHtml + listHtml;
        dropdown.classList.remove('hidden');

        dropdown.querySelectorAll('.city-autocomplete-item').forEach(itemEl => {
            itemEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const val = itemEl.getAttribute('data-value');
                selectValue(val);
            });
        });
    }

    function selectValue(val) {
        inputElement.value = val;
        dropdown.classList.add('hidden');
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof onSelectCallback === 'function') {
            onSelectCallback(val);
        }
    }

    function searchAndShow() {
        const val = inputElement.value.trim();
        if (!val) {
            renderSuggestions(POPULAR_CITIES, true);
            return;
        }

        const valNorm = normalizeHungarian(val);
        const startsWith = [];
        const contains = [];

        for (const city of hungarianCities) {
            const cityNorm = normalizeHungarian(city);
            if (cityNorm.startsWith(valNorm)) {
                startsWith.push(city);
            } else if (cityNorm.includes(valNorm)) {
                contains.push(city);
            }
            if (startsWith.length + contains.length >= 40) break;
        }

        const results = [...startsWith, ...contains].slice(0, 30);
        renderSuggestions(results, false);
    }

    inputElement.addEventListener('focus', searchAndShow);
    inputElement.addEventListener('click', searchAndShow);
    inputElement.addEventListener('input', searchAndShow);

    inputElement.addEventListener('keydown', (e) => {
        if (dropdown.classList.contains('hidden') || currentItems.length === 0) {
            if (e.key === 'ArrowDown') {
                searchAndShow();
            }
            return;
        }

        const itemEls = dropdown.querySelectorAll('.city-autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % itemEls.length;
            updateActiveItem(itemEls);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + itemEls.length) % itemEls.length;
            updateActiveItem(itemEls);
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && activeIndex < currentItems.length) {
                e.preventDefault();
                selectValue(currentItems[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });

    function updateActiveItem(itemEls) {
        itemEls.forEach((el, i) => {
            if (i === activeIndex) {
                el.classList.add('active');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function renderLocationTags(target) {
    const container = document.getElementById(`${target}-item-location-tags`);
    const hiddenInput = document.getElementById(`${target}-item-location`);
    const list = target === 'edit' ? (state.editLocations || []) : (state.newLocations || []);
    if (!container || !hiddenInput) return;

    if (list.length === 0) {
        container.innerHTML = '';
        hiddenInput.value = '';
        return;
    }

    container.innerHTML = list.map((loc, idx) => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl shadow-2xs animate-fade-in">
            <i class="fa-solid fa-location-dot text-emerald-600 text-[10px]"></i>
            <span>${loc}</span>
            <button type="button" onclick="removeLocationTag('${target}', ${idx})" class="w-4 h-4 rounded-full bg-emerald-200 hover:bg-emerald-300 text-emerald-900 flex items-center justify-center text-[10px] ml-1 transition-colors">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </span>
    `).join('');

    hiddenInput.value = list.join(', ');
}

function addLocationTag(target, loc) {
    const input = document.getElementById(`${target}-item-location-input`);
    const rawVal = (loc !== undefined && loc !== null ? loc : (input ? input.value : '')).trim();
    if (!rawVal) return;

    const parts = rawVal.split(/[,;]+/).map(p => p.trim()).filter(p => p.length > 0);
    if (target === 'edit') {
        if (!state.editLocations) state.editLocations = [];
        for (const p of parts) {
            if (!state.editLocations.includes(p)) state.editLocations.push(p);
        }
    } else {
        if (!state.newLocations) state.newLocations = [];
        for (const p of parts) {
            if (!state.newLocations.includes(p)) state.newLocations.push(p);
        }
    }

    if (input) input.value = '';
    renderLocationTags(target);
}

function removeLocationTag(target, idx) {
    const list = target === 'edit' ? state.editLocations : state.newLocations;
    if (list && idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
        renderLocationTags(target);
    }
}

function setupLocationTagInput(target) {
    const input = document.getElementById(`${target}-item-location-input`);
    if (!input) return;

    setupCityAutocomplete(input, (val) => {
        addLocationTag(target, val);
    });

    if (!input.dataset.tagKeyBound) {
        input.dataset.tagKeyBound = "true";
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addLocationTag(target);
            }
        });
    }
}

function initAllCityAutocompletes() {
    const ids = ['location-input', 'reg-city'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) setupCityAutocomplete(el);
    });

    setupLocationTagInput('new');
    setupLocationTagInput('edit');

    document.querySelectorAll('[data-city-autocomplete="true"]').forEach(el => {
        setupCityAutocomplete(el);
    });
}

function setInitialDates() {
    const today = new Date().toISOString().split('T')[0];
    state.calculator.startDate = today;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    state.calculator.endDate = tomorrow.toISOString().split('T')[0];
}

// --- HITELTESÍTÉS ÉS FELHASZNÁLÓKEZELÉS (AUTH) ---

async function checkEmailVerification() {
    try {
        const params = new URLSearchParams(window.location.search);
        const verifyUser = params.get('verify_user') || params.get('verify_email');
        const token = params.get('token');
        if (verifyUser) {
            console.log('🔍 [Auth Verify] E-mail megerősítés folyamatban...', verifyUser);
            const res = await fetch(`/api/auth/verify?user_id=${encodeURIComponent(verifyUser)}&token=${encodeURIComponent(token || '')}`);
            const data = await res.json();
            if (res.ok && data.success) {
                if (state.currentUser && String(state.currentUser.id) === String(verifyUser)) {
                    state.currentUser.email_verified = true;
                    renderAuthUI();
                } else if (!state.currentUser && data.user) {
                    state.currentUser = data.user;
                    localStorage.setItem('kolcsonado_user_id', data.user.id);
                    renderAuthUI();
                }
                showToast('🎉 E-mail címed sikeresen megerősítve! Jó böngészést és kölcsönzést kívánunk!', 'success', 8000);
            }
            // URL megtisztítása újratöltés nélkül
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    } catch (err) {
        console.warn('[Auth Verify] Hiba az e-mail megerősítés során:', err);
    }
}

function generateLetterAvatar(name) {
    if (typeof window !== 'undefined' && typeof window.generateLetterAvatar === 'function' && window.generateLetterAvatar !== generateLetterAvatar) {
        return window.generateLetterAvatar(name);
    }
    const cleanName = (name || '').trim();
    const initial = cleanName ? cleanName.charAt(0).toUpperCase() : 'K';
    const palette = [
        ['#059669', '#047857'],
        ['#2563eb', '#1d4ed8'],
        ['#7c3aed', '#6d28d9'],
        ['#d97706', '#b45309'],
        ['#db2777', '#be185d'],
        ['#0d9488', '#0f766e'],
        ['#e11d48', '#be123c'],
        ['#4f46e5', '#3730a3']
    ];
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % palette.length;
    const [c1, c2] = palette[colorIndex];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs><linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}" /><stop offset="100%" stop-color="${c2}" /></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#avatarGrad)" /><text x="50%" y="54%" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="64" font-weight="800" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getUserAvatar(userOrName, avatarUrl) {
    const name = typeof userOrName === 'string' ? userOrName : (userOrName ? userOrName.name : '');
    const url = avatarUrl || (typeof userOrName === 'object' && userOrName ? userOrName.avatar : '');
    if (url && typeof url === 'string' && url.trim() && !url.includes('unsplash.com/photo-1535713875002-d1d0cf377fde') && !url.includes('dicebear.com/7.x/bottts')) {
        return url;
    }
    return generateLetterAvatar(name);
}

async function initAuth() {
    let storedUserId = localStorage.getItem('kolcsonado_user_id');
    if (!storedUserId) {
        state.currentUser = null;
        renderAuthUI();
        return;
    }
    try {
        const res = await fetch(`/api/auth/me?user_id=${storedUserId}`);
        if (res.ok) {
            state.currentUser = await res.json();
        } else {
            state.currentUser = null;
            localStorage.removeItem('kolcsonado_user_id');
        }
    } catch (err) {
        console.error('Auth helyreállítási hiba:', err);
        state.currentUser = null;
    }
    renderAuthUI();
}

function toggleUserDropdown(forceState) {
    const menu = document.getElementById('user-dropdown-menu');
    const chevron = document.getElementById('user-menu-chevron');
    if (!menu) return;

    const isHidden = menu.classList.contains('hidden');
    const shouldOpen = forceState !== undefined ? forceState : isHidden;

    if (shouldOpen) {
        menu.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

// Kattintás kívülre -> lenyíló menü bezárása
document.addEventListener('click', (e) => {
    const menu = document.getElementById('user-dropdown-menu');
    const trigger = document.getElementById('user-menu-trigger');
    if (menu && !menu.classList.contains('hidden')) {
        if (!menu.contains(e.target) && !trigger.contains(e.target)) {
            toggleUserDropdown(false);
        }
    }
});

function renderAuthUI() {
    const loggedInBox = document.getElementById('auth-logged-in');
    const loggedOutBox = document.getElementById('auth-logged-out');
    const nameEl = document.getElementById('user-name-display');
    const avatarEl = document.getElementById('user-avatar-display');
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownEmail = document.getElementById('dropdown-user-email');
    const dropdownAdminBtn = document.getElementById('dropdown-admin-btn');
    const adminBtn = document.getElementById('btn-nav-admin');

    if (state.currentUser) {
        if (loggedInBox) loggedInBox.classList.remove('hidden');
        if (loggedOutBox) loggedOutBox.classList.add('hidden');

        let providerBadge = '';
        if (state.currentUser.auth_provider === 'google') {
            providerBadge = `<span title="Google-fiókkal bejelentkezve" class="inline-flex items-center text-[10px] ml-1 text-slate-400"><i class="fa-brands fa-google text-red-500"></i></span>`;
        } else if (state.currentUser.auth_provider === 'facebook') {
            providerBadge = `<span title="Facebookkal bejelentkezve" class="inline-flex items-center text-[10px] ml-1 text-slate-400"><i class="fa-brands fa-facebook text-blue-600"></i></span>`;
        }

        const avatarSrc = getUserAvatar(state.currentUser);

        if (nameEl) nameEl.innerHTML = `${state.currentUser.name} ${providerBadge}`;
        if (avatarEl) avatarEl.src = avatarSrc;

        if (dropdownAvatar) dropdownAvatar.src = avatarSrc;
        if (dropdownName) dropdownName.innerHTML = `${state.currentUser.name} ${providerBadge}`;
        if (dropdownEmail) dropdownEmail.textContent = state.currentUser.email || 'Bejelentkezve';
        
        const dropdownIdBadge = document.getElementById('dropdown-user-id-badge');
        if (dropdownIdBadge) {
            dropdownIdBadge.textContent = `Azonosító: #${state.currentUser.id}`;
        }

        const dropdownLevelText = document.getElementById('dropdown-user-level-text');
        const dropdownAchBadge = document.getElementById('dropdown-achievements-badge');
        const userLevel = state.currentUser.level || 1;
        if (dropdownLevelText) dropdownLevelText.textContent = `${userLevel}. Szint`;
        if (dropdownAchBadge) dropdownAchBadge.textContent = `${userLevel}. Szint`;

        // Titkos Admin gomb megjelenítése csak Kornélnak / Adminnak a lenyíló menüben
        const isAdmin = state.currentUser.role === 'admin' || state.currentUser.is_admin || state.currentUser.email === 'kulovanyi.kornel@gmail.com';
        if (adminBtn) {
            if (isAdmin) {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
        if (dropdownAdminBtn) {
            if (isAdmin) {
                dropdownAdminBtn.classList.remove('hidden');
            } else {
                dropdownAdminBtn.classList.add('hidden');
            }
        }

        // Értesítések (olvasatlan üzenetek és függőben lévő bérlések) lekérdezése
        fetchNotifications();
    } else {
        if (loggedInBox) loggedInBox.classList.add('hidden');
        if (loggedOutBox) loggedOutBox.classList.remove('hidden');
        const dot = document.getElementById('user-menu-notification-dot');
        if (dot) dot.classList.add('hidden');
        const badge = document.getElementById('unread-messages-badge');
        if (badge) badge.classList.add('hidden');
        const dropdownBadge = document.getElementById('dropdown-unread-badge');
        if (dropdownBadge) dropdownBadge.classList.add('hidden');
        const dropdownRentalsBadge = document.getElementById('dropdown-rentals-badge');
        if (dropdownRentalsBadge) dropdownRentalsBadge.classList.add('hidden');
        toggleUserDropdown(false);
    }
}


function openAuthModal(tab = 'login') {
    switchAuthTab(tab);
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.className = 'flex-1 py-2 text-sm font-extrabold text-emerald-600 border-b-2 border-emerald-600 transition-colors';
        tabRegister.className = 'flex-1 py-2 text-sm font-extrabold text-slate-400 hover:text-slate-700 transition-colors';
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.className = 'flex-1 py-2 text-sm font-extrabold text-emerald-600 border-b-2 border-emerald-600 transition-colors';
        tabLogin.className = 'flex-1 py-2 text-sm font-extrabold text-slate-400 hover:text-slate-700 transition-colors';
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a bejelentkezéskor');
        }

        const data = await res.json();
        state.currentUser = data.user;
        localStorage.setItem('kolcsonado_user_id', data.user.id);
        
        closeAuthModal();
        renderAuthUI();
        showToast(`Üdv újra, ${data.user.name}!`, 'success');

        if (state.activeTab === 'dashboard') {
            loadDashboardData();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const city = document.getElementById('reg-city').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, phone, city })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a regisztrációkor');
        }

        const data = await res.json();
        state.currentUser = data.user;
        localStorage.setItem('kolcsonado_user_id', data.user.id);

        closeAuthModal();
        renderAuthUI();
        showToast(`🎉 Sikeres regisztráció! Kiküldtünk egy megerősítő e-mailt a fiókodhoz. Kérjük, kattints a benne lévő aktiváló gombra!`, 'success', 9000);
    } catch (err) {
        showToast(err.message, 'error');
    }
}




async function logoutUser() {
    // 1. Firebase Auth kijelentkezés (Google/Facebook/Firebase munkamenet törlése)
    if (typeof firebase !== 'undefined' && fbAuth) {
        try {
            await fbAuth.signOut();
            console.log('🔥 [Firebase Auth] Sikeres kijelentkezés');
        } catch (e) {
            console.warn('[Firebase Auth] Kijelentkezési figyelmeztetés:', e);
        }
    }

    // 2. Böngésző helyi tárolók (LocalStorage & SessionStorage) teljes ürítése
    try {
        localStorage.removeItem('kolcsonado_user_id');
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn('Storage törlési hiba:', e);
    }

    // 3. Kliensoldali belső állapot (State) teljes alaphelyzetbe állítása
    state.currentUser = null;
    state.conversations = [];
    state.activeConversationId = null;
    state.activeConversation = null;
    state.activeMessages = [];
    state.unreadMessagesCount = 0;
    state.pendingRentalsCount = 0;
    state.draftPartner = null;
    state.draftItem = null;
    state.selectedImageFile = null;

    // 4. Érzékeny belső DOM területek azonnali kiürítése (Dashboard, Admin, Chat történet)
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) dashboardContent.innerHTML = '';

    const adminContent = document.getElementById('admin-content');
    if (adminContent) adminContent.innerHTML = '';

    const convList = document.getElementById('conversations-list-container');
    if (convList) convList.innerHTML = '';

    const chatPane = document.getElementById('chat-pane-container');
    if (chatPane) chatPane.innerHTML = '';

    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn) adminBtn.classList.add('hidden');

    const dot = document.getElementById('user-menu-notification-dot');
    if (dot) dot.classList.add('hidden');

    const dropdownRentalsBadge = document.getElementById('dropdown-rentals-badge');
    if (dropdownRentalsBadge) dropdownRentalsBadge.classList.add('hidden');

    const dropdownBadge = document.getElementById('dropdown-unread-badge');
    if (dropdownBadge) dropdownBadge.classList.add('hidden');

    const badge = document.getElementById('unread-messages-badge');
    if (badge) {
        badge.textContent = '0';
        badge.classList.add('hidden');
    }

    // 5. Form mezők kitakarítása
    const loginEmail = document.getElementById('login-email');
    const loginPass = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPass) loginPass.value = '';

    // 6. UI frissítése és visszairányítás a főoldalra
    renderAuthUI();
    switchTab('browse');

    showToast('🔒 Sikeresen kijelentkeztél! Minden privát adat és munkamenet törölve.', 'info');
}


// --- KÖZÖSSÉGI BELÉPÉSEK (GOOGLE & FACEBOOK + FIREBASE POPUP) ---

async function loginWithFirebase(provider) {
    if (typeof firebase === 'undefined' || !fbAuth) {
        initClientFirebase();
    }
    if (!fbAuth) {
        showToast('Firebase Auth inicializálása sikertelen. Kérlek ellenőrizd az internetkapcsolatot!', 'error');
        return;
    }

    try {
        let authProvider;
        if (provider === 'google') {
            authProvider = new firebase.auth.GoogleAuthProvider();
            authProvider.addScope('profile');
            authProvider.addScope('email');
        } else {
            authProvider = new firebase.auth.FacebookAuthProvider();
            authProvider.addScope('email');
        }

        const result = await fbAuth.signInWithPopup(authProvider);
        const user = result.user;
        await executeSocialLogin(
            provider,
            user.displayName || (provider === 'google' ? 'Google Felhasználó' : 'Facebook Felhasználó'),
            user.email || `${user.uid}@${provider}.com`,
            user.photoURL || '',
            ''
        );
        closeAuthModal();
        closeSocialAuthModal();
    } catch (err) {
        console.warn('Firebase popup login hiba/elutasítás:', err);
        if (err.code === 'auth/popup-closed-by-user') {
            showToast('Bejelentkezés megszakítva.', 'info');
        } else if (err.code === 'auth/configuration-not-found') {
            showToast('A Google belépés még nincs bekapcsolva a Firebase konzolban (Authentication > Sign-in method > Google Enable).', 'error');
        } else if (err.code === 'auth/unauthorized-domain') {
            showToast('Ez a domain még nincs engedélyezve a Firebase konzolban (Settings > Authorized domains).', 'error');
        } else {
            showToast(`Google belépés: ${err.message || 'Hiba történt'}`, 'error');
        }
    }
}

function startSocialLogin(provider) {
    loginWithFirebase(provider);
}

function closeSocialAuthModal() {
    const modal = document.getElementById('social-auth-modal');
    if (modal) modal.style.display = 'none';
}

function toggleCustomSocialForm() {
    const form = document.getElementById('custom-social-form');
    if (form) {
        form.classList.toggle('hidden');
    }
}

async function handleCustomSocialSubmit(e) {
    e.preventDefault();
    const provider = state.currentSocialProvider || 'google';
    const name = document.getElementById('social-custom-name').value;
    const email = document.getElementById('social-custom-email').value;
    const city = document.getElementById('social-custom-city').value;
    const phone = document.getElementById('social-custom-phone').value;

    await executeSocialLogin(provider, name, email, null, city, phone);
}

async function executeSocialLogin(provider, name, email, avatar = null, city = '', phone = '') {
    try {
        const res = await fetch('/api/auth/social-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                name,
                email,
                avatar,
                city,
                phone
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a közösségi bejelentkezés során');
        }

        const data = await res.json();
        state.currentUser = data.user;
        localStorage.setItem('kolcsonado_user_id', data.user.id);

        closeSocialAuthModal();
        closeAuthModal();
        renderAuthUI();
        showToast(data.message, 'success');

        if (state.activeTab === 'dashboard') {
            loadDashboardData();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- KÉPFELTÖLTÉS ÉS KÉPBEÁLLÍTÓ / TÖBB KÉP KEZELÉSE ---

state.newItemImages = [];
state.editItemImages = [];
state.currentModalImageIndex = 0;

function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result || 'static/logo.png');
            reader.onerror = () => resolve('static/logo.png');
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                } else {
                    resolve(e.target.result);
                }
            };
            img.onerror = () => resolve(e.target.result || 'static/logo.png');
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('static/logo.png');
        reader.readAsDataURL(file);
    });
}

async function handleMultipleImagesSelect(e, target = 'new') {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!state.newItemImages) state.newItemImages = [];
    if (!state.editItemImages) state.editItemImages = [];

    const targetArr = (target === 'edit') ? state.editItemImages : state.newItemImages;
    showToast(`📷 ${files.length} db fotó feldolgozása és optimalizálása...`, 'info');

    let successCount = 0;
    for (const file of files) {
        try {
            const compressedUrl = await compressImageFile(file, 1000, 1000, 0.82);
            if (compressedUrl) {
                targetArr.push(compressedUrl);
                successCount++;
            }
        } catch (err) {
            console.warn('Hiba a kép optimalizálásakor:', err);
        }
    }

    renderImagesPreviewGrid(target);
    if (successCount > 0) {
        showToast(`📷 ${successCount} db fotó sikeresen optimalizálva és hozzáadva!`, 'success');
    }
    e.target.value = '';
}

function renderImagesPreviewGrid(target = 'new') {
    const isEdit = target === 'edit';
    const images = isEdit ? (state.editItemImages || []) : (state.newItemImages || []);
    const gridEl = document.getElementById(isEdit ? 'edit-item-images-grid' : 'new-item-images-grid');
    const containerEl = document.getElementById(isEdit ? 'edit-image-preview-container' : 'image-preview-container');
    const counterEl = document.getElementById(isEdit ? 'edit-item-images-counter' : 'new-item-images-counter');
    const dropzoneEl = document.getElementById(isEdit ? 'edit-upload-dropzone' : 'upload-dropzone');
    const hiddenUrlEl = document.getElementById(isEdit ? 'edit-item-image-url' : 'new-item-image-url');

    if (!gridEl || !containerEl) return;

    if (images.length === 0) {
        containerEl.classList.add('hidden');
        if (counterEl) {
            counterEl.classList.add('hidden');
            counterEl.innerText = '0 kép';
        }
        if (dropzoneEl) dropzoneEl.classList.remove('hidden');
        if (hiddenUrlEl) hiddenUrlEl.value = '';
        return;
    }

    containerEl.classList.remove('hidden');
    if (counterEl) {
        counterEl.innerText = `${images.length} db fotó`;
        counterEl.classList.remove('hidden');
    }
    if (hiddenUrlEl) {
        hiddenUrlEl.value = images[0] || '';
    }

    gridEl.innerHTML = images.map((imgSrc, idx) => `
        <div class="relative group aspect-square rounded-2xl overflow-hidden border-2 ${idx === 0 ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-400/30' : 'border-slate-200'} bg-slate-100">
            <img src="${imgSrc}" class="w-full h-full object-cover">
            ${idx === 0 ? `
                <span class="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                    Borítókép
                </span>
            ` : ''}
            <button type="button" onclick="removeImageAtIndex(${idx}, '${target}')" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-[10px] shadow transition-transform hover:scale-110 active:scale-95" title="Fotó törlése">
                <i class="fa-solid fa-xmark"></i>
            </button>
            ${idx > 0 ? `
                <button type="button" onclick="makeImageCover(${idx}, '${target}')" class="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[9px] font-bold py-1 rounded-lg text-center backdrop-blur shadow opacity-0 group-hover:opacity-100 transition-opacity">
                    Legyen borító
                </button>
            ` : ''}
        </div>
    `).join('');
}

function removeImageAtIndex(idx, target = 'new') {
    const images = target === 'edit' ? state.editItemImages : state.newItemImages;
    if (idx >= 0 && idx < images.length) {
        images.splice(idx, 1);
        renderImagesPreviewGrid(target);
    }
}

function makeImageCover(idx, target = 'new') {
    const images = target === 'edit' ? state.editItemImages : state.newItemImages;
    if (idx > 0 && idx < images.length) {
        const [selected] = images.splice(idx, 1);
        images.unshift(selected);
        renderImagesPreviewGrid(target);
        showToast('Borítókép frissítve!', 'info');
    }
}

function removeAllSelectedImages(target = 'new') {
    if (target === 'edit') {
        state.editItemImages = [];
    } else {
        state.newItemImages = [];
    }
    renderImagesPreviewGrid(target);
}

function handleImageFileSelect(e, target = 'new') {
    handleMultipleImagesSelect(e, target);
}

function openCropperModal(imageSrc, target = 'new') {
    state.cropperTarget = target;
    const modal = document.getElementById('image-cropper-modal');
    const imageEl = document.getElementById('cropper-image');
    if (!modal || !imageEl) return;

    if (state.cropperInstance) {
        state.cropperInstance.destroy();
        state.cropperInstance = null;
    }

    imageEl.src = imageSrc;
    modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');

    const slider = document.getElementById('cropper-zoom-slider');
    if (slider) slider.value = 1;

    setTimeout(() => {
        if (typeof Cropper === 'undefined') {
            console.error('Cropper.js library nem töltődött be');
            return;
        }

        try {
            state.cropperInstance = new Cropper(imageEl, {
                aspectRatio: 1, // Fix 1:1 Négyzetes képarány
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.95,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                preview: '#cropper-card-preview-box',
                zoom(e) {
                    if (slider && e.detail && e.detail.ratio) {
                        slider.value = Math.min(3, Math.max(0.1, e.detail.ratio));
                    }
                }
            });
        } catch (cropErr) {
            console.error('Hiba a Cropper indításakor:', cropErr);
        }
    }, 120);
}

function closeCropperModal() {
    const modal = document.getElementById('image-cropper-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    if (state.cropperInstance) {
        state.cropperInstance.destroy();
        state.cropperInstance = null;
    }
}

function reopenCropper(target = 'new') {
    const src = target === 'edit' ? (state.editItemImages && state.editItemImages[0]) : (state.newItemImages && state.newItemImages[0]);
    if (src) {
        openCropperModal(src, target);
    } else {
        const fileInput = document.getElementById(target === 'edit' ? 'edit-item-file' : 'new-item-file');
        if (fileInput) fileInput.click();
    }
}

function applyCroppedImage() {
    if (!state.cropperInstance) {
        closeCropperModal();
        return;
    }

    const canvas = state.cropperInstance.getCroppedCanvas({
        maxWidth: 1000,
        maxHeight: 1000,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });

    if (!canvas) {
        showToast('Nem sikerült a kép kivágása!', 'error');
        return;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const isEdit = state.cropperTarget === 'edit';
    if (isEdit) {
        if (!state.editItemImages) state.editItemImages = [];
        if (state.editItemImages.length > 0) {
            state.editItemImages[0] = dataUrl;
        } else {
            state.editItemImages.push(dataUrl);
        }
        renderImagesPreviewGrid('edit');
    } else {
        if (!state.newItemImages) state.newItemImages = [];
        if (state.newItemImages.length > 0) {
            state.newItemImages[0] = dataUrl;
        } else {
            state.newItemImages.push(dataUrl);
        }
        renderImagesPreviewGrid('new');
    }
    
    closeCropperModal();
    showToast('✨ A fotó beállítása és vágása sikeresen alkalmazva!', 'success');
}

function removeSelectedImage(target = 'new') {
    removeAllSelectedImages(target);
}

function setCropperAspectRatio(ratio, btnEl) {
    if (!state.cropperInstance) return;
    state.cropperInstance.setAspectRatio(ratio);

    const aspectBtns = document.querySelectorAll('.cropper-aspect-btn');
    aspectBtns.forEach(btn => {
        btn.className = 'cropper-aspect-btn px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-all';
    });
    if (btnEl) {
        btnEl.className = 'cropper-aspect-btn px-2.5 py-1 rounded-lg font-bold bg-emerald-600 text-white shadow-sm transition-all';
    }
}

function cropperZoom(delta) {
    if (!state.cropperInstance) return;
    state.cropperInstance.zoom(delta);
}

function cropperZoomSlider(val) {
    if (!state.cropperInstance) return;
    state.cropperInstance.zoomTo(parseFloat(val));
}

function cropperRotate(deg) {
    if (!state.cropperInstance) return;
    state.cropperInstance.rotate(deg);
}

function cropperReset() {
    if (!state.cropperInstance) return;
    state.cropperInstance.reset();
    const slider = document.getElementById('cropper-zoom-slider');
    if (slider) slider.value = 1;
}

// --- API ÉS ESZKÖZÖK LEKÉRÉSE ---

async function loadPlans() {
    try {
        const res = await fetch('/api/plans');
        state.plans = await res.json();
    } catch (err) {
        console.error('Csomagok betöltési hiba:', err);
    }
}

async function refreshCurrentUser() {
    if (!state.currentUser) return;
    try {
        const res = await fetch(`/api/auth/me?user_id=${state.currentUser.id}`);
        if (res.ok) {
            state.currentUser = await res.json();
            renderAuthUI();
        }
    } catch (e) {
        console.error('Profil frissítés hiba:', e);
    }
}

async function loadItems() {
    try {
        const params = new URLSearchParams();
        if (state.selectedCategory && state.selectedCategory !== 'Mind') params.append('category', state.selectedCategory);
        if (state.selectedUnit && state.selectedUnit !== 'Mind') params.append('unit', state.selectedUnit);
        if (state.searchQuery) params.append('search', state.searchQuery);
        if (state.maxPrice) params.append('max_price', state.maxPrice);
        if (state.locationFilter) params.append('location', state.locationFilter);

        const res = await fetch('/api/items?' + params.toString());
        if (res.ok) {
            const data = await res.json();
            state.items = Array.isArray(data) ? data : (data.items || []);
        } else {
            state.items = [];
        }
        renderItems();
    } catch (err) {
        console.error('Eszközök betöltési hiba:', err);
        if (!Array.isArray(state.items)) state.items = [];
        renderItems();
    }
}

function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;

    container.innerHTML = state.categories.map(cat => {
        const active = state.selectedCategory === cat;
        return `
            <button onclick="setCategory('${cat}')" 
                class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    active 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }">
                ${getCategoryIcon(cat)} ${cat}
            </button>
        `;
    }).join('');
}

function getCategoryIcon(cat) {
    switch(cat) {
        case 'Szolgáltatás': return '💼';
        case 'Műszaki eszköz': return '💻';
        case 'Ingatlan': return '🏠';
        case 'Garázs': return '🅿️';
        case 'Kertészet': return '🌱';
        case 'Barkácsolás': return '🔨';
        case 'Takarítás': return '✨';
        case 'Építkezés': return '🏗️';
        case 'Jármű & Autó':
        case 'Autó & Garázs': return '🚗';
        case 'Rendezvény & Hobbi': return '🎉';
        case 'Egyéb': return '📦';
        default: return '📦';
    }
}

function renderItemCard(item) {
    const ownerName = item.owner_name || 'Bérbeadó';
    const ownerFirstName = ownerName.split(' ')[0] || ownerName;
    const ownerAvatar = getUserAvatar(ownerName, item.owner_avatar);
    const price = Number(item.price) || 0;
    const deposit = Number(item.deposit) || 0;
    const priceUnit = item.price_unit || 'nap';
    const location = item.location || 'Budapest';
    const category = item.category || 'Egyéb';
    const title = item.title || 'Eszköz';
    const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80';

    return `
    <div class="item-card bg-white rounded-2xl overflow-hidden ${
        item.is_featured 
        ? 'border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-md relative bg-gradient-to-b from-amber-50/20 to-white' 
        : 'border border-slate-200/80 shadow-sm'
    } flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md" onclick="openItemModal(${item.id})">
        <!-- 1:1 Négyzetes Kép és jelvények -->
        <div class="relative aspect-square w-full bg-slate-100 overflow-hidden">
            <img src="${imgUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" onerror="this.src='https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80'">
            
            <div class="absolute top-2 left-2 flex flex-wrap gap-1 z-10">
                <div class="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">
                    ${category}
                </div>
                <div class="bg-slate-900/80 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono shadow-sm">
                    #${item.id}
                </div>
            </div>

            ${item.is_featured ? `
                <div class="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-2 py-0.5 rounded-md text-[9px] shadow flex items-center gap-0.5 animate-pulse">
                    <i class="fa-solid fa-bolt text-yellow-200 text-[8px]"></i> KIEMELT
                </div>
            ` : ''}
        </div>

        <!-- Kompakt Tartalom -->
        <div class="p-3 flex-1 flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span class="flex items-center gap-1 font-medium text-slate-600 truncate">
                        <i class="fa-solid fa-location-dot text-emerald-600 text-[10px]"></i> ${location}
                    </span>
                </div>
                
                <h3 class="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 hover:text-emerald-600 transition-colors mb-2" title="${title}">
                    ${title}
                </h3>

                <!-- Ár és Kaució szekció a leírás mezőben -->
                <div class="my-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-1">
                    <div>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bérlés</span>
                        <div class="flex items-baseline gap-0.5">
                            <span class="text-xs sm:text-sm font-black text-emerald-700 leading-none">${price.toLocaleString('hu-HU')} Ft</span>
                            <span class="text-[10px] font-bold text-slate-500">/${priceUnit}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kaució</span>
                        ${deposit > 0 ? `
                            <span class="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded inline-block">
                                ${deposit.toLocaleString('hu-HU')} Ft
                            </span>
                        ` : `
                            <span class="text-[10px] font-semibold text-emerald-700">0 Ft</span>
                        `}
                    </div>
                </div>
            </div>

            <!-- Kompakt Bérbeadó sáv -->
            <div class="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onclick="event.stopPropagation(); openUserProfileModal(${item.user_id || item.owner_id})" title="Kattints ${ownerFirstName} nyilvános profiljának megtekintéséhez">
                    <img src="${ownerAvatar}" class="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200 shrink-0">
                    <span class="text-[11px] font-medium text-slate-700 truncate hover:text-emerald-700">${ownerFirstName}</span>
                </div>

                <button class="px-2 py-1 ${item.is_featured ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'} rounded-md text-[10px] font-bold transition-colors shrink-0">
                    Bérlés <i class="fa-solid fa-arrow-right text-[8px]"></i>
                </button>
            </div>
        </div>
    </div>
    `;
}

function renderItems() {
    const container = document.getElementById('items-grid');
    const countEl = document.getElementById('items-count');
    if (!container) return;

    if (!Array.isArray(state.items)) {
        state.items = [];
    }

    if (countEl) countEl.textContent = `${state.items.length} db elérhető eszköz`;

    if (state.items.length === 0) {
        const hasFilters = state.searchQuery || (state.selectedCategory && state.selectedCategory !== 'Mind') || (state.selectedUnit && state.selectedUnit !== 'Mind') || state.maxPrice || state.locationFilter;
        if (hasFilters) {
            container.innerHTML = `
                <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 p-8">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-400 mb-3">
                        <i class="fa-solid fa-toolbox text-xl"></i>
                    </div>
                    <h3 class="text-base font-bold text-slate-800 mb-1">Nincs találat a megadott feltételekre</h3>
                    <p class="text-slate-500 text-xs mb-4">Próbáld meg módosítani a keresési kulcsszót vagy a szűrőket!</p>
                    <button onclick="resetFilters()" class="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow hover:bg-emerald-700 transition-colors">
                        Szűrők törlése
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mb-4 shadow-inner">
                        <i class="fa-solid fa-hand-holding-hand text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-extrabold text-slate-900 mb-2">Még nincsenek feltöltött eszközök</h3>
                    <p class="text-slate-500 text-xs max-w-md mx-auto mb-6">
                        Az oldal készen áll. Légy te az első bérbeadó: add bérbe a nem használt gépeidet, szerszámaidat egyszerűen!
                    </p>
                    <button onclick="openNewItemModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Első hirdetés feladása
                    </button>
                </div>
            `;
        }
        return;
    }

    const featuredItems = state.items.filter(item => item.is_featured);
    const normalItems = state.items.filter(item => !item.is_featured);

    const gridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-4";

    let html = '';

    // 1. Kiemelt hirdetések szekció (különválasztva a többitől)
    if (featuredItems.length > 0) {
        html += `
            <div class="mb-8 p-4 sm:p-5 rounded-3xl bg-amber-50/50 border-2 border-amber-300 shadow-sm">
                <div class="flex items-center justify-between mb-4 pb-2.5 border-b border-amber-200/70">
                    <div class="flex items-center gap-2.5">
                        <span class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-sm shadow-amber-500/30">
                            <i class="fa-solid fa-bolt"></i>
                        </span>
                        <div>
                            <h3 class="text-sm sm:text-base font-black text-slate-900 tracking-tight">Kiemelt Ajánlatok</h3>
                            <p class="text-[11px] text-amber-800/80 font-medium">Kiemelt pozícióban lévő prémium gépek és szerszámok</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-amber-200/90 text-amber-950 font-black text-[11px] shadow-sm">
                        ⭐ ${featuredItems.length} db kiemelt
                    </span>
                </div>

                <div class="${gridClasses}">
                    ${featuredItems.map(item => renderItemCard(item)).join('')}
                </div>
            </div>
        `;
    }

    // 2. Normál / Minden egyéb hirdetés szekció
    if (normalItems.length > 0) {
        html += `
            <div class="space-y-4">
                ${featuredItems.length > 0 ? `
                    <div class="flex items-center justify-between pt-2 pb-1">
                        <h3 class="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-list-ul text-emerald-600"></i> További Hirdetések (${normalItems.length})
                        </h3>
                    </div>
                ` : ''}

                <div class="${gridClasses}">
                    ${normalItems.map(item => renderItemCard(item)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// --- ELŐFIZETÉSI CSOMAGOK ---

async function openSubscriptionModal() {
    if (!state.plans || state.plans.length === 0) {
        await loadPlans();
    }
    renderPlansUI();
    const modal = document.getElementById('subscription-modal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
}

function closeSubscriptionModal() {
    const modal = document.getElementById('subscription-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
}

function renderPlansUI() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    const currentPlanId = state.currentUser ? (state.currentUser.subscription_plan || 'free') : 'free';
    const ranks = { 'free': 0, 'starter_3': 1, 'pro_10': 2, 'unlimited': 3 };
    const currentRank = ranks[currentPlanId] || 0;
    const remainingDays = state.currentUser ? state.currentUser.remaining_days : null;
    const pendingDowngrade = state.currentUser ? state.currentUser.pending_downgrade_plan : null;
    const expiresAt = state.currentUser ? state.currentUser.subscription_expires_at : null;

    // Ha van függőben lévő csomagváltás értesítő banner
    const pendingBannerEl = document.getElementById('subscription-pending-banner');
    if (pendingBannerEl) {
        if (pendingDowngrade) {
            const targetPlanObj = state.plans.find(p => p.id === pendingDowngrade) || { name: pendingDowngrade };
            const expDateStr = expiresAt ? expiresAt.substring(0, 10) : 'a 30 napos időszak végén';
            pendingBannerEl.innerHTML = `
                <div class="mb-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start gap-3 shadow-sm">
                    <i class="fa-solid fa-clock-rotate-left text-amber-600 text-lg mt-0.5"></i>
                    <div class="text-xs leading-relaxed">
                        <span class="font-extrabold text-amber-950 block text-sm">⏳ Csomagváltás rögzítve: ${targetPlanObj.name}</span>
                        A jelenlegi magasabb szintű csomagod még <strong>${remainingDays ? remainingDays + ' napig' : ''} (${expDateStr}-ig)</strong> érvényben marad a 30 napos kifizetett időszak végéig. Ezt követően aktiválódik a választott csomag és az új havidíj.
                    </div>
                </div>
            `;
            pendingBannerEl.classList.remove('hidden');
        } else {
            pendingBannerEl.innerHTML = '';
            pendingBannerEl.classList.add('hidden');
        }
    }

    container.innerHTML = state.plans.map(plan => {
        const isCurrent = currentPlanId === plan.id;
        const targetRank = ranks[plan.id] || 0;
        const isDowngrade = targetRank < currentRank;
        const isUnlimited = plan.id === 'unlimited';

        let borderClass = isCurrent 
            ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/10 bg-emerald-50/10' 
            : plan.id === 'pro_10'
                ? 'border-2 border-blue-400 bg-white' 
                : isUnlimited
                    ? 'border-2 border-purple-400 bg-white'
                    : 'border border-slate-200 bg-white';

        const maxItemsStr = plan.max_items >= 9000 ? 'Bármennyi termék' : `${plan.max_items} termék feltöltés`;
        const featuredStr = plan.featured_items > 0 ? `${plan.featured_items} db termék kiemelt` : `0 db kiemelt termék`;

        return `
            <div class="rounded-3xl p-5 sm:p-6 flex flex-col justify-between ${borderClass} shadow-sm hover:shadow-md transition-all relative">
                ${isCurrent ? `
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md whitespace-nowrap flex items-center gap-1">
                        <i class="fa-solid fa-circle-check"></i> Aktuális Csomagod
                    </div>
                ` : ''}

                <!-- Hasáb blokk egységes, fix magasságú sorokkal -->
                <div class="space-y-4">
                    <!-- SOR 1: Csomagnév (Egyszavas) -->
                    <div class="h-10 flex items-center justify-center">
                        <h4 class="text-xl font-black text-slate-900 tracking-tight text-center">${plan.name}</h4>
                    </div>

                    <!-- SOR 2: Ár -->
                    <div class="h-16 flex flex-col items-center justify-center border-y border-slate-100 py-1">
                        <div class="flex items-baseline gap-1">
                            <span class="text-2xl sm:text-3xl font-black text-slate-900">
                                ${plan.price === 0 ? '0 Ft' : plan.price.toLocaleString('hu-HU') + ' Ft'}
                            </span>
                            <span class="text-xs text-slate-500 font-semibold">${plan.price === 0 ? '/ örökre' : '/ hó'}</span>
                        </div>
                    </div>

                    <!-- SOR 3: Termék feltöltési limit -->
                    <div class="h-14 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center px-3 text-center">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hirdetés feltöltés</span>
                        <span class="text-sm font-black ${plan.max_items >= 9000 ? 'text-purple-700' : 'text-slate-800'}">
                            ${maxItemsStr}
                        </span>
                    </div>

                    <!-- SOR 4: Kiemelt termék kvóta -->
                    <div class="h-14 rounded-2xl ${plan.featured_items > 0 ? 'bg-amber-50 border border-amber-200 text-amber-950 font-black' : 'bg-slate-50 border border-slate-100 text-slate-400 font-semibold'} flex flex-col items-center justify-center px-3 text-center">
                        <span class="text-[10px] uppercase font-bold ${plan.featured_items > 0 ? 'text-amber-600' : 'text-slate-400'} tracking-wider">Kiemelt termék</span>
                        <span class="text-sm font-black ${plan.featured_items > 0 ? 'text-amber-800' : 'text-slate-500'}">
                            ${featuredStr}
                        </span>
                    </div>
                </div>

                <!-- SOR 5: Műveleti gomb -->
                <div class="pt-6 mt-2">
                    ${isCurrent ? `
                        <div class="space-y-1.5">
                            <button disabled class="w-full h-11 bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs cursor-default flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-circle-check text-emerald-600"></i> Aktív Csomagod
                            </button>
                            ${remainingDays !== null && remainingDays !== undefined && plan.price > 0 ? `
                                <p class="text-[10px] text-center text-slate-500 font-medium">
                                    Még <strong class="text-emerald-700 font-bold">${remainingDays} napig</strong> aktív
                                </p>
                            ` : ''}
                        </div>
                    ` : pendingDowngrade === plan.id ? `
                        <button disabled class="w-full h-11 bg-amber-100 text-amber-900 font-bold rounded-xl text-xs cursor-default flex items-center justify-center gap-1">
                            <i class="fa-solid fa-clock text-amber-700"></i> Időzítve erre
                        </button>
                    ` : `
                        <button onclick="selectPlan('${plan.id}')" class="w-full h-11 ${
                            isDowngrade
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                : plan.price === 0
                                    ? 'bg-slate-800 hover:bg-slate-900 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                        } font-black rounded-xl text-xs transition-all active:scale-[0.98]">
                            ${plan.price === 0 
                                ? (isDowngrade ? 'Váltás Ingyenesre' : 'Választom') 
                                : isDowngrade 
                                    ? 'Váltás erre csomagra' 
                                    : 'Előfizetés erre'}
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

let currentStripeSession = null;

async function selectPlan(planId) {
    if (!state.currentUser) {
        showToast('Kérlek jelentkezz be a csomagváltáshoz!', 'info');
        openAuthModal('login');
        return;
    }

    const currentPlanId = state.currentUser.subscription_plan || 'free';
    const ranks = { 'free': 0, 'starter_3': 1, 'pro_10': 2, 'unlimited': 3 };
    const currentRank = ranks[currentPlanId] || 0;
    const targetRank = ranks[planId] || 0;
    const targetPlan = state.plans.find(p => p.id === planId) || { name: planId, price: 0 };

    // Visszalépés (Downgrade) kisebb csomagra
    if (targetRank < currentRank) {
        const remainingDays = state.currentUser.remaining_days;
        const confirmMsg = remainingDays && remainingDays > 0
            ? `Biztosan a(z) "${targetPlan.name}" csomagra szeretnél váltani?\n\nA jelenlegi magasabb szintű csomagod a kifizetett 30 napos időszakból hátralévő még ${remainingDays} napig változatlanul érvényes marad. A kisebb csomag csak a fordulónap után lép életbe.`
            : `Biztosan a(z) "${targetPlan.name}" csomagra szeretnél váltani?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            const res = await fetch(`/api/users/${state.currentUser.id}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: planId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Hiba a csomagváltáskor');
            }
            const data = await res.json();
            showToast(data.message, 'success');
            await refreshCurrentUser();
            renderPlansUI();
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    // Ingyenes csomagra váltás
    if (planId === 'free') {
        try {
            const res = await fetch(`/api/users/${state.currentUser.id}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: 'free' })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Hiba a csomagváltáskor');
            }
            const data = await res.json();
            showToast(data.message, 'success');
            await refreshCurrentUser();
            renderPlansUI();
        } catch (err) {
            showToast(err.message, 'error');
        }
        return;
    }

    // Fizetős csomagok esetén Stripe Checkout kezdeményezése (Havi előfizetés)
    try {
        const res = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.currentUser.id,
                plan_id: planId
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a Stripe fizetés előkészítésekor');
        }

        const sessionData = await res.json();
        currentStripeSession = sessionData;

        if (!sessionData.is_sandbox_simulation && sessionData.checkout_url && sessionData.checkout_url.startsWith('https://checkout.stripe.com')) {
            window.location.href = sessionData.checkout_url;
            return;
        }

        // Sandbox / Helyi fizetési ablak megnyitása
        openStripeCheckoutModal(sessionData);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- TERMÉK KIEMELÉS (BOOST) LOGIKA ---

let selectedBoostPlan = 'boost_1_day';
let currentBoostingItem = null;

async function openBoostModal(itemId) {
    if (!state.currentUser) {
        showToast('Kérlek jelentkezz be a kiemeléshez!', 'info');
        openAuthModal('login');
        return;
    }

    // Keresd meg a terméket a helyi listában vagy kérd le
    let item = state.items.find(i => i.id === itemId);
    if (!item) {
        try {
            const res = await fetch(`/api/items/${itemId}`);
            if (res.ok) item = await res.json();
        } catch (e) {}
    }

    if (!item) {
        showToast('A hirdetés nem található!', 'error');
        return;
    }

    currentBoostingItem = item;
    selectedBoostPlan = 'boost_1_day';

    const previewContainer = document.getElementById('boost-item-preview');
    if (previewContainer) {
        previewContainer.innerHTML = `
            <img src="${item.image_url}" class="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 shrink-0">
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-900 text-xs truncate">${item.title}</h4>
                <div class="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>${item.category} • ${item.price.toLocaleString('hu-HU')} Ft/${item.price_unit}</span>
                    ${item.is_featured ? '<span class="text-amber-600 font-bold">⚡ Jelenleg is kiemelt!</span>' : ''}
                </div>
            </div>
        `;
    }

    selectBoostPlan('boost_1_day');

    const modal = document.getElementById('boost-modal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
}

function closeBoostModal() {
    const modal = document.getElementById('boost-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    currentBoostingItem = null;
}

function selectBoostPlan(planId) {
    selectedBoostPlan = planId;
    
    const card1 = document.getElementById('boost-card-boost_1_day');
    const card7 = document.getElementById('boost-card-boost_7_days');
    const payBtnText = document.getElementById('boost-pay-btn-text');

    if (card1 && card7) {
        if (planId === 'boost_1_day') {
            card1.className = 'block relative p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 cursor-pointer transition-all hover:shadow-md';
            card7.className = 'block relative p-4 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:shadow-md hover:border-amber-400';
            const r1 = card1.querySelector('input[type="radio"]');
            if (r1) r1.checked = true;
            if (payBtnText) payBtnText.textContent = '⚡ 1 Napos Kiemelés Fizetése (390 Ft)';
        } else {
            card1.className = 'block relative p-4 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer transition-all hover:shadow-md hover:border-emerald-400';
            card7.className = 'block relative p-4 rounded-2xl border-2 border-amber-500 bg-amber-50/40 cursor-pointer transition-all hover:shadow-md';
            const r7 = card7.querySelector('input[type="radio"]');
            if (r7) r7.checked = true;
            if (payBtnText) payBtnText.textContent = '🚀 1 Heti Kiemelés Fizetése (1 590 Ft)';
        }
    }
}

async function startBoostPayment() {
    if (!state.currentUser || !currentBoostingItem) return;

    try {
        const res = await fetch('/api/stripe/create-boost-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.currentUser.id,
                item_id: currentBoostingItem.id,
                boost_plan_id: selectedBoostPlan
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a kiemelés előkészítésekor');
        }

        const sessionData = await res.json();
        currentStripeSession = sessionData;

        closeBoostModal();

        if (!sessionData.is_sandbox_simulation && sessionData.checkout_url && sessionData.checkout_url.startsWith('https://checkout.stripe.com')) {
            window.location.href = sessionData.checkout_url;
            return;
        }

        openStripeCheckoutModal(sessionData);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openStripeCheckoutModal(sessionData) {
    closeSubscriptionModal();
    const modal = document.getElementById('stripe-checkout-modal');
    if (!modal) return;

    const isBoost = sessionData.payment_type === 'one_time' || sessionData.item_id || (sessionData.plan_id && sessionData.plan_id.startsWith('boost_'));

    document.getElementById('stripe-checkout-plan-name').textContent = sessionData.plan_name;
    
    if (isBoost) {
        document.getElementById('stripe-checkout-plan-desc').textContent = sessionData.item_title ? `Kiemelt eszköz: ${sessionData.item_title} (Egyszeri levonás)` : 'Hirdetés kiemelése a lista élére (Egyszeri levonás)';
        document.getElementById('stripe-checkout-amount').textContent = `${sessionData.amount.toLocaleString('hu-HU')} Ft`;
        const subPer = document.querySelector('#stripe-checkout-amount + span');
        if (subPer) subPer.textContent = 'egyszeri díj (nem újul meg)';
    } else {
        document.getElementById('stripe-checkout-plan-desc').textContent = `Maximum ${sessionData.plan_id === 'starter_3' ? 3 : sessionData.plan_id === 'pro_10' ? 10 : 'végtelen'} db termék (Havonta automatikusan megújuló)`;
        document.getElementById('stripe-checkout-amount').textContent = `${sessionData.amount.toLocaleString('hu-HU')} Ft`;
        const subPer = document.querySelector('#stripe-checkout-amount + span');
        if (subPer) subPer.textContent = '/ hónap (havonta ismétlődő)';
    }

    document.getElementById('stripe-card-name').value = state.currentUser ? state.currentUser.name : '';

    modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
}

function closeStripeCheckoutModal() {
    const modal = document.getElementById('stripe-checkout-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    currentStripeSession = null;
}

async function handleStripePaymentSubmit(e) {
    e.preventDefault();
    if (!currentStripeSession || !state.currentUser) return;

    const submitBtn = document.getElementById('stripe-submit-btn');
    const submitText = document.getElementById('stripe-submit-text');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fizetés feldolgozása a Stripe-on...';
    }

    try {
        // Szimulálunk egy rövid 800ms banki ellenőrzési animációt
        await new Promise(resolve => setTimeout(resolve, 800));

        const isBoost = currentStripeSession.payment_type === 'one_time' || currentStripeSession.item_id || (currentStripeSession.plan_id && currentStripeSession.plan_id.startsWith('boost_'));
        let res;

        if (isBoost) {
            res = await fetch('/api/stripe/confirm-boost-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.currentUser.id,
                    item_id: currentStripeSession.item_id,
                    boost_plan_id: currentStripeSession.plan_id || currentStripeSession.boost_plan_id,
                    session_id: currentStripeSession.session_id
                })
            });
        } else {
            res = await fetch('/api/stripe/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.currentUser.id,
                    plan_id: currentStripeSession.plan_id,
                    session_id: currentStripeSession.session_id
                })
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a fizetés jóváhagyásakor');
        }

        const data = await res.json();
        closeStripeCheckoutModal();
        showToast(data.message, 'success');

        await refreshCurrentUser();
        await loadItems();
        if (state.activeTab === 'dashboard') {
            loadDashboardData();
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitText.innerHTML = 'Biztonságos Fizetés Indítása';
        }
    }
}

// --- MODALOK ÉS BÉRLÉSI KALKULÁTOR ---

async function openItemModal(itemId) {
    try {
        const res = await fetch(`/api/items/${itemId}`);
        if (!res.ok) throw new Error('Eszköz nem található');
        state.selectedItem = await res.json();
        
        state.calculator.units = 0;
        state.calculator.selectedDates = [];
        state.calculator.startDate = '';
        state.calculator.endDate = '';
        state.calculator.note = '';
        state.calendarDate = new Date();
        state.currentModalImageIndex = 0;

        renderItemModalContent();
        const modal = document.getElementById('item-modal');
        if (modal) modal.style.display = 'flex';
        document.body.classList.add('overflow-hidden');
    } catch (err) {
        showToast('Hiba az adatlap betöltésekor', 'error');
    }
}

function closeItemModal() {
    const modal = document.getElementById('item-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    state.selectedItem = null;
    state.currentModalImageIndex = 0;
}

function changeItemModalImage(delta) {
    const item = state.selectedItem;
    if (!item) return;
    const images = (item.images && item.images.length > 0) ? item.images : [item.image_url || 'static/logo.png'];
    if (images.length <= 1) return;
    state.currentModalImageIndex = (state.currentModalImageIndex + delta + images.length) % images.length;
    updateModalCarouselView();
}

function setItemModalImage(idx) {
    const item = state.selectedItem;
    if (!item) return;
    const images = (item.images && item.images.length > 0) ? item.images : [item.image_url || 'static/logo.png'];
    if (idx >= 0 && idx < images.length) {
        state.currentModalImageIndex = idx;
        updateModalCarouselView();
    }
}

function updateModalCarouselView() {
    const item = state.selectedItem;
    if (!item) return;
    const images = (item.images && item.images.length > 0) ? item.images : [item.image_url || 'static/logo.png'];
    const imgEl = document.getElementById('modal-carousel-img');
    const counterEl = document.getElementById('modal-carousel-counter');
    if (imgEl && images[state.currentModalImageIndex]) {
        imgEl.src = images[state.currentModalImageIndex];
    }
    if (counterEl) {
        counterEl.innerText = `${state.currentModalImageIndex + 1} / ${images.length}`;
    }
    const thumbs = document.querySelectorAll('.modal-thumb-btn');
    thumbs.forEach((thumb, i) => {
        if (i === state.currentModalImageIndex) {
            thumb.className = 'modal-thumb-btn relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-emerald-500 ring-2 ring-emerald-400/40 scale-105 shadow-md transition-all';
        } else {
            thumb.className = 'modal-thumb-btn relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-transparent opacity-60 hover:opacity-100 transition-all';
        }
    });
}

// --- KÉP NAGYÍTÓ / LIGHTBOX KEZELÉSE ---

let lightboxImages = [];
let currentLightboxIndex = 0;

function openImageLightbox(index = null, imagesList = null, title = '') {
    const item = state.selectedItem;
    if (imagesList && Array.isArray(imagesList) && imagesList.length > 0) {
        lightboxImages = imagesList;
    } else if (item) {
        lightboxImages = (item.images && item.images.length > 0) ? item.images : [item.image_url || 'static/logo.png'];
    } else {
        lightboxImages = [];
    }

    if (lightboxImages.length === 0) return;

    currentLightboxIndex = (typeof index === 'number' && index >= 0) ? index : (state.currentModalImageIndex || 0);
    if (currentLightboxIndex >= lightboxImages.length) currentLightboxIndex = 0;

    const modal = document.getElementById('image-lightbox-modal');
    const titleEl = document.getElementById('lightbox-title');
    if (!modal) return;

    if (titleEl) {
        titleEl.textContent = title || (item ? item.title : 'Kép');
    }

    modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
    updateLightboxView();
}

function closeImageLightbox(e) {
    if (e && e.target && e.target.id !== 'image-lightbox-modal' && !e.target.closest('button[onclick*="closeImageLightbox"]')) {
        return;
    }
    const modal = document.getElementById('image-lightbox-modal');
    if (modal) modal.style.display = 'none';
    if (!document.getElementById('item-modal') || document.getElementById('item-modal').style.display === 'none') {
        document.body.classList.remove('overflow-hidden');
    }
}

function changeLightboxImage(delta) {
    if (lightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
    state.currentModalImageIndex = currentLightboxIndex;
    updateModalCarouselView();
    updateLightboxView();
}

function setLightboxImage(idx) {
    if (idx >= 0 && idx < lightboxImages.length) {
        currentLightboxIndex = idx;
        state.currentModalImageIndex = idx;
        updateModalCarouselView();
        updateLightboxView();
    }
}

function updateLightboxView() {
    const imgEl = document.getElementById('lightbox-img');
    const counterEl = document.getElementById('lightbox-counter');
    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    const thumbsContainer = document.getElementById('lightbox-thumbnails-container');

    if (imgEl && lightboxImages[currentLightboxIndex]) {
        imgEl.src = lightboxImages[currentLightboxIndex];
    }
    if (counterEl) {
        counterEl.textContent = `${currentLightboxIndex + 1} / ${lightboxImages.length}`;
    }

    if (lightboxImages.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (thumbsContainer) thumbsContainer.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
        if (thumbsContainer) {
            thumbsContainer.style.display = 'flex';
            thumbsContainer.innerHTML = lightboxImages.map((src, i) => `
                <button type="button" onclick="event.stopPropagation(); setLightboxImage(${i})" class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === currentLightboxIndex ? 'border-emerald-400 scale-105 shadow-md ring-2 ring-emerald-400/50' : 'border-transparent opacity-60 hover:opacity-100'}">
                    <img src="${src}" class="w-full h-full object-cover">
                </button>
            `).join('');
        }
    }
}

window.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('image-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') {
        if (e.key === 'Escape') {
            closeImageLightbox();
        } else if (e.key === 'ArrowLeft') {
            changeLightboxImage(-1);
        } else if (e.key === 'ArrowRight') {
            changeLightboxImage(1);
        }
    }
});

function checkRentalDateCollision(item, startDate, endDate) {
    if (!item || !item.booked_ranges || item.booked_ranges.length === 0) return null;
    let reqStart = String(startDate || '').trim();
    let reqEnd = String(endDate || reqStart).trim();
    if (reqStart > reqEnd) {
        const tmp = reqStart;
        reqStart = reqEnd;
        reqEnd = tmp;
    }

    for (const r of item.booked_ranges) {
        let exStart = String(r.start_date || '').trim();
        let exEnd = String(r.end_date || exStart).trim();
        if (!exStart) continue;
        if (exStart > exEnd) {
            const tmp = exStart;
            exStart = exEnd;
            exEnd = tmp;
        }

        if (reqStart <= exEnd && reqEnd >= exStart) {
            return r;
        }
    }
    return null;
}

function renderItemModalContent() {
    const item = state.selectedItem;
    if (!item) return;

    const today = new Date().toISOString().split('T')[0];
    const bookedRanges = item.booked_ranges || [];
    const locationTags = (item.location || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const images = (item.images && item.images.length > 0) ? item.images : [item.image_url || 'static/logo.png'];
    
    if (typeof state.currentModalImageIndex !== 'number' || state.currentModalImageIndex >= images.length) {
        state.currentModalImageIndex = 0;
    }
    const activeImg = images[state.currentModalImageIndex] || images[0];

    const modalBody = document.getElementById('item-modal-content');
    modalBody.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <!-- BAL OLDAL: Kompaktabb oszlop (Képgaléria lapozóval, Cím, Címkék, Leírás, Elérhetőség) -->
            <div class="lg:col-span-5 space-y-4">
                <!-- KÉP GALÉRIA & LAPOZÓ KONTÉNER (Kattintásra teljes méretű nagyítás) -->
                <div class="space-y-2">
                    <div class="relative aspect-square max-h-[320px] sm:max-h-[360px] w-full mx-auto rounded-2xl overflow-hidden bg-slate-100 shadow-inner group border border-slate-200/80 cursor-zoom-in" onclick="openImageLightbox()" title="Kattints a fotó nagyításához">
                        <img id="modal-carousel-img" src="${activeImg}" alt="${item.title}" class="w-full h-full object-cover transition-all duration-300 group-hover:scale-105">
                        
                        <div class="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow">
                            ${item.category}
                        </div>

                        <!-- Nagyítás jelvény hover esetén -->
                        <div class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <i class="fa-solid fa-magnifying-glass-plus text-emerald-400"></i> Nagyítás
                        </div>

                        ${images.length > 1 ? `
                            <!-- Lapozó gombok bal és jobb oldalra -->
                            <button type="button" onclick="event.stopPropagation(); changeItemModalImage(-1)" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all hover:scale-110 active:scale-95" title="Előző fotó">
                                <i class="fa-solid fa-chevron-left text-sm"></i>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); changeItemModalImage(1)" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all hover:scale-110 active:scale-95" title="Következő fotó">
                                <i class="fa-solid fa-chevron-right text-sm"></i>
                            </button>

                            <!-- Képszámláló -->
                            <div class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-bold font-mono shadow">
                                <span id="modal-carousel-counter">${state.currentModalImageIndex + 1} / ${images.length}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${images.length > 1 ? `
                        <!-- Mini bélyegképek (Thumbnail csík) -->
                        <div class="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
                            ${images.map((img, idx) => `
                                <button type="button" onclick="setItemModalImage(${idx})" class="modal-thumb-btn relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${idx === state.currentModalImageIndex ? 'border-emerald-500 ring-2 ring-emerald-400/40 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}">
                                    <img src="${img}" class="w-full h-full object-cover">
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900">${item.title}</h2>
                        <span class="px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200 shrink-0" title="Hirdetés egyedi azonosítója">
                            ID: #${item.id}
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 mb-3">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <i class="fa-solid fa-location-dot text-emerald-600 text-xs"></i>
                            ${locationTags.length > 0 ? locationTags.map(loc => `
                                <span class="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                                    ${loc}
                                </span>
                            `).join('') : `<span class="font-medium">${item.location}</span>`}
                        </div>
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs">Állapot: ${item.condition}</span>
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span class="text-emerald-700 font-semibold flex items-center gap-1"><i class="fa-solid fa-check-circle"></i> Bérelhető</span>
                    </div>

                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-info text-emerald-600"></i> Leírás & Tartozékok
                        </div>
                        ${item.description}
                    </div>
                </div>
            </div>

            <!-- JOBB OLDAL: Szélesebb oszlop (Bérbeadó profilja a kalkulátor tetején + Naptár és kalkulátor) -->
            <div class="lg:col-span-7">
                <div class="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-5 sm:p-6 rounded-2xl border-2 border-emerald-500/20 shadow-lg">
                    
                    <!-- BÉRBEADÓ PROFIL KÁRTYA A KALKULÁTOR LEGELSŐ ELEMEKÉNT (kattintásra profil adatlap) -->
                    <div class="flex items-center justify-between p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm mb-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group" onclick="openUserProfileModal(${item.user_id})" title="Kattints ${item.owner_name} teljes adatlapjának és értékeléseinek megtekintéséhez">
                        <div class="flex items-center gap-3">
                            <div class="relative shrink-0">
                                <img src="${getUserAvatar(item.owner_name, item.owner_avatar)}" class="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/40 shadow-sm group-hover:scale-105 transition-transform">
                                <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[8px] shadow">
                                    <i class="fa-solid fa-check"></i>
                                </span>
                            </div>
                            <div>
                                <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Hirdető / Bérbeadó</span>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-sm font-black text-slate-900 group-hover:text-emerald-700 underline-offset-2 group-hover:underline">
                                        ${item.owner_name}
                                    </span>
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400 group-hover:text-emerald-600 transition-colors"></i>
                                </div>
                                <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                    <span class="text-amber-500 font-bold flex items-center gap-0.5">
                                        ★ ${Number(item.owner_rating || 5.0).toFixed(1)}
                                    </span>
                                    ${item.owner_reviews_count ? `<span class="text-slate-400">(${item.owner_reviews_count} értékelés)</span>` : ''}
                                    ${item.owner_city ? `<span class="text-slate-400">• ${item.owner_city}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 shrink-0">
                            <span>Adatlap</span>
                            <i class="fa-solid fa-chevron-right text-[10px]"></i>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                        <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Bérleti Kalkulátor & Foglalás</span>
                        <span class="text-lg font-black text-slate-900">${item.price.toLocaleString('hu-HU')} Ft <span class="text-xs font-semibold text-slate-500">/ ${item.price_unit || 'nap'}</span></span>
                    </div>

                    <!-- 📅 INTERAKTÍV NAPTÁR WIDGET -->
                    <div id="rental-calendar-container" class="mb-3"></div>

                    <!-- Kijelölt napok állapotsáv -->
                    <div id="calc-selected-days-bar" class="mb-4"></div>

                    <form id="rental-form" onsubmit="submitRentalRequest(event)" class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1.5">Megjegyzés / Átvételi kérés:</label>
                            <textarea id="calc-note" rows="2" placeholder="Pl. Szombat reggel 9-kor érte tudok menni..." class="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm resize-none"></textarea>
                        </div>

                        <div class="bg-white p-4 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                            <div class="flex justify-between text-slate-600">
                                <span>Bérleti díj (<span id="calc-summary-units" class="font-bold text-slate-800">0 nap</span> × ${item.price.toLocaleString('hu-HU')} Ft):</span>
                                <span id="calc-rent-total" class="font-bold text-slate-800">0 Ft</span>
                            </div>
                            <div class="flex justify-between text-slate-600">
                                <span>Kaució (visszajár épségben való visszaadáskor):</span>
                                <span class="font-semibold text-amber-700">${item.deposit.toLocaleString('hu-HU')} Ft</span>
                            </div>
                            <div class="border-t border-slate-100 pt-2.5 flex justify-between items-baseline">
                                <span class="font-bold text-slate-900 text-sm">Fizetendő átvételkor a felek között:</span>
                                <span id="calc-grand-total" class="font-black text-emerald-600 text-lg">${item.deposit.toLocaleString('hu-HU')} Ft</span>
                            </div>
                        </div>

                        <button type="submit" id="rental-submit-btn" disabled class="w-full py-3.5 px-4 bg-slate-300 text-slate-500 font-extrabold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-none">
                            <i class="fa-solid fa-calendar-days"></i> Válassz napo(ka)t a naptárból!
                        </button>
                        <p class="text-[11px] text-center text-slate-500">
                            A fizetés és átadás közvetlenül a két fél között zajlik átvételkor.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    `;

    renderRentalCalendar();
    recalculatePrice();
}

function renderRentalCalendar() {
    const container = document.getElementById('rental-calendar-container');
    if (!container || !state.selectedItem) return;

    if (!state.calendarDate) {
        state.calendarDate = new Date();
    }
    if (!state.calculator.selectedDates) {
        state.calculator.selectedDates = [];
    }

    const item = state.selectedItem;
    const bookedRanges = item.booked_ranges || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();

    const monthNames = [
        'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
        'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
    ];
    const dayNames = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let gridHtml = '';

    for (let i = 0; i < firstDayIndex; i++) {
        gridHtml += `<div class="h-8"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isPast = dayStr < todayStr;
        const bookedRange = bookedRanges.find(r => {
            const s = r.start_date;
            const e = r.end_date || r.start_date;
            return s <= dayStr && dayStr <= e;
        });
        const isBooked = !!bookedRange;
        const isSelected = state.calculator.selectedDates.includes(dayStr);

        if (isBooked) {
            // Piros foglalt nap - NEM KATTINTHATÓ
            gridHtml += `
                <div title="🔴 Foglalt nap (${bookedRange.start_date} – ${bookedRange.end_date})" 
                    class="h-8 w-full rounded-lg bg-rose-500 text-white font-extrabold flex flex-col items-center justify-center text-[10px] shadow-xs cursor-not-allowed opacity-90 select-none">
                    <span>${d}</span>
                    <span class="text-[7px] leading-none uppercase tracking-tighter opacity-90 font-black">Foglalt</span>
                </div>
            `;
        } else if (isPast) {
            // Múltbeli nap - Nem választható
            gridHtml += `
                <div class="h-8 w-full rounded-lg bg-slate-100/70 text-slate-300 font-medium flex items-center justify-center text-xs cursor-not-allowed select-none">
                    <span>${d}</span>
                </div>
            `;
        } else if (isSelected) {
            // Zölddel kijelölt nap - Újrakattintva fehér lesz (kikapcsolódik)
            gridHtml += `
                <button type="button" onclick="selectCalendarDate('${dayStr}')" title="Kijelölve - Kattints a visszavonáshoz"
                    class="h-8 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center text-xs shadow-md ring-2 ring-emerald-400 cursor-pointer transition-transform active:scale-95">
                    <span>${d}</span>
                </button>
            `;
        } else {
            // Fehér szabad nap - Kattintásra zöld lesz
            gridHtml += `
                <button type="button" onclick="selectCalendarDate('${dayStr}')" title="Szabad nap - Kattints a kijelöléshez"
                    class="h-8 w-full rounded-lg bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 font-bold border border-slate-200 hover:border-emerald-500 flex items-center justify-center text-xs cursor-pointer shadow-2xs transition-all active:scale-95">
                    <span>${d}</span>
                </button>
            `;
        }
    }

    container.innerHTML = `
        <div class="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="flex items-center justify-between mb-2.5 px-1">
                <button type="button" onclick="changeCalendarMonth(-1)" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 flex items-center justify-center text-xs transition-colors">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <i class="fa-regular fa-calendar text-emerald-600"></i>
                    <span>${monthNames[month]} ${year}</span>
                </div>
                <button type="button" onclick="changeCalendarMonth(1)" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 flex items-center justify-center text-xs transition-colors">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] font-bold text-slate-400">
                ${dayNames.map(dn => `<div>${dn}</div>`).join('')}
            </div>

            <div class="grid grid-cols-7 gap-1">
                ${gridHtml}
            </div>

            <div class="flex items-center justify-center gap-3 pt-2 mt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
                <div class="flex items-center gap-1">
                    <span class="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span>
                    <span>Kijelölve (Zöld)</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span>
                    <span class="text-rose-700 font-bold">Foglalt (Piros)</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="w-2.5 h-2.5 rounded bg-white border border-slate-300 inline-block"></span>
                    <span>Szabad (Fehér)</span>
                </div>
            </div>
        </div>
    `;

    renderSelectedDaysBar();
}

function selectCalendarDate(dayStr) {
    if (!state.selectedItem) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (dayStr < todayStr) return;

    // Ellenőrizzük, hogy nem foglalt-e
    const bookedRanges = state.selectedItem.booked_ranges || [];
    const isBooked = bookedRanges.some(r => {
        const s = r.start_date;
        const e = r.end_date || r.start_date;
        return s <= dayStr && dayStr <= e;
    });
    if (isBooked) return;

    if (!state.calculator.selectedDates) {
        state.calculator.selectedDates = [];
    }

    const idx = state.calculator.selectedDates.indexOf(dayStr);
    if (idx >= 0) {
        // Már ki volt jelölve -> Visszaállítjuk fehérre (kivesszük a listából)
        state.calculator.selectedDates.splice(idx, 1);
    } else {
        // Még nem volt kijelölve -> Kijelöljük zölddel (hozzáadjuk a listához)
        state.calculator.selectedDates.push(dayStr);
    }

    state.calculator.selectedDates.sort();

    state.calculator.units = state.calculator.selectedDates.length;
    if (state.calculator.selectedDates.length > 0) {
        state.calculator.startDate = state.calculator.selectedDates[0];
        state.calculator.endDate = state.calculator.selectedDates[state.calculator.selectedDates.length - 1];
    } else {
        state.calculator.startDate = '';
        state.calculator.endDate = '';
    }

    recalculatePrice();
    renderRentalCalendar();
}

function renderSelectedDaysBar() {
    const bar = document.getElementById('calc-selected-days-bar');
    if (!bar) return;

    const dates = state.calculator.selectedDates || [];
    if (dates.length === 0) {
        bar.className = 'p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2';
        bar.innerHTML = `
            <i class="fa-solid fa-circle-info text-emerald-600 text-sm shrink-0"></i>
            <span>Kattints a naptárban a kívánt nap(ok)ra a bérlés kijelöléséhez!</span>
        `;
    } else {
        bar.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs';
        bar.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="font-extrabold text-emerald-800 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-check text-emerald-600"></i>
                    Kijelölt időtartam: <strong>${dates.length} nap</strong>
                </span>
                <button type="button" onclick="clearSelectedDates()" class="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer">
                    Kijelölés törlése
                </button>
            </div>
            <div class="text-[11px] text-emerald-700 font-mono truncate">
                ${dates.join(', ')}
            </div>
        `;
    }
}

function clearSelectedDates() {
    state.calculator.selectedDates = [];
    state.calculator.units = 0;
    state.calculator.startDate = '';
    state.calculator.endDate = '';
    recalculatePrice();
    renderRentalCalendar();
}

function changeCalendarMonth(delta) {
    if (!state.calendarDate) state.calendarDate = new Date();
    state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + delta, 1);
    renderRentalCalendar();
}

function recalculatePrice() {
    if (!state.selectedItem) return;
    const item = state.selectedItem;
    const unitType = item.price_unit || 'nap';
    const dates = state.calculator.selectedDates || [];
    const dateCount = dates.length;

    let units = dateCount;
    let unitLabel = 'nap';
    let unitLabelSuffix = 'napra';

    if (unitType === 'alkalom') {
        units = dateCount;
        unitLabel = 'alkalom';
        unitLabelSuffix = 'alkalomra';
    } else if (unitType === 'hónap') {
        units = Math.max(1, Math.ceil(dateCount / 30));
        unitLabel = 'hónap';
        unitLabelSuffix = 'hónapra';
    }

    state.calculator.units = units;

    const rentTotal = dateCount > 0 ? (units * item.price) : 0;
    const grandTotal = dateCount > 0 ? (rentTotal + item.deposit) : item.deposit;

    const summaryUnits = document.getElementById('calc-summary-units');
    const rentTotalEl = document.getElementById('calc-rent-total');
    const grandTotalEl = document.getElementById('calc-grand-total');
    const submitBtn = document.getElementById('rental-submit-btn');

    if (summaryUnits) summaryUnits.textContent = `${units} ${unitLabel}`;
    if (rentTotalEl) rentTotalEl.textContent = `${rentTotal.toLocaleString('hu-HU')} Ft`;
    if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toLocaleString('hu-HU')} Ft`;

    if (submitBtn) {
        if (dateCount > 0) {
            submitBtn.disabled = false;
            submitBtn.className = 'w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer';
            submitBtn.innerHTML = `<i class="fa-solid fa-handshake"></i> Bérlési Kérelem Küldése (${units} ${unitLabelSuffix})`;
        } else {
            submitBtn.disabled = true;
            submitBtn.className = 'w-full py-3.5 px-4 bg-slate-300 text-slate-500 font-extrabold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-none';
            submitBtn.innerHTML = '<i class="fa-solid fa-calendar-days"></i> Válassz napo(ka)t a naptárból!';
        }
    }
}

async function submitRentalRequest(e) {
    e.preventDefault();
    if (!state.currentUser) {
        showToast('Kérlek jelentkezz be a bérléshez!', 'info');
        openAuthModal('login');
        return;
    }
    if (!state.selectedItem) return;

    if (state.selectedItem.user_id === state.currentUser.id) {
        showToast('A saját magad által feltöltött eszközt nem tudod kibérelni!', 'error');
        return;
    }

    const selectedDates = state.calculator.selectedDates || [];
    if (selectedDates.length === 0) {
        showToast('Kérlek kattints a naptárban a kívánt napokra a kijelöléshez!', 'error');
        return;
    }

    const startDate = selectedDates[0];
    const endDate = selectedDates[selectedDates.length - 1];
    const unitType = state.selectedItem.price_unit || 'nap';
    let units = selectedDates.length;
    if (unitType === 'hónap') {
        units = Math.max(1, Math.ceil(selectedDates.length / 30));
    }

    const note = document.getElementById('calc-note')?.value || '';
    const totalPrice = units * state.selectedItem.price;

    const payload = {
        item_id: state.selectedItem.id,
        renter_id: state.currentUser.id,
        start_date: startDate,
        end_date: endDate,
        units_count: units,
        total_price: totalPrice,
        deposit: state.selectedItem.deposit,
        note: note ? `${note} (Kijelölt napok: ${selectedDates.join(', ')})` : `Kijelölt napok: ${selectedDates.join(', ')}`
    };

    try {
        const res = await fetch('/api/rentals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            let errorMsg = 'Hiba a foglalás beküldésekor';
            try {
                const errData = await res.json();
                if (errData.detail) errorMsg = errData.detail;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        closeItemModal();
        showToast('🎉 Bérlési kérelem rögzítve! Értesítő e-mail elküldve a bérbeadónak és bérlőnek.', 'success');
        
        // Frissítjük a hirdetéseket
        await loadItems();

        switchTab('dashboard');
        switchDashboardSubTab('outgoing');
    } catch (err) {
        showToast(err.message || 'Hiba történt a kérelem beküldésekor!', 'error');
    }
}

// --- ÚJ HIRDETÉS FELADÁSA & KÉPFELTÖLTÉS ---

function openNewItemModal() {
    if (!state.currentUser) {
        showToast('Kérlek jelentkezz be a hirdetésfeladáshoz!', 'info');
        openAuthModal('login');
        return;
    }

    const currentCount = state.currentUser.active_items_count || 0;
    const maxItems = state.currentUser.max_items || 1;

    if (currentCount >= maxItems) {
        showToast(`Elérted a csomagod limitjét (${currentCount}/${maxItems} termék)! Válts nagyobb előfizetésre!`, 'error');
        openSubscriptionModal();
        return;
    }

    removeSelectedImage('new');
    const modal = document.getElementById('new-item-modal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
    
    state.newLocations = state.currentUser.city ? [state.currentUser.city] : [];
    renderLocationTags('new');
    setupLocationTagInput('new');
}

function closeNewItemModal() {
    const modal = document.getElementById('new-item-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    removeAllSelectedImages('new');
}

async function submitNewItem(e) {
    e.preventDefault();
    if (!state.currentUser) {
        openAuthModal('login');
        return;
    }

    const form = e.target;

    // Automatikusan vegyük fel a beírt helyszínt, ha a felhasználó nem kattintott a külön "+ Hozzáad" gombra
    const locInput = document.getElementById('new-item-location-input');
    if (locInput && locInput.value.trim()) {
        addLocationTag('new', locInput.value.trim());
    }

    // Ha még mindig nincs helyszín megadva, de a profilban szerepel település, használjuk azt
    if ((!state.newLocations || state.newLocations.length === 0) && state.currentUser.city) {
        addLocationTag('new', state.currentUser.city);
    }

    let location = (state.newLocations && state.newLocations.length > 0)
        ? state.newLocations.join(', ')
        : (form['location'] ? form['location'].value : '').trim();

    if (!location) {
        showToast('Kérlek adj meg legalább egy települést/helyszínt a hirdetéshez!', 'error');
        if (locInput) locInput.focus();
        return;
    }

    const submitBtn = document.getElementById('submit-item-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Feltöltés...`;
    }

    const images = (state.newItemImages && state.newItemImages.length > 0)
        ? state.newItemImages
        : ['static/logo.png'];

    const title = form['title'].value;
    const category = form['category'].value;
    const description = form['description'].value;
    const price = parseInt(form['price'].value);
    const price_unit = (form['price_unit'] ? form['price_unit'].value : 'nap') || 'nap';
    const deposit = parseInt(form['deposit'].value || 0);
    const condition = form['condition'].value;

    const payload = {
        user_id: state.currentUser.id,
        title,
        category,
        description,
        price,
        price_unit,
        deposit,
        location,
        condition,
        image_url: images[0] || 'static/logo.png',
        images: images
    };

    try {
        const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Hiba a hirdetés feladásakor');
        }

        form.reset();
        state.newLocations = [];
        renderLocationTags('new');
        state.newItemImages = [];
        renderImagesPreviewGrid('new');
        closeNewItemModal();
        showToast('✨ Hirdetésed a beállított fotókkal és helyszínekkel sikeresen megjelent az oldalon!', 'success');

        // Szűrők alaphelyzetbe állítása, hogy az új hirdetés azonnal látható legyen a főoldalon
        state.selectedCategory = 'Mind';
        state.selectedUnit = 'Mind';
        state.searchQuery = '';
        state.locationFilter = '';
        state.maxPrice = '';

        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        const cityFilterInput = document.getElementById('city-filter-input');
        if (cityFilterInput) cityFilterInput.value = '';
        const priceFilter = document.getElementById('price-filter');
        if (priceFilter) priceFilter.value = '';

        renderCategoryPills();
        await refreshCurrentUser();
        await loadItems();
        switchTab('browse');
    } catch (err) {
        showToast(err.message, 'error');
        if (err.message.includes('előfizetési csomagra') || err.message.includes('korlátját')) {
            openSubscriptionModal();
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Hirdetés Közzététele</span>`;
        }
    }
}

// --- HIRDETÉS MÓDOSÍTÁSA ÉS TÖRLÉSE ---

let currentEditingItem = null;

async function openEditItemModal(itemId) {
    try {
        const res = await fetch(`/api/items/${itemId}`);
        if (!res.ok) throw new Error('Hiba a hirdetés betöltésekor');
        currentEditingItem = await res.json();

        document.getElementById('edit-item-id').value = currentEditingItem.id;
        document.getElementById('edit-item-title').value = currentEditingItem.title;
        document.getElementById('edit-item-category').value = currentEditingItem.category;
        document.getElementById('edit-item-condition').value = currentEditingItem.condition || 'Jó állapotú';
        document.getElementById('edit-item-price').value = currentEditingItem.price;
        const editUnitEl = document.getElementById('edit-item-price-unit');
        if (editUnitEl) {
            editUnitEl.value = currentEditingItem.price_unit || 'nap';
            updatePriceUnitLabel('edit', editUnitEl.value);
        }
        document.getElementById('edit-item-deposit').value = currentEditingItem.deposit || 0;
        document.getElementById('edit-item-description').value = currentEditingItem.description;

        // Helyszínek betöltése és tag-ek inicializálása
        state.editLocations = (currentEditingItem.location || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        renderLocationTags('edit');
        setupLocationTagInput('edit');

        // Képek betöltése és többkép előnézet inicializálása módosításkor
        if (Array.isArray(currentEditingItem.images) && currentEditingItem.images.length > 0) {
            state.editItemImages = [...currentEditingItem.images];
        } else if (currentEditingItem.image_url && currentEditingItem.image_url !== 'static/logo.png') {
            state.editItemImages = [currentEditingItem.image_url];
        } else {
            state.editItemImages = [];
        }
        renderImagesPreviewGrid('edit');

        const modal = document.getElementById('edit-item-modal');
        if (modal) modal.style.display = 'flex';
        document.body.classList.add('overflow-hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeEditItemModal() {
    const modal = document.getElementById('edit-item-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    removeAllSelectedImages('edit');
    currentEditingItem = null;
}

async function submitEditItem(e) {
    e.preventDefault();
    if (!state.currentUser || !currentEditingItem) return;

    const locInput = document.getElementById('edit-item-location-input');
    if (locInput && locInput.value.trim()) {
        addLocationTag('edit', locInput.value.trim());
    }

    const location = (state.editLocations && state.editLocations.length > 0)
        ? state.editLocations.join(', ')
        : (document.getElementById('edit-item-location') ? document.getElementById('edit-item-location').value : '').trim();

    if (!location) {
        showToast('Kérlek adj meg legalább egy helyszínt a hirdetéshez!', 'error');
        if (locInput) locInput.focus();
        return;
    }

    const btn = document.getElementById('submit-edit-item-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mentés...`;
    }

    const images = (state.editItemImages && state.editItemImages.length > 0)
        ? state.editItemImages
        : [currentEditingItem.image_url || 'static/logo.png'];

    const payload = {
        user_id: state.currentUser.id,
        title: document.getElementById('edit-item-title').value,
        category: document.getElementById('edit-item-category').value,
        condition: document.getElementById('edit-item-condition').value,
        price: parseInt(document.getElementById('edit-item-price').value),
        price_unit: document.getElementById('edit-item-price-unit')?.value || 'nap',
        deposit: parseInt(document.getElementById('edit-item-deposit').value || 0),
        location: location,
        description: document.getElementById('edit-item-description').value,
        image_url: images[0] || 'static/logo.png',
        images: images
    };

    try {
        const res = await fetch(`/api/items/${currentEditingItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a mentéskor');
        }

        closeEditItemModal();
        showToast('✨ Hirdetés adatai sikeresen módosítva lettek!', 'success');
        await loadItems();
        if (state.activeTab === 'dashboard') {
            await loadDashboardData();
        } else if (state.activeTab === 'admin') {
            await loadAdminData();
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>Módosítások Mentése</span>`;
        }
    }
}

async function deleteItem(itemId) {
    if (!state.currentUser) return;
    const confirmed = confirm('Biztosan törölni szeretnéd ezt a hirdetést? Ezzel azonnal felszabadul az ingyenes hirdetési helyed és újra tölthetsz fel terméket!');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/items/${itemId}?user_id=${state.currentUser.id}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a törléskor');
        }

        const data = await res.json();
        showToast(data.message, 'success');
        
        await refreshCurrentUser();
        await loadItems();
        if (state.activeTab === 'dashboard') {
            await loadDashboardData();
        } else if (state.activeTab === 'admin') {
            await loadAdminData();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- IRÁNYÍTÓPULT (DASHBOARD) ---

async function loadDashboardData() {
    if (!state.currentUser) {
        openAuthModal('login');
        return;
    }

    const container = document.getElementById('dashboard-content');
    if (!container) return;

    container.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-600 mb-2"></i><p>Adatok betöltése...</p></div>`;

    try {
        await refreshCurrentUser();

        // 1. Saját hirdetések
        const resMyItems = await fetch(`/api/items?user_id=${state.currentUser.id}`);
        const rawMyItems = resMyItems.ok ? await resMyItems.json() : [];
        const myItems = Array.isArray(rawMyItems) ? rawMyItems : [];

        // 2. Kiadott eszközök bérlései (owner)
        const resOwner = await fetch(`/api/rentals?user_id=${state.currentUser.id}&role=owner`);
        const rawOwner = resOwner.ok ? await resOwner.json() : [];
        const incomingRentals = Array.isArray(rawOwner) ? rawOwner : (rawOwner.incoming || []);

        // 3. Kölcsönzéseim bérlőként (renter)
        const resRenter = await fetch(`/api/rentals?user_id=${state.currentUser.id}&role=renter`);
        const rawRenter = resRenter.ok ? await resRenter.json() : [];
        const outgoingRentals = Array.isArray(rawRenter) ? rawRenter : (rawRenter.outgoing || []);

        state.pendingRentalsCount = incomingRentals.filter(r => r.status === 'pending').length;
        updateNotificationBadges();

        renderDashboardUI(myItems, incomingRentals, outgoingRentals);
    } catch (err) {
        console.error('Hiba az irányítópult betöltésekor:', err);
        container.innerHTML = `<p class="text-rose-600 text-center py-8">Hiba történt az irányítópult betöltésekor. Kérlek frissítsd az oldalt!</p>`;
    }
}

function renderDashboardUI(myItems, incoming, outgoing) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    // Alapértelmezett fül, ha még nem volt beállítva
    if (!['my_items', 'incoming', 'outgoing', 'closed'].includes(state.dashboardSubTab)) {
        state.dashboardSubTab = 'my_items';
    }

    const currentUserId = state.currentUser?.id;
    const isClosedRental = (r) => {
        const hasReviewed = (r.reviews || []).some(rev => rev.reviewer_id === currentUserId);
        return ['completed', 'cancelled_no_show', 'cancelled'].includes(r.status) && hasReviewed;
    };

    const activeIncoming = incoming.filter(r => !isClosedRental(r));
    const closedIncoming = incoming.filter(r => isClosedRental(r));

    const activeOutgoing = outgoing.filter(r => !isClosedRental(r));
    const closedOutgoing = outgoing.filter(r => isClosedRental(r));

    const allClosedRentals = [
        ...closedIncoming.map(r => ({ ...r, _role: 'owner' })),
        ...closedOutgoing.map(r => ({ ...r, _role: 'renter' }))
    ];

    const isMyItems = state.dashboardSubTab === 'my_items';
    const isIncoming = state.dashboardSubTab === 'incoming';
    const isOutgoing = state.dashboardSubTab === 'outgoing';
    const isClosed = state.dashboardSubTab === 'closed';

    const currentCount = state.currentUser.active_items_count !== undefined ? state.currentUser.active_items_count : myItems.length;
    const maxText = state.currentUser.max_items >= 9000 ? '∞' : (state.currentUser.max_items || 1);
    const pendingIncomingCount = activeIncoming.filter(r => r.status === 'pending').length;

    container.innerHTML = `
        <!-- MEGBÍZHATÓSÁGI ÉS PROFIL ÖSSZESÍTŐ SÁV -->
        <div class="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-800">
            <div class="flex items-center gap-4">
                <img src="${getUserAvatar(state.currentUser)}" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-400 shadow-md">
                <div>
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-xl font-black text-white tracking-tight">${state.currentUser.name}</h3>
                        <span class="px-2 py-0.5 rounded-full bg-white/20 text-emerald-300 text-[10px] font-mono font-bold border border-white/20" title="A te egyedi felhasználói azonosítód">
                            Felhasználó ID: #${state.currentUser.id}
                        </span>
                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                            <i class="fa-solid fa-shield-halved"></i> 100% Megbízható Partner
                        </span>
                    </div>
                    <p class="text-xs text-slate-300 mt-0.5">${state.currentUser.email} • ${state.currentUser.city || 'Magyarország'}</p>
                    
                    <!-- MEGBÍZHATÓSÁGI SZÁMLÁLÓK -->
                    <div class="flex flex-wrap items-center gap-2.5 mt-3 text-xs">
                        <div class="bg-white/10 hover:bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-emerald-300 shadow-sm transition-colors" title="Sikeresen visszahozott bérbeadások tulajdonosként">
                            <i class="fa-solid fa-handshake"></i>
                            <span>${state.currentUser.completed_as_owner || 0} sikeres kiadás</span>
                        </div>
                        <div class="bg-white/10 hover:bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-teal-300 shadow-sm transition-colors" title="Rendben visszavitt kölcsönzések bérlőként">
                            <i class="fa-solid fa-cart-shopping"></i>
                            <span>${state.currentUser.completed_as_renter || 0} sikeres bérlés</span>
                        </div>
                        <div class="bg-white/10 hover:bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-amber-300 shadow-sm transition-colors">
                            <i class="fa-solid fa-star"></i>
                            <span>${state.currentUser.rating || 5.0} (${state.currentUser.reviews_count || 0} vélemény)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
                <button onclick="openSubscriptionModal()" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-crown text-amber-950"></i> Csomagom: ${currentCount}/${maxText} db
                </button>
                <button onclick="openNewItemModal()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-plus"></i> Új Hirdetés Feladása
                </button>
            </div>
        </div>

        <!-- AL-FÜLEK -->
        <div class="flex items-center gap-2 border-b border-slate-200 pb-4 mb-6 overflow-x-auto">
            <button onclick="switchDashboardSubTab('my_items')" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap ${
                isMyItems 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }">
                <i class="fa-solid fa-boxes-stacked mr-1.5"></i> Saját hirdetéseim (${myItems.length})
            </button>
            <button onclick="switchDashboardSubTab('incoming')" class="relative px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isIncoming 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }">
                <i class="fa-solid fa-inbox mr-1"></i>
                <span>Kiadott eszközeim bérlései (${activeIncoming.length})</span>
                ${pendingIncomingCount > 0 ? `
                    <span class="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse shadow-sm">
                        ${pendingIncomingCount} új
                    </span>
                ` : ''}
            </button>
            <button onclick="switchDashboardSubTab('outgoing')" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap ${
                isOutgoing 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }">
                <i class="fa-solid fa-cart-shopping mr-1.5"></i> Kölcsönzéseim bérlőként (${activeOutgoing.length})
            </button>
            <button onclick="switchDashboardSubTab('closed')" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isClosed 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }">
                <i class="fa-solid fa-box-archive mr-1 ${isClosed ? 'text-white' : 'text-emerald-600'}"></i>
                <span>Lezárt & Értékelt Bérlések (${allClosedRentals.length})</span>
            </button>
        </div>

        ${isMyItems ? renderMyItems(myItems) : isIncoming ? renderIncomingRentals(activeIncoming) : isOutgoing ? renderOutgoingRentals(activeOutgoing) : renderClosedRentals(allClosedRentals)}
    `;
}

function renderMyItems(items) {
    if (items.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <i class="fa-solid fa-toolbox"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-900 text-lg mb-1">Még nincs aktív hirdetésed</h4>
                    <p class="text-xs text-slate-500 max-w-md mx-auto">Töltsd fel a fészerben álló ásódat, fűkaszádat vagy gépeidet, és keress vele pénzt a környékeden lakóknak való bérbeadással!</p>
                </div>
                <div>
                    <button onclick="openNewItemModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all">
                        + 1. Termék meghirdetése ingyen
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-4">
            ${items.map(item => `
                <div class="item-card bg-white rounded-2xl overflow-hidden ${
                    item.is_featured 
                    ? 'border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-md relative bg-gradient-to-b from-amber-50/20 to-white' 
                    : 'border border-slate-200/80 shadow-sm'
                } flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md">
                    <div>
                        <!-- 1:1 Négyzetes Kép és jelvények -->
                        <div class="relative aspect-square w-full bg-slate-100 overflow-hidden cursor-pointer" onclick="openItemModal(${item.id})">
                            <img src="${item.image_url}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" onerror="this.src='https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80'">
                            
                            <div class="absolute top-2 left-2 flex flex-wrap gap-1 z-10">
                                <div class="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">
                                    ${item.category}
                                </div>
                                <div class="bg-slate-900/80 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono shadow-sm">
                                    #${item.id}
                                </div>
                            </div>

                            ${item.is_featured ? `
                                <div class="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-2 py-0.5 rounded-md text-[9px] shadow flex items-center gap-0.5 animate-pulse">
                                    <i class="fa-solid fa-bolt text-yellow-200 text-[8px]"></i> KIEMELT
                                </div>
                            ` : ''}
                        </div>

                        <!-- Kompakt Tartalom -->
                        <div class="p-3">
                            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                <span class="flex items-center gap-1 font-medium text-slate-600 truncate">
                                    <i class="fa-solid fa-location-dot text-emerald-600 text-[10px]"></i> ${item.location}
                                </span>
                                <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-medium truncate max-w-[70px]">${item.condition}</span>
                            </div>
                            
                            <h3 class="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 hover:text-emerald-600 transition-colors mb-1.5 cursor-pointer" onclick="openItemModal(${item.id})" title="${item.title}">
                                ${item.title}
                            </h3>

                            <!-- Ár és Kaució szekció -->
                            <div class="my-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-1">
                                <div>
                                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bérlés</span>
                                    <div class="flex items-baseline gap-0.5">
                                        <span class="text-xs sm:text-sm font-black text-emerald-700 leading-none">${item.price.toLocaleString('hu-HU')} Ft</span>
                                        <span class="text-[10px] font-bold text-slate-500">/${item.price_unit}</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kaució</span>
                                    ${item.deposit > 0 ? `
                                        <span class="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded inline-block">
                                            ${item.deposit.toLocaleString('hu-HU')} Ft
                                        </span>
                                    ` : `
                                        <span class="text-[10px] font-semibold text-emerald-700">0 Ft</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MŰVELETI GOMBOK A KÁRTYA ALJÁN -->
                    <div class="p-2.5 pt-1.5 border-t border-slate-100 space-y-1.5 bg-slate-50/50">
                        <button onclick="openBoostModal(${item.id})" class="w-full py-1.5 px-2 ${
                            item.is_featured 
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm'
                        } rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1">
                            <i class="fa-solid fa-bolt ${item.is_featured ? 'text-amber-600' : 'text-yellow-200'} text-[10px]"></i>
                            <span>${item.is_featured ? 'Kiemelés Hosszabbítása' : 'Kiemelés (390 Ft)'}</span>
                        </button>

                        <div class="grid grid-cols-2 gap-1.5">
                            <button onclick="openEditItemModal(${item.id})" class="py-1.5 px-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                                <i class="fa-solid fa-pen-to-square text-[10px]"></i> Módosítás
                            </button>
                            <button onclick="deleteItem(${item.id})" class="py-1.5 px-1 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-bold transition-colors flex items-center justify-center gap-1">
                                <i class="fa-solid fa-trash text-[10px]"></i> Törlés
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderIncomingRentals(rentals) {
    if (!rentals || rentals.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                <div class="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    <i class="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-900 text-base mb-1">Nincs aktív kezelendő bérlési kérelem az eszközeidre</h4>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto">Minden korábbi bérbeadásod sikeresen lezárult és értékelve van a <strong>"Lezárt & Értékelt Bérlések"</strong> fülön.</p>
                </div>
                <div class="pt-2">
                    <button onclick="openNewItemModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all">
                        + Új eszköz meghirdetése
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h4 class="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                        Aktív & Folyamatban Lévő Kiadásaim (${rentals.length} db)
                    </h4>
                </div>
                <span class="text-xs font-bold text-slate-500">Jóváhagyásra, átadásra vagy értékelésre váró kérelmek</span>
            </div>

            <div class="space-y-4">
                ${rentals.map(r => renderSingleRentalCard(r, 'owner', false)).join('')}
            </div>
        </div>
    `;
}

function renderOutgoingRentals(rentals) {
    if (!rentals || rentals.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                <div class="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-900 text-base mb-1">Nincs aktív folyamatban lévő kölcsönzésed</h4>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto">Böngéssz a környékeden elérhető kerti szerszámok, gépek és garázsok között!</p>
                </div>
                <div class="pt-2">
                    <button onclick="switchTab('browse')" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all">
                        Eszközök böngészése
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                    <h4 class="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                        Folyamatban Lévő Kölcsönzéseim (${rentals.length} db)
                    </h4>
                </div>
                <span class="text-xs font-bold text-slate-500">Aktív és értékelésre váró foglalások</span>
            </div>

            <div class="space-y-4">
                ${rentals.map(r => renderSingleRentalCard(r, 'renter', false)).join('')}
            </div>
        </div>
    `;
}

function renderClosedRentals(rentals) {
    if (!rentals || rentals.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                <div class="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl shadow-inner">
                    <i class="fa-solid fa-box-archive"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-900 text-base mb-1">Még nincs lezárt és értékelt bérlésed az archívumban</h4>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto">Amikor egy bérbeadásod vagy kölcsönzésed lezárul és a partner értékelése is megtörténik, a bérlés automatikusan átkerül ide erre a fülre.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                        <i class="fa-solid fa-box-archive"></i>
                    </div>
                    <h4 class="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                        Teljesen Lezárt & Értékelt Bérlések Archívuma (${rentals.length} db)
                    </h4>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-extrabold text-[11px] border border-emerald-200">
                    Sikeresen lezárt előzmények
                </span>
            </div>

            <div class="space-y-4">
                ${rentals.map(r => renderSingleRentalCard(r, r._role || (r.owner_id === state.currentUser?.id ? 'owner' : 'renter'), true)).join('')}
            </div>
        </div>
    `;
}

function renderSingleRentalCard(r, role, isClosed = false) {
    const isOwner = role === 'owner';
    const itemImg = r.item_image || 'static/logo.png';
    const itemTitle = r.item_title || 'Eszköz';
    const startDate = r.start_date || '-';
    const endDate = r.end_date || r.start_date || 'rugalmas';
    const unitsCount = r.units_count || 1;
    const unitText = r.item_price_unit || r.price_unit || 'nap';
    const totalPrice = (Number(r.total_price) || 0).toLocaleString('hu-HU');
    const depositPrice = (Number(r.deposit) || 0).toLocaleString('hu-HU');

    const partnerId = isOwner ? (r.renter_id || 1) : (r.owner_id || 1);
    const partnerName = isOwner ? (r.renter_name || 'Bérlő') : (r.owner_name || 'Bérbeadó');
    const partnerAvatar = getUserAvatar(partnerName, isOwner ? r.renter_avatar : r.owner_avatar);
    const partnerPhone = isOwner ? (r.renter_phone || '') : (r.owner_phone || '');
    const partnerCity = isOwner ? (r.renter_city || 'Magyarország') : (r.owner_city || r.item_location || 'Magyarország');
    const partnerRating = isOwner ? (r.renter_rating || 5.0) : (r.owner_rating || 5.0);
    const partnerReviewsCount = isOwner ? (r.renter_reviews_count || 0) : (r.owner_reviews_count || 0);

    const userReview = (r.reviews || []).find(rev => rev.reviewer_id === state.currentUser?.id);

    return `
    <div class="${
        isClosed 
        ? 'bg-slate-50/70 border-slate-200/90 hover:bg-white hover:border-emerald-300' 
        : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-md'
    } rounded-3xl p-5 sm:p-6 border shadow-sm transition-all flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
        
        <!-- 1. Bal oldal: Eszköz és Partner adatok -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0">
            <!-- Eszköz Kép -->
            <div class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 cursor-pointer group" onclick="openItemModal(${r.item_id})" title="Eszköz adatlapjának megtekintése">
                <img src="${itemImg}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200">
                <span class="absolute top-1 left-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                    #${r.item_id}
                </span>
            </div>

            <!-- Részletek -->
            <div class="space-y-2.5 flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                    <h4 class="font-extrabold text-slate-900 text-sm sm:text-base hover:text-emerald-700 cursor-pointer truncate" onclick="openItemModal(${r.item_id})">
                        ${itemTitle}
                    </h4>
                    ${isClosed ? `
                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-200 inline-flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-emerald-600"></i> Teljesen Lezárva & Értékelve
                        </span>
                    ` : getStatusBadge(r.status)}
                </div>

                <!-- 👤 KIEMELT PARTNER PROFIL BLOKK -->
                <div class="p-3 ${isClosed ? 'bg-white/80' : isOwner ? 'bg-gradient-to-r from-emerald-50/70 to-slate-50' : 'bg-gradient-to-r from-slate-50 to-emerald-50/40'} rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 cursor-pointer group" onclick="openUserProfileModal(${partnerId})" title="Kattints ${partnerName} adatlapjának megtekintéséhez">
                        <div class="relative">
                            <img src="${partnerAvatar}" class="w-10 h-10 rounded-full object-cover ring-2 ${isOwner ? 'ring-emerald-500' : 'ring-slate-300'} shadow-sm group-hover:scale-105 transition-transform">
                            <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[8px] shadow">
                                <i class="fa-solid ${isOwner ? 'fa-check' : 'fa-handshake'}"></i>
                            </span>
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-black text-slate-900 group-hover:text-emerald-700 underline-offset-2 group-hover:underline">
                                    ${partnerName}
                                </span>
                                <span class="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[9px] font-bold rounded">
                                    ${isOwner ? 'Bérlő' : 'Bérbeadó'} ID: #${partnerId}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span><i class="fa-solid fa-location-dot text-emerald-600"></i> ${partnerCity}</span>
                                <span>•</span>
                                <span class="text-amber-600 font-bold"><i class="fa-solid fa-star"></i> ${partnerRating} (${partnerReviewsCount})</span>
                            </div>
                        </div>
                    </div>

                    <!-- Partnerrel kapcsolatos gyorsgombok -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="openUserProfileModal(${partnerId})" class="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-slate-800 font-bold text-[11px] rounded-xl border border-slate-200 shadow-xs transition-colors flex items-center gap-1" title="Profil és vélemények">
                            <i class="fa-solid fa-id-card text-emerald-600"></i>
                            <span>Adatlap</span>
                        </button>
                        <button onclick="openChatWithUser(${partnerId})" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition-colors flex items-center gap-1" title="Belső üzenetküldés">
                            <i class="fa-solid fa-comments"></i>
                            <span>Üzenet</span>
                        </button>
                        ${partnerPhone ? `
                            <a href="tel:${partnerPhone}" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-xl border border-slate-200 transition-colors flex items-center gap-1" title="Közvetlen hívás">
                                <i class="fa-solid fa-phone text-emerald-600"></i>
                                <span>${partnerPhone}</span>
                            </a>
                        ` : ''}
                    </div>
                </div>

                <!-- Foglalási időszak, megjegyzés és leadott értékelés -->
                <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span class="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200 inline-flex items-center gap-1.5">
                        <i class="fa-regular fa-calendar-days text-emerald-600"></i>
                        <span>${startDate} – ${endDate}</span>
                    </span>
                    <span class="px-2 py-1 bg-emerald-50 text-emerald-800 font-extrabold rounded-lg border border-emerald-200">
                        ${unitsCount} ${unitText}
                    </span>
                    ${userReview ? `
                        <span class="px-2.5 py-1 bg-amber-50 text-amber-900 font-black rounded-lg border border-amber-200/80 inline-flex items-center gap-1">
                            <i class="fa-solid fa-star text-amber-500 text-[10px]"></i> Leadott értékelésed: ${userReview.rating || 5}/5 ⭐
                        </span>
                    ` : ''}
                </div>

                ${r.note ? `
                    <div class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-1.5 italic">
                        <i class="fa-solid fa-quote-left text-slate-400 mt-0.5 text-[10px]"></i>
                        <span>${escapeHtml(r.note)}</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- 2. Jobb oldal: Összeg és Műveleti gombok -->
        <div class="flex flex-col lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 shrink-0 gap-3">
            <div class="lg:text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ${isOwner ? 'Bevétel (Kereset)' : 'Fizetve átvételkor'}
                </span>
                <div class="text-base sm:text-lg font-black ${isOwner ? 'text-emerald-700' : 'text-slate-900'}">
                    ${totalPrice} Ft
                </div>
                <div class="text-[11px] text-slate-500 font-medium">
                    ${depositPrice !== '0' ? `+ ${depositPrice} Ft kaució (visszajár)` : '0 Ft kaució'}
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                ${isClosed ? `
                    <span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                        <i class="fa-solid fa-circle-check text-emerald-600"></i> Lezárt és értékelt
                    </span>
                ` : isOwner ? getActionButtonsForOwner(r) : getActionButtonsForRenter(r)}
            </div>
        </div>

    </div>
    `;
}

function getActionButtonsForRenter(r) {
    const hasReviewed = (r.reviews || []).some(rev => rev.reviewer_id === state.currentUser?.id);
    const safeTitle = (r.item_title || 'Eszköz').replace(/'/g, "\\'");
    const itemId = r.item_id || 0;

    if (r.status === 'completed') {
        if (hasReviewed) {
            return `<span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelve</span>`;
        }
        return `
            <button onclick="openReviewModal(${r.id}, ${itemId}, '${safeTitle}', 'Bérbeadó', 'completed')" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
                <i class="fa-solid fa-star"></i> Bérbeadó értékelése
            </button>
        `;
    } else if (r.status === 'cancelled_no_show' || r.status === 'cancelled') {
        if (hasReviewed) {
            return `<span class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelve</span>`;
        }
        return `
            <button onclick="openReviewModal(${r.id}, ${itemId}, '${safeTitle}', 'Bérbeadó', '${r.status}')" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
                <i class="fa-solid fa-star"></i> Bérbeadó értékelése
            </button>
        `;
    } else if (r.status === 'accepted') {
        return `
            <button onclick="updateRentalStatus(${r.id}, 'cancelled_no_show')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors" title="Ha a bérbeadó nem jött el a megbeszélt helyszínre">
                <i class="fa-solid fa-user-slash mr-1"></i> Bérbeadó nem jelent meg
            </button>
        `;
    } else if (r.status === 'pending') {
        return `
            <button onclick="updateRentalStatus(${r.id}, 'cancelled')" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                Kérelem visszavonása
            </button>
        `;
    }
    return '';
}

function getStatusBadge(status) {
    switch(status) {
        case 'pending':
            return `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]"><i class="fa-solid fa-clock"></i> Jóváhagyásra vár</span>`;
        case 'accepted':
            return `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]"><i class="fa-solid fa-check"></i> Elfogadva (Átvehető)</span>`;
        case 'active':
            return `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]"><i class="fa-solid fa-handshake"></i> Folyamatban lévő bérlés</span>`;
        case 'completed':
            return `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]"><i class="fa-solid fa-circle-check text-emerald-600"></i> Lezárva (Sikeres átadás)</span>`;
        case 'cancelled_no_show':
            return `<span class="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] border border-rose-200"><i class="fa-solid fa-user-slash text-rose-600"></i> Lemondva (Nem jött el érte)</span>`;
        case 'cancelled':
            return `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]"><i class="fa-solid fa-xmark"></i> Lemondva</span>`;
        default:
            return `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">${status || 'Ismeretlen'}</span>`;
    }
}

function getActionButtonsForOwner(rental) {
    const hasReviewed = (rental.reviews || []).some(rev => rev.reviewer_id === state.currentUser?.id);
    const safeTitle = (rental.item_title || 'Eszköz').replace(/'/g, "\\'");
    const itemId = rental.item_id || 0;

    if (rental.status === 'pending') {
        return `
            <button onclick="updateRentalStatus(${rental.id}, 'accepted')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                <i class="fa-solid fa-check mr-1"></i> Elfogadás
            </button>
            <button onclick="updateRentalStatus(${rental.id}, 'cancelled')" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                Elutasítás
            </button>
            <button onclick="printRentalContract(${rental.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                <i class="fa-solid fa-print"></i> Nyomtatvány
            </button>
        `;
    } else if (rental.status === 'accepted') {
        return `
            <button onclick="updateRentalStatus(${rental.id}, 'active')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                <i class="fa-solid fa-key mr-1"></i> Átadva a bérlőnek
            </button>
            <button onclick="updateRentalStatus(${rental.id}, 'cancelled_no_show')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors" title="Ha a bérlő nem jött el az eszközért">
                <i class="fa-solid fa-user-slash mr-1"></i> Nem jött el érte
            </button>
            <button onclick="printRentalContract(${rental.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                <i class="fa-solid fa-print"></i> Nyomtatvány
            </button>
        `;
    } else if (rental.status === 'active') {
        return `
            <button onclick="updateRentalStatus(${rental.id}, 'completed')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center gap-1.5">
                <i class="fa-solid fa-circle-check"></i> Készre állítás (Visszahozva)
            </button>
            <button onclick="updateRentalStatus(${rental.id}, 'cancelled_no_show')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors" title="Megszakítás mert a bérlő nem hozta vissza vagy megszegte a feltételeket">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i> Nem hozta vissza
            </button>
            <button onclick="printRentalContract(${rental.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                <i class="fa-solid fa-print"></i> Nyomtatvány
            </button>
        `;
    } else if (rental.status === 'completed') {
        if (hasReviewed) {
            return `
                <span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Bérlő értékelve</span>
                <button onclick="printRentalContract(${rental.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                    <i class="fa-solid fa-print"></i> Nyomtatvány
                </button>
            `;
        }
        return `
            <button onclick="openReviewModal(${rental.id}, ${itemId}, '${safeTitle}', 'Bérlő', 'completed')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
                <i class="fa-solid fa-star"></i> Bérlő értékelése
            </button>
            <button onclick="printRentalContract(${rental.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1">
                <i class="fa-solid fa-print"></i> Nyomtatvány
            </button>
        `;
    } else if (rental.status === 'cancelled_no_show' || rental.status === 'cancelled') {
        if (hasReviewed) {
            return `<span class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelés rögzítve</span>`;
        }
        return `
            <button onclick="openReviewModal(${rental.id}, ${itemId}, '${safeTitle}', 'Bérlő', '${rental.status}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
                <i class="fa-solid fa-star"></i> Bérlő értékelése
            </button>
        `;
    }
    return `<span class="text-xs text-slate-400 font-medium italic">Nincs további teendő</span>`;
}

async function updateRentalStatus(rentalId, newStatus) {
    try {
        const res = await fetch(`/api/rentals/${rentalId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Hiba a státusz frissítésekor');
        
        if (newStatus === 'completed') {
            showToast('🎉 Bérlés sikeresen lezárva! Most már értékelhetitek egymást a partnerrel.', 'success');
        } else if (newStatus === 'cancelled_no_show' || newStatus === 'cancelled') {
            showToast('⚠️ Bérlés lemondva! Most már értékelhetitek egymást a partnerrel.', 'info');
        } else {
            showToast('Státusz sikeresen frissítve!', 'success');
        }

        await refreshCurrentUser();
        await loadDashboardData();
    } catch (err) {
        showToast('Nem sikerült frissíteni a státuszt', 'error');
    }
}

// --- ÉRTÉKELÉS MODAL ---

let currentReviewData = null;
let selectedRating = 5;

function openReviewModal(rentalId, itemId, itemTitle, targetRole = 'Partner', statusContext = 'completed') {
    currentReviewData = { rentalId, itemId, itemTitle, targetRole, statusContext };
    
    const titleEl = document.getElementById('review-modal-title');
    const headingEl = document.getElementById('review-modal-heading');
    const badgeEl = document.getElementById('review-modal-badge');
    const commentEl = document.getElementById('review-comment');
    const submitBtn = document.getElementById('review-submit-btn');
    const starsLabel = document.getElementById('review-stars-label');

    if (titleEl) titleEl.textContent = `${itemTitle} • ${targetRole} értékelése`;
    if (headingEl) headingEl.textContent = `${targetRole} értékelése`;
    if (commentEl) {
        commentEl.value = '';
        commentEl.placeholder = 'Írd le a tapasztalataidat (kommunikáció, pontosság, megbízhatóság, eszköz állapota)...';
    }

    if (badgeEl) {
        if (statusContext === 'cancelled_no_show' || statusContext === 'cancelled') {
            badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200';
            badgeEl.textContent = 'Lemondott Bérlés';
        } else {
            badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200';
            badgeEl.textContent = 'Sikeres Bérlés';
        }
    }

    if (starsLabel) starsLabel.textContent = 'Hány csillagot adsz a partnerre és az együttműködésre?';
    if (submitBtn) {
        submitBtn.className = 'px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all';
        submitBtn.textContent = 'Értékelés Beküldése';
    }
    setRatingStars(5);

    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'flex';
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
    currentReviewData = null;
}

function setRatingStars(rating) {
    selectedRating = Math.max(1, Math.min(5, rating));
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((s, idx) => {
        if (idx < selectedRating) {
            s.classList.add('text-amber-400');
            s.classList.remove('text-slate-300');
        } else {
            s.classList.remove('text-amber-400');
            s.classList.add('text-slate-300');
        }
        s.classList.remove('opacity-30', 'cursor-not-allowed');
    });
}

async function submitReview(e) {
    e.preventDefault();
    if (!currentReviewData || !state.currentUser) return;

    const comment = document.getElementById('review-comment').value;

    const payload = {
        rental_id: currentReviewData.rentalId,
        item_id: currentReviewData.itemId,
        reviewer_id: state.currentUser.id,
        rating: selectedRating,
        comment: comment
    };

    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            let errorMsg = 'Hiba az értékelés mentésekor';
            try {
                const errData = await res.json();
                if (errData.detail) errorMsg = errData.detail;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        closeReviewModal();
        showToast('⭐ Értékelés sikeresen rögzítve a felhasználó profiljához!', 'success');
        await loadDashboardData();
        await loadItems();
    } catch (err) {
        showToast(err.message || 'Nem sikerült elküldeni az értékelést', 'error');
    }
}

// --- TABOK ÉS SZŰRŐK KEZELÉSE ---

function switchTab(tab) {
    state.activeTab = tab;
    const browseView = document.getElementById('browse-view');
    const dashboardView = document.getElementById('dashboard-view');
    const adminView = document.getElementById('admin-view');
    const messagesView = document.getElementById('messages-view');
    const financesView = document.getElementById('finances-view');
    const achievementsView = document.getElementById('achievements-view');
    const authBox = document.getElementById('auth-logged-in');

    if (tab === 'browse') {
        if (browseView) browseView.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (financesView) financesView.classList.add('hidden');
        if (achievementsView) achievementsView.classList.add('hidden');
        if (authBox) {
            authBox.classList.remove('ring-2', 'ring-emerald-500', 'ring-purple-600', 'ring-amber-500', 'bg-emerald-50/50', 'bg-purple-50/50', 'bg-amber-50/50');
            authBox.classList.add('bg-slate-50');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'admin') {
        const isAdmin = state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.is_admin || state.currentUser.email === 'kulovanyi.kornel@gmail.com');
        if (!isAdmin) {
            showToast('Hozzáférés megtagadva! Nem vagy adminisztrátor.', 'error');
            return;
        }
        if (browseView) browseView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.remove('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (financesView) financesView.classList.add('hidden');
        if (achievementsView) achievementsView.classList.add('hidden');
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-purple-600', 'bg-purple-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-emerald-500', 'ring-amber-500');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadAdminData();
    } else if (tab === 'messages') {
        if (!state.currentUser) {
            showToast('Kérlek jelentkezz be az üzenetek megtekintéséhez!', 'info');
            openAuthModal('login');
            return;
        }
        if (browseView) browseView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.remove('hidden');
        if (financesView) financesView.classList.add('hidden');
        if (achievementsView) achievementsView.classList.add('hidden');
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-purple-600', 'ring-amber-500');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadMessagesData(state.messagesFolder || 'inbox');
    } else if (tab === 'finances') {
        if (!state.currentUser) {
            showToast('Kérlek jelentkezz be a pénzügyi összesítő megtekintéséhez!', 'info');
            openAuthModal('login');
            return;
        }
        if (browseView) browseView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (financesView) financesView.classList.remove('hidden');
        if (achievementsView) achievementsView.classList.add('hidden');
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-purple-600', 'ring-amber-500');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadFinancesData();
    } else if (tab === 'achievements') {
        if (!state.currentUser) {
            showToast('Kérlek jelentkezz be a sikerek és szintek megtekintéséhez!', 'info');
            openAuthModal('login');
            return;
        }
        if (browseView) browseView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (financesView) financesView.classList.add('hidden');
        if (achievementsView) achievementsView.classList.remove('hidden');
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-emerald-500', 'ring-purple-600');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadAchievementsData();
    } else {
        if (!state.currentUser) {
            showToast('Kérlek jelentkezz be az irányítópult megtekintéséhez!', 'info');
            openAuthModal('login');
            return;
        }
        if (browseView) browseView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.remove('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (financesView) financesView.classList.add('hidden');
        if (achievementsView) achievementsView.classList.add('hidden');
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-purple-600', 'ring-amber-500');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadDashboardData();
    }
}


async function loadAdminData() {
    if (!state.currentUser) return;
    const container = document.getElementById('admin-content');
    if (!container) return;

    container.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl text-purple-600 mb-2"></i><p>Adminisztrációs adatok betöltése...</p></div>`;

    try {
        const [overviewRes, itemsRes, usersRes] = await Promise.all([
            fetch(`/api/admin/overview?user_id=${state.currentUser.id}`),
            fetch('/api/items'),
            fetch('/api/users')
        ]);

        if (!overviewRes.ok) {
            const err = await overviewRes.json();
            throw new Error(err.detail || 'Hozzáférés megtagadva');
        }

        state.adminOverviewData = await overviewRes.json();
        const rawItems = itemsRes.ok ? await itemsRes.json() : [];
        state.adminAllItems = Array.isArray(rawItems) ? rawItems : (rawItems.items || []);

        const rawUsers = usersRes.ok ? await usersRes.json() : [];
        state.adminAllUsers = Array.isArray(rawUsers) ? rawUsers : [];

        // Frissítjük a fülek számláló jelvényeit
        const itemsBadge = document.getElementById('admin-items-count-badge');
        if (itemsBadge) itemsBadge.textContent = state.adminAllItems.length;

        const usersBadge = document.getElementById('admin-users-count-badge');
        if (usersBadge) usersBadge.textContent = state.adminAllUsers.length;

        renderAdminSubTabContent();
    } catch (err) {
        container.innerHTML = `
            <div class="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center text-rose-700">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <h4 class="font-bold text-sm mb-1">Nem sikerült betölteni az adminisztrációs felületet</h4>
                <p class="text-xs">${err.message}</p>
            </div>
        `;
    }
}

function switchAdminSubTab(subTab) {
    state.adminSubTab = subTab;

    const btnItems = document.getElementById('admin-tab-btn-items');
    const btnStats = document.getElementById('admin-tab-btn-stats');
    const btnUsers = document.getElementById('admin-tab-btn-users');

    const activeClass = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap bg-purple-600 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5';
    const inactiveClass = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5';

    if (btnItems) btnItems.className = subTab === 'items' ? activeClass : inactiveClass;
    if (btnStats) btnStats.className = subTab === 'stats' ? activeClass : inactiveClass;
    if (btnUsers) btnUsers.className = subTab === 'users' ? activeClass : inactiveClass;

    renderAdminSubTabContent();
}

function renderAdminSubTabContent() {
    const container = document.getElementById('admin-content');
    if (!container) return;

    if (state.adminSubTab === 'items') {
        renderAdminItemsView(container);
    } else if (state.adminSubTab === 'users') {
        renderAdminUsersView(container);
    } else {
        renderAdminStatsView(container);
    }
}

// --- 1. ADMIN: MINDEN HIRDETÉS KEZELÉSE ---

function setAdminItemSearch(query) {
    state.adminItemSearch = query || '';
    const container = document.getElementById('admin-items-table-container');
    const countEl = document.getElementById('admin-filtered-items-count');
    if (container) {
        const filtered = getFilteredAdminItems();
        if (countEl) countEl.textContent = `${filtered.length} találat`;
        container.innerHTML = renderAdminItemsRows(filtered);
    }
}

function setAdminItemCategory(cat) {
    state.adminItemCategory = cat;
    setAdminItemSearch(state.adminItemSearch);
}

function setAdminItemStatus(status) {
    state.adminItemStatus = status;
    setAdminItemSearch(state.adminItemSearch);
}

function resetAdminItemFilters() {
    state.adminItemSearch = '';
    state.adminItemCategory = 'Mind';
    state.adminItemStatus = 'Mind';

    const sInput = document.getElementById('admin-item-search-input');
    const cSelect = document.getElementById('admin-item-category-select');
    const stSelect = document.getElementById('admin-item-status-select');

    if (sInput) sInput.value = '';
    if (cSelect) cSelect.value = 'Mind';
    if (stSelect) stSelect.value = 'Mind';

    setAdminItemSearch('');
}

function getFilteredAdminItems() {
    let items = [...(state.adminAllItems || [])];
    const q = (state.adminItemSearch || '').trim().toLowerCase();
    const cleanQ = q.replace(/^#/, '');

    if (q) {
        items = items.filter(item => {
            const itemIdStr = String(item.id || '');
            const userIdStr = String(item.user_id || item.owner_id || '');
            const title = (item.title || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            const ownerName = (item.owner_name || '').toLowerCase();
            const ownerEmail = (item.owner_email || '').toLowerCase();
            const ownerPhone = (item.owner_phone || '').toLowerCase();
            const location = (item.location || '').toLowerCase();
            const category = (item.category || '').toLowerCase();

            return itemIdStr === cleanQ ||
                   userIdStr === cleanQ ||
                   itemIdStr.includes(cleanQ) ||
                   userIdStr.includes(cleanQ) ||
                   title.includes(q) ||
                   desc.includes(q) ||
                   ownerName.includes(q) ||
                   ownerEmail.includes(q) ||
                   ownerPhone.includes(q) ||
                   location.includes(q) ||
                   category.includes(q);
        });
    }

    if (state.adminItemCategory && state.adminItemCategory !== 'Mind') {
        items = items.filter(item => item.category === state.adminItemCategory);
    }

    if (state.adminItemStatus && state.adminItemStatus !== 'Mind') {
        if (state.adminItemStatus === 'featured') {
            items = items.filter(item => item.is_featured);
        } else if (state.adminItemStatus === 'normal') {
            items = items.filter(item => !item.is_featured);
        }
    }

    return items;
}

function renderAdminItemsView(container) {
    const filtered = getFilteredAdminItems();

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Kereső és szűrősáv -->
            <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <h3 class="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                            <i class="fa-solid fa-toolbox text-purple-600"></i> Minden Hirdetés Kezelése & Szerkesztése
                        </h3>
                        <p class="text-xs text-slate-500">Keresd meg bármelyik felhasználó hirdetését ID, név, e-mail vagy termék alapján, és módosíts benne közvetlenül!</p>
                    </div>
                    <span id="admin-filtered-items-count" class="px-3 py-1 bg-purple-50 text-purple-800 text-xs font-black rounded-xl border border-purple-200">
                        ${filtered.length} találat
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2">
                    <!-- Fő Kereső (ID, Felhasználó ID, Cím, Név) -->
                    <div class="lg:col-span-6 relative">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-sm"></i>
                        <input type="text" id="admin-item-search-input" value="${state.adminItemSearch}" oninput="setAdminItemSearch(this.value)" placeholder="Keresés: Hirdetés ID (#12), Felhasználó ID (#5), Bérbeadó név, E-mail, Termék neve..." class="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none">
                    </div>

                    <!-- Kategória szűrő -->
                    <div class="lg:col-span-3">
                        <select id="admin-item-category-select" onchange="setAdminItemCategory(this.value)" class="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
                            ${state.categories.map(c => `<option value="${c}" ${state.adminItemCategory === c ? 'selected' : ''}>${c === 'Mind' ? '📂 Minden Kategória' : c}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Kiemelés státusz szűrő -->
                    <div class="lg:col-span-2">
                        <select id="admin-item-status-select" onchange="setAdminItemStatus(this.value)" class="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
                            <option value="Mind" ${state.adminItemStatus === 'Mind' ? 'selected' : ''}>⚡ Mind (Kiemelt/Normál)</option>
                            <option value="featured" ${state.adminItemStatus === 'featured' ? 'selected' : ''}>⚡ Csak Kiemelt</option>
                            <option value="normal" ${state.adminItemStatus === 'normal' ? 'selected' : ''}>📦 Csak Normál</option>
                        </select>
                    </div>

                    <!-- Szűrők törlése -->
                    <div class="lg:col-span-1 flex items-center">
                        <button onclick="resetAdminItemFilters()" class="w-full py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1" title="Szűrők alaphelyzetbe állítása">
                            <i class="fa-solid fa-arrows-rotate"></i>
                            <span class="lg:hidden">Törlés</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Hirdetések táblázat konténer -->
            <div id="admin-items-table-container" class="space-y-3">
                ${renderAdminItemsRows(filtered)}
            </div>
        </div>
    `;
}

function renderAdminItemsRows(items) {
    if (!items || items.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <div class="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-search"></i>
                </div>
                <h4 class="font-extrabold text-slate-800 text-base">Nem található hirdetés a megadott feltételekkel</h4>
                <p class="text-xs text-slate-500">Próbálj meg más azonosítóra, névre vagy e-mail címre keresni!</p>
                <button onclick="resetAdminItemFilters()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-colors">
                    Szűrők törlése
                </button>
            </div>
        `;
    }

    return `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                            <th class="py-3 px-4">Hirdetés & ID</th>
                            <th class="py-3 px-4">Bérbeadó (Tulajdonos)</th>
                            <th class="py-3 px-4">Kategória & Hely</th>
                            <th class="py-3 px-4">Bérleti Díj / Kaució</th>
                            <th class="py-3 px-4">Kiemelés</th>
                            <th class="py-3 px-4 text-right">Admin Műveletek</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
                        ${items.map(item => {
                            const imgUrl = item.image_url || 'static/logo.png';
                            const ownerName = item.owner_name || 'Bérbeadó';
                            const ownerEmail = item.owner_email || '';
                            const ownerPhone = item.owner_phone || '';
                            const price = Number(item.price) || 0;
                            const deposit = Number(item.deposit) || 0;
                            const priceUnit = item.price_unit || 'nap';
                            const isFeatured = !!item.is_featured;

                            return `
                                <tr class="hover:bg-slate-50/80 transition-colors">
                                    <!-- Hirdetés & ID -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-3">
                                            <div class="relative w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                                <img src="${imgUrl}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover">
                                            </div>
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-1.5 mb-0.5">
                                                    <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono font-black text-[11px] border border-purple-200" title="Hirdetés egyedi azonosítója">
                                                        #${item.id}
                                                    </span>
                                                    ${isFeatured ? '<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-black"><i class="fa-solid fa-bolt text-amber-500"></i> Kiemelt</span>' : ''}
                                                </div>
                                                <h4 class="font-extrabold text-slate-900 text-xs sm:text-sm truncate max-w-[200px]" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
                                                <p class="text-[11px] text-slate-400 line-clamp-1">${escapeHtml(item.description || '')}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Bérbeadó adatai -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5">
                                            <div class="flex items-center gap-1.5">
                                                <span class="font-bold text-slate-900">${escapeHtml(ownerName)}</span>
                                                <button onclick="filterAdminItemsByUserId(${item.user_id})" class="px-1.5 py-0.2 rounded bg-slate-100 hover:bg-purple-100 text-purple-700 font-mono text-[10px] font-extrabold border border-slate-200 transition-colors" title="Szűrés ennek a felhasználónak a hirdetéseire">
                                                    User ID: #${item.user_id}
                                                </button>
                                            </div>
                                            <p class="text-[11px] text-slate-500">${escapeHtml(ownerEmail)}</p>
                                            ${ownerPhone ? `<p class="text-[10px] text-emerald-600 font-semibold"><i class="fa-solid fa-phone text-[9px]"></i> ${escapeHtml(ownerPhone)}</p>` : ''}
                                        </div>
                                    </td>

                                    <!-- Kategória & Hely -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5">
                                            <span class="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                                                ${getCategoryIcon(item.category)} ${item.category}
                                            </span>
                                            <p class="text-[11px] text-slate-500 flex items-center gap-1">
                                                <i class="fa-solid fa-location-dot text-slate-400"></i> ${escapeHtml(item.location || '')}
                                            </p>
                                        </div>
                                    </td>

                                    <!-- Bérleti díj & Kaució -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5">
                                            <div class="font-black text-emerald-700 text-xs">
                                                ${price.toLocaleString('hu-HU')} Ft <span class="text-[10px] text-slate-500 font-bold">/${priceUnit}</span>
                                            </div>
                                            <div class="text-[10px] text-amber-700 font-semibold">
                                                Kaució: ${deposit > 0 ? deposit.toLocaleString('hu-HU') + ' Ft' : '0 Ft'}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Kiemelés kapcsoló -->
                                    <td class="py-3.5 px-4">
                                        <button onclick="adminToggleBoost(${item.id})" class="px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                            isFeatured 
                                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                                            : 'bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 border border-slate-200'
                                        }" title="${isFeatured ? 'Kiemelés kikapcsolása' : 'Kiemelés bekapcsolása (VIP lista élére)'}">
                                            <i class="fa-solid fa-bolt ${isFeatured ? 'text-amber-600' : 'text-slate-400'}"></i>
                                            <span>${isFeatured ? 'Kiemelve' : 'Normál'}</span>
                                        </button>
                                    </td>

                                    <!-- Admin Műveletek -->
                                    <td class="py-3.5 px-4 text-right">
                                        <div class="flex items-center justify-end gap-1.5">
                                            <!-- Módosítás / Szerkesztés -->
                                            <button onclick="openEditItemModal(${item.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1" title="Hirdetés adatainak módosítása egyéni kérésre">
                                                <i class="fa-solid fa-pen-to-square"></i>
                                                <span class="hidden sm:inline">Szerkesztés</span>
                                            </button>

                                            <!-- Megtekintés -->
                                            <button onclick="openItemModal(${item.id})" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors" title="Adatlap megtekintése">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>

                                            <!-- Törlés -->
                                            <button onclick="adminDeleteItem(${item.id})" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors" title="Hirdetés törlése">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function adminToggleBoost(itemId) {
    if (!state.currentUser) return;
    const item = state.adminAllItems.find(i => Number(i.id) === Number(itemId));
    if (!item) return;

    const isCurrentlyFeatured = !!item.is_featured;
    const newFeaturedUntil = isCurrentlyFeatured ? null : '2099-12-31 23:59:59';

    try {
        const res = await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.currentUser.id,
                featured_until: newFeaturedUntil
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a kiemelés módosításakor');
        }

        showToast(isCurrentlyFeatured ? '⚡ Kiemelés kikapcsolva!' : '⚡ Kiemelés sikeresen aktiválva a hirdetésre!', 'success');
        await loadAdminData();
        await loadItems();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function adminDeleteItem(itemId) {
    if (!state.currentUser) return;
    const confirmed = confirm(`Adminisztrátorként biztosan törölni szeretnéd a #${itemId} számú hirdetést? Ezzel felszabadul a felhasználó hirdetési kerete.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/items/${itemId}?user_id=${state.currentUser.id}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a törléskor');
        }

        const data = await res.json();
        showToast(data.message || 'Hirdetés sikeresen törölve!', 'success');
        await loadAdminData();
        await loadItems();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function filterAdminItemsByUserId(userId) {
    state.adminItemSearch = `#${userId}`;
    switchAdminSubTab('items');
    const input = document.getElementById('admin-item-search-input');
    if (input) input.value = `#${userId}`;
    setAdminItemSearch(`#${userId}`);
}


// --- 2. ADMIN: REGISZTRÁLT FELHASZNÁLÓK ---

function setAdminUserSearch(query) {
    state.adminUserSearch = query || '';
    const container = document.getElementById('admin-users-table-container');
    const countEl = document.getElementById('admin-filtered-users-count');
    if (container) {
        const filtered = getFilteredAdminUsers();
        if (countEl) countEl.textContent = `${filtered.length} regisztrált felhasználó`;
        container.innerHTML = renderAdminUsersRows(filtered);
    }
}

function getFilteredAdminUsers() {
    let users = [...(state.adminAllUsers || [])];
    const q = (state.adminUserSearch || '').trim().toLowerCase();
    const cleanQ = q.replace(/^#/, '');

    if (q) {
        users = users.filter(u => {
            const uIdStr = String(u.id || '');
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const phone = (u.phone || '').toLowerCase();
            const city = (u.city || '').toLowerCase();
            const plan = (u.subscription_plan || '').toLowerCase();

            return uIdStr === cleanQ ||
                   uIdStr.includes(cleanQ) ||
                   name.includes(q) ||
                   email.includes(q) ||
                   phone.includes(q) ||
                   city.includes(q) ||
                   plan.includes(q);
        });
    }

    return users;
}

function renderAdminUsersView(container) {
    const filtered = getFilteredAdminUsers();

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Keresősáv -->
            <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <h3 class="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                            <i class="fa-solid fa-users text-purple-600"></i> Regisztrált Felhasználók Listája
                        </h3>
                        <p class="text-xs text-slate-500">Minden felhasználó egyedi ID azonosítója, elérhetőségei, előfizetési csomagja és hirdetései</p>
                    </div>
                    <span id="admin-filtered-users-count" class="px-3 py-1 bg-purple-50 text-purple-800 text-xs font-black rounded-xl border border-purple-200">
                        ${filtered.length} regisztrált felhasználó
                    </span>
                </div>

                <div class="relative pt-1">
                    <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-4.5 text-slate-400 text-sm"></i>
                    <input type="text" id="admin-user-search-input" value="${state.adminUserSearch}" oninput="setAdminUserSearch(this.value)" placeholder="Keresés Felhasználó ID (#5), Név, E-mail, Telefonszám vagy Település alapján..." class="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none">
                </div>
            </div>

            <!-- Felhasználók táblázat konténer -->
            <div id="admin-users-table-container" class="space-y-3">
                ${renderAdminUsersRows(filtered)}
            </div>
        </div>
    `;
}

function renderAdminUsersRows(users) {
    if (!users || users.length === 0) {
        return `
            <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <div class="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-user-slash"></i>
                </div>
                <h4 class="font-extrabold text-slate-800 text-base">Nem található felhasználó</h4>
                <p class="text-xs text-slate-500">Módosítsd a keresési feltételt!</p>
            </div>
        `;
    }

    return `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                            <th class="py-3 px-4">Felhasználó & ID</th>
                            <th class="py-3 px-4">Elérhetőség</th>
                            <th class="py-3 px-4">Település</th>
                            <th class="py-3 px-4">Előfizetési Csomag</th>
                            <th class="py-3 px-4">Hirdetések</th>
                            <th class="py-3 px-4">Regisztrált</th>
                            <th class="py-3 px-4 text-right">Művelet</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
                        ${users.map(u => {
                            const avatar = getUserAvatar(u);
                            const planId = u.subscription_plan || 'free';
                            const planName = planId === 'starter_3' ? 'Kertbarát (3)' : planId === 'pro_10' ? 'Ezermester (10)' : planId === 'unlimited' ? 'Profi (Végtelen)' : 'Ingyenes (1)';
                            const planBadgeClass = planId === 'unlimited' ? 'bg-amber-100 text-amber-900 border-amber-200' : planId === 'pro_10' ? 'bg-blue-100 text-blue-900 border-blue-200' : planId === 'starter_3' ? 'bg-emerald-100 text-emerald-900 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200';
                            const isAdmin = u.role === 'admin' || u.is_admin || u.email === 'kulovanyi.kornel@gmail.com';

                            return `
                                <tr class="hover:bg-slate-50/80 transition-colors">
                                    <!-- Felhasználó & ID -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-3">
                                            <img src="${avatar}" class="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/20 shrink-0">
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-1.5 mb-0.5">
                                                    <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono font-black text-[11px] border border-purple-200" title="Felhasználó egyedi azonosítója">
                                                        ID: #${u.id}
                                                    </span>
                                                    ${isAdmin ? '<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-black"><i class="fa-solid fa-crown text-amber-500"></i> Admin</span>' : ''}
                                                </div>
                                                <p class="font-extrabold text-slate-900 text-xs sm:text-sm truncate">${escapeHtml(u.name || '')}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Elérhetőség -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5">
                                            <p class="text-xs text-slate-700 font-bold">${escapeHtml(u.email || '')}</p>
                                            ${u.phone ? `<p class="text-[11px] text-emerald-600 font-semibold"><i class="fa-solid fa-phone text-[10px]"></i> ${escapeHtml(u.phone)}</p>` : '<span class="text-slate-400 text-[10px] italic">Nincs telefon megadva</span>'}
                                        </div>
                                    </td>

                                    <!-- Település -->
                                    <td class="py-3.5 px-4">
                                        <span class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                            <i class="fa-solid fa-location-dot text-slate-400"></i> ${escapeHtml(u.city || 'Budapest')}
                                        </span>
                                    </td>

                                    <!-- Csomag -->
                                    <td class="py-3.5 px-4">
                                        <span class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold border ${planBadgeClass} inline-block">
                                            ${planName}
                                        </span>
                                    </td>

                                    <!-- Hirdetések -->
                                    <td class="py-3.5 px-4">
                                        <span class="text-xs font-black text-slate-900">${u.active_items_count !== undefined ? u.active_items_count : 0} db</span>
                                        <span class="text-[10px] text-slate-400">/ ${u.max_items >= 9000 ? '∞' : (u.max_items || 1)}</span>
                                    </td>

                                    <!-- Regisztrált -->
                                    <td class="py-3.5 px-4 text-slate-500 text-[11px]">
                                        ${u.created_at ? u.created_at.split(' ')[0] : '-'}
                                    </td>

                                    <!-- Művelet -->
                                    <td class="py-3.5 px-4 text-right">
                                        <button onclick="filterAdminItemsByUserId(${u.id})" class="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm" title="Ugrás a hirdetésekhez és szűrés erre a felhasználóra">
                                            <i class="fa-solid fa-toolbox"></i>
                                            <span>Hirdetései (${u.active_items_count !== undefined ? u.active_items_count : 0})</span>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// --- 3. ADMIN: PÉNZÜGYI & RENDSZER STATISZTIKÁK ---

function renderAdminStatsView(container) {
    const data = state.adminOverviewData || {};
    const s = data.summary || {};
    const monthly = data.monthly_revenue || [];
    const plans = data.plans_distribution || {};
    const locations = data.locations_distribution || [];
    const categories = data.categories_distribution || {};
    const transactions = data.recent_transactions || [];

    const subRev = s.total_subscription_revenue_huf || 0;
    const boostRev = s.total_boost_revenue_huf || 0;
    const boostCount = s.total_boosts_sold || 0;

    container.innerHTML = `
        <!-- 1. FŐ KPI STATISZTIKAI KÁRTYÁK -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- 1. Kártya: Összes Előfizetési & Kiemelési Bevétel -->
            <div class="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-purple-200">Összes Stripe Bevétel</span>
                    <span class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm"><i class="fa-solid fa-wallet"></i></span>
                </div>
                <div class="text-2xl sm:text-3xl font-black mb-1">${(s.total_revenue_huf || 0).toLocaleString('hu-HU')} Ft</div>
                <div class="text-[11px] text-purple-200 flex flex-col gap-0.5 mt-1 font-medium">
                    <span>👑 Havi előfizetések: ${subRev.toLocaleString('hu-HU')} Ft</span>
                    <span>⚡ Kiemelések (Egyszeri): ${boostRev.toLocaleString('hu-HU')} Ft (${boostCount} db)</span>
                </div>
            </div>

            <!-- 2. Kártya: Fizető Előfizetők / Összes Felhasználó -->
            <div class="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Előfizetők & Partnerek</span>
                    <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm"><i class="fa-solid fa-users"></i></span>
                </div>
                <div class="text-2xl sm:text-3xl font-black text-slate-900 mb-1">${s.paying_subscribers || 0} <span class="text-xs font-semibold text-slate-400">/ ${s.total_users || 0} regisztrált</span></div>
                <p class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1"><i class="fa-solid fa-crown text-[10px]"></i> ${plans.starter_3 || 0} Kertbarát • ${plans.pro_10 || 0} Ezermester • ${plans.unlimited || 0} Profi</p>
            </div>

            <!-- 3. Kártya: Aktív Hirdetések -->
            <div class="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Feltöltött Eszközök</span>
                    <span class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm"><i class="fa-solid fa-toolbox"></i></span>
                </div>
                <div class="text-2xl sm:text-3xl font-black text-slate-900 mb-1">${s.total_items || 0} db</div>
                <p class="text-[11px] text-blue-600 font-semibold">Elérhető gép és szerszám az oldalon</p>
            </div>

            <!-- 4. Kártya: Bérlések és Lezárt tranzakciók -->
            <div class="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Bérlések & Foglalások</span>
                    <span class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm"><i class="fa-solid fa-handshake"></i></span>
                </div>
                <div class="text-2xl sm:text-3xl font-black text-slate-900 mb-1">${s.total_rentals || 0} db</div>
                <p class="text-[11px] text-amber-600 font-semibold">${s.completed_rentals || 0} lezárva • ${s.active_rentals || 0} folyamatban</p>
            </div>
        </div>

        <!-- 2. HAVI ELŐFIZETÉSEK & KIEMELÉSEK PÉNZÜGYI BONTÁSA (TÁBLÁZAT) -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-6">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                    <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
                        <i class="fa-solid fa-calendar-days text-purple-600"></i> Havi Előfizetési & Kiemelési Bontás
                    </h3>
                    <p class="text-xs text-slate-500">Havi ismétlődő előfizetések és egyszeri termékkiemelések bevételei</p>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                            <th class="py-3 px-3">Időszak (Hónap)</th>
                            <th class="py-3 px-3">Havi Előfizetések</th>
                            <th class="py-3 px-3">Egyszeri Kiemelések</th>
                            <th class="py-3 px-3">Kertbarát (1 490 Ft)</th>
                            <th class="py-3 px-3">Ezermester (3 990 Ft)</th>
                            <th class="py-3 px-3">Profi (7 990 Ft)</th>
                            <th class="py-3 px-3 text-right">Bruttó Havi Összbevétel</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
                        ${monthly.map(m => `
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-purple-600"></span>
                                    <span>${m.month}</span>
                                </td>
                                <td class="py-3 px-3">
                                    <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold">
                                        ${(m.subscription_amount || 0).toLocaleString('hu-HU')} Ft
                                    </span>
                                </td>
                                <td class="py-3 px-3">
                                    <span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold">
                                        ⚡ ${(m.boost_amount || 0).toLocaleString('hu-HU')} Ft (${m.boost_count || 0} db)
                                    </span>
                                </td>
                                <td class="py-3 px-3 text-slate-700">${m.starter_3_count || 0} db</td>
                                <td class="py-3 px-3 text-slate-700">${m.pro_10_count || 0} db</td>
                                <td class="py-3 px-3 text-slate-700">${m.unlimited_count || 0} db</td>
                                <td class="py-3 px-3 text-right font-black text-purple-700 text-sm">${(m.total_amount || 0).toLocaleString('hu-HU')} Ft</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 3. KÉT OSZLOP: TRANZAKCIÓK ÉS ÉRDEKESSÉGEK -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Bal: Legutóbbi Stripe Tranzakciók -->
            <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 class="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
                    <i class="fa-brands fa-stripe text-[#635BFF]"></i> Legfrissebb Kártyás Fizetések
                </h3>
                <p class="text-xs text-slate-500 mb-4">A Stripe-on keresztül beérkezett sikeres tranzakciók</p>

                ${transactions.length === 0 ? `
                    <div class="py-8 text-center text-xs text-slate-400 italic">Még nem érkezett bankkártyás fizetés a rendszerben.</div>
                ` : `
                    <div class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        ${transactions.map(t => {
                            const isBoost = t.type === 'boost' || t.payment_type === 'one_time' || (t.plan_id && t.plan_id.startsWith('boost_'));
                            return `
                                <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                                    <div>
                                        <div class="font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>${t.user_name || 'Felhasználó'}</span>
                                            <span class="text-slate-400 font-normal">(${t.user_email || ''})</span>
                                            ${isBoost ? '<span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">⚡ Egyszeri Kiemelés</span>' : '<span class="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">👑 Havi Előfizetés</span>'}
                                        </div>
                                        <div class="text-[11px] text-slate-500">${t.item_title ? `Eszköz: "${t.item_title}" • ` : ''}${t.plan_name || t.plan_id} • ${t.created_at || ''}</div>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <span class="font-black text-slate-900">${(t.amount_huf || 0).toLocaleString('hu-HU')} Ft</span>
                                        <span class="block text-[10px] text-emerald-600 font-bold">✓ Kifizetve</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- Jobb: Érdekességek & Települések / Kategóriák -->
            <div class="lg:col-span-5 space-y-6">
                <!-- Top Települések -->
                <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <h3 class="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
                        <i class="fa-solid fa-map-location-dot text-emerald-600"></i> Legaktívabb Települések
                    </h3>
                    <p class="text-xs text-slate-500 mb-4">Hol hirdetik a legtöbb gépet és szerszámot?</p>

                    ${locations.length === 0 ? `
                        <p class="text-xs text-slate-400 italic">Még nincs feltöltött eszköz.</p>
                    ` : `
                        <div class="space-y-2">
                            ${locations.map(([city, count], idx) => `
                                <div class="flex items-center justify-between p-2.5 rounded-xl ${idx === 0 ? 'bg-emerald-50 border border-emerald-200 font-bold text-emerald-900' : 'bg-slate-50 text-slate-700'} text-xs">
                                    <span class="flex items-center gap-2">
                                        <span class="w-5 h-5 rounded-full ${idx === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px] font-bold">${idx + 1}</span>
                                        <span>${city}</span>
                                    </span>
                                    <span class="font-extrabold text-slate-800">${count} db eszköz</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- Kategóriák megoszlása -->
                <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <h3 class="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
                        <i class="fa-solid fa-chart-pie text-indigo-600"></i> Keresett Kategóriák
                    </h3>
                    <p class="text-xs text-slate-500 mb-3">Eszközök megoszlása kategóriánként</p>

                    <div class="space-y-2">
                        ${Object.entries(categories).map(([cat, count]) => `
                            <div class="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-xl">
                                <span class="font-medium text-slate-700">${cat}</span>
                                <span class="font-bold text-indigo-700">${count} db</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <!-- 4. E-MAIL ÉRTESÍTŐ RENDSZER VEZÉRLŐPULT & TESZT -->
        <div class="mt-6 bg-gradient-to-br from-slate-900 to-emerald-950 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-500/30">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20 mb-5">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 text-xl shrink-0">
                        <i class="fa-solid fa-envelope-circle-check"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-white flex items-center gap-2">
                            Bérlési E-mail Értesítő Rendszer
                            <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-black border border-emerald-400/40">Kétirányú Aktív</span>
                        </h3>
                        <p class="text-xs text-slate-300">Bérbeadói értesítő & Bérlői visszaigazolás automatikus kiküldése minden bérléskor</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button onclick="triggerAdminTestEmail()" id="admin-test-email-btn" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 transform active:scale-95">
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>Teszt e-mail küldése most</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div class="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">🎯 Teszt Címzett</div>
                    <div class="font-black text-sm text-white break-all">kulovanyi.kornel@gmail.com</div>
                    <p class="text-[11px] text-slate-400 mt-1">Jelenlegi beállítás: mindkét fél (bérbeadó és bérlő) e-mailje erre a címre fut be.</p>
                </div>

                <div class="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">🌐 GitHub & Élő Támogatás</div>
                    <div class="font-bold text-slate-200 flex items-center gap-1.5">
                        <i class="fa-solid fa-circle-check text-emerald-400"></i>
                        <span>GitHub Pages-en is azonnal működik</span>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Kliensoldali REST API közvetlenül továbbítja a leveleket szerver nélkül is.</p>
                </div>

                <div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <div>
                        <div class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">👁️ HTML Előnézetek</div>
                        <div class="flex items-center gap-2 mt-1">
                            <a href="/static/email_preview_owner.html" target="_blank" class="px-2.5 py-1 bg-emerald-700/60 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1">
                                <i class="fa-solid fa-eye"></i> Bérbeadói minta
                            </a>
                            <a href="/static/email_preview_renter.html" target="_blank" class="px-2.5 py-1 bg-blue-700/60 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1">
                                <i class="fa-solid fa-eye"></i> Bérlői minta
                            </a>
                        </div>
                    </div>
                    <span class="text-[10px] text-slate-400 mt-2">Reszponzív, prémium dizájn.</span>
                </div>
            </div>
        </div>
    `;
}

async function triggerAdminTestEmail() {
    const btn = document.getElementById('admin-test-email-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Küldés folyamatban...`;
    }

    try {
        const res = await fetch('/api/email/test-rental-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_email: 'kulovanyi.kornel@gmail.com' })
        });

        if (!res.ok) throw new Error('Nem sikerült a teszt küldése');
        const data = await res.json();
        showToast('🎉 ' + (data.message || 'Teszt e-mailek sikeresen elküldve a kulovanyi.kornel@gmail.com címre!'), 'success');
    } catch (e) {
        showToast('Hiba az e-mail küldésekor: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Teszt e-mail küldése most</span>`;
        }
    }
}

function switchDashboardSubTab(subTab) {
    state.dashboardSubTab = subTab;
    loadDashboardData();
}

function setCategory(cat) {
    state.selectedCategory = cat;
    renderCategoryPills();
    loadItems();
}

function setUnit(unit) {
    state.selectedUnit = unit;
    loadItems();
}

function resetFilters() {
    state.selectedCategory = 'Mind';
    state.selectedUnit = 'Mind';
    state.searchQuery = '';
    state.maxPrice = '';
    state.locationFilter = '';

    const searchInput = document.getElementById('search-input');
    const unitSelect = document.getElementById('unit-filter');
    const maxPriceInput = document.getElementById('max-price-input');
    const locationInput = document.getElementById('location-input');

    if (searchInput) searchInput.value = '';
    if (unitSelect) unitSelect.value = 'Mind';
    if (maxPriceInput) maxPriceInput.value = '';
    if (locationInput) locationInput.value = '';

    renderCategoryPills();
    loadItems();
}

function setupEventListeners() {
    renderCategoryPills();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.searchQuery = e.target.value;
                loadItems();
            }, 300);
        });
    }

    const unitFilter = document.getElementById('unit-filter');
    if (unitFilter) {
        unitFilter.addEventListener('change', (e) => {
            state.selectedUnit = e.target.value;
            loadItems();
        });
    }

    const maxPriceInput = document.getElementById('max-price-input');
    if (maxPriceInput) {
        let timer;
        maxPriceInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.maxPrice = e.target.value;
                loadItems();
            }, 300);
        });
    }

    const locationInput = document.getElementById('location-input');
    if (locationInput) {
        let timer;
        locationInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.locationFilter = e.target.value;
                loadItems();
            }, 300);
        });
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-rose-600 text-white',
        info: 'bg-slate-800 text-white'
    };

    toast.className = `px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- ÉRTESÍTÉSEK ÉS BELSŐ ÜZENETKEZELŐ FUNKCIÓK ---

async function fetchNotifications() {
    if (!state.currentUser) return;
    try {
        // 1. Olvasatlan üzenetek lekérdezése
        const resMsg = await fetch(`/api/messages/unread-count?user_id=${state.currentUser.id}`);
        if (resMsg.ok) {
            const dataMsg = await resMsg.json();
            state.unreadMessagesCount = dataMsg.unread_count || 0;
        }

        // 2. Bejövő bérlési kérelmek (új / függőben lévő bérlések vizsgálata)
        const resRent = await fetch(`/api/rentals?user_id=${state.currentUser.id}&role=owner`);
        if (resRent.ok) {
            const dataRent = await resRent.json();
            const incomingList = Array.isArray(dataRent) ? dataRent : (dataRent.incoming || []);
            state.pendingRentalsCount = incomingList.filter(r => r.status === 'pending').length;
        }

        updateNotificationBadges();
    } catch (err) {
        console.warn('Értesítések lekérdezési megjegyzés:', err);
    }
}

function updateNotificationBadges() {
    const unreadMsgs = state.unreadMessagesCount || 0;
    const pendingRentals = state.pendingRentalsCount || 0;
    const totalNotifications = unreadMsgs + pendingRentals;

    // 1. Fejléc avatar feletti piros értesítési pötty (Összesített állapot)
    const dot = document.getElementById('user-menu-notification-dot');
    if (dot) {
        if (totalNotifications > 0) {
            dot.classList.remove('hidden');
        } else {
            dot.classList.add('hidden');
        }
    }

    // 2. Dropdown menü: Irányítópult & Bérléseim jelvény
    const dropdownRentalsBadge = document.getElementById('dropdown-rentals-badge');
    if (dropdownRentalsBadge) {
        if (pendingRentals > 0) {
            dropdownRentalsBadge.textContent = `${pendingRentals} új`;
            dropdownRentalsBadge.classList.remove('hidden');
        } else {
            dropdownRentalsBadge.classList.add('hidden');
        }
    }

    // 3. Dropdown menü: Belső Üzenetek jelvény
    const dropdownUnreadBadge = document.getElementById('dropdown-unread-badge');
    if (dropdownUnreadBadge) {
        if (unreadMsgs > 0) {
            dropdownUnreadBadge.textContent = String(unreadMsgs);
            dropdownUnreadBadge.classList.remove('hidden');
        } else {
            dropdownUnreadBadge.classList.add('hidden');
        }
    }

    // Régi fejléc jelvény (ha még létezne valahol a DOM-ban)
    const badge = document.getElementById('unread-messages-badge');
    if (badge) {
        if (unreadMsgs > 0) {
            badge.textContent = String(unreadMsgs);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

async function fetchUnreadCount() {
    await fetchNotifications();
}

function switchMessagesFolder(folder) {
    state.messagesFolder = folder;
    const tabInbox = document.getElementById('msg-tab-inbox');
    const tabArchived = document.getElementById('msg-tab-archived');

    if (folder === 'inbox') {
        if (tabInbox) {
            tabInbox.className = 'flex-1 py-1.5 text-xs font-extrabold rounded-lg bg-white text-slate-900 shadow-sm transition-all flex items-center justify-center gap-1.5';
        }
        if (tabArchived) {
            tabArchived.className = 'flex-1 py-1.5 text-xs font-extrabold rounded-lg text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1.5';
        }
    } else {
        if (tabInbox) {
            tabInbox.className = 'flex-1 py-1.5 text-xs font-extrabold rounded-lg text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1.5';
        }
        if (tabArchived) {
            tabArchived.className = 'flex-1 py-1.5 text-xs font-extrabold rounded-lg bg-white text-slate-900 shadow-sm transition-all flex items-center justify-center gap-1.5';
        }
    }

    state.activeConversationId = null;
    state.activeConversation = null;
    state.activeMessages = [];
    loadMessagesData(folder);
}

async function loadMessagesData(folder = 'inbox') {
    if (!state.currentUser) return;

    const listContainer = document.getElementById('conversations-list-container');
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="py-12 text-center text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-xl text-emerald-600 mb-2"></i>
                <p class="text-xs font-medium">Beszélgetések betöltése...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(`/api/messages/conversations?user_id=${state.currentUser.id}&folder=${folder}`);
        if (!res.ok) throw new Error('Hiba a beszélgetések betöltésekor');
        
        state.conversations = await res.json();
        renderConversationsList(state.conversations);

        // Ha van piszkozat (draft), jelenítsük meg a piszkozat chatet
        if (state.draftPartner) {
            renderDraftChatPane();
            return;
        }

        // Ha van kiválasztott beszélgetés, töltsük be újra
        if (state.activeConversationId) {
            const exists = state.conversations.find(c => c.id === state.activeConversationId);
            if (exists) {
                selectConversation(state.activeConversationId, false);
            } else if (state.conversations.length > 0) {
                selectConversation(state.conversations[0].id, false);
            } else {
                renderEmptyChatPane();
            }
        } else if (state.conversations.length > 0) {
            selectConversation(state.conversations[0].id, false);
        } else {
            renderEmptyChatPane();
        }

        fetchUnreadCount();
    } catch (err) {
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="p-6 text-center text-rose-600 text-xs">
                    <i class="fa-solid fa-triangle-exclamation text-lg mb-1"></i>
                    <p>Nem sikerült betölteni az üzeneteket.</p>
                </div>
            `;
        }
    }
}

function renderConversationsList(convs) {
    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) return;

    if (!convs || convs.length === 0) {
        const isArchived = state.messagesFolder === 'archived';
        listContainer.innerHTML = `
            <div class="py-16 px-4 text-center text-slate-400">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 text-xl">
                    <i class="fa-solid ${isArchived ? 'fa-box-archive' : 'fa-inbox'}"></i>
                </div>
                <p class="text-xs font-bold text-slate-600 mb-1">${isArchived ? 'Nincsenek archivált beszélgetések' : 'Nincsenek beérkező üzenetek'}</p>
                <p class="text-[11px] text-slate-400">Bármelyik eszköz adatlapján a "💬 Üzenet a bérbeadónak" gombbal tudsz új beszélgetést kezdeményezni.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = convs.map(c => {
        const isActive = (c.id === state.activeConversationId && !state.draftPartner);
        const partner = c.partner || { name: 'Felhasználó' };
        const avatar = getUserAvatar(partner);
        const unread = c.unread_count || 0;
        const timeStr = formatMessageTime(c.last_message_at);

        return `
            <div onclick="selectConversation('${c.id}')" class="p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                isActive ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-100/70 border-l-4 border-transparent'
            }">
                <div class="relative shrink-0">
                    <img src="${avatar}" class="w-11 h-11 rounded-full object-cover ring-2 ${isActive ? 'ring-emerald-500' : 'ring-slate-200'}">
                    ${unread > 0 ? `
                        <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow">
                            ${unread}
                        </span>
                    ` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-xs font-black text-slate-900 truncate">${partner.name}</span>
                        <span class="text-[10px] font-semibold text-slate-400 shrink-0 ml-1">${timeStr}</span>
                    </div>

                    ${c.item ? `
                        <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold mb-1 max-w-full truncate">
                            <i class="fa-solid fa-wrench text-emerald-600 text-[9px]"></i>
                            <span class="truncate">${c.item.title}</span>
                        </div>
                    ` : ''}

                    <p class="text-xs text-slate-500 truncate ${unread > 0 ? 'font-bold text-slate-800' : ''}">
                        ${c.last_message || 'Beszélgetés megnyitása'}
                    </p>
                </div>
            </div>
        `;
    }).join('');
}

function filterConversations(val) {
    const q = (val || '').toLowerCase().trim();
    if (!q) {
        renderConversationsList(state.conversations);
        return;
    }

    const filtered = state.conversations.filter(c => {
        const partnerName = (c.partner && c.partner.name) ? c.partner.name.toLowerCase() : '';
        const itemTitle = (c.item && c.item.title) ? c.item.title.toLowerCase() : '';
        const lastMsg = (c.last_message || '').toLowerCase();
        return partnerName.includes(q) || itemTitle.includes(q) || lastMsg.includes(q);
    });

    renderConversationsList(filtered);
}

async function selectConversation(convId, autoFocus = true) {
    state.activeConversationId = convId;
    state.draftPartner = null;
    state.draftItem = null;

    renderConversationsList(state.conversations);

    const chatContainer = document.getElementById('chat-pane-container');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div class="flex-1 flex items-center justify-center p-8 text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-600 mr-2"></i>
                <span class="text-xs font-semibold">Beszélgetés betöltése...</span>
            </div>
        `;
    }

    try {
        const [convRes, msgsRes] = await Promise.all([
            fetch(`/api/messages/conversations/${convId}?user_id=${state.currentUser.id}`),
            fetch(`/api/messages/conversations/${convId}/messages?user_id=${state.currentUser.id}`)
        ]);

        if (!convRes.ok || !msgsRes.ok) throw new Error('Hiba a beszélgetés lekérésekor');

        state.activeConversation = await convRes.json();
        state.activeMessages = await msgsRes.json();

        // Olvasottá tétel
        fetch(`/api/messages/conversations/${convId}/read?user_id=${state.currentUser.id}`, { method: 'POST' })
            .then(() => fetchUnreadCount());

        const convInState = state.conversations.find(c => c.id === convId);
        if (convInState) {
            convInState.unread_count = 0;
            renderConversationsList(state.conversations);
        }

        renderActiveChatPane(autoFocus);
    } catch (err) {
        if (chatContainer) {
            chatContainer.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-rose-600">
                    <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                    <p class="text-sm font-bold">Nem sikerült betölteni ezt a beszélgetést.</p>
                </div>
            `;
        }
    }
}

async function refreshActiveChatSilently() {
    if (!state.currentUser || !state.activeConversationId || state.draftPartner) return;
    try {
        const msgsRes = await fetch(`/api/messages/conversations/${state.activeConversationId}/messages?user_id=${state.currentUser.id}`);
        if (msgsRes.ok) {
            const newMsgs = await msgsRes.json();
            if (newMsgs.length !== state.activeMessages.length) {
                state.activeMessages = newMsgs;
                renderMessagesStream(false);
                fetch(`/api/messages/conversations/${state.activeConversationId}/read?user_id=${state.currentUser.id}`, { method: 'POST' });
            }
        }
    } catch (e) {
        // Csendes hiba elnyelése
    }
}

function renderEmptyChatPane() {
    const chatContainer = document.getElementById('chat-pane-container');
    if (!chatContainer) return;

    chatContainer.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div class="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4 shadow-inner">
                <i class="fa-solid fa-comments"></i>
            </div>
            <h3 class="text-base font-black text-slate-800 mb-1">Nincs kiválasztott beszélgetés</h3>
            <p class="text-xs text-slate-500 max-w-sm leading-relaxed">
                Válassz ki egy beszélgetést a bal oldali listából, vagy keress egy szerszámot és írj közvetlenül a tulajdonosnak!
            </p>
        </div>
    `;
}

function renderDraftChatPane() {
    const chatContainer = document.getElementById('chat-pane-container');
    if (!chatContainer || !state.draftPartner) return;

    const partner = state.draftPartner;
    const item = state.draftItem;
    const avatar = getUserAvatar(partner);

    chatContainer.innerHTML = `
        <!-- Chat Fejléc -->
        <div class="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
                <img src="${avatar}" class="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500 shrink-0">
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-black text-slate-900 truncate">${partner.name}</h3>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shrink-0">
                            Új kapcsolatfelvétel
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-500 truncate">${partner.city || 'KölcsönAdó Partner'} • ⭐ ${partner.rating || 5.0}</p>
                </div>
            </div>
            <button onclick="cancelDraftChat()" class="text-slate-400 hover:text-slate-700 p-2 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors">
                <i class="fa-solid fa-xmark mr-1"></i> Mégse
            </button>
        </div>

        <!-- Érintett eszköz csatolt sáv -->
        ${item ? `
            <div class="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <img src="${item.image_url || 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=100'}" class="w-8 h-8 rounded-lg object-cover ring-1 ring-emerald-300 shrink-0">
                    <div class="min-w-0">
                        <span class="text-xs font-black text-emerald-950 truncate block">${item.title}</span>
                        <span class="text-[10px] font-bold text-emerald-700">${item.price ? item.price.toLocaleString('hu-HU') + ' Ft / ' + (item.price_unit || 'nap') : ''}</span>
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- Üzenetek folyam (üres / bevezető kártya) -->
        <div class="flex-1 p-6 overflow-y-auto bg-slate-50/50 flex flex-col items-center justify-center text-center">
            <div class="max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xl font-black">
                    💬
                </div>
                <h4 class="text-sm font-black text-slate-800">Kezdeményezz beszélgetést ${partner.name} partnerrel!</h4>
                <p class="text-xs text-slate-500 leading-relaxed">
                    Írd meg bátran a kérdéseidet a bérléssel kapcsolatban (átvételi időpont, tartozékok, foglalás). Az első üzenet elküldésével létrejön a beszélgetésetek.
                </p>
            </div>
        </div>

        <!-- Üzenetküldő sáv -->
        <div class="p-4 border-t border-slate-200 bg-white">
            <form onsubmit="handleChatSubmit(event)" class="flex items-center gap-2">
                <input type="text" id="chat-message-input" required placeholder="Írj üzenetet... (Enter a küldéshez)" class="flex-1 px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none">
                <button type="submit" id="chat-send-btn" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2">
                    <span>Küldés</span>
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('chat-message-input');
        if (input) {
            if (item && item.title) {
                input.value = `Szia! Érdeklődnék a(z) "${item.title}" eszközöd iránt. Elérhető lenne?`;
            }
            input.focus();
        }
    }, 50);
}

function cancelDraftChat() {
    state.draftPartner = null;
    state.draftItem = null;
    if (state.conversations.length > 0) {
        selectConversation(state.conversations[0].id);
    } else {
        renderEmptyChatPane();
    }
}

function renderActiveChatPane(autoFocus = true) {
    const chatContainer = document.getElementById('chat-pane-container');
    if (!chatContainer || !state.activeConversation) return;

    const conv = state.activeConversation;
    const partner = conv.partner || { name: 'Felhasználó' };
    const avatar = getUserAvatar(partner);
    const isArchived = !!conv.is_archived;

    chatContainer.innerHTML = `
        <!-- Chat Fejléc -->
        <div class="p-3.5 sm:p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
                <img src="${avatar}" class="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500 shrink-0">
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-black text-slate-900 truncate">${partner.name}</h3>
                        ${isArchived ? `
                            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold shrink-0">
                                📁 Archivált
                            </span>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-500 truncate">
                        <span>${partner.city || 'KölcsönAdó Partner'}</span>
                        <span>•</span>
                        <span class="text-amber-500 font-bold">★ ${partner.rating || 5.0}</span>
                        ${partner.phone ? `
                            <span>•</span>
                            <a href="tel:${partner.phone}" class="text-emerald-700 hover:underline font-bold flex items-center gap-1">
                                <i class="fa-solid fa-phone text-[10px]"></i> ${partner.phone}
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Műveleti gombok (Archiválás / Visszaállítás / Törlés) -->
            <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="toggleArchiveActiveConv()" title="${isArchived ? 'Visszahelyezés a Beérkező üzenetekhez' : 'Beszélgetés archiválása'}" class="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors flex items-center gap-1.5">
                    <i class="fa-solid ${isArchived ? 'fa-inbox text-emerald-600' : 'fa-box-archive text-slate-500'}"></i>
                    <span class="hidden sm:inline">${isArchived ? 'Visszaállítás' : 'Archiválás'}</span>
                </button>
                <button onclick="deleteActiveConv()" title="Beszélgetés törlése" class="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-bold transition-colors">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>

        <!-- Érintett gép adatai sáv -->
        ${conv.item ? `
            <div class="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 border-b border-emerald-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <img src="${conv.item.image_url || 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=100'}" class="w-7 h-7 rounded-lg object-cover ring-1 ring-emerald-300 shrink-0">
                    <div class="min-w-0 flex items-center gap-2">
                        <span class="text-xs font-black text-emerald-950 truncate">${conv.item.title}</span>
                        <span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                            ${conv.item.price ? conv.item.price.toLocaleString('hu-HU') + ' Ft / ' + (conv.item.price_unit || 'nap') : ''}
                        </span>
                    </div>
                </div>
                <button onclick="openItemModal(${conv.item.id})" class="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 hover:underline shrink-0 flex items-center gap-1">
                    <span>Eszköz adatlap</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </button>
            </div>
        ` : ''}

        <!-- Üzenetek görgethető folyam -->
        <div id="messages-stream-container" class="flex-1 p-4 sm:p-5 overflow-y-auto bg-slate-50/60 space-y-3 max-h-[380px] sm:max-h-[440px]">
            <!-- JS tölti be az üzenet buborékokat -->
        </div>

        <!-- Üzenetküldő beviteli mező -->
        <div class="p-3 sm:p-4 border-t border-slate-200 bg-white">
            <form onsubmit="handleChatSubmit(event)" class="flex items-center gap-2">
                <input type="text" id="chat-message-input" required autocomplete="off" placeholder="Írj választ... (Enter a küldéshez)" class="flex-1 px-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none">
                <button type="submit" id="chat-send-btn" class="px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2">
                    <span>Küldés</span>
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>
    `;

    renderMessagesStream(autoFocus);
}

function renderMessagesStream(autoFocus = true) {
    const streamContainer = document.getElementById('messages-stream-container');
    if (!streamContainer) return;

    const msgs = state.activeMessages || [];
    if (msgs.length === 0) {
        streamContainer.innerHTML = `
            <div class="py-12 text-center text-slate-400 text-xs">
                <p class="font-semibold">Még nem érkeztek üzenetek ebben a beszélgetésben.</p>
                <p class="text-[11px] text-slate-400 mt-1">Írj egy üzenetet az alábbi mezőbe a csevegés elindításához!</p>
            </div>
        `;
        return;
    }

    const partner = (state.activeConversation && state.activeConversation.partner) || { id: 1, name: 'Partner' };
    const partnerAvatar = getUserAvatar(partner);
    const myAvatar = getUserAvatar(state.currentUser);

    streamContainer.innerHTML = msgs.map(m => {
        const isMine = !!m.is_mine;
        const timeStr = formatMessageTime(m.created_at);

        if (isMine) {
            return `
                <div class="flex items-end justify-end gap-2 max-w-[85%] sm:max-w-[75%] ml-auto">
                    <div class="flex flex-col items-end">
                        <div class="bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                            ${escapeHtml(m.content)}
                        </div>
                        <div class="flex items-center gap-1 text-[10px] text-slate-400 mt-1 pr-1">
                            <span>${timeStr}</span>
                            <i class="fa-solid fa-check-double text-emerald-600 text-[10px]"></i>
                        </div>
                    </div>
                    <img src="${myAvatar}" class="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-400 shrink-0 mb-4" title="Te">
                </div>
            `;
        } else {
            return `
                <div class="flex items-start gap-2 max-w-[85%] sm:max-w-[75%]">
                    <img src="${m.sender_avatar || partnerAvatar}" onclick="openUserProfileModal(${m.sender_id || partner.id})" class="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0 mt-1 cursor-pointer hover:opacity-80 transition-opacity" title="Kattints a profil megtekintéséhez">
                    <div>
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5 cursor-pointer hover:text-emerald-700" onclick="openUserProfileModal(${m.sender_id || partner.id})">
                            ${m.sender_name || partner.name}
                        </div>
                        <div class="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                            ${escapeHtml(m.content)}
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1 pl-1">
                            ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');

    streamContainer.scrollTop = streamContainer.scrollHeight;

    if (autoFocus) {
        const input = document.getElementById('chat-message-input');
        if (input) input.focus();
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    if (!state.currentUser) {
        openAuthModal('login');
        return;
    }

    const input = document.getElementById('chat-message-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();
    input.value = '';

    if (sendBtn) {
        sendBtn.disabled = true;
    }

    try {
        let payload;
        if (state.draftPartner) {
            payload = {
                sender_id: state.currentUser.id,
                receiver_id: state.draftPartner.id,
                content: content,
                item_id: state.draftItem ? state.draftItem.id : null
            };
        } else if (state.activeConversation) {
            payload = {
                sender_id: state.currentUser.id,
                receiver_id: state.activeConversation.partner.id,
                content: content,
                item_id: state.activeConversation.item ? state.activeConversation.item.id : null,
                conversation_id: state.activeConversation.id
            };
        } else {
            return;
        }

        const res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba az üzenet küldésekor');
        }

        const result = await res.json();
        const convId = result.conversation_id;

        state.draftPartner = null;
        state.draftItem = null;

        await loadMessagesData(state.messagesFolder);
        await selectConversation(convId, true);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
}

async function toggleArchiveActiveConv() {
    if (!state.currentUser || !state.activeConversation) return;

    const conv = state.activeConversation;
    const shouldArchive = !conv.is_archived;

    try {
        const res = await fetch(`/api/messages/conversations/${conv.id}/archive?user_id=${state.currentUser.id}&archive=${shouldArchive}`, {
            method: 'POST'
        });

        if (!res.ok) throw new Error('Hiba az archiválás során');

        showToast(shouldArchive ? '📁 Beszélgetés sikeresen archiválva!' : '📥 Beszélgetés visszahelyezve a beérkezettekhez!', 'success');
        await loadMessagesData(state.messagesFolder);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteActiveConv() {
    if (!state.currentUser || !state.activeConversation) return;

    const confirmed = confirm('Biztosan törölni szeretnéd ezt a beszélgetést a postaládádból?');
    if (!confirmed) return;

    const convId = state.activeConversation.id;

    try {
        const res = await fetch(`/api/messages/conversations/${convId}?user_id=${state.currentUser.id}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Hiba a törlés során');

        showToast('🗑️ Beszélgetés sikeresen törölve!', 'success');
        state.activeConversationId = null;
        state.activeConversation = null;
        state.activeMessages = [];
        await loadMessagesData(state.messagesFolder);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openChatFromItem(ownerId, itemId, encodedTitle) {
    if (!state.currentUser) {
        showToast('A bérbeadóval való kapcsolatfelvételhez kérlek jelentkezz be!', 'info');
        openAuthModal('login');
        return;
    }

    if (state.currentUser.id === parseInt(ownerId)) {
        showToast('Ez a te saját hirdetésed, nem tudsz magadnak üzenetet küldeni!', 'info');
        return;
    }

    closeItemModal();
    switchTab('messages');

    const title = decodeURIComponent(encodedTitle);

    await loadMessagesData('inbox');
    const existing = state.conversations.find(c => {
        return c.partner && c.partner.id === parseInt(ownerId) && (!c.item || c.item.id === parseInt(itemId));
    });

    if (existing) {
        selectConversation(existing.id);
    } else {
        let partnerData = {
            id: parseInt(ownerId),
            name: 'Bérbeadó Partner',
            rating: 5.0
        };
        if (state.selectedItem && state.selectedItem.owner_name) {
            partnerData.name = state.selectedItem.owner_name;
            partnerData.avatar = state.selectedItem.owner_avatar;
            partnerData.city = state.selectedItem.owner_city || state.selectedItem.location;
            partnerData.rating = state.selectedItem.owner_rating || 5.0;
        }

        state.draftPartner = partnerData;
        state.draftItem = {
            id: parseInt(itemId),
            title: title,
            image_url: state.selectedItem ? state.selectedItem.image_url : '',
            price: state.selectedItem ? state.selectedItem.price : '',
            price_unit: state.selectedItem ? state.selectedItem.price_unit : 'nap'
        };
        state.activeConversationId = null;
        renderDraftChatPane();
    }
}

async function openUserProfileModal(userId) {
    const modal = document.getElementById('user-public-profile-modal');
    const content = document.getElementById('user-public-profile-content');
    if (!modal || !content) return;

    if (!userId) {
        showToast('A felhasználó azonosítója hiányzik.', 'info');
        return;
    }

    modal.style.display = 'flex';
    content.innerHTML = `
        <div class="py-12 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-600 mb-2"></i>
            <p class="text-xs font-semibold">Profil betöltése...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/users/${userId}/public`);
        if (!res.ok) throw new Error('Nem sikerült betölteni a profilt');
        const user = await res.json();

        const userName = user.name || 'Felhasználó';
        const regDate = user.created_at ? user.created_at.split('T')[0].split(' ')[0] : '2026-09-01';
        const items = user.active_items || [];
        const isMe = state.currentUser && Number(state.currentUser.id) === Number(user.id);

        content.innerHTML = `
            <!-- Fejléc és Fénykép -->
            <div class="text-center pt-2 pb-4 border-b border-slate-100">
                <div class="relative inline-block mx-auto mb-3">
                    <img src="${avatar}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-emerald-500/30 shadow-lg mx-auto">
                    <span class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-md" title="Hitelesített Felhasználó">
                        <i class="fa-solid fa-check"></i>
                    </span>
                </div>
                <h3 class="text-lg sm:text-xl font-black text-slate-900 leading-tight">${userName}</h3>
                <p class="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
                    <i class="fa-solid fa-location-dot text-emerald-600 text-[10px]"></i> ${user.city || 'Magyarország'}
                    <span>•</span>
                    <span>Regisztrált: ${regDate}</span>
                </p>

                <!-- Szint & Értékelés sáv -->
                <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-full text-xs font-black text-amber-900 shadow-xs">
                        <i class="fa-solid fa-trophy text-amber-500 text-xs"></i>
                        <span>${user.level || 1}. Szint (${user.points || 0} pont)</span>
                    </div>

                    <div onclick="scrollToProfileReviews()" class="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-amber-50 border border-slate-200/80 hover:border-amber-300 rounded-full text-xs font-bold text-slate-800 cursor-pointer shadow-xs transition-all group" title="Kattints a kapott vélemények elolvasásához">
                        <span class="text-amber-500 flex items-center gap-1 font-black">
                            <i class="fa-solid fa-star text-[11px]"></i> ${user.rating || 5.0}
                        </span>
                        <span>•</span>
                        <span class="text-slate-700 group-hover:text-amber-900 group-hover:underline underline-offset-2">${user.reviews_count || (user.reviews || []).length || 0} db értékelés</span>
                        <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 group-hover:text-amber-700 transition-transform"></i>
                    </div>
                </div>

                <!-- Megbízhatósági és Aktivitási Mutatók -->
                <div class="grid grid-cols-3 gap-2 mt-3.5 p-2.5 bg-slate-50/80 border border-slate-200/60 rounded-2xl text-center">
                    <div class="p-1">
                        <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Bérbeadás</span>
                        <span class="text-xs sm:text-sm font-black text-emerald-700">${user.completed_rentals_as_owner_count || 0} db</span>
                    </div>
                    <div class="p-1 border-x border-slate-200">
                        <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Kölcsönzés</span>
                        <span class="text-xs sm:text-sm font-black text-blue-700">${user.completed_rentals_as_renter_count || 0} db</span>
                    </div>
                    <div class="p-1">
                        <span class="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Megbízhatóság</span>
                        <span class="text-xs sm:text-sm font-black text-amber-600 flex items-center justify-center gap-1">
                            <i class="fa-solid fa-circle-check text-emerald-500 text-[11px]"></i> 100%
                        </span>
                    </div>
                </div>
            </div>

            <!-- Elérhetőségek -->
            <div class="py-4 space-y-2.5 border-b border-slate-100">
                <div class="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl">
                    <span class="text-slate-500 font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-phone text-emerald-600"></i> Telefonszám
                    </span>
                    ${user.phone ? `
                        <a href="tel:${user.phone}" class="font-bold text-emerald-700 hover:underline">
                            ${user.phone}
                        </a>
                    ` : `<span class="text-slate-400 italic">Nincs megadva</span>`}
                </div>

                <div class="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl">
                    <span class="text-slate-500 font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-envelope text-emerald-600"></i> E-mail cím
                    </span>
                    ${user.email ? `
                        <a href="mailto:${user.email}" class="font-bold text-slate-800 hover:text-emerald-700">
                            ${user.email}
                        </a>
                    ` : `<span class="text-slate-400 italic">Nincs megadva</span>`}
                </div>
            </div>

            <!-- Aktív hirdetések lista preview -->
            <div class="py-4 border-b border-slate-100">
                <div class="flex items-center justify-between mb-2.5">
                    <h4 class="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Hirdetett gépek (${items.length} db)
                    </h4>
                </div>
                ${items.length === 0 ? `
                    <p class="text-xs text-slate-400 italic py-2">Jelenleg nincs aktív hirdetése.</p>
                ` : `
                    <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        ${items.map(it => `
                            <div onclick="closeUserProfileModal(); openItemModal(${it.id});" class="p-2 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-100 cursor-pointer transition-colors flex items-center gap-2">
                                <img src="${it.image_url}" class="w-9 h-9 rounded-lg object-cover shrink-0">
                                <div class="min-w-0">
                                    <p class="text-[11px] font-bold text-slate-800 truncate leading-tight">${it.title}</p>
                                    <p class="text-[10px] font-extrabold text-emerald-700 leading-none mt-0.5">${Number(it.price).toLocaleString('hu-HU')} Ft</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Kapott Értékelések és Szöveges Vélemények (Rákattintva elolvasható) -->
            <div id="profile-reviews-section" class="py-4 border-b border-slate-100 transition-all">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-comments text-amber-500"></i>
                        <span>Kapott Vélemények & Értékelések (${(user.reviews || []).length} db)</span>
                    </h4>
                    <span class="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <i class="fa-solid fa-star text-amber-500 text-[10px]"></i> ${user.rating || 5.0} / 5.0
                    </span>
                </div>

                ${(!user.reviews || user.reviews.length === 0) ? `
                    <div class="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100 text-slate-400 text-xs">
                        <i class="fa-regular fa-comment-dots text-lg mb-1 block"></i>
                        Ehhez a felhasználóhoz még nem érkezett szöveges értékelés.
                    </div>
                ` : `
                    <div class="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        ${user.reviews.map(rev => `
                            <div class="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5 transition-colors">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2 cursor-pointer group" onclick="closeUserProfileModal(); openUserProfileModal(${rev.reviewer_id})">
                                        <img src="${getUserAvatar(rev.reviewer_name, rev.reviewer_avatar)}" class="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200">
                                        <span class="text-xs font-bold text-slate-900 group-hover:text-emerald-700 group-hover:underline">${rev.reviewer_name || 'Értékelő partner'}</span>
                                    </div>
                                    <div class="flex items-center gap-1 text-amber-500 text-xs font-black">
                                        ${Array.from({ length: 5 }).map((_, i) => `<i class="fa-solid fa-star ${i < rev.rating ? 'text-amber-400' : 'text-slate-200'} text-[10px]"></i>`).join('')}
                                        <span class="text-[10px] text-slate-400 font-normal ml-1">${rev.created_at ? rev.created_at.split('T')[0] : ''}</span>
                                    </div>
                                </div>
                                ${rev.item_title ? `
                                    <p class="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                                        <i class="fa-solid fa-toolbox text-emerald-600"></i> ${rev.item_title}
                                    </p>
                                ` : ''}
                                <p class="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                                    "${rev.comment || 'Minden rendben és a megbeszéltek szerint zajlott.'}"
                                </p>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Műveleti gombok -->
            <div class="pt-4 flex gap-2">
                ${!isMe ? `
                    <button onclick="openChatWithUser(${user.id})" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-comments"></i>
                        <span>Üzenet küldése</span>
                    </button>
                ` : `
                    <button onclick="closeUserProfileModal(); openUserSettingsModal();" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-gear text-emerald-600"></i>
                        <span>Fiók Beállítások Módosítása</span>
                    </button>
                `}
                <button onclick="closeUserProfileModal()" class="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors">
                    Bezárás
                </button>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `
            <div class="py-8 text-center text-rose-600">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
                <p class="text-xs font-bold">Nem sikerült betölteni a profilt.</p>
                <button onclick="closeUserProfileModal()" class="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">Bezárás</button>
            </div>
        `;
    }
}

function scrollToProfileReviews() {
    const el = document.getElementById('profile-reviews-section');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('bg-amber-50/50', 'p-2', 'rounded-2xl');
        setTimeout(() => {
            el.classList.remove('bg-amber-50/50', 'p-2', 'rounded-2xl');
        }, 2000);
    }
}

function openUserSettingsModal() {
    if (!state.currentUser) {
        showToast('Kérlek előbb jelentkezz be a beállítások módosításához!', 'info');
        openAuthModal('login');
        return;
    }

    const modal = document.getElementById('user-settings-modal');
    if (!modal) return;

    const u = state.currentUser;
    const nameInput = document.getElementById('settings-name');
    const emailInput = document.getElementById('settings-email');
    const cityInput = document.getElementById('settings-city');
    const phoneInput = document.getElementById('settings-phone');
    const previewImg = document.getElementById('settings-avatar-preview');
    const dataInput = document.getElementById('settings-avatar-data');

    const defaultAvatar = getUserAvatar(u.name || 'User');
    const currentAvatar = getUserAvatar(u, u.avatar);

    if (nameInput) nameInput.value = u.name || '';
    if (emailInput) emailInput.value = u.email || '';
    if (cityInput) cityInput.value = u.city || '';
    if (phoneInput) phoneInput.value = u.phone || '';
    if (previewImg) previewImg.src = currentAvatar;
    if (dataInput) dataInput.value = currentAvatar;

    modal.style.display = 'flex';
}

function closeUserSettingsModal() {
    const modal = document.getElementById('user-settings-modal');
    if (modal) modal.style.display = 'none';
}

function handleSettingsAvatarSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Kérlek érvényes képfájlt (JPG, PNG, WEBP) válassz!', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // 1:1 négyzetes kör alakú középre igazított vágás és tömörítés
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;

            const targetSize = Math.min(400, size);
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);

            const preview = document.getElementById('settings-avatar-preview');
            const dataInput = document.getElementById('settings-avatar-data');
            if (preview) preview.src = compressedDataUrl;
            if (dataInput) dataInput.value = compressedDataUrl;

            showToast('Profilkép kiválasztva és 1:1 kör alakúra formázva!', 'success');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function resetSettingsAvatarToDefault() {
    const name = (document.getElementById('settings-name')?.value || state.currentUser?.name || 'User').trim();
    const defaultAvatar = getUserAvatar(name || 'User');
    const preview = document.getElementById('settings-avatar-preview');
    const dataInput = document.getElementById('settings-avatar-data');
    if (preview) preview.src = defaultAvatar;
    if (dataInput) dataInput.value = defaultAvatar;
    showToast('Alapértelmezett avatár beállítva!', 'info');
}

async function handleSaveUserSettings(event) {
    if (event) event.preventDefault();
    if (!state.currentUser) return;

    const name = (document.getElementById('settings-name')?.value || '').trim();
    const city = (document.getElementById('settings-city')?.value || '').trim();
    const phone = (document.getElementById('settings-phone')?.value || '').trim();
    const avatar = (document.getElementById('settings-avatar-data')?.value || state.currentUser?.avatar || '').trim();

    if (!name) {
        showToast('A név megadása kötelező!', 'error');
        return;
    }

    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mentés...';
    }

    try {
        const payload = {
            name: name,
            city: city,
            phone: phone,
            avatar: avatar
        };

        const res = await fetch(`/api/users/${state.currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Nem sikerült menteni a beállításokat');
        }

        const data = await res.json();
        const updatedUser = data.user || { ...state.currentUser, ...payload };

        state.currentUser = updatedUser;
        localStorage.setItem('kolcsonadlak_user', JSON.stringify(updatedUser));
        if (updatedUser.id) {
            localStorage.setItem('kolcsonado_user_id', String(updatedUser.id));
        }

        renderAuthUI();
        if (state.activeTab === 'dashboard') {
            loadDashboardData();
        }
        closeUserSettingsModal();
        showToast('A fiók beállítások (helység, telefonszám, profilkép) sikeresen elmentve!', 'success');
    } catch (err) {
        showToast(err.message || 'Hiba történt a mentés során.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Beállítások Mentése</span>';
        }
    }
}

function closeUserProfileModal() {
    const modal = document.getElementById('user-public-profile-modal');
    if (modal) modal.style.display = 'none';
}

async function openChatWithUser(targetUserId) {
    if (!state.currentUser) {
        closeUserProfileModal();
        showToast('Üzenetküldéshez kérlek jelentkezz be!', 'info');
        openAuthModal('login');
        return;
    }

    if (state.currentUser.id === Number(targetUserId)) {
        showToast('Magadnak nem küldhetsz üzenetet!', 'info');
        return;
    }

    closeUserProfileModal();
    switchTab('messages');

    try {
        const res = await fetch(`/api/users/${targetUserId}/public`);
        const user = res.ok ? await res.json() : { id: targetUserId, name: 'Partner' };

        await loadMessagesData('inbox');

        const existing = state.conversations.find(c => {
            return c.partner && Number(c.partner.id) === Number(targetUserId);
        });

        if (existing) {
            selectConversation(existing.id);
        } else {
            state.draftPartner = {
                id: Number(targetUserId),
                name: user.name,
                avatar: user.avatar,
                city: user.city,
                rating: user.rating || 5.0,
                phone: user.phone
            };
            state.draftItem = null;
            state.activeConversationId = null;
            renderDraftChatPane();
        }
    } catch (e) {
        showToast('Hiba a csevegés indításakor.', 'error');
    }
}

function formatMessageTime(timeStr) {
    if (!timeStr) return '';
    try {
        const date = new Date(timeStr.replace(' ', 'T'));
        if (isNaN(date.getTime())) return timeStr;
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return timeStr;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- PÉNZÜGYI ÖSSZESÍTŐ (FINANCES) ---

async function loadFinancesData() {
    if (!state.currentUser) return;
    const container = document.getElementById('finances-content');
    if (!container) return;

    container.innerHTML = `
        <div class="py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-600 mb-3"></i>
            <p class="text-sm font-bold text-slate-700">Pénzügyi tranzakciók és elszámolások betöltése...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/rentals?user_id=${state.currentUser.id}`);
        const rawRentals = res.ok ? await res.json() : [];
        const allRentals = Array.isArray(rawRentals) ? rawRentals : [];

        state.finances = state.finances || {};
        state.finances.rawRentals = allRentals;

        // Évek kinyerése a szűrőhöz
        const yearsSet = new Set();
        const currentYear = new Date().getFullYear().toString();
        yearsSet.add(currentYear);

        allRentals.forEach(r => {
            const dateStr = r.start_date || r.created_at;
            if (dateStr) {
                const y = dateStr.substring(0, 4);
                if (y && y.length === 4 && !isNaN(y)) {
                    yearsSet.add(y);
                }
            }
        });

        const sortedYears = Array.from(yearsSet).sort().reverse();
        const yearSelect = document.getElementById('finances-year-filter');
        if (yearSelect) {
            const currentSelected = state.finances.year || 'all';
            yearSelect.innerHTML = `<option value="all" ${currentSelected === 'all' ? 'selected' : ''}>📅 Összes év</option>` +
                sortedYears.map(y => `<option value="${y}" ${currentSelected === y ? 'selected' : ''}>${y}. év</option>`).join('');
        }

        applyFinancesFilter();
    } catch (err) {
        console.error('Pénzügyek betöltési hiba:', err);
        container.innerHTML = `
            <div class="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center text-rose-700">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <p class="font-bold text-sm">Hiba történt a pénzügyi adatok lekérésekor.</p>
                <button onclick="loadFinancesData()" class="mt-3 px-4 py-2 bg-white text-rose-700 font-bold text-xs rounded-xl border border-rose-300">Újrapróbálkozás</button>
            </div>
        `;
    }
}

function applyFinancesFilter() {
    const yearSelect = document.getElementById('finances-year-filter');
    const monthSelect = document.getElementById('finances-month-filter');
    const typeSelect = document.getElementById('finances-type-filter');

    const year = yearSelect ? yearSelect.value : (state.finances?.year || 'all');
    const month = monthSelect ? monthSelect.value : (state.finances?.month || 'all');
    const type = typeSelect ? typeSelect.value : (state.finances?.type || 'all');

    state.finances = state.finances || {};
    state.finances.year = year;
    state.finances.month = month;
    state.finances.type = type;

    const allRentals = state.finances.rawRentals || [];
    const myId = Number(state.currentUser ? state.currentUser.id : 0);

    const filtered = allRentals.filter(r => {
        const isOwner = Number(r.owner_id) === myId || (r.renter_id && Number(r.renter_id) !== myId);
        const txType = isOwner ? 'income' : 'expense';

        if (type === 'income' && txType !== 'income') return false;
        if (type === 'expense' && txType !== 'expense') return false;

        const dateStr = r.start_date || r.created_at || '';
        if (year !== 'all') {
            if (!dateStr.startsWith(year)) return false;
        }

        if (month !== 'all') {
            const m = dateStr.length >= 7 ? dateStr.substring(5, 7) : '';
            if (m !== month) return false;
        }

        return true;
    });

    renderFinancesUI(filtered);
}

function resetFinancesFilters() {
    const yearSelect = document.getElementById('finances-year-filter');
    const monthSelect = document.getElementById('finances-month-filter');
    const typeSelect = document.getElementById('finances-type-filter');

    if (yearSelect) yearSelect.value = 'all';
    if (monthSelect) monthSelect.value = 'all';
    if (typeSelect) typeSelect.value = 'all';

    applyFinancesFilter();
}

function renderFinancesUI(filteredRentals) {
    const container = document.getElementById('finances-content');
    if (!container || !state.currentUser) return;

    const myId = Number(state.currentUser.id);

    // Kiszámítások
    let totalIncome = 0;
    let completedIncome = 0;
    let countIncome = 0;

    let totalExpense = 0;
    let completedExpense = 0;
    let countExpense = 0;

    let totalDepositInvolved = 0;

    const monthNamesMap = {
        '01': 'Január', '02': 'Február', '03': 'Március', '04': 'Április',
        '05': 'Május', '06': 'Június', '07': 'Július', '08': 'Augusztus',
        '09': 'Szeptember', '10': 'Október', '11': 'November', '12': 'December'
    };

    const monthlyGroups = {};

    filteredRentals.forEach(r => {
        const isOwner = Number(r.owner_id) === myId || (r.renter_id && Number(r.renter_id) !== myId);
        const price = Number(r.total_price) || 0;
        const deposit = Number(r.deposit) || 0;
        const isSuccessful = ['completed', 'accepted', 'active'].includes(r.status);

        if (isSuccessful) {
            totalDepositInvolved += deposit;
            if (isOwner) {
                totalIncome += price;
                countIncome += 1;
                if (r.status === 'completed') completedIncome += price;
            } else {
                totalExpense += price;
                countExpense += 1;
                if (r.status === 'completed') completedExpense += price;
            }

            // Havi csoportosítás
            const dateStr = r.start_date || r.created_at || '2026-09-01';
            const ym = dateStr.length >= 7 ? dateStr.substring(0, 7) : '2026-09';
            if (!monthlyGroups[ym]) {
                monthlyGroups[ym] = { ym, income: 0, expense: 0, countIncome: 0, countExpense: 0 };
            }
            if (isOwner) {
                monthlyGroups[ym].income += price;
                monthlyGroups[ym].countIncome += 1;
            } else {
                monthlyGroups[ym].expense += price;
                monthlyGroups[ym].countExpense += 1;
            }
        }
    });

    const netBalance = totalIncome - totalExpense;
    const isPositiveBalance = netBalance >= 0;

    // Hónapok rendezése időrendben csökkenő
    const sortedMonths = Object.values(monthlyGroups).sort((a, b) => b.ym.localeCompare(a.ym));

    let html = `
        <!-- 1. KPI ÖSSZESÍTŐ KÁRTYÁK -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- 🟢 BEVÉTEL (KERESET) -->
            <div class="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between">
                <div class="relative z-10">
                    <div class="flex items-center justify-between text-xs font-bold text-emerald-100 mb-1">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-arrow-trend-up"></i> Összes Bevétel (Kereset)</span>
                        <span class="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">${countIncome} db kiadás</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                        +${totalIncome.toLocaleString('hu-HU')} Ft
                    </div>
                    <p class="text-[11px] text-emerald-100/80 mt-1">
                        Kiadott szerszámaidból és gépeidből származó összeg
                    </p>
                </div>
                <div class="pt-3 mt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-100 relative z-10">
                    <span>Lezárt/kifizetett:</span>
                    <span class="font-extrabold text-white">${completedIncome.toLocaleString('hu-HU')} Ft</span>
                </div>
                <i class="fa-solid fa-hand-holding-dollar absolute -right-3 -bottom-4 text-white/10 text-7xl pointer-events-none"></i>
            </div>

            <!-- 🔴 KIADÁS (KÖLTÉS) -->
            <div class="bg-gradient-to-br from-rose-600 to-rose-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between">
                <div class="relative z-10">
                    <div class="flex items-center justify-between text-xs font-bold text-rose-100 mb-1">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-arrow-trend-down"></i> Összes Kiadás (Költés)</span>
                        <span class="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">${countExpense} db bérlés</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                        -${totalExpense.toLocaleString('hu-HU')} Ft
                    </div>
                    <p class="text-[11px] text-rose-100/80 mt-1">
                        Másoktól bérelt gépekre és eszközökre fordított összeg
                    </p>
                </div>
                <div class="pt-3 mt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-rose-100 relative z-10">
                    <span>Lezárt/kifizetett:</span>
                    <span class="font-extrabold text-white">${completedExpense.toLocaleString('hu-HU')} Ft</span>
                </div>
                <i class="fa-solid fa-cart-shopping absolute -right-3 -bottom-4 text-white/10 text-7xl pointer-events-none"></i>
            </div>

            <!-- 💎 NETTÓ EGYENLEG / PROFIT -->
            <div class="bg-white p-5 rounded-3xl border-2 ${isPositiveBalance ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-rose-300 ring-2 ring-rose-300/10'} shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-scale-balanced text-emerald-600"></i> Nettó Mérleg / Egyenleg</span>
                        <span class="px-2 py-0.5 rounded-full ${isPositiveBalance ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} text-[10px] font-black">
                            ${isPositiveBalance ? 'Nyereséges 🎉' : 'Költség többlet'}
                        </span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-black ${isPositiveBalance ? 'text-emerald-700' : 'text-rose-600'} tracking-tight mt-1">
                        ${isPositiveBalance ? '+' : ''}${netBalance.toLocaleString('hu-HU')} Ft
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                        ${isPositiveBalance ? 'Több bevételt termeltél a megosztással, mint amennyit költöttél!' : 'Többet kölcsönöztél eszközt a vizsgált időszakban.'}
                    </p>
                </div>
                <div class="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-bold">
                    <span>Bevétel / Kiadás arány:</span>
                    <span>${totalExpense > 0 ? (totalIncome / totalExpense).toFixed(1) + 'x' : '100% tiszta haszon'}</span>
                </div>
            </div>

            <!-- 🔒 KAUCIÓ FORGALOM -->
            <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-shield-halved text-amber-500"></i> Kaució Védelem</span>
                        <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">Letét</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mt-1">
                        ${totalDepositInvolved.toLocaleString('hu-HU')} Ft
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                        Összes letétbe helyezett / kezelt kaució a bérlések biztonságáért
                    </p>
                </div>
                <div class="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Állapot:</span>
                    <span class="text-emerald-700 font-bold">Épségben visszaadva</span>
                </div>
            </div>
        </div>

        <!-- 2. HAVI ÉS ÉVES LEBONTÁSÚ IDŐVONAL & GRAFIKON -->
        <div class="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold shadow-xs">
                        <i class="fa-solid fa-calendar-check"></i>
                    </span>
                    <div>
                        <h3 class="text-sm sm:text-base font-black text-slate-900">Havi és Éves Bontású Pénzügyi Statisztika</h3>
                        <p class="text-[11px] text-slate-500">Bevétel és kiadás összehasonlítása hónapról hónapra</p>
                    </div>
                </div>
                <span class="text-xs font-bold text-slate-400">
                    ${sortedMonths.length} aktív hónap
                </span>
            </div>

            ${sortedMonths.length === 0 ? `
                <div class="py-8 text-center text-slate-400 italic text-xs">
                    Nincs lezárt vagy aktív pénzügyi tranzakció a kiválasztott időszakban.
                </div>
            ` : `
                <div class="space-y-3">
                    ${sortedMonths.map(m => {
                        const [y, mm] = m.ym.split('-');
                        const monthName = monthNamesMap[mm] || mm;
                        const monthBalance = m.income - m.expense;
                        const monthTotal = (m.income + m.expense) || 1;
                        const incomePercent = Math.round((m.income / monthTotal) * 100);
                        const expensePercent = Math.round((m.expense / monthTotal) * 100);

                        return `
                            <div class="p-4 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/70 transition-colors space-y-2">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <span class="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-900 font-extrabold text-xs shadow-xs">
                                            📅 ${y}. ${monthName}
                                        </span>
                                        <span class="text-[11px] text-slate-500 font-medium">
                                            (${m.countIncome} kiadás, ${m.countExpense} bérlés)
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-4 text-xs font-bold">
                                        <span class="text-emerald-700 flex items-center gap-1">
                                            <i class="fa-solid fa-arrow-up text-[10px]"></i> +${m.income.toLocaleString('hu-HU')} Ft
                                        </span>
                                        <span class="text-rose-600 flex items-center gap-1">
                                            <i class="fa-solid fa-arrow-down text-[10px]"></i> -${m.expense.toLocaleString('hu-HU')} Ft
                                        </span>
                                        <span class="px-2.5 py-0.5 rounded-lg ${monthBalance >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} font-black">
                                            Egyenleg: ${monthBalance >= 0 ? '+' : ''}${monthBalance.toLocaleString('hu-HU')} Ft
                                        </span>
                                    </div>
                                </div>

                                <!-- Vizuális Összehasonlító sáv -->
                                <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                    <div class="bg-emerald-500 h-full transition-all" style="width: ${incomePercent}%;" title="Bevétel: ${incomePercent}%"></div>
                                    <div class="bg-rose-500 h-full transition-all" style="width: ${expensePercent}%;" title="Kiadás: ${expensePercent}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>

        <!-- 3. RÉSZLETES TÉTELES TRANZAKCIÓLISTA -->
        <div class="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold shadow-xs">
                        <i class="fa-solid fa-receipt text-emerald-600"></i>
                    </span>
                    <div>
                        <h3 class="text-sm sm:text-base font-black text-slate-900">Részletes Tételes Tranzakciós Napló</h3>
                        <p class="text-[11px] text-slate-500">Minden egyes eszközkiadásod és bérlésed pontos elszámolása</p>
                    </div>
                </div>
                <span class="px-3 py-1 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 self-start sm:self-auto">
                    ${filteredRentals.length} db tétel
                </span>
            </div>

            ${filteredRentals.length === 0 ? `
                <div class="py-12 text-center text-slate-500 space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div>
                        <h4 class="font-extrabold text-slate-800 text-sm">Nincs megjeleníthető tranzakció a szűrők alapján</h4>
                        <p class="text-xs text-slate-400">Próbáld meg módosítani az év, hónap vagy típus szűrőt!</p>
                    </div>
                </div>
            ` : `
                <div class="divide-y divide-slate-100">
                    ${filteredRentals.map(r => {
                        const isOwner = Number(r.owner_id) === myId || (r.renter_id && Number(r.renter_id) !== myId);
                        const partnerId = isOwner ? (r.renter_id || 1) : (r.owner_id || 1);
                        const partnerName = isOwner ? (r.renter_name || 'Bérlő') : (r.owner_name || 'Bérbeadó');
                        const partnerAvatar = getUserAvatar(partnerName, isOwner ? r.renter_avatar : r.owner_avatar);
                        const partnerPhone = isOwner ? r.renter_phone : r.owner_phone;

                        const price = Number(r.total_price) || 0;
                        const deposit = Number(r.deposit) || 0;
                        const startDate = r.start_date || '-';
                        const endDate = r.end_date || r.start_date || 'rugalmas';
                        const units = r.units_count || 1;
                        const unitText = r.item_price_unit || r.price_unit || 'nap';

                        return `
                            <div class="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/70 px-2 rounded-2xl transition-colors">
                                <!-- Bal rész: Ikon, Eszköz és Partner -->
                                <div class="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                                    <div class="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer group" onclick="openItemModal(${r.item_id})" title="Eszköz megtekintése">
                                        <img src="${r.item_image || 'static/logo.png'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                                    </div>

                                    <div class="space-y-1 flex-1 min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="px-2 py-0.5 rounded-md text-[10px] font-black ${isOwner ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                                                ${isOwner ? '🟢 BEVÉTEL (Kiadás)' : '🔴 KIADÁS (Bérlés)'}
                                            </span>
                                            <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 truncate hover:text-emerald-700 cursor-pointer" onclick="openItemModal(${r.item_id})">
                                                ${r.item_title || 'Eszköz'}
                                            </h4>
                                            ${getStatusBadge(r.status)}
                                        </div>

                                        <!-- Partner adatok -->
                                        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <div class="flex items-center gap-1.5 cursor-pointer hover:text-emerald-700 font-bold" onclick="openUserProfileModal(${partnerId})" title="Partner adatlapja">
                                                <img src="${partnerAvatar}" class="w-4 h-4 rounded-full object-cover ring-1 ring-slate-300">
                                                <span>${isOwner ? 'Bérlő' : 'Bérbeadó'}: ${partnerName}</span>
                                            </div>
                                            <span>•</span>
                                            <span><i class="fa-regular fa-calendar text-emerald-600"></i> ${startDate} – ${endDate} (${units} ${unitText})</span>
                                            ${deposit > 0 ? `<span>• <strong class="text-amber-700 font-semibold">Kaució: ${deposit.toLocaleString('hu-HU')} Ft</strong></span>` : ''}
                                        </div>
                                    </div>
                                </div>

                                <!-- Jobb rész: Összeg és Gyorsgombok -->
                                <div class="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                    <div class="lg:text-right">
                                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Összeg</span>
                                        <span class="text-sm sm:text-base font-black ${isOwner ? 'text-emerald-700' : 'text-rose-600'}">
                                            ${isOwner ? '+' : '-'}${price.toLocaleString('hu-HU')} Ft
                                        </span>
                                    </div>

                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <button onclick="openUserProfileModal(${partnerId})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold text-[11px] rounded-xl transition-colors" title="Partner adatlapja">
                                            <i class="fa-solid fa-id-card"></i>
                                        </button>
                                        <button onclick="openChatWithUser(${partnerId})" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition-colors" title="Üzenet küldése">
                                            <i class="fa-solid fa-comments"></i>
                                        </button>
                                        ${partnerPhone ? `
                                            <a href="tel:${partnerPhone}" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-xl transition-colors" title="Hívás: ${partnerPhone}">
                                                <i class="fa-solid fa-phone text-emerald-600"></i>
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    container.innerHTML = html;
}

function exportFinancesCSV() {
    if (!state.finances || !state.finances.rawRentals || state.finances.rawRentals.length === 0) {
        showToast('Nincsenek exportálható pénzügyi tranzakciók.', 'info');
        return;
    }

    const myId = Number(state.currentUser ? state.currentUser.id : 0);
    const rows = [
        ['Dátum', 'Típus', 'Eszköz ID', 'Eszköz Címe', 'Partner Neve', 'Partner ID', 'Bérleti Időszak', 'Bérleti Napok', 'Bérleti Díj (Ft)', 'Kaució (Ft)', 'Státusz', 'Megjegyzés']
    ];

    state.finances.rawRentals.forEach(r => {
        const isOwner = Number(r.owner_id) === myId || (r.renter_id && Number(r.renter_id) !== myId);
        const typeStr = isOwner ? 'BEVÉTEL (Kiadás)' : 'KIADÁS (Kölcsönzés)';
        const dateStr = r.start_date || r.created_at || '';
        const partnerName = isOwner ? (r.renter_name || 'Bérlő') : (r.owner_name || 'Bérbeadó');
        const partnerId = isOwner ? (r.renter_id || '') : (r.owner_id || '');
        const itemTitle = r.item_title || 'Eszköz';
        const dateRange = `${r.start_date || '-'} - ${r.end_date || r.start_date || '-'}`;
        const units = r.units_count || 1;
        const price = Number(r.total_price) || 0;
        const deposit = Number(r.deposit) || 0;
        const status = r.status || '';
        const note = (r.note || '').replace(/"/g, '""');

        rows.push([
            `"${dateStr}"`,
            `"${typeStr}"`,
            `"${r.item_id || ''}"`,
            `"${itemTitle.replace(/"/g, '""')}"`,
            `"${partnerName.replace(/"/g, '""')}"`,
            `"${partnerId}"`,
            `"${dateRange}"`,
            `"${units}"`,
            `"${price}"`,
            `"${deposit}"`,
            `"${status}"`,
            `"${note}"`
        ]);
    });

    const csvContent = '\uFEFF' + rows.map(e => e.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kolcsonadlak_Penzugyi_Osszesito_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✨ Pénzügyi kimutatás sikeresen letöltve .CSV formátumban!', 'success');
}

// Globális ablak exportok
window.switchTab = switchTab;
window.switchDashboardSubTab = switchDashboardSubTab;
window.setCategory = setCategory;
window.setUnit = setUnit;
window.resetFilters = resetFilters;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.openNewItemModal = openNewItemModal;
window.closeNewItemModal = closeNewItemModal;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.openSubscriptionModal = openSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.selectPlan = selectPlan;
window.openBoostModal = openBoostModal;
window.closeBoostModal = closeBoostModal;
window.selectBoostPlan = selectBoostPlan;
window.startBoostPayment = startBoostPayment;
window.submitNewItem = submitNewItem;
window.submitRentalRequest = submitRentalRequest;
window.submitReview = submitReview;
window.updateRentalStatus = updateRentalStatus;
window.updateCalculatorUnits = updateCalculatorUnits;
window.setCalculatorUnits = setCalculatorUnits;
window.handleRentalDateChange = handleRentalDateChange;
window.setRatingStars = setRatingStars;
window.recalculatePrice = recalculatePrice;
window.showToast = showToast;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.logoutUser = logoutUser;

// --- SIKEREK, SZINTEK & JUTALMAK (ACHIEVEMENTS / GAMIFICATION) ---

function getLevelInfo(level) {
    const lvl = Number(level) || 1;
    if (lvl === 1) {
        return {
            level: 1,
            title: 'Kezdő Kölcsönző',
            rankName: 'Bronz Fokozat',
            icon: 'fa-award',
            color: 'emerald',
            badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            glowColor: 'from-emerald-400 to-teal-500',
            desc: 'Alap közösségi tag, aktív felfedező'
        };
    } else if (lvl === 2) {
        return {
            level: 2,
            title: 'Megbízható Kölcsönző',
            rankName: 'Ezüst Fokozat',
            icon: 'fa-shield-halved',
            color: 'blue',
            badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
            glowColor: 'from-blue-500 to-indigo-600',
            desc: 'Tapasztalt, ellenőrzött és megbízható partner'
        };
    } else if (lvl === 3) {
        return {
            level: 3,
            title: 'Arany Fokozatú Partner',
            rankName: 'Arany Fokozat',
            icon: 'fa-medal',
            color: 'amber',
            badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
            glowColor: 'from-amber-400 to-amber-600',
            desc: 'Kiváló hírnévvel rendelkező törzstag'
        };
    } else if (lvl === 4) {
        return {
            level: 4,
            title: 'Platina Kölcsönző Mester',
            rankName: 'Platina Fokozat',
            icon: 'fa-gem',
            color: 'purple',
            badgeBg: 'bg-purple-50 text-purple-900 border-purple-300',
            glowColor: 'from-purple-500 to-pink-600',
            desc: 'Kiemelkedő aktivitású szerszámmegosztó mester'
        };
    } else if (lvl === 5) {
        return {
            level: 5,
            title: 'Elit Közösségi Partner',
            rankName: 'Gyémánt Fokozat',
            icon: 'fa-crown',
            color: 'rose',
            badgeBg: 'bg-rose-50 text-rose-900 border-rose-300',
            glowColor: 'from-rose-500 to-red-600',
            desc: 'A platform legmegbízhatóbb elit tagja'
        };
    } else {
        return {
            level: lvl,
            title: `Legenda Szint ${lvl}`,
            rankName: `Legenda Fokozat`,
            icon: 'fa-star',
            color: 'amber',
            badgeBg: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600',
            glowColor: 'from-amber-500 via-yellow-400 to-amber-600',
            desc: `Végtelen fejlődésű mester (${lvl}. Szint)`
        };
    }
}

async function loadAchievementsData() {
    if (!state.currentUser) return;
    const container = document.getElementById('achievements-content');
    if (!container) return;

    container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl text-amber-500 mb-2"></i>
            <p class="text-xs font-semibold">Sikerek és szintek kiszámítása...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/achievements?user_id=${state.currentUser.id}`);
        if (!res.ok) throw new Error('Nem sikerült betölteni a sikereket');
        const data = await res.json();

        // Felhasználói állapot frissítése
        state.currentUser.level = data.level;
        state.currentUser.points = data.points;
        state.currentUser.boosts_available = data.boosts_available;
        renderAuthUI();

        renderAchievementsUI(data);
    } catch (err) {
        console.error('Achievements load error:', err);
        container.innerHTML = `
            <div class="p-8 text-center bg-rose-50 rounded-3xl border border-rose-200 text-rose-700">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
                <p class="font-bold text-sm">Hiba történt a sikerek lekérésekor.</p>
                <button onclick="loadAchievementsData()" class="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow transition-colors">
                    Újrapróbálkozás
                </button>
            </div>
        `;
    }
}

function renderAchievementsUI(data) {
    const container = document.getElementById('achievements-content');
    if (!container) return;

    const levelInfo = getLevelInfo(data.level);
    const nextLevel = data.level + 1;
    const nextLevelInfo = getLevelInfo(nextLevel);

    const userItems = data.user_items || [];
    const nonFeaturedItems = userItems.filter(it => !it.is_featured);

    container.innerHTML = `
        <!-- 1. FŐ HERO SZINT KÁRTYA -->
        <div class="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/60">
            <!-- Háttér díszítés -->
            <div class="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div class="absolute -left-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <!-- Bal oldal: Ikon és Szint Titulus -->
                <div class="flex items-center gap-4 sm:gap-6">
                    <div class="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr ${levelInfo.glowColor} p-1 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                        <div class="w-full h-full bg-slate-900 rounded-[22px] flex flex-col items-center justify-center text-amber-400">
                            <i class="fa-solid ${levelInfo.icon} text-2xl sm:text-3xl mb-1"></i>
                            <span class="text-[11px] font-black tracking-wider uppercase text-amber-300">${data.level}. Szint</span>
                        </div>
                        <span class="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                            ★ ${data.level}
                        </span>
                    </div>

                    <div>
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30 mb-2">
                            <i class="fa-solid fa-trophy text-[11px]"></i>
                            <span>${levelInfo.rankName}</span>
                        </div>
                        <h3 class="text-xl sm:text-2xl font-black text-white leading-tight">
                            ${levelInfo.title}
                        </h3>
                        <p class="text-xs text-slate-300 mt-1 max-w-md">
                            ${levelInfo.desc} • Végtelen pontgyűjtés és automatikus szintlépés.
                        </p>
                    </div>
                </div>

                <!-- Jobb oldal: Pontszám és Jutalmak összefoglaló -->
                <div class="flex items-center gap-3 sm:gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
                    <div class="text-right pr-3 border-r border-white/10">
                        <span class="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Összes pontod</span>
                        <span class="text-2xl sm:text-3xl font-black text-amber-300">${data.points}</span>
                        <span class="text-[10px] text-slate-300 font-bold block">pont</span>
                    </div>
                    <div>
                        <span class="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Ingyen Kiemelés</span>
                        <span class="text-2xl sm:text-3xl font-black ${data.boosts_available > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-300'}">
                            ${data.boosts_available}
                        </span>
                        <span class="text-[10px] text-slate-300 font-bold block">db elérhető</span>
                    </div>
                </div>
            </div>

            <!-- Haladási sáv (Progress Bar) a következő szintig -->
            <div class="mt-8 pt-6 border-t border-slate-700/80">
                <div class="flex items-center justify-between text-xs font-extrabold mb-2">
                    <span class="text-amber-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-angles-up text-xs"></i>
                        Haladás a ${nextLevel}. Szint felé (${nextLevelInfo.title})
                    </span>
                    <span class="text-slate-300">
                        ${data.level_points} / 300 pont <span class="text-amber-400 font-black">(${data.progress_percent}%)</span>
                    </span>
                </div>

                <div class="w-full bg-slate-950/80 rounded-full h-3.5 p-0.5 border border-slate-700 overflow-hidden shadow-inner">
                    <div class="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500 shadow-sm" style="width: ${Math.max(4, data.progress_percent)}%;"></div>
                </div>

                <div class="flex items-center justify-between mt-2.5 text-[11px] text-slate-400">
                    <span>${data.level}. Szint (${(data.level - 1) * 300} pt)</span>
                    <span class="text-amber-300 font-bold">
                        ⚡ Még <strong class="text-white">${data.points_to_next} pont</strong> a következő szinthez és az újabb ingyenes kiemeléshez!
                    </span>
                    <span>${nextLevel}. Szint (${data.level * 300} pt)</span>
                </div>
            </div>
        </div>


        <!-- 2. INGYENES KIEMELÉS BEVÁLTÓ KÖZPONT -->
        <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg shrink-0">
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                    <div>
                        <h4 class="text-base font-black text-slate-900 leading-tight">Ingyenes Hirdetéskiemelés Beváltása</h4>
                        <p class="text-xs text-slate-500">Váltsd be a szintlépésért járó ingyenes kiemelést bármelyik aktív hirdetésedre!</p>
                    </div>
                </div>
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${data.boosts_available > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-black' : 'bg-slate-50 text-slate-600 border border-slate-200 font-bold'} text-xs shrink-0 self-start sm:self-auto">
                    <i class="fa-solid fa-ticket ${data.boosts_available > 0 ? 'text-emerald-600' : 'text-slate-400'}"></i>
                    <span>Elérhető: <strong>${data.boosts_available} db</strong> (Felhasznált: ${data.boosts_used} db)</span>
                </div>
            </div>

            ${data.boosts_available > 0 ? `
                <div class="p-4 bg-gradient-to-r from-amber-50/80 via-emerald-50/40 to-amber-50/80 rounded-2xl border border-amber-200/80 space-y-4">
                    <div class="flex items-center gap-2 text-xs font-black text-amber-900">
                        <i class="fa-solid fa-gift text-amber-600 text-sm"></i>
                        <span>Van ${data.boosts_available} db beváltatlan ingyenes kiemelésed! Válaszd ki az eszközt:</span>
                    </div>

                    ${userItems.length === 0 ? `
                        <div class="text-center py-4 bg-white rounded-xl border border-amber-200 p-4">
                            <p class="text-xs font-bold text-slate-600 mb-2">Még nincs feltöltött hirdetésed, amire be tudnád váltani.</p>
                            <button onclick="openNewItemModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition-all inline-flex items-center gap-1.5">
                                <i class="fa-solid fa-plus"></i> Új eszköz hirdetése most
                            </button>
                        </div>
                    ` : `
                        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div class="flex-1">
                                <select id="redeem-boost-item-select" class="w-full px-4 py-3 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs">
                                    ${userItems.map(it => `
                                        <option value="${it.id}" ${it.is_featured ? 'disabled' : ''}>
                                            ${it.title} — ${Number(it.price).toLocaleString('hu-HU')} Ft/${it.price_unit || 'nap'} ${it.is_featured ? '⭐ (MÁR KIEMELT)' : '🟢 (Normál hirdetés)'}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <button onclick="redeemFreeBoost()" id="redeem-boost-submit-btn" class="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                <i class="fa-solid fa-bolt text-yellow-200"></i>
                                <span>Kiemelés Beváltása Most</span>
                            </button>
                        </div>
                    `}
                </div>
            ` : `
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2.5 text-slate-600">
                        <i class="fa-solid fa-circle-info text-amber-500 text-sm"></i>
                        <span>Jelenleg nincs beváltatlan ingyenes kiemelésed. Gyűjts még <strong>${data.points_to_next} pontot</strong> a következő szinthez és az újabb ajándék kiemeléshez!</span>
                    </div>
                    <button onclick="switchTab('browse')" class="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors shrink-0 self-start sm:self-auto">
                        Böngészés & Bérlés
                    </button>
                </div>
            `}
        </div>


        <!-- 3. PONTGYŰJTÉSI ESEMÉNYEK & AKTIVITÁSI KPI KÁRTYÁK -->
        <div>
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <i class="fa-solid fa-list-check text-emerald-600"></i>
                    Aktivitások & Pontszerzési Statisztikáid
                </h4>
                <span class="text-xs text-slate-500 font-bold">Minden sikerért +1 pont jár</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- 1. Sikeres Bérlés -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-handshake"></i>
                    </div>
                    <div>
                        <span class="text-[11px] font-bold text-slate-400 block uppercase">Sikeres Bérlés</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="text-xl font-black text-slate-900">${data.stats.rentals_as_renter} db</span>
                            <span class="text-xs font-black text-blue-600">+${data.stats.rentals_as_renter} pt</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Sikeres Bérbeadás -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-toolbox"></i>
                    </div>
                    <div>
                        <span class="text-[11px] font-bold text-slate-400 block uppercase">Sikeres Bérbeadás</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="text-xl font-black text-slate-900">${data.stats.rentals_as_owner} db</span>
                            <span class="text-xs font-black text-emerald-600">+${data.stats.rentals_as_owner} pt</span>
                        </div>
                    </div>
                </div>

                <!-- 3. Adott Értékelések -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </div>
                    <div>
                        <span class="text-[11px] font-bold text-slate-400 block uppercase">Adott Értékelések</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="text-xl font-black text-slate-900">${data.stats.reviews_given} db</span>
                            <span class="text-xs font-black text-purple-600">+${data.stats.reviews_given} pt</span>
                        </div>
                    </div>
                </div>

                <!-- 4. Kapott Értékelések -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-star"></i>
                    </div>
                    <div>
                        <span class="text-[11px] font-bold text-slate-400 block uppercase">Kapott Értékelések</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="text-xl font-black text-slate-900">${data.stats.reviews_received} db</span>
                            <span class="text-xs font-black text-amber-600">+${data.stats.reviews_received} pt</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>


        <!-- 4. VÉGTELEN SZINTEK ÚTJA & JUTALMAK (MILESTONE ROADMAP) -->
        <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                    <h4 class="text-base font-black text-slate-900 leading-tight">Szintek Útja & Jutalmak</h4>
                    <p class="text-xs text-slate-500">Minden szint 300 pont. Nincs felső határ, a jutalmak végtelenek!</p>
                </div>
                <span class="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-full">
                    300 pont = 1 szint = +1 Kiemelés
                </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                ${[1, 2, 3, 4, 5, 6].map(lvl => {
                    const info = getLevelInfo(lvl);
                    const minPoints = (lvl - 1) * 300;
                    const maxPoints = lvl * 300 - 1;
                    const isReached = data.level >= lvl;
                    const isCurrent = data.level === lvl;

                    return `
                        <div class="p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                            isCurrent 
                            ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/30 shadow-md relative' 
                            : isReached 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-slate-50/60 border-slate-200 opacity-60'
                        }">
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-base font-black ${isCurrent ? 'text-amber-600' : isReached ? 'text-emerald-700' : 'text-slate-400'}">
                                        <i class="fa-solid ${info.icon}"></i>
                                    </span>
                                    ${isCurrent ? `
                                        <span class="px-1.5 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded uppercase animate-pulse">Aktuális</span>
                                    ` : isReached ? `
                                        <span class="text-emerald-600 text-xs font-bold"><i class="fa-solid fa-check"></i></span>
                                    ` : `
                                        <span class="text-slate-400 text-xs"><i class="fa-solid fa-lock"></i></span>
                                    `}
                                </div>
                                <h5 class="text-xs font-black text-slate-900 leading-tight">${lvl}. Szint</h5>
                                <p class="text-[11px] font-bold text-slate-600 mt-0.5">${info.title}</p>
                                <p class="text-[10px] text-slate-400 font-mono mt-1">${minPoints}${lvl < 6 ? ' - ' + maxPoints : '+'} pt</p>
                            </div>

                            <div class="mt-3 pt-2 border-t border-slate-200/60">
                                <span class="text-[10px] font-extrabold ${isReached ? 'text-emerald-700' : 'text-slate-500'} flex items-center gap-1">
                                    <i class="fa-solid fa-gift text-[9px]"></i>
                                    ${lvl === 1 ? 'Közösségi tagság' : '+1 Ingyen Kiemelés'}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

async function redeemFreeBoost() {
    if (!state.currentUser) return;
    const select = document.getElementById('redeem-boost-item-select');
    if (!select || !select.value) {
        showToast('Kérlek válassz ki egy hirdetést a beváltáshoz!', 'info');
        return;
    }

    const itemId = select.value;
    const btn = document.getElementById('redeem-boost-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kiemelés folyamatban...`;
    }

    try {
        const res = await fetch('/api/achievements/redeem-boost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.currentUser.id,
                item_id: itemId
            })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.detail || 'Nem sikerült beváltani a kiemelést.');

        showToast(result.message || '🎉 Siker! A hirdetésed sikeresen ki lett emelve!', 'success');

        // Frissítjük a hirdetéseket a böngészőben
        await loadItems();
        await loadAchievementsData();
    } catch (err) {
        showToast(err.message || 'Hiba a kiemelés beváltásakor', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-bolt text-yellow-200"></i> <span>Kiemelés Beváltása Most</span>`;
        }
    }
}


// --- GLOBÁLIS WINDOW EXPORTOK ---
window.switchTab = switchTab;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.logoutUser = logoutUser;
window.openNewItemModal = openNewItemModal;
window.closeNewItemModal = closeNewItemModal;
window.handleNewItemSubmit = handleNewItemSubmit;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.calculateRentalPrice = calculateRentalPrice;
window.handleRentalSubmit = handleRentalSubmit;
window.filterCategory = filterCategory;
window.resetFilters = resetFilters;
window.filterAdmin = filterAdmin;
window.handleApprove = handleApprove;
window.handleReject = handleReject;
window.handleCancel = handleCancel;
window.handleReviewSubmit = handleReviewSubmit;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.openPlanUpgradeModal = openPlanUpgradeModal;
window.closePlanUpgradeModal = closePlanUpgradeModal;
window.selectPlan = selectPlan;
window.handleImageFileSelect = handleImageFileSelect;
window.removeSelectedImage = removeSelectedImage;
window.openCropperModal = openCropperModal;
window.closeCropperModal = closeCropperModal;
window.reopenCropper = reopenCropper;
window.applyCroppedImage = applyCroppedImage;
window.setCropperAspectRatio = setCropperAspectRatio;
window.cropperZoom = cropperZoom;
window.cropperZoomSlider = cropperZoomSlider;
window.cropperRotate = cropperRotate;
window.cropperReset = cropperReset;
window.openEditItemModal = openEditItemModal;
window.closeEditItemModal = closeEditItemModal;
window.submitEditItem = submitEditItem;
window.deleteItem = deleteItem;
window.startSocialLogin = startSocialLogin;
window.closeSocialAuthModal = closeSocialAuthModal;
window.toggleCustomSocialForm = toggleCustomSocialForm;
window.handleCustomSocialSubmit = handleCustomSocialSubmit;
window.executeSocialLogin = executeSocialLogin;
window.loginWithFirebase = loginWithFirebase;
window.initClientFirebase = initClientFirebase;
window.openStripeCheckoutModal = openStripeCheckoutModal;
window.closeStripeCheckoutModal = closeStripeCheckoutModal;
window.handleStripePaymentSubmit = handleStripePaymentSubmit;
window.loadAdminData = loadAdminData;
window.switchAdminSubTab = switchAdminSubTab;
window.adminToggleBoost = adminToggleBoost;
window.adminDeleteItem = adminDeleteItem;
window.filterAdminItemsByUserId = filterAdminItemsByUserId;
window.setAdminItemSearch = setAdminItemSearch;
window.setAdminItemCategory = setAdminItemCategory;
window.setAdminItemStatus = setAdminItemStatus;
window.resetAdminItemFilters = resetAdminItemFilters;
window.setAdminUserSearch = setAdminUserSearch;
window.fetchUnreadCount = fetchUnreadCount;
window.switchMessagesFolder = switchMessagesFolder;
window.loadMessagesData = loadMessagesData;
window.selectConversation = selectConversation;
window.handleChatSubmit = handleChatSubmit;
window.toggleArchiveActiveConv = toggleArchiveActiveConv;
window.deleteActiveConv = deleteActiveConv;
window.openChatFromItem = openChatFromItem;
window.filterConversations = filterConversations;
window.cancelDraftChat = cancelDraftChat;
window.triggerAdminTestEmail = triggerAdminTestEmail;
window.toggleUserDropdown = toggleUserDropdown;
window.fetchNotifications = fetchNotifications;
window.updateNotificationBadges = updateNotificationBadges;
window.renderRentalCalendar = renderRentalCalendar;
window.selectCalendarDate = selectCalendarDate;
window.changeCalendarMonth = changeCalendarMonth;
window.renderLocationTags = renderLocationTags;
window.addLocationTag = addLocationTag;
window.removeLocationTag = removeLocationTag;
window.openUserProfileModal = openUserProfileModal;
window.closeUserProfileModal = closeUserProfileModal;
window.openChatWithUser = openChatWithUser;
window.loadFinancesData = loadFinancesData;
window.applyFinancesFilter = applyFinancesFilter;
window.resetFinancesFilters = resetFinancesFilters;
window.exportFinancesCSV = exportFinancesCSV;
window.getLevelInfo = getLevelInfo;
window.loadAchievementsData = loadAchievementsData;
window.renderAchievementsUI = renderAchievementsUI;
window.redeemFreeBoost = redeemFreeBoost;
window.renderSingleRentalCard = renderSingleRentalCard;
window.getActionButtonsForOwner = getActionButtonsForOwner;
window.getActionButtonsForRenter = getActionButtonsForRenter;
function updatePriceUnitLabel(type, value) {
    const badge = document.getElementById(`${type}-item-unit-badge`);
    if (badge) {
        badge.textContent = `/${value}`;
    }
}

window.updatePriceUnitLabel = updatePriceUnitLabel;
window.scrollToProfileReviews = scrollToProfileReviews;
window.openUserSettingsModal = openUserSettingsModal;
window.closeUserSettingsModal = closeUserSettingsModal;
window.handleSettingsAvatarSelect = handleSettingsAvatarSelect;
window.resetSettingsAvatarToDefault = resetSettingsAvatarToDefault;
window.handleSaveUserSettings = handleSaveUserSettings;
window.handleMultipleImagesSelect = handleMultipleImagesSelect;
window.renderImagesPreviewGrid = renderImagesPreviewGrid;
window.removeImageAtIndex = removeImageAtIndex;
window.makeImageCover = makeImageCover;
window.removeAllSelectedImages = removeAllSelectedImages;
window.changeItemModalImage = changeItemModalImage;
window.setItemModalImage = setItemModalImage;
window.updateModalCarouselView = updateModalCarouselView;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.changeLightboxImage = changeLightboxImage;
window.setLightboxImage = setLightboxImage;

// ─────────────────────────────────────────────────────────────────
// BÉRLÉSI NYOMTATVÁNY
// ─────────────────────────────────────────────────────────────────
function printRentalContract(rentalId) {
    // Megkeressük a bérlést a state-ben (incoming = bérbeadóként, outgoing = bérlőként)
    const allRentals = [
        ...(state.incomingRentals || []),
        ...(state.outgoingRentals || [])
    ];
    const r = allRentals.find(x => x.id == rentalId);
    if (!r) {
        alert('A bérlés adata nem található. Kérjük frissítsd az oldalt.');
        return;
    }

    const itemTitle   = (r.item_title || 'Eszköz').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const itemCat     = (r.item_category || '–').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const itemLoc     = (r.item_location || r.item_city || '–').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const startDate   = r.start_date || '–';
    const endDate     = r.end_date || r.start_date || '–';
    const units       = r.units_count || 1;
    const priceUnit   = r.item_price_unit || r.price_unit || 'nap';
    const totalPrice  = Number(r.total_price || 0).toLocaleString('hu-HU');
    const deposit     = Number(r.deposit || 0).toLocaleString('hu-HU');
    const rentalId_   = r.id || '–';
    const status      = r.status || '–';
    const now         = new Date();
    const printDate   = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

    const statusMap = {
        pending: 'Jóváhagyásra vár',
        accepted: 'Elfogadva – Átvételre vár',
        active: 'Folyamatban (Átadva)',
        completed: 'Lezárva – Sikeres visszaadás',
        cancelled: 'Lemondva',
        cancelled_no_show: 'Lemondva – Nem jelent meg'
    };
    const statusLabel = statusMap[status] || status;

    // QR kód URL (Google Charts QR API – ingyenes, nem kell külső csomag)
    const qrData = encodeURIComponent(`Kolcsonadlak.hu | Berles #${rentalId_} | ${itemTitle} | ${startDate} - ${endDate} | ${totalPrice} Ft`);
    const qrUrl  = `https://chart.googleapis.com/chart?cht=qr&chs=130x130&chl=${qrData}&choe=UTF-8`;

    const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bérleti Megállapodás – #${rentalId_}</title>
<style>
  @page { size: A4 portrait; margin: 2cm 2cm 2.5cm 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    color: #111;
    background: #fff;
    line-height: 1.55;
  }
  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2.5px solid #111;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .header-left h1 {
    font-size: 19pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .header-left p {
    font-size: 9pt;
    color: #555;
  }
  .header-right {
    text-align: right;
    font-size: 9pt;
    color: #555;
    line-height: 1.7;
  }
  .header-right strong {
    font-size: 10pt;
    color: #111;
  }
  /* Section titles */
  .section-title {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #111;
    padding-bottom: 3px;
    margin-bottom: 12px;
    margin-top: 20px;
  }
  /* Two column party layout */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 4px;
  }
  .party-box {
    border: 1px solid #aaa;
    border-radius: 4px;
    padding: 12px 14px;
  }
  .party-box h3 {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #ccc;
  }
  /* Field lines */
  .field {
    margin-bottom: 9px;
    font-size: 10pt;
  }
  .field label {
    display: block;
    font-size: 8.5pt;
    color: #555;
    margin-bottom: 1px;
  }
  .field .line {
    display: block;
    border-bottom: 1px solid #888;
    min-height: 18px;
    width: 100%;
  }
  /* Data table */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
    font-size: 10.5pt;
  }
  table.data-table td {
    padding: 6px 8px;
    border: 1px solid #bbb;
    vertical-align: top;
  }
  table.data-table td:first-child {
    width: 52%;
    color: #444;
    font-size: 9.5pt;
  }
  table.data-table td:last-child {
    font-weight: bold;
  }
  table.data-table tr.highlight td {
    background: #f5f5f5;
  }
  table.data-table tr.total td {
    border-top: 2px solid #444;
    font-size: 12pt;
  }
  /* Conditions */
  .conditions {
    font-size: 9.5pt;
    line-height: 1.65;
    color: #333;
    border: 1px solid #bbb;
    border-radius: 4px;
    padding: 12px 14px;
    margin-top: 6px;
  }
  .conditions li {
    margin-left: 16px;
    margin-bottom: 4px;
  }
  /* Signatures */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-top: 28px;
  }
  .sig-block {
    text-align: center;
  }
  .sig-line {
    border-top: 1.5px solid #333;
    margin-top: 52px;
    margin-bottom: 5px;
  }
  .sig-label {
    font-size: 9pt;
    color: #444;
  }
  .sig-date {
    font-size: 8.5pt;
    color: #888;
    margin-top: 14px;
  }
  .sig-date .line {
    display: inline-block;
    border-bottom: 1px solid #888;
    min-width: 140px;
  }
  /* QR + reference row */
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 24px;
    border-top: 1px solid #ccc;
    padding-top: 14px;
    font-size: 8.5pt;
    color: #666;
  }
  .footer-row .ref {
    line-height: 1.7;
  }
  .qr-block {
    text-align: center;
  }
  .qr-block img {
    display: block;
    width: 90px;
    height: 90px;
    margin: 0 auto 3px;
  }
  .qr-block span {
    font-size: 7.5pt;
    color: #888;
    display: block;
  }
  /* Print-only helpers */
  @media screen {
    body { background: #e8e8e8; }
    .page { background: #fff; max-width: 21cm; margin: 30px auto; padding: 2cm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    .print-btn {
      display: block;
      width: fit-content;
      margin: 0 auto 20px;
      padding: 10px 28px;
      background: #059669;
      color: #fff;
      font-family: sans-serif;
      font-size: 14px;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
  }
  @media print {
    body { background: #fff; }
    .page { padding: 0; box-shadow: none; }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Nyomtatás / PDF mentés</button>
<div class="page">

  <!-- FEJLÉC -->
  <div class="header">
    <div class="header-left">
      <h1>Bérleti Megállapodás</h1>
      <p>Kölcsönadlak.hu — Közösségi eszközkölcsönzési platform</p>
    </div>
    <div class="header-right">
      <strong>Bérlés azonosítója: #${rentalId_}</strong><br>
      Státusz: ${statusLabel}<br>
      Nyomtatva: ${printDate}
    </div>
  </div>

  <!-- A FELEK ADATAI -->
  <div class="section-title">A felek adatai</div>
  <div class="parties">
    <div class="party-box">
      <h3>Bérbeadó (Eszköz tulajdonosa)</h3>
      <div class="field">
        <label>Teljes neve</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Lakcíme</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Személyigazolvány száma</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Telefonszáma</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>E-mail címe</label>
        <span class="line"></span>
      </div>
    </div>
    <div class="party-box">
      <h3>Bérlő</h3>
      <div class="field">
        <label>Teljes neve</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Lakcíme</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Személyigazolvány száma</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Telefonszáma</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>E-mail címe</label>
        <span class="line"></span>
      </div>
    </div>
  </div>

  <!-- ESZKÖZ ÉS BÉRLÉS ADATAI -->
  <div class="section-title">Az eszköz és a bérlés adatai</div>
  <table class="data-table">
    <tr>
      <td>Eszköz neve</td>
      <td>${itemTitle}</td>
    </tr>
    <tr class="highlight">
      <td>Kategória</td>
      <td>${itemCat}</td>
    </tr>
    <tr>
      <td>Eszköz helyszíne / átadási körzetje</td>
      <td>${itemLoc}</td>
    </tr>
    <tr class="highlight">
      <td>Bérlés kezdete</td>
      <td>${startDate}</td>
    </tr>
    <tr>
      <td>Bérlés vége (visszaadás várható napja)</td>
      <td>${endDate}</td>
    </tr>
    <tr class="highlight">
      <td>Bérlés időtartama</td>
      <td>${units} ${priceUnit}</td>
    </tr>
    <tr class="total">
      <td>Bérleti díj (átadáskor, készpénzben)</td>
      <td>${totalPrice} Ft</td>
    </tr>
    <tr>
      <td>Kaució összege (visszaadáskor visszajár)</td>
      <td>${deposit} Ft</td>
    </tr>
  </table>

  <!-- ÁTADÁS / VISSZAADÁS ADATAI -->
  <div class="section-title">Átadás és visszaadás helyszíne, időpontja</div>
  <div class="parties">
    <div class="party-box">
      <h3>Átadás</h3>
      <div class="field">
        <label>Helyszín (cím)</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Időpont</label>
        <span class="line"></span>
      </div>
    </div>
    <div class="party-box">
      <h3>Visszaadás</h3>
      <div class="field">
        <label>Helyszín (cím)</label>
        <span class="line"></span>
      </div>
      <div class="field">
        <label>Időpont</label>
        <span class="line"></span>
      </div>
    </div>
  </div>

  <!-- AZ ESZKÖZ ÁLLAPOTA ÁTADÁSKOR -->
  <div class="section-title">Az eszköz állapota átadáskor</div>
  <div class="conditions" style="min-height:54px;">
    <span style="font-size:8.5pt;color:#888;">(Az esetleges korábbi hibákat, sérüléseket itt rögzítsék a felek — pl. karcolás, hiányzó alkatrész stb.)</span><br><br>
  </div>

  <!-- ÁLTALÁNOS FELTÉTELEK -->
  <div class="section-title">Általános feltételek</div>
  <div class="conditions">
    <ul>
      <li>A bérlő az eszközt kizárólag rendeltetésszerűen és a bérbeadó által meghatározott feltételek szerint használhatja.</li>
      <li>A bérlő köteles az eszközt az átadáskori állapotban és tisztán visszaszolgáltatni.</li>
      <li>Az eszközben a bérlési idő alatt keletkező kárért a bérlő anyagi felelősséggel tartozik.</li>
      <li>A kaució visszajár a bérlőnek, amennyiben az eszköz hiánytalanul és sérülésmentesen kerül visszaadásra.</li>
      <li>A bérleti díj (és kaució) készpénzben kerül rendezésre az eszköz átadásakor, hacsak a felek másban nem állapodnak meg.</li>
      <li>A megállapodást a Kölcsönadlak.hu platform közvetítette; a felekre vonatkozó jogszabályok (különösen a Polgári Törvénykönyv bérleti szerződésre vonatkozó rendelkezései) irányadók.</li>
      <li>A jelen megállapodás két eredeti példányban készül — egy-egy példány a bérbeadót és a bérlőt illeti.</li>
    </ul>
  </div>

  <!-- ALÁÍRÁSOK -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label"><strong>Bérbeadó aláírása</strong></div>
      <div class="sig-date">Kelt: <span class="line"></span></div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label"><strong>Bérlő aláírása</strong></div>
      <div class="sig-date">Kelt: <span class="line"></span></div>
    </div>
  </div>

  <!-- LÁBLÉC: QR KÓD + HIVATKOZÁS -->
  <div class="footer-row">
    <div class="ref">
      <strong>Kölcsönadlak.hu</strong> — Közösségi eszközkölcsönzési platform<br>
      Bérlés azonosítója: <strong>#${rentalId_}</strong><br>
      Nyomtatva: ${printDate}<br>
      <span style="font-size:7.5pt;">Ez a nyomtatvány tájékoztató jellegű. A felek felelőssége a valóság alapján kitölteni.</span>
    </div>
    <div class="qr-block">
      <img src="${qrUrl}" alt="QR kód" onerror="this.style.display='none'">
      <span>Bérlés #${rentalId_} azonosítója</span>
    </div>
  </div>

</div><!-- /page -->
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
    if (!popup) {
        alert('A nyomtatvány megnyitásához engedélyezd a felugró ablakokat a böngésződben!');
        return;
    }
    popup.document.write(html);
    popup.document.close();
    // Kis késleltetés után automatikusan megnyílik a nyomtatási párbeszédablak
    popup.onload = function () {
        setTimeout(() => popup.print(), 400);
    };
}

window.printRentalContract = printRentalContract;
