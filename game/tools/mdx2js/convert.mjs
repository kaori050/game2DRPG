// Конвертер модели Warcraft 3 (MDX 800 + BLP1) → JS-файл для движка игры.
// Запуск: node convert.mjs <model.mdx> <папка с текстурами> <выходной .js> <имя>
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { decodeJPEG } from './jpeg.mjs';

const [mdxPath, texDir, outPath, name] = process.argv.slice(2);

// ---------- BLP1 → RGBA ----------
function decodeBLP(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magic = buf.toString('latin1', 0, 4); if (magic !== 'BLP1') throw new Error('not BLP1');
    const comp = dv.getUint32(4, true), alphaBits = dv.getUint32(8, true), w = dv.getUint32(12, true), h = dv.getUint32(16, true);
    const off0 = dv.getUint32(28, true), size0 = dv.getUint32(92, true);
    const rgba = new Uint8Array(w * h * 4);
    if (comp === 0) {
        const hs = dv.getUint32(156, true);
        const jpg = Buffer.concat([buf.subarray(160, 160 + hs), buf.subarray(off0, off0 + size0)]);
        const img = decodeJPEG(new Uint8Array(jpg));
        const C = img.comps;   // порядок: B, G, R, A
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4, px = (c) => c.plane[Math.floor(y * c.sy) * c.w + Math.floor(x * c.sx)];
            rgba[i] = px(C[2]); rgba[i + 1] = px(C[1]); rgba[i + 2] = px(C[0]); rgba[i + 3] = alphaBits ? px(C[3]) : 255;
        }
    } else { // палитра 256 цветов
        const pal = buf.subarray(156, 156 + 1024), idx = buf.subarray(off0, off0 + w * h), al = buf.subarray(off0 + w * h);
        for (let i = 0; i < w * h; i++) { const p = idx[i] * 4; rgba[i * 4] = pal[p + 2]; rgba[i * 4 + 1] = pal[p + 1]; rgba[i * 4 + 2] = pal[p]; rgba[i * 4 + 3] = alphaBits === 8 ? al[i] : (alphaBits === 1 ? ((al[i >> 3] >> (i & 7)) & 1) * 255 : 255); }
    }
    return { w, h, rgba };
}
// ---------- PNG ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function png(w, h, rgba) {
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- MDX ----------
const buf = fs.readFileSync(mdxPath), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let p = 4;
const tag = () => buf.toString('latin1', p, p + 4);
const u32 = () => { const v = dv.getUint32(p, true); p += 4; return v; }, i32 = () => { const v = dv.getInt32(p, true); p += 4; return v; }, f32 = () => { const v = dv.getFloat32(p, true); p += 4; return v; };
const str = n => { const s = buf.toString('latin1', p, p + n).replace(/\0.*$/s, ''); p += n; return s; };
const vec = n => { const a = []; for (let i = 0; i < n; i++) a.push(+f32().toFixed(5)); return a; };
const M = { sequences: [], textures: [], materials: [], geosets: [], geosetAnims: [], nodes: [], pivots: [], globalSeqs: [] };

function readTrack(size, isInt) {
    const count = u32(), interp = u32(), gs = i32(), keys = [];
    for (let i = 0; i < count; i++) {
        const k = { t: i32(), v: isInt ? [u32()] : vec(size) };
        if (interp > 1) { k.i = isInt ? [u32()] : vec(size); k.o = isInt ? [u32()] : vec(size); }
        keys.push(k);
    }
    return { interp, gs, keys };
}
function readNode() {
    const start = p, size = u32(), node = { name: str(80), id: u32(), parent: i32(), flags: u32() };
    while (p < start + size) {
        const t = tag(); p += 4;
        if (t === 'KGTR') node.tr = readTrack(3); else if (t === 'KGRT') node.rot = readTrack(4); else if (t === 'KGSC') node.sc = readTrack(3);
        else throw new Error('unknown node track ' + t);
    }
    p = start + size; return node;
}

