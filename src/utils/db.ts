import type { Database, Player, ServerState } from '../types/database.ts';
import { getDefaultDatabase } from './formatter.ts';
import { log, logError } from './logger.ts';

export async function loadDatabase(dbPath: string): Promise<Database> {
  const file = Bun.file(dbPath);
  try {
    const content = await file.text();
    const loaded = JSON.parse(content) as Partial<Database>;
    // Merge with default, reset players
    const db: Database = {
      ...getDefaultDatabase(),
      ...loaded,
      players: {},
    };
    log(`Found: ${dbPath}`);
    return db;
  } catch (e) {
    logError(`Unable to read: ${dbPath}, creating new database`);
    const db = getDefaultDatabase();
    await saveDatabase(dbPath, db);
    log(`New DB written: ${dbPath}`);
    return db;
  }
}

export async function saveDatabase(dbPath: string, db: Database): Promise<void> {
  await Bun.write(dbPath, JSON.stringify(db, null, 2));
}

export function updateServer(db: Database, state: Partial<ServerState>): Database {
  return {
    ...db,
    server: { ...db.server, ...state },
  };
}

export function getPlayer(db: Database, userId: string): Player | undefined {
  return db.players[userId];
}

export function addOrUpdatePlayer(db: Database, userId: string, player: Player): Database {
  return {
    ...db,
    players: {
      ...db.players,
      [userId]: player,
    },
  };
}

export function updatePlayer(db: Database, userId: string, updates: Partial<Player>): Database {
  const existing = db.players[userId];
  if (!existing) return db;
  return {
    ...db,
    players: {
      ...db.players,
      [userId]: { ...existing, ...updates },
    },
  };
}

export function removePlayer(db: Database, userId: string): Database {
  const { [userId]: removed, ...rest } = db.players;
  return {
    ...db,
    players: rest,
  };
}

export function resetPlayers(db: Database): Database {
  return {
    ...db,
    players: {},
  };
}
