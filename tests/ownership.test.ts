import { canReadDoc, canWriteDoc, resolveWriteUserId } from '../src/utils/ownership';
import { User } from '../src/helpers';

const admin: User = {
    id: 'admin1',
    username: 'admin',
    role: 'admin',
    subUsers: []
};

const pro: User = {
    id: 'pro1',
    username: 'pro',
    role: 'pro',
    subUsers: ['subA', 'subB']
};

const regularUser: User = {
    id: 'user1',
    username: 'user1',
    role: 'user',
    subUsers: []
};

const otherUser: User = {
    id: 'user2',
    username: 'user2',
    role: 'user',
    subUsers: []
};

describe('canReadDoc', () => {
    it('returns false for missing user', () => {
        expect(canReadDoc(undefined, 'doc1')).toBe(false);
        expect(canReadDoc(undefined, null)).toBe(false);
    });

    it('returns false for missing docUserId', () => {
        expect(canReadDoc(regularUser, null)).toBe(false);
        expect(canReadDoc(regularUser, undefined)).toBe(false);
        expect(canReadDoc(regularUser, '')).toBe(false);
    });

    it('admin can read any document', () => {
        expect(canReadDoc(admin, 'anyDoc')).toBe(true);
        expect(canReadDoc(admin, 'random')).toBe(true);
    });

    it('owner can read own document', () => {
        expect(canReadDoc(regularUser, 'user1')).toBe(true);
    });

    it('user cannot read other user document', () => {
        expect(canReadDoc(regularUser, 'user2')).toBe(false);
    });

    it('pro can read sub-user document', () => {
        expect(canReadDoc(pro, 'subA')).toBe(true);
        expect(canReadDoc(pro, 'subB')).toBe(true);
    });

    it('pro cannot read unrelated user document', () => {
        expect(canReadDoc(pro, 'otherUser')).toBe(false);
    });
});

describe('canWriteDoc', () => {
    it('returns false for missing user', () => {
        expect(canWriteDoc(undefined, 'doc1')).toBe(false);
    });

    it('admin can write any document', () => {
        expect(canWriteDoc(admin, 'anyDoc')).toBe(true);
    });

    it('owner can write own document', () => {
        expect(canWriteDoc(regularUser, 'user1')).toBe(true);
    });

    it('user cannot write other user document (no impersonation)', () => {
        expect(canWriteDoc(regularUser, 'user2')).toBe(false);
    });

    it('null docUserId is allowed (treated as "create new for me")', () => {
        expect(canWriteDoc(regularUser, null)).toBe(true);
        expect(canWriteDoc(pro, null)).toBe(true);
    });

    it('pro can write sub-user document', () => {
        expect(canWriteDoc(pro, 'subA')).toBe(true);
    });

    it('pro cannot write unrelated user document', () => {
        expect(canWriteDoc(pro, 'otherUser')).toBe(false);
    });

    it('CRITICAL: regular user cannot escalate to write as another user', () => {
        // Scenario: user1 sends PUT /api/offers/:id with body { userId: 'user2' }
        // canWriteDoc(user1, 'user2') must be false.
        expect(canWriteDoc(regularUser, 'user2')).toBe(false);
        // Same for sub-user escalation
        expect(canWriteDoc(otherUser, 'user1')).toBe(false);
    });
});

describe('resolveWriteUserId', () => {
    it('rejects if no user', () => {
        expect(resolveWriteUserId(undefined, 'x')).toEqual({ allowed: false, effectiveUserId: '' });
    });

    it('admin can create for any userId', () => {
        expect(resolveWriteUserId(admin, 'subA')).toEqual({ allowed: true, effectiveUserId: 'subA' });
        expect(resolveWriteUserId(admin, null)).toEqual({ allowed: true, effectiveUserId: 'admin1' });
    });

    it('regular user: missing userId → own id', () => {
        expect(resolveWriteUserId(regularUser, null)).toEqual({ allowed: true, effectiveUserId: 'user1' });
        expect(resolveWriteUserId(regularUser, undefined)).toEqual({ allowed: true, effectiveUserId: 'user1' });
    });

    it('regular user CANNOT create for another userId', () => {
        expect(resolveWriteUserId(regularUser, 'user2')).toEqual({ allowed: false, effectiveUserId: '' });
    });

    it('pro can create for self', () => {
        expect(resolveWriteUserId(pro, null)).toEqual({ allowed: true, effectiveUserId: 'pro1' });
    });

    it('pro can create for sub-users', () => {
        expect(resolveWriteUserId(pro, 'subA')).toEqual({ allowed: true, effectiveUserId: 'subA' });
    });

    it('pro CANNOT create for unrelated user', () => {
        expect(resolveWriteUserId(pro, 'randomUser')).toEqual({ allowed: false, effectiveUserId: '' });
    });

    it('CRITICAL: user1 cannot pretend to be user2 by sending userId in body', () => {
        // Endpoint extracts userId from body and calls resolveWriteUserId.
        // user1 sends { userId: 'user2' } → must be rejected.
        const r = resolveWriteUserId(regularUser, 'user2');
        expect(r.allowed).toBe(false);
        expect(r.effectiveUserId).toBe('');
    });
});
