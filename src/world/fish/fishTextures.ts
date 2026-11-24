import { CanvasTexture, SRGBColorSpace } from 'three';

/** Body textures are painted procedurally; see fishGeometry for the UV layout. */
function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  return [c, ctx];
}

function texture(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Paints a horizontal band symmetrically on both flanks (v and 1 - v). */
function flankBand(ctx: CanvasRenderingContext2D, w: number, h: number, u0: number, u1: number, v: number, halfWidth: number, style: string | CanvasGradient, taper = 0.4) {
  for (const vv of [v, 1 - v]) {
    ctx.beginPath();
    ctx.moveTo(u0 * w, vv * h);
    ctx.quadraticCurveTo(((u0 + u1) / 2) * w, (vv - halfWidth) * h, u1 * w, vv * h + (vv < 0.5 ? -1 : 1) * halfWidth * taper * h);
    ctx.lineTo(u1 * w, vv * h + (vv < 0.5 ? 1 : -1) * halfWidth * taper * h);
    ctx.quadraticCurveTo(((u0 + u1) / 2) * w, (vv + halfWidth) * h, u0 * w, vv * h);
    ctx.fillStyle = style;
    ctx.fill();
  }
}

function eye(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, v: number, ru: number, rv: number, iris: string) {
  for (const vv of [v, 1 - v]) {
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.ellipse(u * w, vv * h, ru * w, rv * h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(u * w, vv * h, ru * w * 0.62, rv * h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse((u - ru * 0.25) * w, (vv + (vv < 0.5 ? -1 : 1) * rv * 0.25) * h, ru * w * 0.18, rv * h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function verticalGradient(ctx: CanvasRenderingContext2D, h: number, stops: Array<[number, string]>) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export interface FishTextures {
  map: CanvasTexture;
  iridescence: CanvasTexture;
  fins: CanvasTexture;
  /** Structural colour that stays vivid even in shade, like the neon's stripe. */
  emissive?: CanvasTexture;
}

export function neonTextures(): FishTextures {
  const W = 512;
  const H = 192;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = verticalGradient(ctx, H, [
    [0, '#3d3a2a'],
    [0.14, '#55503c'],
    [0.3, '#7d8082'],
    [0.5, '#cfccc4'],
    [0.7, '#7d8082'],
    [0.86, '#55503c'],
    [1, '#3d3a2a'],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Red lower rear half.
  const red = ctx.createLinearGradient(0.4 * W, 0, 0.95 * W, 0);
  red.addColorStop(0, 'rgba(225,30,45,0)');
  red.addColorStop(0.2, 'rgba(225,30,45,0.95)');
  red.addColorStop(1, 'rgba(200,25,40,0.9)');
  flankBand(ctx, W, H, 0.38, 0.93, 0.36, 0.11, red, 0.8);

  // The electric blue lateral stripe, from the eye to the adipose fin.
  const blue = ctx.createLinearGradient(0.08 * W, 0, 0.85 * W, 0);
  blue.addColorStop(0, '#5fe0ff');
  blue.addColorStop(0.5, '#1fb5ff');
  blue.addColorStop(1, '#2a7dff');
  flankBand(ctx, W, H, 0.1, 0.86, 0.2, 0.05, blue, 0.3);
  eye(ctx, W, H, 0.085, 0.215, 0.028, 0.06, '#c9d4d6');

  const [ic, ictx] = canvas(W, H);
  ictx.fillStyle = '#000';
  ictx.fillRect(0, 0, W, H);
  flankBand(ictx, W, H, 0.1, 0.86, 0.2, 0.06, '#fff', 0.3);

  const [ec, ectx] = canvas(W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  flankBand(ectx, W, H, 0.1, 0.86, 0.2, 0.045, '#18a8ff', 0.3);

  const [fc, fctx] = canvas(256, 256);
  fctx.fillStyle = 'rgba(235,240,245,0.38)';
  fctx.fillRect(0, 0, 256, 256);
  const base = fctx.createLinearGradient(0.8 * 256, 0, 256, 0);
  base.addColorStop(0, 'rgba(230,60,60,0.0)');
  base.addColorStop(0.4, 'rgba(230,60,60,0.45)');
  base.addColorStop(1, 'rgba(240,240,240,0.2)');
  fctx.fillStyle = base;
  fctx.fillRect(0, 0, 256, 256);

  return { map: texture(c, true), iridescence: texture(ic, false), fins: texture(fc, true), emissive: texture(ec, true) };
}

const ANGEL_BARS = [0.1, 0.33, 0.56, 0.8];

export function angelTextures(): FishTextures {
  const W = 512;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = verticalGradient(ctx, H, [
    [0, '#4f4b3c'],
    [0.12, '#77766b'],
    [0.3, '#8e9291'],
    [0.5, '#a9a69d'],
    [0.7, '#8e9291'],
    [0.88, '#77766b'],
    [1, '#4f4b3c'],
  ]);
  ctx.fillRect(0, 0, W, H);

  const bars = (target: CanvasRenderingContext2D, w: number, h: number, alpha: number) => {
    ANGEL_BARS.forEach((u, i) => {
      const width = i === 0 ? 0.03 : i === 3 ? 0.035 : 0.05;
      const g = target.createLinearGradient((u - width) * w, 0, (u + width) * w, 0);
      g.addColorStop(0, 'rgba(15,12,10,0)');
      g.addColorStop(0.3, `rgba(15,12,10,${alpha})`);
      g.addColorStop(0.7, `rgba(15,12,10,${alpha})`);
      g.addColorStop(1, 'rgba(15,12,10,0)');
      target.fillStyle = g;
      target.fillRect((u - width) * w, 0, width * 2 * w, h);
    });
  };
  bars(ctx, W, H, 0.85);
  eye(ctx, W, H, 0.1, 0.2, 0.03, 0.05, '#c4452b');

  const [ic, ictx] = canvas(64, 64);
  ictx.fillStyle = '#777';
  ictx.fillRect(0, 0, 64, 64);

  const [fc, fctx] = canvas(256, 256);
  fctx.fillStyle = 'rgba(190,196,198,0.62)';
  fctx.fillRect(0, 0, 256, 256);
  bars(fctx, 256, 256, 0.85);

  return { map: texture(c, true), iridescence: texture(ic, false), fins: texture(fc, true) };
}
