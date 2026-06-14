# Services REST pour VR Scenario Library

Ce guide explique comment utiliser les services REST de VR Scenario Library avec Docker.

## Vue d'ensemble

Les services REST permettent de :
1. Générer des scénarios VR à partir de thèmes
2. Interagir avec les scénarios via des questions/réponses
3. Générer des fichiers audio TTS
4. Récupérer un JSON initial de configuration

## Prérequis

- Docker et Docker Compose installés
- Les variables d'environnement nécessaires (HF_TOKEN, OPENROUTER_API_KEY, etc.)

## Configuration

Avant de lancer les services, assurez-vous d'avoir défini les variables d'environnement nécessaires. Créez un fichier `.env` :

```bash
# Clés API
HF_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_EMBEDDING_API_KEY=your_openrouter_embedding_api_key

# URLs des API
OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_EMBEDDING_API_URL=https://openrouter.ai/api/v1/embeddings

# Paramètres du modèle
EMBEDDING_PROVIDER=huggingface
LLM_MODEL=meta-llama/llama-3.2-3b-instruct:free
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
DEVICE=cpu
HF_INFERENCE_ENDPOINT=https://api-inference.hf.co

# Paramètres de logging
LOG_LEVEL=INFO
```

## Lancement des services

### 1. Construire et lancer le serveur REST

```bash
# Construire l'image Docker
docker-compose -f docker-compose.rest.yml build

# Lancer le serveur REST
docker-compose -f docker-compose.rest.yml up -d rest-server
```

Le serveur sera accessible à l'adresse `http://localhost:3001`.

### 2. Vérifier l'état du serveur

```bash
# Voir les logs du serveur
docker-compose -f docker-compose.rest.yml logs -f rest-server

# Vérifier que le serveur est en cours d'exécution
docker-compose -f docker-compose.rest.yml ps
```

### 3. Lancer un client REST

Vous pouvez lancer un client REST pour interagir avec le serveur :

```bash
# Lancer un client REST en mode interactif
docker-compose -f docker-compose.rest.yml run --rm rest-client
```

### 4. Lancer les tests

```bash
# Lancer les tests dans un conteneur Docker
docker-compose -f docker-compose.rest.yml run --rm rest-tests
```

### 5. Arrêter les conteneurs

```bash
# Arrêter tous les conteneurs
docker-compose -f docker-compose.rest.yml down
```

### 6. Nettoyer les ressources

```bash
# Arrêter et supprimer les conteneurs, volumes et réseaux
docker-compose -f docker-compose.rest.yml down -v --remove-orphans
```

## Utilisation des endpoints

Une fois le serveur lancé, vous pouvez utiliser les endpoints REST :

### Générer un scénario

```bash
curl -X POST http://localhost:3001/api/scenario   -H "Content-Type: application/json"   -d '{"topic": "sécurité incendie", "custom_prompt": "Ajouter des consignes spécifiques pour les bureaux"}'
```

### Récupérer un scénario existant

```bash
curl http://localhost:3001/api/scenario/<session_id>
```

### Poser une question à un scénario

```bash
curl -X POST http://localhost:3001/api/scenario/<session_id>/question   -H "Content-Type: application/json"   -d '{"question": "Quelles sont les procédures d'évacuation ?"}'
```

### Générer un fichier audio TTS

```bash
curl -X POST http://localhost:3001/api/scenario/tts   -H "Content-Type: application/json"   -d '{"text": "Ceci est un exemple de texte à convertir en parole."}'
```

### Récupérer le JSON initial

```bash
curl http://localhost:3001/api/initial-json
```

## Dépannage

### Problèmes courants

1. **Le serveur ne démarre pas** :
   - Vérifiez les logs avec `docker-compose -f docker-compose.rest.yml logs rest-server`
   - Assurez-vous que les ports 3001 ne sont pas utilisés par une autre application

2. **Le client ne se connecte pas** :
   - Vérifiez que le serveur est en cours d'exécution
   - Vérifiez que l'URL du serveur est correcte (http://localhost:3001)

3. **Erreurs de dépendances** :
   - Reconstruisez l'image avec `docker-compose -f docker-compose.rest.yml build --no-cache`

### Logs

Pour voir les logs en temps réel :
```bash
docker-compose -f docker-compose.rest.yml logs -f rest-server
```

## Pour aller plus loin

1. **Développer une interface web** :
   Utilisez les endpoints REST pour créer une interface web moderne.

2. **Intégrer avec d'autres services** :
   Intégrez l'architecture REST avec d'autres systèmes de votre organisation.

3. **Personnaliser les modèles** :
   Utilisez vos propres modèles TTS et LLM pour des résultats plus spécifiques.

## Support

Si vous rencontrez des problèmes ou avez des questions :
- Consultez les fichiers de logs
- Vérifiez la documentation
- Contactez l'équipe de développement
