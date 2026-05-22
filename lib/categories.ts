export type ListType = 'supermarket' | 'pharmacy' | 'house';

export type SectionInfo = {
  name: string;
  emoji: string;
  tint: string;
  ink: string;
};

export const SECTIONS_BY_TYPE: Record<ListType, Record<string, SectionInfo>> = {
  supermarket: {
    produce: { name: 'ירקות ופירות', emoji: '🥬', tint: '#E8F1DD', ink: '#4F6E32' },
    milk: { name: 'מוצרי חלב', emoji: '🥛', tint: '#E7F1F7', ink: '#3B6C8C' },
    meat: { name: 'בשר ודגים', emoji: '🥩', tint: '#F6E0DA', ink: '#A0432F' },
    dry: { name: 'מזווה', emoji: '🌾', tint: '#F2E9D5', ink: '#8A6A2B' },
    sauces: { name: 'רטבים וממרחים', emoji: '🥫', tint: '#F5E6CC', ink: '#8B5E20' },
    baking: { name: 'אפייה ומאפייה', emoji: '🧁', tint: '#F7E2E8', ink: '#A24566' },
    snacks: { name: 'חטיפים', emoji: '🍿', tint: '#FAE7CB', ink: '#A86220' },
    drinks: { name: 'משקאות', emoji: '🥤', tint: '#E6E2F0', ink: '#564B86' },
    frozen: { name: 'קפואים', emoji: '🧊', tint: '#E0EBF2', ink: '#3D6580' },
    cleaning: { name: 'ניקיון', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
  pharmacy: {
    hygiene: { name: 'הגיינה', emoji: '🧼', tint: '#E8F1DD', ink: '#4F6E32' },
    cleaning: { name: 'מוצרי ניקוי', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
    cosmetics: { name: 'קוסמטיקה', emoji: '💅', tint: '#FAE7CB', ink: '#A86220' },
    paper: { name: 'מוצרי נייר', emoji: '🧻', tint: '#E0EBF2', ink: '#3D6580' },
    medicine_cabinet: { name: 'מזווה', emoji: '🏥', tint: '#F7E2E8', ink: '#A24566' },
    pharmacy_medicines: { name: 'בית מרקחת ותרופות', emoji: '💊', tint: '#E7F1F7', ink: '#3B6C8C' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
  house: {
    furniture: { name: 'רהיט', emoji: '🛋️', tint: '#F2E9D5', ink: '#8A6A2B' },
    appliance: { name: 'מכשיר חשמל', emoji: '🔌', tint: '#E7F1F7', ink: '#3B6C8C' },
    decor: { name: 'עיצוב וקישוט', emoji: '🖼️', tint: '#F7E2E8', ink: '#A24566' },
    tools: { name: 'כלים וחומרים', emoji: '🪛', tint: '#FAE7CB', ink: '#A86220' },
    storage: { name: 'איחסון', emoji: '📦', tint: '#E8F1DD', ink: '#4F6E32' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
};
