# راهنمای انتشار Market4U روی Microsoft Azure
# Market4U Azure Deployment Guide

---

## فهرست / Table of Contents

1. [معرفی / Overview](#overview)
2. [پیش‌نیازها / Prerequisites](#prerequisites)
3. [گام ۱: ساخت منابع Azure / Step 1: Provision Azure Resources](#step-1)
4. [گام ۲: تنظیم GitHub / Step 2: Configure GitHub](#step-2)
5. [گام ۳: آماده‌سازی دیتابیس / Step 3: Initialize Database](#step-3)
6. [گام ۴: انتشار خودکار / Step 4: Automatic Deployment](#step-4)
7. [توسعه محلی / Local Development](#local-dev)
8. [عیب‌یابی / Troubleshooting](#troubleshooting)

---

<a name="overview"></a>
## ۱. معرفی / Overview

**فارسی/دری:**
این برنامه از سه بخش اصلی تشکیل شده است:
- **Frontend (ظاهر برنامه):** React + Vite — روی Azure Static Web Apps اجرا می‌شود
- **Backend (پشتیبان):** Azure Functions (Node.js) — داخل همان Static Web App
- **Database (دیتابیس):** Azure SQL Database — برای ذخیره اطلاعات
- **Storage (ذخیره‌سازی):** Azure Blob Storage — برای تصاویر محصولات

**English:**
The app has three main parts:
- **Frontend:** React + Vite — hosted on Azure Static Web Apps
- **Backend:** Azure Functions (Node.js) — co-hosted in Static Web App
- **Database:** Azure SQL Database — stores all data
- **Storage:** Azure Blob Storage — stores product images

**Architecture:**
```
Internet → Azure Static Web Apps
              ├── /         → React Frontend (dist/)
              └── /api/*    → Azure Functions (api/dist/)
                                  ├── Azure SQL Database
                                  └── Azure Blob Storage
```

---

<a name="prerequisites"></a>
## ۲. پیش‌نیازها / Prerequisites

**چیزهایی که نیاز دارید / What you need:**

| ابزار / Tool | دانلود / Download | توضیح / Note |
|---|---|---|
| Azure CLI | https://aka.ms/installazurecli | برای اجرای اسکریپت / For running script |
| Node.js 20+ | https://nodejs.org | برای build و توسعه |
| Git | https://git-scm.com | کنترل کد |
| حساب Azure | https://azure.microsoft.com/free | اکانت رایگان کافی است |
| حساب GitHub | https://github.com | برای CI/CD |

**نصب Azure CLI / Install Azure CLI:**
```bash
# Windows (PowerShell as Admin):
winget install Microsoft.AzureCLI

# macOS:
brew install azure-cli

# Ubuntu/Debian Linux:
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

---

<a name="step-1"></a>
## ۳. گام ۱: ساخت منابع Azure / Step 1: Provision Azure Resources

### روش خودکار (پیشنهادی) / Automatic Method (Recommended)

**۱. وارد Azure شوید / Login to Azure:**
```bash
az login
```
یک مرورگر باز می‌شود. با حساب Azure خود وارد شوید.

**۲. اسکریپت را اجرا کنید / Run the provisioning script:**
```bash
# از پوشه اصلی پروژه / From project root:
bash scripts/deploy-azure.sh
```

اسکریپت از شما می‌خواهد:
- رمز عبور SQL (حداقل ۸ کاراکتر با حروف بزرگ، کوچک، عدد و علامت)

سپس خودکار می‌سازد:
- ✅ Resource Group
- ✅ Azure Static Web App
- ✅ Azure SQL Server + Database
- ✅ Azure Blob Storage
- ✅ Application Insights

**تنظیمات پیش‌فرض / Default settings:**
| تنظیم | مقدار پیش‌فرض |
|---|---|
| منطقه / Region | `uaenorth` (دبی - نزدیک‌ترین به افغانستان) |
| نام برنامه | `market4u` |
| محیط / Environment | `prod` |

**تغییر تنظیمات / Customize settings:**
```bash
APP_NAME=mymarket \
ENVIRONMENT=prod \
LOCATION=uaenorth \
bash scripts/deploy-azure.sh
```

---

### روش دستی از طریق Azure Portal / Manual via Azure Portal

اگر ترجیح می‌دهید از طریق وب‌سایت Azure کار کنید:

**الف) Resource Group بسازید:**
1. به https://portal.azure.com بروید
2. جستجو کنید: **Resource groups** → **+ Create**
3. نام: `market4u-prod-rg`
4. منطقه: **UAE North** (یا **Central India**)
5. **Review + Create** → **Create**

**ب) Static Web App بسازید:**
1. جستجو کنید: **Static Web Apps** → **+ Create**
2. Resource Group: `market4u-prod-rg`
3. نام: `market4u-prod-swa`
4. Plan type: **Free**
5. منطقه: **East Asia** (نزدیک‌ترین به SWA)
6. Source: **GitHub** → حساب GitHub خود را متصل کنید
7. Repository: `Arshad233600/market4u-af`
8. Branch: `main`
9. Build Preset: **Custom**
10. App location: `/`
11. Api location: `api`
12. Output location: `dist`
13. **Review + Create** → **Create**

**ج) SQL Server بسازید:**
1. جستجو کنید: **SQL servers** → **+ Create**
2. Resource Group: `market4u-prod-rg`
3. Server name: `market4u-prod-sql`
4. Location: **UAE North**
5. Authentication: **SQL authentication**
6. Admin login: `market4uadmin`
7. Password: (رمز قوی انتخاب کنید)
8. **Review + Create** → **Create**

**د) SQL Database بسازید:**
1. در SQL Server ساخته شده → **+ New database**
2. نام: `Market4U`
3. Compute + storage: **Basic** (5 DTU - برای شروع کافی)
4. **Review + Create** → **Create**

**ه) Firewall SQL را تنظیم کنید:**
1. SQL Server → **Networking**
2. فعال کنید: **Allow Azure services and resources to access this server**
3. **Save**

**و) Storage Account بسازید:**
1. جستجو کنید: **Storage accounts** → **+ Create**
2. Resource Group: `market4u-prod-rg`
3. نام: `market4uprodst` (فقط حروف کوچک و اعداد)
4. Location: **UAE North**
5. Performance: **Standard**
6. Redundancy: **LRS**
7. **Review + Create** → **Create**

**ز) Blob Container بسازید:**
1. Storage Account → **Containers** → **+ Container**
2. نام: `product-images`
3. Public access level: **Blob (anonymous read access for blobs only)**
4. **Create**

---

<a name="step-2"></a>
## ۴. گام ۲: تنظیم GitHub / Step 2: Configure GitHub

### اضافه کردن توکن Azure به GitHub Secrets

**الف) توکن deployment را پیدا کنید:**
1. Azure Portal → Static Web Apps → `market4u-prod-swa`
2. **Manage deployment token**
3. کپی کنید

**ب) به GitHub Secrets اضافه کنید:**
1. GitHub → مخزن شما → **Settings**
2. **Secrets and variables** → **Actions**
3. **New repository secret**
4. نام: `AZURE_STATIC_WEB_APPS_API_TOKEN`
5. مقدار: (توکن کپی شده)
6. **Add secret**

### تنظیم متغیرهای محیطی در Azure

1. Azure Portal → Static Web Apps → `market4u-prod-swa`
2. **Settings** → **Environment variables**
3. متغیرهای زیر را اضافه کنید:

| نام متغیر | مقدار |
|---|---|
| `SqlConnectionString` | `Server=tcp:YOUR_SERVER.database.windows.net,1433;Initial Catalog=Market4U;User Id=market4uadmin;Password=YOUR_PASS;Encrypt=true;` |
| `AUTH_SECRET` | یک رشته تصادفی حداقل ۳۲ کاراکتر |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string از Storage Account |
| `AZURE_STORAGE_CONTAINER` | `product-images` |
| `GEMINI_API_KEY` | (اختیاری - برای هوش مصنوعی) |

**کجا Connection String را پیدا کنید:**
- SQL: Azure Portal → SQL Database → **Connection strings** → ADO.NET
- Storage: Azure Portal → Storage Account → **Access keys** → Connection string

---

<a name="step-3"></a>
## ۵. گام ۳: آماده‌سازی دیتابیس / Step 3: Initialize Database

**از طریق Azure Portal:**
1. Azure Portal → SQL databases → `Market4U`
2. **Query editor (preview)**
3. وارد شوید با نام کاربری و رمز SQL
4. محتوای فایل `api/sql/init.sql` را کپی و اجرا کنید
5. پیام موفقیت: `Database schema created successfully!`

**از طریق خط فرمان (اگر sqlcmd نصب است):**
```bash
sqlcmd -S YOUR_SERVER.database.windows.net \
       -d Market4U \
       -U market4uadmin \
       -P YOUR_PASSWORD \
       -i api/sql/init.sql \
       -C
```

**تأیید صحت:**
```sql
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
```
باید ۶ جدول نشان دهد: `Users, Ads, AdImages, Favorites, Messages, WalletTransactions`

---

<a name="step-4"></a>
## ۶. گام ۴: انتشار خودکار / Step 4: Automatic Deployment

پس از تنظیم Secret در GitHub، هر بار که کد به شاخه `main` push شود:
1. GitHub Actions اجرا می‌شود
2. Frontend و Backend build می‌شوند
3. به Azure Static Web Apps آپلود می‌شوند
4. در ۲-۳ دقیقه سایت به‌روز می‌شود

**مشاهده وضعیت build:**
GitHub → مخزن شما → **Actions** → آخرین workflow

**آدرس سایت:**
Azure Portal → Static Web Apps → **URL** (مثلاً `https://market4u-prod-swa.azurestaticapps.net`)

---

<a name="local-dev"></a>
## ۷. توسعه محلی / Local Development

**۱. تنظیمات محلی API:**
```bash
cp api/local.settings.example.json api/local.settings.json
# ویرایش api/local.settings.json با اطلاعات واقعی
```

**۲. نصب وابستگی‌ها:**
```bash
npm install
cd api && npm install && cd ..
```

**۳. Build کردن API:**
```bash
cd api && npm run build && cd ..
```

**۴. اجرای سرورها:**

ترمینال ۱ (API):
```bash
cd api
npm start
```

ترمینال ۲ (Frontend):
```bash
npm run dev
```

**۵. دسترسی:**
- Frontend: http://localhost:3000
- API: http://localhost:7071/api

---

<a name="troubleshooting"></a>
## ۸. عیب‌یابی / Troubleshooting

### سایت باز نمی‌شود
- در GitHub Actions مطمئن شوید که build موفق بوده
- Azure Portal → Static Web Apps → **Overview** → آدرس را چک کنید

### خطای API (500 Internal Server Error)
```
۱. Azure Portal → Static Web Apps → Settings → Environment variables
   → مطمئن شوید SqlConnectionString تنظیم است
۲. Azure Portal → SQL Server → Networking
   → "Allow Azure services" فعال باشد
۳. مطمئن شوید init.sql اجرا شده است
```

### خطای ورود / Login Error
- `AUTH_SECRET` را در تنظیمات Static Web App بررسی کنید
- باید حداقل ۳۲ کاراکتر باشد

### تصاویر آپلود نمی‌شوند
- `AZURE_STORAGE_CONNECTION_STRING` را بررسی کنید
- Blob container باید `product-images` باشد با دسترسی public Blob

### بررسی لاگ‌ها / Check Logs
```bash
# Azure CLI
az staticwebapp appsettings list \
  --name market4u-prod-swa \
  --resource-group market4u-prod-rg
```

---

## حساب‌های آزمایشی / Default Test Accounts

بعد از اجرای `init.sql`:

| نوع | ایمیل | رمز عبور |
|---|---|---|
| ادمین / Admin | admin@market4u.com | admin123 |
| کاربر / User | user@market4u.com | user123 |

⚠️ **این رمزها را فوری در محیط production عوض کنید!**

---

## هزینه‌ها / Estimated Costs

| سرویس | طرح | هزینه تقریبی/ماه |
|---|---|---|
| Static Web Apps | Free | $0 |
| SQL Database | Basic (5 DTU) | ~$5 |
| Blob Storage | Standard LRS | ~$0.02/GB |
| Application Insights | Pay-as-you-go | ~$0 (تا ۵ GB رایگان) |
| **مجموع** | | **~$5-10/ماه** |

---

## لینک‌های مفید / Useful Links

- [Azure Portal](https://portal.azure.com)
- [Azure Static Web Apps Docs](https://docs.microsoft.com/azure/static-web-apps)
- [Azure SQL Database Docs](https://docs.microsoft.com/azure/azure-sql)
- [Azure Functions Docs](https://docs.microsoft.com/azure/azure-functions)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure)
