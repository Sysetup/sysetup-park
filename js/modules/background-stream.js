/** Render a bounded plain-text background track with explicit teardown. */

const createVisibility = (documentRef) => {
    if (!documentRef?.addEventListener) {
        return { isHidden: () => false, onChange: () => () => {} };
    }

    return {
        isHidden: () => documentRef.visibilityState === 'hidden',
        onChange: (callback) => {
            documentRef.addEventListener('visibilitychange', callback);
            return () =>
                documentRef.removeEventListener('visibilitychange', callback);
        },
    };
};

const assertFunction = (value, name) => {
    if (typeof value !== 'function') {
        throw new TypeError(`${name} must be a function`);
    }
};

/** Split text into lines while normalizing common line endings. */
export const splitBackgroundText = (text) => {
    if (typeof text !== 'string') {
        throw new TypeError('background text must be a string');
    }
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
};

const createCopy = (documentRef, text) => {
    const copy = documentRef.createElement('span');
    copy.className = 'ambient-code-copy';
    copy.textContent = text;
    return copy;
};

/**
 * Create the decorative background track.
 *
 * The track contains two identical plain-text copies. CSS moves the track at
 * a constant compositor-driven speed and loops at the exact copy boundary.
 *
 * @param {HTMLElement} element Target output element.
 * @param {string} text Plain-text corpus.
 * @param {object} [options] Lifecycle options.
 * @param {Document} [options.document] Document used to create track nodes.
 * @param {boolean} [options.reducedMotion=false] Disable animated movement.
 * @param {{isHidden: Function, onChange: Function}} [options.visibility]
 * Visibility lifecycle adapter.
 * @returns {{start: Function, stop: Function, destroy: Function}}
 */
export const createBackgroundStream = (element, text, options = {}) => {
    if (!element || !('textContent' in element)) {
        throw new TypeError('element must be a DOM element');
    }

    const normalizedText = splitBackgroundText(text).join('\n');
    const {
        document: documentRef = globalThis.document,
        reducedMotion = false,
        visibility = createVisibility(documentRef),
    } = options;

    if (typeof reducedMotion !== 'boolean') {
        throw new TypeError('reducedMotion must be a boolean');
    }
    assertFunction(visibility.isHidden, 'visibility.isHidden');
    assertFunction(visibility.onChange, 'visibility.onChange');

    const outputElement = element;
    let track = null;
    let running = false;
    let destroyed = false;
    let unsubscribe = () => {};

    const setPaused = (paused) => {
        if (typeof track?.classList?.toggle !== 'function') return;
        track.classList.toggle('ambient-code-track-paused', paused);
    };

    const render = () => {
        const ownerDocument = outputElement.ownerDocument ?? documentRef;
        if (
            typeof ownerDocument?.createElement !== 'function' ||
            typeof outputElement.appendChild !== 'function'
        ) {
            outputElement.textContent = normalizedText;
            return null;
        }

        outputElement.textContent = '';
        const nextTrack = ownerDocument.createElement('span');
        nextTrack.className = 'ambient-code-track';
        nextTrack.appendChild(createCopy(ownerDocument, normalizedText));
        if (!reducedMotion) {
            nextTrack.appendChild(createCopy(ownerDocument, normalizedText));
        }
        outputElement.appendChild(nextTrack);
        return nextTrack;
    };

    const handleVisibilityChange = () => {
        if (!running) return;
        setPaused(visibility.isHidden());
    };

    return {
        start() {
            if (destroyed || running) return;
            track = render();
            running = true;
            unsubscribe = visibility.onChange(handleVisibilityChange);
            setPaused(reducedMotion || visibility.isHidden());
        },
        stop() {
            if (!running) return;
            running = false;
            setPaused(true);
            unsubscribe();
            unsubscribe = () => {};
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            running = false;
            setPaused(true);
            unsubscribe();
            unsubscribe = () => {};
            track = null;
        },
    };
};
