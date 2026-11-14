import { Calendar, CircleUser, House, Library, TrendingUp, type LucideIcon } from 'lucide-react';

export const SECTION = {
  TODAY: 'today',
  CALENDAR: 'calendar',
  LIBRARY: 'library',
  PROGRESS: 'progress',
  PROFILE: 'profile',
} as const;

export type Section = (typeof SECTION)[keyof typeof SECTION];

export interface NavItem {
  section: Section;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { section: SECTION.TODAY, href: '/today', icon: House },
  { section: SECTION.CALENDAR, href: '/calendar', icon: Calendar },
  { section: SECTION.LIBRARY, href: '/library/workouts', icon: Library },
  { section: SECTION.PROGRESS, href: '/progress', icon: TrendingUp },
  { section: SECTION.PROFILE, href: '/profile', icon: CircleUser },
];
