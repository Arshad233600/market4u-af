
import { Category, Product, AdStatus } from './types';

// Full List of 34 Provinces with Coordinates
export const PROVINCES = [
  { id: 'all', name: 'کل افغانستان', lat: 33.9391, lng: 67.7100 },
  { id: 'kabul', name: 'کابل', lat: 34.5553, lng: 69.2075 },
  { id: 'herat', name: 'هرات', lat: 34.3529, lng: 62.2040 },
  { id: 'nangarhar', name: 'ننگرهار', lat: 34.4265, lng: 70.4515 },
  { id: 'balkh', name: 'بلخ', lat: 36.7119, lng: 67.1107 },
  { id: 'kandahar', name: 'قندهار', lat: 31.6288, lng: 65.7371 },
  { id: 'badakhshan', name: 'بدخشان', lat: 36.7348, lng: 70.8120 },
  { id: 'badghis', name: 'بادغیس', lat: 34.8716, lng: 63.3820 },
  { id: 'baghlan', name: 'بغلان', lat: 36.1307, lng: 68.7073 },
  { id: 'bamyan', name: 'بامیان', lat: 34.8100, lng: 67.8212 },
  { id: 'daykundi', name: 'دایکندی', lat: 33.6692, lng: 66.0463 },
  { id: 'farah', name: 'فراه', lat: 32.3745, lng: 62.1164 },
  { id: 'faryab', name: 'فاریاب', lat: 35.9189, lng: 64.7834 },
  { id: 'ghazni', name: 'غزنی', lat: 33.5451, lng: 68.4174 },
  { id: 'ghor', name: 'غور', lat: 34.0048, lng: 64.5332 },
  { id: 'helmand', name: 'هلمند', lat: 31.3636, lng: 63.9586 },
  { id: 'jowzjan', name: 'جوزجان', lat: 36.8970, lng: 65.7656 },
  { id: 'kapisa', name: 'کاپیسا', lat: 35.0227, lng: 69.5663 },
  { id: 'khost', name: 'خوست', lat: 33.3338, lng: 69.9372 },
  { id: 'kunar', name: 'کنر', lat: 34.8466, lng: 71.0973 },
  { id: 'kunduz', name: 'کندز', lat: 36.7286, lng: 68.8681 },
  { id: 'laghman', name: 'لغمان', lat: 34.6898, lng: 70.1456 },
  { id: 'logar', name: 'لوگر', lat: 34.0146, lng: 69.1924 },
  { id: 'nimroz', name: 'نیمروز', lat: 31.0261, lng: 62.4504 },
  { id: 'nuristan', name: 'نورستان', lat: 35.3262, lng: 70.9090 },
  { id: 'paktia', name: 'پکتیا', lat: 33.6063, lng: 69.3938 },
  { id: 'paktika', name: 'پکتیکا', lat: 32.3276, lng: 68.6186 },
  { id: 'panjshir', name: 'پنجشیر', lat: 35.4353, lng: 69.7226 },
  { id: 'parwan', name: 'پروان', lat: 34.9631, lng: 69.2557 },
  { id: 'samangan', name: 'سمنگان', lat: 36.2577, lng: 68.0182 },
  { id: 'sar_e_pol', name: 'سرپل', lat: 35.7110, lng: 65.9328 },
  { id: 'takhar', name: 'تخار', lat: 36.6669, lng: 69.4756 },
  { id: 'uruzgan', name: 'ارزگان', lat: 32.9271, lng: 66.1415 },
  { id: 'wardak', name: 'میدان وردک', lat: 34.3513, lng: 68.2385 },
  { id: 'zabul', name: 'زابل', lat: 32.1919, lng: 67.1811 },
];

