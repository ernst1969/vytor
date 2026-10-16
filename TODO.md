# Vytor – TODO

**Stand:** 16. Oktober 2026
**Basis:** implementierter Repository-Stand und automatisierte Prüfungen gegen PostgreSQL.
**Hinweis:** Implementierung und vollständige Abnahme werden getrennt. Der TODO-Audit hat offene Randfälle in zuvor abgehakten Punkten festgestellt. Browserprüfungen ersetzen keine nativen Gerätetests; Details unter P4 und in `docs/RELEASE_CHECKLIST.md`.

## P0 – Technische Grundlagen (abgeschlossen)

- [x] **Datenmodell vereinheitlichen:** `measurementType`, `ExerciseMeasurementType`, `MI` und `requesterId`/`recipientId` in Schema, Migrationen und Code konsistent verwenden; Prisma-Validierung und Offline-Schemaerzeugung prüfen.
- [x] **TypeScript- und Seed-Fehler beheben:** App-/Server-Typecheck und Expo-Lint erfolgreich ausführen.
- [x] **API-Konfiguration:** API-Adresse und Server-Port über Umgebungsvariablen konfigurieren; Beispieldateien bereitstellen.
- [x] **Authentifizierung:** Bearer-Sessions (30 Tage), geschützte private Routen und getrennte Behandlung ungültiger Sessions und Netzwerkfehler.
- [x] **Kernlogik testen:** Levelgrenzen, XP und Workout-Fortschritt automatisiert prüfen.

## P1 – Kritische Fehler und Workout-Zuverlässigkeit

- [x] **Aktive Übungen synchronisieren:** Hinzufügen, Entfernen, Ersetzen und Umordnen über Backend-Endpunkte.
- [ ] **Aktives Workout wiederherstellen/abbrechen (Grundlage):** Entwurf, Sätze und Timer lokal sichern, mit offenem Backend-Workout abgleichen; Abbrechen entfernt offenes Workout.
- [ ] **Satzvalidierung und Abschluss absichern:** Eingaben je Messart validieren; Sätze, Abschluss und XP-Vergabe transaktional speichern.
- [x] **Gespeicherte Workouts laden:** Fehler reproduzieren und beheben; API, Session, Lade-/Leer-/Fehlerzustände prüfen.
- [x] **Recent Workouts öffnen:** Klickbare Einträge und Navigation zu Workout-Details reparieren; nur berechtigte Nutzer sehen vollständige Details. Für andere Profile die eigene zugängliche Trainingsübersicht darstellen, keine zufälligen fremden Workouts.
- [ ] **Aktives Workout kontoübergreifend synchronisieren:** Beim Login auf einem anderen Gerät ein bereits offenes Workout erkennen und fortsetzen; konkurrierende Starts verhindern bzw. kontrolliert behandeln. Lokale Wiederherstellung mit dem Serverzustand abgleichen.
- [x] **Übung im Workout löschen:** Fehler beheben, bei dem Übungen auf dem Workout-Screen nicht entfernt werden können; Backend-Synchronisation und Wiederherstellung testen.
- [x] **Workout-Aktionen dauerhaft sichtbar:** „Finish Workout“ und „End Workout“/Verwerfen am unteren Bildschirmrand erreichbar halten; Safe Areas, Scrollbereich und Tastatur berücksichtigen; Bestätigungen beibehalten.
- [x] **„Start Workout“ am unteren Bildschirmrand:** Button in der Übungsauswahl fixieren und auf iOS, Android und Web korrekt darstellen.
- [x] **Freundschaftsanfragen reparieren:** Fehler „Cannot send friend requests“ reproduzieren; Request-Endpunkt, Berechtigungen, Status und Fehlermeldungen prüfen.
- [x] **Profilbilder anderer Nutzer anzeigen:** Fehlende Bilder in öffentlichen Profilen/Freundesansichten beheben; Fallback und Zugriffsregeln prüfen.

## P2 – Workout-Funktionen und Übungsverwaltung

