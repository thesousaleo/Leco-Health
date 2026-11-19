"""Recursos nativos do Leco Health no projeto Android gerado pelo Capacitor:
- LecoBridge: ponte JS → Android (contagem do descanso na tela de bloqueio e dados do widget)
- LecoWidget: widget da tela inicial (score do dia, treino, hábitos e água, com botão de + copo)
Uso: python3 android-res/native/make.py <applicationId> <pacote.da.MainActivity>"""
import os, sys

app_id, jpkg = sys.argv[1], sys.argv[2]
base = 'android/app/src/main'
res = f'{base}/res'
jdir = f'{base}/java/' + jpkg.replace('.', '/')
rimport = '' if app_id == jpkg else f'import {app_id}.R;\n'
for d in ('layout', 'xml', 'drawable', 'values', 'values-night'):
    os.makedirs(f'{res}/{d}', exist_ok=True)

# ── Java ─────────────────────────────────────────────────────────────
open(f'{jdir}/LecoBridge.java', 'w').write(f'''package {jpkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.util.Iterator;
{rimport}
/** Chamado pelo app (window.LecoNative). */
public class LecoBridge {{
    private final Context ctx;
    static final String CH = "leco_rest";
    static final int REST_ID = 4200;

    public LecoBridge(Context c) {{ ctx = c.getApplicationContext(); }}

    private NotificationManager nm() {{ return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE); }}

    private void channel() {{
        if (Build.VERSION.SDK_INT >= 26 && nm().getNotificationChannel(CH) == null) {{
            NotificationChannel c = new NotificationChannel(CH, "Descanso do treino", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Contagem do descanso entre as séries");
            c.setShowBadge(false);
            nm().createNotificationChannel(c);
        }}
    }}

    private PendingIntent openApp(int code) {{
        Intent open = new Intent(Intent.ACTION_MAIN);
        open.setClassName(ctx.getPackageName(), "{jpkg}.MainActivity");
        open.addCategory(Intent.CATEGORY_LAUNCHER);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }}

    /** Contagem regressiva do descanso na notificação (aparece na tela de bloqueio). */
    @JavascriptInterface
    public void restTimer(double endAt, String title, String text) {{
        try {{
            channel();
            long end = (long) endAt;
            long left = Math.max(1000L, end - System.currentTimeMillis());
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CH) : new Notification.Builder(ctx);
            b.setSmallIcon(R.drawable.ic_stat_leco)
             .setContentTitle(title)
             .setContentText(text)
             .setWhen(end)
             .setShowWhen(true)
             .setUsesChronometer(true)
             .setOngoing(true)
             .setOnlyAlertOnce(true)
             .setVisibility(Notification.VISIBILITY_PUBLIC)
             .setColor(0xFFF26B3A)
             .setContentIntent(openApp(REST_ID));
            if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
            if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(left + 1500L);
            nm().notify(REST_ID, b.build());
        }} catch (Throwable ignored) {{ }}
    }}

    @JavascriptInterface
    public void restTimerCancel() {{
        try {{ nm().cancel(REST_ID); }} catch (Throwable ignored) {{ }}
    }}

    // ── ícone alternativo (activity-alias no manifesto) ──
    static final String[] ICONS = {{ "laranja", "escuro", "claro", "mono" }};
    private ComponentName alias(String n) {{
        return new ComponentName(ctx.getPackageName(), "{jpkg}.Icon" + Character.toUpperCase(n.charAt(0)) + n.substring(1));
    }}

    /** Qual ícone está ativo ("" se o app não tem os ícones alternativos). */
    @JavascriptInterface
    public String getIcon() {{
        try {{
            PackageManager pm = ctx.getPackageManager();
            pm.getActivityInfo(alias("laranja"), PackageManager.GET_DISABLED_COMPONENTS);
            for (String n : ICONS) {{
                if (n.equals("laranja")) continue;
                if (pm.getComponentEnabledSetting(alias(n)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return n;
            }}
            return "laranja";
        }} catch (Throwable t) {{ return ""; }}
    }}

    /** Troca o ícone: liga o escolhido primeiro e só depois desliga os outros (nunca fica sem ícone). */
    @JavascriptInterface
    public boolean setIcon(String name) {{
        try {{
            boolean ok = false;
            for (String n : ICONS) if (n.equals(name)) ok = true;
            if (!ok) return false;
            PackageManager pm = ctx.getPackageManager();
            for (String n : ICONS) pm.getActivityInfo(alias(n), PackageManager.GET_DISABLED_COMPONENTS);
            boolean def = name.equals("laranja");
            pm.setComponentEnabledSetting(alias(name), def ? PackageManager.COMPONENT_ENABLED_STATE_DEFAULT : PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String n : ICONS) {{
                if (n.equals(name)) continue;
                int st = n.equals("laranja") ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED : PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;
                pm.setComponentEnabledSetting(alias(n), st, PackageManager.DONT_KILL_APP);
            }}
            return true;
        }} catch (Throwable t) {{ return false; }}
    }}

    /** Dados do widget (JSON com textos prontos) e redesenho. */
    @JavascriptInterface
    public void setWidget(String json) {{
        try {{
            JSONObject o = new JSONObject(json);
            SharedPreferences.Editor e = ctx.getSharedPreferences("leco_widget", Context.MODE_PRIVATE).edit();
            Iterator<String> it = o.keys();
            while (it.hasNext()) {{
                String k = it.next();
                Object v = o.get(k);
                if (v instanceof Integer) e.putInt(k, (Integer) v); else e.putString(k, String.valueOf(v));
            }}
            e.apply();
            LecoWidget.refresh(ctx);
        }} catch (Throwable ignored) {{ }}
    }}
}}
''')

