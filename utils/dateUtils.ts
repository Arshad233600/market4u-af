
// Utility to format dates in Solar Hijri (Persian) calendar used in Afghanistan

export const toJalali = (dateInput: string | Date | number): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput); // Return original if invalid

    return new Intl.DateTimeFormat('fa-AF', {
      calendar: 'persian',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch (e) {
    console.error("Date formatting error", e);
    return String(dateInput);
  }
};

export const toJalaliWithTime = (dateInput: string | Date | number): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('fa-AF', {
      calendar: 'persian',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(dateInput);
  }
};

export const getRelativeTime = (dateInput: string | Date): string => {
    // Simple relative time in Persian
    const now = new Date();
    const date = new Date(dateInput);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'همین الان';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} دقیقه پیش`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ساعت پیش`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} روز پیش`;
    
    return toJalali(date);
};