// Comprehensive Districts Mapping (Names) for ALL 34 Provinces
export const DISTRICTS: Record<string, string[]> = {
    // 1. Kabul
    'کابل': ['شهر کابل', 'استالف', 'بگرامی', 'پغمان', 'چهارآسیاب', 'خاک جبار', 'ده سبز', 'سروبی', 'شکردره', 'فرزه', 'قره‌باغ', 'کلکان', 'گلدره', 'موسهی', 'میربچه کوت'],
    
    // 2. Herat
    'هرات': ['شهر هرات', 'انجیل', 'اوبه', 'پشتون زرغون', 'چشت شریف', 'زنده‌جان', 'غوریان', 'فارسی', 'کرخ', 'کشک رباط سنگی', 'کشک کهنه', 'کهسان', 'گذره', 'گلران', 'شیندند', 'ادرسکن'],

    // 3. Nangarhar
    'ننگرهار': ['شهر جلال‌آباد', 'آچین', 'بتی‌کوت', 'بهسود', 'پچیر و آگام', 'چپرهار', 'حصاره', 'دره نور', 'ده بالا', 'رودات', 'سرخ‌رود', 'شیرزاد', 'شینوار', 'کوت', 'کوزکنر', 'گوشته', 'لعل‌پور', 'مهمند دره', 'نازیان', 'خوگیانی', 'کامه‌', 'بتی‌کوت'],

    // 4. Balkh
    'بلخ': ['شهر مزار شریف', 'بلخ', 'چاربولک', 'چارکنت', 'چمتال', 'خلم', 'دولت‌آباد', 'دهدادی', 'زاری', 'شور تپه', 'شولگره', 'کشنده', 'کلدار', 'مارمل', 'نهر شاهی', 'شورتپه'],

    // 5. Kandahar
    'قندهار': ['شهر قندهار', 'ارغستان', 'ارغنداب', 'پنجوایی', 'خاکریز', 'دامان', 'ریگ', 'ژری', 'شاه ولی کوت', 'شورابک', 'غورک', 'معروف', 'میانشین', 'میوند', 'نیش', 'سپین بولدک'],

    // 6. Badakhshan
    'بدخشان': ['شهر فیض‌آباد', 'ارگو', 'ارغنج‌خواه', 'اشکاشم', 'بهارک', 'تگاب', 'تیشکان', 'جرم', 'خاش', 'خواهان', 'درایم', 'راغستان', 'زیباک', 'شغنان', 'شکی', 'شهدا', 'شهر بزرگ', 'کوف آب', 'کوهستان', 'گرزیوان', 'نسی', 'وردوج', 'واخان', 'یمگان', 'یاوان', 'مایمی'],

    // 7. Badghis
    'بادغیس': ['قلعه‌نو', 'آب‌کمری', 'جوند', 'غورماچ', 'قادس', 'مقر', 'بالامرغاب'],

    // 8. Baghlan
    'بغلان': ['پل خمری', 'آندراب', 'بغلان جدید', 'برکه', 'تاله و برفک', 'جلگه', 'خنجان', 'خوست و فرنگ', 'دهانه غوری', 'ده‌صلاح', 'دوشی', 'فرنگ و غارو', 'گذرگاه نور', 'نهرین', 'پلحصار'],

    // 9. Bamyan
    'بامیان': ['بامیان', 'کهمرد', 'پنجاب', 'سیغان', 'شیبر', 'ورس', 'یکاولنگ', 'یکاولنگ نمبر ۲'],

    // 10. Daykundi
    'دایکندی': ['نیلی', 'اشترلی', 'خدیر', 'سنگ‌تخت', 'شهرستان', 'کجران', 'گیتی', 'میرامور', 'پاتو'],

    // 11. Farah
    'فراه': ['فراه', 'انار دره', 'بالا بلوک', 'بکواه', 'پرچمن', 'پشت‌رود', 'خاک سفید', 'شیب‌کوه', 'فراه رود', 'قلعه‌کاه', 'گلستان', 'لاشی و جوین'],

    // 12. Faryab
    'فاریاب': ['میمنه', 'المار', 'اندخوی', 'بلچراغ', 'پشتون‌کوت', 'خان چارباغ', 'دولت‌آباد', 'خواجه سبزپوش', 'شیرین تگاب', 'قرغان', 'قرم‌قل', 'قیصار', 'کوهستان', 'گرزیوان'],

    // 13. Ghazni
    'غزنی': ['غزنی', 'آب‌بند', 'اجرستان', 'اندڑ', 'بهرام شهید', 'جاغوری', 'خوگیانی', 'خواجه عمری', 'ده‌یک', 'رشیدان', 'زنخان', 'گیرو', 'قره‌باغ', 'مقر', 'مالستان', 'ناور', 'ناوه', 'واغظ'],

    // 14. Ghor
    'غور': ['فیروزکوه', 'پسابند', 'تولک', 'تیوره', 'دولت‌یار', 'دولینه', 'چارصد خانه', 'لعل و سرجنگل', 'ساغر', 'شهرک'],

    // 15. Helmand
    'هلمند': ['لشکرگاه', 'باغران', 'دیشو', 'ریگ‌خان‌نشین', 'سنگین', 'کجکی', 'گرم‌سیر', 'موسی‌قلعه', 'نادعلی', 'ناوه بارکزایی', 'نوزاد', 'نهر سراج', 'واشیر', 'مارجه'],

    // 16. Jowzjan
    'جوزجان': ['شبرغان', 'آقچه', 'خانقاه', 'خم‌آب', 'خواجه دوکوه', 'درزاب', 'فیض‌آباد', 'قرقین', 'قوش‌تپه', 'مردیان', 'منگجیک'],

    // 17. Kapisa
    'کاپیسا': ['محمود راقی', 'آلاسای', 'تگاب', 'حصه اول کوهستان', 'حصه دوم کوهستان', 'کوه‌بند', 'نجراب'],

    // 18. Khost
    'خوست': ['خوست', 'باک', 'تنی', 'تیرزائی', 'جاجی میدان', 'سپیره', 'شمل', 'صبرری (یعقوبی)', 'قلندر', 'گربز', 'مندوزی', 'موسی‌خیل', 'نادرشاه کوت'],

    // 19. Kunar
    'کنر': ['اسعدآباد', 'برکنر', 'خاص کنر', 'دانگام', 'دره پیچ', 'چپه‌دره', 'چوکی', 'سرکانی', 'شیگل و شلتن', 'غازی‌آباد', 'مروره', 'ناری', 'نرنگ', 'نورگل', 'وټه‌پور'],

    // 20. Kunduz
    'کندز': ['کندز', 'امام صاحب', 'چهاردره', 'خان‌آباد', 'دشت ارچی', 'علی‌آباد', 'قلعه‌زال'],

    // 21. Laghman
    'لغمان': ['مهترلام', 'الینگار', 'الیشنگ', 'دولت‌شاه', 'قرغه‌ای', 'بادپش'],

    // 22. Logar
    'لوگر': ['پل علم', 'ازره', 'برکی برک', 'چرخ', 'خروار', 'خوشی', 'محمدآغه'],

    // 23. Nimroz
    'نیمروز': ['زرنج', 'چهاربرجک', 'خاش‌رود', 'دل‌آرام', 'کنگ'],

    // 24. Nuristan
    'نورستان': ['پارون', 'برگ متال', 'دوآب', 'کامدیش', 'مندول', 'نورگرام', 'واما', 'وایگل'],

    // 25. Paktia
    'پکتیا': ['گردیز', 'احمدآباد', 'جانی‌خیل', 'چمکنی', 'دند پتان', 'زدران (وڅه)', 'زرمت', 'سیدکرم', 'شواک', 'علی‌خیل (جاجی)', 'لجه احمدخیل', 'لجه منگل', 'میرزکه'],

    // 26. Paktika
    'پکتیکا': ['شرنه', 'ارگون', 'اومنه', 'برمل', 'تروو', 'جانی‌خیل', 'دیله و خوشامند', 'زرغون‌شهر', 'زیروک', 'سرروضه', 'سروبی', 'گومل', 'گیان', 'متاخان', 'نکه', 'وازه‌خواه', 'ور ممی', 'یحیی‌خیل', 'یوسف‌خیل'],

    // 27. Panjshir
    'پنجشیر': ['بازارک', 'آبشار', 'انابه', 'پریان', 'خهنچ', 'دره', 'روخه', 'شتل'],

    // 28. Parwan
    'پروان': ['چاریکار', 'بگرام', 'جبل‌سراج', 'سالنگ', 'سیدخیل', 'شیخ‌علی', 'شنواری', 'غوربند', 'کوه صافی', 'سرخ پارسا'],

    // 29. Samangan
    'سمنگان': ['ایبک', 'حضرت سلطان', 'خرم و سارباغ', 'دره‌صوف بالا', 'دره‌صوف پایین', 'روی دوآب', 'فیروزنخچیر'],

    // 30. Sar-e Pol
    'سرپل': ['سرپل', 'بلخاب', 'سانچارک', 'سوزمه‌قلعه', 'صیاد', 'کوهستانات', 'گوسفندی'],

    // 31. Takhar
    'تخار': ['تالقان', 'اشکمش', 'بنگی', 'بهارک', 'چال', 'چاه‌آب', 'خواجه بهاءالدین', 'خواجه غار', 'درقد', 'دشت قلعه', 'روستاق', 'فرخار', 'کلفگان', 'نمک‌آب', 'ورسج', 'هزارسموچ', 'ینگی‌قلعه'],

    // 32. Uruzgan
    'ارزگان': ['ترین‌کوت', 'چوره', 'خاص‌ارزگان', 'ده‌راوود', 'شهید حساس', 'گیزاب'],

    // 33. Wardak
    'میدان وردک': ['میدان‌شهر', 'بهسود (مرکز)', 'حصه اول بهسود', 'جغتو', 'چک وردک', 'جلریز', 'دایمیرداد', 'سیدآباد', 'نرخ'],

    // 34. Zabul
    'زابل': ['قلات', 'اتغر', 'ارغنداب', 'ترنک و جلدک', 'دایچوپان', 'شاه‌جوی', 'شمولزایی', 'شینکی', 'کاکر', 'میزان', 'نوبهار'],
};

