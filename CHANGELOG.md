# Changelog

## 1.4.2 - 2026-11-20

### Fixes
- The frosted expand / collapse button of the illustrated header keeps its blur on Safari before 18 (WebKit prefix).
- Closing a train's popup no longer throws when the train's key holds a quote or a backslash (the selector that gives the focus back to its row is escaped).

### Performance
- The status pill is measured again only when the card changed (or its width), no longer on every Home Assistant update.

### Maintenance
- Tests: the coverage of the card sources is now measured (`node --test --experimental-test-coverage`).

## 1.4.1 - 2026-11-18

### Fixes
- Illustrated header: `auto` now follows the Home Assistant theme alone — a light theme keeps the day picture after sunset, a dark theme still shows the night one.

## 1.4.0 - 2026-11-17

### Features
- **Status pill in the header** of both cards, full and mini, compact and unfolded, illustrated or classic: a coloured dot and a short status right after the title, in the colour of the header icon, which now follows the status too — **On time** (green), **Delays** (orange) or **Disruption** (red, a cancelled train) among the trains listed, **Scheduled** (grey, trains known from the timetable only) or **No trains**. It stays on the title row only while the title stays whole and the pill keeps its whole label beside it (measured by the card in every language, no fixed width threshold); otherwise it goes to its own line under the statistics, kept to one line, and shows only its dot when even that does not fit the banner, and at 200 px or less, the label kept in its tooltip and for screen readers. The pill uses the banner's frosted style. New texts translated into every language.
- **Mini card**: the next train's status pill now sits right after its time, and the header icon takes its colour; when the time row lacks room for its whole label, the pill takes the last row, « in 8 min » the time row and the platform the start of the train's row. With no train to show, the station's name and the board's pill (« No trains ») take its place.
- **Mini card detail button** aligned with the other cards: 24 px round frosted button, 5 px from the banner's top right corner (was 28 px, 6 px), in the unfolded view too; without the illustration it sits in the header's top right corner instead of the middle of the title row.
- With both tabs shown, the header statistics no longer repeat the board's name (« Departures »), already shown by the active tab right under the header; a statistic too long for a narrow header ends with an ellipsis instead of running under the scenery.

### Fixes
- **Night picture with a dark theme by day**: with `illustration_theme: auto` (the default), the night picture now shows when the sun is below the horizon **or** Home Assistant uses a dark theme, like the other cards; a dark dashboard by day used to keep the day sky. `day` and `night` still force it.

### Maintenance
- README: the departure, arrival and mini card animations now have a dark twin (`*-dark.gif`), in a new Animations section; with `illustration_theme: auto` the dark captures show the night picture.

## 1.3.1 - 2026-11-17

### Fixes
- **Uniform header height**: the illustrated header is now 90 px high on both cards (was 112 px on the full card and 100 px on the mini card), the same height as the other illustrated cards, so that headers line up on a dashboard.
- **Track across the whole card**: the rail, sleepers and ballast now run under the full width of the header, edge to edge, instead of stopping under the station, as a 10 px strip (rail, sleepers, ballast) of the same thickness as the ground strip of the other cards; the train still rides on the rail.

## 1.3.0 - 2026-11-15

### Features
- **Train number in the badge (Public Transport)**: the coloured badge now shows the run's own number (e.g. `8089`) rather than the line code (`401D`), using the `train_number` the Public Transport integration exposes; it falls back to the line code when no number is available. The line code stays in the row's accessible label.

## 1.2.2 - 2026-11-15

### Fixes
- **Line badge no longer shifts on hover in Safari**: the departure rows used a subgrid. Under WebKit, hovering a row mis-distributed the sibling rows' `1fr` track and pushed the line badge to the right. Each row now carries its own explicit columns, with the same alignment.

## 1.2.1 - 2026-11-15

### Fixes
- **HTML notices reduced to plain text**: SNCF/GTFS disruptions arrive as HTML (`<p>`, `&nbsp;`, entities) and were shown raw in the notice bar. Tags and entities are now stripped, and notices that differ only by their markup collapse into one.

