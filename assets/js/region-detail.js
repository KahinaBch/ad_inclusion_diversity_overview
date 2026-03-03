(function () {
  const ROOT = (window.AD_DIVERSITY_ROOT || ".").replace(/\/$/, "");

  const PATHS = {
    datasets: `${ROOT}/data/datasets.json`,
    summaries: `${ROOT}/data/region_summaries.json`,
    countriesGeo: `${ROOT}/data/geo/countries_110m.geojson`
  };

  const countryContainer = document.getElementById("countryDetail");
  const continentContainer = document.getElementById("continentDetail");

  const isCountryPage = Boolean(countryContainer);
  const isContinentPage = Boolean(continentContainer);

  const container = countryContainer || continentContainer;
  if (!container) return;

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normaliseDatasets(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.datasets)) return payload.datasets;
    return [];
  }

  function datasetHasContinent(ds, continent, iso3ToContinent) {
    const countries = Array.isArray(ds.countries) ? ds.countries : [];
    return countries.some((iso3) => iso3ToContinent.get(iso3) === continent);
  }

  function modalityCounts(datasets) {
    const counts = { neuroimaging: 0, genetics: 0, proteomics: 0, exposomics: 0 };
    for (const ds of datasets) {
      const mods = Array.isArray(ds.modalities) ? ds.modalities : [];
      for (const m of Object.keys(counts)) {
        if (mods.includes(m)) counts[m] += 1;
      }
    }
    return counts;
  }

  function renderCounts(counts) {
    const items = Object.entries(counts).map(([k, v]) => `<span class="badge-soft" style="margin-right:.35rem">${escapeHtml(k)}: <strong>${v}</strong></span>`);
    return `<div style="margin-top:.35rem">${items.join("")}</div>`;
  }

  function datasetTable(datasets) {
    if (!datasets || datasets.length === 0) {
      return `<p class="small-muted">No datasets listed for this region in <code>data/datasets.json</code> yet.</p>`;
    }

    const rows = datasets
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((ds) => {
        const name = escapeHtml(ds.name || ds.id || "dataset");
        const mods = (ds.modalities || []).map((m) => `<span class="badge-soft" style="margin-right:.35rem">${escapeHtml(m)}</span>`).join("");
        const access = escapeHtml(ds.access || "");
        const link = ds.link ? `<a href="${escapeHtml(ds.link)}" target="_blank" rel="noopener">link</a>` : "";
        return `<tr>
          <td><strong>${name}</strong>${ds.description ? `<div class="small-muted">${escapeHtml(ds.description)}</div>` : ""}</td>
          <td>${mods}</td>
          <td>${access}</td>
          <td>${link}</td>
        </tr>`;
      })
      .join("");

    return `
      <table class="table table-sm" data-quarto-disable-processing="true">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Modalities</th>
            <th>Access</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function summaryBlock(summary) {
    if (!summary) {
      return `<p class="small-muted">No summary yet. Add one in <code>data/region_summaries.json</code>.</p>`;
    }

    const summaryText = summary.summary ? `<p>${escapeHtml(summary.summary)}</p>` : "";
    const highlights = Array.isArray(summary.highlights) ? summary.highlights : [];
    const initiatives = Array.isArray(summary.initiatives) ? summary.initiatives : [];

    const hl =
      highlights.length > 0
        ? `<h4 style="margin-top:1rem">Highlights</h4><ul>${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>`
        : "";

    const ini =
      initiatives.length > 0
        ? `<h4 style="margin-top:1rem">Initiatives</h4><ul>${initiatives.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>`
        : "";

    return `${summaryText}${hl}${ini}`;
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const iso3 = params.get("iso3");
    const continent = params.get("continent");

    if (isCountryPage && !iso3) {
      container.innerHTML = `<h3 style="margin-top:0">Country not specified</h3><p class="small-muted">Add <code>?iso3=USA</code> (for example) to the URL.</p>`;
      return;
    }
    if (isContinentPage && !continent) {
      container.innerHTML = `<h3 style="margin-top:0">Continent not specified</h3><p class="small-muted">Add <code>?continent=Europe</code> (for example) to the URL.</p>`;
      return;
    }

    try {
      const [datasetsPayload, summaries, countriesGeo] = await Promise.all([
        fetch(PATHS.datasets, { cache: "no-cache" }).then((r) => r.json()),
        fetch(PATHS.summaries, { cache: "no-cache" }).then((r) => r.json()),
        fetch(PATHS.countriesGeo, { cache: "no-cache" }).then((r) => r.json())
      ]);

      const datasetsAll = normaliseDatasets(datasetsPayload);

      // Build ISO3 maps
      const iso3ToContinent = new Map();
      const iso3ToName = new Map();
      for (const feat of countriesGeo?.features || []) {
        const p = feat.properties || {};
        if (p.ADM0_A3) {
          iso3ToContinent.set(p.ADM0_A3, p.CONTINENT);
          iso3ToName.set(p.ADM0_A3, p.ADMIN || p.NAME || p.ADM0_A3);
        }
      }

      if (isCountryPage) {
        const name = iso3ToName.get(iso3) || iso3;
        const cont = iso3ToContinent.get(iso3) || "—";
        const datasets = datasetsAll.filter((ds) => (ds.countries || []).includes(iso3));
        const counts = modalityCounts(datasets);
        const summary = summaries?.countries?.[iso3] || null;

        container.innerHTML = `
          <h3 style="margin-top:0">${escapeHtml(name)}</h3>
          <div class="small-muted">ISO3: <code>${escapeHtml(iso3)}</code> • Continent: <strong>${escapeHtml(cont)}</strong> • Datasets in catalog: <strong>${datasets.length}</strong></div>
          ${renderCounts(counts)}
          <hr/>
          ${summaryBlock(summary)}
          <hr/>
          <h4>Datasets covering this country (from the catalog)</h4>
          <div class="small-muted">Edit <code>data/datasets.json</code> to add more entries.</div>
          ${datasetTable(datasets)}
        `;
        return;
      }

      if (isContinentPage) {
        const datasets = datasetsAll.filter((ds) => datasetHasContinent(ds, continent, iso3ToContinent));
        const counts = modalityCounts(datasets);
        const summary = summaries?.continents?.[continent] || null;

        container.innerHTML = `
          <h3 style="margin-top:0">${escapeHtml(continent)}</h3>
          <div class="small-muted">Datasets in catalog touching this continent: <strong>${datasets.length}</strong></div>
          ${renderCounts(counts)}
          <hr/>
          ${summaryBlock(summary)}
          <hr/>
          <h4>Datasets touching this continent (from the catalog)</h4>
          <div class="small-muted">Edit <code>data/datasets.json</code> to add more entries.</div>
          ${datasetTable(datasets)}
        `;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      container.innerHTML = `<h3 style="margin-top:0">Could not load content</h3><p class="small-muted">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  boot();
})();
