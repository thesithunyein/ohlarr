import { Connection, PublicKey } from '@solana/web3.js';

// ── Program constants ────────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);

export const DEVNET_RPC =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

export const PER_RPC =
  process.env.NEXT_PUBLIC_PER_RPC_URL || 'https://devnet-tee.magicblock.app';

// PDA seeds — must match programs/ohlarr_payments/src/lib.rs
const VAULT_SEED = new TextEncoder().encode('vault');
const CHANNEL_SEED = new TextEncoder().encode('channel');

// ── Connection singletons (lazy) ────────────────────────────────────
let _conn: Connection | null = null;
let _perConn: Connection | null = null;

export function getConnection(): Connection {
  if (!_conn) _conn = new Connection(DEVNET_RPC, 'confirmed');
  return _conn;
}

export function getPerConnection(): Connection {
  if (!_perConn) _perConn = new Connection(PER_RPC, 'confirmed');
  return _perConn;
}

// ── PDA derivation ──────────────────────────────────────────────────
export function vaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, owner.toBytes()], PROGRAM_ID);
}

export function channelPda(buyer: PublicKey, seller: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHANNEL_SEED, buyer.toBytes(), seller.toBytes()],
    PROGRAM_ID,
  );
}

// ── Explorer helpers ────────────────────────────────────────────────
export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddrUrl(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

export function shortAddr(addr: string, len = 4): string {
  if (addr.length <= len * 2 + 3) return addr;
  return `${addr.slice(0, len)}...${addr.slice(-len)}`;
}

// ── Account layout parsing (matches lib.rs structs) ─────────────────
// Vault: [8 disc][32 owner][8 balance][1 bump] = 49
export function parseVault(data: Buffer | Uint8Array) {
  const view = new DataView(
    data instanceof Uint8Array ? data.buffer : data.buffer,
    data instanceof Uint8Array ? data.byteOffset : 0,
    data.byteLength,
  );
  return {
    owner: new PublicKey(data.slice(8, 40)),
    balance: view.getBigUint64(40, true),
    bump: data[48],
  };
}

// PaymentChannel: [8 disc][32 buyer][32 seller][8 nonce][8 total_settled][1 bump] = 89
export function parseChannel(data: Buffer | Uint8Array) {
  const view = new DataView(
    data instanceof Uint8Array ? data.buffer : data.buffer,
    data instanceof Uint8Array ? data.byteOffset : 0,
    data.byteLength,
  );
  return {
    buyer: new PublicKey(data.slice(8, 40)),
    seller: new PublicKey(data.slice(40, 72)),
    nonce: view.getBigUint64(72, true),
    totalSettled: view.getBigUint64(80, true),
    bump: data[88],
  };
}
