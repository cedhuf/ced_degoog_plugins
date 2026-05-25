# ced_degoog_plugins

Extensions [Degoog](https://github.com/degoog-org/degoog) par [@cedhuf](https://github.com/cedhuf).

> Intégrations self-hosted pensées pour un homelab — privacy-first, zero cloud, tout sous contrôle.

## Ajouter ce repo dans Degoog

**Settings → Store → Add** puis coller :

```
https://github.com/cedhuf/ced_degoog_plugins.git
```

Ensuite **Browse** → choisir l'extension → **Install** → **Configure**.

---

## Extensions disponibles

### 🔍 Hister

Intègre [Hister](https://github.com/asciimoo/hister) — votre moteur de recherche full-text personnel — directement dans Degoog.

| Capacité | Description |
|---|---|
| **Slot** | Panel « Dans votre index » au-dessus des résultats (position configurable) |
| **Intercepteur** | Si Hister a ≥ N résultats, les moteurs externes sont supprimés |
| **Moteur natif** | Hister apparaît comme moteur Degoog (résultats mélangés ou onglet dédié) |

**Prérequis :** Degoog ≥ 0.17.0 · Hister (toute version récente)

**Configuration :**

| Paramètre | Description | Défaut |
|---|---|---|
| URL Hister | `http://hister:8080` | *(requis)* |
| Clé API | API key si l'instance est protégée | *(optionnel)* |
| Slot activé | Afficher le panel dans les résultats | ✅ |
| Position du slot | above-results / below-results / knowledge-panel / above-sidebar | `above-results` |
| Intercepteur activé | Supprimer moteurs externes si Hister a assez de résultats | ❌ |
| Seuil intercepteur | Nombre minimum de résultats pour déclencher l'intercepteur | `5` |
| Moteur activé | Enregistrer Hister comme moteur Degoog | ❌ |

---

## Structure du repo

```
ced_degoog_plugins/
├── package.json          ← déclaration Store Degoog
├── README.md
├── logo.png
├── screenshots/          ← captures pour le Store
└── plugins/
    └── hister/
        ├── index.js      ← slot + interceptor + engine
        ├── style.css     ← styles scopés (variables CSS Degoog)
        └── author.json
```

*Les dossiers `themes/`, `engines/`, `transports/` sont prêts pour de futures extensions.*

## Licence

MIT
