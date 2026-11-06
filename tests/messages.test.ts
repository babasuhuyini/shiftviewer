import { beforeEach, describe, expect, it, vi } from 'vitest';
import { greetingFor, MESSAGES, pickMessage } from '../src/lib/messages';

// In-memory storage (Node's own experimental localStorage can shadow jsdom's).
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('welcome messages', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('are short enough for a phone screen and unique', () => {
    for (const m of MESSAGES) expect(m.length).toBeLessThanOrEqual(80);
    expect(new Set(MESSAGES).size).toBe(MESSAGES.length);
  });

  it('do not repeat within the last several openings', () => {
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) seen.push(pickMessage());
    for (let i = 1; i < seen.length; i++) {
      const window = seen.slice(Math.max(0, i - 8), i);
      expect(window).not.toContain(seen[i]);
    }
  });

  it('still works when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(MESSAGES).toContain(pickMessage());
  });

  it('greets by time of day', () => {
    expect(greetingFor(8)).toBe('Good morning');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(20)).toBe('Good evening');
    expect(greetingFor(2)).toBe('Hello, night owl');
  });
});
