import type { Item } from './db/types';

export function formatCopyList(items: readonly Pick<Item, 'name' | 'qty' | 'ticked'>[]): string {
  return items
    .filter((item) => !item.ticked)
    .map((item) => item.qty?.trim() ? `${item.name} — ${item.qty}` : item.name)
    .join('\n');
}
