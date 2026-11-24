import { EquirectangularReflectionMapping, PMREMGenerator, type DataTexture, type Texture, type WebGLRenderer } from 'three';

export interface RoomEnvironment {
  /** Prefiltered cube map; higher mips are blurrier. */
  texture: Texture;
  maxLod: number;
}

/** Prefilters the living-room HDRI (Poly Haven, CC0) into a cube map with blurred mip levels. */
export function prefilterRoom(renderer: WebGLRenderer, hdr: DataTexture): RoomEnvironment {
  hdr.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  return { texture: target.texture, maxLod: Math.log2(target.width) };
}
