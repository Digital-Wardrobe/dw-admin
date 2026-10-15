import { useSearchParams } from 'react-router-dom';
import { useMe } from '../../lib/me';
import { PageHeader } from '../../components/ui';
import Inbox from './Inbox';
import { TeamTab, RepliesTab, InsightsTab } from './Tabs';

/* Support: the inbox for agents, team performance and ready replies for leads, insights for leads
   and analysts. What shows depends on the person's access profile (the API checks it too). */

const TABS = [
  { id: 'inbox', label: 'Inbox', perm: 'support' },
  { id: 'team', label: 'Team', perm: 'support.team' },
  { id: 'replies', label: 'Ready replies', perm: 'support' },
  { id: 'insights', label: 'Insights', perm: 'support.insights' },
] as const;

export default function Support() {
  const { can } = useMe();
  const [sp, setSp] = useSearchParams();
  const tabs = TABS.filter((t) => can(t.perm));
  const tab = tabs.find((t) => t.id === sp.get('tab'))?.id || tabs[0]?.id;
  const go = (id: string) => { const n = new URLSearchParams(); n.set('tab', id); setSp(n, { replace: true }); };

  return (
    <>
      <PageHeader title="Support" subtitle="Help chats from the app. Lists show no messages or photos; opening a chat or a customer’s details is logged, and so is every reply and action." />
      {tabs.length > 1 && (
        <div className="mb-3 flex gap-1 border-b border-ink-700" role="tablist" aria-label="Support sections">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${tab === t.id ? 'border-brand text-ink-50' : 'border-transparent text-ink-400 hover:text-ink-100'}`}>{t.label}</button>
          ))}
        </div>
      )}
      {tab === 'inbox' && <Inbox />}
      {tab === 'team' && <TeamTab />}
      {tab === 'replies' && <RepliesTab />}
      {tab === 'insights' && <InsightsTab />}
    </>
  );
}
