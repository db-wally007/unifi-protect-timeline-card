// Shared TypeScript interfaces for the UniFi Protect Timeline Card.
// Only the slices of the Home Assistant frontend object we actually use are typed.

export interface HassEntityRegistryEntry {
  config_entry_id?: string | null;
  device_id?: string | null;
}

export interface HomeAssistant {
  // WebSocket command channel (browse media, history, sign paths, ...).
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  // Authenticated HTTP fetch. Used for the clip-session endpoints, which are
  // POST/DELETE and so can't go through a signed path (those only sign GETs).
  fetchWithAuth?(url: string, init?: RequestInit): Promise<Response>;
  // Fallback when fetchWithAuth is absent: raw bearer token.
  auth?: { accessToken?: string };
  // Entity registry, present in modern HA frontends. Used to auto-resolve nvr_id.
  entities?: Record<string, HassEntityRegistryEntry>;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
  language?: string;
}

// One entry of the `cameras:` gallery strip (single mode) / live grid (multi
// mode). A bare string is shorthand for { camera: <string> }; the display name
// defaults to the entity friendly_name.
export interface CameraEntry {
  // Events / manifest / clip-export key — the camera's primary (high-res)
  // entity_id. Everything server-side is keyed to this.
  camera: string;
  name?: string;
  // Multi mode: the entity streamed in the live grid tile (e.g. the camera's
  // medium-resolution channel, so N simultaneous tiles don't decode N × 4K).
  // Defaults to `camera`.
  live_camera?: string;
  // Multi mode: dashboard path a live-tile tap navigates to (the camera's own
  // single-camera timeline view). Empty/absent = the tap DRILLS IN-CARD
  // instead: the card swaps the multi page for the full single-camera
  // timeline (slide transition; the back chevron returns to the grid). No HA
  // navigation happens, so a hosting bubble popup stays open — the right
  // choice when the card lives in a popup.
  navigation_path?: string;
}

