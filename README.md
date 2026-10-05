# SimPal — Laundry weather

A small portfolio project built with HTML, CSS and plain JavaScript. It turns OpenWeather's five-day forecast into practical suggestions for hanging washing outside.

## Features

- Search for a city and choose between matching locations.
- Compare drying opportunities using rain probability, humidity, temperature and wind.
- Explore each day's forecast in three-hour steps, with daytime and nighttime weather icons.
- See an early laundry opportunity when a wet spell is forecast afterwards.
- Save recent cities in the browser and explore clearly labelled sample data with the demo button.
- Use a responsive layout with hover and keyboard focus states.

## Branches

- `main`: the original weather dashboard, preserved.
- `updated2026`: this updated version, intended for deployment.

## Deploy from GitHub to Cloudflare

No local server or local testing setup is required for this workflow.

1. Create a normal Cloudflare account and keep the **Workers Free** plan.
2. In **Workers & Pages**, create a Worker by importing this GitHub repository.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Worker name | `simpal-laundry-dashboard` |
| Repository | `Majid-pkz/Simpal-Weather-Dashboard` |
| Production branch | `updated2026` |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

4. Deploy. The demo works immediately; live searches need the secret below.
5. Open the Worker's **Settings → Variables and Secrets**, add a **Secret** named `OPENWEATHER_API_KEY`, paste your active OpenWeather key as its value, and save/deploy the change. This must be a runtime secret, rather than a build-only variable.
6. Open the generated `workers.dev` address and search for a city. Future pushes to `updated2026` automatically deploy through the GitHub connection.

A purchased domain is optional. Cloudflare hosts both the website and the small weather request handler in this one Worker.

## Main files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Appearance and responsive layout |
| `script.js` | Search, API requests, DOM updates and laundry scoring |
| `weather-api.js` | JavaScript run by Cloudflare; requests OpenWeather using the private secret |
| `wrangler.toml` | Cloudflare deployment settings |
| `package.json` | Commands and deployment tool dependency |
| `scripts/build-public.js` | Copies the three frontend files into the generated `public` directory |

The browser requests `/api/locations` and `/api/weather` on the website's own domain. Cloudflare adds the API key to its OpenWeather request and returns the necessary weather data. Visitors do not enter an API key.

## Forecast limitations

OpenWeather returns three-hour forecast points covering about five days, which may touch six calendar dates. Times use the city's UTC offset. Partial days and daylight-saving changes can affect displayed windows.

Laundry suggestions use simple planning rules, not a scientific drying model. A candidate window needs consecutive dry daytime points with low rain probability, temperatures above 5°C and moderate wind. The score favours lower humidity, warmer air and a gentle breeze. Forecasts can change; fabric, shade and airflow also affect drying.

The handler caches forecasts for ten minutes and city results for a day, with per-visitor and per-location upstream request limits. These reduce repeated API calls; they do not guarantee a global provider quota.

## References

- [OpenWeather five-day forecast](https://openweathermap.org/forecast5)
- [OpenWeather geocoding](https://openweathermap.org/api/geocoding-api)
- [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Cloudflare runtime secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
