/** Render local date and time with one aligned timer and explicit teardown. */

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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

/**
 * Create a local clock enhancement.
 *
 * @param {object} args Named arguments.
 * @param {HTMLElement} args.dateElement Date output element.
 * @param {HTMLElement} args.timeElement Time output element.
 * @param {Document} [args.document] Document used for visibility changes.
 * @param {Function} [args.now] Function returning the current millisecond time.
 * @param {{setTimeout: Function, clearTimeout: Function}} [args.scheduler]
 * @param {{isHidden: Function, onChange: Function}} [args.visibility]
 * @returns {{start: Function, stop: Function, destroy: Function}}
 */
export const createClock = ({
    dateElement,
    timeElement,
    document: documentRef = globalThis.document,
    now = () => Date.now(),
    scheduler = defaultScheduler,
    visibility = createVisibility(documentRef),
} = {}) => {
    if (
        !dateElement ||
        !timeElement ||
        !('textContent' in dateElement) ||
        !('textContent' in timeElement)
    ) {
        throw new TypeError('dateElement and timeElement are required');
    }
    assertFunction(now, 'now');
    assertFunction(scheduler.setTimeout, 'scheduler.setTimeout');
    assertFunction(scheduler.clearTimeout, 'scheduler.clearTimeout');
    assertFunction(visibility.isHidden, 'visibility.isHidden');
    assertFunction(visibility.onChange, 'visibility.onChange');

    let timerId = null;
    let running = false;
    let destroyed = false;
    let unsubscribe = () => {};

    const clearTimer = () => {
        if (timerId !== null) scheduler.clearTimeout(timerId);
        timerId = null;
    };

    const render = () => {
        const current = new Date(now());
        if (Number.isNaN(current.getTime())) {
            throw new Error('clock received an invalid date');
        }

        const hours = String(current.getHours()).padStart(2, '0');
        const minutes = String(current.getMinutes()).padStart(2, '0');
        const seconds = String(current.getSeconds()).padStart(2, '0');
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateValue = `${year}-${month}-${day}`;

        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
        timeElement.dateTime = `${dateValue}T${hours}:${minutes}:${seconds}`;
        dateElement.textContent = `${dateValue} ${WEEKDAYS[current.getDay()]}`;
        dateElement.dateTime = dateValue;
    };

    const scheduleNext = () => {
        clearTimer();
        if (destroyed || !running || visibility.isHidden()) return;

        const milliseconds = Math.max(1, 1000 - (now() % 1000));
        timerId = scheduler.setTimeout(() => {
            timerId = null;
            if (destroyed || !running) return;
            render();
            scheduleNext();
        }, milliseconds);
    };

    const handleVisibilityChange = () => {
        if (destroyed || !running) return;
        if (visibility.isHidden()) {
            clearTimer();
            return;
        }
        render();
        scheduleNext();
    };

    return {
        start() {
            if (destroyed || running) return;
            running = true;
            unsubscribe = visibility.onChange(handleVisibilityChange);
            render();
            scheduleNext();
        },
        stop() {
            if (destroyed || !running) return;
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
