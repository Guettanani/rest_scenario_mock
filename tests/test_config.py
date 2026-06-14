import pytest

from vr_scenario_lib.config import Config


def test_config_loading():
    """Test que la configuration peut être chargée correctement."""
    config = Config()
    assert config is not None
    assert hasattr(config, 'model_name')
    assert hasattr(config, 'vector_store_path')
    assert hasattr(config, 'scenarios_path')
