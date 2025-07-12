import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "gpt-message-db";
const STORE_NAME = "messages";
const MAX_MESSAGES_PER_SESSION = 1000; // Safety limit

interface DB extends IDBPDatabase {
  [STORE_NAME]: {
    value: StoredMessage;
    key: number;
    indexes: {
      timestamp: string;
      sessionId: string;
    };
  };
}

export const dbPromise = openDB<DB>(DB_NAME, 2, {
  upgrade(db, oldVersion) {
    console.log(`Database upgrade from version ${oldVersion} to 2`);
    if (oldVersion < 1) {
      console.log("Creating initial database schema");
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("timestamp", "timestamp");
      store.createIndex("sessionId", "sessionId");
    }
    if (oldVersion < 2) {
      console.log("Applying version 2 migrations");
      // Future migrations
    }
  },
});

export interface StoredMessage {
  id?: string;
  sessionId: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastActive: string;
  messageCount?: number;
}

export async function saveMessageToDb(
  message: Omit<StoredMessage, "id">
): Promise<number> {
  console.log("Saving message to DB for session:", message.sessionId);
  const db = await dbPromise;
  const id = await db.add(STORE_NAME, message);
  console.log("Message saved with ID:", id);
  return id as number; // Cast to number since we're using auto-increment
}

export async function updateMessageInDb(
  message: StoredMessage
): Promise<number> {
  if (!message.id) {
    console.error("Attempted to update message without ID");
    throw new Error("Cannot update message without ID");
  }
  console.log("Updating message in DB with ID:", message.id);
  const db = await dbPromise;
  const id = await db.put(STORE_NAME, message);
  console.log("Message updated with ID:", id);
  return id as number; // Cast to number since we're using auto-increment
}

export async function getMessagesBySession(
  sessionId: string,
  limit = 200,
  offset = 0
): Promise<StoredMessage[]> {
  console.log(
    `Fetching messages for session ${sessionId}, limit ${limit}, offset ${offset}`
  );
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("sessionId");

  const keys = await index.getAllKeys(IDBKeyRange.only(sessionId));
  console.log(`Found ${keys.length} messages for session ${sessionId}`);

  const paginatedKeys = keys.slice(offset, offset + limit);
  console.log(`Returning ${paginatedKeys.length} messages after pagination`);

  const messages = await Promise.all(
    paginatedKeys.map((key) => store.get(key))
  );
  await tx.done;

  const filteredMessages = messages.filter(Boolean) as StoredMessage[];
  console.log(`Returning ${filteredMessages.length} valid messages`);
  return filteredMessages;
}

export async function getMessageById(
  id: number
): Promise<StoredMessage | undefined> {
  console.log("Fetching message by ID:", id);
  const db = await dbPromise;
  const message = await db.get(STORE_NAME, id);
  console.log(message ? "Message found" : "Message not found");
  return message;
}

export async function getMessageCountBySession(
  sessionId: string
): Promise<number> {
  console.log("Getting message count for session:", sessionId);
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("sessionId");
  const count = await index.count(IDBKeyRange.only(sessionId));
  await tx.done;
  console.log(`Session ${sessionId} has ${count} messages`);
  return count;
}

export async function deleteMessageFromDb(id: string): Promise<void> {
  console.log("Deleting message with ID:", id);
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
  console.log("Message deleted");
}

export async function deleteAllMessages(): Promise<void> {
  console.log("Deleting all messages from DB");
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await store.clear();
  await tx.done;
  console.log("All messages deleted");
}

export async function clearMessagesBySession(sessionId: string): Promise<void> {
  console.log(`Clearing all messages for session ${sessionId}`);
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("sessionId");

  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  let deletedCount = 0;

  while (cursor) {
    await cursor.delete();
    deletedCount++;
    cursor = await cursor.continue();
  }

  await tx.done;
  console.log(`Deleted ${deletedCount} messages for session ${sessionId}`);
}

export async function saveMessagesBatch(
  messages: StoredMessage[]
): Promise<void> {
  console.log(`Saving batch of ${messages.length} messages`);

  if (messages.length === 0) return;
  if (messages.length > 100) {
    console.warn(
      `Large batch size (${messages.length}), performance may be affected`
    );
  }

  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const sessionId = messages[0].sessionId;

  // Get existing message IDs for this session
  const existingMessages = await store
    .index("sessionId")
    .getAll(IDBKeyRange.only(sessionId));
  const existingIds = new Set(existingMessages.map((m) => m.id));

  let newCount = 0;
  let updatedCount = 0;

  for (const message of messages) {
    if (message.id && existingIds.has(message.id)) {
      // Update existing message
      await store.put(message);
      updatedCount++;
    } else {
      // Add new message
      await store.add(message);
      newCount++;
    }
  }

  await tx.done;
  console.log(`Batch save completed: ${newCount} new, ${updatedCount} updated`);
}

