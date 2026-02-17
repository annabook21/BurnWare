/**
 * Broadcast Key Store
 * Persists broadcast channel encryption keys in IndexedDB with vault encryption.
 * Write-through to localStorage for fast synchronous access.
 */

import { isVaultUnlocked, encryptForVault, decryptFromVault } from './key-vault';
import {
  BROADCAST_KEYS_STORE,
  idbGet, idbPut, idbDelete,
  isVaultWrapped,
  type VaultWrappedEntry,
} from './key-store-db';

interface BroadcastKeyEntry {
  encryptionKey: string;   // base64url AES-256 key
  postToken?: string;
  createdAt: number;
}

const LS_KEY = 'bw:bc:encKeys';

function lsRead(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

function lsWrite(channelId: string, key: string): void {
  try {
    const stored = lsRead();
    stored[channelId] = key;
    localStorage.setItem(LS_KEY, JSON.stringify(stored));
  } catch { /* quota exceeded etc */ }
}

function lsRemove(channelId: string): void {
  try {
    const stored = lsRead();
    delete stored[channelId];
    localStorage.setItem(LS_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

/** Save broadcast encryption key to IDB (vault-encrypted if unlocked) + localStorage. */
export async function saveBroadcastKey(
  channelId: string,
  encryptionKey: string,
  postToken?: string,
): Promise<void> {
  const entry: BroadcastKeyEntry = { encryptionKey, postToken, createdAt: Date.now() };

  if (isVaultUnlocked()) {
    const { ct, iv } = await encryptForVault(JSON.stringify(entry));
    await idbPut(BROADCAST_KEYS_STORE, channelId, { _vault: true, ct, iv } as VaultWrappedEntry);
  } else {
    await idbPut(BROADCAST_KEYS_STORE, channelId, entry);
  }

  // Write-through to localStorage for fast synchronous reads
  lsWrite(channelId, encryptionKey);
}

/** Get broadcast encryption key: try IDB first (vault-decrypt if needed), fallback to localStorage. */
export async function getBroadcastKey(channelId: string): Promise<string | undefined> {
  try {
    const stored = await idbGet<BroadcastKeyEntry | VaultWrappedEntry>(BROADCAST_KEYS_STORE, channelId);
    if (stored) {
      if (isVaultWrapped(stored)) {
        if (!isVaultUnlocked()) return undefined;
        const json = await decryptFromVault(stored.ct, stored.iv);
        const entry = JSON.parse(json) as BroadcastKeyEntry;
        return entry.encryptionKey;
      }
      return (stored as BroadcastKeyEntry).encryptionKey;
    }
  } catch {
    // IDB failed — fall through to localStorage
  }

  // Fallback: localStorage
  const ls = lsRead();
  return ls[channelId] || undefined;
}

/** Delete broadcast key from both IDB and localStorage. */
export async function deleteBroadcastKey(channelId: string): Promise<void> {
  lsRemove(channelId);
  try {
    await idbDelete(BROADCAST_KEYS_STORE, channelId);
  } catch { /* ignore if IDB fails */ }
}
