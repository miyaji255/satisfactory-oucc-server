import { createDiscordClient, setDiscordActivity, sendDiscordMessage, attemptPurge as attemptPurgeDiscord, willPurge, getNextPurge } from './utils/discord.ts';
import { probe } from '@djwoodz/satisfactory-dedicated-server-lightweight-query-probe';
import { loadDatabase, saveDatabase, updateServer, getPlayer, addOrUpdatePlayer, updatePlayer, removePlayer, resetPlayers } from './utils/db.ts';
import { watch, watchFile } from 'node:fs';
import { open } from 'node:fs/promises';
import { parse } from './utils/parser.ts';
import {
  formatList,
  formatMinutes,
  formatPlayers,
  getOnlinePlayers,
  getTimestamp,
} from './utils/formatter.ts';
import { INVALID_UNKNOWN_NAMES, MS_PER_MINUTE } from './utils/constants.ts';
import type { Database } from './types/database.ts';
import type { LogEvent } from './types/parser.ts';
import { loadConfigMacro, type ConfigSettings, type PurgeConfig } from './macro.config.ts' with { type: 'macro' };
import type { FileHandle } from 'node:fs/promises';
import { log, logError } from './utils/logger.ts';

// Settings are embedded at compile/build time via Bun macro
const config = loadConfigMacro();

// Discord token must come from environment variable (secret)
const discordToken = (() => {
  const token = process.env.SATISFACTORY_BOT_DISCORD_TOKEN;
  if (!token) {
    throw new Error('Missing required environment variable: SATISFACTORY_BOT_DISCORD_TOKEN');
  }
  return token;
})();

let db: Database;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let nextPurge = 0;
let initTime = 0;
let fileHandle: FileHandle | null = null;

async function update(client: ReturnType<typeof createDiscordClient>): Promise<void> {
  const previouslyUnreachable = db.server.unreachable;
  const previouslyOnline = db.server.online;

  try {
    // @ts-ignore - probe library may not have perfect types
    const data = await probe(
      config.server.ip,
      config.server.port,
      config.server.queryTimeoutMs,
    );

    // Handle unreachable -> reachable
    if (previouslyUnreachable && !config.disableUnreachableFoundMessages) {
      await sendDiscordMessage(client, config.discord.channelName, ':thumbsup: サーバーが見つかりました。');
      db = updateServer(db, { unreachable: false });
    }

    // Handle game state
    if (data.serverState === 'Game ongoing') {
      if (!previouslyOnline) {
        await sendDiscordMessage(client, config.discord.channelName, ':rocket: サーバーが**オンライン**に戻りました！');
        await sendDiscordMessage(client, config.discord.channelName, `:rocket: サーバーバージョン: **${data.serverVersion}**`);
      }
      db = updateServer(db, {
        version: data.serverVersion,
        online: true,
        unreachable: false,
      });
    } else {
      if (previouslyOnline) {
        await sendDiscordMessage(client, config.discord.channelName, ':tools: サーバーが**オフライン**になりました。');
      }
      db = updateServer(db, {
        version: data.serverVersion,
        online: false,
        unreachable: false,
      });
    }

    // Update activity
    const onlinePlayers = getOnlinePlayers(db);
    if (db.server.online) {
      setDiscordActivity(client, `${onlinePlayers.length}/${config.server.maxPlayers}人がオンライン`);
    } else {
      setDiscordActivity(client, 'オフライン');
    }

    await saveDatabase(config.dbPath, db);
  } catch (error) {
    logError(`Server probe failed: ${error instanceof Error ? error.message : String(error)}`);
    setDiscordActivity(client, '不明');

    if (!db.server.unreachable) {
      if (!config.disableUnreachableFoundMessages) {
        await sendDiscordMessage(client, config.discord.channelName, ':man_shrugging: サーバーに到達できません。');
      }
      db = updateServer(db, { unreachable: true, online: false });
      await saveDatabase(config.dbPath, db);
    }
  }

  // Attempt purge
  const now = Date.now();
  if (willPurge(config.purge) && now >= nextPurge) {
    nextPurge = getNextPurge(config.purge.hour);
    console.log('Looking for messages to purge...');
    try {
      await attemptPurgeDiscord(client, config.purge);
    } catch (e) {
      console.error(e);
    }
    console.log(`Next purge will be ${new Date(nextPurge)}`);
  }
}

