import { describe, expect, it } from 'vitest';
import { ShaderChunk, ShaderLib } from 'three';
import { insertAfter, replaceInclude } from './shaderPatch';
import { CHUNK_ANCHORS, PROGRAM_ANCHORS } from './underwaterMaterial';

describe('shader patching', () => {
  it('inserts code after an anchor', () => {
    expect(insertAfter('a;\nb;', 'a;', ' x;')).toBe('a; x;\nb;');
  });

  it('throws when the anchor is missing so a three.js upgrade fails loudly', () => {
    expect(() => insertAfter('a;', 'zzz', 'x')).toThrow(/zzz/);
    expect(() => replaceInclude('a;', 'nope', 'x')).toThrow(/nope/);
  });

  it('finds every anchor the underwater materials rely on in this three.js version', () => {
    for (const [chunk, anchor] of CHUNK_ANCHORS) {
      expect(ShaderChunk[chunk as keyof typeof ShaderChunk], chunk).toContain(anchor);
    }
    for (const program of ['physical', 'standard', 'depth'] as const) {
      const lib = ShaderLib[program];
      for (const anchor of PROGRAM_ANCHORS.vertex) expect(lib.vertexShader, `${program} vertex`).toContain(anchor);
      if (program !== 'depth') {
        for (const anchor of PROGRAM_ANCHORS.fragment) expect(lib.fragmentShader, `${program} fragment`).toContain(anchor);
      }
    }
  });
});
