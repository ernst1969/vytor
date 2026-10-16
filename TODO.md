# Vytor – TODO

**Stand:** 16. Oktober 2026

Diese Liste enthält ausschließlich offene Aufgaben. Abgeschlossene Änderungen und Prüfungen stehen im [Changelog](CHANGELOG.md). Browserprüfungen und erfolgreiche Plattform-Exporte ersetzen keine native Geräteabnahme; siehe [Release-Checkliste](docs/RELEASE_CHECKLIST.md).

## P1 – Workout-Zuverlässigkeit

- [ ] **Entwürfe vollständig validieren:** Einzelne Satzobjekte beim Speichern prüfen, insbesondere `sets: [null]` ablehnen. Die Wiederherstellung gegen fehlerhafte gespeicherte Satzobjekte absichern.
- [ ] **Pausierte Workouts verlustfrei fortsetzen:** Ungesendete lokale Änderungen vor dem Wechsel sichern; den ausstehenden Debounce-Speichervorgang vor dem Laden eines anderen Entwurfs abschließen.
- [ ] **Versionsprüfung beim Umordnen ergänzen:** Die Workout-Revision atomar prüfen und erhöhen, damit ein veraltetes Gerät keine neuere Übungsreihenfolge überschreibt.

## P2 – Satzverwaltung

- [ ] **Drop-Sets stabil zuordnen:** Ursprung und Drop-Set dauerhaft verknüpfen. Einfügen oder Löschen benachbarter Sätze darf die Zuordnung und Markierung nicht verändern.

## P3 – Design-Konsistenz

- [ ] **Theme-Präferenz vollständig anwenden:** `WebBadge` und verbliebene Starter-Komponenten verwenden noch das Betriebssystem-Theme statt konsequent `LIGHT`/`DARK`/`SYSTEM` aus dem App-Theme.

## P4 – Qualitätssicherung und Release

- [ ] **Social-Regressionsfälle ergänzen:** Ablehnen und Zurückziehen von Anfragen sowie Entfernen eines Freundes automatisiert gegen PostgreSQL testen.
- [ ] **Plattformabnahme abschließen:** Registrierung/Login, Vorlagen, Freunde, Profil, Ranking und Settings auf iOS, Android und Web gemäß Testmatrix durchgehen. Die bestätigte Android-LAN-Verbindung ersetzt diese vollständige Abnahme nicht.
- [ ] **Workout-Geräteabnahme durchführen:** App-Neustart, Gerätewechsel, Offline-/Online-Wechsel, Synchronisationskonflikte und Timer auf echten Geräten testen.
- [ ] **UI und Accessibility abnehmen:** Native Tastatur, Safe Areas, Touch-Ziele, Schriftvergrößerung, Hell-/Dunkelmodus und Screenreader prüfen.
- [ ] **Release abnehmen:** Betreiber-/Store-Daten, Projektzuordnung, Identifier, Signierung und endgültige Datenschutzangaben ergänzen; reale EAS-Builds sowie Store-Submission prüfen.
