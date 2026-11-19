import { useState, type ReactNode } from 'react';
import { Check, Copy, Download, ExternalLink, MapPin, Upload } from 'lucide-react';
import { updateSettings } from '../../db/actions';
import { createBackup, deliverBackup } from '../../db/backup';
import { useSettings } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { toDateKey } from '../../lib/dates';
import { isLegacyHost, NEW_HOME_LABEL, NEW_HOME_URL } from '../../lib/hosting';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { buttonClass } from '../ui/buttonStyles';
import { Sheet } from '../ui/Sheet';

/**
 * Shown only on the old GitHub Pages address. Walks the player through moving
 * their data to the new address with a backup file, because a new address on
 * iPhone starts with empty storage.
 */
export function MovedNotice() {
  const [open, setOpen] = useState(false);
  if (!isLegacyHost()) return null;
  return (
    <>
      <Card hud className="animate-fade-up border-primary/60">
        <div className="flex items-start gap-3">
          <MapPin size={22} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-hud text-lg font-bold leading-tight">NutriTrack has a new home</p>
            <p className="mt-1 text-sm text-muted">
              The app now lives at <span className="whitespace-nowrap font-semibold text-text">{NEW_HOME_LABEL}</span>. Bring your progress with you in four quick steps.
            </p>
          </div>
        </div>
        <Button variant="primary" block className="mt-3" onClick={() => setOpen(true)}>
          Move my data
        </Button>
      </Card>
      <MoveGuide open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MoveGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const today = useToday();
  const [backupState, setBackupState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const saveBackup = async () => {
    setBackupState('working');
    setMessage(null);
    try {
      const result = await deliverBackup(await createBackup());
      if (result === 'cancelled') {
        setBackupState('idle');
        return;
      }
      await updateSettings({ lastBackupAt: Date.now() });
      setBackupState('done');
      setMessage(result === 'shared' ? 'Choose "Save to Files" so you can pick it in the new app.' : 'Backup downloaded.');
    } catch (e) {
      setBackupState('error');
      setMessage(`The backup failed: ${(e as Error).message}`);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(NEW_HOME_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const backedUpToday = !!settings.lastBackupAt && toDateKey(new Date(settings.lastBackupAt)) === today;

  return (
    <Sheet open={open} onClose={onClose} title="Move to the new address" subtitle="Your data stays here until you have checked it arrived.">
      <ol className="space-y-5 pt-2">
        <Step n={1} title="Save a backup" done={backupState === 'done'}>
          <p>This puts everything (profile, diary, foods, quests, XP and rank) in one file.</p>
          <Button variant="primary" block className="mt-2" disabled={backupState === 'working'} onClick={() => void saveBackup()}>
            <Download size={18} /> {backupState === 'working' ? 'Preparing…' : backupState === 'done' ? 'Save another backup' : 'Save backup'}
          </Button>
          {message && <p className={backupState === 'error' ? 'mt-2 text-danger' : 'mt-2'}>{message}</p>}
          {backupState !== 'done' && backedUpToday && <p className="mt-2">You already saved one today. Save a fresh one if you have logged anything since.</p>}
        </Step>

        <Step n={2} title="Open the new address in Safari">
          <p>
            Copy the address, then paste it into Safari: <span className="whitespace-nowrap font-semibold text-text">{NEW_HOME_LABEL}</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void copyAddress()}>
              {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <a href={NEW_HOME_URL} target="_blank" rel="noopener" className={buttonClass()}>
              <ExternalLink size={18} /> Open
            </a>
          </div>
        </Step>

        <Step n={3} title="Add it to your Home Screen">
          <p>In Safari tap Share, then "Add to Home Screen". Open the new icon.</p>
        </Step>

        <Step n={4} title="Restore your backup">
          <p>
            On the welcome screen tap <span className="inline-flex items-center gap-1 font-semibold text-text"><Upload size={14} /> Restore from a backup</span> and pick the file
            from step 1. Check your diary and level are there, then delete this old icon.
          </p>
        </Step>
      </ol>
      <p className="mt-5 rounded-xl bg-surface-3/60 p-3 text-xs text-muted">
        Do it in one go: anything you log here after saving the backup will not move. Until you delete this icon, nothing here is lost.
      </p>
    </Sheet>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`font-hud flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-success text-white' : 'bg-surface-3 text-primary ring-1 ring-line-strong'}`}
        aria-hidden
      >
        {done ? <Check size={16} /> : n}
      </span>
      <div className="min-w-0 flex-1 text-sm text-muted">
        <p className="font-semibold text-text">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </li>
  );
}
