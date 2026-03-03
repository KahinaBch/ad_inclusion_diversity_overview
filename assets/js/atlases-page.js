(function () {
  const ROOT = (window.AD_DIVERSITY_ROOT || ".").replace(/\/$/, "");
  const ATLASES_URL = `${ROOT}/data/atlases.json`;
  const PIPELINES_URL = `${ROOT}/data/harmonization_pipelines.json`;

  const atlasesEl = document.getElementById("atlasesList");
  const pipelinesEl = document.getElementById("pipelinesList");

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function itemList(items) {
    if (!items || items.length === 0) {
      return `<p class="small-muted">No items yet. Edit the JSON file in <code>data/</code>.</p>`;
    }

    return `
      <ul>
        ${items
          .map((it) => {
            const name = escapeHtml(it.name || it.id || "item");
            const type = it.type ? `<span class="badge-soft" style="margin-left:.35rem">${escapeHtml(it.type)}</span>` : "";
            const mods = (it.modalities || []).map((m) => `<span class="badge-soft" style="margin-left:.35rem">${escapeHtml(m)}</span>`).join("");
            const link = it.link ? `<a href="${escapeHtml(it.link)}" target="_blank" rel="noopener">link</a>` : "";
            const notes = it.notes ? `<div class="small-muted">${escapeHtml(it.notes)}</div>` : "";
            return `<li><strong>${name}</strong>${type}${mods} ${link}${notes}</li>`;
          })
          .join("")}
      </ul>
    `;
  }

  async function boot() {
    try {
      const [atlasesRes, pipelinesRes] = await Promise.all([
        fetch(ATLASES_URL, { cache: "no-cache" }).then((r) => r.json()),
        fetch(PIPELINES_URL, { cache: "no-cache" }).then((r) => r.json())
      ]);

      const atlases = atlasesRes.items || [];
      const pipelines = pipelinesRes.items || [];

      if (atlasesEl) atlasesEl.innerHTML = itemList(atlases);
      if (pipelinesEl) pipelinesEl.innerHTML = itemList(pipelines);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      if (atlasesEl) atlasesEl.textContent = "Could not load atlases.json";
      if (pipelinesEl) pipelinesEl.textContent = "Could not load harmonization_pipelines.json";
    }
  }

  boot();
})();
