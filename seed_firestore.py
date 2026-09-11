# -*- coding: utf-8 -*-
import json
import os
import urllib.request
import urllib.error

PROJECT_ID = 'kolcsonadlak-7212a'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(BASE_DIR, 'firebase_store.json')
CONFIG_FILE = os.path.expandvars(r'%USERPROFILE%\.config\configstore\firebase-tools.json')

def to_firestore_value(val):
    if val is None:
        return {'nullValue': None}
    elif isinstance(val, bool):
        return {'booleanValue': val}
    elif isinstance(val, int):
        return {'integerValue': str(val)}
    elif isinstance(val, float):
        return {'doubleValue': val}
    elif isinstance(val, str):
        return {'stringValue': val}
    elif isinstance(val, list):
        return {'arrayValue': {'values': [to_firestore_value(v) for v in val]}}
    elif isinstance(val, dict):
        return {'mapValue': {'fields': {k: to_firestore_value(v) for k, v in val.items()}}}
    return {'stringValue': str(val)}

def get_token():
    if not os.path.exists(CONFIG_FILE):
        print('Hiba: Nem talalhato a Firebase bejelentkezesi token!')
        return None
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('tokens', {}).get('access_token')

def seed():
    token = get_token()
    if not token:
        return
    if not os.path.exists(JSON_FILE):
        print('Hiba: firebase_store.json nem talalhato!')
        return
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        store = json.load(f)
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    print('=' * 60)
    print('  KOLCSONADLAK.HU - FIRESTORE CLOUD ADATFELTOLTES')
    print('=' * 60)
    
    total_docs = 0
    for col in ['users', 'items', 'rentals', 'reviews', 'conversations', 'messages', 'transactions']:
        items_dict = store.get(col, {})
        print(f'\n-> Feltoltes gyujtemenybe: [{col}] ({len(items_dict)} elem)...')
        for doc_id, doc_data in items_dict.items():
            url = f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{col}/{doc_id}'
            body = {
                'fields': {k: to_firestore_value(v) for k, v in doc_data.items()}
            }
            req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), method='PATCH', headers=headers)
            try:
                with urllib.request.urlopen(req) as resp:
                    print(f'   + [{col}/{doc_id}] mentve.')
                    total_docs += 1
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode('utf-8', errors='replace')
                if e.code == 404:
                    print(f'   ! HIBA (404): A Firestore Adatbazis meg nincs letrehozva a Firebase Console-ban!')
                    print(f'     Nyisd meg: https://console.firebase.google.com/project/{PROJECT_ID}/firestore')
                    print(f'     Es kattints a "Create database" (Letrehozas) gombra!')
                    return
                else:
                    print(f'   ! Hiba ({e.code}): {err_msg[:150]}')
                    
    print('\n' + '=' * 60)
    print(f'  SIKERESEN FELTOLTVE {total_docs} DOKUMENTUM A CLOUD FIRESTORE-BA!')
    print('=' * 60)

if __name__ == '__main__':
    seed()
