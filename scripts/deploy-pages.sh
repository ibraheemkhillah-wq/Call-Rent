#!/usr/bin/env bash
#
# نشر التطبيق على GitHub Pages بلا المرور بـ GitHub Actions.
#
# لماذا: طابور آلات Actions يتعطّل أحياناً ساعات، فتُلغى النشرة قبل أن
# تبدأ. هذا السكربت يبني محلياً ويدفع مجلد dist إلى فرع gh-pages، فتنشره
# GitHub عبر خط النشر الخاص بها — وهو منفصل تماماً عن آلات Actions.
#
# الاستعمال:  npm run deploy
#
# إعداد لمرة واحدة في المستودع:
#   Settings ← Pages ← Build and deployment ← Source ← Deploy from a branch
#   Branch: gh-pages   Folder: / (root)

set -euo pipefail

BRANCH="gh-pages"
BUILD_DIR="dist"
# التطبيق يُنشر تحت https://<user>.github.io/Call-Rent/
export VITE_BASE="${VITE_BASE:-/Call-Rent/}"

cd "$(dirname "$0")/.."

echo "▸ بناء نسخة الإنتاج (base=$VITE_BASE)"
npm run build

# .nojekyll يمنع Jekyll من تجاهل الملفات التي تبدأ بشرطة سفلية
touch "$BUILD_DIR/.nojekyll"

SRC_COMMIT="$(git rev-parse --short HEAD)"
SRC_SUBJECT="$(git log -1 --pretty=%s)"

# شجرة عمل منفصلة حتى لا يُمسّ فرع العمل الحالي ولا الملفات غير المحفوظة
WORKTREE="$(mktemp -d)"
trap 'git worktree remove --force "$WORKTREE" 2>/dev/null || true; rm -rf "$WORKTREE"' EXIT

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add --quiet "$WORKTREE" -B "$BRANCH" "origin/$BRANCH"
else
  git worktree add --quiet --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --quiet --orphan "$BRANCH"
  git -C "$WORKTREE" rm -rqf . 2>/dev/null || true
fi

# محتوى الفرع نسخة طبق الأصل من dist — تُحذف بقايا البناء السابق
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a "$BUILD_DIR"/. "$WORKTREE"/

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "▸ لا تغيير في الناتج — لا حاجة للنشر"
  exit 0
fi

git -C "$WORKTREE" commit -q -m "نشر $SRC_COMMIT — $SRC_SUBJECT"

echo "▸ الدفع إلى $BRANCH"
for attempt in 1 2 3 4; do
  if git -C "$WORKTREE" push -u origin "$BRANCH"; then
    echo "▸ تم. الرابط: https://ibraheemkhillah-wq.github.io/Call-Rent/"
    exit 0
  fi
  wait=$((2 ** attempt))
  echo "▸ فشل الدفع، إعادة المحاولة بعد ${wait}ث"
  sleep "$wait"
done

echo "▸ تعذّر الدفع بعد أربع محاولات" >&2
exit 1
