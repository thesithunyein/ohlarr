import { PublicKey } from '@solana/web3.js';

/** Default placeholder program id used during scaffolding. Override via env. */
export const DEFAULT_PROGRAM_ID = new PublicKey(
  'CmHUW6WAUcobsYCHpK2cSgjcYU5KqbW8MDXunK5SzdLA',
);

export const VAULT_SEED = Buffer.from('vault');
export const CHANNEL_SEED = Buffer.from('channel');

/** MagicBlock Permission Program (devnet & mainnet share id). */
export const PERMISSION_PROGRAM_ID = new PublicKey(
  'ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1',
);

/** MagicBlock Delegation Program. */
export const DELEGATION_PROGRAM_ID = new PublicKey(
  'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh',
);

/** Devnet TEE-backed PER validator identity. */
export const DEVNET_TEE_VALIDATOR = new PublicKey(
  'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo',
);

export function vaultPda(programId: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, owner.toBuffer()], programId);
}

export function channelPda(
  programId: PublicKey,
  buyer: PublicKey,
  seller: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHANNEL_SEED, buyer.toBuffer(), seller.toBuffer()],
    programId,
  );
}

/** Permission PDA managed by the MagicBlock Permission Program. */
export function permissionPda(target: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('permission'), target.toBuffer()],
    PERMISSION_PROGRAM_ID,
  );
}
