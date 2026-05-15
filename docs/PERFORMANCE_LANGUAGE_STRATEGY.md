# EdSync Performance Language Strategy

EdSync should stay TypeScript-first for the Next.js app, API routes, Cloudflare Workers, and shared domain modules. The current slow paths are mostly remote AI calls, D1/R2 network I/O, upload scanning, browser rendering, and deployment cold starts. A broad rewrite to Rust, Go, Python, or another runtime would add boundaries without improving those bottlenecks.

## Current Position

- Keep product code in TypeScript unless a measured CPU-bound module proves otherwise.
- Use platform-native engines where they already exist: WebCrypto for password hashing, D1 for data, R2 for object storage, and Workers/Vercel runtimes for request handling.
- Prefer query, cache, batching, streaming, bundle, and Worker Queue optimizations before changing languages.
- Keep one programming language per source file so app behavior remains debuggable and deployable across Vercel, Cloudflare, Docker, and local modes.

## When Another Language Is Allowed

Introduce Rust, Go, Python, or WASM only when all of these are true:

1. A benchmark identifies a CPU-bound hot path with p95 latency or memory pressure that TypeScript cannot reasonably reduce.
2. The new module can be isolated behind a stable API and deployed in every supported mode.
3. Cold starts, build time, bundle size, and operational complexity are included in the benchmark.
4. The change improves p95 latency or memory by at least 30% in realistic EdSync workloads.
5. The module has tests that compare results against the TypeScript implementation.

## Likely Future Candidates

- Standards processing: large SCORM ZIP parsing, manifest validation, and package checks.
- Document processing: high-volume PDF/DOCX/OCR extraction when a dedicated parser is needed.
- Media work: video/audio transcoding, thumbnailing, and waveform generation.
- Analytics: large event rollups once D1 rollups are no longer enough.

## Near-Term Optimization Priorities

- Remove request waterfalls and run independent reads in parallel.
- Add or verify D1 indexes for tenant, class, work, catalog, and event queries.
- Keep heavy AI/provider work behind queues, cooldowns, and cached provider health.
- Bound upload extraction, scanning, and parsing work so large files cannot slow the app.
- Split heavy UI panels and settings into lazy-loaded sections.
- Measure before migrating languages.
