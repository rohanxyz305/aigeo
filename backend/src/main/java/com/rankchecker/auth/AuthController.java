package com.rankchecker.auth;

import com.rankchecker.user.User;
import com.rankchecker.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class AuthController {

    private static final Duration TOKEN_LIFETIME = Duration.ofDays(7);

    public record SignupRequest(
        @NotBlank(message = "Enter your name") @Size(max = 100, message = "Name is too long") String name,
        @NotBlank(message = "Enter your email") @Email(message = "Enter a valid email address") String email,
        @NotBlank(message = "Choose a password")
        @Size(min = 8, max = 72, message = "Password must be 8 to 72 characters") String password) {
    }

    public record LoginRequest(
        @NotBlank(message = "Enter your email") String email,
        @NotBlank(message = "Enter your password") String password) {
    }

    public record AuthResponse(String token, String name, String email) {
    }

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> signup(@Valid @RequestBody SignupRequest req) {
        String email = normalize(req.email());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        try {
            users.save(new User(req.name().trim(), email, passwordEncoder.encode(req.password())));
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
        return Map.of("email", email);
    }

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmail(normalize(req.email()))
            .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .subject(user.getEmail())
            .claim("name", user.getName())
            .issuedAt(now)
            .expiresAt(now.plus(TOKEN_LIFETIME))
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AuthResponse(token, user.getName(), user.getEmail());
    }

    @GetMapping("/auth/me")
    public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("email", jwt.getSubject(), "name", jwt.getClaimAsString("name"));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ResponseStatusException emailTaken() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
    }
}
