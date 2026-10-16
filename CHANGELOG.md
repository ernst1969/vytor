# Changelog

Alle wesentlichen Änderungen an Vytor werden in dieser Datei dokumentiert.

## 2026-10-16 – Home-Redesign, Rest-Day-Streak und Settings

### Added

- Rest-Day-Streak aus eindeutigen lokalen Workout-Abschlusstagen: Bis zu zwei Ruhetage zwischen Trainings erhalten die Serie; ohne weiteres Workout verfällt sie erst zu Beginn des fünften Tages. Mehrere Workouts am selben Tag zählen einmal.
- Gemeinsamer Fortschrittsbalken und Tageswechsel-Hook: Aktualisierung bei Home-Fokus, nach Abschluss/Neuladen, lokaler Mitternacht und Rückkehr aus dem Hintergrund, ohne separate Streak-Persistenz oder Polling.
- Zehn Streak-Tests einschließlich Zeitzonen, Sommerzeit und Ablaufgrenze; insgesamt 16 UI-/Geometrie-/Kalender-/Streak-Tests.

### Changed

- Home an `vytor_home_design_variante_2.png` ausgerichtet: kleinere Wortmarke, angepasste Typografie und Abstände, dunkle Karten sowie dezenteres Orange (`#E89235`) mit passendem Start-Button-Verlauf.
- Progress zeigt echte Monats-Workouts, Day Streak und globalen Rang. Der vorhandene Start-Flow sowie Level-/XP-/Ranking-Berechnungen bleiben erhalten.
- Recent Workouts auf Home ohne Icons, mit lokalen Tagesangaben, Dauer und Detailnavigation; zunächst drei Einträge, weitere über „See all“.
- Profil zeigt zwei Reihen à sieben Tageskacheln für die letzten 14 Tage inklusive heute. Je Tag erscheint die Muscle-Load-Vorschau des zuletzt abgeschlossenen Workouts; Tage ohne Training bleiben leer. Separate Muskel-Chips, Legende und Filter entfernt.
- Friends-Leaderboard in einheitlichen Zeilen mit Rang, Namen, Level und XP; lange Namen, Trennlinien und Activity-Karten vereinheitlicht.
- Settings als aufklappbare Buttons mit aktuellen Werten; Minuten-/Sekundenfelder für den Pausentimer. Logout ist ein eigener Button, Kontolöschung steht separat in der Danger Zone.
- Zentrale Theme-/Layout-Tokens, responsive Übersichten und konsistente Navigation mit vier bestehenden Tabs.
- TODO auf offene Aufgaben reduziert; abgeschlossene Einträge und doppelte Audit-Befunde entfernt.

### Fixed

- Entwürfe akzeptieren `restSeconds: null` als fehlende individuelle Pause. Dadurch scheitert das Speichern vor dem Workout-Abschluss nicht mehr mit „Invalid draft exercise“.
- Ungültiger JSX-Leerzeichen-Textknoten im Footer der Übungsauswahl entfernt.

### Validation und lokale Entwicklung

- Lint, App-/Server-Typecheck, UI-/Logiktests und PostgreSQL-Integration geprüft; zusätzliche Regression für Speichern, Wiederherstellen und Abschluss mit leerer Pausenvorgabe sowie ungültige Pausenwerte.
- Browserprüfung bei 320/344/360/390/768/1440 px: Workout-Flow, Tageskacheln, Settings, Home-Navigation, stabile Motivationssprüche, Leaderboard-Gleichstände, Theme-Wechsel und Streak-Verfall um Mitternacht ohne zusätzliche Historienabfrage.
- Exporte für Web, iOS und Android erfolgreich; native Geräte- und Release-Abnahme bleiben offen.
- Android-LAN-Verbindung nach Netzwerkdiagnose vom Nutzer als funktionierend bestätigt. Eine auf WLAN-Adresse und lokales Subnetz beschränkte Windows-Firewall-Freigabe für API-Port 3000 wurde lokal angelegt; sie ist keine versionierte App-Konfiguration. Die einzelne Netzwerkursache wurde nicht abschließend isoliert.

## 2026-10-16 – Responsives Workout-Layout und anatomische Muskelkarte

