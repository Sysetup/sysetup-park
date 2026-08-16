/** Render decorative messages with a small, lifecycle-safe state machine. */

const TYPE_CHAR_MS = 68;
const ERASE_CHAR_MS = 18;
const MIN_TYPE_DELAY_MS = 32;

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

/**
 * Return a natural-feeling delay before the next character.
 *
 * @param {string} previous Character just rendered.
 * @param {string} next Character about to be rendered.
 * @param {Function} [random] Function returning a number between zero and one.
 * @returns {number} Delay in milliseconds.
 */
export const humanTypingDelay = (previous, next, random = Math.random) => {
    assertFunction(random, 'random');
    let delay = TYPE_CHAR_MS + (boundedRandom(random) - 0.5) * 24;
    const nextCharacter = typeof next === 'string' ? next : '';

    if (previous === '') delay += 120 + boundedRandom(random) * 140;
    if (nextCharacter === ' ') delay += 30 + boundedRandom(random) * 45;
    if (previous === ' ') delay += 35 + boundedRandom(random) * 65;
    if ('.:!?'.includes(previous)) {
        delay += 180 + boundedRandom(random) * 180;
    } else if (',;'.includes(previous)) {
        delay += 80 + boundedRandom(random) * 110;
    }
    if (boundedRandom(random) < 0.08) {
        delay += 180 + boundedRandom(random) * 300;
    }
    if (boundedRandom(random) < 0.12) delay *= 0.55;
    if (/[A-Z0-9]/.test(nextCharacter) && boundedRandom(random) < 0.08) {
        delay += 180 + boundedRandom(random) * 240;
    }
    return Math.max(MIN_TYPE_DELAY_MS, Math.round(delay));
};

/**
 * Return a shuffled copy of a message list.
 *
 * @param {string[]} messages Messages to shuffle.
 * @param {Function} [random] Function returning a number between zero and one.
 * @returns {string[]} Shuffled copy.
 */
export const shuffleMessages = (messages, random = Math.random) => {
    if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        messages.some((message) => typeof message !== 'string')
    ) {
        throw new TypeError('messages must be a non-empty array of strings');
    }
    assertFunction(random, 'random');
    const shuffled = [...messages];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(boundedRandom(random) * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [
            shuffled[swapIndex],
            shuffled[index],
        ];
    }
    return shuffled;
};

/**
 * Create the decorative typewriter enhancement.
 *
 * @param {HTMLElement} element Target output element.
 * @param {string[]} messages Non-empty message list.
 * @param {object} [options] Timing and lifecycle options.
 * @returns {{start: Function, pause: Function, resume: Function, destroy: Function}}
 */
