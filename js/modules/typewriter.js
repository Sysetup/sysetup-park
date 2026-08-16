/** Render decorative messages with a small, lifecycle-safe state machine. */

const TYPE_CHAR_MS = 34;
const ERASE_CHAR_MS = 24;
const TYPE_VARIATION_MS = 8;
const FIRST_CHARACTER_PAUSE_MS = 80;
const WORD_BOUNDARY_PAUSE_MS = 12;
const CLAUSE_PAUSE_MS = 48;
const SENTENCE_PAUSE_MS = 92;
const MIN_TYPE_DELAY_MS = 24;
const SHIMMER_CHARACTER_STEP_MS = 34;
const SHIMMER_WORD_PAUSE_MS = 72;
const SHIMMER_REST_MS = 7000;
const SHIMMER_LIGHT_END_RATIO = 0.1;
const SHIMMER_CHARACTER_CLASS = 'typewriter-character';
const SHIMMER_WORD_CLASS = 'typewriter-word';

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
 * Prepare the completed message for a chronological character shimmer.
 *
 * @param {HTMLElement} element Typewriter output element.
 * @param {Document} documentRef Document used to create safe text nodes.
 * @returns {void}
 */
const prepareShimmerText = (element, documentRef) => {
    const ownerDocument = element.ownerDocument ?? documentRef;
    if (
        !ownerDocument ||
        typeof ownerDocument.createDocumentFragment !== 'function' ||
        typeof ownerDocument.createElement !== 'function' ||
        typeof ownerDocument.createTextNode !== 'function' ||
        typeof element.replaceChildren !== 'function'
    ) {
        return;
    }

    const tokens = (element.textContent ?? '').match(/\s+|\S+/gu) ?? [];
    const fragment = ownerDocument.createDocumentFragment();
    let characterIndex = 0;
    let wordIndex = 0;

    tokens.forEach((token) => {
        if (/^\s+$/u.test(token)) {
            fragment.append(ownerDocument.createTextNode(token));
            return;
        }

        const wordElement = ownerDocument.createElement('span');
        wordElement.className = SHIMMER_WORD_CLASS;

        Array.from(token).forEach((character) => {
            const characterElement = ownerDocument.createElement('span');
            const delayMs =
                characterIndex * SHIMMER_CHARACTER_STEP_MS +
                wordIndex * SHIMMER_WORD_PAUSE_MS;

            characterElement.className = SHIMMER_CHARACTER_CLASS;
            characterElement.textContent = character;
            characterElement.style.setProperty(
                '--shimmer-delay',
                `${delayMs}ms`
            );
            wordElement.append(characterElement);
            characterIndex += 1;
        });

        fragment.append(wordElement);
        wordIndex += 1;
    });

    const lastDelayMs =
        characterIndex > 0
            ? (characterIndex - 1) * SHIMMER_CHARACTER_STEP_MS +
              Math.max(wordIndex - 1, 0) * SHIMMER_WORD_PAUSE_MS
            : 0;
    const shimmerCycleMs = Math.ceil(
        (lastDelayMs + SHIMMER_REST_MS) / (1 - SHIMMER_LIGHT_END_RATIO)
    );

    element.style.setProperty('--shimmer-cycle', `${shimmerCycleMs}ms`);
    element.replaceChildren(fragment);
};

/**
 * Return a steady, readable delay before the next character.
 *
 * @param {string} previous Character just rendered.
 * @param {string} next Character about to be rendered.
 * @param {Function} [random] Function returning a number between zero and one.
 * @returns {number} Delay in milliseconds.
 */
export const humanTypingDelay = (previous, next, random = Math.random) => {
    assertFunction(random, 'random');
    let delay =
        TYPE_CHAR_MS + (boundedRandom(random) - 0.5) * TYPE_VARIATION_MS;
    const nextCharacter = typeof next === 'string' ? next : '';

    if (previous === '') delay += FIRST_CHARACTER_PAUSE_MS;
    if (nextCharacter === ' ') delay += WORD_BOUNDARY_PAUSE_MS;
    if ('.:!?'.includes(previous)) {
        delay += SENTENCE_PAUSE_MS;
    } else if (',;'.includes(previous)) {
        delay += CLAUSE_PAUSE_MS;
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

    [
        ['holdMs', holdMs],
        ['changeIntervalMs', changeIntervalMs],
    ].forEach(([name, value]) => {
        if (!Number.isFinite(value) || value < 0) {
            throw new TypeError(`${name} must be a non-negative number`);
        }
    });
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
    const [firstMessage] = messages;
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
                charIndex === 0 && outputElement.textContent === '';
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
                (outputElement.textContent.length + 1) * ERASE_CHAR_MS;
            return Math.max(0, getDelayUntilNextMessage() - eraseDuration);
        }
        return ERASE_CHAR_MS;
    };

    let schedule = () => {};

    /** Advance immediately only when reduced motion is active. */
    function advanceWithoutMotion() {
        if (destroyed || !started) return;

        clearTimer();
        messageIndex = (messageIndex + 1) % messages.length;
        charIndex = 0;
        previousChar = '';
        nextMessageAt = 0;
        outputElement.textContent = messages[messageIndex];
        changeState('holding');
    }

    /** Start the shared erase phase for autonomous and interactive transitions. */
    function beginErasing() {
        if (
            destroyed ||
            !started ||
            paused ||
            reducedMotion ||
            state !== 'holding'
        ) {
            return;
        }

        clearTimer();
        changeState('erasing');
        schedule(ERASE_CHAR_MS);
    }

    const step = () => {
        timerId = null;
        if (destroyed || paused || visibility.isHidden()) return;

        const message = messages[messageIndex];
        if (state === 'typing') {
            const isStartingMessage =
                charIndex === 0 && outputElement.textContent === '';
            if (usesFixedChangeInterval && isStartingMessage) {
                const currentTime = now();
                if (nextMessageAt > currentTime) {
                    schedule(nextMessageAt - currentTime);
                    return;
                }
                nextMessageAt = currentTime + changeIntervalMs;
            }

            const character = message[charIndex];
            outputElement.textContent += character;
            previousChar = character;
            charIndex += 1;
            if (charIndex < message.length) {
                schedule(
                    humanTypingDelay(previousChar, message[charIndex], random)
                );
            } else {
                prepareShimmerText(outputElement, documentRef);
                changeState('holding');
                schedule(getDelayForCurrentState());
            }
            return;
        }

        if (state === 'holding') {
            beginErasing();
            return;
        }

        if (outputElement.textContent.length > 0) {
            outputElement.textContent = outputElement.textContent.slice(0, -1);
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
    };

    schedule = (delay) => {
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
    };

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
        if (reducedMotion) {
            advanceWithoutMotion();
            return;
        }
        beginErasing();
    };

    return {
        start() {
            if (destroyed || started) return;
            started = true;
            if (advanceOnInteraction) {
                outputElement.addEventListener('click', handleInteraction);
                unsubscribeInteraction = () =>
                    outputElement.removeEventListener(
                        'click',
                        handleInteraction
                    );
            }
            if (reducedMotion) {
                outputElement.textContent = firstMessage;
                changeState('holding');
                return;
            }
            outputElement.textContent = '';
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
