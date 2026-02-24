import React from 'react';
import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

export type IconName = keyof typeof LucideIcons;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Standardized Icon Component using lucide-react
 * 
 * Usage:
 *   <Icon name="Home" />
 *   <Icon name="User" size={24} className="text-brand-600" />
 *   <Icon name="Settings" strokeWidth={2.0} aria-label="Settings" />
 * 
 * Design Standards:
 * - Default size: 20px
 * - Default strokeWidth: 1.8
 * - Allowed sizes: 18, 20, 24
 * - Default color: text-ui-muted
 * - Active/primary: text-brand-600
 * - Hover: text-brand-500
 */
export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 20, 
  strokeWidth = 1.8,
  className = '',
  'aria-label': ariaLabel,
  ...props 
}) => {
  const IconComponent = LucideIcons[name] as React.ComponentType<LucideProps>;
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-label={ariaLabel || name}
      {...props}
    />
  );
};

export default Icon;