function handleCommandLine(commandLineStr: string): void {
  const commandLine = commandLineStr.match(/\S+/g);
  if (!Array.isArray(commandLine)) return;

  for (const arg of commandLine) {
    const commandLineArgument = arg.match(/^-(?:NoLogTimes|LocalLogTimes|LogTimeCode)$/i);
    if (Array.isArray(commandLineArgument)) {
      logError(`Unsupported command line argument '${commandLineArgument[0]}' detected. Aborting...`);
      process.exit(2);
    }
  }
}

function handleLoginRequest(client: ReturnType<typeof createDiscordClient>, data: LogEvent & { type: 'Login request' }): void {
  log('Login request', data.userId, data.name);
  const commandLine = commandLineStr.match(/\S+/g);
  if (!Array.isArray(commandLine)) return;

  for (const arg of commandLine) {
    const commandLineArgument = arg.match(/^-(?:NoLogTimes|LocalLogTimes|LogTimeCode)$/i);
    if (Array.isArray(commandLineArgument)) {
      console.error(`Unsupported command line argument '${commandLineArgument[0]}' detected. Aborting...`);
      process.exit(2);
    }
  }
}

function handleLoginRequest(client: ReturnType<typeof createDiscordClient>, data: LogEvent & { type: 'Login request' }): void {
  console.log('Login request', data.userId, data.name);

  if (INVALID_UNKNOWN_NAMES.includes(data.userId as any)) {
    if (
      data.timestamp >= initTime &&
      (config.ignorePollStateWhenMessaging || db.server.online)
    ) {
      sendDiscordMessage(
        client,
        config.discord.channelName,
        `:warning: **${data.name}**のユーザーIDは**${formatList(INVALID_UNKNOWN_NAMES)}**です。キャラクターのインベントリが失われている可能性があります。再起動して再接続してください...`,
      );
    }
  } else {
    const existingPlayer = getPlayer(db, data.userId);
    if (!existingPlayer) {
      db = addOrUpdatePlayer(db, data.userId, {
        userId: data.userId,
        name: data.name,
        joinRequested: 0,
        joined: 0,
      });
    } else {
      // update/reset player
      db = updatePlayer(db, data.userId, {
        name: data.name,
        joinRequested: 0,
        joined: 0,
      });
    }
  }
}

function handleJoinRequest(data: LogEvent & { type: 'Join request' }): void {
  log('Join request', data.name);

  const userId = Object.values(db.players).find(({ name }) => name === data.name)?.userId;
  if (userId) {
    const player = getPlayer(db, userId);
    if (player) {
      db = updatePlayer(db, userId, { joinRequested: player.joinRequested + 1 });
    }
  }
}

function handleJoinSucceeded(client: ReturnType<typeof createDiscordClient>, data: LogEvent & { type: 'Join succeeded' }): void {
  log('Join succeeded', data.name);

  const userId = Object.values(db.players).find(({ name }) => name === data.name)?.userId;
  if (userId) {
    const player = getPlayer(db, userId);
    if (player && player.joinRequested > 0) {
      db = updatePlayer(db, userId, {
        joined: player.joined + 1,
        joinTime: data.timestamp,
      });

      // notify of each new join
      if (
        data.timestamp >= initTime &&
        (config.ignorePollStateWhenMessaging || db.server.online)
      ) {
        const onlinePlayers = getOnlinePlayers(db);
        const playerList = onlinePlayers.length > 0 ? formatPlayers(onlinePlayers) : '';
        const timestamp = getTimestamp();
        let string = `:astronaut: ${config.server.maxPlayers}人中**${onlinePlayers.length}**人がオンライン${playerList ? `: **${playerList}**` : ''} (${timestamp})\n`;
        string += `    :arrow_right: **${data.name}**がサーバーに参加しました。`;
        sendDiscordMessage(client, config.discord.channelName, string);
        if (db.server.online) {
          setDiscordActivity(client, `${onlinePlayers.length}/${config.server.maxPlayers}人がオンライン`);
        }
      }
    }
  }
}

