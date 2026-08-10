import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Snapshot as WireSnapshot } from "@hort/contracts";
import { SnapshotStore } from "./store";
import { App } from "./App";
import "./styles.css";

const root = createRoot(document.body.firstElementChild as HTMLElement);
const store = new SnapshotStore();
const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

const source = new EventSource("/api/stream");
source.onopen = () => store.setServerConnected(true);
source.onerror = () => store.setServerConnected(false);
source.onmessage = (event) => { store.setServerConnected(true); store.replace(JSON.parse(event.data) as WireSnapshot); };

root.render(<QueryClientProvider client={queryClient}><App store={store} /></QueryClientProvider>);
