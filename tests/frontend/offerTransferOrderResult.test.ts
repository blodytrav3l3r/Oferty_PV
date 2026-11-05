import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test.each([
    ['rury', 'RuryTransferJson', 'offerId'],
    ['studnie', 'StudnieTransferJson', 'offerStudnieId']
])(
    '%s reports partial import and preserves the new link when the order batch is rejected',
    async (kind, name, link) => {
        const offer = { id: 'source-offer', number: 'T1', wells: [], items: [] };
        const orders = [
            { id: 'o1', data: { offerId: 'stale-pipe', offerStudnieId: 'stale-well' } },
            { id: 'o2', data: { offerId: 'other-pipe', offerStudnieId: 'other-well' } }
        ];
        const fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ results: [{ id: 'new-offer' }] })
            })
            .mockResolvedValueOnce({ ok: false, status: 409 });
        const sandbox = {
            window: {} as Record<string, { importOffer(file: unknown): Promise<unknown> }>,
            JsonOfferTransfer: { readFile: async () => ({ offer, orders }) },
            XlsxImportShared: { getLoadedOffers: () => [] },
            fetch
        };
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/import-export', kind, 'transferJson.js'),
            'utf8'
        );
        vm.runInNewContext(source, sandbox);

        const result = await sandbox.window[name].importOffer({});
        expect(result).toMatchObject({ error: true, offerId: 'new-offer' });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toBe(`/api/orders-${kind}`);
        const payload = JSON.parse(fetch.mock.calls[1][1].body);
        expect(payload.data).toEqual([
            { id: 'o1', status: 'new', [link]: 'new-offer' },
            { id: 'o2', status: 'new', [link]: 'new-offer' }
        ]);
    }
);
