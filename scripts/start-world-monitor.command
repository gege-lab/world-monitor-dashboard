#!/bin/zsh
set -u
unsetopt BG_NICE 2>/dev/null || true

source "${0:A:h}/world-monitor-common.zsh"

open_dashboard() {
  if [[ "${WORLD_MONITOR_NO_OPEN:-0}" == "1" ]]; then
    return
  fi
  open "$URL"
}

mkdir -p "$RUNTIME_DIR"
if ! resolve_node; then
  pause_before_close
  exit 1
fi

echo "World Monitor を起動します..."
echo "Project: ${PROJECT_DIR}"
echo "URL: ${URL}"
echo

running_pid=""
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && is_world_monitor_pid "$pid"; then
    running_pid="$pid"
  fi
fi

if [[ -z "$running_pid" ]]; then
  for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null); do
    if is_world_monitor_pid "$pid"; then
      running_pid="$pid"
      echo "$pid" > "$PID_FILE"
      break
    fi
  done
fi

if [[ -n "$running_pid" ]]; then
  echo "すでに起動しています。PID: ${running_pid}"
  open_dashboard
  pause_before_close
  exit 0
fi

other_pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1)"
if [[ -n "$other_pid" ]]; then
  echo "ポート ${PORT} は別のプロセスが使用中です。"
  ps -p "$other_pid" -o pid= -o command= 2>/dev/null || true
  pause_before_close
  exit 1
fi

if launchctl list "$LAUNCH_LABEL" >/dev/null 2>&1; then
  existing_pid="$(launch_pid_for_label "$LAUNCH_LABEL")"
  if [[ "$existing_pid" == <-> ]] && ! is_world_monitor_pid "$existing_pid"; then
    echo "起動ラベルは別のアプリが使用中です。既存プロセスは変更しません。"
    pause_before_close
    exit 1
  fi
  launchctl remove "$LAUNCH_LABEL" >/dev/null 2>&1 || true
  sleep 0.3
fi

cd "$PROJECT_DIR" || {
  echo "プロジェクトディレクトリへ移動できません。"
  pause_before_close
  exit 1
}

if launchctl submit -l "$LAUNCH_LABEL" -- /usr/bin/env PORT="$PORT" "$NODE_BIN" "$PROJECT_DIR/server.mjs" >> "$LOG_FILE" 2>&1; then
  sleep 0.3
  new_pid="$(launch_pid_for_label "$LAUNCH_LABEL")"
  if [[ "$new_pid" == <-> ]] && wait_for_dashboard "$new_pid"; then
    echo "$new_pid" > "$PID_FILE"
    echo "起動しました。PID: ${new_pid}"
    echo "ログ: ${LOG_FILE}"
    open_dashboard
    pause_before_close
    exit 0
  fi
  launchctl remove "$LAUNCH_LABEL" >/dev/null 2>&1 || true
fi

/usr/bin/nohup env PORT="$PORT" "$NODE_BIN" "$PROJECT_DIR/server.mjs" >> "$LOG_FILE" 2>&1 &
fallback_pid="$!"
echo "$fallback_pid" > "$PID_FILE"
if wait_for_dashboard "$fallback_pid"; then
  echo "起動しました。PID: ${fallback_pid}"
  echo "ログ: ${LOG_FILE}"
  open_dashboard
  pause_before_close
  exit 0
fi

echo "起動に失敗しました。ログを確認してください。"
tail -n 30 "$LOG_FILE" 2>/dev/null || true
if is_world_monitor_pid "$fallback_pid"; then
  kill "$fallback_pid" 2>/dev/null || true
fi
rm -f "$PID_FILE"
pause_before_close
exit 1
