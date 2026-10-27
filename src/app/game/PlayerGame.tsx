import type { Transport } from '@net';
import PlayerBoard, { type PlayerProfile } from '../player/PlayerBoard';
import type { RosterPlayer } from '../lobby/Roster';
import type { MessageLog } from '../lobby/messageLog';
import type { ConnectionRecoveryKey } from '../lobby/recoveryReason';

export interface PlayerGameProps {
  transport: Transport;
  room: { code: string; seat: string; hostVerified: boolean };
  roster: RosterPlayer[];
  /** This player's own profile (spoken language, display). */
  profile?: PlayerProfile;
  /** Messages received in the lobby, replayed on mount. */
  log?: MessageLog;
  recovery?: ConnectionRecoveryKey | null;
  onLeave?: () => void;
  onBackToLobby?: () => void;
}

const DEFAULT_PROFILE: PlayerProfile = { name: '', glyph: '', spokenLang: 'es' };

/** Game boundary for the player: everything round-specific lives behind this component. */
export default function PlayerGame({
  transport,
  room,
  roster,
  profile,
  log,
  recovery,
  onLeave,
  onBackToLobby,
}: PlayerGameProps) {
  return (
    <PlayerBoard
      transport={transport}
      room={room}
      roster={roster}
      profile={profile ?? DEFAULT_PROFILE}
      log={log}
      recovery={recovery}
      onLeave={onLeave}
      onBackToLobby={onBackToLobby}
    />
  );
}
