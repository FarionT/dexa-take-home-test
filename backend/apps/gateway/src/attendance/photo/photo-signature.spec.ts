import { detectPhotoMime } from './photo-signature.js';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...Buffer.from(text, 'ascii')];

describe('detectPhotoMime', () => {
  it.each([
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0, 0x00), 'image/jpeg'],
    ['PNG', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00), 'image/png'],
    ['WebP', bytes(...ascii('RIFF'), 0x10, 0x00, 0x00, 0x00, ...ascii('WEBPVP8 ')), 'image/webp'],
  ])('recognizes %s', (_label, input, expected) => {
    expect(detectPhotoMime(input)).toBe(expected);
  });

  it.each([
    ['a GIF', bytes(...ascii('GIF89a'))],
    ['a PDF', bytes(...ascii('%PDF-1.7'))],
    ['a RIFF file that is not WebP (WAV)', bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))],
    ['HTML pretending to be an image', bytes(...ascii('<svg onload=alert(1)>'))],
    ['a truncated JPEG', bytes(0xff, 0xd8)],
    ['nothing', bytes()],
  ])('rejects %s', (_label, input) => {
    expect(detectPhotoMime(input)).toBeNull();
  });
});
