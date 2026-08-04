import assert from 'node:assert/strict';
import test from 'node:test';

import outputLogo from '../js/modules/console-logo.js';
import {
    GEOJS_URL,
    GEO_WORKER_URL,
    buildGeolocationMessages,
    loadGeolocationMessages,
} from '../js/modules/load-geolocation.js';

const createResponse = (data, ok = true) => ({
    ok,
    status: ok ? 200 : 503,
    text: async () => JSON.stringify(data),
});

test('outputs the exact console logo message', () => {
    const messages = [];
    outputLogo({ info: (message) => messages.push(message) });

    const expectedLogoTrailingPadding = '       ';
    const expectedLogo = [
        '   ____             __',
        '  / __/_ _____ ___ / /___ _____ _/|',
        String.raw` _\ \/ // (_-</ -_) __/ // / _ > _<`,
        String.raw`/___/\_, /___/\__/\__/\_,_/ .__//`,
        `    /___/                /_/${expectedLogoTrailingPadding}`,
        '> Systems development company.',
    ].join('\n');

    assert.deepEqual(messages, [expectedLogo]);
});

test('uses GeoJS as the primary geolocation endpoint', async () => {
    const calls = [];
    const messages = await loadGeolocationMessages({
        fetchImpl: async (url) => {
            calls.push(url);
            return createResponse({
                asn: 12345,
                city: 'Bogota',
                country: 'Colombia',
                ip: '198.51.100.10',
                organization: 'Example Network',
                region: 'Bogota D.C.',
                timezone: 'America/Bogota',
            });
        },
    });

    assert.deepEqual(calls, [GEOJS_URL]);
    assert.deepEqual(messages, [
        'IP address: 198.51.100.10',
        'City: Bogota',
        'Region: Bogota D.C.',
        'Country: Colombia',
        'Time zone: America/Bogota',
        'Network: AS12345 Example Network',
    ]);
});

test('uses the Worker when GeoJS does not provide usable data', async () => {
    const calls = [];
    const messages = await loadGeolocationMessages({
        fetchImpl: async (url) => {
            calls.push(url);
            if (url === GEOJS_URL) return createResponse({}, false);
            return createResponse({ city: 'Medellin', country: 'Colombia' });
        },
    });

    assert.deepEqual(calls, [GEOJS_URL, GEO_WORKER_URL]);
    assert.deepEqual(messages, ['City: Medellin', 'Country: Colombia']);
});

test('normalizes supported fields and ignores unsupported fields', () => {
    const messages = buildGeolocationMessages({
        city: '  Bogota\n<script>  ',
        country: 'Colombia',
        latitude: '4.711',
        organization: 'Example Network',
    });

    assert.deepEqual(messages, [
        'City: Bogota <script>',
        'Country: Colombia',
        'Network: Example Network',
    ]);
});
