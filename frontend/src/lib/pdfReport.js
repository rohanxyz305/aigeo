import { PLATFORMS, averageWords, pathOf } from './analysis.js';

// Darker than the on-screen tints so they stay readable on white paper.
const PRINT_COLORS = {
  google: '#2563eb',
  chatgpt: '#059669',
  gemini: '#7c3aed',
  claude: '#ea580c',
  perplexity: '#0891b2',
  reddit: '#e11d48',
};
const INK = '#14151f';
const MUTED = '#5b6072';
const LINE = '#e2e5ee';
const SOFT = '#f5f6fb';
const BRAND = '#4f46e5';
const GOOD = '#15803d';
const WARN = '#b45309';
const BAD = '#be123c';

const ACCESS = {
  allowed: ['Allowed', GOOD],
  partial: ['Partly blocked', WARN],
  blocked: ['Blocked', BAD],
};

const rowLines = {
  hLineWidth: (i) => (i === 0 ? 0 : 0.6),
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingTop: () => 6,
  paddingBottom: () => 6,
  paddingLeft: () => 8,
  paddingRight: () => 8,
};
const noLines = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
};

// The bundled font has no emoji or pictographs; drop them instead of printing empty boxes.
const clean = (s) =>
  String(s ?? '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/→/g, '->');

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function inline(text) {
  return clean(text)
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**')) return { text: part.slice(2, -2), bold: true };
      if (part.startsWith('`')) return { text: part.slice(1, -1), color: BRAND, background: '#eef0fb' };
      return { text: part };
    });
}

function sectionHeading(text, color) {
  return {
    headlineLevel: 2,
    margin: [0, 14, 0, 8],
    table: {
      widths: [3, '*'],
      body: [[{ text: '', fillColor: color }, { text: clean(text), bold: true, fontSize: 12.5, color: INK, margin: [8, 2, 0, 2] }]],
    },
    layout: noLines,
  };
}

function codeBlock(text) {
  return {
    margin: [0, 2, 0, 10],
    table: { widths: ['*'], body: [[{ text: clean(text), fontSize: 9, color: '#27293a', preserveLeadingSpaces: true }]] },
    layout: {
      hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => SOFT,
      paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 10, paddingRight: () => 10,
    },
  };
}

/** Converts the small Markdown subset the reports use into pdfmake content. */
function markdownToContent(src, color) {
  const out = [];
  let list = null;
  let code = null;
  const flush = () => {
    if (!list) return;
    out.push({ [list.type]: list.items, ...(list.type === 'ol' ? { start: list.start } : {}), margin: [4, 0, 0, 8], markerColor: color });
    list = null;
  };
  const item = (text) => ({ text: inline(text), margin: [0, 0, 0, 4] });

  for (const line of src.split('\n')) {
    let m;
    if (line.trim().startsWith('```')) {
      if (code) {
        out.push(codeBlock(code.join('\n')));
        code = null;
      } else {
        flush();
        code = [];
      }
    } else if (code) code.push(line);
    else if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      flush();
      out.push(sectionHeading(m[1].replace(/\*\*/g, ''), color));
    } else if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) {
      if (m[1].length >= 2 && list?.type === 'ol' && list.items.length) {
        // An indented bullet under a numbered item stays inside that item.
        const i = list.items.length - 1;
        if (!list.items[i].stack) {
          list.items[i] = { stack: [{ text: list.items[i].text }, { ul: [], margin: [0, 3, 0, 0], markerColor: color }], margin: [0, 0, 0, 4] };
        }
        list.items[i].stack[1].ul.push(item(m[2]));
      } else {
        if (list?.type !== 'ul') {
          flush();
          list = { type: 'ul', items: [] };
        }
        list.items.push(item(m[2]));
      }
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)/))) {
      if (list?.type !== 'ol') {
        flush();
        list = { type: 'ol', items: [], start: +m[1] };
      }
      list.items.push(item(m[2]));
    } else if (!line.trim()) flush();
    else {
      flush();
      out.push({ text: inline(line), margin: [0, 0, 0, 8] });
    }
  }
  if (code) out.push(codeBlock(code.join('\n')));
  flush();
  return out;
}

