/** Load the one local plain-text asset with bounded, fail-closed behavior. */

const EXPECTED_URL = 'assets/background.txt';

const byteLength = (text) => {
    if (typeof TextEncoder === 'function') {
        return new TextEncoder().encode(text).byteLength;
    }
    let length = 0;
    for (const character of text) {
        const codePoint = character.codePointAt(0);
        if (codePoint <= 0x7f) length += 1;
        else if (codePoint <= 0x7ff) length += 2;
        else if (codePoint <= 0xffff) length += 3;
        else length += 4;
    }
    return length;
};

const readBoundedText = async (response, maxBytes) => {
    if (typeof response.body?.getReader !== 'function') {
        const text = await response.text();
        if (byteLength(text) > maxBytes) {
            throw new Error(`background exceeds ${maxBytes} bytes`);
        }
        return text;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array)) {
                throw new Error('background response contained invalid bytes');
            }
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
                await reader.cancel();
                throw new Error(`background exceeds ${maxBytes} bytes`);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

/**
 * Load the decorative background text.
 *
 * @param {object} args Named arguments.
 * @param {Function} args.fetchImpl Fetch implementation.
 * @param {string} args.url Fixed local asset route.
 * @param {number} [args.maxBytes=65536] Maximum UTF-8 body size.
 * @param {number} [args.timeoutMs=5000] Request timeout.
 * @param {AbortSignal} [args.signal] Optional caller cancellation signal.
 * @returns {Promise<string>} Plain text content.
 */
export const loadBackground = async ({
    fetchImpl,
    url,
    maxBytes = 64 * 1024,
    timeoutMs = 5000,
    signal,
} = {}) => {
    if (url !== EXPECTED_URL) {
        throw new Error(`refusing unexpected background route: ${url}`);
    }
    if (typeof fetchImpl !== 'function') {
        throw new TypeError('fetchImpl must be a function');
    }
    if (!Number.isInteger(maxBytes) || maxBytes < 1) {
        throw new TypeError('maxBytes must be a positive integer');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
        throw new TypeError('timeoutMs must be positive');
    }

    const controller = new AbortController();
    const abortRequest = () => controller.abort();
    if (signal) {
        if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
        signal.addEventListener('abort', abortRequest, { once: true });
    }
    const timerId = setTimeout(abortRequest, timeoutMs);

    try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response || !response.ok) {
            const status = response ? response.status : 'no response';
            throw new Error(`background request failed: ${status}`);
        }
        const declaredBytes = Number(
            response.headers?.get?.('content-length') || 0
        );
        if (declaredBytes > maxBytes) {
            throw new Error(`background exceeds ${maxBytes} bytes`);
        }

        return await readBoundedText(response, maxBytes);
    } finally {
        clearTimeout(timerId);
        signal?.removeEventListener('abort', abortRequest);
    }
};
