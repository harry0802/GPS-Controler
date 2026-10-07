GPS-Controller (GeoPort)

GeoPort 是一個以 Python 為核心開發的 GPS 定位與軌跡控制工具介面，提供直觀的網頁操作環境，方便進行定位模擬與軌跡繪製。

🎯 功能特點 (Features)

📍 即時定位控制：輕鬆設定與調整模擬的 GPS 座標。

🗺️ 軌跡繪製與模擬：支援建立與播放移動軌跡。

💻 網頁化操作介面：透過瀏覽器即可直觀操作所有功能。

🎬 功能示範 (Demo)

建立軌跡 (Create Track)

🛠️ 環境需求 (Prerequisites)

Python：3.8 或以上版本

作業系統：macOS / Linux / Windows

🚀 快速開始 (Quick Start)

1. 安裝依賴套件 (Install Dependencies)

在專案根目錄開啟終端機 (Terminal / Command Prompt)，執行以下指令安裝所需套件：

pip install -r requirements.txt


2. 啟動服務 (Run Application)

方法 A：使用 Python 指令啟動（可指定 Port）

預設直接執行主程式：

python main.py


若您的程式支援透過參數指定 Port（例如指定 Port 54321）：

python main.py --port 54321


(註：若系統預設為 Python 2，請改用 python3；若主程式檔名為 app.py 或 run.py 請相應調整)

方法 B：使用快速啟動腳本 (macOS)

在 Mac 環境下，可以直接點擊或在終端機執行：

./GeoPort\ .command


3. 開啟網頁介面 (Access Web UI)

服務啟動後，請開啟瀏覽器並造訪對應的埠號（Port）：

👉 http://localhost:54321

📁 專案結構 (Project Structure)

.
├── main.py               # Python 主程式入口
├── requirements.txt      # Python 依賴套件清單
├── GeoPort .command      # macOS 快速啟動腳本
└── images/               # 專案圖檔與示範 GIF
    └── create-track.gif
