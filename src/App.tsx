import { ClaudePage, FeaturesPage, RevisionsPage } from './pages/InfoPages';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SldPage } from './pages/SldPage';
import { ShortcutOverlay, SideNav, StatusBar, Toasts, TopBar, useHashRoute } from './shell/Shell';

export function App() {
  const route = useHashRoute();
  return (
    <div className="app">
      <TopBar />
      <div className="shell">
        <SideNav route={route} />
        <main className={route === 'sld' ? 'main full' : 'main'}>
          {route === 'sld' && <SldPage />}
          {route === 'projects' && <ProjectsPage />}
          {route === 'revisions' && <RevisionsPage />}
          {route === 'features' && <FeaturesPage />}
          {route === 'claude' && <ClaudePage />}
          {route === 'settings' && <SettingsPage />}
        </main>
      </div>
      <StatusBar />
      <Toasts />
      <ShortcutOverlay />
    </div>
  );
}
