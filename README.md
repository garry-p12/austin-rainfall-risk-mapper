# Austin Rainfall Risk Mapper

An interactive map of where heavy rain hits hardest in Austin, by council district, built from
Hyojeong Choi's analysis of AORC hourly rainfall (2000–2024) at the TE(x)US Lab, UT Austin.

**Live site:** https://garry-p12.github.io/austin-rainfall-risk-mapper/

Two ways to look at the data:

- **Storm direction.** For storms arriving from each of 8 directions, how intense the heaviest
  1–6 hour rain was in each district compared with the regional average for the same storm.
  Shown per district or per ~1 km grid cell.
- **Time of day and urban heat.** How often each district was one of the 3 hardest-hit
  districts, for day and night storms under strong, moderate and weak urban heat islands.

Also: when storms from each direction arrive (month and time of day), "Find my district" from
the browser's location (computed on the page, never sent anywhere), hover values for grid cells,
and links that open the exact view you are looking at.

## Run it

Needs Node 18+ and Python 3.10+.

```bash
npm install
python3 -m venv .venv && source .venv/bin/activate   # only needed to rebuild data
pip install -r requirements.txt
npm run data                      # data/raw -> public/data (already built; rerun after new results)
npm run dev                       # http://localhost:5173
npm test                          # unit tests for buildView() and the shipped data
```

Build a static site for hosting (GitHub Pages, a UT server, Netlify, etc.):

```bash
npm run build                     # output in dist/
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: install, `npm test`, `npm run build`,
then publish `dist/` to GitHub Pages. A failing test stops the deploy. The data in `public/data/`
is committed, so the workflow needs no Python or raw research files.

## Update the data

1. Put Hyojeong's new files in `data/raw/`:
   `directional_relative_concentration.npz` and `final_event_directions_1792.csv`
   (the script checks that their storm counts agree), plus `object_summary.csv` and
   `events_direction.csv` from her storm tracking (used for the storm calendar).
2. Optional, for full-detail district boundaries: `python scripts/fetch_districts.py`.
3. `npm run data` (with the `.venv` active), then `npm test`, then reload the app.

`data/raw/uhi_top3.json` holds the day/night × urban heat values. They were transcribed from the
Aug 20 meeting figure; replace them with her results table when available.

## Forecast prototype (branch `forecast-prototype`, not deployed)

A third view, "Rain forecast", shows ChangJae's RRFS severity per district for forecast days 1–3:
the heaviest 24-hour rain forecast in the district divided by the NOAA Atlas 14 1-year, 24-hour
depth (1.00× = a 1-year storm). It uses one sample run (issued 2026-10-01 00 UTC) and says so on
the page. The view appears only when `public/data/forecast.json` exists.

```bash
npm run forecast -- data/raw/rrfs_district_severity_2026100100.geojson   # -> public/data/forecast.json
```

Open questions before it can go live: how often runs arrive and from where, whether day 1 starts at
the issue time (assumed), and sign-off to publish a forecast.

## Project layout

```
scripts/build_data.py      raw research outputs -> small files in public/data/
scripts/fetch_districts.py download detailed council district boundaries
data/raw/                  research inputs (not committed; see .gitignore)
public/data/               files the app loads
src/lib/view.js            all numbers and wording for the current selection (pure function)
src/lib/view.test.js       Vitest tests: small fixture + every choice on the shipped data
src/lib/scales.js          color classes for both measures
src/components/            ConditionPanel, RiskMap (MapLibre), Legend, ComparisonTable, DistrictPanel
```

Basemap: OpenFreeMap "dark" vector style (OpenStreetMap data), no API key needed. CARTO tiles
were dropped in Nov 2026 because they began requiring an API key.
This is a research product, not an official flood warning.
