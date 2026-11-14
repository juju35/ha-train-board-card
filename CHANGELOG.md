# Changelog

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
