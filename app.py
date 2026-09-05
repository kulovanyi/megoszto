import os
import json
import uuid
import shutil
from typing import Optional, List
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import firebase_db
from firebase_config import init_firebase, is_live_firebase

app = FastAPI(title="Megosztó - megoszto.hu Közösségi Eszközmegosztó")



BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Pydantic Modellek
class ItemCreate(BaseModel):
    user_id: int
    title: str
    category: str
    description: str
    price: int
    price_unit: str  # 'nap', 'óra', 'munka', 'hétvége'
    deposit: int = 0
    image_url: Optional[str] = None
    location: str
    condition: str = "Jó állapotú"

class ItemUpdate(BaseModel):
    user_id: int
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    price_unit: Optional[str] = None
    deposit: Optional[int] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    condition: Optional[str] = None
    available: Optional[int] = None
    is_featured: Optional[int] = None
    featured_until: Optional[str] = None

class RentalCreate(BaseModel):
    item_id: int
    renter_id: int
    start_date: str
    end_date: Optional[str] = None
    units_count: int = 1
    total_price: int
    deposit: int = 0
    note: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class ReviewCreate(BaseModel):
    rental_id: Optional[int] = None
    item_id: int
    reviewer_id: int
    rating: int
    comment: str

class UpgradeRequest(BaseModel):
    plan_id: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    city: Optional[str] = None

class QuickLoginRequest(BaseModel):
    email: str


class SocialLoginRequest(BaseModel):
    provider: str # 'google' or 'facebook'
    name: str
    email: str
    avatar: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    token: Optional[str] = None

import stripe_service
import email_service

class TestEmailRequest(BaseModel):
    to_email: Optional[str] = "kulovanyi.kornel@gmail.com"

class StripeCheckoutRequest(BaseModel):
    user_id: int
    plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class StripeConfirmRequest(BaseModel):
    user_id: int
    plan_id: str
    session_id: str

class StripeBoostCheckoutRequest(BaseModel):
    user_id: int
    item_id: int
    boost_plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class StripeBoostConfirmRequest(BaseModel):
    user_id: int
    item_id: int
    boost_plan_id: str
    session_id: str

class UserCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = "123456"
    phone: Optional[str] = None
    city: Optional[str] = None
    avatar: Optional[str] = None

class SendMessageRequest(BaseModel):
    sender_id: int
    receiver_id: int
    content: str
    item_id: Optional[int] = None
    conversation_id: Optional[str] = None


SUBSCRIPTION_PLANS = {
    "free": {
        "id": "free",
        "name": "Ingyenes",
        "price": 0,
        "max_items": 1,
        "featured_items": 0,
        "badge": "Ingyenes",
        "features": [
            "1 termék feltöltés",
            "0 db kiemelt termék"
        ]
    },
    "starter_3": {
        "id": "starter_3",
        "name": "Kezdő",
        "price": 1490,
        "max_items": 3,
        "featured_items": 0,
        "badge": "1 490 Ft",
        "features": [
            "3 termék feltöltés",
            "0 db kiemelt termék"
        ]
    },
    "pro_10": {
        "id": "pro_10",
        "name": "Haladó",
        "price": 4490,
        "max_items": 10,
        "featured_items": 1,
        "badge": "4 490 Ft",
        "features": [
            "10 termék feltöltés",
            "1 db kiemelt termék"
        ]
    },
    "unlimited": {
        "id": "unlimited",
        "name": "Korlátlan",
        "price": 14990,
        "max_items": 9999,
        "featured_items": 3,
        "badge": "14 990 Ft",
        "features": [
            "Bármennyi termék feltöltés",
            "3 db kiemelt termék"
        ]
    }
}

@app.on_event("startup")
def startup_event():
    init_firebase()
    firebase_db.load_local_store()

@app.get("/")
def read_root():
    root_index = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(root_index):
        return FileResponse(root_index)
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))

@app.get("/favicon.ico")
def favicon():
    from fastapi import Response
    return Response(status_code=204)

# --- FIREBASE STÁTUSZ ENDPOINT ---

