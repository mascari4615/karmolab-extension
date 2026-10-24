# YouTube management panel

- Mode: Operate. Inherit the existing YouTube screen and extension controls.
- User-selected reference: YouTube's top-bar entry and right-side panel composition.
- Live reference: masthead height 56px, existing `#buttons` action group, dark theme on 2026-10-24.
- Follow YouTube's root dark attribute for the surface, text and action palette. Actual YouTube no longer exposes the legacy theme variables; set them locally on the panel and trigger, keeping the page unchanged.
- One top-bar KarmoLab button, one nonmodal panel below the masthead, separate translation, keyword and blocked-user groups without nested cards.
- A close button, Escape and outside click dismiss the panel. Retain unsaved keyword input across dismissal.
- Immediate reversible toggles. Keyword drafts have an explicit Save action. Persistent blocked users have individual Unblock actions and search.
- Use text labels and native controls, 44px panel targets, 16px text inputs, visible keyboard focus. Keep panel within narrow viewports.
- Extend the accepted panel with Shorts controls and a backup section. Scroll the blocked-user list independently so backup controls remain reachable.
- Show up to three persistent block notices with Undo and Dismiss. Avoid a timeout while the user decides.
- Download stored preferences. A selected restore file shows counts and merge semantics before an explicit restore action; preserve unsaved keyword drafts.
- Compact comments: timestamp gutter, no avatar, author and body on the first line. Keep body type at 14px and native content folding. Reveal reactions on hover/focus; keep actions visible for coarse pointers.
- Home sizing changes card width rather than page zoom or type size. Three direct choices: native, small, smaller. Derive columns from available width, with native layout restored outside Home or when disabled.
