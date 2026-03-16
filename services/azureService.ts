
import { Product, User, UserSuggestion, WalletTransaction, DashboardStats, ChatConversation, AdStatus, ChatMessage, Notification, ChatRequest } from '../types';
import { MOCK_PRODUCTS } from '../constants';
import { apiClient, AuthError, ApiError } from './apiClient';
import { USE_MOCK_DATA } from '../config';
import { authService } from './authService';
import { cacheService } from './cacheService';
import { compressImage } from './imageCompression';
import { generateChatReply } from './geminiService';
import { toastService } from './toastService';
import { safeStorage } from '../utils/safeStorage';

const CURRENT_USER_ID = 'user_123'; 
const DB_PREFIX = 'bazar_db_';

// --- MAP BACKEND (PascalCase SQL) RESPONSE TO FRONTEND Product TYPE ---
interface AdRow { [key: string]: unknown; }

interface InboxItem {
    OtherUserId: string;
    OtherUserName: string;
    OtherUserAvatar: string;
    LastMessage: string;
    LastMessageTime: string;
    UnreadCount: number;
}

interface MsgItem {
    Id: string;
    FromUserId: string;
    Content: string;
    IsRead: boolean;
    CreatedAt: string;
}

interface ProfileRecord {
    Id: string;
    Name: string;
    Email: string;
    Phone: string;
    AvatarUrl: string;
    IsVerified: boolean;
    VerificationStatus: string;
    Role: string;
    CreatedAt: string;
}

interface TxRow {
    Id: string;
    UserId: string;
    Amount: number;
    Type: string;
    Status: string;
    Description: string;
    CreatedAt: string;
}

function mapAdToProduct(row: AdRow): Product {
    const dynamicFieldsRaw = row.DynamicFields ?? row.dynamicFields;
    let dynamicFields: Record<string, string | number> | undefined;
    if (typeof dynamicFieldsRaw === 'string' && dynamicFieldsRaw) {
        try { dynamicFields = JSON.parse(dynamicFieldsRaw); } catch (e) {
            console.warn('Failed to parse DynamicFields JSON:', e);
        }
    } else if (dynamicFieldsRaw && typeof dynamicFieldsRaw === 'object') {
        dynamicFields = dynamicFieldsRaw as Record<string, string | number>;
    }

    return {
        id: String(row.Id || row.id || ''),
        userId: String(row.UserId || row.userId || ''),
        title: String(row.Title || row.title || ''),
        price: Number(row.Price ?? row.price ?? 0),
        currency: 'AFN',
        location: String(row.Location || row.location || ''),
        latitude: row.Latitude != null ? Number(row.Latitude) : row.latitude != null ? Number(row.latitude) : undefined,
        longitude: row.Longitude != null ? Number(row.Longitude) : row.longitude != null ? Number(row.longitude) : undefined,
        imageUrl: String(row.MainImageUrl || row.mainImageUrl || row.imageUrl || ''),
        imageUrls: Array.isArray(row.images) ? row.images as string[] : [],
        category: String(row.Category || row.category || ''),
        subCategory: row.SubCategory != null ? String(row.SubCategory) : row.subCategory != null ? String(row.subCategory) : undefined,
        description: String(row.Description || row.description || ''),
        sellerName: String(row.SellerName || row.sellerName || ''),
        postedDate: String(row.CreatedAt || row.createdAt || ''),
        status: (String(row.Status || row.status || 'ACTIVE')) as AdStatus,
        views: Number(row.Views ?? row.views ?? 0),
        isPromoted: Boolean(row.IsPromoted ?? row.isPromoted ?? false),
        isFavorite: Boolean(row.isFavorite ?? false),
        condition: (row.Condition ?? row.condition ?? 'used') as import('../types').ProductCondition,
        isNegotiable: Boolean(row.IsNegotiable ?? row.isNegotiable ?? false),
        deliveryAvailable: Boolean(row.DeliveryAvailable ?? row.deliveryAvailable ?? false),
        dynamicFields,
    };
}

function mapAdsToProducts(rows: AdRow[]): Product[] {
    if (!Array.isArray(rows)) return [];
    return rows.map(mapAdToProduct);
}

function extractProvinceFromLocation(location: string): string {
    return location.split(' - ')[0].trim();
}

// Type definitions for API data
interface CreateAdData {
  title: string;
  price: number | string;
  location: string;
  latitude?: number;
  longitude?: number;
  category: string;
  subCategory?: string;
  description: string;
  imageUrls?: string[];
  dynamicFields?: Record<string, string | number>;
  condition?: string;
  isNegotiable?: boolean;
  deliveryAvailable?: boolean;
}

interface UpdateAdData extends CreateAdData {
  images?: string[];
}

interface UserSettings {
  notif_msg: boolean;
  notif_ad: boolean;
  notif_promo: boolean;
}

interface MessageRecord {
  [conversationId: string]: ChatMessage[];
}

