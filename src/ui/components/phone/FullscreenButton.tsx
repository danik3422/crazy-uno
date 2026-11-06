import { useT } from '../../../i18n';
import { canFullscreen, enterFullscreen, usePhone } from '../../hooks/phone';
import { FullscreenIcon } from './phoneIcons';

/** Lying on its side but still inside the browser bars: a small button in the corner to go full screen. */
export function FullscreenButton() {
  const t = useT();
  const { phone, portrait, fullscreen } = usePhone();
  if (!phone || portrait || fullscreen || !canFullscreen()) return null;
  return (
    <button type="button" className="btn glass icon-btn fs-btn" onClick={() => void enterFullscreen()} title={t('fs.btn')} aria-label={t('fs.btn')}>
      <FullscreenIcon />
    </button>
  );
}
