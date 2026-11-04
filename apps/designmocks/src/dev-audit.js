// Local-only, opt-in QA. Vite removes this import from the production build.
import axe from "axe-core";
document.getElementById("dev-audit")?.remove();
const panel = document.createElement("details");
panel.id = "dev-audit";
panel.style.cssText =
  "position:fixed;right:10px;bottom:10px;z-index:9999;background:#fff;color:#111;border:2px solid #244735;padding:10px;max-width:min(90vw,500px);max-height:70vh;overflow:auto;font:14px/1.5 system-ui";
const summary = document.createElement("summary");
summary.textContent = "Local accessibility QA";
const run = document.createElement("button");
run.textContent = "Run accessibility check";
const output = document.createElement("pre");
output.style.cssText = "white-space:pre-wrap;max-width:460px";
output.setAttribute("role", "status");
panel.append(summary, run, output);
document.body.append(panel);
run.onclick = async () => {
  run.disabled = true;
  output.textContent = "Checking…";
  panel.style.visibility = "hidden";
  try {
    const report = await axe.run(
      { exclude: ["#dev-audit"] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } },
    );
    const result = {
      route: location.pathname,
      theme: document.documentElement.dataset.theme,
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      violations: report.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      incomplete: report.incomplete.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    };
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    run.disabled = false;
    panel.style.visibility = "visible";
  }
};
