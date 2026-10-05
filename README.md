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
| Project name | `simpal-laundry-dashboard` |
| Repository | `Majid-pkz/Simpal-Weather-Dashboard` |
| Path | Repository root (`/` in the setup form) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Enable Preview builds | Off |
| Protect with Cloudflare Access | Off |

4. Click **Deploy** to create the project. The current setup screen does not offer a branch selector. Cloudflare starts with the repository's default branch, `main`. Its initial build is expected to fail because the preserved original version has no `package.json`.
5. Open the Worker's **Settings → Build → Branch control**, select **`updated2026`** as the production branch, and save.
6. Push a new commit to `updated2026` to start a build from that branch. Every new push to the selected production branch triggers the build and deployment commands automatically. Check the new build's branch and commit in Cloudflare.
7. After the build succeeds, the demo works immediately. To enable live searches, open **Settings → Variables and Secrets**, add a **Secret** named `OPENWEATHER_API_KEY`, paste your active OpenWeather key as its value, and deploy the change. This must be a runtime secret, rather than a build-only variable.
8. Open the generated `workers.dev` address and search for a city.

Keep the automatically created Cloudflare deployment token in the setup form. It serves a different purpose from the OpenWeather key, which is added in step 7.

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
