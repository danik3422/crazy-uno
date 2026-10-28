/**
 * Small drawn icons for the game modes, in the card game's own look:
 * coloured mini UNO cards with a white edge, so they read the same on light and dark buttons.
 */
const R = '#e5413a';
const Y = '#f2bf16';
const G = '#26a556';
const B = '#2c79dc';
const EDGE = '#fffdf6';
const INK = '#2a1a10';

function MiniCard({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-6" y="-8.5" width="12" height="17" rx="2.6" fill={fill} stroke={EDGE} strokeWidth="1.6" />
      <ellipse cx="0" cy="0" rx="3.4" ry="5.6" transform="rotate(24)" fill={EDGE} opacity="0.9" />
    </g>
  );
}

export function ModeIcon({ id, size = 32 }: { id: string; size?: number }) {
  return (
    <svg className="mode-svg" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {id === 'classic' && (
        <>
          {/* a neat fan of three cards */}
          <MiniCard x={10} y={17} r={-16} fill={B} />
          <MiniCard x={22} y={17} r={16} fill={G} />
          <MiniCard x={16} y={15} r={0} fill={R} />
        </>
      )}
      {id === 'nomercy' && (
        <>
          {/* a black wild card behind a red one, set on fire: no mercy */}
          <MiniCard x={11} y={19} r={-14} fill="#19191d" />
          <MiniCard x={19} y={18} r={10} fill={R} />
          <path
            d="M24.5 3.5 C26.8 6.6 29 8.6 28.4 12 C28 14.6 25.8 16 23.6 15.8 C21.2 15.6 19.8 13.6 20.2 11.4 C20.5 9.8 21.6 9 21.9 7.6 C22.9 9.2 23.6 9.8 24.2 9.2 C25 8.2 24.4 5.8 24.5 3.5 Z"
            fill="#ff7a1a"
            stroke={INK}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d="M24 9.6 C25.4 11.2 26.2 12.4 25.6 13.8 C25.1 14.8 23.6 15 22.8 14.2 C22 13.4 22.4 12.2 23 11.6 C23.3 12.3 23.8 12.4 24 12 C24.3 11.3 24 10.4 24 9.6 Z" fill={Y} />
        </>
      )}
      {id === 'party' && (
        <>
          {/* a card with confetti flying off it */}
          <MiniCard x={13} y={19} r={-10} fill={Y} />
          <path d="M22 4 l1.4 3.2 3.4 0.4 -2.6 2.2 0.8 3.4 -3 -1.8 -3 1.8 0.8 -3.4 -2.6 -2.2 3.4 -0.4z" fill={Y} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="25" y="16" width="3" height="3" rx="0.6" fill={R} transform="rotate(20 26.5 17.5)" />
          <rect x="21" y="22" width="2.6" height="2.6" rx="0.6" fill={B} transform="rotate(-25 22.3 23.3)" />
          <circle cx="28" cy="25" r="1.4" fill={G} />
          <circle cx="6" cy="6" r="1.3" fill={B} />
        </>
      )}
      {id === 'chaos' && (
        <>
          {/* cards whirling around a swirl */}
          <path d="M16 16 m-9 0 a9 9 0 1 1 9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <path d="M16 16 m-5 0 a5 5 0 1 1 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
          <g transform="scale(0.72)" style={{ transformOrigin: '16px 16px' }}>
            <MiniCard x={6} y={8} r={-35} fill={R} />
            <MiniCard x={27} y={10} r={30} fill={Y} />
            <MiniCard x={24} y={27} r={-20} fill={B} />
            <MiniCard x={7} y={26} r={25} fill={G} />
          </g>
        </>
      )}
      {id === 'quick' && (
        <>
          {/* a card with a lightning bolt and speed lines */}
          <path d="M3 12h5M2 17h6M4 22h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
          <g transform="translate(19 16) rotate(8)">
            <rect x="-8" y="-11" width="16" height="22" rx="3.2" fill={Y} stroke={EDGE} strokeWidth="1.8" />
            <path d="M1.8 -8 L-4 1.2 L-0.2 1.2 L-2 8 L4.4 -1.6 L0.6 -1.6 Z" fill={EDGE} stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
          </g>
        </>
      )}
      {id === 'teams' && (
        <>
          {/* two cards back to back, red and blue, with a little heart: partners */}
          <MiniCard x={11} y={17} r={-14} fill={R} />
          <MiniCard x={21} y={17} r={14} fill={B} />
          <path d="M16 9.5 C16 7.6 13.4 7 12.6 8.8 C11.8 7 9.2 7.6 9.2 9.5 C9.2 11.6 12.6 13.8 12.6 13.8 C12.6 13.8 16 11.6 16 9.5 Z" transform="translate(3.4 -4.2)" fill="#ffd04a" stroke={INK} strokeWidth="0.8" />
        </>
      )}
      {id === 'autopilot' && (
        <>
          {/* a little robot holding a card: it plays your turn for you */}
          <path d="M12 5.5 V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="4.6" r="1.6" fill={Y} stroke={EDGE} strokeWidth="1" />
          <rect x="4.5" y="8" width="15" height="12" rx="3.6" fill={B} stroke={EDGE} strokeWidth="1.6" />
          <circle cx="9" cy="13.4" r="1.9" fill={EDGE} />
          <circle cx="15" cy="13.4" r="1.9" fill={EDGE} />
          <circle cx="9" cy="13.6" r="0.9" fill={INK} />
          <circle cx="15" cy="13.6" r="0.9" fill={INK} />
          <path d="M9.4 17.2 h5.2" stroke={EDGE} strokeWidth="1.4" strokeLinecap="round" />
          <MiniCard x={24} y={21} r={14} fill={R} />
        </>
      )}
      {id === 'custom' && (
        <>
          {/* sliders: your own mix */}
          {[9, 16, 23].map((y, i) => (
            <g key={y}>
              <rect x="5" y={y - 1.2} width="22" height="2.4" rx="1.2" fill="currentColor" opacity="0.45" />
              <circle cx={[11, 21, 15][i]} cy={y} r="3.2" fill={[R, Y, B][i]} stroke={EDGE} strokeWidth="1.4" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
