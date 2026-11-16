# Store listing source

`ko.txt` and `en.txt` are the Korean and English long descriptions for the existing Chrome and Edge listings. `metadata.json` holds the proposed short descriptions and shared links.

These files are not included in the extension ZIP and are not uploaded by the release API. Save descriptions and images in each store's developer dashboard. Short descriptions come from `_locales/*/messages.json` in the uploaded extension package; the proposed text must be included in a subsequent package before claiming it is published.

The 0.4.3 release run was already dispatched from commit 4574e05 before this listing refresh. Do not describe these files as part of that submitted package or launch a duplicate release while its outcome is unknown.