export async function enforceMessageLimits(): Promise<void> {
  console.log("Enforcing message limits");
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const sessionIndex = store.index("sessionId");

  // Get all unique session IDs (using Array.from to handle downlevel iteration)
  const sessions = await sessionIndex.getAllKeys();
  const uniqueSessions = Array.from(new Set(sessions as number[]));
  console.log(`Found ${uniqueSessions.length} unique sessions`);

  for (const sessionId of uniqueSessions) {
    const count = await sessionIndex.count(IDBKeyRange.only(sessionId));
    if (count > MAX_MESSAGES_PER_SESSION) {
      const excess = count - MAX_MESSAGES_PER_SESSION;
      console.log(`Pruning ${excess} messages from session ${sessionId}`);

      const timestampIndex = store.index("timestamp");
      let cursor = await timestampIndex.openCursor(IDBKeyRange.only(sessionId));
      let deleted = 0;

      while (cursor && deleted < excess) {
        await cursor.delete();
        deleted++;
        cursor = await cursor.continue();
      }
      console.log(
        `Deleted ${deleted} oldest messages from session ${sessionId}`
      );
    }
  }

  await tx.done;
  console.log("Message limits enforcement complete");
}

export async function exportSessionToMd(sessionId: string): Promise<string> {
  console.log(`Exporting session ${sessionId} to Markdown`);
  const messages = await getMessagesBySession(
    sessionId,
    MAX_MESSAGES_PER_SESSION
  );
  console.log(`Formatting ${messages.length} messages`);

  const lines = messages.map((msg) => {
    const time = new Date(msg.timestamp).toLocaleString();
    switch (msg.role) {
      case "system":
        return `*_${time} [System]: ${msg.content}_*`;
      case "user":
        return `**${time} [User]:** ${msg.content}`;
      case "assistant":
        return `**${time} [Assistant]:** ${msg.content}`;
      default:
        return `${time} [Unknown]: ${msg.content}`;
    }
  });

  console.log("Markdown content generated");
  return lines.join("\n\n");
}

export async function getAllSessions(): Promise<ChatSession[]> {
  console.log("Fetching all sessions");
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const sessionIndex = store.index("sessionId");

  const messages = await store.getAll();
  console.log(`Found ${messages.length} total messages`);

  const sessions: Record<string, ChatSession> = {};

  // First pass to create sessions and track last activity
  messages.forEach((msg) => {
    if (!sessions[msg.sessionId]) {
      sessions[msg.sessionId] = {
        id: msg.sessionId,
        title: `Session ${msg.sessionId.slice(0, 6)}`,
        createdAt: msg.timestamp,
        lastActive: msg.timestamp,
      };
    } else if (
      new Date(msg.timestamp) > new Date(sessions[msg.sessionId].lastActive)
    ) {
      sessions[msg.sessionId].lastActive = msg.timestamp;
    }
  });

  // Second pass to count messages per session
  const sessionIds = Object.keys(sessions);
  console.log(`Processing ${sessionIds.length} unique sessions`);

  for (const sessionId of sessionIds) {
    sessions[sessionId].messageCount = await sessionIndex.count(
      IDBKeyRange.only(sessionId)
    );
  }

  const sortedSessions = Object.values(sessions).sort(
    (a, b) =>
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
  );

  console.log(`Returning ${sortedSessions.length} sessions`);
  return sortedSessions;
}

export async function downloadSessionMd(sessionId: string) {
  console.log(`Downloading session ${sessionId} as Markdown`);
  const mdContent = await exportSessionToMd(sessionId);

  // Ask user for filename
  const defaultName = `session-${sessionId}.md`;
  const inputName = prompt("Enter filename for download:", defaultName);

  if (inputName === null) {
    // User cancelled the prompt
    console.log("Download cancelled by user");
    return;
  }

  // Ensure the filename ends with .md
  let filename = inputName.trim();
  if (!filename.toLowerCase().endsWith(".md")) {
    filename += ".md";
  }

  const blob = new Blob([mdContent], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  // Create a temporary <a> element
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`Download initiated with filename "${filename}"`);
}

export async function createSessionMdFile(sessionId: string): Promise<File> {
  console.log(`Creating session ${sessionId} Markdown file`);
  const mdContent = await exportSessionToMd(sessionId);

  // Create a Blob with Markdown content
  const blob = new Blob([mdContent], { type: "text/markdown" });

  // Optionally create a File object (Blob with name and lastModified)
  const file = new File([blob], `session-${sessionId}.md`, {
    type: "text/markdown",
    lastModified: Date.now(),
  });

  console.log("Markdown file created");
  return file;
}