function handleConnectionClose(client: ReturnType<typeof createDiscordClient>, data: LogEvent & { type: 'Connection close' }): void {
  log('Connection close', data.userId);

  if (INVALID_UNKNOWN_NAMES.includes(data.userId as any)) {
    if (
      data.timestamp >= initTime &&
      (config.ignorePollStateWhenMessaging || db.server.online)
    ) {
      sendDiscordMessage(
        client,
        config.discord.channelName,
        `:information_source: **${formatList(INVALID_UNKNOWN_NAMES)}**接続が閉じられました。`,
      );
    }
  } else {
    const player = getPlayer(db, data.userId);
    if (player) {
      const leftPlayerName = player.name;
      const leftPlayerJoinTime = player.joinTime ?? data.timestamp;
      db = removePlayer(db, data.userId);

      // notify of each leave
      if (
        data.timestamp >= initTime &&
        (config.ignorePollStateWhenMessaging || db.server.online)
      ) {
        const onlinePlayers = getOnlinePlayers(db);
        const playTimeInMinutes = Math.round((Date.now() - leftPlayerJoinTime) / MS_PER_MINUTE);
        const playerList = onlinePlayers.length > 0 ? formatPlayers(onlinePlayers) : '';
        const timestamp = getTimestamp();
        let string = `:astronaut: ${config.server.maxPlayers}人中**${onlinePlayers.length}**人がオンライン${playerList ? `: **${playerList}**` : ''} (${timestamp})\n`;
        string += `    :arrow_left: **${leftPlayerName}**が**${formatMinutes(playTimeInMinutes)}**プレイしてサーバーを離れました。`;
        sendDiscordMessage(client, config.discord.channelName, string);
        if (db.server.online) {
          setDiscordActivity(client, `${onlinePlayers.length}/${config.server.maxPlayers}人がオンライン`);
        }
      }
    }
  }
}

async function handleLogLine(client: ReturnType<typeof createDiscordClient>, message: string): Promise<void> {
  const data = parse(message);
  if (!data) return;

  switch (data.type) {
    case 'Log file open':
      console.log('Log file open', data.date);
      db = resetPlayers(db);
      await saveDatabase(config.dbPath, db);
      break;

    case 'Command line':
      handleCommandLine(data.commandLine);
      break;

    case 'Login request':
      handleLoginRequest(client, data);
      break;

    case 'Join request':
      handleJoinRequest(data);
      break;

    case 'Join succeeded':
      handleJoinSucceeded(client, data);
      break;

    case 'Connection close':
      handleConnectionClose(client, data);
      break;
  }

  await saveDatabase(config.dbPath, db);
}

async function startLogWatcher(onLine: (line: string) => Promise<void>): Promise<void> {
  // Wait for file to exist
  while (true) {
    try {
      const file = Bun.file(config.log.location);
      await file.text(); // Try to read
      break;
    } catch {
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Open file and read from beginning
  fileHandle = await open(config.log.location, 'r');

  // Start watching
  if (config.log.useWatchFile) {
    watchFile(config.log.location, async () => {
      await readNewLines(onLine);
    });
  } else {
    watch(config.log.location, async () => {
      await readNewLines(onLine);
    });
  }

  async function readNewLines(onLine: (line: string) => Promise<void>): Promise<void> {
    if (!fileHandle) return;

    try {
      const stats = await fileHandle.stat();
      const currentPosition = (fileHandle as any).position || 0;

      if (stats.size <= currentPosition) return;

      const buffer = Buffer.alloc(stats.size - currentPosition);
      const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, currentPosition);
      (fileHandle as any).position = stats.size;

      const text = buffer.toString('utf-8');
      const lines = text.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        await onLine(line);
      }
    } catch (error) {
      logError('Error reading log file:', error);
    }
  }
}

async function main(): Promise<void> {
  log(`Poll interval: ${config.pollIntervalMinutes} minutes`);

  // Load database
  db = await loadDatabase(config.dbPath);

  // Create Discord client with automatic disposal
  await using client = createDiscordClient();

  // Wait for ready event
  const readyPromise = new Promise<void>((resolve) => {
    client.once('clientReady', () => {
      initTime = Date.now();
      log(`Bot logged in as: ${client.user?.tag}`);
      log(`Connected to ${client.guilds.cache.size} guild(s)`);
      resolve();
    });
  });

  try {
    await client.login(discordToken);
  } catch (error) {
    logError('Discord login failed:', error);
    throw error;
  }

  // Wait for ready with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Discord ready timeout after 30 seconds')), 30000);
  });

  try {
    await Promise.race([readyPromise, timeoutPromise]);
  } catch (error) {
    logError('Discord ready error:', error);
    throw error;
  }

  // Setup purging
  if (willPurge(config.purge)) {
    if (config.purge.onStartup) {
      await attemptPurgeDiscord(client, config.purge);
    } else {
      nextPurge = getNextPurge(config.purge.hour);
      log(`First purge will be ${new Date(nextPurge)}`);
    }
  }

  // Start polling
  await update(client);
  pollInterval = setInterval(() => update(client), config.pollIntervalMinutes * MS_PER_MINUTE);

  // Start log watching
  try {
    await startLogWatcher((msg) => handleLogLine(client, msg));
  } catch (error) {
    logError('Log watcher failed:', error);
    process.exit(3);
  }

  // Keep process alive
  await new Promise<void>(() => {});
}

main().catch(console.error);
