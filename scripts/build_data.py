"""Turn Hyojeong's research outputs into the small JSON/GeoJSON files the web app reads.

Inputs (default: data/raw/):
  directional_relative_concentration.npz  8 direction maps of relative rainfall
                                          concentration on the ~1 km AORC grid
  final_event_directions_1792.csv         one row per storm event with its direction
  council_districts*.geojson              City of Austin council district boundaries
  object_summary.csv                      hourly storm objects per event (tracking output),
                                          used for when each storm was over the city
  events_direction.csv                    per-event motion summary (median speed)
  uhi_top3.json (optional)                Top-3 shares by day/night x UHI class

Outputs (default: public/data/):
  districts.geojson        district polygons with a label point id
  district_labels.geojson  one point per district, placed well inside it
  direction_districts.json mean relative concentration per district and direction
  direction_grid.geojson   city grid cells with one value per direction
  direction_calendar.json  per direction: arrival month and hour (Austin time), speed, hours over city
  uhi_top3.json            copied through so the app has one data folder
  meta.json                storm counts, city averages, provenance

Run:  python scripts/build_data.py
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from shapely import contains_xy
from shapely.ops import polylabel
from shapely.geometry import box, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def load_districts(path):
    """Read district polygons keyed by district number (1-10)."""
    gj = json.loads(path.read_text())
    out = {}
    for feature in gj["features"]:
        props = feature["properties"]
        # The city layer has used several field names over time.
        number = next((props[k] for k in ("district", "council_di", "COUNCIL_DI", "council_district")
                       if k in props and props[k] is not None), None)
        if number is None:
            raise ValueError(f"No district number field in properties: {list(props)}")
        out[int(number)] = shape(feature["geometry"]).buffer(0)  # buffer(0) repairs invalid rings
    if sorted(out) != list(range(1, 11)):
        raise ValueError(f"Expected districts 1-10, found {sorted(out)}")
    return out


def storm_calendar(raw, events):
    """When storms from each direction reach the city, how fast they move, how long they stay.

    Arrival = first hourly time step at which any of the event's storm objects touches the city.
    AORC times are UTC; months and hours are converted to Austin local time (CST/CDT).
    """
    objs = pd.read_csv(raw / "object_summary.csv", usecols=["event_id", "time", "city_hit"])
    hit = objs[objs.city_hit.astype(str) == "True"]
    hit = hit[hit.event_id.isin(events.event_id)]
    per_event = hit.groupby("event_id").time.agg(first="min", hours="nunique")
    missing = set(events.event_id) - set(per_event.index)
    if missing:
        raise ValueError(f"{len(missing)} events have no city-hit hour in object_summary.csv, e.g. {sorted(missing)[:5]}")

    speed = pd.read_csv(raw / "events_direction.csv", usecols=["event_id", "speed_median_kmh"]).set_index("event_id")
    df = events.set_index("event_id").join(per_event).join(speed)
    if df.speed_median_kmh.isna().any():
        raise ValueError("Some events have no speed in events_direction.csv")
    local = pd.to_datetime(df["first"]).dt.tz_localize("UTC").dt.tz_convert("America/Chicago")
    df["month"], df["hour"] = local.dt.month, local.dt.hour

    def summarize(g):
        return {
            "n": int(len(g)),
            "months": [int(x) for x in g.month.value_counts().reindex(range(1, 13), fill_value=0)],
            "hours": [int(x) for x in g.hour.value_counts().reindex(range(24), fill_value=0)],
            "speed_kmh_median": round(float(g.speed_median_kmh.median()), 1),
            "hours_over_city_median": float(g.hours.median()),
        }

    out = {"timezone": "America/Chicago", "all": summarize(df)}
    out.update({d: summarize(df[df.final_direction == d]) for d in DIRECTIONS})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", type=Path, default=ROOT / "data/raw")
    parser.add_argument("--out", type=Path, default=ROOT / "public/data")
    parser.add_argument("--districts", type=Path, default=None,
                        help="District GeoJSON. Defaults to council_districts.geojson if present, "
                             "else council_districts_simplified.geojson")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    districts_path = args.districts or next(
        p for p in [args.raw / "council_districts.geojson", args.raw / "council_districts_simplified.geojson"]
        if p.exists())
    districts = load_districts(districts_path)

    # --- Direction maps -------------------------------------------------------
    with np.load(args.raw / "directional_relative_concentration.npz", allow_pickle=False) as z:
        means = z["mean_relative_concentration"]          # (8, lat, lon)
        lat, lon = z["latitude"], z["longitude"]          # cell centers, ascending
        dirs = [str(d) for d in z["directions"]]
        counts = z["event_count"].astype(int)
    if dirs != DIRECTIONS:
        # Reorder so every output uses the same direction order.
        order = [dirs.index(d) for d in DIRECTIONS]
        means, counts, dirs = means[order], counts[order], DIRECTIONS

    events = pd.read_csv(args.raw / "final_event_directions_1792.csv")
    event_counts = events.final_direction.value_counts().reindex(DIRECTIONS, fill_value=0)
    if not np.array_equal(event_counts.to_numpy(), counts):
        raise ValueError("Event counts in the CSV and the NPZ disagree; check both come from the same run.")

    # Assign each grid cell (by its center) to the district that contains it.
    lon2d, lat2d = np.meshgrid(lon, lat)
    owner = np.zeros(lat2d.shape, dtype=int)
    for number, geom in districts.items():
        owner[contains_xy(geom, lon2d, lat2d)] = number
    in_city = owner > 0

    # District value = plain mean of the cells whose centers fall inside it.
    by_district = {d: {str(n): round(float(means[i][owner == n].mean()), 4) for n in districts}
                   for i, d in enumerate(DIRECTIONS)}
    city_avg = {d: round(float(means[i][in_city].mean()), 4) for i, d in enumerate(DIRECTIONS)}

    # Grid cells as small polygons, one property per direction.
    half_lat = float(np.mean(np.diff(lat))) / 2
    half_lon = float(np.mean(np.diff(lon))) / 2
    cells = []
    for r, c in zip(*np.nonzero(in_city)):
        props = {"district": int(owner[r, c])}
        props.update({f"rc_{d}": round(float(means[i, r, c]), 3) for i, d in enumerate(DIRECTIONS)})
        geom = box(lon[c] - half_lon, lat[r] - half_lat, lon[c] + half_lon, lat[r] + half_lat)
        cells.append({"type": "Feature", "properties": props,
                      "geometry": json.loads(json.dumps(mapping(geom)), parse_float=lambda x: round(float(x), 5))})

    # --- District shapes and label points -------------------------------------
    district_features, label_features = [], []
    for number, geom in sorted(districts.items()):
        district_features.append({"type": "Feature", "id": number, "properties": {"district": number},
                                  "geometry": mapping(geom)})
        # Label at the pole of inaccessibility of the largest part, so it sits well inside.
        main = max(getattr(geom, "geoms", [geom]), key=lambda g: g.area)
        point = polylabel(main, tolerance=0.0005)
        label_features.append({"type": "Feature", "properties": {"district": number},
                               "geometry": {"type": "Point", "coordinates": [round(point.x, 5), round(point.y, 5)]}})

    def dump(name, obj):
        (args.out / name).write_text(json.dumps(obj, separators=(",", ":")))

    dump("districts.geojson", {"type": "FeatureCollection", "features": district_features})
    dump("district_labels.geojson", {"type": "FeatureCollection", "features": label_features})
    dump("direction_districts.json", by_district)
    dump("direction_grid.geojson", {"type": "FeatureCollection", "features": cells})
    dump("direction_calendar.json", storm_calendar(args.raw, events))

    uhi = args.raw / "uhi_top3.json"
    if uhi.exists():
        (args.out / "uhi_top3.json").write_text(uhi.read_text())

    all_bounds = np.array([g.bounds for g in districts.values()])
    bounds = [float(all_bounds[:, 0].min()), float(all_bounds[:, 1].min()),
              float(all_bounds[:, 2].max()), float(all_bounds[:, 3].max())]
    dump("meta.json", {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "directions": DIRECTIONS,
        "storm_counts": {d: int(n) for d, n in zip(DIRECTIONS, counts)},
        "total_storms": int(counts.sum()),
        "city_average": city_avg,
        "grid_cells_in_city": len(cells),
        "bounds": bounds,
        "districts_source": districts_path.name,
    })
    print(f"Wrote {args.out} ({len(cells)} grid cells, {int(counts.sum())} storms, districts from {districts_path.name})")


if __name__ == "__main__":
    main()
