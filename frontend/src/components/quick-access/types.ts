import type { ReactNode } from 'react';

export type AccessRole = 'user' | 'manager';

export type ActionItem = {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  gradient: string;
  notificationCount?: number;
  role?: AccessRole;
  href?: string;
  disabled?: boolean;
};

export interface QuickAccessOrbProps {
  items: ActionItem[];
  className?: string;
  autoSpinSpeed?: number;
  ringSize?: number;
  innerSize?: number;
  onSelect?: (id: string) => void;
}


