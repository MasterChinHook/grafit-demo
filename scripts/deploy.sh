#!/usr/bin/env bash
# Ручной деплой без GitHub Actions: собирает сайт и публикует dist/ в ветку gh-pages.
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
REPO=$(basename -s .git "$REMOTE")
OWNER=$(basename "$(dirname "$REMOTE")" | sed 's/.*://')
OWNER_LC=$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')
BASE_PATH="/$REPO/" SITE_URL="https://$OWNER_LC.github.io/$REPO/" npx vite build
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@localhost" commit -qm "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -qf "$REMOTE" gh-pages
rm -rf "$TMP"
echo "Готово: https://$OWNER_LC.github.io/$REPO/ (обновится через 1–2 минуты)"
