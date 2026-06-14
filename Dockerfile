# =============================================================================
# Dockerfile pour VR Scenario Library
# =============================================================================

# Étape 1 : Image de base
FROM python:3.11-slim as base

# Métadonnées
LABEL maintainer="VR Scenario Library Team"
LABEL description="Générateur de scénarios de formation VR pour le secteur gazier"
LABEL version="1.0.0"

# Variables d'environnement
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Créer un utilisateur non-root
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Répertoire de travail
WORKDIR /app

# =============================================================================
# Étape 2 : Dépendances
# =============================================================================
FROM base as dependencies

# Installer les dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copier tout le projet afin d'installer le package dans l'étape de build
COPY . .

# Installer les dépendances Python et installer le package localement
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    # Installer temporairement grpcio-tools pour générer les stubs
    pip install grpcio-tools && \
    # Générer les stubs Python gRPC si le fichier proto existe
    if [ -f /app/scenario.proto ]; then python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. scenario.proto || true; fi && \
    # Installer le package local (permet d'importer `vr_scenario_lib` au runtime)
    pip install . && \
    # Désinstaller les outils de build inutiles pour alléger l'image finale
    pip uninstall -y grpcio-tools || true

# =============================================================================
# Étape 3 : Application
# =============================================================================
FROM base as application

# Copier les dépendances depuis l'étape précédente
COPY --from=dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin
# COPY --from=dependencies /app/scenario_pb2.py /app/scenario_pb2_grpc.py ./

# Copier le code source
COPY . .

# Créer les répertoires nécessaires
RUN mkdir -p /app/documents /app/output /app/faiss_index && \
    chown -R appuser:appuser /app

# Changer vers l'utilisateur non-root
USER appuser

# Point d'entrée par défaut
# Run main as a module from the project root (files are copied into /app)
ENTRYPOINT ["python", "main.py"]

# Commande par défaut (peut être overridée)
CMD ["--help"]