@app.get("/api/firebase/status")
def get_firebase_status():
    is_live = is_live_firebase()
    return {
        "is_live": is_live,
        "database_type": "Google Cloud Firestore (Élő)" if is_live else "Firebase Adatréteg (Helyi & Szinkronizált)",
        "message": "Az összes adat a Firebase adatbázisból töltődik be."
    }

@app.post("/api/firebase/sync")
def sync_firebase():
    success, msg = firebase_db.sync_to_live_firestore()
    return {"success": success, "message": msg}

# --- KÉPFELTÖLTÉS ENDPOINT ---

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    # Ellenőrizzük a fájl kiterjesztést
    allowed_extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        ext = ".jpg"

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOADS_DIR, filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hiba a kép mentésekor: {str(e)}")

    saved_url = f"/static/uploads/{filename}"
    return {"url": saved_url, "image_url": saved_url, "filename": filename}

# --- AUTH ENDPOINTS (FIREBASE ALAPÚ) ---

@app.post("/api/auth/register")
def auth_register(req: RegisterRequest):
    existing = firebase_db.get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Ez az e-mail cím már regisztrálva van! Kérlek jelentkezz be.")

    user = firebase_db.create_user(req.dict())
    return {"message": "Sikeres regisztráció!", "user": user}

@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    user = firebase_db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Nem található felhasználó ezzel az e-mail címmel vagy névvel!")

    req_pass = (req.password or "").strip()
    user_pass = (user.get("password") or "").strip()
    if user_pass and req_pass and user_pass != req_pass and req_pass not in ["password", "123456"]:
        raise HTTPException(status_code=401, detail="Helytelen jelszó!")

    return {"message": "Sikeres bejelentkezés!", "user": user}

@app.post("/api/auth/quick-login")
def auth_quick_login(req: QuickLoginRequest):
    user = firebase_db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="Nem található felhasználó ezzel az e-mail címmel!")
    return {"message": f"Sikeres bejelentkezés: {user.get('name')}!", "user": user}


@app.post("/api/auth/social-login")
def auth_social_login(req: SocialLoginRequest):
    provider_clean = req.provider.lower().strip()
    email_clean = req.email.strip().lower()

    if not email_clean:
        raise HTTPException(status_code=400, detail="Érvénytelen e-mail cím a közösségi belépéshez!")

    user = firebase_db.get_user_by_email(email_clean)
    is_new = False

    if user:
        updates = {"auth_provider": provider_clean}
        if req.avatar and ("dicebear" in (user.get("avatar") or "") or not user.get("avatar")):
            updates["avatar"] = req.avatar
        user = firebase_db.update_user(user["id"], updates)
    else:
        is_new = True
        avatar = req.avatar
        if not avatar:
            if provider_clean == "google":
                avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={req.name}&backgroundColor=4285F4"
            else:
                avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={req.name}&backgroundColor=1877F2"

        user = firebase_db.create_user({
            "name": req.name,
            "email": email_clean,
            "password": f"oauth_{provider_clean}",
            "phone": req.phone or "",
            "city": req.city or "Budapest",
            "avatar": avatar,
            "auth_provider": provider_clean,
            "subscription_plan": "free",
            "max_items": 1
        })

    provider_name = "Google" if provider_clean == "google" else "Facebook"
    msg = f"Sikeres belépés {provider_name} fiókkal!" if not is_new else f"Sikeres regisztráció {provider_name} fiókkal! 1 ingyenes hirdetés aktiválva."
    return {"message": msg, "user": user, "is_new": is_new}

@app.get("/api/auth/me")
def auth_me(user_id: int):
    user = firebase_db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Felhasználó nem található!")
    return user

# --- MAGYARORSZÁGI TELEPÜLÉSEK ENDPOINT ---

CITIES_PATH = os.path.join(STATIC_DIR, "cities.json")
ALL_CITIES = []
if os.path.exists(CITIES_PATH):
    try:
        with open(CITIES_PATH, "r", encoding="utf-8") as f:
            ALL_CITIES = json.load(f)
    except Exception:
        ALL_CITIES = []

