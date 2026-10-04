import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../auth.jsx';
import * as api from '../api.js';
import { PLATFORMS, averageWords, buildData, pageIssues, pathOf, redditMentions } from '../lib/analysis.js';
import { renderMarkdown } from '../lib/markdown.js';

const STEPS = ['Check site', 'Crawl pages', 'Write reports'];
const CONCURRENCY = 4;
const ACCESS = {
  allowed: ['Allowed', 'good'],
  partial: ['Partly blocked', 'warn'],
  blocked: ['Blocked', 'bad'],
};

/** Crawls up to `max` pages a few at a time, following links when the sitemap runs out. */
function crawl(token, discovery, max, onPage) {
  const key = (u) => u.replace(/#.*$/, '').replace(/\/$/, '');
  const queue = [discovery.homepage.finalUrl, ...discovery.sitemap.urls];
  const seen = new Set();
  const pages = [];
  let started = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const pump = () => {
      while (active < CONCURRENCY && started < max) {
        let url = null;
        while (queue.length) {
          const candidate = queue.shift();
          if (!seen.has(key(candidate))) {
            seen.add(key(candidate));
            url = candidate;
            break;
          }
        }
        if (!url) break;
        started++;
        active++;
        api.inspectPage(token, discovery.site, url)
          .catch((err) => {
            if (err.status === 401) throw err;
            return { url, error: err.message };
          })
          .then((page) => {
            if (page.finalUrl) seen.add(key(page.finalUrl));
            page.issues = pageIssues(page);
            pages.push(page);
            for (const link of page.links || []) if (!seen.has(key(link))) queue.push(link);
            onPage(page, pages.length);
            active--;
            pump();
          })
          .catch(reject);
      }
      if (active === 0) resolve(pages);
    };
    pump();
  });
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const runId = useRef(0);

  const [site, setSite] = useState('');
  const [max, setMax] = useState(25);
  const [step, setStep] = useState(-1); // -1 idle, 0-2 running, 3 finished
  const [error, setError] = useState('');
  const [discovery, setDiscovery] = useState(null);
  const [pages, setPages] = useState([]);
  const [reports, setReports] = useState({});
  const [tab, setTab] = useState('google');

  const running = step >= 0 && step < 3;
  const blocked = discovery ? discovery.robots.bots.filter((b) => b.status === 'blocked').length : 0;
  const problems = pages.reduce((n, p) => n + p.issues.length, 0);
  const report = reports[tab];
  const reportHtml = useMemo(() => (report?.text ? renderMarkdown(report.text) : ''), [report?.text]);
  const anyReport = PLATFORMS.some((p) => reports[p.id]?.text);

  async function run(e) {
    e.preventDefault();
    const id = ++runId.current;
    const live = () => runId.current === id;
    const patch = (platform, change) =>
      live() && setReports((prev) => ({ ...prev, [platform]: { ...prev[platform], ...change } }));

    setError('');
    setDiscovery(null);
    setPages([]);
    setReports({});
    setTab('google');
    setStep(0);

    try {
      const found = await api.discover(user.token, site);
      setDiscovery(found);
      setStep(1);

      const [crawled, reddit] = await Promise.all([
        crawl(user.token, found, max, (page) => live() && setPages((prev) => [...prev, page])),
        redditMentions(found.site),
      ]);
      setStep(2);

      const data = buildData(found, crawled, reddit);
      await Promise.all(PLATFORMS.map(async ({ id: platform }) => {
        patch(platform, { state: 'run', text: '' });
        try {
          await api.analyze(user.token, platform, data, (text) => patch(platform, { text }));
          patch(platform, { state: 'done' });
        } catch (err) {
          if (err.status === 401) throw err;
          patch(platform, { state: 'err', error: err.message });
        }
      }));
      setStep(3);
    } catch (err) {
      if (err.status === 401) {
        signOut();
        navigate('/signin', { replace: true });
        return;
      }
      setError(err.message);
      setStep(-1);
    }
  }

  function download() {
    const parts = [`# AI Rank Checker report for ${discovery.site}`];
    for (const p of PLATFORMS) if (reports[p.id]?.text) parts.push(`\n\n## ${p.name}\n\n${reports[p.id].text}`);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([parts.join('')], { type: 'text/markdown' }));
    link.download = `${discovery.site}-rank-report.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <Nav />
      <main className="dash">
        <h1>New audit</h1>
        <p className="muted">Enter a domain to crawl it and get fixes for each platform.</p>

        <form className="card run-form" onSubmit={run}>
          <div className="field grow">
            <label htmlFor="site">Domain</label>
            <input id="site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="example.com"
              autoComplete="off" required disabled={running} />
          </div>
          <div className="field">
            <label htmlFor="max">Pages to analyse</label>
            <select id="max" value={max} onChange={(e) => setMax(+e.target.value)} disabled={running}>
              <option value={10}>10 pages</option>
              <option value={25}>25 pages</option>
              <option value={50}>50 pages</option>
            </select>
          </div>
          <button className="btn btn-primary" disabled={running}>{running ? 'Analysing…' : 'Analyse site'}</button>
        </form>

        {error && <p className="alert alert-error" role="alert">{error}</p>}

        {step >= 0 && (
          <ol className="stepper" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'done' : i === step ? 'current' : ''}>
                <span>{i < step ? '✓' : i + 1}</span>
                {label}
                {i === 1 && step === 1 && <em>{pages.length} of up to {max}</em>}
              </li>
            ))}
          </ol>
        )}

        {step === -1 && !error && !discovery && (
          <div className="card empty">
            <h2>No audit yet</h2>
            <p>Your results will appear here: crawler access, page problems and one report per platform.</p>
          </div>
        )}

        {discovery && (
          <section className="tiles" aria-label="Summary">
            <Tile label="Pages crawled" value={pages.length} />
            <Tile label="Problems found" value={problems} tone={problems ? 'warn' : 'good'} />
            <Tile label="Crawlers blocked" value={`${blocked} of ${discovery.robots.bots.length}`} tone={blocked ? 'bad' : 'good'} />
            <Tile label="Average words per page" value={averageWords(pages)} />
          </section>
        )}

        {step >= 2 && (
          <section className="card">
            <div className="card-head">
              <h2>Why it is not ranking, and what to change</h2>
              <button type="button" className="btn btn-outline" onClick={download} disabled={!anyReport || running}>
                Download report
              </button>
            </div>
            <div className="tabs" role="tablist">
              {PLATFORMS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)}>
                  {p.name}
                  <i className={`dot ${reports[p.id]?.state || ''}`} />
                </button>
              ))}
            </div>
            <div className="report" role="tabpanel">
              {report?.state === 'err' ? (
                <p className="alert alert-error">{report.error}</p>
              ) : reportHtml ? (
                <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
              ) : (
                <p className="muted">Writing the report…</p>
              )}
            </div>
            <p className="hint">
              Based on what the crawl found on the site. Rankings, traffic, backlinks and brand mentions are not included.
            </p>
          </section>
        )}

        {discovery && (
          <details className="card" open={step < 2}>
            <summary><h2>Crawler access and site checks</h2></summary>
            <ul className="facts">
              <Fact label="Homepage" value={`HTTP ${discovery.homepage.status} in ${discovery.homepage.ms} ms`} ok={discovery.homepage.status === 200} />
              <Fact label="HTTPS" value={discovery.homepage.https ? 'Yes' : 'No'} ok={discovery.homepage.https} />
              <Fact label="robots.txt" value={discovery.robots.found ? 'Found' : 'Missing'} ok={discovery.robots.found} />
              <Fact label="XML sitemap" value={discovery.sitemap.found ? `${discovery.sitemap.total} URLs` : 'Not found'} ok={discovery.sitemap.found} />
              <Fact label="llms.txt" value={discovery.llmsTxt ? 'Found' : 'Not found (optional)'} ok />
            </ul>
            <div className="scroll">
              <table>
                <thead><tr><th>Crawler</th><th>Used for</th><th>robots.txt</th></tr></thead>
                <tbody>
                  {discovery.robots.bots.map((b) => (
                    <tr key={b.bot}>
                      <td><code>{b.bot}</code></td>
                      <td>{b.role}</td>
                      <td><span className={`pill ${ACCESS[b.status][1]}`}>{ACCESS[b.status][0]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {pages.length > 0 && (
          <details className="card" open={step < 2}>
            <summary><h2>Pages crawled ({pages.length})</h2></summary>
            <div className="scroll">
              <table>
                <thead><tr><th>Page</th><th>Status</th><th>Words</th><th>Problems found</th></tr></thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.url}>
                      <td className="url"><a href={p.url} target="_blank" rel="noopener noreferrer">{pathOf(p.url)}</a></td>
                      <td>{p.status ?? '–'}</td>
                      <td>{p.words ?? '–'}</td>
                      <td>
                        {p.issues.length
                          ? p.issues.map((issue) => <span className="pill warn" key={issue}>{issue}</span>)
                          : <span className="pill good">none</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </main>
    </>
  );
}

function Tile({ label, value, tone = '' }) {
  return (
    <div className={`tile ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Fact({ label, value, ok }) {
  return (
    <li>
      <span>{label}</span>
      <b className={`pill ${ok ? 'good' : 'bad'}`}>{value}</b>
    </li>
  );
}
