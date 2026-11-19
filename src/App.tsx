import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ensureInitialized } from './db/actions';
import { requestPersistentStorage } from './db/db';
import { isConnectionLostError, recoverConnection } from './db/recovery';
import { syncProgression } from './db/progression';
import { useProfileOrLoading, useSettings } from './hooks/useData';
import { useApplyTheme } from './hooks/useTheme';
import { useToday } from './hooks/useToday';
import { setSoundEnabled } from './lib/sound';
import { BottomNav } from './components/layout/BottomNav';
import { Celebrations } from './components/layout/Celebrations';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { BriefingGate } from './features/briefing/BriefingOverlay';
import { RankChangeGate } from './features/rank/RankChangeOverlay';
import { HomePage } from './features/home/HomePage';
import { Onboarding } from './features/onboarding/Onboarding';
import { Splash } from './components/layout/Splash';

const FoodPage = lazy(() => import('./features/food/FoodPage'));
const AddFoodPage = lazy(() => import('./features/food/AddFoodPage'));
const ScannerPage = lazy(() => import('./features/food/ScannerPage'));
const CustomFoodPage = lazy(() => import('./features/food/CustomFoodPage'));
const NutritionPage = lazy(() => import('./features/nutrition/NutritionPage'));
const QuestsPage = lazy(() => import('./features/quests/QuestsPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const DetailsPage = lazy(() => import('./features/profile/DetailsPage'));
const TargetsPage = lazy(() => import('./features/profile/TargetsPage'));
const WeightPage = lazy(() => import('./features/weight/WeightPage'));
const WaterPage = lazy(() => import('./features/water/WaterPage'));
const StatsPage = lazy(() => import('./features/stats/StatsPage'));
const RankPage = lazy(() => import('./features/rank/RankPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = useToday();
  const settings = useSettings();
  const profile = useProfileOrLoading();
  useApplyTheme(settings.theme);
  setSoundEnabled(settings.sound);

  const [initAttempt, setInitAttempt] = useState(0);

  useEffect(() => {
    ensureInitialized()
      .then(() => syncProgression({ silent: true }))
      .then(() => setReady(true))
      .catch(async (e: Error) => {
        // iOS can hand us a dead IndexedDB connection on resume: reconnect and retry.
        if (isConnectionLostError(e) && (await recoverConnection()) === 'reopen') setInitAttempt((n) => n + 1);
        else setError(e.message || 'Could not open local storage.');
      });
  }, [initAttempt]);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // New local day (or week): re-evaluate quests and streaks.
  useEffect(() => {
    if (ready) void syncProgression({ silent: true, today });
  }, [ready, today]);

  if (error) return <Splash error={error} />;
  if (!ready || profile === undefined) return <Splash />;
  if (!profile?.onboarded) return <Onboarding />;

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-dvh" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/food/add" element={<AddFoodPage />} />
          <Route path="/food/scan" element={<ScannerPage />} />
          <Route path="/food/custom" element={<CustomFoodPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/quests" element={<QuestsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/details" element={<DetailsPage />} />
          <Route path="/profile/targets" element={<TargetsPage />} />
          <Route path="/profile/weight" element={<WeightPage />} />
          <Route path="/profile/stats" element={<StatsPage />} />
          <Route path="/profile/rank" element={<RankPage />} />
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/water" element={<WaterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <NavUnlessFullscreen />
      <BriefingGate today={today} />
      <RankChangeGate today={today} />
      <Celebrations />
      <UpdatePrompt />
    </>
  );
}

function NavUnlessFullscreen() {
  const { pathname } = useLocation();
  if (pathname === '/food/scan') return null;
  return <BottomNav />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
