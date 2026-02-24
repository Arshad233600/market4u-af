
export type Language = 'fa' | 'ps';

export const TRANSLATIONS = {
  fa: {
    // General
    app_name: 'Market4U',
    search_placeholder: 'جستجو در Market4U...',
    currency: '؋',
    lang_switch: 'پشتو',
    loading: 'در حال بارگذاری...',
    back: 'بازگشت',
    save: 'ذخیره',
    cancel: 'انصراف',
    delete: 'حذف',
    edit: 'ویرایش',
    close: 'بستن',
    
    // Navigation
    nav_home: 'خانه',
    nav_post: 'ثبت آگهی',
    nav_profile: 'پروفایل',
    nav_messages: 'پیام‌ها',
    login_btn: 'ورود / ثبت‌نام',
    
    // Home & Filters
    hero_title: 'آگهی‌های تازه',
    filter_btn: 'فیلترها',
    sort_label: 'مرتب‌سازی:',
    empty_state: 'هیچ محصولی یافت نشد.',
    filter_province: 'ولایت (استان)',
    filter_price: 'محدوده قیمت',
    filter_clear: 'پاک کردن',
    filter_apply: 'مشاهده نتایج',
    
    // Exchange Rates
    rates_title: 'نرخ اسعار',
    rates_usd: 'دالر آمریکا',
    rates_eur: 'یورو',
    rates_pkr: 'کلدار پاکستان',
    rates_irr: 'تومان ایران',
    rates_buy: 'خرید',
    rates_sell: 'فروش',

    // Categories
    cat_all: 'همه',
    cat_real_estate: 'املاک',
    cat_vehicles: 'وسایل نقلیه',
    cat_electronics: 'الکترونیک',
    cat_home_kitchen: 'خانه و آشپزخانه',
    cat_fashion: 'مد و پوشاک',
    cat_entertainment: 'رسانه و سرگرمی',
    cat_baby: 'کودک و نوزاد',
    cat_sports: 'ورزش و سفر',
    cat_business: 'کسب‌وکار و صنعت',
    cat_services: 'خدمات',
    cat_jobs: 'کاریابی و وظایف',
    cat_charity: 'خیرات و کمک',

    // Product Detail
    location: 'موقعیت',
    posted_date: 'تاریخ انتشار',
    seller_info: 'اطلاعات فروشنده',
    chat_btn: 'چت با فروشنده',
    call_btn: 'تماس / واتساپ',
    report_btn: 'گزارش آگهی',
    safety_tips: 'نکات ایمنی',
    related_ads: 'آگهی‌های مشابه',
    view_seller_profile: 'مشاهده تمام آگهی‌های این فروشنده',
    offer_btn: 'پیشنهاد قیمت',
    offer_modal_title: 'پیشنهاد قیمت خود را وارد کنید',
    offer_modal_desc: 'این پیشنهاد مستقیماً برای فروشنده ارسال می‌شود.',
    offer_input_label: 'قیمت پیشنهادی (افغانی)',
    offer_send_btn: 'ارسال پیشنهاد',
    offer_sent_msg: 'پیشنهاد قیمت من:',
    
    // Dashboard Sidebar
    dash_overview: 'پیشخوان',
    dash_my_ads: 'آگهی‌های من',
    dash_messages: 'پیام‌ها',
    dash_wallet: 'کیف پول',
    dash_settings: 'تنظیمات',
    dash_logout: 'خروج از حساب',

    // Post Ad
    post_title: 'ثبت آگهی جدید',
    post_title_edit: 'ویرایش آگهی',
    post_lbl_images: 'تصاویر',
    post_lbl_title: 'عنوان آگهی',
    post_lbl_category: 'دسته‌بندی',
    post_lbl_subcategory: 'زیرمجموعه',
    post_lbl_location: 'موقعیت',
    post_lbl_price: 'قیمت (افغانی)',
    post_lbl_salary: 'معاش/حقوق (افغانی)',
    post_lbl_desc: 'توضیحات',
    post_btn_ai: 'نوشتن با هوش مصنوعی',
    post_btn_submit: 'انتشار آگهی',
    post_btn_update: 'بروزرسانی آگهی',
    post_placeholder_title: 'مثلا: تویوتا کرولا ۲۰۲۰...',
    post_placeholder_desc: 'جزئیات کامل را بنویسید...',
    
    // Wallet
    wallet_balance: 'موجودی قابل برداشت',
    wallet_topup: 'افزایش موجودی',
    wallet_withdraw: 'برداشت وجه',
    wallet_transactions: 'تراکنش‌های اخیر',
    
    // Settings
    settings_profile: 'اطلاعات کاربری',
    settings_verification: 'احراز هویت',
    settings_security: 'امنیت',
    settings_notif: 'اعلان‌ها',
    settings_name: 'نام کامل',
    settings_phone: 'شماره تماس',
    settings_email: 'ایمیل',
    verify_status_verified: 'تایید شده',
    verify_status_pending: 'در حال بررسی',
    verify_upload_front: 'تصویر روی تذکره',
    verify_upload_back: 'تصویر پشت تذکره',
  },
  
  ps: {
    // General
    app_name: 'Market4U',
    search_placeholder: 'په Market4U کې لټون...',
    currency: '؋',
    lang_switch: 'دری',
    loading: 'د پورته کیدو په حال کې...',
    back: 'شاته',
    save: 'خوندی کول',
    cancel: 'لغوه',
    delete: 'حذف',
    edit: 'اصلاح',
    close: 'بندول',

    // Navigation
    nav_home: 'کور',
    nav_post: 'اعلان',
    nav_profile: 'پروفایل',
    nav_messages: 'پیغامونه',
    login_btn: 'ننوتل / ثبت نام',
    
    // Home & Filters
    hero_title: 'تازه اعلانونه',
    filter_btn: 'فلټرونه',
    sort_label: 'ترتیب:',
    empty_state: 'هیڅ محصول ونه موندل شو.',
    filter_province: 'ولایت',
    filter_price: 'د قیمت حد',
    filter_clear: 'پاکول',
    filter_apply: 'نتایج لیدل',

    // Exchange Rates
    rates_title: 'د اسعارو نرخ',
    rates_usd: 'امریکایی ډالر',
    rates_eur: 'یورو',
    rates_pkr: 'پاکستانی کلدار',
    rates_irr: 'ایرانی تومان',
    rates_buy: 'اخیستل',
    rates_sell: 'خرڅول',
    
    // Categories
    cat_all: 'ټول',
    cat_real_estate: 'املاک',
    cat_vehicles: 'وسایط',
    cat_electronics: 'برقی وسایل',
    cat_home_kitchen: 'کور او پخلنځی',
    cat_fashion: 'فیشن او جامې',
    cat_entertainment: 'رسنۍ او تفریح',
    cat_baby: 'ماشوم',
    cat_sports: 'ورزش او سفر',
    cat_business: 'کار او صنعت',
    cat_services: 'خدمتونه',
    cat_jobs: 'دندې او کاریابی',
    cat_charity: 'خیرات او مرسته',

    // Product Detail
    location: 'موقعیت',
    posted_date: 'د خپریدو نیټه',
    seller_info: 'د پلورونکي معلومات',
    chat_btn: 'خبرې کول',
    call_btn: 'زنګ / واټساپ',
    report_btn: 'راپور ورکول',
    safety_tips: 'امنیتي لارښوونې',
    related_ads: 'ورته اعلانونه',
    view_seller_profile: 'د دې پلورونکي ټول اعلانونه وګورئ',
    offer_btn: 'قیمت پیشنهاد',
    offer_modal_title: 'خپل وړاندیز شوی قیمت دننه کړئ',
    offer_modal_desc: 'دا وړاندیز به مستقیم پلورونکي ته واستول شي.',
    offer_input_label: 'وړاندیز شوی قیمت (افغانۍ)',
    offer_send_btn: 'وړاندیز لیږل',
    offer_sent_msg: 'زما وړاندیز شوی قیمت:',

    // Dashboard Sidebar
    dash_overview: 'ډشبورډ',
    dash_my_ads: 'زما اعلانونه',
    dash_messages: 'پیغامونه',
    dash_wallet: 'بټوه (کیف پول)',
    dash_settings: 'تنظیمات',
    dash_logout: 'وتل',

    // Post Ad
    post_title: 'نوی اعلان',
    post_title_edit: 'اعلان سمول',
    post_lbl_images: 'انځورونه',
    post_lbl_title: 'د اعلان سرلیک',
    post_lbl_category: 'تولګی (کټګوري)',
    post_lbl_subcategory: 'فرعی ټولګی',
    post_lbl_location: 'موقعیت',
    post_lbl_price: 'قیمت (افغانۍ)',
    post_lbl_salary: 'معاش/تنخوا (افغانۍ)',
    post_lbl_desc: 'توضیحات',
    post_btn_ai: 'د مصنوعي ځیرکتیا سره لیکل',
    post_btn_submit: 'اعلان خپرول',
    post_btn_update: 'اعلان تازه کول',
    post_placeholder_title: 'مثلا: کرولا موټر...',
    post_placeholder_desc: 'بشپړ توضیحات ولیکئ...',
    
    // Wallet
    wallet_balance: 'د ویستلو وړ پیسې',
    wallet_topup: 'پیسې اضافه کول',
    wallet_withdraw: 'پیسې ویستل',
    wallet_transactions: 'وروستۍ راکړې ورکړې',

    // Settings
    settings_profile: 'کارن معلومات',
    settings_verification: 'هو ویت تایید',
    settings_security: 'امنیت',
    settings_notif: 'خبرتیاوې',
    settings_name: 'بشپړ نوم',
    settings_phone: 'د اړیکې شمیره',
    settings_email: 'بریښنالیک',
    verify_status_verified: 'تایید شوی',
    verify_status_pending: 'تر کار لاندې',
    verify_upload_front: 'د تذکرې مخ',
    verify_upload_back: 'د تذکرې شا',
  }
};
