import messages from '@/messages/he.json';
import type { ListType } from './list-types';

export function getProgressLabel(type: ListType, ticked: number, total: number): string {
  if (total === 0) return messages.items.emptyListTitle;

  if (type === 'vacation_abroad') {
    if (ticked === 0) return messages.items.packingNotStarted;
    if (ticked === total) return messages.items.packingComplete;
    return messages.items.packingInProgress;
  }

  if (ticked === 0) return messages.items.shoppingNotStarted;
  if (ticked === total) return messages.items.shoppingComplete;
  return messages.items.shoppingInProgress;
}

export function shouldShowCompleteTrip(type: ListType, ticked: number): boolean {
  return type !== 'vacation_abroad' && ticked > 0;
}
