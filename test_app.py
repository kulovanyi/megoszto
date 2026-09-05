import sys
import os
import json
import io

# UTF-8 kimenet beállítása Windows konzolon
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi.testclient import TestClient
import firebase_db
from firebase_config import init_firebase, is_live_firebase
from app import app

def run_tests():
    print("=== KOLCSONADO RENDSZERTESZT INDITASA (ELO FIREBASE) ===")
    
    init_firebase()
    client = TestClient(app)

    # 1. Főoldal ellenőrzése
    res = client.get("/")
    assert res.status_code == 200, f"Fooldal betoltesi hiba: {res.status_code}"
    assert "Megosztó" in res.text or "megoszto.hu" in res.text
    print("[OK] 1. Fooldal HTML sikeresen betoltodik")

    # 2. Felhasználók lekérdezése
    res = client.get("/api/users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 2
    print(f"[OK] 2. Felhasznalok lekerese sikeres a Firebase-bol ({len(users)} felhasznalo)")

    # 3. Eszközök lekérése (kizárólag valós Firebase elemek)
    res = client.get("/api/items")
    assert res.status_code == 200
    items = res.json()
    print(f"[OK] 3. Eszkozok listazasa sikeres a Firebase-bol ({len(items)} valos eszkoz)")

    # 4. Előfizetési csomagok
    res_plans = client.get("/api/plans")
    assert res_plans.status_code == 200
    plans = res_plans.json()
    assert len(plans) == 4
    print(f"[OK] 4. Elofizetesi csomagok lekerese sikeres ({len(plans)} csomag)")

    # 5. Települések API
    res_cities = client.get("/api/cities")
    assert res_cities.status_code == 200
    cities_list = res_cities.json()
    assert "Balassagyarmat" in cities_list, "Balassagyarmat hianyzik a listabol!"
    print(f"[OK] 5. Telepulesek adatbazis sikeresen betoltve ({len(cities_list)} db)")

    # 6. Új hirdetés feladása és mentése Firebase-be
    owner_user = users[0]
    renter_user = users[1]
    new_tool = {
        "user_id": owner_user["id"],
        "title": "Firebase Integracios Teszt Eszkoz",
        "category": "Kerteszet",
        "description": "Teszt hirdetes a Firebase szinkronizacio igazolasara.",
        "price": 2500,
        "price_unit": "nap",
        "deposit": 5000,
        "location": "Budapest",
        "condition": "Ujszeru"
    }
    res_create = client.post("/api/items", json=new_tool)
    assert res_create.status_code == 200
    new_item_id = res_create.json()["id"]
    print(f"[OK] 6. Uj hirdetes mentese Firebase-be sikeres (ID: {new_item_id})")

    # 7. Hirdetés adatainak lekérdezése
    res_get_item = client.get(f"/api/items/{new_item_id}")
    assert res_get_item.status_code == 200
    assert res_get_item.json()["title"] == "Firebase Integracios Teszt Eszkoz"
    print("[OK] 7. Hirdetes azonnali visszaolvasasa a Firebase-bol sikeres")

    # 8. Hirdetés módosítása
    res_edit = client.put(f"/api/items/{new_item_id}", json={
        "user_id": owner_user["id"],
        "title": "Modositott Firebase Teszt Eszkoz",
        "price": 3000
    })
    assert res_edit.status_code == 200
    assert res_edit.json()["item"]["price"] == 3000
    print("[OK] 8. Hirdetes sikeresen modositva a Firebase-ben")

    # 9. Bérlési kérelem rögzítése
    rental_req = {
        "item_id": new_item_id,
        "renter_id": renter_user["id"],
        "start_date": "2026-11-20",
        "end_date": "2026-11-22",
        "units_count": 2,
        "total_price": 6000,
        "deposit": 5000,
        "note": "Teszt berles"
    }
    res_rental = client.post("/api/rentals", json=rental_req)
    assert res_rental.status_code == 200
    rental_id = res_rental.json()["id"]
    print(f"[OK] 9. Berlesi kerelem mentese Firebase-be sikeres (Rental ID: {rental_id})")

    # 10. Bérlés státusz frissítés
    res_accept = client.patch(f"/api/rentals/{rental_id}/status", json={"status": "approved"})
    assert res_accept.status_code == 200
    print("[OK] 10. Berles statusz frissitese sikeres a Firebase-ben")

    # 11. Hirdetés törlése a teszt végeztével
    res_del = client.delete(f"/api/items/{new_item_id}?user_id={owner_user['id']}")
    assert res_del.status_code == 200
    print("[OK] 11. Teszt hirdetes sikeresen torolve a Firebase-bol")

    # 12. Firebase állapot ellenőrzése
    res_fb_status = client.get("/api/firebase/status")
    assert res_fb_status.status_code == 200
    fb_status_data = res_fb_status.json()
    print(f"[OK] 12. Firebase kapcsolat ellenorizve ({fb_status_data.get('database_type', 'Aktiv')})")

    print("\n*** MINDEN FIREBASE ADATBAZIS ES API INTEGRACIOS TESZT SIKERESEN LEFUTOTT! ***")

if __name__ == "__main__":
    run_tests()
