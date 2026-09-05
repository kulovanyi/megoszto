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

SUBSCRIPTION_PLANS = {
    "free": {
        "id": "free",
        "name": "Ingyenes Alap",
        "price": 0,
        "max_items": 1,
        "featured_items": 0,
        "badge": "Kezdő",
        "features": [
            "1 eszköz ingyenes meghirdetése",
            "0 db kiemelt hirdetés",
            "Alap megjelenés a keresőben",
            "Közösségi értékelések & profil"
        ]
    },
    "starter_3": {
        "id": "starter_3",
        "name": "Kertbarát Csomag",
        "price": 1490,
        "max_items": 3,
        "featured_items": 0,
        "badge": "Népszerű",
        "features": [
            "Akár 3 eszköz meghirdetése",
            "0 db kiemelt hirdetés",
            "Gyorsabb bérlési kapcsolat",
            "0-24 online ügyféltámogatás"
        ]
    },
    "pro_10": {
        "id": "pro_10",
        "name": "Ezermester Csomag",
        "price": 4490,
        "max_items": 10,
        "featured_items": 1,
        "badge": "Legjobb érték",
        "features": [
            "Akár 10 eszköz meghirdetése",
            "⚡ 1 db hirdetés folyamatosan kiemelve",
            "TOP Kiemelt lista a főoldalon",
            "Részletes bérleti statisztikák"
        ]
    },
    "unlimited": {
        "id": "unlimited",
        "name": "Profi Kölcsönző",
        "price": 14990,
        "max_items": 9999,
        "featured_items": 3,
        "badge": "Korlátlan",
        "features": [
            "Bármennyi szerszám és gép feltöltése (Végtelen)",
            "⚡⚡⚡ 3 db hirdetés folyamatosan kiemelve",
            "VIP arany partner jelvény a hirdetéseken",
            "0-24 VIP kiemelt ügyfélszolgálat"
        ]
    }
}

PLAN_RANKS = {
    "free": 0,
    "starter_3": 1,
    "pro_10": 2,
    "unlimited": 3
}

ADMIN_EMAILS = {"kulovanyi.kornel@gmail.com"}

def load_local_store() -> Dict[str, Any]:
    if os.path.exists(LOCAL_FIREBASE_STORE):
        try:
            with open(LOCAL_FIREBASE_STORE, 'r', encoding='utf-8') as f:
                store = json.load(f)
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

def save_local_store(data: Dict[str, Any]):
    try:
        with open(LOCAL_FIREBASE_STORE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Store Error] Helyi tároló mentési hiba: {e}")

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

def ensure_default_users(store: Dict[str, Any]) -> Dict[str, Any]:
    kornel = None
    peter = None
    for u in store.get('users', {}).values():
        if (u.get('email') or '').strip().lower() == 'kulovanyi.kornel@gmail.com':
            kornel = u
        if (u.get('email') or '').strip().lower() == 'peter.nagy@gmail.com':
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
        store['meta']['user_seq'] = max([int(k) for k in store['users'].keys() if str(k).isdigit()] + [len(store['users'])])
        save_local_store(store)
        fs = get_firestore_client()
        if fs and is_live_firebase():
            try:
                for uid, udata in store['users'].items():
                    fs.collection('users').document(str(uid)).set(udata, merge=True)
            except Exception as e:
                print(f"[Firebase Warning] Error syncing default users: {e}")

    return store

# --- Firestore / Live Adatbázis Helper függvények ---

def get_collection_docs(col_name: str) -> Dict[str, Dict[str, Any]]:
    """Közvetlenül kiolvassa a megadott kollekció összes dokumentumát a Firebase Firestore-ból."""
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            docs = fs.collection(col_name).stream()
            result = {}
            for d in docs:
                doc_dict = d.to_dict()
                if 'id' not in doc_dict:
                    doc_dict['id'] = int(d.id) if d.id.isdigit() else d.id
                result[str(d.id)] = doc_dict
            
            local_store = load_local_store()
            local_store[col_name] = result
            save_local_store(local_store)
            
            return result
        except Exception as e:
            print(f"[Firebase Warning] Hiba a Firestore '{col_name}' lekérésekor: {e}")
    
    local_store = load_local_store()
    return local_store.get(col_name, {})

# --- FELHASZNÁLÓK (USERS) ---

