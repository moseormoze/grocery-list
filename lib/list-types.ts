import messages from '@/messages/he.json';

export const LIST_TYPES = ['supermarket', 'pharmacy', 'house', 'vacation_abroad'] as const;

export type ListType = (typeof LIST_TYPES)[number];

type ListTypeMeta = {
  label: string;
  emoji: string;
  tint: string;
  categoryCount: number;
  createSubtitle: string;
  listNamePlaceholder: string;
  itemNamePlaceholder: string;
  itemQtyPlaceholder: string;
};

export const LIST_TYPE_META: Record<ListType, ListTypeMeta> = {
  supermarket: {
    label: messages.lists.supermarket,
    emoji: '🛒',
    tint: '#FBE5DC',
    categoryCount: 11,
    createSubtitle: messages.lists.defaultTypeSubtitle,
    listNamePlaceholder: messages.lists.listNamePlaceholder,
    itemNamePlaceholder: messages.lists.supermarketItemPlaceholder,
    itemQtyPlaceholder: messages.lists.supermarketQtyPlaceholder,
  },
  pharmacy: {
    label: messages.lists.pharmacy,
    emoji: '💊',
    tint: '#E4EEF3',
    categoryCount: 7,
    createSubtitle: messages.lists.defaultTypeSubtitle,
    listNamePlaceholder: messages.lists.listNamePlaceholder,
    itemNamePlaceholder: messages.lists.pharmacyItemPlaceholder,
    itemQtyPlaceholder: messages.lists.pharmacyQtyPlaceholder,
  },
  house: {
    label: messages.lists.house,
    emoji: '🏠',
    tint: '#F2E9D5',
    categoryCount: 6,
    createSubtitle: messages.lists.defaultTypeSubtitle,
    listNamePlaceholder: messages.lists.listNamePlaceholder,
    itemNamePlaceholder: messages.lists.houseItemPlaceholder,
    itemQtyPlaceholder: messages.lists.houseQtyPlaceholder,
  },
  vacation_abroad: {
    label: messages.lists.vacationAbroad,
    emoji: '🧳',
    tint: '#EAE4F3',
    categoryCount: 7,
    createSubtitle: messages.lists.vacationTypeSubtitle,
    listNamePlaceholder: messages.lists.vacationNamePlaceholder,
    itemNamePlaceholder: messages.items.vacationNamePlaceholder,
    itemQtyPlaceholder: messages.items.vacationQtyPlaceholder,
  },
};
