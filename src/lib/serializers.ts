import type { Board, Card, Module } from "@/generated/prisma/client";
import type { EffortLevel, PriorityLane } from "@/lib/constants";
import { DB_TO_EFFORT, DB_TO_LANE } from "@/lib/constants";

export type BoardDto = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ModuleDto = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CardDto = {
  id: string;
  boardId: string;
  moduleId: string;
  title: string;
  description: string | null;
  priorityLane: PriorityLane;
  effort: EffortLevel;
  weekTarget: string | null;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type BoardSnapshotDto = {
  board: BoardDto;
  modules: ModuleDto[];
  cards: CardDto[];
};

export function serializeBoard(board: Board): BoardDto {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    version: board.version,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export function serializeModule(module: Module): ModuleDto {
  return {
    id: module.id,
    boardId: module.boardId,
    name: module.name,
    position: module.position,
    version: module.version,
    createdAt: module.createdAt.toISOString(),
    updatedAt: module.updatedAt.toISOString(),
  };
}

export function serializeCard(card: Card): CardDto {
  return {
    id: card.id,
    boardId: card.boardId,
    moduleId: card.moduleId,
    title: card.title,
    description: card.description,
    priorityLane: DB_TO_LANE[card.priorityLane as keyof typeof DB_TO_LANE],
    effort: DB_TO_EFFORT[card.effort as keyof typeof DB_TO_EFFORT],
    weekTarget: card.weekTarget,
    position: card.position,
    version: card.version,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
