/** Load, validate, and format coarse visitor geolocation data. */

/** Options: exact HTTPS primary endpoint; current value is GeoJS. */
export const GEOJS_URL = 'https://get.geojs.io/v1/ip/geo.json';

/** Options: exact HTTPS fallback endpoint; current value is the Sysetup Worker. */
export const GEO_WORKER_URL =
    'https://sysetup-geolocation.sysetup.workers.dev/';

/** Options: positive finite request timeout in milliseconds; default: 4000. */
const GEO_REQUEST_TIMEOUT_MS = 4000;

/** Options: positive integer maximum UTF-8 response size in bytes; default: 8192. */
const GEO_MAX_RESPONSE_BYTES = 8192;

/** Options: positive integer maximum characters retained per remote field; default: 80. */
const GEO_FIELD_MAX_LENGTH = 80;

/** Options: allowlisted response fields are IP, city, region, country, and time zone. */
const GEO_FIELD_DEFINITIONS = [
    ['IP address', ['ip']],
    ['City', ['city']],
    ['Region', ['region', 'region_name']],
    ['Country', ['country', 'country_name', 'country_code']],
    ['Time zone', ['timezone', 'time_zone']],
];

const createAbortError = () => {
    const error = new Error('geolocation request aborted');
    error.name = 'AbortError';
    return error;
};

const normalizeField = (value) => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().replace(/\s+/g, ' ');
    return [...normalized]
        .filter((character) => {
            const codePoint = character.codePointAt(0);
            return codePoint > 0x1f && codePoint !== 0x7f;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .slice(0, GEO_FIELD_MAX_LENGTH);
};

const readFirstField = (data, keys) =>
    keys.map((key) => normalizeField(data[key])).find(Boolean) ?? '';

const readAsn = (value) => {
    if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 1) return '';
        return String(value);
    }
    if (typeof value !== 'string') return '';

    const normalized = value.trim().replace(/^AS/i, '');
    return /^\d{1,10}$/.test(normalized) ? normalized : '';
};

const readNetwork = (data) => {
    const organization = readFirstField(data, [
        'organization',
        'network',
        'org',
        'isp',
    ]);
    const asn = readAsn(data.asn);
    if (asn && organization) return `AS${asn} ${organization}`;
    if (asn) return `AS${asn}`;
    return organization;
};

/**
 * Convert a validated API object into safe, user-visible rotation messages.
 *
 * @param {object} data Parsed geolocation response.
 * @returns {string[]} Supported non-empty fields formatted for the typewriter.
 */
export const buildGeolocationMessages = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError('geolocation data must be an object');
    }

    const messages = GEO_FIELD_DEFINITIONS.reduce((items, [label, keys]) => {
        const value = readFirstField(data, keys);
        if (value) items.push(`${label}: ${value}`);
        return items;
    }, []);
    const network = readNetwork(data);
    if (network) messages.push(`Network: ${network}`);
    return messages;
};

/**
 * Fetch one bounded JSON response from an allowlisted endpoint.
 *
 * @param {Function} fetchImpl Fetch implementation.
 * @param {string} url Allowlisted endpoint URL.
 * @param {AbortSignal} [signal] Caller-controlled cancellation signal.
 * @param {number} timeoutMs Request timeout in milliseconds.
 * @returns {Promise<object>} Parsed JSON object.
 */
const fetchGeolocationJson = async (fetchImpl, url, signal, timeoutMs) => {
    const AbortControllerClass = globalThis.AbortController;
    if (typeof AbortControllerClass !== 'function') {
        throw new Error('AbortController is unavailable');
    }

    const controller = new AbortControllerClass();
    const abortRequest = () => controller.abort();
    if (signal) {
        if (typeof signal.addEventListener !== 'function') {
            throw new TypeError('signal must support abort events');
        }
        if (signal.aborted) throw createAbortError();
        signal.addEventListener('abort', abortRequest, { once: true });
    }

    const timerId = globalThis.setTimeout(abortRequest, timeoutMs);
    try {
        const response = await fetchImpl(url, {
            credentials: 'omit',
            method: 'GET',
            signal: controller.signal,
        });
        if (!response || response.ok !== true) {
            const status = response?.status ?? 'no response';
            throw new Error(`geolocation request failed: ${status}`);
        }

        const text = await response.text();
        if (typeof text !== 'string' || text.length > GEO_MAX_RESPONSE_BYTES) {
            throw new Error('geolocation response exceeds the size limit');
        }

        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('geolocation response must be a JSON object');
        }
        return data;
    } finally {
        globalThis.clearTimeout(timerId);
        signal?.removeEventListener?.('abort', abortRequest);
    }
};

const loadEndpointMessages = async (fetchImpl, url, signal, timeoutMs) => {
    try {
        const data = await fetchGeolocationJson(
            fetchImpl,
            url,
            signal,
            timeoutMs
        );
        return buildGeolocationMessages(data);
    } catch {
        return [];
    }
};

/**
 * Load visitor data from GeoJS and then the Sysetup Worker if needed.
 *
 * @param {object} args Named loader arguments.
 * @param {Function} args.fetchImpl Fetch implementation.
 * @param {AbortSignal} [args.signal] Caller-controlled cancellation signal.
 * @param {number} [args.timeoutMs=4000] Per-endpoint request timeout.
 * @returns {Promise<string[]>} Safe messages for the existing typewriter.
 */
export const loadGeolocationMessages = async ({
    fetchImpl,
    signal,
    timeoutMs = GEO_REQUEST_TIMEOUT_MS,
} = {}) => {
    if (typeof fetchImpl !== 'function') {
        throw new TypeError('fetchImpl must be a function');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
        throw new TypeError('timeoutMs must be positive');
    }

    const primaryMessages = await loadEndpointMessages(
        fetchImpl,
        GEOJS_URL,
        signal,
        timeoutMs
    );
    if (primaryMessages.length > 0) return primaryMessages;

    const fallbackMessages = await loadEndpointMessages(
        fetchImpl,
        GEO_WORKER_URL,
        signal,
        timeoutMs
    );
    if (fallbackMessages.length > 0) return fallbackMessages;

    throw new Error('geolocation data is unavailable');
};
