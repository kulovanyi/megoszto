// Megosztó Hybrid Client DB & Live Firebase Firestore Sync
(function() {
    console.log('🚀 [Megosztó] Initializing Embedded Client Database & Firestore Sync...');

    const CLIENT_DB_KEY = 'megoszto_embedded_db_v6';
    const EMBEDDED_SEED = {"users": {"1": {"id": 1, "name": "Kuloványi Kornél", "email": "kulovanyi.kornel@gmail.com", "password": "oauth_google", "phone": "+36 30 111 2222", "city": "Balassagyarmat", "avatar": "https://lh3.googleusercontent.com/a/ACg8ocIuDqCb0ZC_qwAbIJ4Wyb2R4rSJqiW7cgQ4jXPhJvmSGUUnlFD62Q=s96-c", "rating": 5.0, "reviews_count": 3, "subscription_plan": "pro_10", "max_items": 10, "auth_provider": "google", "role": "admin", "is_admin": true, "created_at": "2026-09-04 12:00:00"}, "2": {"id": 2, "name": "Nagy Péter (Bérlő)", "email": "peter.nagy@gmail.com", "password": "password", "phone": "+36 30 765 4321", "city": "Budapest, XI. kerület", "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80", "rating": 5.0, "reviews_count": 2, "subscription_plan": "free", "max_items": 1, "auth_provider": "local", "role": "user", "is_admin": false, "created_at": "2026-09-04 12:00:00"}, "3": {"id": 3, "name": "Szabó Anna", "email": "szabo.anna@gmail.com", "password": "password", "phone": "+36 20 987 6543", "city": "Szeged", "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80", "rating": 4.9, "reviews_count": 5, "subscription_plan": "starter_3", "max_items": 3, "auth_provider": "local", "role": "user", "is_admin": false, "created_at": "2026-09-04 12:00:00"}}, "items": {"1": {"id": 1, "user_id": 1, "title": "Szekrény", "category": "Barkácsolás", "description": "Kényelmes, masszív és sokoldalú szekrény rendezvényekre, fotózáshoz vagy ideiglenes tárolásra.", "price": 2000, "price_unit": "nap", "deposit": 20000, "image_url": "static/uploads/3a1948cd10d04184bbce02bc9846ea84.png", "location": "Balassagyarmat", "condition": "Újszerű", "available": 1, "created_at": "2026-09-04 17:03:28", "featured_until": "2026-09-15 18:00:00"}, "2": {"id": 2, "user_id": 2, "title": "Bosch Professional GBH 2-28 Fúrókalapács", "category": "Barkácsolás", "description": "Erős, strapabíró 880W-os ipari fúrókalapács SDS-plus tokmánnyal, véső és fúrószár készlettel.", "price": 3900, "price_unit": "nap", "deposit": 15000, "image_url": "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80", "location": "Budapest, XI. kerület", "condition": "Kiváló állapotú", "available": 1, "created_at": "2026-09-04 14:00:00", "featured_until": null}, "3": {"id": 3, "user_id": 3, "title": "Kärcher K5 Power Control Magasnyomású Mosó", "category": "Takarítás", "description": "145 bar nyomású prémium mosó teraszmosó fejjel, autómosó készlettel, vízhűtéses motorral.", "price": 4500, "price_unit": "nap", "deposit": 25000, "image_url": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80", "location": "Szeged", "condition": "Újszerű", "available": 1, "created_at": "2026-09-04 13:00:00", "featured_until": null}, "4": {"id": 4, "user_id": 1, "title": "Husqvarna 445 II Benzines Láncfűrész", "category": "Kertészet", "description": "Megbízható, erős 2.8 LE-s motoros fűrész tűzifa aprításhoz vagy kerti faápoláshoz. Friss lánccal és védőfelszereléssel.", "price": 5500, "price_unit": "nap", "deposit": 30000, "image_url": "https://images.unsplash.com/photo-1546554137-f86b9593a222?w=600&auto=format&fit=crop&q=80", "location": "Balassagyarmat", "condition": "Kiváló állapotú", "available": 1, "created_at": "2026-09-04 12:00:00", "featured_until": "2026-09-12 12:00:00"}, "5": {"id": 5, "user_id": 3, "title": "Harry Potter Díszdobozos Könyvsorozat (1-7. kötet)", "category": "Rendezvény & Hobbi", "description": "A teljes J.K. Rowling varázslóvilág sorozat keménytáblás, magyar nyelvű díszkiadásban. Tökéletes olvasásra vagy fotózásra!", "price": 800, "price_unit": "nap", "deposit": 10000, "image_url": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80", "location": "Szeged", "condition": "Újszerű", "available": 1, "created_at": "2026-09-04 11:00:00", "featured_until": null}, "6": {"id": 6, "user_id": 2, "title": "DJI Mini 3 Pro 4K Drón Készlet (Fly More Combo)", "category": "Rendezvény & Hobbi", "description": "4K/60fps HDR videófelvétel, 3 darab akkumulátor (akár 90 perc repülési idő), RC kijelzős távirányító.", "price": 8900, "price_unit": "nap", "deposit": 50000, "image_url": "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=600&auto=format&fit=crop&q=80", "location": "Budapest, XI. kerület", "condition": "Újszerű", "available": 1, "created_at": "2026-09-04 10:00:00", "featured_until": null}}, "rentals": {"1": {"id": 1, "item_id": 1, "renter_id": 2, "owner_id": 1, "start_date": "2026-09-10", "end_date": "2026-09-12", "units_count": 2, "total_price": 4000, "deposit": 20000, "status": "approved", "note": "Szombat délelőtt átvenném személyesen!", "created_at": "2026-09-04 18:00:00"}}, "reviews": {"1": {"id": 1, "item_id": 1, "reviewer_id": 2, "reviewer_name": "Nagy Péter", "rating": 5, "comment": "Minden a megbeszéltek szerint zajlott, pontos és nagyon segítőkész volt a tulajdonos!", "created_at": "2026-09-02 16:45:00"}}, "conversations": {"conv_1": {"id": "conv_1", "participants": [1, 2], "item_id": 1, "last_message": "oké, várlak szombaton!", "last_message_at": "2026-09-04 20:25:10", "last_sender_id": 1, "unread_counts": {"1": 0, "2": 0}, "archived_by": [], "deleted_by": [], "created_at": "2026-09-04 19:06:38"}}, "messages": {"1": {"id": 1, "conversation_id": "conv_1", "sender_id": 1, "receiver_id": 2, "content": "Szia Péter! Láttam a foglalást a szekrényre.", "item_id": 1, "created_at": "2026-09-04 19:06:38", "is_read": true}, "2": {"id": 2, "conversation_id": "conv_1", "sender_id": 2, "receiver_id": 1, "content": "Szia Kornél! Igen, szombat 10-re tudnék menni érte Balassagyarmatra.", "item_id": 1, "created_at": "2026-09-04 19:10:00", "is_read": true}, "3": {"id": 3, "conversation_id": "conv_1", "sender_id": 1, "receiver_id": 2, "content": "oké, várlak szombaton!", "item_id": 1, "created_at": "2026-09-04 20:25:10", "is_read": true}}, "transactions": {"tx_1": {"id": "tx_1", "type": "boost", "item_id": 1, "item_title": "Szekrény", "plan_id": "boost_1_day", "plan_name": "1 Napos Villám Kiemelés", "amount_huf": 390, "currency": "HUF", "user_id": 1, "user_name": "Kuloványi Kornél", "status": "paid", "created_at": "2026-09-04 18:52:00"}}, "meta": {"item_seq": 6, "user_seq": 3, "rental_seq": 1, "review_seq": 1, "msg_seq": 3}};

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
    function getFirestore() {
        if (fbDb) return fbDb;
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                fbDb = firebase.firestore();
                return fbDb;
            } catch (e) {}
        }
        return null;
    }

    function getLocalDb() {
        try {
            const raw = localStorage.getItem(CLIENT_DB_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.items && Object.keys(parsed.items).length > 0) {
                    return parsed;
                }
            }
        } catch (e) {}
        const fresh = JSON.parse(JSON.stringify(EMBEDDED_SEED));
        saveLocalDb(fresh);
        return fresh;
    }

    function saveLocalDb(db) {
        try {
            localStorage.setItem(CLIENT_DB_KEY, JSON.stringify(db));
        } catch (e) {}
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

    async function syncDocToFirestore(collection, id, data) {
        const firestore = getFirestore();
        if (firestore) {
            try {
                await firestore.collection(collection).doc(String(id)).set(data, { merge: true });
            } catch (e) {}
        }
    }

    async function handleApiRequest(urlStr, init = {}) {
        const parsedUrl = new URL(urlStr, window.location.href);
        const path = parsedUrl.pathname;
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

        const db = getLocalDb();
        const firestore = getFirestore();

        // 1. PLANS
        if (path.includes('/api/plans')) return makeResponse(PLANS);

        // 2. CITIES
        if (path.includes('/api/cities')) {
            try {
                const r = await _originalFetch('static/cities.json');
                if (r.ok) return r;
            } catch (e) {}
            return makeResponse(['Budapest (Összes kerület)', 'Budapest, XI. kerület', 'Budapest, XIII. kerület', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Balassagyarmat']);
        }

        // 3. STATUS
        if (path.includes('/api/firebase/status')) {
            return makeResponse({
                is_live: !!firestore,
                database_type: firestore ? 'Google Cloud Firestore (Élő felhő)' : 'Megosztó Web Adatbázis (Kliens)',
                message: 'Adatbázis aktív és működik.'
            });
        }

        // 4. AUTH
        if (path.includes('/api/auth/me')) {
            const uid = parsedUrl.searchParams.get('user_id') || localStorage.getItem('kolcsonado_user_id') || '1';
            let user = db.users[uid] || db.users['1'];
            return makeResponse(user);
        }
        if (path.includes('/api/auth/login')) {
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
        if (path.includes('/api/auth/quick-login')) {
            const isFree = (body.plan === 'free');
            const user = isFree ? (db.users['2'] || Object.values(db.users).find(u => u.subscription_plan === 'free')) : (db.users['1'] || Object.values(db.users)[0]);
            return makeResponse({ message: 'Sikeres gyors belépés!', user: user });
        }
        if (path.includes('/api/auth/social-login') || path.includes('/api/auth/register')) {
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

        // 5. ITEMS LIST
        if (path.includes('/api/items') && method === 'GET' && !path.match(/\/api\/items\/\d+/)) {
            const cat = parsedUrl.searchParams.get('category');
            const unit = parsedUrl.searchParams.get('unit');
            const search = (parsedUrl.searchParams.get('search') || '').toLowerCase();
            const maxPrice = parseFloat(parsedUrl.searchParams.get('max_price') || '0');
            const loc = (parsedUrl.searchParams.get('location') || '').toLowerCase();

            // Firestore sync ha elérhető
            if (firestore) {
                try {
                    const snap = await firestore.collection('items').get();
                    if (!snap.empty) {
                        snap.forEach(d => {
                            db.items[d.id] = { id: d.id, ...d.data() };
                        });
                        saveLocalDb(db);
                    }
                } catch (e) {}
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

        // 6. SINGLE ITEM
        const itemMatch = path.match(/\/api\/items\/(\d+)/);
        if (itemMatch && method === 'GET') {
            const itemId = itemMatch[1];
            let item = db.items[itemId];
            if (!item) return makeResponse({ detail: 'Nem található' }, 404);
            const owner = db.users[item.user_id] || { name: 'Bérbeadó', avatar: '', rating: 5.0, reviews_count: 0, phone: '', city: item.location };
            const reviews = Object.values(db.reviews || {}).filter(r => String(r.item_id) === String(itemId));
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

        // 7. POST ITEM
        if (path.includes('/api/items') && method === 'POST') {
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
            return makeResponse({ message: 'Hirdetés sikeresen feladva!', item_id: newId });
        }

        // 8. UPLOAD
        if (path.includes('/api/upload')) {
            return makeResponse({ image_url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80', message: 'Kép feltöltve' });
        }

        // 9. RENTALS
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

        if (path.includes('/api/rentals') && method === 'POST') {
            const newId = Date.now();
            const it = db.items[body.item_id];
            const newRental = { id: newId, item_id: body.item_id, renter_id: body.renter_id, owner_id: it ? it.user_id : 1, start_date: body.start_date, end_date: body.end_date, units_count: body.units_count || 1, total_price: body.total_price || 2000, deposit: body.deposit || 0, status: 'pending', note: body.note || '', created_at: new Date().toISOString() };
            db.rentals[newId] = newRental;
            saveLocalDb(db);
            syncDocToFirestore('rentals', newId, newRental);
            return makeResponse({ message: 'Bérlési kérelem elküldve!', rental_id: newId });
        }

        const statusMatch = path.match(/\/api\/rentals\/(\d+)\/status/);
        if (statusMatch && method === 'PUT') {
            const rId = statusMatch[1];
            if (db.rentals[rId]) {
                db.rentals[rId].status = body.status || 'approved';
                saveLocalDb(db);
                syncDocToFirestore('rentals', rId, db.rentals[rId]);
            }
            return makeResponse({ message: 'Státusz frissítve!' });
        }

        // 10. REVIEWS
        if (path.includes('/api/reviews') && method === 'POST') {
            const newId = Date.now();
            const u = db.users[body.reviewer_id] || { name: 'Felhasználó' };
            const newRev = { id: newId, item_id: body.item_id, reviewer_id: body.reviewer_id, reviewer_name: u.name, rating: body.rating || 5, comment: body.comment || '', created_at: new Date().toISOString() };
            db.reviews[newId] = newRev;
            saveLocalDb(db);
            syncDocToFirestore('reviews', newId, newRev);
            return makeResponse({ message: 'Értékelés rögzítve!' });
        }

        // 11. MESSAGES
        if (path.includes('/api/messages/unread-count')) return makeResponse({ unread_count: 0 });
        if (path.includes('/api/messages/conversations')) {
            const uid = parseInt(parsedUrl.searchParams.get('user_id') || '1');
            const folder = parsedUrl.searchParams.get('folder') || 'inbox';
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
            const uid = parseInt(parsedUrl.searchParams.get('user_id') || '1');
            const partner = db.users[partnerId] || { id: partnerId, name: 'Partner', avatar: '', city: 'Budapest' };
            const conv = Object.values(db.conversations || {}).find(c => c.participants && c.participants.includes(uid) && c.participants.includes(partnerId)) || { id: 'conv_' + uid + '_' + partnerId, participants: [uid, partnerId], item_id: null, archived_by: [] };
            const msgs = Object.values(db.messages || {}).filter(m => (m.sender_id === uid && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === uid));
            return makeResponse({ conversation: conv, partner: partner, item: conv.item_id ? db.items[conv.item_id] : null, messages: msgs });
        }

        if (path.includes('/api/messages/send') && method === 'POST') {
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
            return makeResponse({ message: 'Üzenet elküldve!', message_data: newMsg, conversation_id: conv.id });
        }

        if (path.includes('/api/messages/archive')) {
            if (db.conversations[body.conversation_id]) {
                if (!db.conversations[body.conversation_id].archived_by) db.conversations[body.conversation_id].archived_by = [];
                db.conversations[body.conversation_id].archived_by.push(body.user_id);
                saveLocalDb(db);
            }
            return makeResponse({ message: 'Archiválva' });
        }

        // 12. STRIPE / BOOST
        if (path.includes('/api/stripe/create-checkout-session')) {
            const plan = PLANS.find(p => p.id === body.plan_id) || PLANS[1];
            return makeResponse({ checkout_url: null, session_id: 'cs_' + Date.now(), plan_id: plan.id, plan_name: plan.name, amount: plan.price, payment_type: 'subscription', is_sandbox_simulation: true });
        }
        if (path.includes('/api/stripe/confirm-payment')) {
            const plan = PLANS.find(p => p.id === body.plan_id) || PLANS[1];
            if (db.users[body.user_id]) {
                db.users[body.user_id].subscription_plan = plan.id;
                db.users[body.user_id].max_items = plan.max_items;
                saveLocalDb(db);
                syncDocToFirestore('users', body.user_id, db.users[body.user_id]);
            }
            return makeResponse({ message: 'Sikeres előfizetés: ' + plan.name });
        }
        if (path.includes('/api/stripe/create-boost-checkout')) {
            const is7 = body.boost_plan_id === 'boost_7_days';
            const it = db.items[body.item_id] || { title: 'Eszköz' };
            return makeResponse({ checkout_url: null, session_id: 'cs_b_' + Date.now(), plan_id: body.boost_plan_id, plan_name: is7 ? '1 Heti VIP Kiemelés' : '1 Napos Villám Kiemelés', item_id: body.item_id, item_title: it.title, amount: is7 ? 1590 : 390, payment_type: 'one_time', is_sandbox_simulation: true });
        }
        if (path.includes('/api/stripe/confirm-boost-payment')) {
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

        // 13. ADMIN
        if (path.includes('/api/admin/stats')) {
            return makeResponse({
                stats: { total_users: Object.keys(db.users).length, total_items: Object.keys(db.items).length, total_rentals: Object.keys(db.rentals || {}).length, total_revenue_huf: 24890, monthly_mrr_huf: 17960, active_subscriptions: 3, boosted_items_count: 2 },
                plans: PLANS
            });
        }
        if (path.includes('/api/admin/rentals')) return makeResponse({ rentals: Object.values(db.rentals || {}) });

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
            } catch (netErr) {}
        }

        return handleApiRequest(url, init);
    };

    console.log('✅ [Megosztó] Embedded Client DB Layer initialized.');
})();
