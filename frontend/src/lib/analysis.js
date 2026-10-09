export const PLATFORMS = [
  { id: 'google', name: 'Google', color: '#60a5fa' },
  { id: 'chatgpt', name: 'ChatGPT', color: '#34d399' },
  { id: 'gemini', name: 'Gemini', color: '#a78bfa' },
  { id: 'claude', name: 'Claude', color: '#fb923c' },
  { id: 'perplexity', name: 'Perplexity', color: '#22d3ee' },
  { id: 'reddit', name: 'Reddit', color: '#fb7185' },
];

export function pathOf(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function pageIssues(p) {
  if (p.error) return [`could not fetch: ${p.error}`];
  if (p.notHtml) return ['not an HTML page'];
  if (p.offSite) return ['redirects to another site'];
  const out = [];
  if (p.status >= 400) out.push(`HTTP ${p.status}`);
  if (p.noindex) out.push('noindex');
  if (p.canonicalElsewhere) out.push('canonical points elsewhere');
  if (p.jsRendered) out.push('content needs JavaScript');
  if (!p.title) out.push('no title');
  else if (p.title.length > 65) out.push('title too long');
  else if (p.title.length < 15) out.push('title too short');
  if (!p.description) out.push('no meta description');
  else if (p.description.length > 170) out.push('description too long');
  if (p.h1Count === 0) out.push('no H1');
  else if (p.h1Count > 1) out.push('multiple H1');
  if (p.words < 300) out.push(`thin content (${p.words} words)`);
  if (!p.schemaTypes.length) out.push('no structured data');
  if (p.imgs > 0 && p.imgsMissingAlt / p.imgs > 0.5) out.push('images missing alt text');
  return out;
}

/** Best-effort search for the domain on Reddit, straight from the browser. */
export async function redditMentions(site) {
  try {
    const res = await fetch(`https://www.reddit.com/search.json?limit=15&q=${encodeURIComponent(`"${site}"`)}`);
    if (!res.ok) throw new Error(res.status);
    const posts = (await res.json()).data.children.map((c) => c.data);
    return {
      checked: true,
      postsFound: posts.length,
      posts: posts.slice(0, 10).map((p) => ({ subreddit: p.subreddit, title: p.title, score: p.score, comments: p.num_comments })),
    };
  } catch {
    return { checked: false, note: 'Reddit search could not be reached, so mentions are unverified.' };
  }
}

const cut = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '');

/** The compact crawl summary sent to the model for every platform. */
export function buildData(discovery, pages, reddit) {
  const counts = {};
  for (const p of pages) {
    for (const issue of p.issues) {
      const key = issue.replace(/ \(.*\)$/, '').replace(/^could not fetch.*/, 'could not fetch');
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const ok = pages.filter((p) => p.words != null);
  return {
    site: discovery.site,
    limits: 'On-page and crawl signals only. No ranking, traffic, backlink or brand-mention data.',
    siteSignals: {
      homepageStatus: discovery.homepage.status,
      homepageResponseMs: discovery.homepage.ms,
      https: discovery.homepage.https,
      robotsTxtFound: discovery.robots.found,
      crawlerAccess: Object.fromEntries(discovery.robots.bots.map((b) => [b.bot, b.status])),
      llmsTxtFound: discovery.llmsTxt,
      sitemapFound: discovery.sitemap.found,
      sitemapUrlCount: discovery.sitemap.total,
    },
    totals: {
      pagesCrawled: pages.length,
      averageWords: averageWords(pages),
      pagesWithAuthor: ok.filter((p) => p.hasAuthor).length,
      pagesWithDate: ok.filter((p) => p.hasDate).length,
      pagesWithQuestionHeadings: ok.filter((p) => p.questionHeadings > 0).length,
      problemCounts: counts,
    },
    pages: pages.map((p, i) => {
      const path = pathOf(p.url);
      if (p.words == null) return { path, status: p.status, problems: p.issues };
      return {
        path,
        status: p.status,
        title: cut(p.title, 120),
        metaDescription: cut(p.description, 200),
        h1: p.h1,
        h2: p.h2.slice(0, 6).map((h) => cut(h, 80)),
        words: p.words,
        schema: p.schemaTypes,
        author: p.hasAuthor,
        date: p.hasDate,
        questionHeadings: p.questionHeadings,
        internalLinks: p.internalLinks,
        problems: p.issues,
        ...(i < 5 ? { textSample: cut(p.sample, 400) } : {}),
      };
    }),
    reddit,
  };
}

export function averageWords(pages) {
  const ok = pages.filter((p) => p.words != null);
  return ok.length ? Math.round(ok.reduce((n, p) => n + p.words, 0) / ok.length) : 0;
}

const yesNo = (v) => (v ? 'Yes' : 'No');
const percent = (v) => `${v}%`;

// [key, label, which direction wins (null = shown for context only), formatter]
const COMPARE = [
  ['pages', 'Pages crawled', null, String],
  ['https', 'HTTPS', 'high', yesNo],
  ['responseMs', 'Homepage response', 'low', (v) => `${v} ms`],
  ['blocked', 'Crawlers blocked in robots.txt', 'low', String],
  ['sitemap', 'XML sitemap', 'high', yesNo],
  ['llmsTxt', 'llms.txt', 'high', yesNo],
  ['averageWords', 'Average words per page', 'high', String],
  ['problemsPerPage', 'Problems per page', 'low', String],
  ['schema', 'Pages with structured data', 'high', percent],
  ['author', 'Pages with a named author', 'high', percent],
  ['date', 'Pages with a date', 'high', percent],
  ['questions', 'Pages with question headings', 'high', percent],
];

function siteStats(discovery, pages) {
  const ok = pages.filter((p) => p.words != null);
  const share = (test) => (ok.length ? Math.round((ok.filter(test).length / ok.length) * 100) : 0);
  const problems = pages.reduce((n, p) => n + p.issues.length, 0);
  return {
    pages: pages.length,
    https: discovery.homepage.https,
    responseMs: discovery.homepage.ms,
    blocked: discovery.robots.bots.filter((b) => b.status === 'blocked').length,
    sitemap: discovery.sitemap.found,
    llmsTxt: discovery.llmsTxt,
    averageWords: averageWords(pages),
    problemsPerPage: pages.length ? +(problems / pages.length).toFixed(1) : 0,
    schema: share((p) => p.schemaTypes.length > 0),
    author: share((p) => p.hasAuthor),
    date: share((p) => p.hasDate),
    questions: share((p) => p.questionHeadings > 0),
  };
}

/** Side-by-side crawl signals for two sites; `winner` is 'mine', 'theirs' or null for a tie. */
export function compareSites(mine, theirs) {
  const a = siteStats(mine.discovery, mine.pages);
  const b = siteStats(theirs.discovery, theirs.pages);
  return COMPARE.map(([key, label, better, format]) => {
    const diff = better ? (Number(a[key]) - Number(b[key])) * (better === 'low' ? -1 : 1) : 0;
    return { label, mine: format(a[key]), theirs: format(b[key]), winner: diff > 0 ? 'mine' : diff < 0 ? 'theirs' : null };
  });
}