- [x] **Workout-Vorlagen verwalten (Grundlage):** Eigene Vorlagen erstellen, bearbeiten und löschen; globale Starter-Vorlage schreibgeschützt halten.
- [x] **Messarten korrekt abbilden (Grundlage):** Kraft-, Körpergewichts-, Zeit-, Distanz-/Zeit- und Gewicht-/Distanzübungen mit passenden Feldern und Datenmigration.
- [x] **Workout-Bedienung (Grundlage):** Bestätigung vor Abschluss/Verwerfen und plattformgerechte Tab-Symbole.
- [x] **Vorlagen-Auswahl überarbeiten:** „Starter Workout“ aus der Auswahl entfernen bzw. bewusst migrieren; Auswahl aktualisieren und Vorlagen direkt als Sets vorbereiten.
- [x] **Vorlagen-Optionen ergänzen:** Zahnrad-/Menüsymbol je Vorlage für Bearbeiten, Löschen und weitere Aktionen; globale/systemeigene Vorlagen schützen.
- [x] **Workout-Presets klären und umsetzen:** Wiederverwendbare Trainingskonfigurationen speichern/laden; prüfen, ob dies durch vorhandene Vorlagen abgedeckt werden kann, statt Doppelstrukturen zu schaffen.
- [x] **Zielwiederholungen je Satz:** Übungen/Vorlagen mit Ziel-Reps und optionalen „Ghost“-Orientierungswerten ausstatten; Anzeige und Persistenz definieren.
- [ ] **Satztypen und Drop-Sets:** Antippen eines Satzes öffnet Warm-Up, Regular, Drop-Set und Delete Set; Drop-Set unmittelbar unter dem Ursprungssatz hinzufügen, visuell verbinden, ursprünglichen Satz mit „D“ markieren und Drop-Set nicht als separaten regulären Satz zählen.
- [x] **Satzoptionen erweitern:** „Add another Set“ direkt unter dem ausgewählten Satz; zugehörigen Satz gezielt löschen können.
- [x] **Pausentimer pro Übung:** Statische Vorgabe entfernen, freie Dauer wählen und pro Übung speichern; Timer beim Wiederherstellen korrekt fortsetzen.
- [x] **„Rest after set“ anpassen:** Nicht als erste Option anzeigen; zusätzliche Aktion „Set Timer“ mit Eingabe `mm:ss` anbieten.
- [x] **Zeiteingabe vereinheitlichen:** Anzeige `hh:mm:ss`; Zifferneingabe wie bei einem Geldbetrag (z. B. `123` → `00:01:23`) mit klarer Validierung.
- [x] **„Add Exercise“ oben rechts:** Schaltfläche im aktiven Workout oben rechts platzieren.
- [x] **Einheiten in Übungsoptionen verschieben:** Gewicht/Distanz pro Übung statt nur in allgemeinen Einstellungen wählen; Umrechnung, Persistenz und Historie konsistent halten.
- [x] **Einheiten im aktiven Workout platzsparend anzeigen:** `kg`/`lb` bzw. Distanz direkt hinter dem Eingabefeld statt im Feld; Platz für Zielwerte schaffen.
- [x] **Eigene Übungen erstellen:** Name, Messart und ggf. Kategorie konfigurieren; nur selbst angelegte Übungen bearbeiten/löschen.
- [x] **Sportartspezifische Satzbezeichnungen:** Bei Boxing/ähnlichen Übungen „Session“ statt „Set“, bei Kraftübungen weiterhin „Set“ anzeigen.
- [x] **Workout-Notizen:** Allgemeine Notizen oberhalb der Übungsliste speichern und anzeigen.
- [x] **Übungsanmerkungen:** Dauerhafte Hinweise/Form-Cues unter dem Übungsnamen und vor den Sätzen anzeigen.
- [x] **Workout-Abschluss prüfen:** Vor „Finish Workout“ Checkliste für nicht abgeschlossene Sätze anzeigen; bewusste Bestätigung ermöglichen.
- [x] **Abschlussdialoge gestalten:** „Finish Workout“ und ähnliche Pop-ups konsistent mit dem App-Theme gestalten.
- [x] **Workout-Ergebnisbildschirm:** Nach Abschluss Gesamt-XP mit Fortschrittsbalken, XP je Übung, 1RM für gewichtete Übungen und Highlights (mehr Wiederholungen bei gleichem Gewicht bzw. mehr Gewicht bei gleichen Wiederholungen) anzeigen.

