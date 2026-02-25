# Market4U - Android App 🤖

این پوشه پروژه اندرید اپلیکیشن Market4U را که با استفاده از Capacitor ساخته شده است در بر می‌گیرد.

## 📥 نصب APK مستقیم (برای کاربران)

بعد از هر ریلیز، فایل APK در بخش [Releases](https://github.com/Arshad233600/market4u-af/releases) در دسترس است.

1. روی لینک دانلود APK کلیک کنید
2. فایل را روی گوشی اندرید خود دانلود کنید
3. قبل از نصب، در تنظیمات گوشی گزینه **"منابع ناشناس"** (Unknown Sources) را فعال کنید
4. فایل APK را باز کنید و نصب کنید

---

## 🛠️ نصب از طریق PWA (آسان‌تر)

اگر می‌خواهید اپ را بدون دانلود فایل نصب کنید:

1. سایت [market4u.af](https://market4u.af) را در **Google Chrome** باز کنید
2. منوی سه‌نقطه (⋮) را باز کنید
3. گزینه **"Add to Home screen"** یا **"نصب اپ"** را انتخاب کنید
4. تأیید کنید — اپ مانند یک برنامه معمولی روی صفحه اصلی ظاهر می‌شود

---

## 👨‍💻 ساخت APK برای توسعه‌دهندگان

### پیش‌نیازها

- Node.js 18+
- Android Studio با Android SDK (API 22+)
- Java 17+

### مراحل ساخت

```bash
# ۱. نصب dependencies
npm install

# ۲. ساخت web assets
npm run build

# ۳. همگام‌سازی با پروژه اندرید
npx cap sync android

# ۴. باز کردن در Android Studio
npx cap open android
```

در Android Studio می‌توانید:
- روی دستگاه واقعی یا شبیه‌ساز اجرا کنید
- فایل APK/AAB را برای توزیع بسازید (Build → Generate Signed Bundle/APK)

### ساخت APK از طریق Command Line

```bash
cd android
./gradlew assembleRelease
```

فایل APK در مسیر `android/app/build/outputs/apk/release/app-release.apk` ذخیره می‌شود.

---

## 📋 اطلاعات برنامه

| مشخصه | مقدار |
|--------|-------|
| App ID | `af.market4u.app` |
| نسخه اندرید | 22+ (Android 5.0) |
| فریم‌ورک | Capacitor + React |
