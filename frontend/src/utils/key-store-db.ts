/**
 * Key Store DB — shared IndexedDB utilities for key-store and broadcast-key-store.
 */

export const DB_NAME = 'burnware-keys';
export const DB_VERSION = 5; // Bumped to add broadcastKeys store
export const LINK_KEYS_STORE = 'linkKeys';
export const REPLY_CACHE_STORE = 'replyCache';
export const ROOM_KEYS_STORE = 'roomKeys';
export const VAULT_META_STORE = 'vaultMeta';
export const BROADCAST_KEYS_STORE = 'broadcastKeys';

export interface VaultWrappedEntry {
  _vault: true;
  ct: string;
  iv: string;
}

export function isVaultWrapped(val: unknown): val is VaultWrappedEntry {
  return typeof val === 'object' && val !== null && '_vault' in val
    && (val as VaultWrappedEntry)._vault === true;
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LINK_KEYS_STORE)) db.createObjectStore(LINK_KEYS_STORE);
      if (!db.objectStoreNames.contains(REPLY_CACHE_STORE)) db.createObjectStore(REPLY_CACHE_STORE);
      if (!db.objectStoreNames.contains(ROOM_KEYS_STORE)) db.createObjectStore(ROOM_KEYS_STORE);
      if (!db.objectStoreNames.contains(VAULT_META_STORE)) db.createObjectStore(VAULT_META_STORE);
      if (!db.objectStoreNames.contains(BROADCAST_KEYS_STORE)) db.createObjectStore(BROADCAST_KEYS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite', { durability: 'strict' });
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function idbDelete(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}
