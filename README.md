# 🌱 KölcsönAdó — Közösségi Eszköz- és Szerszámbérlő Platform

A **KölcsönAdó** egy modern, reszponzív közösségi P2P webalkalmazás, ahol magánszemélyek és kisvállalkozók meghirdethetik kerti szerszámaikat (pl. egyszerű kerti ásót, fűkaszát, láncfűrészt), háztartási és barkácsgépeiket, a szomszédok pedig rugalmas konstrukcióban (**Ft/nap**, **Ft/óra**, **Ft/munka** vagy **Ft/hétvége**) kibérelhetik azokat.

---

## 🚀 Főbb Funkciók

1. **Rugalmas Elszámolási Konstrukciók**:
   - 📅 **/nap** (pl. *Fiskars ergonómikus ásó 800 Ft/nap*)
   - 🛠️ **/munka (alkalom)** (pl. *Kärcher kárpittisztító gép 6.000 Ft/munka*)
   - ⚡ **/óra** (pl. *Ipari bontókalapács 1.500 Ft/óra*)
   - 🏖️ **/hétvége**
   - 💰 **Kaució / Letét** kezelése (amely a szerszám épségben történő visszahozatalakor visszajár).

2. **Interaktív Bérleti Kalkulátor & Foglalás**:
   - Időtartam és egységszám választó (+ / - gombokkal és naptárral).
   - Valós idejű összegszámítás (bérleti díj + kaució = fizetendő végösszeg).
   - Egykattintásos bérlési kérelem küldése a bérbeadónak megjegyzéssel.

3. **Új Eszköz Meghirdetése**:
   - Kategória (Kertészet, Barkácsolás, Takarítás, Építkezés, Autó & Garázs, Rendezvény), állapot, leírás és átvételi helyszín megadása.
   - Egyéni bérleti díj és elszámolási mértékegység beállítása.

4. **Irányítópult (Dashboard) & Életciklus-kezelés**:
   - **Kiadott eszközeim**: Beérkező kérelmek jóváhagyása / elutasítása, átadás rögzítése, visszavétel és kaució elszámolása.
   - **Kölcsönzéseim bérlőként**: Saját foglalások állapota, bérbeadó elérhetőségei.
   - **Értékelési rendszer**: Visszahozatal után 1-5 csillagos értékelés és vélemény írása.

5. **Gyors Profilváltó (Demó Mód)**:
   - A fejlécből azonnal válthatsz különböző bérbeadói és bérlői profilok között (pl. *Kovács Béla bérbeadó*, *Szabó Anna*, *Tóth Gábor bérlő*), így azonnal kipróbálható a teljes bérlési és jóváhagyási folyamat mindkét fél szemszögéből!

---

## 💻 Indítás és Használat

### Egyszerű indítás:
Kattints duplán a `start.bat` fájlra, vagy futtasd parancssorból:

```bash
python run.py
```

A weboldal automatikusan megnyílik a böngésződben a **http://127.0.0.1:8000** címen.

---

## 🛠️ Technikai Architektúra

- **Backend**: Python (FastAPI + Uvicorn)
- **Adatbázis**: SQLite (`kolcsonado.db`)
- **Frontend**: HTML5, Tailwind CSS, Vanilla JS, FontAwesome ikonok
- **Tesztelés**: Integrált automatizált tesztcsomag (`python test_app.py`)
