import { useSyncExternalStore } from "react"; import type { SnapshotStore } from "./store";
export const useStore = (store: SnapshotStore) => useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
