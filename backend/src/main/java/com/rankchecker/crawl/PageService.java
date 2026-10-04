package com.rankchecker.crawl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpHeaders;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

/** Fetches one page and extracts the on-page signals the reports are based on. */
@Service
public class PageService {

    private static final Pattern SKIP_EXT = Pattern.compile(
        "\\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|mp4|mp3|css|js|xml|json|woff2?)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUESTION = Pattern.compile(
        "(\\?$|^(what|how|why|when|where|which|who|can|does|do|is|are|should)\\b)", Pattern.CASE_INSENSITIVE);
    private static final int MAX_LINKS = 150;

    private final SafeFetcher fetcher;
    private final ObjectMapper mapper;

    public PageService(SafeFetcher fetcher, ObjectMapper mapper) {
        this.fetcher = fetcher;
        this.mapper = mapper;
    }

    public Map<String, Object> inspect(String site, String url) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("url", url);
        try {
            SafeFetcher.Result res = fetcher.fetch(url, Duration.ofSeconds(10));
            out.put("finalUrl", res.url());
            out.put("status", res.status());
            out.put("ms", res.ms());
            out.put("bytes", res.bytes());
            String type = res.headers().firstValue("content-type").orElse("");
            if (!type.toLowerCase().contains("html")) {
                out.put("notHtml", true);
            } else if (!SiteUtil.sameSite(URI.create(res.url()).getHost(), site)) {
                out.put("offSite", true);
            } else {
                analyze(out, res.text(), res.url(), site, res.headers());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            out.put("error", "Interrupted");
        } catch (HttpTimeoutException e) {
            out.put("error", "Timed out");
        } catch (Exception e) {
            out.put("error", e.getMessage() == null ? "Could not fetch the page" : e.getMessage());
        }
        return out;
    }

    private void analyze(Map<String, Object> out, String html, String finalUrl, String site, HttpHeaders headers) {
        Document doc = Jsoup.parse(html, finalUrl);

        String description = meta(doc, "name", "description");
        if (description.isEmpty()) {
            description = meta(doc, "property", "og:description");
        }
        Element canonicalTag = doc.selectFirst("link[rel~=(?i)canonical][href]");
        String canonical = canonicalTag == null ? null : canonicalTag.absUrl("href");
        String robots = meta(doc, "name", "robots") + " " + meta(doc, "name", "googlebot") + " "
            + headers.firstValue("x-robots-tag").orElse("");

        Set<String> schemaTypes = new LinkedHashSet<>();
        boolean[] schemaFlags = new boolean[2]; // [author, date]
        for (Element script : doc.select("script[type=application/ld+json]")) {
            try {
                walkSchema(mapper.readTree(script.data()), schemaTypes, schemaFlags);
            } catch (Exception ignored) {
                // Malformed JSON-LD is treated as absent.
            }
        }

        int scripts = doc.select("script").size();
        List<Element> images = doc.select("img");
        long missingAlt = images.stream().filter(img -> img.attr("alt").isBlank()).count();
        boolean appShell = doc.selectFirst("#root, #app, #__next, #__nuxt") != null;

        Element body = doc.body();
        body.select("script, style, noscript, svg, template").remove();

        Set<String> links = new LinkedHashSet<>();
        int external = 0;
        for (Element a : body.select("a[href]")) {
            String href = a.absUrl("href");
            try {
                URI uri = URI.create(href);
                if (uri.getHost() == null) {
                    continue;
                }
                if (!SiteUtil.sameSite(uri.getHost(), site)) {
                    external++;
                } else if (!SKIP_EXT.matcher(uri.getPath() == null ? "" : uri.getPath()).find()) {
                    links.add(href.replaceFirst("#.*$", ""));
                }
            } catch (IllegalArgumentException ignored) {
                // Skip links that aren't valid URLs.
            }
        }

        List<String> h1 = texts(body, "h1");
        List<String> h2 = texts(body, "h2");
        List<String> subheadings = new ArrayList<>(h2);
        subheadings.addAll(texts(body, "h3"));

        body.select("nav, footer").remove();
        String text = body.text();
        int words = text.isBlank() ? 0 : text.trim().split("\\s+").length;

        out.put("title", doc.title());
        out.put("description", description);
        out.put("canonical", canonical);
        out.put("canonicalElsewhere", canonical != null && !canonical.isEmpty() && !trim(canonical).equals(trim(finalUrl)));
        out.put("noindex", robots.toLowerCase().contains("noindex"));
        out.put("lang", doc.select("html").attr("lang"));
        out.put("viewport", !meta(doc, "name", "viewport").isEmpty());
        out.put("openGraph", !meta(doc, "property", "og:title").isEmpty());
        out.put("h1", h1.stream().limit(3).toList());
        out.put("h1Count", h1.size());
        out.put("h2", h2.stream().limit(10).toList());
        out.put("questionHeadings", subheadings.stream().filter(h -> QUESTION.matcher(h).find()).count());
        out.put("words", words);
        out.put("schemaTypes", schemaTypes);
        out.put("hasAuthor", schemaFlags[0] || !meta(doc, "name", "author").isEmpty());
        out.put("hasDate", schemaFlags[1]
            || !meta(doc, "property", "article:published_time").isEmpty()
            || !meta(doc, "property", "article:modified_time").isEmpty());
        out.put("imgs", images.size());
        out.put("imgsMissingAlt", missingAlt);
        out.put("internalLinks", links.size());
        out.put("externalLinks", external);
        out.put("links", links.stream().limit(MAX_LINKS).toList());
        out.put("scripts", scripts);
        // AI crawlers generally don't run JavaScript, so text must be in the raw HTML.
        out.put("jsRendered", words < 120 && (scripts >= 3 || appShell));
        out.put("sample", text.length() > 500 ? text.substring(0, 500) : text);
    }

    private static String meta(Document doc, String attribute, String value) {
        Element tag = doc.selectFirst("meta[" + attribute + "=" + value + "]");
        return tag == null ? "" : tag.attr("content").trim();
    }

    private static List<String> texts(Element root, String tag) {
        return root.select(tag).stream().map(Element::text).filter(t -> !t.isBlank()).toList();
    }

    private static String trim(String url) {
        return url.replaceFirst("#.*$", "").replaceFirst("/$", "");
    }

    /** Walks parsed JSON-LD collecting schema types and whether author/date fields exist. */
    private static void walkSchema(JsonNode node, Set<String> types, boolean[] flags) {
        if (node.isArray()) {
            node.forEach(child -> walkSchema(child, types, flags));
            return;
        }
        if (!node.isObject()) {
            return;
        }
        JsonNode type = node.get("@type");
        if (type != null) {
            if (type.isArray()) {
                type.forEach(t -> types.add(t.asText()));
            } else {
                types.add(type.asText());
            }
        }
        flags[0] |= node.has("author");
        flags[1] |= node.has("datePublished") || node.has("dateModified");
        node.forEach(child -> walkSchema(child, types, flags));
    }
}
