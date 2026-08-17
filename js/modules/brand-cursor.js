/**
 * Render the SYSETUP brand cursor as a tiny dependency-free WebGL sculpture.
 *
 * The DOM keeps the original asterisk as a visual fallback. The fallback is
 * hidden only after WebGL has successfully compiled, linked, and rendered.
 */

const DEFAULT_ROTATION_PERIOD_MS = 7200;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readCssNumber = (styles, property, fallback, min, max) => {
    const parsed = Number.parseFloat(styles?.getPropertyValue?.(property));
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

const VERTEX_SHADER = `
attribute vec3 a_position;
attribute vec3 a_normal;

uniform float u_rx;
uniform float u_ry;
uniform float u_rz;
uniform float u_scale;

varying vec3 v_normal;
varying vec3 v_position;

mat3 rotateX(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, s,
        0.0, -s, c
    );
}

mat3 rotateY(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
    );
}

mat3 rotateZ(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        c, s, 0.0,
        -s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {
    mat3 rotation = rotateZ(u_rz) * rotateY(u_ry) * rotateX(u_rx);
    vec3 position = rotation * (a_position * u_scale);
    vec3 normal = normalize(rotation * a_normal);

    // A very shallow perspective keeps the mark legible at favicon-like sizes
    // while still allowing the tips to move convincingly through depth.
    float depth = 1.0 + position.z * 0.13;
    vec2 projected = position.xy / depth;

    gl_Position = vec4(projected * 0.69, position.z * 0.11, 1.0);
    v_normal = normal;
    v_position = position;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform float u_wire;
uniform float u_pulse;
uniform float u_glow;

varying vec3 v_normal;
varying vec3 v_position;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 lightDirection = normalize(vec3(-0.35, 0.7, 1.0));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float facing = abs(normal.z);
    float fresnel = pow(1.0 - facing, 2.2);

    vec3 cyan = vec3(0.067, 0.925, 0.898);
    vec3 ice = vec3(0.96, 1.0, 1.0);
    vec3 electric = vec3(0.25, 0.64, 1.0);

    float energy = 0.72 + u_glow * 0.28;

    if (u_wire > 0.5) {
        vec3 wireColor = mix(cyan, ice, 0.72 + 0.24 * u_pulse);
        gl_FragColor = vec4(wireColor * energy, (0.44 + 0.18 * u_pulse) * energy);
        return;
    }

    float highlight = clamp(
        diffuse * 0.72 + fresnel * 0.9 + u_pulse * 0.08 + u_glow * 0.035,
        0.0,
        1.0
    );
    vec3 color = mix(cyan, ice, highlight);
    color = mix(color, electric, max(-normal.x * 0.12, 0.0));
    float alpha = (0.26 + diffuse * 0.24 + fresnel * 0.29) * energy;

    gl_FragColor = vec4(color * energy, alpha);
}
`;

const normalize = ([x, y, z]) => {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
};

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

const faceNormal = (a, b, c) => normalize(cross(subtract(b, a), subtract(c, a)));

/** Build a stellated octahedron: compact, angular and readable at small sizes. */
const createCursorGeometry = () => {
    const vertices = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
    ];
    const faces = [
        [0, 2, 4],
        [2, 1, 4],
        [1, 3, 4],
        [3, 0, 4],
        [2, 0, 5],
        [1, 2, 5],
        [3, 1, 5],
        [0, 3, 5],
    ];
    const trianglePositions = [];
    const triangleNormals = [];
    const linePositions = [];
    const lineNormals = [];

    const addTriangle = (a, b, c) => {
        const normal = faceNormal(a, b, c);
        for (const point of [a, b, c]) {
            trianglePositions.push(...point);
            triangleNormals.push(...normal);
        }
        for (const point of [a, b, b, c, c, a]) {
            linePositions.push(...point);
            lineNormals.push(...normal);
        }
    };

    for (const [ia, ib, ic] of faces) {
        const a = vertices[ia];
        const b = vertices[ib];
        const c = vertices[ic];
        const faceCenter = normalize([
            (a[0] + b[0] + c[0]) / 3,
            (a[1] + b[1] + c[1]) / 3,
            (a[2] + b[2] + c[2]) / 3,
        ]);
        const apex = faceCenter.map((component) => component * 1.82);

        addTriangle(a, b, apex);
        addTriangle(b, c, apex);
        addTriangle(c, a, apex);
    }

    return {
        trianglePositions: new Float32Array(trianglePositions),
        triangleNormals: new Float32Array(triangleNormals),
        linePositions: new Float32Array(linePositions),
        lineNormals: new Float32Array(lineNormals),
    };
};

