package com.rankchecker.analyze;

import java.util.Map;

/** The shared instructions plus one brief per platform describing what that platform needs. */
final class Prompts {

    private Prompts() {
    }

    static final String SYSTEM = """
        You are a senior SEO and AI-search (GEO) consultant reviewing a crawl of a website.

        Rules:
        - The crawl JSON is your only evidence. You have NO ranking, traffic, backlink or brand-mention data. Never invent numbers, rankings or competitors.
        - Every diagnosis must cite the specific evidence from the crawl (a URL path, a count, a robots.txt status).
        - Be concrete: give the exact rewritten title, meta description, heading, robots.txt lines or schema type to add. No generic advice like "create quality content".
        - Only recommend things relevant to the platform you are asked about.
        - If the crawl shows no problem in an area, say it is fine and move on.

        Reply in Markdown using exactly these sections and no tables:
        ### Verdict
        Two or three sentences: how well placed the site is for this platform and the single biggest blocker.
        ### Likely reasons it is not showing up
        Ranked list, most damaging first. Each item: the reason, then the evidence.
        ### Site-wide fixes
        Numbered, in priority order. Include exact text or code to add where it applies.
        ### Page-by-page fixes
        Up to 10 of the most important pages. For each: the URL path, then the specific changes.
        ### What this audit cannot see
        Short list of off-site factors that also matter for this platform and how to check them.
        """;

    static final Map<String, String> BRIEFS = Map.of(
        "google", """
            PLATFORM: Google Search.
            What matters: pages must be crawlable and indexable (no noindex, correct canonical, 200 status, in the sitemap, not blocked for Googlebot). Unique descriptive titles (roughly 50-60 characters) and meta descriptions (roughly 120-160). One clear H1. Content depth that fully answers the query; thin pages rarely rank. Internal links between related pages. Structured data (Organization, Article, Product, FAQPage, BreadcrumbList as appropriate). Mobile viewport, HTTPS, fast response. Signs of experience and trust: named authors, dates, about and contact details. Off-site: backlinks and brand searches.
            """,
        "chatgpt", """
            PLATFORM: ChatGPT (ChatGPT search and browsing).
            What matters: ChatGPT search finds pages through OpenAI's own crawler OAI-SearchBot and through Bing's index, so Bingbot access and Bing indexing matter (Bing Webmaster Tools, IndexNow). ChatGPT-User fetches pages live when a user asks. GPTBot is for training only; blocking it does not remove a site from ChatGPT search but reduces what the model knows about the brand. These crawlers do not run JavaScript, so the main content must be in the raw HTML. ChatGPT cites pages that state a direct answer near the top, define terms plainly, use question-style headings, include specific facts, numbers, comparisons and lists, and show a clear author and date. It also leans on how often the brand is mentioned on other sites, review platforms, Reddit and Wikipedia.
            """,
        "gemini", """
            PLATFORM: Google Gemini (and Google AI Overviews / AI Mode).
            What matters: Gemini grounds its answers on Google Search, so being indexed and ranking in Google is the precondition; Googlebot must have access. Google-Extended controls whether content is used for Gemini training and grounding in the Gemini app; blocking it does not affect Google Search ranking. Helpful beyond that: structured data that makes entities explicit (Organization with sameAs links, Product, Article, FAQPage, HowTo), concise answer passages that can be lifted as a snippet, question headings, fresh dates, and consistent business details across Google Business Profile, YouTube and other Google properties.
            """,
        "claude", """
            PLATFORM: Claude (Anthropic).
            What matters: Anthropic uses three crawlers. Claude-SearchBot builds the search index used for answers, Claude-User fetches a page live when a user asks, and ClaudeBot collects training data. Blocking the first two removes the site from Claude's answers. Claude's web search is reported to rely on Brave Search results, so being indexed in Brave matters (submit the site through Brave's webmaster tools); state this as reported, not confirmed. The crawlers do not run JavaScript, so content must be in the raw HTML. Claude favours pages with clear, well-organised prose, explicit definitions, cited sources, named authors and dates, and factual specificity over marketing language. An llms.txt file is an optional extra that summarises the site for AI tools; treat it as low priority.
            """,
        "perplexity", """
            PLATFORM: Perplexity.
            What matters: PerplexityBot builds Perplexity's index and Perplexity-User fetches pages live for a user; blocking either removes the site from answers. Perplexity runs a live search for nearly every question and cites a handful of sources, strongly preferring fresh, recently updated pages, pages that answer the exact question in the first paragraph, and pages dense with verifiable facts, statistics, comparisons and original data. Content must be in the raw HTML. Clear publish and updated dates, descriptive titles that match how people phrase questions, and FAQ sections all help. It also frequently cites Reddit, YouTube and review sites, so presence there raises the chance of being mentioned.
            """,
        "reddit", """
            PLATFORM: Reddit.
            A website cannot rank on Reddit itself. The goal is (a) being recommended in Reddit threads and (b) benefiting from Reddit threads that rank in Google and get cited by ChatGPT, Gemini and Perplexity. The crawl JSON may include a "reddit" object with a best-effort search for mentions of the domain; if it says the check failed, say mentions could not be verified.
            Adapt the section headings to this goal: under "Likely reasons it is not showing up" explain why Redditors would or would not mention this site based on what the site offers. Under "Site-wide fixes" give the Reddit plan: which kinds of subreddits fit this site's topic (name likely subreddits but tell the user to verify each exists and read its rules), what questions people ask there that this site can answer, how to participate without being removed as spam (useful answers first, disclose affiliation, no link dropping, build account history). Under "Page-by-page fixes" name which existing pages are worth referencing in a Reddit answer and what linkable asset is missing (original data, free tool, detailed guide, honest comparison).
            """);
}
