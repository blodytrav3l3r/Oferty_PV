# CSP Observation Report

**Period**: 2026-07-11T12:00:00.000Z → 2026-07-11T12:01:00.000Z

| Metryka             | Wartość |
| ------------------- | ------: |
| Total reports       |       2 |
| Unique fingerprints |       2 |

## Top violations

| #   |    Fingerprint | Count | Directive       | File            | Line |
| --- | -------------: | ----: | --------------- | --------------- | ---: |
| 1   | `2bae5cfad043` |     1 | script-src-attr | offerExports.js |  332 |
| 2   | `cdd10c995a51` |     1 | script-src-attr | wellPopups.js   | 1129 |

## Migrated modules regression check

| Module          | Handlers | Violated FPs | Status |
| --------------- | -------: | -----------: | ------ |
| dashboard.js    |        3 |            0 | PASS   |
| offerExports.js |        8 |            1 | FAIL   |
| ui.js           |        2 |            0 | PASS   |

**⚠ Regression detected in migrated modules — investigate violations above.**
