# Pipeline CI/CD avec GitHub Actions

Ce document explique le pipeline CI/CD mis en place pour le projet vr_scenario_lib_rest.

## Structure du pipeline

Le pipeline CI/CD est défini dans le fichier `.github/workflows/ci.yml` et comprend les étapes suivantes :

### 1. Tests unitaires (test)
- Exécute les tests sur plusieurs versions de Python (3.8, 3.9, 3.10, 3.11)
- Utilise pytest pour exécuter les tests
- Génère un rapport de couverture de code
- Upload le rapport de couverture vers Codecov

### 2. Linting (lint)
- Vérifie la qualité du code avec flake8
- Vérifie le formatage du code avec black
- Vérifie l'organisation des imports avec isort

### 3. Construction du package (build)
- Construit le package Python avec setuptools
- Upload les artefacts de construction

### 4. Construction de l'image Docker (docker-build)
- Construit l'image Docker pour l'application
- Pousse l'image sur Docker Hub si la branche est main/develop
- Gère les balises en fonction de la branche et du commit

## Exécution locale des tests

Pour exécuter les tests localement :

```bash
# Installation des dépendances
pip install -r requirements.txt
pip install pytest pytest-cov

# Exécution des tests
pytest --cov=vr_scenario_lib tests/

# Exécution avec un seuil de couverture minimum
pytest --cov=vr_scenario_lib --cov-fail-under=80 tests/
```

## Exécution locale des outils de linting

```bash
# Installation des outils de linting
pip install flake8 black isort

# Vérification du formatage du code
black --check --diff .

# Vérification de l'organisation des imports
isort --check-only --diff .

# Linting avec flake8
flake8 .
```

## Configuration requise pour Docker

Pour que le pipeline Docker fonctionne, vous devez configurer les secrets suivants dans votre dépôt GitHub :

1. `DOCKER_USERNAME`: Votre nom d'utilisateur Docker Hub
2. `DOCKER_PASSWORD`: Votre mot de passe ou token d'accès Docker Hub

## Déclenchement du pipeline

Le pipeline est déclenché automatiquement :

- Sur les push vers les branches `main` et `develop`
- Sur les pull requests vers la branche `main`

## Résultats du pipeline

Les résultats du pipeline sont disponibles dans l'onglet "Actions" de votre dépôt GitHub. Vous pouvez y voir :

- Le statut de chaque étape (succès, échec, en cours)
- Les journaux d'exécution
- Les rapports de couverture de code
- Les artefacts générés

## Intégration continue

Le pipeline garantit que le code est testé et validé avant d'être fusionné dans les branches principales. Cela permet de détecter les problèmes de qualité et les régressions dès que possible.

## Livraison continue

Le pipeline automatise la construction et le déploiement de l'image Docker, permettant une livraison rapide et fiable de l'application.
