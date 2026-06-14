import pytest
import json
from pathlib import Path
from vr_scenario_lib.scenario import Scenario

def test_scenario_loading():
    """Test qu'un scénario peut être chargé correctement."""
    # Charger un scénario de test
    scenario_path = Path("scenarios/mise-en-bypass-gazfio/session.json")
    if scenario_path.exists():
        with open(scenario_path, 'r', encoding='utf-8') as f:
            scenario_data = json.load(f)

        scenario = Scenario(scenario_data)
        assert scenario is not None
        assert hasattr(scenario, 'name')
        assert hasattr(scenario, 'description')
        assert hasattr(scenario, 'steps')
    else:
        pytest.skip("Fichier de scénario de test non trouvé")
