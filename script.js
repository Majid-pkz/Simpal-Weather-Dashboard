'use strict';

// Plain JavaScript. OpenWeather returns 40 forecast points, spaced three hours apart.
// These thresholds are transparent product heuristics, not a drying-time model.
const RULES = Object.freeze({ maxPop: 0.2, minTemp: 5, maxWind: 30, maxGust: 45 });
const HOUR = 3600;
const localDate = (dt, offset) => new Date((dt + offset) * 1000);
const dateKey = (dt, offset) => localDate(dt, offset).toISOString().slice(0, 10);
const timeLabel = (dt, offset) => localDate(dt, offset).toLocaleTimeString('en-AU', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
const dayLabel = key => new Date(key + 'T12:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', weekday: 'long' });
const shortDate = key => new Date(key + 'T12:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const windKmh = point => point.wind.speed * 3.6;
const wet = point => (point.rain?.['3h'] || 0) > 0 || (point.snow?.['3h'] || 0) > 0 || /Rain|Drizzle|Snow|Thunderstorm/.test(point.weather?.[0]?.main || '');
const usable = point => Number.isFinite(point.pop) && point.pop <= RULES.maxPop && !wet(point) && point.main.temp > RULES.minTemp && windKmh(point) < RULES.maxWind && (!Number.isFinite(point.wind.gust) || point.wind.gust * 3.6 < RULES.maxGust);
function pointScore(point) {
  return (1 - point.pop) * 45 + (100 - point.main.humidity) * .3 + Math.min(30, Math.max(0, point.main.temp)) * .5 + (windKmh(point) >= 4 && windKmh(point) <= 20 ? 10 : 0);
}
function bestWindow(points) {
  const runs = []; let run = [];
  for (const point of points) {
    if (!usable(point)) { if (run.length) runs.push(run); run = []; continue; }
    if (run.length && point.dt - run.at(-1).dt !== 3 * HOUR) { runs.push(run); run = []; }
    run.push(point);
  }
  if (run.length) runs.push(run);
  return runs.filter(r => r.length >= 2).map(points => ({ points, start: points[0].dt, end: points.at(-1).dt, score: mean(points.map(pointScore)) + Math.min(9, (points.length - 1) * 3) })).sort((a, b) => b.score - a.score || a.start - b.start)[0] || null;
}
function analyseForecast(data, now = Date.now() / 1000) {
  const offset = data.city.timezone;
  const future = data.list.filter(p => p.dt >= now).sort((a, b) => a.dt - b.dt);
  const groups = new Map();
  for (const point of future) {
    const key = dateKey(point.dt, offset);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  }
  const days = [...groups].map(([key, points]) => {
    const daytime = points.filter(p => {
      const hour = localDate(p.dt, offset).getUTCHours() + localDate(p.dt, offset).getUTCMinutes() / 60;
      return hour >= 8 && hour <= 18 && p.sys?.pod !== 'n';
    });
    const window = bestWindow(daytime);
    const full = daytime.length >= 3 && daytime.at(-1).dt - daytime[0].dt >= 6 * HOUR;
    const quality = !daytime.length ? 'Limited data' : window ? (mean(window.points.map(p => p.main.humidity)) <= 75 && mean(window.points.map(p => p.main.temp)) >= 12 ? 'Favourable' : 'Mixed') : 'Poor';
    // Only call a day persistently wet when several daytime points support it.
    const persistentlyWet = full && !window && daytime.every(p => wet(p) || (Number.isFinite(p.pop) && p.pop >= .5));
    return { key, points, daytime, window, quality, full, persistentlyWet };
  });
  const best = days.filter(d => d.window && d.quality === 'Favourable').sort((a, b) => b.window.score - a.window.score || a.window.start - b.window.start)[0] || null;
  return { days, best, future, offset };
}
function wetSpellMessage(days) {
  for (let i = 0; i < days.length - 2; i++) {
    if (days[i].quality !== 'Favourable') continue;
    let count = 0;
    for (let j = i + 1; j < days.length; j++) {
      const gap = (Date.parse(days[j].key) - Date.parse(days[j - 1].key)) / 86400000;
      if (gap !== 1 || !days[j].persistentlyWet) break;
      count++;
    }
    if (count >= 2) return `Plan ahead: ${dayLabel(days[i].key)} has a promising window, followed by ${count} days with wet conditions across the available daytime forecast points. Consider getting your washing done before then.`;
  }
  return '';
}
// Use the provider's icon code, including its day/night suffix. Never infer
// daylight from the viewer's clock: the forecast may be for another country.
const ICON_CODE = /^(01|02|03|04|09|10|11|13|50)[dn]$/;
function weatherIconInfo(point) {
  const weather = point.weather?.[0] || {};
  let code = ICON_CODE.test(weather.icon || '') ? weather.icon : null;
  const period = code ? code.slice(-1) : ['d', 'n'].includes(point.sys?.pod) ? point.sys.pod : null;

  // Fallback for incomplete responses. Without a known day/night flag, do not
  // guess a sun or moon. Visible condition text remains available in every case.
  if (!code && period) {
    const id = weather.id;
    let group = null;
    if (id === 800 || weather.main === 'Clear') group = '01';
    else if (id === 801) group = '02';
    else if (id === 802) group = '03';
    else if (id === 803 || id === 804 || weather.main === 'Clouds') group = '04';
    else if (id === 511 || weather.main === 'Snow') group = '13';
    else if (weather.main === 'Thunderstorm') group = '11';
    else if (weather.main === 'Drizzle' || [520, 521, 522, 531].includes(id)) group = '09';
    else if (weather.main === 'Rain') group = '10';
    else if (['Mist', 'Smoke', 'Haze', 'Dust', 'Fog', 'Sand', 'Ash', 'Squall', 'Tornado'].includes(weather.main)) group = '50';
    if (group) code = group + period;
  }

  const description = typeof weather.description === 'string' && weather.description.trim()
    ? weather.description.trim() : weather.main || 'Weather unavailable';
  const periodName = period === 'n' ? 'night' : period === 'd' ? 'day' : '';
  const group = code?.slice(0, 2);
  const fallback = group === '01' ? (period === 'n' ? '🌙' : '☀️')
    : group === '02' ? (period === 'n' ? '🌙 ☁️' : '🌤️')
    : ({ '03': '☁️', '04': '☁️', '09': '🌧️', '10': '🌧️', '11': '⛈️', '13': '❄️', '50': '🌫️' }[group] || '—');
  return { code, description, label: `${description}${periodName ? ' · ' + periodName : ''}`, fallback,
    url: code ? `https://openweathermap.org/payload/api/media/file/${code}.png` : null };
}

function createWeatherIcon(point, className = '') {
  const info = weatherIconInfo(point);
  const wrapper = document.createElement('span');
  wrapper.className = `weather-symbol ${className}`.trim();
  wrapper.title = info.label;
  // Visible adjacent text describes the condition; the picture is decorative.
  wrapper.setAttribute('aria-hidden', 'true');
  if (!info.url) {
    wrapper.textContent = info.fallback;
    return wrapper;
  }
  const image = document.createElement('img');
  image.alt = '';
  image.width = 48;
  image.height = 48;
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => wrapper.replaceChildren(document.createTextNode(info.fallback)), { once: true });
  image.src = info.url;
  wrapper.append(image);
  return wrapper;
}

