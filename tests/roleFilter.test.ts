import { buildRoleWhereClause } from '../src/utils/roleFilter';
import { User } from '../src/helpers';

describe('buildRoleWhereClause', () => {
    it('admin should get undefined (no filter = all records)', () => {
        const admin: User = {
            id: 'admin1',
            username: 'admin',
            role: 'admin',
            subUsers: []
        };
        expect(buildRoleWhereClause(admin)).toBeUndefined();
    });

    it('regular user should get filter by own userId', () => {
        const user: User = {
            id: 'user1',
            username: 'jan',
            role: 'user',
            subUsers: []
        };
        const result = buildRoleWhereClause(user);
        expect(result).toEqual({ userId: 'user1' });
    });

    it('pro user should get filter by own id and subUsers', () => {
        const pro: User = {
            id: 'pro1',
            username: 'szef',
            role: 'pro',
            subUsers: ['sub1', 'sub2']
        };
        const result = buildRoleWhereClause(pro);
        expect(result).toEqual({ userId: { in: ['pro1', 'sub1', 'sub2'] } });
    });

    it('pro user with no subUsers should include only own id', () => {
        const pro: User = {
            id: 'pro1',
            username: 'szef',
            role: 'pro',
            subUsers: []
        };
        const result = buildRoleWhereClause(pro);
        expect(result).toEqual({ userId: { in: ['pro1'] } });
    });

    it('unknown role should fall through to userId filter', () => {
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
