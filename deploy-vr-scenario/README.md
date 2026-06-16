# deploy-vr-scenario (VPS)

Dossier prêt à copier sur ta VPS pour démarrer avec Docker Compose.

## Contenu
- `docker-compose.yml` (pull depuis Docker Hub)
- `.env.production` (à compléter)
- `documents/` (à remplir avec tes PDFs/DOCX)
- `scenarios/`, `output/` (créés côté host pour persister)

## Démarrage sur la VPS
```bash
cd /chemin/vers/deploy-vr-scenario
docker compose up -d --pull always
```

## Vérifications
```bash
curl -fsS http://VPS_IP:8002/health
```
Frontend :
```bash
http://VPS_IP:3001/
