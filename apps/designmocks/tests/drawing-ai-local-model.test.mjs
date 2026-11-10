import assert from 'node:assert/strict';
import test from 'node:test';

import { openLocalDrawingModel } from '../scripts/drawing-ai-local-model.mjs';

const tag = 'gemma4:e4b';
const digest = 'a7'.repeat(32);
const config = { url: 'http://127.0.0.1:11434', tag, digest };
const modelEntry = { name: tag, model: tag, digest };
const task = {
  prompt: 'Draw an object using the reference figure.',
  rubric: [
    { label: 'Form', points: 3.25, guidance: 'Show clear form and visual hierarchy.', privateId: 'private-criterion-id' },
    { label: 'Detail', points: 2, guidance: 'Include readable details in the drawing.' },
  ],
  images: [
    { role: 'figure', ordinal: 1, bytes: Uint8Array.of(0, 255), path: '/private/figure.png' },
    { role: 'drawing', ordinal: 2, bytes: Uint8Array.of(1, 254), path: '/private/submission.png' },
  ],
};
const suggestion = {
  criterionMarks: { Form: 2.07, Detail: 1.12 },
  comments: 'Clarify the smaller details.',
  confidence: 0.8,
  evidence: [{ role: 'drawing', ordinal: 2, observation: 'The outline establishes the form.' }],
};

function chatResponse(advice = suggestion) {
  return { model: tag, done: true, done_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(advice) } };
}

function setup(overrides = {}, configuration = config) {
  const requests = [];
  const defaultResponses = {
    '/api/tags': { models: [modelEntry] },
    '/api/show': { capabilities: ['completion', 'vision'] },
    '/api/chat': chatResponse(),
  };
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    requests.push({ url, path, options });
    const result = overrides[path] ?? defaultResponses[path];
    return typeof result === 'function' ? result(options) : Response.json(result);
  };
  return { model: openLocalDrawingModel({ ...configuration, fetchImpl }), requests };
}

test('restricts URL spelling, tag, and full digest before any network activity', () => {
  for (const url of [
    'https://127.0.0.1:11434', 'http://localhost:11434', 'http://127.0.1:11434', 'http://2130706433:11434',
    'http://[0:0:0:0:0:0:0:1]:11434', 'http://127.0.0.1:11434/api', 'http://127.0.0.1/?',
    'http://127.0.0.1/#', 'http://user@127.0.0.1', 'http://127.0.0.1:65536', 'http://127.0.0.1\n',
  ]) {
    assert.throws(() => openLocalDrawingModel({ ...config, url }), /loopback HTTP origin/, url);
  }
  for (const invalidTag of [
    'gemma4', 'Gemma4:e4b', 'gemma4:cloud', 'gemma4:e4b-cloud', 'gemma4:remote.q4',
    'registry.example/owner/gemma4:e4b', 'gemma4:e4b@digest', 'a'.repeat(54) + ':b',
  ]) {
    assert.throws(() => openLocalDrawingModel({ ...config, tag: invalidTag }), /explicit local tag/, invalidTag);
  }
  for (const invalidDigest of [digest.toUpperCase(), digest.slice(1), 'sha256:' + digest, digest + '\n']) {
    assert.throws(() => openLocalDrawingModel({ ...config, digest: invalidDigest }), /pinned SHA-256/);
  }
});

test('verifies exact installed identity and model capabilities over literal IPv6', async () => {
  const { model, requests } = setup({}, { ...config, url: 'http://[::1]:11434/' });
  assert.equal(model.identity, tag + '@' + digest);
  assert.equal(await model.verify(), model.identity);
  assert.deepEqual(requests.map(({ url, options }) => [url, options.method]), [
    ['http://[::1]:11434/api/tags', 'GET'],
    ['http://[::1]:11434/api/show', 'POST'],
  ]);
  assert.deepEqual(JSON.parse(requests[1].options.body), { model: tag });
  assert.equal(requests[0].options.body, undefined);
});

