const DB_NAME = 'annstudio-db'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

async function readRaw(key: string): Promise<unknown> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
}

async function writeRaw(key: string, value: unknown): Promise<void> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(value, key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'))
  })
}

function readLocalStorageFallback<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function loadFromDatabase<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return fallback
  }

  try {
    const fromDb = await readRaw(key)
    if (fromDb !== undefined) {
      return fromDb as T
    }

    const localValue = readLocalStorageFallback<T>(key)
    if (localValue !== null) {
      await writeRaw(key, localValue)
      return localValue
    }

    return fallback
  } catch {
    return fallback
  }
}

export async function saveToDatabase<T>(key: string, value: T): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return
  }

  try {
    await writeRaw(key, value)
  } catch {
    // Keep UI responsive when browser storage is unavailable.
  }
}
