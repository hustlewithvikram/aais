import React, { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { renderVector } from './vectorRenderer';
import { Upload, Download, Sun, Moon, Layers, Eye, EyeOff, RotateCcw, ZoomIn, ZoomOut, Check, AlertCircle, Palette, Code2, Image as ImageIcon, ClipboardPaste } from 'lucide-react';

type Layer = 'foreground' | 'background' | 'monochrome';
const initialFg = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFFFFFFF" android:pathData="M54,18a36,36 0,1 0,0.1 0z"/><path android:fillColor="#FF6750A4" android:pathData="M54,31a23,23 0,1 0,0.1 0z"/><path android:fillColor="#FFFFFFFF" android:pathData="M49,39h10v30h-10z M39,49h30v10h-30z"/></vector>';
const initialBg = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFD9D2E9" android:pathData="M0,0h108v108h-108z"/></vector>';
const initialMono = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFFFFFFF" android:pathData="M54,18a36,36 0,1 0,0.1 0z"/><path android:fillColor="#FFFFFFFF" android:pathData="M49,39h10v30h-10z M39,49h30v10h-30z"/></vector>';

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const shapeClip: Record<string, string> = {
  circle: 'circle(50%)',
  squircle: 'inset(0 round 30%)',
  rounded: 'inset(0 round 22%)',
  square: 'inset(0)',
  teardrop: 'path("M 50 0 C 77 0 100 20 100 50 C 100 78 78 100 50 100 C 22 100 0 78 0 50 C 0 22 22 0 50 0 Z")'
};

export default function App() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [fg, setFg] = useState(initialFg), [bg, setBg] = useState(initialBg), [mono, setMono] = useState(initialMono);
  const [active, setActive] = useState<Layer>('foreground');
  const [fgName, setFgName] = useState('ic_launcher_foreground.xml'), [bgName, setBgName] = useState('ic_launcher_background.xml'), [monoName, setMonoName] = useState('ic_launcher_monochrome.xml');
  const [showFg, setShowFg] = useState(true), [showBg, setShowBg] = useState(true), [showMono, setShowMono] = useState(false);
  const [shape, setShape] = useState('squircle'), [scale, setScale] = useState(100), [previewZoom, setPreviewZoom] = useState(100), [x, setX] = useState(0), [y, setY] = useState(0);
  const [bgColor, setBgColor] = useState('#D9D2E9'), [message, setMessage] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false), [pasteText, setPasteText] = useState(''), [pasteError, setPasteError] = useState('');
  const fgInput = useRef<HTMLInputElement>(null), bgInput = useRef<HTMLInputElement>(null), monoInput = useRef<HTMLInputElement>(null);
  const fgResult = useMemo(() => renderVector(fg), [fg]), bgResult = useMemo(() => renderVector(bg), [bg]), monoResult = useMemo(() => renderVector(mono), [mono]);
  const result = active === 'foreground' ? fgResult : active === 'background' ? bgResult : monoResult;
  const current = active === 'foreground' ? fg : active === 'background' ? bg : mono;
  const setCurrent = active === 'foreground' ? setFg : active === 'background' ? setBg : setMono;
  const clip = shapeClip[shape] || shapeClip.squircle;

  function download(name: string, content: string, type = 'text/xml') {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function applyPastedXml() {
    const parsed = renderVector(pasteText);
    if (parsed.error) { setPasteError(parsed.error); return; }
    setCurrent(pasteText);
    if (active === 'foreground') setFgName('pasted-foreground.xml');
    else if (active === 'background') setBgName('pasted-background.xml');
    else setMonoName('pasted-monochrome.xml');
    setPasteError('');
    setPasteOpen(false);
    setMessage('Pasted XML applied to ' + active + ' layer');
  }
  async function importFile(file: File, layer: Layer) {
    const value = await file.text();
    const parsed = renderVector(value);
    if (parsed.error) { setMessage('Import failed: ' + parsed.error); return; }
    if (layer === 'foreground') { setFg(value); setFgName(file.name); }
    else if (layer === 'background') { setBg(value); setBgName(file.name); }
    else { setMono(value); setMonoName(file.name); }
    setActive(layer); setMessage(file.name + ' imported');
  }
  async function imageFromSvg(svg: string) {
    const img = new window.Image();
    img.src = svgUrl(svg);
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Unable to render SVG for PNG export.')); });
    return img;
  }
  async function exportPng() {
    const foregroundResult = active === 'monochrome' ? monoResult : fgResult;
    const foregroundVisible = active === 'monochrome' ? showMono : showFg;
    if (foregroundResult.error || bgResult.error) { setMessage('Fix the active foreground and background XML errors before exporting.'); return; }
    const size = 512, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setMessage('Canvas is unavailable in this browser.'); return; }
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    else if (shape === 'square') ctx.rect(0, 0, size, size);
    else if (shape === 'teardrop') {
      ctx.moveTo(256,0); ctx.bezierCurveTo(394,0,512,102,512,256); ctx.bezierCurveTo(512,394,394,512,256,512); ctx.bezierCurveTo(118,512,0,394,0,256); ctx.bezierCurveTo(0,118,118,0,256,0); ctx.closePath();
    } else {
      const radius = shape === 'rounded' ? 112 : 150;
      ctx.roundRect(0, 0, size, size, radius);
    }
    ctx.clip();
    if (showBg) {
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, size, size);
      if (bgResult.svg) {
        const img = await imageFromSvg(bgResult.svg);
        ctx.drawImage(img, 0, 0, size, size);
      }
    }
    if (foregroundVisible && foregroundResult.svg) {
      const img = await imageFromSvg(foregroundResult.svg), s = size * scale / 100;
      ctx.save(); ctx.translate(size/2 + x*size/100, size/2 + y*size/100); ctx.drawImage(img, -s/2, -s/2, s, s); ctx.restore();
    }
    ctx.restore();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { setMessage('PNG export failed.'); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'adaptive-icon-512.png'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('512 × 512 PNG exported');
  }
  async function exportResources() {
    if (fgResult.error || bgResult.error || (mono.trim() && monoResult.error)) { setMessage('Fix XML errors before exporting resources.'); return; }
    const zip = new JSZip();
    zip.file('res/drawable/ic_launcher_foreground.xml', fg);
    zip.file('res/drawable/ic_launcher_background.xml', bg);
    if (mono.trim()) zip.file('res/drawable/ic_launcher_monochrome.xml', mono);
    const monoTag = mono.trim() ? '\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>' : '';
    zip.file('res/mipmap-anydpi-v26/ic_launcher.xml', '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_launcher_foreground"/>' + monoTag + '\n</adaptive-icon>');
    zip.file('README.txt', 'Copy the res/ folder into app/src/main/res/. Set android:icon="@mipmap/ic_launcher" in your manifest. The monochrome layer is included when enabled and is used by supported Android versions for themed icons. The launcher applies its own adaptive mask; the exported PNG is a masked preview.');
    const blob = await zip.generateAsync({type:'blob'}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'android-adaptive-icon-resources.zip'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Android resources exported');
  }

  const layers: {id: Layer; label: string; filename: string; visible: boolean; toggle: () => void}[] = [
    {id:'foreground',label:'Foreground',filename:fgName,visible:showFg,toggle:()=>setShowFg(!showFg)},
    {id:'background',label:'Background',filename:bgName,visible:showBg,toggle:()=>setShowBg(!showBg)},
    {id:'monochrome',label:'Monochrome',filename:monoName,visible:showMono,toggle:()=>setShowMono(!showMono)}
  ];
  return <div className={'app ' + theme}>
    <header className="topbar"><div className="brand"><div className="brand-icon"><Layers size={19}/></div><div><b>Adaptive Icon Studio</b><small>ANDROID DRAWABLE WORKSPACE</small></div></div><div className="actions"><span className="local">● Local workspace</span><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="primary" onClick={() => void exportResources()}><Download size={15}/> Export project</button></div></header>
    <main className="layout">
      <aside className="sidebar"><label>PROJECT</label><div className="project-name"><Layers size={18}/><div><b>My adaptive icon</b><small>Untitled project</small></div></div><label>LAYERS</label>
        {layers.map(layer => <button key={layer.id} className={'layer ' + (active===layer.id?'selected':'')} onClick={() => { setActive(layer.id); if (layer.id === 'monochrome') setShowMono(true); }}><span className={'swatch ' + layer.id}/><span><b>{layer.label}</b><small>{layer.filename}</small></span><i onClick={e => {e.stopPropagation();layer.toggle();}}>{layer.visible?<Eye size={15}/>:<EyeOff size={15}/>}</i></button>)}
        <label className="import-label">IMPORT XML</label><button className="import" onClick={() => fgInput.current?.click()}><Upload size={15}/> Foreground XML <small>Browse</small></button><button className="import" onClick={() => bgInput.current?.click()}><Upload size={15}/> Background XML <small>Browse</small></button><button className="import" onClick={() => monoInput.current?.click()}><Upload size={15}/> Monochrome XML <small>Browse</small></button>
        <input ref={fgInput} hidden type="file" accept=".xml,text/xml" onChange={e => e.target.files?.[0] && void importFile(e.target.files[0],'foreground')}/><input ref={bgInput} hidden type="file" accept=".xml,text/xml" onChange={e => e.target.files?.[0] && void importFile(e.target.files[0],'background')}/><input ref={monoInput} hidden type="file" accept=".xml,text/xml" onChange={e => e.target.files?.[0] && void importFile(e.target.files[0],'monochrome')}/>
        <button className={'paste-toggle ' + (pasteOpen ? 'open' : '')} onClick={() => { setPasteOpen(!pasteOpen); setPasteText(current); setPasteError(''); }}><ClipboardPaste size={15}/> Paste XML as text <span>{pasteOpen ? '−' : '+'}</span></button>
        {pasteOpen && <div className="paste-panel"><small>Paste Android VectorDrawable XML into the <b>{active}</b> layer.</small><textarea aria-label="Paste Android VectorDrawable XML" spellCheck={false} placeholder={'<vector xmlns:android="http://schemas.android.com/apk/res/android" ...>\n    ...\n</vector>'} value={pasteText} onChange={e => {setPasteText(e.target.value);setPasteError('');}}/><button className="paste-apply" disabled={!pasteText.trim()} onClick={applyPastedXml}><Check size={14}/> Apply to {active}</button>{pasteError && <p className="error"><AlertCircle size={13}/>{pasteError}</p>}</div>}
        <p className="privacy">Files are parsed locally in your browser. Nothing is uploaded.</p></aside>
      <section className="canvas"><div className="canvas-head"><div><b>Preview canvas</b><small>Adaptive icon · 108 × 108 dp</small></div><div className="zoom"><button className="icon-button" onClick={() => setPreviewZoom(100)}><RotateCcw size={15}/></button><button className="icon-button" onClick={() => setPreviewZoom(Math.max(50,previewZoom-10))}><ZoomOut size={15}/></button><span>{previewZoom}%</span><button className="icon-button" onClick={() => setPreviewZoom(Math.min(200,previewZoom+10))}><ZoomIn size={15}/></button></div></div>
        <div className="stage"><div className="grid-bg"/><div className="icon-preview" style={{clipPath:clip,background:showBg?bgColor:'transparent',transform:'scale('+(previewZoom/100)+')'}}>{showBg && bgResult.svg && <div className="vector" dangerouslySetInnerHTML={{__html:bgResult.svg}}/>}{(active==='monochrome'?showMono:showFg) && (active==='monochrome'?monoResult.svg:fgResult.svg) && <div className="vector foreground" style={{transform:'translate('+x+'%, '+y+'%) scale('+(scale/100)+')'}} dangerouslySetInnerHTML={{__html:active==='monochrome'?monoResult.svg:fgResult.svg}}/>}<div className="safe"><span>72dp safe zone</span></div></div><small className="hint">Select a layer to edit · Preview updates live</small></div>
        <div className="shape-list"><label>LAUNCHER SHAPES</label>{Object.keys(shapeClip).map(s => <button key={s} className={shape===s?'chosen':''} onClick={() => setShape(s)}><span className={s}/>{s}</button>)}</div></section>
      <aside className="inspector"><div className="tabs"><b><Palette size={15}/> Properties</b><span><Code2 size={15}/> XML</span></div><section><div className="section-head"><b>Layer properties</b><small>{active}</small></div><label>Selected layer</label><div className="select">{active==='foreground'?'Foreground drawable':active==='background'?'Background drawable':'Monochrome drawable'} <Layers size={14}/></div>
        <label>Scale <strong>{scale}%</strong></label><input type="range" min="50" max="150" value={scale} onChange={e => setScale(+e.target.value)}/><label>Horizontal position <strong>{x}%</strong></label><input type="range" min="-20" max="20" value={x} onChange={e => setX(+e.target.value)}/><label>Vertical position <strong>{y}%</strong></label><input type="range" min="-20" max="20" value={y} onChange={e => setY(+e.target.value)}/></section>
        <section><div className="section-head"><b>Background color</b></div><div className="color"><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}/><code>{bgColor.toUpperCase()}</code></div></section>
        <section><div className="section-head"><b>XML source</b><button className="link" onClick={() => download(active==='foreground'?fgName:active==='background'?bgName:monoName,current)}>Download XML</button></div><textarea spellCheck={false} value={current} onChange={e => setCurrent(e.target.value)}/>{result.error?<p className="error"><AlertCircle size={13}/>{result.error}</p>:<p className="success"><Check size={13}/> XML parsed successfully</p>}{result.warnings.map((warning,i)=><p className="warning" key={i}><AlertCircle size={13}/>{warning}</p>)}</section>
        <div className="export-buttons"><button onClick={() => void exportPng()}><ImageIcon size={15}/> PNG 512</button><button className="primary" onClick={() => void exportResources()}><Download size={15}/> Export Android resources</button></div></aside>
    </main>{message && <button className="toast" onClick={() => setMessage('')}>{message} ×</button>}
  </div>;
}
