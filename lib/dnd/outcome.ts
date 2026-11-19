import { arrayMove } from '@dnd-kit/sortable';
import type { Item } from '@/lib/db/types';

export type DragOutcome =
  | { kind: 'none' }
  | { kind: 'reorder'; sectionId: string; orderedIds: string[] }
  | { kind: 'move'; itemId: string; toSectionId: string };

export function computeDragOutcome(args: {
  activeId: string;
  overId: string | null;
  items: Item[];
}): DragOutcome {
  const { activeId, overId, items } = args;

  if (!overId || activeId === overId) return { kind: 'none' };

  const active = items.find((i) => i.id === activeId);
  if (!active) return { kind: 'none' };

  const over = items.find((i) => i.id === overId);
  if (!over) return { kind: 'none' };

  const activeSection = active.section_id ?? 'other';
  const overSection = over.section_id ?? 'other';

  if (activeSection !== overSection) {
    return { kind: 'none' };
  }

  const sectionItems = items.filter(
    (i) => (i.section_id ?? 'other') === activeSection
  );
  const oldIndex = sectionItems.findIndex((i) => i.id === activeId);
  const newIndex = sectionItems.findIndex((i) => i.id === overId);
  if (oldIndex === -1 || newIndex === -1) return { kind: 'none' };

  const reordered = arrayMove(sectionItems, oldIndex, newIndex);
  return {
    kind: 'reorder',
    sectionId: activeSection,
    orderedIds: reordered.map((i) => i.id),
  };
}
