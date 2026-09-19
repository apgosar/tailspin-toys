import { eq, asc, inArray, and } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

export interface GameFilters {
    categoryIds?: number[];
    publisherIds?: number[];
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function normalizeFilterIds(ids?: number[]): number[] | undefined {
    if (!ids || ids.length === 0) {
        return undefined;
    }

    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    return uniqueIds.length > 0 ? uniqueIds : undefined;
}

type FilterableGamesQuery = ReturnType<typeof baseGamesQuery> & {
    where: (condition: Parameters<typeof and>[0]) => ReturnType<typeof baseGamesQuery>;
    orderBy: (...args: unknown[]) => ReturnType<typeof baseGamesQuery>;
};

function applyFilters(query: ReturnType<typeof baseGamesQuery>, filters?: GameFilters): ReturnType<typeof baseGamesQuery> {
    let filteredQuery = query as FilterableGamesQuery;
    const categoryIds = normalizeFilterIds(filters?.categoryIds);
    const publisherIds = normalizeFilterIds(filters?.publisherIds);
    const conditions = [] as unknown as Parameters<typeof and>;

    if (categoryIds) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    if (conditions.length > 0) {
        filteredQuery = filteredQuery.where(and(...conditions)) as unknown as FilterableGamesQuery;
    }

    return filteredQuery as ReturnType<typeof baseGamesQuery>;
}

/** All games ordered by title. */
export async function getAllGames(db: Database, filters?: GameFilters): Promise<Game[]> {
    const rows = await applyFilters(baseGamesQuery(db), filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All available categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All available publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
