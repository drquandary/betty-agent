import {
  DEFAULT_CHAT_PREFERENCES,
  resolveChatPreferences,
  type ChatPreferences,
} from '../lib/chat-preferences';

export { DEFAULT_CHAT_PREFERENCES, resolveChatPreferences, type ChatPreferences };

const PLACEHOLDER_API_KEYS = new Set([
  'your_api_key_here',
  'your-api-key-here',
  'sk-ant-your-api-key-here',
  'anthropic_api_key_here',
]);

export function shouldIgnoreAnthropicApiKey(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_API_KEYS.has(trimmed.toLowerCase());
}

export function prepareClaudeEnvironment(): void {
  if (shouldIgnoreAnthropicApiKey(process.env.ANTHROPIC_API_KEY)) {
    delete process.env.ANTHROPIC_API_KEY;
  }
}
