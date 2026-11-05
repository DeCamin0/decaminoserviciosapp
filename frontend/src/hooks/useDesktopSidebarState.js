import { useCallback, useEffect, useState } from 'react';

const COLLAPSED_KEY = 'decamino.desktopSidebar.collapsed';
const OPEN_CATS_KEY = 'decamino.desktopSidebar.openCategories';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Persist collapsed + open category accordions for desktop sidebar.
 */
export function useDesktopSidebarState() {
  const [collapsed, setCollapsedState] = useState(() =>
    Boolean(readJson(COLLAPSED_KEY, false)),
  );
  const [openCategories, setOpenCategoriesState] = useState(() => {
    const stored = readJson(OPEN_CATS_KEY, null);
    return stored && typeof stored === 'object' ? stored : {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore quota */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_CATS_KEY, JSON.stringify(openCategories));
    } catch {
      /* ignore */
    }
  }, [openCategories]);

  const setCollapsed = useCallback((value) => {
    setCollapsedState((prev) => (typeof value === 'function' ? value(prev) : Boolean(value)));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => !prev);
  }, []);

  const setCategoryOpen = useCallback((catId, open) => {
    setOpenCategoriesState((prev) => ({ ...prev, [catId]: Boolean(open) }));
  }, []);

  const toggleCategory = useCallback((catId) => {
    setOpenCategoriesState((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  /** Ensure category containing the active route is expanded */
  const ensureCategoryOpen = useCallback((catId) => {
    if (!catId) return;
    setOpenCategoriesState((prev) => {
      if (prev[catId]) return prev;
      return { ...prev, [catId]: true };
    });
  }, []);

  return {
    collapsed,
    setCollapsed,
    toggleCollapsed,
    openCategories,
    setCategoryOpen,
    toggleCategory,
    ensureCategoryOpen,
  };
}
