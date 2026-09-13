/**
 * The content repository integration.
 *
 * `load`  reads a directory into a tolerant snapshot (never throws);
 * `store` keeps that snapshot fresh and tells subscribers when it changes;
 * `overlay` merges it over the compiled-in catalog.
 */
export * from "./load.js";
export * from "./store.js";
export * from "./overlay.js";
