import { LoadingManager, RepeatWrapping, SRGBColorSpace, TextureLoader, type DataTexture, type Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const BASE = `${import.meta.env.BASE_URL}assets/`;

export interface PbrTextures {
  map: Texture;
  normalMap: Texture;
  /** Packed ambient occlusion (R), roughness (G) and metalness (B). */
  arm: Texture;
}

/** Loads the downloaded assets and reports overall progress. */
export class AssetLoader {
  private readonly manager: LoadingManager;
  private readonly textures: TextureLoader;
  private readonly gltf: GLTFLoader;
  private readonly hdrLoader: HDRLoader;

  constructor(onProgress: (fraction: number) => void) {
    this.manager = new LoadingManager();
    this.manager.onProgress = (_url, loaded, total) => onProgress(total > 0 ? loaded / total : 0);
    this.textures = new TextureLoader(this.manager);
    this.gltf = new GLTFLoader(this.manager);
    this.hdrLoader = new HDRLoader(this.manager);
  }

  url(path: string): string {
    return BASE + path;
  }

  async pbr(name: string, anisotropy: number): Promise<PbrTextures> {
    const load = async (suffix: string, srgb: boolean) => {
      const t = await this.textures.loadAsync(this.url(`textures/${name}_${suffix}_1k.jpg`));
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = anisotropy;
      if (srgb) t.colorSpace = SRGBColorSpace;
      return t;
    };
    const [map, normalMap, arm] = await Promise.all([load('diff', true), load('nor_gl', false), load('arm', false)]);
    return { map, normalMap, arm };
  }

  hdr(path: string): Promise<DataTexture> {
    return this.hdrLoader.loadAsync(this.url(path));
  }

  model(path: string): Promise<GLTF> {
    return this.gltf.loadAsync(this.url(path));
  }
}
