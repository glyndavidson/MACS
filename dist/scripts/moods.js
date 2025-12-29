const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];
const weathers = ['none','rain','wind','hot','cold'];

function applyBodyClass(prefix, value, allowed, fallback){

    [...document.body.classList].forEach(c => { if (c.startsWith(prefix + '-')) document.body.classList.remove(c); });
    const v = (value || '').toString().trim().toLowerCase();
    document.body.classList.add(prefix + '-' + (allowed.includes(v) ? v : fallback));
}

function setMood(m){ 
    applyBodyClass('mood', m, moods, 'idle'); 
}
function setWeather(wx){ applyBodyClass('wx', wx, weathers, 'none'); }

function setWeatherIntensity(intensity){
    if (intensity === null || intensity === undefined) return;
    const v = Math.max(0, Math.min(1, parseFloat(intensity)));
    if (!Number.isNaN(v)) document.documentElement.style.setProperty('--weather-intensity', v.toString());
}

const qs = new URLSearchParams(location.search);
setMood(qs.get('mood') || 'idle');
setWeather(qs.get('wx') || 'none');
setWeatherIntensity(qs.get('int'));

window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'macs:mood') return;
    setMood(e.data.mood || 'idle');
});