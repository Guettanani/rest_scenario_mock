"""Tests pour le module prompts.py - Templates de prompts."""

from vr_scenario_lib.config import CORRESPONDANCE_OBJETS, JSON_SCHEMA_V2
from vr_scenario_lib.prompts import (
    build_announcement_prompt,
    build_json_conversion_prompt,
    build_scenario_prompt,
)


class TestBuildScenarioPrompt:
    """Tests pour build_scenario_prompt."""

    def test_contains_topic(self):
        """Test que le prompt contient le sujet."""
        topic = "Mise en bypass GAZFIO"
        context = "Contexte documentaire"
        prompt = build_scenario_prompt(topic, context)
        assert topic in prompt

    def test_contains_context(self):
        """Test que le prompt contient le contexte."""
        topic = "Test"
        context = "Consigne de sécurité R1"
        prompt = build_scenario_prompt(topic, context)
        assert context in prompt

    def test_contains_correspondance_objets(self):
        """Test que le prompt contient la table de correspondance."""
        prompt = build_scenario_prompt("Test", "Context")
        assert CORRESPONDANCE_OBJETS in prompt
        assert "R0" in prompt
        assert "R1" in prompt
        assert "VS_GAZFIO" in prompt

    def test_contains_structure_requirements(self):
        """Test que le prompt contient les exigences de structure."""
        prompt = build_scenario_prompt("Test", "Context")
        assert "CONFIGURATION INITIALE DU POSTE" in prompt
        assert "TYPE_POSTE" in prompt
        assert "METEO" in prompt
        assert "DEMANDE_CLIENT" in prompt
        assert "ÉTAPES DU SCÉNARIO" in prompt
        assert "CRITÈRES DE RÉUSSITE" in prompt

    def test_contains_maser_codes(self):
        """Test que le prompt contient les codes MASER."""
        prompt = build_scenario_prompt("Test", "Context")
        assert "GAZFIO" in prompt
        assert "FRANCEL" in prompt
        assert "J" in prompt
        assert "N" in prompt
        assert "JP" in prompt
        assert "NP" in prompt

    def test_empty_topic(self):
        """Test avec un sujet vide."""
        prompt = build_scenario_prompt("", "Context")
        assert "**" in prompt  # Le formatage markdown est présent

    def test_empty_context(self):
        """Test avec un contexte vide."""
        prompt = build_scenario_prompt("Test", "")
        assert "CONTEXTE DOCUMENTAIRE" in prompt


class TestBuildAnnouncementPrompt:
    """Tests pour build_announcement_prompt."""

    def test_contains_scenario(self):
        """Test que le prompt contient le scénario."""
        scenario = {"titre": "Test Scenario", "etapes": []}
        prompt = build_announcement_prompt(scenario)
        assert "Test Scenario" in prompt

    def test_contains_instructions(self):
        """Test que le prompt contient les instructions."""
        scenario = {"titre": "Test"}
        prompt = build_announcement_prompt(scenario)
        assert "texte narratif fluide" in prompt
        assert "pédagogique" in prompt
        assert "EPI obligatoires" in prompt
        assert "état initial" in prompt
        assert "critères de réussite" in prompt

    def test_contains_start_end_markers(self):
        """Test que le prompt contient les marqueurs de début et fin."""
        scenario = {"titre": "Test"}
        prompt = build_announcement_prompt(scenario)
        assert "Bienvenue dans ce scénario de formation" in prompt
        assert "Fin du scénario" in prompt

    def test_with_complex_scenario(self):
        """Test avec un scénario complexe."""
        scenario = {
            "scenario_id": "bypass-gazfio",
            "titre": "Mise en bypass GAZFIO",
            "etat_initial": {
                "TYPE_POSTE": "GAZFIO",
                "METEO": "J",
                "R0": {"STATUT": 1, "ETAT": 1},
            },
            "etapes": [
                {
                    "etape_id": 1,
                    "titre": "Ouverture R3",
                    "actions": [{"objet": "R3", "action": "ouvrir"}],
                }
            ],
        }
        prompt = build_announcement_prompt(scenario)
        assert "bypass-gazfio" in prompt
        assert "GAZFIO" in prompt
        assert "Ouverture R3" in prompt

    def test_json_formatting(self):
        """Test que le scénario est formaté en JSON."""
        scenario = {"key": "value"}
        prompt = build_announcement_prompt(scenario)
        assert "SCÉNARIO STRUCTURÉ" in prompt


class TestBuildJsonConversionPrompt:
    """Tests pour build_json_conversion_prompt."""

    def test_contains_scenario_text(self):
        """Test que le prompt contient le texte du scénario."""
        scenario_text = "Scénario de test pour conversion"
        prompt = build_json_conversion_prompt(scenario_text)
        assert scenario_text in prompt

    def test_contains_schema(self):
        """Test que le prompt contient le schéma JSON."""
        prompt = build_json_conversion_prompt("Test")
        assert JSON_SCHEMA_V2 in prompt
        assert "scenario_id" in prompt
        assert "etat_initial" in prompt
        assert "etapes" in prompt

    def test_contains_correspondance_objets(self):
        """Test que le prompt contient la table de correspondance."""
        prompt = build_json_conversion_prompt("Test")
        assert CORRESPONDANCE_OBJETS in prompt

    def test_contains_rules(self):
        """Test que le prompt contient les règles de conversion."""
        prompt = build_json_conversion_prompt("Test")
        assert "RÈGLES IMPORTANTES" in prompt
        assert "etat_initial" in prompt
        assert "etapes" in prompt
        assert "actions" in prompt
        assert "conditions_erreur" in prompt
        assert "MASER" in prompt

    def test_contains_response_format(self):
        """Test que le prompt spécifie le format de réponse."""
        prompt = build_json_conversion_prompt("Test")
        assert "UNIQUEMENT avec le JSON valide" in prompt
        assert "rien d'autre" in prompt

    def test_empty_scenario_text(self):
        """Test avec un texte de scénario vide."""
        prompt = build_json_conversion_prompt("")
        assert "SCÉNARIO À CONVERTIR" in prompt

    def test_multiline_scenario_text(self):
        """Test avec un texte de scénario multiligne."""
        scenario_text = """
        Étape 1: Ouvrir R3
        Étape 2: Fermer R1
        Étape 3: Vérifier pression
        """
        prompt = build_json_conversion_prompt(scenario_text)
        assert "Étape 1" in prompt
        assert "Étape 2" in prompt
        assert "Étape 3" in prompt