test('blocks native fetch under Node proxy settings and leaves injected transports usable', async () => {
  const previousProxy = process.env.NODE_USE_ENV_PROXY;
  const previousOptions = process.env.NODE_OPTIONS;
  try {
    process.env.NODE_USE_ENV_PROXY = '1';
    assert.throws(() => openLocalDrawingModel(config), /environment proxies disabled/);
    await setup().model.verify();

    delete process.env.NODE_USE_ENV_PROXY;
    process.env.NODE_OPTIONS = '"--use_env_proxy"';
    assert.throws(() => openLocalDrawingModel(config), /environment proxies disabled/);
  } finally {
    if (previousProxy === undefined) delete process.env.NODE_USE_ENV_PROXY;
    else process.env.NODE_USE_ENV_PROXY = previousProxy;
    if (previousOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previousOptions;
  }
});

test('rechecks metadata and runs the caller fence immediately before sending only authorized fields and ordered bytes', async () => {
  const { model, requests } = setup();
  await model.verify();
  const beforeDispatch = async () => {
    assert.deepEqual(requests.map(({ path }) => path), ['/api/tags', '/api/show', '/api/tags', '/api/show']);
  };
  assert.deepEqual(await model.suggest({ ...task, beforeDispatch }), suggestion);
  const { options } = requests.at(-1);
  assert.equal(requests.at(-1).path, '/api/chat');
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(Object.hasOwn(options.headers, 'authorization'), false);

  const body = JSON.parse(options.body);
  assert.equal(body.model, tag);
  assert.equal(body.stream, false);
  assert.equal(body.truncate, false);
  assert.equal(body.shift, false);
  assert.deepEqual(body.messages[1].images, ['AP8=', 'Af4=']);
  assert.deepEqual(JSON.parse(body.messages[1].content), {
    prompt: task.prompt,
    rubric: task.rubric.map(({ label, points, guidance }) => ({ label, points, guidance })),
    images: [{ role: 'figure', ordinal: 1 }, { role: 'drawing', ordinal: 2 }],
  });
  assert.equal(body.format.additionalProperties, false);
  assert.deepEqual(body.format.properties.criterionMarks.required, ['Form', 'Detail']);
  assert.equal(body.format.properties.criterionMarks.properties.Form.maximum, 3.25);
  assert.doesNotMatch(options.body, /\/private\/|private-criterion-id/);
});

test('a failing caller fence prevents the image-bearing request', async () => {
  const { model, requests } = setup();
  const beforeDispatch = async () => {
    await Promise.resolve();
    throw new Error('Snapshot changed');
  };
  await assert.rejects(model.suggest({ ...task, beforeDispatch }), /Snapshot changed/);
  assert.deepEqual(requests.map(({ path }) => path), ['/api/tags', '/api/show']);
});

test('fails closed on changed, duplicate, missing, or remote tags and unusable model metadata', async () => {
  for (const models of [
    [], [{ ...modelEntry, name: 'other:tag' }], [modelEntry, modelEntry],
    [{ ...modelEntry, digest: 'b'.repeat(64) }], [{ ...modelEntry, remote_host: 'example.test' }],
    [{ ...modelEntry, remote_model: '' }],
  ]) {
    const { model, requests } = setup({ '/api/tags': { models } });
    await assert.rejects(model.suggest(task), /missing, remote, or changed/);
    assert.deepEqual(requests.map(({ path }) => path), ['/api/tags']);
  }
  for (const show of [
    { capabilities: ['completion'] }, { capabilities: ['vision'] },
    { capabilities: ['completion', 'vision'], remote_model: 'example' },
  ]) {
    const { model, requests } = setup({ '/api/show': show });
    await assert.rejects(model.suggest(task), /vision and completion|\/api\/show failed/);
    assert.deepEqual(requests.map(({ path }) => path), ['/api/tags', '/api/show']);
  }
});

test('rejects malformed normalized evidence before metadata requests', async () => {
  const { model, requests } = setup();
  for (const images of [
    [], [task.images[0]], [task.images[1], task.images[1]], [{ ...task.images[1], ordinal: 0 }],
    [{ ...task.images[1], bytes: 'base64' }], Array.from({ length: 16 }, () => task.images[1]),
  ]) {
    await assert.rejects(model.suggest({ ...task, images }), /normalized drawing images/);
  }
  assert.equal(requests.length, 0);
});

test('allows fifteen ordered images and normalizes feedback and evidence whitespace', async () => {
  const images = Array.from({ length: 15 }, (_, index) => ({
    role: index < 10 ? 'figure' : 'drawing',
    ordinal: (index < 10 ? index : index - 10) + 1,
    bytes: Uint8Array.of(index),
  }));
  const advice = { ...suggestion, comments: ' Clarify the smaller details. ', evidence: [
    { role: 'drawing', ordinal: 2, observation: ' The outline establishes the form. ' },
  ] };
  const { model, requests } = setup({ '/api/chat': chatResponse(advice) });
  assert.deepEqual(await model.suggest({ ...task, images }), suggestion);
  assert.equal(JSON.parse(requests.at(-1).options.body).messages[1].images.length, 15);
});

test('rejects incomplete, malformed, foreign-model, remote, and tool-call chat envelopes', async () => {
  for (const response of [
    { ...chatResponse(), model: 'another:model' },
    { ...chatResponse(), done: false },
    { ...chatResponse(), done_reason: 'length' },
    { ...chatResponse(), remote_host: 'example.test' },
    { ...chatResponse(), error: 'provider leaked input' },
    { ...chatResponse(), message: { ...chatResponse().message, tool_calls: [{}] } },
    { ...chatResponse(), message: { role: 'assistant', content: '```json\n{}\n```' } },
  ]) {
    const { model } = setup({ '/api/chat': response });
    await assert.rejects(model.suggest(task), /invalid|failed/i);
  }
});

test('rejects criteria or marks outside the rubric and malformed comments, confidence, and evidence', async () => {
  for (const advice of [
    { ...suggestion, score: 3.19 },
    { ...suggestion, criterionMarks: { Form: 2 } },
    { ...suggestion, criterionMarks: { Form: 2, Detail: 1, Extra: 0 } },
    { ...suggestion, criterionMarks: { Form: 3.26, Detail: 1 } },
    { ...suggestion, criterionMarks: { Form: 2, Detail: -0.1 } },
    { ...suggestion, criterionMarks: { Form: 2.071, Detail: 1 } },
    { ...suggestion, criterionMarks: { Form: '2.07', Detail: 1 } },
    { ...suggestion, confidence: 1.01 },
    { ...suggestion, comments: 'short'.repeat(801) },
    { ...suggestion, comments: '     ' },
    { ...suggestion, evidence: [] },
    { ...suggestion, evidence: [{ ...suggestion.evidence[0], role: 'figure' }] },
    { ...suggestion, evidence: [{ ...suggestion.evidence[0], observation: ' ' }] },
    { ...suggestion, evidence: [{ ...suggestion.evidence[0], observation: 'a'.repeat(361) }] },
    { ...suggestion, evidence: [{ ...suggestion.evidence[0], path: '/private/image' }] },
  ]) {
    const { model } = setup({ '/api/chat': chatResponse(advice) });
    await assert.rejects(model.suggest(task), /invalid local drawing/i);
  }
});

test('validates numeric precision before floating-point parsing can round the literal', async () => {
  const response = chatResponse();
  response.message.content = response.message.content.replace('2.07', '2.070000000000000000001');
  await assert.rejects(setup({ '/api/chat': response }).model.suggest(task), /criterion marks/);

  response.message.content = response.message.content.replace('2.070000000000000000001', '2070e-3');
  assert.deepEqual(await setup({ '/api/chat': response }).model.suggest(task), suggestion);
});

test('rejects redirects, non-JSON, and oversized streaming bodies without reading past the cap', async () => {
  let cancelled = false;
  for (const response of [
    () => Response.redirect('https://example.test/api/chat'),
    () => new Response('{"data":0}'),
    () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '65537' } }),
    () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(65537));
      },
      cancel() {
        cancelled = true;
      },
    }), { headers: { 'content-type': 'application/json' } }),
  ]) {
    const { model } = setup({ '/api/chat': response });
    await assert.rejects(model.suggest(task), /\/api\/chat failed/);
  }
  assert.equal(cancelled, true);
});

test('uses deadlines for verification and chat, and does not expose provider errors', async (t) => {
  const realTimeout = AbortSignal.timeout;
  const timeout = t.mock.method(AbortSignal, 'timeout', (ms) => realTimeout(ms));
  const { model } = setup({
    '/api/chat': ({ signal }) => {
      assert.equal(signal.aborted, false);
      throw new Error('provider response with student data');
    },
  });
  await assert.rejects(model.suggest(task), { message: 'Local Ollama /api/chat failed' });
  assert.deepEqual(timeout.mock.calls.map(({ arguments: args }) => args), [[5000], [5000], [180000]]);
});

test('a chat body that stalls is cancelled at the request deadline', async (t) => {
  const deadline = new AbortController();
  const realTimeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', (ms) => ms === 180000 ? deadline.signal : realTimeout(ms));
  let cancelled = false;
  const { model } = setup({
    '/api/chat': () => new Response(new ReadableStream({
      start() {
        setImmediate(() => deadline.abort());
      },
      cancel() {
        cancelled = true;
      },
    }), { headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(model.suggest(task), { message: 'Local Ollama /api/chat timed out' });
  assert.equal(cancelled, true);
});
