let scheduleData = { schedule: [], settings: { warning_minutes: 3, night_mode_start: "23:00", night_mode_end: "05:00" } };
let currentTaskId = null;
let warningPlayedForTaskId = null;

// ★お住まいの地域の緯度・経度を設定してください（デフォルトは東京）
const LAT = 35.6895;
const LON = 139.6917;

function initApp() {
    const timestamp = new Date().getTime();
    document.getElementById('sound-change').src = `/static/sounds/change.mp3?t=${timestamp}`;
    document.getElementById('sound-warning').src = `/static/sounds/warning.mp3?t=${timestamp}`;

    fetchData();
    fetchWeather(); // 天気を取得
    setInterval(fetchData, 5000);
    setInterval(checkSchedule, 1000);
    setInterval(fetchWeather, 3600000); // 天気は1時間ごとに更新
}

function requestFullAndStart() {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
    } else if (docElm.mozRequestFullScreen) { /* Firefox */
        docElm.mozRequestFullScreen();
    } else if (docElm.webkitRequestFullscreen) { /* Chrome, Safari, Silk */
        docElm.webkitRequestFullscreen();
    } else if (docElm.msRequestFullscreen) { /* IE/Edge */
        docElm.msRequestFullscreen();
    }

    startApp();
}

function startApp() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';

    const soundChange = document.getElementById('sound-change');
    const soundWarning = document.getElementById('sound-warning');
    soundChange.play().then(() => soundChange.pause()).catch(e => {});
    soundWarning.play().then(() => soundWarning.pause()).catch(e => {});
}

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        scheduleData = await response.json();
    } catch (error) { console.error("データ取得エラー", error); }
}

// 🌤 天気取得機能 (Open-Meteo API)
async function fetchWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo`;
        const res = await fetch(url);
        const data = await res.json();

        const code = data.daily.weathercode[0];
        const maxT = Math.round(data.daily.temperature_2m_max[0]);
        const minT = Math.round(data.daily.temperature_2m_min[0]);

        let icon = "☁️";
        if (code <= 1) icon = "☀️";
        else if (code <= 3) icon = "⛅";
        else if (code <= 48) icon = "🌫";
        else if (code <= 67) icon = "☔";
        else if (code <= 77) icon = "⛄";
        else if (code <= 82) icon = "☔";
        else if (code >= 95) icon = "⚡";

        document.getElementById('weather-icon').innerText = icon;
        document.getElementById('weather-temp').innerText = `${maxT}°C / ${minT}°C`;
    } catch (e) {
        console.log("天気取得エラー", e);
    }
}

function checkSchedule() {
    const now = new Date();
    const currentDay = now.getDay();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').innerText = `${hours}:${minutes}`;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const startMins = parseTimeToMinutes(scheduleData.settings.night_mode_start || "23:00");
    const endMins = parseTimeToMinutes(scheduleData.settings.night_mode_end || "05:00");
    let isNight = (startMins <= endMins)
        ? (nowMinutes >= startMins && nowMinutes < endMins)
        : (nowMinutes >= startMins || nowMinutes < endMins);

    if (isNight) {
        document.body.classList.add('night-mode');
        document.getElementById('current-message').innerText = "おやすみなさい... 🌙💤";
        document.getElementById('time-timer').style.display = 'none'; // 夜はタイマー非表示
        return;
    } else {
        document.body.classList.remove('night-mode');
    }

    let activeTask = null;
    let nextTask = null;

    const todaysSchedule = scheduleData.schedule
        .filter(task => parseInt(task.day) === currentDay)
        .map(task => {
            const [sH, sM] = task.start.split(':').map(Number);
            const [eH, eM] = task.end.split(':').map(Number);
            return { ...task, startMins: sH * 60 + sM, endMins: eH * 60 + eM };
        })
        .sort((a, b) => a.startMins - b.startMins);

    for (let i = 0; i < todaysSchedule.length; i++) {
        const task = todaysSchedule[i];
        if (nowMinutes >= task.startMins && nowMinutes < task.endMins) activeTask = task;
        if (nowMinutes < task.startMins && !nextTask) nextTask = task;
    }

    const timerEl = document.getElementById('time-timer');

    if (activeTask) {
        document.getElementById('current-message').innerText = activeTask.message;

        // ⏱ タイムタイマーの計算
        const remainingMins = activeTask.endMins - nowMinutes;
        const displayMins = remainingMins > 60 ? 60 : remainingMins;
        const pct = (displayMins / 60) * 100; // 残り時間をパーセント(%)に変換

        timerEl.style.setProperty('--remaining-pct', pct);
        timerEl.style.display = 'block';

        if (currentTaskId !== activeTask.id) {
            currentTaskId = activeTask.id;
            playSound('sound-change');
        }
    } else {
        document.getElementById('current-message').innerText = "たぶん、ねるじかんです・・・👻";
        currentTaskId = null;
        timerEl.style.display = 'none';
    }

    if (nextTask) {
        const warningTime = nextTask.startMins - scheduleData.settings.warning_minutes;
        if (nowMinutes === warningTime && warningPlayedForTaskId !== nextTask.id) {
            playSound('sound-warning');
            warningPlayedForTaskId = nextTask.id;
        }
    }
}

function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function playSound(id) {
    const audio = document.getElementById(id);
    audio.currentTime = 0;
    audio.play().catch(e => console.log("再生エラー", e));
}
