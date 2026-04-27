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

// Anchor event discriminators: SHA256("event:<Name>")[0..8]
const DISC_PAYMENT_SETTLED = [158, 182, 152, 76, 105, 23, 232, 135];
const DISC_CHANNEL_OPENED = [253, 213, 255, 96, 31, 188, 47, 170];

function matchDisc(bytes: Uint8Array, disc: number[]): boolean {
  for (let i = 0; i < 8; i++) if (bytes[i] !== disc[i]) return false;
  return true;
}

/** Parse Anchor "Program data:" log lines for event payloads.
 *  ChannelOpened:  disc(8) + channel(32) + buyer(32) + seller(32) = 104
 *  PaymentSettled: disc(8) + channel(32) + amount(8) + nonce(8) + hash(32) = 88
 */
function parseEventData(logs: string[]): {
  channel: string;
  amount: bigint;
  nonce: bigint;
  buyer: string;
  seller: string;
} | null {
  for (const log of logs) {
    if (!log.startsWith('Program data: ')) continue;
    try {
      const b64 = log.slice('Program data: '.length);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.length < 8) continue;

      if (matchDisc(bytes, DISC_PAYMENT_SETTLED) && bytes.length >= 88) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return {
          channel: new PublicKey(bytes.slice(8, 40)).toBase58(),
          amount: view.getBigUint64(40, true),
          nonce: view.getBigUint64(48, true),
          buyer: '',
          seller: '',
        };
      }

      if (matchDisc(bytes, DISC_CHANNEL_OPENED) && bytes.length >= 104) {
        return {
          channel: new PublicKey(bytes.slice(8, 40)).toBase58(),
          amount: 0n,
          nonce: 0n,
          buyer: new PublicKey(bytes.slice(40, 72)).toBase58(),
          seller: new PublicKey(bytes.slice(72, 104)).toBase58(),
        };
      }
    } catch {
      // Not a valid event payload — skip
    }
  }
  return null;
}

/** Extract account public keys from a transaction message */
function getAccountKeysFromTx(tx: { transaction: { message: unknown } }): PublicKey[] {
  const msg = tx.transaction.message as Record<string, unknown>;
  // Versioned tx (v0) — getAccountKeys().staticAccountKeys
  if (typeof msg.getAccountKeys === 'function') {
    const keys = (msg.getAccountKeys as () => { staticAccountKeys: PublicKey[] })();
    return keys.staticAccountKeys || [];
  }
  // Legacy tx — .accountKeys directly
  if (Array.isArray(msg.accountKeys)) return msg.accountKeys as PublicKey[];
  return [];
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
          const accountKeys = getAccountKeysFromTx(tx);
          const eventData = parseEventData(logs);

          // accountKeys[0] is always the fee payer (buyer / initiator)
          const feePayer = accountKeys[0]?.toBase58() ?? '';
          let buyerAddr = eventData?.buyer || feePayer;
          let sellerAddr = eventData?.seller || '';

          // For settle txns: read channel account to get real buyer/seller
          if (type === 'settle' && eventData?.channel && !sellerAddr) {
            try {
              const channelAcct = await conn.getAccountInfo(new PublicKey(eventData.channel));
              if (channelAcct && channelAcct.data.length >= 72) {
                const parsed = parseChannel(channelAcct.data);
                buyerAddr = parsed.buyer.toBase58();
                sellerAddr = parsed.seller.toBase58();
              }
            } catch {
              // Fallback to fee payer
            }
          }

          parsedEvents.push({
            id: sigInfo.signature,
            ts: (sigInfo.blockTime || 0) * 1000,
            txSig: sigInfo.signature,
            type,
            buyer: buyerAddr ? shortAddr(buyerAddr) : '',
            seller: sellerAddr ? shortAddr(sellerAddr) : shortAddr(feePayer),
            amount: eventData ? Number(eventData.amount) : 0,
            channel: eventData?.channel ?? '',
            nonce: eventData ? Number(eventData.nonce) : 0,
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
        (logInfo: { err: unknown; signature: string; logs: string[] }) => {
          if (logInfo.err) return;

          const logs = logInfo.logs;
          const type = parseInstructionType(logs);
          const eventData = parseEventData(logs);

          const event: OnChainEvent = {
            id: logInfo.signature,
            ts: Date.now(),
            txSig: logInfo.signature,
            type,
            buyer: eventData?.buyer ? shortAddr(eventData.buyer) : '',
            seller: eventData?.seller ? shortAddr(eventData.seller) : '',
            amount: eventData ? Number(eventData.amount) : 0,
            channel: eventData?.channel ?? '',
            nonce: eventData ? Number(eventData.nonce) : 0,
          };

          // Backfill buyer/seller from tx if not in event data
          if (!event.buyer || !event.seller) {
            conn.getTransaction(logInfo.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed',
            }).then((tx) => {
              if (!tx) return;
              const keys = getAccountKeysFromTx(tx);
              const feePayer = keys[0]?.toBase58() ?? '';
              setEvents((prev: OnChainEvent[]) =>
                prev.map((e) =>
                  e.id === logInfo.signature
                    ? {
                        ...e,
                        buyer: e.buyer || shortAddr(feePayer),
                        seller: e.seller || shortAddr(feePayer),
                      }
                    : e,
                ),
              );
            }).catch(() => {});
          }

          setEvents((prev: OnChainEvent[]) => [event, ...prev].slice(0, 50));
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
