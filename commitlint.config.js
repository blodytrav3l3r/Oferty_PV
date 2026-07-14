export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'refactor', 'chore', 'docs', 'perf', 'test', 'style']
        ],
        'scope-enum': [
            2,
            'always',
            [
                'rury',
                'studnie',
                'offers',
                'orders',
                'prisma',
                'auth',
                'ui',
                'api',
                'seed',
                'deploy',
                'clients',
                'audit',
                'settings',
                'preco',
                'telemetry',
                'deps',
                'docs',
                'ci',
                'config',
                'test',
                'docker',
                'security',
                'chore',
                'release'
            ]
        ],
        'scope-case': [2, 'always', 'lower-case'],
        'subject-case': [2, 'always', 'lower-case'],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'header-max-length': [2, 'always', 72]
    }
};
