function requireAnchor(source: string, anchor: string): void {
  if (!source.includes(anchor)) throw new Error(`Shader patch anchor not found: ${anchor}`);
}

export function insertAfter(source: string, anchor: string, code: string): string {
  requireAnchor(source, anchor);
  return source.replace(anchor, anchor + code);
}

export function insertBefore(source: string, anchor: string, code: string): string {
  requireAnchor(source, anchor);
  return source.replace(anchor, code + anchor);
}

/** Replaces an `#include <name>` directive with custom code. */
export function replaceInclude(source: string, name: string, code: string): string {
  const directive = `#include <${name}>`;
  requireAnchor(source, directive);
  return source.replace(directive, code);
}
