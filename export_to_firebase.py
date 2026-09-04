import os
import sys
import json
from firebase_config import init_firebase, get_firestore_client, is_live_firebase
import firebase_db

def export_all_to_firebase():
    print('=== KOLCSONADO FIREBASE SZINKRONIZALO ES EXPORTALO ESZKOZ ===')
    db, is_live = init_firebase()

    if not is_live:
        print('[INFO] Nincs csatlakoztatva elo Firebase (hianyzik a firebase-credentials.json).')
        print('[INFO] A helyi Firebase adatbazis tarolo (firebase_store.json) keszen all es szinkronban van.')
        print('\nUtmutato az elo Firebase Firestore-hoz kapcsolodashoz:')
        print('1. Menj a Firebase Console-ba (https://console.firebase.google.com)')
        print('2. Hozz letre egy uj projektet vagy valaszd ki a meglebot.')
        print('3. Project Settings -> Service accounts -> Generate new private key')
        print('4. Mentstd le a JSON fajlt a projekt mappajaba ezen a neven: firebase-credentials.json')
        print('5. Futtasd ujra ezt a scriptet: python export_to_firebase.py')
        return

    print('[INFO] Elo Firebase kapcsolat eszlelve! Adatok feltoltese a Firestore-ba...')
    success, msg = firebase_db.sync_to_live_firestore()
    if success:
        print(f'[SUCCESS] {msg}')
    else:
        print(f'[ERROR] {msg}')

if __name__ == '__main__':
    export_all_to_firebase()
