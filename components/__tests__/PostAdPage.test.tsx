import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PostAd from '../../pages/PostAd';

const {
  mockUploadImage,
  mockOnAuthInvalid,
  mockToastError,
  mockIsStorageAvailable,
  mockGetToken,
} = vi.hoisted(() => ({
  mockUploadImage: vi.fn(),
  mockOnAuthInvalid: vi.fn(),
  mockToastError: vi.fn(),
  mockIsStorageAvailable: vi.fn(),
  mockGetToken: vi.fn(),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../components/LocationPicker', () => ({
  default: () => <div data-testid="location-picker" />,
}));

vi.mock('../../services/geminiService', () => ({
  generateAdDescription: vi.fn(),
}));

vi.mock('../../services/azureService', () => ({
  azureService: {
    uploadImage: mockUploadImage,
    getMyAds: vi.fn(),
    postAd: vi.fn(),
    updateAd: vi.fn(),
  },
}));

vi.mock('../../services/authService', () => ({
  authService: {
    getToken: mockGetToken,
    getCurrentUser: vi.fn(),
    isTokenExpired: vi.fn(),
    refreshToken: vi.fn(),
    onAuthInvalid: mockOnAuthInvalid,
  },
}));

vi.mock('../../services/toastService', () => ({
  toastService: {
    error: mockToastError,
    success: vi.fn(),
    warning: vi.fn(),
    errorWithId: vi.fn(),
  },
}));

vi.mock('../../utils/safeStorage', () => ({
  safeStorage: {
    isAvailable: mockIsStorageAvailable,
  },
}));

describe('PostAd image upload auth handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows storage-blocked message and does not invalidate auth when token is missing during image upload', () => {
    mockGetToken.mockReturnValue(null);
    mockIsStorageAvailable.mockReturnValue(false);

    const onNavigate = vi.fn();
    const { container } = render(<PostAd onNavigate={onNavigate} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockToastError).toHaveBeenCalledWith('مرورگر شما دسترسی به حافظه را مسدود کرده. لطفاً کوکی‌ها را فعال کنید و دوباره تلاش کنید.');
    expect(mockOnAuthInvalid).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});
