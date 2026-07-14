# TestFlight builds via GitHub Actions

This repo builds and uploads to TestFlight using a GitHub-hosted macOS runner
(`.github/workflows/testflight.yml`) instead of a local Xcode install — `macos-26`
runners ship Xcode 26.5, which includes the iOS 26 SDK that App Store Connect now
requires (Xcode 16.4/iOS 18.5 SDK builds are rejected).

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

Auto-triggers on every push to `main` that touches `mobile/**` or the workflow file
itself — this is the single source of truth for iOS builds (an earlier parallel EAS
pipeline was retired after it collided with this one on build numbers). It can also be
run on demand from the repo's Actions tab → "iOS TestFlight" → Run workflow
(`workflow_dispatch`), which rebuilds the current `main` HEAD.

## What the workflow does

1. Checks out the repo, selects Xcode 26.5.
2. Installs mobile npm dependencies, runs `npm run build`/`lint`/`test` (fails fast
   before the slow signing/archive stages if JS/TS is broken).
3. Installs CocoaPods.
4. Writes the API key to a temp file from the `ASC_API_KEY_P8` secret.
5. Imports a pre-issued Distribution certificate + App Store provisioning profile into
   a temporary CI keychain (manual signing — see the P0 troubleshooting item below for
   why, not `-allowProvisioningUpdates` automatic signing).
6. Bumps `CURRENT_PROJECT_VERSION` to the GitHub Actions run number via `agvtool` —
   Apple rejects re-uploading the same build number for a given marketing version, so
   this needs to keep increasing across runs. This exact number is also what
   `scripts/attach_testflight_build.rb` uses afterward to find the build it just
   uploaded (see below) — don't change how it's derived without updating that script.
7. Archives, then exports with `-authenticationKeyPath`/`-ID`/`-IssuerID` pointed at
   the API key, which makes `xcodebuild -exportArchive` upload directly to App Store
   Connect as its last step.
8. Runs `scripts/attach_testflight_build.rb` (see below) to make the upload actually
   visible to testers.

## Known gotchas (check these first if a build silently doesn't reach testers)

A successful CI run (green checkmark, upload succeeded) does **not** mean testers can
see the new build — Apple requires export compliance + a beta group attached per
build, and getting either of those wrong fails silently: the workflow still goes
green, nothing errors, and the app in TestFlight just... doesn't update.

- **The build-selection bug (fixed 2026-07-14).** `attach_testflight_build.rb` used to
  fetch `/v1/preReleaseVersions/{id}/builds?limit=1` with no sort or filter, assuming
  the API returns the just-uploaded build first. It doesn't reliably — from the build
  right after this script was introduced onward, every run silently re-attached an
  **old, already-processed build** instead of the new one (caught via a `409` "already
  declared" on the compliance PATCH, and a build reaching `VALID` 2-3 seconds after
  upload finished, which is not how long real Apple processing takes). The real new
  build never got compliance/group set and stayed invisible — testers kept seeing
  whatever build predated this script, across every push, with no error anywhere.
  Fixed by filtering on the exact build number the workflow just created
  (`BUILD_NUMBER` env var, same value as the `agvtool` bump) instead of trusting list
  order. **If a future build still doesn't reach testers after a green CI run, check
  the "Attach build to TestFlight internal testers" step's log first** — it prints the
  exact build number/ID it operated on and the compliance/group HTTP status codes.
- **Export compliance and beta group attachment aren't automatic on upload** — a build
  can show `processingState: VALID` in App Store Connect and still not be installable
  until both are set. This is what the script above exists to automate for internal
  testers.
- **External testers need a separate, manual Beta App Review submission per build** —
  deliberately not automated, since that's a real App Review submission to Apple, not
  something to fire off unattended alongside every push.
