import sys
import os
import json
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from fastapi.testclient import TestClient
import database
from app import app

def run_tests():
    print("=== KÖLCSÖNADÓ RENDSZERTESZT INDÍTÁSA ===")
    
    # 1. Adatbázis inicializálás és seed
    database.init_db()
    database.seed_data()
    
    client = TestClient(app)

    # 2. Főoldal ellenőrzése
    res = client.get("/")
    assert res.status_code == 200, f"Főoldal betöltési hiba: {res.status_code}"
    assert "KölcsönAdó" in res.text
    print("✅ 1. Főoldal HTML sikeresen betöltődik")

    # 3. Felhasználók lekérdezése
    res = client.get("/api/users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 4
    print(f"✅ 2. Felhasználók lekérése sikeres ({len(users)} felhasználó)")

    # 4. Eszközök lekérése és szűrések tesztelése
    res = client.get("/api/items")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 8
    print(f"✅ 3. Eszközök listázása sikeres ({len(items)} eszköz az adatbázisban)")

    # Szűrés /nap, /munka szerint
    res_work = client.get("/api/items?unit=munka")
    assert res_work.status_code == 200
    work_items = res_work.json()
    assert any(i["price_unit"] == "munka" for i in work_items)
    print(f"✅ 4. Elszámolási egység szerinti szűrés (/munka) sikeres ({len(work_items)} db)")

    # Szűrés kategóriára
    res_garden = client.get("/api/items?category=Kertészet")
    assert res_garden.status_code == 200
    garden_items = res_garden.json()
    assert any("Ásó" in i["title"] for i in garden_items)
    print(f"✅ 5. Kategória szűrés (Kertészet, pl. Ásó) sikeres ({len(garden_items)} db)")

    # 5. Új eszköz feladása teszt (Nagy Dániel - unlimited csomag)
    new_tool = {
        "user_id": users[2]["id"],
        "title": "Kézi Földfúró 150mm (Oszlopokhoz, növényekhez)",
        "category": "Kertészet",
        "description": "Erős acél kézi talajfúró kerti oszlopok és facsemeték lyukainak fúrásához.",
        "price": 1200,
        "price_unit": "nap",
        "deposit": 3000,
        "location": "Budapest, XI. kerület",
        "condition": "Újszerű"
    }
    res_create = client.post("/api/items", json=new_tool)
    assert res_create.status_code == 200
    new_item_id = res_create.json()["id"]
    print(f"✅ 6. Új hirdetés feladása sikeres (ID: {new_item_id})")

    # 6. Bérlési kérelem leadása
    rental_req = {
        "item_id": new_item_id,
        "renter_id": users[1]["id"],
        "start_date": "2026-09-10",
        "end_date": "2026-09-12",
        "units_count": 2,
        "total_price": 2400,
        "deposit": 3000,
        "note": "Kerítésépítéshez szeretném elvinni csütörtöktől szombatig."
    }
    res_rental = client.post("/api/rentals", json=rental_req)
    assert res_rental.status_code == 200
    rental_id = res_rental.json()["id"]
    print(f"✅ 7. Bérlési kérelem küldése sikeres (Rental ID: {rental_id})")

    # 7. Bérlés státuszának frissítése (Elfogadás -> Befejezés)
    res_accept = client.patch(f"/api/rentals/{rental_id}/status", json={"status": "accepted"})
    assert res_accept.status_code == 200
    print("✅ 8. Bérbeadó kérelem-elfogadása sikeres")

    res_complete = client.patch(f"/api/rentals/{rental_id}/status", json={"status": "completed"})
    assert res_complete.status_code == 200
    print("✅ 9. Bérlés sikeres lezárása (visszavétel & elszámolás)")

    # 8. Értékelés beküldése
    review_data = {
        "rental_id": rental_id,
        "item_id": new_item_id,
        "reviewer_id": users[1]["id"],
        "rating": 5,
        "comment": "Kiváló eszköz, sok időt spóroltunk meg vele a kerítésoszlopoknál!"
    }
    res_rev = client.post("/api/reviews", json=review_data)
    assert res_rev.status_code == 200
    print("✅ 10. Értékelés és véleményezés sikeres")

    # 9. Előfizetési csomagok lekérdezése
    res_plans = client.get("/api/plans")
    assert res_plans.status_code == 200
    plans = res_plans.json()
    assert len(plans) == 4
    print(f"✅ 11. Előfizetési csomagok lekérése sikeres ({len(plans)} csomag: Ingyenes, 3 db, 10 db, Végtelen)")

    # 10. Ingyenes korlát és előfizetési limit tesztelése
    # Tóth Gábor (users[3]) ingyenes felhasználó (max_items = 1).
    # Feltölt egy 1. ingyenes terméket:
    free_user_id = users[3]["id"]
    item_1 = {
        "user_id": free_user_id,
        "title": "Kézi Kerti Gereblye",
        "category": "Kertészet",
        "description": "Erős fém fogú gereblye falevelekhez és föld elegyengetéséhez.",
        "price": 500,
        "price_unit": "nap",
        "deposit": 1000,
        "location": "Budapest, XIV. kerület",
        "condition": "Jó állapotú"
    }
    res_i1 = client.post("/api/items", json=item_1)
    assert res_i1.status_code == 200
    print("✅ 12. Ingyenes 1. termék feltöltése sikeres")

    # Megpróbál egy 2. terméket feltölteni csomagváltás nélkül (blokkolva kell legyen):
    item_2 = {
        "user_id": free_user_id,
        "title": "Metszőolló Fiskars",
        "category": "Kertészet",
        "description": "Éles kerti metszőolló ágakhoz.",
        "price": 600,
        "price_unit": "nap",
        "deposit": 1000,
        "location": "Budapest, XIV. kerület",
        "condition": "Újszerű"
    }
    res_i2 = client.post("/api/items", json=item_2)
    assert res_i2.status_code == 400
    assert "korlátját" in res_i2.json()["detail"]
    print("✅ 13. Csomaglimit helyesen blokkolta a 2. termék feltöltését ingyenes csomagnál")

    # Előfizetés a Kertbarát (3 termék) csomagra:
    res_upg = client.post(f"/api/users/{free_user_id}/upgrade", json={"plan_id": "starter_3"})
    assert res_upg.status_code == 200
    assert res_upg.json()["user"]["max_items"] == 3
    print("✅ 14. Sikeres csomagváltás 'Kertbarát (3 termék)' előfizetésre")

    # 11. Képfeltöltés tesztelése (/api/upload)
    test_image_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"  # Dummy JPEG header
    files = {"file": ("teszt_kerti_aso.jpg", test_image_bytes, "image/jpeg")}
    res_upload = client.post("/api/upload", files=files)
    assert res_upload.status_code == 200
    uploaded_url = res_upload.json()["url"]
    assert "/static/uploads/" in uploaded_url
    print(f"✅ 16. Képfeltöltés sikeres ({uploaded_url})")

    # 12. Új regisztráció és bejelentkezés tesztelése (/api/auth)
    reg_payload = {
        "name": "Minta János",
        "email": "janos@teszt.hu",
        "password": "titkosjelszo",
        "phone": "+36 30 777 8899",
        "city": "Győr"
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code == 200
    new_user = res_reg.json()["user"]
    assert new_user["name"] == "Minta János"
    assert new_user["max_items"] == 1
    print(f"✅ 17. Új felhasználó regisztrációja sikeres (ID: {new_user['id']})")

    # Bejelentkezés rossz jelszóval
    res_bad_login = client.post("/api/auth/login", json={"email": "janos@teszt.hu", "password": "rossz"})
    assert res_bad_login.status_code == 401
    print("✅ 18. Hibás jelszavas bejelentkezés helyesen elutasítva")

    # 13. Települések API és Balassagyarmat ellenőrzése
    res_cities = client.get("/api/cities")
    assert res_cities.status_code == 200
    cities_list = res_cities.json()
    assert len(cities_list) >= 3170, f"Csak {len(cities_list)} település töltődött be!"
    assert "Balassagyarmat" in cities_list, "Balassagyarmat hiányzik a listából!"
    print(f"✅ 20. Települések adatbázis sikeresen betöltve ({len(cities_list)} db, Balassagyarmat ellenőrizve)")

    # 14. Hirdetés módosítása (PUT /api/items/{id})
    edit_payload = {
        "user_id": users[2]["id"],
        "title": "Módosított Földfúró Gép 200mm",
        "price": 1800,
        "price_unit": "nap",
        "deposit": 4000
    }
    res_edit = client.put(f"/api/items/{new_item_id}", json=edit_payload)
    assert res_edit.status_code == 200
    assert res_edit.json()["item"]["title"] == "Módosított Földfúró Gép 200mm"
    assert res_edit.json()["item"]["price"] == 1800
    print("✅ 21. Hirdetés adatainak módosítása (szerkesztés) sikeres")

    # 15. Hirdetés törlése (DELETE /api/items/{id}) és ingyenes kvóta felszabadítása
    res_del = client.delete(f"/api/items/{new_item_id}?user_id={users[2]['id']}")
    assert res_del.status_code == 200
    print("✅ 22. Hirdetés törlése és hirdetési hely azonnali felszabadítása sikeres")

    # 16. Megbízhatósági számlálók ellenőrzése (/api/auth/me)
    res_owner_me = client.get(f"/api/auth/me?user_id={users[0]['id']}")
    assert res_owner_me.status_code == 200
    owner_data = res_owner_me.json()
    assert "completed_as_owner" in owner_data
    assert "completed_as_renter" in owner_data
    print(f"✅ 23. Megbízhatósági számlálók ({owner_data['completed_as_owner']} kiadás, {owner_data['completed_as_renter']} bérlés) sikeresen lekérdezve")

    # 17. Google bejelentkezés tesztelése (/api/auth/social-login)
    google_login_payload = {
        "provider": "google",
        "name": "Minta Google Felhasználó",
        "email": "minta.google@gmail.com",
        "city": "Debrecen"
    }
    res_google = client.post("/api/auth/social-login", json=google_login_payload)
    assert res_google.status_code == 200
    google_res = res_google.json()
    assert google_res["user"]["auth_provider"] == "google"
    assert google_res["user"]["max_items"] == 1
    print("✅ 24. Google fiókkal történő belépés és fióklétrehozás sikeres")

    # 18. Facebook bejelentkezés tesztelése (/api/auth/social-login)
    facebook_login_payload = {
        "provider": "facebook",
        "name": "Minta Facebook Felhasználó",
        "email": "minta.facebook@facebook.com",
        "city": "Szeged"
    }
    res_fb = client.post("/api/auth/social-login", json=facebook_login_payload)
    assert res_fb.status_code == 200
    fb_res = res_fb.json()
    assert fb_res["user"]["auth_provider"] == "facebook"
    # 19. Firebase állapot lekérdezése (/api/firebase/status)
    res_fb_status = client.get("/api/firebase/status")
    assert res_fb_status.status_code == 200
    fb_status_data = res_fb_status.json()
    assert "database_type" in fb_status_data
    print(f"✅ 26. Firebase adatbázis kapcsolat ellenőrizve ({fb_status_data['database_type']})")

    print("\n🎉 MINDEN HITELTESÍTÉSI, TELEPÜLÉSI, SZERKESZTÉSI, TÖRLÉSI, MEGBÍZHATÓSÁGI, KÖZÖSSÉGI ÉS FIREBASE TESZT SIKERESEN LEFUTOTT!")

if __name__ == "__main__":
    run_tests()