// Card YAML configuration.
export interface CardConfig {
  type: string;
  // Which page the card renders (default 'single'):
  //   single  the classic one-camera timeline/events card (all options below)
  //   multi   UniFi-app-style multi-camera page: a merged event-clip strip
  //           across ALL `cameras:` on top, an always-live camera grid below.
  //           Tapping a clip plays it where the grid was (the live streams
  //           unmount — one decode instead of N); tapping a live tile
  //           navigates to that camera's own view (entry.navigation_path).
  card_version?: 'single' | 'multi';
  // HA camera entity_id; passed straight to the proxy as {camera_id}.
  // Multi mode: optional — defaults to the first `cameras:` entry.
  camera: string;
  // Optional camera gallery: dragging DOWN on the video opens a horizontal
  // carousel of these cameras (drag UP closes it); tapping one switches the
  // whole card (live, events, timeline) to it. Entries are entity_ids or
  // { camera, name } objects. Omitted/empty = single-camera card, no gesture.
  cameras?: (string | CameraEntry)[];
  // ---- multi mode only (card_version: multi) -------------------------------
  // Event strip header text; the merged event count is appended ("Events 260").
  strip_title?: string;
  // Strip thumbnail width in px (16/10 aspect; camera name below), per layout:
  // mobile = the narrow/stacked layout (default 0 = AUTO: exactly two thumbs
  // fit the screen, matching the expanded grid's 2 columns so toggling only
  // changes the orientation), tablet = the wide/columns layout (default 156,
  // the size of the camera-gallery tiles).
  mobile_events_thumbnail_size?: number;
  tablet_events_thumbnail_size?: number;
  // Time label overlaid on each strip thumbnail, in px (default 12).
  strip_time_size?: number;
  // Live tile aspect ratio (default "16/9").
  grid_aspect?: string;
  // --------------------------------------------------------------------------
  // How far back the date-pill calendar allows jumping, in days (default 30).
  // Future dates are always disabled.
  calendar_days?: number;
  // unifiprotect config-entry id (or NVR id). Optional — auto-resolved from the
  // camera's entity registry entry when omitted.
  nvr_id?: string;
  // Layout. 'auto' (default) picks by the CARD's own width (layout_breakpoint):
  // wide -> 'columns' (vertical timeline left, video right — tablet / desktop /
  // landscape phone), narrow -> 'stacked' (video top, timeline below — portrait
  // phone). Rotating a phone re-picks live. Explicit values pin it.
  layout?: 'auto' | 'columns' | 'stacked';
  // Card width (px) at/above which layout 'auto' picks 'columns' (default 600
  // — above any portrait phone, below any landscape one).
  layout_breakpoint?: number;
  // In 'stacked' layout, the video's share of the height. Fraction 0–1
  // (default 0.45); a value > 1 is treated as a percent (so 45 and 0.45 match).
  video_ratio?: number;
  // In 'stacked' layout, size the video pane by aspect ratio (e.g. "16/9")
  // instead of a height fraction — the video then fills exactly with no black
  // bars, and the timeline gets the rest of the height. "" = use video_ratio.
  video_aspect?: string;
  // Height of the WHOLE card (any CSS length) — header + camera strip + the
  // video/timeline row, which flexes to fill it. "" = built-in default: 80vh
  // in 'columns', 100dvh in 'stacked' (fills the phone, behind the navbar).
  height?: string;
  // Initial visible vertical span, in minutes (10..60; default 60 = most zoomed
  // out). The user zooms with the +/- buttons / pinch.
  default_span_minutes?: number;
  // Length of the clip exported/played on settle, in SECONDS (default 300).
  // Trade-off: the NVR exports this range on demand, so longer windows take
  // longer to start playing, but chain (pause between segments) less often.
  chunk_seconds?: number;
  // How many seconds BEHIND live the continuous delayed-follow playback holds
  // after a rewind (default 15). The NVR can't export the last ~8s, so values
  // below ~12 are clamped; larger values = longer gapless chunks (fewer swaps)
  // but further behind live.
  delay_seconds?: number;
  // LIVE audio policy. `auto` makes one best-effort unmute attempt only after
  // high-resolution video is moving; `muted` always waits for a user tap.
  // Visual playback remains muted/autoplay-safe while either policy starts.
  live_audio_start?: 'auto' | 'muted';
  // Pause between releasing a scrub (drag/flick/wheel) and playback starting,
  // in ms (default 700). Taps play immediately. 0 = no delay.
  scrub_settle_ms?: number;
  // Timeline label font size in px (default 11).
  timeline_font_size?: number;
  // Timeline label color (any CSS color; default theme secondary text).
  timeline_font_color?: string;
  // Date pill (bottom-left, opens the calendar) text size in px (default 15)
  // and color (any CSS color; default white).
  date_font_size?: number;
  date_font_color?: string;
  // Accent color (playhead, zoom slider). Any CSS color; default theme
  // --primary-color.
  accent_color?: string;
  // Timeline | Events segmented toggle colors. All optional:
  //   toggle_bg           track behind both buttons ("" = bubble pop-up close-
  //                       button background chain -> --card-background-color)
  //   toggle_active_bg    the active button's fill ("" = rgba(0,0,0,0.6), the dark pill look)
  //   toggle_active_color active button text ("" = #fff)
  //   toggle_text_color   inactive button text ("" = theme --secondary-text-color)
  toggle_bg?: string;
  toggle_active_bg?: string;
  toggle_active_color?: string;
  toggle_text_color?: string;
  // Events-list day-divider line color ("" = accent_color).
  list_divider_color?: string;
  // Jump-to-live arrow background. Any CSS color; default = accent_color.
  arrow_color?: string;
  // Jump-to-live arrow distance from the bottom of the timeline, in px (default 14).
  live_arrow_bottom?: number;
  // Initial zoom when the card loads, 0–100 (0 = fully zoomed out / widest,
  // 100 = fully zoomed in / narrowest). Default 50 (middle). Overrides
  // default_span_minutes when set.
  default_timeline_zoom?: number;
  // Minute-divider tick color (any CSS color; default theme secondary text).
  tick_color?: string;
  // Minute-divider tick length: a number in px, or 'small' | 'medium' | 'large'.
  tick_size?: number | 'small' | 'medium' | 'large';
  // Recorded (past) track color. Any CSS color; default theme divider color.
  recorded_color?: string;
  // Future track color (above the playhead). Any CSS color; default = the
  // recorded color dimmed ~30%.
  future_color?: string;
  // Show dark-grey "unavailable footage" bands on the timeline for spans where
  // the camera was offline / not recording (UniFi's "Lost wired connection"
  // segments). Derived from the camera entity's `unavailable` history — no NVR
  // calls. The card also stops probing the NVR for thumbnails/video inside these
  // spans. Default true.
  show_footage_gaps?: boolean;
  // Color of the unavailable-footage bands (any CSS color; default a neutral
  // dark grey that reads as "no data").
  gap_color?: string;
  // Timeline inline thumbnail width in px, inactive (default 79) and when
  // hovered/under the playhead (default 95 — a subtle UniFi-style grow).
  // Height follows a 4:3 ratio. Thumbnail spacing always reserves room for the
  // enlarged size, so a growing thumb can never touch its neighbours.
  thumb_size?: number;
  thumb_size_active?: number;
  // Consecutive NVR events with gaps up to this many seconds are consolidated
  // into ONE display event (one timeline bar / one events-list row with the
  // merged duration), replicating how the UniFi app groups continuous activity.
  // Default 60. 0 = no grouping (raw 1:1 events, the pre-1.27 behavior).
  event_merge_gap_seconds?: number;
  // Events-list view: row 1 (event start time) text size in px (default 12).
  list_text_size?: number;
  // Events-list view: row 1 text color (any CSS color; default theme secondary
  // text — same grey as the timeline labels).
  list_text_color?: string;
  // Events-list view: row 2 (duration) text color (any CSS color; default = the
  // row-1 color, dimmed).
  list_duration_color?: string;
  // Events-list view — ACTIVE (currently-playing) row styling, independent of
  // the inactive set above. Defaults: white background, black text on both rows.
  list_active_text_size?: number; // row 1 (start time), default 12
  list_active_text_color?: string; // row 1 color, default #000
  list_active_duration_size?: number; // row 2 (duration), default 12
  list_active_duration_color?: string; // row 2 color, default #000
  list_active_bg?: string; // playing-row background, default #fff
  // Deprecated alias for list_active_bg (background of the playing row).
  list_highlight_color?: string;
  // When an event clip (played from the Events list) finishes, step to the next
  // newer event (true, default) or instead keep playing the timeline footage
  // continuously from where the clip ended (false). Timeline-mode playback is
  // unaffected either way.
  autoplay_next_event?: boolean;
  // Max simultaneous thumbnail fetches from the NVR (default 2). Lower = gentler
  // on the NVR; higher = faster to fill but more load. Applies to both views.
  thumbnail_concurrency?: number;
  // Directory (served path) of the server-side thumbnail cache written by the
  // pyscript protect_thumbs job. Default: /protect_thumbs/<camera object_id>.
  // When a manifest.json is found there, the card serves exact cached thumbnails
  // locally and only falls back to the NVR for events not yet cached.
  thumbnail_cache_dir?: string;
  // Show low-res timelapse frames on the stage while scrubbing (default true),
  // fed by the pyscript protect_scrub cache. Silently stays a plain black stage
  // when the cache doesn't exist (job not installed / camera not cached).
  scrub_preview?: boolean;
  // Directory (served path) of the scrub-preview cache written by the pyscript
  // protect_scrub job. Default: /protect_scrub/<camera object_id>.
  scrub_preview_dir?: string;
  // EXPERIMENTAL (default true). When a scrub starts near the live edge, ask
  // the NVR (via pyscript.protect_scrub_tip) for a REAL-TIME clip of the newest
  // ~60s. The cron-driven cache can only ever be 10-70s behind live and is a
  // timelapse at one frame per ~2.4s; the tip lands in ~1.1s, reaches to ~2s
  // behind live and scrubs at ~30fps. Costs ~0.9 MB per gesture and one short
  // NVR export. Set false to fall back to the cron cache alone.
  scrub_tip?: boolean;
  // SPRITE-PREVIEW-2026-08-04. How the scrub preview paints its frames:
  //   'video'   - seek a cached <video>. Sharpest (640x360), but a seek costs
  //               ~10 ms on a Mac/iPhone and ~99 ms on a low-end Android, whose
  //               hardware decoder caps the preview at ~10 updates/sec.
  //   'sprites' - draw a tile from a cached JPEG mosaic into a <canvas>. 480x270
  //               and ~0.5 ms per frame on that same Android. Needs the sheets
  //               the pyscript job publishes; falls back to video per unit where
  //               they are missing (the head/tip tiers never have them).
  //   'auto'    - start on video and switch to sprites only if this device's own
  //               MEASURED seek latency turns out to be slow. Deliberately NOT
  //               user-agent sniffing: the tablet this exists for reports a
  //               DESKTOP Linux UA, so sniffing fails on the very device that
  //               needs it, while a fast device measures ~10 ms and can never
  //               trip the switch.
  // TEMPORARY DEFAULT 'sprites' (2026-08-04) so the quality can be judged on
  // every device at once; the intended long-term default is 'auto'. One word to
  // change, in getStubConfig and in card.ts's render().
  scrub_preview_mode?: 'auto' | 'sprites' | 'video';
  // UniFi-app-style scrubber overlaid on the RIGHT edge of the FULLSCREEN
  // player (mobile + tablet), fading in and out with the video controls
  // (default true), and its width in px (default 110). A reduced timeline: no
  // calendar pill, no zoom UI, no events list — event thumbnails show but a tap
  // seeks like anywhere else on the ruler.
  fs_timeline?: boolean;
  fs_timeline_width?: number;
  // Width (px) of the band down the right edge that ACCEPTS the scrub gesture.
  // Default 0 = the WHOLE player: a drag or wheel anywhere on the picture
  // scrubs. Taps never move the timeline — they show/hide the controls.
  // Everything the ruler draws is anchored to the screen edge, so a value here
  // only shrinks the target — nothing moves or dims.
  fs_timeline_grab_width?: number;
  // Clearance (px) between the fullscreen ruler and the TOP/BOTTOM screen edges
  // (default 60 on tablet / 20 on a phone, whose rotated ruler only gets the
  // screen's short side). The scrim still reaches the edges, and the ruler and
  // its thumbnails fade out at both ends rather than stopping dead.
  fs_timeline_padding?: number;
  // The lane (px) between the ruler and the RIGHT screen edge, which holds the
  // zoom control and the jump-to-live arrow — default 140 (110 on a phone,
  // where that edge is also iOS's system-gesture strip: a button inside it
  // never gets the touch, and the whole column has to clear it).
  fs_timeline_gutter?: number;
  // Peak opacity (0–1, default 0.88) of the dimming behind the fullscreen
  // ruler, at the screen edge; it fades out under the thumbnails that hang past
  // the strip. Bright daytime footage needs most of it to stay legible.
  fs_timeline_scrim?: number;
  // How far (px) that dimming reaches PAST the ruler strip, over the video
  // (default 170) — enough to back the event thumbnails, which hang outside it.
  fs_timeline_scrim_extend?: number;
  // Card title (default "UniFi Protect Timeline").
  title?: string;
  // Title (top-left header) font size in px, color, and weight. Defaults: size =
  // HA's card header size (~24px), color = theme primary text, weight = 300.
  title_font_size?: number;
  title_font_color?: string;
  title_font_weight?: number;
  // Weight of the header when it shows a CAMERA NAME (gallery configured).
  // Fixed to one value (default 600) regardless of title_font_weight, so the
  // camera name looks identical whether the timeline is opened standalone or
  // drilled in from the multi page (whose title_font_weight differs).
  camera_name_font_weight?: number;
  // While this card is on screen, paint the PAGE canvas (the <html> element —
  // the layer that shows through when HA's view-transition helpers fade the
  // view container) this color, restoring the original on unmount. Fixes the
  // lighter theme-background "flicker" when transitioning between two views
  // that share a darker background. "" (default) = off.
  page_background?: string;
  // In-card back button: a chevron shown at the top-left, before the title.
  // Clicking it calls history.back() (returns to the previous view/page — nothing
  // hard-coded). Default false (hidden); when hidden the title sits at the left.
  // EXCEPTION: multi mode's drilled-in timeline ALWAYS shows the chevron (it
  // returns to the grid — the only way back), regardless of this option.
  back_button?: boolean;
  // Back button chevron size in px (default 38); the circular button scales with it.
  back_button_size?: number;
  // Explicit back destination: when set, the back button ALWAYS navigates
  // here (no history involved — deterministic). Priority: this, else
  // history.back(), else back_fallback_path (see below). "" (default) = off.
  back_button_path?: string;
  // Where the back button navigates when there is NO in-app history to pop —
  // a deep link or the companion app cold-starting straight onto this view
  // (history.back() would do nothing and strand the user on the page).
  // "" (default) = the dashboard root (/<dashboard>/ → its default view).
  back_fallback_path?: string;
}

