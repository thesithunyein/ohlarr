/**
 * Wire types for the Ohlarr × x402 protocol.
 *
 * The HTTP layer follows the x402.org spec:
 *   - server returns `402 Payment Required` with a JSON challenge body
 *   - client retries with `Authorization: x402 <base64(payload)>`
 *
 * Our `scheme` is `ohlarr-per-v1` — settlement happens inside a MagicBlock
 * Private Ephemeral Rollup (PER) and the receipt is a signed PER tx signature.
 */

export const OHLARR_SCHEME = 'ohlarr-per-v1' as const;

export type OhlarrNetwork = 'solana-mainnet' | 'solana-devnet' | 'solana-testnet';

/** Body of a 402 response. */
export interface X402Challenge {
  scheme: typeof OHLARR_SCHEME;
  network: OhlarrNetwork;
  /** Asset identifier — `lamports` or an SPL mint base58. */
  asset: string;
  /** Amount in the smallest unit of `asset`, as a decimal string. */
  amount: string;
  /** Seller vault PDA (base58). */
  recipient_vault: string;
  /** Bilateral channel PDA (base58). */
  channel: string;
  /** Next nonce the buyer must use (channel.nonce + 1). */
  nonce: number;
  /** Unix seconds after which this challenge MUST be rejected. */
  expires_at: number;
  /** BLAKE3 hex of the canonicalized request the buyer is paying for. */
  request_hash: string;
}

/** Body the client puts in `Authorization: x402 base64(<this>)`. */
export interface X402Receipt {
  scheme: typeof OHLARR_SCHEME;
  network: OhlarrNetwork;
  /** PER transaction signature of the `settle()` instruction (base58). */
  tx_sig: string;
  /** Channel PDA the settle was applied to (base58). */
  channel: string;
  /** Nonce that was settled. */
  nonce: number;
  /** Amount that was settled, as a decimal string. */
  amount: string;
  /** Buyer's signature over BLAKE3(challenge_json) (base58). Ed25519. */
  challenge_sig: string;
  /** Buyer pubkey (base58). */
  buyer: string;
}

export class X402Error extends Error {
  constructor(
    public readonly code:
      | 'BadScheme'
      | 'Expired'
      | 'BadNonce'
      | 'BadSignature'
      | 'NotSettled'
      | 'InsufficientAmount'
      | 'NetworkMismatch',
    message: string,
  ) {
    super(message);
    this.name = 'X402Error';
  }
}