// Major District Coordinates (Helper for Map Positioning)
export const DISTRICT_LOCATIONS: Record<string, { lat: number, lng: number }> = {
    // --- Kabul ---
    'شهر کابل': { lat: 34.5553, lng: 69.2075 },
    'استالف': { lat: 34.8327, lng: 69.0494 },
    'بگرامی': { lat: 34.4947, lng: 69.2744 },
    'پغمان': { lat: 34.5879, lng: 68.9509 },
    'چهارآسیاب': { lat: 34.4286, lng: 69.1706 },
    'خاک جبار': { lat: 34.4400, lng: 69.4500 }, // Approx
    'ده سبز': { lat: 34.6212, lng: 69.3175 },
    'سروبی': { lat: 34.5898, lng: 69.7719 },
    'شکردره': { lat: 34.6933, lng: 69.0305 },
    'فرزه': { lat: 34.7369, lng: 69.0560 },
    'قره‌باغ': { lat: 34.8465, lng: 69.1729 },
    'کلکان': { lat: 34.7865, lng: 69.1558 },
    'گلدره': { lat: 34.7554, lng: 69.0183 },
    'موسهی': { lat: 34.3989, lng: 69.1833 },
    'میربچه کوت': { lat: 34.7303, lng: 69.1171 },

    // --- Herat ---
    'شهر هرات': { lat: 34.3529, lng: 62.2040 },
    'انجیل': { lat: 34.3056, lng: 62.2515 },
    'اوبه': { lat: 34.3685, lng: 63.1672 },
    'پشتون زرغون': { lat: 34.2541, lng: 62.8360 },
    'چشت شریف': { lat: 34.3524, lng: 63.7431 },
    'زنده‌جان': { lat: 34.3424, lng: 61.7479 },
    'غوریان': { lat: 34.3431, lng: 61.4789 },
    'فارسی': { lat: 33.7225, lng: 63.0292 },
    'کرخ': { lat: 34.5369, lng: 62.6186 },
    'کشک رباط سنگی': { lat: 34.9213, lng: 62.2227 },
    'کشک کهنه': { lat: 34.8427, lng: 62.5317 },
    'کهسان': { lat: 34.5802, lng: 61.1895 },
    'گذره': { lat: 34.2185, lng: 62.2223 },
    'گلران': { lat: 35.0933, lng: 61.6496 },
    'شیندند': { lat: 33.3039, lng: 62.1474 },

    // --- Nangarhar ---
    'شهر جلال‌آباد': { lat: 34.4265, lng: 70.4515 },
    'آچین': { lat: 34.1258, lng: 70.7078 },
    'بتی‌کوت': { lat: 34.2980, lng: 70.7850 },
    'بهسود': { lat: 34.4608, lng: 70.4908 },
    'پچیر و آگام': { lat: 34.1353, lng: 70.3667 },
    'چپرهار': { lat: 34.3411, lng: 70.3956 },
    'حصاره': { lat: 34.1500, lng: 69.9500 }, // Approx
    'دره نور': { lat: 34.5847, lng: 70.5906 },
    'ده بالا': { lat: 34.1333, lng: 70.5500 },
    'رودات': { lat: 34.3317, lng: 70.6272 },
    'سرخ‌رود': { lat: 34.4536, lng: 70.2975 },
    'شیرزاد': { lat: 34.2000, lng: 69.9667 },
    'شینوار': { lat: 34.1806, lng: 70.8358 },
    'کوت': { lat: 34.2250, lng: 70.6083 },
    'کوزکنر': { lat: 34.5769, lng: 70.6242 },
    'گوشته': { lat: 34.5375, lng: 70.7600 },
    'لعل‌پور': { lat: 34.3683, lng: 71.0503 },
    'مهمند دره': { lat: 34.3208, lng: 70.9208 },
    'نازیان': { lat: 34.1167, lng: 70.8167 },

    // --- Balkh ---
    'شهر مزار شریف': { lat: 36.7119, lng: 67.1107 },
    'بلخ': { lat: 36.7564, lng: 66.8972 },
    'چاربولک': { lat: 36.8167, lng: 66.5833 },
    'چارکنت': { lat: 36.4381, lng: 67.2417 },
    'چمتال': { lat: 36.6500, lng: 66.8167 },
    'خلم': { lat: 36.6975, lng: 67.6983 },
    'دولت‌آباد': { lat: 37.0425, lng: 66.8042 },
    'دهدادی': { lat: 36.6667, lng: 66.9833 },
    'زاری': { lat: 36.1417, lng: 66.8250 },
    'شور تپه': { lat: 37.3333, lng: 66.8333 },
    'شولگره': { lat: 36.3500, lng: 67.0333 },
    'کشنده': { lat: 36.1500, lng: 66.5500 },
    'کلدار': { lat: 37.2167, lng: 67.3333 },
    'مارمل': { lat: 36.5333, lng: 67.5333 },
    'نهر شاهی': { lat: 36.7500, lng: 67.2000 },

    // --- Kandahar ---
    'شهر قندهار': { lat: 31.6288, lng: 65.7371 },
    'ارغستان': { lat: 31.5667, lng: 66.5000 },
    'ارغنداب': { lat: 31.6575, lng: 65.6481 },
    'پنجوایی': { lat: 31.5458, lng: 65.3783 },
    'خاکریز': { lat: 31.9881, lng: 65.4950 },
    'دامان': { lat: 31.5000, lng: 65.9000 },
    'ریگ': { lat: 30.6500, lng: 65.8500 }, // Approx Region
    'ژری': { lat: 31.5833, lng: 65.3333 },
    'شاه ولی کوت': { lat: 32.0667, lng: 66.0000 },
    'شورابک': { lat: 30.6833, lng: 66.0000 },
    'غورک': { lat: 31.9292, lng: 65.1111 },
    'معروف': { lat: 31.6833, lng: 67.0500 },
    'میانشین': { lat: 32.1833, lng: 65.8000 },
    'میوند': { lat: 31.6833, lng: 65.0833 },
    'نیش': { lat: 32.1667, lng: 65.6500 },
    'سپین بولدک': { lat: 31.009, lng: 66.398 },

    // --- Badakhshan ---
    'شهر فیض‌آباد': { lat: 37.1168, lng: 70.5800 },
    'ارگو': { lat: 37.1000, lng: 70.3833 },
    'ارغنج‌خواه': { lat: 37.3000, lng: 70.6333 },
    'اشکاشم': { lat: 36.6833, lng: 71.5333 },
    'بهارک': { lat: 37.0000, lng: 70.9167 },
    'تگاب': { lat: 36.5667, lng: 70.2167 },
    'تیشکان': { lat: 36.8333, lng: 70.1667 },
    'جرم': { lat: 36.8667, lng: 70.8333 },
    'خاش': { lat: 36.9333, lng: 70.7667 },
    'خواهان': { lat: 37.8833, lng: 70.6667 },
    'درایم': { lat: 36.9500, lng: 70.3667 },
    'راغستان': { lat: 37.6667, lng: 70.6500 },
    'زیباک': { lat: 36.5333, lng: 71.3333 },
    'شغنان': { lat: 37.5667, lng: 71.5000 },
    'شکی': { lat: 38.0000, lng: 70.7833 },
    'شهدا': { lat: 37.2333, lng: 70.8500 },
    'شهر بزرگ': { lat: 37.4500, lng: 70.3833 },
    'کوف آب': { lat: 37.9667, lng: 70.5833 },
    'کوهستان': { lat: 37.4167, lng: 70.6667 }, // Ambiguous, approx
    'گرزیوان': { lat: 36.8667, lng: 70.4500 }, // Approx
    'نسی': { lat: 38.4500, lng: 70.8000 }, // Darwaz
    'وردوج': { lat: 36.7500, lng: 71.1833 },
    'واخان': { lat: 37.0500, lng: 73.1000 }, // Deep Wakhan
    'یمگان': { lat: 36.5333, lng: 70.8667 },
    'یاوان': { lat: 37.5000, lng: 70.4000 },
};

