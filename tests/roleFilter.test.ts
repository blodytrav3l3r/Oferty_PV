import { buildRoleWhereClause } from '../src/utils/roleFilter';
import { User } from '../src/helpers';

describe('buildRoleWhereClause', () => {
    it('admin powinien otrzymać undefined (brak filtra = wszystkie rekordy)', () => {
        const admin: User = {
            id: 'admin1',
            username: 'admin',
            role: 'admin',
            subUsers: []
        };
        expect(buildRoleWhereClause(admin)).toBeUndefined();
    });

    it('zwykły użytkownik powinien otrzymać filtr po własnym userId', () => {
        const user: User = {
            id: 'user1',
            username: 'jan',
            role: 'user',
            subUsers: []
        };
        const result = buildRoleWhereClause(user);
        expect(result).toEqual({ userId: 'user1' });
    });

    it('użytkownik pro powinien otrzymać filtr po własnym id i podużytkownikach (subUsers)', () => {
        const pro: User = {
            id: 'pro1',
            username: 'szef',
            role: 'pro',
            subUsers: ['sub1', 'sub2']
        };
        const result = buildRoleWhereClause(pro);
        expect(result).toEqual({ userId: { in: ['pro1', 'sub1', 'sub2'] } });
    });

    it('użytkownik pro bez podużytkowników powinien zawierać tylko własne id', () => {
        const pro: User = {
            id: 'pro1',
            username: 'szef',
            role: 'pro',
            subUsers: []
        };
        const result = buildRoleWhereClause(pro);
        expect(result).toEqual({ userId: { in: ['pro1'] } });
    });

    it('nieznana rola powinna przejść do filtra userId', () => {
        const unknown: User = {
            id: 'x1',
            username: 'unknown',
            role: 'guest',
            subUsers: []
        };
        const result = buildRoleWhereClause(unknown);
        expect(result).toEqual({ userId: 'x1' });
    });
});