- Gemeinsame Spalten für Überschriften und Eingaben aller fünf Messarten; 48-Punkte-Zeilen, einzeiliges SESSION und Einheiten innerhalb des Feldrahmens ohne Überlagerung.
- Volle mobile Inhaltsbreite, begrenzte Desktopbreite, konsistente Kartenabstände, lange Übungsnamen und unverrückte Drop-Markierungen.
- Footer außerhalb des Scrollbereichs, automatische Tastatur-Scrollhilfe und ausgeblendete Tab-Leiste bei Tastatureingabe.
- Set-/Session-Bezeichnungen in Satzaktionen, Abschlusscheckliste und Detailansicht vereinheitlicht.
- Anatomische MuscleMap-Konturen aus OpenGyms separat MIT-lizenzierten Geometriedaten; Vorder-/Rückseite, zwei Körperformen, Zeitraumfilter, interaktive Muskeln und hellere indirekte Kupfertöne.
- Eigene detaillierte Bewegungs-/Kategoriezuordnung und vollständige Drittanbieterhinweise; keine AGPL-Anwendungslogik übernommen.
- Expo-kompatibles `react-native-svg`, fünf UI-/Geometrietests und Browser-Prüfskript für fünf Bildschirmbreiten.
- Bestehende API-Schnittstellen, Datenmodelle und Workout-Geschäftslogik bleiben erhalten. Offene Punkte aus dem TODO-Audit sind separat gekennzeichnet.

## 2026-10-16 – TODO-Umsetzung

### Added

- Versionierte Workout-Entwürfe mit kontoabhängigem Offline-Cache, Wiederholungsversuchen, Wiederherstellung nach Login und expliziter Geräte-Konfliktauflösung.
- Partieller Datenbankindex gegen parallele aktive Workouts; atomarer Übungsersatz. Ältere doppelte offene Trainings bleiben als wiederaufnehmbare pausierte Entwürfe erhalten.
- Workout-Notizen, dauerhafte persönliche Form-Cues sowie gespeicherte Einheiten und Pausen je Übung.
- Persönliche Übungen mit Editor, Kategorie, Messart und historienerhaltender Archivierung.
- Presets auf Basis bestehender Vorlagen inklusive Zielen je Satz, Satztypen, Einheiten und Pausen.
- Freie Timer, validierte Zifferneingabe für `hh:mm:ss`, Einfügen einzelner Sätze und Drop-Set-Verbindungen.
- Ergebnisansicht mit Gesamt-/Übungs-XP, Levelbalken, Epley-1RM und Verbesserungen gegenüber früheren Trainings.
- XP-Ränge Bronze/Silver/Gold/Platinum/Diamond und eigenständig erstellte Muskelübersicht für direkte/indirekte Belastung.
- Zentrales Hell-/Dunkel-/System-Theme, plattformübergreifende Bestätigungsdialoge und Avatar-Fallback.
- Feedbackeingang mit Datenschutzhinweis, Passwortänderung mit Session-Widerruf und bestätigte Kontolöschung.
- Acht Unit-/Logiktests, isolierte PostgreSQL-/HTTP-Integrationssuite, GitHub-Checks, EAS-Profile und manuelle Release-Testmatrix.

### Changed

- Start- und Finish-/Verwerfen-Aktionen bleiben am unteren Bildschirmrand erreichbar; Übung hinzufügen steht oben rechts.
- Leaderboard steht im Friends-Tab; das eigene Profil trennt „Level X“, XP-Rang und globalen Rang.
- Workout-Details werden gezielt geladen und für Besitzer sowie bestätigte Freunde freigegeben; andere Profile verlinken die eigene Trainingsübersicht.
- Die alte Starter-Vorlage wird aus der Auswahl ausgeblendet; globale Vorlagen bleiben geschützt.
- Einheiten stehen direkt hinter den Eingaben und werden in Übungsoptionen gewählt; Settings bieten eine freie Standardpause.
- Bildauswahl fordert keine Kamera-/Mikrofonberechtigungen mehr an.

### Fixed

