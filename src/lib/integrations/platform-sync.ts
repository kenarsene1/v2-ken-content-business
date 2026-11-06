/**
 * Future: automatic stats syncing per platform.
 *
 * Each platform gets one adapter implementing PlatformSyncAdapter. The Accounts
 * UI only talks to `getSyncAdapter(platform)`; until an adapter is registered,
 * stats stay hand-entered. Adapters must never block core features — failures
 * should be caught and surfaced as a toast, not thrown into the UI.
 *
 * Writes go to the account's `followers`, `external_id` and `last_synced_at`
 * columns, always scoped to that single account id.
 */
import type { Account } from "@/lib/queries";
import type { PlatformId } from "@/lib/platforms";

export interface AccountStats {
  followers: number;
  externalId?: string;
}

export interface PlatformSyncAdapter {
  platform: PlatformId;
  /** Starts the connect (OAuth) flow for this platform. */
  connect(account: Account): Promise<void>;
  /** Fetches fresh stats for exactly one account. */
  fetchStats(account: Account): Promise<AccountStats>;
}

const adapters: Partial<Record<PlatformId, PlatformSyncAdapter>> = {};

export function registerSyncAdapter(a: PlatformSyncAdapter) {
  adapters[a.platform] = a;
}

export function getSyncAdapter(platform: string): PlatformSyncAdapter | undefined {
  return adapters[platform as PlatformId];
}
