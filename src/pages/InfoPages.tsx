// Features (roadmap), Claude Instructions and Revisions (app version history).

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import claudeMd from '../../CLAUDE.md?raw';
import changelogMd from '../../CHANGELOG.md?raw';
import features from '../content/features.json';
import { Page } from '../shell/Shell';

type Status = 'Done' | 'In progress' | 'Planned' | 'Idea';
interface Feature { id: string; title: string; status: Status; area: string; notes?: string; version?: string }

const ORDER: Status[] = ['In progress', 'Planned', 'Idea', 'Done'];
const STATUS_CLASS: Record<Status, string> = { Done: 'okish', 'In progress': 'warnish', Planned: 'planned', Idea: 'idea' };
const STATUS_SUB: Record<Status, string> = {
  'In progress': 'Being built now.',
  Planned: 'Next up, agreed scope.',
  Idea: 'Later. Worth doing, not scheduled.',
  Done: 'Shipped in this app.',
};

export function FeaturesPage() {
  const items = (features as { items: Feature[] }).items;
  const counts = ORDER.map((s) => `${items.filter((i) => i.status === s).length} ${s.toLowerCase()}`).join(' · ');
  return (
    <Page title="Features & roadmap" sub={<>Read-only view of <code>src/content/features.json</code>. {counts}.</>}>
      {ORDER.map((status) => {
        const list = items.filter((i) => i.status === status);
        if (!list.length) return null;
        return (
          <section className="section" key={status}>
            <div className="section-head">
              <h2>{status}</h2>
              <span className="meta">{list.length} · {STATUS_SUB[status]}</span>
              <span className="rule" />
            </div>
            <div className="panel">
              <table>
                <tbody>
                  {list.map((f) => (
                    <tr key={f.id}>
                      <td style={{ width: '34%' }}><strong>{f.title}</strong></td>
                      <td style={{ width: 140 }}><span className="tag">{f.area}</span></td>
                      <td className="muted small">{f.notes}</td>
                      <td className="r" style={{ width: 120 }}>
                        <span className={`tag ${STATUS_CLASS[f.status]}`}>{f.status}</span>
                        {f.version && <span className="muted small"> v{f.version}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </Page>
  );
}

export function ClaudePage() {
  return (
    <Page title="Claude Instructions" sub={<>The repo's <code>CLAUDE.md</code>, rendered. Edit the file in the repo; this page shows the version built into the app.</>}>
      <article className="panel pad markdown">
        <Markdown remarkPlugins={[remarkGfm]}>{claudeMd}</Markdown>
      </article>
    </Page>
  );
}

interface Release { version: string; date: string; body: string }

export function parseChangelog(md: string): Release[] {
  const out: Release[] = [];
  const re = /^## \[([^\]]+)\](?:\s*-\s*(.+))?$/gm;
  const heads = [...md.matchAll(re)];
  heads.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < heads.length ? heads[i + 1]!.index! : md.length;
    out.push({ version: m[1]!, date: (m[2] ?? '').trim(), body: md.slice(start, end).trim() });
  });
  return out;
}

export function RevisionsPage() {
  const releases = parseChangelog(changelogMd);
  return (
    <Page
      title="Revisions"
      sub={<>Version history of Conductor itself. You are running <strong>v{__APP_VERSION__}</strong>. Drawing revision control (issue A/B/0/1, IFR/IFC/As-Built, compare) is on the roadmap.</>}
    >
      {releases.map((r) => (
        <section className="section" key={r.version}>
          <div className="section-head">
            <h2>v{r.version}</h2>
            {r.version === __APP_VERSION__ && <span className="tag okish">current</span>}
            <span className="meta">{r.date}</span>
            <span className="rule" />
          </div>
          <article className="panel pad markdown">
            <Markdown remarkPlugins={[remarkGfm]}>{r.body}</Markdown>
          </article>
        </section>
      ))}
    </Page>
  );
}
