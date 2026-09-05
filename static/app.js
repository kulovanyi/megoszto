// MegosztÓ (megoszto.hu) - Közösségi Eszközmegosztó Platform Logika

// Firebase Konfiguráció (kolcsonado projekt)
const firebaseConfig = {
    apiKey: "AIzaSyCZqV24fltN672ySbrw28dxEPGcNFi06zE",
    authDomain: "kolcsonado.firebaseapp.com",
    projectId: "kolcsonado",
    storageBucket: "kolcsonado.firebasestorage.app",
    messagingSenderId: "1072705116754",
    appId: "1:1072705116754:web:1d83adf419b58721e09d8b",
    measurementId: "G-Y32BGKZRQK"
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
        name: "Ingyenes Alap",
        price: 0,
        max_items: 1,
        badge: "Kezdő",
        features: ["1 eszköz ingyenes meghirdetése", "Alap megjelenés", "Bérleti kalkulátor", "Közösségi értékelések"]
    },
    {
        id: "starter_3",
        name: "Kertbarát Csomag",
        price: 1490,
        max_items: 3,
        badge: "Népszerű",
        features: ["Akár 3 eszköz meghirdetése", "Gyorsabb foglalás", "Kiemelt kategória pozíció", "0-24 ügyféltámogatás"]
    },
    {
        id: "pro_10",
        name: "Ezermester Csomag",
        price: 3990,
        max_items: 10,
        badge: "Legjobb érték",
        features: ["Akár 10 eszköz meghirdetése", "Kiemelt hirdetési helyek", "Közvetlen kapcsolattartási fülke", "Részletes statisztikák"]
    },
    {
        id: "unlimited",
        name: "Profi Kölcsönző",
        price: 7990,
        max_items: 9999,
        badge: "Korlátlan",
        features: ["Végtelen számú szerszám és gép", "Legmagasabb keresési rangsorolás", "VIP kiemelt profil", "Egyedi céges elérhetőségek"]
    }
];

const state = {
    currentUser: null,
    items: [],
    plans: [...DEFAULT_PLANS],
    categories: ['Mind', 'Kertészet', 'Barkácsolás', 'Takarítás', 'Építkezés', 'Autó & Garázs', 'Rendezvény & Hobbi'],
    selectedCategory: 'Mind',
    selectedUnit: 'Mind',
    searchQuery: '',
    maxPrice: '',
    locationFilter: '',
    activeTab: 'browse', // 'browse', 'dashboard', 'admin', 'messages'
    dashboardSubTab: 'incoming', // 'incoming', 'outgoing'
    selectedItem: null,
    selectedImageFile: null,
    messagesFolder: 'inbox', // 'inbox', 'archived'
    conversations: [],
    activeConversationId: null,
    activeConversation: null,
    activeMessages: [],
    unreadMessagesCount: 0,
    pendingRentalsCount: 0,
    draftPartner: null,
    draftItem: null,
    calculator: {
        units: 1,
        startDate: '',
        endDate: '',
        note: ''
    }
};

// --- INICIALIZÁLÁS ---
document.addEventListener('DOMContentLoaded', async () => {
    try { initClientFirebase(); } catch (e) { console.warn('Firebase init:', e); }
    try { setInitialDates(); } catch (e) {}
    try { setupEventListeners(); } catch (e) { console.error('Setup listeners:', e); }
    try { await loadPlans(); } catch (e) {}
    try { await loadCities(); } catch (e) {}
    try { await initAuth(); } catch (e) {}
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

function initAllCityAutocompletes() {
    const ids = ['location-input', 'new-item-location', 'reg-city'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) setupCityAutocomplete(el);
    });

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

async function initAuth() {
    let storedUserId = localStorage.getItem('kolcsonado_user_id');
    if (!storedUserId || storedUserId === '2') {
        storedUserId = '1';
        localStorage.setItem('kolcsonado_user_id', '1');
    }
    try {
        const res = await fetch(`/api/auth/me?user_id=${storedUserId}`);
        if (res.ok) {
            state.currentUser = await res.json();
        } else {
            const fallbackRes = await fetch(`/api/auth/me?user_id=1`);
            if (fallbackRes.ok) {
                state.currentUser = await fallbackRes.json();
                localStorage.setItem('kolcsonado_user_id', '1');
            }
        }
    } catch (err) {
        console.error('Auth helyreállítási hiba:', err);
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
        if (!menu.contains(e.target) && !trigger?.contains(e.target)) {
            toggleUserDropdown(false);
        }
    }
});

