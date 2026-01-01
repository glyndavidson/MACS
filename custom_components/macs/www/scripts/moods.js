const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];
const weathers = ['none','rain','wind','hot','cold'];


// applies a css class to the body so that we can style based on mood/weather/brightness
function applyBodyClass(prefix, value, allowed, fallback){
    // remove existing prefixed classes
    [...document.body.classList].forEach(c => {
        if (c.startsWith(prefix + '-')) document.body.classList.remove(c);
    });

    // normalise the input value
    const v = (value ?? '').toString().trim().toLowerCase();

    // make sure it's an allowed value
    const isValid = typeof allowed === 'function' ? allowed(v) : allowed.includes(v);

    // apply the css style
    document.body.classList.add(prefix + '-' + (isValid ? v : fallback));
}

// set Macs mood. Must be one of const moods
function setMood(m){ 
    applyBodyClass('mood', m, moods, 'idle'); 
}

// set weather effect. Must be one of const weathers
function setWeather(weather){ 
    applyBodyClass('weather', weather, weathers, 'none'); 
}

// set brightness level (0-100)
function setBrightness(userBrightness){
	const brightness = Number(userBrightness);

	if (!Number.isFinite(brightness)) return;

    if (brightness < 0 || brightness > 100) return;

	// convert to 0–1 for opacity
    let opacity = 100;
    if (brightness === 0){
        opacity = 0;
    }
    else if (brightness < 100){
	    opacity = brightness / 100;
    }

	document.documentElement.style.setProperty(
		'--brightness-level',
		opacity.toString()
	);
}


const qs = new URLSearchParams(location.search);
setMood(qs.get('mood') || 'idle');
setWeather(qs.get('weather') || 'none');
setBrightness(qs.get('brightness') ?? '100');

window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;

    if (e.data.type === 'macs:mood') {
        setMood(e.data.mood || 'idle');
        return;
    }
    if (e.data.type === 'macs:weather') {
        setWeather(e.data.weather || 'none');
        return;
    }
    if (e.data.type === 'macs:brightness') {
        setBrightness(e.data.brightness ?? '100');
        return;
    }
});