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
- Success: change these settings without leaving YouTube, with saved-state feedback and preserved drafts.
