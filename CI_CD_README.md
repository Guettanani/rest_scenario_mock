# Pipeline CI/CD avec GitHub Actions

Ce document a été consolidé dans [`README_CICD_GITHUB_ACTION.md`](./README_CICD_GITHUB_ACTION.md).

Veuillez vous référer à ce fichier pour la documentation complète du pipeline CI/CD, incluant :
- L'architecture des jobs (test, lint, build, docker-build, deploy)
- Les événements déclencheurs
- Les prérequis de configuration (secrets, Docker Hub, Codecov)
- La stratégie de cache
- Le dépannage

## Secrets requis

| Secret | Description |
|---|---|
| `DOCKER_USERNAME` | Nom d'utilisateur Docker Hub |
| `DOCKER_TOKEN` | Access Token Docker Hub |

## Déclenchement

- Push sur `main` et `develop`
- Pull requests vers `main`
- Déclenchement manuel (`workflow_dispatch`)
