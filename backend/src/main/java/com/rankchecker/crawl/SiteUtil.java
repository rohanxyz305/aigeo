package com.rankchecker.crawl;

import java.util.Locale;
import java.util.regex.Pattern;

final class SiteUtil {

    private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z][a-z0-9-]+$");

    private SiteUtil() {
    }

    /** Turns user input like "https://www.Example.com/page" into "www.example.com"; null when it isn't a domain. */
    static String normalizeSite(String input) {
        if (input == null) {
            return null;
        }
        String s = input.trim().toLowerCase(Locale.ROOT)
            .replaceFirst("^https?://", "")
            .replaceFirst("[/?#].*$", "")
            .replaceFirst(":\\d+$", "");
        return DOMAIN.matcher(s).matches() ? s : null;
    }

    static boolean sameSite(String hostname, String site) {
        if (hostname == null) {
            return false;
        }
        String host = hostname.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        String base = site.replaceFirst("^www\\.", "");
        return host.equals(base) || host.endsWith("." + base);
    }
}
