// Cloudflare runs this JavaScript to handle weather requests.
// Only these two fixed OpenWeather endpoints can be called by visitors.
const ROUTES = new Set(['/api/locations', '/api/weather']);
const FORECAST_TTL = 600;
const LOCATION_TTL = 86400;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...extra }
  });
}
function error(message, status, extra) { return json({ error: message }, status, extra); }
function coordinate(value, max) {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) && Math.abs(result) <= max ? result.toFixed(4) : null;
}
function validate(url) {
  const parameters = url.searchParams;
  const allowed = url.pathname === '/api/locations' ? ['city'] : ['lat', 'lon'];
  if ([...parameters.keys()].some(key => !allowed.includes(key) || parameters.getAll(key).length !== 1)) return null;
  if (url.pathname === '/api/locations') {
    const city = (parameters.get('city') || '').trim().replace(/\s+/g, ' ');
    if (!city || city.length > 100 || /[\u0000-\u001f\u007f]/.test(city)) return null;
    return { path: 'geo/1.0/direct', params: { q: city, limit: '5' },
      key: `locations:${city.toLowerCase()}`, ttl: LOCATION_TTL };
  }
  const lat = coordinate(parameters.get('lat'), 90);
  const lon = coordinate(parameters.get('lon'), 180);
  if (lat === null || lon === null) return null;
  return { path: 'data/2.5/forecast', params: { lat, lon, units: 'metric' },
    key: `forecast:${lat},${lon}`, ttl: FORECAST_TTL };
}
function cleanLocations(data) {
  if (!Array.isArray(data)) throw new Error('Invalid upstream data');
  return data.filter(city => typeof city?.name === 'string' && Number.isFinite(city.lat)
    && Number.isFinite(city.lon) && Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180)
    .slice(0, 5).map(city => ({ name: city.name, country: city.country || '',
      ...(typeof city.state === 'string' ? { state: city.state } : {}), lat: city.lat, lon: city.lon }));
}
function cleanForecast(data) {
  if (!Number.isFinite(data?.city?.timezone) || !Array.isArray(data.list) || !data.list.length
    || data.list.some(p => !Number.isFinite(p.dt) || !Number.isFinite(p.main?.temp)
      || !Number.isFinite(p.main?.humidity) || !Number.isFinite(p.wind?.speed))) {
    throw new Error('Invalid upstream data');
  }
  // Keep only weather fields that the dashboard needs. Never forward an error
  // payload, arbitrary provider fields, request URLs or the service's API key.
  return { city: { name: data.city.name, country: data.city.country, timezone: data.city.timezone },
    list: data.list.map(p => ({ dt: p.dt,
      main: { temp: p.main.temp, humidity: p.main.humidity },
      wind: { speed: p.wind.speed, ...(Number.isFinite(p.wind.gust) ? { gust: p.wind.gust } : {}) },
      ...(Number.isFinite(p.pop) ? { pop: p.pop } : {}),
      weather: (Array.isArray(p.weather) ? p.weather : []).slice(0, 1).map(w => ({
        id: w.id, main: w.main, description: w.description, icon: w.icon })),
      ...(p.sys?.pod === 'd' || p.sys?.pod === 'n' ? { sys: { pod: p.sys.pod } } : {}),
      ...(Number.isFinite(p.rain?.['3h']) ? { rain: { '3h': p.rain['3h'] } } : {}),
      ...(Number.isFinite(p.snow?.['3h']) ? { snow: { '3h': p.snow['3h'] } } : {})
    })) };
}

export async function handleRequest(request, env, context = {}, dependencies = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  }
  if (!ROUTES.has(url.pathname)) return error('Endpoint not found.', 404);
  if (request.method !== 'GET') return error('Use GET for weather searches.', 405, { Allow: 'GET' });
  // No public CORS permission. Block cross-site browser requests. This is not a
  // substitute for rate limits; non-browser clients can still call public APIs.
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return error('Please search from the dashboard.', 403);
  }
  const options = validate(url);
  if (!options) return error('Enter a valid city or valid latitude and longitude.', 400);
  const apiKey = typeof env.OPENWEATHER_API_KEY === 'string' ? env.OPENWEATHER_API_KEY.trim() : '';
  if (!apiKey || apiKey === 'PASTE_YOUR_NEW_KEY_HERE') {
    return error('Live weather is not available yet. You can explore the demo.', 503);
  }
  // Fail closed when a deployment omits the rate-limit bindings.
  if (!env.WEATHER_RATE_LIMITER?.limit || !env.UPSTREAM_RATE_LIMITER?.limit) {
    return error('Live weather is temporarily unavailable. Please try again later.', 503);
  }
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.WEATHER_RATE_LIMITER.limit({ key: `visitor:${ip}` });
    if (!success) return error('Too many searches. Please wait a minute and try again.', 429, { 'Retry-After': '60' });
    const cache = dependencies.cache || globalThis.caches?.default;
    // Cache identity contains no key and is scoped to this deployment's host.
    const cacheURL = new URL('/__weather_cache/' + encodeURIComponent(options.key), url.origin);
    const cacheRequest = new Request(cacheURL);
    let cached;
    try { cached = cache && await cache.match(cacheRequest); } catch { /* Continue if cache is unavailable. */ }
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('Cache-Control', 'no-store'); headers.set('X-Weather-Cache', 'HIT');
      return new Response(cached.body, { headers });
    }
    // This shared limit applies to cache misses per Cloudflare location. It is
    // an additional guard, not a global OpenWeather-account quota guarantee.
    const upstreamLimit = await env.UPSTREAM_RATE_LIMITER.limit({ key: 'openweather' });
    if (!upstreamLimit.success) return error('Weather requests are busy. Please wait a minute and try again.', 429, { 'Retry-After': '60' });
    const upstreamURL = new URL('https://api.openweathermap.org/' + options.path);
    upstreamURL.search = new URLSearchParams({ ...options.params, appid: apiKey });
    const fetcher = dependencies.fetch || globalThis.fetch;
    const response = await fetcher(upstreamURL, { signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' }, redirect: 'error' });
    if (!response.ok) {
      if (response.status === 429) return error('The weather service is busy. Please try again later.', 429, { 'Retry-After': '60' });
      // The raw error could echo credentials, so it is never returned or logged.
      return error('Live weather is temporarily unavailable. Please try again later.', 502);
    }
    const raw = await response.json();
    const data = url.pathname === '/api/locations' ? cleanLocations(raw) : cleanForecast(raw);
    const result = json(data, 200, { 'X-Weather-Cache': 'MISS' });
    if (cache) {
      const cachedResponse = result.clone();
      cachedResponse.headers.set('Cache-Control', `public, max-age=${options.ttl}`);
      const write = cache.put(cacheRequest, cachedResponse).catch(() => {});
      if (context.waitUntil) context.waitUntil(write); else await write;
    }
    return result;
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return error('The weather service took too long to respond. Please try again.', 504);
    }
    return error('Could not load live weather. Please try again later.', 502);
  }
}

export default { fetch: handleRequest };
