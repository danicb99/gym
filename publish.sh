#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🧪 Ejecutando suite de verificación..."
node tests/verify_flow.js
node tests/compat_test.js
node tests/complete_set_test.js

echo "📦 Comprobando estado de git..."
if [ -z "$(git status --porcelain)" ]; then
  echo "ℹ️ No hay cambios pendientes por commitear."
  exit 0
fi

MSG="${1:-Fix aplicado en caliente desde Antigravity Remote}"
git add .
git commit -m "$MSG"
echo "🚀 Subiendo a GitHub origin main..."
git push origin main
echo "✅ Publicado con éxito. GitHub Pages se actualizará en unos instantes."
