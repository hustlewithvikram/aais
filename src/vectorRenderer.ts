export type RenderResult = { svg: string; error: string; warnings: string[] };

const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';

function getAttr(node: Element, name: string, fallback = ''): string {
  return node.getAttributeNS(ANDROID_NS, name) ?? node.getAttribute('android:' + name) ?? node.getAttribute(name) ?? fallback;
}
function getNumber(node: Element, name: string, fallback: number): number {
  const raw = getAttr(node, name, String(fallback)).trim().replace(/dp|dip|px$/i, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function parseColor(raw: string, alpha = 1): { color: string; opacity: number; unresolved: boolean } {
  const value = raw.trim();
  if (!value || value === '@null' || value.toLowerCase() === 'none') return { color: 'none', opacity: 1, unresolved: false };
  if (value.startsWith('@') || value.startsWith('?')) return { color: '#000000', opacity: alpha, unresolved: true };
  let color = value;
  let opacity = alpha;
  if (/^#[\da-f]{8}$/i.test(color)) {
    opacity *= parseInt(color.slice(1, 3), 16) / 255;
    color = '#' + color.slice(3);
  } else if (/^#[\da-f]{4}$/i.test(color)) {
    opacity *= parseInt(color[1] + color[1], 16) / 255;
    color = '#' + color[2] + color[2] + color[3] + color[3];
  } else if (/^#[\da-f]{3}$/i.test(color)) {
    color = '#' + color.slice(1).split('').map(char => char + char).join('');
  }
  return { color, opacity: clamp(opacity), unresolved: false };
}

export function renderVector(xml: string): RenderResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) return { svg: '', error: 'XML syntax error: ' + (parseError.textContent || 'Unable to parse XML').split('\n')[0], warnings: [] };

  const root = doc.documentElement;
  if (!root || root.localName !== 'vector') {
    const type = root?.localName || 'empty document';
    return { svg: '', error: 'This layer expects a static Android <vector> drawable. Found <' + type + '>. Animated vectors, selectors and shape drawables need a different preview mode.', warnings: [] };
  }

  const viewportWidth = getNumber(root, 'viewportWidth', 108);
  const viewportHeight = getNumber(root, 'viewportHeight', 108);
  if (viewportWidth <= 0 || viewportHeight <= 0) return { svg: '', error: 'viewportWidth and viewportHeight must be greater than zero.', warnings: [] };

  const warnings = new Set<string>();
  const defs: string[] = [];
  let id = 0;
  const rootAlpha = clamp(getNumber(root, 'alpha', 1));
  const rootTint = getAttr(root, 'tint');
  const rootTintMode = getAttr(root, 'tintMode', 'src_in');

  const makeGradient = (path: Element): string | null => {
    const attrNode = Array.from(path.children).find(child => child.localName === 'attr' && getAttr(child, 'name') === 'android:fillColor');
    const gradient = attrNode ? Array.from(attrNode.children).find(child => child.localName === 'gradient') : null;
    const direct = Array.from(path.children).find(child => child.localName === 'gradient');
    const gradientNode = gradient || direct;
    if (!gradientNode) return null;

    const type = getAttr(gradientNode, 'type', 'linear');
    if (type === 'sweep') {
      warnings.add('Sweep gradients are not supported by SVG and are omitted. Use a raster preview or Android rendering for exact sweep-gradient output.');
      return null;
    }
    if (type !== 'linear' && type !== 'radial') {
      warnings.add('Unknown gradient type "' + type + '" was skipped.');
      return null;
    }

    const stops = Array.from(gradientNode.children)
      .filter(child => child.localName === 'item')
      .map(child => ({
        offset: clamp(getNumber(child, 'offset', 0)),
        color: parseColor(getAttr(child, 'color', '#000000'))
      }))
      .sort((a, b) => a.offset - b.offset);

    if (!stops.length) {
      const start = parseColor(getAttr(gradientNode, 'startColor', '#000000'));
      const end = parseColor(getAttr(gradientNode, 'endColor', '#ffffff'));
      const centerRaw = getAttr(gradientNode, 'centerColor');
      stops.push({ offset: 0, color: start });
      if (centerRaw) stops.push({ offset: 0.5, color: parseColor(centerRaw) });
      stops.push({ offset: 1, color: end });
    }
    if (stops.some(stop => stop.color.unresolved)) warnings.add('A gradient stop uses a resource or theme reference; it is shown as black until resolved.');
    const stopMarkup = stops.map(stop => '<stop offset="' + stop.offset + '" stop-color="' + escapeAttr(stop.color.color) + '" stop-opacity="' + stop.color.opacity + '"/>').join('');
    const gradientId = 'aais-gradient-' + (++id);
    const tileMode = getAttr(gradientNode, 'tileMode', 'clamp');
    const spread = tileMode === 'repeat' ? 'repeat' : tileMode === 'mirror' ? 'reflect' : 'pad';

    if (type === 'radial') {
      const cx = getNumber(gradientNode, 'centerX', viewportWidth / 2);
      const cy = getNumber(gradientNode, 'centerY', viewportHeight / 2);
      const radius = getNumber(gradientNode, 'gradientRadius', Math.min(viewportWidth, viewportHeight) / 2);
      if (radius <= 0) warnings.add('A radial gradient has a non-positive gradientRadius.');
      defs.push('<radialGradient id="' + gradientId + '" cx="' + cx + '" cy="' + cy + '" r="' + Math.max(0.001, radius) + '" gradientUnits="userSpaceOnUse" spreadMethod="' + spread + '">' + stopMarkup + '</radialGradient>');
    } else {
      const x1 = getNumber(gradientNode, 'startX', 0);
      const y1 = getNumber(gradientNode, 'startY', 0);
      const x2 = getNumber(gradientNode, 'endX', viewportWidth);
      const y2 = getNumber(gradientNode, 'endY', 0);
      defs.push('<linearGradient id="' + gradientId + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" gradientUnits="userSpaceOnUse" spreadMethod="' + spread + '">' + stopMarkup + '</linearGradient>');
    }
    return 'url(#' + gradientId + ')';
  };

  const renderChildren = (parent: Element): string => {
    let activeClip: string | null = null;
    return Array.from(parent.children).map(child => {
      if (child.localName === 'clip-path') {
        const pathData = getAttr(child, 'pathData');
        if (!pathData) {
          warnings.add('A clip-path without pathData was ignored.');
          return '';
        }
        activeClip = 'aais-clip-' + (++id);
        defs.push('<clipPath id="' + activeClip + '" clipPathUnits="userSpaceOnUse"><path d="' + escapeAttr(pathData) + '"/></clipPath>');
        return '';
      }
      const markup = renderNode(child);
      return activeClip && markup ? '<g clip-path="url(#' + activeClip + ')">' + markup + '</g>' : markup;
    }).join('');
  };

  const renderNode = (node: Element): string => {
    if (node.localName === 'path') {
      const pathData = getAttr(node, 'pathData');
      if (!pathData) {
        warnings.add('A path without pathData was skipped.');
        return '';
      }
      const fillRaw = getAttr(node, 'fillColor', '#000000');
      const strokeRaw = getAttr(node, 'strokeColor', '@null');
      const fillAlpha = clamp(getNumber(node, 'fillAlpha', 1));
      const strokeAlpha = clamp(getNumber(node, 'strokeAlpha', 1));
      const fill = parseColor(fillRaw, fillAlpha);
      const stroke = parseColor(strokeRaw, strokeAlpha);
      if (fill.unresolved || stroke.unresolved) warnings.add('Android @color and ?attr references are not resolved in a standalone browser preview. Literal colors render accurately.');
      const gradient = makeGradient(node);
      const fillPaint = gradient || fill.color;
      const fillOpacity = gradient ? fillAlpha : fill.opacity;
      const fillType = getAttr(node, 'fillType', 'nonZero').toLowerCase() === 'evenodd' ? 'evenodd' : 'nonzero';

      const trimStart = getNumber(node, 'trimPathStart', 0);
      const trimEnd = getNumber(node, 'trimPathEnd', 1);
      const trimOffset = getNumber(node, 'trimPathOffset', 0);
      const trimmed = trimStart !== 0 || trimEnd !== 1 || trimOffset !== 0;
      if (trimmed) warnings.add('trimPath is approximated with SVG stroke dashes; Android path trimming may differ for complex paths.');
      const dashLength = clamp(trimEnd - trimStart);
      const dashOffset = -((((trimStart + trimOffset) % 1) + 1) % 1);
      const trimAttrs = trimmed ? ' pathLength="1" stroke-dasharray="' + dashLength + ' 1" stroke-dashoffset="' + dashOffset + '"' : '';
      const fillValue = trimmed ? 'none' : fillPaint;
      return '<path d="' + escapeAttr(pathData) + '"' + trimAttrs +
        ' fill="' + escapeAttr(fillValue) + '" fill-opacity="' + fillOpacity + '" fill-rule="' + fillType + '"' +
        ' stroke="' + escapeAttr(stroke.color) + '" stroke-opacity="' + stroke.opacity + '"' +
        ' stroke-width="' + getNumber(node, 'strokeWidth', 0) + '"' +
        ' stroke-linecap="' + escapeAttr(getAttr(node, 'strokeLineCap', 'butt').toLowerCase()) + '"' +
        ' stroke-linejoin="' + escapeAttr(getAttr(node, 'strokeLineJoin', 'miter').toLowerCase()) + '"' +
        ' stroke-miterlimit="' + getNumber(node, 'strokeMiterLimit', 4) + '"/>';
    }

    if (node.localName === 'group') {
      const pivotX = getNumber(node, 'pivotX', 0);
      const pivotY = getNumber(node, 'pivotY', 0);
      const rotation = getNumber(node, 'rotation', 0);
      const scaleX = getNumber(node, 'scaleX', 1);
      const scaleY = getNumber(node, 'scaleY', 1);
      const translateX = getNumber(node, 'translateX', 0);
      const translateY = getNumber(node, 'translateY', 0);
      const transform = 'translate(' + (pivotX + translateX) + ' ' + (pivotY + translateY) + ') rotate(' + rotation + ') scale(' + scaleX + ' ' + scaleY + ') translate(' + (-pivotX) + ' ' + (-pivotY) + ')';
      return '<g transform="' + transform + '">' + renderChildren(node) + '</g>';
    }

    if (node.localName === 'clip-path') return '';
    if (node.localName === 'attr' || node.localName === 'gradient' || node.localName === 'item') return '';
    warnings.add('Unsupported VectorDrawable element <' + node.localName + '> was skipped.');
    return '';
  };

  const content = renderChildren(root);
  if (rootTint) {
    const tint = parseColor(rootTint);
    if (tint.unresolved) warnings.add('Root tint uses an Android resource/theme reference and cannot be resolved here.');
    else if (rootTintMode === 'src_in' || rootTintMode === 'src_atop') {
      defs.push('<filter id="aais-tint" color-interpolation-filters="sRGB"><feFlood flood-color="' + escapeAttr(tint.color) + '"/><feComposite in2="SourceAlpha" operator="in"/><feComposite in="SourceGraphic"/></filter>');
      warnings.add('Root tint is approximated in the browser; Android blend modes may render differently.');
    } else warnings.add('Root tint mode "' + rootTintMode + '" is not reproduced by the browser renderer.');
  }
  if (getAttr(root, 'autoMirrored') === 'true') warnings.add('autoMirrored is directional and is not applied without a layout-direction preview setting.');
  const defsMarkup = defs.length ? '<defs>' + defs.join('') + '</defs>' : '';
  const rootTransform = getAttr(root, 'autoMirrored') === 'true' ? '' : '';
  const tintFilter = rootTint && !rootTint.startsWith('@') && !rootTint.startsWith('?') && (rootTintMode === 'src_in' || rootTintMode === 'src_atop') ? ' filter="url(#aais-tint)"' : '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + viewportWidth + ' ' + viewportHeight + '" width="' + viewportWidth + '" height="' + viewportHeight + '">' +
    defsMarkup + '<g opacity="' + rootAlpha + '"' + tintFilter + '>' + content + '</g>' + rootTransform + '</svg>';
  return { svg, error: '', warnings: Array.from(warnings) };
}
