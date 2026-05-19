import React from 'react';
import {
  ShoppingCart,
  Pill,
  Home,
  Leaf,
  Milk,
  Beef,
  Wheat,
  Cake,
  Popcorn,
  Wine,
  Snowflake,
  Sparkles,
  Package,
  Droplet,
  Brush,
  Sofa,
  Lightbulb,
  Palette,
  Hammer,
  FileText,
  Users,
  Settings,
  ChevronLeft,
} from 'lucide-react';

const EMOJI_TO_ICON: Record<string, React.ReactNode> = {
  '🛒': <ShoppingCart size={20} />,
  '💊': <Pill size={20} />,
  '🏠': <Home size={20} />,
  '🥬': <Leaf size={20} />,
  '🥛': <Milk size={20} />,
  '🥩': <Beef size={20} />,
  '🌾': <Wheat size={20} />,
  '🧁': <Cake size={20} />,
  '🍿': <Popcorn size={20} />,
  '🥤': <Wine size={20} />,
  '🧊': <Snowflake size={20} />,
  '🧽': <Sparkles size={20} />,
  '📦': <Package size={20} />,
  '🧼': <Droplet size={20} />,
  '💅': <Brush size={20} />,
  '🧻': <Sparkles size={20} />,
  '🏥': <Pill size={20} />,
  '🛋️': <Sofa size={20} />,
  '🔌': <Lightbulb size={20} />,
  '🖼️': <Palette size={20} />,
  '🪛': <Hammer size={20} />,
  '📝': <FileText size={20} />,
  '👥': <Users size={20} />,
  '⚙': <Settings size={20} />,
  '›': <ChevronLeft size={20} />,
};

export function EmojiIcon({ emoji }: { emoji: string }) {
  return (
    <span className="flex items-center justify-center">
      {EMOJI_TO_ICON[emoji] || emoji}
    </span>
  );
}

export function getSectionIcon(emoji: string) {
  return EMOJI_TO_ICON[emoji] || emoji;
}
