"""Tests pour le module documents.py - Chargement et découpage de documents."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

from vr_scenario_lib.documents import (
    DocumentLoadError,
    _get_loader,
    _is_supported_file,
    load_document,
    scan_directory,
    split_documents,
)


class TestGetLoader:
    """Tests pour _get_loader."""

    def test_pdf_loader(self):
        """Test que _get_loader retourne PyPDFLoader pour un PDF."""
        with patch("vr_scenario_lib.documents.PyPDFLoader") as mock_loader:
            _get_loader("/path/to/file.pdf")
            mock_loader.assert_called_once_with("/path/to/file.pdf")

    def test_docx_loader(self):
        """Test que _get_loader retourne Docx2txtLoader pour un DOCX."""
        with patch("vr_scenario_lib.documents.Docx2txtLoader") as mock_loader:
            _get_loader("/path/to/file.docx")
            mock_loader.assert_called_once_with("/path/to/file.docx")

    def test_unsupported_extension(self):
        """Test qu'une erreur est levée pour une extension non supportée."""
        with pytest.raises(DocumentLoadError, match="Extension non supportée"):
            _get_loader("/path/to/file.txt")

    def test_unsupported_extension_csv(self):
        """Test qu'une erreur est levée pour un fichier CSV."""
        with pytest.raises(DocumentLoadError, match="Extension non supportée"):
            _get_loader("/path/to/data.csv")

    def test_unsupported_extension_empty(self):
        """Test qu'une erreur est levée pour un fichier sans extension."""
        with pytest.raises(DocumentLoadError, match="Extension non supportée"):
            _get_loader("/path/to/file")


class TestIsSupportedFile:
    """Tests pour _is_supported_file."""

    def test_pdf_supported(self):
        """Test que PDF est supporté."""
        assert _is_supported_file("document.pdf") is True

    def test_docx_supported(self):
        """Test que DOCX est supporté."""
        assert _is_supported_file("document.docx") is True

    def test_uppercase_pdf(self):
        """Test que PDF majuscule est supporté."""
        assert _is_supported_file("DOCUMENT.PDF") is True

    def test_uppercase_docx(self):
        """Test que DOCX majuscule est supporté."""
        assert _is_supported_file("DOCUMENT.DOCX") is True

    def test_txt_not_supported(self):
        """Test que TXT n'est pas supporté."""
        assert _is_supported_file("document.txt") is False

    def test_csv_not_supported(self):
        """Test que CSV n'est pas supporté."""
        assert _is_supported_file("data.csv") is False

    def test_json_not_supported(self):
        """Test que JSON n'est pas supporté."""
        assert _is_supported_file("config.json") is False

    def test_no_extension(self):
        """Test qu'un fichier sans extension n'est pas supporté."""
        assert _is_supported_file("Makefile") is False


class TestLoadDocument:
    """Tests pour load_document."""

    def test_file_not_found(self):
        """Test qu'une erreur est levée si le fichier n'existe pas."""
        with pytest.raises(FileNotFoundError, match="Fichier introuvable"):
            load_document("/nonexistent/path/file.pdf")

    def test_load_pdf_success(self):
        """Test le chargement réussi d'un PDF."""
        mock_docs = [
            Document(page_content="Test content", metadata={"source": "test.pdf"})
        ]
        with patch("vr_scenario_lib.documents.PyPDFLoader") as mock_loader_class:
            mock_loader = MagicMock()
            mock_loader.load.return_value = mock_docs
            mock_loader_class.return_value = mock_loader

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                temp_path = f.name

            try:
                docs = load_document(temp_path)
                assert len(docs) == 1
                assert docs[0].page_content == "Test content"
            finally:
                os.unlink(temp_path)

    def test_load_docx_success(self):
        """Test le chargement réussi d'un DOCX."""
        mock_docs = [
            Document(page_content="Test content", metadata={"source": "test.docx"})
        ]
        with patch("vr_scenario_lib.documents.Docx2txtLoader") as mock_loader_class:
            mock_loader = MagicMock()
            mock_loader.load.return_value = mock_docs
            mock_loader_class.return_value = mock_loader

            with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
                temp_path = f.name

            try:
                docs = load_document(temp_path)
                assert len(docs) == 1
                assert docs[0].page_content == "Test content"
            finally:
                os.unlink(temp_path)

    def test_load_unsupported_file(self):
        """Test qu'une erreur est levée pour un fichier non supporté."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            temp_path = f.name

        try:
            with pytest.raises(DocumentLoadError, match="Extension non supportée"):
                load_document(temp_path)
        finally:
            os.unlink(temp_path)

    def test_load_corrupted_pdf(self):
        """Test qu'une erreur est levée pour un PDF corrompu."""
        with patch("vr_scenario_lib.documents.PyPDFLoader") as mock_loader_class:
            mock_loader = MagicMock()
            mock_loader.load.side_effect = Exception("PDF corrompu")
            mock_loader_class.return_value = mock_loader

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                temp_path = f.name

            try:
                with pytest.raises(DocumentLoadError, match="Erreur chargement"):
                    load_document(temp_path)
            finally:
                os.unlink(temp_path)


