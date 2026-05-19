import messages from '@/messages/he.json';

/**
 * Simple i18n helper for Hebrew (MVP only).
 * Returns translated string from messages/he.json.
 */
export function useTranslations() {
  const t = (key: string, vars?: Record<string, any>): string => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
    }

    if (!value) {
      console.warn(`Missing translation key: ${key}`);
      return key;
    }

    if (vars && typeof value === 'string') {
      return value.replace(/{(\w+)}/g, (match, varKey) => {
        return vars[varKey] ?? match;
      });
    }

    return String(value);
  };

  return { t };
}

export { messages };