export const SORT_OPTIONS = [
  { id: 'newest', name: 'جدیدترین' },
  { id: 'price_low', name: 'ارزان‌ترین' },
  { id: 'price_high', name: 'گران‌ترین' },
  { id: 'most_viewed', name: 'پربازدیدترین' },
];

// --- 10 MAIN CATEGORIES WITH DETAILED ATTRIBUTES (FORM FIELDS) ---
export const CATEGORIES: Category[] = [
  { id: 'all', name: 'همه', translationKey: 'cat_all', icon: 'MoreHorizontal' },
  
  // 1. Real Estate (املاک)
  { 
    id: 'real_estate', 
    name: 'املاک',
    translationKey: 'cat_real_estate',
    icon: 'Home',
    subcategories: [
      { id: 'apartment', name: 'آپارتمان و فلت' },
      { id: 'house_villa', name: 'خانه و حویلی' },
      { id: 'land', name: 'زمین و نمره' },
      { id: 'commercial', name: 'دکان و دفتر تجاری' },
      { id: 'rental', name: 'کرایی و گروی' }
    ],
    filterConfig: [
        { key: 'listing_type', label: 'نوع معامله', type: 'select', options: ['فروشی', 'کرایی', 'گروی'] },
        { key: 'area', label: 'مساحت (متر/بسوه)', type: 'range', min: 0, max: 5000, unit: 'متر' },
        { key: 'rooms', label: 'تعداد اتاق', type: 'select', options: ['۱', '۲', '۳', '۴', '۵', '۶+'] },
        { key: 'bathrooms', label: 'تعداد تشناب', type: 'select', options: ['۱', '۲', '۳', '۴+'] },
        { key: 'floor', label: 'منزل (طبقه)', type: 'select', options: ['همکف', '۱', '۲', '۳', '۴', '۵+'] },
        { key: 'parking', label: 'پارکینگ موتر', type: 'select', options: ['دارد', 'ندارد'] },
        { key: 'elevator', label: 'آسانسور (لفت)', type: 'select', options: ['دارد', 'ندارد'] },
        { key: 'document_type', label: 'نوع سند', type: 'select', options: ['شرعی', 'عرفی', 'قولنامه‌ای'] }
    ]
  },

  // 2. Vehicles (وسایل نقلیه)
  { 
    id: 'vehicles', 
    name: 'وسایل نقلیه', 
    translationKey: 'cat_vehicles',
    icon: 'Car',
    subcategories: [
      { id: 'cars', name: 'موتر (خودرو)' },
      { id: 'motorcycles', name: 'موتورسایکل' },
      { id: 'bicycles', name: 'بایسکل' },
      { id: 'heavy_vehicles', name: 'موترهای سنگین و باربری' },
      { id: 'parts', name: 'پرِزه و لوازم یدکی' }
    ],
    filterConfig: [
       { key: 'brand', label: 'برند', type: 'select', options: ['تویوتا', 'مرسدس بنز', 'هوندا', 'سوزوکی', 'هیوندای', 'نیسان', 'فورد', 'شورلت', 'لکسوس', 'بی‌ام‌و'] },
       { key: 'model_year', label: 'سال ساخت', type: 'range', min: 1990, max: 2025 },
       { key: 'mileage', label: 'کارکرد (کیلومتر)', type: 'range', min: 0, max: 500000 },
       { key: 'transmission', label: 'گیربکس', type: 'select', options: ['اتومات', 'دستی (گیر)'] },
       { key: 'fuel', label: 'نوع سوخت', type: 'select', options: ['پترول', 'دیزل', 'گاز', 'هیبرید', 'برقی'] },
       { key: 'color', label: 'رنگ', type: 'select', options: ['سفید', 'سیاه', 'نقره‌ای', 'خاکستری', 'آبی', 'سرخ', 'طلایی'] },
       { key: 'plate_type', label: 'نوع پلیت', type: 'select', options: ['کابل', 'ولایتی', 'موقت', 'منفی', 'بدون پلیت (یک‌کلید)'] },
       { key: 'condition', label: 'وضعیت بدنه', type: 'select', options: ['بدون رنگ', 'یک لکه رنگ', 'رنگ دار', 'تصادفی'] }
    ]
  },

  // 3. Electronics (الکترونیک)
  { 
    id: 'electronics', 
    name: 'الکترونیک', 
    translationKey: 'cat_electronics',
    icon: 'Smartphone',
    subcategories: [
      { id: 'mobile', name: 'موبایل و تبلت' },
      { id: 'computer', name: 'لپ‌تاپ و کامپیوتر' },
      { id: 'accessories', name: 'لوازم جانبی موبایل' },
      { id: 'gaming', name: 'کنسول بازی (PlayStation/Xbox)' },
      { id: 'tv_audio', name: 'تلویزیون و سیستم صوتی' }
    ],
    filterConfig: [
        { key: 'brand', label: 'برند', type: 'select', options: ['اپل (Apple)', 'سامسونگ (Samsung)', 'شیائومی (Xiaomi)', 'هواوی', 'سونی', 'دل (Dell)', 'اچ‌پی (HP)', 'لنوو'] },
        { key: 'storage', label: 'حافظه داخلی', type: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
        { key: 'ram', label: 'رم (RAM)', type: 'select', options: ['4GB', '8GB', '16GB', '32GB'] },
        { key: 'sim_count', label: 'تعداد سیم‌کارت', type: 'select', options: ['تک سیم', 'دو سیم'] },
        { key: 'battery_health', label: 'سلامت باتری (درصد)', type: 'range', min: 70, max: 100 },
        { key: 'condition', label: 'وضعیت ظاهری', type: 'select', options: ['نو (آکبند)', 'در حد نو', 'کارکرده', 'نیاز به تعمیر'] }
    ]
  },

  // 4. Home & Kitchen (خانه و آشپزخانه)
  { 
    id: 'home_kitchen', 
    name: 'خانه و آشپزخانه', 
    translationKey: 'cat_home_kitchen',
    icon: 'Armchair',
    subcategories: [
      { id: 'furniture', name: 'مبلمان و کوچ' },
      { id: 'appliances', name: 'لوازم برقی (یخچال/لباسشویی)' },
      { id: 'carpets', name: 'فرش، قالین و گلیم' },
      { id: 'decor', name: 'دکوراسیون و پرده' },
      { id: 'kitchenware', name: 'ظروف و لوازم آشپزخانه' }
    ],
    filterConfig: [
        { key: 'item_condition', label: 'وضعیت کالا', type: 'select', options: ['نو', 'دست دوم (سالم)', 'دست دوم (نیاز به تعمیر)'] },
        { key: 'material', label: 'جنس بدنه', type: 'select', options: ['چوب', 'فلز', 'ام‌دی‌اف', 'پلاستیک', 'شیشه'] },
        { key: 'color', label: 'رنگ', type: 'select', options: ['قهوه‌ای', 'سفید', 'مشکی', 'کرم', 'طوسی', 'رنگارنگ'] }
    ]
  },

  // 5. Fashion (مد و پوشاک)
  { 
    id: 'fashion', 
    name: 'مد و پوشاک', 
    translationKey: 'cat_fashion',
    icon: 'Shirt',
    subcategories: [
      { id: 'men_clothing', name: 'لباس مردانه' },
      { id: 'women_clothing', name: 'لباس زنانه' },
      { id: 'kids_clothing', name: 'لباس کودک' },
      { id: 'shoes', name: 'کیف و کفش' },
      { id: 'jewelry', name: 'ساعت و جواهرات' },
      { id: 'cosmetics', name: 'آرایشی و بهداشتی' }
    ],
    filterConfig: [
        { key: 'size', label: 'سایز', type: 'select', options: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'] },
        { key: 'condition', label: 'وضعیت', type: 'select', options: ['نو (تگ دار)', 'در حد نو', 'کارکرده'] },
        { key: 'origin', label: 'اصالت برند', type: 'select', options: ['اوریجینال', 'های‌کپی', 'تولید داخلی'] }
    ]
  },

  // 6. Media & Entertainment (فرهنگ و سرگرمی)
  { 
    id: 'entertainment', 
    name: 'فرهنگ و سرگرمی', 
    translationKey: 'cat_entertainment',
    icon: 'Clapperboard',
    subcategories: [
        { id: 'books', name: 'کتاب و مجله' },
        { id: 'musical_instruments', name: 'آلات موسیقی' },
        { id: 'gaming_discs', name: 'بازی‌های ویدیویی (دیسک/اکانت)' },
        { id: 'handicrafts', name: 'صنایع دستی و هنری' },
        { id: 'collect', name: 'کلکسیون و عتیقه' },
        { id: 'tickets', name: 'بلیط و تور' }
    ],
    filterConfig: [
        { key: 'condition', label: 'وضعیت', type: 'select', options: ['نو', 'دست دوم', 'کلکسیونی'] },
        { key: 'language', label: 'زبان', type: 'select', options: ['دری', 'پشتو', 'انگلیسی', 'عربی', 'سایر'] },
        { key: 'genre', label: 'ژانر/دسته', type: 'select', options: ['آموزشی', 'رمان', 'تاریخی', 'مذهبی', 'هنری', 'تکنالوژی'] }
    ]
  },

  // 7. Baby & Kids (کودک و نوزاد)
  { 
    id: 'baby', 
    name: 'کودک و نوزاد', 
    translationKey: 'cat_baby',
    icon: 'Baby',
    subcategories: [
        { id: 'toys', name: 'اسباب‌بازی' },
        { id: 'strollers', name: 'کالسکه و لوازم حمل' },
        { id: 'kids_furniture', name: 'تخت و کمد کودک' },
        { id: 'baby_clothing', name: 'لباس نوزادی' },
        { id: 'school_supplies', name: 'لوازم مکتب' }
    ],
    filterConfig: [
        { key: 'condition', label: 'وضعیت', type: 'select', options: ['نو', 'در حد نو', 'کارکرده'] },
        { key: 'age_group', label: 'رده سنی', type: 'select', options: ['نوزاد (۰-۲)', 'کودک (۲-۵)', 'خردسال (۵-۱۰)', 'نوجوان'] },
        { key: 'gender', label: 'جنسیت', type: 'select', options: ['پسرانه', 'دخترانه', 'اسپرت (مشترک)'] },
        { key: 'brand', label: 'برند', type: 'select', options: ['Mothercare', 'Chicco', 'Baby Johnson', 'متفرقه'] }
    ]
  },

  // 8. Sports & Outdoors (ورزش و سفر)
  { 
    id: 'sports', 
    name: 'ورزش و سفر', 
    translationKey: 'cat_sports',
    icon: 'Tent',
    subcategories: [
        { id: 'fitness', name: 'لوازم بدنسازی' },
        { id: 'camping', name: 'کوهنوردی و کمپینگ' },
        { id: 'bicycles_pro', name: 'دوچرخه حرفه‌ای' },
        { id: 'ball_sports', name: 'توپ و تور (فوتبال/والیبال)' },
        { id: 'winter_sports', name: 'ورزش‌های زمستانی' }
    ],
    filterConfig: [
        { key: 'condition', label: 'وضعیت', type: 'select', options: ['نو', 'دست دوم'] },
        { key: 'sport_type', label: 'رشته ورزشی', type: 'select', options: ['فوتبال', 'کریکت', 'والیبال', 'بدنسازی', 'کوهنوردی', 'شنا', 'رزمی'] },
        { key: 'brand', label: 'برند', type: 'select', options: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Decathlon', 'متفرقه'] }
    ]
  },

  // 9. Business & Industry (کسب‌وکار و صنعت)
  { 
    id: 'business', 
    name: 'کسب‌وکار و صنعت', 
    translationKey: 'cat_business',
    icon: 'Factory',
    subcategories: [
        { id: 'machinery', name: 'ماشین‌آلات صنعتی' },
        { id: 'shop_equipment', name: 'تجهیزات فروشگاهی و رستوران' },
        { id: 'agriculture', name: 'لوازم کشاورزی و زراعت' },
        { id: 'office_supplies', name: 'لوازم اداری و دفتری' },
        { id: 'wholesale', name: 'عمده‌فروشی' }
    ],
    filterConfig: [
        { key: 'condition', label: 'وضعیت', type: 'select', options: ['نو', 'کارکرده (سالم)', 'نیاز به تعمیر'] },
        { key: 'industry_type', label: 'حوزه فعالیت', type: 'select', options: ['کشاورزی', 'ساختمانی', 'پزشکی', 'نساجی', 'مواد غذایی', 'خدماتی'] },
        { key: 'power_source', label: 'منبع تغذیه', type: 'select', options: ['برقی', 'دستی', 'دیزلی/بنزینی', 'سولار'] }
    ]
  },

  // 10. Services (خدمات)
  { 
    id: 'services', 
    name: 'خدمات', 
    translationKey: 'cat_services',
    icon: 'Wrench',
    subcategories: [
        { id: 'education', name: 'آموزش و تدریس' },
        { id: 'technical', name: 'پیشه و مهارت فنی' },
        { id: 'transport', name: 'حمل و نقل و باربری' },
        { id: 'beauty', name: 'آرایشگری و زیبایی' },
        { id: 'cleaning', name: 'نظافت و قالین‌شویی' },
        { id: 'computer_services', name: 'خدمات کامپیوتری و موبایل' }
    ],
    filterConfig: [
        { key: 'service_location', label: 'محل ارائه خدمت', type: 'select', options: ['در محل مشتری', 'در محل ارائه‌دهنده', 'آنلاین/مجازی'] },
        { key: 'experience', label: 'سابقه کار', type: 'select', options: ['کمتر از ۱ سال', '۱ تا ۵ سال', 'بیش از ۵ سال', 'شرکت معتبر'] },
        { key: 'pricing_model', label: 'شیوه قیمت‌گذاری', type: 'select', options: ['توافقی', 'ساعتی', 'پروژه‌ای (ثابت)'] }
    ]
  }
];

// Mock data for Exchange Rates (Sarafi)
export const EXCHANGE_RATES = [
    { currency: 'USD', name: 'Dolar', buy: 70.50, sell: 70.60, flag: '🇺🇸', trend: 'up' },
    { currency: 'EUR', name: 'Euro', buy: 76.20, sell: 76.40, flag: '🇪🇺', trend: 'down' },
    { currency: 'PKR', name: 'Kaldar', buy: 0.25, sell: 0.26, flag: '🇵🇰', trend: 'stable' },
    { currency: 'IRR', name: 'Toman', buy: 0.0012, sell: 0.0013, flag: '🇮🇷', trend: 'stable' },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    userId: 'user_mock_1',
    title: 'تویوتا کرولا مدل ۲۰۰۵',
    price: 350000,
    currency: 'AFN',
    location: 'کابل - شهر نو',
    imageUrl: 'https://picsum.photos/400/300?random=1',
    category: 'vehicles',
    subCategory: 'cars',
    description: 'تویوتا کرولا بسیار تمیز، رنگ سفید، پلیت کابل. موتور و گیربکس ضمانتی.',
    sellerName: 'احمد ضیا',
    postedDate: '۲ ساعت پیش',
    isPromoted: true,
    status: AdStatus.ACTIVE,
    views: 1250,
    dynamicFields: {
        'brand': 'تویوتا',
        'model_year': 2005,
        'fuel': 'پترول',
        'mileage': 120000
    }
  },
  {
    id: '2',
    userId: 'user_mock_2',
    title: 'آیفون ۱۳ پرو مکس',
    price: 85000,
    currency: 'AFN',
    location: 'بلخ - روضه شریف',
    imageUrl: 'https://picsum.photos/400/300?random=3',
    category: 'electronics',
    subCategory: 'mobile',
    description: 'حافظه ۲۵۶ گیگ، باتری ۹۰٪، بدون خط و خش، با کارتن و لوازم.',
    sellerName: 'فروشگاه موبایل برتر',
    postedDate: '۱ روز پیش',
    status: AdStatus.ACTIVE,
    views: 432,
    dynamicFields: {
        'brand': 'اپل',
        'condition': 'در حد نو',
        'storage': '256GB'
    }
  },
  {
    id: '3',
    userId: 'user_mock_3',
    title: 'آپارتمان ۳ اتاقه لوکس',
    price: 4500000,
    currency: 'AFN',
    location: 'هرات - جاده ابریشم',
    imageUrl: 'https://picsum.photos/400/300?random=2',
    category: 'real_estate',
    subCategory: 'apartment',
    description: 'طبقه ۴، دارای آسانسور و پارکینگ، سیستم گرمایش مرکز.',
    sellerName: 'مشاور املاک صداقت',
    postedDate: '۵ ساعت پیش',
    status: AdStatus.ACTIVE,
    views: 890,
    dynamicFields: {
        'listing_type': 'فروشی',
        'rooms': '۳',
        'area': 150,
        'floor': '۴'
    }
  }
];

export const APP_STRINGS = {
  header_search_placeholder: 'جستجو در بازار...',
  currency: '؋',
};
