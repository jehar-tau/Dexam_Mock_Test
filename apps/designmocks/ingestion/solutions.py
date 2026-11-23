#!/usr/bin/env python3
"""Stage 5 of the question-paper ingestion pipeline: worked solutions.

Solutions are drafted by Claude in a local session (owner decision D3, 20 Nov 2026)
and kept in the private work folder. This tool does the parts that must be exact:

    brief  <paper> <key>   everything a drafter needs: prompt, options, figures, official key
    check  <paper>         validate every 05-solutions/<key>.json; a draft that does not reach
                           the official key, or breaks the format, is held
    render <paper>         05-solutions/review.html: each solution with its step-by-step
                           annotations drawn over the canonical figure, for human review

The format is in docs/ingestion/PLAN.md ("Solution format"). Nothing here writes
into the repository.
"""

import argparse
import html
import importlib.util
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

SCHEMA = 1
STAGE = "05-solutions"
DIFFICULTY = {"easy", "medium", "hard"}
STATUS = {"draft", "verified", "held"}
STEP_WORDS_WARN, STEP_WORDS_MAX, MAX_STEPS = 30, 45, 8
SVG_NS = "http://www.w3.org/2000/svg"
OVERLAY_TAGS = {"g", "circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "text", "tspan"}
OVERLAY_ATTRS = {"cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points", "d",
                 "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
                 "stroke-linejoin", "opacity", "font-size", "font-weight", "text-anchor", "transform", "id"}
ID = re.compile(r"^[a-z][a-z0-9-]{0,40}$")
# Visual solutions (PLAN.md, "Visual solution standard"): declarative motion only, never scripts.
MOTIONS = {
    "fold": {"axis": ("x", "y"), "at": float},          # flip a layer over a crease (x: vertical crease, y: horizontal)
    "rotate": {"angle": float, "cx": float, "cy": float},
    "move": {"dx": float, "dy": float},                  # or "path": [[x, y], ...] relative offsets
    "draw": {},                                         # stroke draws on
    "fade": {"from": float, "to": float},
    "pulse": {},                                        # brief emphasis
    "stagger": {},                                      # reveal children one by one (counting)
}
MAX_MOTION_MS = 4000
SAFE_VALUE = re.compile(r"^[-#%.,()0-9A-Za-z \t]*$")


class SolutionError(Exception):
    """A refusal the operator can act on. The message is safe to print."""


def load(name):
    spec = importlib.util.spec_from_file_location(name, pathlib.Path(__file__).with_name(f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def paper_files(work, paper_id):
    base = pathlib.Path(work).expanduser().resolve() / paper_id
    needed = {"segments": base / "02-segments" / "questions.json", "figures": base / "03-figures" / "figures.json",
              "key": base / "04-key" / "key.json"}
    for name, path in needed.items():
        if not path.is_file():
            raise SolutionError(f"Run the earlier stages first: {path.relative_to(base.parent)} is missing")
    segments = {q["key"]: q for q in json.loads(needed["segments"].read_text())["questions"]}
    figures = {q["key"]: q for q in json.loads(needed["figures"].read_text())["questions"]}
    keys = json.loads(needed["key"].read_text())["keys"]
    return base, segments, figures, keys


# ---------------------------------------------------------------- brief


def brief(work, paper_id, key):
    base, segments, figures, keys = paper_files(work, paper_id)
    if key not in segments:
        raise SolutionError(f"No question {key} in {paper_id}")
    question, record = segments[key], figures.get(key, {})
    official = keys.get(key, {})
    return {
        "paperId": paper_id, "key": key, "type": question["type"], "prompt": question["prompt"],
        "options": [{"key": o["key"], "text": o["text"]} for o in question["options"]],
        "officialKey": {"raw": official.get("raw"), "status": official.get("status", "none")},
        "figures": [{"id": f["id"], "role": f["role"], "file": str(base / "03-figures" / f["canonical"]["file"]),
                     "width": f["canonical"]["width"], "height": f["canonical"]["height"]} for f in record.get("figures", [])],
        "block": str(base / "03-figures" / record["block"]["file"]) if record.get("block") else None,
        "flags": question["flags"],
    }


# ---------------------------------------------------------------- validation


def overlay_problems(fragment):
    """Overlay fragments may only draw shapes and text: no links, scripts, styles or images."""
    try:
        root = ET.fromstring(f'<g xmlns="{SVG_NS}">{fragment}</g>')
    except ET.ParseError:
        return ["overlay-not-well-formed"]
    problems = []
    for element in root.iter():
        tag = element.tag.split("}")[-1]
        if tag not in OVERLAY_TAGS:
            problems.append(f"overlay-element-{tag}")
        for name, value in element.attrib.items():
            local = name.split("}")[-1]
            if local not in OVERLAY_ATTRS:
                problems.append(f"overlay-attribute-{local}")
            elif not SAFE_VALUE.match(value) or "url" in value.lower() or (local == "id" and not ID.match(value)):
                problems.append(f"overlay-value-{local}")
    return sorted(set(problems))


def reaches_key(ak, value, official_raw, kind):
    """True when the solution's answer is the official key: the same choices for MCQ/MSQ,
    or for NAT a printed value or a value inside a printed range."""
    mine, theirs = ak.canonical(value, kind), ak.canonical(official_raw, kind)
    if mine is None or theirs is None:
        return False
    if mine == theirs or kind != "NAT" or len(mine) != 1 or mine[0][0] != mine[0][1]:
        return mine == theirs
    point = float(mine[0][0])
    return any(float(low) <= point <= float(high) for low, high in theirs)


def words(text):
    return len(str(text).split())


def validate(solution, question, official, figures):
    """Return (errors, warnings, reaches_key). Errors hold the solution."""
    ak = load("answer_key")
    errors, warnings = [], []
    required = ["schema", "answer", "keyIdea", "steps", "meta", "provenance"]
    for field in required:
        if field not in solution:
            errors.append(f"missing-{field}")
    if errors:
        return errors, warnings, False
    if solution["schema"] != SCHEMA:
        errors.append("unsupported-schema")
    kind = question["type"]
    value = solution["answer"].get("value")
    status = official.get("status")
    reaches = None
    if status == "official-key":
        reaches = reaches_key(ak, str(value), official["raw"], kind)
        if not reaches:
            errors.append("does-not-reach-official-key")
        if solution["answer"].get("source") != "official-key":
            errors.append("answer-source-must-be-official-key")
    elif status == "dropped":
        warnings.append("official-key-dropped")
    else:
        errors.append("no-official-key-to-check-against")
    if not str(solution["keyIdea"]).strip():
        errors.append("key-idea-empty")
    elif words(solution["keyIdea"]) > 2 * STEP_WORDS_WARN:
        warnings.append("key-idea-long")
    steps = solution["steps"]
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEPS:
        errors.append(f"steps-must-be-1-to-{MAX_STEPS}")
        steps = steps if isinstance(steps, list) else []
    for index, step in enumerate(steps, 1):
        count = words(step.get("text", ""))
        if not count:
            errors.append(f"step-{index}-empty")
        elif count > STEP_WORDS_MAX:
            errors.append(f"step-{index}-too-long")
        elif count > STEP_WORDS_WARN:
            warnings.append(f"step-{index}-long")
    if kind == "NAT" and not any(re.search(r"\d\s*[-+×x*/÷=]\s*\d|=", s.get("text", "")) for s in steps):
        warnings.append("nat-shows-no-arithmetic")  # some NAT questions ask "which number", not a sum
    if kind in ("MCQ", "MSQ"):
        letters = [o["key"] for o in question["options"]] or ["A", "B", "C", "D"]
        check = solution.get("optionCheck") or []
        if sorted(c.get("option") for c in check) != sorted(letters):
            errors.append("option-check-must-cover-every-option")
        correct = sorted(c["option"] for c in check if c.get("verdict") == "correct")
        if status == "official-key" and reaches:
            key_sets = [sorted(branch.split(",")) for branch in ak.normalise(official["raw"], kind)[0].split(" or ")]
            if correct not in key_sets:
                errors.append("option-verdicts-disagree-with-key")
        if any(c.get("verdict") not in ("correct", "wrong") or not str(c.get("why", "")).strip() for c in check):
            errors.append("option-check-needs-verdict-and-reason")
    overlay = solution.get("overlay")
    step_refs = [s.get("overlay") for s in steps if s.get("overlay")]
    if overlay:
        figure = figures.get(overlay.get("figure"))
        if figure is None:
            errors.append("overlay-figure-unknown")
        elif overlay.get("viewBox") != f"0 0 {figure['canonical']['width']} {figure['canonical']['height']}":
            errors.append("overlay-viewbox-must-match-figure")
        for name, fragment in (overlay.get("steps") or {}).items():
            errors.extend(f"{problem}-in-{name}" for problem in overlay_problems(fragment))
        missing = [ref for ref in step_refs if ref not in (overlay.get("steps") or {})]
        if missing:
            errors.append("step-overlay-missing")
    elif step_refs:
        errors.append("steps-refer-to-an-overlay-that-is-absent")
    errors.extend(motion_problems(steps, overlay))
    if question.get("figures_present") and not overlay:
        warnings.append("no-visual-solution")
    meta = solution["meta"]
    if meta.get("difficulty") not in DIFFICULTY:
        errors.append("meta-difficulty")
    if not isinstance(meta.get("seconds"), int) or not 10 <= meta["seconds"] <= 600:
        errors.append("meta-seconds")
    if not meta.get("topic"):
        errors.append("meta-topic")
    if solution["provenance"].get("status") not in STATUS:
        errors.append("provenance-status")
    if solution["provenance"].get("status") == "verified" and not solution["provenance"].get("reviewedBy"):
        errors.append("verified-needs-a-reviewer")
    return errors, warnings, reaches


def overlay_ids(overlay):
    ids = set()
    for fragment in (overlay or {}).get("steps", {}).values():
        ids.update(re.findall(r'\bid="([^"]+)"', fragment))
    for piece in (overlay or {}).get("pieces", []):
        if isinstance(piece, dict) and isinstance(piece.get("id"), str):
            ids.update({piece["id"], f"{piece['id']}-turn"})  # move the piece, turn its inner group
    return ids


def piece_problems(overlay, width, height):
    """Figure pieces: a circle, ring or polygon cut from the canonical figure, shown with a layer,
    optionally covering its original place, so it can be moved or turned like a drawn layer."""
    problems = []
    seen = set()
    layers = set((overlay or {}).get("steps", {}))
    num = lambda v: isinstance(v, (int, float))
    for index, piece in enumerate((overlay or {}).get("pieces") or [], 1):
        if not isinstance(piece, dict) or not ID.match(str(piece.get("id", ""))) or piece["id"] in seen:
            problems.append(f"piece-{index}-id")
            continue
        seen.add(piece["id"])
        if piece.get("layer") not in layers:
            problems.append(f"piece-{index}-layer")
        shape = piece.get("shape")
        if shape == "circle":
            ok = all(num(piece.get(k)) for k in ("cx", "cy", "r")) and piece["r"] > 0
        elif shape == "ring":
            ok = all(num(piece.get(k)) for k in ("cx", "cy", "r1", "r2")) and 0 <= piece["r2"] < piece["r1"]
        elif shape == "polygon":
            points = piece.get("points")
            ok = isinstance(points, list) and 3 <= len(points) <= 64 and all(
                isinstance(p, list) and len(p) == 2 and all(num(v) for v in p) for p in points)
        else:
            ok = False
        if not ok:
            problems.append(f"piece-{index}-shape")
        if "cover" in piece and not isinstance(piece["cover"], bool):
            problems.append(f"piece-{index}-cover")
    return problems


def motion_problems(steps, overlay):
    """Visual-solution fields on steps: motion, focus (zoom to a region), hide, ask (predict first)."""
    problems = []
    ids = overlay_ids(overlay)
    layers = set((overlay or {}).get("steps", {}))
    width = height = None
    if overlay and re.fullmatch(r"0 0 \d+ \d+", str(overlay.get("viewBox", ""))):
        width, height = (int(v) for v in overlay["viewBox"].split()[2:])
    problems.extend(piece_problems(overlay, width, height))
    for index, step in enumerate(steps, 1):
        for motion in step.get("motion") or []:
            kind = motion.get("type")
            if kind not in MOTIONS:
                problems.append(f"step-{index}-motion-type")
                continue
            if motion.get("target") not in ids:
                problems.append(f"step-{index}-motion-target")
            elif any(re.search(rf'<[^>]*\bid="{re.escape(motion["target"])}"[^>]*\btransform=|<[^>]*\btransform="[^"]*"[^>]*\bid="{re.escape(motion["target"])}"', f)
                     for f in (overlay or {}).get("steps", {}).values()):
                problems.append(f"step-{index}-motion-target-has-transform")  # the animation would replace it; wrap in a <g id>
            duration = motion.get("duration", 900)
            if not isinstance(duration, (int, float)) or not 150 <= duration <= MAX_MOTION_MS:
                problems.append(f"step-{index}-motion-duration")
            if not isinstance(motion.get("delay", 0), (int, float)) or not 0 <= motion.get("delay", 0) <= MAX_MOTION_MS:
                problems.append(f"step-{index}-motion-delay")
            for field, expected in MOTIONS[kind].items():
                if kind == "move" and "path" in motion:
                    break
                value = motion.get(field)
                if isinstance(expected, tuple):
                    if value not in expected:
                        problems.append(f"step-{index}-motion-{field}")
                elif field not in ("from", "to", "cx", "cy") or value is not None:
                    if not isinstance(value, (int, float)):
                        problems.append(f"step-{index}-motion-{field}")
            if kind == "move" and "path" in motion and not (isinstance(motion["path"], list) and 1 <= len(motion["path"]) <= 12
                                                         and all(isinstance(p, list) and len(p) == 2 and all(isinstance(v, (int, float)) for v in p) for p in motion["path"])):
                problems.append(f"step-{index}-motion-path")
        if "focus" in step:
            box = step["focus"]
            if not (isinstance(box, list) and len(box) == 4 and all(isinstance(v, (int, float)) for v in box) and box[2] > 0 and box[3] > 0
                    and (width is None or (box[0] >= 0 and box[1] >= 0 and box[0] + box[2] <= width + 1 and box[1] + box[3] <= height + 1))):
                problems.append(f"step-{index}-focus")
        if any(name not in layers for name in step.get("hide") or []):
            problems.append(f"step-{index}-hide")
        if "ask" in step and not (isinstance(step["ask"], str) and 1 <= words(step["ask"]) <= STEP_WORDS_WARN):
            problems.append(f"step-{index}-ask")
        if "askChoices" in step:  # tappable answers for the prediction (coach treatment)
            choices = step["askChoices"]
            if "ask" not in step or not (isinstance(choices, list) and 2 <= len(choices) <= 5
                                         and all(isinstance(c, str) and 0 < len(c) <= 40 for c in choices) and len(set(choices)) == len(choices)):
                problems.append(f"step-{index}-ask-choices")
            elif "askAnswer" in step and step["askAnswer"] not in choices:
                problems.append(f"step-{index}-ask-answer")
    return problems


def check(work, paper_id):
    base, segments, figures, keys = paper_files(work, paper_id)
    folder = base / STAGE
    figure_index = {f["id"]: f for record in figures.values() for f in record["figures"]}
    results = {}
    for path in sorted(folder.glob("q*.json"), key=lambda p: (p.stem.startswith("qb"), int(re.sub(r"\D", "", p.stem.split(".")[0])), p.stem)):
        # q38.json is the draft; q38.visual.json is a visual version kept beside it (never over it).
        name = path.stem
        key = name.split(".")[0]
        try:
            solution = json.loads(path.read_text())
        except json.JSONDecodeError:
            results[name] = {"status": "held", "errors": ["not-json"], "warnings": []}
            continue
        if key not in segments or name not in (key, f"{key}.visual"):
            results[name] = {"status": "held", "errors": ["no-such-question"], "warnings": []}
            continue
        question = dict(segments[key], figures_present=bool(figures.get(key, {}).get("figures")))
        errors, warnings, reaches = validate(solution, question, keys.get(key, {}), figure_index)
        claimed = solution.get("provenance", {}).get("status")
        status = "held" if errors else (claimed if claimed in ("draft", "verified") else "draft")
        results[name] = {"status": status, "reachesKey": reaches, "errors": errors, "warnings": warnings}
    part_a = [k for k, q in segments.items() if q["part"] == "A"]
    report = {"paperId": paper_id, "solutions": len(results), "partAQuestions": len(part_a),
              "withoutSolution": [k for k in part_a if k not in results],
              "visualVersions": sorted((n for n in results if n.endswith(".visual")), key=lambda n: int(re.sub(r"\D", "", n))),
              "byStatus": {s: sum(1 for r in results.values() if r["status"] == s) for s in ("draft", "verified", "held")},
              "results": results}
    (folder / "check.json").write_text(json.dumps(report, indent=1) + "\n")
    return report


# ---------------------------------------------------------------- review page


def render(work, paper_id):
    report = check(work, paper_id)
    base, segments, figures, keys = paper_files(work, paper_id)
    folder = base / STAGE
    figure_index = {f["id"]: f for record in figures.values() for f in record["figures"]}
    cards = []
    for key, result in report["results"].items():
        if "not-json" in result["errors"] or key not in segments:
            continue
        solution = json.loads((folder / f"{key}.json").read_text())
        question = segments[key]
        esc = html.escape
        figure_html = ""
        overlay = solution.get("overlay")
        if overlay and overlay.get("figure") in figure_index and not any(e.startswith("overlay") for e in result["errors"]):
            figure = figure_index[overlay["figure"]]
            layers = "".join(f'<g class="layer" data-step="{esc(name)}">{fragment}</g>' for name, fragment in overlay["steps"].items())
            figure_html = (f'<figure class="stage"><div class="frame"><img src="../03-figures/{esc(figure["canonical"]["file"])}" alt="">'
                           f'<svg viewBox="{esc(overlay["viewBox"])}" preserveAspectRatio="none">{layers}</svg></div>'
                           f'<div class="scrub"><button type="button" class="prev">Back</button><span class="count"></span>'
                           f'<button type="button" class="next">Next step</button></div></figure>')
        else:
            record = figures.get(key, {})
            if record.get("block"):
                figure_html = f'<figure class="stage"><img src="../03-figures/{esc(record["block"]["file"])}" alt=""></figure>'
        steps = "".join(f'<li data-step="{esc(s.get("overlay") or "")}">{esc(s["text"])}</li>' for s in solution["steps"])
        options = "".join(f'<li><b>{esc(c["option"])}</b> <span class="{esc(c["verdict"])}">{esc(c["verdict"])}</span> {esc(c["why"])}</li>'
                          for c in solution.get("optionCheck") or [])
        extras = "".join(f'<p><b>{label}</b> {esc(solution[field])}</p>' for field, label in (("trap", "Trap:"), ("fastTrack", "Faster:")) if solution.get(field))
        problems = "".join(f"<li>{esc(e)}</li>" for e in result["errors"] + result["warnings"])
        meta = solution["meta"]
        cards.append(f'''<article class="card {esc(result["status"])}">
<header><h2>{esc(key.upper())} <small>{esc(question["type"])} · {esc(meta.get("topic", ""))} · {esc(meta.get("difficulty", ""))} · {esc(str(meta.get("seconds", "")))} s</small></h2>
<span class="badge">{esc(result["status"])}</span></header>
<p class="prompt">{esc(question["prompt"])}</p>
{figure_html}
<p class="answer">Answer <b>{esc(str(solution["answer"].get("value")))}</b> <small>official key {esc(str(keys.get(key, {}).get("raw")))}</small></p>
<p class="idea">{esc(solution["keyIdea"])}</p>
<ol class="steps">{steps}</ol>
{f'<ul class="options">{options}</ul>' if options else ''}
{extras}
{f'<ul class="problems">{problems}</ul>' if problems else ''}
</article>''')
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solution review</title><style>
:root{{--paper:#f7f3ea;--ink:#1f2a24;--forest:#2f5d46;--orange:#d9772b;--muted:#6b6f68;--line:#ddd5c4;--card:#fffdf8}}
@media (prefers-color-scheme:dark){{:root{{--paper:#171b18;--ink:#ece7dc;--forest:#7fb89a;--orange:#f0a060;--muted:#a5a99f;--line:#33392f;--card:#1f241f}}}}
body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:860px;margin:0 auto;padding:24px 16px}} h1{{font-size:24px;margin:0 0 4px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:20px 0}}
.card header{{display:flex;justify-content:space-between;align-items:baseline;gap:12px}} h2{{font-size:18px;margin:0}} h2 small{{color:var(--muted);font-weight:400;font-size:13px}}
.badge{{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line)}} .held .badge{{background:#c0392b;color:#fff}} .draft .badge{{background:var(--orange);color:#fff}} .verified .badge{{background:var(--forest);color:#fff}}
.prompt{{color:var(--muted)}} .answer b{{color:var(--forest);font-size:18px}} .idea{{border-left:3px solid var(--orange);padding-left:10px}}
.stage{{margin:12px 0}} .frame{{position:relative;background:#fff;border-radius:8px;overflow:hidden}} .frame img,.stage>img{{display:block;width:100%;height:auto}}
.frame svg{{position:absolute;inset:0;width:100%;height:100%}} .layer{{opacity:0;transition:opacity .25s}} .layer.on{{opacity:1}}
.scrub{{display:flex;gap:10px;align-items:center;margin-top:8px}} button{{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}}
.steps li.on{{font-weight:600}} .correct{{color:var(--forest)}} .wrong{{color:#c0392b}} .problems{{color:#c0392b;font-size:14px}}
</style></head><body><main><h1>{html.escape(paper_id.upper())} solutions</h1>
<p>{report["solutions"]} drafted · {report["byStatus"]["draft"]} draft · {report["byStatus"]["verified"]} verified · {report["byStatus"]["held"]} held · {len(report["withoutSolution"])} Part A questions without a solution yet. Private review copy.</p>
{"".join(cards)}</main><script>
document.querySelectorAll('.card').forEach(card=>{{const layers=[...card.querySelectorAll('.layer')];const items=[...card.querySelectorAll('.steps li')];
const names=items.map(li=>li.dataset.step);let at=0;const count=card.querySelector('.count');if(!count)return;
const show=()=>{{const upto=names.slice(0,at+1);layers.forEach(l=>l.classList.toggle('on',upto.includes(l.dataset.step)));
items.forEach((li,i)=>li.classList.toggle('on',i===at));count.textContent=`Step ${{at+1}} of ${{items.length}}`;}};
card.querySelector('.prev').onclick=()=>{{at=Math.max(0,at-1);show();}};card.querySelector('.next').onclick=()=>{{at=Math.min(items.length-1,at+1);show();}};show();}});
</script></body></html>'''
    (folder / "review.html").write_text(page)
    return {**{k: v for k, v in report.items() if k != "results"}, "page": str(folder / "review.html")}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stage 5: worked solutions (brief, check, render).")
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("brief")
    one.add_argument("paper_id")
    one.add_argument("key")
    for name in ("check", "render"):
        sub.add_parser(name).add_argument("paper_id")
    parser.add_argument("--work", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "brief":
            result = brief(args.work, args.paper_id, args.key)
        elif args.command == "check":
            report = check(args.work, args.paper_id)
            result = {k: v for k, v in report.items() if k != "results"}
            result["held"] = {k: r["errors"] for k, r in report["results"].items() if r["status"] == "held"}
        else:
            result = render(args.work, args.paper_id)
    except SolutionError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
