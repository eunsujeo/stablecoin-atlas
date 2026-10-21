import java.net.URL;
public final class LocalReadProbeDriver {
  public static void main(String[] args) {
    try {
      int port = Integer.parseInt(args[0]);
      if (port < 1 || port > 65535 || !args[1].matches("/[a-z-]+")) throw new Exception();
      System.out.print(LocalReadProbe.read(new URL("http://127.0.0.1:" + port + args[1]), "GET", null));
    } catch (Exception ignored) { LocalReadProbe.reportFailure(); System.exit(1); }
  }
}
