import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

// java.base only. Production entrypoint accepts an operation, never a target URL.
public final class LocalReadProbe {
  private static final AtomicBoolean failureReported = new AtomicBoolean();
  static void reportFailure() {
    if (failureReported.compareAndSet(false, true)) System.err.println("LOCAL_READ_FAILED");
  }
  static String read(URL url, String method, String body) throws Exception {
    // This class runs only in a dedicated probe JVM. A process deadline also bounds
    // header parsing/connect/write paths where per-read socket timeouts can be reset.
    Thread watchdog = new Thread(() -> {
      try { Thread.sleep(5000); }
      catch (InterruptedException done) { return; }
      reportFailure(); Runtime.getRuntime().halt(1);
    }, "local-probe-deadline");
    watchdog.setDaemon(true); watchdog.start();
    long deadline = System.nanoTime() + 5_000_000_000L;
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(1500);
    connection.setReadTimeout(1500);
    connection.setRequestMethod(method);
    connection.setRequestProperty("Accept", "application/json");
    try {
      if (body != null) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setFixedLengthStreamingMode(bytes.length);
        try (var output = connection.getOutputStream()) { output.write(bytes); }
      }
      int status = connection.getResponseCode();
      if (status < 200 || status >= 300) throw new Exception("HTTP_STATUS");
      long declared = connection.getContentLengthLong();
      if (declared > 1_048_576) throw new Exception("SIZE_LIMIT");
      try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
        byte[] buffer = new byte[8192];
        for (;;) {
          long remaining = (deadline - System.nanoTime()) / 1_000_000;
          if (remaining <= 0) throw new Exception("DEADLINE");
          connection.setReadTimeout((int) Math.min(1500L, remaining));
          int n = input.read(buffer);
          if (n < 0) break;
          if (output.size() + n > 1_048_576) throw new Exception("SIZE_LIMIT");
          output.write(buffer, 0, n);
        }
        if (declared >= 0 && output.size() != declared) throw new Exception("TRUNCATED");
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(output.toByteArray())).toString();
      }
    } finally { watchdog.interrupt(); connection.disconnect(); }
  }
  public static void main(String[] args) {
    Thread processDeadline = new Thread(() -> {
      try { Thread.sleep(6000); } catch (InterruptedException done) { return; }
      reportFailure(); Runtime.getRuntime().halt(1);
    }, "local-probe-process-deadline");
    processDeadline.setDaemon(true); processDeadline.start();
    try {
      if (args.length != 1) throw new Exception("OPERATION");
      String path, method = "POST", body = "{}";
      boolean stdin = false;
      switch (args[0]) {
        case "health": path = "/healthcheck"; method = "GET"; body = null; break;
        case "node": path = "/wallet/getnodeinfo"; break;
        case "genesis": path = "/wallet/getblockbynum"; body = "{\"num\":0}"; break;
        case "head": path = "/wallet/getnowblock"; break;
        case "deploy": path = "/wallet/deploycontract"; stdin = true; break;
        case "trigger": path = "/wallet/triggersmartcontract"; stdin = true; break;
        case "broadcast": path = "/wallet/broadcasthex"; stdin = true; break;
        case "receipt": path = "/wallet/gettransactioninfobyid"; stdin = true; break;
        case "contract": path = "/wallet/getcontractinfo"; stdin = true; break;
        case "constant": path = "/wallet/triggerconstantcontract"; stdin = true; break;
        case "account": path = "/wallet/getaccount"; stdin = true; break;
        case "block": path = "/wallet/getblockbynum"; stdin = true; break;
        default: throw new Exception("OPERATION");
      }
      if (stdin) {
        byte[] input = System.in.readNBytes(1_048_577);
        if (input.length == 0 || input.length > 1_048_576) throw new Exception("INPUT_SIZE");
        body = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(input)).toString();
      }
      System.out.print(read(new URL("http://127.0.0.1:9090" + path), method, body));
    } catch (Exception ignored) {
      reportFailure(); System.exit(1);
    } finally { processDeadline.interrupt(); }
  }
}
