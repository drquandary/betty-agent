import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAT_PREFERENCES,
  resolveChatPreferences,
  shouldIgnoreAnthropicApiKey,
} from './providers';

describe('resolveChatPreferences', () => {
  it('defaults to Claude Code with the Betty tool-enabled model', () => {
    expect(resolveChatPreferences(undefined)).toEqual(DEFAULT_CHAT_PREFERENCES);
  });

  it('normalizes local Qwen to the OpenAI-compatible local server', () => {
    expect(resolveChatPreferences({ provider: 'local-qwen' })).toMatchObject({
      provider: 'local-qwen',
      label: 'Local Qwen',
      model: 'qwen/qwen3.6-35b-a3b',
      baseUrl: 'http://127.0.0.1:1234/v1',
    });
  });

  it('treats ChatGPT login as OpenAI API-key compatible chat', () => {
    expect(resolveChatPreferences({ provider: 'chatgpt-login' })).toMatchObject({
      provider: 'openai',
      label: 'OpenAI',
    });
  });
});

describe('shouldIgnoreAnthropicApiKey', () => {
  it('ignores blank and placeholder keys so Claude Code OAuth can be used', () => {
    expect(shouldIgnoreAnthropicApiKey('')).toBe(true);
    expect(shouldIgnoreAnthropicApiKey('your_api_key_here')).toBe(true);
    expect(shouldIgnoreAnthropicApiKey('sk-ant-api03-realish')).toBe(false);
  });
});
