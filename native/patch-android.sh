#!/usr/bin/env bash
# Agrega el "deep link" ar.irusta.trainingclub:// para volver del login de Google.
set -euo pipefail
M=android/app/src/main/AndroidManifest.xml
grep -q 'ar.irusta.trainingclub' "$M" && exit 0
python3 - "$M" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
intent='''
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="ar.irusta.trainingclub" />
            </intent-filter>
'''
i=s.index('</activity>')
s=s[:i]+intent+'        '+s[i:]
open(p,'w').write(s)
PY
echo "Android: deep link agregado"
