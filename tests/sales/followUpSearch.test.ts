import {
    parseSearchParams,
    buildFollowUpConditions,
    buildFollowUpOrderBy,
    buildOffersCountSql,
    followUpColumnsSql,
    mapOfferRow,
    RawOfferRow
} from '../../src/utils/searchUtils';
import { calculateFollowUpHealth } from '../../src/utils/followUpHealth';

// Mock wierny semantyce Prisma (kopía wzorca z datePresetSearch.test.ts).
jest.mock('../../generated/prisma', () => {
    const renderSql = (strings: any, values: any) => {
        if (strings && typeof strings === 'object' && strings.__prismaSql) {
            return strings.render();
        }
        let out = '';
        (strings || []).forEach((s: string, i: number) => {
            out += s;
            if (i < (values || []).length) {
                const v = values[i];
                out += v && typeof v === 'object' && v.__prismaSql ? v.render() : String(v);
            }
        });
        return out;
    };
    const makeSql = (strings: any, values: any) => ({
        __prismaSql: true,
        render: () => renderSql(strings, values)
    });
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => makeSql(strings, values);
    return {
        Prisma: {
            raw: (s: string) => makeSql([s], []),
            empty: makeSql([''], []),
            sql,
            join: (vals: unknown[], sep = ', ') =>
                makeSql(['', ...new Array(Math.max(vals.length - 1, 0)).fill(sep), ''], vals)
        }
    };
});

jest.mock('../../src/utils/fts5Sync', () => ({
    buildFts5Query: () => null
}));

const NOW = '2026-10-08T12:00:00.000Z';
const base = {
    followupStatus: 'all' as const,
    overdueOnly: false,
    nextContactFrom: '',
    nextContactTo: '',
    nowIso: NOW
};
const render = (conds: any[]): string =>
    conds.map((c) => (c && c.render ? c.render() : String(c))).join(' AND ');

describe('P0.4 parseSearchParams — nowe filtry', () => {
    it('domyslnie: followupStatus all, overdueOnly false, sort createdAt (regresja)', () => {
        const p = parseSearchParams({});
        expect(p.followupStatus).toBe('all');
        expect(p.overdueOnly).toBe(false);
        expect(p.nextContactFrom).toBe('');
        expect(p.nextContactTo).toBe('');
        expect(p.sort).toBe('createdAt');
    });

    it('akceptuje LOS i sort followup, odrzuca smieci', () => {
        expect(parseSearchParams({ followupStatus: 'needs_contact' }).followupStatus).toBe(
            'needs_contact'
        );
        expect(parseSearchParams({ followupStatus: 'won' }).followupStatus).toBe('won');
        expect(parseSearchParams({ followupStatus: 'XYZ' }).followupStatus).toBe('all');
        expect(parseSearchParams({ sort: 'followup' }).sort).toBe('followup');
        expect(parseSearchParams({ sort: 'DROP' }).sort).toBe('createdAt');
        expect(parseSearchParams({ overdueOnly: 'true' }).overdueOnly).toBe(true);
        expect(parseSearchParams({ overdueOnly: 'yes' }).overdueOnly).toBe(false);
        expect(parseSearchParams({ nextContactFrom: '2026-10-01' }).nextContactFrom).toBe(
            '2026-10-01'
        );
        expect(parseSearchParams({ nextContactFrom: 'nie-data' }).nextContactFrom).toBe('');
    });
});

describe('P0.4 followUpColumnsSql — latest, nie MAX', () => {
    it('rury: kind literal + latest ORDER BY contactedAt/createdAt', () => {
        const sql = (followUpColumnsSql('rury', 'o') as any).render() as string;
        expect(sql).toContain('"offerKind" = rury');
        expect(sql).toContain('ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1');
        expect(sql).toContain('"_fu_outcome"');
        expect(sql).toContain('"_fu_next"');
        expect(sql).toContain('"_fu_last"');
        expect(sql).not.toContain('MAX');
    });

    it('studnie: alias s + kind studnie', () => {
        const sql = (followUpColumnsSql('studnie', 's') as any).render() as string;
        expect(sql).toContain('"offerKind" = studnie');
        expect(sql).toContain('s.id');
    });
});

