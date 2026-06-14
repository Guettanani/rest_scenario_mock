# 📋 Plan d'actions — Audit `vr_scenario_lib_rest`

> Généré automatiquement à la suite de l'audit exhaustif du 2026-06-14.
> Chaque case à cocher `[ ]` représente une action individuelle à accomplir.

---

## 1. 🔴 Corrections bloquantes (Tests + CI)

- [ ] **T1** — `tests/test_config.py` : remplacer `from vr_scenario_lib.config import Config` par `from vr_scenario_lib.config import LLMConfig, build_llm_config`
- [ ] **T2** — `tests/test_config.py` : adapter le corps du test car `LLMConfig` est un `TypedDict`, pas une classe avec attributs (`model_name`, `vector_store_path`, etc. n'existent pas)
- [ ] **T3** — `tests/test_scenario.py` : remplacer `from vr_scenario_lib.scenario import Scenario` par `from vr_scenario_lib.scenario_store import ScenarioSession`
- [ ] **T4** — `tests/test_scenario.py` : adapter le corps du test car `ScenarioSession` nécessite `scenario_id`, `topic`, `scenario_text`, `scenario_json` (dataclass)
- [ ] **T5** — `tests/test_rest_server.py` : corriger `GET /scenarios` → `GET /api/v1/scenarios`
- [ ] **T6** — `tests/test_rest_server.py` : corriger `GET /scenarios/{name}` → `GET /api/v1/scenario/{scenario_id}`
- [ ] **T7** — `tests/test_rest_server.py` : corriger l'assertion `data["name"]` → `data["scenario_id"]` (ou `data["topic"]`)
- [ ] **T8** — `tests/test_rest_server.py` : corriger `response.json()["status"] == "healthy"` → `response.json()["status"] == "SERVING"`
- [ ] **T9** — `tests/test_rest_server.py` : wrapper l'instanciation de `TestClient` dans un `lifecycle` ou appeler `initialize_state()` dans un setup pour que `_server_state["initialized"]` soit `True`
- [ ] **T10** — Tous les tests : ajouter des `unittest.mock` / `pytest-mock` pour les appels LLM, embeddings et API externes (HF, OpenRouter)
- [ ] **T11** — `pytest.ini` : ajuster `--cov-fail-under=80` à un réaliste (ex: `20`) tant que la couverture n'est pas atteinte, ou supprimer la contrainte

---

## 2. 🔴 Corrections de sécurité

- [ ] **R6** — `vr_scenario_lib/vectorstore.py` ligne 383 : ajouter un `logger.warning()` explicite lors de l'utilisation de `allow_dangerous_deserialization=True`
- [ ] **R6b** — `vr_scenario_lib/vectorstore.py` : envisager de signer l'index FAISS avec HMAC pour détecter toute altération
- [ ] **SEC1** — `.env` : **RÉVOQUER IMMÉDIATEMENT** tous les tokens en clair dans le fichier `.env` (HF_TOKEN, OPENROUTER_API_KEY, OPENROUTER_EMBEDDING_API_KEY). Ces clés ne doivent **jamais** être versionnées.
- [ ] **SEC2** — `.env` : renommer `.env` en `.env.example` avec des valeurs factices et s'assurer que le `.gitignore` empêche tout fichier `.env*` d'être commit

---

## 3. 🔴 Corrections RAG (qualité & robustesse)

- [ ] **R5** — `vr_scenario_lib/config.py` lignes 212-217 : supprimer les doublons dans `DEFAULT_FALLBACK_EMBEDDING_MODELS` (`sentence-transformers/all-MiniLM-L6-v2` apparaît 3 fois). Remplacer par des modèles distincts et multilingues (ex: `intfloat/multilingual-e5-base`, `BAAI/bge-m3`)
- [ ] **R7** — `vr_scenario_lib/config.py` ligne 197 : remplacer le modèle d'embeddings par défaut `sentence-transformers/all-MiniLM-L6-v2` (anglais-centric) par un modèle multilingue comme `intfloat/multilingual-e5-base` ou `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- [ ] **R17** — `vr_scenario_lib/json_converter.py` ligne 23-42 : remplacer le parsing `clean.split("````")[1]` par une regex robuste : `re.search(r"````(?:json)?\s*([\s\S]*?)````", clean)`
- [ ] **R11** — `vr_scenario_lib/scenario.py` ligne 31 : migrer `retriever.invoke(topic)` vers `await retriever.ainvoke(topic)` dans un contexte async
- [ ] **R1b** — `README_CICD_GITHUB_ACTION.md` lignes 494-498 : **supprimer** le bloc d'avertissement sur `continue-on-errors` car le fichier `ci.yml` contient déjà la forme correcte `continue-on-error`

---
