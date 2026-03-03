(function () {
  const ROOT = (window.AD_DIVERSITY_ROOT || ".").replace(/\/$/, "");
  const DATASETS_URL = `${ROOT}/data/datasets.json`;

  const filterEl = document.getElementById("datasetFilter");
  const modalityEl = document.getElementById("modalityFilter");
  const tableEl = document.getElementById("datasetsTable");
  const tbodyEl = tableEl ? tableEl.querySelector("tbody") : null;
  const countEl = document.getElementById("datasetCount");

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalise(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.datasets)) return payload.datasets;
    return [];
  }

  function hasModality(ds, mod) {
    if (mod === "all") return true;
    const mods = Array.isArray(ds.modalities) ? ds.modalities : [];
    return mods.includes(mod);
  }

  function formatBadges(items) {
    return (items || [])
      .map((x) => `<span class="badge-soft" style="margin-right:0.35rem">${escapeHtml(x)}</span>`)
      .join("");
  }

  function countryLinks(iso3s) {
    return (iso3s || [])
      .map((iso3) => `<a href="${ROOT}/geo/country/?iso3=${encodeURIComponent(iso3)}">${escapeHtml(iso3)}</a>`)
      .join(", ");
  }

  function linkCell(link) {
    if (!link) return "";
    const safe = escapeHtml(link);
    return `<a href="${safe}" target="_blank" rel="noopener">link</a>`;
  }

  function matchesText(ds, q) {
    if (!q) return true;
    const hay = [
      ds.name,
      ds.description,
      ds.notes,
      (ds.modalities || []).join(" "),
      (ds.countries || []).join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function render(datasets, q, mod) {
    const filtered = datasets
      .filter((ds) => hasModality(ds, mod))
      .filter((ds) => matchesText(ds, q));

    if (countEl) {
      countEl.textContent = `${filtered.length} dataset(s) shown • ${datasets.length} total in catalog`;
    }

    if (!tbodyEl) return;

    tbodyEl.innerHTML = filtered
      .map((ds) => {
        const name = escapeHtml(ds.name || ds.id || "dataset");
        const modalities = formatBadges(ds.modalities || []);
        const countries = countryLinks(ds.countries || []);
        const access = escapeHtml(ds.access || "");
        const link = linkCell(ds.link || "");
        return `
          <tr>
            <td>
              <strong>${name}</strong>
              ${ds.description ? `<div class="small-muted">${escapeHtml(ds.description)}</div>` : ""}
            </td>
            <td>${modalities}</td>
            <td>${countries}</td>
            <td>${access}</td>
            <td>${link}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function boot() {
    try {
      const res = await fetch(DATASETS_URL, { cache: "no-cache" });
      const payload = await res.json();
      const datasets = normalise(payload);

      const update = () => {
        const q = filterEl ? filterEl.value.trim() : "";
        const mod = modalityEl ? modalityEl.value : "all";
        render(datasets, q, mod);
      };

      if (filterEl) filterEl.addEventListener("input", update);
      if (modalityEl) modalityEl.addEventListener("change", update);

      update();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      if (countEl) countEl.textContent = "Could not load datasets.json";
    }
  }

  boot();
})();
