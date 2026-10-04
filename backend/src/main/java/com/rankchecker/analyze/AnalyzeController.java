package com.rankchecker.analyze;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** Sends the crawl to DeepSeek with one platform's brief and streams the report back as plain text. */
@RestController
@RequestMapping("/api")
public class AnalyzeController {

    public record AnalyzeRequest(String platform, JsonNode data) {
    }

    private static final URI DEEPSEEK = URI.create("https://api.deepseek.com/chat/completions");
    private static final int MAX_CRAWL_CHARS = 150_000;

    private final ObjectMapper mapper;
    private final String apiKey;
    private final String model;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public AnalyzeController(ObjectMapper mapper,
                             @Value("${app.deepseek.api-key}") String apiKey,
                             @Value("${app.deepseek.model}") String model) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.model = model;
    }

    @PostMapping("/analyze")
    public ResponseEntity<StreamingResponseBody> analyze(@RequestBody AnalyzeRequest req)
        throws IOException, InterruptedException {
        String brief = req.platform() == null ? null : Prompts.BRIEFS.get(req.platform());
        if (brief == null || req.data() == null || !req.data().isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "platform and data are required");
        }
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "DEEPSEEK_API_KEY is not set on the server");
        }
        String crawl = mapper.writeValueAsString(req.data());
        if (crawl.length() > MAX_CRAWL_CHARS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Crawl data too large; analyse fewer pages");
        }

        ObjectNode payload = mapper.createObjectNode();
        payload.put("model", model);
        payload.put("stream", true);
        payload.put("temperature", 0.3);
        payload.put("max_tokens", 3000);
        payload.putArray("messages")
            .add(mapper.createObjectNode().put("role", "system").put("content", Prompts.SYSTEM + "\n" + brief))
            .add(mapper.createObjectNode().put("role", "user")
                .put("content", "Crawl data for " + req.data().path("site").asText() + ":\n" + crawl));

        HttpRequest request = HttpRequest.newBuilder(DEEPSEEK)
            .timeout(Duration.ofSeconds(60))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
            .build();
        HttpResponse<InputStream> upstream = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (upstream.statusCode() != 200) {
            String detail;
            try (InputStream in = upstream.body()) {
                detail = new String(in.readNBytes(300), StandardCharsets.UTF_8);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "DeepSeek returned " + upstream.statusCode() + ": " + detail);
        }

        StreamingResponseBody stream = out -> {
            try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(upstream.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String data = line.substring(5).trim();
                    if (data.equals("[DONE]")) {
                        break;
                    }
                    String piece = mapper.readTree(data).path("choices").path(0).path("delta").path("content").asText("");
                    if (!piece.isEmpty()) {
                        out.write(piece.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    }
                }
            }
        };
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "plain", StandardCharsets.UTF_8))
            .header("Cache-Control", "no-store")
            .header("X-Accel-Buffering", "no")
            .body(stream);
    }
}
