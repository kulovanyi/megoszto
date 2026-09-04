import os
import json
import uuid
import stripe
from typing import Optional, Dict, Any, Tuple
import firebase_db
from firebase_config import get_firestore_client, is_live_firebase

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Stripe API Kulcsok (Alapértelmezetten beállíthatók környezeti változóból vagy config fájlból)
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "sk_test_mock_kolcsonado_key")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_mock_kolcsonado_key")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

stripe.api_key = STRIPE_SECRET_KEY

def is_real_stripe_configured() -> bool:
    """Ellenőrzi, hogy valós Stripe API kulcs van-e megadva (sk_test_ vagy sk_live_ valódi tokennel)."""
    return bool(STRIPE_SECRET_KEY and not STRIPE_SECRET_KEY.startswith("sk_test_mock"))

def create_checkout_session(
    user_id: int,
    plan_id: str,
    plan_data: Dict[str, Any],
    success_url: str,
    cancel_url: str
) -> Dict[str, Any]:
    """
    Létrehoz egy Stripe Checkout munkamenetet havi ismétlődő előfizetéshez.
    Ha van éles/valós tesztkulcs, a Stripe hivatalos szerverén hozza létre.
    Ha helyi mock mód van, egy beépített szimulált Stripe Checkout munkamenetet készít.
    """
    user = firebase_db.get_user_by_id(user_id)
    if not user:
        raise ValueError("Felhasználó nem található!")

    price_huf = int(plan_data.get("price", 0))
    if price_huf <= 0:
        raise ValueError("Az ingyenes csomaghoz nem szükséges bankkártyás fizetés.")

    session_id = f"cs_sub_{uuid.uuid4().hex}"

    if is_real_stripe_configured():
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                customer_email=user.get("email"),
                client_reference_id=str(user_id),
                line_items=[{
                    "price_data": {
                        "currency": "huf",
                        "recurring": {"interval": "month"},
                        "product_data": {
                            "name": f"KölcsönAdó Havi Előfizetés - {plan_data['name']}",
                            "description": f"Maximum {plan_data['max_items']} db eszköz meghirdetése (Havonta automatikusan megújuló)",
                            "images": ["https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=400&q=80"]
                        },
                        "unit_amount": price_huf * 100,  # Fillérben
                    },
                    "quantity": 1,
                }],
                mode="subscription",
                metadata={
                    "user_id": str(user_id),
                    "plan_id": plan_id,
                    "plan_name": plan_data["name"],
                    "payment_type": "recurring_monthly",
                    "max_items": str(plan_data["max_items"])
                },
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}&plan_id={plan_id}&user_id={user_id}",
                cancel_url=cancel_url
            )
            return {
                "checkout_url": session.url,
                "session_id": session.id,
                "is_sandbox_simulation": False
            }
        except Exception as e:
            print(f"[Stripe Warning] Hiba az éles Stripe Checkout Session létrehozásakor: {e}")
            # Fallback a sandbox checkoutra ha a kulcs nem érvényes
    
    # Sandbox / Helyi Interaktív Stripe Checkout
    return {
        "checkout_url": f"/#stripe-checkout?session_id={session_id}&plan_id={plan_id}&user_id={user_id}&amount={price_huf}&plan_name={plan_data['name']}&payment_type=recurring_monthly",
        "session_id": session_id,
        "is_sandbox_simulation": True,
        "amount": price_huf,
        "plan_name": plan_data["name"],
        "plan_id": plan_id,
        "payment_type": "recurring_monthly",
        "user_email": user.get("email", ""),
        "user_name": user.get("name", "")
    }

