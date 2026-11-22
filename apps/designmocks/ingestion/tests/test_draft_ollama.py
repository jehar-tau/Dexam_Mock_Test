"""The local model adapter is tested without network calls or real questions."""

import json
import pathlib
import sys
import tempfile
import unittest
import urllib.request

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from test_solutions import MSQ, PAPER, build_work  # noqa: E402
import draft_ollama  # noqa: E402
import solution_batch  # noqa: E402


class Response:
    status = 200

    def __init__(self, value):
        self.value = value

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return json.dumps(self.value).encode()


class LocalOpener:
    def __init__(self):
        self.calls = []

    def open(self, request, timeout):
        self.calls.append((request.full_url, request.data))
        if request.full_url.endswith("/api/tags"):
            return Response({"models": [{"name": "qwen3-vl:4b-instruct"}]})
        if request.full_url.endswith("/api/chat"):
            answer = {"answer": "A,B", "keyIdea": MSQ["keyIdea"], "steps": MSQ["steps"],
                      "optionCheck": MSQ["optionCheck"], "meta": MSQ["meta"]}
            return Response({"message": {"content": json.dumps(answer)}})
        raise AssertionError("Unexpected URL")


class DraftOllamaTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.work = pathlib.Path(self.temp.name)
        self.base = build_work(self.work)
        self.packet_path = pathlib.Path(solution_batch.queue(self.work, PAPER, limit=1, text_only=True)["packet"])

    def tearDown(self):
        self.temp.cleanup()

    def test_local_response_stays_private_and_unapproved(self):
        opener = LocalOpener()
        result = draft_ollama.run(self.work, PAPER, self.packet_path, opener=opener)
        self.assertEqual((1, 0, 0), (result["drafted"], result["approved"], result["published"]))
        output = pathlib.Path(result["responses"])
        self.assertEqual(self.packet_path.parent, output.parent)
        payload = json.loads(output.read_text())
        self.assertEqual("A,B", payload["answers"][0]["answer"])
        self.assertFalse((self.base / "05-solutions/q2.json").exists())
        chat = json.loads(opener.calls[1][1])
        self.assertEqual("http://127.0.0.1:11434/api/chat", opener.calls[1][0])
        self.assertNotIn("officialKey", json.dumps(chat))
        self.assertNotIn("A,B", json.dumps(chat))
        self.assertEqual([], chat["messages"][1]["images"])
        imported = solution_batch.ingest(self.work, PAPER, self.packet_path, output, "qwen3-vl:4b-instruct")
        self.assertEqual((1, 0), (imported["draft"], imported["held"]))

    def test_cloud_or_uninstalled_model_is_rejected_before_question_transfer(self):
        opener = LocalOpener()
        with self.assertRaisesRegex(draft_ollama.LocalModelError, "never a cloud model"):
            draft_ollama.run(self.work, PAPER, self.packet_path, model="qwen3-vl:cloud", opener=opener)
        self.assertEqual([], opener.calls)
        with self.assertRaisesRegex(draft_ollama.LocalModelError, "not already installed"):
            draft_ollama.run(self.work, PAPER, self.packet_path, model="qwen3-vl:8b", opener=opener)
        self.assertEqual(1, len(opener.calls))

    def test_preserved_figure_is_sent_only_to_local_server(self):
        visual_packet = pathlib.Path(solution_batch.queue(self.work, PAPER, limit=2)["packet"])
        first = solution_batch.private_packet(self.base, visual_packet)["questions"][0]
        self.assertEqual("q1", first["key"])
        opener = LocalOpener()
        draft_ollama.draft_question(self.base, first, "qwen3-vl:4b-instruct", opener=opener)
        chat = json.loads(opener.calls[0][1])
        self.assertEqual("http://127.0.0.1:11434/api/chat", opener.calls[0][0])
        self.assertEqual(1, len(chat["messages"][1]["images"]))
        self.assertNotIn("officialKey", json.dumps(chat))

    def test_redirect_to_another_server_is_rejected(self):
        handler = draft_ollama.NoRedirect()
        request = urllib.request.Request("http://127.0.0.1:11434/api/chat")
        with self.assertRaisesRegex(draft_ollama.LocalModelError, "redirect"):
            handler.redirect_request(request, None, 302, "Found", {}, "https://example.org/")

    def test_model_that_only_thinks_cannot_write_a_draft(self):
        first = solution_batch.private_packet(self.base, self.packet_path)["questions"][0]

        class NoFinalAnswer(LocalOpener):
            def open(self, request, timeout):
                if request.full_url.endswith("/api/chat"):
                    return Response({"message": {"content": "", "thinking": "unfinished"},
                                     "done_reason": "length"})
                return super().open(request, timeout)

        with self.assertRaisesRegex(draft_ollama.LocalModelError, "no final answer"):
            draft_ollama.draft_question(self.base, first, "qwen3-vl:4b-instruct", opener=NoFinalAnswer())
        self.assertFalse((self.base / "05-solutions/q2.json").exists())


if __name__ == "__main__":
    unittest.main()
