# Gala des STARS – Application de vote en ligne

Application web de vote développée en **une semaine** pour un événement caritatif (Gala des STARS, ICC Nancy).
Elle permet à l'assemblée de voter par catégorie de prix, puis à des responsables d'évaluer les finalistes, avec un classement final pondéré.

**Résultat :** 239 votes recueillis sur 7 catégories, entre le 2 et le 18 septembre 2026.

## Captures d'écran

**Vote de l'assemblée**

![Page de vote de l'assemblée](screenshots/Capture d'écran 2026-11-16 015241.png)

**Espace responsables**

![Page de vote des responsables](screenshots/Capture d'écran 2026-11-16 015645.png)

> Les visages ont été floutés pour préserver la vie privée des participants.

## Fonctionnalités

**Vote de l'assemblée (`votes-assemblee/`)**
- 7 catégories de prix, avec description et critères de sélection
- Vote avec justification obligatoire pour les catégories à saisie libre
- Compte à rebours configurable : ouverture et fermeture des votes
- Verrou d'écriture (`LockService`) pour gérer les votes simultanés
- Espace admin protégé par un code PIN : résultats par prix

**Évaluation par les responsables (`votes-responsables/`)**
- Notation /20 des finalistes de chaque prix, avec commentaires
- Une seule évaluation par responsable et par prix
- Sélection automatique du top 3 issu du vote de l'assemblée
- Tableau de bord global : score final sur 100 (60 % assemblée, 40 % responsables)
- Génération automatique d'une feuille « Résultats officiels »

## Stack technique

- **Back-end :** Google Apps Script
- **Front-end :** HTML, JavaScript, Tailwind CSS (CDN)
- **Base de données :** Google Sheets
- **Hébergement :** web app Apps Script

## Installation

1. Créer un Google Sheet (feuilles utilisées : `Candidats`, `Votes`, `Votes_Responsables`).
2. Ouvrir **Extensions > Apps Script** et copier les fichiers de chaque dossier dans un projet distinct.
3. Dans `votes-responsables/Code.gs`, remplacer `VOTRE_ID_GOOGLE_SHEET` par l'ID de la feuille (visible dans son URL).
4. Dans chaque projet, aller dans **Paramètres du projet > Propriétés du script** et ajouter :
   - `ADMIN_PIN` : le code PIN administrateur de votre choix
5. Dans `votes-assemblee/JavaScript.html`, remplacer la liste d'exemple `ENFANTS_PRIX6` par la vraie liste.
6. **Déployer > Nouveau déploiement > Application Web.**

## Sécurité et confidentialité

- Le PIN admin n'est **pas** stocké dans le code : il est lu dans les propriétés du script.
- Aucun vote ni commentaire réel n'est inclus dans ce dépôt, et la liste des enfants est remplacée par des noms d'exemple.

## Limites connues et améliorations possibles

- Ajouter un contrôle PIN sur `setCountdownConfig` (assemblée) : aujourd'hui, la fonction n'est pas protégée côté serveur.
- Garantir un vote unique par personne et par catégorie **côté serveur** (jetons à usage unique).
- Normaliser les noms de candidats (liste déroulante ou identifiants) pour éviter des décomptes faussés par les variantes d'écriture.
- Désactiver le bouton « Envoyer » après le premier clic pour éviter les doublons.
- Remplacer le CDN Tailwind par une version compilée.

## Ce que j'ai appris

- Livrer un projet complet en une semaine, et le voir utilisé en conditions réelles par une communauté.
- Choisir Google Apps Script et Google Sheets pour aller vite, sans coût d'hébergement.
- Gérer les écritures simultanées avec `LockService` lorsque plusieurs personnes votent en même temps.
- Sécuriser l'accès admin : sortir le PIN du code et le vérifier côté serveur.
- Repérer les limites à l'usage (doublons, variantes d'écriture des noms, absence de vote unique côté serveur) et les documenter pour la suite.
