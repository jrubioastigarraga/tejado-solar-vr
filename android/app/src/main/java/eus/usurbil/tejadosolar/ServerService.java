package eus.usurbil.tejadosolar;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/**
 * Mantiene vivo el proceso (y el servidor local) mientras el usuario juega
 * en el navegador del visor.
 */
public class ServerService extends Service {

    public static final String CHANNEL_ID = "tejadosolar_server";
    private static final int NOTIFICATION_ID = 4712;

    @Override
    public void onCreate() {
        super.onCreate();
        LocalServer.get(this).start();
        createChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        LocalServer.get(this).start();
        return START_STICKY;
    }

    private void createChannel() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW);
        ch.setDescription(getString(R.string.channel_desc));
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, flags);

        Notification.Builder b = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(getString(R.string.notif_text))
                .setSmallIcon(R.drawable.ic_stat_solar)
                .setContentIntent(pi)
                .setOngoing(true);
        return b.build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