// A generated fixture, deliberately labelled DEMO throughout the interface.
function demoForecast() {
  const offset = 11 * HOUR;
  const start = Math.ceil(Date.now() / 1000 / (3 * HOUR)) * 3 * HOUR;
  const firstKey = dateKey(start, offset);
  const list = Array.from({ length: 40 }, (_, i) => {
    const dt = start + i * 3 * HOUR;
    const day = Math.round((Date.parse(dateKey(dt, offset)) - Date.parse(firstKey)) / 86400000);
    const hour = localDate(dt, offset).getUTCHours();
    const rainy = day >= 2 && day <= 4;
    const pod = hour >= 7 && hour < 19 ? 'd' : 'n';
    return { dt, main: { temp: rainy ? 17 : 22 + (hour >= 11 && hour <= 17 ? 3 : 0), humidity: rainy ? 87 : day === 1 ? 48 : 60 }, wind: { speed: 3.2, gust: 5 }, pop: rainy ? .85 : .1, weather: [{ id: rainy ? 500 : 800, main: rainy ? 'Rain' : 'Clear', description: rainy ? 'light rain' : 'clear sky', icon: (rainy ? '10' : '01') + pod }], sys: { pod }, ...(rainy ? { rain: { '3h': 1.2 } } : {}) };
  });
  return { city: { name: 'Sydney', country: 'AU', timezone: offset }, list };
}

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let state = null;
  let controller = null;
  let requestId = 0;
  let history = [];
  try { const saved = JSON.parse(localStorage.getItem('simpal-laundry-history') || '[]'); if (Array.isArray(saved)) history = saved.filter(v => typeof v === 'string').slice(0, 5); } catch { /* Storage can be blocked. */ }
  function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
  function renderHistory() {
    $('history').replaceChildren();
    for (const city of history) {
      const button = node('button', city, 'chip'); button.type = 'button';
      button.addEventListener('click', () => { $('city-input').value = city; search(city); });
      $('history').append(button);
    }
  }
  function remember(query) {
    history = [query, ...history.filter(c => c.toLowerCase() !== query.toLowerCase())].slice(0, 5);
    try { localStorage.setItem('simpal-laundry-history', JSON.stringify(history)); } catch { /* Continue without storage. */ }
    renderHistory();
  }
  async function getJSON(path, params, signal) {
    const url = new URL(path, window.location.origin);
    url.search = new URLSearchParams(params);
    const response = await fetch(url, { signal });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Live weather could not load. Please try again later.'); }
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Live weather is temporarily unavailable.');
    }
    return data;
  }
  async function search(query, chosen) {
    const id = ++requestId;
    controller?.abort(); controller = new AbortController();
    const activeController = controller;
    $('locations').replaceChildren(); $('dashboard').hidden = true;
    $('search-button').disabled = false; $('search-button').textContent = 'Find my forecast ↗';
    if (!query.trim()) { status('Enter a city name.', true); return; }
    $('search-button').disabled = true; $('search-button').textContent = 'Finding your forecast…';
    status('Checking the weather…');
    const timeout = setTimeout(() => activeController.abort(), 20000);
    try {
      let city = chosen;
      if (!city) {
        const matches = await getJSON('/api/locations', { city: query }, activeController.signal);
        if (id !== requestId) return;
        if (!Array.isArray(matches) || !matches.length) throw new Error('No matching city found. Try a city name followed by its country code, such as Sydney, AU.');
        if (matches.length > 1) {
          status('Choose the location you mean:');
          for (const match of matches) {
            const label = [match.name, match.state, match.country].filter(Boolean).join(', ');
            const button = node('button', label); button.type = 'button'; button.addEventListener('click', () => search(query, match)); $('locations').append(button);
          }
          return;
        }
        city = matches[0];
      }
      const forecast = await getJSON('/api/weather', { lat: city.lat, lon: city.lon }, activeController.signal);
      if (id !== requestId) return;
      if (!Array.isArray(forecast.list) || !forecast.list.length || !Number.isFinite(forecast.city?.timezone) || forecast.list.some(p => !Number.isFinite(p.dt) || !Number.isFinite(p.main?.temp) || !Number.isFinite(p.main?.humidity) || !Number.isFinite(p.wind?.speed))) throw new Error('The weather service returned incomplete data. Please try again later.');
      render(forecast, false, [city.name, city.state, city.country].filter(Boolean).join(', '));
      remember(query); status('Forecast loaded. Select a day below to see the details.');
    } catch (error) {
      if (id !== requestId) return;
      status(error.name === 'AbortError' ? 'The request timed out. Please try again.' : error instanceof TypeError ? 'Could not reach the weather service. Check your connection and try again.' : error.message, true);
    } finally {
      clearTimeout(timeout);
      if (id === requestId) { $('search-button').disabled = false; $('search-button').textContent = 'Find my forecast ↗'; }
    }
  }
  function peakPop(points) { return points.every(p => Number.isFinite(p.pop)) ? `${Math.round(Math.max(...points.map(p => p.pop)) * 100)}%` : 'unavailable'; }
  function windowText(window) { return `${timeLabel(window.start, state.offset)}–${timeLabel(window.end, state.offset)}`; }
  function render(data, demo, name) {
    state = analyseForecast(data);
    if (!state.future.length) throw new Error('No future forecast points available. Please refresh the forecast.');
    $('dashboard').hidden = false;
    $('data-mode').textContent = demo ? 'DEMO · SAMPLE DATA, NOT A REAL FORECAST' : 'LIVE OPENWEATHER FORECAST';
    $('location-name').textContent = name;
    $('coverage').textContent = `${shortDate(dateKey(state.future[0].dt, state.offset))}–${shortDate(dateKey(state.future.at(-1).dt, state.offset))} · City-local times`;
    const best = state.best;
    $('recommendation-title').textContent = best ? `${dayLabel(best.key)} looks promising.` : 'Keep your drying plans flexible.';
    $('recommendation-copy').textContent = best ? `Best available window: ${windowText(best.window)} on ${shortDate(best.key)}. Low precipitation risk across consecutive forecast points, with conditions that favour outdoor drying.` : 'No strong outdoor drying window stands out in the available forecast. Explore individual days for shorter or less favourable opportunities.';
    $('recommendation-metrics').replaceChildren();
    if (best) {
      const points = best.window.points;
      [`${peakPop(points)} peak rain chance`, `${Math.round(mean(points.map(p => p.main.humidity)))}% average humidity`, `${Math.round(mean(points.map(windKmh)))} km/h average wind`].forEach(text => $('recommendation-metrics').append(node('span', text)));
    }
    const next = state.future[0];
    $('weather-icon').replaceChildren(createWeatherIcon(next)); $('temperature').textContent = `${Math.round(next.main.temp)}°C`;
    $('weather-description').textContent = next.weather?.[0]?.description || 'Weather forecast';
    $('next-time').textContent = `${shortDate(dateKey(next.dt, state.offset))}, ${timeLabel(next.dt, state.offset)} · forecast, not current observation`;
    $('next-metrics').replaceChildren(node('span', `Humidity ${Math.round(next.main.humidity)}%`), node('span', `Wind ${Math.round(windKmh(next))} km/h`));
    const notice = wetSpellMessage(state.days); $('wet-notice').hidden = !notice; $('wet-notice').textContent = notice;
    $('day-cards').replaceChildren();
    for (const day of state.days) {
      const button = node('button', undefined, 'day-card'); button.type = 'button'; button.dataset.key = day.key; button.setAttribute('aria-pressed', 'false');
      button.append(node('span', day === best ? '✦ BEST OPPORTUNITY' : '\u00a0', 'best-mark'), node('span', dayLabel(day.key), 'day-name'), node('span', shortDate(day.key), 'day-date'));
      const representative = day.daytime[Math.floor(day.daytime.length / 2)] || day.points[0];
      const condition = weatherIconInfo(representative);
      const description = node('span', condition.description, 'condition-label');
      description.title = `Forecast at ${timeLabel(representative.dt, state.offset)} · ${condition.label}`;
      button.append(createWeatherIcon(representative, 'day-icon'), description);
      button.append(node('span', day.quality, `badge ${day.quality === 'Favourable' ? 'good' : day.quality === 'Mixed' ? 'mixed' : 'poor'}`));
      const points = day.daytime.length ? day.daytime : day.points;
      button.append(node('span', `${Math.round(Math.min(...points.map(p => p.main.temp)))}–${Math.round(Math.max(...points.map(p => p.main.temp)))}°C`, 'card-temp'), node('span', `${peakPop(points)} peak rain chance`, 'card-stat'), node('span', day.window ? windowText(day.window) : 'No qualifying window', 'card-stat'), node('span', day.full ? 'Daytime points available' : 'Partial daytime coverage', 'card-stat'));
      button.addEventListener('click', () => selectDay(day)); $('day-cards').append(button);
    }
    selectDay(best || state.days[0]);
  }
  function selectDay(day) {
    document.querySelectorAll('.day-card').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.key === day.key)));
    $('detail-title').textContent = `${dayLabel(day.key)}, ${shortDate(day.key)}`;
    $('day-explanation').textContent = day.window ? `${day.quality} conditions · Candidate window ${windowText(day.window)}. Highlighted points meet our rain, temperature and wind rules. ${day.quality === 'Mixed' ? 'Cooler or humid conditions may slow drying. ' : ''}Green points do not guarantee dry weather between forecasts.` : day.daytime.length ? 'No two consecutive daytime points meet all the drying rules. Rain risk, cold, wind or missing precipitation data may limit outdoor drying.' : 'Not enough remaining daytime data to assess a laundry window for this date.';
    $('timeline').replaceChildren();
    for (const point of day.points) {
      const inWindow = day.window && point.dt >= day.window.start && point.dt <= day.window.end;
      const item = node('div', undefined, `time-point${inWindow ? ' in-window' : ''}`);
      item.append(node('strong', timeLabel(point.dt, state.offset)), createWeatherIcon(point, 'point-icon'), node('span', weatherIconInfo(point).label, 'condition-label'), node('span', `${Math.round(point.main.temp)}°C`), node('span', `${Number.isFinite(point.pop) ? Math.round(point.pop * 100) + '%' : 'Unknown'} rain`), node('span', `${Math.round(point.main.humidity)}% humidity`), node('span', `${Math.round(windKmh(point))} km/h wind`));
      if (inWindow) item.append(node('span', '✓ In window'));
      $('timeline').append(item);
    }
  }
  function showDemo() { requestId++; controller?.abort(); $('locations').replaceChildren(); $('search-button').disabled = false; $('search-button').textContent = 'Find my forecast ↗'; render(demoForecast(), true, 'Sydney, AU · Demo'); status('You’re viewing illustrative sample data. Search for your city to load live weather.'); }
  $('search-form').addEventListener('submit', event => { event.preventDefault(); search($('city-input').value.trim()); });
  $('demo-button').addEventListener('click', showDemo);
  renderHistory(); showDemo();
}
if (typeof module !== 'undefined') module.exports = { analyseForecast, bestWindow, wetSpellMessage, demoForecast, dateKey, usable, weatherIconInfo, createWeatherIcon };
