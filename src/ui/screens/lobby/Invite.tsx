import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import { FitLetter } from '../../components/FitLetter';
import './Invite.css';

/** the link that opens this room */
function inviteLink(code: string) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

/** how long "copied!" stays */
const COPIED_MS = 1600;
/** a computer: the QR is out from the start (friends scan it with their phones); a phone: on request */
const QR_OPEN_AT_START = '(min-width: 1000px) and (min-height: 521px)';

const IconLink = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** The room code as cards (tap to copy), copy-link / QR / share buttons, and the QR with the link. */
export function Invite({ code }: { code: string }) {
  const t = useT();
  const link = inviteLink(code);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [qrOpen, setQrOpen] = useState(() => typeof matchMedia === 'function' && matchMedia(QR_OPEN_AT_START).matches);
  const qr = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(link);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [link]);

  const copy = async (text: string, what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      // clipboard blocked: show the link so it can be copied by hand
      setQrOpen(true);
    }
  };
  const share = () => {
    navigator.share?.({ title: t('app.title'), text: t('lobby.shareText', { code }), url: link }).catch(() => {});
  };

  return (
    <section className="lb-invite" aria-label={t('lobby.room')}>
      <div className="lb-code">
        <span className="lb-label">{copied === 'code' ? t('lobby.codeCopied') : t('lobby.code')}</span>
        <button className="code-tiles small" onClick={() => copy(code, 'code')} aria-label={t('lobby.copyCodeAria', { code })} title={t('lobby.copyCode')}>
          {code.split('').map((ch, i) => <span key={i} className={`tile t${i}`}><FitLetter ch={ch} /></span>)}
        </button>
      </div>
      <div className="lb-invite-btns">
        <button className="btn soft invite-copy" onClick={() => copy(link, 'link')}>
          <IconLink /> {copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyLink')}
        </button>
        <button className={`btn soft ${qrOpen ? 'on' : ''}`} onClick={() => setQrOpen(o => !o)} aria-expanded={qrOpen} aria-label={t('lobby.qr')}>QR</button>
        {'share' in navigator && <button className="btn soft" onClick={share} aria-label={t('lobby.share')} title={t('lobby.share')}><IconShare /></button>}
      </div>
      {qrOpen && (
        <div className="qr-box">
          <div className="qr" aria-label={t('lobby.qrAria')} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="qr-text">
            <p>{t('lobby.qrHint')}</p>
            <input id="invite-link" className="text-in" readOnly value={link} onFocus={e => e.target.select()} aria-label={t('lobby.linkAria')} />
          </div>
        </div>
      )}
    </section>
  );
}
