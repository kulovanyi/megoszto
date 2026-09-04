import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Lehetséges Firebase hitelesítő fájl elérési utak
CREDENTIALS_PATHS = [
    os.path.join(BASE_DIR, 'firebase-credentials.json'),
    os.path.join(BASE_DIR, 'firebase-key.json'),
    os.path.join(BASE_DIR, 'serviceAccountKey.json'),
    os.environ.get('FIREBASE_CREDENTIALS_PATH', '')
]

FIREBASE_PROJECT_ID = "kolcsonado"
FIREBASE_API_KEY = "AIzaSyCZqV24fltN672ySbrw28dxEPGcNFi06zE"
FIREBASE_AUTH_DOMAIN = "kolcsonado.firebaseapp.com"
FIREBASE_STORAGE_BUCKET = "kolcsonado.firebasestorage.app"

_firebase_app = None
_firestore_db = None
_is_live_firebase = False

def get_credentials_path():
    for path in CREDENTIALS_PATHS:
        if path and os.path.exists(path):
            return path
    return None

def init_firebase():
    global _firebase_app, _firestore_db, _is_live_firebase

    if _firebase_app is not None:
        return _firestore_db, _is_live_firebase

    cred_path = get_credentials_path()
    db_url = os.environ.get('FIREBASE_DATABASE_URL', None)

    try:
        if cred_path:
            cred = credentials.Certificate(cred_path)
            if db_url:
                _firebase_app = firebase_admin.initialize_app(cred, {'databaseURL': db_url})
            else:
                _firebase_app = firebase_admin.initialize_app(cred)
            
            _firestore_db = firestore.client()
            _is_live_firebase = True
            print(f'[Firebase] Csatlakozva az ELO Firebase Firestore adatbazishoz! (Kulcs: {os.path.basename(cred_path)})')
        else:
            _is_live_firebase = False
            _firestore_db = None
            print('[Firebase] Helyi Firebase adatbazis reteg aktiv. Elo kapcsolathoz helyezz el egy firebase-credentials.json fajlt.')
    except Exception as e:
        print(f'[Firebase Warning] Inicializalasi ertesites: {e}')
        _is_live_firebase = False
        _firestore_db = None

    return _firestore_db, _is_live_firebase

def get_firestore_client():
    global _firestore_db
    if _firestore_db is None and _is_live_firebase:
        init_firebase()
    return _firestore_db

def is_live_firebase():
    return _is_live_firebase
