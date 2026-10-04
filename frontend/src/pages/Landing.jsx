import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../auth.jsx';
import { PLATFORMS } from '../lib/analysis.js';

const PREVIEW = [
  ['Googlebot', 'Allowed', 'good'],
  ['OAI-SearchBot', 'Blocked', 'bad'],
  ['Claude-SearchBot', 'Blocked', 'bad'],
  ['PerplexityBot', 'Allowed', 'good'],
];

const FEATURES = [
  ['Crawler access check', 'See which of 11 search and AI crawlers your robots.txt lets in, and which it turns away.'],
  ['Page-by-page audit', 'Titles, descriptions, headings, content depth, structured data and JavaScript-only content, checked on every page.'],
  ['One report per platform', 'Each platform reads the web differently. You get a separate list of fixes for each, with the exact text to change.'],
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
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">SEO and AI search audit</p>
            <h1>Find out why search engines and AI assistants skip your site</h1>
            <p className="lead">
              Enter a domain. Get a page-by-page list of what to change to show up on Google, ChatGPT, Gemini,
              Claude, Perplexity and Reddit.
            </p>
            <div className="hero-actions">
              <Link to={start} className="btn btn-primary btn-lg">{user ? 'Open dashboard' : 'Sign up free'}</Link>
              {!user && <Link to="/signin" className="btn btn-outline btn-lg">Sign in</Link>}
            </div>
            <ul className="platform-row" aria-label="Platforms covered">
              {PLATFORMS.map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
          </div>

          <div className="preview" aria-hidden="true">
            <div className="preview-bar"><span /><span /><span /><b>yoursite.com</b></div>
            <div className="preview-body">
              <p className="preview-label">Crawler access</p>
              {PREVIEW.map(([bot, status, tone]) => (
                <div className="preview-row" key={bot}>
                  <code>{bot}</code>
                  <span className={`pill ${tone}`}>{status}</span>
                </div>
              ))}
              <p className="preview-label">Top fix for ChatGPT</p>
              <p className="preview-fix">
                Your robots.txt blocks <code>OAI-SearchBot</code>, so ChatGPT search cannot index any page. Remove
                the rule to become eligible for citations.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>What you get</h2>
          <div className="grid-3">
            {FEATURES.map(([title, text]) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>How it works</h2>
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-num">{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="cta">
          <h2>Check your site now</h2>
          <p>Create an account and run your first audit in a couple of minutes.</p>
          <Link to={start} className="btn btn-primary btn-lg">{user ? 'Open dashboard' : 'Sign up free'}</Link>
        </section>
      </main>
      <footer className="footer">
        Reports are based on what is on your site. They do not include ranking, traffic or backlink data.
      </footer>
    </>
  );
}
