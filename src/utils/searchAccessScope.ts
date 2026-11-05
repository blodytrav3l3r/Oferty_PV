import type { User } from '../helpers';

export function searchAccessScope(user: Pick<User, 'id' | 'role' | 'subUsers'>) {
    return [user.id, user.role, [...(user.subUsers ?? [])].sort()] as const;
}