## 1.2.0 - 2026-11-14

### Changes
- **Illustrated header aligned on the other ha-* cards** (and on the flight board card): the round tinted icon of 40 px at the left of the sky, the train icon inside and the brand badge at its bottom right, then the station name and the statistics beside it — instead of a small train icon beside the title. The mini card has the same 40 px icon, with the next train beside it (the station's name in the icon's tooltip). The text still stops where the station starts: nothing moves under it.

## 1.1.0 - 2026-11-14

### Features
- **Brand badge** on the header icon, as on the other multi-brand cards: the logo of the railway behind the detected integration — Deutsche Bahn (DB Infoscreen), National Rail (National Rail UK, National Rail Departure Times, UK Transport), NS (Nederlandse Spoorwegen), SNCF (Train Traveler), SBB (Swiss Transport, Swiss public transport), Trafikverket (Trafikverket Train, its emblem), Trenitalia (ViaggiaTreno, its symbol), SNCB / NMBS (NMBS) — and the Public Transport integration's icon, on a white tile readable in both themes; beside the train icon of the title on the illustrated header, on the round icon of the classic header. The logos are embedded in the bundle; a wide logotype gets a `-mark.svg` emblem for the small badge, and a brand without a logo file gets no badge.
- `brand` (YAML only) picks another bundled logo, e.g. `obb` for a DB Infoscreen station on the ÖBB backend.
- README: the supported railways' logos under the project's icon, and in the Supported integrations table. The wide logotypes of Trafikverket and Trenitalia on a white tile, readable in dark themes; several logos from Simple Icons (CC0), in each brand's colour.

## 1.0.0 - 2026-11-14

First release ([#1](https://github.com/juju35/ha-train-board-card/issues/1)).

### Features
- **Train Board Card** (`custom:train-board-card`): the departures and arrivals board of a railway station — scheduled time, train type pill coloured by family, destination (« from » the origin for arrivals), train number, platform (orange when it changed) and status: on time, « +12 min », boarding, arrived, delayed, cancelled.
- **Animated header**: an original SVG station (hills, building with its canopy, arched windows and a clock whose hand turns, catenary, platform, track) and a generic train that waits at the platform then leaves (Departures) or comes in and stops (Arrivals); the animation starts over when the tab changes, and nothing moves under the title and the statistics (« Departures · 18 trains · 89 % on time »).
- **Night picture**: dark sky with stars and the moon, lit windows and platform lamps, the train's headlight; `illustration_theme: auto | day | night` (auto follows `sun.sun`, else the dark theme), `illustration: false` for a classic header. The « reduce motion » setting keeps the train at the platform.
- **Departures / Arrivals tabs**, the arrivals from a second sensor (`arrival_entity`); options `default_tab`, `show_departures`, `show_arrivals`. Columns and tabs an integration does not provide are not shown.
- **Train details** popup at the top of the card: scheduled and expected times, platform and its change, operator, calling points, disruption messages; closed by a click elsewhere, Escape or leaving the page. **Station notices** above the board.
- Options `max_trains`, `show_platform`, `show_train_number`, `show_via`, `show_messages`, `platforms` and `train_types` filters, `hide_cancelled`, `train_type_colors` (YAML only).
- **Train Board Mini Card** (`custom:train-board-mini-card`): the banner with the next train on its sky (time, « in 8 min », type, destination, platform, status) and a detail button that unfolds the full board; a click elsewhere folds it back.
- **Twelve integrations**, detected from the entity or forced with `integration`: DB Infoscreen, National Rail UK (jfparis), National Rail Departure Times (crismc), Swiss Transport (prusuino), Public Transport (juju35), Train Traveler, and the built-in Nederlandse Spoorwegen, Trafikverket Train, Swiss public transport, ViaggiaTreno, NMBS / SNCB and UK Transport.
- Local times of the integrations read in Home Assistant's time zone; clock times in the profile's 12 / 24 h setting.
- Visual editors for both cards (the mini card's has the unfolded view's options too), minimal YAML.
- 22 languages, English in the bundle and each other language in its own file loaded on demand.
