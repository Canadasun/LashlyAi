# TestFlight builds via GitHub Actions

This repo builds and uploads to TestFlight using a GitHub-hosted macOS runner
(`.github/workflows/testflight.yml`) instead of a local Xcode install — GitHub's
`macos-15` runners come with Xcode 16.0–16.4 pre-installed, which covers React
Native 0.86's requirement (16.1+).

## One-time setup: GitHub repo secrets

Go to the repo → Settings → Secrets and variables → Actions → New repository secret,
and add:

| Secret | Where to get it |
|---|---|
| `ASC_KEY_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API → your key's Key ID |
| `ASC_ISSUER_ID` | Same page — the Issuer ID shown above the keys table (shared across all your keys) |
| `ASC_API_KEY_P8` | The full contents of the `.p8` file you downloaded when creating the key (starts with `-----BEGIN PRIVATE KEY-----`). **Apple only lets you download this once** — if lost, revoke and generate a new key. |

The API key needs at least the **App Manager** role so it can manage provisioning
profiles and upload builds.

## Running a build

Go to the repo's Actions tab → "iOS TestFlight" workflow → Run workflow. It's
manual-trigger only (`workflow_dispatch`), not run on every push — uploading a build
is a visible, real action (testers may get notified), so it should be a deliberate
choice, not a side effect of pushing code.

## What the workflow does

1. Checks out the repo, selects Xcode 16.4.
2. Installs mobile npm dependencies and CocoaPods.
3. Writes the API key to a temp file from the `ASC_API_KEY_P8` secret.
4. Bumps `CURRENT_PROJECT_VERSION` to the GitHub Actions run number via `agvtool` —
   Apple rejects re-uploading the same build number for a given marketing version, so
   this needs to keep increasing across runs.
5. Archives with `-allowProvisioningUpdates` and the API key — Xcode automatically
   creates/fetches the needed distribution certificate and provisioning profile using
   the key's permissions, no manually-managed certs needed.
6. Exports with `destination: upload` in `mobile/ios/ExportOptions.plist`, which makes
   `xcodebuild -exportArchive` upload directly to App Store Connect as its last step.

## Known unknowns (nothing here has been run yet)

This workflow was written and YAML/plist-validated but **has not been run for real**
— there's no local Xcode/simulator in this dev environment to test it against first.
The first real run may need adjustments, most likely:
- **Xcode 16.4 not being the exact version needed** — if the build fails on
  React Native/Swift version mismatches, try a different 16.x version, or move to a
  `macos-26` runner (has Xcode 26.x) if RN's actual requirement turns out higher than
  expected.
- **Automatic signing needing the API key's role bumped** to Admin if App Manager
  turns out insufficient for creating a brand-new provisioning profile on the very
  first run.
- **CocoaPods native modules** (react-native-svg, react-native-screens, etc.) — these
  installed cleanly in this dev environment despite no Xcode, but have never actually
  compiled through `xcodebuild`.

Report back the exact failure if the first run doesn't succeed — CI logs from a real
Xcode toolchain will surface issues no amount of `tsc`/`pod install` here could catch.
