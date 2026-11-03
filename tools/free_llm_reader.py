#!/usr/bin/env python3
"""Free-tier LLMs as extra readers for the answer engine.

Reads the same batch files the answer engine queues (tools/answer_engine.py queue ...) and writes
result files in the same format, so `answer_engine.py ingest-free` can fold the votes in. Providers
are OpenAI-compatible endpoints listed in tools/free_llm_providers.json. Keys come from the
environment, loaded from the git-ignored file .env.free-llms at the workstation root; they are
never printed or written anywhere else.

Free models are weaker readers than the Claude workers, so their answers are only votes: see
`ingest-free` in answer_engine.py for how many agreeing providers it takes to count.

Usage:
  tools/free_llm_reader.py providers
  tools/free_llm_reader.py models  --provider gemini
  tools/free_llm_reader.py selftest --provider kilo
  tools/free_llm_reader.py run --provider gemini --lane free-ctx [--limit 50] batches/*.json
Results go to server/data/answer-engine/<lane>/results/<provider>/<batch>.json; a rerun skips the
questions already answered, so a daily quota running out loses nothing."""
import argparse
import base64
import io
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = ROOT / "tools/free_llm_providers.json"
ENV_FILE = ROOT / ".env.free-llms"
WORK = ROOT / "server/data/answer-engine"
MAX_IMAGE_SIDE = 1600
MAX_IMAGE_BYTES = 2_500_000

PROMPT = """You are answering one question from a design-entrance exam (NIFT, NID, CEED or UCEED).
{where}
Answer by printed position: A is the first printed option, B the second, and so on, whatever numbering
the paper uses. MCQ has one answer; MSQ has one or more letters (for example "AC"); NAT is a number
(for example "12" or "4.5", or a range such as "12 to 13").
Reply with ONLY one JSON object and nothing else:
{{"answer": "<letters or number or null>", "confidence": "high|medium|low", "needsContext": false, "badCrop": false}}
- confidence "low" means a guess.
- needsContext: true when the question cannot be answered from what is shown (missing passage or setup).
- badCrop: true when the picture is cut off, is missing an option, or shows another question's text.
Question type: {kind}.
{body}"""


def load_env():
    if ENV_FILE.is_file():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def providers():
    config = json.loads(CONFIG.read_text())
    return {name: spec for name, spec in config.items() if not name.startswith("_")}


def provider(name):
    found = providers().get(name)
    if not found:
        raise SystemExit(f"Unknown provider {name!r}. Known: {', '.join(providers())}")
    return found


def endpoint(spec):
    base = spec["base_url"]
    for placeholder in re.findall(r"\{(\w+)\}", base):
        value = os.environ.get(placeholder)
        if not value:
            raise SystemExit(f"{placeholder} is not set (see tools/free_llms.env.example).")
        base = base.replace("{" + placeholder + "}", value)
    return base.rstrip("/")


def api_key(spec):
    if not spec.get("key_env"):
        return None
    key = os.environ.get(spec["key_env"])
    return key or None


def ready(spec):
    return spec.get("key_env") is None or bool(api_key(spec))


def image_data_url(path):
    """A data URL for the crop, shrunk when it is large (providers cap request sizes)."""
    from PIL import Image

    with Image.open(path) as image:
        image = image.convert("RGB")
        if max(image.size) > MAX_IMAGE_SIDE:
            image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        data, mime = buffer.getvalue(), "image/png"
        if len(data) > MAX_IMAGE_BYTES:
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=85)
            data, mime = buffer.getvalue(), "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def build_messages(item, spec):
    if item.get("image"):
        where = "The whole question is in the attached image. Shared directions or a passage may sit above a grey rule, with the question below it."
        body = ""
        content = [{"type": "text", "text": PROMPT.format(where=where, kind=item["type"], body=body)},
                   {"type": "image_url", "image_url": {"url": image_data_url(item["image"])}}]
    else:
        options = "\n".join(f"{o['position']}) {o['text']}" for o in item.get("options") or [])
        body = f"Question: {item.get('prompt') or ''}\nOptions:\n{options}"
        content = PROMPT.format(where="The question is given as text.", kind=item["type"], body=body)
    return [{"role": "user", "content": content}]


def parse_reply(text):
    """The first JSON object in the reply, tolerating code fences and reasoning text around it."""
    if not text:
        return None
    for match in re.finditer(r"\{[^{}]*\}", text, re.S):
        try:
            value = json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and "answer" in value:
            answer = value["answer"]
            return {
                "answer": None if answer in (None, "", "null") else str(answer).strip(),
                "confidence": str(value.get("confidence", "low")).lower(),
                "needsContext": bool(value.get("needsContext")),
                "badCrop": bool(value.get("badCrop")),
            }
    return None


class Quota(Exception):
    """The provider refused further requests (daily or monthly allowance used up)."""


