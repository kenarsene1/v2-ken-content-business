import { describe, expect, it } from 'vitest';
import { ideaScore, scopeToAccount } from '@/lib/ideas';
import { allowedPhotoUrl, extractProfilePhoto, profileLookupUrl } from '@/lib/profile-photos';

describe('Profile-specific ideas', () => {
  const rows = [{ id: 'one', account_id: 'a' }, { id: 'two', account_id: 'b' }, { id: 'none', account_id: null }];
  it('only shows the selected profile and retains all accounts', () => {
    expect(scopeToAccount(rows, 'a')?.map((r) => r.id)).toEqual(['one']);
    expect(scopeToAccount(rows, 'missing')).toEqual([]);
    expect(scopeToAccount(rows, null)).toBe(rows);
  });
  it('calculates actual reach × ease × fit, from 1 to 125', () => {
    expect(ideaScore({ reach: 5, ease: 3, relevance: 4 })).toBe(60);
    expect(ideaScore({ reach: 5, ease: 5, relevance: 5 })).toBe(125);
  });
});
describe('Safe platform photo import', () => {
  it('resolves a YouTube handle and validates its host', () => {
    expect(profileLookupUrl('youtube', null, '@creator')).toBe('https://www.youtube.com/@creator');
    expect(() => profileLookupUrl('youtube', 'https://localhost/@creator', null)).toThrow();
    expect(() => profileLookupUrl('youtube', 'https://youtube.com.evil.com/@creator', null)).toThrow();
    expect(() => profileLookupUrl('youtube', 'https://youtube.com/watch?v=123', null)).toThrow();
    expect(() => profileLookupUrl('youtube', 'http://youtube.com/@creator', null)).toThrow();
  });
  it('accepts only platform image hosts, not generic logos or arbitrary images', () => {
    expect(allowedPhotoUrl('https://yt3.googleusercontent.com/avatar.jpg')).toBe(true);
    expect(allowedPhotoUrl('https://yt3.googleusercontent.com.evil.test/a')).toBe(false);
    expect(extractProfilePhoto('<meta content="https://yt3.googleusercontent.com/a?a=1&amp;b=2" property="og:image">', 'youtube')).toBe('https://yt3.googleusercontent.com/a?a=1&b=2');
    expect(extractProfilePhoto('<meta property="og:image" content="https://youtube.com/logo.png">', 'youtube')).toBe(null);
  });
});