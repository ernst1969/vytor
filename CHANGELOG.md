# Changelog

Alle wesentlichen Änderungen an Vytor werden in dieser Datei dokumentiert.

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
