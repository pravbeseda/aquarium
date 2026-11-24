import { CanvasTexture, SRGBColorSpace } from 'three';

/** A 2D canvas to paint a procedural texture on. */
export function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  return [c, ctx];
}

/** Wraps a painted canvas; colour maps are sRGB, data maps (masks) are not. */
export function canvasTexture(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
