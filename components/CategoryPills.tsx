
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
    <div className="w-full overflow-x-auto no-scrollbar py-2">
      <div className="flex gap-2 px-1 min-w-max">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedId === cat.id;
          const translatedName = t(cat.translationKey as keyof typeof TRANSLATIONS['fa']);

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 border press whitespace-nowrap ${
                isSelected
                  ? 'bg-brand-gradient text-white border-transparent shadow-glow'
                  : 'bg-ui-surface2 text-ui-muted border-ui-border hover:bg-ui-surface3 hover:text-ui-text hover:border-ui-border2'
              }`}
            >
              <Icon
                name={(cat.icon || 'MoreHorizontal') as IconName}
                size={17}
                strokeWidth={isSelected ? 2.5 : 2}
                className={isSelected ? 'text-white' : ''}
              />
              <span>{translatedName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryPills;
