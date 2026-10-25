#!/bin/zsh
set -eu

source "${0:A:h}/scripts/world-monitor-common.zsh"
echo "World Monitor のデスクトップアイコンを設定します。"
echo "本体: $PROJECT_DIR"
if ! resolve_node; then
  pause_before_close
  exit 1
fi
if ! "$NODE_BIN" "$PROJECT_DIR/scripts/install-desktop.mjs" "$PROJECT_DIR" "${WORLD_MONITOR_DESKTOP_DIR:-$HOME/Desktop}"; then
  echo "セットアップに失敗しました。デスクトップへのアクセス許可を確認してください。"
  pause_before_close
  exit 1
fi
echo
echo "設定完了。デスクトップの「World Monitor 起動」をダブルクリックしてください。"
echo "本体フォルダーを移動した場合は、このセットアップをもう一度実行してください。"
pause_before_close
