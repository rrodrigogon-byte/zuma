from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise SystemExit(f"PyYAML não disponível: {exc}")

path = Path(__file__).resolve().parents[1] / "cloudbuild.yaml"
data = yaml.safe_load(path.read_text())
assert isinstance(data, dict), "cloudbuild.yaml precisa ser um mapa"
assert data.get("substitutions", {}).get("_REGION") == "us-central1"
assert data.get("substitutions", {}).get("_SERVICE_NAME") == "kytto-erp"
assert data.get("substitutions", {}).get("_IMAGE_NAME") == "app"
steps = data.get("steps", [])
assert any(step.get("id") == "deploy-cloud-run" for step in steps)
assert any(step.get("id") == "verify-health" for step in steps)
text = path.read_text()
assert "setpoint-ultra" not in text
assert "southamerica-east1" not in text
print("cloudbuild.yaml: YAML válido e alinhado a kytto-erp/us-central1")
