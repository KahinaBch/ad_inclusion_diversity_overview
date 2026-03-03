# GBM6330E Final Project (Quarto + GitHub Pages)

**Topic:** *Inclusion of diversity in the prevention and diagnosis of neurodegenerative diseases — the example of Alzheimer’s disease.*

This repository is a **Quarto website** designed to be published with **GitHub Pages**, and includes an **Interactive Explorer** (map + “person in a city” diagram) to navigate diversity-related Alzheimer’s datasets and initiatives.

---

## What’s inside

- `part1/` – Narrative chapters (Part I)
- `part2/` – Part II + **Interactive Explorer**
- `geo/` – Dynamic “View more” pages (country + continent), driven by query parameters
- `data/` – JSON + GeoJSON used by the interactive components
- `assets/` – CSS, JS, images (including the SVG diagram)
- `.github/workflows/publish.yml` – GitHub Actions workflow to build & publish to GitHub Pages

---

## Publish on GitHub Pages (recommended path)

This project uses a GitHub Action that builds the site and publishes it to a **`gh-pages`** branch.

1. Push this repository to GitHub (to your `main` branch).
2. In your repo, go to:
   - **Settings → Pages**
   - **Build and deployment → Source**: select **Deploy from a branch**
   - Branch: `gh-pages` / folder: `/ (root)`
3. Go to **Actions** tab and confirm the workflow runs after your push to `main`.

### If the workflow fails with a permissions error
In GitHub:
- **Settings → Actions → General → Workflow permissions**
- Choose **Read and write permissions**

---

## Local preview (optional)

If you have Quarto installed locally:

```bash
quarto preview
```

---

## Editing the interactive content (your main knobs)

### Dataset catalog
Edit:
- `data/datasets.json`

Each dataset has:
- `id`, `name`
- `modalities` (e.g., `neuroimaging`, `genetics`, `proteomics`, `exposomics`)
- `countries` (ISO3 codes, e.g., `USA`, `CAN`, `FRA`)
- `access`, `link`, `notes` (free text)

### Region summaries (what users see in the info panel)
Edit:
- `data/region_summaries.json`

This file powers:
- the brief “overview” shown in the Explorer right panel
- the detailed “View more” pages:
  - `geo/country/?iso3=USA`
  - `geo/continent/?continent=Europe`

---

## “Original research” repos (to be created separately)

The hub site expects you to add links to three external, reproducible repositories:

1. Datasets catalog repo
2. Atlases + harmonisation pipelines repo
3. Alzheimer’s & Dementia journal reproducibility study repo

Update:
- `original-research/index.qmd`

---

## Notes

- The Leaflet library is loaded from a CDN (pinned to Leaflet 1.9.4).
- Base map tiles use OpenStreetMap (with attribution).
- Country boundaries are Natural Earth 1:110m GeoJSON.

See `attribution.qmd` for details.

