# import json
# from pathlib import Path

# import pytest

# from vr_scenario_lib.scenario import Scenario


# def test_scenario_loading():
#     """Test qu'un scénario peut être chargé correctement."""
#     # Charger un scénario de test
#     scenario_path = Path("scenarios/mise-en-bypass-gazfio/session.json")
#     if scenario_path.exists():
#         with open(scenario_path, 'r', encoding='utf-8') as f:
#             scenario_data = json.load(f)

#         scenario = Scenario(scenario_data)
#         assert scenario is not None
#         assert hasattr(scenario, 'name')
#         assert hasattr(scenario, 'description')
#         assert hasattr(scenario, 'steps')
#     else:
#         pytest.skip("Fichier de scénario de test non trouvé")


from unittest.mock import MagicMock, patch
from langchain_core.documents import Document
from vr_scenario_lib.scenario import (
    format_context,
    retrieve_context,
    generate_scenario,
    generate_narrative,
    discuss_scenario,
)
from vr_scenario_lib.config import build_llm_config
from vr_scenario_lib.scenario_store import ScenarioSession


def test_format_context():
    """Test le formatage des documents récupérés en une seule chaîne lisible."""
    docs = [
        Document(page_content="Consigne de sécurité R1.", metadata={"source": "doc1.pdf"}),
        Document(page_content="Consigne de bypass R3.", metadata={"source": "doc2.docx"}),
    ]
    formatted = format_context(docs)
    
    assert "[Source 1 — doc1.pdf]" in formatted
    assert "Consigne de sécurité R1." in formatted
    assert "[Source 2 — doc2.docx]" in formatted
    assert "Consigne de bypass R3." in formatted
    assert "---" in formatted


def test_retrieve_context():
    """Test de la récupération du contexte à travers le retriever."""
    mock_retriever = MagicMock()
    mock_docs = [Document(page_content="RAG context", metadata={"source": "rag.pdf"})]
    mock_retriever.invoke.return_value = mock_docs

    result = retrieve_context(mock_retriever, "fuite de gaz")
    
    assert len(result) == 1
    assert result[0].page_content == "RAG context"
    mock_retriever.invoke.assert_called_once_with("fuite de gaz")


@patch("vr_scenario_lib.scenario.call_llm")
def test_generate_scenario(mock_call_llm):
    """Test de la génération complète de scénario en simulant l'appel LLM."""
    mock_call_llm.return_value = "Scénario généré"
    mock_retriever = MagicMock()
    mock_docs = [Document(page_content="Info technique", metadata={"source": "spec.pdf"})]
    mock_retriever.invoke.return_value = mock_docs

    llm_config = build_llm_config(token="fake_token")

    scenario_text, docs = generate_scenario(
        topic="Démarrage bypass",
        retriever=mock_retriever,
        llm_config=llm_config,
        custom_prompt="Ajouter contrainte météo.",
    )

    assert scenario_text == "Scénario généré"
    assert len(docs) == 1
    mock_retriever.invoke.assert_called_once_with("Démarrage bypass")
    mock_call_llm.assert_called_once()


@patch("vr_scenario_lib.scenario.call_llm")
def test_generate_narrative(mock_call_llm):
    """Test de la génération du texte narratif pour l'annonce vocale."""
    mock_call_llm.return_value = "Bonjour et bienvenue dans la simulation VR..."
    
    llm_config = build_llm_config(token="fake_token")
    mock_scenario_dict = {"scenario_id": "test", "titre": "Scénario Test"}

    narrative = generate_narrative(mock_scenario_dict, llm_config)
    
    assert narrative == "Bonjour et bienvenue dans la simulation VR..."
    mock_call_llm.assert_called_once()


@patch("vr_scenario_lib.scenario.call_llm_messages")
def test_discuss_scenario_without_retriever(mock_call_llm_messages):
    """Test de la discussion d'un scénario existant (sans recherche RAG additionnelle)."""
    mock_call_llm_messages.return_value = "Réponse du formateur."
    
    session = ScenarioSession(
        scenario_id="test",
        scenario_text="Texte du scénario d'origine",
        history=[]
    )
    llm_config = build_llm_config(token="fake_token")

    reply = discuss_scenario(
        session=session,
        user_message="Que dois-je faire après R0 ?",
        llm_config=llm_config,
        retriever=None
    )

    assert reply == "Réponse du formateur."
    # L'historique doit contenir l'échange (1 entrée utilisateur et 1 entrée assistant)
    assert len(session.history) == 2
    assert session.history[0] == {"role": "user", "content": "Que dois-je faire après R0 ?"}
    assert session.history[1] == {"role": "assistant", "content": "Réponse du formateur."}
    mock_call_llm_messages.assert_called_once()