import { createSignal } from 'solid-js';

export interface InfiniteScrollOptions<T> {
  pageSize: number;
  fetchMore: (offset: number, limit: number) => Promise<T[]>;
}

export interface InfiniteScrollReturn<T> {
  items: () => T[];
  hasMore: () => boolean;
  isLoadingMore: () => boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  setItems: (items: T[]) => void;
  appendItems: (newItems: T[]) => void;
}

/**
 * Generic infinite scroll hook for pagination with lazy loading.
 * Appends new items instead of replacing, preserving scroll position.
 */
export function useInfiniteScroll<T>(options: InfiniteScrollOptions<T>): InfiniteScrollReturn<T> {
  const [items, setItems] = createSignal<T[]>([]);
  const [hasMore, setHasMore] = createSignal(true);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);

  const loadMore = async () => {
    if (!hasMore() || isLoadingMore()) return;

    setIsLoadingMore(true);
    try {
      const currentItems = items();
      const newItems = await options.fetchMore(currentItems.length, options.pageSize);

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems([...currentItems, ...newItems]);
        // If returned fewer than requested, no more data
        if (newItems.length < options.pageSize) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Failed to load more items:', error);
      throw error;
    } finally {
      setIsLoadingMore(false);
    }
  };

  const reset = () => {
    setItems([]);
    setHasMore(true);
  };

  const appendItems = (newItems: T[]) => {
    setItems((prev) => [...prev, ...newItems]);
    if (newItems.length < options.pageSize) {
      setHasMore(false);
    }
  };

  return {
    items,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
    setItems,
    appendItems,
  };
}
