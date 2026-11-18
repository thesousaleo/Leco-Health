"""Cria os atalhos do ícone (segurar o ícone do app) no projeto Android gerado pelo Capacitor.
Uso: python3 android-res/shortcuts/make.py <applicationId> <pacote.da.MainActivity>"""
import os, re, sys

app_id, java_pkg = sys.argv[1], sys.argv[2]
res = 'android/app/src/main/res'
os.makedirs(f'{res}/xml', exist_ok=True)
os.makedirs(f'{res}/drawable', exist_ok=True)

# (id, rótulo curto, rótulo longo, path do ícone Material 24dp)
SC = [
    ('agua', 'Água', 'Registrar um copo de água',
     'M12,2c-5.33,4.55 -8,8.48 -8,11.8c0,4.98 3.8,8.2 8,8.2s8,-3.22 8,-8.2C20,10.48 17.33,6.55 12,2z'),
    ('refeicao', 'Refeição', 'Foto da refeição',
     'M12,15.2a3.2,3.2 0,1 0,0 -6.4a3.2,3.2 0,1 0,0 6.4zM9,2L7.17,4H4c-1.1,0 -2,0.9 -2,2v12c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V6c0,-1.1 -0.9,-2 -2,-2h-3.17L15,2H9zM12,17c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5 5,2.24 5,5 -2.24,5 -5,5z'),
    ('treino', 'Treino', 'Iniciar o treino de hoje',
     'M20.57,14.86L22,13.43 20.57,12 17,15.57 8.43,7 12,3.43 10.57,2 9.14,3.43 7.71,2 5.57,4.14 4.14,2.71 2.71,4.14l1.43,1.43L2,7.71l1.43,1.43L2,10.57 3.43,12 7,8.43 15.57,17 12,20.57 13.43,22l1.43,-1.43L16.29,22l2.14,-2.14 1.43,1.43 1.43,-1.43 -1.43,-1.43L22,16.29z'),
    ('peso', 'Peso', 'Registrar o peso',
     'M14,11V8c4.56,-0.58 8,-3.1 8,-6H2c0,2.9 3.44,5.42 8,6l0,3c-3.68,0.73 -8,3.61 -8,11h6v-2H4.13c0.93,-6.83 6.65,-7.2 7.87,-7.2s6.94,0.37 7.87,7.2H16v2h6C22,14.61 17.68,11.73 14,11zM12,22c-1.1,0 -2,-0.9 -2,-2c0,-0.55 0.22,-1.05 0.59,-1.41C11.39,17.79 16,16 16,16s-1.79,4.61 -2.59,5.41C13.05,21.78 12.55,22 12,22z'),
]

for sid, _, _, path in SC:
    open(f'{res}/drawable/sc_{sid}.xml', 'w').write(f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="48dp" android:height="48dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#F26B3A" android:pathData="M12,0a12,12 0,1 1,0 24a12,12 0,1 1,0 -24z"/>
    <group android:scaleX="0.55" android:scaleY="0.55" android:pivotX="12" android:pivotY="12">
        <path android:fillColor="#FFFFFF" android:pathData="{path}"/>
    </group>
</vector>
''')

strings = '\n'.join(f'    <string name="sc_{sid}">{short}</string>\n    <string name="sc_{sid}_long">{long}</string>' for sid, short, long, _ in SC)
open(f'{res}/values/shortcuts_strings.xml', 'w').write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n{strings}\n</resources>\n')

items = '\n'.join(f'''    <shortcut android:shortcutId="{sid}" android:enabled="true" android:icon="@drawable/sc_{sid}"
        android:shortcutShortLabel="@string/sc_{sid}" android:shortcutLongLabel="@string/sc_{sid}_long">
        <intent android:action="android.intent.action.VIEW" android:targetPackage="{app_id}"
            android:targetClass="{java_pkg}.MainActivity" android:data="lecohealth://atalho/{sid}" />
    </shortcut>''' for sid, _, _, _ in SC)
open(f'{res}/xml/shortcuts.xml', 'w').write(f'<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n{items}\n</shortcuts>\n')

# liga os atalhos à atividade principal (a do ícone)
mf = 'android/app/src/main/AndroidManifest.xml'
m = open(mf).read()
if 'android.app.shortcuts' not in m:
    i = m.index('.MainActivity')
    j = m.index('</activity>', i)
    m = m[:j] + '    <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />\n        ' + m[j:]
    open(mf, 'w').write(m)
print(open(f'{res}/xml/shortcuts.xml').read())
print(re.search(r'<activity[\s\S]*?</activity>', m).group(0))
