
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { TRANSLATIONS, Language } from '../translations';
import { safeStorage } from '../utils/safeStorage';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof TRANSLATIONS['fa']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = safeStorage.getItem('app_language');
    return (saved === 'fa' || saved === 'ps') ? saved : 'fa';
  });

  useEffect(() => {
    safeStorage.setItem('app_language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fa' ? 'ps' : 'fa');
  };

  const t = (key: keyof typeof TRANSLATIONS['fa']) => {
    return TRANSLATIONS[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      <div className={language === 'ps' ? 'font-pashto' : 'font-dari'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
