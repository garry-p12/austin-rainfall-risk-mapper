"""Turn a district severity forecast GeoJSON (ChangJae's RRFS output) into public/data/forecast.json.

Input: one FeatureCollection with a feature per council district. Properties:
  district_name   "District 7"
  severity_day1   forecast 24-hour rain / NOAA Atlas 14 1-year 24-hour depth (max over the district)
  severity_day2, severity_day3, ...
and top-level metadata with model, issue_time (UTC), forecast_days, accumulation_hours.

Output (about 1 KB; the app already has the district shapes):
  {"model", "issue_time", "accumulation_hours", "severity_definition",
   "days": [{"day": 1, "start": ISO UTC, "end": ISO UTC}, ...],
   "districts": {"1": [day1, day2, day3], ...}}

Assumption until ChangJae confirms: day N covers issue_time + (N-1)*24 h to issue_time + N*24 h.

Run:  python scripts/build_forecast.py data/raw/rrfs_district_severity_2026100100.geojson
"""
import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build(src):
    gj = json.loads(Path(src).read_text())
    meta = gj["metadata"]
    days = meta["forecast_days"]
    hours = meta["accumulation_hours"]
    issued = datetime.fromisoformat(meta["issue_time"].replace("Z", "+00:00"))

    districts = {}
    for f in gj["features"]:
        props = f["properties"]
        number = int(re.fullmatch(r"District (\d+)", props["district_name"]).group(1))
        districts[str(number)] = [round(float(props[f"severity_day{d}"]), 3) for d in days]
    if sorted(map(int, districts)) != list(range(1, 11)):
        raise ValueError(f"Expected districts 1-10, found {sorted(map(int, districts))}")

    iso = lambda t: t.strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "model": meta["model"],
        "issue_time": iso(issued),
        "accumulation_hours": hours,
        "severity_definition": meta["severity_definition"],
        "days": [{"day": d, "start": iso(issued + timedelta(hours=hours * (d - 1))),
                  "end": iso(issued + timedelta(hours=hours * d))} for d in days],
        "districts": dict(sorted(districts.items(), key=lambda kv: int(kv[0]))),
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", default=ROOT / "public" / "data" / "forecast.json")
    args = ap.parse_args()
    out = build(args.src)
    Path(args.out).write_text(json.dumps(out, indent=1) + "\n")
    print(f"Wrote {args.out}: {out['model']} issued {out['issue_time']}, {len(out['days'])} days")
