# راهنمای کامل انتشار Market4U در Microsoft Azure
# Complete Azure Deployment Guide for Market4U

> **زبان:** دری (Dari)  
> این راهنما گام به گام توضیح می‌دهد که چطور اپلیکیشن Market4U را در Microsoft Azure نشر کنید.

---

## 📋 فهرست مطالب

1. [پیش‌نیازها](#۱-پیش‌نیازها)
2. [ساخت منابع Azure](#۲-ساخت-منابع-azure)
   - [Resource Group](#الف-resource-group-گروه-منابع)
   - [Azure SQL Database](#ب-azure-sql-database-دیتابیس)
   - [Azure Storage Account](#ج-azure-storage-account-ذخیره‌سازی-تصاویر)
   - [Azure Static Web App](#د-azure-static-web-app-میزبانی-وبسایت)
3. [اتصال GitHub به Azure](#۳-اتصال-github-به-azure)
4. [تنظیم متغیرهای محیطی](#۴-تنظیم-متغیرهای-محیطی)
5. [اجرای اسکریپت دیتابیس](#۵-اجرای-اسکریپت-دیتابیس)
6. [نشر خودکار با GitHub Actions](#۶-نشر-خودکار-با-github-actions)
7. [تست نهایی](#۷-تست-نهایی)
8. [نشر خودکار با Bicep (روش پیشرفته)](#۸-نشر-خودکار-با-bicep-روش-پیشرفته)
9. [رفع مشکلات رایج](#۹-رفع-مشکلات-رایج)
10. [هزینه‌های تقریبی](#۱۰-هزینه‌های-تقریبی)

---

## ۱. پیش‌نیازها

قبل از شروع، موارد زیر را آماده کنید:

- ✅ حساب Microsoft Azure (ثبت نام رایگان: https://azure.microsoft.com/free/)
- ✅ حساب GitHub با repository پروژه
- ✅ کد پروژه در شاخه `main` در GitHub
- ✅ Node.js نسخه 20 یا بالاتر (برای توسعه محلی)

---

## ۲. ساخت منابع Azure

وارد [Azure Portal](https://portal.azure.com) شوید.

### الف) Resource Group (گروه منابع)

این یک ظرف منطقی است که تمام منابع پروژه در آن قرار می‌گیرند.

1. در Azure Portal، **"Resource groups"** را جستجو کنید
2. روی **"+ Create"** کلیک کنید
3. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Subscription** | اشتراک Azure شما |
| **Resource group** | `Market4U-RG` |
| **Region** | `UAE North` (دبی - نزدیک‌ترین به افغانستان) |

4. روی **"Review + Create"** و سپس **"Create"** کلیک کنید

---

### ب) Azure SQL Database (دیتابیس)

این دیتابیس اطلاعات کاربران، آگهی‌ها و پیام‌ها را نگه می‌دارد.

#### قدم ۱: ساخت SQL Server

1. در Azure Portal، **"SQL servers"** را جستجو کنید
2. روی **"+ Create"** کلیک کنید
3. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Subscription** | اشتراک Azure شما |
| **Resource group** | `Market4U-RG` |
| **Server name** | `market4u-sql-[نام‌منحصربه‌فرد]` (مثلاً `market4u-sql-2024`) |
| **Region** | `UAE North` |
| **Authentication method** | `Use SQL authentication` |
| **Server admin login** | `market4uadmin` |
| **Password** | یک رمز قوی (مثلاً `Market4U@2024!`) |

4. در تب **"Networking"**:
   - **Connectivity method**: `Public endpoint`
   - **Allow Azure services**: `Yes`
   - **Add current client IP**: `Yes` (برای دسترسی از کامپیوتر شما)

5. روی **"Review + Create"** و سپس **"Create"** کلیک کنید

#### قدم ۲: ساخت Database

1. بعد از ساخت SQL Server، روی **"+ Create database"** کلیک کنید
2. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Database name** | `Market4U` |
| **Server** | سرور که در قدم قبل ساختید |
| **Compute + storage** | روی **"Configure database"** کلیک کنید → **Basic** را انتخاب کنید (ارزان‌ترین، حدود $5/ماه) |

3. روی **"Review + Create"** و سپس **"Create"** کلیک کنید

#### قدم ۳: کپی Connection String

1. وارد SQL Server بشوید
2. از منوی چپ، **"Connection strings"** را انتخاب کنید
3. تب **"ADO.NET"** را انتخاب کنید
4. رشته اتصال را کپی کنید (شبیه این):
   ```
   Server=tcp:market4u-sql-2024.database.windows.net,1433;Initial Catalog=Market4U;Persist Security Info=False;User ID=market4uadmin;Password=Market4U@2024!;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
   ```
5. این را **جای امنی ذخیره کنید** - بعداً لازم می‌شود

---

### ج) Azure Storage Account (ذخیره‌سازی تصاویر)

این برای ذخیره تصاویر آگهی‌ها استفاده می‌شود.

1. در Azure Portal، **"Storage accounts"** را جستجو کنید
2. روی **"+ Create"** کلیک کنید
3. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Resource group** | `Market4U-RG` |
| **Storage account name** | `market4uimages[عدد‌تصادفی]` (مثلاً `market4uimages2024`) ⚠️ فقط حروف کوچک و اعداد |
| **Region** | `UAE North` |
| **Performance** | `Standard` |
| **Redundancy** | `LRS` (ارزان‌ترین) |

4. روی **"Review + Create"** و سپس **"Create"** کلیک کنید

#### ساخت Container برای تصاویر

1. وارد Storage Account شوید
2. از منوی چپ، **"Containers"** را انتخاب کنید
3. روی **"+ Container"** کلیک کنید
4. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Name** | `product-images` |
| **Public access level** | `Blob (anonymous read access for blobs only)` |

5. روی **"Create"** کلیک کنید

#### کپی Connection String برای Storage

1. از منوی چپ Storage Account، **"Access keys"** را انتخاب کنید
2. روی **"Show keys"** کلیک کنید
3. زیر **"key1"**، **"Connection string"** را کپی کنید
4. این را نیز **جای امنی ذخیره کنید**

---

### د) Azure Static Web App (میزبانی وبسایت)

این سرویس هم وبسایت و هم API را میزبانی می‌کند و **رایگان** است!

1. در Azure Portal، **"Static Web Apps"** را جستجو کنید
2. روی **"+ Create"** کلیک کنید
3. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Resource group** | `Market4U-RG` |
| **Name** | `market4u-app` |
| **Plan type** | `Free` |
| **Region** | `East Asia` یا `Central US` (Static Web Apps در UAE North در دسترس نیست) |
| **Source** | `GitHub` |

4. روی **"Sign in with GitHub"** کلیک کنید و اجازه دسترسی بدهید
5. تنظیمات GitHub را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Organization** | نام سازمان یا حساب GitHub شما |
| **Repository** | `market4u-af` |
| **Branch** | `main` |

6. در بخش **"Build Details"**:

| فیلد | مقدار |
|------|-------|
| **Build Presets** | `Custom` |
| **App location** | `/` |
| **Api location** | `api` |
| **Output location** | `dist` |

7. روی **"Review + Create"** و سپس **"Create"** کلیک کنید

> ⚠️ **توجه:** Azure به طور خودکار یک فایل GitHub Actions به repository شما اضافه می‌کند. اما ما قبلاً فایل خودمان را داریم، پس می‌توانید آن فایل جدید را حذف کنید.

---

## ۳. اتصال GitHub به Azure

#### دریافت Deployment Token

1. وارد Static Web App شوید که در مرحله قبل ساختید
2. از منوی چپ، **"Overview"** را انتخاب کنید
3. روی **"Manage deployment token"** کلیک کنید
4. توکن را **کپی کنید**

#### اضافه کردن Secret به GitHub

1. به GitHub repository بروید: `https://github.com/YOUR_USERNAME/market4u-af`
2. روی **"Settings"** کلیک کنید
3. از منوی چپ، **"Secrets and variables"** → **"Actions"** را انتخاب کنید
4. روی **"New repository secret"** کلیک کنید
5. تنظیمات زیر را وارد کنید:

| فیلد | مقدار |
|------|-------|
| **Name** | `AZURE_STATIC_WEB_APPS_API_TOKEN` |
| **Secret** | توکنی که از Azure کپی کردید |

6. روی **"Add secret"** کلیک کنید

---

## ۴. تنظیم متغیرهای محیطی

متغیرهای محیطی اطلاعات حساس مانند رمزهای دیتابیس را نگه می‌دارند.

1. وارد Static Web App شوید
2. از منوی چپ، **"Configuration"** را انتخاب کنید
3. روی **"+ Add"** کلیک کنید و هر متغیر را یک به یک اضافه کنید:

| نام متغیر | مقدار | توضیح |
|-----------|-------|-------|
| `SqlConnectionString` | رشته اتصال SQL که کپی کردید | اتصال به دیتابیس |
| `AUTH_SECRET` | یک رشته تصادفی طولانی (حداقل 32 کاراکتر) | امنیت توکن‌های JWT |
| `AZURE_STORAGE_CONNECTION_STRING` | رشته اتصال Storage که کپی کردید | ذخیره تصاویر |
| `AZURE_STORAGE_CONTAINER` | `product-images` | نام container تصاویر |
| `GEMINI_API_KEY` | کلید Gemini AI (اختیاری) | هوش مصنوعی |
| `VITE_USE_MOCK_DATA` | `false` | **⚠️ اختیاری:** برای استفاده از دیتابیس واقعی، این متغیر را `false` قرار دهید. بدون این متغیر، اپ از حالت نمایشی (Mock) استفاده می‌کند |

> ⚠️ **مهم:** متغیر `VITE_USE_MOCK_DATA=false` در زمان **Build** خوانده می‌شود نه Runtime. برای اینکه این متغیر در هنگام build در دسترس باشد، باید آن را در Azure Static Web App → Configuration → Application settings اضافه کنید تا Azure در هنگام deploy از آن استفاده کند.

> 💡 **برای ساخت AUTH_SECRET:** می‌توانید از این سایت یک کلید تصادفی بسازید: https://generate-secret.vercel.app/32

4. بعد از اضافه کردن همه متغیرها، روی **"Save"** کلیک کنید

---

## ۵. اجرای اسکریپت دیتابیس

این مرحله جداول دیتابیس را می‌سازد.

#### روش ۱: از طریق Azure Portal

1. در Azure Portal، وارد SQL Database `Market4U` شوید
2. از منوی چپ، **"Query editor (preview)"** را انتخاب کنید
3. با نام کاربری و رمز SQL Server وارد شوید
4. محتویات فایل `api/sql/init.sql` را کپی کنید
5. در Query editor جای‌گذاری (paste) کنید
6. روی **"Run"** کلیک کنید

#### روش ۲: از طریق Azure Data Studio یا SSMS

1. Azure Data Studio را دانلود کنید: https://aka.ms/azuredatastudio
2. اتصال جدید ایجاد کنید:
   - **Server**: `[نام-سرور].database.windows.net`
   - **Authentication**: `SQL Login`
   - **User name**: `market4uadmin`
   - **Password**: رمز SQL Server
3. فایل `api/sql/init.sql` را باز کنید و اجرا کنید

---

## ۶. نشر خودکار با GitHub Actions

بعد از انجام مراحل بالا، هر بار که کد را به شاخه `main` push کنید، به طور خودکار نشر می‌شود.

#### اولین نشر دستی

1. به GitHub repository بروید
2. روی تب **"Actions"** کلیک کنید
3. اگر workflow آماده نشان داده نمی‌شود، روی **"Azure Static Web Apps CI/CD"** کلیک کنید
4. روی **"Run workflow"** کلیک کنید
5. منتظر بمانید تا کامل شود (حدود 5-10 دقیقه)

#### بررسی وضعیت نشر

- ✅ آیکون سبز: نشر موفق
- ❌ آیکون قرمز: خطا - روی آن کلیک کنید تا جزئیات ببینید

---

## ۷. تست نهایی

بعد از نشر موفق:

1. آدرس وبسایت را از بخش **"Overview"** Static Web App کپی کنید
2. وبسایت را در مرورگر باز کنید
3. API را تست کنید: `https://[آدرس-سایت]/api/health`
4. باید جواب زیر را ببینید:
   ```json
   {"success": true, "data": {"status": "healthy", "database": "connected"}}
   ```

#### حساب‌های آزمایشی

بعد از اجرای `init.sql`، می‌توانید با این حساب‌ها وارد شوید:

| نوع | ایمیل | رمز عبور |
|-----|-------|---------|
| مدیر | `admin@market4u.com` | `admin123` |
| کاربر | `user@market4u.com` | `user123` |

> ⚠️ **فوری:** این رمزها را بعد از اولین ورود عوض کنید!

---

## ۸. نشر خودکار با Bicep (روش پیشرفته)

اگر می‌خواهید تمام منابع Azure را با یک دستور بسازید:

#### پیش‌نیاز: نصب Azure CLI

دانلود از: https://docs.microsoft.com/cli/azure/install-azure-cli

#### مراحل

```bash
# ۱. ورود به Azure
az login

# ۲. ساخت Resource Group
az group create --name Market4U-RG --location uaenorth

# ۳. نشر تمام منابع با Bicep
az deployment group create \
  --resource-group Market4U-RG \
  --template-file infrastructure/main.bicep \
  --parameters \
    sqlAdminPassword='Market4U@2024!' \
    githubRepoUrl='https://github.com/YOUR_USERNAME/market4u-af' \
    githubBranch='main'
```

> ⚠️ رمز SQL را با یک رمز قوی خود جایگزین کنید

#### دریافت نتایج

بعد از اجرا، خروجی شامل:
- `staticWebAppUrl`: آدرس وبسایت
- `deploymentToken`: توکن برای GitHub Secret

---

## ۹. رفع مشکلات رایج

### ❌ خطا: "خطای سرور" هنگام ثبت نام یا ورود

**علت:** متغیر `VITE_USE_MOCK_DATA=false` تنظیم نشده، یا دیتابیس متصل نیست.

**راه حل:**
1. اگر می‌خواهید از داده‌های نمایشی استفاده کنید (بدون دیتابیس): مطمئن شوید `VITE_USE_MOCK_DATA` تنظیم نشده یا مقدار `true` دارد، سپس دوباره deploy کنید.
2. اگر می‌خواهید دیتابیس واقعی: اطمینان حاصل کنید که `VITE_USE_MOCK_DATA=false` و `SqlConnectionString` در Azure App Settings تنظیم شده است، سپس دوباره deploy کنید.
3. وضعیت دیتابیس را از آدرس `/api/health` بررسی کنید.

### ❌ خطا: "Database connection failed"

**علت:** رشته اتصال اشتباه است

**راه حل:**
1. وارد Static Web App → Configuration بشوید
2. مقدار `SqlConnectionString` را بررسی کنید
3. مطمئن شوید `User ID` و `Password` صحیح هستند
4. مطمئن شوید Firewall Rule "AllowAllWindowsAzureIps" در SQL Server موجود است

### ❌ خطا: "No matching Static Web App was found or the api key was invalid"

**علت:** توکن GitHub Secret اشتباه است

**راه حل:**
1. وارد Static Web App در Azure شوید
2. روی **"Manage deployment token"** کلیک کنید
3. توکن جدید را کپی کنید
4. در GitHub: Settings → Secrets → `AZURE_STATIC_WEB_APPS_API_TOKEN` را آپدیت کنید
5. دوباره Workflow را اجرا کنید

### ❌ خطا: Build fails with TypeScript errors

**راه حل:**
```bash
# در محیط محلی بیلد را تست کنید
npm install
npm run build

cd api
npm install
npm run build
```

### ❌ تصاویر آپلود نمی‌شوند

**علت:** تنظیمات Storage اشتباه است

**راه حل:**
1. مطمئن شوید `AZURE_STORAGE_CONNECTION_STRING` صحیح است
2. مطمئن شوید Container `product-images` با دسترسی Public ساخته شده
3. CORS را در Storage Account بررسی کنید (باید `*` اجازه داشته باشد)

### ❌ خطاهای API (500)

**راه حل:**
1. وارد Static Web App شوید
2. از منوی چپ، **"Functions"** را انتخاب کنید
3. روی هر تابع کلیک کنید تا لاگ‌ها را ببینید

---

## ۱۰. هزینه‌های تقریبی

| منبع | سطح | هزینه تقریبی/ماه |
|------|-----|-----------------|
| Static Web App | Free | **$0** |
| SQL Database | Basic (5 DTU) | **~$5** |
| Storage Account | Standard LRS | **~$1** (بستگی به حجم تصاویر) |
| **مجموع** | | **~$6/ماه** |

> 💡 برای شروع این هزینه بسیار معقول است. با رشد اپ می‌توانید SQL را به Standard ارتقا دهید.

---

## 📞 پشتیبانی

اگر مشکلی داشتید:
1. لاگ‌های GitHub Actions را بررسی کنید
2. لاگ‌های Azure Static Web App را بررسی کنید
3. مستندات Azure: https://docs.microsoft.com/azure/static-web-apps/

---

*Market4U - بازار دیجیتال افغانستان 🇦🇫*
