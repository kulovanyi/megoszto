const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

admin.initializeApp();

const SMTP_USER = "kulovanyi.kornel@gmail.com";
const SMTP_PASS = "qtlnhswigvveakvd";
const FROM_HEADER = `"Kölcsönadlak.hu" <${SMTP_USER}>`;
const ADMIN_EMAIL = "kulovanyi.kornel+admin@gmail.com";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

function prepareItemImage(item_image, site_url = "https://kolcsonadlak-7212a.web.app") {
    const fallbackImage = "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80";
    let imgSrc = fallbackImage;
    const attachments = [];

    if (item_image && typeof item_image === "string" && item_image.trim()) {
        const trimmed = item_image.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("cid:")) {
            imgSrc = trimmed;
        } else if (trimmed.startsWith("data:image/")) {
            const match = trimmed.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (match) {
                const subType = match[1].toLowerCase();
                const ext = subType === "jpeg" ? "jpg" : (subType === "svg+xml" ? "svg" : subType);
                const base64Data = match[2];
                const cid = "item_image_" + Date.now() + "@kolcsonadlak";
                attachments.push({
                    filename: `eszkoz.${ext}`,
                    content: Buffer.from(base64Data, "base64"),
                    cid: cid
                });
                imgSrc = `cid:${cid}`;
            } else {
                imgSrc = trimmed;
            }
        } else if (trimmed.startsWith("static/") || trimmed.startsWith("/static/")) {
            const clean = trimmed.replace(/^\/+/, "");
            imgSrc = `${site_url}/${clean}`;
        }
    }

    return { imgSrc, attachments };
}