// A visible time window in epoch milliseconds. start < end.
export interface TimeDomain {
  start: number;
  end: number;
}

// A span (epoch ms) where the camera was offline, so the NVR has no footage —
// drawn as a grey "unavailable footage" band and skipped when probing the NVR.
export interface FootageGap {
  start: number;
  end: number;
}

// One entry in the server-side event cache manifest.json (written by the
// pyscript protect_thumbs job): one raw Protect event, 1:1 with the NVR.
export interface ThumbnailManifestEntry {
  id: string; // Protect event id
  kind: string; // person | vehicle | animal | motion | ...
  start: number; // epoch ms
  end: number; // epoch ms (provisional = write time when `ongoing`)
  dur?: number; // end - start (ms), absent while the event is ongoing
  ongoing?: boolean; // event had no end yet at sync time; finalized later
  file?: string; // /local/... served path; absent if the thumb isn't cached yet
}

// manifest.json v2: an object wrapping the raw event list plus the camera's
// recording padding, so clip playback can cover what the UniFi app plays
// (start - pre_ms .. end + post_ms). v1 was a bare ThumbnailManifestEntry[].
export interface ThumbnailManifest {
  version: number;
  generated: number; // epoch ms of the sync run — used for staleness detection
  pre_ms: number; // camera recording pre-padding
  post_ms: number; // camera recording post-padding
  events: ThumbnailManifestEntry[];
}

