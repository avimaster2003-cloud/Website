#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
EXPORT_URL="file://$SCRIPT_DIR/index.html?export=1"

if ! command -v gs >/dev/null 2>&1; then
  echo "Missing dependency: ghostscript (gs)"
  echo "Install with: brew install ghostscript"
  exit 1
fi

echo "[1/2] Building RGB source PDF from HTML..."
if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  echo "Using Chrome renderer for closest match to on-screen mockup."
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new \
    --disable-gpu \
    --virtual-time-budget=3000 \
    --print-to-pdf-no-header \
    --print-to-pdf="$SCRIPT_DIR/business-card-rgb.pdf" \
    "$EXPORT_URL"
elif command -v wkhtmltopdf >/dev/null 2>&1; then
  echo "Chrome not found, falling back to wkhtmltopdf (layout may differ slightly)."
  wkhtmltopdf \
    --page-width 85.5mm \
    --page-height 54mm \
    --margin-top 0 \
    --margin-bottom 0 \
    --margin-left 0 \
    --margin-right 0 \
    --enable-local-file-access \
    "$EXPORT_URL" business-card-rgb.pdf
else
  echo "Missing HTML-to-PDF tool. Install one of:"
  echo "- Google Chrome app (recommended for exact output), or"
  echo "- wkhtmltopdf"
  exit 1
fi

echo "[2/2] Converting PDF to CMYK..."
gs \
  -dSAFER \
  -dBATCH \
  -dNOPAUSE \
  -dAutoRotatePages=/None \
  -dCompatibilityLevel=1.4 \
  -sDEVICE=pdfwrite \
  -sColorConversionStrategy=CMYK \
  -dProcessColorModel=/DeviceCMYK \
  -dConvertCMYKImagesToRGB=false \
  -sOutputFile=business-card-cmyk.pdf \
  business-card-rgb.pdf

echo "Done: business-card-cmyk.pdf is ready to send to print."
