import os
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DATA_FILE = os.path.join(os.path.dirname(__name__), 'data', 'schedule.json')
SOUNDS_DIR = os.path.join(os.path.dirname(__name__), 'static', 'sounds')

# 音声保存先フォルダがなければ作成
os.makedirs(SOUNDS_DIR, exist_ok=True)

DEFAULT_DATA = {
    "settings": {
        "warning_minutes": 3,
        "night_mode_start": "23:00",
        "night_mode_end": "05:00"
    },
    "schedule": [
        {"id": 1, "day": 1, "start": "05:30", "end": "06:00", "message": "おきるじかんです。トイレにいってきがえましょう。👕🚽"}
    ]
}

def load_data():
    if not os.path.exists(DATA_FILE):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        save_data(DEFAULT_DATA)
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/api/data', methods=['GET', 'POST'])
def api_data():
    if request.method == 'POST':
        save_data(request.json)
        return jsonify({"status": "success"})
    return jsonify(load_data())

# 🎵 音声アップロードAPI
@app.route('/api/upload_sound', methods=['POST'])
def upload_sound():
    file = request.files.get('file')
    sound_type = request.form.get('type')  # 'change' または 'warning'

    if file and sound_type in ['change', 'warning']:
        # 拡張子に関わらず強制的に mp3 として上書き保存（扱いやすくするため）
        filepath = os.path.join(SOUNDS_DIR, f"{sound_type}.mp3")
        file.save(filepath)
        return jsonify({"status": "success"})

    return jsonify({"status": "error", "message": "不正なリクエストです"}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