// One drawable event band. Since v2 these come exclusively from the manifest
// (the NVR's own event list) — 1:1, no history coalescing.
export interface DetectionBand {
  type: string; // stable identity (protect:<event id>)
  label: string;
  color: string;
  start: number; // epoch ms
  end: number; // epoch ms (rendered as "now" while `ongoing`)
  id?: string; // Protect event id
  // Exact cached thumbnail; absent until the sync job has downloaded it (the
  // loader then falls back to a one-off NVR snapshot).
  file?: string;
  // Event duration (ms) = end - start as the NVR reports it; absent while ongoing.
  durMs?: number;
  // Event is still in progress on the NVR (no final end time yet).
  ongoing?: boolean;
  // Multi-camera merged bands carry the source camera's display name; the events
  // list shows it as a caption line (single-camera timeline bands leave it unset).
  cameraName?: string;
  // The raw NVR events consolidated into this display band (UniFi-style
  // grouping — see data/event-groups.ts), oldest-first. Each member carries its
  // own exact thumbnail; the timeline shows one thumb per member along the
  // merged bar. Absent on a raw (ungrouped) band.
  members?: DetectionBand[];
}

// Raw state row as returned by history/history_during_period.
// Supports both the verbose form (last_changed/state) and the compressed
// minimal form (lu/lc/s) so the parser is robust across HA versions.
export interface RawHistoryState {
  s?: string;
  state?: string;
  lu?: number; // last_updated, epoch seconds (float)
  lc?: number; // last_changed, epoch seconds (float)
  last_updated?: string;
  last_changed?: string;
}
