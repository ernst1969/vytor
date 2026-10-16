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
- [ ] **Account- und Theme-Finish:** gespeicherte LIGHT/DARK/SYSTEM-Präferenz auf alle noch fest eingefärbten Screens anwenden sowie Passwortänderung und Kontolöschung ergänzen.

## P3 – Konfiguration und Qualität

- [x] **Umgebung konfigurierbar machen:** API-Adresse und Server-Port kommen aus dokumentierten Umgebungsvariablen; sichere Beispieldateien sind vorhanden.
- [x] **Automatisierte Kernlogik testen:** Levelgrenzen, Fortschrittsbereiche und Workout-XP werden mit dem Node-Test-Runner geprüft.
- [ ] **Endgeräte- und Datenbankprüfung:** Migration auf einer echten PostgreSQL-Testdatenbank sowie Registrierung/Login, Workout- und Freundesabläufe auf iOS, Android und Web ausführen.

