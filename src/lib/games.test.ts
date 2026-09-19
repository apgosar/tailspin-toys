import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedMixedGames(db: Database): Promise<{
    strategy: { id: number; name: string };
    adventure: { id: number; name: string };
    alpha: { id: number; name: string };
    beta: { id: number; name: string };
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy' })
        .returning({ id: categories.id, name: categories.name });
    const [adventure] = await db
        .insert(categories)
        .values({ name: 'Adventure', description: 'adventure' })
        .returning({ id: categories.id, name: categories.name });
    const [alpha] = await db
        .insert(publishers)
        .values({ name: 'Alpha Games', description: 'alpha' })
        .returning({ id: publishers.id, name: publishers.name });
    const [beta] = await db
        .insert(publishers)
        .values({ name: 'Beta Studio', description: 'beta' })
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        { title: 'Game A', description: 'One', starRating: 4.0, categoryId: strategy.id, publisherId: alpha.id },
        { title: 'Game B', description: 'Two', starRating: 4.2, categoryId: adventure.id, publisherId: alpha.id },
        { title: 'Game C', description: 'Three', starRating: 4.5, categoryId: strategy.id, publisherId: beta.id },
        { title: 'Game D', description: 'Four', starRating: 3.8, categoryId: adventure.id, publisherId: beta.id },
    ]);

    return { strategy, adventure, alpha, beta };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns list of categories and publishers in alphabetical order', async () => {
        await seedMixedGames(db);
        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Adventure' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Alpha Games' },
            { id: expect.any(Number), name: 'Beta Studio' },
        ]);
    });

    it('filters games by category and publisher when given filter ids', async () => {
        const fixtures = await seedMixedGames(db);
        const byCategory = await getAllGames(db, { categoryIds: [fixtures.strategy.id] });
        expect(byCategory.map((game) => game.title)).toEqual(['Game A', 'Game C']);

        const byPublisher = await getAllGames(db, { publisherIds: [fixtures.alpha.id] });
        expect(byPublisher.map((game) => game.title)).toEqual(['Game A', 'Game B']);

        const combined = await getAllGames(db, {
            categoryIds: [fixtures.strategy.id],
            publisherIds: [fixtures.alpha.id],
        });
        expect(combined.map((game) => game.title)).toEqual(['Game A']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
