
import React from 'react';
import { CATEGORIES } from '../constants';
import Icon from '../src/components/ui/Icon';
import { IconName } from '../src/components/ui/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { TRANSLATIONS } from '../translations';

interface CategoryPillsProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

const CategoryPills: React.FC<CategoryPillsProps> = ({ selectedId, onSelect }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
      <div className="flex gap-2 px-4 min-w-max">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedId === cat.id;
          
          // Translate Name
          const translatedName = t(cat.translationKey as keyof typeof TRANSLATIONS['fa']);

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                isSelected 
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm scale-105' 
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Icon name={(cat.icon || 'MoreHorizontal') as IconName} size={18} strokeWidth={1.8} />
              <span>{translatedName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryPills;