def check_and_update_user_subscription(user: Dict[str, Any]) -> Dict[str, Any]:
    expires_str = user.get('subscription_expires_at')
    pending_plan = user.get('pending_downgrade_plan')
    remaining_days = None
    is_expired = False

    if expires_str:
        try:
            clean_str = str(expires_str).replace('T', ' ').split('.')[0]
            if len(clean_str) == 10:
                clean_str += ' 23:59:59'
            exp_date = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            now = datetime.now()
            diff = (exp_date - now).total_seconds()
            if diff > 0:
                remaining_days = max(1, int(diff // 86400) + (1 if diff % 86400 > 0 else 0))
            else:
                is_expired = True
                remaining_days = 0
        except Exception:
            pass

    if is_expired and pending_plan and pending_plan in SUBSCRIPTION_PLANS:
        new_plan = SUBSCRIPTION_PLANS[pending_plan]
        uid = int(user.get('id', 0))
        update_data = {
            'subscription_plan': pending_plan,
            'max_items': new_plan['max_items'],
            'featured_items_quota': new_plan.get('featured_items', 0),
            'pending_downgrade_plan': None,
            'pending_downgrade_at': None,
            'subscription_expires_at': None
        }
        user.update(update_data)
        if uid > 0:
            update_user(uid, update_data)
        remaining_days = None

    return {
        'remaining_days': remaining_days,
        'subscription_expires_at': user.get('subscription_expires_at'),
        'pending_downgrade_plan': user.get('pending_downgrade_plan'),
        'pending_downgrade_at': user.get('pending_downgrade_at')
    }

def get_user_stats(user_id: int, items_dict: Optional[Dict[str, Any]] = None, rentals_dict: Optional[Dict[str, Any]] = None, users_dict: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if items_dict is None:
        items_dict = get_collection_docs('items')
    if rentals_dict is None:
        rentals_dict = get_collection_docs('rentals')
    if users_dict is None:
        users_dict = get_collection_docs('users')
    
    active_items = sum(1 for i in items_dict.values() if int(i.get('user_id', 0)) == int(user_id))
    user_item_ids = {i.get('id') for i in items_dict.values() if int(i.get('user_id', 0)) == int(user_id)}
    completed_as_owner = sum(1 for r in rentals_dict.values() if r.get('item_id') in user_item_ids and r.get('status') == 'completed')
    completed_as_renter = sum(1 for r in rentals_dict.values() if int(r.get('renter_id', 0)) == int(user_id) and r.get('status') == 'completed')

    user = users_dict.get(str(user_id), {})
    user_email = (user.get('email') or '').strip().lower()
    is_admin = user_email in ADMIN_EMAILS or user.get('role') == 'admin' or bool(user.get('is_admin'))

    sub_status = check_and_update_user_subscription(user)

    return {
        'active_items_count': active_items,
        'completed_as_owner': completed_as_owner,
        'completed_as_renter': completed_as_renter,
        'role': 'admin' if is_admin else user.get('role', 'user'),
        'is_admin': is_admin,
        'remaining_days': sub_status.get('remaining_days'),
        'pending_downgrade_plan': sub_status.get('pending_downgrade_plan'),
        'pending_downgrade_at': sub_status.get('pending_downgrade_at')
    }

def get_users() -> List[Dict[str, Any]]:
    users_dict = get_collection_docs('users')
    items_dict = get_collection_docs('items')
    rentals_dict = get_collection_docs('rentals')
    
    users = []
    for u in users_dict.values():
        u_copy = dict(u)
        uid = int(u_copy.get('id', 0))
        stats = get_user_stats(uid, items_dict, rentals_dict, users_dict)
        u_copy.update(stats)
        if (u_copy.get('email') or '').strip().lower() in ADMIN_EMAILS:
            u_copy['role'] = 'admin'
            u_copy['is_admin'] = True
        users.append(u_copy)
    return sorted(users, key=lambda x: int(x.get('id', 0)))

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            doc = fs.collection('users').document(str(user_id)).get()
            if doc.exists:
                u = doc.to_dict()
                if 'id' not in u:
                    u['id'] = user_id
                u.update(get_user_stats(user_id))
                return u
        except Exception as e:
            print(f'[Firebase Warning] Error fetching user {user_id} from Firestore: {e}')

    users_dict = get_collection_docs('users')
    u = users_dict.get(str(user_id))
    if u:
        u_copy = dict(u)
        u_copy.update(get_user_stats(user_id))
        return u_copy
    return None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None
    email_clean = email.strip().lower()
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            docs = fs.collection('users').where('email', '==', email_clean).limit(1).stream()
            for doc in docs:
                u = doc.to_dict()
                uid = int(u.get('id', doc.id))
                u['id'] = uid
                u.update(get_user_stats(uid))
                return u
        except Exception as e:
            print(f'[Firebase Warning] Error fetching user by email from Firestore: {e}')

    users_dict = get_collection_docs('users')
    for u in users_dict.values():
        if (u.get('email') or '').strip().lower() == email_clean:
            u_copy = dict(u)
            uid = int(u_copy.get('id', 0))
            u_copy.update(get_user_stats(uid))
            return u_copy

    for u in users_dict.values():
        u_name = (u.get('name') or '').strip().lower()
        u_email = (u.get('email') or '').strip().lower()
        clean_no_space = email_clean.replace(' ', '').replace('.', '')
        name_no_space = u_name.replace(' ', '').replace('.', '')
        if clean_no_space in name_no_space or name_no_space in clean_no_space or email_clean in u_email:
            u_copy = dict(u)
            uid = int(u_copy.get('id', 0))
            u_copy.update(get_user_stats(uid))
            return u_copy
    return None

def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    users_dict = get_collection_docs('users')
    existing_ids = [int(k) for k in users_dict.keys() if str(k).isdigit()]
    new_id = (max(existing_ids) + 1) if existing_ids else int(time.time())

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
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('users').document(str(new_id)).set(user)
        except Exception as e:
            print(f'[Firebase Warning] Error saving user to Firestore: {e}')

    local_store = load_local_store()
    local_store['users'][str(new_id)] = user
    local_store['meta']['user_seq'] = new_id
    save_local_store(local_store)

    user_copy = dict(user)
    user_copy.update({'active_items_count': 0, 'completed_as_owner': 0, 'completed_as_renter': 0})
    return user_copy

def update_user(user_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    uid_str = str(user_id)
    clean_updates = {k: v for k, v in updates.items() if v is not None}

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('users').document(uid_str).set(clean_updates, merge=True)
        except Exception as e:
            print(f'[Firebase Warning] Error updating user in Firestore: {e}')

    local_store = load_local_store()
    if uid_str in local_store.get('users', {}):
        local_store['users'][uid_str].update(clean_updates)
        save_local_store(local_store)
        u = dict(local_store['users'][uid_str])
        u.update(get_user_stats(user_id))
        return u
    
    return get_user_by_id(user_id)

# --- ESZKÖZÖK & HIRDETÉSEK (ITEMS) ---

def get_items(category: Optional[str] = None, price_unit: Optional[str] = None, search: Optional[str] = None, user_id: Optional[int] = None, available_only: bool = False) -> List[Dict[str, Any]]:
    items_dict = get_collection_docs('items')
    users_dict = get_collection_docs('users')
    
    items = []
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for item in items_dict.values():
        if available_only and item.get('available') == 0:
            continue
        if user_id is not None and int(item.get('user_id', 0)) != int(user_id):
            continue
        if category and category != 'Mind' and item.get('category') != category:
            continue
        if price_unit and price_unit != 'Mind' and item.get('price_unit') != price_unit:
            continue
        if search:
            s = search.lower()
            if s not in (item.get('title') or '').lower() and s not in (item.get('description') or '').lower() and s not in (item.get('location') or '').lower():
                continue

        item_copy = dict(item)
        
        featured_until = item.get('featured_until')
        is_featured = bool(featured_until and str(featured_until) > now_str)
        item_copy['is_featured'] = is_featured
        item_copy['featured_until'] = featured_until

        owner = users_dict.get(str(item.get('user_id')))
        if owner:
            item_copy['owner_email'] = owner.get('email', '')
            item_copy['owner_id'] = owner.get('id', item.get('user_id'))
            item_copy['owner_name'] = owner.get('name', 'Bérbeadó')
            item_copy['owner_avatar'] = owner.get('avatar', '')
            item_copy['owner_rating'] = owner.get('rating', 5.0)
            item_copy['owner_phone'] = owner.get('phone', '')
            item_copy['owner_city'] = owner.get('city', item.get('location', 'Budapest'))
            item_copy['owner_plan'] = owner.get('subscription_plan', 'free')
            owner_stats = get_user_stats(int(owner.get('id', item.get('user_id'))), items_dict=items_dict, users_dict=users_dict)
            item_copy['completed_as_owner'] = owner_stats['completed_as_owner']
            item_copy['completed_as_renter'] = owner_stats['completed_as_renter']

        items.append(item_copy)

    return sorted(items, key=lambda x: (1 if x.get('is_featured') else 0, int(x.get('id', 0)) if str(x.get('id', 0)).isdigit() else 0), reverse=True)

def get_item_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    fs = get_firestore_client()
    item = None
    if fs and is_live_firebase():
        try:
            doc = fs.collection('items').document(str(item_id)).get()
            if doc.exists:
                item = doc.to_dict()
                if 'id' not in item:
                    item['id'] = item_id
        except Exception as e:
            print(f'[Firebase Warning] Error fetching item {item_id} from Firestore: {e}')

    if not item:
        items_dict = get_collection_docs('items')
        item = items_dict.get(str(item_id))

    if not item:
        return None

    item_copy = dict(item)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    featured_until = item.get('featured_until')
    item_copy['is_featured'] = bool(featured_until and str(featured_until) > now_str)
    item_copy['featured_until'] = featured_until

    users_dict = get_collection_docs('users')
    owner = users_dict.get(str(item.get('user_id')))
    if owner:
        item_copy['owner_name'] = owner.get('name', 'Bérbeadó')
        item_copy['owner_avatar'] = owner.get('avatar', '')
        item_copy['owner_rating'] = owner.get('rating', 5.0)
        item_copy['owner_phone'] = owner.get('phone', '')
        item_copy['owner_city'] = owner.get('city', item.get('location', 'Budapest'))
        item_copy['owner_plan'] = owner.get('subscription_plan', 'free')
        owner_stats = get_user_stats(int(owner.get('id', item.get('user_id'))), users_dict=users_dict)
        item_copy['completed_as_owner'] = owner_stats['completed_as_owner']
        item_copy['completed_as_renter'] = owner_stats['completed_as_renter']

    reviews_dict = get_collection_docs('reviews')
    reviews = []
    for rev in reviews_dict.values():
        if int(rev.get('item_id', 0)) == int(item_id):
            rev_copy = dict(rev)
            reviewer = users_dict.get(str(rev.get('reviewer_id')))
            if reviewer:
                rev_copy['reviewer_name'] = reviewer.get('name')
                rev_copy['reviewer_avatar'] = reviewer.get('avatar')
            reviews.append(rev_copy)
    item_copy['reviews'] = sorted(reviews, key=lambda x: x.get('created_at', ''), reverse=True)

    rentals_dict = get_collection_docs('rentals')
    booked_ranges = []
    for r in rentals_dict.values():
        if int(r.get('item_id', 0)) == int(item_id) and r.get('status') in ['pending', 'approved', 'active', 'accepted']:
            s_date = r.get('start_date')
            e_date = r.get('end_date') or s_date
            if s_date:
                booked_ranges.append({
                    'id': r.get('id'),
                    'start_date': s_date,
                    'end_date': e_date,
                    'status': r.get('status'),
                    'units_count': r.get('units_count', 1)
                })
    item_copy['booked_ranges'] = sorted(booked_ranges, key=lambda x: str(x.get('start_date', '')))

    return item_copy

def create_item(item_data: Dict[str, Any]) -> Dict[str, Any]:
    items_dict = get_collection_docs('items')
    existing_ids = [int(k) for k in items_dict.keys() if str(k).isdigit()]
    new_id = (max(existing_ids) + 1) if existing_ids else int(time.time() * 1000)

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    item = {
        'id': new_id,
        'user_id': int(item_data['user_id']),
        'title': item_data['title'],
        'category': item_data['category'],
        'description': item_data.get('description', ''),
        'price': int(item_data['price']),
        'price_unit': item_data.get('price_unit', 'nap'),
        'deposit': int(item_data.get('deposit', 0)),
        'image_url': item_data.get('image_url') or 'static/logo.png',
        'location': item_data.get('location', 'Budapest'),
        'condition': item_data.get('condition', 'Jó állapotú'),
        'available': 1,
        'created_at': now_str,
        'featured_until': None
    }
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(str(new_id)).set(item)
            print(f"[Firebase] Új hirdetés sikeresen mentve a Firestore-ba! ID: {new_id}, Cím: {item['title']}")
        except Exception as e:
            print(f'[Firebase Warning] Error saving item to Firestore: {e}')

    local_store = load_local_store()
    local_store['items'][str(new_id)] = item
    local_store['meta']['item_seq'] = new_id
    save_local_store(local_store)

    return item

def update_item(item_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    iid_str = str(item_id)
    clean_updates = {k: v for k, v in updates.items() if v is not None}

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(iid_str).set(clean_updates, merge=True)
            print(f"[Firebase] Hirdetés frissítve a Firestore-ban: {iid_str}")
        except Exception as e:
            print(f'[Firebase Warning] Error updating item in Firestore: {e}')

    local_store = load_local_store()
    if iid_str in local_store.get('items', {}):
        local_store['items'][iid_str].update(clean_updates)
        save_local_store(local_store)
        return local_store['items'][iid_str]

    return get_item_by_id(item_id)

def delete_item(item_id: int) -> bool:
    iid_str = str(item_id)
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(iid_str).delete()
            print(f"[Firebase] Hirdetés törölve a Firestore-ból: {iid_str}")
        except Exception as e:
            print(f'[Firebase Warning] Error deleting item from Firestore: {e}')

    local_store = load_local_store()
    if iid_str in local_store.get('items', {}):
        del local_store['items'][iid_str]
        save_local_store(local_store)
        return True

    return True

def boost_item(item_id: int, boost_plan_id: str, session_id: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    item = get_item_by_id(item_id)
    if not item:
        raise ValueError("Az eszköz nem található!")

    plan = BOOST_PLANS.get(boost_plan_id)
    if not plan:
        raise ValueError("Érvénytelen kiemelési csomag!")

    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    current_until = item.get('featured_until')
    
    if current_until and str(current_until) > now_str:
        try:
            base_time = datetime.strptime(str(current_until), '%Y-%m-%d %H:%M:%S')
        except Exception:
            base_time = now
    else:
        base_time = now

    new_until_dt = base_time + timedelta(days=plan['duration_days'])
    new_until = new_until_dt.strftime('%Y-%m-%d %H:%M:%S')

    target_user_id = user_id or item.get('user_id')
    user = get_user_by_id(int(target_user_id)) or {}

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

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('items').document(str(item_id)).update({'featured_until': new_until})
            fs.collection("transactions").document(session_id).set(tx_data)
        except Exception as e:
            print(f"[Firebase Warning] Error saving boost transaction to Firestore: {e}")

    local_store = load_local_store()
    if str(item_id) in local_store.get('items', {}):
        local_store['items'][str(item_id)]['featured_until'] = new_until
    if 'transactions' not in local_store:
        local_store['transactions'] = {}
    local_store['transactions'][session_id] = tx_data
    save_local_store(local_store)

    return {
        "success": True,
        "item": item,
        "boost_plan": plan,
        "featured_until": new_until,
        "transaction": tx_data,
        "message": f"⚡ Sikeres kiemelés! A hirdetés kiemelve eddig: {new_until}"
    }

# --- BÉRLÉSEK (RENTALS) ---

def get_rentals(renter_id: Optional[int] = None, owner_id: Optional[int] = None) -> List[Dict[str, Any]]:
    rentals_dict = get_collection_docs('rentals')
    items_dict = get_collection_docs('items')
    users_dict = get_collection_docs('users')
    reviews_dict = get_collection_docs('reviews')

    rentals = []
    user_item_ids = set()
    if owner_id is not None:
        user_item_ids = {int(i.get('id', 0)) for i in items_dict.values() if int(i.get('user_id', 0)) == int(owner_id)}

    for rental in rentals_dict.values():
        r_renter = int(rental.get('renter_id', 0))
        r_item_id = int(rental.get('item_id', 0))
        r_owner = int(rental.get('owner_id', 0))

        if renter_id is not None and r_renter != int(renter_id):
            continue
        if owner_id is not None and (r_item_id not in user_item_ids and r_owner != int(owner_id)):
            continue

        rental_copy = dict(rental)
        item = items_dict.get(str(r_item_id))
        if item:
            rental_copy['item_title'] = item.get('title')
            rental_copy['item_image'] = item.get('image_url')
            rental_copy['item_category'] = item.get('category')
            rental_copy['item_location'] = item.get('location')
            rental_copy['price_unit'] = item.get('price_unit')
            owner = users_dict.get(str(item.get('user_id')))
            if owner:
                rental_copy['owner_id'] = owner.get('id')
                rental_copy['owner_name'] = owner.get('name')
                rental_copy['owner_phone'] = owner.get('phone')
                rental_copy['owner_email'] = owner.get('email')

        renter = users_dict.get(str(r_renter))
        if renter:
            rental_copy['renter_name'] = renter.get('name')
            rental_copy['renter_phone'] = renter.get('phone')
            rental_copy['renter_email'] = renter.get('email')

        r_id = rental.get('id')
        rental_copy['reviews'] = [
            dict(rev) for rev in reviews_dict.values()
            if str(rev.get('rental_id')) == str(r_id)
        ]

        rentals.append(rental_copy)

    return sorted(rentals, key=lambda x: int(x.get('id', 0)) if str(x.get('id', 0)).isdigit() else 0, reverse=True)

def get_rental_by_id(rental_id: int) -> Optional[Dict[str, Any]]:
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            doc = fs.collection('rentals').document(str(rental_id)).get()
            if doc.exists:
                r = doc.to_dict()
                if 'id' not in r:
                    r['id'] = rental_id
                return r
        except Exception as e:
            print(f'[Firebase Warning] Error fetching rental {rental_id} from Firestore: {e}')

    rentals_dict = get_collection_docs('rentals')
    rental = rentals_dict.get(str(rental_id))
    if not rental:
        return None
    return dict(rental)

def check_rental_collision(item_id: int, start_date: str, end_date: Optional[str]) -> Optional[Dict[str, Any]]:
    req_start = str(start_date).strip()
    req_end = str(end_date or start_date).strip()
    if req_start > req_end:
        req_start, req_end = req_end, req_start

    rentals_dict = get_collection_docs('rentals')
    for r in rentals_dict.values():
        if int(r.get('item_id', 0)) == int(item_id) and r.get('status') in ['pending', 'approved', 'active', 'accepted']:
            ex_start = str(r.get('start_date') or '').strip()
            ex_end = str(r.get('end_date') or ex_start).strip()
            if not ex_start:
                continue
            if ex_start > ex_end:
                ex_start, ex_end = ex_end, ex_start

            if req_start <= ex_end and req_end >= ex_start:
                return {
                    'start_date': ex_start,
                    'end_date': ex_end,
                    'status': r.get('status')
                }
    return None

def create_rental(rental_data: Dict[str, Any]) -> Dict[str, Any]:
    collision = check_rental_collision(
        int(rental_data['item_id']),
        rental_data['start_date'],
        rental_data.get('end_date')
    )
    if collision:
        raise ValueError(f"Ez az eszköz a megadott időszakban ({collision['start_date']} – {collision['end_date']}) már le van foglalva! Kérlek válassz másik szabad időpontot.")

    rentals_dict = get_collection_docs('rentals')
    existing_ids = [int(k) for k in rentals_dict.keys() if str(k).isdigit()]
    new_id = (max(existing_ids) + 1) if existing_ids else int(time.time())

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    rental = {
        'id': new_id,
        'item_id': int(rental_data['item_id']),
        'renter_id': int(rental_data['renter_id']),
        'owner_id': int(rental_data.get('owner_id', 1)),
        'start_date': rental_data['start_date'],
        'end_date': rental_data.get('end_date') or rental_data['start_date'],
        'units_count': int(rental_data.get('units_count', 1)),
        'total_price': int(rental_data['total_price']),
        'deposit': int(rental_data.get('deposit', 0)),
        'note': rental_data.get('note', ''),
        'status': 'pending',
        'created_at': now_str
    }
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('rentals').document(str(new_id)).set(rental)
            print(f"[Firebase] Új bérlés mentve a Firestore-ba! ID: {new_id}")
        except Exception as e:
            print(f'[Firebase Warning] Error saving rental to Firestore: {e}')

    local_store = load_local_store()
    local_store['rentals'][str(new_id)] = rental
    local_store['meta']['rental_seq'] = new_id
    save_local_store(local_store)

    return rental

def update_rental_status(rental_id: int, status: str) -> Optional[Dict[str, Any]]:
    rid_str = str(rental_id)
    
    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('rentals').document(rid_str).update({'status': status})
            print(f"[Firebase] Bérlés státusza módosítva a Firestore-ban: {rid_str} -> {status}")
        except Exception as e:
            print(f'[Firebase Warning] Error updating rental in Firestore: {e}')

    local_store = load_local_store()
    if rid_str in local_store.get('rentals', {}):
        local_store['rentals'][rid_str]['status'] = status
        save_local_store(local_store)
        return local_store['rentals'][rid_str]

    return get_rental_by_id(rental_id)

# --- ÉRTÉKELÉSEK (REVIEWS) ---

def get_reviews_for_item(item_id: int) -> List[Dict[str, Any]]:
    reviews_dict = get_collection_docs('reviews')
    users_dict = get_collection_docs('users')
    reviews = []
    for rev in reviews_dict.values():
        if int(rev.get('item_id', 0)) == int(item_id):
            rev_copy = dict(rev)
            reviewer = users_dict.get(str(rev.get('reviewer_id')))
            if reviewer:
                rev_copy['reviewer_name'] = reviewer.get('name')
                rev_copy['reviewer_avatar'] = reviewer.get('avatar')
            reviews.append(rev_copy)
    return sorted(reviews, key=lambda x: int(x.get('id', 0)) if str(x.get('id', 0)).isdigit() else 0, reverse=True)

def create_review(review_data: Dict[str, Any]) -> Dict[str, Any]:
    rental_id = review_data.get('rental_id')
    if not rental_id:
        raise ValueError("Értékelést csak lezárt vagy meghiúsult bérléshez lehet leadni!")

    rental = get_rental_by_id(int(rental_id))
    if not rental:
        raise ValueError("A megadott bérlés nem található!")

    item = get_item_by_id(int(rental.get('item_id', 0)))
    if not item:
        raise ValueError("A bérléshez tartozó eszköz nem található!")

    owner_id = int(item.get('user_id', rental.get('owner_id', 1)))
    renter_id = int(rental.get('renter_id'))
    reviewer_id = int(review_data.get('reviewer_id', 0))

    if reviewer_id not in [owner_id, renter_id]:
        raise ValueError("Csak a bérlésben érintett bérlő vagy bérbeadó értékelheti egymást!")

    status = rental.get('status')
    try:
        rating = int(review_data.get('rating', 5))
    except Exception:
        rating = 5

    if rating < 1 or rating > 5:
        raise ValueError("Az értékelésnek 1 és 5 csillag között kell lennie!")

    target_user_id = renter_id if reviewer_id == owner_id else owner_id

    reviews_dict = get_collection_docs('reviews')
    for existing in reviews_dict.values():
        if str(existing.get('rental_id')) == str(rental_id) and int(existing.get('reviewer_id', 0)) == reviewer_id:
            raise ValueError("Erre a bérlésre már adtál le értékelést!")

    existing_ids = [int(k) for k in reviews_dict.keys() if str(k).isdigit()]
    new_id = (max(existing_ids) + 1) if existing_ids else int(time.time())

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    review = {
        'id': new_id,
        'rental_id': int(rental_id),
        'item_id': int(rental.get('item_id')),
        'reviewer_id': reviewer_id,
        'target_user_id': target_user_id,
        'rating': rating,
        'comment': str(review_data.get('comment', '')).strip(),
        'status_context': status,
        'created_at': now_str
    }
    
    all_target_revs = [r for r in reviews_dict.values() if int(r.get('target_user_id', 0)) == target_user_id]
    all_target_revs.append(review)
    avg_r = round(sum(int(r.get('rating', 5)) for r in all_target_revs) / len(all_target_revs), 1)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('reviews').document(str(new_id)).set(review)
            fs.collection('users').document(str(target_user_id)).set({
                'rating': avg_r,
                'reviews_count': len(all_target_revs)
            }, merge=True)
            print(f"[Firebase] Új értékelés mentve a Firestore-ba! ID: {new_id}")
        except Exception as e:
            print(f'[Firebase Warning] Error saving review to Firestore: {e}')

    local_store = load_local_store()
    local_store['reviews'][str(new_id)] = review
    local_store['meta']['review_seq'] = new_id
    if str(target_user_id) in local_store.get('users', {}):
        local_store['users'][str(target_user_id)]['rating'] = avg_r
        local_store['users'][str(target_user_id)]['reviews_count'] = len(all_target_revs)
    save_local_store(local_store)

    return review

# --- BELSŐ ÜZENETKEZELŐ (MESSAGING & CHAT) ---

def get_conversations(user_id: int, folder: str = "inbox") -> List[Dict[str, Any]]:
    convs_dict = get_collection_docs('conversations')
    users_dict = get_collection_docs('users')
    items_dict = get_collection_docs('items')
    
    convs = []
    uid_int = int(user_id)
    uid_str = str(user_id)

    for conv in convs_dict.values():
        participants = [int(p) for p in conv.get('participants', []) if str(p).isdigit()]
        if uid_int not in participants:
            continue
        
        deleted_by = [str(d) for d in conv.get('deleted_by', [])]
        if uid_str in deleted_by:
            continue

        archived_by = [str(a) for a in conv.get('archived_by', [])]
        is_archived = uid_str in archived_by

        if folder == "archived" and not is_archived:
            continue
        if folder == "inbox" and is_archived:
            continue

        conv_copy = dict(conv)
        conv_copy['is_archived'] = is_archived

        partner_id = next((p for p in participants if p != uid_int), uid_int)
        partner = users_dict.get(str(partner_id), {})
        conv_copy['partner'] = {
            'id': partner_id,
            'name': partner.get('name', 'Felhasználó'),
            'avatar': partner.get('avatar', ''),
            'phone': partner.get('phone', ''),
            'city': partner.get('city', ''),
            'rating': partner.get('rating', 5.0)
        }

        item_id = conv.get('item_id')
        if item_id:
            item = items_dict.get(str(item_id))
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
        conv_copy['unread_count'] = unread_dict.get(uid_str, unread_dict.get(uid_int, 0))

        convs.append(conv_copy)

    return sorted(convs, key=lambda x: str(x.get('last_message_at', '')), reverse=True)

def get_conversation(conv_id: str, user_id: int) -> Optional[Dict[str, Any]]:
    convs_dict = get_collection_docs('conversations')
    conv = convs_dict.get(str(conv_id))
    if not conv:
        return None

    uid_int = int(user_id)
    uid_str = str(user_id)
    participants = [int(p) for p in conv.get('participants', []) if str(p).isdigit()]
    if uid_int not in participants:
        return None

    conv_copy = dict(conv)
    conv_copy['is_archived'] = uid_str in [str(a) for a in conv.get('archived_by', [])]

    partner_id = next((p for p in participants if p != uid_int), uid_int)
    users_dict = get_collection_docs('users')
    partner = users_dict.get(str(partner_id), {})
    conv_copy['partner'] = {
        'id': partner_id,
        'name': partner.get('name', 'Felhasználó'),
        'avatar': partner.get('avatar', ''),
        'phone': partner.get('phone', ''),
        'city': partner.get('city', ''),
        'rating': partner.get('rating', 5.0)
    }

    item_id = conv.get('item_id')
    if item_id:
        items_dict = get_collection_docs('items')
        item = items_dict.get(str(item_id))
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
    conv_copy['unread_count'] = unread_dict.get(uid_str, unread_dict.get(uid_int, 0))
    return conv_copy

def get_messages(conv_id: str, user_id: int) -> List[Dict[str, Any]]:
    conv = get_conversation(conv_id, user_id)
    if not conv:
        return []

    messages_dict = get_collection_docs('messages')
    msgs = []
    uid_int = int(user_id)

    for m in messages_dict.values():
        if str(m.get('conversation_id')) == str(conv_id):
            m_copy = dict(m)
            m_copy['is_mine'] = (int(m.get('sender_id', 0)) == uid_int)
            msgs.append(m_copy)

    return sorted(msgs, key=lambda x: str(x.get('created_at', '')))

def send_message(
    sender_id: int,
    receiver_id: int,
    content: str,
    item_id: Optional[int] = None,
    conv_id: Optional[str] = None
) -> Dict[str, Any]:
    convs_dict = get_collection_docs('conversations')
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    sender_id = int(sender_id)
    receiver_id = int(receiver_id)

    target_conv_id = conv_id
    if not target_conv_id:
        for cid, c in convs_dict.items():
            parts = [int(p) for p in c.get('participants', []) if str(p).isdigit()]
            if sender_id in parts and receiver_id in parts:
                if item_id is None or c.get('item_id') == item_id:
                    target_conv_id = cid
                    break

    if not target_conv_id or str(target_conv_id) not in convs_dict:
        target_conv_id = f"conv_{int(time.time())}"
        conv_data = {
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
        conv_data = dict(convs_dict[str(target_conv_id)])
        conv_data['last_message'] = content
        conv_data['last_message_at'] = now_str
        conv_data['last_sender_id'] = sender_id
        if item_id and not conv_data.get('item_id'):
            conv_data['item_id'] = item_id
        
        conv_data['deleted_by'] = [d for d in conv_data.get('deleted_by', []) if str(d) not in [str(sender_id), str(receiver_id)]]
        conv_data['archived_by'] = [a for a in conv_data.get('archived_by', []) if str(a) != str(receiver_id)]

        if 'unread_counts' not in conv_data:
            conv_data['unread_counts'] = {}
        curr_unread = conv_data['unread_counts'].get(str(receiver_id), 0)
        conv_data['unread_counts'][str(receiver_id)] = curr_unread + 1
        conv_data['unread_counts'][str(sender_id)] = 0

    messages_dict = get_collection_docs('messages')
    existing_msg_ids = [int(k) for k in messages_dict.keys() if str(k).isdigit()]
    new_msg_id = (max(existing_msg_ids) + 1) if existing_msg_ids else int(time.time())

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

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(str(target_conv_id)).set(conv_data)
            fs.collection('messages').document(str(new_msg_id)).set(msg_obj)
            print(f"[Firebase] Üzenet mentve a Firestore-ba! Beszélgetés: {target_conv_id}")
        except Exception as e:
            print(f"[Firebase Warning] Error saving message to Firestore: {e}")

    local_store = load_local_store()
    local_store['conversations'][str(target_conv_id)] = conv_data
    local_store['messages'][str(new_msg_id)] = msg_obj
    save_local_store(local_store)

    return {
        'success': True,
        'conversation_id': target_conv_id,
        'message': msg_obj
    }

def mark_conversation_read(conv_id: str, user_id: int) -> bool:
    cid_str = str(conv_id)
    user_id_str = str(user_id)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).set({
                'unread_counts': {user_id_str: 0}
            }, merge=True)
        except Exception as e:
            print(f"[Firebase Warning] Error marking conversation as read in Firestore: {e}")

    local_store = load_local_store()
    if cid_str in local_store.get('conversations', {}):
        if 'unread_counts' not in local_store['conversations'][cid_str]:
            local_store['conversations'][cid_str]['unread_counts'] = {}
        local_store['conversations'][cid_str]['unread_counts'][user_id_str] = 0
        save_local_store(local_store)

    return True

def archive_conversation(conv_id: str, user_id: int, archive: bool = True) -> bool:
    cid_str = str(conv_id)
    user_id_str = str(user_id)
    uid_int = int(user_id)

    convs_dict = get_collection_docs('conversations')
    if cid_str not in convs_dict:
        return False

    conv = convs_dict[cid_str]
    archived_list = [str(a) for a in conv.get('archived_by', [])]
    if archive:
        if user_id_str not in archived_list:
            archived_list.append(uid_int)
    else:
        archived_list = [a for a in archived_list if str(a) != user_id_str]

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).update({'archived_by': archived_list})
        except Exception as e:
            print(f"[Firebase Warning] Error updating archive in Firestore: {e}")

    local_store = load_local_store()
    if cid_str in local_store.get('conversations', {}):
        local_store['conversations'][cid_str]['archived_by'] = archived_list
        save_local_store(local_store)

    return True

def delete_conversation(conv_id: str, user_id: int) -> bool:
    cid_str = str(conv_id)
    user_id_str = str(user_id)
    uid_int = int(user_id)

    convs_dict = get_collection_docs('conversations')
    if cid_str not in convs_dict:
        return False

    conv = convs_dict[cid_str]
    deleted_list = [str(d) for d in conv.get('deleted_by', [])]
    if user_id_str not in deleted_list:
        deleted_list.append(uid_int)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection('conversations').document(cid_str).update({'deleted_by': deleted_list})
        except Exception as e:
            print(f"[Firebase Warning] Error updating deleted_by in Firestore: {e}")

    local_store = load_local_store()
    if cid_str in local_store.get('conversations', {}):
        local_store['conversations'][cid_str]['deleted_by'] = deleted_list
        save_local_store(local_store)

    return True

def get_unread_messages_count(user_id: int) -> int:
    convs_dict = get_collection_docs('conversations')
    user_id_str = str(user_id)
    uid_int = int(user_id)
    total_unread = 0

    for conv in convs_dict.values():
        participants = [int(p) for p in conv.get('participants', []) if str(p).isdigit()]
        if uid_int not in participants:
            continue
        deleted_by = [str(d) for d in conv.get('deleted_by', [])]
        if user_id_str in deleted_by:
            continue
        unread_dict = conv.get('unread_counts', {})
        total_unread += unread_dict.get(user_id_str, unread_dict.get(uid_int, 0))

    return total_unread

def get_transactions() -> List[Dict[str, Any]]:
    txs_dict = get_collection_docs('transactions')
    transactions = list(txs_dict.values())
    return sorted(transactions, key=lambda x: str(x.get('created_at', '')), reverse=True)

def get_admin_overview() -> Dict[str, Any]:
    users = get_users()
    items = get_items()
    rentals = get_rentals()
    transactions = get_transactions()

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

    plans_distribution = {
        'free': sum(1 for u in users if u.get('subscription_plan', 'free') == 'free'),
        'starter_3': sum(1 for u in users if u.get('subscription_plan') == 'starter_3'),
        'pro_10': sum(1 for u in users if u.get('subscription_plan') == 'pro_10'),
        'unlimited': sum(1 for u in users if u.get('subscription_plan') == 'unlimited')
    }

    categories_distribution: Dict[str, int] = {}
    locations_distribution: Dict[str, int] = {}
    for item in items:
        cat = item.get('category', 'Egyéb')
        categories_distribution[cat] = categories_distribution.get(cat, 0) + 1
        loc = item.get('location', 'Ismeretlen')
        locations_distribution[loc] = locations_distribution.get(loc, 0) + 1

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
            'paying_subscribers': max(0, len(users) - plans_distribution['free'])
        },
        'monthly_revenue': monthly_list,
        'plans_distribution': plans_distribution,
        'categories_distribution': categories_distribution,
        'locations_distribution': sorted(locations_distribution.items(), key=lambda x: x[1], reverse=True)[:10],
        'recent_transactions': transactions[:15],
        'users_list': users,
        'items_list': items
    }

def sync_to_live_firestore():
    fs = get_firestore_client()
    if not fs or not is_live_firebase():
        return False, 'Nincs aktív élő Firebase kapcsolat.'

    store = load_local_store()
    for col in ['users', 'items', 'rentals', 'reviews', 'conversations', 'messages', 'transactions']:
        for doc_id, doc_data in store.get(col, {}).items():
            fs.collection(col).document(str(doc_id)).set(doc_data)
    return True, 'Sikeres feltöltés és szinkronizálás a Firebase adatbázisba!'

# Kezdeti inicializálás
init_firebase()
if not os.path.exists(LOCAL_FIREBASE_STORE):
    seed_initial_data()
