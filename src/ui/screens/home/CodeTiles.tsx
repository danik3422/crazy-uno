import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { CODE_LEN, normalizeCode } from '../../../net/protocol';
import { FitLetter } from '../../components/FitLetter';
import './CodeTiles.css';

/** Four coloured card-tiles over one real input: type, paste or tap to edit the room code. */
export function CodeTiles({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // a full code: the keyboard goes away
  useEffect(() => {
    if (value.length === CODE_LEN) input.current?.blur();
  }, [value]);
  const caretAt = Math.min(value.length, CODE_LEN - 1);
  return (
    <div className={`code-tiles-in ${focused ? 'focus' : ''}`} onClick={() => input.current?.focus()}>
      {Array.from({ length: CODE_LEN }, (_, i) => (
        <span key={i} className={`ct t${i} ${value[i] ? 'filled' : ''} ${focused && i === caretAt ? 'caret' : ''}`} aria-hidden>
          {value[i] ? <FitLetter ch={value[i]} /> : null}
        </span>
      ))}
      <input
        id="room-code"
        ref={input}
        className="ct-input"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label={t('home.codeAria')}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(normalizeCode(e.target.value))}
      />
    </div>
  );
}
