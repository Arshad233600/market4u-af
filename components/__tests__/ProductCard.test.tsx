import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Product } from '../../types';

// Mock external service dependency
vi.mock('../../services/azureService', () => ({
  azureService: {
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock OptimizedImage to a simple img element
vi.mock('../OptimizedImage', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

// Mock LanguageContext used indirectly
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, toggleLanguage: vi.fn() }),
}));

import ProductCard from '../ProductCard';

const mockProduct: Product = {
  id: 'prod-1',
  userId: 'user-1',
  title: 'لپ‌تاپ دل XPS 15',
  price: 45000,
  currency: 'AFN',
  location: 'کابل',
  imageUrl: 'https://example.com/laptop.jpg',
  category: 'electronics',
  description: 'لپتاپ در حالت خوب',
  sellerName: 'احمد',
  postedDate: '2024-01-01T10:00:00Z',
  isFavorite: false,
  isPromoted: false,
  deliveryAvailable: false,
  isNegotiable: false,
  condition: 'used',
};

describe('ProductCard', () => {
  it('renders the product title', () => {
    render(<ProductCard product={mockProduct} onClick={vi.fn()} />);
    expect(screen.getByText('لپ‌تاپ دل XPS 15')).toBeInTheDocument();
  });

  it('renders the product price', () => {
    render(<ProductCard product={mockProduct} onClick={vi.fn()} />);
    expect(screen.getByText('45,000')).toBeInTheDocument();
  });

  it('renders the product location', () => {
    render(<ProductCard product={mockProduct} onClick={vi.fn()} />);
    expect(screen.getByText('کابل')).toBeInTheDocument();
  });

  it('calls onClick when the card is clicked', () => {
    const handleClick = vi.fn();
    render(<ProductCard product={mockProduct} onClick={handleClick} />);
    fireEvent.click(screen.getByText('لپ‌تاپ دل XPS 15'));
    expect(handleClick).toHaveBeenCalledWith(mockProduct);
  });

  it('renders the product image with correct alt text', () => {
    render(<ProductCard product={mockProduct} onClick={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'لپ‌تاپ دل XPS 15');
  });

  it('renders "ویژه" badge when product is promoted', () => {
    render(<ProductCard product={{ ...mockProduct, isPromoted: true }} onClick={vi.fn()} />);
    expect(screen.getByText('ویژه')).toBeInTheDocument();
  });

  it('renders "ارسال" badge when delivery is available', () => {
    render(<ProductCard product={{ ...mockProduct, deliveryAvailable: true }} onClick={vi.fn()} />);
    expect(screen.getByText('ارسال')).toBeInTheDocument();
  });

  it('renders "قابل معامله" badge when product is negotiable', () => {
    render(<ProductCard product={{ ...mockProduct, isNegotiable: true }} onClick={vi.fn()} />);
    expect(screen.getByText('قابل معامله')).toBeInTheDocument();
  });

  it('does not call onClick when favorite button is clicked', () => {
    const handleClick = vi.fn();
    render(<ProductCard product={mockProduct} onClick={handleClick} />);
    fireEvent.click(screen.getByLabelText('افزودن به علاقه‌مندی'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
