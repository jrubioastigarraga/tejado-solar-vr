package eus.usurbil.tejadosolar;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Pantalla de lanzamiento.
 *
 * La escena es WebXR y el WebView de Android no soporta sesiones inmersivas,
 * asi que se sirve en local y se abre en el navegador del Pico 4, que si las
 * soporta (6DoF + mandos).
 */
public class MainActivity extends Activity {

    private static boolean autoOpened = false;

    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        status = findViewById(R.id.status);

        startServerService();

        findViewById(R.id.btnVr).setOnClickListener(v -> openInBrowser("/", false));
        findViewById(R.id.btnChooser).setOnClickListener(v -> openInBrowser("/", true));
        findViewById(R.id.btn2d).setOnClickListener(v -> {
            Intent i = new Intent(this, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_URL, LocalServer.BASE_URL + "/");
            startActivity(i);
        });

        boolean ok = LocalServer.get(this).start();
        status.setText(ok
                ? getString(R.string.status_ok, LocalServer.BASE_URL)
                : getString(R.string.status_error));
        status.setTextColor(ok ? Color.parseColor("#46d99b") : Color.parseColor("#ff6b5e"));

        if (!autoOpened) {
            autoOpened = true;
            new Handler(Looper.getMainLooper()).postDelayed(
                    () -> openInBrowser("/", false), 900);
        }
    }

    private void startServerService() {
        Intent svc = new Intent(this, ServerService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc);
            else startService(svc);
        } catch (Exception e) {
            LocalServer.get(this).start();
        }
    }

    private void openInBrowser(String path, boolean choose) {
        String url = LocalServer.BASE_URL + path;
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            if (choose) {
                startActivity(Intent.createChooser(view, getString(R.string.choose_browser)));
            } else {
                startActivity(view);
            }
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_LONG).show();
            Intent i = new Intent(this, WebViewActivity.class);
            i.putExtra(WebViewActivity.EXTRA_URL, url);
            startActivity(i);
        }
    }
}