function banner(title, subtitle, color) {
  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: title, color: '#ffffff', bold: true, fontSize: 20 },
          { text: subtitle, color: '#ffffff', opacity: 0.85, fontSize: 10.5, margin: [0, 4, 0, 0] },
        ],
        fillColor: color,
        margin: [18, 16, 18, 16],
      }]],
    },
    layout: noLines,
    margin: [0, 0, 0, 16],
  };
}

function title(text) {
  return { text, bold: true, fontSize: 14, color: INK, margin: [0, 18, 0, 8], headlineLevel: 1 };
}

function tile(value, label, color) {
  return {
    stack: [
      { text: String(value), bold: true, fontSize: 20, color },
      { text: label, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] },
    ],
    fillColor: SOFT,
    margin: [10, 10, 10, 10],
  };
}

const head = (labels) => labels.map((text) => ({ text: text.toUpperCase(), bold: true, fontSize: 7.5, color: MUTED, characterSpacing: 0.4 }));

/** Builds the pdfmake document for one finished audit. */
export function buildReportDocument({ discovery, pages, reports, generatedAt = new Date() }) {
  const site = discovery.site;
  const date = generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const bots = discovery.robots.bots;
  const blocked = bots.filter((b) => b.status === 'blocked').length;
  const problems = pages.reduce((n, p) => n + p.issues.length, 0);
  const written = PLATFORMS.filter((p) => reports[p.id]?.text);

  const counts = {};
  for (const p of pages) {
    for (const issue of p.issues) {
      const key = issue.replace(/ \(.*\)$/, '').replace(/^could not fetch.*/, 'could not fetch');
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const topProblems = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const facts = [
    ['Homepage', `HTTP ${discovery.homepage.status}, answered in ${discovery.homepage.ms} ms`, discovery.homepage.status === 200],
    ['HTTPS', discovery.homepage.https ? 'Yes' : 'No', discovery.homepage.https],
    ['robots.txt', discovery.robots.found ? 'Found' : 'Missing', discovery.robots.found],
    ['XML sitemap', discovery.sitemap.found ? `Found, ${discovery.sitemap.total} URLs` : 'Not found', discovery.sitemap.found],
    ['llms.txt', discovery.llmsTxt ? 'Found' : 'Not found (optional)', true],
  ];

  const content = [
    banner('AI Visibility Report', `${site}  ·  ${date}`, '#312e81'),
    {
      text: 'What is holding this site back on Google, ChatGPT, Gemini, Claude, Perplexity and Reddit, and what to change first.',
      color: MUTED, fontSize: 11, margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: ['*', '*', '*', '*'],
        body: [[
          tile(pages.length, 'Pages crawled', BRAND),
          tile(problems, 'Problems found', problems ? WARN : GOOD),
          tile(`${blocked} of ${bots.length}`, 'Crawlers blocked', blocked ? BAD : GOOD),
          tile(averageWords(pages), 'Average words per page', BRAND),
        ]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 || i === 4 ? 0 : 6), vLineColor: () => '#ffffff', paddingTop: () => 0, paddingBottom: () => 0, paddingLeft: () => 0, paddingRight: () => 0 },
    },

    title('How to read this report'),
    {
      ul: [
        'Section 1 covers the whole site: whether each platform\'s crawler is allowed in, and the most common page problems.',
        'Sections 2 onward give one report per platform. Each starts with a verdict, then the likely reasons, then fixes in priority order.',
        'The appendix lists every page that was crawled and what was found on it.',
      ],
      color: '#33364a', margin: [0, 0, 0, 4],
    },

    title('Contents'),
    {
      table: {
        widths: [18, '*'],
        body: [
          [{ text: '1', bold: true, color: BRAND }, 'Site overview'],
          ...written.map((p, i) => [{ text: String(i + 2), bold: true, color: PRINT_COLORS[p.id] }, `${p.name} report`]),
          [{ text: 'A', bold: true, color: MUTED }, 'Appendix: pages crawled'],
        ],
      },
      layout: rowLines,
    },

    { ...banner('1. Site overview', 'Checks that apply to the whole site', BRAND), pageBreak: 'before' },

    title('Site checks'),
    {
      table: {
        widths: [110, '*', 60],
        body: [
          head(['Check', 'Result', 'Status']),
          ...facts.map(([label, value, ok]) => [
            { text: label, bold: true }, value, { text: ok ? 'OK' : 'Fix', bold: true, color: ok ? GOOD : BAD },
          ]),
        ],
      },
      layout: rowLines,
    },

    title('Crawler access'),
    { text: 'Whether robots.txt lets each crawler read the site. A blocked crawler means that platform cannot use your pages.', color: MUTED, margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [105, '*', 80],
        body: [
          head(['Crawler', 'Used for', 'robots.txt']),
          ...bots.map((b) => [
            { text: b.bot, bold: true }, b.role, { text: ACCESS[b.status][0], bold: true, color: ACCESS[b.status][1] },
          ]),
        ],
      },
      layout: rowLines,
    },

    title('Most common page problems'),
    topProblems.length
      ? {
        table: {
          headerRows: 1,
          widths: ['*', 90],
          body: [
            head(['Problem', 'Pages affected']),
            ...topProblems.map(([name, n]) => [name.charAt(0).toUpperCase() + name.slice(1), { text: `${n} of ${pages.length}`, bold: true, color: WARN }]),
          ],
        },
        layout: rowLines,
      }
      : { text: 'No problems were found on the crawled pages.', color: GOOD },
  ];

  written.forEach((p, i) => {
    const color = PRINT_COLORS[p.id];
    content.push(
      { ...banner(`${i + 2}. ${p.name}`, `Why ${site} may not be showing up, and what to change`, color), pageBreak: 'before' },
      ...markdownToContent(reports[p.id].text, color),
    );
  });

  content.push(
    { ...banner('Appendix', `All ${pages.length} pages crawled`, '#475569'), pageBreak: 'before' },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [190, 36, 36, '*'],
        body: [
          head(['Page', 'Status', 'Words', 'Problems found']),
          ...pages.map((p) => [
            { text: cut(pathOf(p.url), 46), fontSize: 8.5 },
            { text: String(p.status ?? '-'), fontSize: 8.5 },
            { text: String(p.words ?? '-'), fontSize: 8.5 },
            p.issues.length
              ? { text: p.issues.join(', '), fontSize: 8.5, color: WARN }
              : { text: 'None', fontSize: 8.5, color: GOOD },
          ]),
        ],
      },
      layout: rowLines,
    },
    {
      text: 'This report is based on what the crawl found on the site. It does not include ranking, traffic, backlink or brand-mention data.',
      color: MUTED, fontSize: 8.5, italics: true, margin: [0, 16, 0, 0],
    },
  );

  return {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 52],
    info: { title: `AI Visibility Report: ${site}`, author: 'AI Rank Checker' },
    defaultStyle: { fontSize: 10, lineHeight: 1.35, color: '#27293a' },
    header: (page) =>
      page === 1
        ? null
        : {
          margin: [40, 24, 40, 0],
          columns: [
            { text: 'AI Rank Checker', bold: true, fontSize: 8.5, color: BRAND },
            { text: site, alignment: 'right', fontSize: 8.5, color: MUTED },
          ],
        },
    footer: (page, total) => ({
      margin: [40, 18, 40, 0],
      columns: [
        { text: `Generated ${date}`, fontSize: 8, color: MUTED },
        { text: `Page ${page} of ${total}`, alignment: 'right', fontSize: 8, color: MUTED },
      ],
    }),
    // Never leave a heading stranded at the bottom of a page.
    pageBreakBefore: (node, followingOnPage) => !!node.headlineLevel && followingOnPage.length === 0,
    content,
  };
}

/** Generates the PDF in the browser and saves it. The PDF library is loaded only when needed. */
export async function downloadPdfReport(audit) {
  const [{ default: pdfMake }, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const fonts = fontModule.default ?? fontModule;
  pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? fonts;

  const doc = pdfMake.createPdf(buildReportDocument(audit));
  await new Promise((resolve) => doc.download(`${audit.discovery.site}-ai-visibility-report.pdf`, resolve));
}

