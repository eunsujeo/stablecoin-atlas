export interface CachedCompiler { readonly id: string; readonly version: string; readonly sha256: string;
  readonly provenance: 'EXISTING_PINNED_CACHE' | 'BROWSER_ACQUIRED_PINNED_CACHE'; readonly independentAttestation: 'NOT_TESTED' }
export const cachedCompiler: CachedCompiler;
export const jpycCompiler: CachedCompiler;
export const usdtCompiler: CachedCompiler;
export const rlusdCompiler: CachedCompiler;
export const jpyscCompiler: CachedCompiler;
export const cachedCompilers: readonly CachedCompiler[];
export function cachedCompilerById(id: string): CachedCompiler | null;
export function inspectCachedCompiler(version?: string): Promise<CachedCompiler | null>;
export function stageCachedCompiler(version?: string): Promise<{ path: string; cleanup(): Promise<void> }>;
export function verifyCompilerBytes(bytes: Buffer, expectedHash: string): void;
export function readVerifiedCompiler(path: string | URL, expectedHash: string): Promise<Buffer>;
