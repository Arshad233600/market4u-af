# راهنمای تنظیم GitHub Secrets برای Market4U

## GitHub Secrets Setup Guide for Market4U

---

## 🇦🇫 دری / Dari

این راهنما نشان می‌دهد که کدام کلیدهایی که در **Microsoft Azure** ساخته‌اید باید به عنوان **GitHub Secrets** تنظیم شوند تا فرآیند CI/CD به درستی کار کند.

> **چرا باید در GitHub هم تنظیم شوند؟**
> GitHub Actions هنگام Deploy کردن، این مقادیر را به‌صورت خودکار به Azure Application Settings منتقل می‌کند.
> اگر این Secret‌ها در GitHub تنظیم نشوند، workflow با خطا متوقف می‌شود و مقادیر موجود در Azure **پاک می‌شوند** که باعث خطاهای 401/503 می‌شود.

---

## چگونه Secret اضافه کنیم؟

۱. به آدرس مخزن در GitHub بروید: `https://github.com/Arshad233600/market4u-af`
۲. روی **Settings** کلیک کنید
۳. از منوی سمت چپ: **Secrets and variables → Actions**
۴. روی **New repository secret** کلیک کنید
۵. نام و مقدار را وارد کنید → **Add secret**

---

## 🔑 جدول کلیدها / Secrets Table

| نام Secret در GitHub | مقدار / Format | ضروری؟ | توضیح |
|---|---|---|---|
| `AUTH_SECRET` | رشته تصادفی حداقل ۳۲ کاراکتر | ✅ **بسیار ضروری** | برای امضا و تأیید توکن‌های JWT استفاده می‌شود. با دستور `openssl rand -hex 32` بسازید. |
| `SqlConnectionString` | `Server=tcp:...database.windows.net,1433;...` | ✅ **بسیار ضروری** | رشته اتصال به Azure SQL Database. نام دقیق باید `SqlConnectionString` باشد. |
| `AZURE_SQL_CONNECTION_STRING` | همان مقدار `SqlConnectionString` | ✅ **ضروری** | نام جایگزین که توسط سیستم پشتیبانی می‌شود. |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=https;AccountName=...` | ✅ **بسیار ضروری** | رشته اتصال Azure Blob Storage برای آپلود تصاویر. |
| `AZURE_STORAGE_CONTAINER` | `product-images` | ✅ **بسیار ضروری** | نام Container در Azure Blob Storage. |
| `GEMINI_API_KEY` | کلید API از Google AI Studio | ⚠️ توصیه شده | برای قابلیت تولید توضیح آگهی با هوش مصنوعی. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=...;IngestionEndpoint=...` | ⚠️ توصیه شده | برای مانیتورینگ و لاگ‌گیری در Azure Application Insights. |
| `VITE_API_BASE_URL` | `/api` | ✅ **ضروری** | باید دقیقاً `/api` باشد (نه یک URL کامل). |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | توکن خودکار از Azure | 🔄 **خودکار** | به‌صورت خودکار هنگام اتصال مخزن به Azure Static Web Apps ساخته می‌شود — نیازی به ساختن دستی ندارد. |

---

## 📋 مقادیر نمونه / Example Values

### `AUTH_SECRET`
```
# در Linux/macOS:
openssl rand -hex 32
# خروجی نمونه:
a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2
```

### `SqlConnectionString`
```
Server=tcp:market4u-sql-server.database.windows.net,1433;Initial Catalog=market4u-db;Persist Security Info=False;User ID=YOUR_USER;Password=YOUR_PASSWORD;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;ApplicationName=market4u-api;
```

### `AZURE_STORAGE_CONNECTION_STRING`
```
DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=YOUR_ACCOUNT_KEY;EndpointSuffix=core.windows.net
```

### `AZURE_STORAGE_CONTAINER`
```
product-images
```

### `VITE_API_BASE_URL`
```
/api
```

### `APPLICATIONINSIGHTS_CONNECTION_STRING`
```
InstrumentationKey=YOUR_KEY;IngestionEndpoint=https://YOUR_REGION.in.applicationinsights.azure.com/;LiveEndpoint=https://YOUR_REGION.livediagnostics.monitor.azure.com/
```

---

## 🔄 جریان کار / How It Works

```
GitHub Secrets
      │
      ▼
GitHub Actions Workflow
(.github/workflows/azure-static-web-apps.yml)
      │
      ├─ Validates secrets are present (fails fast if missing)
      │
      ▼
Azure Static Web Apps Deploy Action
      │
      └─ Syncs secrets → Azure Application Settings
                  │
                  ▼
            Azure Functions (API)
            reads env vars at runtime
```

---

## ⚠️ نکات مهم / Important Notes

1. **`AUTH_SECRET`** باید یک رشته تصادفی واقعی باشد — از قرار دادن نام متغیر دیگری (مثل `VITE_API_BASE_URL`) به عنوان مقدار آن خودداری کنید.

2. **`VITE_API_BASE_URL`** باید دقیقاً `/api` باشد (بدون دامنه). اگر URL کامل مثل `https://xyz.azurewebsites.net/api` قرار دهید، درخواست‌ها از SWA bypass می‌شوند و خطای CORS/401 ایجاد می‌شود.

3. **`SqlConnectionString`** نام دقیق مهم است — Azure Functions این نام را به عنوان Connection String شناخته و به‌صورت ویژه با آن رفتار می‌کند.

4. پس از تغییر هر Secret، باید یک **Deploy مجدد** انجام دهید تا مقادیر جدید به Azure منتقل شوند.

---

## English Summary

All eight keys listed in the table above must be added to **GitHub → Settings → Secrets and variables → Actions** as repository secrets.

The CI/CD workflow (`.github/workflows/azure-static-web-apps.yml`) reads these secrets and:
- **Validates** that the critical ones (`AUTH_SECRET`, `SqlConnectionString`/`AZURE_SQL_CONNECTION_STRING`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`) are present before deploying.
- **Syncs** all secrets to Azure Application Settings during deployment.

If a secret is missing from GitHub, the workflow will fail the deployment to prevent overwriting a valid Azure setting with an empty value (which would break the live API).

For local development, copy `api/local.settings.json.example` to `api/local.settings.json` and fill in the real values.
