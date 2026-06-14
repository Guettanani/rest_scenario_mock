from fastapi.testclient import TestClient

from vr_scenario_lib.rest_server import app

client = TestClient(app)


def test_get_scenarios():
    """Test l'endpoint pour récupérer la liste des scénarios."""
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200

    data = response.json()
    # Vérifie que la réponse contient bien la clé "scenarios" sous forme de liste
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)


def test_get_scenario_by_name():
    """Test l'endpoint pour récupérer un scénario par son nom."""
    # Remplacez "mise-en-bypass-gazfio" par un nom de scénario valide
    scenario_name = "mise-en-bypass-gazfio"
    response = client.get(f"/scenarios/{scenario_name}")
    if response.status_code == 200:
        data = response.json()
        assert data["name"] == scenario_name
    else:
        # Si le scénario n'existe pas, vérifiez que le code d'erreur est correct
        assert response.status_code == 404


def test_health_check():
    """Test l'endpoint de vérification de santé."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in ["healthy", "SERVING", "NOT_SERVING"]