export const createTypewriter = (element, messages, options = {}) => {
    if (!element || !('textContent' in element)) {
        throw new TypeError('element must be a DOM element');
    }
    if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        messages.some(
            (message) => typeof message !== 'string' || message.length === 0
        )
    ) {
        throw new TypeError(
            'messages must be a non-empty array of non-empty strings'
        );
    }

    const {
        holdMs = 2600,
        changeIntervalMs = 0,
        document: documentRef = globalThis.document,
        scheduler = defaultScheduler,
        random = Math.random,
        visibility = createVisibility(documentRef),
        now = () => globalThis.performance?.now?.() ?? Date.now(),
        reducedMotion = false,
        advanceOnInteraction = false,
        onStateChange = null,
    } = options;

    for (const [name, value] of [
        ['holdMs', holdMs],
        ['changeIntervalMs', changeIntervalMs],
    ]) {
        if (!Number.isFinite(value) || value < 0) {
            throw new TypeError(`${name} must be a non-negative number`);
        }
    }
    if (typeof advanceOnInteraction !== 'boolean') {
        throw new TypeError('advanceOnInteraction must be a boolean');
    }
    if (
        advanceOnInteraction &&
        (typeof element.addEventListener !== 'function' ||
            typeof element.removeEventListener !== 'function')
    ) {
        throw new TypeError(
            'element must support events when interaction is enabled'
        );
    }
    assertFunction(scheduler.setTimeout, 'scheduler.setTimeout');
    assertFunction(scheduler.clearTimeout, 'scheduler.clearTimeout');
    assertFunction(random, 'random');
    assertFunction(now, 'now');
    assertFunction(visibility.isHidden, 'visibility.isHidden');
    assertFunction(visibility.onChange, 'visibility.onChange');
    if (onStateChange !== null) {
        assertFunction(onStateChange, 'onStateChange');
    }

    const outputElement = element;
    const usesFixedChangeInterval = changeIntervalMs > 0;
    let timerId = null;
    let messageIndex = 0;
    let charIndex = 0;
    let state = 'typing';
    let previousChar = '';
    let nextMessageAt = 0;
    let hiddenAt = null;
    let started = false;
    let paused = false;
    let destroyed = false;
    let unsubscribe = () => {};
    let unsubscribeInteraction = () => {};

    /** Allow manual advancement only after the current message is complete. */
    const isInteractionReady = () =>
        !destroyed &&
        started &&
        !paused &&
        (reducedMotion || state === 'holding');

    /** Keep the interaction state exposed to assistive technology. */
    const updateInteractionState = () => {
        if (
            !advanceOnInteraction ||
            typeof outputElement.setAttribute !== 'function'
        ) {
            return;
        }
        outputElement.setAttribute(
            'aria-disabled',
            String(!isInteractionReady())
        );
    };

    const changeState = (nextState) => {
        state = nextState;
        updateInteractionState();
        if (typeof onStateChange === 'function') {
            onStateChange(state, outputElement);
        }
    };

    const clearTimer = () => {
        if (timerId !== null) scheduler.clearTimeout(timerId);
        timerId = null;
    };

    const getDelayUntilNextMessage = () => Math.max(0, nextMessageAt - now());

    const getDelayForCurrentState = () => {
        const message = messages[messageIndex];
        if (state === 'typing') {
            const isStartingMessage =
                charIndex === 0 && element.textContent === '';
            if (usesFixedChangeInterval && isStartingMessage && nextMessageAt) {
                return getDelayUntilNextMessage();
            }
            return humanTypingDelay(
                previousChar,
                message[charIndex] ?? '',
                random
            );
        }
        if (state === 'holding') {
            if (!usesFixedChangeInterval) return holdMs;
            const eraseDuration =
                (element.textContent.length + 1) * ERASE_CHAR_MS;
            return Math.max(0, getDelayUntilNextMessage() - eraseDuration);
        }
        return ERASE_CHAR_MS;
    };

    function schedule(delay) {
        clearTimer();
        if (
            destroyed ||
            paused ||
            !started ||
            reducedMotion ||
            visibility.isHidden()
        ) {
            return;
        }
        timerId = scheduler.setTimeout(step, Math.max(0, Math.round(delay)));
    }

    /** Skip the current message and restart the next message from its first character. */
    function advanceToNextMessage() {
        if (destroyed || !started) return;

        clearTimer();
        messageIndex = (messageIndex + 1) % messages.length;
        charIndex = 0;
        previousChar = '';
        nextMessageAt = 0;
        outputElement.textContent = reducedMotion ? messages[messageIndex] : '';
        changeState(reducedMotion ? 'holding' : 'typing');

        if (!reducedMotion) {
            schedule(humanTypingDelay('', messages[messageIndex][0], random));
        }
    }

    function step() {
        timerId = null;
        if (destroyed || paused || visibility.isHidden()) return;

        const message = messages[messageIndex];
        if (state === 'typing') {
            const isStartingMessage =
                charIndex === 0 && element.textContent === '';
            if (usesFixedChangeInterval && isStartingMessage) {
                const currentTime = now();
                if (nextMessageAt > currentTime) {
                    schedule(nextMessageAt - currentTime);
                    return;
                }
                nextMessageAt = currentTime + changeIntervalMs;
            }

            const character = message[charIndex];
            element.textContent += character;
            previousChar = character;
            charIndex += 1;
            if (charIndex < message.length) {
                schedule(
                    humanTypingDelay(previousChar, message[charIndex], random)
                );
            } else {
                changeState('holding');
                schedule(getDelayForCurrentState());
            }
            return;
        }

        if (state === 'holding') {
            changeState('erasing');
            schedule(ERASE_CHAR_MS);
            return;
        }

        if (element.textContent.length > 0) {
            element.textContent = element.textContent.slice(0, -1);
            schedule(ERASE_CHAR_MS);
            return;
        }

        messageIndex = (messageIndex + 1) % messages.length;
        charIndex = 0;
        previousChar = '';
        changeState('typing');
        schedule(
            usesFixedChangeInterval
                ? getDelayUntilNextMessage()
                : humanTypingDelay('', messages[messageIndex][0], random)
        );
    }

    const handleVisibilityChange = () => {
        if (visibility.isHidden()) {
            hiddenAt = now();
            clearTimer();
            return;
        }

        if (hiddenAt !== null && usesFixedChangeInterval) {
            nextMessageAt += now() - hiddenAt;
        }
        hiddenAt = null;
        if (!paused) schedule(getDelayForCurrentState());
    };

    const handleInteraction = () => {
        if (!isInteractionReady()) return;
        advanceToNextMessage();
    };

    return {
        start() {
            if (destroyed || started) return;
            started = true;
            if (advanceOnInteraction) {
                element.addEventListener('click', handleInteraction);
                unsubscribeInteraction = () =>
                    element.removeEventListener('click', handleInteraction);
            }
            if (reducedMotion) {
                element.textContent = messages[0];
                changeState('holding');
                return;
            }
            element.textContent = '';
            changeState('typing');
            unsubscribe = visibility.onChange(handleVisibilityChange);
            schedule(humanTypingDelay('', messages[0][0], random));
        },
        pause() {
            if (destroyed || paused || reducedMotion) return;
            paused = true;
            clearTimer();
            updateInteractionState();
        },
        resume() {
            if (destroyed || !paused || reducedMotion) return;
            paused = false;
            updateInteractionState();
            schedule(getDelayForCurrentState());
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            updateInteractionState();
            clearTimer();
            unsubscribe();
            unsubscribe = () => {};
            unsubscribeInteraction();
            unsubscribeInteraction = () => {};
        },
    };
};
