import HomePage from './home/HomePage';
import HostPage from './host/HostPage';
import JoinPage from './join/JoinPage';
import PrintPage from './print/PrintPage';
import DeckPage from './deck/DeckPage';
import CreditsPage from './credits/CreditsPage';
import SoloPage from './solo/SoloPage';
import NotFound from './NotFound';
import Gallery from './ui/Gallery';

export const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/host', element: <HostPage /> },
  { path: '/r/:code', element: <JoinPage /> },
  { path: '/solo', element: <SoloPage /> },
  { path: '/print', element: <PrintPage /> },
  { path: '/deck', element: <DeckPage /> },
  { path: '/creditos', element: <CreditsPage /> },
  { path: '/ui', element: <Gallery /> },
  { path: '*', element: <NotFound /> },
];
