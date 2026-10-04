package com.rankchecker.crawl;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Site-level checks: homepage, robots.txt rules for each platform's crawler, sitemap and llms.txt. */
@Service
public class DiscoverService {

    private record Bot(String name, String role) {
    }

    private record Rule(boolean allow, String path) {
    }

    private record Group(List<String> agents, List<Rule> rules) {
    }

    private record Robots(List<Group> groups, List<String> sitemaps) {
    }

    // Crawlers that decide whether each platform can read the site at all.
    private static final List<Bot> BOTS = List.of(
        new Bot("Googlebot", "Google Search index (also feeds Gemini and AI Overviews)"),
        new Bot("Google-Extended", "Gemini training and grounding control"),
        new Bot("Bingbot", "Bing index, which ChatGPT search draws on"),
        new Bot("OAI-SearchBot", "ChatGPT search index"),
        new Bot("ChatGPT-User", "ChatGPT fetching a page for a user"),
        new Bot("GPTBot", "OpenAI model training"),
        new Bot("ClaudeBot", "Anthropic model training"),
        new Bot("Claude-SearchBot", "Claude search index"),
        new Bot("Claude-User", "Claude fetching a page for a user"),
        new Bot("PerplexityBot", "Perplexity search index"),
        new Bot("Perplexity-User", "Perplexity fetching a page for a user"));

    private static final Pattern LOC =
        Pattern.compile("<loc>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]]+?)\\s*(?:\\]\\]>)?\\s*</loc>", Pattern.CASE_INSENSITIVE);
    private static final Pattern SITEMAP_ROOT = Pattern.compile("<(urlset|sitemapindex)", Pattern.CASE_INSENSITIVE);
    private static final Pattern SITEMAP_INDEX = Pattern.compile("<sitemapindex", Pattern.CASE_INSENSITIVE);
    private static final int MAX_URLS = 200;

    private final SafeFetcher fetcher;
    private final ExecutorService pool = Executors.newCachedThreadPool();

    public DiscoverService(SafeFetcher fetcher) {
        this.fetcher = fetcher;
    }

    public Map<String, Object> discover(String site) {
        SafeFetcher.Result home = tryFetch("https://" + site + "/", 6);
        if (home == null) {
            home = tryFetch("http://" + site + "/", 4);
        }
        if (home == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Could not reach " + site + ". Check the domain and that the site is online.");
        }
        URI homeUri = URI.create(home.url());
        String origin = homeUri.getScheme() + "://" + homeUri.getAuthority();

        CompletableFuture<SafeFetcher.Result> robotsFuture = async(origin + "/robots.txt");
        CompletableFuture<SafeFetcher.Result> llmsFuture = async(origin + "/llms.txt");
        SafeFetcher.Result robotsRes = robotsFuture.join();
        boolean robotsFound = isPlainText(robotsRes);
        Robots robots = parseRobots(robotsFound ? robotsRes.text() : "");

        List<Map<String, Object>> bots = new ArrayList<>();
        for (Bot bot : BOTS) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bot", bot.name());
            row.put("role", bot.role());
            row.put("status", access(robots, bot.name()));
            bots.add(row);
        }

        List<String> sitemapUrls = robots.sitemaps().isEmpty() ? List.of(origin + "/sitemap.xml") : robots.sitemaps();
        List<String> sitemaps = fetchAll(sitemapUrls.stream().limit(3).toList()).stream()
            .filter(r -> r != null && r.status() == 200 && SITEMAP_ROOT.matcher(r.text()).find())
            .map(SafeFetcher.Result::text)
            .toList();

        List<String> pageUrls = new ArrayList<>();
        List<String> children = new ArrayList<>();
        for (String xml : sitemaps) {
            (SITEMAP_INDEX.matcher(xml).find() ? children : pageUrls).addAll(locs(xml));
        }
        List<String> childUrls = children.stream().filter(u -> !u.endsWith(".gz")).limit(5).toList();
        for (SafeFetcher.Result r : fetchAll(childUrls)) {
            if (r != null && r.status() == 200) {
                pageUrls.addAll(locs(r.text()));
            }
        }

        Set<String> unique = new LinkedHashSet<>();
        for (String url : pageUrls) {
            try {
                if (SiteUtil.sameSite(URI.create(url).getHost(), site)) {
                    unique.add(url);
                }
            } catch (IllegalArgumentException ignored) {
                // Skip sitemap entries that aren't valid URLs.
            }
        }
        // Shallow pages first: they are usually the most important ones.
        List<String> sorted = unique.stream()
            .sorted(Comparator.comparingInt(DiscoverService::depth).thenComparingInt(String::length))
            .toList();

