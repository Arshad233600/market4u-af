export type Currency = 'AFN';

export type ProductCondition = 'new' | 'used' | 'damaged';

export enum AdStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  SOLD = 'SOLD',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED' // Added for Soft Delete functionality
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatarUrl: string;
  isVerified: boolean;
  verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'; 
  joinDate: string;
  role: 'USER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED'; // Added for User Account Status
  province?: string; // ولایت - province of the user
  rating?: number; 
  reviewCount?: number;
  responseTime?: string; // e.g., "پاسخ‌دهی در کمتر از ۱ ساعت"
}

export interface UserSuggestion {
  id: string;
  name: string;
  province: string;
  avatarUrl?: string;
}

export interface Review {
  id: string;
  userId: string; 
  userName: string;
  rating: number; 
  comment: string;
  date: string;
}

export interface Product {
  id: string;
  userId: string; 
  title: string;
  price: number;
  currency: Currency;
  location: string; 
  latitude?: number;  // Added for Map
  longitude?: number; // Added for Map
  imageUrl: string;
  imageUrls?: string[]; 
  category: string;
  subCategory?: string;
  description: string;
  sellerName: string; 
  postedDate: string;
  status: AdStatus;
  views: number;
  isPromoted?: boolean;
  isFavorite?: boolean; 
  condition?: ProductCondition;
  isNegotiable?: boolean;
  deliveryAvailable?: boolean;
  dynamicFields?: Record<string, string | number>;
}

export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string; 
  translationKey: string; 
  icon: string;
  subcategories?: SubCategory[];
  filterConfig?: FilterConfig[]; 
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'range' | 'text';
  options?: string[];
  min?: number;      
  max?: number;      
  unit?: string;     
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT_AD_PROMO';
  date: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  description: string;
}

export type MessageStatus = 'PENDING' | 'SENT' | 'FAILED';
export type MessageType = 'TEXT' | 'AUDIO';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string; 
  type?: MessageType;
  duration?: number; 
  timestamp: string;
  isRead: boolean;
  status?: MessageStatus; 
  localId?: string;
  isDeleted?: boolean; // Added for message deletion
}

export interface ChatConversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  productId: string;
  productTitle: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface DashboardStats {
  totalAds: number;
  activeAds: number;
  totalViews: number;
  unreadMessages: number;
  walletBalance: number;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  /** Full UUID v4 requestId – when present a "Copy ID" button is shown. */
  requestId?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ChatRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export enum Page {
  HOME = 'home',
  POST_AD = 'post_ad',
  EDIT_AD = 'edit_ad', // Added for Edit functionality
  DETAIL = 'detail',
  PROFILE = 'profile',
  LOGIN = 'login',
  REGISTER = 'register',
  FAVORITES = 'favorites', 
  SELLER_PROFILE = 'seller_profile',
  
  // Static Pages
  ABOUT_US = 'about_us',
  TERMS = 'terms',
  PRIVACY = 'privacy',
  SAFETY = 'safety',
  CONTACT_US = 'contact_us',
  NOT_FOUND = 'not_found',

  // Dashboard Sub-pages
  DASHBOARD = 'dashboard',
  DASHBOARD_ADS = 'dashboard_ads',
  DASHBOARD_WALLET = 'dashboard_wallet',
  DASHBOARD_CHAT = 'dashboard_chat',
  DASHBOARD_SETTINGS = 'dashboard_settings',
  DASHBOARD_FAVORITES = 'dashboard_favorites'
}
