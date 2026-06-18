#!/bin/bash
# GeoPort 停止腳本

PID_FILE="$HOME/GeoPort/geoport.pid"
CAFF_PID_FILE="$HOME/GeoPort/caffeinate.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "停止 GeoPort (PID: $PID)..."
        sudo kill "$PID"
        rm -f "$PID_FILE"
        echo "已停止"
    else
        echo "GeoPort 沒有在執行"
        rm -f "$PID_FILE"
    fi
else
    echo "找不到 PID 檔案，GeoPort 可能沒有在執行"
fi

# 停止 caffeinate（允許電腦恢復正常睡眠）
if [ -f "$CAFF_PID_FILE" ]; then
    CAFF_PID=$(cat "$CAFF_PID_FILE")
    kill "$CAFF_PID" 2>/dev/null
    rm -f "$CAFF_PID_FILE"
    echo "電腦可以正常睡眠了"
fi
