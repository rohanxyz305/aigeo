package com.rankchecker.crawl;

import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CrawlController {

    private final DiscoverService discoverService;
    private final PageService pageService;

    public CrawlController(DiscoverService discoverService, PageService pageService) {
        this.discoverService = discoverService;
        this.pageService = pageService;
    }

    @GetMapping("/discover")
    public Map<String, Object> discover(@RequestParam String site) {
        return discoverService.discover(requireSite(site));
    }

    @GetMapping("/page")
    public Map<String, Object> page(@RequestParam String site, @RequestParam String url) {
        String domain = requireSite(site);
        String host;
        try {
            host = URI.create(url).getHost();
        } catch (IllegalArgumentException e) {
            host = null;
        }
        if (!SiteUtil.sameSite(host, domain)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "url must be a page on the given site");
        }
        return pageService.inspect(domain, url);
    }

    private static String requireSite(String input) {
        String site = SiteUtil.normalizeSite(input);
        if (site == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid domain, for example example.com");
        }
        return site;
    }
}