describe('P0.4 buildFollowUpConditions', () => {
    it('all bez flag: pusto (regresja — brak zmian w SQL)', () => {
        expect(buildFollowUpConditions(base)).toHaveLength(0);
    });

    it('won / lost', () => {
        expect(render(buildFollowUpConditions({ ...base, followupStatus: 'won' }))).toContain(
            `combined."_fu_outcome" = 'WON'`
        );
        const lost = render(buildFollowUpConditions({ ...base, followupStatus: 'lost' }));
        expect(lost).toContain('LOST_COMPETITION');
        expect(lost).toContain('LOST_OTHER');
        expect(lost).toContain('ABANDONED');
    });

    it('needs_contact: NULL-lub-OPEN i brak terminu lub termin miniony', () => {
        const sql = render(buildFollowUpConditions({ ...base, followupStatus: 'needs_contact' }));
        expect(sql).toContain(`combined."_fu_outcome" IS NULL OR combined."_fu_outcome" = 'OPEN'`);
        expect(sql).toContain(`combined."_fu_next" IS NULL OR combined."_fu_next" <= ${NOW}`);
    });

    it('in_progress: OPEN i termin w przyszlosci', () => {
        const sql = render(buildFollowUpConditions({ ...base, followupStatus: 'in_progress' }));
        expect(sql).toContain(`combined."_fu_outcome" = 'OPEN'`);
        expect(sql).toContain(`combined."_fu_next" > ${NOW}`);
    });

    it('overdueOnly: OPEN-lub-NULL i termin miniony (termin wymagany)', () => {
        const sql = render(buildFollowUpConditions({ ...base, overdueOnly: true }));
        expect(sql).toContain(`combined."_fu_next" <= ${NOW}`);
        expect(sql).not.toContain('combined."_fu_next" IS NULL');
    });

    it('zakres nextContactFrom/To', () => {
        const sql = render(
            buildFollowUpConditions({
                ...base,
                nextContactFrom: '2026-10-01',
                nextContactTo: '2026-10-31'
            })
        );
        expect(sql).toContain('combined."_fu_next" >= 2026-10-01');
        expect(sql).toContain('combined."_fu_next" <= 2026-10-31');
    });
});

describe('P0.4 buildFollowUpOrderBy — zalegle najpierw', () => {
    it('buckety 0/1/2 + NULL terminu jako najstarsza zaleglosc', () => {
        const sql = (buildFollowUpOrderBy(NOW) as any).render() as string;
        expect(sql).toContain('THEN 0');
        expect(sql).toContain('THEN 1');
        expect(sql).toContain('ELSE 2 END ASC');
        expect(sql).toContain(`COALESCE(combined."_fu_next", '0000') ASC`);
    });
});

describe('P0.4-fix buildOffersCountSql — kolumny _fu_* w count', () => {
    it('count selektuje _fu_outcome/_fu_next/_fu_last w obu galeziach', () => {
        const sql = (
            buildOffersCountSql('' as any, '' as any, '' as any) as any
        ).render() as string;
        expect(sql).toContain('"_fu_outcome"');
        expect(sql).toContain('"_fu_next"');
        expect(sql).toContain('"_fu_last"');
        expect(sql).toContain(`"offerKind" = rury`);
        expect(sql).toContain(`"offerKind" = studnie`);
        expect(sql).toContain('SELECT COUNT(*) as cnt');
    });
});

describe('P0.4 calculateFollowUpHealth — parytet z SQL', () => {
    it.each([
        ['WON', '2026-10-01T00:00:00.000Z', 'closed'],
        ['LOST_COMPETITION', null, 'closed'],
        ['ABANDONED', null, 'closed'],
        ['OPEN', '2026-10-01T00:00:00.000Z', 'overdue'],
        ['OPEN', null, 'due'],
        ['OPEN', '2026-12-01T00:00:00.000Z', 'scheduled'],
        [null, null, 'due'],
        [null, '2026-10-01T00:00:00.000Z', 'overdue']
    ])('(%s, %s) => %s', (outcome, next, expected) => {
        expect(
            calculateFollowUpHealth(
                outcome as string | null,
                next as string | null,
                '2026-10-08T12:00:00.000Z'
            )
        ).toBe(expected);
    });
});

describe('P0.4 mapOfferRow — projekcja followup', () => {
    const row = (fu: Partial<RawOfferRow>): RawOfferRow =>
        ({
            id: 'o-1',
            userId: 'u-1',
            clientId: null,
            state: 'final',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
            offer_number: 'OF/1',
            d_clientName: 'ACME',
            d_investName: null,
            d_investAddress: null,
            d_clientNip: null,
            d_clientNumber: null,
            d_totalNetto: null,
            d_totalBrutto: 100,
            d_summary: null,
            d_costSummary: null,
            d_wellsExportTotal: null,
            d_wellsCount: null,
            d_itemsCount: null,
            d_userName: null,
            d_creatorName: null,
            d_createdByUserName: null,
            d_budowa: null,
            d_number: null,
            d_offerNumber: null,
            pricelistVersionId: null,
            history: '[]',
            _type: 'rury',
            transportCost: null,
            _orderCount: 0,
            clientName: 'ACME',
            investName: '',
            clientNip: '',
            clientNumber: null,
            ...fu
        }) as RawOfferRow;

    it('brak follow-up: followup null', () => {
        const mapped = mapOfferRow(row({ _fu_outcome: null, _fu_next: null, _fu_last: null }));
        expect(mapped.followup).toBeNull();
    });

    it('latest follow-up: obiekt z trzema polami', () => {
        const mapped = mapOfferRow(
            row({
                _fu_outcome: 'OPEN',
                _fu_next: '2026-10-12T09:00:00.000Z',
                _fu_last: '2026-10-08T09:55:00.000Z'
            })
        );
        expect(mapped.followup).toEqual({
            outcome: 'OPEN',
            nextContactAt: '2026-10-12T09:00:00.000Z',
            lastContactAt: '2026-10-08T09:55:00.000Z'
        });
    });
});
