# QuandEstLibre — version corrigée pour le partage

Cette version corrige le **respect des majuscules** dans le chemin GitHub Pages, les liens directs des sondages et les erreurs silencieuses de chargement. Elle sauvegarde les sondages dans Supabase avant de donner le lien de partage. Les créneaux de 15 minutes sont proposés par défaut.

## Déployer dans GitHub

Dépôt : `https://github.com/daryous1/QuandEstLibre`
Site : **`https://daryous1.github.io/QuandEstLibre/`** (majuscules importantes).

1. Décompresse le ZIP sur ton ordinateur.
2. Dans ton dépôt GitHub, mets à jour **tous les fichiers** contenus dans ce ZIP, en conservant l'arborescence de dossiers, puis clique sur « Commit changes ». Ne dépose pas le ZIP fermé : GitHub ne le décompresse pas automatiquement.
3. GitHub : Settings → Pages → Build and deployment → Source = **GitHub Actions**.
4. Dans **Settings → Secrets and variables → Actions → Repository secrets**, tu as déjà créé :
   - `VITE_SUPABASE_URL` = `https://wvxvqierbtuitobxufiv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = **ta clé publique Supabase** (ne pas saisir une clé secrète/service_role)
5. Va dans **Actions** et contrôle que le déploiement « Deploy QuandEstLibre » est vert.
6. Ouvre le site avec l'adresse ci-dessus ; crée un **nouveau** sondage, puis ouvre son lien sur un autre téléphone, de préférence en navigation privée pour le tester.

### Pour remplacer seulement les fichiers modifiés

Le plus simple est de remplacer ces **3 fichiers** dans GitHub :
- `vite.config.js` — bon chemin GitHub Pages et PWA ;
- `src/main.jsx` — création en ligne, liens directs et messages d'erreur ;
- `src/style.css` — mise en forme des messages d'erreur.

Le fichier `.github/workflows/deploy.yml` inclus est déjà configuré pour **GitHub Secrets** (`secrets.`).

## Supabase

La table `public.events` doit déjà exister si tu as exécuté le SQL précédemment. Le code SQL est dans `supabase/schema.sql` pour référence : **ne relance pas ce fichier si tu as déjà créé les policies**, car elles seraient en double.

Les anciens sondages créés en mode local **ne peuvent pas être partagés** sans migration : crée-en de nouveaux une fois la connexion en ligne active.

La table de démonstration a un accès public en lecture et écriture : ne l'utilise pas pour des informations privées, et renforce les règles d'accès avant un usage sensible.

## Notes

L'application récupère les réponses depuis Supabase régulièrement. Si un lien n'est pas trouvé ou si Supabase renvoie une erreur, elle affiche désormais une explication à la place de l'accueil.

Après la mise à jour, si ton Android ouvre encore une ancienne version, recharge en vidant les données du site ou supprime puis réinstalle la PWA depuis Chrome.
