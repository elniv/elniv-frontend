import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRoute } from "../src/lib/router.tsx";
import { parseMessageActivities } from "../src/lib/activities.ts";

test("activities: route routing and safety", () => {
  assert.equal(matchRoute("/activities", "/activities") !== null, true);
  assert.equal(matchRoute("/activities/:id", "/activities/breathing")?.id, "breathing");
});

test("chat: parseMessageActivities strips activity tags and extracts pills", () => {
  const sample = "It sounds like you're carrying a lot of weight right now. Let's take a pause together. [ACTIVITY: breathing]";
  const parsed = parseMessageActivities(sample);

  assert.equal(parsed.cleanContent, "It sounds like you're carrying a lot of weight right now. Let's take a pause together.");
  assert.equal(parsed.activities.length, 1);
  assert.equal(parsed.activities[0]?.type, "breathing");
  assert.equal(parsed.activities[0]?.label, "Try Gentle Breathing");
  assert.equal(parsed.activities[0]?.icon, "🌬️");

  // Ripples
  const ripplesSample = "Water ripples can help calm a racing mind. [ACTIVITY: ripples]";
  const parsedRipples = parseMessageActivities(ripplesSample);
  assert.equal(parsedRipples.cleanContent, "Water ripples can help calm a racing mind.");
  assert.equal(parsedRipples.activities[0]?.type, "ripples");
  assert.equal(parsedRipples.activities[0]?.icon, "🌊");

  // Journal
  const journalSample = "Writing your thoughts down might untangle this. [ACTIVITY: journal]";
  const parsedJournal = parseMessageActivities(journalSample);
  assert.equal(parsedJournal.cleanContent, "Writing your thoughts down might untangle this.");
  assert.equal(parsedJournal.activities[0]?.type, "journal");
  assert.equal(parsedJournal.activities[0]?.icon, "📖");

  // Case insensitive and whitespace tolerance
  const mixedSample = "Take a breath. [activity:  Breathing  ]";
  const parsedMixed = parseMessageActivities(mixedSample);
  assert.equal(parsedMixed.cleanContent, "Take a breath.");
  assert.equal(parsedMixed.activities.length, 1);
  assert.equal(parsedMixed.activities[0]?.type, "breathing");

  // No tags
  const plainSample = "Just a regular helpful response.";
  const parsedPlain = parseMessageActivities(plainSample);
  assert.equal(parsedPlain.cleanContent, plainSample);
  assert.equal(parsedPlain.activities.length, 0);
});
