# Vytor – nächste Aufgaben

Diese Liste basiert auf dem untersuchten Stand vom 16. Oktober 2026. Sie ist bewusst kurz und nach Abhängigkeiten priorisiert.

## P0 – Projekt wieder ausführbar machen

- [x] **Datenmodell vereinheitlichen:** Prisma-Schema, Migrationen und Anwendungscode verwenden einheitlich `measurementType`, `ExerciseMeasurementType`, `MI` und `requesterId`/`recipientId`. Prisma-Client, Schema-Validierung und Offline-Schemaerzeugung sind geprüft.
- [x] **TypeScript- und Seed-Fehler beheben:** App- und Server-Typecheck sowie Expo-Lint laufen erfolgreich.

## P1 – Workout-Kern fertigstellen

- [x] **Aktive Übungen vollständig synchronisieren:** Hinzufügen, Entfernen, Ersetzen und Umordnen sind an Backend-Endpunkte angebunden.
- [x] **Aktives Workout wiederherstellen oder abbrechen:** Entwurf, Sätze und Timer werden lokal wiederhergestellt und gegen das offene Backend-Workout geprüft; Abbrechen löscht das offene Workout.
- [x] **Eingaben und Abschluss absichern:** Pflichtwerte werden je Messart validiert; Sätze, Abschluss und XP-Vergabe laufen in einer Transaktion.

## P2 – Produkt-Systeme vervollständigen

- [x] **Echte Authentifizierung einführen:** 30-Tage-Bearer-Sessions schützen private API-Routen; ungültige Sessions und Netzwerkfehler werden getrennt behandelt.
- [x] **Levelling-System implementieren:** Workout-Abschlüsse vergeben einmalig Basis-XP plus Satz-XP; quadratische Levelkurve, XP-Ereignisse und Fortschritt sind serverseitig gespeichert und getestet.
- [x] **Rank-System implementieren:** globales XP-Ranking mit Gleichständen, API-Endpunkt und Top-5-Profilansicht ersetzen die bisherigen Attrappen.
- [x] **Freunde-System abschließen:** Anfrage senden, annehmen, ablehnen und zurückziehen sowie Freund entfernen sind angebunden; Profile verwenden echten Status und echte Trainingsaktivität.
- [x] **Settings ausbauen:** Gewichts-/Distanzeinheit, Standard-Pausendauer und Darstellungspräferenz werden serverseitig gespeichert; Einheiten und Pausendauer wirken auf neue Workouts. Logout beendet die Server-Session.
- [x] **Workout-Bedienung vervollständigen:** Die Tab-Leiste besitzt plattformgerechte Symbole und vor dem Abschluss oder Verwerfen eines Workouts erscheint eine Bestätigung.
- [x] **Workout-Vorlagen verwalten:** Persönliche Vorlagen können erstellt, bearbeitet und gelöscht werden; die globale Starter-Vorlage bleibt schreibgeschützt.
- [x] **Übungs-Messarten korrigieren:** Kraft-, Körpergewichts-, Zeit-, Distanz-/Zeit- und Gewicht-/Distanzübungen verwenden passende Eingabefelder; bestehende Daten werden per Migration berichtigt.
- [ ] **Account- und Theme-Finish:** gespeicherte LIGHT/DARK/SYSTEM-Präferenz auf alle noch fest eingefärbten Screens anwenden sowie Passwortänderung und Kontolöschung ergänzen.

## P3 – Konfiguration und Qualität

- [x] **Umgebung konfigurierbar machen:** API-Adresse und Server-Port kommen aus dokumentierten Umgebungsvariablen; sichere Beispieldateien sind vorhanden.
- [x] **Automatisierte Kernlogik testen:** Levelgrenzen, Fortschrittsbereiche und Workout-XP werden mit dem Node-Test-Runner geprüft.
- [ ] **Endgeräteprüfung:** Registrierung/Login, Workout-, Vorlagen- und Freundesabläufe auf iOS, Android und Web vollständig ausführen.

