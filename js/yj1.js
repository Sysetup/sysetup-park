(() => {

    // Initialize components
    const init = () => {
        updateClock();
        outputLogo();
        void fetchGeoData();
        void loadCodeBackground();
        displayRandomDescription();
        maybeLoadAnalytics();
    };

    // Generic typewriter engine: types a list of messages into an element one
    // character at a time with a human-like, slightly irregular rhythm, pauses
    // so each message can be read, erases quickly, then moves to the next one,
    // looping forever.
    //
    // DOM writes are append-only spans while typing, so the layout engine
    // never re-processes already-typed text (unlike `textContent +=`).
    // All timers pause with the tab via the visibilitychange listener, so the
    // effect never drifts or bursts after the tab is hidden.
    // Typing rhythm: base speed of a fast typist (~130 wpm), with jitter,
    // slower starts after a hold, brief hesitations on punctuation/space, and
    // occasional short bursts of extra speed. Erasing stays brisk.
    const TYPE_CHAR_MS = 52;
    const ERASE_CHAR_MS = 18;

    // Returns a natural-feeling delay before typing the next character.
    // `previous` is the char just typed; `next` is the upcoming one.
    const humanTypingDelay = (previous, next) => {
        let delay = TYPE_CHAR_MS + (Math.random() - 0.5) * 34; // ±17 ms jitter
        // Slow down slightly right after a long hold or message start.
        if (previous === "") delay *= 1.9;
        // Hesitate a touch after sentence punctuation and before spaces.
        if (".:!?".includes(previous)) delay += 140 + Math.random() * 160;
        else if (",;".includes(previous)) delay += 70 + Math.random() * 90;
        else if (previous === " ") delay += 25 + Math.random() * 45;
        // Occasional short burst of speed (~15% of keystrokes).
        if (Math.random() < 0.15) delay *= 0.45;
        // Rare moment of doubt before an uppercase or digit-heavy token.
        if (/[A-Z0-9]/.test(next) && Math.random() < 0.08) delay += 220 + Math.random() * 260;
        return Math.max(28, Math.round(delay));
    };

    const startTypewriter = (element, messages, holdMs) => {
        if (!element || !messages.length) return;

        const typedSpan = document.createElement("span");
        element.textContent = "";
        element.appendChild(typedSpan);

        let timerId = 0;
        let messageIndex = 0;
        let charIndex = 0;
        let state = "typing";
        let previousChar = "";

        const step = () => {
            if (state === "typing") {
                const message = messages[messageIndex];
                const char = message[charIndex];
                typedSpan.textContent += char;
                previousChar = char;
                charIndex += 1;
                if (charIndex < message.length) {
                    timerId = setTimeout(step, humanTypingDelay(previousChar, message[charIndex]));
                } else {
                    state = "holding";
                    timerId = setTimeout(step, holdMs);
                }
                return;
            }
            if (state === "holding") {
                state = "erasing";
                timerId = setTimeout(step, ERASE_CHAR_MS);
                return;
            }
            // Erasing.
            const text = typedSpan.textContent;
            if (text) {
                typedSpan.textContent = text.slice(0, -1);
                timerId = setTimeout(step, ERASE_CHAR_MS);
                return;
            }
            messageIndex = (messageIndex + 1) % messages.length;
            charIndex = 0;
            previousChar = "";
            state = "typing";
            timerId = setTimeout(step, TYPE_CHAR_MS);
        };

        const clearTimer = () => {
            if (timerId) clearTimeout(timerId);
            timerId = 0;
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                clearTimer();
            } else {
                clearTimer();
                timerId = setTimeout(step, humanTypingDelay(previousChar, messages[messageIndex]?.[charIndex] ?? ""));
            }
        });

        timerId = setTimeout(step, humanTypingDelay("", messages[0]?.[0] ?? ""));
    };

    // Fisher-Yates shuffle; keeps the typed message cycles fresh.
    const shuffleArray = (array) => {
        for (let index = array.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
        }
        return array;
    };

    // Clock functionality
    const updateClock = () => {
        const timeElement = document.querySelector(".time");
        const dateElement = document.querySelector(".date");
        if (!timeElement || !dateElement) return;

        const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const padNumber = (num, places) => String(num).padStart(places, "0");

        const updateTime = () => {
            const now = new Date();
            const hours = padNumber(now.getHours(), 2);
            const minutes = padNumber(now.getMinutes(), 2);
            const seconds = padNumber(now.getSeconds(), 2);
            const year = now.getFullYear();
            const month = padNumber(now.getMonth() + 1, 2);
            const day = padNumber(now.getDate(), 2);
            const weekday = weekdays[now.getDay()];

            timeElement.textContent = `${hours}:${minutes}:${seconds}`;
            dateElement.textContent = `${year}-${month}-${day} ${weekday}`;
        };

        updateTime();
        setInterval(updateTime, 1000);
    };

    // ASCII art console output
    const outputLogo = () => {
        console.info(
            "   ____             __\n" +
            "  / __/_ _____ ___ / /___ _____ _/|\n" +
            " _\\ \\/ // (_-</ -_) __/ // / _ > _<\n" +
            "/___/\\_, /___/\\__/\\__/\\_,_/ .__//\n" +
            "    /___/                /_/       \n" +
            "> Systems development company."
        );
    };

    // Visitor connection info for the footer. Lookup priority:
    //   1. Same-origin Cloudflare Worker (/api/geo, request.cf fields).
    //   2. GeoJS (https://get.geojs.io) as a keyless third-party fallback.
    //   3. Local, tracker-free summary when no remote source answers.
    // GetGeoAPI and its browser key were removed entirely (RF-001/RF-002).
    const GEO_WORKER_PATH = "/api/geo";
    const GEOJS_URL = "https://get.geojs.io/v1/ip/geo.json";
    const GEO_TIMEOUT_MS = 4000;

    const fetchJsonBounded = async (url, { allowCrossOrigin = false } = {}) => {
        const resolved = new URL(url, window.location.href);
        if (!allowCrossOrigin && resolved.origin !== window.location.origin) {
            throw new Error(`refusing cross-origin fetch: ${resolved.origin}`);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
        try {
            const response = await fetch(resolved.href, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            const text = await response.text();
            if (text.length > 8192) {
                throw new Error("geo payload exceeds 8 KiB cap");
            }
            return JSON.parse(text);
        } finally {
            clearTimeout(timer);
        }
    };

    const pickField = (value) =>
        typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "";

    // Builds the rotating footer messages typed one after another.
    const buildGeoMessages = ({ ip, city, region, country, timezone, network }) => {
        const location = [city, region, country].filter(Boolean).join(", ");
        const messages = [];
        if (ip) messages.push(`IP address: ${ip}`);
        if (location) messages.push(`Location: ${location}`);
        if (network) messages.push(`Network: ${network}`);
        if (timezone) messages.push(`Time zone: ${timezone}`);
        return messages;
    };

    const CONNECTIONS_HOLD_MS = 2600;

    const fetchGeoData = async () => {
        const connectionsElement = document.getElementById("connections");
        if (!connectionsElement) return;

        const typeMessages = (messages) => {
            const filtered = messages.filter(Boolean);
            if (!filtered.length) return;
            startTypewriter(connectionsElement, shuffleArray(filtered), CONNECTIONS_HOLD_MS);
        };

        // 1) Cloudflare Worker (same-origin; request.cf on every plan).
        try {
            const data = await fetchJsonBounded(GEO_WORKER_PATH);
            const messages = buildGeoMessages({
                ip: pickField(data && data.ip),
                city: pickField(data && data.city),
                region: pickField(data && data.region),
                country: pickField(data && data.country),
                timezone: pickField(data && data.timezone),
                network: pickField(data && data.network),
            });
            if (messages.length) {
                typeMessages(messages);
                return;
            }
        } catch (error) {
            console.info("Geo worker unavailable; trying GeoJS fallback.", error.message);
        }

        // 2) GeoJS fallback (no API key required).
        try {
            const data = await fetchJsonBounded(GEOJS_URL, { allowCrossOrigin: true });
            const organization = pickField(data && data.organization);
            const rawAsn = data && data.asn;
            const asn =
                typeof rawAsn === "number" && Number.isInteger(rawAsn) && rawAsn > 0
                    ? String(rawAsn)
                    : pickField(rawAsn).replace(/^AS/i, "");
            const messages = buildGeoMessages({
                ip: pickField(data && data.ip),
                city: pickField(data && data.city),
                region: pickField(data && data.region),
                country: pickField(data && data.country),
                timezone: pickField(data && data.timezone),
                network: asn ? `AS${asn}${organization ? ` ${organization}` : ""}` : organization,
            });
            if (messages.length) {
                typeMessages(messages);
                return;
            }
        } catch (error) {
            console.info("GeoJS fallback unavailable; using local info.", error.message);
        }

        // 3) Local, tracker-free fallback.
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
        const language = navigator.language || "unknown";
        typeMessages([`Locale: ${language}`, `Time zone: ${timeZone}`]);
    };

    // Bounded same-origin text fetch used for the background snapshot.
    const fetchLocalText = async (url, maxBytes, timeoutMs) => {
        const resolved = new URL(url, window.location.href);
        if (resolved.origin !== window.location.origin) {
            throw new Error(`refusing cross-origin fetch: ${resolved.origin}`);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(resolved.href, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            const declared = Number(response.headers.get("content-length") || 0);
            if (declared > maxBytes) {
                throw new Error(`snapshot exceeds ${maxBytes} bytes`);
            }
            const text = await response.text();
            if (text.length > maxBytes) {
                throw new Error(`snapshot exceeds ${maxBytes} bytes`);
            }
            return text;
        } finally {
            clearTimeout(timer);
        }
    };

    // Load the finite, build-time generated code background snapshot.
    // Generate it with: node scripts/build-background.mjs
    const loadCodeBackground = async () => {
        const backgroundElement = document.getElementById("background");
        if (!backgroundElement) return;

        let snapshotHtml;
        try {
            snapshotHtml = await fetchLocalText("js/generated/background.html", 1024 * 1024, 5000);
        } catch (error) {
            console.info(
                "Background snapshot not available. Run `node scripts/build-background.mjs` to generate it.",
                error.message
            );
            return;
        }

        const template = document.createElement("template");
        template.innerHTML = snapshotHtml;
        const snapshot = template.content.querySelector("#background-snapshot");
        if (!snapshot) {
            console.error("Background snapshot is malformed: #background-snapshot not found.");
            return;
        }

        const blocks = snapshot.querySelectorAll(".code-block");
        if (!blocks.length) return;

        // Pre-highlighted snapshots need no runtime parsing. If the operator
        // chose a plain snapshot, re-use the per-file language recorded by the
        // generator (data-lang) and fall back to text-only when Highlight.js
        // is not loaded; highlightAuto is never used on unbounded content.
        if (snapshot.dataset.highlighted !== "true") {
            const canHighlight =
                typeof hljs !== "undefined" && typeof hljs.highlight === "function";
            blocks.forEach((block) => {
                const lang = block.dataset.lang;
                if (!canHighlight || !lang || !hljs.getLanguage(lang)) return;
                try {
                    block.innerHTML = hljs.highlight(block.textContent, { language: lang }).value;
                } catch (error) {
                    // Keep the escaped text block on any parser failure.
                }
            });
        }

        // Append the snapshot content twice so the smooth scroll can wrap
        // seamlessly. A div wrapper avoids nesting <pre> inside the target
        // <code> element.
        backgroundElement.innerHTML = "";
        const firstPass = document.createElement("div");
        Array.from(snapshot.childNodes).forEach((node) => {
            firstPass.appendChild(document.importNode(node, true));
        });
        backgroundElement.appendChild(firstPass);
        if (!prefersReducedMotion()) {
            const secondPass = document.importNode(firstPass, true);
            secondPass.setAttribute("aria-hidden", "true");
            backgroundElement.appendChild(secondPass);
        }
        setupSmoothScrolling(backgroundElement);
    };

    const prefersReducedMotion = () =>
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Setup smooth, continuous scrolling. The loop only runs while the tab is
    // visible, never runs under prefers-reduced-motion, and wraps over the
    // first copy of the duplicated snapshot (RF-005 lifecycle).
    const setupSmoothScrolling = (backgroundElement) => {
        if (prefersReducedMotion()) return;

        const passes = backgroundElement.children;
        if (passes.length < 2) return;
        const loopHeight = passes[0].offsetHeight;
        if (loopHeight <= 0) return;

        // CSS pixels advanced per second; keeps the calm drift of the
        // previous 11px-per-frame loop (~1 line/s at 60fps).
        const pixelsPerSecond = 165;
        let scrollPos = 0;
        let lastTimestamp = null;
        let rafId = 0;
        let running = false;

        const step = (timestamp) => {
            if (!running) return;
            if (lastTimestamp === null) lastTimestamp = timestamp;
            const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;
            scrollPos = (scrollPos + pixelsPerSecond * deltaSeconds) % loopHeight;
            backgroundElement.scrollTop = scrollPos;
            rafId = requestAnimationFrame(step);
        };

        const start = () => {
            if (running || prefersReducedMotion()) return;
            running = true;
            lastTimestamp = null;
            rafId = requestAnimationFrame(step);
        };

        const stop = () => {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                stop();
            } else {
                start();
            }
        });

        start();
    };

    // Type shuffled marketing descriptions into the hero, holding each one
    // long enough to be read and absorbed before erasing it.
    const displayRandomDescription = () => {
        const descriptions = [
            "Analyzing requirements to architect robust software and system solutions.",
            "Designing scalable systems with lifecycle-focused logistics integration.",
            "Developing custom software aligned to operational and business needs.",
            "Implementing secure, maintainable platforms with continuous improvement.",
            "Maintaining system integrity through proactive monitoring and updates.",
            "Orchestrating end-to-end system delivery from spec through production.",
            "Driving efficiency via data-driven analysis and process optimization.",
            "Engineering resilient architectures with modular, maintainable components.",
            "Integrating software and logistics workflows for seamless operations.",
            "Translating complex needs into detailed design and implementation plans.",
            "Delivering turnkey solutions covering dev, deploy, and long-term support.",
            "Managing full-cycle projects: analysis, design, dev, deploy, maintenance.",
            "Aligning systems development to SLA-driven maintenance and reliability.",
            "Optimizing system logistics with automated deployment and versioning.",
            "Delivering professional-grade solutions with 24/7 operational readiness.",
            "Ensuring continuity via structured testing, rollout, and support cycles.",
            "Bridging analysis to operations with clear design and maintenance docs.",
            "Coordinating cross-functional teams for system planning and upkeep.",
            "Streamlining deployments with config management and runbook automation.",
            "Sustaining performance through lifecycle governance and audits."
        ];

        const descriptionElement = document.getElementById("description");
        if (!descriptionElement || !descriptions.length) return;

        startTypewriter(descriptionElement, shuffleArray(descriptions), 8000);
    };

    // Consent-based analytics: the Google tag is never loaded automatically.
    // The visitor is asked once; the answer is persisted in localStorage.
    const GA_MEASUREMENT_ID = "G-H8812EY8KQ";
    const GA_CONSENT_KEY = "sysetup.analytics-consent";

    const maybeLoadAnalytics = () => {
        let consent = null;
        try {
            consent = localStorage.getItem(GA_CONSENT_KEY);
        } catch (error) {
            return;
        }

        if (consent === "granted") {
            loadAnalytics();
            return;
        }
        if (consent === "denied") return;

        const granted = window.confirm(
            "Allow anonymous usage analytics (Google Analytics)? You can change this by clearing site data."
        );
        try {
            localStorage.setItem(GA_CONSENT_KEY, granted ? "granted" : "denied");
        } catch (error) {
            // Consent persistence unavailable; respect the in-memory choice.
        }
        if (granted) loadAnalytics();
    };

    const loadAnalytics = () => {
        window.dataLayer = window.dataLayer || [];
        const gtag = (...args) => window.dataLayer.push(args);
        window.gtag = gtag;

        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
        document.head.appendChild(script);

        gtag("js", new Date());
        gtag("config", GA_MEASUREMENT_ID);
    };

    // Start the application
    init();
})();
