# YouTube management panel

- Mode: Operate. Inherit the existing YouTube screen and extension controls.
- User-selected reference: YouTube's top-bar entry and right-side panel composition.
- Live reference: masthead height 56px, existing `#buttons` action group, dark theme on 2026-10-24.
- Follow YouTube's root dark attribute for the surface, text and action palette. Actual YouTube no longer exposes the legacy theme variables; set them locally on the panel and trigger, keeping the page unchanged.
- One top-bar KarmoLab button, one nonmodal panel below the masthead, three setting groups without nested cards.
- A close button, Escape and outside click dismiss the panel. Retain unsaved keyword input across dismissal.
- Immediate reversible toggles. Keyword drafts have an explicit Save action. Persistent blocked users have individual Unblock actions and search.
- Use text labels and native controls, 44px panel targets, 16px text inputs, visible keyboard focus. Keep panel within narrow viewports.
