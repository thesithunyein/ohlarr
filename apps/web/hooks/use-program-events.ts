'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  getConnection,
  PROGRAM_ID,
  shortAddr,
  parseChannel,
} from '@/lib/solana';

export interface OnChainEvent {
  id: string;
  ts: number;
  txSig: string;
  type: 'settle' | 'channel_opened' | 'deposit' | 'init_vault' | 'unknown';
  buyer: string;
  seller: string;
  amount: number;
  channel: string;
  nonce: number;
}

/** Map instruction name from Anchor log → event type */
function parseInstructionType(logs: string[]): OnChainEvent['type'] {
  for (const log of logs) {
    if (log.includes('Instruction: Settle')) return 'settle';
    if (log.includes('Instruction: OpenChannel')) return 'channel_opened';
    if (log.includes('Instruction: Deposit')) return 'deposit';
    if (log.includes('Instruction: InitializeVault')) return 'init_vault';
  }
  return 'unknown';
}

/** Parse a PaymentSettled event from Anchor "Program data:" log line.
 *  Layout (after 8-byte discriminator):
 *    [32 channel][8 amount][8 nonce][32 request_hash]
 */
function parseSettledEvent(logs: string[]): {
  channel: string;
  amount: bigint;
  nonce: bigint;
} | null {
  for (const log of logs) {
    if (!log.startsWith('Program data: ')) continue;
    try {
      const b64 = log.slice('Program data: '.length);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // Skip 8-byte discriminator
      if (bytes.length < 8 + 32 + 8 + 8) continue;
      const channel = new PublicKey(bytes.slice(8, 40)).toBase58();
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const amount = view.getBigUint64(40, true);
      const nonce = view.getBigUint64(48, true);
      // Only accept if amount > 0 (filter out ChannelOpened events that have different layout)
      if (amount > 0n) {
        return { channel, amount, nonce };
      }
    } catch {
      // Not a valid event payload — skip
    }
  }
  return null;
}

interface UseProgramEventsReturn {
  events: OnChainEvent[];
  isLive: boolean;
  isLoading: boolean;
  error: string | null;
  programDeployed: boolean;
}

export function useProgramEvents(): UseProgramEventsReturn {
  const [events, setEvents] = useState<OnChainEvent[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programDeployed, setProgramDeployed] = useState(false);
  const subIdRef = useRef<number | null>(null);

  // Fetch recent historical transactions on mount
  const fetchHistory = useCallback(async () => {
    try {
      const conn = getConnection();

      // Check if program exists on devnet
      const programInfo = await conn.getAccountInfo(PROGRAM_ID);
      if (!programInfo) {
        setProgramDeployed(false);
        setIsLoading(false);
        return;
      }
      setProgramDeployed(true);

      // Fetch recent signatures for the program
      const sigs = await conn.getSignaturesForAddress(PROGRAM_ID, { limit: 30 });
      if (sigs.length === 0) {
        setIsLoading(false);
        return;
      }

      const parsedEvents: OnChainEvent[] = [];
      // Process in batches to avoid rate limits
      for (const sigInfo of sigs) {
        try {
          const tx = await conn.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          });
          if (!tx || tx.meta?.err) continue;

          const logs = tx.meta?.logMessages || [];
          const type = parseInstructionType(logs);

          // Get accounts from transaction
          const accountKeys = tx.transaction.message.getAccountKeys
            ? tx.transaction.message.getAccountKeys().staticAccountKeys
            : (tx.transaction.message as unknown as { accountKeys: PublicKey[] }).accountKeys || [];

          const settled = type === 'settle' ? parseSettledEvent(logs) : null;

          parsedEvents.push({
            id: sigInfo.signature,
            ts: (sigInfo.blockTime || 0) * 1000,
            txSig: sigInfo.signature,
            type,
            buyer: accountKeys.length > 3 ? shortAddr(accountKeys[3]?.toBase58() ?? '') : '',
            seller: accountKeys.length > 2 ? shortAddr(accountKeys[2]?.toBase58() ?? '') : '',
            amount: settled ? Number(settled.amount) : 0,
            channel: settled?.channel ?? '',
            nonce: settled ? Number(settled.nonce) : 0,
          });
        } catch {
          // Skip individual tx errors
        }
      }

      setEvents(parsedEvents);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch program data');
      setIsLoading(false);
    }
  }, []);

  // Subscribe to real-time program logs
  const subscribe = useCallback(() => {
    try {
      const conn = getConnection();
      const subId = conn.onLogs(
        PROGRAM_ID,
        (logInfo) => {
          if (logInfo.err) return;

          const logs = logInfo.logs;
          const type = parseInstructionType(logs);
          const settled = type === 'settle' ? parseSettledEvent(logs) : null;

          const event: OnChainEvent = {
            id: logInfo.signature,
            ts: Date.now(),
            txSig: logInfo.signature,
            type,
            buyer: '',
            seller: '',
            amount: settled ? Number(settled.amount) : 0,
            channel: settled?.channel ?? '',
            nonce: settled ? Number(settled.nonce) : 0,
          };

          setEvents((prev) => [event, ...prev].slice(0, 50));
          setIsLive(true);
        },
        'confirmed',
      );
      subIdRef.current = subId;
    } catch {
      // Subscription failed — fall back to polling
    }
  }, []);

  useEffect(() => {
    fetchHistory().then(() => subscribe());

    return () => {
      if (subIdRef.current !== null) {
        getConnection().removeOnLogsListener(subIdRef.current);
      }
    };
  }, [fetchHistory, subscribe]);

  return { events, isLive, isLoading, error, programDeployed };
}