def create_boost_checkout_session(
    user_id: int,
    item_id: int,
    boost_plan_id: str,
    success_url: str,
    cancel_url: str
) -> Dict[str, Any]:
    """
    Létrehoz egy Stripe Checkout munkamenetet hirdetés egyszeri kiemeléséhez (1 nap vagy 1 hét).
    Egyszeri fizetés: mode="payment".
    """
    user = firebase_db.get_user_by_id(user_id)
    if not user:
        raise ValueError("Felhasználó nem található!")

    item = firebase_db.get_item_by_id(item_id)
    if not item:
        raise ValueError("A kiemelendő hirdetés nem található!")

    if boost_plan_id not in firebase_db.BOOST_PLANS:
        raise ValueError("Érvénytelen kiemelési csomag!")

    boost_plan = firebase_db.BOOST_PLANS[boost_plan_id]
    price_huf = int(boost_plan.get("price", 0))
    session_id = f"cs_boost_{uuid.uuid4().hex}"

    if is_real_stripe_configured():
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                customer_email=user.get("email"),
                client_reference_id=str(user_id),
                line_items=[{
                    "price_data": {
                        "currency": "huf",
                        "product_data": {
                            "name": f"KölcsönAdó Kiemelés: {item.get('title')}",
                            "description": f"{boost_plan['name']} ({boost_plan['badge']}) - Egyszeri fizetés, nem újul meg automatikusan",
                            "images": [item.get("image_url") or "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=400&q=80"]
                        },
                        "unit_amount": price_huf * 100,  # Fillérben
                    },
                    "quantity": 1,
                }],
                mode="payment",
                metadata={
                    "user_id": str(user_id),
                    "item_id": str(item_id),
                    "boost_plan_id": boost_plan_id,
                    "payment_type": "one_time",
                    "plan_name": boost_plan["name"]
                },
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}&boost_plan_id={boost_plan_id}&item_id={item_id}&user_id={user_id}",
                cancel_url=cancel_url
            )
            return {
                "checkout_url": session.url,
                "session_id": session.id,
                "is_sandbox_simulation": False
            }
        except Exception as e:
            print(f"[Stripe Warning] Hiba a kiemelés Stripe Checkout Session létrehozásakor: {e}")

    # Sandbox / Helyi Interaktív Stripe Checkout
    return {
        "checkout_url": f"/#stripe-checkout?session_id={session_id}&boost_plan_id={boost_plan_id}&item_id={item_id}&user_id={user_id}&amount={price_huf}&plan_name={boost_plan['name']}&item_title={item.get('title')}&payment_type=one_time",
        "session_id": session_id,
        "is_sandbox_simulation": True,
        "amount": price_huf,
        "plan_name": boost_plan["name"],
        "plan_id": boost_plan_id,
        "item_id": item_id,
        "item_title": item.get("title"),
        "payment_type": "one_time",
        "user_email": user.get("email", ""),
        "user_name": user.get("name", "")
    }

def fulfill_subscription_payment(user_id: int, plan_id: str, plan_data: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    """
    Aktiválja a havi előfizetést, növeli a felhasználó hirdetési limitjét és elmenti a tranzakciót.
    """
    user = firebase_db.update_user(user_id, {
        "subscription_plan": plan_id,
        "max_items": plan_data["max_items"]
    })

    if not user:
        raise ValueError("Felhasználó nem található a frissítéshez!")

    # Tranzakció mentése a Firestore-ba és a helyi store-ba
    tx_data = {
        "id": session_id,
        "type": "subscription",
        "payment_type": "recurring_monthly",
        "user_id": user_id,
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "plan_id": plan_id,
        "plan_name": plan_data["name"],
        "amount_huf": plan_data["price"],
        "currency": "HUF",
        "session_id": session_id,
        "status": "paid",
        "provider": "stripe",
        "created_at": firebase_db.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    store = firebase_db.load_local_store()
    if "transactions" not in store:
        store["transactions"] = {}
    store["transactions"][session_id] = tx_data
    firebase_db.save_local_store(store)

    fs = get_firestore_client()
    if fs and is_live_firebase():
        try:
            fs.collection("transactions").document(session_id).set(tx_data)
        except Exception as e:
            print(f"[Firebase Warning] Tranzakció mentési hiba a Firestore-ban: {e}")

    return {
        "success": True,
        "user": user,
        "plan": plan_data,
        "transaction": tx_data,
        "message": f"🎉 Sikeres havi előfizetés! Új csomagod: {plan_data['name']} (Maximum {plan_data['max_items']} db termék). A csomag díja havonta automatikusan megújul."
    }

def fulfill_boost_payment(user_id: int, item_id: int, boost_plan_id: str, session_id: str) -> Dict[str, Any]:
    """
    Aktiválja a termék kiemelést és rögzíti az egyszeri tranzakciót.
    """
    result = firebase_db.boost_item(
        item_id=item_id,
        boost_plan_id=boost_plan_id,
        session_id=session_id,
        user_id=user_id
    )
    return result
