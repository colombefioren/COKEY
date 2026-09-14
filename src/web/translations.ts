/**
 * The site's French strings, keyed by their English original.
 *
 * `t(lang, text)` (see `lang.tsx`) looks a string up here when `lang` is
 * `"fr"` and falls back to the English original when a key is missing, so a
 * string that has not been added yet degrades to English instead of
 * disappearing or crashing the page.
 *
 * This covers the app's own copy: labels, buttons, headings, static
 * explanatory text, empty states, placeholders and tooltips. It deliberately
 * does not cover data that comes from elsewhere and is not COKEY's own
 * writing — provider names and descriptions from the catalog, model ids,
 * a provider's own error text, or a sentence assembled at runtime from live
 * numbers and names. Translating those would either mean maintaining a
 * second copy of the entire provider catalog in French or gluing French and
 * English fragments into one sentence, both worse than leaving them as the
 * provider or the gateway actually reports them.
 */
export const FR: Record<string, string> = {
  // ---- Dashboard ----------------------------------------------------------
  "Live route": "Route en direct",
  Resilience: "Résilience",
  Activity: "Activité",
  Gateway: "Passerelle",
  Chains: "Chaînes",
  "aliases clients call": "alias appelés par les clients",
  Credentials: "Identifiants",
  healthy: "en bonne santé",
  cooldown: "en pause",
  invalid: "invalide",
  "Providers connected": "Fournisseurs connectés",
  "custom endpoint(s)": "point(s) de terminaison personnalisé(s)",
  Requests: "Requêtes",
  "fell back": "repli",
  avg: "moy.",
  "Chain summary": "Résumé des chaînes",
  "No chains yet — create one in Chains.": "Pas encore de chaîne — créez-en une dans Chaînes.",
  Chain: "Chaîne",
  Nodes: "Nœuds",
  Keys: "Clés",
  Status: "Statut",
  enabled: "activée",
  disabled: "désactivée",
  "Recent requests": "Requêtes récentes",
  "refreshing…": "actualisation…",
  refresh: "actualiser",
  "Nothing routed yet. Point a client at": "Rien de routé pour l'instant. Pointez un client vers",
  "and it shows up here.": "et ça s'affichera ici.",
  When: "Quand",
  Model: "Modèle",
  Credential: "Identifiant",
  Result: "Résultat",
  Latency: "Latence",
  ok: "ok",
  fallback: "repli",

  // ---- Nudger ---------------------------------------------------------------
  of: "sur",
  "free providers connected": "fournisseurs gratuits connectés",
  Add: "Ajoutez",
  "more and a rate limit can never block you.":
    "de plus et une limite de débit ne pourra jamais vous bloquer.",
  Connect: "Connecter",
  "Browse providers": "Parcourir les fournisseurs",
  Later: "Plus tard",

  // ---- Resilience -----------------------------------------------------------
  scope: "portée",
  "whole chain": "toute la chaîne",
  "Chain fallback": "Repli de chaîne",
  "A node that cannot serve is set aside and the request walks on.":
    "Un nœud incapable de servir est mis de côté et la requête continue.",
  "entered once every key of that node is spent":
    "déclenché une fois toutes les clés de ce nœud épuisées",
  "model_unavailable skips the node; context_too_large stops":
    "model_unavailable saute le nœud ; context_too_large arrête tout",
  "the alias clients call": "l'alias que les clients appellent",
  "node 1 · groq": "nœud 1 · groq",
  "set aside": "mis de côté",
  "node 2 · openrouter": "nœud 2 · openrouter",
  next: "suivant",
  "one key": "une clé",
  "Key cooldown": "Pause de clé",
  "A rate-limited key sits out. Its siblings keep serving the node.":
    "Une clé limitée en débit se met en pause. Ses sœurs continuent de servir le nœud.",
  "catches 429, a rejected key and provider 5xx":
    "attrape les 429, une clé rejetée et les 5xx du fournisseur",
  "Retry-After wins; otherwise 30s → 60s → 120s → 300s, with jitter":
    "Retry-After prime ; sinon 30s → 60s → 120s → 300s, avec gigue",
  "node 1": "nœud 1",
  "keys bound": "clés rattachées",
  cooling: "en pause",
  serving: "en service",
  ready: "prête",
  "one model": "un modèle",
  "Model gating": "Filtrage de modèle",
  "A model is offered only while a verified key can reach it.":
    "Un modèle n'est proposé que tant qu'une clé vérifiée peut l'atteindre.",
  "proven against the provider before it joins a chain":
    "vérifié auprès du fournisseur avant de rejoindre une chaîne",
  "an expired cooldown returns as unverified, never healthy":
    "une pause expirée revient comme non vérifiée, jamais en bonne santé",
  proven: "vérifiée",
  offered: "proposé",
  "not offered": "non proposé",
  "Resilience · three layers": "Résilience · trois couches",
  "node, then key, then model": "nœud, puis clé, puis modèle",
  "One dead key never costs a": "Une clé morte ne coûte jamais",
  "key 429 → cooldown · rejected key → rotate · node 5xx → fallback · context too large → stop":
    "clé 429 → pause · clé rejetée → rotation · nœud 5xx → repli · contexte trop grand → arrêt",

  // ---- ChainFlow --------------------------------------------------------------
  "No chains yet. Create one in Chains and the route draws itself here.":
    "Pas encore de chaîne. Créez-en une dans Chaînes et la route se dessinera ici.",
  routing: "routage",
  idle: "au repos",
  waiting: "en attente",
  "Test every node and keep the first that answers":
    "Tester chaque nœud et garder le premier qui répond",
  testing: "test en cours",
  "test all": "tout tester",
  client: "client",
  "your editor": "votre éditeur",
  "one base URL": "une seule URL de base",
  alias: "alias",
  empty: "vide",
  "no nodes yet": "pas encore de nœud",
  "current · first node that answered": "actuel · premier nœud qui a répondu",
  "tried top to bottom": "essayés de haut en bas",
  current: "actuel",
  fail: "échec",
  "currently serving": "en service actuellement",
  "not reached": "non atteint",
  "tried first": "essayé en premier",
  "no keys": "aucune clé",
  "auto egress": "sortie automatique",
  "pinned egress": "sortie épinglée",

  // ---- Chains ---------------------------------------------------------------
  "Give the chain an alias, for example cokey-best":
    "Donnez un alias à la chaîne, par exemple cokey-best",
  "New chain": "Nouvelle chaîne",
  "Alias · the model id clients send": "Alias · l'id de modèle envoyé par les clients",
  "Description · optional": "Description · optionnelle",
  "Creating…": "Création…",
  "Create chain": "Créer la chaîne",
  "Tried top to bottom. Reorder by dragging,": "Essayées de haut en bas. Réordonnez par glisser,",
  "or the arrows.": "ou avec les flèches.",
  nodes: "nœuds",
  keys: "clés",
  "No chains yet.": "Pas encore de chaîne.",

  // ---- Pagination -------------------------------------------------------------
  to: "à",
  "per page": "par page",
  "First page": "Première page",
  "Previous page": "Page précédente",
  "Next page": "Page suivante",
  "Last page": "Dernière page",
  rows: "lignes",
  chains: "chaînes",

  // ---- ChainCard --------------------------------------------------------------
  "Entry duplicated": "Entrée dupliquée",
  "Renamed to": "Renommée en",
  Deleted: "Supprimée :",
  Save: "Enregistrer",
  Cancel: "Annuler",
  entry: "entrée",
  entries: "entrées",
  "model id for clients": "id de modèle pour les clients",
  "Testing nodes…": "Test des nœuds…",
  "Test every node and go to the first that answers":
    "Tester chaque nœud et aller au premier qui répond",
  "testing…": "test en cours…",
  Rename: "Renommer",
  rename: "renommer",
  disable: "désactiver",
  enable: "activer",
  delete: "supprimer",
  "No entries yet. Add a provider and model to start building the fallback order.":
    "Pas encore d'entrée. Ajoutez un fournisseur et un modèle pour bâtir l'ordre de repli.",
  "Drag to reorder, or Alt+↑ / Alt+↓": "Glisser pour réordonner, ou Alt+↑ / Alt+↓",
  "Move up (Alt+↑)": "Monter (Alt+↑)",
  "Move down (Alt+↓)": "Descendre (Alt+↓)",
  "View details": "Voir les détails",
  Provider: "Fournisseur",
  "auto proxy": "proxy automatique",
  "Automatic egress pool is assigning exits":
    "Le pool de sortie automatique attribue des sorties",
  Edit: "Modifier",
  Duplicate: "Dupliquer",
  Disable: "Désactiver",
  Enable: "Activer",
  remove: "retirer",
  "Add entry": "Ajouter une entrée",
  "Nodes run top to bottom. Drag or Alt+↑ / Alt+↓ to reorder; click a model to view, edit, or test its keys.":
    "Les nœuds s'exécutent de haut en bas. Glissez ou Alt+↑ / Alt+↓ pour réordonner ; cliquez sur un modèle pour le voir, le modifier ou tester ses clés.",
  "Remove entry": "Retirer l'entrée",
  Remove: "Retirer",
  from: "de",
  "Delete chain": "Supprimer la chaîne",
  "and all of its entries?": "et toutes ses entrées ?",
  Delete: "Supprimer",
  "first node that answered OK": "premier nœud qui a répondu OK",
  "Testing this node's key": "Test de la clé de ce nœud",
  "Answered OK": "A répondu OK",
  Failed: "Échoué",

  // ---- Keys -------------------------------------------------------------------
  "verified in": "vérifiée en",
  "A replacement key cannot be empty": "Une clé de remplacement ne peut pas être vide",
  "Key replaced": "Clé remplacée",
  "pinned to a pool exit": "épinglée à une sortie du pool",
  "returned to the automatic pool": "retournée au pool automatique",
  "Credential deleted": "Identifiant supprimé",
  "Search keys": "Rechercher des clés",
  "No keys yet. Connect a provider and COKEY proves the key before storing it.":
    "Pas encore de clé. Connectez un fournisseur et COKEY vérifie la clé avant de la stocker.",
  key: "clé",
  State: "État",
  Description: "Description",
  Key: "Clé",
  Rate: "Débit",
  Egress: "Sortie",
  Usage: "Utilisation",
  Quota: "Quota",
  Used: "Utilisée",
  left: "restant",
  "Exit IP for this key: automatic pool, a pinned exit, or direct":
    "IP de sortie pour cette clé : pool automatique, sortie épinglée, ou directe",
  proxy: "proxy",
  auto: "auto",
  pinned: "épinglé",
  direct: "directe",
  req: "req",
  tok: "jetons",
  never: "jamais",
  test: "tester",
  replace: "remplacer",
  revoke: "révoquer",
  "Replace API key": "Remplacer la clé API",
  "Enter a new secret for": "Entrez un nouveau secret pour",
  "The key is verified before it is stored.": "La clé est vérifiée avant d'être stockée.",
  "Revoke key": "Révoquer la clé",
  "Delete credential": "Supprimer l'identifiant",
  "It is detached from every chain.": "Il est détaché de toutes les chaînes.",
  Revoke: "Révoquer",
  "Egress for this key": "Sortie pour cette clé",
  "Add proxies to the pool once and every key of a provider gets a different exit. Leave this automatic, or pin the key to one exit.":
    "Ajoutez des proxys au pool une fois et chaque clé d'un fournisseur obtient une sortie différente. Laissez ceci automatique, ou épinglez la clé à une sortie.",
  "Automatic pool": "Pool automatique",
  "Loading the pool…": "Chargement du pool…",
  "The pool is empty. Add proxies under Settings, Egress pool, or set":
    "Le pool est vide. Ajoutez des proxys dans Paramètres, Pool de sortie, ou définissez",
  "before first start.": "avant le premier démarrage.",
  "key(s)": "clé(s)",
  Close: "Fermer",
  providers: "fournisseurs",
  Providers: "Fournisseurs",

  // ---- ConnectProviderModal / AddCredentialModal -------------------------------
  "Description, key and account id are required":
    "Description, clé et id de compte sont requis",
  "Description and key are both required": "Description et clé sont toutes deux requises",
  "Agree to the Terms before saving a key": "Acceptez les Conditions avant d'enregistrer une clé",
  models: "modèles",
  retired: "retiré(s)",
  "model list": "liste de modèles",
  "key verified in": "clé vérifiée en",
  "key saved": "clé enregistrée",
  "the key never leaves this machine": "la clé ne quitte jamais cette machine",
  "I agree to the": "J'accepte les",
  Terms: "Conditions",
  "Main account, Personal backup, Second account…":
    "Compte principal, Sauvegarde personnelle, Second compte…",
  "API key": "Clé API",
  "Account id": "Id de compte",
  "Cloudflare account id": "Id de compte Cloudflare",
  Verified: "Vérifiée",
  "accepted the key": "a accepté la clé",
  "Route this test/save through the egress pool": "Router ce test/enregistrement via le pool de sortie",
  "Protects your real IP, but free pool exits can hang, error or get blocked — no proxy is faster. Off = direct.":
    "Protège votre IP réelle, mais les sorties gratuites du pool peuvent bloquer, échouer ou être filtrées — sans proxy c'est plus rapide. Désactivé = direct.",
  "Need a key?": "Besoin d'une clé ?",
  Open: "Ouvrir",
  "Testing…": "Test en cours…",
  Test: "Tester",
  "Saving…": "Enregistrement…",
  "Save key": "Enregistrer la clé",

  // ---- AddCredentialModal -------------------------------------------------------
  "Credential attached": "Identifiant rattaché",
  "Key is required": "Une clé est requise",
  "Name and key are both required": "Nom et clé sont tous deux requis",
  "Verified and attached to": "Vérifiée et rattachée à",
  Saved: "Enregistrée",
  "and attached to": "et rattachée à",
  "Add key": "Ajouter une clé",
  "A one-token probe verifies the key against this exact model.":
    "Une sonde d'un jeton vérifie la clé contre ce modèle exact.",
  "The key is verified against the provider's model list.":
    "La clé est vérifiée par rapport à la liste de modèles du fournisseur.",
  "Use existing key": "Utiliser une clé existante",
  "Add a new key": "Ajouter une nouvelle clé",
  Attach: "Rattacher",
  Name: "Nom",
  "Main account": "Compte principal",
  "Egress proxy (optional override)": "Proxy de sortie (surcharge optionnelle)",
  "Leave empty to use the automatic pool": "Laissez vide pour utiliser le pool automatique",
  "COKEY already assigns exit IPs on its own: add proxies to the egress pool once and every key of a provider gets a different one, re-planned as keys appear. Leave this empty to inherit that. Type a URL here only to pin this key to a specific exit, which overrides the pool for it.":
    "COKEY attribue déjà les IP de sortie tout seul : ajoutez des proxys au pool de sortie une fois et chaque clé d'un fournisseur en obtient une différente, replanifiée à mesure que des clés apparaissent. Laissez ceci vide pour en hériter. Ne saisissez une URL ici que pour épingler cette clé à une sortie précise, ce qui prime sur le pool pour elle.",
  "Verifying with": "Vérification avec",

  // ---- AddEntryModal ------------------------------------------------------------
  "Pick a provider and a model": "Choisissez un fournisseur et un modèle",
  "Select at least one credential, or connect a key for this provider first":
    "Sélectionnez au moins un identifiant, ou connectez d'abord une clé pour ce fournisseur",
  Added: "Ajouté",
  "operational in": "opérationnelle en",
  "Add entry to": "Ajouter une entrée à",
  "Entries run top to bottom; every credential of an entry is exhausted before the next entry.":
    "Les entrées s'exécutent de haut en bas ; chaque identifiant d'une entrée est épuisé avant la suivante.",
  free: "gratuit",
  "not connected": "non connecté",
  "Probe this model with a selected key": "Sonder ce modèle avec une clé sélectionnée",
  Only: "Seuls les modèles de",
  "models are listed.": "sont listés.",
  "Display name (optional)": "Nom affiché (optionnel)",
  on: "sur",
  "This is the name COKEY shows for the node. It is never generated for you.":
    "C'est le nom que COKEY affiche pour le nœud. Il n'est jamais généré pour vous.",
  "No credentials for": "Pas d'identifiant pour",
  "yet. Connect one from the Providers tab first — COKEY will not create an entry with an unverified key.":
    "pour l'instant. Connectez-en un d'abord depuis l'onglet Fournisseurs — COKEY ne créera pas d'entrée avec une clé non vérifiée.",
  "Adding…": "Ajout…",

  // ---- EditEntryModal -------------------------------------------------------------
  "Pick or type a model": "Choisissez ou saisissez un modèle",
  "Chain node updated": "Nœud de chaîne mis à jour",
  "Edit chain node": "Modifier le nœud de chaîne",
  "cannot be changed here: this node's keys belong to it.":
    "ne peut pas être changé ici : les clés de ce nœud lui appartiennent.",
  "Shown in the dashboard and in": "Affiché dans le tableau de bord et dans",
  "Leave it empty to show the raw model id.": "Laissez vide pour afficher l'id de modèle brut.",
  "curated model(s) for": "modèle(s) sélectionné(s) pour",
  "Any id the provider accepts works.": "Tout id accepté par le fournisseur fonctionne.",
  "Routing strategy": "Stratégie de routage",
  "Sequential: use the keys in order": "Séquentiel : utiliser les clés dans l'ordre",
  "Round robin: rotate the keys": "Tourniquet : faire tourner les clés",

  // ---- ViewEntryModal ---------------------------------------------------------
  "Credential removed": "Identifiant retiré",
  Details: "Détails",
  "Everything this node routes to. Keys are tried in the strategy order below.":
    "Tout ce vers quoi ce nœud route. Les clés sont essayées dans l'ordre de la stratégie ci-dessous.",
  "Base URL": "URL de base",
  Strategy: "Stratégie",
  "How credentials are rotated for this node": "Comment les identifiants tournent pour ce nœud",
  "sequential · in order": "séquentiel · dans l'ordre",
  "round-robin · rotate": "tourniquet · rotation",
  "Test a key against": "Tester une clé contre",
  "A red pill means the key failed for this model; a green pill shows its latency.":
    "Une pastille rouge signifie que la clé a échoué pour ce modèle ; une pastille verte affiche sa latence.",
  "No credentials linked to this entry.": "Aucun identifiant lié à cette entrée.",
  failed: "échoué",
  "Testing...": "Test en cours...",
  "Test this credential": "Tester cet identifiant",
  "Remove credential": "Retirer l'identifiant",

  // ---- Primitives ---------------------------------------------------------------
  paused: "en pause",
  new: "nouvelle",
  OK: "OK",
  "req in the last minute": "req la dernière minute",
  "in the last 5 min": "sur les 5 dernières min",
  "rate limited recently": "récemment limitée",
  "quota exhaustion(s) observed": "épuisement(s) de quota observé(s)",
  "Quota: Unknown": "Quota : inconnu",
  "req left": "req restantes",
  "tok left": "jetons restants",

  // ---- Window -------------------------------------------------------------------
  "Expand panel": "Développer le panneau",
  "Collapse panel": "Réduire le panneau",
  panel: "panneau",

  // ---- Sidebar --------------------------------------------------------------
  "COKEY dashboard": "Tableau de bord COKEY",
  Sections: "Sections",

  // ---- App topbar -----------------------------------------------------------
  "Close navigation": "Fermer la navigation",
  "Open navigation": "Ouvrir la navigation",
  "The public model list, as any OpenAI client would see it":
    "La liste publique de modèles, telle que la verrait n'importe quel client OpenAI",

  // ---- NotificationsBell ------------------------------------------------------
  "notice(s) need attention": "notification(s) à traiter",
  Notifications: "Notifications",
  "Needs attention": "À traiter",

  // ---- Guidance ---------------------------------------------------------------
  "Key verified": "Clé vérifiée",
  "Still failing": "Toujours en échec",
  "could not be checked": "n'a pas pu être vérifié",
  restored: "restauré(s)",
  "model(s)": "modèle(s)",
  "is unchanged": "est inchangé",
  Checked: "Vérifié",
  "provider(s)": "fournisseur(s)",
  unreachable: "injoignable(s)",
  "to fix": "à corriger",
  "to watch": "à surveiller",
  show: "afficher",
  "reset dismissed": "réinitialiser les ignorées",
  "dismiss all": "tout ignorer",
  "Checking the gateway…": "Vérification de la passerelle…",
  "dismissed.": "ignorée(s).",
  "All clear.": "Tout est en ordre.",
  "needs a fix": "à corriger",
  "worth a look": "à surveiller",
  notice: "notification",
  "working…": "en cours…",
  "Hide until it changes": "Masquer jusqu'à changement",
  dismiss: "ignorer",
  checked: "vérifié",
  "stays on this machine": "reste sur cette machine",

  // ---- Providers --------------------------------------------------------------
  "connected only": "connectés uniquement",
  "Search providers": "Rechercher des fournisseurs",
  "Much of this list is one free pool re-exported under several names, so the verdicts are the point: start at the top and never build on an":
    "Une bonne partie de cette liste est un même pool gratuit réexporté sous plusieurs noms, donc les verdicts sont l'essentiel : commencez par le haut et ne construisez jamais sur un",
  avoid: "à éviter",
  "Nothing matches.": "Rien ne correspond.",
  Recommended: "Recommandé",
  Usable: "Utilisable",
  Limited: "Limité",
  Avoid: "À éviter",
  "Custom endpoints": "Points de terminaison personnalisés",
  "None yet — add one in Settings. URLs are SSRF-checked before they are stored.":
    "Aucun pour l'instant — ajoutez-en un dans Paramètres. Les URL sont vérifiées contre le SSRF avant d'être stockées.",
  "API token and account id": "Jeton API et id de compte",
  recommended: "recommandé",
  usable: "utilisable",
  limited: "limité",
  Reviewed: "Revu",
  reviewed: "revu",
  "No longer returned:": "N'est plus renvoyé :",
  "Model list checked": "Liste de modèles vérifiée",
  live: "en direct",
  "model list checked": "liste de modèles vérifiée",
  "model list never checked": "liste de modèles jamais vérifiée",
  "connect a key to check": "connectez une clé pour vérifier",
  Ask: "Demander à",
  "what it serves right now": "ce qu'il sert actuellement",
  "Connect a key first": "Connectez d'abord une clé",
  "re-check": "revérifier",
  none: "aucune",
  Type: "Type",
  "Model lab": "Labo de modèles",
  "Inference cloud": "Cloud d'inférence",
  Aggregator: "Agrégateur",
  "Local runtime": "Exécution locale",
  "Free tier": "Palier gratuit",
  "curated model(s)": "modèle(s) sélectionné(s)",
  "add to chain": "ajouter à une chaîne",
  "No curated models.": "Aucun modèle sélectionné.",
  "Retired · gone since": "Retiré · disparu depuis",
  source: "source",
  "get a free key": "obtenir une clé gratuite",

  // ---- ApiKeys ------------------------------------------------------------------
  "Give the key a name, e.g. OpenCode": "Donnez un nom à la clé, par ex. OpenCode",
  "API key revoked": "Clé API révoquée",
  "New API key": "Nouvelle clé API",
  "Create key": "Créer la clé",
  "Clients send this key as": "Les clients envoient cette clé comme",
  against: "contre",
  "Copy this key now": "Copiez cette clé maintenant",
  "It is shown once and never stored in plaintext.":
    "Elle n'est affichée qu'une fois et jamais stockée en clair.",
  Copied: "Copiée",
  Copy: "Copier",
  Done: "Terminé",
  "API keys": "Clés API",
  "No keys yet — create one above.": "Pas encore de clé — créez-en une ci-dessus.",
  Prefix: "Préfixe",
  Created: "Créée",
  "Last used": "Dernière utilisation",
  "Revoke API key": "Révoquer la clé API",
  "Clients using it stop working immediately.":
    "Les clients qui l'utilisent cessent immédiatement de fonctionner.",

  // ---- Models -------------------------------------------------------------------
  Catalog: "Catalogue",
  "My models": "Mes modèles",
  "sending hello": "envoi d'un bonjour",
  working: "fonctionne",
  unchanged: "inchangé",
  "Search model or provider": "Rechercher un modèle ou un fournisseur",
  "tested. Ranked by your own results.": "testé(s). Classés par vos propres résultats.",
  "Connect a provider to see your models here.":
    "Connectez un fournisseur pour voir vos modèles ici.",
  "No model matches that search.": "Aucun modèle ne correspond à cette recherche.",
  untested: "non testé",
  "with a working": "avec une clé",
  "Re-read what": "Relire ce que",
  "serves right now": "sert actuellement",
  "Ranked by success rate, then speed. A test is one real request through a working key.":
    "Classés par taux de réussite, puis par vitesse. Un test est une vraie requête via une clé qui fonctionne.",
  "usable only": "utilisables uniquement",
  "Search model, use or provider": "Rechercher un modèle, un usage ou un fournisseur",
  "providers usable.": "fournisseurs utilisables.",
  "sends one real hello and turns green only on a 200.":
    "envoie un vrai bonjour et ne devient vert que sur un 200.",
  "model(s) were gone on the last check, so they are hidden. Use":
    "modèle(s) avaient disparu lors de la dernière vérification, ils sont donc masqués. Utilisez",
  "to look again; the bell lists the chains that depend on one.":
    "pour revérifier ; la cloche liste les chaînes qui en dépendent.",
  "No models match that search.": "Aucun modèle ne correspond à cette recherche.",
  "Last checked": "Dernière vérification",
  "Never checked — showing the curated catalog only":
    "Jamais vérifié — affiche uniquement le catalogue sélectionné",
  "not checked": "non vérifié",
  "Models this provider returns that the curated catalog does not list":
    "Modèles que ce fournisseur renvoie et que le catalogue sélectionné ne liste pas",
  "keys unhealthy": "clés en mauvaise santé",
  "Connect a": "Connectez une clé",
  "key to check its model list": "pour vérifier sa liste de modèles",
  "Send a hello to": "Envoyer un bonjour à",
  "Connect a working": "Connectez une clé",
  "key first": "d'abord qui fonctionne",
  page: "page",
  "Previous models": "Modèles précédents",
  "More models": "Plus de modèles",
  "API equivalent:": "Équivalent API :",

  // ---- Rankings -----------------------------------------------------------------
  "Loading rankings…": "Chargement des classements…",
  "How to read this": "Comment lire ceci",
  "Coding skill": "Compétence en code",
  "Benchmark first, limits ignored": "Benchmark d'abord, limites ignorées",
  "Rate limits": "Limites de débit",
  "Throughput first, skill ignored": "Débit d'abord, compétence ignorée",
  Combined: "Combiné",
  "What to actually wire up": "Ce qu'il faut vraiment brancher",
  Redundancy: "Redondance",
  "What is a re-export of what": "Ce qui est une réexportation de quoi",
  "Rankings updated from the published bundle.": "Classements mis à jour depuis le paquet publié.",
  "No update available.": "Aucune mise à jour disponible.",
  "Published boards": "Classements publiés",
  fetched: "récupérés",
  "Compiled-in boards: this build's own snapshot.":
    "Classements intégrés : l'instantané propre à cette version.",
  "check for updates": "vérifier les mises à jour",
  Sources: "Sources",
  "Benchmark scores move every month and vendor-run numbers flatter the vendor. The play button in the catalog is the only score that reflects your own key.":
    "Les scores de benchmark bougent chaque mois et les chiffres publiés par les fournisseurs les flattent. Le bouton lecture du catalogue est le seul score qui reflète votre propre clé.",
  Tier: "Palier",
  Why: "Pourquoi",
  "Find": "Trouver",
  "in the catalog": "dans le catalogue",
  "in the provider catalog": "dans le catalogue des fournisseurs",
  "vendor direct": "direct fournisseur",
  "Ordered by how much a provider gives away, not how good it is — a provider can top this board and still be useless for coding.":
    "Classés par ce qu'un fournisseur offre, pas par sa qualité — un fournisseur peut dominer ce classement et rester inutile pour coder.",
  Source: "Source",
  Reliability: "Fiabilité",
  operator: "opérateur",
  "third party": "tiers",
  unpublished: "non publié",
  solid: "solide",
  watch: "à surveiller",
  "Dropped on purpose": "Écartés volontairement",
  "What to actually use, in order": "Ce qu'il faut vraiment utiliser, dans l'ordre",
  "Six or seven providers is the practical ceiling here. Beyond that you are wiring the same models up twice and paying for it in cooldowns.":
    "Six ou sept fournisseurs, c'est le plafond pratique ici. Au-delà, vous branchez deux fois les mêmes modèles et le payez en pauses.",
  "Duplicated model families": "Familles de modèles dupliquées",
  "Dozens of these providers resell the same underlying free pool. OpenRouter's free catalogue shows up almost verbatim on several others, so the redundancy is structural rather than accidental. Keep one of each row, and treat the rest as a fallback only.":
    "Des dizaines de ces fournisseurs revendent le même pool gratuit sous-jacent. Le catalogue gratuit d'OpenRouter réapparaît presque à l'identique chez plusieurs autres, donc la redondance est structurelle plutôt qu'accidentelle. Gardez une entrée par ligne et traitez le reste comme un simple repli.",
  "Model family": "Famille de modèle",
  "Also available on": "Aussi disponible sur",
  Keep: "Garder",
  Fallback: "Repli",

  // ---- Usage --------------------------------------------------------------------
  Overview: "Aperçu",
  "Serving now": "En service actuellement",
  "Loading…": "Chargement…",
  exit: "sortie",
  tries: "essais",
  started: "démarré",
  "Idle — the next request lands here.": "Au repos — la prochaine requête atterrira ici.",
  "Last route:": "Dernière route :",
  "Usage by provider": "Utilisation par fournisseur",
  "Loading usage…": "Chargement de l'utilisation…",
  "Chain state": "État des chaînes",
  "No chains configured.": "Aucune chaîne configurée.",
  off: "désactivé",
  "keys:": "clés :",
  "serving now": "en service actuellement",
  now: "maintenant",
  "Nothing recorded yet. Send a request to": "Rien d'enregistré pour l'instant. Envoyez une requête à",
  "Models used": "Modèles utilisés",
  "30-day requests": "Requêtes sur 30 jours",
  "30-day tokens": "Jetons sur 30 jours",
  in: "entrée",
  out: "sortie",
  "No model usage yet.": "Aucune utilisation de modèle pour l'instant.",
  requests: "requêtes",
  "Tokens in / out": "Jetons entrée / sortie",
  "Rate / min": "Débit / min",
  "Quota vs limit": "Quota vs limite",
  Reset: "Réinitialisation",
  unknown: "inconnu",
  "No model usage for this provider yet.": "Aucune utilisation de modèle pour ce fournisseur pour l'instant.",
  "Daily rollup": "Cumul quotidien",
  "No daily totals yet.": "Aucun total quotidien pour l'instant.",
  Day: "Jour",
  "Tokens in": "Jetons entrée",
  "Tokens out": "Jetons sortie",
  today: "aujourd'hui",
  "History cleared": "Historique effacé",
  "Request statistics": "Statistiques des requêtes",
  Recorded: "Enregistrées",
  Succeeded: "Réussies",
  "Used fallback": "Repli utilisé",
  "Requests that rotated to another key or node":
    "Requêtes ayant tourné vers une autre clé ou un autre nœud",
  "Average latency": "Latence moyenne",
  "Request history": "Historique des requêtes",
  "All outcomes": "Tous les résultats",
  "Search chain, model or key": "Rechercher une chaîne, un modèle ou une clé",
  "Provider / model": "Fournisseur / modèle",
  Attempts: "Tentatives",
  Mode: "Mode",
  stream: "flux",
  buffered: "tamponné",
  "Clear request history": "Effacer l'historique des requêtes",
  "Clear the local request history? This cannot be undone.":
    "Effacer l'historique local des requêtes ? Ceci est irréversible.",
  "no declared limit": "aucune limite déclarée",
  "source:": "source :",

  // ---- Settings -------------------------------------------------------------------
  "Password set. It is now permanent.": "Mot de passe défini. Il est désormais permanent.",
  "Settings saved": "Paramètres enregistrés",
  "A display name and base URL are required": "Un nom affiché et une URL de base sont requis",
  "Custom endpoint registered": "Point de terminaison personnalisé enregistré",
  "Loading settings…": "Chargement des paramètres…",
  Port: "Port",
  Host: "Hôte",
  "Loopback by default. Binding to 0.0.0.0 exposes the gateway to your network - set an auth token first.":
    "Loopback par défaut. Se lier à 0.0.0.0 expose la passerelle à votre réseau - définissez d'abord un jeton d'authentification.",
  "Log level": "Niveau de log",
  "Data directory": "Répertoire de données",
  "Admin password": "Mot de passe admin",
  "Set. The password is permanent and can no longer be changed here.":
    "Défini. Le mot de passe est permanent et ne peut plus être changé ici.",
  "New password": "Nouveau mot de passe",
  "Set password": "Définir le mot de passe",
  "Currently the default": "Actuellement celui par défaut",
  "Setting a password locks it permanently - there is no way to change it afterwards.":
    "Définir un mot de passe le verrouille de façon permanente - il n'y a aucun moyen de le changer ensuite.",
  "Config export (no secrets):": "Export de configuration (sans secrets) :",
  "download cokey-export.json": "télécharger cokey-export.json",
  "Fallback policy": "Politique de repli",
  "Fallback enabled": "Repli activé",
  "Try the next credential within an entry": "Essayer l'identifiant suivant dans une entrée",
  "Fall through to the next entry": "Passer à l'entrée suivante",
  "Automatic cooldowns": "Pauses automatiques",
  "Max retries per credential": "Tentatives max par identifiant",
  "Free-provider suggestions": "Suggestions de fournisseurs gratuits",
  "Show the free-provider nudger": "Afficher le rappel de fournisseurs gratuits",
  "Target number of connected free providers": "Nombre cible de fournisseurs gratuits connectés",
  "Entirely local — COKEY never phones home, and only providers that advertise a free tier are counted.":
    "Entièrement local — COKEY ne communique jamais avec l'extérieur, et seuls les fournisseurs qui annoncent un palier gratuit sont comptés.",
  "Custom OpenAI-compatible endpoints": "Points de terminaison personnalisés compatibles OpenAI",
  "Display name": "Nom affiché",
  "My self-hosted vLLM": "Mon vLLM auto-hébergé",
  "Models (comma separated)": "Modèles (séparés par des virgules)",
  "Add endpoint": "Ajouter le point de terminaison",
  "Allow private, loopback and plain-HTTP endpoints":
    "Autoriser les points de terminaison privés, loopback et en HTTP simple",
  "Off by default. Custom URLs are SSRF-checked: loopback, private ranges, link-local and cloud metadata are all blocked. Enable only for a service you run.":
    "Désactivé par défaut. Les URL personnalisées sont vérifiées contre le SSRF : loopback, plages privées, link-local et métadonnées cloud sont toutes bloquées. À activer seulement pour un service que vous gérez.",
  "No custom endpoints yet.": "Pas encore de point de terminaison personnalisé.",
  Revert: "Annuler",
  "Save settings": "Enregistrer les paramètres",
  "Set this password permanently? It cannot be changed again.":
    "Définir ce mot de passe de façon permanente ? Il ne pourra plus être changé.",

  // ---- EgressPoolPanel ------------------------------------------------------------
  "Proxy added to the pool": "Proxy ajouté au pool",
  "Proxy removed; affected keys were reassigned": "Proxy retiré ; les clés concernées ont été réassignées",
  "Assignments already up to date": "Assignations déjà à jour",
  "credential(s) moved to a new exit IP": "identifiant(s) déplacé(s) vers une nouvelle IP de sortie",
  "working free exit(s) added": "sortie(s) gratuite(s) fonctionnelle(s) ajoutée(s)",
  probed: "sondée(s)",
  "dead skipped": "morte(s) ignorée(s)",
  "free exit(s) added from Proxifly": "sortie(s) gratuite(s) ajoutée(s) depuis Proxifly",
  "Pool is empty - nothing to check": "Le pool est vide - rien à vérifier",
  All: "Toutes",
  "exit(s) alive": "sortie(s) en vie",
  alive: "en vie",
  "dead exit(s) removed": "sortie(s) morte(s) retirée(s)",
  "Automatic egress on": "Sortie automatique activée",
  "Automatic egress off": "Sortie automatique désactivée",
  "Egress pool": "Pool de sortie",
  "Probe candidates and only import exits that answer":
    "Sonder les candidats et n'importer que les sorties qui répondent",
  verify: "vérifier",
  "fetch free proxies (Proxifly)": "récupérer des proxys gratuits (Proxifly)",
  "check exits": "vérifier les sorties",
  "bulk paste": "coller en masse",
  "re-run assignment": "relancer l'assignation",
  "Assign exits automatically": "Assigner les sorties automatiquement",
  "Assignment strategy": "Stratégie d'assignation",
  "Stable per provider (keys stay on the same exit)":
    "Stable par fournisseur (les clés restent sur la même sortie)",
  "Rotate by provider order": "Tourner selon l'ordre des fournisseurs",
  "Fetch free proxies (Proxifly):": "Récupérer des proxys gratuits (Proxifly) :",
  "pulls Proxifly's public free list into the pool. It's free because it's public — open exit IPs shared by strangers, so expect them to be slower, flaky, sometimes already dead, and some providers block them on sight. With":
    "récupère la liste gratuite publique de Proxifly dans le pool. C'est gratuit parce que c'est public — des IP de sortie ouvertes partagées par des inconnus, donc attendez-vous à ce qu'elles soient plus lentes, instables, parfois déjà mortes, et certains fournisseurs les bloquent d'emblée. Avec",
  "on (default) every candidate is probed first and only exits that answer are imported. The":
    "activé (par défaut) chaque candidat est d'abord sondé et seules les sorties qui répondent sont importées. Le bouton",
  "button sweeps the pool and drops the ones that died since. Paste your own paid or residential proxies above for exits you can trust. (We're all poor here — but careful does it.)":
    "balaie le pool et retire celles qui sont mortes depuis. Collez vos propres proxys payants ou résidentiels ci-dessus pour des sorties fiables. (On est tous fauchés ici — mais la prudence, ça aide.)",
  "Pool size": "Taille du pool",
  "Providers covered": "Fournisseurs couverts",
  "key assignments": "assignations de clés",
  Saturated: "Saturés",
  "Every provider has enough distinct exits": "Chaque fournisseur a assez de sorties distinctes",
  "have more keys than the pool": "ont plus de clés que le pool",
  "Add proxy": "Ajouter un proxy",
  "The pool is empty, so every key currently leaves through this machine's own address. Add proxies above, or set":
    "Le pool est vide, donc chaque clé sort actuellement par la propre adresse de cette machine. Ajoutez des proxys ci-dessus, ou définissez",
  "to a comma-separated list before first start. COKEY cannot invent an exit IP, so an empty pool means direct egress.":
    "en liste séparée par des virgules avant le premier démarrage. COKEY ne peut pas inventer une IP de sortie, donc un pool vide signifie une sortie directe.",
  Exit: "Sortie",
  "Keys using it": "Clés qui l'utilisent",
  Enabled: "Activée",

  // ---- BulkProxyModal -------------------------------------------------------------
  "Nothing to add": "Rien à ajouter",
  "No new exits —": "Aucune nouvelle sortie —",
  "skipped (duplicate or invalid)": "ignorée(s) (doublon ou invalide)",
  exits: "sorties",
  skipped: "ignorée(s)",
  "Bulk add egress proxies": "Ajouter des proxys de sortie en masse",
  "One proxy per line. Credentials stay on the server; only host:port is ever shown.":
    "Un proxy par ligne. Les identifiants restent sur le serveur ; seul host:port est jamais affiché.",
  "Proxy URLs": "URL de proxy",
  "Paste one proxy per line.": "Collez un proxy par ligne.",
  line: "ligne",
  lines: "lignes",
  "pasted.": "collée(s).",
  "Add proxies": "Ajouter les proxys",

  // ---- About --------------------------------------------------------------------
  "a tool for broke lads made by a broke princess":
    "un outil pour les fauchés, fait par une princesse fauchée",
  "Pool the free API keys you already have into ordered chains, behind one OpenAI-compatible endpoint. When a key runs out, the next one takes over and the client never notices. It runs on your machine, encrypted at rest, and sends nothing anywhere.":
    "Réunissez les clés API gratuites que vous avez déjà en chaînes ordonnées, derrière un seul point de terminaison compatible OpenAI. Quand une clé s'épuise, la suivante prend le relais sans que le client s'en aperçoive. Ça tourne sur votre machine, chiffré au repos, et n'envoie rien nulle part.",
  "Source on GitHub": "Code source sur GitHub",
  Follow: "Suivre",
  Credits: "Crédits",
  "The provider and free-tier catalog is built in part from":
    "Le catalogue des fournisseurs et des paliers gratuits est construit en partie à partir de",
  "with thanks. Rate limits change constantly, so the ranking boards always name their source and let you decide.":
    "avec nos remerciements. Les limites de débit changent constamment, donc les classements nomment toujours leur source et vous laissent décider.",

  // ---- LoginForm ------------------------------------------------------------------
  "Sign in to manage the gateway": "Connectez-vous pour gérer la passerelle",
  Password: "Mot de passe",
  Default: "Par défaut",
  "change it in Settings and it is permanent.":
    "changez-le dans Paramètres et c'est permanent.",
  "Signing in…": "Connexion…",
  "Sign in": "Se connecter",

  // ---- StatusBar ------------------------------------------------------------------
  "Connected to the live event stream — this page updates as the gateway changes":
    "Connecté au flux d'évènements en direct — cette page se met à jour au fil des changements de la passerelle",
  "Event stream offline — falling back to a periodic refresh":
    "Flux d'évènements hors ligne — repli sur une actualisation périodique",
  offline: "hors ligne",
  "Connected providers": "Fournisseurs connectés",
  "Stored credentials": "Identifiants stockés",
  "Configured chains": "Chaînes configurées",
  "data directory": "répertoire de données",
  "data:": "données :",
  default: "par défaut",
  "Gateway version": "Version de la passerelle",
  "made by": "fait par",

  // ---- LiveStatus -----------------------------------------------------------------
  "Model changed": "Modèle changé",
  "Key changed": "Clé changée",
  was: "était",
  "no traffic yet": "pas encore de trafic",
  "A request is being routed right now": "Une requête est en cours de routage",
  "Last routed request": "Dernière requête routée",
  via: "via",
  "last error": "dernière erreur",
  "Routing feed": "Flux de routage",
  attempt: "tentative",
  "in flight": "en cours",
  updated: "mise à jour",
  "No routing activity yet.": "Aucune activité de routage pour l'instant.",

  // ---- Contact ------------------------------------------------------------------
  "Issues, pull requests and the source": "Tickets, pull requests et le code source",
  "Work and updates": "Travail et actualités",
  "Say hello": "Dire bonjour",
  Repository: "Dépôt",
  "Open source, MIT licensed": "Open source, licence MIT",

  // ---- Tutorial -------------------------------------------------------------------
  "Getting started": "Prise en main",
  "Connect two or three providers.": "Connectez deux ou trois fournisseurs.",
  "Open the Providers tab and paste a key for each. COKEY verifies every key before storing it, so a typo is caught immediately.":
    "Ouvrez l'onglet Fournisseurs et collez une clé pour chacun. COKEY vérifie chaque clé avant de la stocker, donc une faute de frappe est repérée immédiatement.",
  "Create one chain.": "Créez une chaîne.",
  "Chains, then": "Chaînes, puis",
  "Name it whatever you will type into your editor, for example":
    "Nommez-la comme vous la saisirez dans votre éditeur, par exemple",
  "Add nodes in the order you want them tried.": "Ajoutez des nœuds dans l'ordre où vous voulez qu'ils soient essayés.",
  "Each node is a provider plus a model plus the keys bound to it. Every key of a node is exhausted before the next node runs.":
    "Chaque nœud est un fournisseur plus un modèle plus les clés qui lui sont rattachées. Chaque clé d'un nœud est épuisée avant que le nœud suivant ne s'exécute.",
  "Press play in the Models tab.": "Appuyez sur lecture dans l'onglet Modèles.",
  "A green check means a real 200 came back through a real key, not that a database row says healthy.":
    "Une coche verte signifie qu'un vrai 200 est revenu via une vraie clé, pas qu'une ligne de base de données dit qu'elle est en bonne santé.",
  "Point your client at the gateway.": "Pointez votre client vers la passerelle.",
  "Use one of the recipes below. The base URL is always":
    "Utilisez l'une des recettes ci-dessous. L'URL de base est toujours",
  "Editor and CLI recipes": "Recettes éditeur et CLI",
  "Automatic egress proxies": "Proxys de sortie automatiques",
  "Provider limits are usually tracked per key": "Les limites des fournisseurs sont généralement suivies par clé",
  and: "et",
  "per IP, so rotating five keys from one address still trips the same limit. Fill the pool once and COKEY assigns the exits for you:":
    "par IP, donc faire tourner cinq clés depuis une seule adresse déclenche quand même la même limite. Remplissez le pool une fois et COKEY assigne les sorties pour vous :",
  "Every key of one provider gets a different exit IP.": "Chaque clé d'un fournisseur obtient une IP de sortie différente.",
  "Keys of different providers may share an entry, because nothing correlates them upstream.":
    "Les clés de différents fournisseurs peuvent partager une entrée, car rien ne les corrèle en amont.",
  "The mapping is stable across restarts, so a key does not appear to move cities every boot.":
    "L'association est stable entre les redémarrages, donc une clé ne semble pas changer de ville à chaque démarrage.",
  "A proxy you set by hand is never overwritten by the pool.": "Un proxy que vous définissez à la main n'est jamais écrasé par le pool.",
  "Add entries under Settings, Egress pool, or supply a comma-separated list through":
    "Ajoutez des entrées dans Paramètres, Pool de sortie, ou fournissez une liste séparée par des virgules via",
  copied: "copié",
  copy: "copier",

  CLI: "CLI",
  Editor: "Éditeur",
  "Editor extension": "Extension d'éditeur",
  "Agent framework": "Framework d'agent",

  "The reference client for this setup. Use the chain alias as the model, keep the provider named COKEY, and watch for the chain state notification when a node moves.":
    "Le client de référence pour cette configuration. Utilisez l'alias de la chaîne comme modèle, gardez le fournisseur nommé COKEY, et surveillez la notification d'état de chaîne quand un nœud change.",
  "Claude Code speaks the Anthropic wire format. Point its base URL at COKEY and it will use whichever chain you aliased, including failover.":
    "Claude Code parle le format Anthropic. Pointez son URL de base vers COKEY et il utilisera la chaîne que vous avez aliasée, avec repli inclus.",
  "Codex reads an OpenAI-compatible provider block from its config.":
    "Codex lit un bloc fournisseur compatible OpenAI depuis sa configuration.",
  "VS Code itself has no model setting, so the base URL goes in whichever AI extension you run. The two blocks below cover Copilot Chat's BYOK path and the generic OpenAI-compatible setting most extensions expose.":
    "VS Code lui-même n'a pas de réglage de modèle, donc l'URL de base va dans l'extension IA que vous utilisez. Les deux blocs ci-dessous couvrent le chemin BYOK de Copilot Chat et le réglage générique compatible OpenAI que la plupart des extensions exposent.",
  "Cursor accepts an OpenAI-compatible base URL in its model settings and verifies it with a test call.":
    "Cursor accepte une URL de base compatible OpenAI dans ses réglages de modèle et la vérifie avec un appel test.",
  "JetBrains AI Assistant and the plugin ecosystem both take a custom OpenAI-compatible endpoint under Settings, Tools, AI Assistant, Models.":
    "JetBrains AI Assistant et l'écosystème de plugins acceptent tous deux un point de terminaison personnalisé compatible OpenAI sous Settings, Tools, AI Assistant, Models.",
  "Cline, Roo Code and the forks built on it all use the same settings shape: an OpenAI-compatible provider plus a base URL.":
    "Cline, Roo Code et les forks construits dessus utilisent tous la même forme de réglages : un fournisseur compatible OpenAI plus une URL de base.",
  "Continue takes a YAML model block with an OpenAI-compatible provider.":
    "Continue prend un bloc de modèle YAML avec un fournisseur compatible OpenAI.",
  "Hermes Agent reads an OpenAI-compatible endpoint from its environment, so the base URL is the whole configuration.":
    "Hermes Agent lit un point de terminaison compatible OpenAI depuis son environnement, donc l'URL de base est toute la configuration.",
  "OpenClaw is configured with a provider map, same as opencode.":
    "OpenClaw se configure avec une carte de fournisseurs, comme opencode.",
  "Anything that can speak OpenAI-compatible chat completions works. These are the two environment variables almost every tool reads.":
    "Tout ce qui peut parler des complétions de chat compatibles OpenAI fonctionne. Voici les deux variables d'environnement que presque tous les outils lisent.",

  "Add COKEY as an OpenAI-compatible provider in your opencode config:":
    "Ajoutez COKEY comme fournisseur compatible OpenAI dans votre config opencode :",
  "Authenticate with the same placeholder. COKEY ignores it unless you also created a gateway API key:":
    "Authentifiez-vous avec le même espace réservé. COKEY l'ignore sauf si vous avez aussi créé une clé API de passerelle :",
  "Ask once, then watch the state line. Every switch prints a notification rather than an error:":
    "Demandez une fois, puis surveillez la ligne d'état. Chaque changement affiche une notification plutôt qu'une erreur :",
  "The provider name is COKEY on purpose. Set it that way and the model picker never mentions an upstream vendor, even when the answer came from one.":
    "Le nom du fournisseur est COKEY à dessein. Réglez-le ainsi et le sélecteur de modèle ne mentionne jamais un fournisseur en amont, même quand la réponse en vient.",
  "Export the base URL and a placeholder key for the session:":
    "Exportez l'URL de base et une clé espace réservé pour la session :",
  "Start it as usual and select the chain alias when asked for a model:":
    "Démarrez-le comme d'habitude et sélectionnez l'alias de la chaîne quand un modèle est demandé :",
  "If your version also sends a beta header the gateway does not recognise, COKEY forwards unknown headers upstream untouched, so nothing breaks.":
    "Si votre version envoie aussi un en-tête bêta que la passerelle ne reconnaît pas, COKEY transmet les en-têtes inconnus en amont sans y toucher, donc rien ne casse.",
  "Add a provider entry in ~/.codex/config.toml:": "Ajoutez une entrée fournisseur dans ~/.codex/config.toml :",
  "Set the placeholder key the config refers to:": "Définissez la clé espace réservé référencée par la config :",
  "Open Settings and search for the extension's API base URL field, or set it in settings.json:":
    "Ouvrez Settings et cherchez le champ URL de base API de l'extension, ou définissez-le dans settings.json :",
  "Reload the window. The model picker gains a COKEY entry using your chain alias.":
    "Rechargez la fenêtre. Le sélecteur de modèle gagne une entrée COKEY utilisant l'alias de votre chaîne.",
  "Extension setting names change between releases. The value is always the same three things: base URL, placeholder key, chain alias.":
    "Les noms des réglages d'extension changent d'une version à l'autre. La valeur, c'est toujours les trois mêmes choses : URL de base, clé espace réservé, alias de chaîne.",
  "Settings, Models, then add an OpenAI-compatible model:":
    "Settings, Models, puis ajoutez un modèle compatible OpenAI :",
  "Press Verify. Cursor issues a small completion through COKEY, which is exactly what the play button in the Models tab does.":
    "Appuyez sur Vérifier. Cursor émet une petite complétion via COKEY, ce qui est exactement ce que fait le bouton lecture de l'onglet Modèles.",
  "Turn off any 'override OpenAI base URL' setting you may have enabled for another proxy, or the two will fight.":
    "Désactivez tout réglage « override OpenAI base URL » que vous auriez activé pour un autre proxy, sinon les deux vont se battre.",
  "Add a custom model provider:": "Ajoutez un fournisseur de modèle personnalisé :",
  "Apply, then run any inline AI action to confirm traffic reaches the gateway.":
    "Appliquez, puis lancez n'importe quelle action IA en ligne pour confirmer que le trafic atteint la passerelle.",
  "In the extension settings choose API Provider: OpenAI Compatible.":
    "Dans les réglages de l'extension choisissez API Provider : OpenAI Compatible.",
  "Enable 'model supports images' only if your chain's model does. COKEY forwards the request either way.":
    "Activez « model supports images » seulement si le modèle de votre chaîne le supporte. COKEY transmet la requête dans les deux cas.",
  "Agentic extensions send tools and structured output. Drop providers that fail structured output from your chain, or a tool call will break mid-task.":
    "Les extensions agentiques envoient des outils et de la sortie structurée. Retirez de votre chaîne les fournisseurs qui échouent sur la sortie structurée, sinon un appel d'outil cassera en plein milieu d'une tâche.",
  "Add the model to ~/.continue/config.yaml:": "Ajoutez le modèle à ~/.continue/config.yaml :",
  "Reload Continue. The model appears in the chat and autocomplete pickers.":
    "Rechargez Continue. Le modèle apparaît dans les sélecteurs de chat et d'autocomplétion.",
  "Export the endpoint and a placeholder key before launching:":
    "Exportez le point de terminaison et une clé espace réservé avant de lancer :",
  "Long tool-calling loops benefit most from failover: raise maxRetriesPerCredential in Settings if a run keeps hitting one provider's limit.":
    "Les longues boucles d'appels d'outils profitent le plus du repli : augmentez maxRetriesPerCredential dans Paramètres si une exécution bute sans cesse sur la limite d'un fournisseur.",
  "Register COKEY as an OpenAI-compatible provider:": "Enregistrez COKEY comme fournisseur compatible OpenAI :",
  "Restart the agent and confirm the first request shows up in the Usage tab.":
    "Redémarrez l'agent et vérifiez que la première requête apparaît dans l'onglet Utilisation.",
  "Set the generic variables:": "Définissez les variables génériques :",
  "Verify the endpoint by hand with curl. A 200 here means the gateway, not the client, is the next thing to look at:":
    "Vérifiez le point de terminaison à la main avec curl. Un 200 ici signifie que c'est la passerelle, pas le client, qu'il faut examiner ensuite :",
  "List what COKEY currently serves, owned by COKEY rather than the upstream vendor:":
    "Listez ce que COKEY sert actuellement, la réponse venant de COKEY plutôt que du fournisseur en amont :",

  // ---- Terms ----------------------------------------------------------------------
  "Terms of service": "Conditions d'utilisation",
  "The short version: COKEY is a local tool, the keys are yours, the providers' rules come first, and legal problems between you and a provider are yours to resolve.":
    "En bref : COKEY est un outil local, les clés sont les vôtres, les règles des fournisseurs priment, et les problèmes juridiques entre vous et un fournisseur sont à régler par vous.",
  "In one sentence": "En une phrase",
  "You are responsible for the keys you add, you agree to respect each provider's own terms and limits, and you accept that the author is not liable for how you use their software or for any consequences that follow from it. If a dispute arises with a provider, it is between you and that provider.":
    "Vous êtes responsable des clés que vous ajoutez, vous acceptez de respecter les conditions et limites propres à chaque fournisseur, et vous acceptez que l'autrice ne soit pas responsable de l'usage que vous faites de son logiciel ni des conséquences qui en découlent. Si un litige survient avec un fournisseur, il est entre vous et ce fournisseur.",
  "Contact the creator": "Contacter la créatrice",
  "COKEY is built and maintained by one person,": "COKEY est construit et maintenu par une seule personne,",
  "Bug reports, provider tips, a free tier that changed under you, and pull requests are all welcome - the software is MIT licensed and the source is public. If a provider changed its limits, the fastest fix is a pull request against the catalog rather than an issue.":
    "Rapports de bugs, tuyaux sur les fournisseurs, un palier gratuit qui a changé sous vos pieds, et les pull requests sont tous les bienvenus - le logiciel est sous licence MIT et le code source est public. Si un fournisseur a changé ses limites, le correctif le plus rapide est une pull request contre le catalogue plutôt qu'un ticket.",

  "What COKEY is": "Ce qu'est COKEY",
  [`COKEY is a **local gateway that runs on your machine**. It stores API keys you
already own, encrypts them at rest, and exposes one OpenAI-compatible endpoint
that rotates between them.

It does not create accounts, buy credits, or hold funds on your behalf. There is
no service behind it to sign up to, and nobody is running a COKEY server that
your requests travel through.`]: `COKEY est une **passerelle locale qui tourne sur votre machine**. Elle stocke les clés API
que vous possédez déjà, les chiffre au repos, et expose un point de terminaison compatible OpenAI
qui tourne entre elles.

Elle ne crée pas de comptes, n'achète pas de crédits, et ne détient pas de fonds en votre nom. Il n'y a
aucun service derrière auquel s'inscrire, et personne ne fait tourner un serveur COKEY par lequel
vos requêtes transiteraient.`,

  "Your keys, your responsibility": "Vos clés, votre responsabilité",
  [`Every credential in this pool belongs to an account **you** control.

You are responsible for:

- obtaining those keys lawfully;
- the accuracy of the account information you store;
- anything a request made with them does upstream.

The author of COKEY is not a party to any agreement between you and a provider.
Adding a key is you acting on your own account, in your own name, under your own
agreement with that provider.`]: `Chaque identifiant de ce pool appartient à un compte que **vous** contrôlez.

Vous êtes responsable :

- d'obtenir ces clés légalement ;
- de l'exactitude des informations de compte que vous stockez ;
- de ce que fait en amont toute requête effectuée avec elles.

L'autrice de COKEY n'est partie à aucun accord entre vous et un fournisseur.
Ajouter une clé, c'est vous qui agissez sur votre propre compte, en votre nom propre, sous votre propre
accord avec ce fournisseur.`,

  "Provider terms come first": "Les conditions du fournisseur priment",
  [`Providers set the rules for their own free tiers: rate limits, permitted uses,
how many accounts one person may hold, and whether automated routing is allowed
at all.

**Where COKEY's behaviour and a provider's terms disagree, the provider's terms
win.** It is your job to know them before you add a key.

Using COKEY to evade a provider's limits is not a supported use. Rotation exists
so that a rate limit on one key does not take down your own legitimate traffic;
it is not a way to obtain more capacity than the provider has offered you.`]: `Les fournisseurs fixent les règles de leurs propres paliers gratuits : limites de débit, usages
permis, combien de comptes une personne peut détenir, et si le routage automatisé est autorisé
du tout.

**Là où le comportement de COKEY et les conditions d'un fournisseur divergent, les conditions du
fournisseur l'emportent.** C'est à vous de les connaître avant d'ajouter une clé.

Utiliser COKEY pour contourner les limites d'un fournisseur n'est pas un usage pris en charge. La
rotation existe pour qu'une limite de débit sur une clé ne fasse pas tomber votre propre trafic
légitime ; ce n'est pas un moyen d'obtenir plus de capacité que celle offerte par le fournisseur.`,

  "No warranty": "Aucune garantie",
  [`COKEY is provided **as is**, without warranty of any kind.

It may route a request to a provider that is down, report a limit number the
provider has since changed, or lose a cooldown window. Rate limits, quotas and
latency figures shown in the dashboard are what a provider publishes — and
published numbers drift.

Nothing here is a guarantee of availability, correctness or fitness for a
particular purpose.`]: `COKEY est fourni **tel quel**, sans garantie d'aucune sorte.

Il peut router une requête vers un fournisseur qui est en panne, rapporter un chiffre de limite que
le fournisseur a depuis changé, ou perdre une fenêtre de pause. Les limites de débit, quotas et
chiffres de latence affichés dans le tableau de bord sont ceux publiés par un fournisseur — et
les chiffres publiés dérivent.

Rien ici n'est une garantie de disponibilité, d'exactitude ou d'adéquation à un usage
particulier.`,

  "Limitation of liability": "Limitation de responsabilité",
  [`To the extent permitted by law, the author is not liable for any indirect,
incidental or consequential loss arising from your use of COKEY.

That includes, without limitation:

- lost credits or paid capacity;
- suspended or terminated provider accounts;
- failed, delayed or misrouted requests;
- prompts or responses exposed by a provider;
- legal trouble with a third party.

You agree to use the software at your own risk, and to resolve any dispute with
a provider directly with that provider.`]: `Dans la mesure permise par la loi, l'autrice n'est pas responsable de toute perte indirecte,
accessoire ou consécutive résultant de votre usage de COKEY.

Cela inclut, sans s'y limiter :

- crédits perdus ou capacité payante ;
- comptes fournisseurs suspendus ou résiliés ;
- requêtes échouées, retardées ou mal routées ;
- prompts ou réponses exposés par un fournisseur ;
- ennuis juridiques avec un tiers.

Vous acceptez d'utiliser le logiciel à vos propres risques, et de résoudre tout litige avec
un fournisseur directement avec ce fournisseur.`,

  "No monitoring, no telemetry": "Aucune surveillance, aucune télémétrie",
  [`COKEY has **no analytics, no phone-home, and no server component you did not
start yourself**.

Everything is stored in a local SQLite database under your data directory. Your
keys, your prompts, your request history and your provider catalog live on your
disk and nowhere else.

The dashboard's own fonts and icons are served from the gateway rather than a
CDN, for the same reason: rendering a page should not tell a third party that
you opened it.

If you join a community to ask a question, you choose what to share.`]: `COKEY n'a **aucune analytique, aucune communication vers l'extérieur, et aucun composant serveur
que vous n'avez pas démarré vous-même**.

Tout est stocké dans une base de données SQLite locale sous votre répertoire de données. Vos
clés, vos prompts, votre historique de requêtes et votre catalogue de fournisseurs vivent sur votre
disque et nulle part ailleurs.

Les polices et icônes du tableau de bord sont servies depuis la passerelle plutôt qu'un
CDN, pour la même raison : afficher une page ne devrait pas dire à un tiers que
vous l'avez ouverte.

Si vous rejoignez une communauté pour poser une question, vous choisissez ce que vous partagez.`,

  "Acceptable use": "Usage acceptable",
  [`Do not use COKEY to:

- attack, probe or overload a provider;
- resell free capacity as a paid service;
- circumvent an account ban;
- do anything unlawful in your jurisdiction or the provider's.

The automatic egress pool exists so that one provider's per-IP limit does not
collapse your own legitimate traffic — not as a means of disguising abusive
volume. Spreading abuse across exits is still abuse.`]: `N'utilisez pas COKEY pour :

- attaquer, sonder ou surcharger un fournisseur ;
- revendre de la capacité gratuite comme un service payant ;
- contourner un bannissement de compte ;
- faire quoi que ce soit d'illégal dans votre juridiction ou celle du fournisseur.

Le pool de sortie automatique existe pour qu'une limite par IP d'un fournisseur ne fasse pas
s'effondrer votre propre trafic légitime — pas comme un moyen de déguiser un
volume abusif. Répartir l'abus sur plusieurs sorties reste de l'abus.`,

  Changes: "Modifications",
  [`These terms may change with the software. Continuing to use a new version means
accepting the terms that ship with it.

Because this repository is public and versioned, the exact wording at any point
in the project's history is one \`git log\` away:

\`\`\`bash
git log --follow -p src/web/pages/Terms.tsx
\`\`\`

The version you are running is shown in the gateway's status bar.`]: `Ces conditions peuvent changer avec le logiciel. Continuer à utiliser une nouvelle version signifie
accepter les conditions qui l'accompagnent.

Comme ce dépôt est public et versionné, le libellé exact à n'importe quel moment
de l'historique du projet est à un \`git log\` de distance :

\`\`\`bash
git log --follow -p src/web/pages/Terms.tsx
\`\`\`

La version que vous utilisez est affichée dans la barre d'état de la passerelle.`,

  // ---- Gap-fill pass (found by cross-checking every t() call against the dictionary) --
  "Add this model to a chain": "Ajouter ce modèle à une chaîne",
  "answered 200": "a répondu 200",
  "Ask every connected provider what it serves right now":
    "Demander à chaque fournisseur connecté ce qu'il sert actuellement",
  "checking…": "vérification…",
  Clear: "Effacer",
  "did not answer:": "n'a pas répondu :",
  dismissed: "ignorée",
  exhausted: "épuisée",
  "is working": "fonctionne",
  "Keys bound to this node": "Clés rattachées à ce nœud",
  Models: "Modèles",
  "no response": "aucune réponse",
  Rankings: "Classements",
  "re-check all": "tout revérifier",
  "re-check models": "revérifier les modèles",
  "replied:": "a répondu :",
  Success: "Réussite",

  // ---- Insights flash cards -------------------------------------------------------
  Dismiss: "Ignorer",
  'That key came back invalid. Worth a double-check for a stray trailing space or newline from a copy-paste - a surprising number of "invalid key" errors are exactly that.':
    "Cette clé est ressortie invalide. Vérifiez qu'il n'y a pas d'espace ou de retour à la ligne superflu venant d'un copier-coller - beaucoup d'erreurs « clé invalide » viennent exactement de là.",
  "Rate-limited already? If this key shares an exit IP with others on the same provider, an egress pool gives each one its own IP - Settings → Automatic egress pool.":
    "Déjà limitée en débit ? Si cette clé partage une IP de sortie avec d'autres du même fournisseur, un pool d'égress donne une IP propre à chacune - Paramètres → Pool d'égress automatique.",
  "Quota's gone for this key. If you were testing several keys back-to-back, some providers count verification calls against the same daily quota as real traffic.":
    "Le quota de cette clé est épuisé. Si vous testiez plusieurs clés à la suite, certains fournisseurs comptent les appels de vérification dans le même quota journalier que le trafic réel.",
  "Couldn't reach the provider at all. If you're behind a VPN or a proxy, that's usually the first thing to check.":
    "Impossible de joindre le fournisseur. Si vous êtes derrière un VPN ou un proxy, c'est généralement la première chose à vérifier.",
  "The provider hiccuped (5xx) - that's usually about them, not your key. Worth a retry in a moment.":
    "Le fournisseur a eu un raté (5xx) - ça vient généralement d'eux, pas de votre clé. Ça vaut le coup de réessayer dans un instant.",
  "That model isn't reachable through this key right now. Some providers gate free models per account rather than per key.":
    "Ce modèle n'est pas accessible avec cette clé pour le moment. Certains fournisseurs limitent les modèles gratuits par compte plutôt que par clé.",
  "That request was too big for the model's context window - rotating keys won't help here, only a shorter prompt will.":
    "Cette requête était trop grande pour la fenêtre de contexte du modèle - changer de clé n'y changera rien, seul un message plus court le peut.",
  "The provider rejected the request shape itself, not the key - check the model name matches what the provider actually serves.":
    "Le fournisseur a rejeté la forme de la requête elle-même, pas la clé - vérifiez que le nom du modèle correspond à ce que le fournisseur sert réellement.",
  "Testing a lot of keys back-to-back? A few providers count verification calls against the same quota as real traffic - worth pacing it out if you'll need them soon.":
    "Vous testez beaucoup de clés à la suite ? Certains fournisseurs comptent les appels de vérification dans le même quota que le trafic réel - mieux vaut étaler un peu si vous en aurez besoin bientôt.",
  "Checking every model in a row can eat into a provider's daily quota faster than real usage would. Consider testing just the ones you're about to chain.":
    "Vérifier tous les modèles à la suite peut entamer le quota journalier d'un fournisseur plus vite qu'un usage réel. Testez plutôt seulement ceux que vous allez chaîner.",
};