## P3 – Profil, Social, Ranking und Design

- [x] **Levelling (Grundlage):** Basis- und Satz-XP einmalig vergeben; Levelkurve, XP-Ereignisse und Fortschritt serverseitig verwalten.
- [x] **Rankings (Grundlage):** Globales XP-Ranking mit Gleichständen, API-Endpunkt und Top-5-Profilansicht.
- [x] **Freunde (Grundlage):** Anfragen senden/annehmen/ablehnen/zurückziehen, Freund entfernen, echte Status- und Trainingsdaten anbinden.
- [x] **Settings (Grundlage):** Einheiten, Standardpause und Theme-Präferenz speichern; Logout beendet Session.
- [x] **Rank-System ausgestalten:** Ränge, Schwellenwerte und Darstellung definieren; vorhandene XP-Daten und Ranking-Endpunkt verwenden.
- [x] **Global Ranking im Profil vereinfachen:** Nur eigenen globalen Rang anzeigen; Level als „Level X“ darstellen, ohne Rang und Level zu verwechseln.
- [x] **Leaderboard in Friends-Tab verschieben:** Navigation und Zugänglichkeit aktualisieren.
- [x] **Profil personalisieren:** Profilbild, Anzeigename und eindeutiger `@username`; Upload, Bearbeitung, Validierung und Anzeige in eigenen/fremden Profilen.
- [x] **Profilbild-Darstellung korrigieren:** Rahmen im Profil-Tab konsistent rund gestalten.
- [x] **Muskelübersicht integrieren:** Muskelgrafik aus OpenGym nur bei zulässiger Lizenz übernehmen bzw. eigenständig erstellen; Vytor-Farbton nach Trainingsbelastung, nur indirekt beanspruchte Muskeln heller darstellen.
- [ ] **Helles Theme vervollständigen:** `LIGHT`/`DARK`/`SYSTEM` konsequent auf alle Screens, Modals und Komponenten anwenden.
- [x] **Freestyle-Auswahl bereinigen:** Unerwünschten Rahmen um „FREESTYLE“ entfernen.
- [x] **Übungssuche verbessern:** X-Schaltfläche zum Leeren des Suchfeldes.
- [x] **Settings vereinfachen:** Doppelte/unnötige Einheitenauswahl nach Verlagerung entfernen; Zeitwahl für Standard-Pausentimer anbieten.
- [x] **Feedback in Settings:** Möglichkeit für Nutzerfeedback ergänzen, inklusive Zustellung und Datenschutz-Hinweis.
- [x] **Offline-Nutzung vorbereiten:** Lokale Speicherung für Training bei schlechter Verbindung; Synchronisations- und Konfliktstrategie definieren.
- [x] **Account-Verwaltung:** Passwortänderung und Kontolöschung einschließlich serverseitiger Bereinigung und Bestätigung.

## P4 – Qualitätssicherung und Release

- [x] **Integrationsprüfung mit echter Datenbank:** Sämtliche Migrationen, Seed, Login und private Endpunkte gegen PostgreSQL in einem isolierten Testschema geprüft (`npm run test:integration`).
- [ ] **Plattformtests:** iOS, Android und Web für Registrierung/Login, Workouts, Vorlagen, Freunde, Profil, Ranking und Settings durchgehen.
- [ ] **Workout-Regressionsfälle (Geräteabnahme):** API-/Logiktests für Gerätewechsel, Konflikte, parallele Starts, Übungsersatz/-löschung, Satztypen, Zeit und Abschluss bestehen. App-Neustart, Offline/Online-Wechsel und Timer müssen auf Endgeräten gemäß Testmatrix abgenommen werden.
- [ ] **Social-Regressionsfälle (API):** Anfragen, fremde Profilbilder, Sichtbarkeit und Berechtigungen gegen PostgreSQL geprüft; visuelle Geräteabnahme bleibt Teil der Plattformtests.
- [ ] **UI-/Accessibility-Prüfung:** Kleine Displays, Safe Areas, Tastatur, Touch-Ziele, Hell-/Dunkelmodus und Screenreader.
- [ ] **Release-Abnahme:** EAS-Preview-/Production-/Submit-Konfiguration und CI sind vorbereitet. Projekt-/Store-Zuordnung, Identifier, Signierung, reale Builds und endgültige Datenschutzangaben benötigen Betreiber-/Store-Daten.

