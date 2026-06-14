# REST Scenario Mock

Ce projet fournit une API REST pour simuler et gérer des scénarios VR (Virtual Reality).

## Démarrage rapide

### Prérequis

- Python 3.7+
- Pip

### Installation

1. Clonez le dépôt :
```bash
git clone https://github.com/Guettanani/rest_scenario_mock.git
cd rest_scenario_mock
```

2. Installez les dépendances :
```bash
pip install -r requirements.txt
```

### Lancement du serveur

Pour démarrer le serveur REST, exécutez la commande suivante :

```bash
python app.py
```

Le serveur sera accessible à l'adresse [http://localhost:3001](http://localhost:3001)

### Utilisation de base

L'API fournit plusieurs points d'accès pour interagir avec les scénarios VR :

- **GET /scenarios** : Récupère la liste de tous les scénarios disponibles
- **GET /scenarios/{id}** : Récupère les détails d'un scénario spécifique
- **POST /scenarios** : Crée un nouveau scénario
- **PUT /scenarios/{id}** : Met à jour un scénario existant
- **DELETE /scenarios/{id}** : Supprime un scénario

### Exemples de requêtes

Voici quelques exemples de requêtes que vous pouvez envoyer à l'API :

```bash
# Récupérer tous les scénarios
curl http://localhost:3001/scenarios

# Récupérer un scénario spécifique
curl http://localhost:3001/scenarios/1

# Créer un nouveau scénario
curl -X POST -H "Content-Type: application/json" -d '{"name":"Test Scenario", "description":"A test scenario"}' http://localhost:3001/scenarios
```

## Documentation

Pour plus de détails sur les points d'accès de l'API et leurs paramètres, veuillez consulter la documentation Swagger disponible à l'adresse [http://localhost:3001/docs](http://localhost:3001/docs) une fois le serveur démarré.

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à soumettre une Pull Request pour améliorer ce projet.

## Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.
