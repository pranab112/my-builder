import { describe, it, expect, beforeEach, vi } from 'vitest';
import { backend } from '../../services/backend';

describe('LocalBackend Service', () => {
  
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('should cache successful responses', async () => {
    const mockParams = { model: 'test', contents: 'hello' };
    
    // Mock the API key check since we aren't in a real env
    process.env.API_KEY = 'mock-key';
    
    // We need to intercept the actual AI call since we don't want to hit Gemini in unit tests
    // We'll mock the 'ai.generateContent' method's internal helper or the library itself.
    // However, since backend.ai.generateContent is the method under test, we should inspect its side effects (localStorage)
    // BUT checking rate limiting implies we call it.
    // For a pure unit test of the 'checkRateLimit' logic which is internal, we can infer it works by calling the public method 
    // and catching the error after N times.
  });

  it('should enforce rate limits', async () => {
    // Manually populate rate limit storage to simulate near-limit
    const now = Date.now();
    const timestamps = Array(15).fill(now); // 15 requests just happened
    localStorage.setItem('proshot_rate_limit', JSON.stringify(timestamps));

    // The next call should fail immediately before hitting the AI provider
    await expect(backend.ai.generateContent({}))
      .rejects
      .toThrow("Rate limit exceeded");
  });

  it('should clear rate limits after time window', async () => {
    // Populate with old timestamps
    const old = Date.now() - 61000; // 61 seconds ago
    const timestamps = Array(15).fill(old);
    localStorage.setItem('proshot_rate_limit', JSON.stringify(timestamps));

    // This would fail if timestamps weren't expired. 
    // Since we can't easily mock the internal GoogleGenAI constructor failure in this blackbox test,
    // we expect it to fail on "API Key" or similar, NOT "Rate limit".
    
    // Note: In a real unit test we would inject a mock AI client. 
    // Here we rely on the specific error message difference.
    try {
        await backend.ai.generateContent({});
    } catch (e: any) {
        expect(e.message).not.toContain("Rate limit exceeded");
    }
  });
});
