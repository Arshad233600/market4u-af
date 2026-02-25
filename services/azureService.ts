
import { Product, User, WalletTransaction, DashboardStats, ChatConversation, AdStatus, ChatMessage, Notification } from '../types';
import { MOCK_PRODUCTS } from '../constants';
import { apiClient } from './apiClient';
import { USE_MOCK_DATA } from '../config';
import { authService } from './authService';
import { cacheService } from './cacheService';
import { compressImage } from './imageCompression';
import { generateChatReply } from './geminiService';
import { toastService } from './toastService';

const CURRENT_USER_ID = 'user_123'; 
const DB_PREFIX = 'bazar_db_';

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
            const data = localStorage.getItem(DB_PREFIX + table);
            return data ? JSON.parse(data) : defaultData;
        } catch {
            return defaultData;
        }
    },
    save: <T>(table: string, data: T) => {
        try {
            localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
        } catch (e) {
            console.error("Local DB Full", e);
            toastService.error('حافظه مرورگر پر شده است. لطفاً برخی از آگهی‌ها یا تصاویر را پاک کنید.');
        }
    },
    init: () => {
        if (!localStorage.getItem(DB_PREFIX + 'products')) {
            const seedProducts = MOCK_PRODUCTS.map(p => ({ ...p, userId: p.userId === 'user_mock_1' ? CURRENT_USER_ID : p.userId }));
            localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(seedProducts));
        }
        if (!localStorage.getItem(DB_PREFIX + 'users')) {
            const seedUsers: User[] = [
                { id: 'user_v1', name: 'کریم خان', phone: '0771112222', avatarUrl: '', isVerified: false, verificationStatus: 'PENDING', joinDate: 'دیروز', role: 'USER', status: 'ACTIVE' },
                { id: 'user_v2', name: 'گل‌ناز', phone: '0799888777', avatarUrl: '', isVerified: false, verificationStatus: 'PENDING', joinDate: 'امروز', role: 'USER', status: 'ACTIVE' }
            ];
            localStorage.setItem(DB_PREFIX + 'users', JSON.stringify(seedUsers));
        }
        if (!localStorage.getItem(DB_PREFIX + 'conversations')) {
             localStorage.setItem(DB_PREFIX + 'conversations', JSON.stringify([]));
        }
        if (!localStorage.getItem(DB_PREFIX + 'messages')) {
             localStorage.setItem(DB_PREFIX + 'messages', JSON.stringify({}));
        }
        if (!localStorage.getItem(DB_PREFIX + 'wallet')) {
            localStorage.setItem(DB_PREFIX + 'wallet', '3450');
        }
        if (!localStorage.getItem(DB_PREFIX + 'transactions')) {
             const seedTx: WalletTransaction[] = [{ id: 'tx1', userId: CURRENT_USER_ID, amount: 500, type: 'DEPOSIT', date: '۱۴۰۳/۱۰/۰۱', status: 'SUCCESS', description: 'شارژ کیف پول (هشت‌پیس)' }];
             localStorage.setItem(DB_PREFIX + 'transactions', JSON.stringify(seedTx));
        }
        if (!localStorage.getItem(DB_PREFIX + 'favorites')) {
            localStorage.setItem(DB_PREFIX + 'favorites', JSON.stringify([]));
        }
        if (!localStorage.getItem(DB_PREFIX + 'notifications')) {
            const seedNotifs: Notification[] = [
                { id: 'n1', title: 'خوش آمدید', message: 'به بازار افغان خوش آمدید. پروفایل خود را تکمیل کنید.', date: '۱۴۰۳/۱۰/۰۱', isRead: false, type: 'info' }
            ];
            localStorage.setItem(DB_PREFIX + 'notifications', JSON.stringify(seedNotifs));
        }
        if (!localStorage.getItem(DB_PREFIX + 'settings')) {
            localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify({ notif_msg: true, notif_ad: true, notif_promo: true }));
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
  condition?: string;
  dynamicFilters?: Record<string, string | number>;
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
    const CACHE_KEY = `user_profile_${CURRENT_USER_ID}`;
    
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
    const data = await apiClient.get<User>('/user/profile');
    cacheService.set(CACHE_KEY, data);
    return data;
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
    } catch { return false; }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // 1. Get SAS Token from API
        const sasResponse = await apiClient.post<{ sasUrl: string, blobUrl: string, uniqueName: string }>('/upload/sas-token', { 
            fileName: fileToUpload.name,
            fileType: fileToUpload.type 
        });

        // 2. Upload directly to Azure Blob Storage
        const uploadResponse = await fetch(sasResponse.sasUrl, {
            method: 'PUT',
            headers: { 
                'x-ms-blob-type': 'BlockBlob', 
                'Content-Type': fileToUpload.type 
            },
            body: fileToUpload
        });

        if (uploadResponse.ok) {
            return sasResponse.blobUrl;
        }
        
        console.error('Blob upload failed:', uploadResponse.statusText);
        return null;
    } catch (error) {
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
            status: AdStatus.PENDING,
            views: 0,
            dynamicFields: adData.dynamicFields
        };
        db.save('products', [newProduct, ...products]);
        return true;
    }
    try {
        await apiClient.post('/ads', adData);
        return true;
    } catch { return false; }
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
                status: AdStatus.PENDING,
                price: Number(adData.price),
                imageUrl: adData.images && adData.images.length > 0 ? adData.images[0] : products[index].imageUrl,
                imageUrls: adData.images || [],
            };
            db.save('products', products);
            return true;
        }
        return false;
    }
    try {
        await apiClient.put(`/ads/${id}`, adData);
        return true;
    } catch { return false; }
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
    } catch { return false; }
  },

  deleteAccount: async (): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          await new Promise(r => setTimeout(r, 1500));
          return true;
      }
      try {
          await apiClient.delete('/user/account');
          return true;
      } catch { return false; }
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
    return apiClient.get<DashboardStats>('/dashboard/stats');
  },
  
  getMyAds: async () => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.userId === CURRENT_USER_ID && p.status !== AdStatus.DELETED);
      }
      return apiClient.get('/ads/my-ads');
  },
  
  getSellerAds: async (id: string) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.userId === id && p.status === AdStatus.ACTIVE);
      }
      return apiClient.get(`/ads/user/${id}`);
  },
  
  getSellerReviews: async (id: string) => USE_MOCK_DATA ? [{ id: 'r1', userId: 'u55', userName: 'کریم', rating: 5, comment: 'فروشنده بسیار خوش برخورد.', date: '۲ روز پیش' }] : apiClient.get(`/users/${id}/reviews`),
  
  getProductById: async (id: string): Promise<Product | null> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.find(p => p.id === id) || null;
      }
      try {
          return await apiClient.get<Product>(`/ads/${id}`);
      } catch { return null; }
  },

  getRelatedProducts: async (cat: string, id: string) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          return products.filter(p => p.status === AdStatus.ACTIVE && p.category === cat && p.id !== id).slice(0, 4);
      }
      return apiClient.get(`/ads/related`);
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
        if (filters.condition) {
            res = res.filter(p => p.condition === filters.condition);
        }
        if (filters.dynamicFilters) {
            for (const [key, value] of Object.entries(filters.dynamicFilters)) {
                if (!value && value !== 0) continue;
                if (key.endsWith('_min')) {
                    const field = key.slice(0, -4);
                    res = res.filter(p => p.dynamicFields && Number(p.dynamicFields[field]) >= Number(value));
                } else if (key.endsWith('_max')) {
                    const field = key.slice(0, -4);
                    res = res.filter(p => p.dynamicFields && Number(p.dynamicFields[field]) <= Number(value));
                } else {
                    res = res.filter(p => p.dynamicFields && String(p.dynamicFields[key]) === String(value));
                }
            }
        }
        if(filters.query) {
            const q = filters.query.toLowerCase();
            res = res.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.location.toLowerCase().includes(q) ||
                p.sellerName.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q)
            );
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
    return apiClient.post('/search/index', filters);
  },

  getSearchSuggestions: async (q: string): Promise<string[]> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const ql = q.toLowerCase();
          return products
              .filter(p => p.status === AdStatus.ACTIVE && (
                  p.title.toLowerCase().includes(ql) ||
                  p.description.toLowerCase().includes(ql) ||
                  p.location.toLowerCase().includes(ql)
              ))
              .map(p => p.title)
              .filter((t, i, arr) => arr.indexOf(t) === i)
              .slice(0, 5);
      }
      return apiClient.get<string[]>(`/search/suggest?q=${q}`);
  },
  
  getWalletTransactions: async () => {
      if (USE_MOCK_DATA) {
          return db.get<WalletTransaction[]>('transactions', []);
      }
      return apiClient.get('/wallet/transactions');
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
      return true;
  },
  
  // --- REAL-TIME CHAT IMPLEMENTATION (LOCAL STORAGE) ---
  getConversations: async (): Promise<ChatConversation[]> => {
      if (USE_MOCK_DATA) {
          // Instant response for better feel
          return db.get<ChatConversation[]>('conversations', []);
      }
      return apiClient.get('/chat/conversations');
  },
  
  getMessages: async (id: string): Promise<ChatMessage[]> => {
      if (USE_MOCK_DATA) {
          // Instant response
          const allMessages = db.get<MessageRecord>('messages', {});
          return allMessages[id] || [];
      }
      return apiClient.get(`/chat/${id}/messages`);
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
      return apiClient.post<ChatMessage>(`/chat/${id}/messages`, { text });
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
      return 'c1'; // Fallback for real API pending impl
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
      return false;
  },

  updateAdStatus: async (id: string, status: AdStatus) => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const updated = products.map(p => p.id === id ? { ...p, status } : p);
          db.save('products', updated);
          return true;
      }
      return true;
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
      return true;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      return apiClient.get('/user/favorites');
  },

  getFavorites: async () => {
      if (USE_MOCK_DATA) {
          const favorites = db.get<string[]>('favorites', []);
          const products = db.get<Product[]>('products', []);
          const favProducts = products.filter(p => favorites.includes(p.id));
          return favProducts.map(p => ({ ...p, isFavorite: true }));
      }
      return apiClient.get('/user/favorites');
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (): Promise<Notification[]> => {
      if (USE_MOCK_DATA) {
          return db.get<Notification[]>('notifications', []);
      }
      return apiClient.get('/user/notifications');
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
     return apiClient.get('/admin/ads/pending');
  },
  
  adminGetPendingVerifications: async (): Promise<User[]> => {
      if (USE_MOCK_DATA) {
          const users = db.get<User[]>('users', []);
          return users.filter(u => u.verificationStatus === 'PENDING');
      }
      return apiClient.get('/admin/users/pending-verification');
  },

  adminApproveAd: async (id: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
          const products = db.get<Product[]>('products', []);
          const updated = products.map(p => p.id === id ? { ...p, status: AdStatus.ACTIVE } : p);
          db.save('products', updated);
          return true;
      }
      return apiClient.post(`/admin/ads/${id}/approve`, {});
  },

  adminRejectAd: async (id: string): Promise<boolean> => {
      if (USE_MOCK_DATA) {
        const products = db.get<Product[]>('products', []);
        const updated = products.map(p => p.id === id ? { ...p, status: AdStatus.REJECTED } : p);
        db.save('products', updated);
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
      return [];
  }
};
