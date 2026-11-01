# Android Adaptive Icon Studio

A client-side Android Adaptive Icon editor built with React, TypeScript and Vite. Import foreground, background and monochrome Android VectorDrawable XML, inspect rendered layers, preview launcher masks, edit XML and export Android resources or a masked 512 × 512 PNG.

## Run locally

    npm install
    npm run dev

## Production build

    npm run build
    npm run preview

The production output is written to dist/.

## Features

- Foreground, background and monochrome VectorDrawable XML layers.
- Live preview with circle, squircle, rounded-square, square and teardrop masks.
- Android ARGB color conversion to SVG color plus opacity.
- Solid fills, linear/radial gradients, strokes, fill rules, stroke caps/joins and nested group transforms.
- Basic clip-path support and stroke-based trim-path rendering.
- Foreground scale and X/Y positioning.
- Layer visibility controls and editable XML source.
- XML syntax/root validation with unsupported-feature warnings.
- Transparent PNG output when the background layer is hidden; PNG is clipped to the selected launcher mask.
- Android resource ZIP with adaptive icon XML and optional Android 13+ monochrome drawable.
- Light and dark themes; file processing stays in the browser.

## VectorDrawable compatibility

This is a browser renderer for common static VectorDrawable assets, not a full Android resource compiler. It supports vector roots, paths, nested groups, solid colors, alpha, strokes, fill types, linear/radial gradients, basic clip-paths and stroke-based trim-paths. Filled-path trimming is not supported. Android resource references (@color, ?attr), theme resolution, sweep gradients, animated vectors, selectors and platform-specific rendering behavior are not resolved. Unsupported elements are surfaced as warnings rather than silently treated as fully supported. Validate exported resources in Android Studio and test launcher behavior on target Android versions.

## Deploy to Vercel

Import this repository in Vercel and use:

- Framework preset: Vite
- Root directory: ./
- Build command: npm run build
- Output directory: dist
- Install command: npm install
- Production branch: master

No server, environment variables or backend are required. A vercel.json is included for SPA fallback routing.

## Stack

React 18 · TypeScript · Vite · SVG · Canvas · JSZip · Lucide React
