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

/** Fine overlapping scale rows. */
function scales(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(40,45,50,0.12)';
  ctx.lineWidth = 1;
  const du = 0.014 * w;
  const dv = 0.03 * h;
  for (let row = 0; row * dv < h; row++) {
    for (let col = 0; col * du < w; col++) {
      const x = col * du + (row % 2) * du * 0.5;
      ctx.beginPath();
      ctx.arc(x, row * dv, du * 0.6, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }
}

/** Fin rays: slanting back through the dorsal and anal sails, fanning out through the tail. Fin UVs: u = 0.5 - z, v = 0.5 + 0.6 y. */
function finRays(ctx: CanvasRenderingContext2D, size: number) {
  ctx.strokeStyle = 'rgba(45,50,55,0.5)';
  ctx.lineWidth = 1.5;
  const line = (u0: number, v0: number, u1: number, v1: number) => {
    ctx.beginPath();
    ctx.moveTo(u0 * size, (1 - v0) * size);
    ctx.lineTo(u1 * size, (1 - v1) * size);
    ctx.stroke();
  };
  for (let u = 0.3; u < 0.8; u += 0.018) {
    line(u, 0.64, u + 0.34, 1.0);
    line(u, 0.36, u + 0.34, 0.0);
  }
  for (let k = -6; k <= 6; k++) line(0.76, 0.5 + k * 0.012, 1.0, 0.5 + k * 0.03);
}

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
  scales(ctx, W, H);
  bars(ctx, W, H, 0.85);
  eye(ctx, W, H, 0.1, 0.2, 0.03, 0.05, '#c4452b');

  const [ic, ictx] = canvas(64, 64);
  ictx.fillStyle = '#777';
  ictx.fillRect(0, 0, 64, 64);

  const F = 512;
  const [fc, fctx] = canvas(F, F);
  fctx.fillStyle = 'rgba(150,158,162,0.64)';
  fctx.fillRect(0, 0, F, F);
  finRays(fctx, F);
  bars(fctx, F, F, 0.85);
  // Dusky outer edges of the dorsal and anal sails (canvas y runs opposite to v).
  const edge = fctx.createLinearGradient(0, 0, 0, F);
  edge.addColorStop(0, 'rgba(25,25,25,0.6)');
  edge.addColorStop(0.18, 'rgba(25,25,25,0)');
  edge.addColorStop(0.82, 'rgba(25,25,25,0)');
  edge.addColorStop(1, 'rgba(25,25,25,0.6)');
  fctx.fillStyle = edge;
  fctx.fillRect(0, 0, F, F);

  return { map: texture(c, true), iridescence: texture(ic, false), fins: texture(fc, true) };
}
