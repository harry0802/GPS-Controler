#!/bin/bash
PID_FILE="$HOME/GeoPort/geoport.pid"
CAFF_PID_FILE="$HOME/GeoPort/caffeinate.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "停止 GeoPort..."
        sudo kill "$PID"
        rm -f "$PID_FILE"
        echo "已停止"
    else
        echo "GeoPort 沒有在執行"
        rm -f "$PID_FILE"
    fi
else
    echo "GeoPort 沒有在執行"
fi

if [ -f "$CAFF_PID_FILE" ]; then
    kill "$(cat "$CAFF_PID_FILE")" 2>/dev/null
    rm -f "$CAFF_PID_FILE"
fi

echo "完成。"
sleep 2
