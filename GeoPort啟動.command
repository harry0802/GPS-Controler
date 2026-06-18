#!/bin/bash
PID_FILE="$HOME/GeoPort/geoport.pid"
CAFF_PID_FILE="$HOME/GeoPort/caffeinate.pid"
LOG_FILE="$HOME/GeoPort/geoport.log"
PORT=54321
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 檢查是否已在執行
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "GeoPort 已在執行中，開啟網頁..."
        open "http://localhost:$PORT"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

mkdir -p "$HOME/GeoPort"

# 如果不是 root，重新用 sudo 執行整個腳本
if [ "$EUID" -ne 0 ]; then
    echo "需要管理員密碼："
    exec sudo bash "$0"
fi

# 以下以 root 身份執行
caffeinate -i &
echo $! > "$CAFF_PID_FILE"

echo "啟動 GeoPort..."
python3 "$SCRIPT_DIR/src/main.py" --no-browser --port $PORT > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "等待 server 啟動..."
for i in $(seq 1 20); do
    if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
        echo "Server 已啟動！"
        break
    fi
    echo -n "."
    sleep 1
done

# open 要用原本的 user 執行才能開瀏覽器
ORIGINAL_USER=$(logname 2>/dev/null || echo "$SUDO_USER")
sudo -u "$ORIGINAL_USER" open "http://localhost:$PORT"
echo ""
echo "完成！可以關掉這個視窗了。"
