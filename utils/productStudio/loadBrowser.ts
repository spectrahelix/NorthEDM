"use client";

import type * as TF from "@huggingface/transformers";
import { TRANSFORMERS_VERSION, loadSam, type Sam } from "./segment.ts";

/**
 * Load the smart-select model in the browser, once per page.
 *
 * transformers.js comes from jsDelivr at the moment Studio opens, pinned to the
 * same version as package.json, rather than through the bundler: it is ~600 KB
 * plus a WASM runtime that only shop owners framing a photo need, and its
 * Node-only dependencies (sharp, onnxruntime-node) trip the bundler. The model
 * (~14 MB) comes from Hugging Face and is kept in the browser's Cache Storage,
 * so the second photo starts instantly. The service worker ignores both
 * (it only handles our own origin).
 */
let pending: Promise<Sam> | null = null;

export function loadBrowserSam(onProgress?: (pct: number) => void): Promise<Sam> {
  if (!pending) {
    pending = (async () => {
      const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`;
      const tf = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as typeof TF;
      tf.env.allowLocalModels = false;
      return loadSam(tf, onProgress);
    })();
    pending.catch(() => { pending = null; }); // let a retry try again
  }
  return pending;
}
