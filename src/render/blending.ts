import { AddEquation, CustomBlending, OneFactor, ZeroFactor } from 'three';

/** Additive blending that leaves the alpha channel alone; alpha carries the water surface's mirror mask. */
export const ADDITIVE_KEEP_ALPHA = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;
