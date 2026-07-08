/* =========================================
   0. INDEXED DB WRAPPER (To bypass 5MB localStorage limit)
   Ported verbatim from utils.js
   ========================================= */
const DB_CONFIG = {
    name: 'QuizAppDB',
    version: 1,
    storeName: 'app_cache'
};

export const IDB = {
    dbPromise: null,

    open() {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject("IndexedDB failed to open");
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
                    db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'key' });
                }
            };
        });
        return this.dbPromise;
    },

    async get(key) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([DB_CONFIG.storeName], 'readonly');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("IDB Get Error", e);
            return null;
        }
    },

    async set(key, data) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.put({ key, ...data });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("IDB Set Error", e);
        }
    },

    async delete(key) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("IDB Delete Error", e);
        }
    },

    async getAllKeys() {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([DB_CONFIG.storeName], 'readonly');
                const store = transaction.objectStore(DB_CONFIG.storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("IDB GetAllKeys Error", e);
            return [];
        }
    }
};
