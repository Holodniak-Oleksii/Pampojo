import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

/** Press and hold the handle this long before the item lifts, so a quick tap or scroll does nothing. */
const HOLD_MS = 200;
const CANCEL_DISTANCE_PX = 8;

export interface DragHandleProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  style: { touchAction: 'none' };
  'aria-pressed': boolean;
}

/**
 * Reorders a list or grid by dragging a handle. The item under the pointer swaps places as the
 * pointer moves over it, so the same hook serves a vertical list and a two-column grid. Arrow keys
 * on a focused handle move the item too.
 */
export function useDragReorder(onMove: (from: number, to: number) => void, count: number) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const current = useRef<number | null>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  const itemRef = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      items.current[index] = node;
    },
    [],
  );

  function indexAt(x: number, y: number): number | null {
    for (let index = 0; index < count; index++) {
      const rect = items.current[index]?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return index;
      }
    }
    return null;
  }

  function handleProps(index: number): DragHandleProps {
    return {
      style: { touchAction: 'none' },
      'aria-pressed': active === index,
      onKeyDown: (event) => {
        const by =
          event.key === 'ArrowUp' || event.key === 'ArrowLeft'
            ? -1
            : event.key === 'ArrowDown' || event.key === 'ArrowRight'
              ? 1
              : 0;
        const target = index + by;
        if (by === 0 || target < 0 || target >= count) return;
        event.preventDefault();
        onMove(index, target);
      },
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        const handle = event.currentTarget;
        const start = { x: event.clientX, y: event.clientY };
        const pointerId = event.pointerId;
        let lifted = false;

        const timer = window.setTimeout(() => {
          lifted = true;
          current.current = index;
          setActive(index);
          handle.setPointerCapture?.(pointerId);
        }, HOLD_MS);

        const move = (moveEvent: globalThis.PointerEvent) => {
          if (moveEvent.pointerId !== pointerId) return;
          if (!lifted) {
            const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
            if (distance > CANCEL_DISTANCE_PX) end();
            return;
          }
          moveEvent.preventDefault();
          const from = current.current;
          const to = indexAt(moveEvent.clientX, moveEvent.clientY);
          if (from !== null && to !== null && to !== from) {
            onMove(from, to);
            current.current = to;
            setActive(to);
          }
        };

        const end = () => {
          window.clearTimeout(timer);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          current.current = null;
          setActive(null);
          cleanup.current = () => {};
        };

        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        cleanup.current = end;
      },
    };
  }

  return { active, itemRef, handleProps };
}
