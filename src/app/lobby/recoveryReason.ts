export type ConnectionRecoveryKey = 'player.roomRefreshRequired' | 'player.browserStorageRequired';

/** Error names cross transport/module boundaries without importing networking internals. */
export function connectionRecoveryKey(error: unknown): ConnectionRecoveryKey | null {
  if (!error || typeof error !== 'object' || !('name' in error)) return null;
  if (error.name === 'ProtocolVersionError') return 'player.roomRefreshRequired';
  if (error.name === 'SequenceStorageError') return 'player.browserStorageRequired';
  return null;
}