open(f'{jdir}/LecoWidget.java', 'w').write(f'''package {jpkg};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
{rimport}
/** Widget da tela inicial: score do dia, treino, hábitos e água. */
public class LecoWidget extends AppWidgetProvider {{
    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {{
        for (int id : ids) m.updateAppWidget(id, views(ctx));
    }}

    static void refresh(Context ctx) {{
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, LecoWidget.class));
        for (int id : ids) m.updateAppWidget(id, views(ctx));
    }}

    private static PendingIntent link(Context ctx, String action, int code) {{
        Intent i = action == null ? new Intent(Intent.ACTION_MAIN) : new Intent(Intent.ACTION_VIEW, Uri.parse("lecohealth://atalho/" + action));
        i.setClassName(ctx.getPackageName(), "{jpkg}.MainActivity");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }}

    static RemoteViews views(Context ctx) {{
        SharedPreferences p = ctx.getSharedPreferences("leco_widget", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.leco_widget);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean fresh = today.equals(p.getString("day", ""));
        v.setTextViewText(R.id.lw_date, p.getString("dateLabel", ""));
        if (fresh) {{
            v.setTextViewText(R.id.lw_score, p.getString("score", "—"));
            v.setTextViewText(R.id.lw_workout, p.getString("workout", ""));
            v.setTextViewText(R.id.lw_habits, p.getString("habits", ""));
            v.setTextViewText(R.id.lw_water, p.getString("water", ""));
            v.setProgressBar(R.id.lw_water_bar, 100, p.getInt("waterPct", 0), false);
            v.setProgressBar(R.id.lw_score_bar, 100, p.getInt("scorePct", 0), false);
        }} else {{
            v.setTextViewText(R.id.lw_score, "—");
            v.setTextViewText(R.id.lw_workout, "Toque para abrir o app");
            v.setTextViewText(R.id.lw_habits, "e atualizar o dia");
            v.setTextViewText(R.id.lw_water, "");
            v.setProgressBar(R.id.lw_water_bar, 100, 0, false);
            v.setProgressBar(R.id.lw_score_bar, 100, 0, false);
        }}
        v.setViewVisibility(R.id.lw_habits, p.getString("habits", "").isEmpty() && fresh ? View.GONE : View.VISIBLE);
        v.setOnClickPendingIntent(R.id.lw_root, link(ctx, null, 7100));
        v.setOnClickPendingIntent(R.id.lw_add_water, link(ctx, "agua", 7101));
        v.setOnClickPendingIntent(R.id.lw_workout, link(ctx, "treino", 7102));
        return v;
    }}
}}
''')

