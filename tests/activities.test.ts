import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRoute } from "../src/lib/router.tsx";

test("activities: route routing and safety", () => {
  assert.equal(matchRoute("/activities", "/activities") !== null, true);
  assert.equal(matchRoute("/activities/:id", "/activities/breathing")?.id, "breathing");
});
