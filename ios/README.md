# Market4U - iOS App 🍎

این پوشه پروژه iOS اپلیکیشن Market4U را که با استفاده از Capacitor ساخته شده است در بر می‌گیرد.

## 📥 نصب از طریق PWA (برای کاربران آیفون)

چون اپ Store نیاز به حساب Apple Developer دارد، ساده‌ترین راه نصب از طریق Safari است:

1. سایت [market4u.af](https://market4u.af) را در **Safari** (نه Chrome) باز کنید
2. دکمه **Share** (مربع با فلش رو به بالا) را لمس کنید
3. گزینه **"Add to Home Screen"** (افزودن به صفحه اصلی) را انتخاب کنید
4. نام را تأیید کنید و **Add** را بزنید
5. اپ Market4U روی صفحه اصلی شما نمایش داده می‌شود ✅

---

## 👨‍💻 ساخت IPA برای توسعه‌دهندگان

> **توجه:** ساخت برنامه iOS نیاز به **macOS** و **Xcode** دارد.

### پیش‌نیازها

- macOS 12.0+
- Xcode 14+
- CocoaPods (`sudo gem install cocoapods`)
- Node.js 18+
- Apple Developer Account (برای توزیع)

### مراحل ساخت

```bash
# ۱. نصب dependencies
npm install

# ۲. ساخت web assets
npm run build

# ۳. همگام‌سازی با پروژه iOS
npx cap sync ios

# ۴. باز کردن در Xcode
npx cap open ios
```

در Xcode:
1. تیم توسعه‌دهنده خود را در **Signing & Capabilities** تنظیم کنید
2. دستگاه مقصد را انتخاب کنید
3. روی **Run** کلیک کنید

### نصب CocoaPods (اگر لازم است)

```bash
cd ios/App
pod install
```

---

## 📱 توزیع از طریق TestFlight

1. در Xcode، **Archive** بسازید (Product → Archive)
2. به [App Store Connect](https://appstoreconnect.apple.com) وارد شوید
3. Archive را آپلود کنید
4. از TestFlight برای تست با کاربران استفاده کنید

---

## 📋 اطلاعات برنامه

| مشخصه | مقدار |
|--------|-------|
| Bundle ID | `af.market4u.app` |
| حداقل iOS | 13.0 |
| فریم‌ورک | Capacitor + React |
