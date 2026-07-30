import { useSyncExternalStore } from "react"; import type { DashboardStore } from "@hort/mqtt";
export const useStore = (store: DashboardStore) => useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
