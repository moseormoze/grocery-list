import messages from '@/messages/he.json';
import type { ListType } from './list-types';

export type ListTemplateItem = {
  name: string;
  qty: null;
  section_id: string;
  order_index: number;
};

const vacationSections = [
  ['documents_money', messages.vacationAbroad.items.documentsMoney],
  ['electronics', messages.vacationAbroad.items.electronics],
  ['health_toiletries', messages.vacationAbroad.items.healthToiletries],
  ['clothing_footwear', messages.vacationAbroad.items.clothingFootwear],
  ['sea_pool', messages.vacationAbroad.items.seaPool],
  ['flight_transit', messages.vacationAbroad.items.flightTransit],
] as const;

export const VACATION_ABROAD_TEMPLATE: ListTemplateItem[] = vacationSections
  .flatMap(([sectionId, names]) => names.map((name) => ({ name, section_id: sectionId })))
  .map((item, orderIndex) => ({ ...item, qty: null, order_index: orderIndex }));

export function getInitialItemsForListType(type: ListType): ListTemplateItem[] {
  if (type !== 'vacation_abroad') return [];
  return VACATION_ABROAD_TEMPLATE.map((item) => ({ ...item }));
}
