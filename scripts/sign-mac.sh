#!/usr/bin/env bash
# Firma Lector.app. Con certificado Developer ID (variables MAC_CERT_P12_BASE64 y MAC_CERT_PASSWORD)
# firma para distribución y, si hay clave de API de App Store Connect, notariza y grapa el ticket.
# Sin certificado, firma ad hoc como hasta ahora.
set -euo pipefail
APP="$1"          # ruta a Lector.app
RC="$2"           # ruta a rcodesign
ENT="$(dirname "$0")/../build/entitlements.plist"

if [ -z "${MAC_CERT_P12_BASE64:-}" ]; then
  echo "Sin certificado: firma ad hoc"
  "$RC" sign "$APP"
  exit 0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "$MAC_CERT_P12_BASE64" | base64 -d > "$TMP/cert.p12"
printf '%s' "$MAC_CERT_PASSWORD" > "$TMP/pass"

ARGS=(--p12-file "$TMP/cert.p12" --p12-password-file "$TMP/pass" --for-notarization
      -e "$ENT")
# Los ejecutables auxiliares de Electron necesitan los mismos permisos que la app principal.
while IFS= read -r helper; do
  rel="${helper#"$APP"/}"
  ARGS+=(-e "$rel:$ENT")
done < <(find "$APP/Contents/Frameworks" -maxdepth 1 -name "*.app")

echo "Firmando con Developer ID"
"$RC" sign "${ARGS[@]}" "$APP"

if [ -n "${APPLE_API_KEY_P8:-}" ]; then
  printf '%s' "$APPLE_API_KEY_P8" > "$TMP/AuthKey.p8"
  "$RC" encode-app-store-connect-api-key -o "$TMP/key.json" "$APPLE_API_ISSUER_ID" "$APPLE_API_KEY_ID" "$TMP/AuthKey.p8"
  echo "Notarizando (suele tardar unos minutos)"
  "$RC" notary-submit --api-key-path "$TMP/key.json" --staple "$APP"
else
  echo "Sin clave de API de App Store Connect: firmada pero sin notarizar"
fi
