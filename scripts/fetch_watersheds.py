"""Download City of Austin watershed boundaries as GeoJSON.

    python scripts/fetch_watersheds.py
    python scripts/build_data.py      # picks up data/raw/watersheds.geojson

Source: City of Austin Watershed Protection Department, "Watershed Boundaries" layer
(used in the department's public Watershed Protection web map). Please credit the department.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYER = ("https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/"
         "INLANDWATERS_watershed_low_flow/FeatureServer/0/query")
PARAMS = {"where": "1=1", "outFields": "WATERSHED_FULL_NAME,DISPLAY_NAME", "returnGeometry": "true",
          "outSR": "4326", "geometryPrecision": "5", "maxAllowableOffset": "0.0003", "f": "geojson"}


def main():
    url = LAYER + "?" + urllib.parse.urlencode(PARAMS)
    with urllib.request.urlopen(url, timeout=120) as response:
        data = json.load(response)
    features = [f for f in data.get("features", []) if f.get("geometry")]
    if len(features) < 50:
        raise SystemExit(f"Only {len(features)} watersheds downloaded; the layer may have moved.")
    for f in features:
        p = f["properties"]
        # Full names ("Barton Creek") read better than the short display names ("Barton").
        f["properties"] = {"name": " ".join((p.get("WATERSHED_FULL_NAME") or p.get("DISPLAY_NAME")).split())}
    out = ROOT / "data/raw/watersheds.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"Saved {out} ({len(features)} watersheds)")


if __name__ == "__main__":
    main()
