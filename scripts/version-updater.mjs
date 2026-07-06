#!/usr/bin/env node
/**
 * version-updater.mjs — updater VERSION dla standard-version.
 *
 * standard-version woła readVersion(contents) i writeVersion(contents, version).
 * VERSION to plik z samą wersją (np. "1.0.0\n").
 */

export function readVersion(contents) {
    return contents.trim();
}

export function writeVersion(contents, version) {
    return version + '\n';
}
