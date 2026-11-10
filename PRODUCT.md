# KarmoLab extension

## Product

- Browser extension for managing YouTube viewing and comment preferences.
- Existing functions: Shorts dates and daily viewing totals, user blocking, keyword folding, Korean comment translation, optional site utilities.
- Users manage their own browser preferences while browsing YouTube.
- Local browser storage is the source for preferences. The in-page panel and extension popup share existing keys.

## Platform

- Web, Chromium Manifest V3, Chrome and Edge. This user's installed trial runs in Edge.
- Preserve the current local version and existing permissions. Store submissions require a separate request.

## Current scope

- User selected a KarmoLab button in YouTube's top bar opening a right-hand management panel.
- Panel manages Korean translation, keyword editing, user blocking and unblock actions.
- One keyword list covers comment bodies and video/Shorts titles in result, home, subscription and recommendation cards. Channel names and video descriptions stay outside title matching.
- Blocking masks original text and thumbnails immediately after a match; only a neutral placeholder exits before the remaining cards move.
- User approved block undo, Shorts settings in the panel, and YouTube preferences/blocked-user JSON backup and restore.
- Backups exclude viewing history, optional site permissions, site volume and Base64 site settings. Restore previews contents, merges blocked users and applies backed-up preferences.
- Unknown Shorts remain covered while channel blocking is active and ownership is checked. Failed checks remain covered with retry and deliberate reveal actions.
- Keyword targets have separate comments, video and Shorts switches. Existing settings default to all targets enabled.
- The existing panel reports current covered items and reasons without exposing original titles or thumbnails. Show once resets at navigation; stable content IDs support persistent item exceptions and revocation.
- Success: change these settings without leaving YouTube, with saved-state feedback and preserved drafts.
- User requested compact comments resembling a dense chat view, and resizable Home video cards. Preserve native reply, translation, blocking and folding behavior.
- Density preferences live in the management panel and backups. Native layout remains available and is the default for a new installation.
- Shorts comments open at a requested 640px width, constrained by the available window. Drag the left separator to resize; remember the requested width locally across visits. This layout preference is independent of comment density and is not included in preference backups.
- Replies stay concealed from document start until both author and keyword checks finish. Changed text, author identity, settings, and exceptions invalidate prior checks before the next paint. Incomplete replies remain concealed. Fully loaded, entirely filtered reply groups show a neutral status instead of an empty expander; unknown totals and remaining continuations retain native loading controls.
- Home inline previews follow the saved video volume by default (10% fallback if unavailable). A 0-100% slider beside Home column controls sets a separate remembered preview volume; Follow video volume restores automatic following. Preserve native mute state and leave regular video and Shorts volume unchanged. Preview volume is not part of settings backups.
# Comment safety and compact controls

- Classify adult promotion locally from combined author and comment signals after Unicode normalization. Hide strong matches, fold uncertain matches, and preserve ordinary discussion that merely mentions an adult term. Keep reasons and per-comment exceptions in filter review. No external classifier or automatic account-wide blocking.
- Hide explicit keyword matches without a placeholder. Recover through the management panel.
- Read image emoji alternatives and Unicode image filenames as comment text. Treat each keyword entry separately; two emoji in one entry mean an adjacent sequence.
- Manage keywords as searchable rows with add, delete and optional author-block actions, saving the draft explicitly. Author blocking is off for every rule until selected. Store matched authors in the extension's existing local block list; preserve a local exception after undo/unblock to prevent immediate reblocking. Keep automatic rules in settings backups.
- Skip confirmed blocked current Shorts after closing comments. Match the renderer video ID to the URL so stale authors cannot skip the next video. Stop blocked regular playback and follow the native next-video link, falling back to Home when no usable next target exists. Unresolved author checks do not trigger skipping.
- Include spam acknowledgement in the reply prepaint gate. Recheck after translation and content replacement.
- Show an accessible translation progress icon, ending when text changes, the native control confirms completion, or after a 15-second response limit. Unknown source language uses a globe. Flags represent language hints, never author nationality.
- Detect original comment language with the browser's CLD API before translation, caching bounded results. Respect declared comment language, require reliable detection and at least 80% for inferred language, and leave short or ambiguous input unknown. Render native-independent SVG flags where available and ISO language badges for other known languages, with localized full names in tooltips.
- Search automatically excluded authors and resume keyword-based author blocking from the management panel or popup. Keep older boolean exclusions readable; new exclusions retain author names. Removing an exclusion clears the live suppression cache and rechecks matching comments.
- Prefer familiar action icons with accessible names and tooltips. Block and Home-hide notifications expire after six seconds, pausing during hover, focus or pending undo. Keep error details and restore confirmation as text.
