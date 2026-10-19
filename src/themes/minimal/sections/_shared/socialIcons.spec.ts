import { describe, expect, it } from 'vitest';
import { isSocialPlatformRoot, normalizeSocialUrl, resolveSocialHref } from './socialIcons';

// Live data that rendered as broken relative links: `theme.socials` values
// without a scheme, and the SocialIcons default content (platform roots).

describe('normalizeSocialUrl', () => {
  it('keeps absolute URLs and mailto/tel as typed (trimmed)', () => {
    expect(normalizeSocialUrl('facebook', ' https://facebook.com/namez.se ')).toBe('https://facebook.com/namez.se');
    expect(normalizeSocialUrl('website', 'http://example.com')).toBe('http://example.com');
    expect(normalizeSocialUrl('website', 'mailto:hi@example.com')).toBe('mailto:hi@example.com');
    expect(normalizeSocialUrl('website', '//cdn.example.com/x')).toBe('https://cdn.example.com/x');
  });

  it('adds https:// to a scheme-less URL', () => {
    expect(normalizeSocialUrl('facebook', 'facebook.com/namez.se')).toBe('https://facebook.com/namez.se');
    expect(normalizeSocialUrl('instagram', 'www.instagram.com/namez.se')).toBe('https://www.instagram.com/namez.se');
    expect(normalizeSocialUrl('tiktok', 'tiktok.com/@namez.se')).toBe('https://tiktok.com/@namez.se');
    expect(normalizeSocialUrl('whatsapp', 'wa.me/46701234567')).toBe('https://wa.me/46701234567');
    expect(normalizeSocialUrl('instagram', 'linktr.ee/namez')).toBe('https://linktr.ee/namez');
    expect(normalizeSocialUrl('website', 'namez.se')).toBe('https://namez.se');
  });

  it('maps a bare handle to the platform profile URL', () => {
    expect(normalizeSocialUrl('facebook', '@namez.se')).toBe('https://facebook.com/namez.se');
    expect(normalizeSocialUrl('facebook', 'namez.se')).toBe('https://facebook.com/namez.se');
    expect(normalizeSocialUrl('instagram', 'namez')).toBe('https://instagram.com/namez');
    expect(normalizeSocialUrl('tiktok', '@namez.se')).toBe('https://tiktok.com/@namez.se');
    expect(normalizeSocialUrl('twitter', '@namez')).toBe('https://x.com/namez');
    expect(normalizeSocialUrl('youtube', 'namez')).toBe('https://youtube.com/@namez');
    expect(normalizeSocialUrl('whatsapp', '+46 70 123 45 67')).toBe('https://wa.me/46701234567');
  });

  it('returns an empty string for an empty value', () => {
    expect(normalizeSocialUrl('facebook', '')).toBe('');
    expect(normalizeSocialUrl('facebook', '   ')).toBe('');
  });
});

describe('isSocialPlatformRoot', () => {
  it('recognises the untouched section defaults', () => {
    expect(isSocialPlatformRoot('instagram', 'https://instagram.com/')).toBe(true);
    expect(isSocialPlatformRoot('facebook', 'https://www.facebook.com')).toBe(true);
    expect(isSocialPlatformRoot('tiktok', 'https://tiktok.com/')).toBe(true);
    expect(isSocialPlatformRoot('tiktok', 'https://tiktok.com/@')).toBe(true);
    expect(isSocialPlatformRoot('whatsapp', 'https://wa.me/')).toBe(true);
  });

  it('is false for a real profile, another host, or a non-URL', () => {
    expect(isSocialPlatformRoot('facebook', 'https://facebook.com/namez.se')).toBe(false);
    expect(isSocialPlatformRoot('facebook', 'https://namez.se/')).toBe(false);
    expect(isSocialPlatformRoot('website', 'https://example.com/')).toBe(false);
    expect(isSocialPlatformRoot('facebook', 'namez')).toBe(false);
  });
});

describe('resolveSocialHref', () => {
  it('resolves the Namez theme socials to absolute profile URLs', () => {
    expect(resolveSocialHref('facebook', 'facebook.com/namez.se')).toBe('https://facebook.com/namez.se');
    expect(resolveSocialHref('instagram', 'instagram.com/namez.se')).toBe('https://instagram.com/namez.se');
    expect(resolveSocialHref('tiktok', 'tiktok.com/@namez.se')).toBe('https://tiktok.com/@namez.se');
  });

  it("returns '#' for an empty value or an untouched platform root", () => {
    expect(resolveSocialHref('facebook', '')).toBe('#');
    expect(resolveSocialHref('facebook', 'https://facebook.com/')).toBe('#');
    expect(resolveSocialHref('whatsapp', 'https://wa.me/')).toBe('#');
  });

  it('keeps the mailto: / tel: prefixing for email and phone', () => {
    expect(resolveSocialHref('email', 'hi@example.com')).toBe('mailto:hi@example.com');
    expect(resolveSocialHref('email', 'mailto:hi@example.com')).toBe('mailto:hi@example.com');
    expect(resolveSocialHref('phone', '+4670')).toBe('tel:+4670');
    expect(resolveSocialHref('phone', '')).toBe('#');
  });
});
