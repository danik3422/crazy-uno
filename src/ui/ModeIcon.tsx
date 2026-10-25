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
