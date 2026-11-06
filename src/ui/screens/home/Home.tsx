import { useState } from 'react';
import { Profile } from '../../profile/Profile';
import { About } from '../About';
import { HowTo } from '../HowTo';
import { HomeFooter } from './HomeFooter';
import { HomeHero } from './HomeHero';
import { HomeNav, type HomeTab } from './HomeNav';
import { PlayerCard, type PlayerCardProps } from './PlayerCard';
import './Home.css';

type Props = Omit<PlayerCardProps, 'code' | 'setCode' | 'picking' | 'setPicking'>;

/**
 * The home screen: the tab bar, then the open tab. "Play" is the hero on the left and the player's card on the right
 * (one column on a phone); "Profile", "How to play" and "About" are one scrolling column each. A computer adds the footer.
 */
export function Home(props: Props) {
  const [tab, setTab] = useState<HomeTab>('play');
  // the card's state lives here so it survives a look at another tab
  const [code, setCode] = useState(props.invite);
  const [picking, setPicking] = useState(false);
  return (
    <div className={`home tab-${tab}`}>
      <HomeNav tab={tab} onTab={setTab} />
      {tab === 'profile' && <div className="home-page"><Profile name={props.name} avatar={props.avatar} /></div>}
      {tab === 'howto' && <div className="home-page"><HowTo /></div>}
      {tab === 'about' && <div className="home-page"><About /></div>}
      {tab === 'play' && (
        <>
          <HomeHero />
          <PlayerCard {...props} code={code} setCode={setCode} picking={picking} setPicking={setPicking} />
        </>
      )}
      {tab !== 'about' && <HomeFooter onAbout={() => setTab('about')} />}
    </div>
  );
}
