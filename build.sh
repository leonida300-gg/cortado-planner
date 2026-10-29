#!/bin/sh
# Builds app.html (fragment for publishing as a Claude artifact) and index.html (standalone page for any static host).
set -e
cd "$(dirname "$0")"
cat > /tmp/cortado_head.html <<'H'
<title>Cortado Planner</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap">
H
{
  cat /tmp/cortado_head.html
  echo '<style>'; cat src/styles.css; echo '</style>'
  cat src/shell.html
  echo '<script>'; cat src/data.js src/forecast.js src/replen.js src/charts.js src/ui.js; echo '</script>'
} > app.html
{
  cat <<'H'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
H
  cat /tmp/cortado_head.html
  echo '<style>'; cat src/styles.css; echo '</style>'
  echo '</head>'; echo '<body>'
  cat src/shell.html
  echo '<script>'; cat src/data.js src/forecast.js src/replen.js src/charts.js src/ui.js; echo '</script>'
  echo '</body>'; echo '</html>'
} > index.html
rm -f /tmp/cortado_head.html
echo "built: app.html ($(wc -c < app.html | tr -d ' ') bytes), index.html ($(wc -c < index.html | tr -d ' ') bytes)"
