package backend;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class Server {
    private static final int PORT = 8080;
    private static final String FILE_PATH = "scores.json";
    private static final Object fileLock = new Object();

    private static final String DEFAULT_SCORES = "[]";

    public static void main(String[] args) throws IOException {
        // Initialize scores file if it doesn't exist
        initScoresFile();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/scores", new ScoresHandler());
        server.setExecutor(Executors.newCachedThreadPool());
        System.out.println("Java Ranking Server started on port " + PORT + "...");
        server.start();
    }

    private static void initScoresFile() {
        synchronized (fileLock) {
            File file = new File(FILE_PATH);
            if (!file.exists()) {
                try {
                    Files.write(Paths.get(FILE_PATH), DEFAULT_SCORES.getBytes(StandardCharsets.UTF_8));
                    System.out.println("Created initial scores.json");
                } catch (IOException e) {
                    System.err.println("Failed to create scores.json: " + e.getMessage());
                }
            }
        }
    }

    static class Score {
        String name;
        int score;
        String character;

        Score(String name, int score, String character) {
            this.name = name;
            this.score = score;
            this.character = character;
        }

        String toJson() {
            return String.format("{\"name\":\"%s\",\"score\":%d,\"character\":\"%s\"}", 
                escapeJson(name), score, escapeJson(character));
        }

        private String escapeJson(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\").replace("\"", "\\\"");
        }
    }

    static class ScoresHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Add CORS Headers
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

            String method = exchange.getRequestMethod();

            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(200, -1); // Respond to preflight
                return;
            }

            if ("GET".equalsIgnoreCase(method)) {
                handleGet(exchange);
            } else if ("POST".equalsIgnoreCase(method)) {
                handlePost(exchange);
            } else {
                sendResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
            }
        }

        private void handleGet(HttpExchange exchange) throws IOException {
            String scoresJson = readScoresFile();
            sendResponse(exchange, 200, scoresJson);
        }

        private void handlePost(HttpExchange exchange) throws IOException {
            InputStream is = exchange.getRequestBody();
            byte[] bodyBytes = is.readAllBytes();
            String body = new String(bodyBytes, StandardCharsets.UTF_8);

            String name = extractField(body, "name");
            String scoreStr = extractField(body, "score");
            String character = extractField(body, "character");

            if (name == null || scoreStr == null) {
                sendResponse(exchange, 400, "{\"error\":\"Bad Request: Missing 'name' or 'score'\"}");
                return;
            }

            int score;
            try {
                score = Integer.parseInt(scoreStr.trim());
            } catch (NumberFormatException e) {
                sendResponse(exchange, 400, "{\"error\":\"Bad Request: 'score' must be an integer\"}");
                return;
            }

            if (character == null) {
                character = "Minji";
            }

            // Capitalize name to keep leaderboard looking uniform
            name = name.trim().toUpperCase();
            if (name.length() > 10) {
                name = name.substring(0, 10);
            }
            if (name.isEmpty()) {
                name = "ANON";
            }

            String updatedJson = addNewScore(new Score(name, score, character));
            sendResponse(exchange, 200, updatedJson);
        }

        private String readScoresFile() {
            synchronized (fileLock) {
                try {
                    byte[] bytes = Files.readAllBytes(Paths.get(FILE_PATH));
                    return new String(bytes, StandardCharsets.UTF_8);
                } catch (IOException e) {
                    System.err.println("Error reading scores.json, returning default: " + e.getMessage());
                    return DEFAULT_SCORES;
                }
            }
        }

        private String addNewScore(Score newScore) {
            synchronized (fileLock) {
                String currentJson = readScoresFile();
                List<Score> list = parseScores(currentJson);
                list.add(newScore);

                // Sort scores descending
                Collections.sort(list, new Comparator<Score>() {
                    @Override
                    public int compare(Score s1, Score s2) {
                        return Integer.compare(s2.score, s1.score);
                    }
                });

                // Keep top 10
                if (list.size() > 10) {
                    list = list.subList(0, 10);
                }

                // Convert list back to JSON array
                StringBuilder sb = new StringBuilder();
                sb.append("[");
                for (int i = 0; i < list.size(); i++) {
                    sb.append(list.get(i).toJson());
                    if (i < list.size() - 1) {
                        sb.append(",");
                    }
                }
                sb.append("]");
                String updatedJson = sb.toString();

                try {
                    Files.write(Paths.get(FILE_PATH), updatedJson.getBytes(StandardCharsets.UTF_8));
                } catch (IOException e) {
                    System.err.println("Failed to write updated scores to scores.json: " + e.getMessage());
                }

                return updatedJson;
            }
        }

        private List<Score> parseScores(String json) {
            List<Score> list = new ArrayList<>();
            Pattern objectPattern = Pattern.compile("\\{[^}]+\\}");
            Matcher m = objectPattern.matcher(json);
            while (m.find()) {
                String obj = m.group();
                String name = extractField(obj, "name");
                String scoreStr = extractField(obj, "score");
                String character = extractField(obj, "character");
                if (name != null && scoreStr != null) {
                    try {
                        int score = Integer.parseInt(scoreStr.trim());
                        list.add(new Score(name, score, character != null ? character : "Minji"));
                    } catch (NumberFormatException e) {
                        // Skip malformed
                    }
                }
            }
            return list;
        }

        private String extractField(String json, String field) {
            Pattern pStr = Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]*)\"");
            Matcher mStr = pStr.matcher(json);
            if (mStr.find()) {
                return mStr.group(1);
            }
            Pattern pNum = Pattern.compile("\"" + field + "\"\\s*:\\s*(-?\\d+)");
            Matcher mNum = pNum.matcher(json);
            if (mNum.find()) {
                return mNum.group(1);
            }
            return null;
        }

        private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(statusCode, responseBytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(responseBytes);
            os.close();
        }
    }
}
