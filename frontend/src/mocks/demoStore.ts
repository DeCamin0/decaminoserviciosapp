/**
 * DEMO Store - Persistent localStorage-based data store
 * Simulates backend database for DEMO mode
 */

// Tip pentru un item din store (trebuie să aibă cel puțin un id opțional)
type StoreItem = Record<string, unknown> & { id?: string | number };

type Store = Record<string, StoreItem[]>;

const STORE_KEY = '__demo_store__';

/**
 * Load initial data from fixtures or localStorage
 */
function loadInitial(fixtures: Store): Store {
  if (typeof window === 'undefined') return fixtures;
  
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to parse stored demo data, using fixtures:', error);
    }
  }
  
  return structuredClone(fixtures);
}

let store: Store = {};

/**
 * Persist store to localStorage
 */
function persist() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Failed to persist demo store:', error);
  }
}

/**
 * DEMO Store API
 */
export const DemoStore = {
  /**
   * Initialize store with fixtures
   */
  init(fixtures: Store) {
    store = loadInitial(fixtures);
    persist();
  },

  /**
   * Get current store snapshot
   */
  snapshot() {
    return store;
  },

  /**
   * Reset store to fixtures
   */
  reset(fixtures: Store) {
    store = structuredClone(fixtures);
    persist();
  },

  /**
   * List all items for a resource
   */
  list(resource: string) {
    return store[resource] ?? [];
  },

  /**
   * Get single item by ID
   */
  get(resource: string, id: string) {
    const items = store[resource] ?? [];
    return items.find((item: StoreItem) => String(item.id) === String(id)) || null;
  },

  /**
   * Create new item
   */
  create(resource: string, item: Record<string, unknown>) {
    if (!store[resource]) {
      store[resource] = [];
    }
    
    const newItem = {
      ...item,
      id: item.id ?? crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store[resource].unshift(newItem);
    persist();
    return newItem;
  },

  /**
   * Update existing item
   */
  update(resource: string, id: string, patch: Partial<Record<string, unknown>>) {
    const items = store[resource] ?? [];
    const index = items.findIndex((item: StoreItem) => String(item.id) === String(id));
    
    if (index === -1) return null;
    
    const updatedItem = {
      ...items[index],
      ...patch,
      id: items[index].id, // Preserve original ID
      updatedAt: new Date().toISOString()
    };
    
    items[index] = updatedItem;
    persist();
    return updatedItem;
  },

  /**
   * Delete item
   */
  remove(resource: string, id: string) {
    const items = store[resource] ?? [];
    const index = items.findIndex((item: StoreItem) => String(item.id) === String(id));
    
    if (index === -1) return false;
    
    items.splice(index, 1);
    persist();
    return true;
  },

  /**
   * Clear all data
   */
  clear() {
    store = {};
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORE_KEY);
    }
  },

  /**
   * Get store size
   */
  size() {
    return Object.keys(store).length;
  },

  /**
   * Get total items count
   */
  totalItems() {
    return Object.values(store).reduce((total, items) => total + items.length, 0);
  }
};
