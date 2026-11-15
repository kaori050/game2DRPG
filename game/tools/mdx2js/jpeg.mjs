// Минимальный JPEG-декодер (baseline + progressive), возвращает «сырые» компоненты без цветового преобразования.
// Нужен для BLP1: там 4 канала (B, G, R, A) лежат в JPEG как есть.
const ZZ = new Int32Array([0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]);

function buildHuffman(counts, symbols) {
    // Возвращает таблицу: ключ (длина<<16 | код) → символ
    const map = new Map(); let code = 0, k = 0;
    for (let len = 1; len <= 16; len++) { for (let i = 0; i < counts[len - 1]; i++) { map.set((len << 16) | code, symbols[k++]); code++; } code <<= 1; }
    return map;
}

export function decodeJPEG(data) {
    let pos = 0;
    const u16 = () => { const v = (data[pos] << 8) | data[pos + 1]; pos += 2; return v; };
    const qt = [], dcT = [], acT = [];
    let frame = null, progressive = false, resetInterval = 0, eobrun = 0;
    if (u16() !== 0xFFD8) throw new Error('not jpeg');
    while (pos < data.length) {
        let m = u16();
        while (m === 0xFFFF) { pos--; m = u16(); }
        if (m === 0xFFD9) break;
        if (m === 0xFFDB) { const end = pos + u16(); while (pos < end) { const pq = data[pos] >> 4, tq = data[pos++] & 15; const t = new Int32Array(64); for (let i = 0; i < 64; i++) t[ZZ[i]] = pq ? u16() : data[pos++]; qt[tq] = t; } }
        else if (m === 0xFFC4) { const end = pos + u16(); while (pos < end) { const tc = data[pos] >> 4, th = data[pos++] & 15; const counts = data.subarray(pos, pos + 16); pos += 16; let n = 0; for (const c of counts) n += c; const syms = data.subarray(pos, pos + n); pos += n; (tc ? acT : dcT)[th] = buildHuffman(counts, syms); } }
        else if (m === 0xFFDD) { u16(); resetInterval = u16(); }
        else if (m === 0xFFC0 || m === 0xFFC1 || m === 0xFFC2) {
            progressive = m === 0xFFC2; u16(); pos++;
            const H = u16(), W = u16(), N = data[pos++], comps = [];
            for (let i = 0; i < N; i++) comps.push({ id: data[pos], h: data[pos + 1] >> 4, v: data[pos + 1] & 15, tq: data[pos + 2] }), pos += 3;
            const hmax = Math.max(...comps.map(c => c.h)), vmax = Math.max(...comps.map(c => c.v));
            const mcuW = Math.ceil(W / (8 * hmax)), mcuH = Math.ceil(H / (8 * vmax));
            for (const c of comps) { c.bw = mcuW * c.h; c.bh = mcuH * c.v; c.coef = new Int32Array(c.bw * c.bh * 64); c.pred = 0; }
            frame = { W, H, comps, hmax, vmax, mcuW, mcuH };
        }
        else if (m === 0xFFDA) {
            u16(); const ns = data[pos++], sc = [];
            for (let i = 0; i < ns; i++) { const c = frame.comps.find(c => c.id === data[pos]); c.dc = dcT[data[pos + 1] >> 4]; c.ac = acT[data[pos + 1] & 15]; sc.push(c); pos += 2; }
            const Ss = data[pos++], Se = data[pos++], Ah = data[pos] >> 4, Al = data[pos++] & 15;
            pos = decodeScan(data, pos, frame, sc, Ss, Se, Ah, Al, progressive, resetInterval);
        }
        else { const L = u16(); pos += L - 2; }
    }
    // Деквантование + обратное DCT
    const out = [];
    for (const c of frame.comps) {
        const q = qt[c.tq], plane = new Uint8ClampedArray(c.bw * 8 * c.bh * 8), blk = new Float64Array(64), tmp = new Float64Array(64);
        for (let by = 0; by < c.bh; by++) for (let bx = 0; bx < c.bw; bx++) {
            const o = (by * c.bw + bx) * 64;
            for (let i = 0; i < 64; i++) blk[i] = c.coef[o + i] * q[i];
            idct(blk, tmp);
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) plane[(by * 8 + y) * c.bw * 8 + bx * 8 + x] = Math.round(blk[y * 8 + x] + 128);
        }
        out.push({ plane, w: c.bw * 8, sx: c.h / frame.hmax, sy: c.v / frame.vmax });
    }
    return { width: frame.W, height: frame.H, comps: out };
}

const COS = (() => { const t = new Float64Array(64); for (let x = 0; x < 8; x++) for (let u = 0; u < 8; u++) t[x * 8 + u] = (u === 0 ? Math.SQRT1_2 : 1) * Math.cos((2 * x + 1) * u * Math.PI / 16); return t; })();
function idct(b, t) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let s = 0; for (let u = 0; u < 8; u++) s += COS[x * 8 + u] * b[y * 8 + u]; t[y * 8 + x] = s / 2; }
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { let s = 0; for (let v = 0; v < 8; v++) s += COS[y * 8 + v] * t[v * 8 + x]; b[y * 8 + x] = s / 2; }
}

