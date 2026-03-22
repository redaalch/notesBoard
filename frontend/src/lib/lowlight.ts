import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

const lowlight = createLowlight();

// Register a focused set of languages to avoid shipping the full highlight.js corpus.
lowlight.register({
  bash,
  css,
  html: xml,
  javascript,
  js: javascript,
  json,
  markdown,
  md: markdown,
  plaintext,
  python,
  py: python,
  sql,
  typescript,
  ts: typescript,
  xml,
});

export default lowlight;
