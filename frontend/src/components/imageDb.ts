// imageDb.ts
import { openDB } from "idb";

const DB_NAME = "gpt-image-db";
const STORE_NAME = "images";

export const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
  },
});

export async function saveImageToDb(base64: string) {
  const db = await dbPromise;
  return await db.add(STORE_NAME, {
    base64,
    created: new Date().toISOString(),
  });
}

export async function getAllImagesFromDb() {
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
}

export async function deleteImageFromDb(id: number) {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}