function decodeScan(data, pos, frame, sc, Ss, Se, Ah, Al, progressive, resetInterval) {
    let bitBuf = 0, bitCnt = 0, eobrun = 0;
    const readBit = () => {
        if (bitCnt === 0) {
            let b = data[pos++];
            if (b === 0xFF) { const nx = data[pos]; if (nx === 0) pos++; else if (nx >= 0xD0 && nx <= 0xD7) { /* маркер рестарта внутри — обработаем снаружи */ } }
            bitBuf = b; bitCnt = 8;
        }
        bitCnt--; return (bitBuf >> bitCnt) & 1;
    };
    const receive = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | readBit(); return v; };
    const extend = (v, n) => n === 0 ? 0 : (v < (1 << (n - 1)) ? v - (1 << n) + 1 : v);
    const decodeHuff = tbl => { let code = 0; for (let len = 1; len <= 16; len++) { code = (code << 1) | readBit(); const s = tbl.get((len << 16) | code); if (s !== undefined) return s; } throw new Error('bad huffman'); };

    const blockBase = (c, row, col) => (row * c.bw + col) * 64;
    const decodeBlock = (c, o) => {
        const z = c.coef;
        if (!progressive) {
            const t = decodeHuff(c.dc), diff = t ? extend(receive(t), t) : 0; c.pred += diff; z[o] = c.pred;
            for (let k = 1; k < 64;) { const rs = decodeHuff(c.ac), r = rs >> 4, s = rs & 15; if (s === 0) { if (r < 15) break; k += 16; continue; } k += r; z[o + ZZ[k]] = extend(receive(s), s); k++; }
            return;
        }
        if (Ss === 0) { // DC
            if (Ah === 0) { const t = decodeHuff(c.dc), diff = t ? extend(receive(t), t) : 0; c.pred += diff; z[o] = c.pred << Al; }
            else if (readBit()) z[o] |= 1 << Al;
            return;
        }
        if (Ah === 0) { // AC first
            if (eobrun > 0) { eobrun--; return; }
            for (let k = Ss; k <= Se;) {
                const rs = decodeHuff(c.ac), r = rs >> 4, s = rs & 15;
                if (s === 0) { if (r < 15) { eobrun = (1 << r) - 1 + (r ? receive(r) : 0); break; } k += 16; continue; }
                k += r; z[o + ZZ[k]] = extend(receive(s), s) * (1 << Al); k++;
            }
            return;
        }
        // AC refine
        let k = Ss; const p1 = 1 << Al, m1 = -1 << Al;
        if (eobrun <= 0) {
            for (; k <= Se;) {
                const rs = decodeHuff(c.ac); let r = rs >> 4, s = rs & 15, val = 0;
                if (s === 0) { if (r < 15) { eobrun = (1 << r) + (r ? receive(r) : 0); break; } }
                else val = readBit() ? p1 : m1;
                while (k <= Se) {
                    const zi = o + ZZ[k];
                    if (z[zi] !== 0) { if (readBit() && (z[zi] & p1) === 0) z[zi] += z[zi] >= 0 ? p1 : m1; }
                    else { if (r === 0) { if (val) z[zi] = val; k++; break; } r--; }
                    k++;
                }
            }
        }
        if (eobrun > 0) {
            for (; k <= Se; k++) { const zi = o + ZZ[k]; if (z[zi] !== 0 && readBit() && (z[zi] & p1) === 0) z[zi] += z[zi] >= 0 ? p1 : m1; }
            eobrun--;
        }
    };

    const single = sc.length === 1;
    const total = single ? Math.ceil(frame.W * sc[0].h / frame.hmax / 8) * Math.ceil(frame.H * sc[0].v / frame.vmax / 8) : frame.mcuW * frame.mcuH;
    const singleW = single ? Math.ceil(frame.W * sc[0].h / frame.hmax / 8) : 0;
    let n = 0;
    sc.forEach(c => c.pred = 0);
    while (n < total) {
        const lim = resetInterval ? Math.min(total, n + resetInterval) : total;
        for (; n < lim; n++) {
            if (single) { const c = sc[0], row = Math.floor(n / singleW), col = n % singleW; decodeBlock(c, blockBase(c, row, col)); }
            else {
                const mr = Math.floor(n / frame.mcuW), mc = n % frame.mcuW;
                for (const c of sc) for (let v = 0; v < c.v; v++) for (let h = 0; h < c.h; h++) decodeBlock(c, blockBase(c, mr * c.v + v, mc * c.h + h));
            }
        }
        if (n >= total) break;
        // Рестарт: выравниваемся на байт и пропускаем маркер RSTn
        bitCnt = 0;
        while (pos < data.length && !(data[pos] === 0xFF && data[pos + 1] >= 0xD0 && data[pos + 1] <= 0xD7)) pos++;
        pos += 2; sc.forEach(c => c.pred = 0); eobrun = 0;
    }
    bitCnt = 0;
    // Ищем следующий маркер
    while (pos < data.length - 1 && !(data[pos] === 0xFF && data[pos + 1] !== 0 && !(data[pos + 1] >= 0xD0 && data[pos + 1] <= 0xD7))) pos++;
    return pos;
}
