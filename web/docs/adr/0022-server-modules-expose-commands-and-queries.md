# Server modules expose commands and queries explicitly

The server is organised by domain module, with each application capability implemented as one named file under that module's `application/commands/` or `application/queries/` directory and tested beside it. Each directory has an `index.ts` capability map, while cross-module composition, command dispatch and shared HTTP-facing queries remain under `src/application`; this adds small files and explicit wiring in exchange for making ownership, available actions and read operations visible without opening a central handler or dispatcher.
