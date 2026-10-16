# Vytor – nächste Aufgaben

Diese Liste basiert auf dem dokumentierten Entwicklungsstand vom 16. Oktober 2026 und den 13 geplanten Verbesserungen aus dem Produkt-Board. Bereits abgeschlossene technische Arbeiten bleiben dokumentiert; neue Aufgaben sind nach Abhängigkeiten und Nutzerwirkung priorisiert. Die offenen Punkte wurden nicht erneut im Code verifiziert.

## P0 – Projekt wieder ausführbar machen (abgeschlossen)

- [x] **Datenmodell vereinheitlichen:** Prisma-Schema, Migrationen und Anwendungscode verwenden einheitlich `measurementType`, `ExerciseMeasurementType`, `MI` und `requesterId`/`recipientId`. Prisma-Client, Schema-Validierung und Offline-Schemaerzeugung sind geprüft.
- [x] **TypeScript- und Seed-Fehler beheben:** App- und Server-Typecheck sowie Expo-Lint laufen erfolgreich.

## P1 – Workout-Kern und Fehlerbehebung

- [x] **Aktive Übungen vollständig synchronisieren:** Hinzufügen, Entfernen, Ersetzen und Umordnen sind an Backend-Endpunkte angebunden.
- [x] **Aktives Workout wiederherstellen oder abbrechen:** Entwurf, Sätze und Timer werden lokal wiederhergestellt und gegen das offene Backend-Workout geprüft; Abbrechen löscht das offene Workout.
- [x] **Eingaben und Abschluss absichern:** Pflichtwerte werden je Messart validiert; Sätze, Abschluss und XP-Vergabe laufen in einer Transaktion.
- [ ] **Gespeicherte Workouts laden:** Fehler beim Laden gespeicherter Workouts reproduzieren und beheben; Lade-, Fehler- und Leerzustände sowie API-/Session-Verhalten prüfen.
- [ ] **Letzte Workouts öffnen:** Nicht reagierende Einträge unter „Recent Workouts“ reparieren; Navigation zu Workout-Details auf iOS, Android und Web testen.
- [ ] **Workout-Aktionen immer sichtbar halten:** „Finish Workout“ und „End Workout“ (Abbrechen/Verwerfen) während des Trainings zuverlässig erreichbar machen, inklusive Safe Areas und Tastatur; bestehende Bestätigungsdialoge erhalten.
- [ ] **Satzoptionen erweitern:** Beim Antippen eines Satzes „Warm-Up“, „Regular“, „Drop-Set“ und „Delete Set“ anbieten. Beim Drop-Set direkt unter dem gewählten Satz einen zugehörigen zusätzlichen Satz anlegen und dessen Zuordnung und Darstellung dauerhaft speichern.
- [ ] **Pausentimer flexibilisieren:** Statische Timer-Vorgabe entfernen; Dauer frei wählen und je Übung individuell anpassen. Persistenz und Wiederherstellung des aktiven Timers berücksichtigen.

## P2 – Produkt-Systeme und UX

- [x] **Echte Authentifizierung einführen:** 30-Tage-Bearer-Sessions schützen private API-Routen; ungültige Sessions und Netzwerkfehler werden getrennt behandelt.
- [x] **Levelling-System implementieren:** Workout-Abschlüsse vergeben einmalig Basis-XP plus Satz-XP; quadratische Levelkurve, XP-Ereignisse und Fortschritt sind serverseitig gespeichert und getestet.
- [x] **Rank-System implementieren (Grundlage):** Globales XP-Ranking mit Gleichständen, API-Endpunkt und Top-5-Profilansicht ersetzen die bisherigen Attrappen.
- [x] **Freunde-System abschließen (Grundlage):** Anfrage senden, annehmen, ablehnen und zurückziehen sowie Freund entfernen sind angebunden; Profile verwenden echten Status und echte Trainingsaktivität.
- [x] **Settings ausbauen (Grundlage):** Gewichts-/Distanzeinheit, Standard-Pausendauer und Darstellungspräferenz werden serverseitig gespeichert; Einheiten und Pausendauer wirken auf neue Workouts. Logout beendet die Server-Session.
- [x] **Workout-Bedienung vervollständigen (Grundlage):** Die Tab-Leiste besitzt plattformgerechte Symbole und vor dem Abschluss oder Verwerfen eines Workouts erscheint eine Bestätigung.
- [x] **Workout-Vorlagen verwalten:** Persönliche Vorlagen können erstellt, bearbeitet und gelöscht werden; die globale Starter-Vorlage bleibt schreibgeschützt.
- [x] **Übungs-Messarten korrigieren:** Kraft-, Körpergewichts-, Zeit-, Distanz-/Zeit- und Gewicht-/Distanzübungen verwenden passende Eingabefelder; bestehende Daten werden per Migration berichtigt.
- [ ] **Workout-Presets speichern:** Trainingskonfigurationen als wiederverwendbare Presets speichern und laden; mit bestehenden Workout-Vorlagen abgleichen, damit keine doppelte Funktion entsteht.
- [ ] **Übung hinzufügen oben rechts platzieren:** „Add Exercise“ im Workout-Screen oben rechts erreichbar machen.
- [ ] **Einheiten in Übungsoptionen verschieben:** Gewichts- und Distanzeinheiten aus den allgemeinen Einstellungen in die Optionen der jeweiligen Übung verlagern; bestehende Werte und Umrechnungen korrekt übernehmen.
- [ ] **Rankings überarbeiten:** Rank-Darstellung und Zugriff auf globale Ranglisten ausarbeiten; vorhandenen XP-Ranking-Endpunkt wiederverwenden.
- [ ] **Profil personalisieren:** Profilbild, Anzeigename und eindeutigen Benutzernamen im Format `@xyz` ergänzen; Bearbeitung, Validierung und Anzeige auf Profilen vorsehen.
- [ ] **Global Ranking im Profil anpassen:** Nur den eigenen globalen Rang anzeigen, basierend auf XP; als „Level X“ statt ausschließlich als XP-Wert darstellen. Rang und Level fachlich getrennt halten.
- [ ] **Leaderboard in Friends-Tab verschieben:** Ranglistenansicht aus dem bisherigen Bereich in den Freunde-Tab integrieren und Navigation aktualisieren.
- [ ] **Account- und Theme-Finish:** Gespeicherte `LIGHT`/`DARK`/`SYSTEM`-Präferenz auf alle noch fest eingefärbten Screens anwenden, konsistente helle Darstellung sicherstellen sowie Passwortänderung und Kontolöschung ergänzen.

## P3 – Konfiguration und Qualität

- [x] **Umgebung konfigurierbar machen:** API-Adresse und Server-Port kommen aus dokumentierten Umgebungsvariablen; sichere Beispieldateien sind vorhanden.
- [x] **Automatisierte Kernlogik testen:** Levelgrenzen, Fortschrittsbereiche und Workout-XP werden mit dem Node-Test-Runner geprüft.
- [ ] **Endgeräteprüfung:** Registrierung/Login, Workout-, Vorlagen- und Freundesabläufe auf iOS, Android und Web vollständig ausführen. Insbesondere gespeicherte und letzte Workouts, Satztypen/Drop-Sets, Timer, dauerhafte Workout-Aktionen, Themes und Profil-/Ranking-Navigation testen.
