import {
  Connection,
  ConnectionConfig,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

/**
 * Connection manager for a MagicBlock Private Ephemeral Rollup endpoint.
 *
 * A `PerSession` holds two `Connection`s:
 *   - `base`     → Solana L1 (devnet/mainnet); used for delegate/commit.
 *   - `rollup`   → MagicBlock PER endpoint (e.g. devnet-tee.magicblock.app);
 *                  used for `settle()` and other in-rollup operations.
 *
 * Most application code only needs `rollup`.
 */
export interface PerSessionConfig {
  baseRpcUrl: string;
  rollupRpcUrl: string;
  commitment?: ConnectionConfig['commitment'];
}

export class PerSession {
  readonly base: Connection;
  readonly rollup: Connection;

  constructor(cfg: PerSessionConfig) {
    const opts: ConnectionConfig = { commitment: cfg.commitment ?? 'confirmed' };
    this.base = new Connection(cfg.baseRpcUrl, opts);
    this.rollup = new Connection(cfg.rollupRpcUrl, opts);
  }

  /** Send and confirm a transaction inside the PER. */
  async sendInRollup(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    feePayer: PublicKey,
  ): Promise<string> {
    const { blockhash } = await this.rollup.getLatestBlockhash();
    const tx = new Transaction({ feePayer, recentBlockhash: blockhash });
    tx.add(...instructions);
    tx.sign(...signers);
    const sig = await this.rollup.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await this.rollup.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight: (await this.rollup.getLatestBlockhash()).lastValidBlockHeight });
    return sig;
  }
}
