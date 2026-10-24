export interface CachedCompiler { readonly id: string; readonly version: string; readonly sha256: string;
  readonly provenance: 'EXISTING_PINNED_CACHE'; readonly independentAttestation: 'NOT_TESTED' }
export const cachedCompiler: CachedCompiler;
export function inspectCachedCompiler(): Promise<CachedCompiler | null>;
export function stageCachedCompiler(): Promise<{ path: string; cleanup(): Promise<void> }>;
export function verifyCompilerBytes(bytes: Buffer, expectedHash: string): void;
export function readVerifiedCompiler(path: string | URL, expectedHash: string): Promise<Buffer>;