## Empfohlene Umsetzungsreihenfolge

1. Gespeicherte/letzte Workouts, Löschen von Übungen und Freundschaftsanfragen reparieren.
2. Geräteübergreifende Workout-Fortsetzung und dauerhaft sichtbare Start-/Finish-/End-Aktionen.
3. Satztypen/Drop-Sets, Timer und Eingabe-/Abschlusslogik.
4. Vorlagen, Zielwiederholungen, eigene Übungen und Notizen.
5. Profile, Rankings, Freundesansichten und Themes.
6. Offline-Synchronisierung, Endgeräteprüfung und Release-Vorbereitung.

## Umsetzungsentscheidungen und Grenzen

- Vorlagen sind die einzige Preset-Struktur; „Save as reusable preset“ übernimmt Ziele, Satztypen, Einheiten, Pausen und Cues.
- Die globale Starter-Vorlage bleibt für historische Referenzen erhalten, wird aber aus der Auswahl ausgeblendet.
- Offline-Vorbereitung umfasst kontoabhängige Entwürfe, Wiederherstellung, Wiederholungsversuche und explizite Konflikte. Neue Starts, strukturelle Übungsänderungen und Abschluss brauchen weiterhin eine Verbindung.
- Die Muskelkarte nutzt die in OpenGym separat als MIT ausgewiesenen MuscleMap-Konturen mit vollständiger Attribution. Darstellung und Bewegungs-/Kategoriezuordnung sind Vytor-eigen; keine OpenGym-AGPL-Anwendungslogik wurde übernommen.
- Feedback wird serverseitig im internen Datenbankeingang gespeichert, mit Hinweis vor dem Senden; kein externer E-Mail-Dienst ist konfiguriert.
- Die historische Messartenmigration wurde für saubere Neuinstallationen repariert. Bestehende Installationen werden durch eine neue additive Migration erweitert; kein Datenbank-Reset.

## Workout-Layout – umgesetzt und separat geprüft

- [x] Einheitliche Spalten für Header/Zeilen aller Messarten, integrierte Einheiten, 48-Punkte-Zeilen und einzeiliges SESSION.
- [x] Mobile/Tablet/Desktop-Breite, Kartenabstände, lange Übungsnamen und Footer außerhalb des Scrollbereichs.
- [x] Anatomische Vorder-/Rückansicht mit direkter/indirekter Kupferfärbung, Zeitraumfilter, Körperformauswahl und MIT-Lizenzhinweisen.
- [x] Browserprüfung bei 320/360/390/768/1440 px mit simulierten APIs; fünf UI-/Geometrie-Tests.

## Noch offene Befunde aus dem TODO-Audit

- Workout-Sortierung besitzt keine Versionsprüfung; ein veraltetes Gerät kann die Reihenfolge überschreiben.
- Entwürfe erlauben ungültige einzelne Satzobjekte, die eine Wiederherstellung verhindern können.
- Beim Wechsel auf einen pausierten Entwurf müssen ungesendete Änderungen vor dem Laden gesichert werden.
- Drop-Sets brauchen eine stabile Zuordnung zum Ursprung, auch beim Einfügen/Löschen benachbarter Sätze.
- Einzelne Starter-Komponenten berücksichtigen die App-Theme-Präferenz noch nicht konsequent.
- Social-Tests müssen Ablehnen, Zurückziehen und Entfernen eines Freundes zusätzlich abdecken.