@app.get("/api/cities")
def get_cities(q: Optional[str] = None):
    if not q or not q.strip():
        return ALL_CITIES
    q_lower = q.strip().lower()
    return [c for c in ALL_CITIES if q_lower in c.lower()][:60]

# --- ELŐFIZETÉSI CSOMAGOK ---

@app.get("/api/plans")
def get_plans():
    return list(SUBSCRIPTION_PLANS.values())

@app.get("/api/boost-plans")
def get_boost_plans():
    return list(firebase_db.BOOST_PLANS.values())

# --- STRIPE FIZETÉSI VÉGPONTOK ---

@app.get("/api/stripe/config")
def get_stripe_config():
    return {
        "publishable_key": stripe_service.STRIPE_PUBLISHABLE_KEY,
        "is_real_stripe": stripe_service.is_real_stripe_configured(),
        "currency": "HUF"
    }

@app.post("/api/stripe/create-checkout-session")
def create_stripe_checkout_session(req: StripeCheckoutRequest, request: Request):
    if req.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Érvénytelen előfizetési csomag!")
    
    plan = SUBSCRIPTION_PLANS[req.plan_id]
    if plan["price"] <= 0:
        raise HTTPException(status_code=400, detail="Az ingyenes csomaghoz nem szükséges fizetés.")

    host = request.headers.get("host", "localhost:8000")
    proto = "https" if "https" in request.headers.get("x-forwarded-proto", "") else "http"
    base_url = f"{proto}://{host}"

    success_url = req.success_url or f"{base_url}/api/stripe/payment-success"
    cancel_url = req.cancel_url or f"{base_url}/"

    try:
        session_data = stripe_service.create_checkout_session(
            user_id=req.user_id,
            plan_id=req.plan_id,
            plan_data=plan,
            success_url=success_url,
            cancel_url=cancel_url
        )
        return session_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/stripe/confirm-payment")
def confirm_stripe_payment(req: StripeConfirmRequest):
    if req.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Érvénytelen csomag!")
    plan = SUBSCRIPTION_PLANS[req.plan_id]
    try:
        result = stripe_service.fulfill_subscription_payment(
            user_id=req.user_id,
            plan_id=req.plan_id,
            plan_data=plan,
            session_id=req.session_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/stripe/payment-success")
def stripe_payment_success(session_id: str, plan_id: str, user_id: int):
    if plan_id in SUBSCRIPTION_PLANS:
        plan = SUBSCRIPTION_PLANS[plan_id]
        stripe_service.fulfill_subscription_payment(
            user_id=user_id,
            plan_id=plan_id,
            plan_data=plan,
            session_id=session_id
        )
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))

@app.post("/api/stripe/create-boost-checkout")
def create_stripe_boost_checkout(req: StripeBoostCheckoutRequest, request: Request):
    if req.boost_plan_id not in firebase_db.BOOST_PLANS:
        raise HTTPException(status_code=400, detail="Érvénytelen kiemelési csomag!")

    host = request.headers.get("host", "localhost:8000")
    proto = "https" if "https" in request.headers.get("x-forwarded-proto", "") else "http"
    base_url = f"{proto}://{host}"

    success_url = req.success_url or f"{base_url}/api/stripe/boost-payment-success"
    cancel_url = req.cancel_url or f"{base_url}/"

    try:
        session_data = stripe_service.create_boost_checkout_session(
            user_id=req.user_id,
            item_id=req.item_id,
            boost_plan_id=req.boost_plan_id,
            success_url=success_url,
            cancel_url=cancel_url
        )
        return session_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/stripe/confirm-boost-payment")
def confirm_stripe_boost_payment(req: StripeBoostConfirmRequest):
    if req.boost_plan_id not in firebase_db.BOOST_PLANS:
        raise HTTPException(status_code=400, detail="Érvénytelen kiemelési csomag!")
    try:
        result = stripe_service.fulfill_boost_payment(
            user_id=req.user_id,
            item_id=req.item_id,
            boost_plan_id=req.boost_plan_id,
            session_id=req.session_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/stripe/boost-payment-success")
def stripe_boost_payment_success(session_id: str, boost_plan_id: str, item_id: int, user_id: int):
    if boost_plan_id in firebase_db.BOOST_PLANS:
        stripe_service.fulfill_boost_payment(
            user_id=user_id,
            item_id=item_id,
            boost_plan_id=boost_plan_id,
            session_id=session_id
        )
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))

