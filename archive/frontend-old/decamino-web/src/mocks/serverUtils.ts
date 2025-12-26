/**
 * MSW Server Utilities
 * Helper functions for MSW handlers
 */

/**
 * Simulate network delay
 */
export const randDelay = (min = 100, max = 400) =>
  new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
  );

/**
 * Create success response
 */
export function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * Create error response
 */
export function err(status = 500, message = 'Eroare simulată DEMO') {
  return new Response(JSON.stringify({ error: message }), { 
    status, 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * Parse URL and query parameters
 */
export function parseUrl(url: string) {
  const urlObj = new URL(url);
  const queryParams: Record<string, string> = {};
  
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });
  
  return { url: urlObj, qp: queryParams };
}

/**
 * Paginate array of items
 */
export function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    items: items.slice(start, end),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize)
  };
}

/**
 * Search items by query
 */
export function searchItems<T>(
  items: T[], 
  query: string, 
  searchFields: (keyof T)[]
): T[] {
  if (!query.trim()) return items;
  
  const lowercaseQuery = query.toLowerCase();
  
  return items.filter(item => 
    searchFields.some(field => {
      const value = item[field];
      return value && String(value).toLowerCase().includes(lowercaseQuery);
    })
  );
}

/**
 * Sort items by field
 */
export function sortItems<T>(
  items: T[], 
  field: keyof T, 
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}
