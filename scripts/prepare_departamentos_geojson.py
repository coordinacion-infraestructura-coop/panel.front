"""Script one-off: reproyecta el GeoJSON de los 26 departamentos de Córdoba de
EPSG:22174 a WGS84 (lat/lon) y lo simplifica para servirlo como asset estático
del frontend (mapa coroplético de los informes por programa).

No se re-ejecuta en cada deploy — la cartografía de departamentos no cambia.
Fuente: proyecto_sistema_gestiones/informe/bq_views/departamentos.json
(mismo archivo que usa generar_informe_general.py de ese proyecto).

Uso:
    python frontend/scripts/prepare_departamentos_geojson.py
"""
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

FUENTE = (
    Path(__file__).resolve().parents[3]
    / "proyecto_sistema_gestiones" / "informe" / "bq_views" / "departamentos.json"
)
SALIDA = Path(__file__).resolve().parents[1] / "public" / "geo" / "departamentos_cba.json"
CRS_ORIGEN = "EPSG:22174"
SIMPLIFICAR = 0.001


def main() -> None:
    with open(FUENTE, "rb") as f:
        raw = json.loads(f.read().decode("utf-8"))

    transformer = Transformer.from_crs(CRS_ORIGEN, "EPSG:4326", always_xy=True)
    features = []
    for feat in raw["features"]:
        geom = shape(feat["geometry"])
        geom = shp_transform(transformer.transform, geom)
        geom = geom.simplify(SIMPLIFICAR, preserve_topology=True)
        features.append({
            "type": "Feature",
            "properties": {"nombre": feat["properties"]["nombre"]},
            "geometry": mapping(geom),
        })

    salida = {"type": "FeatureCollection", "features": features}
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))

    print(f"{len(features)} departamentos -> {SALIDA} ({SALIDA.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