function getRentalRequestHtml(data) {
    const {
        owner_name = "Bérbeadó",
        renter_name = "Bérlő",
        renter_phone = "Nincs megadva",
        renter_email = "kulovanyi.kornel@gmail.com",
        item_title = "Eszköz",
        item_image = "",
        item_image_src = "",
        item_category = "Szerszám",
        item_location = "Magyarország",
        start_date = "",
        end_date = "",
        units_count = 1,
        price_unit = "nap",
        total_price = 0,
        deposit = 0,
        note = "",
        site_url = "https://kolcsonadlak-7212a.web.app"
    } = data;

    const formattedPrice = Number(total_price).toLocaleString("hu-HU");
    const formattedDeposit = Number(deposit).toLocaleString("hu-HU");
    const depositBlock = deposit > 0 ? `
        <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kaució (átadáskor kérd el):</td>
            <td style="padding: 10px 0; color: #d97706; font-size: 14px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">${formattedDeposit} Ft</td>
        </tr>
    ` : "";

    const noteBlock = (note && note.trim()) ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bérlő megjegyzése:</div>
            <div style="font-size: 14px; color: #334155; font-style: italic; line-height: 1.5;">"${note}"</div>
        </div>
    ` : "";

    const img = item_image_src || (item_image && (String(item_image).startsWith("http") || String(item_image).startsWith("cid:")) ? item_image : "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80");

    return `<!DOCTYPE html>
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
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 30px; text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                🔄 Kölcsönadlak Értesítő • Bérbeadói példány
                            </div>
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">Új bérlési kérelmed érkezett!</h1>
                            <p style="color: #d1fae5; font-size: 14px; margin: 0;">Valaki kölcsönözni szeretné az egyik meghirdetett eszközödet.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px 0; line-height: 1.5;">
                                Szia <strong>${owner_name}</strong>! 👋<br>
                                Örömmel értesítünk, hogy <strong>${renter_name}</strong> bérlési kérelmet adott le a(z) <strong>${item_title}</strong> nevű eszközödre.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="90" valign="top" style="padding-right: 16px;">
                                                    <img src="${item_image}" alt="${item_title}" width="90" height="90" style="border-radius: 12px; object-fit: cover; display: block; border: 1px solid #cbd5e1;">
                                                </td>
                                                <td valign="top">
                                                    <span style="background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">${item_category}</span>
                                                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 6px 0 4px 0;">${item_title}</h3>
                                                    <p style="font-size: 12px; color: #64748b; margin: 0;">📍 ${item_location}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                                <tr>
                                    <td colspan="2" style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                        📅 Bérlés Részletei:
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időtartam:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">${units_count} ${price_unit}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időszak:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">${start_date} – ${end_date || start_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 800; border-top: 2px solid #e2e8f0;">Bérleti díj (Neked fizetendő átadáskor):</td>
                                    <td style="padding: 10px 0; color: #059669; font-size: 17px; font-weight: 900; text-align: right; border-top: 2px solid #e2e8f0;">${formattedPrice} Ft</td>
                                </tr>
                                ${depositBlock}
                            </table>
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                                    👤 Bérlő Adatai & Kapcsolat:
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${renter_name}</div>
                                <div style="font-size: 13px; color: #334155; margin-bottom: 8px;">
                                    📞 Telefon: <a href="tel:${renter_phone}" style="color: #059669; font-weight: 700; text-decoration: none;">${renter_phone}</a>
                                    <br>
                                    ✉️ E-mail: <a href="mailto:${renter_email}" style="color: #059669; text-decoration: none;">${renter_email}</a>
                                </div>
                            </div>
                            ${noteBlock}
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 10px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${site_url}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35); text-align: center;">
                                            👉 Irányítópult & Kérelem Elfogadása
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0;">© 2026 Kölcsönadlak.hu — Minden jog fenntartva.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function getRentalApprovalHtml(data) {
    const {
        owner_name = "Bérbeadó",
        owner_phone = "Nincs megadva",
        owner_email = "kulovanyi.kornel@gmail.com",
        renter_name = "Bérlő",
        item_title = "Eszköz",
        item_image = "",
        item_image_src = "",
        item_category = "Szerszám",
        item_location = "Magyarország",
        start_date = "",
        end_date = "",
        units_count = 1,
        price_unit = "nap",
        total_price = 0,
        deposit = 0,
        site_url = "https://kolcsonadlak-7212a.web.app"
    } = data;

    const formattedPrice = Number(total_price).toLocaleString("hu-HU");
    const formattedDeposit = Number(deposit).toLocaleString("hu-HU");
    const depositBlock = deposit > 0 ? `
        <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Kaució (átadáskor letétbe helyezendő):</td>
            <td style="padding: 10px 0; color: #d97706; font-size: 14px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">${formattedDeposit} Ft</td>
        </tr>
    ` : "";

    const img = item_image_src || (item_image && (String(item_image).startsWith("http") || String(item_image).startsWith("cid:")) ? item_image : "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80");

    return `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>A bérbeadó elfogadta a kérelmedet! 🎉</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 30px; text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                🎊 Kölcsönadlak • Bérlői Visszaigazolás
                            </div>
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 6px 0;">A bérbeadó elfogadta a foglalásodat!</h1>
                            <p style="color: #e0f2fe; font-size: 14px; margin: 0;">Minden készen áll a személyes átvételhez és használathoz.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px 0; line-height: 1.5;">
                                Szia <strong>${renter_name}</strong>! 👋<br>
                                Nagyszerű hírünk van: <strong>${owner_name}</strong> elfogadta a(z) <strong>${item_title}</strong> eszközre leadott bérlési kérelmedet!
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="90" valign="top" style="padding-right: 16px;">
                                                    <img src="${img}" alt="${item_title}" width="90" height="90" style="border-radius: 12px; object-fit: cover; display: block; border: 1px solid #cbd5e1;">
                                                </td>
                                                <td valign="top">
                                                    <span style="background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">${item_category}</span>
                                                    <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 6px 0 4px 0;">${item_title}</h3>
                                                    <p style="font-size: 12px; color: #64748b; margin: 0;">📍 ${item_location}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                                <tr>
                                    <td colspan="2" style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;">
                                        📅 Bérlés Adatai:
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időtartam:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">${units_count} ${price_unit}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Időszak:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">${start_date} – ${end_date || start_date}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #0f172a; font-size: 14px; font-weight: 800; border-top: 2px solid #e2e8f0;">Fizetendő díj átadáskor:</td>
                                    <td style="padding: 10px 0; color: #0284c7; font-size: 17px; font-weight: 900; text-align: right; border-top: 2px solid #e2e8f0;">${formattedPrice} Ft</td>
                                </tr>
                                ${depositBlock}
                            </table>
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                                    👤 Bérbeadó Elérhetőségei:
                                </div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${owner_name}</div>
                                <div style="font-size: 13px; color: #334155; margin-bottom: 8px;">
                                    📞 Telefon: <a href="tel:${owner_phone}" style="color: #059669; font-weight: 700; text-decoration: none;">${owner_phone}</a>
                                    <br>
                                    ✉️ E-mail: <a href="mailto:${owner_email}" style="color: #059669; text-decoration: none;">${owner_email}</a>
                                </div>
                                <div style="font-size: 11px; color: #166534; font-weight: 600;">
                                    💡 Kérlek vedd fel a kapcsolatot a bérbeadóval az átadás pontos helyéről és idejéről!
                                </div>
                            </div>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0 10px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${site_url}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); text-align: center;">
                                            👉 Irányítópult Megnyitása
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0;">© 2026 Kölcsönadlak.hu — Minden jog fenntartva.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function getRegistrationVerifyHtml(data) {
    const {
        user_name = "Új Felhasználó",
        user_email = "felhasznalo@kolcsonadlak.hu",
        created_at = new Date().toISOString().split("T")[0],
        city = "Magyarország",
        plan_name = "Ingyenes csomag (1 termék feltöltése)",
        verify_url = "https://kolcsonadlak.hu",
        site_url = "https://kolcsonadlak.hu"
    } = data;

    return `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erősítsd meg a regisztrációdat! 🎉</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <!-- FŐ KÁRTYA -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
                    
                    <!-- FEJLÉC SÁV -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 34px 30px; text-align: center;">
                            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                🎉 Kölcsönadlak • Fiók Hitelesítés
                            </div>
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">Üdvözlünk a Kölcsönadlakon!</h1>
                            <p style="color: #d1fae5; font-size: 14px; margin: 0;">Már csak egyetlen kattintás választ el fiókod aktiválásától.</p>
                        </td>
                    </tr>

                    <!-- TÖRZS TARTALOM -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 20px 0; line-height: 1.5;">
                                Szia <strong>${user_name}</strong>! 👋<br>
                                Köszönjük, hogy csatlakoztál a <strong>Kölcsönadlak.hu</strong> közösségéhez! Kérjük, igazold vissza a regisztrációdat az alábbi gombra kattintva, hogy biztonságosan használhasd a fiókodat és azonnal kölcsönözhess vagy hirdethess.
                            </p>

                            <!-- FIÓK ADATOK KÁRTYA -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td colspan="2" style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 10px;">
                                                    📋 Regisztráció Adatai:
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Név:</td>
                                                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; border-top: 1px solid #f1f5f9;">${user_name}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">E-mail cím:</td>
                                                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">${user_email}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Regisztráció napja:</td>
                                                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">${created_at}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9;">Település:</td>
                                                <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; border-top: 1px solid #f1f5f9;">📍 ${city}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0; color: #0f172a; font-size: 13px; font-weight: 800; border-top: 2px solid #e2e8f0;">Aktivált kezdőcsomag:</td>
                                                <td style="padding: 10px 0; color: #059669; font-size: 13px; font-weight: 800; text-align: right; border-top: 2px solid #e2e8f0;">🎁 Ingyenes (1 hirdetés)</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA GOMB -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0 20px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${verify_url}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 14px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35); text-align: center;">
                                            👉 Regisztráció Megerősítése
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- MIÉRT JÓ DOBOZ -->
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                    ✨ Miért jó a Kölcsönadlak közösségéhez tartozni?
                                </div>
                                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #166534; line-height: 1.6;">
                                    <li><strong>Keress pénzt:</strong> Add bérbe otthon ritkán használt gépeidet, szerszámaidat másoknak.</li>
                                    <li><strong>Spórolj okosan:</strong> Kölcsönözz kedvező áron a közeledben élőktől felesleges vásárlás helyett.</li>
                                    <li><strong>Biztonság és bizalom:</strong> Valós értékelések, részletes profilok és átlátható bérlési feltételek.</li>
                                </ul>
                            </div>

                            <!-- ALTERNATÍV LINK -->
                            <div style="background-color: #f8fafc; border-left: 4px solid #059669; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Nem működik a gomb?</div>
                                <div style="font-size: 12px; color: #334155; line-height: 1.5; word-break: break-all;">
                                    Másold be ezt a hivatkozást közvetlenül a böngésződ címsorába:<br>
                                    <a href="${verify_url}" style="color: #059669; text-decoration: underline; font-weight: 600;">${verify_url}</a>
                                </div>
                            </div>

                            <!-- BIZTONSÁGI MEGJEGYZÉS -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px;">
                                <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.5;">
                                    🛡️ <strong>Biztonsági tájékoztató:</strong> Ha ezt a fiókot nem te regisztráltad a Kölcsönadlakon, kérjük hagyd figyelmen kívül ezt a levelet, vagy jelezd ügyfélszolgálatunknak.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- LÁBLÉC -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">
                                Ez egy automatikus értesítés a <strong>Kölcsönadlak</strong> (kolcsonadlak.hu) platformtól.
                            </p>
                            <p style="font-size: 11px; color: #cbd5e1; margin: 0;">
                                © 2026 Kölcsönadlak Platform (kolcsonadlak.hu) • Balassagyarmat & Országos hálózat
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// HTTP API Endpoint
exports.sendRentalEmail = functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method Not Allowed" });
        }

        try {
            const { type, data = {} } = req.body || {};
            let subject = "";
            let html = "";
            let to = data.target_email || SMTP_USER;

            const { imgSrc, attachments: imgAttachments } = prepareItemImage(data.item_image, data.site_url);
            data.item_image_src = imgSrc;

            if (type === "rental_request") {
                subject = `🛠️ [Kölcsönadlak - Új Bérlési Kérelem] ${data.item_title || "Eszköz"} (${data.renter_name || "Bérlő"})`;
                html = getRentalRequestHtml(data);
                to = data.owner_email || SMTP_USER;
            } else if (type === "rental_approval") {
                subject = `🎉 [Kölcsönadlak - Bérlés Jóváhagyva] A bérbeadó elfogadta a kérelmedet: ${data.item_title || "Eszköz"}`;
                html = getRentalApprovalHtml(data);
                to = data.renter_email || SMTP_USER;
            } else if (type === "register_verify" || type === "registration_verification" || type === "registration") {
                subject = `🎉 [Kölcsönadlak] Erősítsd meg a regisztrációdat! (${data.user_name || "Új Felhasználó"})`;
                html = data.html || getRegistrationVerifyHtml(data);
                to = data.user_email || data.target_email || SMTP_USER;
            } else if (data.html && (data.subject || type === "custom")) {
                subject = data.subject || "Értesítés - Kölcsönadlak.hu";
                html = data.html;
                to = data.target_email || data.user_email || SMTP_USER;
            } else {
                return res.status(400).json({ error: "Invalid email notification type" });
            }

            // 1. Címzettnek küldés
            const info = await transporter.sendMail({
                from: FROM_HEADER,
                to: to,
                subject: subject,
                html: html,
                attachments: imgAttachments
            });

            // 2. Admin másolat küldése
            if (ADMIN_EMAIL && ADMIN_EMAIL !== to) {
                try {
                    await transporter.sendMail({
                        from: FROM_HEADER,
                        to: ADMIN_EMAIL,
                        subject: `[ADMIN MÁSOLAT] ${subject}`,
                        html: html,
                        attachments: imgAttachments
                    });
                } catch (adminErr) {
                    console.warn("Admin copy email warning:", adminErr);
                }
            }

            return res.status(200).json({ success: true, messageId: info.messageId, to: to });
        } catch (err) {
            console.error("Failed to send email:", err);
            return res.status(500).json({ error: err.message });
        }
    });
});
