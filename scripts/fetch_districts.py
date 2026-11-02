"""Download full-detail City of Austin council district boundaries as GeoJSON.

The app ships with a simplified copy (data/raw/council_districts_simplified.geojson).
Run this once on a machine with internet access to replace it with the detailed version:

    python scripts/fetch_districts.py
    python scripts/build_data.py      # picks up council_districts.geojson automatically

Source: ArcGIS Online layer "Austin_Texas_Council_Districts_" (City of Austin boundaries).
The official open-data page is https://data.austintexas.gov/d/w3v2-cj58 if this layer moves.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYER = ("https://services1.arcgis.com/4ZKi1B1zTblbwgWB/ArcGIS/rest/services/"
         "Austin_Texas_Council_Districts_/FeatureServer/0/query")
PARAMS = {"where": "1=1", "outFields": "council_di", "returnGeometry": "true",
          "outSR": "4326", "f": "geojson"}


def main():
    url = LAYER + "?" + urllib.parse.urlencode(PARAMS)
    with urllib.request.urlopen(url, timeout=60) as response:
        data = json.load(response)
    features = data.get("features", [])
    numbers = sorted(int(f["properties"]["council_di"]) for f in features)
    if numbers != list(range(1, 11)):
        raise SystemExit(f"Unexpected districts in download: {numbers}")
    for f in features:
        f["properties"] = {"district": int(f["properties"]["council_di"])}
    out = ROOT / "data/raw/council_districts.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
