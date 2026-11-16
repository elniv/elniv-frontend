import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarkdown, parseInline } from "../src/lib/markdown.tsx";
import { matchRoute } from "../src/lib/router.tsx";
import { dayLabel, formatDuration, greeting } from "../src/lib/format.ts";
import { summarizeCheckins, moodMeta } from "../src/lib/moods.ts";
import { messageFromBody } from "../src/lib/api.ts";
import { plainText } from "../src/lib/speech.ts";
import { extensionFor } from "../src/lib/voice.ts";

test("markdown: blocks", () => {
  const blocks = parseMarkdown("# Title\n\nHello **world** and `code`.\n\n- one\n- two\n\n1. a\n2. b\n\n> quote\n\n```js\nconst x = 1;\n```");
  assert.deepEqual(blocks.map((b) => b.t), ["h", "p", "ul", "ol", "quote", "code"]);
  const code = blocks[5];
  assert.ok(code && code.t === "code" && code.v === "const x = 1;" && code.lang === "js");
});

test("markdown: unterminated fence does not throw or loop", () => {
  const blocks = parseMarkdown("```\nopen forever");
  assert.equal(blocks.length, 1);
});

test("markdown: only http(s) links become links; html stays text", () => {
  const inline = parseInline("[ok](https://a.com) [bad](javascript:alert(1)) <img src=x onerror=1>");
  assert.equal(inline.filter((n) => n.t === "link").length, 1);
  assert.ok(inline.some((n) => n.t === "text" && n.v.includes("<img")));
});

test("router: matchRoute", () => {
  assert.deepEqual(matchRoute("/chat/:id", "/chat/abc-123"), { id: "abc-123" });
  assert.equal(matchRoute("/chat/:id", "/chat"), null);
  assert.equal(matchRoute("/chat/:id", "/settings/abc"), null);
  assert.deepEqual(matchRoute("/chat/:id", "/chat/a%20b/"), { id: "a b" });
  assert.deepEqual(matchRoute("/activities", "/activities"), {});
  assert.deepEqual(matchRoute("/checkin", "/checkin"), {});
  assert.deepEqual(matchRoute("/home", "/home"), {});
});

test("format: duration, day labels, greeting", () => {
  assert.equal(formatDuration(83.9), "1:23");
  assert.equal(formatDuration(-4), "0:00");
  const now = new Date(2026, 10, 12, 10, 0);
  assert.equal(dayLabel(new Date(2026, 10, 12, 1).toISOString(), now), "Today");
  assert.equal(dayLabel(new Date(2026, 10, 11, 23).toISOString(), now), "Yesterday");
  assert.equal(greeting("Rohit", new Date(2026, 10, 12, 9)), "Good morning, Rohit");
  assert.equal(greeting("", new Date(2026, 10, 12, 20)), "Good evening");
});

test("moods: summary uses only real entries and is case-insensitive", () => {
  const items = [
    { mood: "anxious", focus_area: "Work" },
    { mood: "Anxious", focus_area: "Work" },
    { mood: "Calm", focus_area: "Sleep" },
    { mood: "Overwhelmed", focus_area: "Relationships" },
    { mood: "Confused", focus_area: "Decision" },
    { mood: "Exhausted", focus_area: "Rest" },
    { mood: "Unknown mood", focus_area: "Work" },
  ];
  const s = summarizeCheckins(items);
  assert.equal(s.topFocus, "Work");
  assert.equal(s.scores.length, 6); // unknown moods are excluded from the trend
  assert.equal(moodMeta("CALM")?.label, "Calm");
  assert.equal(moodMeta("OVERWHELMED")?.label, "Overwhelmed");
  assert.equal(moodMeta("frustrated")?.label, "Frustrated");
  assert.equal(moodMeta("numb")?.label, "Numb");
  assert.equal(moodMeta("not sure")?.label, "Not sure");
  assert.deepEqual(summarizeCheckins([]), { topMood: null, topFocus: null, scores: [] });
});

test("api: error messages from FastAPI bodies", () => {
  assert.equal(messageFromBody(404, { detail: "Conversation not found." }), "Conversation not found.");
  assert.equal(messageFromBody(422, { detail: [{ msg: "Value error, Model cannot be empty." }] }), "Model cannot be empty.");
  assert.match(messageFromBody(500, null), /our side/);
  assert.match(messageFromBody(429, {}), /Too many/);
});

test("speech: markdown stripped for reading aloud", () => {
  assert.equal(plainText("# Hi\n**bold** [link](https://x.y) `c`\n```\nskip\n```"), "Hi bold link c");
});

test("voice: file extension from mime type", () => {
  assert.equal(extensionFor("audio/webm;codecs=opus"), "webm");
  assert.equal(extensionFor("audio/mp4"), "m4a");
  assert.equal(extensionFor("audio/ogg"), "ogg");
});
