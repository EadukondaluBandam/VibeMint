import type { Interest } from '@prisma/client';
import type { InterestCategory } from '@vibemint/types';

export type { Interest };

export interface FormattedInterest {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type { InterestCategory };
