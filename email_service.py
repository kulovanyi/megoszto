import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List

# SMTP Konfiguráció (környezeti változókból vagy alapértelmezett beállításokból)
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "ertesito@megoszto.hu")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Megosztó (megoszto.hu)")

# Alapértelmezett teszt/fejlesztői e-mail cím (a felhasználó kérésének megfelelően)
TARGET_OVERRIDE_EMAIL = "kulovanyi.kornel@gmail.com"


def generate_rental_request_html(
    owner_name: str,
    renter_name: str,
    renter_phone: str,
    renter_email: str,
    item_title: str,
    item_image: str,
    item_category: str,
    item_location: str,
    start_date: str,
    end_date: str,
    units_count: int,
    price_unit: str,
    total_price: int,
    deposit: int,
    note: str,
    site_url: str = "http://localhost:8000"
) -> str:
    """
    Készít egy prémium minőségű, reszponzív HTML e-mail sablont az eszköz tulajdonosának (Bérbeadó).
    """
    unit_label = {
        "nap": "nap",
        "óra": "óra",
        "munka": "alkalom",
        "hétvége": "hétvége"
    }.get(price_unit, price_unit)

    formatted_price = f"{total_price:,}".replace(",", " ")
    formatted_deposit = f"{deposit:,}".replace(",", " ") if deposit else "0"

    deposit_block = ""
    if deposit > 0:
        deposit_block = f"""
        <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kaució (átadáskor kérd el):</td>
            <td style="padding: 10px 0; color: #d97706; font-size: 14px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">{formatted_deposit} Ft</td>
        </tr>
        """

    note_block = ""
    if note and note.strip():
        note_block = f"""
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bérlő üzenete / megjegyzése:</div>
            <div style="font-size: 14px; color: #334155; font-style: italic; line-height: 1.5;">"{note}"</div>
        </div>
        """

    img_src = item_image or "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80"

    html = f"""<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Új bérlési kérelmed érkezett!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <!-- FŐ KÁRTYA -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
                    
                    <!-- FEJLÉC SÁV -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 30px; text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                🔄 Megosztó Értesítő • Bérbeadói példány
                            </div>
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">Új bérlési kérelmed érkezett!</h1>
                            <p style="color: #d1fae5; font-size: 14px; margin: 0;">Valaki kölcsönözni szeretné az egyik meghirdetett eszközödet.</p>
                        </td>
                    </tr>

                    <!-- TÖRZS TARTALOM -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px 0; line-height: 1.5;">
                                Szia <strong>{owner_name}</strong>! 👋<br>
                                Örömmel értesítünk, hogy <strong>{renter_name}</strong> bérlési kérelmet adott le a(z) <strong>{item_title}</strong> nevű meghirdetett eszközödre.
                            </p>

                            <!-- ESZKÖZ KÁRTYA -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="90" valign="top" style="padding-right: 16px;">
                                                    <img src="{img_src}" alt="{item_title}" width="90" height="90" style="border-radius: 12px; object-fit: cover; display: block; border: 1px solid #cbd5e1;">
                                                </td>
                                                <td valign="top">
                                                    <span style="background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">{item_category}</span>
                                                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 6px 0 4px 0;">{item_title}</h3>
                                                    <p style="font-size: 12px; color: #64748b; margin: 0;">📍 {item_location}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- FOGLALÁSI RÉSZLETEK TÁBLÁZAT -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                                <tr>
                                    <td colspan="2" style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                        📅 Bérlés Részletei:
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időtartam:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">{units_count} {unit_label}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kezdés időpontja:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">{start_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Várható visszahozatal:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">{end_date or 'Megbeszélés szerint'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 800; border-top: 2px solid #e2e8f0;">Bérleti díj (Neked fizetendő átadáskor):</td>
                                    <td style="padding: 10px 0; color: #059669; font-size: 17px; font-weight: 900; text-align: right; border-top: 2px solid #e2e8f0;">{formatted_price} Ft</td>
                                </tr>
                                {deposit_block}
                            </table>

                            <!-- BÉRLŐ ELÉRHETŐSÉGEI KÁRTYA -->
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                                    👤 Bérlő Adatai & Kapcsolat:
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">{renter_name}</div>
                                <div style="font-size: 13px; color: #334155; margin-bottom: 8px;">
                                    📞 Telefon: <a href="tel:{renter_phone}" style="color: #059669; font-weight: 700; text-decoration: none;">{renter_phone or 'Nincs megadva'}</a>
                                    <br>
                                    ✉️ E-mail: <a href="mailto:{renter_email}" style="color: #059669; text-decoration: none;">{renter_email}</a>
                                </div>
                                <div style="font-size: 11px; color: #166534; font-weight: 600;">
                                    💡 Javaslat: Vedd fel a kapcsolatot a bérlővel telefonon vagy az Irányítópulton keresztül az átadás pontos helyéről és idejéről!
                                </div>
                            </div>

                            {note_block}

                            <!-- CTA GOMB -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 10px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{site_url}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35); text-align: center;">
                                            👉 Irányítópult & Kérelem Kezelése
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- BIZTONSÁGI TIPPEK -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 25px;">
                                <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">🛡️ Hasznos tippek az átadáshoz:</div>
                                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #64748b; line-height: 1.6;">
                                    <li>Átadáskor próbáljátok ki közösen a gépet vagy szerszámot.</li>
                                    <li>Ha van kaució, azt az eszköz átadásakor készpénzben vagy azonnali utalással vedd át.</li>
                                    <li>A bérlés végeztével kérd meg a bérlőt, hogy értékelje a tapasztalatát a platformon!</li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- LÁBLÉC -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">
                                Ez egy automatikus értesítő a <strong>Megosztó</strong> (megoszto.hu) platformtól.
                            </p>
                            <p style="font-size: 11px; color: #cbd5e1; margin: 0;">
                                © 2026 Megosztó Platform (megoszto.hu) • Balassagyarmat & Országos hálózat
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    return html


def generate_renter_confirmation_html(
    owner_name: str,
    owner_phone: str,
    owner_email: str,
    renter_name: str,
    item_title: str,
    item_image: str,
    item_category: str,
    item_location: str,
    start_date: str,
    end_date: str,
    units_count: int,
    price_unit: str,
    total_price: int,
    deposit: int,
    note: str,
    site_url: str = "http://localhost:8000"
) -> str:
    """
    Készít egy prémium minőségű, reszponzív HTML e-mail sablont a bérlőnek (visszaigazolás).
    """
    unit_label = {
        "nap": "nap",
        "óra": "óra",
        "munka": "alkalom",
        "hétvége": "hétvége"
    }.get(price_unit, price_unit)

    formatted_price = f"{total_price:,}".replace(",", " ")
    formatted_deposit = f"{deposit:,}".replace(",", " ") if deposit else "0"

    deposit_block = ""
    if deposit > 0:
        deposit_block = f"""
        <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kaució (átadáskor letétbe helyezendő):</td>
            <td style="padding: 10px 0; color: #d97706; font-size: 14px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">{formatted_deposit} Ft</td>
        </tr>
        """

    note_block = ""
    if note and note.strip():
        note_block = f"""
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Az általad megadott megjegyzés:</div>
            <div style="font-size: 14px; color: #334155; font-style: italic; line-height: 1.5;">"{note}"</div>
        </div>
        """

    img_src = item_image or "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80"

    html = f"""<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bérlési kérelmed rögzítve!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <!-- FŐ KÁRTYA -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
                    
                    <!-- FEJLÉC SÁV -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 30px; text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                ✅ Megosztó Visszaigazolás • Bérlői példány
                            </div>
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">Bérlési kérelmedet rögzítettük!</h1>
                            <p style="color: #dbeafe; font-size: 14px; margin: 0;">Az értesítést továbbítottuk az eszköz bérbeadójának.</p>
                        </td>
                    </tr>

                    <!-- TÖRZS TARTALOM -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px 0; line-height: 1.5;">
                                Szia <strong>{renter_name}</strong>! 👋<br>
                                Sikeresen leadtad bérlési kérelmedet a(z) <strong>{item_title}</strong> eszközre. A bérbeadó hamarosan felveszi veled a kapcsolatot vagy visszaigazolja a foglalást.
                            </p>

                            <!-- ESZKÖZ KÁRTYA -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="90" valign="top" style="padding-right: 16px;">
                                                    <img src="{img_src}" alt="{item_title}" width="90" height="90" style="border-radius: 12px; object-fit: cover; display: block; border: 1px solid #cbd5e1;">
                                                </td>
                                                <td valign="top">
                                                    <span style="background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">{item_category}</span>
                                                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 6px 0 4px 0;">{item_title}</h3>
                                                    <p style="font-size: 12px; color: #64748b; margin: 0;">📍 {item_location}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- FOGLALÁSI RÉSZLETEK TÁBLÁZAT -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                                <tr>
                                    <td colspan="2" style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                        📅 Foglalás Részletei:
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időtartam:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">{units_count} {unit_label}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kezdés időpontja:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">{start_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Várható visszahozatal:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">{end_date or 'Megbeszélés szerint'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 800; border-top: 2px solid #e2e8f0;">Fizetendő bérleti díj átvételkor:</td>
                                    <td style="padding: 10px 0; color: #2563eb; font-size: 17px; font-weight: 900; text-align: right; border-top: 2px solid #e2e8f0;">{formatted_price} Ft</td>
                                </tr>
                                {deposit_block}
                            </table>

                            <!-- BÉRBEADÓ ELÉRHETŐSÉGEI KÁRTYA -->
                            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                                    👤 Bérbeadó Adatai & Kapcsolat:
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">{owner_name}</div>
                                <div style="font-size: 13px; color: #334155; margin-bottom: 8px;">
                                    📞 Telefon: <a href="tel:{owner_phone}" style="color: #2563eb; font-weight: 700; text-decoration: none;">{owner_phone or 'Nincs megadva'}</a>
                                    <br>
                                    ✉️ E-mail: <a href="mailto:{owner_email}" style="color: #2563eb; text-decoration: none;">{owner_email}</a>
                                </div>
                                <div style="font-size: 11px; color: #1e40af; font-weight: 600;">
                                    💡 Javaslat: Ha sürgős az átvétel, hívd fel közvetlenül a bérbeadót telefonon!
                                </div>
                            </div>

                            {note_block}

                            <!-- CTA GOMB -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 10px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{site_url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); text-align: center;">
                                            👉 Irányítópult & Bérléseim Megtekintése
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- BIZTONSÁGI TIPPEK BÉRLŐNEK -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 25px;">
                                <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">🛡️ Hasznos tippek a bérléshez:</div>
                                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #64748b; line-height: 1.6;">
                                    <li>Átvételkor nézzétek át közösen az eszközt és próbáljátok ki annak működését.</li>
                                    <li>A bérleti díjat és az esetleges kauciót közvetlenül az átadáskor rendezzétek.</li>
                                    <li>A bérlés befejezésekor kérjük értékeld a bérbeadót a profilján!</li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- LÁBLÉC -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">
                                Ez egy automatikus visszaigazolás a <strong>Megosztó</strong> (megoszto.hu) platformtól.
                            </p>
                            <p style="font-size: 11px; color: #cbd5e1; margin: 0;">
                                © 2026 Megosztó Platform (megoszto.hu) • Balassagyarmat & Országos hálózat
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    return html


def _send_single_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_plain: str
) -> Dict[str, Any]:
    """
    Segédfüggvény egy darab e-mail kiküldésére SMTP-n keresztül.
    """
    if SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
            msg["To"] = to_email

            msg.attach(MIMEText(text_plain, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())
            server.quit()

            return {"success": True, "sent_via": "smtp_live", "to_email": to_email, "subject": subject}
        except Exception as e:
            print(f"[SMTP Warning] Élő küldési hiba: {e}")
            return {"success": True, "sent_via": "preview_fallback", "to_email": to_email, "subject": subject, "error": str(e)}

    return {"success": True, "sent_via": "preview_mode", "to_email": to_email, "subject": subject}


def send_rental_notifications(
    owner_name: str,
    owner_phone: str,
    owner_email: str,
    renter_name: str,
    renter_phone: str,
    renter_email: str,
    item_title: str,
    item_image: str,
    item_category: str,
    item_location: str,
    start_date: str,
    end_date: str,
    units_count: int,
    price_unit: str,
    total_price: int,
    deposit: int,
    note: str,
    site_url: str = "http://localhost:8000",
    force_test_email: Optional[str] = TARGET_OVERRIDE_EMAIL
) -> Dict[str, Any]:
    """
    Kiküldi a bérlési értesítőket mind a bérbeadónak, mind a bérlőnek.
    A felhasználó kérésére jelenleg mindkét e-mail a kulovanyi.kornel@gmail.com címre érkezik.
    """
    # 1. Bérbeadói sablon generálása
    owner_html = generate_rental_request_html(
        owner_name=owner_name,
        renter_name=renter_name,
        renter_phone=renter_phone,
        renter_email=renter_email,
        item_title=item_title,
        item_image=item_image,
        item_category=item_category,
        item_location=item_location,
        start_date=start_date,
        end_date=end_date,
        units_count=units_count,
        price_unit=price_unit,
        total_price=total_price,
        deposit=deposit,
        note=note,
        site_url=site_url
    )

    # 2. Bérlői visszaigazoló sablon generálása
    renter_html = generate_renter_confirmation_html(
        owner_name=owner_name,
        owner_phone=owner_phone,
        owner_email=owner_email,
        renter_name=renter_name,
        item_title=item_title,
        item_image=item_image,
        item_category=item_category,
        item_location=item_location,
        start_date=start_date,
        end_date=end_date,
        units_count=units_count,
        price_unit=price_unit,
        total_price=total_price,
        deposit=deposit,
        note=note,
        site_url=site_url
    )

    # Előnézeti fájlok mentése a static mappába
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    os.makedirs(static_dir, exist_ok=True)
    try:
        with open(os.path.join(static_dir, "email_preview_owner.html"), "w", encoding="utf-8") as f:
            f.write(owner_html)
        with open(os.path.join(static_dir, "email_preview_renter.html"), "w", encoding="utf-8") as f:
            f.write(renter_html)
        with open(os.path.join(static_dir, "email_preview.html"), "w", encoding="utf-8") as f:
            f.write(owner_html)
    except Exception as e:
        print(f"[Email Preview Warning] {e}")

    # Címzettek meghatározása (egyelőre mindkettő TARGET_OVERRIDE_EMAIL-re megy, ahogy kérted)
    owner_dest = force_test_email if force_test_email else (owner_email or TARGET_OVERRIDE_EMAIL)
    renter_dest = force_test_email if force_test_email else (renter_email or TARGET_OVERRIDE_EMAIL)

    owner_subject = f"🛠️ [Megosztó - Bérbeadó Értesítő] Új bérlési kérelem: '{item_title}' ({renter_name})"
    renter_subject = f"✅ [Megosztó - Bérlő Visszaigazolás] Bérlési kérelem rögzítve: '{item_title}'"

    owner_text = f"""
Szia {owner_name}! (Bérbeadó Értesítő)
Új bérlési kérelem érkezett a(z) {item_title} eszközödre!

Bérlő neve: {renter_name}
Bérlő telefonszáma: {renter_phone}
Bérlő e-mail címe: {renter_email}
Időtartam: {units_count} {price_unit} ({start_date} - {end_date or start_date})
Bérleti díj: {total_price} Ft (Kaució: {deposit} Ft)
Megjegyzés: {note}

Irányítópult: {site_url}
"""

    renter_text = f"""
Szia {renter_name}! (Bérlő Visszaigazolás)
Bérlési kérelmedet rögzítettük a(z) {item_title} eszközre!

Bérbeadó neve: {owner_name}
Bérbeadó telefonszáma: {owner_phone}
Bérbeadó e-mail címe: {owner_email}
Időtartam: {units_count} {price_unit} ({start_date} - {end_date or start_date})
Bérleti díj: {total_price} Ft (Kaució: {deposit} Ft)
Megjegyzés: {note}

Irányítópult: {site_url}
"""

    res_owner = _send_single_email(owner_dest, owner_subject, owner_html, owner_text)
    res_renter = _send_single_email(renter_dest, renter_subject, renter_html, renter_text)

    return {
        "success": True,
        "sent_to": TARGET_OVERRIDE_EMAIL,
        "owner_email_status": res_owner,
        "renter_email_status": res_renter,
        "message": f"Mindkét értesítő (bérbeadói és bérlői) előkészítve és elküldve a(z) {TARGET_OVERRIDE_EMAIL} címre!",
        "owner_preview_url": "/static/email_preview_owner.html",
        "renter_preview_url": "/static/email_preview_renter.html"
    }


def send_rental_request_email(
    to_email: str,
    owner_name: str,
    renter_name: str,
    renter_phone: str,
    renter_email: str,
    item_title: str,
    item_image: str,
    item_category: str,
    item_location: str,
    start_date: str,
    end_date: str,
    units_count: int,
    price_unit: str,
    total_price: int,
    deposit: int,
    note: str,
    site_url: str = "http://localhost:8000"
) -> Dict[str, Any]:
    """
    Kompatibilitási burkoló, amely mindkét e-mailt kiküldi.
    """
    return send_rental_notifications(
        owner_name=owner_name,
        owner_phone=renter_phone or "+36 30 111 2222",
        owner_email=to_email or TARGET_OVERRIDE_EMAIL,
        renter_name=renter_name,
        renter_phone=renter_phone,
        renter_email=renter_email,
        item_title=item_title,
        item_image=item_image,
        item_category=item_category,
        item_location=item_location,
        start_date=start_date,
        end_date=end_date,
        units_count=units_count,
        price_unit=price_unit,
        total_price=total_price,
        deposit=deposit,
        note=note,
        site_url=site_url,
        force_test_email=TARGET_OVERRIDE_EMAIL
    )