while (p < buf.length) {
    const t = tag(); p += 4; const size = u32(), end = p + size;
    if (t === 'SEQS') { while (p < end) { M.sequences.push({ name: str(80), start: u32(), end: u32(), speed: f32(), flags: u32(), rarity: f32(), sync: u32(), extent: vec(7) }); } }
    else if (t === 'GLBS') { while (p < end) M.globalSeqs.push(u32()); }
    else if (t === 'TEXS') { while (p < end) M.textures.push({ repl: u32(), file: str(260), flags: u32() }); }
    else if (t === 'MTLS') {
        while (p < end) {
            const ms = p, msize = u32(), mat = { prio: i32(), flags: u32(), layers: [] };
            if (tag() === 'LAYS') { p += 4; const n = u32(); for (let i = 0; i < n; i++) { const ls = p, lsize = u32(); const L = { filter: u32(), shading: u32(), tex: u32(), texAnim: i32(), coord: u32(), alpha: f32() }; while (p < ls + lsize) { const tt = tag(); p += 4; if (tt === 'KMTA') L.alphaTrack = readTrack(1); else if (tt === 'KMTF') L.texTrack = readTrack(1, true); else break; } p = ls + lsize; mat.layers.push(L); } }
            p = ms + msize; M.materials.push(mat);
        }
    }
    else if (t === 'GEOS') {
        while (p < end) {
            const gs = p, gsize = u32(), G = {};
            const expect = tt => { if (tag() !== tt) throw new Error('expected ' + tt + ' got ' + tag()); p += 4; };
            expect('VRTX'); let n = u32(); G.pos = vec(n * 3);
            expect('NRMS'); n = u32(); G.nrm = vec(n * 3);
            expect('PTYP'); n = u32(); const ptyp = []; for (let i = 0; i < n; i++) ptyp.push(u32());
            expect('PCNT'); n = u32(); for (let i = 0; i < n; i++) u32();
            expect('PVTX'); n = u32(); G.idx = []; for (let i = 0; i < n; i++) { G.idx.push(dv.getUint16(p, true)); p += 2; }
            expect('GNDX'); n = u32(); G.grp = Array.from(buf.subarray(p, p + n)); p += n;
            expect('MTGC'); n = u32(); const sizes = []; for (let i = 0; i < n; i++) sizes.push(u32());
            expect('MATS'); n = u32(); const mats = []; for (let i = 0; i < n; i++) mats.push(u32());
            G.groups = []; let k = 0; for (const s of sizes) { G.groups.push(mats.slice(k, k + s)); k += s; }
            G.mat = u32(); u32(); u32(); vec(7); n = u32(); p += n * 28;
            expect('UVAS'); n = u32(); expect('UVBS'); const nu = u32(); G.uv = vec(nu * 2);
            p = gs + gsize; M.geosets.push(G);
        }
    }
    else if (t === 'GEOA') {
        while (p < end) { const as = p, asz = u32(); const A = { alpha: f32(), flags: u32(), color: vec(3), geoset: u32() }; while (p < as + asz) { const tt = tag(); p += 4; if (tt === 'KGAO') A.alphaTrack = readTrack(1); else if (tt === 'KGAC') A.colorTrack = readTrack(3); else break; } p = as + asz; M.geosetAnims.push(A); }
    }
    else if (t === 'BONE') { while (p < end) { const n = readNode(); n.type = 'bone'; n.geoset = u32(); n.geoAnim = u32(); M.nodes.push(n); } }
    else if (t === 'HELP') { while (p < end) { const n = readNode(); n.type = 'helper'; M.nodes.push(n); } }
    else if (t === 'PIVT') { while (p < end) M.pivots.push(vec(3)); }
    p = end;
}

// Текстуры: PNG в data-URI; заменяемые (цвет команды) — помечаем
M.textures = M.textures.map(tx => {
    if (tx.repl) return { repl: tx.repl };
    const f = path.join(texDir, path.basename(tx.file.replace(/\\/g, '/')));
    // Встроенные текстуры Warcraft 3 (их нет в архиве модели) — помечаем, движок подставит цветное свечение
    if (!fs.existsSync(f)) { console.error('нет текстуры (встроенная в WC3?):', tx.file); return { file: path.basename(f), missing: true }; }
    const img = decodeBLP(fs.readFileSync(f));
    return { file: path.basename(f), w: img.w, h: img.h, png: 'data:image/png;base64,' + png(img.w, img.h, img.rgba).toString('base64') };
});
// Лишние поля нод — компактнее
M.nodes.sort((a, b) => a.id - b.id);
const report = {
    sequences: M.sequences.map(s => `${s.name} [${s.start}-${s.end}]`),
    textures: M.textures.map(t => t.file || ('replaceable ' + t.repl)),
    materials: M.materials.map(m => m.layers.map(l => `tex${l.tex}/filter${l.filter}/a${l.alpha}`).join('+')),
    geosets: M.geosets.map(g => `${g.pos.length / 3}v ${g.idx.length / 3}t mat${g.mat} groups${g.groups.length}`),
    nodes: M.nodes.length, pivots: M.pivots.length, geosetAnims: M.geosetAnims.length, globalSeqs: M.globalSeqs
};
console.log(JSON.stringify(report, null, 1));
fs.writeFileSync(outPath, `// Модель «${name}» (Warcraft 3 MDX → JSON), сгенерировано конвертером. Текстуры — PNG в data-URI.\nwindow.MDX_MODELS = window.MDX_MODELS || {};\nMDX_MODELS[${JSON.stringify(name)}] = ${JSON.stringify(M)};\n`);
console.log('written', outPath, fs.statSync(outPath).size);
