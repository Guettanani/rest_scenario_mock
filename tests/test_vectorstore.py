"""Tests pour le module vectorstore.py - Embeddings, FAISS et Retriever."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from vr_scenario_lib.vectorstore import (
    EmbeddingError,
    OpenRouterEmbeddings,
    build_vectorstore,
    create_embeddings,
    create_retriever,
    load_vectorstore,
    resolve_huggingface_inference_endpoint,
    save_vectorstore,
)


class TestResolveHuggingfaceInferenceEndpoint:
    """Tests pour resolve_huggingface_inference_endpoint."""

    def test_valid_url(self):
        """Test avec une URL valide."""
        result = resolve_huggingface_inference_endpoint(
            "https://api-inference.huggingface.co"
        )
        assert "api-inference.hf.co" in result

    def test_url_with_pipeline_path(self):
        """Test avec un chemin pipeline."""
        result = resolve_huggingface_inference_endpoint(
            "https://api-inference.huggingface.co/pipeline/feature-extraction"
        )
        assert result == "https://api-inference.hf.co"

    def test_none_url(self):
        """Test avec None - utilise la valeur par défaut."""
        with patch.dict(os.environ, {}, clear=True):
            result = resolve_huggingface_inference_endpoint(None)
            assert result == "https://api-inference.hf.co"

    def test_custom_url(self):
        """Test avec une URL personnalisée."""
        result = resolve_huggingface_inference_endpoint("https://custom.endpoint.com")
        assert result == "https://custom.endpoint.com"


class TestOpenRouterEmbeddings:
    """Tests pour OpenRouterEmbeddings."""

    def test_init(self):
        """Test l'initialisation."""
        embeddings = OpenRouterEmbeddings(
            model="text-embedding-3-large",
            api_key="test_key",
            api_url="https://openrouter.ai/api/v1/embeddings",
        )
        assert embeddings.model == "text-embedding-3-large"
        assert embeddings.api_key == "test_key"

    def test_embed_documents_success(self):
        """Test l'embedding de documents avec succès."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"embedding": [0.1, 0.2, 0.3]},
                {"embedding": [0.4, 0.5, 0.6]},
            ]
        }

        embeddings = OpenRouterEmbeddings(
            model="test-model",
            api_key="test_key",
            api_url="https://openrouter.ai/api/v1/embeddings",
        )

        with patch(
            "vr_scenario_lib.vectorstore.requests.Session"
        ) as mock_session_class:
            mock_session = MagicMock()
            mock_session.post.return_value = mock_response
            mock_session_class.return_value = mock_session

            result = embeddings.embed_documents(["text1", "text2"])
            assert len(result) == 2
            assert result[0] == [0.1, 0.2, 0.3]

    def test_embed_query(self):
        """Test l'embedding d'une seule requête."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": [{"embedding": [0.1, 0.2, 0.3]}]}

        embeddings = OpenRouterEmbeddings(
            model="test-model",
            api_key="test_key",
            api_url="https://openrouter.ai/api/v1/embeddings",
        )

        with patch(
            "vr_scenario_lib.vectorstore.requests.Session"
        ) as mock_session_class:
            mock_session = MagicMock()
            mock_session.post.return_value = mock_response
            mock_session_class.return_value = mock_session

            result = embeddings.embed_query("test query")
            assert result == [0.1, 0.2, 0.3]

    def test_embed_error_response(self):
        """Test une réponse d'erreur."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        embeddings = OpenRouterEmbeddings(
            model="test-model",
            api_key="invalid_key",
            api_url="https://openrouter.ai/api/v1/embeddings",
        )

        with patch(
            "vr_scenario_lib.vectorstore.requests.Session"
        ) as mock_session_class:
            mock_session = MagicMock()
            mock_session.post.return_value = mock_response
            mock_session_class.return_value = mock_session

            with pytest.raises(EmbeddingError, match="OpenRouter embeddings a échoué"):
                embeddings.embed_documents(["text"])


class TestCreateEmbeddings:
    """Tests pour create_embeddings."""

    def test_openrouter_provider_without_api_key(self):
        """Test qu'une erreur est levée sans clé API OpenRouter."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(EmbeddingError, match="clé API OpenRouter est requise"):
                create_embeddings(provider="openrouter")

    def test_openrouter_provider_with_api_key(self):
        """Test la création d'embeddings OpenRouter."""
        with patch.dict(os.environ, {"OPENROUTER_EMBEDDING_API_KEY": "test_key"}):
            with patch(
                "vr_scenario_lib.vectorstore.OpenRouterEmbeddings"
            ) as mock_embeddings:
                create_embeddings(provider="openrouter")
                mock_embeddings.assert_called_once()

    def test_huggingface_provider_without_api_key(self):
        """Test qu'une erreur est levée sans clé API HuggingFace."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(EmbeddingError, match="clé API HuggingFace est requise"):
                create_embeddings(provider="huggingface")

    def test_huggingface_provider_with_api_key(self):
        """Test la création d'embeddings HuggingFace."""
        with patch.dict(os.environ, {"HUGGINGFACE_API_KEY": "test_key"}):
            # HuggingFaceEndpointEmbeddings est importé dynamiquement dans le module
            with patch(
                "langchain_huggingface.HuggingFaceEndpointEmbeddings"
            ) as mock_embeddings:
                mock_embeddings.return_value = MagicMock(spec=Embeddings)
                result = create_embeddings(provider="huggingface")
                assert result is not None