- Freundschaftsanfragen scheitern nicht mehr am fehlenden Prisma-Pflichtfeld `updatedAt`; konkurrierende Anfragen werden je Nutzerpaar serialisiert.
- Historische Messartenmigration verwendet das gewählte Schema, konvertiert `MILES` korrekt und erhält vorhandene Messarten.
- Übungslöschung und Sortierung melden Backend-Fehler sichtbar; Übungsersatz verliert bei Fehlern keine ursprüngliche Übung.
- Profilbilder werden in öffentlichen Profilen und Freundeslisten angezeigt; Profilrahmen sind rund.
- Freestyle-Suchfeld lässt sich leeren, Auswahl lässt sich zurücknehmen, selbst erstellte Übungen erscheinen nach Rückkehr im Picker.
- Leere Abschlüsse vergeben keine XP; Einheiten, doppelte Sätze, veraltete Versionen und Vorlagenkonfigurationen werden geprüft.
- Unfertige lokale Änderungen werden beim Neustart nicht stillschweigend durch Serverdaten überschrieben.

### Validation

- Lint, App-/Server-Typecheck, Unit-Tests, vollständige Migrationskette/Seed und echte API-Tests gegen PostgreSQL geprüft.
- Expo Doctor: 21/21 Prüfungen erfolgreich. Additive Migration auf der lokalen Entwicklungsdatenbank angewendet.
- Expo-Export für iOS, Android und Web erfolgreich; manuelle Geräte- und Store-Abnahmen bleiben ausdrücklich offen.

## 2026-10-16

### Added

- Plattformgerechte Symbole für Home, Freunde, Profil und Einstellungen in der Tab-Leiste.
- Bestätigungsdialog vor dem Abschließen eines Workouts; Abbrechen bleibt ebenfalls abgesichert.
- Persönliche Workout-Vorlagen mit Erstellen, Bearbeiten und Löschen.
- Besitzerzuordnung für persönliche Vorlagen; globale Seed-Vorlagen bleiben schreibgeschützt.
- Serverseitige 30-Tage-Sessions mit Bearer-Token und Logout.
- XP-Ereignisse, quadratische Levelkurve und globale Rangliste mit Gleichständen.
- Profilfortschritt, Top-5-Ranking und echte Aktivitätsdaten auf Freundesprofilen.
- Persistenz und Wiederherstellung aktiver Workouts sowie expliziter Workout-Abbruch.
- Backend-Synchronisierung für Entfernen, Ersetzen und Sortieren aktiver Übungen.
- Einstellungen für Gewichts-/Distanzeinheit, Pausendauer und Darstellungspräferenz.
- Ablehnen und Zurückziehen von Freundschaftsanfragen sowie Entfernen von Freunden.
- Umgebungsbeispiele für API, Datenbank und Server-Port.
- Unit-Tests für Level-, Fortschritts- und XP-Regeln.

### Changed

- Der Übungskatalog verwendet passende Messarten: Kampfsport und statische Übungen erfassen Zeit, Cardio Distanz und Zeit, Körpergewichtsübungen Wiederholungen und Carries Gewicht und Distanz.
- Eine Datenmigration korrigiert Messarten bereits vorhandener Übungen, damit beispielsweise Muay Thai keine Gewichtsangabe mehr anzeigt.
- Prisma-Schema, Migrationen, Seed und API verwenden einheitliche Mess-, Distanz- und Freundschaftsfelder.
- Workout-Abschluss speichert Sätze, Abschlusszeit und XP atomar in einer Transaktion.
- Neue Workouts übernehmen die bevorzugten Einheiten; der Pausentimer nutzt die gespeicherte Dauer.
- App- und Server-TypeScript-Konfigurationen sind getrennt und der Server verwendet ESM.
- Expo-Pakete wurden auf die von SDK 57 erwarteten Patchversionen gebracht und native Abhängigkeiten dedupliziert.

### Fixed

- Vorlagen erzeugen vollständige Übungen für alle unterstützten Messarten.
- Netzwerkfehler beim App-Start melden den Benutzer nicht mehr automatisch ab.
- Fest eingetragene Level-, Rang- und Freundesaktivitätswerte wurden entfernt.
- Bestehende Theme-, Style-, Seed- und API-Typfehler wurden behoben.

### Security

- Private API-Routen benötigen eine gültige Session und prüfen den angemeldeten Benutzer bei privaten Ressourcen.
- Passwörter bleiben mit bcrypt und Kostenfaktor 12 gehasht; Session-Token werden nur als SHA-256-Hash gespeichert.
