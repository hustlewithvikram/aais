# Android Adaptive Icon Studio

A browser-based Android Adaptive Icon editor built with React, TypeScript and Vite. Import Android Vector Drawable XML for foreground and background layers, preview launcher masks, edit XML, and export PNG or Android resource files.

## Getting started

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Features

- Import foreground and background Android Vector Drawable XML files.
- Live layered preview with circle, squircle, rounded-square, square and teardrop masks.
- Edit XML directly with basic XML/vector validation.
- Adjust foreground scale and X/Y position.
- Toggle layer visibility and inspect a grayscale preview.
- Export a 512 × 512 PNG or a ZIP containing Android `res/drawable` and `res/mipmap-anydpi-v26` resources.
- Dark and light themes.
- Client-side processing; source XML is not uploaded to a server.

## Current XML support

The renderer supports common `<vector>`, `<path>` and nested `<group>` elements, including path data, solid fill/stroke colors, alpha, fill type and basic group transforms. It is not a complete Android VectorDrawable implementation yet: gradients, clip paths, trim paths, animated vectors, theme attributes and all Android resource/color references are not fully supported. Verify production assets on an Android emulator or device.

## Stack

React 18 · TypeScript · Vite · SVG · Canvas · JSZip · Lucide React
