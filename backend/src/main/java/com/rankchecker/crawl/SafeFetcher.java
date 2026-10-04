package com.rankchecker.crawl;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Fetches public URLs only: private addresses are refused on every redirect hop, and time and size are capped. */
@Component
public class SafeFetcher {

    public record Result(int status, String url, HttpHeaders headers, String text, long ms, int bytes) {
    }

    private static final String USER_AGENT = "Mozilla/5.0 (compatible; AIRankChecker/1.0; site audit)";
    private static final int MAX_BYTES = 1_500_000;
    private static final int MAX_REDIRECTS = 5;
    private static final Pattern CHARSET = Pattern.compile("charset=\"?([\\w-]+)", Pattern.CASE_INSENSITIVE);

    private final HttpClient client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    public Result fetch(String startUrl, Duration timeout) throws IOException, InterruptedException {
        long started = System.nanoTime();
        URI uri = parse(startUrl);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            assertPublic(uri);
            Duration left = timeout.minusNanos(System.nanoTime() - started);
            if (left.isNegative() || left.isZero()) {
                throw new HttpTimeoutException("Timed out");
            }
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(left)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .GET()
                .build();
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

            Optional<String> location = response.headers().firstValue("location");
            if (response.statusCode() >= 300 && response.statusCode() < 400 && location.isPresent()) {
                response.body().close();
                try {
                    uri = uri.resolve(location.get().trim());
                } catch (IllegalArgumentException e) {
                    throw new IOException("Invalid redirect");
                }
                continue;
            }

            byte[] body;
            try (InputStream in = response.body()) {
                body = in.readNBytes(MAX_BYTES);
            }
            long ms = (System.nanoTime() - started) / 1_000_000;
            return new Result(response.statusCode(), uri.toString(), response.headers(),
                new String(body, charsetOf(response.headers())), ms, body.length);
        }
        throw new IOException("Too many redirects");
    }

    private static URI parse(String url) throws IOException {
        try {
            return URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IOException("Invalid URL");
        }
    }

    private static Charset charsetOf(HttpHeaders headers) {
        Matcher m = CHARSET.matcher(headers.firstValue("content-type").orElse(""));
        if (m.find()) {
            try {
                return Charset.forName(m.group(1));
            } catch (RuntimeException ignored) {
                // Unknown charset label: fall through to UTF-8.
            }
        }
        return StandardCharsets.UTF_8;
    }

    private static void assertPublic(URI uri) throws IOException {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new IOException("Unsupported protocol");
        }
        if (uri.getHost() == null) {
            throw new IOException("Invalid URL");
        }
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            if (isPrivate(address)) {
                throw new IOException("Host is not publicly reachable");
            }
        }
    }

    private static boolean isPrivate(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
            || a.isSiteLocalAddress() || a.isMulticastAddress()) {
            return true;
        }
        byte[] b = a.getAddress();
        if (a instanceof Inet4Address) {
            int first = b[0] & 0xff;
            int second = b[1] & 0xff;
            return first == 0 || (first == 100 && second >= 64 && second <= 127);
        }
        return (b[0] & 0xfe) == 0xfc; // IPv6 unique local fc00::/7
    }
}
