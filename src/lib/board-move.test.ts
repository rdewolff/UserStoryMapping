import { describe, expect, it } from "vitest";

import { applyMoveByIds, positionUpdates } from "./board-move";

describe("applyMoveByIds", () => {
  it("moves a card inside the same container", () => {
    const result = applyMoveByIds({
      sourceIds: ["a", "b", "c", "d"],
      targetIds: ["a", "b", "c", "d"],
      cardId: "b",
      targetIndex: 3,
      sourceContainer: "m1::skeleton",
      targetContainer: "m1::skeleton",
    });

    expect(result.sourceIds).toEqual(["a", "c", "b", "d"]);
    expect(result.targetIds).toEqual(["a", "c", "b", "d"]);
  });

  it("moves a card across containers", () => {
    const result = applyMoveByIds({
      sourceIds: ["a", "b", "c"],
      targetIds: ["d", "e"],
      cardId: "b",
      targetIndex: 1,
      sourceContainer: "m1::skeleton",
      targetContainer: "m2::mvp",
    });

    expect(result.sourceIds).toEqual(["a", "c"]);
    expect(result.targetIds).toEqual(["d", "b", "e"]);
  });

  it("clamps oversized target index", () => {
    const result = applyMoveByIds({
      sourceIds: ["a", "b"],
      targetIds: ["c"],
      cardId: "a",
      targetIndex: 999,
      sourceContainer: "m1::mvp",
      targetContainer: "m2::lovable",
    });

    expect(result.targetIds).toEqual(["c", "a"]);
  });
});

describe("positionUpdates", () => {
  it("returns sequential positions", () => {
    expect(positionUpdates(["x", "y", "z"])).toEqual([
      { id: "x", position: 0 },
      { id: "y", position: 1 },
      { id: "z", position: 2 },
    ]);
  });
});
