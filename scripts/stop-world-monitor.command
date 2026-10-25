#!/bin/zsh
set -u

source "${0:A:h}/world-monitor-common.zsh"

stop_pid() {
  local pid="$1"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null || ! is_world_monitor_pid "$pid"; then
    return 1
  fi

  echo "停止します。PID: ${pid}"
  kill "$pid" 2>/dev/null || return 1

  for _ in {1..25}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  echo "停止要求を送りましたが、まだ終了待ちです。"
  return 0
}

echo "World Monitor を停止します..."
echo

stopped=0
labels=("$LAUNCH_LABEL")
[[ "$PORT" == "4173" ]] && labels+=("$LEGACY_LAUNCH_LABEL")
for label in "${labels[@]}"; do
  launch_pid="$(launch_pid_for_label "$label")"
  if [[ "$launch_pid" == <-> ]] && is_world_monitor_pid "$launch_pid"; then
    launchctl remove "$label" >/dev/null 2>&1 || true
    stopped=1
    sleep 0.5
  fi
done

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if stop_pid "$pid"; then
    stopped=1
  fi
fi

if [[ "$PORT" == "4173" && -f "$LEGACY_PID_FILE" ]]; then
  pid="$(cat "$LEGACY_PID_FILE" 2>/dev/null || true)"
  if stop_pid "$pid"; then
    stopped=1
    rm -f "$LEGACY_PID_FILE"
  fi
fi

for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null); do
  if stop_pid "$pid"; then
    stopped=1
  fi
done

if [[ "$stopped" -eq 1 ]]; then
  rm -f "$PID_FILE"
  echo
  echo "停止しました。"
else
  echo "起動中の World Monitor は見つかりませんでした。"
fi

pause_before_close
