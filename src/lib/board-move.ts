export type MoveResult = {
  sourceIds: string[];
  targetIds: string[];
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function applyMoveByIds(input: {
  sourceIds: string[];
  targetIds: string[];
  cardId: string;
  targetIndex: number;
  sourceContainer: string;
  targetContainer: string;
}): MoveResult {
  const sameContainer = input.sourceContainer === input.targetContainer;

  const sourceIds = [...input.sourceIds];
  const targetIds = sameContainer ? sourceIds : [...input.targetIds];

  const fromIndex = sourceIds.indexOf(input.cardId);
  if (fromIndex < 0) {
    return {
      sourceIds,
      targetIds,
    };
  }

  sourceIds.splice(fromIndex, 1);

  let insertIndex = clamp(input.targetIndex, 0, targetIds.length);
  if (sameContainer && fromIndex < insertIndex) {
    insertIndex -= 1;
  }

  if (sameContainer) {
    sourceIds.splice(insertIndex, 0, input.cardId);
    return {
      sourceIds,
      targetIds: sourceIds,
    };
  }

  targetIds.splice(insertIndex, 0, input.cardId);
  return {
    sourceIds,
    targetIds,
  };
}

export function positionUpdates(ids: string[]): Array<{ id: string; position: number }> {
  return ids.map((id, index) => ({
    id,
    position: index,
  }));
}