# ── recursos ─────────────────────────────────────────────────────────
open(f'{res}/drawable/ic_stat_leco.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp"
    android:viewportWidth="60" android:viewportHeight="60">
    <group android:translateX="-24" android:translateY="-24">
        <path android:pathData="M39.27,35.25 L39.27,66.05 L48.64,66.05 L52.66,58.02 L58.02,72.75 L62.04,62.04 L68.73,62.04"
            android:strokeColor="#FFFFFFFF" android:strokeWidth="6.7" android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000"/>
    </group>
</vector>
''')
open(f'{res}/values/leco_widget_colors.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="lw_bg">#F5FFFFFF</color>
    <color name="lw_ink">#1C1B1A</color>
    <color name="lw_muted">#67625B</color>
    <color name="lw_track">#1F1C1B1A</color>
    <color name="lw_accent">#F26B3A</color>
    <color name="lw_water">#4A6A9B</color>
    <string name="lw_label">Leco Health</string>
    <string name="lw_desc">Score do dia, treino, hábitos e água</string>
</resources>
''')
open(f'{res}/values-night/leco_widget_colors.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="lw_bg">#F2201E1C</color>
    <color name="lw_ink">#F3F0EB</color>
    <color name="lw_muted">#A8A29A</color>
    <color name="lw_track">#26FFFFFF</color>
    <color name="lw_water">#8FA9D6</color>
</resources>
''')
open(f'{res}/drawable/leco_widget_bg.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/lw_bg"/>
    <corners android:radius="26dp"/>
</shape>
''')
open(f'{res}/drawable/leco_widget_btn.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/lw_accent"/>
    <corners android:radius="99dp"/>
</shape>
''')
def bar(color):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@android:id/background"><shape><corners android:radius="3dp"/><solid android:color="@color/lw_track"/></shape></item>
    <item android:id="@android:id/progress"><clip><shape><corners android:radius="3dp"/><solid android:color="@color/{color}"/></shape></clip></item>
</layer-list>
'''
open(f'{res}/drawable/leco_widget_bar.xml', 'w').write(bar('lw_accent'))
open(f'{res}/drawable/leco_widget_bar_water.xml', 'w').write(bar('lw_water'))

open(f'{res}/layout/leco_widget.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/lw_root" android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:padding="16dp" android:background="@drawable/leco_widget_bg">

    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical">
        <TextView android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content"
            android:text="Leco Health" android:textSize="12sp" android:textStyle="bold" android:textColor="@color/lw_accent"/>
        <TextView android:id="@+id/lw_date" android:layout_width="wrap_content" android:layout_height="wrap_content"
            android:textSize="12sp" android:textColor="@color/lw_muted"/>
    </LinearLayout>

    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="bottom" android:layout_marginTop="2dp">
        <TextView android:id="@+id/lw_score" android:layout_width="wrap_content" android:layout_height="wrap_content"
            android:text="—" android:textSize="34sp" android:textStyle="bold" android:textColor="@color/lw_ink" android:includeFontPadding="false"/>
        <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginStart="6dp" android:layout_marginBottom="4dp"
            android:text="seu dia" android:textSize="12sp" android:textColor="@color/lw_muted"/>
    </LinearLayout>
    <ProgressBar android:id="@+id/lw_score_bar" style="@android:style/Widget.ProgressBar.Horizontal"
        android:layout_width="match_parent" android:layout_height="5dp" android:layout_marginTop="6dp"
        android:max="100" android:progress="0" android:progressDrawable="@drawable/leco_widget_bar"/>

    <TextView android:id="@+id/lw_workout" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="10dp"
        android:textSize="13sp" android:textColor="@color/lw_ink" android:maxLines="1" android:ellipsize="end"/>
    <TextView android:id="@+id/lw_habits" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="2dp"
        android:textSize="13sp" android:textColor="@color/lw_muted" android:maxLines="1" android:ellipsize="end"/>

    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginTop="8dp">
        <LinearLayout android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content" android:orientation="vertical" android:layout_marginEnd="10dp">
            <TextView android:id="@+id/lw_water" android:layout_width="match_parent" android:layout_height="wrap_content"
                android:textSize="12sp" android:textColor="@color/lw_muted" android:maxLines="1"/>
            <ProgressBar android:id="@+id/lw_water_bar" style="@android:style/Widget.ProgressBar.Horizontal"
                android:layout_width="match_parent" android:layout_height="5dp" android:layout_marginTop="4dp"
                android:max="100" android:progress="0" android:progressDrawable="@drawable/leco_widget_bar_water"/>
        </LinearLayout>
        <TextView android:id="@+id/lw_add_water" android:layout_width="wrap_content" android:layout_height="34dp"
            android:gravity="center" android:paddingStart="14dp" android:paddingEnd="14dp"
            android:text="+ Copo" android:textSize="13sp" android:textStyle="bold" android:textColor="#FFFFFF" android:background="@drawable/leco_widget_btn"/>
    </LinearLayout>
</LinearLayout>
''')
open(f'{res}/xml/leco_widget_info.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp" android:minHeight="140dp"
    android:minResizeWidth="180dp" android:minResizeHeight="110dp"
    android:targetCellWidth="4" android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/leco_widget"
    android:previewLayout="@layout/leco_widget"
    android:description="@string/lw_desc"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"/>
''')

# ── ícones alternativos ──────────────────────────────────────────────
L_PATH = 'M39.27,35.25 L39.27,66.05 L48.64,66.05 L52.66,58.02 L58.02,72.75 L62.04,62.04 L68.73,62.04'
ALT = {  # nome: (fundo, cor do traço)
    'escuro': ('#1C1B1A', '#F26B3A'),
    'claro': ('#F4F1EC', '#F26B3A'),
    'mono': ('#FFFFFF', '#1C1B1A'),
}
os.makedirs(f'{res}/mipmap-anydpi-v26', exist_ok=True)
os.makedirs(f'{res}/mipmap-anydpi', exist_ok=True)
for n, (bgc, fg) in ALT.items():
    open(f'{res}/drawable/ic_alt_{n}_fg.xml', 'w').write(f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:pathData="{L_PATH}" android:strokeColor="{fg}" android:strokeWidth="6.7" android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000"/>
</vector>
''')
    open(f'{res}/drawable/ic_alt_{n}_bg.xml', 'w').write(f'''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="{bgc}"/></shape>
''')
    adaptive = f'''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_alt_{n}_bg"/>
    <foreground android:drawable="@drawable/ic_alt_{n}_fg"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
'''
    open(f'{res}/mipmap-anydpi-v26/ic_alt_{n}.xml', 'w').write(adaptive)
    open(f'{res}/mipmap-anydpi-v26/ic_alt_{n}_round.xml', 'w').write(adaptive)
    legacy = f'''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape android:shape="oval"><solid android:color="{bgc}"/></shape></item>
    <item android:drawable="@drawable/ic_alt_{n}_fg"/>
</layer-list>
'''
    open(f'{res}/mipmap-anydpi/ic_alt_{n}.xml', 'w').write(legacy)
    open(f'{res}/mipmap-anydpi/ic_alt_{n}_round.xml', 'w').write(legacy)

# ── manifesto ────────────────────────────────────────────────────────
mf = f'{base}/AndroidManifest.xml'
m = open(mf).read()
# o ícone do app passa a ser um dos 4 apelidos (activity-alias) da MainActivity; só um fica ligado
if 'IconLaranja' not in m:
    import re
    a0 = m.find('.MainActivity')
    a_start = m.rfind('<activity', 0, a0)
    a_end = m.find('</activity>', a0)
    act = m[a_start:a_end]
    launcher = re.search(r'\s*<intent-filter>\s*<action android:name="android.intent.action.MAIN"\s*/>\s*<category android:name="android.intent.category.LAUNCHER"\s*/>\s*</intent-filter>', act)
    sc = re.search(r'\s*<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"\s*/>', act)
    if a_start < 0 or a_end < 0 or not launcher:
        print('AVISO: MainActivity sem LAUNCHER no formato esperado; ícones alternativos desligados')
    else:
        target = re.search(r'android:name="([^"]*MainActivity)"', act).group(1)  # igual ao declarado (".MainActivity" ou completo)
        lab = re.search(r'android:label="([^"]+)"', act)
        label = f' android:label="{lab.group(1)}"' if lab else ''
        act2 = act.replace(launcher.group(0), '')
        if sc: act2 = act2.replace(sc.group(0), '')
        meta = '\n            <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />' if sc else ''
        def alias(n, icon, rnd, on):
            return f'''
        <activity-alias android:name="{jpkg}.Icon{n.capitalize()}" android:targetActivity="{target}"
            android:enabled="{'true' if on else 'false'}" android:exported="true"{label}
            android:icon="{icon}" android:roundIcon="{rnd}">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>{meta}
        </activity-alias>'''
        aliases = alias('laranja', '@mipmap/ic_launcher', '@mipmap/ic_launcher_round', True) + ''.join(alias(n, f'@mipmap/ic_alt_{n}', f'@mipmap/ic_alt_{n}_round', False) for n in ALT)
        end = a_end + len('</activity>')
        m = m[:a_start] + act2 + '</activity>' + aliases + m[end:]
        open(mf, 'w').write(m)
        print(re.search(r'<activity[\s\S]*</activity-alias>', m).group(0))
if 'LecoWidget' not in m:
    rec = f'''        <receiver android:name="{jpkg}.LecoWidget" android:exported="false" android:label="@string/lw_label">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/leco_widget_info" />
        </receiver>
'''
    i = m.rindex('</application>')
    m = m[:i] + rec + '    ' + m[i:]
    open(mf, 'w').write(m)
print('nativo ok:', jdir)
