import { useT } from '../../i18n';
import type { Connection } from '../../net/connection';
import './ConnBadge.css';

/** The connection to the game server: online, reconnecting or connecting. */
export function ConnBadge({ conn }: { conn: Connection }) {
  const t = useT();
  const label = conn.status === 'open' ? t('conn.open') : conn.status === 'reconnecting' ? t('conn.reconnecting') : t('conn.connecting');
  return <span className={`conn ${conn.status}`}>{label}</span>;
}
