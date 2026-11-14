import { arrayMove } from '@dnd-kit/sortable';
import { useReducer } from 'react';
import type { WorkoutTargets } from '@/constants/workout';
import type { Draft, DraftItem } from '../types';

export type DraftAction =
  | { type: 'reset'; draft: Draft }
  | { type: 'setName'; name: string }
  | { type: 'setDescription'; description: string }
  | { type: 'add'; items: DraftItem[]; index?: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'remove'; key: string }
  | { type: 'setTargets'; key: string; patch: Partial<WorkoutTargets> }
  | { type: 'setNotes'; key: string; notes: string };

export function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'reset':
      return action.draft;
    case 'setName':
      return { ...draft, name: action.name };
    case 'setDescription':
      return { ...draft, description: action.description };
    case 'add': {
      const index = action.index ?? draft.items.length;
      const items = [...draft.items];
      items.splice(index, 0, ...action.items);
      return { ...draft, items };
    }
    case 'move':
      return { ...draft, items: arrayMove(draft.items, action.from, action.to) };
    case 'remove':
      return { ...draft, items: draft.items.filter((item) => item.key !== action.key) };
    case 'setTargets':
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.key === action.key
            ? { ...item, targets: { ...item.targets, ...action.patch } }
            : item,
        ),
      };
    case 'setNotes':
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.key === action.key ? { ...item, notes: action.notes } : item,
        ),
      };
  }
}

export function useWorkoutDraft(initial: Draft) {
  return useReducer(draftReducer, initial);
}
