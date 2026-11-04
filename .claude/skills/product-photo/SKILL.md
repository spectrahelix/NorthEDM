---
name: product-photo
description: Turn a vendor's phone snapshot of a product (held in a hand, on a floor, cluttered background) into a clean square studio shot on a fresh backdrop for their NorthEDM shop — smart-select the item, cut out the background and hand, place it on a chosen colour, then add it to the shop. Use when asked to crop/cut out/clean up/remove the background of product photos, make product pictures "look professional", or put a vendor's photos into their shop.
---

# Product photo → studio shot → shop

The same tool shop owners have on the site: every item photo on
`/vendor/dashboard` goes through the square cropper, whose **✨ Studio** button
opens `app/components/vendor/PhotoStudio.tsx`. You run the identical code from
the command line, so your result matches what the owner would get:

| Piece | File |
|---|---|
| Smart select (Segment Anything / SlimSAM via transformers.js, on-device) | `utils/productStudio/segment.ts` |
| Mask clean-up, edge snap, backdrop + shadow composite | `utils/productStudio/compose.ts` |
| The only backdrops offered | `utils/productStudio/backdrops.ts` |
| Command line | `scripts/product-photo.mjs` |

Fix a cut-out problem in those files, not in a one-off script — the shops get
the fix too. Don't hand-draw polygons or reach for another background remover.

## 1. Read tap points off a grid

Images pasted into the chat are saved under `/root/.claude/uploads/…`; the
system message lists the paths. Work in the scratchpad.

```bash
node --no-warnings scripts/product-photo.mjs grid <photo> --out <scratch>/grid.png
```

Open the grid image. Coordinates are pixels of the photo after EXIF rotation
and the 1600 px cap the site also applies.

## 2. Make the shot

```bash
node --no-warnings scripts/product-photo.mjs make <photo> \
  --tap X,Y --tap X,Y --tap X,Y   # points ON the item
  --not X,Y                       # points that are NOT the item (a fingertip)
  --backdrop sand --out <scratch>/<item>.jpg
```

`node scripts/product-photo.mjs backdrops` lists ids. It writes the 1200×1200
JPEG and `<item>.select.png`, with everything outside the selection dimmed and
the taps as green/red dots.

**Open both files every time.** The model's confidence number doesn't tell you
whether a fingertip came along, so don't rely on it.

What worked on the first real batch (Gee's shop, 2026-11-04):

- **Tap 2–3 spots across the item: top, middle, bottom.** One tap on a label
  selects *just the label* (Hanna's Secret: the white sticker, not the black
  box). One tap on a bottle body can drop the cap.
- **A finger still attached → one `--not` right on the fingertip, added to the
  positive taps.** A `--not` placed out in the palm or between the item and the
  hand made the cut worse (it ate the bottle's cap and base). Put it on the
  part you want gone.
- Box prompts don't work with this compact model (it returns noise), so taps
  are the only way to point.
- Backdrop: light products on `teal` / `night`, dark boxes on `sand` / `studio`,
  colourful packs on a backdrop that echoes them (yellow talc on `blush` or
  `sunset`). One photo per item, matching backdrops across a shop look tidy.
- If the photo shows the back of a box (ingredients), say so. A front shot
  sells better, so ask the vendor for one, but don't block on it.

Show the finished shots to the person (`SendUserFile`, `display: "render"`)
before going further.

## 3. Into the shop — only with a clear yes

Adding items writes to the live database and storage, and customers see the
result. **Ask first, every time:** name, price in the shop's currency (prices
are whole units: `400` = 400 GMD for a GMD shop), stock count, and which shop.
A price the vendor didn't give is a question, not a guess.

The site's own path, and the one to prefer: the vendor (or the owner signed in
as them) opens `/vendor/dashboard`, adds the item, and uploads your JPEG. Studio
is right there if they want to redo it.

Doing it for them needs the service role (`SUPABASE_SERVICE_ROLE_KEY`; check
`env`, and never print it). Without that key you can't upload files to Storage:
the Supabase connector runs SQL but has no Storage upload. In that case hand
over the files and say plainly that you didn't upload them. With the key:

1. Upload each JPEG to the public bucket `shop-products` at
   `<vendor's user id>/<Date.now()>-<random>.jpg`, the same layout
   `/api/vendor/products/upload` uses, and get its public URL.
2. Insert into `products`: `vendor_id`, `name`, `category`, `description`,
   `price`, `inventory_count`, `image_url` (the URL), `is_public: true`,
   `status` (`'active'` to list it, `'draft'` to stage it).
3. Insert into `product_images`: `product_id`, `url`, `position: 0`. The item
   page gallery reads this table, and `image_url` mirrors the first one.

Then **verify like AGENTS.md says**: logged out, open the shop page
(`/<store slug>` and `/marketplace/<vendor id>`) and the item page, and confirm
the new photo URL is in the HTML. Compare against an item that was already
there, so a broken page can't pass. Report what was added and what you saw live.
A lights-out vendor (AGENTS.md) won't show publicly. That's expected, not a
failure to fix.
