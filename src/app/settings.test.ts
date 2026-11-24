import { describe, expect, it } from 'vitest';
import { detectTier, parseUrlOptions } from './settings';

describe('detectTier', () => {
  it('uses the low tier on touch devices', () => {
    expect(detectTier({ coarsePointer: true, cores: 8 })).toBe('low');
  });

  it('uses the high tier on capable desktops', () => {
    expect(detectTier({ coarsePointer: false, cores: 8 })).toBe('high');
  });

  it('uses the medium tier on modest desktops', () => {
    expect(detectTier({ coarsePointer: false, cores: 4 })).toBe('medium');
  });
});

describe('parseUrlOptions', () => {
  it('returns defaults for an empty query', () => {
    expect(parseUrlOptions('')).toEqual({ autostart: false, quality: null, camera: null, touchUi: false, stats: false });
  });

  it('parses quality, autostart, touch UI and a camera pose', () => {
    const o = parseUrlOptions('?autostart&quality=low&touch&stats&cam=0.1,0.2,0.3,1.5,-0.2');
    expect(o.autostart).toBe(true);
    expect(o.stats).toBe(true);
    expect(o.touchUi).toBe(true);
    expect(o.quality).toBe('low');
    expect(o.camera).toEqual({ position: [0.1, 0.2, 0.3], yaw: 1.5, pitch: -0.2 });
  });

  it('ignores malformed values', () => {
    const o = parseUrlOptions('?quality=ultra&cam=1,2');
    expect(o.quality).toBeNull();
    expect(o.camera).toBeNull();
  });
});
