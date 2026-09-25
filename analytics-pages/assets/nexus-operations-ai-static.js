(() => {
  "use strict";

  const output = document.getElementById("nexus-ai-output");
  const meta = document.getElementById("nexus-ai-meta");
  const modelPill = document.getElementById("nexus-ai-model");
  const button = document.getElementById("nexus-ai-generate");

  if (!output || !meta || !modelPill || !button) return;

  function formatDate(value) {
    if (!value) return "Unknown time";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(parsed);
  }

  function render(payload) {
    const model = payload.model || {};
    const briefing = payload.briefing;
    modelPill.textContent = model.available
      ? `${model.configured_model || "AI"} Ready`
      : `${model.configured_model || "AI"} Unavailable`;
    modelPill.classList.toggle("unavailable", !model.available);

    if (!briefing) {
      output.textContent = "No saved AI fleet briefing is available yet.";
      meta.textContent = "Northstar will publish the next saved briefing here.";
      return;
    }

    output.textContent = briefing.response || briefing.error || "The saved briefing has no visible output.";
    if (briefing.status === "error") {
      meta.textContent = `Saved error · Attempted: ${formatDate(briefing.created_at)}`;
      return;
    }
    meta.textContent =
      `Model: ${briefing.model || model.configured_model || "unknown"} · ` +
      `Generated: ${formatDate(briefing.created_at)} · ` +
      `Evidence: ${formatDate(briefing.evidence_at)} · ` +
      `Validation: ${briefing.validation_status || "legacy"} · ` +
      "Source: nexus-ai-hf saved briefing";
  }

  async function loadSavedBriefing() {
    button.disabled = true;
    button.textContent = "Loading Saved Briefing...";
    try {
      const response = await fetch("./data/ai-briefing.json", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      render(payload);
    } catch (error) {
      modelPill.textContent = "Saved AI unavailable";
      modelPill.classList.add("unavailable");
      output.textContent = `Unable to load the saved AI briefing: ${error.message}`;
      meta.textContent = "The Northstar refresh may not have published a briefing yet.";
    } finally {
      button.disabled = false;
      button.textContent = "Refresh Saved Briefing";
    }
  }

  button.addEventListener("click", loadSavedBriefing);
  loadSavedBriefing();
})();
