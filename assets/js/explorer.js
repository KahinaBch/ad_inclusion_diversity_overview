/* global L */

(function () {
  const ROOT = (window.AD_DIVERSITY_ROOT || ".").replace(/\/$/, "");

  const PATHS = {
    datasets: `${ROOT}/data/datasets.json`,
    summaries: `${ROOT}/data/region_summaries.json`,
    modalityMeta: `${ROOT}/data/modality_meta.json`,
    countriesGeo: `${ROOT}/data/geo/countries_110m.geojson`,
    continentsGeo: `${ROOT}/data/geo/continents.geojson`
  };

  const state = {
    mode: "countries", // countries | continents
    modality: "all",
    datasets: [],
    summaries: { countries: {}, continents: {} },
    modalityMeta: {},
    countriesGeo: null,
    continentsGeo: null,
    iso3ToContinent: new Map(),
    iso3ToCountryName: new Map(),
    countsCountry: new Map(),
    countsContinent: new Map(),
    map: null,
    layers: {
      countries: null,
      continents: null
    },
    selected: null // { type: 'country'|'continent', id, name }
  };

  // ----------------------------
  // Utilities
  // ----------------------------

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return res.json();
  }

  function normaliseDatasets(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.datasets)) return payload.datasets;
    return [];
  }

  function datasetMatchesModality(ds, modality) {
    const mods = Array.isArray(ds.modalities) ? ds.modalities : [];
    if (modality === "all") return true;

    if (modality === "genetics_proteomics") {
      return mods.includes("genetics") || mods.includes("proteomics");
    }

    return mods.includes(modality);
  }

  function computeCountryCounts(modality) {
    const counts = new Map();
    for (const ds of state.datasets) {
      if (!datasetMatchesModality(ds, modality)) continue;
      const countries = Array.isArray(ds.countries) ? ds.countries : [];
      for (const iso3 of countries) {
        counts.set(iso3, (counts.get(iso3) || 0) + 1);
      }
    }
    return counts;
  }

  function computeContinentCounts(modality) {
    // Count datasets per continent (each dataset counts max once per continent).
    const counts = new Map();
    for (const ds of state.datasets) {
      if (!datasetMatchesModality(ds, modality)) continue;

      const countries = Array.isArray(ds.countries) ? ds.countries : [];
      const seen = new Set();
      for (const iso3 of countries) {
        const cont = state.iso3ToContinent.get(iso3);
        if (cont) seen.add(cont);
      }
      for (const cont of seen) {
        counts.set(cont, (counts.get(cont) || 0) + 1);
      }
    }
    return counts;
  }

  function getFillColor(count) {
    // Light → darker scale.
    if (count >= 10) return "#1f77b4";
    if (count >= 6) return "#4c93c4";
    if (count >= 3) return "#7fb3d8";
    if (count >= 1) return "#b8d6ea";
    return "#f8f9fa";
  }

  function getFillOpacity(count) {
    if (count >= 1) return 0.78;
    return 0.18;
  }

  function modalityLabel(modalityKey) {
    const meta = state.modalityMeta?.[modalityKey];
    return meta?.label || modalityKey;
  }

  function selectedSummary() {
    if (!state.selected) return null;
    if (state.selected.type === "country") {
      return state.summaries?.countries?.[state.selected.id] || null;
    }
    if (state.selected.type === "continent") {
      return state.summaries?.continents?.[state.selected.id] || null;
    }
    return null;
  }

  function regionDatasetList({ type, id, limit = 6 }) {
    const out = [];
    for (const ds of state.datasets) {
      if (!datasetMatchesModality(ds, state.modality)) continue;

      if (type === "country") {
        if ((ds.countries || []).includes(id)) out.push(ds);
      } else if (type === "continent") {
        const countries = ds.countries || [];
        const has = countries.some((iso3) => state.iso3ToContinent.get(iso3) === id);
        if (has) out.push(ds);
      }
    }
    out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return out.slice(0, limit);
  }

  // ----------------------------
  // Leaflet styles + events
  // ----------------------------

  function styleCountry(feature) {
    const iso3 = feature?.properties?.ADM0_A3;
    const count = state.countsCountry.get(iso3) || 0;

    return {
      fillColor: getFillColor(count),
      fillOpacity: getFillOpacity(count),
      weight: 1,
      opacity: 1,
      color: "rgba(33, 37, 41, 0.18)"
    };
  }

  function styleContinent(feature) {
    const name = feature?.properties?.CONTINENT;
    const count = state.countsContinent.get(name) || 0;

    return {
      fillColor: getFillColor(count),
      fillOpacity: getFillOpacity(count),
      weight: 1,
      opacity: 1,
      color: "rgba(33, 37, 41, 0.18)"
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 2,
      color: "rgba(13, 59, 102, 0.70)",
      fillOpacity: Math.min(0.92, (layer.options.fillOpacity || 0.5) + 0.10)
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  function resetHighlightCountry(e) {
    state.layers.countries.resetStyle(e.target);
  }

  function resetHighlightContinent(e) {
    state.layers.continents.resetStyle(e.target);
  }

  function zoomToLayer(layer) {
    try {
      const bounds = layer.getBounds();
      if (!bounds || !bounds.isValid()) return;
      state.map.fitBounds(bounds, { padding: [30, 30] });
    } catch (_) {
      // Ignore
    }
  }

  function onEachCountry(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlightCountry,
      click: () => {
        const iso3 = feature?.properties?.ADM0_A3;
        const name = feature?.properties?.ADMIN || feature?.properties?.NAME || iso3;

        state.selected = { type: "country", id: iso3, name: name };
        updateInfoPanel();
        zoomToLayer(layer);
      }
    });
  }

  function onEachContinent(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlightContinent,
      click: () => {
        const name = feature?.properties?.CONTINENT;

        state.selected = { type: "continent", id: name, name: name };
        updateInfoPanel();
        zoomToLayer(layer);
      }
    });
  }

  // ----------------------------
  // UI rendering
  // ----------------------------

  function renderLegend() {
    const el = document.getElementById("legend");
    if (!el) return;

    // Keep it compact; show bins.
    const bins = [
      { label: "0", count: 0 },
      { label: "1–2", count: 1 },
      { label: "3–5", count: 3 },
      { label: "6–9", count: 6 },
      { label: "10+", count: 10 }
    ];

    const html = bins
      .map(
        (b) =>
          `<span style="margin-right:0.6rem"><span class="legend-swatch" style="background:${getFillColor(
            b.count
          )}"></span>${escapeHtml(b.label)}</span>`
      )
      .join("");

    el.innerHTML = `<span style="margin-right:0.5rem"><strong>Datasets</strong></span>${html}`;
  }

  function renderInfoPanelEmpty() {
    const panel = document.getElementById("infoPanel");
    if (!panel) return;

    panel.innerHTML = `
      <h3 class="info-title" style="margin-top:0">Click a region</h3>
      <div class="info-meta">Mode: ${escapeHtml(state.mode)} • Modality: ${escapeHtml(modalityLabel(state.modality))}</div>
      <div class="small-muted">
        Choose a modality (left), then click a country/continent on the map.
      </div>
    `;
  }

  function updateInfoPanel() {
    const panel = document.getElementById("infoPanel");
    if (!panel) return;

    if (!state.selected) {
      renderInfoPanelEmpty();
      return;
    }

    const modality = state.modality;
    const mode = state.mode;

    let count = 0;
    let viewMoreHref = "#";

    if (state.selected.type === "country") {
      count = state.countsCountry.get(state.selected.id) || 0;
      viewMoreHref = `${ROOT}/geo/country/?iso3=${encodeURIComponent(state.selected.id)}`;
    } else if (state.selected.type === "continent") {
      count = state.countsContinent.get(state.selected.id) || 0;
      viewMoreHref = `${ROOT}/geo/continent/?continent=${encodeURIComponent(state.selected.id)}`;
    }

    const summary = selectedSummary();
    const summaryText = summary?.summary
      ? `<p>${escapeHtml(summary.summary)}</p>`
      : `<p class="small-muted">No summary yet for this region. Add one in <code>data/region_summaries.json</code>.</p>`;

    const highlights = Array.isArray(summary?.highlights) ? summary.highlights : [];
    const initiatives = Array.isArray(summary?.initiatives) ? summary.initiatives : [];

    const highlightHtml =
      highlights.length > 0
        ? `<h4 style="margin-top:0.9rem">Highlights</h4><ul class="info-list">${highlights
            .slice(0, 5)
            .map((h) => `<li>${escapeHtml(h)}</li>`)
            .join("")}</ul>`
        : "";

    const initiativesHtml =
      initiatives.length > 0
        ? `<h4 style="margin-top:0.9rem">Initiatives (starter)</h4><ul class="info-list">${initiatives
            .slice(0, 5)
            .map((h) => `<li>${escapeHtml(h)}</li>`)
            .join("")}</ul>`
        : "";

    const dsList = regionDatasetList({ type: state.selected.type, id: state.selected.id, limit: 6 });

    const dsHtml =
      dsList.length > 0
        ? `<h4 style="margin-top:0.9rem">Datasets (matching current modality)</h4>
           <ul class="info-list">${dsList
             .map((ds) => {
               const name = escapeHtml(ds.name || ds.id || "dataset");
               const link = ds.link ? escapeHtml(ds.link) : "";
               return link
                 ? `<li><a href="${link}" target="_blank" rel="noopener">${name}</a></li>`
                 : `<li>${name}</li>`;
             })
             .join("")}</ul>
           <div class="small-muted">Full catalog: <a href="${ROOT}/part2/datasets.html">Datasets overview</a></div>`
        : `<div class="small-muted" style="margin-top:0.6rem">No datasets in the starter catalog match this selection.</div>`;

    panel.innerHTML = `
      <h3 class="info-title" style="margin-top:0">${escapeHtml(state.selected.name)}</h3>
      <div class="info-meta">Mode: ${escapeHtml(mode)} • Modality: ${escapeHtml(modalityLabel(modality))} • <strong>${count}</strong> dataset(s)</div>
      ${summaryText}
      <p><a class="btn btn-sm btn-primary" href="${viewMoreHref}">View more</a></p>
      ${highlightHtml}
      ${initiativesHtml}
      ${dsHtml}
    `;
  }

  function setMode(mode) {
    if (mode !== "countries" && mode !== "continents") return;

    state.mode = mode;

    const btnCountries = document.getElementById("modeCountries");
    const btnContinents = document.getElementById("modeContinents");
    if (btnCountries && btnContinents) {
      btnCountries.classList.toggle("active", mode === "countries");
      btnContinents.classList.toggle("active", mode === "continents");
    }

    if (state.map && state.layers.countries && state.layers.continents) {
      if (mode === "countries") {
        if (state.map.hasLayer(state.layers.continents)) state.map.removeLayer(state.layers.continents);
        if (!state.map.hasLayer(state.layers.countries)) state.layers.countries.addTo(state.map);
      } else {
        if (state.map.hasLayer(state.layers.countries)) state.map.removeLayer(state.layers.countries);
        if (!state.map.hasLayer(state.layers.continents)) state.layers.continents.addTo(state.map);
      }
    }

    // Clear selection when switching modes to avoid confusion.
    state.selected = null;
    updateInfoPanel();
  }

  function setModality(modality) {
    state.modality = modality;

    // UI: highlight active button
    document.querySelectorAll(".modality-buttons button[data-modality]").forEach((btn) => {
      const isActive = btn.getAttribute("data-modality") === modality;
      btn.classList.toggle("active", isActive);
    });

    // Recompute counts, restyle layers.
    state.countsCountry = computeCountryCounts(modality);
    state.countsContinent = computeContinentCounts(modality);

    if (state.layers.countries) state.layers.countries.setStyle(styleCountry);
    if (state.layers.continents) state.layers.continents.setStyle(styleContinent);

    renderLegend();
    updateInfoPanel();
  }

  function wireSvgHotspots() {
    const obj = document.getElementById("personObject");
    if (!obj) return;

    obj.addEventListener("load", () => {
      const svgDoc = obj.contentDocument;
      if (!svgDoc) return;

      const head = svgDoc.getElementById("head");
      const arm = svgDoc.getElementById("arm_vein");
      const env = svgDoc.getElementById("environment");

      if (head) head.addEventListener("click", () => setModality("neuroimaging"));
      if (arm) arm.addEventListener("click", () => setModality("genetics_proteomics"));
      if (env) env.addEventListener("click", () => setModality("exposomics"));

      // Basic keyboard support inside the SVG object
      [head, arm, env].forEach((el) => {
        if (!el) return;
        el.setAttribute("tabindex", "0");
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            el.dispatchEvent(new MouseEvent("click"));
          }
        });
      });
    });
  }

  function wireControls() {
    const btnCountries = document.getElementById("modeCountries");
    const btnContinents = document.getElementById("modeContinents");

    if (btnCountries) btnCountries.addEventListener("click", () => setMode("countries"));
    if (btnContinents) btnContinents.addEventListener("click", () => setMode("continents"));

    document.querySelectorAll(".modality-buttons button[data-modality]").forEach((btn) => {
      btn.addEventListener("click", () => setModality(btn.getAttribute("data-modality")));
    });

    wireSvgHotspots();
  }

  function buildIso3Maps() {
    state.iso3ToContinent.clear();
    state.iso3ToCountryName.clear();

    for (const feat of state.countriesGeo?.features || []) {
      const p = feat.properties || {};
      const iso3 = p.ADM0_A3;
      const cont = p.CONTINENT;
      const name = p.ADMIN || p.NAME || iso3;

      if (iso3) {
        state.iso3ToContinent.set(iso3, cont);
        state.iso3ToCountryName.set(iso3, name);
      }
    }
  }

  function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) throw new Error("Map container #map not found.");

    state.map = L.map(mapEl, {
      scrollWheelZoom: true,
      worldCopyJump: true
    }).setView([20, 0], 2);

    // Base layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 8,
      attribution: "© OpenStreetMap contributors"
    }).addTo(state.map);

    state.layers.countries = L.geoJSON(state.countriesGeo, {
      style: styleCountry,
      onEachFeature: onEachCountry
    });

    state.layers.continents = L.geoJSON(state.continentsGeo, {
      style: styleContinent,
      onEachFeature: onEachContinent
    });

    // Default: countries
    state.layers.countries.addTo(state.map);
  }

  function renderFatalError(err) {
    // Map might not exist yet—write to info panel + console.
    // eslint-disable-next-line no-console
    console.error(err);

    const panel = document.getElementById("infoPanel");
    if (panel) {
      panel.innerHTML = `
        <h3 class="info-title" style="margin-top:0">Could not load the Explorer</h3>
        <p class="small-muted">
          ${escapeHtml(err?.message || String(err))}
        </p>
        <p class="small-muted">
          Tip: confirm the site is being served from a web server (GitHub Pages or <code>quarto preview</code>),
          and that the <code>data/</code> folder is included in the published site.
        </p>
      `;
    }
  }

  // ----------------------------
  // Boot
  // ----------------------------

  async function boot() {
    try {
      const [datasetsPayload, summaries, modalityMeta, countriesGeo, continentsGeo] = await Promise.all([
        loadJson(PATHS.datasets),
        loadJson(PATHS.summaries),
        loadJson(PATHS.modalityMeta),
        loadJson(PATHS.countriesGeo),
        loadJson(PATHS.continentsGeo)
      ]);

      state.datasets = normaliseDatasets(datasetsPayload);
      state.summaries = summaries || { countries: {}, continents: {} };
      state.modalityMeta = modalityMeta || {};
      state.countriesGeo = countriesGeo;
      state.continentsGeo = continentsGeo;

      buildIso3Maps();

      // Initial counts
      state.countsCountry = computeCountryCounts(state.modality);
      state.countsContinent = computeContinentCounts(state.modality);

      initMap();
      renderLegend();
      wireControls();
      renderInfoPanelEmpty();
    } catch (err) {
      renderFatalError(err);
    }
  }

  boot();
})();
