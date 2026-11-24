export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  maxPixelRatio: number;
  msaaSamples: number;
  shadowMapSize: number;
  bloom: boolean;
  shaftSteps: number;
  roomHdri: '1k' | '2k';
  hairgrassTufts: number;
  vallisneriaBlades: number;
  stemPlants: number;
  particles: number;
  neonCount: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: {
    maxPixelRatio: 2,
    msaaSamples: 4,
    shadowMapSize: 2048,
    bloom: true,
    shaftSteps: 32,
    roomHdri: '2k',
    hairgrassTufts: 2600,
    vallisneriaBlades: 320,
    stemPlants: 110,
    particles: 2400,
    neonCount: 40,
  },
  medium: {
    maxPixelRatio: 1.5,
    msaaSamples: 4,
    shadowMapSize: 1024,
    bloom: true,
    shaftSteps: 24,
    roomHdri: '2k',
    hairgrassTufts: 1700,
    vallisneriaBlades: 240,
    stemPlants: 80,
    particles: 1500,
    neonCount: 32,
  },
  low: {
    maxPixelRatio: 1.5,
    msaaSamples: 0,
    shadowMapSize: 1024,
    bloom: false,
    shaftSteps: 16,
    roomHdri: '1k',
    hairgrassTufts: 900,
    vallisneriaBlades: 160,
    stemPlants: 56,
    particles: 800,
    neonCount: 24,
  },
};

export function detectTier(env: { coarsePointer: boolean; cores: number }): QualityTier {
  if (env.coarsePointer) return 'low';
  return env.cores >= 8 ? 'high' : 'medium';
}

export interface CameraPose {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

/** Options read from the page URL; used for quality overrides and reproducible screenshots. */
export interface UrlOptions {
  autostart: boolean;
  quality: QualityTier | null;
  camera: CameraPose | null;
  touchUi: boolean;
  /** Log frame rate and render scale to the console. */
  stats: boolean;
}

export function parseUrlOptions(search: string): UrlOptions {
  const params = new URLSearchParams(search);
  const q = params.get('quality');
  const quality = q === 'low' || q === 'medium' || q === 'high' ? q : null;

  let camera: CameraPose | null = null;
  const cam = params.get('cam')?.split(',').map(Number);
  if (cam && cam.length === 5 && cam.every(Number.isFinite)) {
    camera = { position: [cam[0], cam[1], cam[2]], yaw: cam[3], pitch: cam[4] };
  }

  return { autostart: params.has('autostart'), quality, camera, touchUi: params.has('touch'), stats: params.has('stats') };
}
