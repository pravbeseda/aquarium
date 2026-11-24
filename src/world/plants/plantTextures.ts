import type { CanvasTexture } from 'three';
import { mulberry32 } from '../../core/random';
import { canvasTexture, createCanvas } from '../canvasTexture';

/** Light leaf detail multiplied over the vertex colours: veins, darker margins, a few blemishes. */
function leafCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const [canvas, ctx] = createCanvas(width, height);
  ctx.fillStyle = '#eef2e6';
  ctx.fillRect(0, 0, width, height);
  const margin = ctx.createLinearGradient(0, 0, width, 0);
  margin.addColorStop(0, 'rgba(60,70,40,0.35)');
  margin.addColorStop(0.18, 'rgba(60,70,40,0)');
  margin.addColorStop(0.82, 'rgba(60,70,40,0)');
  margin.addColorStop(1, 'rgba(60,70,40,0.35)');
  ctx.fillStyle = margin;
  ctx.fillRect(0, 0, width, height);
  draw(ctx);
  return canvasTexture(canvas, true);
}

/** Vallisneria: long parallel veins with faint cross-veinlets, streaks and a few spots. */
export function ribbonLeafTexture(): CanvasTexture {
  const rng = mulberry32(21);
  const W = 64;
  const H = 512;
  return leafCanvas(W, H, (ctx) => {
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = `rgba(80,95,50,${(rng() * 0.12).toFixed(3)})`;
      ctx.fillRect(x, 0, 1, H);
    }
    for (const u of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      ctx.fillStyle = u === 0.5 ? 'rgba(255,255,240,0.55)' : 'rgba(255,255,240,0.3)';
      ctx.fillRect(Math.round(u * W) - (u === 0.5 ? 1 : 0), 0, u === 0.5 ? 2 : 1, H);
    }
    ctx.strokeStyle = 'rgba(255,255,240,0.14)';
    for (let i = 0; i < 160; i++) {
      const y = rng() * H;
      const x = rng() * W;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 1);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(110,85,40,${(0.1 + rng() * 0.2).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(rng() * W, rng() * H, 1 + rng() * 2.5, 2 + rng() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Small leaves: a pale midrib with paired side veins running towards the tip. */
export function smallLeafTexture(): CanvasTexture {
  const S = 128;
  return leafCanvas(S, S, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,235,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2, S);
    ctx.lineTo(S / 2, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,235,0.3)';
    for (let y = S * 0.9; y > S * 0.1; y -= S * 0.12) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(S / 2, y);
        ctx.quadraticCurveTo(S / 2 + side * S * 0.2, y - S * 0.05, S / 2 + side * S * 0.42, y - S * 0.16);
        ctx.stroke();
      }
    }
  });
}
