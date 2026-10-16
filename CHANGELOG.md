# Changelog

Alle wesentlichen Änderungen an Vytor werden in dieser Datei dokumentiert.

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
