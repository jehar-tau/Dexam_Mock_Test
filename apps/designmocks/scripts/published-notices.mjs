import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { brand, money } from "../src/config.js";
import { operator } from "../src/operator.js";
import { sha256, stableJson } from "./question-bank-import.mjs";

const fields = {
  terms: { coverage: "The released catalogue", refunds: "Cancellation and refunds", invoices: "Tax and invoices" },
  privacy: { information: "Information we collect and use", processors: "Service providers",
    retention: "Retention and account requests", youngerStudents: "Younger students" },
};

export function compilePublishedNotices(input, { allowFixture = false } = {}) {
  if (input?.schemaVersion !== 1 || Object.keys(input).length !== 4
    || (input.scope !== "release" && !(allowFixture && input.scope === "fixture"))) {
    throw new Error("A reviewed customer notice bundle is required");
  }
  const pages = {};
  for (const [page, headings] of Object.entries(fields)) {
    const content = input[page];
    if (!content || typeof content !== "object" || Array.isArray(content)
      || Object.keys(content).length !== Object.keys(headings).length) {
      throw new Error(`The ${page} notice is incomplete`);
    }
    pages[page] = Object.entries(headings).map(([field, heading]) => {
      const paragraph = content[field];
      if (typeof paragraph !== "string" || paragraph.trim().length < 20 || paragraph.length > 8000) {
        throw new Error(`The ${heading.toLowerCase()} notice is incomplete`);
      }
      return { heading, paragraph: paragraph.trim() };
    });
  }
  pages.terms.unshift({
    heading: "The annual pass",
    paragraph: `The annual pass costs ${money(brand.price)} for ${brand.months} calendar months from verified payment. It covers the explicitly released papers. You make one payment, with no automatic renewal.`,
  });
  const eligibility = pages.privacy.find(({ heading }) => heading === fields.privacy.youngerStudents);
  pages.terms.push({ heading: "Account eligibility", paragraph: eligibility.paragraph });
  const version = "dmocks-notices-v1-" + sha256(stableJson({ scope: input.scope, brand: brand.name, operator, pages }));
  const refunds = pages.terms.filter(({ heading }) => heading === fields.terms.refunds);
  return { version, pages: { ...pages, refunds } };
}

export function readPublishedNotices(file, options) {
  if (!file) return null;
  let input;
  try {
    const info = statSync(file);
    if (!info.isFile() || info.size > 65536) throw new Error();
    input = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error("The customer notice file is unreadable or exceeds the supported size");
  }
  return compilePublishedNotices(input, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Provide one reviewed customer notice JSON file");
    console.log(readPublishedNotices(process.argv[2]).version);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
