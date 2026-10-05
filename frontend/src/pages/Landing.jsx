import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { Aurora, CountUp, Reveal } from '../components/Effects.jsx';
import { useAuth } from '../auth.jsx';
import { PLATFORMS } from '../lib/analysis.js';

const PREVIEW = [
  ['Googlebot', 'Allowed', 'good'],
  ['OAI-SearchBot', 'Blocked', 'bad'],
  ['Claude-SearchBot', 'Blocked', 'bad'],
  ['PerplexityBot', 'Allowed', 'good'],
];

const STATS = [
  [6, 'platforms covered'],
  [11, 'crawlers checked'],
  [50, 'pages per audit'],
];

const FEATURES = [
  {
    title: 'Crawler access check',
    text: 'See which of 11 search and AI crawlers your robots.txt lets in, and which it turns away.',
    tint: '#22d3ee',
    icon: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2.2 2.2 4.3-4.4" />,
  },
  {
    title: 'Page-by-page audit',
    text: 'Titles, descriptions, headings, content depth, structured data and JavaScript-only content, checked on every page.',
    tint: '#a78bfa',
    icon: <path d="M7 3h7l4 4v14H7V3zm7 0v4h4M10 12h5M10 16h5" />,
  },
  {
    title: 'One report per platform',
    text: 'Each platform reads the web differently. You get a separate list of fixes for each, with the exact text to change.',
    tint: '#f472b6',
    icon: <path d="M4 19v-9m5.3 9V5m5.4 14v-7M20 19V8" />,
  },
];

const STEPS = [
  ['Enter your domain', 'No tracking code and no access to your accounts. Just the address.'],
  ['We crawl the site', 'Up to 50 pages from your sitemap, read the way a crawler reads them.'],
  ['Get the fixes', 'Six reports that say what is holding you back and what to change first.'],
];

export default function Landing() {
  const { user } = useAuth();
  const start = user ? '/app' : '/signup';

  return (
    <>
      <Aurora />
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow rise">SEO and AI search audit</p>
            <h1 className="rise" style={{ '--d': '80ms' }}>
              Find out why search engines and <span className="grad">AI assistants</span> skip your site
            </h1>
            <p className="lead rise" style={{ '--d': '160ms' }}>
              Enter a domain. Get a page-by-page list of what to change to show up on Google, ChatGPT, Gemini,
              Claude, Perplexity and Reddit.
            </p>
            <div className="hero-actions rise" style={{ '--d': '240ms' }}>
              <Link to={start} className="btn btn-primary btn-lg">{user ? 'Open dashboard' : 'Sign up free'}</Link>
              {!user && <Link to="/signin" className="btn btn-outline btn-lg">Sign in</Link>}
            </div>
            <ul className="platform-row" aria-label="Platforms covered">
              {PLATFORMS.map((p, i) => (
                <li key={p.id} style={{ '--c': p.color, '--d': `${340 + i * 70}ms` }}>{p.name}</li>
              ))}
            </ul>
          </div>

          <div className="rise" style={{ '--d': '200ms' }} aria-hidden="true">
            <div className="preview-wrap">
              <div className="preview">
                <div className="preview-bar"><span /><span /><span /><b>yoursite.com</b></div>
                <div className="preview-body">
                  <p className="preview-label">Crawler access</p>
                  {PREVIEW.map(([bot, status, tone], i) => (
                    <div className="preview-row" key={bot} style={{ '--d': `${500 + i * 130}ms` }}>
                      <code>{bot}</code>
                      <span className={`pill ${tone}`}>{status}</span>
                    </div>
                  ))}
                  <p className="preview-label">Top fix for ChatGPT</p>
                  <p className="preview-fix">
                    Your robots.txt blocks <code>OAI-SearchBot</code>, so ChatGPT search cannot index any page.
                    Remove the rule to become eligible for citations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stats" aria-label="At a glance">
          {STATS.map(([value, label], i) => (
            <Reveal className="stat" key={label} delay={i * 90}>
              <b className="grad"><CountUp value={value} /></b>
              <span>{label}</span>
            </Reveal>
          ))}
        </section>

        <section className="section">
          <Reveal as="h2">What you get</Reveal>
          <Reveal as="p" className="section-sub" delay={60}>
            Checks run in code against your real pages, then turned into plain fixes you can act on.
          </Reveal>
          <div className="grid-3">
            {FEATURES.map((f, i) => (
              <Reveal as="article" className="card feature" key={f.title} delay={i * 110}
                style={{ '--tint': f.tint, '--glow': `${f.tint}26` }}>
                <div className="icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section">
          <Reveal as="h2">How it works</Reveal>
          <Reveal as="p" className="section-sub" delay={60}>From domain to a prioritised to-do list in three steps.</Reveal>
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <Reveal as="li" key={title} delay={i * 110}>
                <span className="step-num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <Reveal as="section" className="cta">
          <h2>Check your <span className="grad">site</span> now</h2>
          <p>Create an account and run your first audit in a couple of minutes.</p>
          <Link to={start} className="btn btn-primary btn-lg">{user ? 'Open dashboard' : 'Sign up free'}</Link>
        </Reveal>
      </main>
      <footer className="footer">
        Reports are based on what is on your site. They do not include ranking, traffic or backlink data.
      </footer>
    </>
  );
}
