// Replaced at build time from package.json and the build host's commit (see scripts/build-info.mjs).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const APP_VERSION: string = __APP_VERSION__;
export const APP_COMMIT: string = __APP_COMMIT__;

export function versionLabel(version = APP_VERSION, commit = APP_COMMIT): string {
  return `v${version}${commit ? ` · ${commit}` : ''}`;
}
