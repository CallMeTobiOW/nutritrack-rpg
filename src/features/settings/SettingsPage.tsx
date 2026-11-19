import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Database, Download, Globe, HardDrive, Lock, Share, ShieldCheck, SquarePlus, Trash2, Upload } from 'lucide-react';
import { ALL_TABLES, db } from '../../db/db';
import { updateSettings } from '../../db/actions';
import { BackupError, createBackup, deliverBackup, restoreBackup, validateBackup, wipeAllData } from '../../db/backup';
import { useSettings } from '../../hooks/useData';
import { sfx } from '../../lib/sound';
import { plural } from '../../lib/food';
import { BRIEFINGS } from '../../data/briefings';
import type { ThemePreference } from '../../lib/models';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { Label, NumberInput, TextInput, Toggle } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function SettingsPage() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<unknown>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');

  const counts = useLiveQuery(async () => {
    const [diary, foods, water, weights, xp] = await Promise.all([db.diary.count(), db.foods.count(), db.water.count(), db.weights.count(), db.xpEvents.count()]);
    return { diary, foods, water, weights, xp };
  }, []);
  const storage = useLiveQuery(async () => {
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    const est = await navigator.storage?.estimate?.();
    return { persisted, usedKb: est?.usage ? Math.round(est.usage / 1024) : null };
  }, []);

  const exportData = async () => {
    try {
      const result = await deliverBackup(await createBackup());
      if (result !== 'cancelled') {
        await updateSettings({ lastBackupAt: Date.now() });
        setStatus(result === 'shared' ? 'Backup ready. Choose "Save to Files" to keep it safe.' : 'Backup downloaded.');
      }
    } catch (e) {
      setStatus(`Export failed: ${(e as Error).message}`);
    }
  };

  return (
    <Page>
      <PageHeader back kicker="Systems" title="Settings & data" />
      <div className="space-y-4">
        {!isStandalone() && <InstallCard />}

        <Card>
          <SectionTitle>Appearance</SectionTitle>
          <Segmented<ThemePreference>
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
          <div className="mt-4">
            <Label>Weight unit</Label>
            <Segmented
              value={settings.weightUnit}
              onChange={(weightUnit) => void updateSettings({ weightUnit })}
              options={[
                { value: 'kg', label: 'Kilograms' },
                { value: 'lbs', label: 'Pounds' },
              ]}
            />
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <Toggle
              checked={settings.sound}
              onChange={(sound) => {
                void updateSettings({ sound });
                if (sound) setTimeout(() => sfx.quest(), 50);
              }}
              label="Sound effects"
              description="Short synthesised chimes for quests and achievements."
            />
          </div>
        </Card>

        <Card>
          <SectionTitle>Rewards</SectionTitle>
          <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
            <span className="text-sm">
              <span className="block font-medium">Daily missions bonus</span>
              <span className="block text-xs text-muted">Extra XP for clearing every daily mission. Set XP for each quest in its editor.</span>
            </span>
            <NumberInput value={settings.allDailyBonusXp} decimals={false} onValue={(v) => v !== undefined && void updateSettings({ allDailyBonusXp: v })} suffix="XP" aria-label="Daily missions bonus XP" />
          </div>
        </Card>

        <Card>
          <SectionTitle>Backup &amp; restore</SectionTitle>
          <p className="mb-3 text-sm text-muted">
            Everything is stored only on this device. Export a backup regularly, and before deleting Safari data or switching phones.
            {settings.lastBackupAt ? ` Last backup: ${new Date(settings.lastBackupAt).toLocaleDateString()}.` : ' No backup yet.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={exportData}>
              <Download size={18} /> Export
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={18} /> Restore
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                // Check the file before asking to replace data, so a bad file never reaches the confirm step.
                setPendingRestore(validateBackup(JSON.parse(await f.text())));
              } catch (err) {
                setStatus(err instanceof BackupError ? err.message : 'That file could not be read as a backup.');
              }
            }}
          />
          {status && <p className="mt-3 text-sm text-primary">{status}</p>}
          {counts && (
            <p className="mt-3 text-xs text-faint tabular">
              {[
                plural(counts.diary, 'diary entry', 'diary entries'),
                plural(counts.foods, 'saved food'),
                plural(counts.water, 'drink'),
                plural(counts.weights, 'weigh-in'),
                plural(counts.xp, 'XP record'),
              ].join(' · ')}
              {storage?.usedKb != null && ` · ${storage.usedKb.toLocaleString()} KB used`}
            </p>
          )}
        </Card>

        <PrivacyCard persisted={storage?.persisted ?? false} />

        <Card>
          <SectionTitle>Danger zone</SectionTitle>
          <Button variant="secondary" block className="text-danger" onClick={() => setWipeOpen(true)}>
            <Trash2 size={18} /> Delete all data
          </Button>
        </Card>

        <Card>
          <SectionTitle>About</SectionTitle>
          <div className="space-y-1.5 text-sm text-muted">
            <p>
              <b className="text-text">NutriTrack RPG</b> v{__APP_VERSION__} · a personal, offline-first nutrition RPG.
            </p>
            <p>{BRIEFINGS.length} original briefings · all characters, writing and artwork are original.</p>
            <p>
              Food data ©{' '}
              <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="text-primary">
                Open Food Facts
              </a>{' '}
              contributors (Open Database License). Icons: Lucide (ISC). Fonts: Inter and Rajdhani (SIL Open Font License).
            </p>
            <p className="text-xs text-faint">Not medical advice. Targets are estimates; talk to a professional about specific health needs.</p>
          </div>
        </Card>
      </div>

      <Sheet open={pendingRestore !== null} onClose={() => setPendingRestore(null)} title="Restore backup?">
        <div className="space-y-3 py-2">
          <p className="flex gap-2 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange" />
            Restoring replaces everything currently in the app with the contents of the backup. This can&apos;t be undone.
          </p>
          <Button
            variant="primary"
            block
            onClick={async () => {
              try {
                const r = await restoreBackup(pendingRestore);
                const total = Object.values(r.counts).reduce((a, b) => a + (b ?? 0), 0);
                setStatus(`Restored ${total.toLocaleString()} records.`);
              } catch (e) {
                setStatus((e as Error).message);
              }
              setPendingRestore(null);
            }}
          >
            Replace my data
          </Button>
          <Button variant="ghost" block onClick={() => setPendingRestore(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false);
          setWipeText('');
        }}
        title="Delete all data"
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted">
            This permanently erases your profile, diary, foods, water, weight, quests, XP and achievements from this device ({ALL_TABLES.length} data stores). Export a backup first if you might want it back.
          </p>
          <Label htmlFor="wipe">Type DELETE to confirm</Label>
          <TextInput id="wipe" value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          <Button
            variant="danger"
            block
            disabled={wipeText.trim().toUpperCase() !== 'DELETE'}
            onClick={async () => {
              await wipeAllData();
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            <Trash2 size={18} /> Permanently delete everything
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

function PrivacyCard({ persisted }: { persisted: boolean }) {
  return (
    <Card>
      <SectionTitle>Privacy</SectionTitle>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3">
          <HardDrive size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <b>Stored on this device only.</b> Your profile, diary, weight, water, quests and XP live in this browser&apos;s private storage (IndexedDB). There is no
            account, no server and no tracking.
          </span>
        </li>
        <li className="flex gap-3">
          <Globe size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <b>What goes to Open Food Facts:</b> only the barcode you scan or type, or the words you search for, plus the standard information any website
            request includes (your IP address and browser type). Product photos are loaded from their image server. No personal or diary data is ever sent.
          </span>
        </li>
        <li className="flex gap-3">
          <Lock size={18} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <b>Camera:</b> the video is processed on your phone to read the barcode. No images are saved or uploaded.
          </span>
        </li>
        <li className="flex gap-3">
          {persisted ? <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" /> : <Database size={18} className="mt-0.5 shrink-0 text-orange" />}
          <span>
            <b>Storage protection:</b>{' '}
            {persisted
              ? 'this browser has agreed to keep your data unless you delete it.'
              : 'the browser may clear stored data if the device runs very low on space, or (on iPhone) if the app is not opened for several weeks. Installing to the Home Screen and exporting backups keeps you safe.'}
          </span>
        </li>
      </ul>
    </Card>
  );
}

function InstallCard() {
  return (
    <Card hud>
      <SectionTitle>Install on iPhone</SectionTitle>
      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="font-hud grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
          <span>
            Open this page in <b>Safari</b>.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-hud grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
          <span>
            Tap <Share size={16} className="inline align-[-3px] text-primary" /> <b>Share</b>.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-hud grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
          <span>
            Choose <SquarePlus size={16} className="inline align-[-3px] text-primary" /> <b>Add to Home Screen</b>.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-hud grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">4</span>
          <span>
            Name it <b>NUTRITRACK</b> and tap <b>Add</b>.
          </span>
        </li>
      </ol>
      <p className="mt-3 text-xs text-faint">
        The installed app keeps its own storage, separate from Safari tabs. If you have already logged data in Safari, export a backup here first and restore it inside the installed app.
      </p>
    </Card>
  );
}
