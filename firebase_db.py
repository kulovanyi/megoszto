import os
import json
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from firebase_config import init_firebase, get_firestore_client, is_live_firebase

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_FIREBASE_STORE = os.path.join(BASE_DIR, 'firebase_store.json')

BOOST_PLANS = {
    "boost_1_day": {
        "id": "boost_1_day",
        "name": "1 Napos Villám Kiemelés",
        "price": 390,
        "duration_days": 1,
        "badge": "1 Nap",
        "description": "24 órás lista élére rangsorolás és arany kitűző"
    },
    "boost_7_days": {
        "id": "boost_7_days",
        "name": "1 Heti Prémium Kiemelés",
        "price": 1590,
        "duration_days": 7,
        "badge": "7 Nap - 40% Megtakarítás",
        "description": "7 napos lista élére rangsorolás és arany kitűző"
    }
}

def load_local_store() -> Dict[str, Any]:
    if os.path.exists(LOCAL_FIREBASE_STORE):
        try:
            with open(LOCAL_FIREBASE_STORE, 'r', encoding='utf-8') as f:
                store = json.load(f)
                # Ensure all collections exist
                for key in ['users', 'items', 'rentals', 'reviews', 'conversations', 'messages', 'transactions']:
                    if key not in store:
                        store[key] = {}
                if 'meta' not in store:
                    store['meta'] = {'user_seq': 0, 'item_seq': 0, 'rental_seq': 0, 'review_seq': 0, 'conv_seq': 0, 'msg_seq': 0}
                return ensure_default_users(store)
        except Exception:
            pass
    store = seed_initial_data()
    return ensure_default_users(store)

def ensure_default_users(store: Dict[str, Any]) -> Dict[str, Any]:
    kornel = None
    peter = None
    for u in store.get('users', {}).values():
        if u.get('email', '').strip().lower() == 'kulovanyi.kornel@gmail.com':
            kornel = u
        if u.get('email', '').strip().lower() == 'peter.nagy@gmail.com':
            peter = u

    changed = False
    if not kornel:
        kornel = {
            'id': 1,
            'name': 'Kornél Kuloványi',
            'email': 'kulovanyi.kornel@gmail.com',
            'password': 'password',
            'phone': '+36 30 123 4567',
            'city': 'Budapest',
            'avatar': 'https://lh3.googleusercontent.com/a/ACg8ocIuDqCb0ZC_qwAbIJ4Wyb2R4rSJqiW7cgQ4jXPhJvmSGUUnlFD62Q=s96-c',
            'rating': 5.0,
            'reviews_count': 0,
            'subscription_plan': 'pro_10',
            'max_items': 10,
            'auth_provider': 'google',
            'role': 'admin',
            'is_admin': True,
            'created_at': '2026-09-04 12:00:00'
        }
        store['users']['1'] = kornel
        changed = True

    if not peter:
        # Find next available ID
        existing_ids = [int(k) for k in store.get('users', {}).keys() if str(k).isdigit()]
        new_id = (max(existing_ids) + 1) if existing_ids else 2
        peter = {
            'id': new_id,
            'name': 'Nagy Péter (Bérlő)',
            'email': 'peter.nagy@gmail.com',
            'password': 'password',
            'phone': '+36 30 765 4321',
            'city': 'Budapest',
            'avatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            'rating': 5.0,
            'reviews_count': 0,
            'subscription_plan': 'free',
            'max_items': 1,
            'auth_provider': 'local',
            'role': 'user',
            'is_admin': False,
            'created_at': '2026-09-04 12:00:00'
        }
        store['users'][str(new_id)] = peter
        changed = True

    if changed:
        if 'meta' not in store:
            store['meta'] = {}
        store['meta']['user_seq'] = max([int(k) for k in store['users'].keys()] + [len(store['users'])])
        save_local_store(store)
        fs = get_firestore_client()
        if fs and is_live_firebase():
            try:
                for uid, udata in store['users'].items():
                    fs.collection('users').document(str(uid)).set(udata)
            except Exception as e:
                print(f"[Firebase Warning] Error syncing default users: {e}")

    return store