// --- LOCAL STORAGE DATABASE HELPERS ---
const db = {
    get: <T>(table: string, defaultData: T): T => {
        try {
            const data = safeStorage.getItem(DB_PREFIX + table);
            return data ? JSON.parse(data) : defaultData;
        } catch {
            return defaultData;
        }
    },
    save: <T>(table: string, data: T) => {
        try {
            safeStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
        } catch (e) {
            console.error("Local DB Full", e);
            toastService.error('حافظه مرورگر پر شده است. لطفاً برخی از آگهی‌ها یا تصاویر را پاک کنید.');
        }
    },
    init: () => {
        if (!safeStorage.getItem(DB_PREFIX + 'products')) {
            const seedProducts = MOCK_PRODUCTS.map(p => ({ ...p, userId: p.userId === 'user_mock_1' ? CURRENT_USER_ID : p.userId }));
            safeStorage.setItem(DB_PREFIX + 'products', JSON.stringify(seedProducts));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'users')) {
            const seedUsers: User[] = [
                { id: 'user_v1', name: 'کریم خان', phone: '0771112222', avatarUrl: '', isVerified: false, verificationStatus: 'PENDING', joinDate: 'دیروز', role: 'USER', status: 'ACTIVE', province: 'کابل' },
                { id: 'user_v2', name: 'گل‌ناز', phone: '0799888777', avatarUrl: '', isVerified: false, verificationStatus: 'PENDING', joinDate: 'امروز', role: 'USER', status: 'ACTIVE', province: 'هرات' }
            ];
            safeStorage.setItem(DB_PREFIX + 'users', JSON.stringify(seedUsers));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'conversations')) {
             safeStorage.setItem(DB_PREFIX + 'conversations', JSON.stringify([]));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'messages')) {
             safeStorage.setItem(DB_PREFIX + 'messages', JSON.stringify({}));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'wallet')) {
            safeStorage.setItem(DB_PREFIX + 'wallet', '3450');
        }
        if (!safeStorage.getItem(DB_PREFIX + 'transactions')) {
             const seedTx: WalletTransaction[] = [{ id: 'tx1', userId: CURRENT_USER_ID, amount: 500, type: 'DEPOSIT', date: '۱۴۰۳/۱۰/۰۱', status: 'SUCCESS', description: 'شارژ کیف پول (هشت‌پیس)' }];
             safeStorage.setItem(DB_PREFIX + 'transactions', JSON.stringify(seedTx));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'favorites')) {
            safeStorage.setItem(DB_PREFIX + 'favorites', JSON.stringify([]));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'notifications')) {
            const seedNotifs: Notification[] = [
                { id: 'n1', title: 'خوش آمدید', message: 'به بازار افغان خوش آمدید. پروفایل خود را تکمیل کنید.', date: '۱۴۰۳/۱۰/۰۱', isRead: false, type: 'info' }
            ];
            safeStorage.setItem(DB_PREFIX + 'notifications', JSON.stringify(seedNotifs));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'settings')) {
            safeStorage.setItem(DB_PREFIX + 'settings', JSON.stringify({ notif_msg: true, notif_ad: true, notif_promo: true }));
        }
        if (!safeStorage.getItem(DB_PREFIX + 'chatRequests')) {
            safeStorage.setItem(DB_PREFIX + 'chatRequests', JSON.stringify([]));
        }
    }
};

// Initialize DB on load
if (USE_MOCK_DATA) {
    db.init();
}

export interface SearchFilters {
  query?: string;
  category?: string;
  province?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

// Helper to simulate incoming messages
const triggerMockReply = async (conversationId: string, userText: string) => {
    // Determine Product Context
    const conversations = db.get<ChatConversation[]>('conversations', []);
    const currentConv = conversations.find(c => c.id === conversationId);
    const productContext = currentConv ? currentConv.productTitle : "محصول";

    // Simulate typing delay
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    let replyText = "";

    // 1. Try AI Reply
    if (process.env.API_KEY) {
        replyText = await generateChatReply(userText, productContext);
    }

    // 2. Fallback Logic
    if (!replyText) {
        if (userText.includes('قیمت') || userText.includes('چند')) {
            replyText = "قیمت نهایی است اما برای مشتری واقعی تخفیف جزئی دارد.";
        } else if (userText.includes('کجاست') || userText.includes('آدرس')) {
            replyText = "موقعیت دقیق را در نقشه مشخص کردم. کی تشریف می‌آورید؟";
        } else if (userText.includes('سلام')) {
            replyText = "وعلیکم سلام! چطور می‌توانم کمک کنم؟";
        } else {
            replyText = "پیام شما را دریافت کردم، بزودی پاسخ می‌دهم.";
        }
    }

    const replyMsg: ChatMessage = {
        id: `msg_reply_${Date.now()}`,
        senderId: 'other_user', // Mock sender
        text: replyText,
        type: 'TEXT',
        timestamp: new Date().toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        status: 'SENT',
        isDeleted: false
    };

    // 1. Save to DB
    const allMessages = db.get<MessageRecord>('messages', {});
    if (!allMessages[conversationId]) allMessages[conversationId] = [];
    allMessages[conversationId].push(replyMsg);
    db.save('messages', allMessages);

    // 2. Update Conversation List
    const freshConversations = db.get<ChatConversation[]>('conversations', []);
    const convIndex = freshConversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
        freshConversations[convIndex].lastMessage = replyText;
        freshConversations[convIndex].lastMessageTime = 'همین الان';
        freshConversations[convIndex].unreadCount = (freshConversations[convIndex].unreadCount || 0) + 1;
        // Move to top
        const conv = freshConversations.splice(convIndex, 1)[0];
        freshConversations.unshift(conv);
        db.save('conversations', freshConversations);
    }

    // 3. Dispatch Event for RealtimeService
    const event = new CustomEvent('mock-message-received', { detail: replyMsg });
    window.dispatchEvent(event);
};

