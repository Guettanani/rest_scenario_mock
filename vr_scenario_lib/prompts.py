"""Templates de prompts pour la génération de scénarios VR.

Sépare les templates de prompts de la logique métier.
Chaque fonction construit un prompt user à partir de données contextuelles.
"""

from __future__ import annotations

from .config import CORRESPONDANCE_OBJETS, JSON_SCHEMA_V2


def build_scenario_prompt(topic: str, context: str) -> str:
    """Construit le prompt utilisateur pour la génération de scénario texte.

    Args:
        topic: Thème du scénario demandé.
        context: Contexte documentaire formaté (chunks RAG).

    Returns:
        Prompt utilisateur complet pour le LLM.
    """
    return f"""
Génère un scénario de formation VR sur le thème : **{topic}**

CONTEXTE DOCUMENTAIRE :
{context}

{CORRESPONDANCE_OBJETS}

STRUCTURE OBLIGATOIRE :

## CONFIGURATION INITIALE DU POSTE
(utilise les codes ET les noms de la table de correspondance)
- TYPE_POSTE : [GAZFIO ou FRANCEL]
- METEO : [J / N / JP / NP]
- DEMANDE_CLIENT : MOY=[250-1000], TYPE=[NOISE/SIN/CUBIC], RESEAU=[5/10/15/25]
- R0  (Robinet d'isolement amont principal)  : STATUT=[0/1], ETAT=[0/1]
- R1  (Robinet d'isolement aval)             : STATUT=[0/1], ETAT=[0/1]
- R2  (Robinet de détente)                   : STATUT=[0/1], ETAT=[0/1]
- R3  (Robinet de bypass)                    : STATUT=[0/1], ETAT=[0/1]
- R4  (Vanne de régulation)                  : STATUT=[0/1], ETAT=[0-100]
- VS_GAZFIO (Vanne de sécurité principale)   : STATUT=[0/1], ETAT=[0/1/2]
- M   (Mode opératoire du poste)             : VALEUR=[0-4]
- PM  (Prise de mesure pression)             : STATUT=[0/1], ETAT=[0/1]

## CONTEXTE SCÉNARIO
[Description de la situation initiale]

## OBJECTIFS PÉDAGOGIQUES
[3 à 5 objectifs]

## EPI OBLIGATOIRES
[Liste avec normes EN]

## ÉTAPES DU SCÉNARIO
[Pour chaque étape — utilise OBLIGATOIREMENT les codes MASER (R0, R1, R2, R3, R4, VS_GAZFIO, M, PM) :
- Titre de l'étape
- Actions à réaliser sur quels objets avec leur code MASER
- Valeurs attendues après l'action
- Erreurs possibles et conséquences]

## CRITÈRES DE RÉUSSITE
[Conditions de validation]
""".strip()


def build_announcement_prompt(scenario: dict) -> str:
    """Construit le prompt pour reformuler un scénario structuré en texte narratif.

    Args:
        scenario: Dictionnaire du scénario structuré (sortie JSON).

    Returns:
        Prompt utilisateur pour le LLM qui générera le texte narratif.
    """
    import json as _json
    scenario_str = _json.dumps(scenario, ensure_ascii=False, indent=2)

    return f"""Reformule ce scénario de formation gazière en un texte narratif fluide,
comme si tu étais un opérateur expérimenté qui explique la procédure à un collègue.

Le texte doit être :
- Clair et pédagogique, étape par étape
- Utiliser un langage naturel (pas de codes techniques bruts)
- Mentionner les EPI obligatoires au début
- Décrire l'état initial du poste
- Expliquer chaque étape avec les actions à réaliser
- Mentionner les erreurs possibles et leurs conséquences
- Se terminer par les critères de réussite

SCÉNARIO STRUCTURÉ :
{scenario_str}

Génère le texte narratif complet, en français, prêt à être annoncé à voix haute.
Commence par "Bienvenue dans ce scénario de formation." et termine par "Fin du scénario."
""".strip()


def build_json_conversion_prompt(scenario_text: str) -> str:
    """Construit le prompt utilisateur pour la conversion scénario → JSON Unity.

    Args:
        scenario_text: Texte du scénario généré à convertir.

    Returns:
        Prompt utilisateur complet pour le LLM.
    """
    return f"""
Convertis ce scénario de formation gazière en JSON dynamique strictement conforme au schéma.

SCHÉMA CIBLE :
{JSON_SCHEMA_V2}

{CORRESPONDANCE_OBJETS}

RÈGLES IMPORTANTES :
- etat_initial : état complet du poste au début (tous les champs MASER)
- etapes : UNE étape par grande action du scénario texte — ne regroupe pas, ne saute pas
- actions : utilise UNIQUEMENT les codes MASER (R0, R1, R2, R3, R4, VS_GAZFIO, M, PM) comme "objet"
- etat_resultant : UNIQUEMENT les objets qui changent — avec leurs codes MASER exacts
- conditions_erreur : 1 à 3 erreurs par étape — type "mauvaise_action" OU "valeur_hors_seuil"
- consequence : message court affiché dans le casque VR (max 15 mots)
- scenario_id : slug du titre

SCÉNARIO À CONVERTIR :
{scenario_text}

Réponds UNIQUEMENT avec le JSON valide, rien d'autre.
""".strip()