def save_local_store(data: Dict[str, Any]):
    with open(LOCAL_FIREBASE_STORE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def seed_initial_data() -> Dict[str, Any]:
    store = {
        'users': {},
        'items': {},
        'rentals': {},
        'reviews': {},
        'conversations': {},
        'messages': {},
        'transactions': {},
        'meta': {'user_seq': 0, 'item_seq': 0, 'rental_seq': 0, 'review_seq': 0, 'conv_seq': 0, 'msg_seq': 0}
    }
    save_local_store(store)
    return store


ADMIN_EMAILS = {"kulovanyi.kornel@gmail.com"}

def get_user_stats(user_id: int, store: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if store is None:
        store = load_local_store()
    
    active_items = sum(1 for i in store.get('items', {}).values() if i.get('user_id') == user_id)
    user_item_ids = {i.get('id') for i in store.get('items', {}).values() if i.get('user_id') == user_id}
    completed_as_owner = sum(1 for r in store.get('rentals', {}).values() if r.get('item_id') in user_item_ids and r.get('status') == 'completed')
    completed_as_renter = sum(1 for r in store.get('rentals', {}).values() if r.get('renter_id') == user_id and r.get('status') == 'completed')

    user = store.get('users', {}).get(str(user_id), {})
    is_admin = user.get('email', '').strip().lower() in ADMIN_EMAILS or user.get('role') == 'admin'

    return {
        'active_items_count': active_items,
        'completed_as_owner': completed_as_owner,
        'completed_as_renter': completed_as_renter,
        'role': 'admin' if is_admin else user.get('role', 'user'),
        'is_admin': is_admin
    }

def get_users() -> List[Dict[str, Any]]:
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            docs = fs.collection('users').stream()
            users = []
            for doc in docs:
                u = doc.to_dict()
                stats = get_user_stats(u.get('id', 0))
                u.update(stats)
                if u.get('email', '').strip().lower() in ADMIN_EMAILS:
                    u['role'] = 'admin'
                    u['is_admin'] = True
                users.append(u)
            return sorted(users, key=lambda x: x.get('id', 0))
        except Exception as e:
            print(f'[Firebase Warning] Error fetching users from Firestore: {e}')
    
    store = load_local_store()
    users = []
    for u in store.get('users', {}).values():
        u_copy = dict(u)
        stats = get_user_stats(u_copy['id'], store)
        u_copy.update(stats)
        if u_copy.get('email', '').strip().lower() in ADMIN_EMAILS:
            u_copy['role'] = 'admin'
            u_copy['is_admin'] = True
        users.append(u_copy)
    return sorted(users, key=lambda x: x.get('id', 0))

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            doc = fs.collection('users').document(str(user_id)).get()
            if doc.exists:
                u = doc.to_dict()
                u.update(get_user_stats(user_id))
                return u
        except Exception as e:
            print(f'[Firebase Warning] Error fetching user by ID from Firestore: {e}')

    store = load_local_store()
    u = store.get('users', {}).get(str(user_id))
    if u:
        u_copy = dict(u)
        u_copy.update(get_user_stats(user_id, store))
        return u_copy
    return None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    email_clean = email.strip().lower()
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            docs = fs.collection('users').where('email', '==', email_clean).limit(1).stream()
            for doc in docs:
                u = doc.to_dict()
                u.update(get_user_stats(u.get('id', 0)))
                return u
        except Exception as e:
            print(f'[Firebase Warning] Error fetching user by email from Firestore: {e}')

    store = load_local_store()
    for u in store.get('users', {}).values():
        if u.get('email', '').strip().lower() == email_clean:
            u_copy = dict(u)
            u_copy.update(get_user_stats(u_copy['id'], store))
            return u_copy
    return None

def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    store = load_local_store()
    new_id = store.get('meta', {}).get('user_seq', len(store.get('users', {}))) + 1
    store['meta']['user_seq'] = new_id

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    user = {
        'id': new_id,
        'name': user_data['name'],
        'email': user_data['email'].strip().lower(),
        'password': user_data.get('password', '123456'),
        'phone': user_data.get('phone', ''),
        'city': user_data.get('city', ''),
        'avatar': user_data.get('avatar', 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user_data['name']),
        'rating': user_data.get('rating', 5.0),
        'reviews_count': user_data.get('reviews_count', 0),
        'subscription_plan': user_data.get('subscription_plan', 'free'),
        'max_items': user_data.get('max_items', 1),
        'auth_provider': user_data.get('auth_provider', 'local'),
        'created_at': now_str
    }
    store['users'][str(new_id)] = user
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('users').document(str(new_id)).set(user)
        except Exception as e:
            print(f'[Firebase Warning] Error saving user to Firestore: {e}')

    user_copy = dict(user)
    user_copy.update({'active_items_count': 0, 'completed_as_owner': 0, 'completed_as_renter': 0})
    return user_copy

def update_user(user_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    uid_str = str(user_id)
    if uid_str not in store.get('users', {}):
        return None

    store['users'][uid_str].update(updates)
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('users').document(uid_str).update(updates)
        except Exception as e:
            print(f'[Firebase Warning] Error updating user in Firestore: {e}')

    u = dict(store['users'][uid_str])
    u.update(get_user_stats(user_id, store))
    return u

def get_items(category: Optional[str] = None, price_unit: Optional[str] = None, search: Optional[str] = None, user_id: Optional[int] = None, available_only: bool = False) -> List[Dict[str, Any]]:
    store = load_local_store()
    items = []
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for item in store.get('items', {}).values():
        if available_only and item.get('available') == 0:
            continue
        if user_id is not None and item.get('user_id') != user_id:
            continue
        if category and item.get('category') != category:
            continue
        if price_unit and item.get('price_unit') != price_unit:
            continue
        if search:
            s = search.lower()
            if s not in item.get('title', '').lower() and s not in item.get('description', '').lower() and s not in item.get('location', '').lower():
                continue

        item_copy = dict(item)
        
        # Kiemelés vizsgálata
        featured_until = item.get('featured_until')
        is_featured = bool(featured_until and str(featured_until) > now_str)
        item_copy['is_featured'] = is_featured
        item_copy['featured_until'] = featured_until

        owner = store.get('users', {}).get(str(item.get('user_id')))
        if owner:
            item_copy['owner_name'] = owner.get('name')
            item_copy['owner_avatar'] = owner.get('avatar')
            item_copy['owner_rating'] = owner.get('rating', 5.0)
            item_copy['owner_phone'] = owner.get('phone')
            item_copy['owner_city'] = owner.get('city')
            item_copy['owner_plan'] = owner.get('subscription_plan', 'free')
            owner_stats = get_user_stats(owner.get('id'), store)
            item_copy['completed_as_owner'] = owner_stats['completed_as_owner']
            item_copy['completed_as_renter'] = owner_stats['completed_as_renter']

        items.append(item_copy)

    # Kiemelt termékek a lista legelejére, azon belül legfrissebb előre
    return sorted(items, key=lambda x: (1 if x.get('is_featured') else 0, x.get('id', 0)), reverse=True)

def get_item_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    item = store.get('items', {}).get(str(item_id))
    if not item:
        return None

    item_copy = dict(item)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    featured_until = item.get('featured_until')
    item_copy['is_featured'] = bool(featured_until and str(featured_until) > now_str)
    item_copy['featured_until'] = featured_until

    owner = store.get('users', {}).get(str(item.get('user_id')))
    if owner:
        item_copy['owner_name'] = owner.get('name')
        item_copy['owner_avatar'] = owner.get('avatar')
        item_copy['owner_rating'] = owner.get('rating', 5.0)
        item_copy['owner_phone'] = owner.get('phone')
        item_copy['owner_city'] = owner.get('city')
        item_copy['owner_plan'] = owner.get('subscription_plan', 'free')
        owner_stats = get_user_stats(owner.get('id'), store)
        item_copy['completed_as_owner'] = owner_stats['completed_as_owner']
        item_copy['completed_as_renter'] = owner_stats['completed_as_renter']

    reviews = []
    for rev in store.get('reviews', {}).values():
        if rev.get('item_id') == item_id:
            rev_copy = dict(rev)
            reviewer = store.get('users', {}).get(str(rev.get('reviewer_id')))
            if reviewer:
                rev_copy['reviewer_name'] = reviewer.get('name')
                rev_copy['reviewer_avatar'] = reviewer.get('avatar')
            reviews.append(rev_copy)
    item_copy['reviews'] = reviews
    return item_copy

def create_item(item_data: Dict[str, Any]) -> Dict[str, Any]:
    store = load_local_store()
    new_id = store.get('meta', {}).get('item_seq', len(store.get('items', {}))) + 1
    store['meta']['item_seq'] = new_id

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    item = {
        'id': new_id,
        'user_id': item_data['user_id'],
        'title': item_data['title'],
        'category': item_data['category'],
        'description': item_data['description'],
        'price': item_data['price'],
        'price_unit': item_data['price_unit'],
        'deposit': item_data.get('deposit', 0),
        'image_url': item_data.get('image_url') or 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80',
        'location': item_data['location'],
        'condition': item_data.get('condition', 'Jó állapotú'),
        'available': 1,
        'created_at': now_str
    }
    store['items'][str(new_id)] = item
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(str(new_id)).set(item)
        except Exception as e:
            print(f'[Firebase Warning] Error saving item to Firestore: {e}')

    return item

def update_item(item_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    iid_str = str(item_id)
    if iid_str not in store.get('items', {}):
        return None

    clean_updates = {k: v for k, v in updates.items() if v is not None}
    store['items'][iid_str].update(clean_updates)
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(iid_str).update(clean_updates)
        except Exception as e:
            print(f'[Firebase Warning] Error updating item in Firestore: {e}')

    return store['items'][iid_str]

def delete_item(item_id: int) -> bool:
    store = load_local_store()
    iid_str = str(item_id)
    if iid_str not in store.get('items', {}):
        return False

    del store['items'][iid_str]
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(iid_str).delete()
        except Exception as e:
            print(f'[Firebase Warning] Error deleting item from Firestore: {e}')

    return True

def boost_item(item_id: int, boost_plan_id: str, session_id: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    store = load_local_store()
    iid_str = str(item_id)
    item = store.get('items', {}).get(iid_str)
    if not item:
        raise ValueError("A kiemelendő hirdetés nem található!")

    if boost_plan_id not in BOOST_PLANS:
        raise ValueError("Érvénytelen kiemelési csomag!")

    plan = BOOST_PLANS[boost_plan_id]
    days = plan['duration_days']
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')

    curr_featured = item.get('featured_until')
    start_dt = now
    if curr_featured:
        try:
            parsed = datetime.strptime(str(curr_featured), '%Y-%m-%d %H:%M:%S')
            if parsed > now:
                start_dt = parsed
        except Exception:
            start_dt = now

    new_until = (start_dt + timedelta(days=days)).strftime('%Y-%m-%d %H:%M:%S')
    item['featured_until'] = new_until
    store['items'][iid_str] = item

    # Felhasználó adatok
    target_user_id = user_id or item.get('user_id')
    user = store.get('users', {}).get(str(target_user_id)) or {}
    
    tx_data = {
        "id": session_id,
        "type": "boost",
        "payment_type": "one_time",
        "item_id": item_id,
        "item_title": item.get('title', 'Eszköz'),
        "plan_id": boost_plan_id,
        "plan_name": plan['name'],
        "amount_huf": plan['price'],
        "currency": "HUF",
        "user_id": target_user_id,
        "user_name": user.get('name', 'Bérbeadó'),
        "user_email": user.get('email', ''),
        "session_id": session_id,
        "status": "paid",
        "provider": "stripe",
        "created_at": now_str
    }

    if 'transactions' not in store:
        store['transactions'] = {}
    store['transactions'][session_id] = tx_data
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(iid_str).update({'featured_until': new_until})
            fs.collection("transactions").document(session_id).set(tx_data)
        except Exception as e:
            print(f"[Firebase Warning] Error saving boost transaction to Firestore: {e}")

    return {
        "success": True,
        "item": item,
        "boost_plan": plan,
        "featured_until": new_until,
        "transaction": tx_data,
        "message": f"⚡ Sikeres kiemelés! A hirdetés kiemelve eddig: {new_until}"
    }

def get_rentals(renter_id: Optional[int] = None, owner_id: Optional[int] = None) -> List[Dict[str, Any]]:
    store = load_local_store()
    rentals = []

    user_item_ids = set()
    if owner_id is not None:
        user_item_ids = {i.get('id') for i in store.get('items', {}).values() if i.get('user_id') == owner_id}

    for rental in store.get('rentals', {}).values():
        if renter_id is not None and rental.get('renter_id') != renter_id:
            continue
        if owner_id is not None and rental.get('item_id') not in user_item_ids:
            continue

        rental_copy = dict(rental)
        item = store.get('items', {}).get(str(rental.get('item_id')))
        if item:
            rental_copy['item_title'] = item.get('title')
            rental_copy['item_image'] = item.get('image_url')
            rental_copy['item_category'] = item.get('category')
            rental_copy['item_location'] = item.get('location')
            rental_copy['price_unit'] = item.get('price_unit')
            owner = store.get('users', {}).get(str(item.get('user_id')))
            if owner:
                rental_copy['owner_id'] = owner.get('id')
                rental_copy['owner_name'] = owner.get('name')
                rental_copy['owner_phone'] = owner.get('phone')

        renter = store.get('users', {}).get(str(rental.get('renter_id')))
        if renter:
            rental_copy['renter_name'] = renter.get('name')
            rental_copy['renter_phone'] = renter.get('phone')
            rental_copy['renter_email'] = renter.get('email')

        rentals.append(rental_copy)

    return sorted(rentals, key=lambda x: x.get('id', 0), reverse=True)

def get_rental_by_id(rental_id: int) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    rental = store.get('rentals', {}).get(str(rental_id))
    if not rental:
        return None
    return dict(rental)

def create_rental(rental_data: Dict[str, Any]) -> Dict[str, Any]:
    store = load_local_store()
    new_id = store.get('meta', {}).get('rental_seq', len(store.get('rentals', {}))) + 1
    store['meta']['rental_seq'] = new_id

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    rental = {
        'id': new_id,
        'item_id': rental_data['item_id'],
        'renter_id': rental_data['renter_id'],
        'start_date': rental_data['start_date'],
        'end_date': rental_data.get('end_date'),
        'units_count': rental_data.get('units_count', 1),
        'total_price': rental_data['total_price'],
        'deposit': rental_data.get('deposit', 0),
        'note': rental_data.get('note', ''),
        'status': 'pending',
        'created_at': now_str
    }
    store['rentals'][str(new_id)] = rental
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('rentals').document(str(new_id)).set(rental)
        except Exception as e:
            print(f'[Firebase Warning] Error saving rental to Firestore: {e}')

    return rental

def update_rental_status(rental_id: int, status: str) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    rid_str = str(rental_id)
    if rid_str not in store.get('rentals', {}):
        return None

    store['rentals'][rid_str]['status'] = status
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('rentals').document(rid_str).update({'status': status})
        except Exception as e:
            print(f'[Firebase Warning] Error updating rental in Firestore: {e}')

    return store['rentals'][rid_str]

def get_reviews_for_item(item_id: int) -> List[Dict[str, Any]]:
    store = load_local_store()
    reviews = []
    for rev in store.get('reviews', {}).values():
        if rev.get('item_id') == item_id:
            rev_copy = dict(rev)
            reviewer = store.get('users', {}).get(str(rev.get('reviewer_id')))
            if reviewer:
                rev_copy['reviewer_name'] = reviewer.get('name')
                rev_copy['reviewer_avatar'] = reviewer.get('avatar')
            reviews.append(rev_copy)
    return sorted(reviews, key=lambda x: x.get('id', 0), reverse=True)

def create_review(review_data: Dict[str, Any]) -> Dict[str, Any]:
    store = load_local_store()
    new_id = store.get('meta', {}).get('review_seq', len(store.get('reviews', {}))) + 1
    store['meta']['review_seq'] = new_id

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    review = {
        'id': new_id,
        'rental_id': review_data.get('rental_id'),
        'item_id': review_data['item_id'],
        'reviewer_id': review_data['reviewer_id'],
        'rating': review_data['rating'],
        'comment': review_data['comment'],
        'created_at': now_str
    }
    store['reviews'][str(new_id)] = review
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('reviews').document(str(new_id)).set(review)
        except Exception as e:
            print(f'[Firebase Warning] Error saving review to Firestore: {e}')

    return review

def sync_to_live_firestore():
    fs = get_firestore_client()
    if not fs or not is_live_firebase():
        return False, 'Nincs aktív élő Firebase kapcsolat.'

    store = load_local_store()
    for col in ['users', 'items', 'rentals', 'reviews', 'conversations', 'messages', 'transactions']:
        for doc_id, doc_data in store.get(col, {}).items():
            fs.collection(col).document(str(doc_id)).set(doc_data)
    return True, 'Sikeres feltöltés és szinkronizálás a Firebase adatbázisba!'

# --- BELSŐ ÜZENETKEZELŐ (MESSAGING & CHAT) ---

def get_conversations(user_id: int, folder: str = "inbox") -> List[Dict[str, Any]]:
    store = load_local_store()
    convs = []
    user_id_str = str(user_id)
    uid_int = int(user_id)

    for conv in store.get('conversations', {}).values():
        participants = conv.get('participants', [])
        # Résztvevő-e a felhasználó?
        if uid_int not in participants and user_id_str not in [str(p) for p in participants]:
            continue
        
        # Törölte-e a felhasználó?
        deleted_by = [str(d) for d in conv.get('deleted_by', [])]
        if user_id_str in deleted_by:
            continue

        # Archivált-e a felhasználónál?
        archived_by = [str(a) for a in conv.get('archived_by', [])]
        is_archived = user_id_str in archived_by

        if folder == "archived" and not is_archived:
            continue
        if folder == "inbox" and is_archived:
            continue

        conv_copy = dict(conv)
        conv_copy['is_archived'] = is_archived

        # Partner azonosítása
        partner_id = None
        for p in participants:
            if str(p) != user_id_str:
                partner_id = int(p)
                break
        
        if partner_id is None:
            partner_id = uid_int

        partner = store.get('users', {}).get(str(partner_id), {})
        conv_copy['partner'] = {
            'id': partner_id,
            'name': partner.get('name', 'Felhasználó'),
            'avatar': partner.get('avatar'),
            'phone': partner.get('phone', ''),
            'city': partner.get('city', ''),
            'rating': partner.get('rating', 5.0)
        }

        # Érintett eszköz (ha van)
        item_id = conv.get('item_id')
        if item_id:
            item = store.get('items', {}).get(str(item_id))
            if item:
                conv_copy['item'] = {
                    'id': item.get('id'),
                    'title': item.get('title'),
                    'image_url': item.get('image_url'),
                    'category': item.get('category'),
                    'price': item.get('price'),
                    'price_unit': item.get('price_unit')
                }

        # Olvasatlan számláló erre a felhasználóra
        unread_dict = conv.get('unread_counts', {})
        conv_copy['unread_count'] = unread_dict.get(user_id_str, unread_dict.get(int(user_id), 0))

        convs.append(conv_copy)

    return sorted(convs, key=lambda x: x.get('last_message_at', ''), reverse=True)

def get_conversation(conv_id: str, user_id: int) -> Optional[Dict[str, Any]]:
    store = load_local_store()
    conv = store.get('conversations', {}).get(str(conv_id))
    if not conv:
        return None

    user_id_str = str(user_id)
    uid_int = int(user_id)
    participants = conv.get('participants', [])
    if uid_int not in participants and user_id_str not in [str(p) for p in participants]:
        return None

    conv_copy = dict(conv)
    conv_copy['is_archived'] = user_id_str in [str(a) for a in conv.get('archived_by', [])]

    partner_id = None
    for p in participants:
        if str(p) != user_id_str:
            partner_id = int(p)
            break
    if partner_id is None:
        partner_id = uid_int

    partner = store.get('users', {}).get(str(partner_id), {})
    conv_copy['partner'] = {
        'id': partner_id,
        'name': partner.get('name', 'Felhasználó'),
        'avatar': partner.get('avatar'),
        'phone': partner.get('phone', ''),
        'city': partner.get('city', ''),
        'rating': partner.get('rating', 5.0)
    }

    item_id = conv.get('item_id')
    if item_id:
        item = store.get('items', {}).get(str(item_id))
        if item:
            conv_copy['item'] = {
                'id': item.get('id'),
                'title': item.get('title'),
                'image_url': item.get('image_url'),
                'category': item.get('category'),
                'price': item.get('price'),
                'price_unit': item.get('price_unit')
            }

    unread_dict = conv.get('unread_counts', {})
    conv_copy['unread_count'] = unread_dict.get(user_id_str, unread_dict.get(int(user_id), 0))
    return conv_copy

def get_messages(conv_id: str, user_id: int) -> List[Dict[str, Any]]:
    store = load_local_store()
    conv = store.get('conversations', {}).get(str(conv_id))
    if not conv:
        return []

    user_id_str = str(user_id)
    uid_int = int(user_id)
    participants = conv.get('participants', [])
    if uid_int not in participants and user_id_str not in [str(p) for p in participants]:
        return []

    msgs = []
    for m in store.get('messages', {}).values():
        if str(m.get('conversation_id')) == str(conv_id):
            m_copy = dict(m)
            m_copy['is_mine'] = (m.get('sender_id') == uid_int)
            msgs.append(m_copy)

    return sorted(msgs, key=lambda x: x.get('created_at', ''))

def send_message(
    sender_id: int,
    receiver_id: int,
    content: str,
    item_id: Optional[int] = None,
    conv_id: Optional[str] = None
) -> Dict[str, Any]:
    store = load_local_store()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    sender_id = int(sender_id)
    receiver_id = int(receiver_id)

    # 1. Beszélgetés megkeresése vagy létrehozása
    target_conv_id = conv_id
    if not target_conv_id:
        # Keressünk meglévő beszélgetést a 2 fél között (és ha meg van adva item_id, akkor azzal)
        for cid, c in store.get('conversations', {}).items():
            parts = [int(p) for p in c.get('participants', [])]
            if sender_id in parts and receiver_id in parts:
                if item_id is None or c.get('item_id') == item_id:
                    target_conv_id = cid
                    break

    if not target_conv_id or str(target_conv_id) not in store.get('conversations', {}):
        new_conv_num = store.get('meta', {}).get('conv_seq', len(store.get('conversations', {}))) + 1
        store['meta']['conv_seq'] = new_conv_num
        target_conv_id = f"conv_{new_conv_num}"
        store['conversations'][target_conv_id] = {
            'id': target_conv_id,
            'participants': [sender_id, receiver_id],
            'item_id': item_id,
            'last_message': content,
            'last_message_at': now_str,
            'last_sender_id': sender_id,
            'unread_counts': {str(receiver_id): 1, str(sender_id): 0},
            'archived_by': [],
            'deleted_by': [],
            'created_at': now_str
        }
    else:
        conv = store['conversations'][str(target_conv_id)]
        conv['last_message'] = content
        conv['last_message_at'] = now_str
        conv['last_sender_id'] = sender_id
        if item_id and not conv.get('item_id'):
            conv['item_id'] = item_id
        
        # Ha a címzettnél archiválva vagy törölve volt, tegyük újra láthatóvá az új bejövő üzenet miatt
        if str(receiver_id) in [str(d) for d in conv.get('deleted_by', [])]:
            conv['deleted_by'] = [d for d in conv.get('deleted_by', []) if str(d) != str(receiver_id)]
        if str(receiver_id) in [str(a) for a in conv.get('archived_by', [])]:
            conv['archived_by'] = [a for a in conv.get('archived_by', []) if str(a) != str(receiver_id)]
        if str(sender_id) in [str(d) for d in conv.get('deleted_by', [])]:
            conv['deleted_by'] = [d for d in conv.get('deleted_by', []) if str(d) != str(sender_id)]

        # Növeljük a címzett olvasatlan számlálóját
        if 'unread_counts' not in conv:
            conv['unread_counts'] = {}
        curr_unread = conv['unread_counts'].get(str(receiver_id), 0)
        conv['unread_counts'][str(receiver_id)] = curr_unread + 1
        conv['unread_counts'][str(sender_id)] = 0

    # 2. Üzenet objektum mentése
    new_msg_id = store.get('meta', {}).get('msg_seq', len(store.get('messages', {}))) + 1
    store['meta']['msg_seq'] = new_msg_id

    msg_obj = {
        'id': new_msg_id,
        'conversation_id': target_conv_id,
        'sender_id': sender_id,
        'receiver_id': receiver_id,
        'content': content,
        'item_id': item_id,
        'created_at': now_str,
        'is_read': False
    }
    store['messages'][str(new_msg_id)] = msg_obj
    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(str(target_conv_id)).set(store['conversations'][str(target_conv_id)])
            fs.collection('messages').document(str(new_msg_id)).set(msg_obj)
        except Exception as e:
            print(f"[Firebase Warning] Error saving message to Firestore: {e}")

    return {
        'success': True,
        'conversation_id': target_conv_id,
        'message': msg_obj
    }

def mark_conversation_read(conv_id: str, user_id: int) -> bool:
    store = load_local_store()
    cid_str = str(conv_id)
    user_id_str = str(user_id)
    uid_int = int(user_id)

    if cid_str not in store.get('conversations', {}):
        return False

    conv = store['conversations'][cid_str]
    if 'unread_counts' not in conv:
        conv['unread_counts'] = {}
    conv['unread_counts'][user_id_str] = 0

    # Üzenetek olvasottá tétele
    for m in store.get('messages', {}).values():
        if str(m.get('conversation_id')) == cid_str and m.get('receiver_id') == uid_int:
            m['is_read'] = True

    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).update({f'unread_counts.{user_id_str}': 0})
        except Exception as e:
            print(f"[Firebase Warning] Error marking conversation as read in Firestore: {e}")

    return True

def archive_conversation(conv_id: str, user_id: int, archive: bool = True) -> bool:
    store = load_local_store()
    cid_str = str(conv_id)
    user_id_str = str(user_id)
    uid_int = int(user_id)

    if cid_str not in store.get('conversations', {}):
        return False

    conv = store['conversations'][cid_str]
    if 'archived_by' not in conv:
        conv['archived_by'] = []

    archived_list = [str(a) for a in conv['archived_by']]
    if archive:
        if user_id_str not in archived_list:
            conv['archived_by'].append(uid_int)
    else:
        conv['archived_by'] = [a for a in conv['archived_by'] if str(a) != user_id_str]

    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).update({'archived_by': conv['archived_by']})
        except Exception as e:
            print(f"[Firebase Warning] Error updating archive in Firestore: {e}")

    return True

def delete_conversation(conv_id: str, user_id: int) -> bool:
    store = load_local_store()
    cid_str = str(conv_id)
    user_id_str = str(user_id)
    uid_int = int(user_id)

    if cid_str not in store.get('conversations', {}):
        return False

    conv = store['conversations'][cid_str]
    if 'deleted_by' not in conv:
        conv['deleted_by'] = []

    deleted_list = [str(d) for d in conv['deleted_by']]
    if user_id_str not in deleted_list:
        conv['deleted_by'].append(uid_int)

    save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).update({'deleted_by': conv['deleted_by']})
        except Exception as e:
            print(f"[Firebase Warning] Error updating deleted_by in Firestore: {e}")

    return True

def get_unread_messages_count(user_id: int) -> int:
    store = load_local_store()
    user_id_str = str(user_id)
    uid_int = int(user_id)
    total_unread = 0

    for conv in store.get('conversations', {}).values():
        participants = conv.get('participants', [])
        if uid_int not in participants and user_id_str not in [str(p) for p in participants]:
            continue
        deleted_by = [str(d) for d in conv.get('deleted_by', [])]
        if user_id_str in deleted_by:
            continue
        unread_dict = conv.get('unread_counts', {})
        total_unread += unread_dict.get(user_id_str, unread_dict.get(uid_int, 0))

    return total_unread

def get_transactions() -> List[Dict[str, Any]]:
    fs = get_firestore_client()
    transactions = []
    if fs and is_live_firebase():
        try:
            docs = fs.collection('transactions').stream()
            for doc in docs:
                t = doc.to_dict()
                t['id'] = doc.id
                transactions.append(t)
        except Exception as e:
            print(f'[Firebase Warning] Error fetching transactions: {e}')
    
    if not transactions:
        store = load_local_store()
        transactions = list(store.get('transactions', {}).values())
    
    return sorted(transactions, key=lambda x: x.get('created_at', ''), reverse=True)

def get_admin_overview() -> Dict[str, Any]:
    users = get_users()
    items = get_items()
    rentals = get_rentals()
    transactions = get_transactions()

    # 1. Havi előfizetési és kiemelési bontás (Monthly Revenue Breakdown)
    monthly_revenue: Dict[str, Dict[str, Any]] = {}
    total_revenue = 0
    total_sub_revenue = 0
    total_boost_revenue = 0
    total_boosts_sold = 0

    for tx in transactions:
        created_at = tx.get('created_at', '')
        month_key = created_at[:7] if len(created_at) >= 7 else datetime.now().strftime('%Y-%m')
        amount = int(tx.get('amount_huf', 0))
        plan_id = str(tx.get('plan_id', 'starter_3'))
        tx_type = tx.get('type', 'subscription')
        is_boost = tx_type == 'boost' or plan_id.startswith('boost_')

        total_revenue += amount
        if is_boost:
            total_boost_revenue += amount
            total_boosts_sold += 1
        else:
            total_sub_revenue += amount

        if month_key not in monthly_revenue:
            monthly_revenue[month_key] = {
                'month': month_key,
                'total_amount': 0,
                'subscription_amount': 0,
                'boost_amount': 0,
                'transactions_count': 0,
                'boost_count': 0,
                'starter_3_count': 0,
                'pro_10_count': 0,
                'unlimited_count': 0
            }
        
        monthly_revenue[month_key]['total_amount'] += amount
        monthly_revenue[month_key]['transactions_count'] += 1
        
        if is_boost:
            monthly_revenue[month_key]['boost_amount'] += amount
            monthly_revenue[month_key]['boost_count'] += 1
        else:
            monthly_revenue[month_key]['subscription_amount'] += amount
            if plan_id == 'starter_3':
                monthly_revenue[month_key]['starter_3_count'] += 1
            elif plan_id == 'pro_10':
                monthly_revenue[month_key]['pro_10_count'] += 1
            elif plan_id == 'unlimited':
                monthly_revenue[month_key]['unlimited_count'] += 1

    # Ha még nincs tranzakció, hozzunk létre egy aktuális havi sort
    current_month = datetime.now().strftime('%Y-%m')
    if current_month not in monthly_revenue:
        monthly_revenue[current_month] = {
            'month': current_month,
            'total_amount': 0,
            'subscription_amount': 0,
            'boost_amount': 0,
            'transactions_count': 0,
            'boost_count': 0,
            'starter_3_count': 0,
            'pro_10_count': 0,
            'unlimited_count': 0
        }

    monthly_list = sorted(list(monthly_revenue.values()), key=lambda x: x['month'], reverse=True)

    # 2. Csomagok szerinti megoszlás a felhasználók között
    plans_distribution = {
        'free': sum(1 for u in users if u.get('subscription_plan', 'free') == 'free'),
        'starter_3': sum(1 for u in users if u.get('subscription_plan') == 'starter_3'),
        'pro_10': sum(1 for u in users if u.get('subscription_plan') == 'pro_10'),
        'unlimited': sum(1 for u in users if u.get('subscription_plan') == 'unlimited')
    }

    # 3. Kategóriák szerinti megoszlás
    categories_distribution: Dict[str, int] = {}
    locations_distribution: Dict[str, int] = {}
    for item in items:
        cat = item.get('category', 'Egyéb')
        categories_distribution[cat] = categories_distribution.get(cat, 0) + 1
        loc = item.get('location', 'Ismeretlen')
        locations_distribution[loc] = locations_distribution.get(loc, 0) + 1

    # 4. Bérlési statisztikák
    completed_rentals = sum(1 for r in rentals if r.get('status') == 'completed')
    active_rentals = sum(1 for r in rentals if r.get('status') == 'active')
    pending_rentals = sum(1 for r in rentals if r.get('status') == 'pending')

    return {
        'summary': {
            'total_users': len(users),
            'total_items': len(items),
            'total_rentals': len(rentals),
            'completed_rentals': completed_rentals,
            'active_rentals': active_rentals,
            'pending_rentals': pending_rentals,
            'total_revenue_huf': total_revenue,
            'total_subscription_revenue_huf': total_sub_revenue,
            'total_boost_revenue_huf': total_boost_revenue,
            'total_boosts_sold': total_boosts_sold,
            'paying_subscribers': len(users) - plans_distribution['free']
        },
        'monthly_revenue': monthly_list,
        'plans_distribution': plans_distribution,
        'categories_distribution': categories_distribution,
        'locations_distribution': sorted(locations_distribution.items(), key=lambda x: x[1], reverse=True)[:10],
        'recent_transactions': transactions[:15],
        'users_list': users,
        'items_list': items
    }

# Kezdeti inicializálás
init_firebase()
if not os.path.exists(LOCAL_FIREBASE_STORE):
    seed_initial_data()
