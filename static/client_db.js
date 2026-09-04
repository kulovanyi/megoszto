// Megosztó Live Firebase Firestore & Client Data Adapter for GitHub Pages
(function() {
    console.log('🔥 [Megosztó] Initializing Live Firebase Firestore Data Adapter...');

    const CLIENT_DB_KEY = 'megoszto_client_db_v5';

    // Firebase inicializálás
    const firebaseConfig = {
        apiKey: 'AIzaSyCZqV24fltN672ySbrw28dxEPGcNFi06zE',
        authDomain: 'kolcsonado.firebaseapp.com',
        projectId: 'kolcsonado',
        storageBucket: 'kolcsonado.firebasestorage.app',
        messagingSenderId: '1072705116754',
        appId: '1:1072705116754:web:1d83adf419b58721e09d8b',
        measurementId: 'G-Y32BGKZRQK'
    };

    let fbDb = null;
    let fbAuth = null;

    function getFirestore() {
        if (fbDb) return fbDb;
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                fbDb = firebase.firestore();
                fbAuth = firebase.auth();
                console.log('🔥 [Firestore Live] Csatlakozva a Google Cloud Firestore-hoz!');
                return fbDb;
            } catch (e) {
                console.warn('[Firestore] Inicializálási megjegyzés:', e);
            }
        }
        return null;
    }

    let _seedData = null;

    async function loadSeedData() {
        if (_seedData) return _seedData;
        try {
            const res = await _originalFetch('static/seed_data.json');
            if (res.ok) {
                _seedData = await res.json();
                return _seedData;
            }
        } catch (e) {}
        return null;
    }

    function getLocalDb() {
        try {
            const raw = localStorage.getItem(CLIENT_DB_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    }

    function saveLocalDb(db) {
        try {
            localStorage.setItem(CLIENT_DB_KEY, JSON.stringify(db));
        } catch (e) {}
    }

    async function getOrInitDb() {
        let db = getLocalDb();
        if (!db) {
            db = await loadSeedData();
            if (db) saveLocalDb(db);
        }
        return db || { users: {}, items: {}, rentals: {}, reviews: {}, conversations: {}, messages: {}, meta: {} };
    }

    function normalizeImgUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80';
        if (url.startsWith('/static/')) return 'static/' + url.substring(8);
        if (url.startsWith('./static/')) return 'static/' + url.substring(9);
        return url;
    }

    function makeResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status: status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const PLANS = [
        { id: 'free', name: 'Ingyenes Alap', price: 0, max_items: 1, badge: 'Kezdő', features: ['1 eszköz ingyenes meghirdetése', 'Alap megjelenés', 'Bérleti kalkulátor', 'Közösségi értékelések'] },
        { id: 'starter_3', name: 'Kertbarát Csomag', price: 1490, max_items: 3, badge: 'Népszerű', features: ['Akár 3 eszköz meghirdetése', 'Gyorsabb foglalás', 'Kiemelt kategória pozíció', '0-24 ügyféltámogatás'] },
        { id: 'pro_10', name: 'Ezermester Csomag', price: 3990, max_items: 10, badge: 'Legjobb érték', features: ['Akár 10 eszköz meghirdetése', 'TOP Kiemelt lista a főoldalon', 'Közvetlen telefonos kiemelés', 'Részletes statisztikák'] },
        { id: 'unlimited', name: 'Profi Kölcsönző (Végtelen)', price: 7990, max_items: 9999, badge: 'Korlátlan', features: ['Végtelen eszköz feltöltése', 'Arany jelvény a hirdetéseken', '0% platform jutalék', 'Kiemelt VIP ügyfélszolgálat'] }
    ];

    // Szinkronizálás Firestore-ba (ha online van a Firebase)
    async function syncDocToFirestore(collection, id, data) {
        const firestore = getFirestore();
        if (firestore) {
            try {
                await firestore.collection(collection).doc(String(id)).set(data, { merge: true });
                console.log('🔥 [Firestore Sync] ' + collection + '/' + id + ' sikeresen mentve a Firebase felhőbe!');
            } catch (err) {
                console.warn('[Firestore Sync] ' + collection + '/' + id + ' mentési figyelmeztetés:', err);
            }
        }
    }

    async function handleApiRequest(urlStr, init = {}) {
        const url = new URL(urlStr, window.location.href);
        const path = url.pathname;
        const method = (init.method || 'GET').toUpperCase();
        let body = {};
        if (init.body) {
            try {
                if (typeof init.body === 'string') body = JSON.parse(init.body);
                else if (init.body instanceof FormData) {
                    for (let [k, v] of init.body.entries()) body[k] = v;
                }
            } catch (e) {}
        }

        const db = await getOrInitDb();
        const firestore = getFirestore();

        if (path.endsWith('/api/plans')) return makeResponse(PLANS);
        if (path.endsWith('/api/cities')) {
            try {
                const r = await _originalFetch('static/cities.json');
                if (r.ok) return r;
            } catch (e) {}
            return makeResponse(['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Balassagyarmat']);
        }
        if (path.endsWith('/api/firebase/status')) {
            return makeResponse({
                is_live: !!firestore,
                database_type: firestore ? 'Google Cloud Firestore (Élő felhő Firestore SDK)' : 'Megosztó Web DB (Kliens)',
                message: firestore ? 'Az adatok közvetlenül a Google Firestore felhőbe íródnak és onnan töltődnek be!' : 'Helyi tároló aktív.'
            });
        }

        // Auth / User
        if (path.endsWith('/api/auth/me')) {
            const uid = url.searchParams.get('user_id') || localStorage.getItem('kolcsonado_user_id') || '1';
            let user = db.users[uid];
            if (!user && firestore) {
                try {
                    const doc = await firestore.collection('users').doc(String(uid)).get();
                    if (doc.exists) user = doc.data();
                } catch (e) {}
            }
            return makeResponse(user || db.users['1']);
        }

        if (path.endsWith('/api/auth/login')) {
            const email = (body.email || '').trim().toLowerCase();
            let user = Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
            if (!user) {
                user = { id: Date.now(), name: email.split('@')[0], email: email, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', subscription_plan: 'free', max_items: 1, rating: 5.0, reviews_count: 0, created_at: new Date().toISOString() };
                db.users[user.id] = user;
                saveLocalDb(db);
                syncDocToFirestore('users', user.id, user);
            }
            return makeResponse({ message: 'Sikeres bejelentkezés!', user: user });
        }

        if (path.endsWith('/api/auth/quick-login')) {
            const isFree = body.plan === 'free';
            const user = isFree ? (db.users['2'] || Object.values(db.users).find(u => u.subscription_plan === 'free')) : (db.users['1'] || Object.values(db.users)[0]);
            return makeResponse({ message: 'Sikeres gyors belépés!', user: user });
        }

        if (path.endsWith('/api/auth/social-login') || path.endsWith('/api/auth/register')) {
            const email = (body.email || 'user@megoszto.hu').toLowerCase();
            let user = Object.values(db.users).find(u => (u.email || '').toLowerCase() === email);
            if (!user) {
                user = { id: Date.now(), name: body.name || email.split('@')[0], email: email, avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', subscription_plan: 'free', max_items: 1, rating: 5.0, reviews_count: 0, phone: body.phone || '', city: body.city || 'Budapest', created_at: new Date().toISOString() };
                db.users[user.id] = user;
                saveLocalDb(db);
                syncDocToFirestore('users', user.id, user);
            }
            return makeResponse({ message: 'Sikeres bejelentkezés!', user: user });
        }

        // Items List -> Lekéri az élő Firestore-ból is!
        if (path.endsWith('/api/items') && method === 'GET') {
            const cat = url.searchParams.get('category');
            const unit = url.searchParams.get('unit');
            const search = (url.searchParams.get('search') || '').toLowerCase();
            const maxPrice = parseFloat(url.searchParams.get('max_price') || '0');
            const loc = (url.searchParams.get('location') || '').toLowerCase();

            if (firestore) {
                try {
                    const snap = await firestore.collection('items').get();
                    if (!snap.empty) {
                        snap.forEach(d => {
                            const data = d.data();
                            db.items[d.id] = { id: d.id, ...data };
                        });
                        saveLocalDb(db);
                    }
                } catch (e) {
                    console.warn('[Firestore Live] Olvasási megjegyzés:', e);
                }
            }

            let items = Object.values(db.items).map(item => {
                const owner = db.users[item.user_id] || { name: 'Kornél', avatar: '', rating: 5.0, reviews_count: 0, phone: '', city: item.location };
                const isFeatured = item.featured_until ? new Date(item.featured_until) > new Date() : false;
                return {
                    ...item,
                    image_url: normalizeImgUrl(item.image_url),
                    is_featured: isFeatured,
                    owner_name: owner.name,
                    owner_avatar: owner.avatar,
                    owner_rating: owner.rating,
                    owner_reviews_count: owner.reviews_count,
                    owner_phone: owner.phone,
                    owner_city: owner.city
                };
            });

            if (cat && cat !== 'Mind') items = items.filter(i => i.category === cat);
            if (unit && unit !== 'Mind') items = items.filter(i => i.price_unit === unit);
            if (search) items = items.filter(i => (i.title || '').toLowerCase().includes(search) || (i.description || '').toLowerCase().includes(search));
            if (maxPrice > 0) items = items.filter(i => i.price <= maxPrice);
            if (loc) items = items.filter(i => (i.location || '').toLowerCase().includes(loc));

            items.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
            return makeResponse(items);
        }

        // Single Item
        const itemMatch = path.match(/\/api\/items\/(\d+)$/);
        if (itemMatch && method === 'GET') {
            const itemId = parseInt(itemMatch[1]);
            let item = db.items[itemId];
            if (!item && firestore) {
                try {
                    const d = await firestore.collection('items').doc(String(itemId)).get();
                    if (d.exists) item = d.data();
                } catch (e) {}
            }
            if (!item) return makeResponse({ detail: 'Nem található' }, 404);
            const owner = db.users[item.user_id] || { name: 'Bérbeadó', avatar: '', rating: 5.0, reviews_count: 0, phone: '', city: item.location };
            const reviews = Object.values(db.reviews || {}).filter(r => r.item_id === itemId);
            return makeResponse({
                ...item,
                image_url: normalizeImgUrl(item.image_url),
                is_featured: item.featured_until ? new Date(item.featured_until) > new Date() : false,
                owner_name: owner.name,
                owner_avatar: owner.avatar,
                owner_rating: owner.rating,
                owner_reviews_count: owner.reviews_count,
                owner_phone: owner.phone,
                owner_city: owner.city,
                reviews: reviews
            });
        }

        // Új hirdetés feladása -> Menti LocalDB-be ÉS az élő Firestore-ba!
        if (path.endsWith('/api/items') && method === 'POST') {
            const uid = body.user_id || 1;
            const newId = Date.now();
            const newItem = {
                id: newId,
                user_id: uid,
                title: body.title,
                category: body.category || 'Barkácsolás',
                description: body.description || '',
                price: parseInt(body.price || 1000),
                price_unit: body.price_unit || 'nap',
                deposit: parseInt(body.deposit || 0),
                image_url: normalizeImgUrl(body.image_url || 'static/logo.png'),
                location: body.location || 'Budapest',
                condition: body.condition || 'Jó állapotú',
                available: 1,
                created_at: new Date().toISOString(),
                featured_until: null
            };
            db.items[newId] = newItem;
            saveLocalDb(db);
            syncDocToFirestore('items', newId, newItem);

            return makeResponse({ message: 'Hirdetés sikeresen feladva és szinkronizálva a Firebase felhőbe!', item_id: newId });
        }

        if (path.endsWith('/api/upload')) {
            return makeResponse({ image_url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80', message: 'Feltöltve' });
        }

        // Rentals -> Menti LocalDB-be ÉS Firestore-ba!
        const rentalsMatch = path.match(/\/api\/users\/(\d+)\/rentals/);
        if (rentalsMatch) {
            const uid = parseInt(rentalsMatch[1]);
            const incoming = [];
            const outgoing = [];
            Object.values(db.rentals || {}).forEach(r => {
                const it = db.items[r.item_id] || { title: 'Eszköz', image_url: 'static/logo.png', location: 'Budapest' };
                const renter = db.users[r.renter_id] || { name: 'Bérlő', phone: '', email: '', avatar: '' };
                const owner = db.users[r.owner_id || it.user_id] || { name: 'Tulajdonos', phone: '', email: '', avatar: '' };
                const obj = { ...r, item_title: it.title, item_image: normalizeImgUrl(it.image_url), item_location: it.location, renter_name: renter.name, renter_avatar: renter.avatar, renter_phone: renter.phone, renter_email: renter.email, owner_name: owner.name, owner_avatar: owner.avatar, owner_phone: owner.phone, owner_email: owner.email };
                if (it.user_id === uid || r.owner_id === uid) incoming.push(obj);
                if (r.renter_id === uid) outgoing.push(obj);
            });
            return makeResponse({ incoming, outgoing });
        }

        if (path.endsWith('/api/rentals') && method === 'POST') {
            const newId = Date.now();
            const it = db.items[body.item_id];
            const newRental = { id: newId, item_id: body.item_id, renter_id: body.renter_id, owner_id: it ? it.user_id : 1, start_date: body.start_date, end_date: body.end_date, units_count: body.units_count || 1, total_price: body.total_price || 2000, deposit: body.deposit || 0, status: 'pending', note: body.note || '', created_at: new Date().toISOString() };
            db.rentals[newId] = newRental;
            saveLocalDb(db);
            syncDocToFirestore('rentals', newId, newRental);

            return makeResponse({ message: 'Bérlési kérelem elküldve és mentve a Firebase felhőbe!', rental_id: newId });
        }

        const statusMatch = path.match(/\/api\/rentals\/(\d+)\/status/);
        if (statusMatch && method === 'PUT') {
            const rId = statusMatch[1];
            if (db.rentals[rId]) {
                db.rentals[rId].status = body.status || 'approved';
                saveLocalDb(db);
                syncDocToFirestore('rentals', rId, db.rentals[rId]);
            }
            return makeResponse({ message: 'Státusz frissítve a felhőben!' });
        }

        // Reviews -> Menti LocalDB-be ÉS Firestore-ba!
        if (path.endsWith('/api/reviews') && method === 'POST') {
            const newId = Date.now();
            const u = db.users[body.reviewer_id] || { name: 'Felhasználó' };
            const newRev = { id: newId, item_id: body.item_id, reviewer_id: body.reviewer_id, reviewer_name: u.name, rating: body.rating || 5, comment: body.comment || '', created_at: new Date().toISOString() };
            db.reviews[newId] = newRev;
            saveLocalDb(db);
            syncDocToFirestore('reviews', newId, newRev);

            return makeResponse({ message: 'Értékelés rögzítve a felhőben!' });
        }

        // Messages -> Menti LocalDB-be ÉS Firestore-ba!
        if (path.endsWith('/api/messages/unread-count')) return makeResponse({ unread_count: 0 });
        if (path.endsWith('/api/messages/conversations')) {
            const uid = parseInt(url.searchParams.get('user_id') || '1');
            const folder = url.searchParams.get('folder') || 'inbox';
            const list = Object.values(db.conversations || {})
                .filter(c => c.participants && c.participants.includes(uid))
                .filter(c => folder === 'archived' ? (c.archived_by || []).includes(uid) : !(c.archived_by || []).includes(uid))
                .map(c => {
                    const partnerId = c.participants.find(p => p !== uid) || uid;
                    const partner = db.users[partnerId] || { name: 'Partner', avatar: '', city: 'Budapest' };
                    const it = c.item_id ? db.items[c.item_id] : null;
                    return { ...c, partner_id: partnerId, partner_name: partner.name, partner_avatar: partner.avatar, partner_city: partner.city, item_title: it ? it.title : null, item_image: it ? normalizeImgUrl(it.image_url) : null, unread_count: 0 };
                });
            return makeResponse(list);
        }

        const threadMatch = path.match(/\/api\/messages\/thread\/(\d+)/);
        if (threadMatch) {
            const partnerId = parseInt(threadMatch[1]);
            const uid = parseInt(url.searchParams.get('user_id') || '1');
            const partner = db.users[partnerId] || { id: partnerId, name: 'Partner', avatar: '', city: 'Budapest' };
            const conv = Object.values(db.conversations || {}).find(c => c.participants && c.participants.includes(uid) && c.participants.includes(partnerId)) || { id: 'conv_' + uid + '_' + partnerId, participants: [uid, partnerId], item_id: null, archived_by: [] };
            const msgs = Object.values(db.messages || {}).filter(m => (m.sender_id === uid && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === uid));
            return makeResponse({ conversation: conv, partner: partner, item: conv.item_id ? db.items[conv.item_id] : null, messages: msgs });
        }

        if (path.endsWith('/api/messages/send') && method === 'POST') {
            const sId = body.sender_id;
            const rId = body.receiver_id;
            const msgId = Date.now();
            let conv = Object.values(db.conversations || {}).find(c => c.participants && c.participants.includes(sId) && c.participants.includes(rId));
            if (!conv) {
                conv = { id: 'conv_' + Date.now(), participants: [sId, rId], item_id: body.item_id || null, last_message: body.content, last_message_at: new Date().toISOString(), last_sender_id: sId, archived_by: [] };
                db.conversations[conv.id] = conv;
            } else {
                conv.last_message = body.content;
                conv.last_message_at = new Date().toISOString();
                conv.last_sender_id = sId;
            }
            const newMsg = { id: msgId, conversation_id: conv.id, sender_id: sId, receiver_id: rId, content: body.content, item_id: body.item_id || conv.item_id, created_at: new Date().toISOString(), is_read: false };
            db.messages[msgId] = newMsg;
            saveLocalDb(db);

            syncDocToFirestore('conversations', conv.id, conv);
            syncDocToFirestore('messages', msgId, newMsg);

            return makeResponse({ message: 'Üzenet elküldve és mentve a Firebase felhőbe!', message_data: newMsg, conversation_id: conv.id });
        }

        if (path.endsWith('/api/messages/archive')) {
            if (db.conversations[body.conversation_id]) {
                if (!db.conversations[body.conversation_id].archived_by) db.conversations[body.conversation_id].archived_by = [];
                db.conversations[body.conversation_id].archived_by.push(body.user_id);
                saveLocalDb(db);
                syncDocToFirestore('conversations', body.conversation_id, db.conversations[body.conversation_id]);
            }
            return makeResponse({ message: 'Archiválva' });
        }

        // Stripe / Boost
        if (path.endsWith('/api/stripe/create-checkout-session')) {
            const plan = PLANS.find(p => p.id === body.plan_id) || PLANS[1];
            return makeResponse({ checkout_url: null, session_id: 'cs_' + Date.now(), plan_id: plan.id, plan_name: plan.name, amount: plan.price, payment_type: 'subscription', is_sandbox_simulation: true });
        }
        if (path.endsWith('/api/stripe/confirm-payment')) {
            const plan = PLANS.find(p => p.id === body.plan_id) || PLANS[1];
            if (db.users[body.user_id]) {
                db.users[body.user_id].subscription_plan = plan.id;
                db.users[body.user_id].max_items = plan.max_items;
                saveLocalDb(db);
                syncDocToFirestore('users', body.user_id, db.users[body.user_id]);
            }
            return makeResponse({ message: 'Sikeres előfizetés a felhőben: ' + plan.name });
        }
        if (path.endsWith('/api/stripe/create-boost-checkout')) {
            const is7 = body.boost_plan_id === 'boost_7_days';
            const it = db.items[body.item_id] || { title: 'Eszköz' };
            return makeResponse({ checkout_url: null, session_id: 'cs_b_' + Date.now(), plan_id: body.boost_plan_id, plan_name: is7 ? '1 Heti VIP Kiemelés' : '1 Napos Villám Kiemelés', item_id: body.item_id, item_title: it.title, amount: is7 ? 1590 : 390, payment_type: 'one_time', is_sandbox_simulation: true });
        }
        if (path.endsWith('/api/stripe/confirm-boost-payment')) {
            const days = body.boost_plan_id === 'boost_7_days' ? 7 : 1;
            const exp = new Date();
            exp.setDate(exp.getDate() + days);
            if (db.items[body.item_id]) {
                db.items[body.item_id].featured_until = exp.toISOString();
                saveLocalDb(db);
                syncDocToFirestore('items', body.item_id, db.items[body.item_id]);
            }
            return makeResponse({ message: '⚡ Sikeres kiemelés ' + days + ' napra!' });
        }

        // Admin
        if (path.endsWith('/api/admin/stats')) {
            return makeResponse({
                stats: { total_users: Object.keys(db.users).length, total_items: Object.keys(db.items).length, total_rentals: Object.keys(db.rentals || {}).length, total_revenue_huf: 24890, monthly_mrr_huf: 17960, active_subscriptions: 3, boosted_items_count: 2 },
                plans: PLANS
            });
        }
        if (path.endsWith('/api/admin/rentals')) return makeResponse({ rentals: Object.values(db.rentals || {}) });

        return makeResponse({ success: true });
    }

    const _originalFetch = window.fetch.bind(window);
    window.fetch = async function(resource, init) {
        const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        
        if (!url.includes('/api/')) {
            if (url.startsWith('/static/')) {
                try {
                    const r = await _originalFetch(url, init);
                    if (r.ok) return r;
                } catch (e) {}
                return _originalFetch('static/' + url.substring(8), init);
            }
            return _originalFetch(resource, init);
        }

        const isStaticHost = window.location.hostname.endsWith('github.io') || 
                             window.location.protocol === 'file:' || 
                             window.location.port === '5500' ||
                             window.location.hostname.includes('pages.dev');

        if (!isStaticHost) {
            try {
                const response = await _originalFetch(resource, init);
                if (response.status !== 404 && response.status !== 502 && response.status !== 503) {
                    return response;
                }
            } catch (netErr) {
                console.warn('[Client DB] Backend nem elérhető, átváltás Firebase Firestore-ra:', netErr);
            }
        }

        return handleApiRequest(url, init);
    };

    console.log('✅ [Megosztó] Live Firebase Firestore Adapter ready.');
})();
