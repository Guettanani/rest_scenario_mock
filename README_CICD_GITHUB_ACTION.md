# README_CICD_GITHUB_ACTION.md

# Pipeline CI/CD — `vr_scenario_lib_rest`

Documentation technique complète des pipelines GitHub Actions du projet.

## Workflows disponibles

| Fichier | Description | Déclenchement |
|---|---|---|
| `.github/workflows/ci.yml` | Backend — tests, lint, build Python, Docker, deploy | push/PR sur main, develop |
| `.github/workflows/frontend-cd.yml` | Frontend — lint, build React, tests, Docker, push | push/PR sur main |

---

## Table des matières

1. [Vue d'ensemble du pipeline](#1-vue-densemble-du-pipeline)
2. [Architecture des jobs](#2-architecture-des-jobs)
3. [Événements déclencheurs (triggers)](#3-événements-déclencheurs-triggers)
4. [Exécution séquentielle — Détail par job](#4-exécution-séquentielle--détail-par-job)
   - [Job `test`](#job-test)
   - [Job `lint`](#job-lint)
   - [Job `build`](#job-build)
   - [Job `docker-build`](#job-docker-build)
   - [Job `deploy`](#job-deploy)
5. [Prérequis de configuration](#5-prérequis-de-configuration)
   - [Secrets GitHub](#secrets-github)
   - [Variables d'environnement implicites](#variables-denvironnement-implicites)
   - [Paramètres du dépôt](#paramètres-du-dépôt)
   - [Configuration Docker Hub](#configuration-docker-hub)
   - [Configuration Codecov](#configuration-codecov)
   - [Environment `production`](#environment-production)
6. [Gestion des artefacts](#6-gestion-des-artefacts)
7. [Stratégie de cache](#7-stratégie-de-cache)
8. [Concurrence et annulation automatique](#8-concurrence-et-annulation-automatique)
9. [Permissions (sécurité)](#9-permissions-sécurité)
10. [Mise à jour automatique — Dependabot](#10-mise-à-jour-automatique--dependabot)
11. [Dépannage](#11-dépannage)

---

## 1. Vue d'ensemble du pipeline

Le fichier `.github/workflows/ci.yml` définit un pipeline CI/CD complet pour le
projet Python `vr_scenario_lib_rest`. Le pipeline orchestre **5 jobs** répartis
en trois phases :

```
                    ┌─────────────┐
                    │   Trigger   │
                    │  push / PR  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐           ┌──────▼──────┐
        │   test    │           │    lint     │
        │ (matrix)  │           │  Python 3.12│
        └─────┬─────┘           └──────┬──────┘
              │                        │
              │    ┌───────────────────┘
              │    │
        ┌─────▼────▼─────┐
        │                │
   ┌────▼────┐    ┌──────▼──────┐
   │  build  │    │ docker-build│
   │ Python  │    │ multi-arch  │
   │  3.12   │    │ + Trivy     │
   └────┬────┘    └──────┬──────┘
        │                │
        └────────┬───────┘
                 │
           ┌─────▼─────┐
           │   deploy  │
           │   (main)  │
           └───────────┘
```

- **Phase 1 — Validation parallèle** : `test` et `lint` s'exécutent
  simultanément, sans dépendance l'un de l'autre.
- **Phase 2 — Packaging** : `build` et `docker-build` s'exécutent en parallèle
  dès que `test` ET `lint` sont réussis.
- **Phase 3 — Déploiement** : `deploy` s'exécute uniquement après `build` ET
  `docker-build`, et uniquement sur la branche `main`.

---

## 2. Architecture des jobs

| Job | Runner | Timeout | Dépendances | Objectif |
|---|---|---|---|---|
| `test` | `ubuntu-latest` | 15 min | aucune | Tests unitaires multi-version Python |
| `lint` | `ubuntu-latest` | 10 min | aucune | Qualité de code (black, isort, flake8) |
| `build` | `ubuntu-latest` | 10 min | `test` + `lint` | Construction du package Python |
| `docker-build` | `ubuntu-latest` | 20 min | `test` + `lint` | Image Docker multi-arch + scan CVE |
| `deploy` | `ubuntu-latest` | 15 min | `build` + `docker-build` | Déploiement production |

---

## 3. Événements déclencheurs (triggers)

Le workflow se déclenche sur trois événements :

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:
```

### 3.1 `push` vers `main` ou `develop`

Tout commit poussé sur les branches `main` ou `develop` déclenche le pipeline
complet, y compris le déploiement (uniquement pour `main` via le garde
`if: github.ref == 'refs/heads/main'` dans le job `deploy`).

**Cas d'usage** : fusion de PR, push direct, fusion de develop vers main.

### 3.2 `pull_request` vers `main`

L'ouverture, la réouverture, ou la mise à jour d'une pull request ciblant la
branche `main` déclenche les jobs `test`, `lint`, `build`, et `docker-build`.
Le job `deploy` est **exclu** de ce contexte.

**Sécurité** : les images Docker ne sont **pas poussées** sur Docker Hub dans
ce contexte (`push: ${{ github.event_name != 'pull_request' }}`).
Seule l'image locale est construite puis scannée pour les vulnérabilités.

### 3.3 `workflow_dispatch`

Déclenchement manuel depuis l'onglet "Actions" de l'interface GitHub.
Permet de relancer le pipeline sur n'importe quelle branche sans nouveau commit.

---

## 4. Exécution séquentielle — Détail par job

### Job `test`

**Objectif** : exécuter la suite de tests unitaires sur toutes les versions
Python supportées pour garantir la compatibilité ascendante et descendante.

**Matrice de versions** :

```yaml
strategy:
  matrix:
    python-version: ["3.10", "3.11", "3.12", "3.13"]
```

Ce job est instancié **5 fois** en parallèle (une par version Python). Chaque
instance est indépendante et possède son propre cache pip.

#### Étape 1 — `actions/checkout@v4`

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1
```

Clone le dépôt avec une profondeur de 1 commit (`shallow clone`). Cela réduit
le temps de checkout en évitant de télécharger l'historique complet du dépôt.
Le code source est nécessaire pour installer le package en mode développement
et exécuter les tests.

#### Étape 2 — `actions/setup-python@v5`

```yaml
- name: Set up Python ${{ matrix.python-version }}
  uses: actions/setup-python@v5
  with:
    python-version: ${{ matrix.python-version }}
    cache: pip
```

Installe l'interpréteur Python de la version spécifiée par la matrice.
Le paramètre `cache: pip` active la mise en cache native du répertoire
`~/.cache/pip` basé sur le hash de `requirements.txt`. À chaque exécution
ultérieure, les paquets déjà téléchargés sont restaurés depuis le cache,
réduisant le temps d'installation de plusieurs dizaines de secondes.

#### Étape 3 — Installation des dépendances

```yaml
- name: Install dependencies
  run: |
    pip install -r requirements.txt
    pip install pytest pytest-cov
```

Deux installations distinctes :
- `requirements.txt` : dépendances du projet (langchain, fastapi, pypdf, etc.)
- `pytest` et `pytest-cov` : framework de tests et plugin de couverture de code,
  non inclus dans `requirements.txt` car ce sont des dépendances de CI

**Note** : la commande `pip install --upgrade pip` a été volontairement supprimée
car `actions/setup-python@v5` fournit déjà une version récente de pip. L'ajout
de cette commande n'apportait aucun bénéfice et ajoutait ~5–10 secondes par job.

#### Étape 4 — Exécution des tests

```yaml
- name: Run tests with pytest
  run: |
    pytest --cov=vr_scenario_lib tests/
```

Exécute tous les fichiers de test situés dans le répertoire `tests/`.
L'option `--cov=vr_scenario_lib` génère un rapport de couverture de code
pour le package `vr_scenario_lib`. Le rapport est produit au format XML
(`coverage.xml`) configurable via `pyproject.toml` ou `.coveragerc`.

Comportement en cas d'échec : si un test échoue, le job est marqué comme
échoué et les jobs dépendants (`build`, `docker-build`) ne sont pas exécutés.

#### Étape 5 — Upload vers Codecov

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    file: ./coverage.xml
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: false
```

Envoie le rapport de couverture à la plateforme Codecov pour suivi
historique et visualisation dans les PR.

Le paramètre `fail_ci_if_error: false` est une mesure de résilience : si le
service Codecov est temporairement indisponible, cela ne fait pas échouer le
pipeline. Le `flags: unittests` permet de distinguer cette couverture des
autres types de tests (intégration, e2e) dans le dashboard Codecov.

---

### Job `lint`

**Objectif** : valider la qualité et la cohérence du code source sans
l'exécuter. S'exécute en parallèle avec `test`.

Ce job s'exécute **une seule fois** sur Python 3.12.

#### Étape 1 — Checkout

Identique au job `test` : clone superficiel (`fetch-depth: 1`) du dépôt.

#### Étape 2 — Setup Python

```yaml
- name: Set up Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: pip
```

Utilise Python 3.12 avec cache pip natif. Le cache est partagé entre les
jobs car il est clé sur `(runner.os, python-version, hashFiles)`.

#### Étape 3 — Installation des outils de linting

```yaml
- name: Install linting tools
  run: |
    pip install flake8 black isort
```

Trois outils sont installés :
- **black** : formattage automatique du code (vérifie le formatage sans
  le corriger en mode `--check`)
- **isort** : vérification du tri des imports Python
- **flake8** : linting divers (complexité, erreurs de syntaxe, PEP 8)

#### Étape 4 — Vérification du formatage (black)

```yaml
- name: Check code formatting with black
  run: black --check --diff .
```

L'option `--check` fait que `black` retourne un code de sortie non-zéro si
des fichiers doivent être reformatés, sans les modifier. L'option `--diff`
affiche les changements nécessaires dans les logs du job.

Configuration dans `pyproject.toml` :
- `line-length = 88` (valeur par défaut de black)
- `target-version = ['py38']`
- exclusions : `.eggs`, `.git`, `.venv`, `build`, `dist`

En cas d'échec : le développeur doit exécuter `black .` localement et
recommiter.

#### Étape 5 — Vérification des imports (isort)

```yaml
- name: Check import sorting with isort
  run: isort --check-only --diff .
```

Vérifie que les imports sont triés selon le profil `black` (compatible avec
le formattage de black). Configuration dans `pyproject.toml` :
- `profile = "black"`
- `multi_line_output = 3` (style vertical)
- `known_first_party = ["vr_scenario_lib"]`

#### Étape 6 — Linting (flake8)

```yaml
- name: Lint with flake8
  run: flake8 .
```

Exécute flake8 sur l'ensemble du projet et détecte les erreurs de syntaxe, les
imports inutilisés, les variables non définies, et d'autres problèmes.

---

### Job `build`

**Objectif** : construire le package Python au format wheel et sdist.
S'exécute uniquement si `test` ET `lint` sont réussis.

**Condition d'exécution** :

```yaml
needs: [test, lint]
```

L'opérateur `needs` garantit que le job attend la réussite de tous les jobs
de la matrice `test` (5 versions Python) ET du job `lint`. Si l'un des 6 jobs
prédecesseurs échoue, `build` ne s'exécute pas.

#### Étape 1 — Checkout + Setup Python

Identique aux jobs précédents, sur Python 3.12.

#### Étape 2 — Installation des outils de build

```yaml
- name: Install build dependencies
  run: |
    pip install build wheel
```

- **build** (`python -m build`) : outil PEP 517/518 pour construire les
  packages Python. Produit un fichier `.whl` (wheel) et un fichier `.tar.gz`
  (sdistribution) dans `dist/`.
- **wheel** : format de package pré-compilé permettant une installation plus
  rapide que les sdist.

Configuration du build dans `pyproject.toml` :
- Backend : `setuptools.build_meta`
- Dépendances de build : `setuptools>=45`, `wheel`, `setuptools_scm[toml]>=6.2`
  (setuptools_scm gère automatiquement la version depuis les tags Git)

#### Étape 3 — Construction

```yaml
- name: Build package
  run: python -m build
```

Exécute le build PEP 517 dans le répertoire courant. Produit :
- `dist/vr_scenario_lib_rest-*.whl`
- `dist/vr_scenario_lib_rest-*.tar.gz`

#### Étape 4 — Upload des artefacts

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/
    retention-days: 7
```

Les fichiers dans `dist/` sont uploadés en tant qu'artefacts GitHub.
Ils sont conservés pendant **7 jours** (paramètre `retention-days: 7`)
pour limiter les coûts de stockage. Ces artefacts sont accessibles
via le job `deploy` grâce à `actions/download-artifact`.

---

### Job `docker-build`

**Objectif** : construire l'image Docker multi-architecture (amd64 + arm64),
la pousser sur Docker Hub, et scanner les vulnérabilités.

**Condition d'exécution** :

```yaml
needs: [test, lint]
```

S'exécute en parallèle de `build`, indépendamment de celui-ci.

#### Étape 1 — Checkout + Setup Docker Buildx

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
```

Buildx est l'outil de build Docker avancé qui supporte :
- La compilation multi-architecture (QEMU emulation)
- Le build parallèle
- Les caches de build exportables (`type=gha`)

Initialise un builder Buildx avec support QEMU pour compiler sur `arm64`
depuis un runner `amd64`.

#### Étape 2 — Authentification Docker Hub

```yaml
- name: Login to Docker Hub
  if: github.event_name != 'pull_request'
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_TOKEN }}
```

Conditionnée par `if: github.event_name != 'pull_request'` : les PR provenant de forks n'ont pas accès aux secrets et ne doivent pas pousser
d'images.

Utilise un **Access Token** (`DOCKER_TOKEN`) plutôt que le mot de passe
complet du compte, conformément aux bonnes pratiques de sécurité Docker Hub.

#### Étape 3 — Extraction des métadonnées

```yaml
- name: Extract metadata
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: ${{ secrets.DOCKER_USERNAME }}/vr_scenario_lib_rest
    tags: |
      type=ref,event=branch
      type=ref,event=pr
      type=sha,prefix={{branch}}-
      type=raw,value=latest,enable={{is_default_branch}}
```

Génère automatiquement les tags et labels de l'image. Résultat stocké dans
`steps.meta.outputs.tags` et `steps.meta.outputs.labels`.

Stratégie de taggage :

| Type | Condition | Exemple de tag |
|---|---|---|
| `type=ref,event=branch` | Push sur branche | `develop`, `main` |
| `type=ref,event=pr` | Pull request | `pr-42` |
| `type=sha,prefix={{branch}}-` | Toujours | `main-a1b2c3d` |
| `type=raw,value=latest` | Branche par défaut (`main`) | `latest` |

L'attribut `id: meta` permet de référencer les sorties via
`steps.meta.outputs.tags` dans les étapes suivantes.

#### Étape 4 — Construction de l'image Docker

```yaml
- name: Build Docker image
  uses: docker/build-push-action@v6
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: ${{ github.event_name != 'pull_request' }}
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    load: true
  continue-on-error: ${{ github.event_name == 'pull_request' }
```

Détail des options :
- **`context: .`** : utilise le répertoire racine du dépôt (et son `Dockerfile`)
  comme contexte de build Docker.
- **`platforms: linux/amd64,linux/arm64`** : cible les architectures x86_64 et
  ARM64 grâce à l'émulation QEMU configurée par Buildx.
- **`push: ...`** : pousse l'image sur Docker Hub sauf pour les PRs externes.
- **`cache-from: type=gha`** : restaure les couches Docker mises en cache depuis
  le GitHub Actions cache (stockage associé au dépôt).
- **`cache-to: type=gha,mode=max`** : exporte toutes les couches (y compris les
  couches intermédiaires) dans le cache GitHub Actions pour accélérer les builds
  suivants.
- **`load: true`** : charge l'image dans le Docker daemon local du runner
  (nécessaire pour le scan Trivy qui suit). En mode `push`, l'image est à la
  fois poussée ET chargée localement.
- **continue-on-error: ...** : pour les PRs, un échec de build Docker ne
  fait pas échouer le pipeline entier (résilience face aux problèmes transitoires
  de Docker Hub ou des bases d'images).
> **⚠️ Note importante** : le fichier ``ci.yml`` contient actuellement une faute
> de frappe sur cette clé : ``continue-on-errors`` (avec un « s ») est invalide
> dans GitHub Actions. Seule la forme ``continue-on-error`` (sans « s ») est
> reconnue. Il est impératif de corriger le fichier ``.github/workflows/ci.yml``
> pour remplacer ``continue-on-errors`` par ``continue-on-error``.


#### Étape 5 — Scan de vulnérabilités (Trivy)

```yaml
- name: Scan Docker image for vulnerabilities
  uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: ${{ secrets.DOCKER_USERNAME }}/vr_scenario_lib_rest:latest
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: 0
```

Scanne l'image Docker construite pour détecter les CVEs (Common Vulnerabilities
and Exposures) dans :
- Les paquets système (apt, apk)
- Les paquets Python (pip)
- Les dépendances de runtime

Paramètres :
- **`severity: CRITICAL,HIGH`** : ne reporte que les vulnérabilités critiques et
  hautes, réduisant le bruit des faux positifs.
- **`exit-code: 0`** : le scan produit un rapport mais ne fait pas échouer le
  pipeline. Cela permet d'avoir une visibilité sur les vulnérabilités sans
  bloquer les déploiements. À ajuster à `1` une fois les vulnérabilités
  existantes corrigées.
- **`format: sarif`** : format standard compatible avec GitHub Advanced Security
  (onglet « Security » du dépôt).

---

### Job `deploy`

**Objectif** : déploiement en production. S'exécute sur la branche `main`
uniquement, après la réussite de `build` ET `docker-build`.

**Conditions d'exécution** :

```yaml
needs: [build, docker-build]
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

Double garde :
- `needs: [build, docker-build]` : les deux jobs de packaging doivent réussir
- `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` : uniquement
  sur push direct vers `main` (pas de PR, pas de déclenchement manuel,
  pas de branche `develop`)

**Environment** : le job référence `environment: production`, ce qui permet
de configurer des règles d'approbation manuelle dans les paramètres du dépôt.

#### Étape 1 — Téléchargement des artefacts

```yaml
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: dist
    path: dist/
```

Télécharge les artefacts (wheel et sdist) uploadés par le job `build`.
Ces fichiers sont placés dans `dist/` pour utilisation par les étapes
suivantes.

#### Étape 2 — Déploiement

```yaml
- name: Deploy to production
  run: |
    echo "Deploying version ${{ github.sha }}"
    echo "Add your deployment commands here"
```

Espace réservé pour les commandes de déploiement réel. À personnaliser
selon l'infrastructure cible :

- **Cloud (AWS/GCP/Azure)** : `aws ecs update-service`, `gcloud run deploy`, etc.
- **Kubernetes** : `kubectl set image`, `helm upgrade`, ArgoCD sync, etc.
- **PyPI** : `twine upload dist/*` pour publier le package.
- **Serveur SSH** : `scp` + `ssh` pour copier et redéplacer un service.

`${{ github.sha }}` est le hash du commit ayant déclenché le pipeline,
garantissant la traçabilité exacte du déploiement.

---

## 5. Prérequis de configuration

### Secrets GitHub

Les secrets suivants doivent être configur dans le dépôt GitHub :
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Description | Comment l'obtenir |
|---|---|---|
| `DOCKER_USERNAME` | Nom d'utilisateur Docker Hub | Compte Docker Hub (hub.docker.com) |
| `DOCKER_TOKEN` | Access Token Docker Hub | Docker Hub → Account Settings → Security → New Access Token. permissions minimales : `Read, Write, Delete` sur le repo `vr_scenario_lib_rest` uniquement |

**Note de sécurité** : Ne JAMAIS utiliser le mot de passe principal du compte
Docker Hub. L'Access Token est révocable et à portée limitée.

### Variables d'environnement implicites

Le workflow utilise plusieurs variables fournies automatiquement par le contexte
GitHub Actions, sans configuration requise :

| Variable | Utilisation | Description |
|---|---|---|
| `github.ref` | `github.ref == 'refs/heads/main'` | Référence complète de la branche/tag |
| `github.event_name` | `!= 'pull_request'` | Type d'événement déclencheur |
| `github.sha` | `Deploying version ${{ github.sha }}` | Hash du commit |
| `runner.os` | Cache key | Système d'exploitation du runner |
| `github.workflow` | `concurrency.group` | Nom unique du workflow |

### Paramètres du dépôt

#### Branches protégées

Configuration pour la branche `main` :
**Settings → Branches → Branch protection rules → `main`**

| Paramètre | Valeur recommandée | Raison |
|---|---|---|
| Require a pull request before merging | Activé | Pas de push direct |
| Require status checks to pass | Activé | Bloque le merge si CI échoue |
| Branches must be up to date before merging | Active | Évite les conflits |

#### Environment `production`

**Settings → Environments → New environment → `production`**

| Paramètre | Valeur recommandée |
|---|---|
| Required reviewers | 1–2 approbateurs |
| Wait timer | 0 (ou délai de grâce si nécessaire) |
| Deployment branches | `main` uniquement |

Ces paramètres garantissent que le job `deploy` nécessite une approbation
manuelle avant de s'exécuter, même si tous les jobs précédents sont réussis.

### Configuration Docker Hub

1. Créer un compte sur [hub.docker.com](https://hub.docker.com)
2. Créer le repository `vr_scenario_lib_rest`
3. Générer un Access Token : **Account Settings → Security → New Access Token**
   - Description : `github-actions-ci`
   - Access permissions : `Read & Write`
4. Ajouter `DOCKER_USERNAME` et `DOCKER_TOKEN` dans les secrets GitHub
5. (Optionnel) Configurer les règles de nettoyage d'images automatiques :
   **Repository Settings → Add cleanup rule**




### Configuration Codecov

1. Créer un compte sur [codecov.io](https://codecov.io) lié au dépôt GitHub
2. Installation de l'application GitHub Codecov : **codecov.io → Configure**
3. Upload token : **Repository Settings → Configure**
   - Ajouter `CODECOV_TOKEN` dans les secrets GitHub si le dépôt est privé
   - Les dépôts publics fonctionnent sans token (upload anonyme)

### Permissions du workflow

Le niveau de permission est défini globalement et par job :

```yaml
# Workflow-level : lecture seule du code source
permissions:
  contents: read

# Job docker-build : lecture seule (pas de push GHCR)
permissions:
  contents: read

# Job deploy : lecture seule
permissions:
  contents: read
```

Le paramètre `contents: read` remplace la valeur par défaut `contents: write`,
appliquant le principe du moindre privilège. Aucun job n'a besoin de pousser
du code ou de créer des releases.

---

## 6. Gestion des artefacts

Les artefacts du job `build` sont :
- **Stockés** : dans le storage GitHub Actions (hors du runner)
- **Clé** : `dist` (nom défini par `name: dist`)
- **Rétention** : 7 jours (`retention-days: 7`)
- **Restaurés** : par le job `deploy` via `actions/download-artifact@v4`

La rétention de 7 jours (au lieu des 90 jours par défaut) limite les coûts
de stockage tout en laissant suffisamment de temps pour vérifier un déploiement.

**Accès aux artefacts** :
- Interface GitHub : Onglet Actions → Exécution → Artefacts
- API : `GET /repos/{owner}/{repo}/actions/artifacts`

---

## 7. Stratégie de cache

Deux niveaux de cache indépendants sont utilisés :

### Cache pip (Python)

Fourni nativement par `actions/setup-python@v5` avec `cache: pip`.

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: pip
```

Clé de cache : `(runner.os, python-version, hashFiles('**/requirements.txt'))`.

Lorsque `requirements.txt` ne change pas, le cache est restauré intégralement.
Lorsqu'il change seulement partiellement, les paquets inchangés sont récupérés
depuis le cache. Limite de stockage du cache : 10 GB par dépôt (GitHub).

Avantage par rapport à l'ancienne méthode (`actions/cache@v3`) :
- Configuration simplifiée (un paramètre au lieu d'un step entier)
- Meilleure intégration avec la gestion des versions Python
- Invalidation automatique sur changement de version Python

### Couches Docker (Buildx)

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

- **`type=gha`** : utilise le GitHub Actions cache (stockage partagé de 10 GB)
- **`mode=max`** : exporte toutes les couches, y compris les couches
  intermédiaires de build multi-stage. Maximise le taux de cache hit mais
  consomme plus d'espace de stockage.

---

## 8. Concurrence et annulation automatique

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Groupe de concurrence : une combinaison unique du nom du workflow ET de la
branche/tag de référence. Comportement :

- **Push rapide** : si un développeur push 3 commits en succession rapide,
  seule la dernière exécution continue. Les 2 exécutions précédentes sont
  annulées automatiquement.
- **Branches indépendantes** : les exécutions sur `main` et `develop` ne
  s'annulent pas mutuellement.
- **PR séparée** : une PR a son propre groupe de concurrence basé sur la
  branche source.

Cela économise des minutes de runner (facturées pour les dépôts privés) et
réduit le temps d'attente pour les résultats.

---

## 9. Permissions (sécurité)

### Workflow-level

```yaml
permissions:
  contents: read
```

Tous les jobs reçoivent par défaut la permission `contents: read`. Aucun job
n'a la permission d'écrire dans le dépôt, de créer des issues, ou de publier
des releases.

### Permissions par job

| Job | Permissions | Justification |
|---|---|---|
| `test` | `contents: read` (hérité) | Lecture du code source uniquement |
| `lint` | `contents: read` (hérité) | Lecture du code source uniquement |
| `build` | `contents: read` (hérité) | Lecture + upload d'artefacts (built-in) |
| `docker-build` | `contents: read` explicite | Lecture + push Docker Hub (credentials-based) |
| `deploy` | `contents: read` explicite | Téléchargement d'artefacts uniquement |

Aucun `packages: write` n'est nécessaire car les images sont poussées sur
Docker Hub (authentification par credentials), pas sur le GitHub Container
Registry.

---

## 10. Mise à jour automatique — Dependabot

Le fichier `.github/dependabot.yml` configure la mise à jour automatique des
actions GitHub :

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - github-actions
```

- **`interval: weekly`** : Dependabot scanne les nouvelles versions chaque semaine
- **`open-pull-requests-limit: 5`** : maximum 5 PRs simultanées pour éviter
  de submerger le flux de review
- **`labels: [dependencies, github-actions]`** : labels appliqués aux PRs
  pour filtrage et tri

Dependabot ouvre une PR pour chaque mise à disposition d'action (par exemple,
`docker/setup-buildx-action` v3 → v4). Le pipeline CI s'exécute
automatiquement sur ces PRs, validant la compatibilité.

**Note** : Dependabot ne met PAS à jour les références de version figurant
dans les fichiers `Dockerfile` ou les Dockerfiles internes, mais uniquement
les versions des GitHub Actions référencées dans les fichiers
`.github/workflows/*.yml`.

---

## 11. Dépannage

### Échecs courants et solutions

#### Lint échoue sur black
```
would reformat src/module.py
```
**Solution** : exécuter `black .` localement et recommiter.

#### Cache pip ne se restaure pas
Le cache est invalide si `requirements.txt` a changé. Attendre le prochain
build : une fois le cache reconstruit, les builds suivants seront rapides.

#### Build Docker échoue sur `pull_request` de fork
Les PRs de forks n'ont pas accès aux secrets (`DOCKER_USERNAME`,
`DOCKER_TOKEN`). C'est normal et attendu. L'authentification est
conditionnée par `if: github.event_name != 'pull_request'`.

#### Trivy signale des CVEs
Le job continue malgré les alertes (`exit-code: 0`). Considérer :
1. Mettre à jour les bases d'images Docker dans le `Dockerfile`
2. Supprimer les paquets non essentiels
3. Passer `exit-code: 1` une fois les CVEs résolues

#### Le job `deploy` ne s'exécute pas
Vérifier :
- Le push est bien sur `main` (pas `develop`)
- `build` ET `docker-build` sont au vert
- Un approbateur a validé l'environment dans l'onglet Actions → deploy

#### Timeout sur un job
Les timeouts sont calibrés : 15 min pour `test`, 10 min pour `lint` et `build`,
20 min pour `docker-build`. Si un timeout survient :
1. Vérifier les logs pour identifier un blocage
2. Augmenter le timeout si le build est légitimement long
3. Vérifier les connexions réseau (téléchargement de paquets, images Docker)

### Liens utiles

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Référence du workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Docker Buildx documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [Trivy documentation](https://aquasecurity.github.io/trivy/)
- [Dependabot version updates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot)