def chat(spec, messages, timeout=120):
    body = json.dumps({"model": spec["model"], "messages": messages, "temperature": 0, "max_tokens": 1200}).encode()
    request = urllib.request.Request(endpoint(spec) + "/chat/completions", data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", "dexam-answer-engine/1.0")
    key = api_key(spec)
    if key:
        request.add_header("Authorization", f"Bearer {key}")
    delay = 5
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            return payload["choices"][0]["message"].get("content") or ""
        except urllib.error.HTTPError as error:
            detail = error.read()[:300].decode("utf-8", "replace")
            if error.code in (401, 403):
                raise SystemExit(f"{spec['model']}: the provider rejected the key (HTTP {error.code}).")
            if error.code == 429 and re.search(r"quota|daily|per day|exceeded your", detail, re.I) and attempt >= 1:
                raise Quota(detail)
            if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                wait = int(error.headers.get("Retry-After", delay)) if error.headers.get("Retry-After", "").isdigit() else delay
                time.sleep(min(wait, 90))
                delay *= 2
                continue
            raise RuntimeError(f"HTTP {error.code}: {detail}")
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as error:
            if attempt < 3:
                time.sleep(delay)
                delay *= 2
                continue
            raise RuntimeError(str(error))
    raise RuntimeError("no reply")


def run(args):
    load_env()
    spec = provider(args.provider)
    if not ready(spec):
        raise SystemExit(f"No key for {args.provider}: set {spec['key_env']} in .env.free-llms.")
    out_dir = WORK / args.lane / "results" / args.provider
    out_dir.mkdir(parents=True, exist_ok=True)
    gap = 60.0 / max(1, spec.get("rpm", 10))
    asked = answered = 0
    try:
        for name in args.batches:
            batch = json.loads(pathlib.Path(name).read_text())
            target = out_dir / pathlib.Path(name).name
            results = json.loads(target.read_text()) if target.exists() else {}
            for item in batch:
                if item["id"] in results:
                    continue
                if item.get("image") is None and False:
                    continue
                if item.get("image") and not spec.get("vision"):
                    continue
                if args.limit and asked >= args.limit:
                    raise StopIteration
                started = time.time()
                asked += 1
                try:
                    reply = chat(spec, build_messages(item, spec))
                except RuntimeError as error:
                    print(f"  {item['id']}: failed ({str(error)[:120]})", flush=True)
                    continue
                parsed = parse_reply(reply)
                if parsed is None:
                    print(f"  {item['id']}: unreadable reply", flush=True)
                    continue
                results[item["id"]] = {**parsed, "method": "free-llm", "source": f"{args.provider}:{spec['model']}"}
                answered += 1
                target.write_text(json.dumps(results, indent=1) + "\n")
                time.sleep(max(0, gap - (time.time() - started)))
            print(f"{pathlib.Path(name).name}: {len(results)}/{len(batch)} answered", flush=True)
    except StopIteration:
        pass
    except Quota as error:
        print("Quota reached; progress is saved and a rerun continues:", str(error)[:160])
    print(f"asked {asked}, answered {answered} with {args.provider}")


def show_providers(_args):
    load_env()
    for name, spec in providers().items():
        status = "ready" if ready(spec) else f"needs {spec['key_env']}"
        print(f"{name:11} {status:26} {'vision' if spec.get('vision') else 'text  '} {spec['model']}")
        print(f"{'':11} {spec.get('privacy', '')}")


def show_models(args):
    load_env()
    spec = provider(args.provider)
    request = urllib.request.Request(endpoint(spec) + "/models")
    key = api_key(spec)
    if key:
        request.add_header("Authorization", f"Bearer {key}")
    request.add_header("User-Agent", "dexam-answer-engine/1.0")
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.loads(response.read())
    for model in data.get("data", data if isinstance(data, list) else []):
        print(model.get("id") if isinstance(model, dict) else model)


def selftest(args):
    """One synthetic text question, to check the endpoint, key and reply format."""
    load_env()
    spec = provider(args.provider)
    if not ready(spec):
        raise SystemExit(f"No key for {args.provider}: set {spec['key_env']} in .env.free-llms.")
    item = {"id": "selftest", "type": "MCQ", "image": None, "prompt": "Which of these is a primary colour?",
            "options": [{"position": "A", "text": "Green"}, {"position": "B", "text": "Red"},
                        {"position": "C", "text": "Orange"}, {"position": "D", "text": "Purple"}]}
    reply = chat(spec, build_messages(item, spec))
    parsed = parse_reply(reply)
    print("reply parsed:", parsed)
    if not parsed or parsed["answer"] != "B":
        raise SystemExit("Unexpected answer (the primary colour in the list is B).")
    print("ok")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("providers")
    m = sub.add_parser("models")
    m.add_argument("--provider", required=True)
    s = sub.add_parser("selftest")
    s.add_argument("--provider", required=True)
    r = sub.add_parser("run")
    r.add_argument("--provider", required=True)
    r.add_argument("--lane", required=True, help="Results folder under server/data/answer-engine, e.g. free-ctx")
    r.add_argument("--limit", type=int, default=0, help="Stop after this many requests")
    r.add_argument("batches", nargs="+")
    args = parser.parse_args()
    {"providers": show_providers, "models": show_models, "selftest": selftest, "run": run}[args.command](args)


if __name__ == "__main__":
    main()
