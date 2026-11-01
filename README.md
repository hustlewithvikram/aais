# Android Adaptive Icon Studio

A browser-based Android launcher icon workspace built with React, TypeScript and Vite. Import or paste Android drawable XML, inspect each adaptive icon layer, preview launcher mask shapes, adjust foreground placement, and export PNGs or Android resource files.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Editor features

- Separate foreground, background and monochrome layers with visibility controls.
- Import XML from disk or paste XML text directly.
- Live preview with selectable circle, squircle, rounded-square, square and teardrop mask approximations.
- Correct 72dp safe-zone guide for the standard 108dp adaptive icon viewport.
- Foreground scale and X/Y positioning controls.
- XML source editing, validation feedback and unsupported-feature warnings.
- Light and dark themes with responsive desktop, tablet and mobile layouts.
- 512 × 512 PNG export and Android adaptive-icon resource ZIP export.
- Local-only processing; files are not uploaded to a server.

## VectorDrawable rendering

The browser renderer supports static Android `<vector>` drawables, including:

- Viewport dimensions and root alpha.
- Paths and Android pathData commands supported by SVG paths.\n- Common shape drawables: rectangle, oval, line and approximate ring, solid fills, corner radii, strokes and shape gradients.\n- Inline layer-list items, inset, rotate, scale, color drawables and a first-item selector preview.
- Fill and stroke colors, ARGB alpha, fill/stroke alpha, stroke width, caps, joins and miter limit.
- Non-zero and even-odd fill rules.
- Nested groups with pivot, rotation, scale and translation transforms.
- Clip paths.
- Linear and radial gradients, including AAPT `<aapt:attr name="android:fillColor">` gradients with explicit `<item>` color stops.
- Basic root tint handling for common tint modes.
- Stroke trim-path approximation.

### Compatibility boundaries

This is a browser-side Android drawable preview renderer, not the Android resource compiler or Android framework renderer. Android resource references such as `@color/...`, theme attributes such as `?attr/...`, color state lists, and references to resources from other files require project resources and theme context that a standalone XML file does not contain. Sweep gradients, animated vectors, animated state, selectors, drawable aliases, and platform-specific tint/blend behavior are not rendered as a full Android runtime would render them. Trim-path rendering is an SVG approximation, especially for filled and complex closed paths.

Drawable types that depend on external resources or runtime state still need Android project context. The selector preview shows only its first item, ring drawables are approximated, and layer-list items are only rendered when their child drawable is inline. The selected launcher mask is an illustrative preview: Android launchers choose and apply the actual mask on-device. For pixel-identical results, build the resources in Android Studio and inspect them on the target Android version.

## Deploy to Vercel

- Framework preset: Vite
- Root directory: `./`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Production branch: `master`

No backend or environment variables are required.

## Stack

React 18 · TypeScript · Vite · SVG · Canvas · JSZip · Lucide React
