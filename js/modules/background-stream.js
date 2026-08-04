/** Render a bounded plain-text background stream with explicit teardown. */

const defaultScheduler = {
    setTimeout: (callback, milliseconds) =>
        globalThis.setTimeout(callback, milliseconds),
    clearTimeout: (timerId) => globalThis.clearTimeout(timerId),
};

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

const boundedRandom = (random) => {
    const value = Number(random());
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
};

/** Split text into lines while normalizing common line endings. */
export const splitBackgroundText = (text) => {
    if (typeof text !== 'string') {
        throw new TypeError('background text must be a string');
    }
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
};

/**
 * Create the decorative background stream.
 *
 * @param {HTMLElement} element Target output element.
 * @param {string} text Plain-text corpus.
 * @param {object} [options] Pacing and lifecycle options.
 * @returns {{start: Function, stop: Function, destroy: Function}}
 */
export const createBackgroundStream = (element, text, options = {}) => {
    if (!element || !('textContent' in element)) {
        throw new TypeError('element must be a DOM element');
    }

    const lines = splitBackgroundText(text);
    const {
        blockPauseMs = 480,
        burstEvery = 9,
        burstPauseMs = 900,
        document: documentRef = globalThis.document,
        lineDelayMaxMs = 130,
        lineDelayMinMs = 28,
        maxLinesKept = 90,
        maxLinesPerTick = 3,
        minLinesPerTick = 1,
        primeLines = 70,
        random = Math.random,
        reducedMotion = false,
        scheduler = defaultScheduler,
        visibility = createVisibility(documentRef),
    } = options;

    const numericOptions = [
        ['blockPauseMs', blockPauseMs],
        ['burstEvery', burstEvery],
        ['burstPauseMs', burstPauseMs],
        ['lineDelayMaxMs', lineDelayMaxMs],
        ['lineDelayMinMs', lineDelayMinMs],
        ['maxLinesKept', maxLinesKept],
        ['maxLinesPerTick', maxLinesPerTick],
        ['minLinesPerTick', minLinesPerTick],
        ['primeLines', primeLines],
    ];
    for (const [name, value] of numericOptions) {
        if (!Number.isFinite(value) || value < 0) {
            throw new TypeError(`${name} must be a non-negative number`);
        }
    }
    if (minLinesPerTick < 1 || maxLinesPerTick < minLinesPerTick) {
        throw new TypeError('line burst bounds are invalid');
    }
    if (lineDelayMaxMs < lineDelayMinMs || burstEvery < 1 || maxLinesKept < 1) {
        throw new TypeError('background pacing bounds are invalid');
    }
    assertFunction(random, 'random');
    assertFunction(scheduler.setTimeout, 'scheduler.setTimeout');
    assertFunction(scheduler.clearTimeout, 'scheduler.clearTimeout');
    assertFunction(visibility.isHidden, 'visibility.isHidden');
    assertFunction(visibility.onChange, 'visibility.onChange');

    const buffer = [];
    let lineIndex = 0;
    let tickCount = 0;
    let timerId = null;
    let running = false;
    let destroyed = false;
    let unsubscribe = () => {};

    const clearTimer = () => {
        if (timerId !== null) scheduler.clearTimeout(timerId);
        timerId = null;
    };

    const render = () => {
        element.textContent = buffer.join('\n');
    };

    const pushLines = (count) => {
        let startedNewBlock = false;
        for (let index = 0; index < count; index += 1) {
            const line = lines[lineIndex];
            if (line === '' && lines[(lineIndex + 1) % lines.length] !== '') {
                startedNewBlock = true;
            }
            buffer.push(line);
            lineIndex = (lineIndex + 1) % lines.length;
        }
        if (buffer.length > maxLinesKept) {
            buffer.splice(0, buffer.length - maxLinesKept);
        }
        return startedNewBlock;
    };

    const nextDelay = (startedNewBlock) => {
        tickCount += 1;
        let delay =
            lineDelayMinMs +
            boundedRandom(random) * (lineDelayMaxMs - lineDelayMinMs);
        if (startedNewBlock) {
            delay += blockPauseMs;
        } else if (tickCount % burstEvery === 0) {
            delay += burstPauseMs;
        }
        return Math.round(delay);
    };

    function schedule(delay) {
        clearTimer();
        if (!running || destroyed || visibility.isHidden()) return;
        timerId = scheduler.setTimeout(step, Math.max(0, Math.round(delay)));
    }

    function step() {
        timerId = null;
        if (!running || destroyed || visibility.isHidden()) return;
        const burst =
            minLinesPerTick +
            Math.floor(
                boundedRandom(random) *
                    (maxLinesPerTick - minLinesPerTick + 1)
            );
        const startedNewBlock = pushLines(burst);
        render();
        schedule(nextDelay(startedNewBlock));
    }

    const handleVisibilityChange = () => {
        if (!running) return;
        if (visibility.isHidden()) {
            clearTimer();
            return;
        }
        schedule(lineDelayMinMs);
    };

    return {
        start() {
            if (destroyed || running || lines.length === 0) return;
            if (reducedMotion) {
                element.textContent = lines.join('\n');
                return;
            }
            running = true;
            unsubscribe = visibility.onChange(handleVisibilityChange);
            pushLines(Math.min(Math.floor(primeLines), lines.length));
            render();
            schedule(lineDelayMinMs);
        },
        stop() {
            if (!running) return;
            running = false;
            clearTimer();
            unsubscribe();
            unsubscribe = () => {};
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            running = false;
            clearTimer();
            unsubscribe();
            unsubscribe = () => {};
        },
    };
};
