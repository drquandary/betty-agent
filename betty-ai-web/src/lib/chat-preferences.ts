export type ChatProvider = 'claude-code' | 'local-qwen' | 'openai' | 'litellm-parcc';

export type ChatProviderInput = ChatProvider | 'chatgpt-login';

export interface ChatPreferencesInput {
  provider?: ChatProviderInput;
  model?: string;
  baseUrl?: string;
}

export interface ChatPreferences {
  provider: ChatProvider;
  label: string;
  model: string;
  baseUrl?: string;
}

export const CHAT_PREFERENCES_STORAGE_KEY = 'betty-ai-chat-preferences';

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  provider: 'claude-code',
  label: 'Claude Code',
  model: 'claude-sonnet-4-5',
};

const LOCAL_QWEN_DEFAULT_BASE_URL = 'http://127.0.0.1:1234/v1';
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LITELLM_PARCC_DEFAULT_BASE_URL = 'https://litellm.parcc.upenn.edu/v1';

const LOCAL_QWEN_DEFAULTS: ChatPreferences = {
  provider: 'local-qwen',
  label: 'Local Qwen',
  model: 'qwen/qwen3.6-35b-a3b',
  baseUrl: LOCAL_QWEN_DEFAULT_BASE_URL,
};

const OPENAI_DEFAULTS: ChatPreferences = {
  provider: 'openai',
  label: 'OpenAI',
  model: 'gpt-4o-mini',
  baseUrl: OPENAI_DEFAULT_BASE_URL,
};

const LITELLM_PARCC_DEFAULTS: ChatPreferences = {
  provider: 'litellm-parcc',
  label: 'PARCC LiteLLM',
  model: 'openai/gpt-oss-120b',
  baseUrl: LITELLM_PARCC_DEFAULT_BASE_URL,
};

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/v1') ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`;
}

export function resolveChatPreferences(input: unknown): ChatPreferences {
  if (!input || typeof input !== 'object') return DEFAULT_CHAT_PREFERENCES;

  const raw = input as ChatPreferencesInput;
  const provider = raw.provider === 'chatgpt-login' ? 'openai' : raw.provider;

  if (provider === 'local-qwen') {
    return {
      ...LOCAL_QWEN_DEFAULTS,
      model: raw.model?.trim() || LOCAL_QWEN_DEFAULTS.model,
      baseUrl: normalizeBaseUrl(raw.baseUrl, LOCAL_QWEN_DEFAULT_BASE_URL),
    };
  }

  if (provider === 'openai') {
    return {
      ...OPENAI_DEFAULTS,
      model: raw.model?.trim() || OPENAI_DEFAULTS.model,
      baseUrl: normalizeBaseUrl(raw.baseUrl, OPENAI_DEFAULT_BASE_URL),
    };
  }

  if (provider === 'litellm-parcc') {
    return {
      ...LITELLM_PARCC_DEFAULTS,
      model: raw.model?.trim() || LITELLM_PARCC_DEFAULTS.model,
      baseUrl: normalizeBaseUrl(raw.baseUrl, LITELLM_PARCC_DEFAULT_BASE_URL),
    };
  }

  return {
    ...DEFAULT_CHAT_PREFERENCES,
    model: raw.model?.trim() || DEFAULT_CHAT_PREFERENCES.model,
  };
}

export function readStoredChatPreferences(): ChatPreferences {
  if (typeof window === 'undefined') return DEFAULT_CHAT_PREFERENCES;

  try {
    const stored = window.localStorage.getItem(CHAT_PREFERENCES_STORAGE_KEY);
    return resolveChatPreferences(stored ? JSON.parse(stored) : undefined);
  } catch {
    return DEFAULT_CHAT_PREFERENCES;
  }
}

export function writeStoredChatPreferences(preferences: ChatPreferencesInput): ChatPreferences {
  const resolved = resolveChatPreferences(preferences);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CHAT_PREFERENCES_STORAGE_KEY, JSON.stringify(resolved));
    window.dispatchEvent(new CustomEvent('betty-ai:preferences-changed', { detail: resolved }));
  }
  return resolved;
}
