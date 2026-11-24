import { AddEquation, CustomBlending, OneFactor, ZeroFactor } from 'three';

/** Additive blending that leaves the alpha channel alone; the water pass reads coverage and the surface's mirror reflectance from it. */
export const ADDITIVE_KEEP_ALPHA = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;