function renderAuthUI() {
    const loggedInBox = document.getElementById('auth-logged-in');
    const loggedOutBox = document.getElementById('auth-logged-out');
    const nameEl = document.getElementById('current-user-name');
    const avatarEl = document.getElementById('current-user-avatar');
    const dropdownAvatar = document.getElementById('dropdown-user-avatar');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownEmail = document.getElementById('dropdown-user-email');
    const dropdownAdminBtn = document.getElementById('dropdown-admin-btn');
    const adminBtn = document.getElementById('admin-nav-btn');

    if (state.currentUser) {
        if (loggedInBox) loggedInBox.classList.remove('hidden');
        if (loggedOutBox) loggedOutBox.classList.add('hidden');

        let providerBadge = '';
        if (state.currentUser.auth_provider === 'google') {
            providerBadge = `<span title="Google-fiókkal bejelentkezve" class="inline-flex items-center text-[10px] ml-1 text-slate-400"><i class="fa-brands fa-google text-red-500"></i></span>`;
        } else if (state.currentUser.auth_provider === 'facebook') {
            providerBadge = `<span title="Facebookkal bejelentkezve" class="inline-flex items-center text-[10px] ml-1 text-slate-400"><i class="fa-brands fa-facebook text-blue-600"></i></span>`;
        }

        const avatarSrc = state.currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${state.currentUser.name}`;

        if (nameEl) nameEl.innerHTML = `${state.currentUser.name} ${providerBadge}`;
        if (avatarEl) avatarEl.src = avatarSrc;

        if (dropdownAvatar) dropdownAvatar.src = avatarSrc;
        if (dropdownName) dropdownName.innerHTML = `${state.currentUser.name} ${providerBadge}`;
        if (dropdownEmail) dropdownEmail.textContent = state.currentUser.email || 'Bejelentkezve';

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
        showToast(`Sikeres regisztráció! 1 ingyenes hirdetés aktiválva.`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function quickLogin(email) {
    await quickLoginUser(email);
}

async function quickLoginUser(email) {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = email;
    if (passInput) passInput.value = 'password';

    try {
        const res = await fetch('/api/auth/quick-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hiba a gyors bejelentkezéskor');
        }

        const data = await res.json();
        state.currentUser = data.user;
        localStorage.setItem('kolcsonado_user_id', data.user.id);
        
        closeAuthModal();
        renderAuthUI();
        
        const isFree = (data.user.subscription_plan === 'free');
        const planText = isFree ? 'Ingyenes Alap fiók' : 'Pro fiók';
        showToast(`Sikeres bejelentkezés: ${data.user.name} (${planText})`, 'success');

        await refreshCurrentUser();
        if (state.activeTab === 'dashboard') {
            loadDashboardData();
        } else if (state.activeTab === 'messages') {
            loadMessagesData(state.messagesFolder);
        }
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

// --- KÉPFELTÖLTÉS KEZELÉSE ---

function handleImageFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.selectedImageFile = file;

    // Helyi előnézet azonnal FileReader-rel
    const reader = new FileReader();
    reader.onload = (event) => {
        const previewImg = document.getElementById('image-preview');
        const previewContainer = document.getElementById('image-preview-container');
        const dropzone = document.getElementById('upload-dropzone');

        if (previewImg) previewImg.src = event.target.result;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (dropzone) dropzone.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removeSelectedImage() {
    state.selectedImageFile = null;
    const fileInput = document.getElementById('new-item-file');
    const previewContainer = document.getElementById('image-preview-container');
    const dropzone = document.getElementById('upload-dropzone');
    const previewImg = document.getElementById('image-preview');

    if (fileInput) fileInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (dropzone) dropzone.classList.remove('hidden');
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
        case 'Kertészet': return '🌱';
        case 'Barkácsolás': return '🔨';
        case 'Takarítás': return '✨';
        case 'Építkezés': return '🏗️';
        case 'Autó & Garázs': return '🚗';
        case 'Rendezvény & Hobbi': return '🎉';
        default: return '📦';
    }
}

function renderItems() {
    const grid = document.getElementById('items-grid');
    const countEl = document.getElementById('items-count');
    if (!grid) return;

    if (!Array.isArray(state.items)) {
        state.items = [];
    }

    if (countEl) countEl.textContent = `${state.items.length} db elérhető eszköz`;

    if (state.items.length === 0) {
        const hasFilters = state.searchQuery || (state.selectedCategory && state.selectedCategory !== 'Mind') || (state.selectedUnit && state.selectedUnit !== 'Mind') || state.maxPrice || state.locationFilter;
        if (hasFilters) {
            grid.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-4">
                        <i class="fa-solid fa-toolbox text-2xl"></i>
                    </div>
                    <h3 class="text-lg font-bold text-slate-800 mb-1">Nincs találat a megadott feltételekre</h3>
                    <p class="text-slate-500 text-sm mb-4">Próbáld meg módosítani a keresési kulcsszót vagy a szűrőket!</p>
                    <button onclick="resetFilters()" class="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-emerald-700 transition-colors">
                        Szűrők törlése
                    </button>
                </div>
            `;
        } else {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 mb-4 shadow-inner">
                        <i class="fa-solid fa-hand-holding-hand text-3xl"></i>
                    </div>
                    <h3 class="text-xl font-extrabold text-slate-900 mb-2">Még nincsenek feltöltött eszközök</h3>
                    <p class="text-slate-500 text-sm max-w-md mx-auto mb-6">
                        Az oldal készen áll. Légy te az első bérbeadó: add bérbe a nem használt gépeidet, szerszámaidat egyszerűen!
                    </p>
                    <button onclick="openNewItemModal()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all inline-flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Első hirdetés feladása
                    </button>
                </div>
            `;
        }
        return;
    }

    grid.innerHTML = state.items.map(item => {
        const ownerName = item.owner_name || 'Bérbeadó';
        const ownerFirstName = ownerName.split(' ')[0] || ownerName;
        const ownerAvatar = item.owner_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(ownerName)}`;
        const price = Number(item.price) || 0;
        const deposit = Number(item.deposit) || 0;
        const priceUnit = item.price_unit || 'nap';
        const location = item.location || 'Budapest';
        const condition = item.condition || 'Kiváló állapotú';
        const category = item.category || 'Egyéb';
        const title = item.title || 'Eszköz';
        const description = item.description || '';
        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80';

        return `
        <div class="item-card bg-white rounded-2xl overflow-hidden ${
            item.is_featured 
            ? 'border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg relative bg-gradient-to-b from-amber-50/20 to-white' 
            : 'border border-slate-200/80 shadow-sm'
        } flex flex-col cursor-pointer transition-all hover:-translate-y-1" onclick="openItemModal(${item.id})">
            <!-- Kép és jelvények -->
            <div class="relative h-48 w-full bg-slate-100 overflow-hidden">
                <img src="${imgUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300" onerror="this.src='https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80'">
                
                ${item.is_featured ? `
                    <div class="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-3 py-1 rounded-full text-[11px] shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                        <i class="fa-solid fa-bolt text-yellow-200"></i> KIEMELT
                    </div>
                    <div class="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md text-white font-bold px-3 py-1 rounded-full text-xs shadow-md">
                        ${price.toLocaleString('hu-HU')} Ft / ${priceUnit}
                    </div>
                ` : `
                    <div class="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-slate-700 shadow-sm">
                        ${category}
                    </div>
                    <div class="absolute top-3 right-3 bg-emerald-700 text-white font-bold px-3 py-1 rounded-full text-xs shadow-md">
                        ${price.toLocaleString('hu-HU')} Ft / ${priceUnit}
                    </div>
                `}

                ${deposit > 0 ? `
                    <div class="absolute bottom-3 right-3 bg-amber-500/90 backdrop-blur-md text-white font-medium px-2 py-0.5 rounded text-[11px] shadow-sm">
                        Kaució: ${deposit.toLocaleString('hu-HU')} Ft
                    </div>
                ` : ''}
            </div>

            <!-- Tartalom -->
            <div class="p-5 flex-1 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span class="flex items-center gap-1 font-medium text-slate-600">
                            <i class="fa-solid fa-location-dot text-emerald-600"></i> ${location}
                        </span>
                        <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[11px]">${condition}</span>
                    </div>
                    <h3 class="font-bold text-slate-900 text-base line-clamp-1 hover:text-emerald-600 transition-colors mb-2">${title}</h3>
                    <p class="text-slate-600 text-xs line-clamp-2 mb-4 leading-relaxed">${description}</p>
                </div>

                <!-- Bérbeadó sáv -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <img src="${ownerAvatar}" class="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200">
                        <div>
                            <p class="text-xs font-semibold text-slate-800 leading-tight">${ownerFirstName}</p>
                            <div class="flex items-center gap-1 text-[11px] text-amber-500">
                                <i class="fa-solid fa-star text-[10px]"></i>
                                <span class="font-bold text-slate-700">${item.owner_rating || 5.0}</span>
                            </div>
                        </div>
                    </div>

                    <button class="px-3 py-1.5 ${item.is_featured ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'} rounded-lg text-xs font-bold transition-colors">
                        Bérlés <i class="fa-solid fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
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

    const currentPlanId = state.currentUser ? state.currentUser.subscription_plan : 'free';

    container.innerHTML = state.plans.map(plan => {
        const isCurrent = currentPlanId === plan.id;
        const isPopular = plan.id === 'starter_3';
        const isPro = plan.id === 'pro_10';
        const isUnlimited = plan.id === 'unlimited';

        let borderClass = isCurrent 
            ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' 
            : isPopular 
                ? 'border-2 border-amber-400 bg-amber-50/10' 
                : 'border border-slate-200 bg-white';

        return `
            <div class="rounded-3xl p-6 flex flex-col justify-between ${borderClass} transition-all hover:shadow-lg relative">
                ${isCurrent ? `
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow">
                        Aktuális Csomagod
                    </div>
                ` : isPopular ? `
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow">
                        Legnépszerűbb
                    </div>
                ` : ''}

                <div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            isUnlimited ? 'bg-amber-100 text-amber-800' : isPro ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }">${plan.badge}</span>
                    </div>

                    <h4 class="text-lg font-black text-slate-900 mb-1">${plan.name}</h4>
                    <div class="mb-2">
                        <span class="text-2xl font-extrabold text-slate-900">
                            ${plan.price === 0 ? '0 Ft' : plan.price.toLocaleString('hu-HU') + ' Ft'}
                        </span>
                        <span class="text-xs text-slate-500 font-medium">${plan.price === 0 ? '/ örökre' : '/ hó'}</span>
                    </div>
                    ${plan.price > 0 ? `
                        <div class="mb-4 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <i class="fa-solid fa-arrows-rotate text-[10px]"></i> Havi automatikus megújulás
                        </div>
                    ` : '<div class="mb-4 text-[11px] text-slate-400">Örökre ingyenes alapfiók</div>'}

                    <div class="py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100 mb-5 text-center">
                        <span class="text-xs font-black text-emerald-700">
                            ${plan.max_items >= 9000 ? '✨ Végtelen feltölthető termék' : `📦 Maximum ${plan.max_items} db termék`}
                        </span>
                    </div>

                    <ul class="space-y-2.5 text-xs text-slate-600 mb-6">
                        ${plan.features.map(f => `
                            <li class="flex items-start gap-2">
                                <i class="fa-solid fa-check text-emerald-600 mt-0.5 text-xs"></i>
                                <span>${f}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div>
                    ${isCurrent ? `
                        <button disabled class="w-full py-2.5 px-4 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs cursor-default">
                            ✓ Ez az aktív csomagod
                        </button>
                    ` : `
                        <button onclick="selectPlan('${plan.id}')" class="w-full py-2.5 px-4 ${
                            isPopular || isUnlimited 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20' 
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        } font-bold rounded-xl text-xs transition-all">
                            ${plan.price === 0 ? 'Váltás Ingyenesre' : 'Előfizetés erre (Havidíjas)'}
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
        openAuthModal('login');
        return;
    }

    if (planId === 'free') {
        try {
            const res = await fetch(`/api/users/${state.currentUser.id}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: 'free' })
            });
            if (!res.ok) throw new Error('Hiba az ingyenes csomagra való váltáskor');
            const data = await res.json();
            showToast(data.message, 'success');
            await refreshCurrentUser();
            closeSubscriptionModal();
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
        
        state.calculator.units = 1;
        state.calculator.note = '';
        setInitialDates();

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
}

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

    const modalBody = document.getElementById('item-modal-content');
    modalBody.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div class="lg:col-span-7 space-y-6">
                <div class="relative h-72 sm:h-80 rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                    <img src="${item.image_url}" alt="${item.title}" class="w-full h-full object-cover">
                    <div class="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow">
                        ${item.category}
                    </div>
                    <div class="absolute top-4 right-4 bg-emerald-600 text-white px-3.5 py-1.5 rounded-full text-sm font-extrabold shadow-lg">
                        ${item.price.toLocaleString('hu-HU')} Ft / ${item.price_unit}
                    </div>
                </div>

                <div>
                    <h2 class="text-2xl font-extrabold text-slate-900 mb-2">${item.title}</h2>
                    <div class="flex flex-wrap items-center gap-3 text-sm text-slate-600 mb-4">
                        <span class="flex items-center gap-1.5 font-medium"><i class="fa-solid fa-location-dot text-emerald-600"></i> ${item.location}</span>
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs">Állapot: ${item.condition}</span>
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span class="text-emerald-700 font-semibold flex items-center gap-1"><i class="fa-solid fa-check-circle"></i> Bérelhető és elérhető</span>
                    </div>

                    <!-- 📅 FOGLALTSÁGI NAPTÁR & ELÉRHETŐSÉG DOBOZ -->
                    <div class="mb-5 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/20 border border-slate-200">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <i class="fa-solid fa-calendar-days text-emerald-600"></i> Foglaltsági Naptár & Elérhetőség
                            </h4>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${bookedRanges.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                                ${bookedRanges.length > 0 ? `${bookedRanges.length} foglalt időszak` : 'Teljesen szabad'}
                            </span>
                        </div>

                        ${bookedRanges.length > 0 ? `
                            <div class="space-y-1.5 mt-2">
                                <p class="text-[11px] text-slate-600 font-medium">A termék fennmarad és bérelhető, de az alábbi időpontok már le vannak kötve:</p>
                                <div class="flex flex-wrap gap-2 pt-1">
                                    ${bookedRanges.map(r => `
                                        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-lg shadow-sm">
                                            <i class="fa-solid fa-ban text-rose-500 text-[11px]"></i>
                                            <span>${r.start_date} – ${r.end_date}</span>
                                            <span class="text-[10px] uppercase font-black bg-rose-200 text-rose-900 px-1 rounded">Foglalt</span>
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="text-[11px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
                                    <i class="fa-solid fa-circle-check text-emerald-600"></i> Minden más dátumra szabadon és azonnal leadható bérlés!
                                </p>
                            </div>
                        ` : `
                            <div class="flex items-center gap-2 text-xs text-emerald-800 font-bold mt-1">
                                <i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                                <span>Nincsenek meglévő foglalások! Bármilyen napra azonnal kibérelheted.</span>
                            </div>
                        `}
                    </div>

                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line mb-6">
                        ${item.description}
                    </div>

                    <div class="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <img src="${item.owner_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + item.owner_name}" class="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-slate-900 text-sm">${item.owner_name}</h4>
                                    <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200 inline-flex items-center gap-1">
                                        <i class="fa-solid fa-shield-halved text-emerald-600"></i> Megbízható Partner
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500">${item.owner_city || item.location}</p>
                                <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 mt-1">
                                    <span class="text-amber-500 font-bold flex items-center gap-1">
                                        <i class="fa-solid fa-star"></i> ${item.owner_rating || 5.0} (${item.owner_reviews_count || 0})
                                    </span>
                                    <span>•</span>
                                    <span class="font-semibold text-emerald-700 flex items-center gap-1">
                                        <i class="fa-solid fa-handshake"></i> ${item.owner_completed_as_owner || 0} sikeres kiadás
                                    </span>
                                    <span>•</span>
                                    <span class="font-semibold text-teal-700 flex items-center gap-1">
                                        <i class="fa-solid fa-cart-shopping"></i> ${item.owner_completed_as_renter || 0} sikeres bérlés
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 justify-end shrink-0">
                            <button onclick="openChatFromItem(${item.user_id}, ${item.id}, '${encodeURIComponent(item.title)}')" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20">
                                <i class="fa-solid fa-comments"></i> Üzenet a bérbeadónak
                            </button>
                            <a href="tel:${item.owner_phone || ''}" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-sm">
                                <i class="fa-solid fa-phone text-emerald-600"></i> Telefon
                            </a>
                        </div>
                    </div>

                    <div class="mt-6">
                        <h4 class="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                            <i class="fa-solid fa-comments text-emerald-600"></i> Korábbi bérlők véleményei (${item.reviews ? item.reviews.length : 0})
                        </h4>
                        ${item.reviews && item.reviews.length > 0 ? `
                            <div class="space-y-3">
                                ${item.reviews.map(r => `
                                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                        <div class="flex items-center justify-between mb-1.5">
                                            <div class="flex items-center gap-2">
                                                <img src="${r.reviewer_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + r.reviewer_name}" class="w-6 h-6 rounded-full">
                                                <span class="font-bold text-xs text-slate-800">${r.reviewer_name}</span>
                                            </div>
                                            <div class="text-amber-500 text-xs font-bold flex items-center gap-0.5">
                                                ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                                            </div>
                                        </div>
                                        <p class="text-xs text-slate-600 italic">"${r.comment}"</p>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <p class="text-xs text-slate-400 italic">Még nem érkezett értékelés erre az eszközre. Legyél te az első bérlő!</p>
                        `}
                    </div>
                </div>
            </div>

            <div class="lg:col-span-5">
                <div class="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-6 rounded-2xl border-2 border-emerald-500/20 shadow-lg sticky top-6">
                    <div class="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
                        <span class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Bérleti Kalkulátor</span>
                        <span class="text-lg font-black text-slate-900">${item.price.toLocaleString('hu-HU')} Ft <span class="text-xs font-semibold text-slate-500">/${item.price_unit}</span></span>
                    </div>

                    <form id="rental-form" onsubmit="submitRentalRequest(event)" class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1.5">
                                Bérlési időtartam (${item.price_unit === 'nap' ? 'Napok száma' : item.price_unit === 'óra' ? 'Órák száma' : item.price_unit === 'munka' ? 'Alkalmak száma' : 'Hétvégék száma'}):
                            </label>
                            <div class="flex items-center gap-3">
                                <button type="button" onclick="updateCalculatorUnits(-1)" class="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm text-lg">-</button>
                                <input type="number" id="calc-units" min="1" max="90" value="${state.calculator.units}" onchange="setCalculatorUnits(this.value)" class="flex-1 h-10 text-center font-bold text-base text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm">
                                <button type="button" onclick="updateCalculatorUnits(1)" class="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm text-lg">+</button>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1.5">Kezdés dátuma:</label>
                                <input type="date" id="calc-start-date" min="${today}" value="${state.calculator.startDate}" onchange="handleRentalDateChange()" required class="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1.5">Várható visszahozatal:</label>
                                <input type="date" id="calc-end-date" min="${today}" value="${state.calculator.endDate}" onchange="handleRentalDateChange()" class="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm">
                            </div>
                        </div>

                        <!-- ÉLŐ DÁTUM ÜTKÖZÉS JELZŐ SÁV -->
                        <div id="calc-conflict-warning" class="hidden p-3 rounded-xl border text-xs font-bold transition-all"></div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1.5">Megjegyzés / Átvételi kérés:</label>
                            <textarea id="calc-note" rows="2" placeholder="Pl. Szombat reggel 9-kor érte tudok menni..." class="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm resize-none"></textarea>
                        </div>

                        <div class="bg-white p-4 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                            <div class="flex justify-between text-slate-600">
                                <span>Bérleti díj (<span id="calc-summary-units">${state.calculator.units}</span> ${item.price_unit} × ${item.price.toLocaleString('hu-HU')} Ft):</span>
                                <span id="calc-rent-total" class="font-bold text-slate-800">${(state.calculator.units * item.price).toLocaleString('hu-HU')} Ft</span>
                            </div>
                            <div class="flex justify-between text-slate-600">
                                <span>Kaució (visszajár épségben való visszaadáskor):</span>
                                <span class="font-semibold text-amber-700">${item.deposit.toLocaleString('hu-HU')} Ft</span>
                            </div>
                            <div class="border-t border-slate-100 pt-2.5 flex justify-between items-baseline">
                                <span class="font-bold text-slate-900 text-sm">Fizetendő átvételkor a felek között:</span>
                                <span id="calc-grand-total" class="font-black text-emerald-600 text-lg">${(state.calculator.units * item.price + item.deposit).toLocaleString('hu-HU')} Ft</span>
                            </div>
                        </div>

                        <button type="submit" id="rental-submit-btn" class="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm">
                            <i class="fa-solid fa-handshake"></i> Bérlési Kérelem Küldése
                        </button>
                        <p class="text-[11px] text-center text-slate-500">
                            A fizetés és átadás közvetlenül a két fél között zajlik átvételkor.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Initialize conflict check right away
    handleRentalDateChange();
}

function handleRentalDateChange() {
    const startInput = document.getElementById('calc-start-date');
    const endInput = document.getElementById('calc-end-date');
    if (!startInput || !endInput) return;

    state.calculator.startDate = startInput.value;
    state.calculator.endDate = endInput.value;

    // Ha az end_date üres vagy kisebb mint start_date, igazítsuk
    if (state.calculator.endDate && state.calculator.endDate < state.calculator.startDate) {
        state.calculator.endDate = state.calculator.startDate;
        endInput.value = state.calculator.endDate;
    }

    recalculatePrice();
}

function updateCalculatorUnits(delta) {
    const newUnits = Math.max(1, state.calculator.units + delta);
    setCalculatorUnits(newUnits);
}

function setCalculatorUnits(val) {
    state.calculator.units = Math.max(1, parseInt(val) || 1);
    const input = document.getElementById('calc-units');
    if (input) input.value = state.calculator.units;
    
    // Auto sync end date based on units if units changed
    if (state.calculator.startDate) {
        const start = new Date(state.calculator.startDate);
        if (!isNaN(start.getTime())) {
            const end = new Date(start);
            end.setDate(end.getDate() + (state.calculator.units - 1));
            state.calculator.endDate = end.toISOString().split('T')[0];
            const endInput = document.getElementById('calc-end-date');
            if (endInput) endInput.value = state.calculator.endDate;
        }
    }

    recalculatePrice();
}

function recalculatePrice() {
    if (!state.selectedItem) return;
    const item = state.selectedItem;
    const units = state.calculator.units;
    const rentTotal = units * item.price;
    const grandTotal = rentTotal + item.deposit;

    const summaryUnits = document.getElementById('calc-summary-units');
    const rentTotalEl = document.getElementById('calc-rent-total');
    const grandTotalEl = document.getElementById('calc-grand-total');

    if (summaryUnits) summaryUnits.textContent = units;
    if (rentTotalEl) rentTotalEl.textContent = `${rentTotal.toLocaleString('hu-HU')} Ft`;
    if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toLocaleString('hu-HU')} Ft`;

    // Élő ütközés vizsgálat
    const warningEl = document.getElementById('calc-conflict-warning');
    const submitBtn = document.getElementById('rental-submit-btn');
    const conflict = checkRentalDateCollision(item, state.calculator.startDate, state.calculator.endDate);

    if (conflict) {
        if (warningEl) {
            warningEl.className = 'p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-start gap-2 animate-shake';
            warningEl.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation text-rose-600 text-sm mt-0.5 shrink-0"></i>
                <div>
                    <div>⚠️ A kiválasztott időszak (${state.calculator.startDate} – ${state.calculator.endDate}) ütközik egy már lefoglalt időponttal:</div>
                    <div class="mt-1 font-black text-rose-900">🔴 ${conflict.start_date} – ${conflict.end_date} (Foglalt)</div>
                    <div class="mt-1 font-normal text-rose-700">Kérlek válassz olyan kezdő és végdátumot, ami nem esik a foglalt napok közé!</div>
                </div>
            `;
            warningEl.classList.remove('hidden');
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.className = 'w-full py-3.5 px-4 bg-slate-300 text-slate-500 font-extrabold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-none';
            submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Erre a Dátumra Már Foglalt';
        }
    } else {
        if (warningEl) {
            warningEl.className = 'p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2';
            warningEl.innerHTML = `
                <i class="fa-solid fa-circle-check text-emerald-600 text-sm shrink-0"></i>
                <span>✅ Szabad időpont! (${state.calculator.startDate} – ${state.calculator.endDate})</span>
            `;
            warningEl.classList.remove('hidden');
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.className = 'w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm';
            submitBtn.innerHTML = '<i class="fa-solid fa-handshake"></i> Bérlési Kérelem Küldése';
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

    const startDate = document.getElementById('calc-start-date')?.value || state.calculator.startDate;
    const endDate = document.getElementById('calc-end-date')?.value || state.calculator.endDate;

    // Kliensoldali ütközés ellenőrzés
    const conflict = checkRentalDateCollision(state.selectedItem, startDate, endDate);
    if (conflict) {
        showToast(`⚠️ Ez az eszköz a megadott időszakban (${conflict.start_date} – ${conflict.end_date}) már le van foglalva! Kérlek válassz másik szabad időpontot.`, 'error');
        return;
    }

    const note = document.getElementById('calc-note')?.value || '';
    const units = state.calculator.units;
    const totalPrice = units * state.selectedItem.price;

    const payload = {
        item_id: state.selectedItem.id,
        renter_id: state.currentUser.id,
        start_date: startDate,
        end_date: endDate,
        units_count: units,
        total_price: totalPrice,
        deposit: state.selectedItem.deposit,
        note: note
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
        showToast('🎉 Bérlési kérelem sikeresen elküldve a bérbeadónak!', 'success');
        
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

    removeSelectedImage();
    const modal = document.getElementById('new-item-modal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('overflow-hidden');
    
    const locationInput = document.getElementById('new-item-location');
    if (locationInput && state.currentUser.city) {
        locationInput.value = state.currentUser.city;
    }
}

function closeNewItemModal() {
    const modal = document.getElementById('new-item-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    removeSelectedImage();
}

async function submitNewItem(e) {
    e.preventDefault();
    if (!state.currentUser) {
        openAuthModal('login');
        return;
    }

    const submitBtn = document.getElementById('submit-item-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Feltöltés...`;
    }

    let imageUrl = '';

    // 1. Ha a felhasználó tallózott be képet a gépéről, töltsük fel a szerverre
    if (state.selectedImageFile) {
        try {
            const formData = new FormData();
            formData.append('file', state.selectedImageFile);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.url;
            } else {
                console.warn('Képfeltöltés sikertelen, alapértelmezett képet használunk');
            }
        } catch (uploadErr) {
            console.error('Képfeltöltési hiba:', uploadErr);
        }
    }

    const form = e.target;
    const title = form['title'].value;
    const category = form['category'].value;
    const description = form['description'].value;
    const price = parseInt(form['price'].value);
    const price_unit = form['price_unit'].value;
    const deposit = parseInt(form['deposit'].value || 0);
    const location = form['location'].value;
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
        image_url: imageUrl
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
        closeNewItemModal();
        showToast('✨ Hirdetésed a fotóval sikeresen megjelent az oldalon!', 'success');
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
        document.getElementById('edit-item-price-unit').value = currentEditingItem.price_unit;
        document.getElementById('edit-item-deposit').value = currentEditingItem.deposit || 0;
        document.getElementById('edit-item-location').value = currentEditingItem.location;
        document.getElementById('edit-item-description').value = currentEditingItem.description;

        const modal = document.getElementById('edit-item-modal');
        if (modal) modal.style.display = 'flex';
        document.body.classList.add('overflow-hidden');

        // Település autocomplete inicializálása
        const editLocInput = document.getElementById('edit-item-location');
        if (editLocInput) setupCityAutocomplete(editLocInput);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeEditItemModal() {
    const modal = document.getElementById('edit-item-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
    currentEditingItem = null;
}

async function submitEditItem(e) {
    e.preventDefault();
    if (!state.currentUser || !currentEditingItem) return;

    const btn = document.getElementById('submit-edit-item-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mentés...`;
    }

    const payload = {
        user_id: state.currentUser.id,
        title: document.getElementById('edit-item-title').value,
        category: document.getElementById('edit-item-category').value,
        condition: document.getElementById('edit-item-condition').value,
        price: parseInt(document.getElementById('edit-item-price').value),
        price_unit: document.getElementById('edit-item-price-unit').value,
        deposit: parseInt(document.getElementById('edit-item-deposit').value || 0),
        location: document.getElementById('edit-item-location').value,
        description: document.getElementById('edit-item-description').value
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
        showToast('✨ Hirdetésed adatai sikeresen módosítva lettek!', 'success');
        await loadItems();
        if (state.activeTab === 'dashboard') {
            await loadDashboardData();
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
    if (!['my_items', 'incoming', 'outgoing'].includes(state.dashboardSubTab)) {
        state.dashboardSubTab = 'my_items';
    }

    const isMyItems = state.dashboardSubTab === 'my_items';
    const isIncoming = state.dashboardSubTab === 'incoming';
    const isOutgoing = state.dashboardSubTab === 'outgoing';

    const currentCount = state.currentUser.active_items_count !== undefined ? state.currentUser.active_items_count : myItems.length;
    const maxText = state.currentUser.max_items >= 9000 ? '∞' : (state.currentUser.max_items || 1);
    const pendingIncomingCount = incoming.filter(r => r.status === 'pending').length;

    container.innerHTML = `
        <!-- MEGBÍZHATÓSÁGI ÉS PROFIL ÖSSZESÍTŐ SÁV -->
        <div class="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-800">
            <div class="flex items-center gap-4">
                <img src="${state.currentUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + state.currentUser.name}" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-400 shadow-md">
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="text-xl font-black text-white tracking-tight">${state.currentUser.name}</h3>
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
                <span>Kiadott eszközeim bérlései (${incoming.length})</span>
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
                <i class="fa-solid fa-cart-shopping mr-1.5"></i> Kölcsönzéseim bérlőként (${outgoing.length})
            </button>
        </div>

        ${isMyItems ? renderMyItems(myItems) : isIncoming ? renderIncomingRentals(incoming) : renderOutgoingRentals(outgoing)}
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
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${items.map(item => `
                <div class="bg-white rounded-2xl ${
                    item.is_featured 
                    ? 'border-2 border-amber-400 ring-2 ring-amber-400/20' 
                    : 'border border-slate-200'
                } overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <div class="relative h-48 w-full bg-slate-100 overflow-hidden">
                            <img src="${item.image_url}" alt="${item.title}" class="w-full h-full object-cover">
                            <div class="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-slate-700 shadow">
                                ${item.category}
                            </div>
                            <div class="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                                ${item.price.toLocaleString('hu-HU')} Ft / ${item.price_unit}
                            </div>
                            ${item.is_featured ? `
                                <div class="absolute bottom-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
                                    <i class="fa-solid fa-bolt text-yellow-200"></i> Kiemelve: ${item.featured_until ? item.featured_until.split(' ')[0] : 'Aktív'}
                                </div>
                            ` : ''}
                        </div>

                        <div class="p-4 space-y-2">
                            <div class="flex items-center justify-between text-xs text-slate-500">
                                <span class="flex items-center gap-1 font-semibold text-slate-700">
                                    <i class="fa-solid fa-location-dot text-emerald-600"></i> ${item.location}
                                </span>
                                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[11px]">${item.condition}</span>
                            </div>

                            <h4 class="font-bold text-slate-900 text-sm line-clamp-1">${item.title}</h4>
                            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${item.description}</p>
                            
                            ${item.deposit > 0 ? `
                                <div class="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                                    Kaució: ${item.deposit.toLocaleString('hu-HU')} Ft
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- MŰVELETI GOMBOK: KIEMELÉS & MÓDOSÍTÁS & TÖRLÉS -->
                    <div class="p-4 pt-2 border-t border-slate-100 space-y-2">
                        <button onclick="openBoostModal(${item.id})" class="w-full py-2 px-2.5 ${
                            item.is_featured 
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm shadow-amber-500/20'
                        } rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-bolt ${item.is_featured ? 'text-amber-600' : 'text-yellow-200'}"></i>
                            <span>${item.is_featured ? '⚡ Kiemelés Hosszabbítása' : '⚡ Hirdetés Kiemelése (390 Ft-tól)'}</span>
                        </button>

                        <div class="grid grid-cols-3 gap-2">
                            <button onclick="openEditItemModal(${item.id})" class="py-2 px-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1">
                                <i class="fa-solid fa-pen-to-square"></i> Módosítás
                            </button>
                            <button onclick="deleteItem(${item.id})" class="py-2 px-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1">
                                <i class="fa-solid fa-trash"></i> Törlés
                            </button>
                            <button onclick="openItemModal(${item.id})" class="py-2 px-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow">
                                <i class="fa-solid fa-eye"></i> Megtekintés
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderIncomingRentals(rentals) {
    if (rentals.length === 0) {
        return `
            <div class="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-xl">
                    <i class="fa-solid fa-hand-holding-dollar"></i>
                </div>
                <h4 class="font-bold text-slate-800 text-base mb-1">Még nem érkezett bérlési kérelem az eszközeidre</h4>
                <p class="text-xs text-slate-500 mb-4">Adj fel új hirdetést, vagy oszd meg a meglévőket szomszédaiddal!</p>
                <button onclick="openNewItemModal()" class="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow">
                    + Új eszköz meghirdetése
                </button>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            ${rentals.map(r => `
                <div class="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:border-emerald-200 transition-colors">
                    <div class="flex items-center gap-4">
                        <img src="${r.item_image}" class="w-16 h-16 rounded-xl object-cover">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-extrabold text-slate-900 text-sm">${r.item_title}</h4>
                                ${getStatusBadge(r.status)}
                            </div>
                            <p class="text-xs text-slate-600">
                                <strong>Bérlő:</strong> ${r.renter_name} (${r.renter_phone || 'n/a'}) • 
                                <strong>Időszak:</strong> ${r.start_date} → ${r.end_date || 'megbeszélés szerint'} (${r.units_count} ${r.item_price_unit})
                            </p>
                            ${r.note ? `<p class="text-xs text-slate-500 mt-1 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"${r.note}"</p>` : ''}
                        </div>
                    </div>

                    <div class="flex flex-col md:items-end w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <div class="text-sm font-black text-slate-900 mb-2">
                            ${r.total_price.toLocaleString('hu-HU')} Ft <span class="text-xs font-normal text-slate-500">(+ ${r.deposit.toLocaleString('hu-HU')} Ft kaució)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${getActionButtonsForOwner(r)}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderOutgoingRentals(rentals) {
    if (rentals.length === 0) {
        return `
            <div class="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <div class="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-xl">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
                <h4 class="font-bold text-slate-800 text-base mb-1">Még nem kölcsönöztél semmit</h4>
                <p class="text-xs text-slate-500 mb-4">Böngéssz a környékeden elérhető kerti szerszámok és gépek között!</p>
                <button onclick="switchTab('browse')" class="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow">
                    Eszközök böngészése
                </button>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            ${rentals.map(r => {
                const hasReviewed = (r.reviews || []).some(rev => rev.reviewer_id === state.currentUser?.id);
                return `
                <div class="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:border-emerald-200 transition-colors">
                    <div class="flex items-center gap-4">
                        <img src="${r.item_image}" class="w-16 h-16 rounded-xl object-cover">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="font-extrabold text-slate-900 text-sm">${r.item_title}</h4>
                                ${getStatusBadge(r.status)}
                            </div>
                            <p class="text-xs text-slate-600">
                                <strong>Bérbeadó:</strong> ${r.owner_name} (<a href="tel:${r.owner_phone}" class="text-emerald-600 hover:underline font-semibold">${r.owner_phone}</a>)
                            </p>
                            <p class="text-xs text-slate-500">
                                <strong>Időszak:</strong> ${r.start_date} → ${r.end_date || 'rugalmas'} • ${r.units_count} ${r.item_price_unit || 'nap'}
                            </p>
                        </div>
                    </div>

                    <div class="flex flex-col md:items-end w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <div class="text-sm font-black text-slate-900 mb-2">
                            ${r.total_price.toLocaleString('hu-HU')} Ft <span class="text-xs font-normal text-slate-500">(+ ${r.deposit.toLocaleString('hu-HU')} Ft kaució)</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 justify-end">
                            ${r.status === 'completed' ? (
                                hasReviewed 
                                ? `<span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelve</span>`
                                : `<button onclick="openReviewModal(${r.id}, ${r.item_id}, '${r.item_title.replace(/'/g, "\\'")}', 'Bérbeadó', 'completed')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"><i class="fa-solid fa-star"></i> Bérbeadó értékelése</button>`
                            ) : ''}
                            ${(r.status === 'cancelled_no_show' || r.status === 'cancelled') ? (
                                hasReviewed 
                                ? `<span class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelve</span>`
                                : `<button onclick="openReviewModal(${r.id}, ${r.item_id}, '${r.item_title.replace(/'/g, "\\'")}', 'Bérbeadó', '${r.status}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"><i class="fa-solid fa-star"></i> Bérbeadó értékelése</button>`
                            ) : ''}
                            ${r.status === 'accepted' ? `
                                <button onclick="updateRentalStatus(${r.id}, 'cancelled_no_show')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors" title="Ha a bérbeadó nem jött el a megbeszélt helyszínre">
                                    <i class="fa-solid fa-user-slash mr-1"></i> Bérbeadó nem jelent meg
                                </button>
                            ` : ''}
                            ${r.status === 'pending' ? `
                                <button onclick="updateRentalStatus(${r.id}, 'cancelled')" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                                    Visszavonás
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;}).join('')}
        </div>
    `;
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
            return `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">${status}</span>`;
    }
}

function getActionButtonsForOwner(rental) {
    const hasReviewed = (rental.reviews || []).some(rev => rev.reviewer_id === state.currentUser?.id);

    if (rental.status === 'pending') {
        return `
            <button onclick="updateRentalStatus(${rental.id}, 'accepted')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                <i class="fa-solid fa-check mr-1"></i> Elfogadás
            </button>
            <button onclick="updateRentalStatus(${rental.id}, 'cancelled')" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                Elutasítás
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
        `;
    } else if (rental.status === 'active') {
        return `
            <button onclick="updateRentalStatus(${rental.id}, 'completed')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center gap-1.5">
                <i class="fa-solid fa-circle-check"></i> Készre állítás (Visszahozva)
            </button>
            <button onclick="updateRentalStatus(${rental.id}, 'cancelled_no_show')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors" title="Megszakítás mert a bérlő nem hozta vissza vagy megszegte a feltételeket">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i> Nem hozta vissza
            </button>
        `;
    } else if (rental.status === 'completed') {
        if (hasReviewed) {
            return `<span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Bérlő értékelve</span>`;
        }
        return `
            <button onclick="openReviewModal(${rental.id}, ${rental.item_id}, '${rental.item_title.replace(/'/g, "\\'")}', 'Bérlő', 'completed')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
                <i class="fa-solid fa-star"></i> Bérlő értékelése
            </button>
        `;
    } else if (rental.status === 'cancelled_no_show' || rental.status === 'cancelled') {
        if (hasReviewed) {
            return `<span class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-check"></i> Értékelés rögzítve</span>`;
        }
        return `
            <button onclick="openReviewModal(${rental.id}, ${rental.item_id}, '${rental.item_title.replace(/'/g, "\\'")}', 'Bérlő', '${rental.status}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5">
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
    const authBox = document.getElementById('auth-logged-in');

    if (tab === 'browse') {
        if (browseView) browseView.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (adminView) adminView.classList.add('hidden');
        if (messagesView) messagesView.classList.add('hidden');
        if (authBox) {
            authBox.classList.remove('ring-2', 'ring-emerald-500', 'ring-purple-600', 'bg-emerald-50/50', 'bg-purple-50/50');
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
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-purple-600', 'bg-purple-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-emerald-500');
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
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-purple-600');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadMessagesData(state.messagesFolder || 'inbox');
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
        if (authBox) {
            authBox.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
            authBox.classList.remove('bg-slate-50', 'ring-purple-600');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadDashboardData();
    }
}


async function loadAdminData() {
    if (!state.currentUser) return;
    const container = document.getElementById('admin-content');
    if (!container) return;

    container.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl text-purple-600 mb-2"></i><p>Pénzügyi és rendszeradatok betöltése...</p></div>`;

    try {
        const res = await fetch(`/api/admin/overview?user_id=${state.currentUser.id}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Hozzáférés megtagadva');
        }

        const data = await res.json();
        renderAdminUI(data);
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

function renderAdminUI(data) {
    const container = document.getElementById('admin-content');
    if (!container) return;

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
        const avatar = partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`;
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
    const avatar = partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`;

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
    const avatar = partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`;
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

    const partner = (state.activeConversation && state.activeConversation.partner) || { name: 'Partner' };
    const partnerAvatar = partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`;

    streamContainer.innerHTML = msgs.map(m => {
        const isMine = !!m.is_mine;
        const timeStr = formatMessageTime(m.created_at);

        if (isMine) {
            return `
                <div class="flex flex-col items-end">
                    <div class="max-w-[80%] sm:max-w-[70%] bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                        ${escapeHtml(m.content)}
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-slate-400 mt-1 pr-1">
                        <span>${timeStr}</span>
                        <i class="fa-solid fa-check-double text-emerald-600 text-[10px]"></i>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%]">
                    <img src="${partnerAvatar}" class="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0 mt-1">
                    <div>
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
window.quickLogin = quickLogin;
window.quickLoginUser = quickLoginUser;
window.logoutUser = logoutUser;

window.handleImageFileSelect = handleImageFileSelect;
window.removeSelectedImage = removeSelectedImage;
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


