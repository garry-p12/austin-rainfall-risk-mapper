# Austin Rainfall Risk Mapper

An interactive map of where heavy rain hits hardest in Austin, by council district, built from
Hyojeong Choi's analysis of AORC hourly rainfall (2000–2024) at the TE(x)US Lab, UT Austin.

Two ways to look at the data:

- **Storm direction.** For storms arriving from each of 8 directions, how intense the heaviest
  1–6 hour rain was in each district compared with the regional average for the same storm.
  Shown per district or per ~1 km grid cell.
- **Time of day and urban heat.** How often each district was one of the 3 hardest-hit
  districts, for day and night storms under strong, moderate and weak urban heat islands.

## Run it

Needs Node 18+ and Python 3.10+.

```bash
npm install
pip install -r requirements.txt   # only needed to rebuild data
npm run data                      # data/raw -> public/data (already built; rerun after new results)
npm run dev                       # http://localhost:5173
```

Build a static site for hosting (GitHub Pages, a UT server, Netlify, etc.):

```bash
npm run build                     # output in dist/
```

## Update the data

1. Put Hyojeong's new files in `data/raw/`:
   `directional_relative_concentration.npz` and `final_event_directions_1792.csv`
   (the script checks that their storm counts agree).
2. Optional, for full-detail district boundaries: `python scripts/fetch_districts.py`.
3. `npm run data`, then reload the app.

`data/raw/uhi_top3.json` holds the day/night × urban heat values. They were transcribed from the
Aug 20 meeting figure; replace them with her results table when available.

## Project layout

```
scripts/build_data.py      raw research outputs -> small files in public/data/
scripts/fetch_districts.py download detailed council district boundaries
data/raw/                  research inputs (not committed; see .gitignore)
public/data/               files the app loads
src/lib/view.js            all numbers and wording for the current selection (pure function)
src/lib/scales.js          color classes for both measures
src/components/            ConditionPanel, RiskMap (MapLibre), Legend, ComparisonTable, DistrictPanel
```

Basemap: CARTO dark tiles (OpenStreetMap data), no API key needed.
This is a research product, not an official flood warning.
