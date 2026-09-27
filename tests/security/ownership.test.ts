import {
    canReadDoc,
    canWriteDoc,
    resolveWriteUserId,
    resolveAssignUserId,
    canClaimNumber
} from '../../src/utils/ownership';
import type { User } from '../../src/helpers';

const user = (id: string, role: User['role'] = 'user', subUsers: string[] = []): User =>
    ({ id, username: id, role, subUsers }) as User;
const admin = (): User => user('admin', 'admin');
const pro = (): User => user('pro1', 'pro', ['sub1']);

/**
 * P0.6: kontrakt ownership — macierz odczyt/zapis/przypisanie/numery.
 * Legacy rekord bez właściciela (null) = fail-closed dla nie-admina (baza #40).
 */
describe('P0.6 ownership matrix', () => {
    it('read: owner/pro-parent/admin tak; obcy/null/anonim nie', () => {
        expect(canReadDoc(user('u1'), 'u1')).toBe(true);
        expect(canReadDoc(pro(), 'sub1')).toBe(true);
        expect(canReadDoc(admin(), 'ktokolwiek')).toBe(true);
        expect(canReadDoc(user('u1'), 'u2')).toBe(false);
        expect(canReadDoc(user('u1'), null)).toBe(false);
        expect(canReadDoc(undefined, 'u1')).toBe(false);
    });

    it('write: legacy null fail-closed dla nie-admina', () => {
        expect(canWriteDoc(user('u1'), 'u1')).toBe(true);
        expect(canWriteDoc(pro(), 'sub1')).toBe(true);
        expect(canWriteDoc(admin(), null)).toBe(true);
        expect(canWriteDoc(user('u1'), 'u2')).toBe(false);
        expect(canWriteDoc(user('u1'), null)).toBe(false);
        expect(canWriteDoc(user('u1'), undefined)).toBe(false);
        expect(canWriteDoc(undefined, 'u1')).toBe(false);
    });

    it('resolveWriteUserId: user nie podszyje się pod obcego', () => {
        expect(resolveWriteUserId(user('u1'), 'u2')).toEqual({
            allowed: false,
            effectiveUserId: ''
        });
        expect(resolveWriteUserId(user('u1'), 'u1')).toEqual({
            allowed: true,
            effectiveUserId: 'u1'
        });
        expect(resolveWriteUserId(pro(), 'sub1')).toEqual({
            allowed: true,
            effectiveUserId: 'sub1'
        });
        expect(resolveWriteUserId(admin(), 'dowolny')).toEqual({
            allowed: true,
            effectiveUserId: 'dowolny'
        });
    });

    it('resolveAssignUserId: zmiana opiekuna wymaga praw do starego I nowego', () => {
        // właściciel oddaje własny dokument obcemu -> NIE
        expect(resolveAssignUserId(user('u1'), 'u1', 'u2').allowed).toBe(false);
        // pro przenosi między swoimi subami -> TAK
        const pro2 = user('pro1', 'pro', ['sub1', 'sub2']);
        expect(resolveAssignUserId(pro2, 'sub1', 'sub2')).toEqual({
            allowed: true,
            effectiveUserId: 'sub2'
        });
        // obcy nie ruszy cudzego -> NIE
        expect(resolveAssignUserId(user('u9'), 'u1', null).allowed).toBe(false);
    });

    it('canClaimNumber deleguje do canWriteDoc', () => {
        expect(canClaimNumber(user('u1'), 'u1')).toBe(true);
        expect(canClaimNumber(user('u1'), 'u2')).toBe(false);
        expect(canClaimNumber(user('u1'), null)).toBe(false);
        expect(canClaimNumber(admin(), 'u2')).toBe(true);
    });
});
