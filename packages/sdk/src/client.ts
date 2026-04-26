import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { canonicalize, blake3Hex } from './hash.js';
import { channelPda, vaultPda } from './pdas.js';
import { PerSession } from './per.js';
import {
  OHLARR_SCHEME,
  X402Challenge,
  X402Error,
  X402Receipt,
  type OhlarrNetwork,
} from './types.js';

export interface OhlarrClientConfig {
  programId: PublicKey;
  buyer: Keypair;
  network: OhlarrNetwork;
  per: PerSession;
  /**
   * Build the on-chain `settle` instruction. Provided by the consumer using
   * the generated Anchor IDL — keeps this SDK IDL-agnostic so it can be
   * imported in browser builds without pulling in the full Anchor stack.
   */
  buildSettleIx: (args: {
    buyer: PublicKey;
    seller: PublicKey;
    channel: PublicKey;
    buyerVault: PublicKey;
    sellerVault: PublicKey;
    amount: bigint;
    nonce: bigint;
    requestHash: Uint8Array;
  }) => TransactionInstruction | Promise<TransactionInstruction>;
}

/**
 * Drop-in replacement for `fetch()` that auto-handles HTTP 402 challenges
 * by paying through the Ohlarr PER and retrying.
 *
 *     const ohlarr = new OhlarrClient({ ... });
 *     const r = await ohlarr.fetch('https://api.example.com/premium');
 */
export class OhlarrClient {
  constructor(private readonly cfg: OhlarrClientConfig) {}

  async fetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const first = await fetch(input, init);
    if (first.status !== 402) return first;

    const challenge = (await first.clone().json()) as Omit<X402Challenge, 'channel' | 'nonce'>;
    if (challenge.scheme !== OHLARR_SCHEME) {
      throw new X402Error('BadScheme', `unsupported scheme ${challenge.scheme}`);
    }
    if (challenge.network !== this.cfg.network) {
      throw new X402Error('NetworkMismatch', `unexpected network ${challenge.network}`);
    }
    if (challenge.expires_at * 1000 < Date.now()) {
      throw new X402Error('Expired', 'challenge expired');
    }

    const seller = pubkeyFromVault(challenge.recipient_vault);
    // Note: in production we'd resolve the seller pubkey from the vault PDA;
    // here we expect the server to also surface it. For minimal flow we treat
    // the recipient_vault as the canonical seller identifier and let the
    // consumer extend the protocol (e.g. with a `seller` field).
    const sellerPk = new PublicKey(challenge.recipient_vault);

    const buyerPk = this.cfg.buyer.publicKey;
    const [channel] = channelPda(this.cfg.programId, buyerPk, seller ?? sellerPk);
    const [buyerVault] = vaultPda(this.cfg.programId, buyerPk);
    const [sellerVault] = vaultPda(this.cfg.programId, seller ?? sellerPk);

    // Fetch current channel nonce from the PER.
    const channelAcct = await this.cfg.per.rollup.getAccountInfo(channel);
    const currentNonce = channelAcct ? readChannelNonce(channelAcct.data) : 0n;
    const nonce = currentNonce + 1n;
    const amount = BigInt(challenge.amount);
    const requestHash = hexToBytes(challenge.request_hash);

    // Build full canonical challenge (with nonce + channel) and sign it.
    const canonicalChallenge = canonicalize({
      amount: amount.toString(),
      channel: channel.toBase58(),
      network: challenge.network,
      nonce: Number(nonce),
      request_hash: challenge.request_hash,
      scheme: OHLARR_SCHEME,
    });
    const challengeDigest = new TextEncoder().encode(blake3Hex(canonicalChallenge));
    const sig = nacl.sign.detached(challengeDigest, this.cfg.buyer.secretKey);

    // Settle inside the PER.
    const ix = await this.cfg.buildSettleIx({
      buyer: buyerPk,
      seller: seller ?? sellerPk,
      channel,
      buyerVault,
      sellerVault,
      amount,
      nonce,
      requestHash,
    });
    const txSig = await this.cfg.per.sendInRollup([ix], [this.cfg.buyer], buyerPk);

    const receipt: X402Receipt = {
      scheme: OHLARR_SCHEME,
      network: challenge.network,
      tx_sig: txSig,
      channel: channel.toBase58(),
      nonce: Number(nonce),
      amount: amount.toString(),
      challenge_sig: bs58.encode(sig),
      buyer: buyerPk.toBase58(),
    };

    const headers = new Headers(init.headers);
    headers.set(
      'Authorization',
      'x402 ' + Buffer.from(JSON.stringify(receipt)).toString('base64'),
    );
    return fetch(input, { ...init, headers });
  }
}

/** Best-effort: parse owner from a vault account's first 32 bytes after discriminator.
 *  Returns `null` if it can't be resolved without an extra RPC call.
 */
function pubkeyFromVault(_vault: string): PublicKey | null {
  return null;
}

/** Read channel.nonce — the channel account layout is:
 *  [8 bytes discriminator][32 buyer][32 seller][8 nonce][8 total][32 hash][1 bump]
 */
function readChannelNonce(data: Uint8Array): bigint {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // 8 + 32 + 32 = 72 → nonce starts here, little-endian u64
  return view.getBigUint64(72, true);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('blake3:') ? hex.slice('blake3:'.length) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
