/**
 * Studio product photos, the "smart select" half: tap the product, get its
 * outline. Runs Segment Anything (SlimSAM, Apache-2.0, ~14 MB quantised)
 * through transformers.js (Apache-2.0), on the person's own device — no photo
 * leaves it until the finished shot is uploaded.
 *
 * The transformers module is passed in rather than imported, because the two
 * callers load it differently: the browser from the CDN at the moment Studio
 * opens (utils/productStudio/loadBrowser.ts, so the site's bundle doesn't
 * carry it), the agent script from node_modules. The version is pinned in one
 * place, TRANSFORMERS_VERSION, and must match package.json.
 *
 * Imports use `.ts` extensions so Node can run this file directly.
 */
import type * as TF from "@huggingface/transformers";

export const TRANSFORMERS_VERSION = "4.3.1";
export const SAM_MODEL = "Xenova/slimsam-77-uniform";

/** A tap: `add` = this is the product, otherwise = this is NOT (a hand, the table). */
export type Tap = { x: number; y: number; add: boolean };

export type Sam = {
  tf: typeof TF;
  model: TF.SamModel;
  processor: TF.Processor;
};

export type Prepared = {
  sam: Sam;
  width: number;
  height: number;
  // Outputs of the vision encoder plus the size bookkeeping SAM needs.
  embeddings: Record<string, TF.Tensor>;
  original_sizes: number[][];
  reshaped_input_sizes: number[][];
};

export async function loadSam(tf: typeof TF, onProgress?: (pct: number) => void): Promise<Sam> {
  const files = new Map<string, number>();
  const progress_callback = (p: { status?: string; file?: string; progress?: number }) => {
    if (!onProgress || p.status !== "progress" || !p.file) return;
    files.set(p.file, p.progress ?? 0);
    const all = [...files.values()];
    onProgress(all.reduce((a, b) => a + b, 0) / Math.max(2, all.length));
  };
  const model = (await tf.SamModel.from_pretrained(SAM_MODEL, { dtype: "q8", progress_callback })) as TF.SamModel;
  const processor = await tf.AutoProcessor.from_pretrained(SAM_MODEL, {});
  return { tf, model, processor };
}

/** Run the (slow) image encoder once per photo; every tap after that is quick. */
export async function prepare(sam: Sam, image: TF.RawImage): Promise<Prepared> {
  const inputs = await sam.processor(image);
  const embeddings = await sam.model.get_image_embeddings(inputs);
  return {
    sam, width: image.width, height: image.height, embeddings,
    original_sizes: inputs.original_sizes, reshaped_input_sizes: inputs.reshaped_input_sizes,
  };
}

/**
 * The product's mask for these taps: W×H, 1 = product. SAM proposes three
 * masks per prompt; the one it scores highest is used.
 */
export async function maskFor(p: Prepared, taps: Tap[]): Promise<{ mask: Uint8Array; score: number }> {
  const { tf, model, processor } = p.sam;
  const [rh, rw] = p.reshaped_input_sizes[0];
  const [oh, ow] = p.original_sizes[0];
  const sx = rw / ow, sy = rh / oh;
  const pts = new Float32Array(taps.length * 2);
  taps.forEach((t, i) => { pts[i * 2] = t.x * sx; pts[i * 2 + 1] = t.y * sy; });
  const labels = BigInt64Array.from(taps.map((t) => (t.add ? BigInt(1) : BigInt(0))));
  const input_points = new tf.Tensor("float32", pts, [1, 1, taps.length, 2]);
  const input_labels = new tf.Tensor("int64", labels, [1, 1, taps.length]);

  const out = await model({ ...p.embeddings, input_points, input_labels });
  const masks = await (processor as unknown as {
    post_process_masks: (m: TF.Tensor, o: number[][], r: number[][]) => Promise<TF.Tensor[]>;
  }).post_process_masks(out.pred_masks, p.original_sizes, p.reshaped_input_sizes);

  const scores = Array.from(out.iou_scores.data as Float32Array);
  const best = scores.indexOf(Math.max(...scores));
  const m = masks[0];
  const n = p.width * p.height;
  const data = m.data as ArrayLike<number | boolean>;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = data[best * n + i] ? 1 : 0;
  return { mask, score: scores[best] };
}