export const azureService = {

  getUserProfile: async (): Promise<User> => {
    if (USE_MOCK_DATA) {
      const sessionUser = authService.getCurrentUser();
      const user = sessionUser || {
        id: CURRENT_USER_ID,
        name: 'احمد شاه',
        phone: '0799999999',
        email: 'ahmad@example.com',
        avatarUrl: '',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        joinDate: '۱۴۰۲/۰۱/۰۱',
        role: 'USER',
        status: 'ACTIVE'
      };
      return user;
    }
    const sessionUser = authService.getCurrentUser();
    if (sessionUser) return sessionUser;
    const data = await apiClient.get<ProfileRecord>('/user/profile');
    return {
      id: data.Id,
      name: data.Name,
      email: data.Email,
      phone: data.Phone || '',
      avatarUrl: data.AvatarUrl || '',
      isVerified: data.IsVerified,
      verificationStatus: (data.VerificationStatus || 'NONE') as User['verificationStatus'],
      role: data.Role as 'USER' | 'ADMIN',
      joinDate: data.CreatedAt
    };
  },

  updateUserProfile: async (data: Partial<User>): Promise<boolean> => {
    cacheService.remove(`user_profile_${CURRENT_USER_ID}`);
    if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 800));
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            authService.updateUserSession({ ...currentUser, ...data });
        }
        return true;
    }
    try {
        await apiClient.put('/user/profile', data);
        return true;
    } catch (err) {
        if (err instanceof AuthError) throw err;
        return false;
    }
  },

  uploadVerificationDocs: async (_frontImage: File, _backImage: File): Promise<boolean> => {
      await new Promise(r => setTimeout(r, 1500));
      // In a real app, this would trigger a status change to PENDING
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
          authService.updateUserSession({ ...currentUser, verificationStatus: 'PENDING', isVerified: false });
      }
      return true;
  },

  uploadImage: async (file: File): Promise<string | null> => {
    let fileToUpload = file;
    try {
        fileToUpload = await compressImage(file, 0.6, 1200);
    } catch (e) {
        console.warn('Image compression failed', e);
    }

    if (USE_MOCK_DATA) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.readAsDataURL(fileToUpload);
        });
    }
    
    try {
        // Convert file to base64 and upload via API proxy to avoid browser CORS restrictions
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // strip data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(fileToUpload);
        });

        const uploadResponse = await apiClient.post<{ ok: boolean, url: string }>('/upload', {
            fileName: fileToUpload.name,
            contentType: fileToUpload.type,
            base64,
        });

        if (uploadResponse.ok) {
            return uploadResponse.url;
        }

        console.error('Blob upload failed');
        return null;
    } catch (error) {
        if (error instanceof AuthError) throw error;
        // Re-throw server-side errors (5xx) so the caller can distinguish a permanent
        // configuration failure (e.g. AZURE_STORAGE_CONNECTION_STRING not set → 503
        // STORAGE_NOT_CONFIGURED) from a transient network error. Without this, callers
        // receive null and show a misleading "retry" message even when retrying won't help.
        if (error instanceof ApiError && error.status >= 500) throw error;
        console.error('Upload process error:', error);
        return null;
    }
  },

  postAd: async (adData: CreateAdData): Promise<boolean> => {
    if (USE_MOCK_DATA) {
        // ... (mock implementation remains same but updated to handle imageUrls)
        const products = db.get<Product[]>('products', []);
        const newProduct: Product = {
            id: `ad_${Date.now()}`,
            userId: CURRENT_USER_ID,
            title: adData.title,
            price: Number(adData.price),
            currency: 'AFN',
            location: adData.location,
            latitude: adData.latitude,
            longitude: adData.longitude,
            imageUrl: adData.imageUrls && adData.imageUrls.length > 0 ? adData.imageUrls[0] : 'https://via.placeholder.com/400',
            imageUrls: adData.imageUrls || [],
            category: adData.category,
            subCategory: adData.subCategory,
            description: adData.description,
            sellerName: authService.getCurrentUser()?.name || 'کاربر',
            postedDate: new Date().toLocaleDateString('fa-AF'),
            status: AdStatus.ACTIVE,
            views: 0,
            dynamicFields: adData.dynamicFields
        };
        db.save('products', [newProduct, ...products]);
        // Create a confirmation notification in mock mode
        const notifs = db.get<Notification[]>('notifications', []);
        notifs.unshift({
            id: `n_${Date.now()}`,
            title: 'آگهی شما ثبت شد',
            message: `آگهی "${adData.title}" با موفقیت ثبت شد.`,
            date: 'همین الان',
            isRead: false,
            type: 'success'
        });
        db.save('notifications', notifs);
        return true;
    }
    const token = authService.getToken();
    if (!token) {
      throw new AuthError('missing_token');
    }
    await apiClient.post('/ads', adData);
    return true;
  },

  updateAd: async (id: string, adData: UpdateAdData): Promise<boolean> => {
    if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 1000));
        const products = db.get<Product[]>('products', []);
        const index = products.findIndex(p => p.id === id);
        
        if (index !== -1) {
            products[index] = {
                ...products[index],
                ...adData,
                status: AdStatus.ACTIVE,
                price: Number(adData.price),
                imageUrl: adData.images && adData.images.length > 0 ? adData.images[0] : products[index].imageUrl,
                imageUrls: adData.images || [],
            };
            db.save('products', products);
            return true;
        }
        return false;
    }
    await apiClient.put(`/ads/${id}`, adData);
    return true;
  },

  deleteAd: async (id: string): Promise<boolean> => {
    if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 500));
        const products = db.get<Product[]>('products', []);
        const updated = products.map(p => p.id === id ? { ...p, status: AdStatus.DELETED } : p);
        db.save('products', updated);
        return true;
    }
    try {
        await apiClient.delete(`/ads/${id}`);
        return true;
    } catch (err) {
        if (err instanceof AuthError) throw err;
        return false;
    }
  },

  deleteAccount: async (): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          await new Promise(r => setTimeout(r, 1500));
          return true;
      }
      try {
          await apiClient.delete('/user/account');
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 400)); 
      const products = db.get<Product[]>('products', []);
      const userAds = products.filter(p => p.userId === CURRENT_USER_ID && p.status !== AdStatus.DELETED);
      const balance = Number(db.get('wallet', '0'));
      const convos = db.get<ChatConversation[]>('conversations', []);
      const unreadCount = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      
      return {
          totalAds: userAds.length,
          activeAds: userAds.filter(ad => ad.status === AdStatus.ACTIVE).length,
          totalViews: userAds.reduce((sum, ad) => sum + (ad.views || 0), 0),
          unreadMessages: unreadCount,
          walletBalance: balance
      };
    }
    // Auth errors (401) must propagate so the auth-change redirect can proceed
    // without briefly flashing zero stats. Non-auth errors (network outage, etc.)
    // fall back to safe defaults so the dashboard still renders.
    return await apiClient.get<DashboardStats>('/dashboard/stats').catch((err: unknown) => {
        if (err instanceof AuthError) {
            throw err;
        }
        return { totalAds: 0, activeAds: 0, totalViews: 0, unreadMessages: 0, walletBalance: 0 };
    });
  },
  
  getMyAds: async () => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.userId === CURRENT_USER_ID && p.status !== AdStatus.DELETED);
      }
      try {
          const data = await apiClient.get<AdRow[]>('/ads/my-ads');
          return mapAdsToProducts(data);
      } catch (err: unknown) {
          if (err instanceof AuthError) {
              console.warn('[azureService.getMyAds] 401 Unauthorized – token missing or expired', err.reason);
              throw err;
          }
          if (err instanceof ApiError) {
              console.error(`[azureService.getMyAds] API error status=${err.status} requestId=${err.requestId ?? ''} category=${err.category ?? ''}`);
              if (err.status === 404) {
                  toastService.error('مسیر my-ads در سرور موجود نیست');
              }
              if (err.status === 503) {
                  throw err;
              }
          }
          return [];
      }
  },
  
  getSellerAds: async (id: string) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.userId === id && p.status === AdStatus.ACTIVE);
      }
      try {
          const data = await apiClient.get<AdRow[]>(`/ads/user/${id}`);
          return mapAdsToProducts(data);
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  // TODO: implement real reviews API when backend support is added
  getSellerReviews: async (_id: string) => USE_MOCK_DATA ? [{ id: 'r1', userId: 'u55', userName: 'کریم', rating: 5, comment: 'فروشنده بسیار خوش برخورد.', date: '۲ روز پیش' }] : [],
  
  getProductById: async (id: string): Promise<Product | null> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.find(p => p.id === id) || null;
      }
      try {
          const data = await apiClient.get<AdRow>(`/ads/${id}`);
          return mapAdToProduct(data);
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return null;
      }
  },

  getRelatedProducts: async (cat: string, id: string) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.status === AdStatus.ACTIVE && p.category === cat && p.id !== id).slice(0, 4);
      }
      try {
          const data = await apiClient.get<AdRow[]>(`/ads?category=${encodeURIComponent(cat)}`);
          return mapAdsToProducts(data).filter(p => p.id !== id).slice(0, 4);
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  searchAds: async (filters: SearchFilters): Promise<Product[]> => {
    if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 300));
        const allProducts = db.get<Product[]>('products', []);
        let res = allProducts.filter(p => p.status === AdStatus.ACTIVE || p.status === AdStatus.SOLD);
        
        if(filters.category && filters.category !== 'all') {
            res = res.filter(p => p.category === filters.category);
        }
        if(filters.province && filters.province !== 'all') {
            res = res.filter(p => p.location.includes(filters.province!));
        }
        if (filters.district) {
            res = res.filter(p => p.location.includes(filters.district!));
        }
        if (filters.minPrice) {
            res = res.filter(p => p.price >= filters.minPrice!);
        }
        if (filters.maxPrice) {
            res = res.filter(p => p.price <= filters.maxPrice!);
        }
        if(filters.query) {
            res = res.filter(p => p.title.includes(filters.query!) || p.description.includes(filters.query!));
        }
        
        if (filters.sort === 'price_low') {
            res.sort((a, b) => a.price - b.price);
        } else if (filters.sort === 'price_high') {
            res.sort((a, b) => b.price - a.price);
        } else if (filters.sort === 'most_viewed') {
            res.sort((a, b) => (b.views || 0) - (a.views || 0));
        } 

        const favorites = db.get<string[]>('favorites', []);
        res = res.map(p => ({ ...p, isFavorite: favorites.includes(p.id) }));

        return res;
    }
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.province && filters.province !== 'all') params.append('province', filters.province);
    if (filters.district) params.append('district', filters.district);
    if (filters.query) params.append('q', filters.query);
    if (filters.minPrice) params.append('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.append('maxPrice', String(filters.maxPrice));
    if (filters.sort) params.append('sort', filters.sort);
    const qs = params.toString();
    try {
      const data = await apiClient.get<AdRow[]>(`/ads${qs ? '?' + qs : ''}`);
      return mapAdsToProducts(data);
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      return [];
    }
  },

  getSearchSuggestions: async (q: string): Promise<string[]> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.map(p => p.title).filter(t => t.includes(q)).slice(0, 5);
      }
      try {
          const data = await apiClient.get<AdRow[]>(`/ads?q=${encodeURIComponent(q)}`);
          return mapAdsToProducts(data).map(p => p.title).slice(0, 5);
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },

  searchUsers: async (q: string): Promise<UserSuggestion[]> => {
      if (!q || q.length < 2) return [];
      if (USE_MOCK_DATA) {
          const users = db.get<User[]>('users', []);
          const products = db.get<Product[]>('products', []);

          // Build a Map of userId → province from products for O(1) lookup
          const userProvinceMap = new Map<string, string>();
          for (const p of products) {
              if (!userProvinceMap.has(p.userId)) {
                  userProvinceMap.set(p.userId, extractProvinceFromLocation(p.location));
              }
          }

          // Match registered users
          const userResults: UserSuggestion[] = users
              .filter(u => u.name.includes(q) && u.status !== 'DELETED')
              .map(u => ({
                  id: u.id,
                  name: u.name,
                  province: u.province || userProvinceMap.get(u.id) || '',
                  avatarUrl: u.avatarUrl || '',
              }));

          // Also match unique sellers from products (by sellerName)
          const seenNames = new Set(userResults.map(u => u.name));
          const sellerResults: UserSuggestion[] = [];
          for (const p of products) {
              if (p.sellerName.includes(q) && !seenNames.has(p.sellerName)) {
                  seenNames.add(p.sellerName);
                  sellerResults.push({ id: p.userId, name: p.sellerName, province: extractProvinceFromLocation(p.location), avatarUrl: '' });
              }
          }

          return [...userResults, ...sellerResults].slice(0, 5);
      }
      try {
          interface UserSearchRow { Id: string; Name: string; Province?: string; AvatarUrl?: string; }
          const data = await apiClient.get<UserSearchRow[]>(`/users/search?q=${encodeURIComponent(q)}`);
          if (!Array.isArray(data)) return [];
          return data.map(u => ({ id: u.Id, name: u.Name, province: u.Province || '', avatarUrl: u.AvatarUrl || '' })).slice(0, 5);
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  getWalletTransactions: async () => {
      if (USE_MOCK_DATA) {
          return db.get<WalletTransaction[]>('transactions', []);
      }
      try {
          const data = await apiClient.get<TxRow[]>('/wallet/transactions');
          if (!Array.isArray(data)) return [];
          return data.map(tx => ({
              id: tx.Id,
              userId: tx.UserId,
              amount: tx.Amount,
              type: tx.Type as WalletTransaction['type'],
              date: tx.CreatedAt,
              status: tx.Status as WalletTransaction['status'],
              description: tx.Description || ''
          }));
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  topUpWallet: async (amount: number, desc: string) => { 
      if (USE_MOCK_DATA) {
          let balance = Number(db.get('wallet', '0'));
          balance += amount;
          db.save('wallet', balance.toString());
          
          const txs = db.get<WalletTransaction[]>('transactions', []);
          const newTx: WalletTransaction = { 
              id: `tx_${Date.now()}`, 
              userId: CURRENT_USER_ID, 
              amount, 
              type: 'DEPOSIT', 
              date: new Date().toLocaleDateString('fa-AF'), 
              status: 'SUCCESS', 
              description: desc 
          };
          db.save('transactions', [newTx, ...txs]);
          
          // Notif
          const notifs = db.get<Notification[]>('notifications', []);
          notifs.unshift({
              id: `n_${Date.now()}`,
              title: 'افزایش موجودی',
              message: `کیف پول شما مبلغ ${amount} افغانی شارژ شد.`,
              date: 'همین الان',
              isRead: false,
              type: 'success'
          });
          db.save('notifications', notifs);

          return true; 
      }
      try {
          await apiClient.post('/wallet/top-up', { amount, description: desc });
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },
  
  // --- REAL-TIME CHAT IMPLEMENTATION (LOCAL STORAGE) ---
  getConversations: async (): Promise<ChatConversation[]> => {
      if (USE_MOCK_DATA) {
          // Instant response for better feel
          return db.get<ChatConversation[]>('conversations', []);
      }
      // Skip the API call when not authenticated or token is expired to avoid unnecessary 401 errors.
      if (!authService.getToken() || authService.isTokenExpired()) return [];
      try {
          const data = await apiClient.get<InboxItem[]>('/messages/inbox');
          if (!Array.isArray(data)) return [];
          return data.map(item => ({
              id: item.OtherUserId,
              otherUserId: item.OtherUserId,
              otherUserName: item.OtherUserName,
              otherUserAvatar: item.OtherUserAvatar || '',
              productId: '',
              productTitle: '',
              lastMessage: item.LastMessage,
              lastMessageTime: new Date(item.LastMessageTime).toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
              unreadCount: item.UnreadCount || 0
          }));
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  getMessages: async (id: string): Promise<ChatMessage[]> => {
      if (USE_MOCK_DATA) {
          // Instant response
          const allMessages = db.get<MessageRecord>('messages', {});
          return allMessages[id] || [];
      }
      try {
          const data = await apiClient.get<MsgItem[]>(`/messages/thread/${id}`);
          if (!Array.isArray(data)) return [];
          return data.map(msg => ({
              id: msg.Id,
              senderId: msg.FromUserId,
              text: msg.Content,
              type: 'TEXT' as const,
              timestamp: new Date(msg.CreatedAt).toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
              isRead: msg.IsRead,
              status: 'SENT' as const,
              isDeleted: msg.Content === ''
          }));
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },
  
  sendMessage: async (id: string, text: string): Promise<ChatMessage> => {
      if (USE_MOCK_DATA) {
          const newMessage: ChatMessage = {
              id: `msg_${Date.now()}`,
              senderId: CURRENT_USER_ID,
              text,
              type: 'TEXT',
              timestamp: new Date().toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
              isRead: false,
              status: 'SENT',
              isDeleted: false
          };
          
          // Save Message
          const allMessages = db.get<MessageRecord>('messages', {});
          if (!allMessages[id]) allMessages[id] = [];
          allMessages[id].push(newMessage);
          db.save('messages', allMessages);

          // Update Conversation Preview
          const conversations = db.get<ChatConversation[]>('conversations', []);
          const convIndex = conversations.findIndex(c => c.id === id);
          if (convIndex !== -1) {
              conversations[convIndex].lastMessage = text;
              conversations[convIndex].lastMessageTime = 'همین الان';
              // Move to top
              const conv = conversations.splice(convIndex, 1)[0];
              conversations.unshift(conv);
              db.save('conversations', conversations);
          }

          // Trigger simulated reply from other user (NOW POWERED BY AI)
          triggerMockReply(id, text);

          return newMessage;
      }
      const currentUser = authService.getCurrentUser();
      await apiClient.post('/messages', { toUserId: id, content: text });
      return {
          id: `msg_${Date.now()}`,
          senderId: currentUser?.id || '',
          text,
          type: 'TEXT',
          timestamp: new Date().toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
          status: 'SENT',
          isDeleted: false
      };
  },

  startConversation: async (productId: string): Promise<string> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const product = products.find(p => p.id === productId);
          
          if (!product) return 'error';
          if (product.userId === CURRENT_USER_ID) {
              toastService.warning('شما نمی‌توانید با خودتان چت کنید!');
              return '';
          }

          // Check if conversation exists
          const conversations = db.get<ChatConversation[]>('conversations', []);
          const existing = conversations.find(c => c.productId === productId && c.otherUserId === product.userId);
          
          if (existing) return existing.id;

          // Create New Conversation
          const newConvoId = `c_${Date.now()}`;
          const newConvo: ChatConversation = {
              id: newConvoId,
              otherUserId: product.userId,
              otherUserName: product.sellerName,
              otherUserAvatar: '',
              productId: product.id,
              productTitle: product.title,
              lastMessage: 'شروع گفتگو...',
              lastMessageTime: 'همین الان',
              unreadCount: 0
          };
          
          conversations.unshift(newConvo);
          db.save('conversations', conversations);
          return newConvoId;
      }
      try {
          const ad = await apiClient.get<AdRow>(`/ads/${productId}`);
          return String(ad.UserId || '');
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return '';
      }
  },

  deleteMessage: async (messageId: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          const allMessages = db.get<MessageRecord>('messages', {});
          let found = false;
          for (const convId in allMessages) {
              const msgIndex = allMessages[convId].findIndex((m: ChatMessage) => m.id === messageId);
              if (msgIndex !== -1) {
                  allMessages[convId][msgIndex].isDeleted = true;
                  found = true;
                  break;
              }
          }
          if (found) db.save('messages', allMessages);
          return found;
      }
      try {
          await apiClient.delete(`/messages/${messageId}`);
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },

  // --- CHAT REQUESTS ---
  sendChatRequest: async (toUserId: string, toUserName: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          if (toUserId === CURRENT_USER_ID) {
              toastService.warning('شما نمی‌توانید با خودتان چت کنید!');
              return false;
          }
          const requests = db.get<ChatRequest[]>('chatRequests', []);
          // Check if a pending request already exists
          if (requests.some(r => r.toUserId === toUserId && r.fromUserId === CURRENT_USER_ID && r.status === 'PENDING')) {
              toastService.info('قبلاً درخواست گفتگو فرستاده‌اید.');
              return false;
          }
          // If conversation already exists, just open it
          const conversations = db.get<ChatConversation[]>('conversations', []);
          if (conversations.some(c => c.otherUserId === toUserId)) {
              toastService.info('گفتگو از قبل موجود است.');
              return false;
          }
          const newRequest: ChatRequest = {
              id: `req_${Date.now()}`,
              fromUserId: CURRENT_USER_ID,
              fromUserName: authService.getCurrentUser()?.name || 'کاربر',
              toUserId,
              status: 'PENDING',
              createdAt: new Date().toLocaleDateString('fa-AF'),
          };
          requests.push(newRequest);
          db.save('chatRequests', requests);
          // Simulate auto-accept after 2 seconds (mock demo)
          setTimeout(async () => {
              await azureService.acceptChatRequest(newRequest.id, toUserId, toUserName);
              const event = new CustomEvent('chat-request-accepted', { detail: { requestId: newRequest.id } });
              window.dispatchEvent(event);
          }, 2000);
          return true;
      }
      try {
          await apiClient.post('/chat/requests', { toUserId });
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },

  getChatRequests: async (): Promise<ChatRequest[]> => {
      if (USE_MOCK_DATA) {
          const requests = db.get<ChatRequest[]>('chatRequests', []);
          return requests.filter(r => r.toUserId === CURRENT_USER_ID && r.status === 'PENDING');
      }
      try {
          const data = await apiClient.get<ChatRequest[]>('/chat/requests');
          return Array.isArray(data) ? data : [];
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },

  acceptChatRequest: async (requestId: string, fromUserId?: string, fromUserName?: string): Promise<string> => {
      if (USE_MOCK_DATA) {
          const requests = db.get<ChatRequest[]>('chatRequests', []);
          const reqIndex = requests.findIndex(r => r.id === requestId);
          let req = reqIndex !== -1 ? requests[reqIndex] : null;
          if (!req && fromUserId && fromUserName) {
              // Called internally for mock auto-accept
              req = { id: requestId, fromUserId, fromUserName, toUserId: CURRENT_USER_ID, status: 'PENDING', createdAt: '' };
          }
          if (!req) return '';
          if (reqIndex !== -1) {
              requests[reqIndex] = { ...req, status: 'ACCEPTED' };
              db.save('chatRequests', requests);
          }
          // Create conversation
          const conversations = db.get<ChatConversation[]>('conversations', []);
          if (conversations.some(c => c.otherUserId === req!.fromUserId)) {
              return conversations.find(c => c.otherUserId === req!.fromUserId)!.id;
          }
          const newConvoId = `c_${Date.now()}`;
          const newConvo: ChatConversation = {
              id: newConvoId,
              otherUserId: req.fromUserId,
              otherUserName: req.fromUserName,
              otherUserAvatar: '',
              productId: '',
              productTitle: '',
              lastMessage: '',
              lastMessageTime: 'همین الان',
              unreadCount: 0,
          };
          conversations.unshift(newConvo);
          db.save('conversations', conversations);
          return newConvoId;
      }
      try {
          const data = await apiClient.post<{ conversationId: string }>(`/chat/requests/${requestId}/accept`, {});
          return data.conversationId;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return '';
      }
  },

  rejectChatRequest: async (requestId: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          const requests = db.get<ChatRequest[]>('chatRequests', []);
          const idx = requests.findIndex(r => r.id === requestId);
          if (idx === -1) return false;
          requests[idx] = { ...requests[idx], status: 'REJECTED' };
          db.save('chatRequests', requests);
          return true;
      }
      try {
          await apiClient.post(`/chat/requests/${requestId}/reject`, {});
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },

  updateAdStatus: async (id: string, status: AdStatus) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const updated = products.map(p => p.id === id ? { ...p, status } : p);
          db.save('products', updated);
          return true;
      }
      try {
          await apiClient.patch(`/ads/${id}/status`, { status });
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },
  
  promoteAd: async (id: string, plan: string) => {
      if (USE_MOCK_DATA) {
          let balance = Number(db.get('wallet', '0'));
          const cost = plan === 'URGENT' ? 200 : 50;
          const label = plan === 'URGENT' ? 'فوری و ویژه' : 'نردبان';

          if (balance >= cost) {
              // 1. Deduct Balance
              balance -= cost;
              db.save('wallet', balance.toString());

              // 2. Update Product
              const products = db.get<Product[]>('products', []);
              const updated = products.map(p => p.id === id ? { ...p, isPromoted: true } : p);
              db.save('products', updated);

              // 3. Create Transaction Record
              const txs = db.get<WalletTransaction[]>('transactions', []);
              const newTx: WalletTransaction = { 
                  id: `tx_${Date.now()}`, 
                  userId: CURRENT_USER_ID, 
                  amount: -cost, 
                  type: 'PAYMENT_AD_PROMO', 
                  date: new Date().toLocaleDateString('fa-AF'), 
                  status: 'SUCCESS', 
                  description: `ارتقای آگهی (${label})` 
              };
              db.save('transactions', [newTx, ...txs]);

              // 4. Create Notification
              const notifs = db.get<Notification[]>('notifications', []);
              notifs.unshift({
                  id: `n_${Date.now()}`,
                  title: 'آگهی ارتقا یافت',
                  message: `آگهی شما با موفقیت به طرح ${label} ارتقا یافت.`,
                  date: 'همین الان',
                  isRead: false,
                  type: 'success'
              });
              db.save('notifications', notifs);

              return true;
          }
          return false; // Insufficient funds
      }
      try {
          await apiClient.post(`/ads/${id}/promote`, { plan });
          return true;
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return false;
      }
  },

  reportAd: async (_id: string, _reason: string) => true,

  toggleFavorite: async (id: string) => {
      if (USE_MOCK_DATA) {
          let favorites = db.get<string[]>('favorites', []);
          if (favorites.includes(id)) {
              favorites = favorites.filter(fid => fid !== id);
          } else {
              favorites.push(id);
          }
          db.save('favorites', favorites);
          return true;
      }
      try {
          await apiClient.post(`/favorites/${id}`, {});
          return true;
      } catch (err: unknown) {
          if (err instanceof AuthError) throw err;
          // 409 = already favorited, so remove it
          if (err instanceof Error && (err.message.includes('409') || err.message.includes('Already'))) {
              try {
                  await apiClient.delete(`/favorites/${id}`);
                  return true;
              } catch (delErr) {
                  if (delErr instanceof AuthError) throw delErr;
                  return false;
              }
          }
          return false;
      }
  },

  getFavorites: async () => {
      if (USE_MOCK_DATA) {
          const favorites = db.get<string[]>('favorites', []);
          const products = db.get<Product[]>('products', []);
          const favProducts = products.filter(p => favorites.includes(p.id));
          return favProducts.map(p => ({ ...p, isFavorite: true }));
      }
      try {
          const data = await apiClient.get<AdRow[]>('/favorites');
          return mapAdsToProducts(data).map(p => ({ ...p, isFavorite: true }));
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (): Promise<Notification[]> => {
      if (USE_MOCK_DATA) {
          return db.get<Notification[]>('notifications', []);
      }
      // Skip the API call when not authenticated or token is expired to avoid unnecessary 401 errors.
      if (!authService.getToken() || authService.isTokenExpired()) return [];
      try {
          const data = await apiClient.get<Array<{
              Id: string; UserId: string; Title: string; Message: string;
              Type: string; IsRead: boolean; CreatedAt: string;
          }>>('/notifications', { silent: true });
          if (!Array.isArray(data)) return [];
          return data.map(n => ({
              id: n.Id,
              title: n.Title,
              message: n.Message,
              date: new Date(n.CreatedAt).toLocaleDateString('fa-AF'),
              isRead: n.IsRead,
              type: n.Type as Notification['type']
          }));
      } catch (err) {
          // Re-throw auth errors so callers can detect and stop polling on 401.
          if (err instanceof AuthError) throw err;
          return [];
      }
  },

  markNotificationRead: async (id?: string) => {
      if (USE_MOCK_DATA) {
          let notifs = db.get<Notification[]>('notifications', []);
          if (id) {
              notifs = notifs.map(n => n.id === id ? { ...n, isRead: true } : n);
          } else {
              notifs = notifs.map(n => ({ ...n, isRead: true }));
          }
          db.save('notifications', notifs);
          return;
      }
      // Skip the API call when not authenticated or token is expired to avoid unnecessary 401 errors.
      if (!authService.getToken() || authService.isTokenExpired()) return;
      try {
          await apiClient.patch('/notifications/read', id ? { id } : {});
      } catch (err) {
          if (err instanceof AuthError) throw err;
          /* silent – non-critical */
      }
  },

  // --- SETTINGS ---
  getSettings: (): UserSettings => {
      return db.get<UserSettings>('settings', { notif_msg: true, notif_ad: true, notif_promo: true });
  },
  saveSettings: (settings: UserSettings) => {
      db.save('settings', settings);
  },

  // --- ADMIN FUNCTIONS ---
  adminGetPendingAds: async (): Promise<Product[]> => {
     if (USE_MOCK_DATA) {
         const products = db.get<Product[]>('products', []);
         return products.filter(p => p.status === AdStatus.PENDING);
     }
     try {
         const data = await apiClient.get<AdRow[]>('/admin/ads/pending');
         return mapAdsToProducts(data);
     } catch (err) {
         if (err instanceof AuthError) throw err;
         return [];
     }
  },
  
  adminGetPendingVerifications: async (): Promise<User[]> => {
      if (USE_MOCK_DATA) {
          const users = db.get<User[]>('users', []);
          return users.filter(u => u.verificationStatus === 'PENDING');
      }
      try {
          return await apiClient.get('/admin/users/pending-verification');
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  },

  adminApproveAd: async (id: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const ad = products.find(p => p.id === id);
          const updated = products.map(p => p.id === id ? { ...p, status: AdStatus.ACTIVE } : p);
          db.save('products', updated);
          if (ad) {
              const notifs = db.get<Notification[]>('notifications', []);
              notifs.unshift({
                  id: `n_${Date.now()}`,
                  title: 'آگهی شما تأیید شد',
                  message: `آگهی "${ad.title}" توسط مدیریت تأیید و منتشر شد.`,
                  date: 'همین الان',
                  isRead: false,
                  type: 'success'
              });
              db.save('notifications', notifs);
          }
          return true;
      }
      return apiClient.post(`/admin/ads/${id}/approve`, {});
  },

  adminRejectAd: async (id: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
        const products = db.get<Product[]>('products', []);
        const ad = products.find(p => p.id === id);
        const updated = products.map(p => p.id === id ? { ...p, status: AdStatus.REJECTED } : p);
        db.save('products', updated);
        if (ad) {
            const notifs = db.get<Notification[]>('notifications', []);
            notifs.unshift({
                id: `n_${Date.now()}`,
                title: 'آگهی شما رد شد',
                message: `آگهی "${ad.title}" توسط مدیریت رد شد. لطفاً آگهی را ویرایش و دوباره ارسال کنید.`,
                date: 'همین الان',
                isRead: false,
                type: 'error'
            });
            db.save('notifications', notifs);
        }
        return true;
      }
      return apiClient.post(`/admin/ads/${id}/reject`, {});
  },

  adminVerifyUser: async (userId: string, status: 'VERIFIED' | 'REJECTED'): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          const users = db.get<User[]>('users', []);
          const updated = users.map(u => u.id === userId ? { 
              ...u, 
              verificationStatus: status,
              isVerified: status === 'VERIFIED' 
          } : u);
          db.save('users', updated);
          return true;
      }
      return apiClient.post(`/admin/users/${userId}/verify`, { status });
  },

  // Helper for Recent Activity Stream
  getRecentActivities: async () => {
      if (USE_MOCK_DATA) {
          const acts = [];
          
          // 1. Ads
          const ads = db.get<Product[]>('products', []).filter(p => p.userId === CURRENT_USER_ID);
          ads.forEach(ad => acts.push({
              type: 'AD', date: ad.postedDate, title: `ثبت آگهی "${ad.title}"`, id: ad.id
          }));

          // 2. Transactions
          const txs = db.get<WalletTransaction[]>('transactions', []).filter(t => t.userId === CURRENT_USER_ID);
          txs.forEach(tx => acts.push({
              type: 'WALLET', date: tx.date, title: tx.description, id: tx.id, detail: `${Math.abs(tx.amount)} ؋`
          }));

          // 3. Messages (Approximate)
          const convos = db.get<ChatConversation[]>('conversations', []);
          convos.forEach(c => acts.push({
              type: 'MESSAGE', date: c.lastMessageTime, title: `پیام از ${c.otherUserName}`, id: c.id
          }));

          // Simple sort
          return acts.slice(0, 10);
      }
      // Skip the API call when not authenticated or token is expired
      if (!authService.getToken() || authService.isTokenExpired()) return [];
      try {
          const data = await apiClient.get<Array<{ type: string; id: string; title: string; detail?: string; date: string }>>('/dashboard/activities');
          return Array.isArray(data) ? data : [];
      } catch (err) {
          if (err instanceof AuthError) throw err;
          return [];
      }
  }
};