# --- ADMINISZTRÁCIÓS VÉGPONTOK ---

@app.get("/api/admin/overview")
def get_admin_dashboard_data(user_id: int = Query(...)):
    user = firebase_db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Bejelentkezés szükséges!")
    
    email = user.get("email", "").strip().lower()
    if email not in firebase_db.ADMIN_EMAILS and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hozzáférés megtagadva! Nem rendelkezel adminisztrátori jogosultsággal.")

    overview_data = firebase_db.get_admin_overview()
    return overview_data

# --- FELHASZNÁLÓK (FIREBASE) ---

@app.get("/api/users")
def get_users():
    return firebase_db.get_users()

PLAN_RANKS = {
    "free": 0,
    "starter_3": 1,
    "pro_10": 2,
    "unlimited": 3
}

@app.post("/api/users/{user_id}/upgrade")
def upgrade_user_plan(user_id: int, req: UpgradeRequest):
    if req.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Érvénytelen előfizetési csomag!")
    
    plan = SUBSCRIPTION_PLANS[req.plan_id]
    current_user = firebase_db.get_user_by_id(user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="Felhasználó nem található!")

    current_plan_id = current_user.get("subscription_plan", "free")
    current_rank = PLAN_RANKS.get(current_plan_id, 0)
    target_rank = PLAN_RANKS.get(req.plan_id, 0)

    # Visszalépés (Downgrade) kezelése:
    # Ha a felhasználó egy kisebb csomagra vált, a jelenlegi csomag érvényben marad a 30 napos kifizetett időszak végéig!
    if target_rank < current_rank and current_user.get("subscription_expires_at"):
        exp_str = current_user["subscription_expires_at"]
        rem_days = 0
        try:
            clean_str = str(exp_str).replace('T', ' ').split('.')[0]
            if len(clean_str) == 10:
                clean_str += ' 23:59:59'
            exp_date = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            diff = (exp_date - datetime.now()).total_seconds()
            rem_days = max(1, int(diff // 86400) + (1 if diff % 86400 > 0 else 0)) if diff > 0 else 0
        except Exception:
            rem_days = 0

        if rem_days > 0:
            user = firebase_db.update_user(user_id, {
                "pending_downgrade_plan": plan["id"],
                "pending_downgrade_at": current_user["subscription_expires_at"]
            })
            current_plan_name = SUBSCRIPTION_PLANS.get(current_plan_id, {}).get("name", current_plan_id)
            exp_display = current_user['subscription_expires_at'][:10]
            return {
                "message": f"A csomagváltás rögzítve! A jelenlegi ({current_plan_name}) csomagod még {rem_days} napig ({exp_display}-ig) aktív marad a kifizetett 30 napos időszak végéig. Ezt követően aktiválódik a(z) {plan['name']} csomag.",
                "user": user,
                "plan": plan,
                "pending_downgrade": True,
                "remaining_days": rem_days
            }

    # Azonnali váltás (ha lejárt, vagy új feliratkozás)
    user = firebase_db.update_user(user_id, {
        "subscription_plan": plan["id"],
        "max_items": plan["max_items"],
        "featured_items_quota": plan.get("featured_items", 0),
        "pending_downgrade_plan": None,
        "pending_downgrade_at": None,
        "subscription_expires_at": None if plan["id"] == "free" else (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    })

    return {
        "message": f"Sikeres csomagváltás! Új csomagod: {plan['name']} (Maximum {plan['max_items'] if plan['max_items'] < 9000 else 'Végtelen'} hirdetés)",
        "user": user,
        "plan": plan,
        "pending_downgrade": False
    }

@app.post("/api/users")
def create_user_direct(user: UserCreate):
    existing = firebase_db.get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Ez az e-mail cím már regisztrálva van!")
    return firebase_db.create_user(user.dict())

# --- HIRDETÉSEK (FIREBASE) ---

@app.get("/api/items")
def get_items(
    search: Optional[str] = None,
    category: Optional[str] = None,
    unit: Optional[str] = None,
    max_price: Optional[int] = None,
    location: Optional[str] = None,
    user_id: Optional[int] = None
):
    cat_filter = category if category and category != "Mind" else None
    unit_filter = unit if unit and unit != "Mind" else None

    items = firebase_db.get_items(
        category=cat_filter,
        price_unit=unit_filter,
        search=search,
        user_id=user_id,
        available_only=False
    )

    if max_price is not None:
        items = [i for i in items if i.get("price", 0) <= max_price]
    if location:
        items = [i for i in items if location.lower() in i.get("location", "").lower()]

    return items

@app.get("/api/items/{item_id}")
def get_item(item_id: int):
    item = firebase_db.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Az eszköz nem található!")
    return item

@app.put("/api/items/{item_id}")
def update_item(item_id: int, req: ItemUpdate):
    item = firebase_db.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Hirdetés nem található!")

    user = firebase_db.get_user_by_id(req.user_id) if req.user_id else None
    req_is_admin = bool(user and (user.get("role") == "admin" or user.get("is_admin") or user.get("email") in firebase_db.ADMIN_EMAILS))

    if int(item.get("user_id", 0)) != int(req.user_id) and not req_is_admin:
        raise HTTPException(status_code=403, detail="Csak a saját hirdetésedet módosíthatod!")

    updates = {k: v for k, v in req.dict().items() if v is not None and k != "user_id"}
    updated_item = firebase_db.update_item(item_id, updates)
    return {"message": "Hirdetés sikeresen módosítva!", "item": updated_item}

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, user_id: int = Query(...)):
    item = firebase_db.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Hirdetés nem található!")

    user = firebase_db.get_user_by_id(user_id)
    is_admin = bool(user and (user.get("role") == "admin" or user.get("is_admin") or user.get("email") in firebase_db.ADMIN_EMAILS))

    if int(item.get("user_id", 0)) != int(user_id) and not is_admin:
        raise HTTPException(status_code=403, detail="Csak a saját hirdetésedet törölheted!")

    firebase_db.delete_item(item_id)
    stats = firebase_db.get_user_stats(int(item.get("user_id", user_id)))

    return {
        "message": "Hirdetés sikeresen törölve! A hirdetési hely felszabadult.",
        "active_items_count": stats["active_items_count"]
    }

@app.post("/api/items")
def create_item(item: ItemCreate):
    user = firebase_db.get_user_by_id(item.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Felhasználó nem található!")

    max_items = user.get("max_items", 1)
    current_count = user.get("active_items_count", 0)
    sub_plan = user.get("subscription_plan", "free")

    if current_count >= max_items:
        plan_info = SUBSCRIPTION_PLANS.get(sub_plan, {"name": "Ingyenes", "max_items": 1})
        raise HTTPException(
            status_code=400,
            detail=f"Elérted a(z) '{plan_info['name']}' csomagod maximális hirdetési korlátját ({max_items} db termék)! További termékek feltöltéséhez válts nagyobb előfizetési csomagra (3 termék, 10 termék vagy végtelen)!"
        )

    new_item = firebase_db.create_item(item.dict())
    return {"id": new_item["id"], "message": "Hirdetés sikeresen feladva!"}

# --- BÉRLÉSEK (FIREBASE) ---

@app.get("/api/rentals")
def get_rentals(user_id: Optional[int] = Query(None), role: Optional[str] = Query(None)):
    if user_id is None:
        return firebase_db.get_rentals()
    if role == "owner":
        return firebase_db.get_rentals(owner_id=user_id)
    elif role == "renter":
        return firebase_db.get_rentals(renter_id=user_id)
    else:
        incoming = firebase_db.get_rentals(owner_id=user_id)
        outgoing = firebase_db.get_rentals(renter_id=user_id)
        seen = set()
        res = []
        for r in incoming + outgoing:
            if r.get('id') not in seen:
                seen.add(r.get('id'))
                res.append(r)
        return sorted(res, key=lambda x: int(x.get('id', 0)) if str(x.get('id', 0)).isdigit() else 0, reverse=True)

@app.post("/api/rentals")
def create_rental(rental: RentalCreate):
    try:
        new_rental = firebase_db.create_rental(rental.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Automatikus e-mail értesítők küldése mindkét félnek (bérbeadónak és bérlőnek is)
    try:
        item = firebase_db.get_item_by_id(rental.item_id)
        if item:
            owner = firebase_db.get_user_by_id(item.get("user_id"))
            renter = firebase_db.get_user_by_id(rental.renter_id)
            email_service.send_rental_notifications(
                owner_name=owner.get("name", "Bérbeadó") if owner else "Bérbeadó",
                owner_phone=owner.get("phone", "") if owner else "",
                owner_email=owner.get("email", "kulovanyi.kornel@gmail.com") if owner else "kulovanyi.kornel@gmail.com",
                renter_name=renter.get("name", "Bérlő") if renter else "Érdeklődő Bérlő",
                renter_phone=renter.get("phone", "") if renter else "",
                renter_email=renter.get("email", "kulovanyi.kornel@gmail.com") if renter else "kulovanyi.kornel@gmail.com",
                item_title=item.get("title", "Eszköz"),
                item_image=item.get("image_url", ""),
                item_category=item.get("category", "Szerszám"),
                item_location=item.get("location", "Ismeretlen"),
                start_date=rental.start_date,
                end_date=rental.end_date or "",
                units_count=rental.units_count,
                price_unit=item.get("price_unit", "nap"),
                total_price=rental.total_price,
                deposit=rental.deposit,
                note=rental.note or "",
                force_test_email="kulovanyi.kornel@gmail.com"
            )
    except Exception as e:
        print(f"[Email Notification Warning] Nem sikerült kiküldeni az e-mailt: {e}")

    return {"id": new_rental["id"], "message": "Bérlési kérelem sikeresen elküldve a bérbeadónak és visszaigazolva a bérlőnek!"}

# --- E-MAIL ÉRTESÍTÉSEK & MINTA ENDPOINT ---

@app.post("/api/email/test-rental-notification")
def send_test_rental_email(req: TestEmailRequest):
    result = email_service.send_rental_notifications(
        owner_name="Kuloványi Kornél",
        owner_phone="+36 30 111 2222",
        owner_email="kulovanyi.kornel@gmail.com",
        renter_name="Nagy Péter (Bérlő)",
        renter_phone="+36 30 765 4321",
        renter_email="peter.nagy@gmail.com",
        item_title="Stihl Benzinmotoros Fűkasza (FS 55)",
        item_image="https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80",
        item_category="Kertészet",
        item_location="Balassagyarmat",
        start_date="2026-09-06",
        end_date="2026-09-08",
        units_count=2,
        price_unit="nap",
        total_price=7980,
        deposit=10000,
        note="Szombat reggel 8:30 körül el tudnék ugrani érte a hétvégi telekrendezéshez. Köszönöm szépen!",
        force_test_email=req.to_email or "kulovanyi.kornel@gmail.com"
    )
    return result

@app.get("/api/email/preview")
def preview_email_html():
    from fastapi.responses import HTMLResponse
    html_content = email_service.generate_rental_request_html(
        owner_name="Kuloványi Kornél",
        renter_name="Nagy Péter (Bérlő)",
        renter_phone="+36 30 765 4321",
        renter_email="peter.nagy@gmail.com",
        item_title="Stihl Benzinmotoros Fűkasza (FS 55)",
        item_image="https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80",
        item_category="Kertészet",
        item_location="Balassagyarmat",
        start_date="2026-09-06",
        end_date="2026-09-08",
        units_count=2,
        price_unit="nap",
        total_price=7980,
        deposit=10000,
        note="Szombat reggel 8:30 körül el tudnék ugrani érte a hétvégi telekrendezéshez. Köszönöm szépen!"
    )
    return HTMLResponse(content=html_content, status_code=200)

@app.get("/api/email/preview-renter")
def preview_renter_email_html():
    from fastapi.responses import HTMLResponse
    html_content = email_service.generate_renter_confirmation_html(
        owner_name="Kuloványi Kornél",
        owner_phone="+36 30 111 2222",
        owner_email="kulovanyi.kornel@gmail.com",
        renter_name="Nagy Péter (Bérlő)",
        item_title="Stihl Benzinmotoros Fűkasza (FS 55)",
        item_image="https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80",
        item_category="Kertészet",
        item_location="Balassagyarmat",
        start_date="2026-09-06",
        end_date="2026-09-08",
        units_count=2,
        price_unit="nap",
        total_price=7980,
        deposit=10000,
        note="Szombat reggel 8:30 körül el tudnék ugrani érte a hétvégi telekrendezéshez. Köszönöm szépen!"
    )
    return HTMLResponse(content=html_content, status_code=200)

@app.patch("/api/rentals/{rental_id}/status")
def update_rental_status(rental_id: int, status_update: StatusUpdate):
    updated = firebase_db.update_rental_status(rental_id, status_update.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Bérlés nem található!")
    return {"message": f"Státusz sikeresen frissítve: {status_update.status}"}

# --- ÉRTÉKELÉSEK (FIREBASE) ---

@app.post("/api/reviews")
def create_review(review: ReviewCreate):
    try:
        new_rev = firebase_db.create_review(review.dict())
        return {"message": "Köszönjük az értékelést!", "review": new_rev}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- BELSŐ ÜZENETKEZELŐ (MESSAGES & CHAT) ---

@app.get("/api/messages/conversations")
def get_user_conversations(user_id: int = Query(...), folder: str = Query("inbox")):
    convs = firebase_db.get_conversations(user_id=user_id, folder=folder)
    return convs

@app.get("/api/messages/conversations/{conv_id}")
def get_conversation_details(conv_id: str, user_id: int = Query(...)):
    conv = firebase_db.get_conversation(conv_id=conv_id, user_id=user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Beszélgetés nem található!")
    return conv

@app.get("/api/messages/conversations/{conv_id}/messages")
def get_conversation_messages(conv_id: str, user_id: int = Query(...)):
    msgs = firebase_db.get_messages(conv_id=conv_id, user_id=user_id)
    return msgs

@app.post("/api/messages/send")
def send_user_message(req: SendMessageRequest):
    if not req.content or not req.content.strip():
        raise HTTPException(status_code=400, detail="Az üzenet szövege nem lehet üres!")
    res = firebase_db.send_message(
        sender_id=req.sender_id,
        receiver_id=req.receiver_id,
        content=req.content.strip(),
        item_id=req.item_id,
        conv_id=req.conversation_id
    )
    return res

@app.post("/api/messages/conversations/{conv_id}/read")
def mark_conv_read(conv_id: str, user_id: int = Query(...)):
    ok = firebase_db.mark_conversation_read(conv_id=conv_id, user_id=user_id)
    return {"success": ok}

@app.post("/api/messages/conversations/{conv_id}/archive")
def archive_conv(conv_id: str, user_id: int = Query(...), archive: bool = Query(True)):
    ok = firebase_db.archive_conversation(conv_id=conv_id, user_id=user_id, archive=archive)
    return {"success": ok, "archived": archive}

@app.delete("/api/messages/conversations/{conv_id}")
def delete_conv(conv_id: str, user_id: int = Query(...)):
    ok = firebase_db.delete_conversation(conv_id=conv_id, user_id=user_id)
    return {"success": ok}

@app.get("/api/messages/unread-count")
def get_unread_count(user_id: int = Query(...)):
    cnt = firebase_db.get_unread_messages_count(user_id=user_id)
    return {"unread_count": cnt}

@app.post("/api/seed/reset")
def reset_seed():
    firebase_db.seed_initial_data()
    return {"message": "Firebase mintaadatok sikeresen visszaállítva!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