class TestBuildVectorstore:
    """Tests pour build_vectorstore."""

    def test_empty_chunks(self):
        """Test qu'une erreur est levée si chunks est vide."""
        mock_embeddings = MagicMock(spec=Embeddings)
        with pytest.raises(ValueError, match="Aucun chunk à indexer"):
            build_vectorstore([], mock_embeddings)

    def test_successful_build(self):
        """Test la construction réussie d'un vectorstore."""
        docs = [
            Document(page_content="Test content 1", metadata={"source": "doc1.pdf"}),
            Document(page_content="Test content 2", metadata={"source": "doc2.pdf"}),
        ]

        mock_embeddings = MagicMock(spec=Embeddings)
        mock_embeddings.embed_documents.return_value = [[0.1, 0.2], [0.3, 0.4]]
        mock_embeddings.embed_query.return_value = [0.1, 0.2]

        with patch("vr_scenario_lib.vectorstore.FAISS") as mock_faiss:
            mock_vs = MagicMock()
            mock_vs.index.ntotal = 2
            mock_faiss.from_documents.return_value = mock_vs

            result = build_vectorstore(docs, mock_embeddings)
            assert result.index.ntotal == 2


class TestSaveLoadVectorstore:
    """Tests pour save_vectorstore et load_vectorstore."""

    def test_save_vectorstore(self):
        """Test la sauvegarde d'un vectorstore."""
        mock_vs = MagicMock()

        with tempfile.TemporaryDirectory() as tmpdir:
            save_vectorstore(mock_vs, tmpdir)
            mock_vs.save_local.assert_called_once_with(tmpdir)

    def test_load_vectorstore_not_exists(self):
        """Test le chargement quand le dossier n'existe pas."""
        result = load_vectorstore("/nonexistent/path", None)
        assert result is None

    def test_load_vectorstore_without_embeddings(self):
        """Test le chargement sans embeddings."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer un faux index
            Path(tmpdir, "index.faiss").write_bytes(b"fake")
            Path(tmpdir, "index.pkl").write_bytes(b"fake")

            result = load_vectorstore(tmpdir, None)
            assert result is None

    def test_load_vectorstore_success(self):
        """Test le chargement réussi d'un vectorstore."""
        mock_embeddings = MagicMock(spec=Embeddings)
        mock_embeddings.embed_query.return_value = [0.1, 0.2, 0.3]

        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer un faux index
            Path(tmpdir, "index.faiss").write_bytes(b"fake")
            Path(tmpdir, "index.pkl").write_bytes(b"fake")

            with patch("vr_scenario_lib.vectorstore.FAISS") as mock_faiss:
                mock_vs = MagicMock()
                mock_vs.index.ntotal = 10
                mock_vs.index.d = 3
                mock_faiss.load_local.return_value = mock_vs

                result = load_vectorstore(tmpdir, mock_embeddings)
                assert result is not None
                assert result.index.ntotal == 10


class TestCreateRetriever:
    """Tests pour create_retriever."""

    def test_default_parameters(self):
        """Test la création avec les paramètres par défaut."""
        mock_vs = MagicMock()
        mock_retriever = MagicMock()
        mock_vs.as_retriever.return_value = mock_retriever

        _ = create_retriever(mock_vs)
        mock_vs.as_retriever.assert_called_once()

    def test_custom_parameters(self):
        """Test la création avec des paramètres personnalisés."""
        mock_vs = MagicMock()
        mock_retriever = MagicMock()
        mock_vs.as_retriever.return_value = mock_retriever

        _ = create_retriever(
            mock_vs,
            search_type="similarity",
            k=10,
            fetch_k=50,
            lambda_mult=0.8,
        )

        call_kwargs = mock_vs.as_retriever.call_args
        assert call_kwargs[1]["search_type"] == "similarity"
        assert call_kwargs[1]["search_kwargs"]["k"] == 10
        assert call_kwargs[1]["search_kwargs"]["fetch_k"] == 50
        assert call_kwargs[1]["search_kwargs"]["lambda_mult"] == 0.8

    def test_mmr_search_type(self):
        """Test la recherche de type MMR."""
        mock_vs = MagicMock()
        mock_retriever = MagicMock()
        mock_vs.as_retriever.return_value = mock_retriever

        _ = create_retriever(mock_vs, search_type="mmr")

        call_kwargs = mock_vs.as_retriever.call_args
        assert call_kwargs[1]["search_type"] == "mmr"
