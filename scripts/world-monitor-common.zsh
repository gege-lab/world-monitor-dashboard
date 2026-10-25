#!/bin/zsh

PROJECT_DIR="${${(%):-%N}:A:h:h}"
PORT="${WORLD_MONITOR_PORT:-4173}"
if [[ "$PORT" != <-> || ${#PORT} -gt 5 ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "ポート番号は1024から65535の整数で指定してください。"
  exit 1
fi
PROJECT_ID="$(printf '%s' "$PROJECT_DIR" | /usr/bin/cksum | /usr/bin/awk '{print $1}')"
LAUNCH_LABEL="local.world-monitor-dashboard.${PORT}.${PROJECT_ID}"
LEGACY_LAUNCH_LABEL="local.world-monitor-dashboard"
RUNTIME_DIR="${PROJECT_DIR}/.runtime"
PID_FILE="${RUNTIME_DIR}/world-monitor-${PORT}.pid"
LEGACY_PID_FILE="${RUNTIME_DIR}/world-monitor.pid"
LOG_FILE="${RUNTIME_DIR}/world-monitor-${PORT}.log"
URL="http://localhost:${PORT}/"

pause_before_close() {
  [[ "${WORLD_MONITOR_NO_PAUSE:-0}" == "1" ]] && return
  echo
  echo "Enterキーで閉じます。"
  read -r _
}

is_world_monitor_pid() {
  local command_line
  command_line="$(/bin/ps -p "$1" -o command= 2>/dev/null || true)"
  [[ -n "$command_line" && "$command_line" == *"${PROJECT_DIR}/server.mjs"* ]]
}

launch_pid_for_label() {
  /bin/launchctl list 2>/dev/null | /usr/bin/awk -v label="$1" '$3 == label {print $1}'
}

resolve_node() {
  local architecture candidate version
  architecture="$(/usr/bin/uname -m)"
  if [[ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" == "1" ]]; then
    architecture="arm64"
  elif [[ "$architecture" == "x86_64" ]]; then
    architecture="x64"
  fi
  for candidate in \
    "${PROJECT_DIR}/runtime/${architecture}/bin/node" \
    "$(command -v node 2>/dev/null || true)" \
    "/opt/homebrew/bin/node" \
    "/usr/local/bin/node" \
    "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    version="$("$candidate" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null)" || continue
    if [[ "$version" == <-> ]] && (( version >= 20 )); then
      NODE_BIN="$candidate"
      return 0
    fi
  done
  echo "利用できるNode.jsが見つかりません。"
  echo "移行版のruntimeフォルダーも一緒にコピーしてください。"
  echo "同梱版はmacOS 11以降のApple Silicon / Intelに対応しています。"
  return 1
}

wait_for_dashboard() {
  local pid="$1" attempt
  for attempt in {1..30}; do
    if is_world_monitor_pid "$pid" && /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    /bin/kill -0 "$pid" 2>/dev/null || return 1
    /bin/sleep 0.2
  done
  return 1
}
