import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Canonicalize a request for signing/hashing. We use a stable JSON
 * representation: keys sorted, no whitespace, UTF-8.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') +
    '}'
  );
}

export function blake3Hex(input: string | Uint8Array): string {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return bytesToHex(blake3(data));
}

export function blake3Bytes(input: string | Uint8Array): Uint8Array {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return blake3(data);
}