        Map<String, Object> homepage = new LinkedHashMap<>();
        homepage.put("status", home.status());
        homepage.put("ms", home.ms());
        homepage.put("https", "https".equals(homeUri.getScheme()));
        homepage.put("finalUrl", home.url());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("site", site);
        out.put("origin", origin);
        out.put("homepage", homepage);
        out.put("robots", Map.of("found", robotsFound, "bots", bots));
        out.put("llmsTxt", isPlainText(llmsFuture.join()));
        out.put("sitemap", Map.of(
            "found", !sitemaps.isEmpty(),
            "total", sorted.size(),
            "urls", sorted.stream().limit(MAX_URLS).toList()));
        return out;
    }

    private SafeFetcher.Result tryFetch(String url, int seconds) {
        try {
            return fetcher.fetch(url, Duration.ofSeconds(seconds));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private CompletableFuture<SafeFetcher.Result> async(String url) {
        return CompletableFuture.supplyAsync(() -> tryFetch(url, 5), pool);
    }

    private List<SafeFetcher.Result> fetchAll(List<String> urls) {
        List<CompletableFuture<SafeFetcher.Result>> futures = urls.stream().map(this::async).toList();
        List<SafeFetcher.Result> results = new ArrayList<>();
        for (CompletableFuture<SafeFetcher.Result> f : futures) {
            results.add(f.join());
        }
        return results;
    }

    /** A missing robots.txt or llms.txt often comes back as a 200 HTML page, which doesn't count. */
    private static boolean isPlainText(SafeFetcher.Result r) {
        return r != null && r.status() == 200 && !r.text().isBlank() && !r.text().stripLeading().startsWith("<");
    }

    private static Robots parseRobots(String text) {
        List<Group> groups = new ArrayList<>();
        List<String> sitemaps = new ArrayList<>();
        Group current = null;
        boolean lastWasAgent = false;
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.replaceFirst("#.*$", "").trim();
            int colon = line.indexOf(':');
            if (colon < 0) {
                continue;
            }
            String key = line.substring(0, colon).trim().toLowerCase(Locale.ROOT);
            String value = line.substring(colon + 1).trim();
            if (key.equals("user-agent")) {
                if (!lastWasAgent) {
                    current = new Group(new ArrayList<>(), new ArrayList<>());
                    groups.add(current);
                }
                current.agents().add(value.toLowerCase(Locale.ROOT));
                lastWasAgent = true;
                continue;
            }
            lastWasAgent = false;
            if (key.equals("sitemap")) {
                sitemaps.add(value);
            } else if ((key.equals("allow") || key.equals("disallow")) && current != null) {
                current.rules().add(new Rule(key.equals("allow"), value));
            }
        }
        return new Robots(groups, sitemaps);
    }

    /** Returns "allowed", "partial" or "blocked" for one crawler, falling back to the wildcard group. */
    private static String access(Robots robots, String bot) {
        String name = bot.toLowerCase(Locale.ROOT);
        List<Group> matched = robots.groups().stream().filter(g -> g.agents().contains(name)).toList();
        if (matched.isEmpty()) {
            matched = robots.groups().stream().filter(g -> g.agents().contains("*")).toList();
        }
        List<Rule> rules = matched.stream().flatMap(g -> g.rules().stream()).toList();
        if (rules.stream().noneMatch(r -> !r.allow() && !r.path().isEmpty())) {
            return "allowed";
        }
        boolean rootBlocked = rules.stream().anyMatch(r -> !r.allow() && isRoot(r.path()));
        boolean rootAllowed = rules.stream().anyMatch(r -> r.allow() && isRoot(r.path()));
        return rootBlocked && !rootAllowed ? "blocked" : "partial";
    }

    private static boolean isRoot(String path) {
        return path.equals("/") || path.equals("/*");
    }

    private static List<String> locs(String xml) {
        List<String> out = new ArrayList<>();
        Matcher m = LOC.matcher(xml);
        while (m.find()) {
            out.add(m.group(1).replace("&amp;", "&"));
        }
        return out;
    }

    private static int depth(String url) {
        String path = URI.create(url).getPath();
        return path == null ? 0 : (int) List.of(path.split("/")).stream().filter(s -> !s.isEmpty()).count();
    }
}
