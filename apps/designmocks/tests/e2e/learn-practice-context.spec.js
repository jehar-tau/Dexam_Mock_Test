import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const student = { id: "00000000-0000-4000-8000-000000000361", email: "lesson-practice@example.invalid" };
const attemptId = "00000000-0000-4000-8000-000000000369";
const lesson = {
  id: "50000000-0000-4000-8000-000000000361", slug: "observing-structure", exam: "ceed", topic: "observation",
  title: "Observing structure", summary: "Notice the relationships between visible forms.",
  body: "A synthetic lesson about observing structure before choosing an answer.", completed: false,
};

async function fixture(page, path = "/dashboard/learn") {
  const state = { lesson: { ...lesson }, error: "", attempt: null, catalog: [
    { exam: "uceed", topic: "observation", questions: 40 },
    { exam: "ceed", topic: "observation", questions: 20 },
    { exam: "ceed", topic: "visual-hierarchy", questions: 10 },
    { exam: "ceed", topic: "small-pool", questions: 9 },
    { exam: "nift", topic: "general-aptitude", questions: 30 },
  ] };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "public_all_india_top_ten": return [];
      case "learning_catalog": return [state.lesson];
      case "learning_progress": return { total: 1, completed: 0, percent: 0 };
      case "read_learning_lesson": return state.lesson;
      case "topic_catalog": return state.catalog;
      case "start_topic_practice": {
        if (state.error) return { code: "P0001", message: state.error };
        state.attempt = { id: attemptId, title: "Synthetic contextual practice", status: "active", score: null, total: null,
          resultsPending: false, examResultsPending: false, serverNow: new Date().toISOString(),
          deadline: new Date(Date.now() + input.p_duration_seconds * 1000).toISOString(),
          questions: Array.from({ length: input.p_count }, (_, index) => ({
            id: "context-practice-question-" + index, ordinal: index + 1, kind: "mcq", topic: input.p_topic,
            prompt: "Contextual practice question " + (index + 1),
            options: [{ id: "A", label: "First choice" }, { id: "B", label: "Second choice" },
              { id: "C", label: "Third choice" }, { id: "D", label: "Fourth choice" }],
            answer: null, answerRevision: 0, points: 3, negativePoints: 0.5, marking: { correct: 3, wrong: -0.5 }, media: [],
          })),
        };
        return attemptId;
      }
      case "read_attempt": return { ...state.attempt, serverNow: new Date().toISOString() };
      case "my_exam_mock_session": return null;
      case "my_exam_mock_report": return null;
    }
  });
  await page.goto(path);
  await seedPortalSession(page, student);
  await page.reload();
  return Object.assign(state, provider);
}

const examSelect = page => page.getByRole("combobox", { name: "Exam", exact: true });
const topicSelect = page => page.getByRole("combobox", { name: "Topic", exact: true });
const startButton = page => page.getByRole("button", { name: "Start practice", exact: true });
const starts = state => state.calls.filter(([name]) => name === "start_topic_practice");

