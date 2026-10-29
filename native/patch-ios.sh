#!/usr/bin/env bash
# Agrega el esquema ar.irusta.trainingclub:// para volver del login de Google.
set -euo pipefail
P=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
if $PB -c "Print :CFBundleURLTypes" "$P" >/dev/null 2>&1; then echo "iOS: ya estaba"; exit 0; fi
$PB -c "Add :CFBundleURLTypes array" "$P"
$PB -c "Add :CFBundleURLTypes:0 dict" "$P"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string ar.irusta.trainingclub" "$P"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$P"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string ar.irusta.trainingclub" "$P"
$PB -c "Add :LSApplicationQueriesSchemes array" "$P" || true
$PB -c "Add :LSApplicationQueriesSchemes:0 string whatsapp" "$P" || true
echo "iOS: esquema agregado"
