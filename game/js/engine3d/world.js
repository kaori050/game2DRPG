// ============================================================================
// 3D-МИР: рельеф (куски 20×20 тайлов), вода и лава, деревья, скалы, стены, постройки и декор (инстансинг)
// ============================================================================
const World3D = {
    C: 20,                       // размер куска в тайлах (граница яруса Ада, ряд 300, делится на 20)
    chunks: new Map(), queue: [], lightsCache: [], lightsT: 0,
    init(scene) {
        this.scene = scene;
        const T = Tex3D.T;
        // Земля: PBR с картой нормалей; в шейдер добавлены тени облаков, мокрая земля и лужи
        this.U = { uClouds: { value: T.clouds }, uCloud: { value: 0 }, uWet: { value: 0 }, uCloudOff: { value: new THREE.Vector2() }, uTime: { value: 0 }, uRain: { value: 0 } };
        // Рябь от капель: кольца расходятся из случайных точек в каждой клетке сетки (возвращает наклон поверхности)
        const RIPPLE = `
            vec2 rippleField(vec2 p, float t) {
                vec2 rd = vec2(0.0);
                for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
                    vec2 cell = floor(p) + vec2(float(i), float(j));
                    float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
                    vec2 c = cell + 0.5 + 0.35 * vec2(sin(h * 6.28), cos(h * 9.1));
                    float ph = fract(t * (0.8 + h * 0.4) + h);
                    vec2 d = p - c; float dist = length(d), r = ph * 0.85;
                    float w = sin((dist - r) * 30.0) * smoothstep(0.14, 0.0, abs(dist - r)) * (1.0 - ph) * (1.0 - ph);
                    rd += d / max(dist, 1e-3) * w;
                }
                return rd;
            }`;
        // Земля: PBR с картой нормалей; в шейдере — тени облаков, мокрая земля и лужи
        // Лужа: гладкое зеркало с френелем (отражает небо/окружение), сквозь воду видно преломлённое дно, по воде бегут круги от капель, края мягко переходят в мокрую землю
        this.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.ground, normalMap: T.groundN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.94, metalness: 0, envMapIntensity: 0.35 });
        this.groundMat.onBeforeCompile = sh => {
            Object.assign(sh.uniforms, this.U);
            sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = 'varying vec3 vGW;\nuniform sampler2D uClouds;\nuniform float uCloud, uWet, uTime, uRain;\nuniform vec2 uCloudOff;\nfloat gPuddle = 0.0;\nvec2 gRip = vec2(0.0);\n' + RIPPLE + '\n' + sh.fragmentShader
                .replace('#include <map_fragment>', `#include <map_fragment>
                    float cl = texture2D(uClouds, vGW.xz * 0.02 + uCloudOff).r;
                    diffuseColor.rgb *= mix(1.0, 0.42 + 0.58 * smoothstep(0.38, 0.68, cl), uCloud);
                    float pm = texture2D(uClouds, vGW.xz * 0.11 + 0.37).r;
                    gPuddle = smoothstep(0.6, 0.665, pm) * uWet;
                    float wetRim = (smoothstep(0.53, 0.62, pm) - smoothstep(0.6, 0.665, pm)) * uWet;
                    gRip = rippleField(vGW.xz * 2.4, uTime) * uRain;
                    #ifdef USE_MAP
                        // Преломление: дно под водой чуть смещено рябью, темнее и холоднее
                        vec3 under = texture2D(map, vUv + gRip * 0.025).rgb * diffuse;
                        diffuseColor.rgb = mix(diffuseColor.rgb, under * vec3(0.62, 0.68, 0.74), gPuddle);
                    #endif
                    diffuseColor.rgb *= 1.0 - uWet * 0.28 - wetRim * 0.22;`)
                .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor * (1.0 - uWet * 0.4), 0.03, gPuddle);')
                .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                    vec3 wN = normalize(vec3(-gRip.x * 0.55, 1.0, -gRip.y * 0.55));
                    normal = normalize(mix(normal, normalize((viewMatrix * vec4(wN, 0.0)).xyz), gPuddle));`)
                .replace('#include <output_fragment>', `
                    #ifdef USE_ENVMAP
                    if (gPuddle > 0.002) {
                        vec3 vdir = normalize(vViewPosition);
                        float fres = 0.1 + 0.9 * pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 4.0);
                        vec3 refl = getIBLRadiance(vdir, normal, 0.02) * 1.5;
                        outgoingLight = mix(outgoingLight, outgoingLight * 0.8 + refl * (0.18 + fres * 1.1), gPuddle * 0.9);
                    }
                    #endif
                    #include <output_fragment>`);
        };
        this.groundMat.customProgramCacheKey = () => 'ground2';
        // Вода рек и озёр: рябь от ветра + круги от дождя, отражение неба с френелем
        this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1a4458, roughness: 0.05, metalness: 0.1, normalMap: T.waterN, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88, envMapIntensity: 1.0 });
        this.waterMat.onBeforeCompile = sh => {
            sh.uniforms.uTime = this.U.uTime; sh.uniforms.uRain = this.U.uRain;
            sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = 'varying vec3 vGW;\nuniform float uTime, uRain;\n' + RIPPLE + '\n' + sh.fragmentShader
                .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                    vec2 wr = rippleField(vGW.xz * 2.0, uTime) * uRain;
                    normal = normalize(normal + (viewMatrix * vec4(-wr.x * 0.5, 0.0, -wr.y * 0.5, 0.0)).xyz);`)
                .replace('#include <output_fragment>', `
                    #ifdef USE_ENVMAP
                    { vec3 vdir = normalize(vViewPosition); float fres = 0.08 + 0.92 * pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 5.0);
                      outgoingLight += getIBLRadiance(vdir, normal, 0.03) * fres * 1.6; diffuseColor.a = mix(diffuseColor.a, 1.0, fres * 0.6); }
                    #endif
                    #include <output_fragment>`);
        };
        this.waterMat.customProgramCacheKey = () => 'water2';
        T.waterN.repeat.set(3, 3);
        this.lavaTex = T.clouds.clone(); this.lavaTex.needsUpdate = true; this.lavaTex.repeat.set(2, 2);
        this.lavaMat = new THREE.MeshStandardMaterial({ color: 0x1a0400, emissive: 0xff5a10, emissiveIntensity: 1.6, emissiveMap: this.lavaTex, roughness: 0.6, normalMap: T.leafN });
        this.buildProps();
    },

    // ---------- палитра тайлов ----------
    tileColor(t, x, y) {
        const dark = typeof darkGround === 'function' && darkGround(x, y);
        switch (t) {
            case 0: return 0x5a8a3a; case 1: return 0x8d7b62; case 2: return 0x24343a; case 3: return dark ? 0x3a3542 : 0x2f5226;
            case 4: return 0x3f6e2e; case 5: return 0x3e3946; case 6: return dark ? 0x3b3742 : 0x55504a; case 7: return 0x2a1008;
            case 8: return 0x24343a; case 9: return 0x6f8088; case 10: return 0xd4cdbf; case 11: return 0x2f55b0; case 12: return 0x9a9282;
            case 13: return 0x4c4558; case 14: return 0x2c2736; case 15: return 0x7a1b1b; case 16: return 0x4c4558; case 17: return 0x2c0f0a;
            case 18: return 0x30483a; case 19: return 0x30483a; case 20: return 0x4c4558; case 21: return 0x3a1208; case 22: return 0x2c0f0a;
        }
        return 0x444444;
    },
    // Мягкие холмы (не на воде и лаве)
    hill(wx, wz, h) { return h < -0.05 ? 0 : (Tex3D.fbm(wx * 0.18, wz * 0.18, 1e5, 3, 7) - 0.5) * 0.24 + (Tex3D.fbm(wx * 0.9, wz * 0.9, 1e5, 2, 8) - 0.5) * 0.05; },
    // Высота земли в точке мира (для персонажей, декора и эффектов)
    hAt(wx, wz) {
        if (typeof worldMap === 'undefined') return 0;
        const fx = wx - 0.5, fz = wz - 0.5, ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz;
        const th = (x, y) => { x = Math.max(0, Math.min(MAP_W - 1, x)); y = Math.max(0, Math.min(MAP_H - 1, y)); return this.tileHeight(worldMap[y][x]); };
        const h = (th(ix, iz) * (1 - u) + th(ix + 1, iz) * u) * (1 - w) + (th(ix, iz + 1) * (1 - u) + th(ix + 1, iz + 1) * u) * w;
        return Math.max(h, -0.2) + this.hill(wx, wz, h);
    },
    tileHeight(t) { return t === 2 || t === 8 ? -0.5 : (t === 7 ? -0.32 : (t === 9 ? -0.12 : 0)); },

    // ---------- детальные модели природы и построек (для инстансинга) ----------
    // Неровная поверхность: вершины сдвигаются по нормали шумом (кора, камень, кроны)
    bump(g, amt, freq, seed = 1) {
        g = g.index ? g.toNonIndexed() : g;
        const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
        g.computeBoundingBox(); g.boundingBox.getCenter(c);
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            const d = v.clone().sub(c), l = d.length() || 1;
            const n = Tex3D.fbm(v.x * freq + 50, v.y * freq + v.z * freq * 0.7 + 50, 1e5, 3, seed) - 0.5;
            v.add(d.multiplyScalar(n * amt / l * 2)); p.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        return g;
    },
    // Склейка нескольких геометрий (с их сдвигами) в одну
    join(list) {
        const parts = list.map(([g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1]) => {
            const c = (g.index ? g.toNonIndexed() : g.clone());
            c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)));
            if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
            return c;
        });
        return Actors3D.mergeGeos(parts);
    },
    buildProps() {
        const M = (c, k, o) => G3.mat(c, Object.assign({ k }, o || {})), E = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
        const cyl = (rt, rb, h, s = 16, hs = 4) => new THREE.CylinderGeometry(rt, rb, h, s, hs);
        const MB = Models3D;
        const P = this.props = {};
        // part: [геометрия, материал, смещение по y, отбрасывает тень, цвет экземпляра]
        // Ель: ствол в коре и четыре яруса «рваных» опущенных лап
        const tier = (r, h, seed) => { const g = new THREE.ConeGeometry(r, h, 22, 4, true), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 11 + seed) * 0.08 + (Tex3D.hash(Math.round(a * 30), seed, 3) - 0.5) * 0.12; if (y < -h * 0.3) { p.setY(i, y - Math.abs(Math.sin(a * 11 + seed)) * 0.09); } p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); return g; };
        P.pine = [[cyl(0.05, 0.11, 1.0, 14), M(0x6a4a32, 'wood'), 0.5, true], [this.join([[tier(0.78, 0.9, 1), 0, 0.95], [tier(0.62, 0.8, 2), 0, 1.4], [tier(0.46, 0.7, 3), 0, 1.82], [tier(0.28, 0.55, 4), 0, 2.2]]), M(0xffffff, 'leaf', { side: THREE.DoubleSide }), 0, true, true]];
        // Дуб: ствол с ветвями и пышная бугристая крона
        const crown = this.join([[this.bump(new THREE.IcosahedronGeometry(0.62, 3), 0.18, 3, 2), 0, 1.35], [this.bump(new THREE.IcosahedronGeometry(0.45, 3), 0.14, 3.5, 3), 0.38, 1.6, 0.1], [this.bump(new THREE.IcosahedronGeometry(0.42, 3), 0.14, 3.5, 4), -0.35, 1.55, -0.12], [this.bump(new THREE.IcosahedronGeometry(0.4, 3), 0.12, 4, 5), 0.05, 1.95, 0.05]]);
        const oakTrunk = this.join([[cyl(0.08, 0.15, 1.1, 14), 0, 0.55], [cyl(0.03, 0.06, 0.6, 10), 0.18, 1.05, 0, 0, 0, -0.8], [cyl(0.03, 0.05, 0.55, 10), -0.16, 1.05, 0.05, 0, 0, 0.9]]);
        P.oak = [[oakTrunk, M(0x5a3e2a, 'wood'), 0, true], [crown, M(0xffffff, 'leaf'), 0, true, true]];
        // Мёртвое дерево: кривой ствол и сучья-трубки
        const twig = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 16, r, 7);
        P.dead = [[this.join([[twig([[0, 0, 0], [0.05, 0.5, 0], [-0.04, 1.0, 0.03], [0.02, 1.5, 0]], 0.07)], [twig([[0, 0.8, 0], [0.25, 1.05, 0.05], [0.5, 1.15, 0.0]], 0.03)], [twig([[0, 1.1, 0], [-0.2, 1.3, -0.05], [-0.38, 1.55, 0]], 0.025)], [twig([[0, 0.55, 0], [-0.15, 0.7, 0.15], [-0.3, 0.75, 0.3]], 0.025)]]), M(0x3d3530, 'wood'), 0, true]];
        // Скалы: сглаженные валуны с выветренной поверхностью
        P.rock = [[this.bump(new THREE.IcosahedronGeometry(0.5, 3).scale(1, 0.75, 1), 0.22, 2.2, 7), M(0xffffff, 'rock'), 0.25, true, true]];
        P.boulder = [[this.bump(new THREE.IcosahedronGeometry(0.32, 3).scale(1.1, 0.7, 1), 0.12, 3, 8), M(0x5e5a54, 'rock'), 0.14, true]];
        // Стены: скруглённые блоки кладки с зубцами
        const wallG = MB.rboxGeo(1, 2.1, 1, 0.06).clone(), wu = wallG.attributes.uv; for (let i = 0; i < wu.count; i++) wu.setXY(i, wu.getX(i), wu.getY(i) * 2);
        P.wall = [[wallG, M(0xffffff, 'stone'), 1.05, true, true], [this.join([[MB.rboxGeo(0.32, 0.34, 1.0, 0.05), -0.3], [MB.rboxGeo(0.32, 0.34, 1.0, 0.05), 0.3]]), M(0xffffff, 'stone'), 2.27, true, true]];
        // Надгробие с крестом
        P.tomb = [[this.join([[MB.rboxGeo(0.42, 0.55, 0.13, 0.04), 0, 0.27], [MB.rboxGeo(0.5, 0.08, 0.3, 0.03), 0, 0.03], [MB.rboxGeo(0.06, 0.26, 0.05, 0.015), 0, 0.66], [MB.rboxGeo(0.18, 0.05, 0.05, 0.015), 0, 0.7]]), M(0x8a8f96, 'stone'), 0, true]];
        // Колонна: база, рифлёный ствол, капитель
        const shaft = (() => { const g = cyl(0.22, 0.25, 1.6, 32, 8), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 - Math.max(0, Math.cos(a * 14)) * 0.07; if (Math.abs(p.getY(i)) < 0.79) { p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); return g; })();
        P.pillar = [[this.join([[shaft, 0, 0.98], [MB.rboxGeo(0.62, 0.16, 0.62, 0.04), 0, 0.08], [cyl(0.3, 0.32, 0.1, 32), 0, 0.2], [cyl(0.32, 0.24, 0.14, 32), 0, 1.84], [MB.rboxGeo(0.66, 0.12, 0.66, 0.035), 0, 1.96]]), M(0x6b6478, 'stone'), 0, true]];
        P.spire = [[this.bump(new THREE.ConeGeometry(0.45, 2.6, 16, 8), 0.12, 2.5, 9), M(0x1a0c0a, 'rock'), 1.3, true], [new THREE.ConeGeometry(0.2, 1.2, 12), M(0x5a1206, 'rock', { emissive: 0xff3a00, emissiveIntensity: 0.6 }), 0.6, false]];
        // Шатёр: провисающая ткань между шестами, навершие
        const tentG = (() => { const g = new THREE.ConeGeometry(0.8, 1.05, 32, 6), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i), k = 1 - (0.5 - y / 1.05) * 0.0 - Math.abs(Math.sin(a * 3)) * 0.1 * (0.5 - y / 1.05); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
        P.tent = [[tentG, M(0xffffff, 'cloth'), 0.52, true, true], [cyl(0.025, 0.025, 0.3, 8), M(0x4a3020, 'wood'), 1.15, true]];
        // Знамя: древко, перекладина, волнистое полотнище
        const flag = (() => { const g = new THREE.PlaneGeometry(0.5, 0.8, 8, 10), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 9 + y * 3) * 0.04); if (y < -0.3) p.setY(i, y - Math.abs(x) * 0.25); } g.translate(0.27, 0, 0); g.computeVertexNormals(); return g; })();
        P.banner = [[this.join([[cyl(0.025, 0.03, 2.0, 10), 0, 1.0], [cyl(0.015, 0.015, 0.6, 8), 0.27, 1.86, 0, 0, 0, Math.PI / 2], [new THREE.SphereGeometry(0.045, 14, 10), 0, 2.03]]), M(0x6b5a3a, 'metal'), 0, true], [flag, M(0xffffff, 'cloth', { side: THREE.DoubleSide }), 1.45, true, true]];
        // Костёр: кольцо камней, поленья, языки пламени
        const stones = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; stones.push([this.bump(new THREE.IcosahedronGeometry(0.09, 2), 0.04, 9, i), Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36]); }
        P.campfire = [[this.join(stones), M(0x5a5650, 'rock'), 0, true], [this.join([[cyl(0.05, 0.06, 0.62, 10), 0, 0.08, 0, Math.PI / 2, 0.6, 0], [cyl(0.05, 0.06, 0.62, 10), 0, 0.1, 0, Math.PI / 2, -0.6, 0], [cyl(0.045, 0.05, 0.55, 10), 0, 0.12, 0, Math.PI / 2, 1.6, 0]]), M(0x4a2a14, 'wood'), 0, false],
            [new THREE.ConeGeometry(0.2, 0.6, 12), E(0xff9a3a), 0.38, false], [new THREE.ConeGeometry(0.11, 0.42, 10), E(0xfff0a0), 0.32, false]];
        P.torch = [[cyl(0.035, 0.05, 1.3, 10), M(0x4a3020, 'wood'), 0.65, true], [new THREE.LatheGeometry([[0.03, 0], [0.09, 0.08], [0.1, 0.14]].map(p => new THREE.Vector2(...p)), 14), M(0x3a3a3a, 'dark', { side: THREE.DoubleSide }), 1.28, true], [new THREE.ConeGeometry(0.09, 0.3, 10), E(0xffb050), 1.5, false]];
        P.candelabra = [[new THREE.LatheGeometry([[0.12, 0], [0.1, 0.04], [0.03, 0.08], [0.025, 0.9], [0.06, 0.95], [0.03, 1.0]].map(p => new THREE.Vector2(...p)), 18), M(0xc8a040, 'gold'), 0, true], [new THREE.SphereGeometry(0.06, 12, 8), E(0xffd080), 1.12, false]];
        P.brazier = [[new THREE.LatheGeometry([[0.0, 0], [0.2, 0.02], [0.32, 0.2], [0.34, 0.26], [0.3, 0.24]].map(p => new THREE.Vector2(...p)), 24), M(0x2a1a14, 'dark', { side: THREE.DoubleSide }), 0.42, true], [this.join([[cyl(0.025, 0.03, 0.5, 8), 0.15, 0.22, 0, 0, 0, 0.3], [cyl(0.025, 0.03, 0.5, 8), -0.08, 0.22, 0.13, 0.25, 0, -0.15], [cyl(0.025, 0.03, 0.5, 8), -0.08, 0.22, -0.13, -0.25, 0, -0.15]]), M(0x2a1a14, 'dark'), 0, true], [new THREE.ConeGeometry(0.24, 0.55, 12), E(0xff5a20), 0.86, false]];
        P.ruinPillar = [[this.join([[this.bump(cyl(0.2, 0.24, 1.1, 24, 6), 0.04, 6, 11), 0, 0.6], [MB.rboxGeo(0.52, 0.12, 0.52, 0.03), 0, 0.06]]), M(0xa49c8c, 'stone'), 0, true]];
        P.coffin = [[(() => { const sh = new THREE.Shape(); sh.moveTo(-0.15, -0.42); sh.lineTo(0.15, -0.42); sh.lineTo(0.22, 0.2); sh.lineTo(0.14, 0.42); sh.lineTo(-0.14, 0.42); sh.lineTo(-0.22, 0.2); sh.lineTo(-0.15, -0.42); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3 }); g.rotateX(-Math.PI / 2); return g; })(), M(0x3a2418, 'wood'), 0.03, true]];
        P.statue = [[this.join([[MB.rboxGeo(0.55, 0.28, 0.55, 0.04), 0, 0.14], [this.bump(new THREE.IcosahedronGeometry(0.24, 3).scale(1, 1.3, 0.9), 0.06, 5, 12), 0, 0.58], [new THREE.SphereGeometry(0.12, 16, 12), 0, 0.95, 0.06], [MB.hornGeo(0.03, 0.18, 0.6), 0.07, 1.02, 0.02, 0.2, 0, -0.4], [MB.hornGeo(0.03, 0.18, 0.6), -0.07, 1.02, 0.02, 0.2, 0, 0.4]]), M(0x6a6a74, 'rock'), 0, true]];
        P.throne = [[this.join([[MB.rboxGeo(0.8, 0.45, 0.7, 0.06), 0, 0.22], [MB.rboxGeo(0.8, 1.5, 0.16, 0.05), 0, 0.98, -0.27], [MB.rboxGeo(0.12, 0.35, 0.6, 0.04), 0.4, 0.58], [MB.rboxGeo(0.12, 0.35, 0.6, 0.04), -0.4, 0.58]]), M(0x5a0c14, 'cloth'), 0, true], [this.join([[MB.rboxGeo(0.84, 0.06, 0.2, 0.02), 0, 1.75, -0.27], [new THREE.SphereGeometry(0.06, 12, 8), 0.4, 1.8, -0.27], [new THREE.SphereGeometry(0.06, 12, 8), -0.4, 1.8, -0.27]]), M(0xd4a020, 'gold'), 0, true]];
        // Трава: пучок изогнутых травинок
        const blade = new THREE.ConeGeometry(0.025, 0.36, 4, 3); blade.translate(0, 0.18, 0);
        const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setZ(i, bp.getZ(i) + y * y * 0.6); }
        P.grass = [[this.join([[blade, 0, 0, 0, 0, 0, 0.1], [blade, 0.05, 0, 0.03, 0, 2, -0.15, 0.85], [blade, -0.04, 0, 0.02, 0, 4, 0.2, 0.9], [blade, 0.02, 0, -0.05, 0, 1, 0.05, 1.15], [blade, -0.03, 0, -0.03, 0, 3, -0.1, 0.7], [blade, 0.07, 0, -0.02, 0, 5, 0.25, 0.8]]), M(0xffffff, 'leaf', { side: THREE.DoubleSide }), 0, false, true]];
        const frond = new THREE.PlaneGeometry(0.1, 0.42, 1, 5); frond.translate(0, 0.21, 0); const fp = frond.attributes.position; for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setZ(i, y * y * 1.4); fp.setX(i, fp.getX(i) * Math.sin(Math.min(1, y / 0.42) * Math.PI)); }
        const fr = []; for (let i = 0; i < 7; i++) fr.push([frond, 0, 0, 0, -0.3, i / 7 * Math.PI * 2]);
        P.fern = [[this.join(fr), M(0x2f6a2a, 'leaf', { side: THREE.DoubleSide }), 0, false]];
        P.reeds = [[this.join([[cyl(0.012, 0.022, 0.7, 6), 0, 0.35], [new THREE.CapsuleGeometry(0.025, 0.1, 4, 8), 0, 0.68]]), M(0x8a8a4a, 'leaf'), 0, false]];
        P.log = [[(() => { const g = cyl(0.13, 0.15, 0.95, 16); g.rotateZ(Math.PI / 2); return g; })(), M(0x5a3a22, 'wood'), 0.13, true]];
        P.skulls = [[this.join([[new THREE.SphereGeometry(0.09, 16, 12), 0, 0.09], [MB.rboxGeo(0.1, 0.05, 0.08, 0.015), 0, 0.03, 0.04]]), M(0xe8e2d4, 'bone'), 0, false]];
        P.bridge = [[this.join([[MB.rboxGeo(1.02, 0.08, 0.3, 0.025), 0, 0, -0.33], [MB.rboxGeo(1.02, 0.08, 0.3, 0.025), 0, 0, 0], [MB.rboxGeo(1.02, 0.08, 0.3, 0.025), 0, 0, 0.33]]), M(0x7a5232, 'wood'), -0.02, true]];
        P.spikes = [[new THREE.ConeGeometry(0.06, 0.32, 10), M(0xc9ccd4, 'metal'), 0.12, false]];
        P.flower = [[this.join([[cyl(0.008, 0.01, 0.16, 5), 0, 0.08], [new THREE.SphereGeometry(0.05, 10, 6).scale(1, 0.5, 1), 0, 0.17]]), M(0xffffff, 'plain'), 0, false, true]];
        P.shrineSword = [[MB.rboxGeo(0.7, 0.4, 0.7, 0.05), M(0xbdb5a3, 'stone'), 0.2, true], [MB.rboxGeo(0.06, 1.0, 0.16, 0.02), M(0xe8f0ff, 'metal', { emissive: 0x6080ff, emissiveIntensity: 0.6 }), 0.9, true]];
    },

    // ---------- куски мира ----------
    key: (cx, cy) => cx + ',' + cy,
    update(px, pz, inHell, dt) {
        const C = this.C, ccx = Math.floor(px / C), ccy = Math.floor(pz / C), R = 2;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const cx = ccx + dx, cy = ccy + dy;
            if (cx < 0 || cy < 0 || cx * C >= MAP_W || cy * C >= MAP_H) continue;
            const k = this.key(cx, cy);
            if (!this.chunks.has(k) && !this.queue.includes(k)) this.queue.push(k);
        }
        // Ближние куски строим первыми, не больше двух за кадр (без рывков)
        this.queue.sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return Math.hypot(ax - ccx, ay - ccy) - Math.hypot(bx - ccx, by - ccy); });
        for (let n = 0; n < 2 && this.queue.length; n++) { const k = this.queue.shift(); const [cx, cy] = k.split(',').map(Number); this.chunks.set(k, this.buildChunk(cx, cy)); }
        const hellRow = (typeof WORLD !== 'undefined' ? WORLD.hellRow : 1e9);
        // Отсечение по пирамиде видимости камеры — кусок целиком
        const cam = Engine3D.camera; cam.updateMatrixWorld();
        this.frustum = this.frustum || new THREE.Frustum(); this.box = this.box || new THREE.Box3();
        this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        for (const [k, ch] of this.chunks) {
            const far = Math.max(Math.abs(ch.cx - ccx), Math.abs(ch.cy - ccy)) > R + 1;
            if (far) { this.disposeChunk(ch); this.chunks.delete(k); continue; }
            this.box.min.set(ch.cx * C - 3, -1, ch.cy * C - 3); this.box.max.set(ch.cx * C + C + 3, 4, ch.cy * C + C + 3);
            ch.tier = (ch.cy * C >= hellRow) === inHell;
            ch.group.visible = ch.tier && this.frustum.intersectsBox(this.box);
        }
        Tex3D.T.waterN.offset.x += dt * 0.02; Tex3D.T.waterN.offset.y += dt * 0.012;
        this.lavaTex.offset.y += dt * 0.02; this.lavaTex.offset.x += dt * 0.01;
    },
    buildChunk(cx, cy) {
        const C = this.C, x0 = cx * C, y0 = cy * C, group = new THREE.Group();
        // Рельеф: сетка 2×2 вершины на тайл, цвет и высота — плавная интерполяция между центрами тайлов + мягкие холмики
        const Q = 2, N = C * Q + 1, pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), idx = [];
        const tmp = new THREE.Color();
        let hasWater = false, hasLava = false;
        const tc = new Map(), tileAt = (tx, ty) => {
            tx = Math.max(0, Math.min(MAP_W - 1, tx)); ty = Math.max(0, Math.min(MAP_H - 1, ty));
            const k = ty * MAP_W + tx; let v = tc.get(k);
            if (!v) { const t = worldMap[ty][tx]; tmp.setHex(this.tileColor(t, tx, ty)); const s = 0.9 + ((tx * 928371 + ty * 12377) % 100) / 100 * 0.2; v = [tmp.r * s, tmp.g * s, tmp.b * s, this.tileHeight(t)]; tc.set(k, v); }
            return v;
        };
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const wx = x0 + i / Q, wz = y0 + j / Q, fx = wx - 0.5, fz = wz - 0.5, ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz;
            const a = tileAt(ix, iz), b = tileAt(ix + 1, iz), c = tileAt(ix, iz + 1), d = tileAt(ix + 1, iz + 1);
            const L = (q) => (a[q] * (1 - u) + b[q] * u) * (1 - w) + (c[q] * (1 - u) + d[q] * u) * w;
            const k = j * N + i, h = L(3);
            const hill = this.hill(wx, wz, h);
            pos[k * 3] = wx; pos[k * 3 + 1] = h + hill; pos[k * 3 + 2] = wz;
            col[k * 3] = L(0); col[k * 3 + 1] = L(1); col[k * 3 + 2] = L(2);
            uv[k * 2] = wx * 0.3; uv[k * 2 + 1] = wz * 0.3;
        }
        for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
            const a = j * N + i, b2 = a + 1, c2 = a + N, d2 = c2 + 1;
            idx.push(a, c2, b2, b2, c2, d2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(idx); geo.computeVertexNormals();
        const ground = new THREE.Mesh(geo, this.groundMat); ground.receiveShadow = true;
        group.add(ground);

        // Постройки, природа, декор
        const inst = {}, lights = [];
        const add = (type, x, z, s = 1, rot = 0, color = null, sy = 1) => { (inst[type] = inst[type] || []).push([x, z, s, rot, color, sy]); };
        const hsh = (x, y, k = 1) => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0) / 4294967296;
        for (let y = y0; y < Math.min(MAP_H, y0 + C); y++) for (let x = x0; x < Math.min(MAP_W, x0 + C); x++) {
            const t = worldMap[y][x], cxm = x + 0.5, czm = y + 0.5, hv = hsh(x, y);
            const dark = typeof darkGround === 'function' && darkGround(x, y);
            if (t === 2 || t === 8) hasWater = true;
            if (t === 7) hasLava = true;
            if (t === 3) {
                if (dark) add('dead', cxm + (hv - 0.5) * 0.3, czm, 0.9 + hv * 0.5, hv * 6);
                else if (hv < 0.62) add('pine', cxm + (hv - 0.3) * 0.4, czm, 0.85 + hv * 0.6, hv * 6, new THREE.Color().setHSL(0.3 + hv * 0.05, 0.45, 0.2 + hv * 0.08));
                else add('oak', cxm, czm, 0.9 + hv * 0.4, hv * 6, new THREE.Color().setHSL(0.24 + hv * 0.08, 0.5, 0.25 + hv * 0.06));
            } else if (t === 6) add('rock', cxm, czm, 0.85 + hv * 0.6, hv * 6, new THREE.Color(dark ? 0x34303c : 0x58554e).offsetHSL(0, 0, (hv - 0.5) * 0.1), 0.7 + hv * 0.8);
            else if (t === 12) add('wall', cxm, czm, 1, 0, new THREE.Color(0xc4bca8));
            else if (t === 14) add('wall', cxm, czm, 1, 0, new THREE.Color(0x3b3448));
            else if (t === 19) add('tomb', cxm, czm, 0.9 + hv * 0.3, (hv - 0.5) * 0.5);
            else if (t === 20) add('pillar', cxm, czm);
            else if (t === 21) add('spire', cxm, czm, 0.9 + hv * 0.4, hv * 6);
            else if (t === 8 || t === 22) add('bridge', cxm, czm);
            else if (t === 16) { for (let k = 0; k < 4; k++) add('spikes', cxm + (k % 2 - 0.5) * 0.4, czm + (Math.floor(k / 2) - 0.5) * 0.4); }
            const dec = worldDecor[y] && worldDecor[y][x];
            if (dec) {
                switch (dec) {
                    case 'tent': add('tent', cxm, czm, 1, hv * 6, new THREE.Color(hv < 0.5 ? 0x8a4a22 : 0x6b6158)); break;
                    case 'banner_cross': add('banner', cxm, czm, 1, 0.3, new THREE.Color(0xf2f2f2)); break;
                    case 'banner_blood': add('banner', cxm, czm, 1, 0.3, new THREE.Color(0x8a1020)); break;
                    case 'royal_banner': add('banner', cxm, czm, 1.1, 0.3, new THREE.Color(0x2048c0)); break;
                    case 'campfire': add('campfire', cxm, czm); lights.push({ x: cxm, z: czm, h: 0.8, c: 0xff8a3d }); break;
                    case 'torch': add('torch', cxm, czm); lights.push({ x: cxm, z: czm, h: 1.5, c: 0xffa040 }); break;
                    case 'candelabra': add('candelabra', cxm, czm); lights.push({ x: cxm, z: czm, h: 1.25, c: 0xffc070 }); break;
                    case 'hell_brazier': add('brazier', cxm, czm); lights.push({ x: cxm, z: czm, h: 1.1, c: 0xff4a1a }); break;
                    case 'ruin_pillar': add('ruinPillar', cxm, czm, 0.8 + hv * 0.6); break;
                    case 'boulder': add('boulder', cxm, czm, 0.8 + hv * 0.7, hv * 6); break;
                    case 'coffin': add('coffin', cxm, czm, 1, hv * 0.6); break;
                    case 'gargoyle_statue': add('statue', cxm, czm); break;
                    case 'throne': add('throne', cxm, czm, 1.2); break;
                    case 'dead_tree': add('dead', cxm, czm, 0.8 + hv * 0.4, hv * 6); break;
                    case 'fallen_log': add('log', cxm, czm, 1, hv * 6); break;
                    case 'skull_pile': for (let k = 0; k < 3; k++) add('skulls', cxm + (k - 1) * 0.12, czm + (k % 2) * 0.1); break;
                    case 'fern': add('fern', cxm, czm, 0.8 + hv * 0.6, hv * 6); break;
                    case 'reeds': for (let k = 0; k < 5; k++) add('reeds', cxm + (hsh(x, y, k) - 0.5) * 0.6, czm + (hsh(x, y, k + 9) - 0.5) * 0.6, 0.8 + hsh(x, y, k) * 0.5); break;
                    case 'tuft': for (let k = 0; k < 5; k++) add('grass', cxm + (hsh(x, y, k) - 0.5) * 0.7, czm + (hsh(x, y, k + 5) - 0.5) * 0.7, 0.7 + hsh(x, y, k) * 0.7, 0, new THREE.Color().setHSL(0.25 + hsh(x, y, k) * 0.06, 0.55, 0.3)); break;
                    case 'flower': add('flower', cxm, czm, 1, 0, new THREE.Color().setHSL(hv, 0.7, 0.6)); break;
                    case 'excalibur_shrine': add('shrineSword', cxm, czm); break;
                }
            }
            // Немного травы на открытых лугах — живая земля
            if ((t === 0 || t === 4) && !dec && hv > 0.45) for (let k = 0; k < (hv > 0.8 ? 3 : 1); k++) { const q = hsh(x, y, k + 40); add('grass', x + 0.15 + q * 0.7, y + 0.15 + hsh(x, y, k + 60) * 0.7, 0.8 + q * 0.6, q * 6, new THREE.Color().setHSL(0.24 + q * 0.06, 0.5, 0.26 + hv * 0.08)); }
        }
        const dummy = new THREE.Object3D();
        for (const type in inst) {
            const list = inst[type], parts = this.props[type];
            if (!parts) continue;
            parts.forEach(([pg, pm, oy, shadow, useColor]) => {
                const im = new THREE.InstancedMesh(pg, pm, list.length);
                list.forEach(([x, z, s, rot, color, sy], i) => {
                    dummy.position.set(x, (oy * s * sy) + (type === 'bridge' ? 0 : this.hAt(x, z)), z); dummy.rotation.set(0, rot, 0); dummy.scale.set(s, s * sy, s); dummy.updateMatrix();
                    im.setMatrixAt(i, dummy.matrix);
                    if (useColor) im.setColorAt(i, color || new THREE.Color(0xffffff));
                });
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
                im.castShadow = !!shadow; im.receiveShadow = true;
                im.frustumCulled = false; // отсечение — целыми кусками (см. update)
                group.add(im);
            });
        }
        if (hasWater) { const w = new THREE.Mesh(new THREE.PlaneGeometry(C, C), this.waterMat); w.rotation.x = -Math.PI / 2; w.position.set(x0 + C / 2, -0.2, y0 + C / 2); w.receiveShadow = true; group.add(w); }
        if (hasLava) { const l = new THREE.Mesh(new THREE.PlaneGeometry(C, C), this.lavaMat); l.rotation.x = -Math.PI / 2; l.position.set(x0 + C / 2, -0.12, y0 + C / 2); group.add(l); }
        this.scene.add(group);
        return { cx, cy, group, lights, ground };
    },
    disposeChunk(ch) {
        this.scene.remove(ch.group);
        ch.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o === ch.ground || (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry')) o.geometry.dispose(); });
    },
    // Ближайшие источники огня (для пула точечных огней)
    nearLights(px, pz, n) {
        this.lightsT -= 1;
        if (this.lightsT > 0) return this.lightsCache;
        this.lightsT = 15;
        const all = [];
        for (const ch of this.chunks.values()) if (ch.tier) for (const l of ch.lights) all.push(l);
        if (typeof FX3D !== 'undefined') FX3D.extraLights(all);
        all.forEach(l => l.d = Math.hypot(l.x - px, l.z - pz));
        this.lightsCache = all.filter(l => l.d < 22).sort((a, b) => a.d - b.d).slice(0, n);
        return this.lightsCache;
    }
};