const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to allocate WebGL shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
        gl.deleteShader(shader);
        throw new Error(message);
    }
    return shader;
};

const createProgram = (gl) => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to allocate WebGL program');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || 'WebGL program linking failed';
        gl.deleteProgram(program);
        throw new Error(message);
    }
    return program;
};

const createBuffer = (gl, data) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to allocate WebGL buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
};

/**
 * Create the rotating brand cursor inside a data-role="brand-cursor" host.
 *
 * @param {HTMLElement} host Element containing the fallback asterisk.
 * @param {object} [options]
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {boolean} [options.reducedMotion]
 * @returns {{refresh: Function, destroy: Function}}
 *
 * Visual tuning is centralized in .brand-cursor CSS custom properties:
 * --cursor-size, --cursor-x, --cursor-y, --cursor-render-scale,
 * --cursor-glow, and --cursor-rotation-speed.
 */
export const createBrandCursor = (host, options = {}) => {
    const doc = options.document ?? host?.ownerDocument;
    const win = options.window ?? doc?.defaultView;
    if (!host || !doc || !win) throw new TypeError('host, document and window are required');

    const reducedMotion = options.reducedMotion ?? false;
    const canvas = doc.createElement('canvas');
    canvas.className = 'brand-cursor-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);

    let gl;
    try {
        gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            depth: true,
            premultipliedAlpha: false,
            powerPreference: 'low-power',
        });
    } catch {
        gl = null;
    }

    if (!gl) {
        canvas.remove();
        return { refresh() {}, destroy() {} };
    }

    let program;
    const buffers = [];
    let frameId = 0;
    let observer = null;
    let resizeObserver = null;
    let destroyed = false;
    let inViewport = true;
    let elapsedBeforePause = 0;
    let lastTimestamp = null;
    let tuning = { renderScale: 1, glow: 1, rotationSpeed: 1 };

    const syncTuning = () => {
        const styles =
            typeof win.getComputedStyle === 'function'
                ? win.getComputedStyle(host)
                : host.style;
        tuning = {
            renderScale: readCssNumber(styles, '--cursor-render-scale', 1, 0.25, 2.5),
            glow: readCssNumber(styles, '--cursor-glow', 1, 0, 2.5),
            rotationSpeed: readCssNumber(
                styles,
                '--cursor-rotation-speed',
                1,
                0,
                4
            ),
        };
        host.style.setProperty(
            '--brand-cursor-canvas-brightness',
            (0.72 + tuning.glow * 0.28).toFixed(3)
        );
    };

    try {
        program = createProgram(gl);
        const geometry = createCursorGeometry();
        const trianglePositionBuffer = createBuffer(gl, geometry.trianglePositions);
        const triangleNormalBuffer = createBuffer(gl, geometry.triangleNormals);
        const linePositionBuffer = createBuffer(gl, geometry.linePositions);
        const lineNormalBuffer = createBuffer(gl, geometry.lineNormals);
        buffers.push(
            trianglePositionBuffer,
            triangleNormalBuffer,
            linePositionBuffer,
            lineNormalBuffer
        );

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const normalLocation = gl.getAttribLocation(program, 'a_normal');
        const rxLocation = gl.getUniformLocation(program, 'u_rx');
        const ryLocation = gl.getUniformLocation(program, 'u_ry');
        const rzLocation = gl.getUniformLocation(program, 'u_rz');
        const scaleLocation = gl.getUniformLocation(program, 'u_scale');
        const wireLocation = gl.getUniformLocation(program, 'u_wire');
        const pulseLocation = gl.getUniformLocation(program, 'u_pulse');
        const glowLocation = gl.getUniformLocation(program, 'u_glow');

        const bindGeometry = (positionBuffer, normalBuffer) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.enableVertexAttribArray(normalLocation);
            gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        };

        const resize = () => {
            const rect = host.getBoundingClientRect();
            const cssSize = Math.max(24, Math.ceil(Math.min(rect.width, rect.height) || 48));
            const dpr = Math.min(win.devicePixelRatio || 1, 2);
            const targetSize = Math.max(32, Math.round(cssSize * dpr));
            if (canvas.width !== targetSize || canvas.height !== targetSize) {
                canvas.width = targetSize;
                canvas.height = targetSize;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
        };

        const draw = (time) => {
            if (destroyed) return;

            if (!reducedMotion) {
                if (lastTimestamp === null) lastTimestamp = time;
                elapsedBeforePause += Math.max(0, time - lastTimestamp);
                lastTimestamp = time;
            }
            const elapsed = reducedMotion ? 0 : elapsedBeforePause;
            const turn =
                (elapsed / DEFAULT_ROTATION_PERIOD_MS) * TAU * tuning.rotationSpeed;
            const pulse = reducedMotion ? 0.45 : 0.5 + Math.sin(elapsed / 820) * 0.5;

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.useProgram(program);

            gl.uniform1f(rxLocation, 0.58 + Math.sin(turn * 0.63) * 0.16);
            gl.uniform1f(ryLocation, turn);
            gl.uniform1f(rzLocation, -0.24 + Math.sin(turn * 0.41) * 0.13);
            gl.uniform1f(
                scaleLocation,
                (0.93 + pulse * 0.025) * tuning.renderScale
            );
            gl.uniform1f(pulseLocation, pulse);
            gl.uniform1f(glowLocation, tuning.glow);

            bindGeometry(trianglePositionBuffer, triangleNormalBuffer);
            gl.uniform1f(wireLocation, 0);
            gl.drawArrays(gl.TRIANGLES, 0, geometry.trianglePositions.length / 3);

            gl.disable(gl.DEPTH_TEST);
            bindGeometry(linePositionBuffer, lineNormalBuffer);
            gl.uniform1f(wireLocation, 1);
            gl.drawArrays(gl.LINES, 0, geometry.linePositions.length / 3);

            host.style.setProperty(
                '--brand-cursor-inner-opacity',
                clamp((0.72 + pulse * 0.22) * tuning.glow, 0, 1).toFixed(3)
            );
            host.style.setProperty(
                '--brand-cursor-outer-opacity',
                clamp((0.42 + pulse * 0.22) * tuning.glow, 0, 1).toFixed(3)
            );
            if (!host.classList.contains('brand-cursor-ready')) {
                host.classList.add('brand-cursor-ready');
            }

            if (!reducedMotion && inViewport && !doc.hidden) {
                frameId = win.requestAnimationFrame(draw);
            }
        };

        const start = () => {
            if (destroyed || reducedMotion || !inViewport || doc.hidden || frameId) return;
            lastTimestamp = null;
            frameId = win.requestAnimationFrame((time) => {
                frameId = 0;
                draw(time);
            });
        };

        const stop = () => {
            if (frameId) {
                win.cancelAnimationFrame(frameId);
                frameId = 0;
            }
            lastTimestamp = null;
        };

        const onVisibilityChange = () => {
            if (doc.hidden) stop();
            else start();
        };
        doc.addEventListener('visibilitychange', onVisibilityChange);

        if ('IntersectionObserver' in win) {
            observer = new win.IntersectionObserver((entries) => {
                inViewport = entries.some((entry) => entry.isIntersecting);
                if (inViewport) start();
                else stop();
            });
            observer.observe(host);
        }

        const refresh = () => {
            if (destroyed) return;
            stop();
            syncTuning();
            resize();
            draw(win.performance?.now?.() ?? Date.now());
        };

        if ('ResizeObserver' in win) {
            resizeObserver = new win.ResizeObserver(refresh);
            resizeObserver.observe(host);
        } else {
            win.addEventListener('resize', refresh, { passive: true });
        }

        // Paint synchronously so the fallback disappears only after success.
        syncTuning();
        resize();
        draw(win.performance?.now?.() ?? Date.now());

        return {
            refresh,
            destroy() {
                if (destroyed) return;
                destroyed = true;
                stop();
                observer?.disconnect();
                resizeObserver?.disconnect();
                doc.removeEventListener('visibilitychange', onVisibilityChange);
                if (!resizeObserver) win.removeEventListener('resize', refresh);
                for (const buffer of buffers) gl.deleteBuffer(buffer);
                gl.deleteProgram(program);
                canvas.remove();
                host.classList.remove('brand-cursor-ready');
                host.style.removeProperty('--brand-cursor-inner-opacity');
                host.style.removeProperty('--brand-cursor-outer-opacity');
                host.style.removeProperty('--brand-cursor-canvas-brightness');
            },
        };
    } catch (error) {
        for (const buffer of buffers) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        canvas.remove();
        throw error;
    }
};
