import React, { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Upload, Download, Sun, Moon, Layers, Eye, EyeOff, Image, RotateCcw, ZoomIn, ZoomOut, Check, AlertCircle, Palette, Code2 } from 'lucide-react';

type Layer = 'foreground' | 'background';
const initialFg = `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#FFFFFFFF" android:pathData="M54,18a36,36 0,1 0,0.1 0z"/>
  <path android:fillColor="#FF6750A4" android:pathData="M54,31a23,23 0,1 0,0.1 0z"/>
  <path android:fillColor="#FFFFFFFF" android:pathData="M49,39h10v30h-10z M39,49h30v10h-30z"/>
</vector>`;
const initialBg = `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#FFD9D2E9" android:pathData="M0,0h108v108h-108z"/>
</vector>`;

function getAttr(el: Element, name: string, fallback = '') {
  return el.getAttribute(name) || el.getAttribute('android:' + name) || fallback;
}
function toSvg(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML syntax.');
  const root = doc.documentElement;
  if (root.tagName !== 'vector') throw new Error('Expected an Android <vector> drawable.');
  const width = Number(getAttr(root, 'viewportWidth', '108'));
  const height = Number(getAttr(root, 'viewportHeight', '108'));
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const render = (node: Element): string => {
    if (node.tagName === 'path') {
      const color = getAttr(node, 'fillColor', '#000000');
      const stroke = getAttr(node, 'strokeColor', 'none');
      return `<path d="${esc(getAttr(node, 'pathData'))}" fill="${esc(color)}" fill-opacity="${getAttr(node, 'fillAlpha', '1')}" stroke="${esc(stroke)}" stroke-width="${getAttr(node, 'strokeWidth', '0')}" stroke-opacity="${getAttr(node, 'strokeAlpha', '1')}" fill-rule="${getAttr(node, 'fillType') === 'evenOdd' ? 'evenodd' : 'nonzero'}"/>`;
    }
    if (node.tagName === 'group') {
      const px = Number(getAttr(node, 'pivotX', '0')), py = Number(getAttr(node, 'pivotY', '0'));
      const sx = Number(getAttr(node, 'scaleX', '1')), sy = Number(getAttr(node, 'scaleY', '1'));
      const rotation = Number(getAttr(node, 'rotation', '0'));
      const tx = Number(getAttr(node, 'translateX', '0')), ty = Number(getAttr(node, 'translateY', '0'));
      return `<g transform="translate(${px + tx} ${py + ty}) rotate(${rotation}) scale(${sx} ${sy}) translate(${-px} ${-py})">${Array.from(node.children).map(render).join('')}</g>`;
    }
    return Array.from(node.children).map(render).join('');
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">${Array.from(root.children).map(render).join('')}</svg>`;
}
const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

export default function App() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [fg, setFg] = useState(initialFg), [bg, setBg] = useState(initialBg);
  const [active, setActive] = useState<Layer>('foreground');
  const [fgName, setFgName] = useState('ic_launcher_foreground.xml'), [bgName, setBgName] = useState('ic_launcher_background.xml');
  const [showFg, setShowFg] = useState(true), [showBg, setShowBg] = useState(true);
  const [shape, setShape] = useState('squircle'), [scale, setScale] = useState(100), [x, setX] = useState(0), [y, setY] = useState(0);
  const [bgColor, setBgColor] = useState('#D9D2E9'), [message, setMessage] = useState('');
  const fgInput = useRef<HTMLInputElement>(null), bgInput = useRef<HTMLInputElement>(null);
  const [fgError, setFgError] = useState(''), [bgError, setBgError] = useState('');
  const fgSvg = useMemo(() => { try { setFgError(''); return toSvg(fg); } catch(e) { setFgError((e as Error).message); return ''; } }, [fg]);
  const bgSvg = useMemo(() => { try { setBgError(''); return toSvg(bg); } catch(e) { setBgError((e as Error).message); return ''; } }, [bg]);
  const current = active === 'foreground' ? fg : bg;
  const setCurrent = active === 'foreground' ? setFg : setBg;
  const mask = shape === 'circle' ? 'circle(50%)' : shape === 'square' ? 'inset(0)' : shape === 'rounded' ? 'inset(0 round 22%)' : 'inset(0 round 30%)';
  function download(name: string, content: string, type = 'text/xml') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importFile(file: File, layer: Layer) {
    const value = await file.text();
    if (layer === 'foreground') { setFg(value); setFgName(file.name); setActive('foreground'); }
    else { setBg(value); setBgName(file.name); setActive('background'); }
    setMessage(file.name + ' imported');
  }
  async function exportPng() {
    if (fgError || bgError) { setMessage('Fix XML errors before exporting.'); return; }
    const size = 512, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, size, size);
    const draw = async (svg: string, visible: boolean) => {
      if (!svg || !visible) return;
      const img = new window.Image(); img.src = svgUrl(svg);
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
      const s = size * scale / 100; ctx.save(); ctx.translate(size/2 + x*size/100, size/2 + y*size/100);
      ctx.drawImage(img, -s/2, -s/2, s, s); ctx.restore();
    };
    if (showBg && bgSvg) await draw(bgSvg, true);
    await draw(fgSvg, showFg);
    const a = document.createElement('a'); a.download = 'adaptive-icon-512.png'; a.href = canvas.toDataURL('image/png'); a.click();
    setMessage('PNG exported');
  }
  async function exportResources() {
    const zip = new JSZip();
    zip.file('res/drawable/ic_launcher_foreground.xml', fg);
    zip.file('res/drawable/ic_launcher_background.xml', bg);
    zip.file('res/mipmap-anydpi-v26/ic_launcher.xml', `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`);
    zip.file('README.txt', 'Copy the res/ folder into app/src/main/res/. Update your manifest to use @mipmap/ic_launcher.');
    const blob = await zip.generateAsync({type:'blob'}); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'android-adaptive-icon-resources.zip'; a.click(); URL.revokeObjectURL(a.href);
    setMessage('Android resources exported');
  }
  const shapes = ['circle','squircle','rounded','square'];
  return <div className={`app ${theme}`}>
    <header className="topbar"><div className="brand"><div className="brand-icon"><Layers size={19}/></div><div><b>Adaptive Icon Studio</b><small>ANDROID VECTOR WORKSPACE</small></div></div><div className="actions"><span className="local">● Local workspace</span><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="primary" onClick={() => void exportResources()}><Download size={15}/> Export project</button></div></header>
    <main className="layout">
      <aside className="sidebar"><label>PROJECT</label><div className="project-name"><Layers size={18}/><div><b>My adaptive icon</b><small>Untitled project</small></div></div><label>LAYERS</label>
        <button className={`layer ${active==='foreground'?'selected':''}`} onClick={() => setActive('foreground')}><span className="swatch purple"/><span><b>Foreground</b><small>{fgName}</small></span><i onClick={e => {e.stopPropagation();setShowFg(!showFg)}}>{showFg?<Eye size={15}/>:<EyeOff size={15}/>}</i></button>
        <button className={`layer ${active==='background'?'selected':''}`} onClick={() => setActive('background')}><span className="swatch lilac"/><span><b>Background</b><small>{bgName}</small></span><i onClick={e => {e.stopPropagation();setShowBg(!showBg)}}>{showBg?<Eye size={15}/>:<EyeOff size={15}/>}</i></button>
        <label className="import-label">IMPORT XML</label><button className="import" onClick={() => fgInput.current?.click()}><Upload size={15}/> Foreground XML <small>Browse</small></button><button className="import" onClick={() => bgInput.current?.click()}><Upload size={15}/> Background XML <small>Browse</small></button>
        <input ref={fgInput} hidden type="file" accept=".xml,text/xml" onChange={e => e.target.files?.[0] && void importFile(e.target.files[0],'foreground')}/><input ref={bgInput} hidden type="file" accept=".xml,text/xml" onChange={e => e.target.files?.[0] && void importFile(e.target.files[0],'background')}/>
        <p className="privacy">Files are parsed locally in your browser. Nothing is uploaded.</p></aside>
      <section className="canvas"><div className="canvas-head"><div><b>Preview canvas</b><small>Adaptive icon · 108 × 108 dp</small></div><div className="zoom"><button className="icon-button" onClick={() => {setScale(100);setX(0);setY(0)}}><RotateCcw size={15}/></button><button className="icon-button" onClick={() => setScale(Math.max(50,scale-5))}><ZoomOut size={15}/></button><span>{scale}%</span><button className="icon-button" onClick={() => setScale(Math.min(150,scale+5))}><ZoomIn size={15}/></button></div></div>
        <div className="stage"><div className="grid-bg"/><div className="icon-preview" style={{clipPath:mask,background:bgColor}}>{showBg && bgSvg && <div className="vector" dangerouslySetInnerHTML={{__html:bgSvg}}/>}{showFg && fgSvg && <div className="vector foreground" style={{transform:`translate(${x}%,${y}%) scale(${scale/100})`}} dangerouslySetInnerHTML={{__html:fgSvg}}/>}</div><div className="safe">SAFE ZONE</div><small className="hint">Select a layer to edit · Preview updates live</small></div>
        <div className="shape-list"><label>LAUNCHER SHAPES</label>{shapes.map(s => <button key={s} className={shape===s?'chosen':''} onClick={() => setShape(s)}><span className={s}/>{s}</button>)}</div></section>
      <aside className="inspector"><div className="tabs"><b><Palette size={15}/> Properties</b><span><Code2 size={15}/> XML</span></div><section><div className="section-head"><b>Layer properties</b><small>{active}</small></div><label>Selected layer</label><div className="select">{active==='foreground'?'Foreground drawable':'Background drawable'} <Layers size={14}/></div>
        <label>Scale <strong>{scale}%</strong></label><input type="range" min="50" max="150" value={scale} onChange={e => setScale(+e.target.value)}/><label>Horizontal position <strong>{x}%</strong></label><input type="range" min="-20" max="20" value={x} onChange={e => setX(+e.target.value)}/><label>Vertical position <strong>{y}%</strong></label><input type="range" min="-20" max="20" value={y} onChange={e => setY(+e.target.value)}/></section>
        <section><div className="section-head"><b>Background color</b></div><div className="color"><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}/><code>{bgColor.toUpperCase()}</code></div></section>
        <section><div className="section-head"><b>XML source</b><button className="link" onClick={() => download(active==='foreground'?fgName:bgName,current)}>Download XML</button></div><textarea spellCheck={false} value={current} onChange={e => setCurrent(e.target.value)}/>{(active==='foreground'?fgError:bgError)?<p className="error"><AlertCircle size={13}/>{active==='foreground'?fgError:bgError}</p>:<p className="success"><Check size={13}/> XML parsed successfully</p>}</section>
        <div className="export-buttons"><button onClick={() => void exportPng()}><Image size={15}/> PNG 512</button><button className="primary" onClick={() => void exportResources()}><Download size={15}/> Export Android resources</button></div></aside>
    </main>{message && <button className="toast" onClick={() => setMessage('')}>{message} ×</button>}
  </div>;
}