test("a lesson keeps its CEED topic when UCEED has a larger pool with the same name", async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Start lesson" }).press("Enter");
  const link = page.getByRole("link", { name: "Practise this topic" });
  await expect(link).toHaveAttribute("href", "/dashboard/practice?exam=ceed&topic=observation");
  await link.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/practice\?exam=ceed&topic=observation$/);
  await expect(examSelect(page)).toHaveValue("ceed");
  await expect(topicSelect(page)).toHaveValue("observation");
  expect(starts(state)).toEqual([]);
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("20");
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("1800");
  await startButton(page).press("Enter");
  await expect(page).toHaveURL(new RegExp("/attempt/" + attemptId + "$"));
  await expect(page.getByRole("heading", { name: "Contextual practice question 1", exact: true })).toBeVisible();
  expect(starts(state)).toEqual([["start_topic_practice", { p_exam: "ceed", p_topic: "observation", p_count: 20, p_duration_seconds: 1800 }]]);
  expect(state.calls.some(([name]) => ["prepare_order", "complete_learning_lesson", "save_answer_revision", "submit_attempt"].includes(name))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("unavailable and invalid contexts require an explicit available selection", async ({ page }) => {
  const state = await fixture(page, "/dashboard/practice?exam=ceed&topic=not-ready");
  for (const [query, selectedExam, message] of [
    ["exam=ceed&topic=not-ready", "ceed", /not ready for CEED/],
    ["exam=ceed&topic=small-pool", "ceed", /not ready for CEED/],
    ["exam=nid&topic=observation", "", /NID is not ready/],
    ["exam=unknown&topic=observation", "", /exam is unavailable/],
  ]) {
    await page.goto("/dashboard/practice?" + query);
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
    await expect(examSelect(page)).toHaveValue(selectedExam);
    await expect(topicSelect(page)).toHaveValue("");
    await expect(startButton(page)).toBeDisabled();
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  for (let theme = 0; theme < 2; theme++) {
    await expect(startButton(page)).toHaveCSS("background-color", theme ? "rgb(220, 235, 161)" : "rgb(36, 71, 53)");
    expect(await page.evaluate(async () => (await window.axe.run(".topic-practice", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })).violations)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
  }
  await examSelect(page).selectOption("ceed");
  await expect(topicSelect(page)).toHaveValue("observation");
  await expect(startButton(page)).toBeEnabled();
  expect(starts(state)).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("a topic-only link asks for its exam and never substitutes a different topic for a larger set", async ({ page }) => {
  const state = await fixture(page, "/dashboard/practice?topic=observation");
  await expect(page.getByRole("status").filter({ hasText: "several exams" })).toBeVisible();
  await expect(examSelect(page)).toHaveValue("");
  await expect(startButton(page)).toBeDisabled();
  await examSelect(page).selectOption("ceed");
  await expect(topicSelect(page)).toHaveValue("observation");
  await expect(startButton(page)).toBeEnabled();
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("30");
  await expect(topicSelect(page)).toHaveValue("observation");
  await expect(startButton(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "supports up to 20 questions" })).toBeVisible();
  await page.getByRole("combobox", { name: "Questions", exact: true }).selectOption("10");
  await expect(topicSelect(page)).toHaveValue("observation");
  await expect(startButton(page)).toBeEnabled();
  await topicSelect(page).selectOption("visual-hierarchy");
  await expect(startButton(page)).toBeEnabled();
  expect(starts(state)).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("query navigation and browser history reselect the requested context without starting an attempt", async ({ page }) => {
  const state = await fixture(page, "/dashboard/practice?exam=ceed&topic=observation");
  await expect(examSelect(page)).toHaveValue("ceed");
  await page.evaluate(() => {
    history.pushState(history.state, "", "/dashboard/practice?exam=uceed&topic=observation");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(examSelect(page)).toHaveValue("uceed");
  await expect(topicSelect(page)).toHaveValue("observation");
  await page.goBack();
  await expect(page).toHaveURL(/exam=ceed&topic=observation$/);
  await expect(examSelect(page)).toHaveValue("ceed");
  await page.goForward();
  await expect(page).toHaveURL(/exam=uceed&topic=observation$/);
  await expect(examSelect(page)).toHaveValue("uceed");
  expect(starts(state)).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("blank-topic lessons browse their exam and encoded topics preserve their exact identity", async ({ page }) => {
  const state = await fixture(page);
  state.lesson.topic = "";
  await page.getByRole("button", { name: "Start lesson" }).click();
  const browse = page.getByRole("link", { name: "Browse practice" });
  await expect(browse).toHaveAttribute("href", "/dashboard/practice?exam=ceed");
  await browse.click();
  await expect(examSelect(page)).toHaveValue("ceed");
  const specialTopic = "line & space / colour? + figure=2";
  state.lesson.topic = specialTopic;
  state.catalog.push({ exam: "ceed", topic: specialTopic, questions: 10 });
  await page.goto("/dashboard/learn");
  await page.getByRole("button", { name: "Start lesson" }).click();
  await page.getByRole("link", { name: "Practise this topic" }).click();
  await expect(topicSelect(page)).toHaveValue(specialTopic);
  const url = new URL(page.url());
  expect([...url.searchParams]).toEqual([["exam", "ceed"], ["topic", specialTopic]]);
  expect(starts(state)).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("learning remains readable while contextual starts retain pass and verified-profile errors", async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByText(lesson.body)).toBeVisible();
  await page.getByRole("link", { name: "Practise this topic" }).click();
  for (const message of ["An active pass is required", "Complete your verified profile first"]) {
    state.error = message;
    await startButton(page).click();
    const alert = page.getByRole("alert");
    if (message === "Complete your verified profile first") {
      await expect(alert).toHaveText(message + " Complete your profile →");
      await expect(alert.getByRole("link", { name: "Complete your profile →" })).toHaveAttribute("href", "/onboarding");
    } else {
      await expect(alert).toHaveText(message);
      await expect(alert.getByRole("link")).toHaveCount(0);
    }
    await expect(startButton(page)).toBeEnabled();
    await expect(page).toHaveURL(/\/dashboard\/practice\?exam=ceed&topic=observation$/);
  }
  expect(starts(state)).toHaveLength(2);
  expect(starts(state).every(([, input]) => input.p_exam === "ceed" && input.p_topic === "observation")).toBe(true);
  expect(state.calls.some(([name]) => ["read_attempt", "prepare_order", "submit_attempt", "save_answer_revision"].includes(name))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

for (const destination of ["context", "account", "navigation", "history"]) {
  test(`a late practice start respects a later ${destination} change`, async ({ page }) => {
    const state = await fixture(page, "/dashboard/practice?exam=ceed&topic=observation");
    await expect(startButton(page)).toBeEnabled();
    let release, finish;
    const held = new Promise(resolve => { release = resolve; }), finished = new Promise(resolve => { finish = resolve; });
    await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/start_topic_practice", async route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      state.calls.push(["start_topic_practice", route.request().postDataJSON()]);
      await held;
      try { await route.fulfill({ json: attemptId, headers: { "Access-Control-Allow-Origin": "*" } }); }
      catch { /* The old view aborts its read of this already committed fictional start. */ }
      finally { finish(); }
    });
    const requested = page.waitForRequest(request => request.url().endsWith("/rpc/start_topic_practice") && request.method() === "POST");
    await startButton(page).click();
    await requested;
    try {
      for (const name of ["Exam", "Topic", "Questions", "Time"]) {
        await expect(page.getByRole("combobox", { name, exact: true })).toBeDisabled();
      }
      if (destination === "context") {
        await page.evaluate(() => {
          history.pushState(history.state, "", "/dashboard/practice?exam=uceed&topic=observation");
          dispatchEvent(new PopStateEvent("popstate"));
        });
        await expect(examSelect(page)).toHaveValue("uceed");
      } else if (destination === "account") {
        await seedPortalSession(page, { id: "00000000-0000-4000-8000-000000000362", email: "other-lesson-practice@example.invalid" });
        await page.evaluate(() => {
          const key = "sb-dmocks-portal-fixture-auth-token", channel = new BroadcastChannel(key);
          channel.postMessage({ event: "SIGNED_IN", session: JSON.parse(localStorage.getItem(key)) });
          channel.close();
        });
        await expect(startButton(page)).toBeEnabled();
      } else if (destination === "history") {
        // Simulate a new navigation entry before React commits its cleanup.
        await page.evaluate(() => history.pushState({ ...history.state, key: "fictional-new-navigation" }, "", location.href));
      } else {
        await page.getByRole("link", { name: "DMocks home", exact: true }).first().click();
        await expect(page).toHaveURL(/\/$/);
      }
    } finally { release(); }
    await finished;
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(destination === "navigation" ? /\/$/ : destination === "context" ? /exam=uceed&topic=observation$/ : /exam=ceed&topic=observation$/);
    if(destination === "history"){
      // The old private scope stays closed between native history mutation and
      // the router observing that navigation; complete that second phase now.
      await expect(startButton(page)).toBeDisabled();
      await page.evaluate(()=>dispatchEvent(new PopStateEvent("popstate",{state:history.state})));
    }
    if (destination !== "navigation") await expect(startButton(page)).toBeEnabled();
    expect(starts(state)).toEqual([["start_topic_practice", { p_exam: "ceed", p_topic: "observation", p_count: 10, p_duration_seconds: 900 }]]);
    expect(state.calls.some(([name]) => ["read_attempt", "prepare_order", "save_answer_revision", "submit_attempt"].includes(name))).toBe(false);
    expect(state.unexpected).toEqual([]);
  });
}
