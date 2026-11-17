# QuandEstLibre

PWA française inspirée de When2Meet, avec une grille tactile responsive.

## Déploiement GitHub Pages

Le projet est préconfiguré pour le dépôt **Quandestlibre** : le chemin `/Quandestlibre/` est déjà défini dans `vite.config.js`.

1. Décompresse cette archive.
2. Dans le dépôt GitHub `daryous1/Quandestlibre`, remplace les anciens fichiers par **tout le contenu** de cette archive (y compris le dossier caché `.github`).
3. Fais un commit sur la branche `main`.
4. Dans GitHub : **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Ouvre l'onglet **Actions** et attends le succès de `Deploy QuandEstLibre`.
6. Le site sera à `https://daryous1.github.io/Quandestlibre/`.

## Test local

Node.js 20+ :
```bash
npm install
npm run dev
```

## Synchronisation entre téléphones avec Supabase

1. Dans Supabase, crée un projet (choisis un mot de passe de base de données et une région proche).
2. Ouvre **SQL Editor → New query**.
3. Copie-colle le contenu de `supabase/schema.sql`, puis clique sur **Run**.
4. Dans Supabase, ouvre **Project Settings → API** (ou **Data API** selon l'interface) et copie :
   - **Project URL** ;
   - la clé publique **anon / publishable**. Ne copie jamais la `service_role` / `secret key`.
5. Dans GitHub, ouvre `daryous1/Quandestlibre` puis **Settings → Secrets and variables → Actions → Variables → New repository variable**.
6. Crée ces deux variables avec les valeurs copiées :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Dans GitHub, ouvre **Actions → Deploy QuandEstLibre → Run workflow** (ou fais un nouveau commit). Attends la coche verte.
8. Recharge l'application. Les nouveaux sondages seront stockés dans Supabase et accessibles par leur lien depuis d'autres appareils.

Le workflow GitHub de cette archive transmet automatiquement ces deux variables à la compilation. Les variables doivent être configurées avant de relancer le déploiement.

**Important :** le SQL fourni autorise la lecture et la modification publiques des sondages pour cette première version sans compte. Ne mets pas d'informations privées dans les sondages. Une sécurisation plus poussée pourra être ajoutée ensuite.

## Installer sur Android

Une fois le site publié en HTTPS : ouvre-le dans Chrome Android → menu ⋮ → **Installer l'application** ou **Ajouter à l'écran d'accueil**.
