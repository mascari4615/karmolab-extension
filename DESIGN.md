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
- Compact comments: timestamp gutter, a 20px profile image before the author, and body on the first line. Keep short comments at 28px with the native profile control; use a 44px hit target for coarse pointers. Body type at 15px/22px, author and date at 12px/22px. Use the strongest neutral for content, muted blue for the author, and secondary neutral for the date. Preserve native content folding. Reveal reactions on hover/focus; keep actions visible for coarse pointers.
- Place the native translation control in reserved space at the comment's trailing edge. Show short Original/Translate labels while retaining the full native accessible text and state. Avoid an extra row and preserve keyboard operation.
- Use a small pencil beside the date for edited comments, preserving the native date link and full accessible text. Keep the same date type and alignment for ordinary and edited comments.
- At desktop widths, place native reply counts and collapse controls beside the comment. Group expanded replies with a single thin line and shallow indentation. Keep native nested reply loading; on narrow or coarse-pointer screens, leave reply controls in normal flow with larger targets.
- Home sizing changes card width rather than page zoom or type size. Three direct choices: native, small, smaller. Derive columns from available width, with native layout restored outside Home or when disabled.
- Where row-based reading flow is supported, backfill Home grid gaps around full-width shelves and align keyboard focus with visual rows. Otherwise keep source order and ordinary grid placement.
