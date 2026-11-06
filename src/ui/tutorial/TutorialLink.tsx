import { useT } from '../../i18n';
import { tutorialDone, type TutorialMode } from './tutorial';
import './TutorialLink.css';

/** A small way into a tutorial, shown until that tutorial has been played (or skipped) once. */
export function TutorialLink({ mode, onStart }: { mode: TutorialMode; onStart: (mode: TutorialMode) => void }) {
  const t = useT();
  if (tutorialDone(mode)) return null;
  return (
    <button type="button" className="tut-link" onClick={() => onStart(mode)}>
      <span aria-hidden>?</span> {t(mode === 'nomercy' ? 'tut.startNm' : 'tut.start')}
    </button>
  );
}
