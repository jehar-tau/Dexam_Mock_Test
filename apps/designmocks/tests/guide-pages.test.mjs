import assert from "node:assert/strict";
import test from "node:test";
import { guidePage, guidePath, guideSlug } from "../src/guide-pages.mjs";
import { pageHead, publicPages } from "../src/search-pages.mjs";

const article = { slug: "how-to-review-a-mock-test", title: "How to review a <mock> test", dek: "A short \"dek\"." };

test("guide paths round-trip and reject anything else", () => {
  assert.equal(guidePath(article.slug), "/guides/how-to-review-a-mock-test");
  assert.equal(guideSlug("/guides/how-to-review-a-mock-test/"), "how-to-review-a-mock-test");
  for (const path of ["/guides", "/guides/", "/guides/a/b", "/guides/Bad_Slug", "/dashboard/community/read/x"]) assert.equal(guideSlug(path), null, path);
});

test("a guide page is indexed as an Article by the owner, with escaped text", () => {
  const head = pageHead("/guides/how-to-review-a-mock-test", true, guidePage(article));
  assert.match(head, /<title data-dmocks-head>How to review a &lt;mock&gt; test \| DMocks guides<\/title>/);
  assert.match(head, /name="robots" content="index, follow"/);
  assert.match(head, /property="og:type" content="article"/);
  assert.match(head, /rel="canonical" href="https:\/\/dmocks.com\/guides\/how-to-review-a-mock-test"/);
  const json = JSON.parse(/<script data-dmocks-head type="application\/ld\+json">(.*)<\/script>/.exec(head)[1]);
  assert.equal(json["@type"], "Article");
  assert.equal(json.author.name, "Snehalkumar Shinde");
  assert.equal(json.headline, article.title);
  assert.ok(!/<mock>/.test(/application\/ld\+json">(.*)<\/script>/.exec(head)[1]));
});

test("the guides index is a public indexed page and unknown guides stay unindexed", () => {
  assert.ok(publicPages.get("/guides").index !== false);
  assert.match(pageHead("/guides/unknown", true), /noindex, nofollow/);
});
