package eus.usurbil.tejadosolar;

import android.content.Context;
import android.content.res.AssetManager;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor HTTP local (solo lectura) que publica los assets "site/" en
 * http://127.0.0.1:8741.
 *
 * WebXR exige un contexto seguro: file:// no lo es, pero http://127.0.0.1 si.
 * Asi el navegador del visor puede abrir la escena sin Internet.
 */
public final class LocalServer {

    public static final int PORT = 8741;
    public static final String BASE_URL = "http://127.0.0.1:" + PORT;

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("htm", "text/html; charset=utf-8");
        MIME.put("js", "text/javascript; charset=utf-8");
        MIME.put("mjs", "text/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("wasm", "application/wasm");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("mp4", "video/mp4");
        MIME.put("txt", "text/plain; charset=utf-8");
        MIME.put("md", "text/plain; charset=utf-8");
    }

    private static LocalServer instance;

    private final AssetManager assets;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private ServerSocket socket;
    private volatile boolean running;

    private LocalServer(Context ctx) {
        this.assets = ctx.getApplicationContext().getAssets();
    }

    public static synchronized LocalServer get(Context ctx) {
        if (instance == null) instance = new LocalServer(ctx);
        return instance;
    }

    public synchronized boolean isRunning() {
        return running;
    }

    /** Arranca (idempotente). Devuelve true si el servidor queda escuchando. */
    public synchronized boolean start() {
        if (running) return true;
        try {
            ServerSocket s = new ServerSocket(PORT, 64, InetAddress.getByName("127.0.0.1"));
            s.setReuseAddress(true);
            socket = s;
            running = true;
            Thread t = new Thread(this::acceptLoop, "tejado-http");
            t.setDaemon(true);
            t.start();
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    public synchronized void stop() {
        running = false;
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket client = socket.accept();
                client.setSoTimeout(15000);
                pool.execute(() -> handle(client));
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    private void handle(Socket client) {
        try (Socket c = client) {
            InputStream in = c.getInputStream();
            StringBuilder head = new StringBuilder();
            int b;
            while ((b = in.read()) != -1) {
                head.append((char) b);
                int n = head.length();
                if (n >= 4 && head.charAt(n - 1) == '\n' && head.charAt(n - 2) == '\r'
                        && head.charAt(n - 3) == '\n' && head.charAt(n - 4) == '\r') {
                    break;
                }
                if (n > 16384) break;
            }
            String requestLine = head.toString().split("\r\n", 2)[0];
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0].toUpperCase(Locale.ROOT);
            String target = parts[1];
            if (!method.equals("GET") && !method.equals("HEAD")) {
                write(c.getOutputStream(), 405, "text/plain; charset=utf-8",
                        "Method Not Allowed".getBytes("UTF-8"), false);
                return;
            }

            String path = target;
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            int h = path.indexOf('#');
            if (h >= 0) path = path.substring(0, h);
            path = URLDecoder.decode(path, "UTF-8");
            path = normalize(path);

            Asset asset = readAsset(path);
            OutputStream out = new BufferedOutputStream(c.getOutputStream());
            if (asset == null) {
                byte[] msg = ("404 - No encontrado: " + path).getBytes("UTF-8");
                write(out, 404, "text/plain; charset=utf-8", msg, method.equals("HEAD"));
            } else {
                // El MIME se decide por el fichero servido, no por la URL.
                write(out, 200, mimeOf(asset.path), asset.data, method.equals("HEAD"));
            }
            out.flush();
        } catch (Exception ignored) {
        }
    }

    private static String normalize(String path) {
        if (path == null || path.isEmpty() || path.equals("/")) return "/index.html";
        if (path.contains("..")) return "/__forbidden__";
        if (!path.startsWith("/")) path = "/" + path;
        return path;
    }

    /** Fichero resuelto: datos + ruta real del asset (para deducir el MIME). */
    private static final class Asset {
        final byte[] data;
        final String path;

        Asset(byte[] data, String path) {
            this.data = data;
            this.path = path;
        }
    }

    private Asset readAsset(String path) {
        String rel = path.substring(1);
        String[] candidates;
        if (rel.isEmpty()) {
            candidates = new String[]{"index.html"};
        } else if (rel.endsWith("/")) {
            candidates = new String[]{rel + "index.html"};
        } else {
            candidates = new String[]{rel, rel + "/index.html", rel + ".html"};
        }
        for (String c : candidates) {
            try (InputStream is = assets.open("site/" + c)) {
                return new Asset(readAll(is), c);
            } catch (FileNotFoundException ignored) {
            } catch (IOException ignored) {
            }
        }
        return null;
    }

    private static byte[] readAll(InputStream is) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
        byte[] buf = new byte[32 * 1024];
        int n;
        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    private static String mimeOf(String path) {
        int dot = path.lastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        String ext = path.substring(dot + 1).toLowerCase(Locale.ROOT);
        String m = MIME.get(ext);
        return m != null ? m : "application/octet-stream";
    }

    private static void write(OutputStream out, int code, String type, byte[] body, boolean headOnly)
            throws IOException {
        String reason = code == 200 ? "OK" : code == 404 ? "Not Found" : "Error";
        String headers = "HTTP/1.1 " + code + " " + reason + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Connection: close\r\n\r\n";
        out.write(headers.getBytes("UTF-8"));
        if (!headOnly) out.write(body);
    }
}
