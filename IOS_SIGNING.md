# راهنمای تنظیم امضای iOS (iOS Code Signing Setup)

برای ساخت فایل `.ipa` واقعی (قابل نصب روی دستگاه iPhone)، باید ۶ سکرت (Secret) زیر را به تنظیمات GitHub اضافه کنید.

---

## ۱. پیش‌نیازها

- عضویت فعال در [Apple Developer Program](https://developer.apple.com/programs/) (پرداخت سالانه ۹۹ دلار)
- نصب **Xcode** روی Mac
- دسترسی به تنظیمات Repository در GitHub (Settings → Secrets and variables → Actions)

---

## ۲. دریافت Certificate و Provisioning Profile

### الف) ساخت Distribution Certificate

1. وارد [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list) شوید.
2. گزینه **Certificates → +** را انتخاب کنید.
3. نوع **Apple Distribution** را انتخاب کنید.
4. CSR (Certificate Signing Request) را از Keychain Access بسازید:
   - `Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority`
5. CSR را آپلود کنید و Certificate را دانلود کنید.
6. روی فایل دانلود‌شده دابل‌کلیک کنید تا به Keychain اضافه شود.
7. در Keychain Access، روی Certificate کلیک راست کرده → **Export** کنید:
   - فرمت: **Personal Information Exchange (.p12)**
   - یک پسورد قوی انتخاب کنید – این مقدار `P12_PASSWORD` است.

### ب) ساخت Provisioning Profile

1. وارد [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list) شوید.
2. گزینه **Profiles → +** را انتخاب کنید.
3. نوع **Ad Hoc** (برای توزیع محدود) یا **App Store** را انتخاب کنید.
4. **App ID** را `af.market4u.app` انتخاب کنید (اگر وجود ندارد، ابتدا آن را در بخش Identifiers بسازید).
5. Certificate و دستگاه‌های تست را انتخاب کنید.
6. یک نام بگذارید (مثلاً `Market4U Ad Hoc`) – این مقدار `PROVISIONING_PROFILE_NAME` است.
7. Profile را دانلود کنید (پسوند `.mobileprovision`).

---

## ۳. تولید Secrets با اسکریپت آماده

پس از دریافت فایل‌ها، اسکریپت زیر را روی Mac خود اجرا کنید:

```bash
chmod +x scripts/setup-ios-signing.sh

./scripts/setup-ios-signing.sh \
    --cert    /path/to/certificate.p12 \
    --profile /path/to/Market4U_AdHoc.mobileprovision \
    --team    YOURTEAMID \
    --profile-name "Market4U Ad Hoc"
```

> **Team ID** را از [Apple Developer Account](https://developer.apple.com/account) → `Membership Details` پیدا کنید.

اسکریپت مقادیر base64 همه Secret‌ها را در خروجی چاپ می‌کند.

---

## ۴. اضافه کردن Secrets به GitHub

به صفحه زیر بروید:

```
https://github.com/Arshad233600/market4u-af/settings/secrets/actions
```

سپس ۶ سکرت زیر را **New repository secret** کنید:

| نام Secret | توضیح |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | محتوای base64 فایل `.p12` |
| `P12_PASSWORD` | پسورد که موقع export فایل `.p12` تعیین کردید |
| `KEYCHAIN_PASSWORD` | یک پسورد تصادفی (اسکریپت خودکار تولید می‌کند) |
| `BUILD_PROVISION_PROFILE_BASE64` | محتوای base64 فایل `.mobileprovision` |
| `APPLE_TEAM_ID` | شناسه Team از Apple Developer Portal |
| `PROVISIONING_PROFILE_NAME` | نامی که برای Provisioning Profile انتخاب کردید |

---

## ۵. اجرای مجدد Workflow

پس از اضافه کردن همه ۶ سکرت:

1. به بخش **Actions** در GitHub بروید.
2. **Build iOS IPA** را انتخاب کنید.
3. روی **Run workflow** کلیک کنید.

این بار workflow یک فایل `.ipa` واقعی می‌سازد که روی دستگاه iPhone قابل نصب است.

---

## رفع مشکل (Troubleshooting)

| خطا | راه‌حل |
|---|---|
| `Code signing is required` | مطمئن شوید همه ۶ سکرت اضافه شده‌اند |
| `No certificate found` | Certificate را در Keychain Access تأیید کنید و دوباره export کنید |
| `Provisioning profile doesn't match` | بررسی کنید `PROVISIONING_PROFILE_NAME` دقیقاً با نام profile در Developer Portal مطابقت دارد |
| `Invalid team ID` | `APPLE_TEAM_ID` را از صفحه Membership در Developer Portal کپی کنید |