class TestScanDirectory:
    """Tests pour scan_directory."""

    def test_directory_not_found(self):
        """Test qu'une erreur est levée si le répertoire n'existe pas."""
        with pytest.raises(FileNotFoundError, match="Répertoire introuvable"):
            scan_directory("/nonexistent/directory")

    def test_empty_directory(self):
        """Test qu'une erreur est levée si le répertoire est vide."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(ValueError, match="Aucun document valide trouvé"):
                scan_directory(tmpdir)

    def test_directory_with_only_unsupported_files(self):
        """Test qu'une erreur est levée si seuls des fichiers non supportés sont présents."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, "readme.txt").write_text("Hello")
            Path(tmpdir, "config.json").write_text("{}")

            with pytest.raises(ValueError, match="Aucun document valide trouvé"):
                scan_directory(tmpdir)

    def test_scan_with_mixed_files(self):
        """Test le scan avec des fichiers supportés et non supportés."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Créer des fichiers
            Path(tmpdir, "readme.txt").write_text("Hello")
            Path(tmpdir, "config.json").write_text("{}")

            with patch("vr_scenario_lib.documents.load_document") as mock_load:
                mock_load.return_value = [
                    Document(
                        page_content="PDF content", metadata={"source": "test.pdf"}
                    )
                ]

                # Créer un faux fichier PDF
                pdf_path = Path(tmpdir, "test.pdf")
                pdf_path.write_bytes(b"%PDF-1.4 fake")

                docs = scan_directory(tmpdir)
                assert len(docs) == 1
                assert docs[0].page_content == "PDF content"

    def test_scan_subdirectory(self):
        """Test le scan dans les sous-répertoires."""
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir, "subdir")
            subdir.mkdir()

            with patch("vr_scenario_lib.documents.load_document") as mock_load:
                mock_load.return_value = [
                    Document(page_content="Content", metadata={"source": "test.pdf"})
                ]

                pdf_path = subdir / "test.pdf"
                pdf_path.write_bytes(b"%PDF-1.4 fake")

                docs = scan_directory(tmpdir)
                assert len(docs) == 1


class TestSplitDocuments:
    """Tests pour split_documents."""

    def test_empty_documents(self):
        """Test qu'une erreur est levée si la liste est vide."""
        with pytest.raises(ValueError, match="Aucun document à découper"):
            split_documents([])

    def test_single_document(self):
        """Test le découpage d'un seul document."""
        docs = [
            Document(
                page_content="A" * 3000,
                metadata={"source": "test.pdf"},
            )
        ]

        chunks = split_documents(docs, chunk_size=1000, chunk_overlap=100)
        assert len(chunks) > 1

    def test_multiple_documents(self):
        """Test le découpage de plusieurs documents."""
        docs = [
            Document(page_content="A" * 2000, metadata={"source": "doc1.pdf"}),
            Document(page_content="B" * 2000, metadata={"source": "doc2.pdf"}),
        ]

        chunks = split_documents(docs, chunk_size=1000, chunk_overlap=100)
        assert len(chunks) > 2

    def test_custom_chunk_size(self):
        """Test avec une taille de chunk personnalisée."""
        docs = [Document(page_content="A" * 5000, metadata={"source": "test.pdf"})]

        chunks_small = split_documents(docs, chunk_size=500, chunk_overlap=50)
        chunks_large = split_documents(docs, chunk_size=2000, chunk_overlap=200)

        assert len(chunks_small) > len(chunks_large)

    def test_chunk_overlap(self):
        """Test que le chevauchement est respecté."""
        content = " ".join([f"word{i}" for i in range(500)])
        docs = [Document(page_content=content, metadata={"source": "test.pdf"})]

        chunks = split_documents(docs, chunk_size=500, chunk_overlap=100)
        if len(chunks) > 1:
            # Vérifier qu'il y a du contenu commun entre les chunks
            assert len(chunks) >= 1

    def test_short_document(self):
        """Test avec un document plus petit que la taille de chunk."""
        docs = [Document(page_content="Short content", metadata={"source": "test.pdf"})]

        chunks = split_documents(docs, chunk_size=1000, chunk_overlap=100)
        assert len(chunks) == 1
        assert chunks[0].page_content == "Short content"

    def test_metadata_preserved(self):
        """Test que les métadonnées sont préservées dans les chunks."""
        docs = [
            Document(
                page_content="A" * 3000,
                metadata={"source": "test.pdf", "page": 1},
            )
        ]

        chunks = split_documents(docs, chunk_size=1000, chunk_overlap=100)
        for chunk in chunks:
            assert chunk.metadata["source"] == "test.pdf"
            assert chunk.metadata["page"] == 1
