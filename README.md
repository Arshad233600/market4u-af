
# Bazar Afghanistan (بازار افغانستان) 🇦🇫

A modern, offline-first marketplace Progressive Web App (PWA) tailored for the Afghan market. Built with React, TypeScript, and Azure.

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.StaticApp)

## 📱 نصب اپ روی موبایل (Mobile Installation)

### اندرید (Android)
1. **از طریق PWA (بدون دانلود):** سایت را در Chrome باز کنید → منوی ⋮ → "Add to Home Screen"
2. **APK مستقیم:** آخرین نسخه APK را از [Releases](https://github.com/Arshad233600/market4u-af/releases) دانلود کنید
3. **توسعه‌دهندگان:** راهنمای [android/README.md](./android/README.md) را ببینید

### آیفون (iPhone / iOS)
1. سایت را در **Safari** باز کنید
2. دکمه Share (🔗) را بزنید → **"Add to Home Screen"**
3. **توسعه‌دهندگان:** راهنمای [ios/README.md](./ios/README.md) را ببینید

---

## 🌟 Features

*   **Localized UI:** Full RTL support with Dari (Persian) and Pashto translations.
*   **Offline-First:** Works without internet connectivity (PWA).
*   **Performance:** Image compression and optimized loading for low-bandwidth networks.
*   **AI Integration:** Gemini-powered ad description generation.
*   **Advanced Search:** Filtering by 34 provinces, districts, price, and category.
*   **Mobile Apps:** Native Android (Capacitor) + iOS PWA support.

## 📊 Azure Migration Status

We have prepared a detailed readiness report for deploying to Microsoft Azure.
👉 **[Read the Migration Report](./MIGRATION_REPORT.md)**

Current Readiness:
*   **Frontend:** 🟢 Ready (100%) - Configured for Static Web Apps
*   **Backend:** 🟡 Mock Data (Ready for Demo)
*   **Database:** 🟡 In-Memory (Ready for Demo)

## 🚀 Getting Started

### Prerequisites

*   Node.js 18+
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/bazar-afghan.git
    cd bazar-afghan
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run development server:
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## ☁️ Deployment to Microsoft Azure

This project is configured for **Azure Static Web Apps**.

### Quick Deploy (Recommended)
Click the "Deploy to Azure" button above to automatically create a Static Web App resource linked to this repository.

### Option 1: Deploy via Azure CLI (Manual/Direct)

1.  **Install Azure CLI** and log in:
    ```bash
    az login
    ```

2.  **Create a Resource Group:**
    ```bash
    az group create --name BazarAfghanRG --location uaenorth
    ```

3.  **Create the Static Web App:**
    ```bash
    az staticwebapp create \
      --name bazarafghan-app \
      --resource-group BazarAfghanRG \
      --source . \
      --location uaenorth \
      --branch main \
      --login-with-github
    ```

### Configuration on Azure

Once deployed, go to the Azure Portal -> Static Web App -> **Configuration** -> **Application Settings** to set environment variables (Optional for Demo):

*   `REACT_APP_USE_MOCK_DATA`: Set to `true` (Default is true if API URL is missing).
*   `REACT_APP_API_URL`: The URL of your backend API (Leave empty for Mock).
*   `REACT_APP_API_KEY`: Your Gemini AI API Key (Required for AI features).

## 📂 Project Structure

*   `src/components`: Reusable UI components.
*   `src/pages`: Main application screens.
*   `src/services`: Logic for API calls, Auth, and Azure integration.
*   `public`: Static assets, Manifest, and Service Worker.
*   `staticwebapp.config.json`: Routing and security config for Azure.

## 📄 License

This project is licensed under the MIT License.
