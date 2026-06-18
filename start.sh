#!/bin/bash
PID_FILE="$HOME/GeoPort/geoport.pid"
CAFF_PID_FILE="$HOME/GeoPort/caffeinate.pid"
LOG_FILE="$HOME/GeoPort/geoport.log"
PORT=54321
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "GeoPort 已在執行中 (PID: $PID)"
        echo "網頁: http://localhost:$PORT"
        open "http://localhost:$PORT"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

mkdir -p "$HOME/GeoPort"
caffeinate -i &
echo $! > "$CAFF_PID_FILE"

echo "啟動 GeoPort..."
nohup sudo python3 "$SCRIPT_DIR/src/main.py" --no-browser --port $PORT >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "GeoPort 已在背景執行"
echo "網頁: http://localhost:$PORT"
echo "Log:  $LOG_FILE"
sleep 3
open "http://localhost:$PORT"
