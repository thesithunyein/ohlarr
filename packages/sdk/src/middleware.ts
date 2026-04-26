import type { IncomingMessage, ServerResponse } from 'node:http';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import {
  OHLARR_SCHEME,
  X402Challenge,
  X402Error,
  X402Receipt,
  type OhlarrNetwork,
} from './types.js';
import { blake3Hex, canonicalize } from './hash.js';
import { PerSession } from './per.js';
import { channelPda, vaultPda } from './pdas.js';

export interface MiddlewareOptions {
  /** Ohlarr program id deployed on Solana base layer. */
  programId: PublicKey;
  /** Seller (this server's) wallet pubkey — vault is derived from it. */
  sellerPubkey: PublicKey;
  /** Network this middleware operates on. */
  network: OhlarrNetwork;
  /** PER session — used to verify settle txs. */
  per: PerSession;
  /** Price (smallest unit) per request. Can also be a function for dynamic pricing. */
  price: bigint | ((req: IncomingMessage) => bigint | Promise<bigint>);
  /** Asset id. Defaults to `lamports`. */
  asset?: string;
  /** Challenge time-to-live in seconds. Default 60. */
  ttlSeconds?: number;
}

interface ConnectLikeReq extends IncomingMessage {
  ohlarr?: {
    receipt: X402Receipt;
    challenge: X402Challenge;
  };
}

type Next = (err?: unknown) => void;

/**
 * Express/Connect-style middleware. Drop in front of any paid route.
 *
 *   app.get('/api/premium', ohlarrMiddleware({...}), (req, res) => res.json({...}))
 */
export function ohlarrMiddleware(opts: MiddlewareOptions) {
  const ttl = opts.ttlSeconds ?? 60;
  const asset = opts.asset ?? 'lamports';
  const [sellerVault] = vaultPda(opts.programId, opts.sellerPubkey);

  return async function handle(req: ConnectLikeReq, res: ServerResponse, next: Next) {
    try {
      const auth = req.headers['authorization'];
      const price = typeof opts.price === 'function' ? await opts.price(req) : opts.price;

      // Build a deterministic identifier of *this* request.
      const reqDescriptor = {
        method: req.method,
        url: req.url,
        // body hashing deferred to the route if needed
      };
      const requestHash = blake3Hex(canonicalize(reqDescriptor));

      if (!auth || !auth.toLowerCase().startsWith('x402 ')) {
        return sendChallenge(res, opts, sellerVault, asset, price, requestHash, ttl);
      }

      const payload = parseAuthHeader(auth);
      if (payload.scheme !== OHLARR_SCHEME) {
        throw new X402Error('BadScheme', `expected ${OHLARR_SCHEME}, got ${payload.scheme}`);
      }
      if (payload.network !== opts.network) {
        throw new X402Error('NetworkMismatch', `network mismatch: ${payload.network}`);
      }
      if (BigInt(payload.amount) < price) {
        throw new X402Error(
          'InsufficientAmount',
          `paid ${payload.amount} < required ${price.toString()}`,
        );
      }

      const buyer = new PublicKey(payload.buyer);
      const [expectedChannel] = channelPda(opts.programId, buyer, opts.sellerPubkey);
      if (expectedChannel.toBase58() !== payload.channel) {
        throw new X402Error('BadSignature', 'channel PDA mismatch for declared buyer');
      }

      // Verify the buyer signed the challenge they claim to have paid for.
      // (Signature is over BLAKE3(challenge_json) — challenge is reconstructed
      // deterministically from request_hash + amount + nonce + recipient.)
      const reconstructedChallenge = canonicalize({
        amount: payload.amount,
        channel: payload.channel,
        network: payload.network,
        nonce: payload.nonce,
        request_hash: requestHash,
        scheme: OHLARR_SCHEME,
      });
      const challengeDigest = new TextEncoder().encode(blake3Hex(reconstructedChallenge));
      const sigOk = nacl.sign.detached.verify(
        challengeDigest,
        bs58.decode(payload.challenge_sig),
        buyer.toBytes(),
      );
      if (!sigOk) throw new X402Error('BadSignature', 'challenge signature invalid');

      // Verify the settle tx actually landed in the PER and updated the channel
      // to the claimed nonce. Cheap: one getTransaction call.
      const tx = await opts.per.rollup.getTransaction(payload.tx_sig, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx || tx.meta?.err) {
        throw new X402Error('NotSettled', 'settle tx not found or failed in PER');
      }

      // Hand off to route handler with parsed receipt attached.
      req.ohlarr = {
        receipt: payload,
        challenge: {
          amount: payload.amount,
          asset,
          channel: payload.channel,
          expires_at: Math.floor(Date.now() / 1000) + ttl,
          network: opts.network,
          nonce: payload.nonce,
          recipient_vault: sellerVault.toBase58(),
          request_hash: requestHash,
          scheme: OHLARR_SCHEME,
        },
      };
      next();
    } catch (err) {
      if (err instanceof X402Error) {
        res.statusCode = 402;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.code, message: err.message }));
        return;
      }
      next(err);
    }
  };
}

function sendChallenge(
  res: ServerResponse,
  opts: MiddlewareOptions,
  sellerVault: PublicKey,
  asset: string,
  price: bigint,
  requestHash: string,
  ttl: number,
) {
  // We do not know the buyer yet — channel is derived client-side and echoed
  // back in the receipt. We send the seller-side identifying info.
  const challenge: Omit<X402Challenge, 'channel' | 'nonce'> = {
    scheme: OHLARR_SCHEME,
    network: opts.network,
    asset,
    amount: price.toString(),
    recipient_vault: sellerVault.toBase58(),
    expires_at: Math.floor(Date.now() / 1000) + ttl,
    request_hash: requestHash,
  };
  res.statusCode = 402;
  res.setHeader('WWW-Authenticate', `x402 scheme="${OHLARR_SCHEME}"`);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(challenge));
}

function parseAuthHeader(header: string): X402Receipt {
  const b64 = header.slice('x402 '.length).trim();
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json) as X402Receipt;
}
