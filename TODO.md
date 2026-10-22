# Vytor – TODO

**Stand:** 22. Oktober 2026

Diese Liste enthält ausschließlich offene Aufgaben. Abgeschlossene Änderungen und Prüfungen stehen im [Changelog](CHANGELOG.md). Browserprüfungen und erfolgreiche Plattform-Exporte ersetzen keine native Geräteabnahme; siehe [Release-Checkliste](docs/RELEASE_CHECKLIST.md).

## P1 – Deployment- und Geräteabnahme

- [ ] **Docker/Caddy-Staging prüfen:** beide Docker-Targets bauen, Compose validieren, echte Proxy-/Header-/TLS-/Portkette und Shutdown testen.
- [ ] **Offsite-Backup abnehmen:** Restic gegen externes Repository ausführen, Alarmzustellung auslösen und vollständigen Restore auf separater Infrastruktur messen.
- [ ] **SecureStore nativ abnehmen:** Legacy-Migration, Offlinefehler, Logout/Accountwechsel, Android Backup/Reinstall und iOS Reinstall auf neuen Builds testen.
- [ ] **iOS-Draft-Datenschutz abnehmen:** Sandbox-Backup-/Reinstall-Verhalten des accountgebundenen AsyncStorage-Drafts auf realem Gerät prüfen und Betreiberentscheidung dokumentieren; Android Auto Backup ist deaktiviert.
- [ ] **Workout-/Session-Races nativ abnehmen:** die automatisierten Save-/Wechsel-/Background-/Account-Races einschließlich Save-Preset, tokenlosem Logout, Passwortänderung, bestätigter Account-Löschung vor/während Sessionwechsel, verzögerter 401, Finish/Cancel/Start/Add/Delete/Move/Replace, A→B→A-Hydration und Delete-Purge auf zwei realen Geräten mit Netzunterbrechung reproduzieren.
- [ ] **Expo-Advisories neu bewerten:** kompatible SDK-57-Patches verfolgen oder SDK-58-Migration separat planen; kein automatisches npm-force-fix.

## P2 – Design-Konsistenz

- [ ] **Theme-Präferenz vollständig anwenden:** `WebBadge` und verbliebene Starter-Komponenten verwenden noch das Betriebssystem-Theme statt konsequent `LIGHT`/`DARK`/`SYSTEM` aus dem App-Theme.

## P3 – Qualitätssicherung und Release

- [ ] **Plattformabnahme abschließen:** Registrierung/Login, Vorlagen, Freunde, Profil, Ranking und Settings auf iOS, Android und Web gemäß Testmatrix durchgehen. Die bestätigte Android-LAN-Verbindung ersetzt diese vollständige Abnahme nicht.
- [ ] **Workout-Geräteabnahme durchführen:** App-Neustart, Gerätewechsel, Offline-/Online-Wechsel, Synchronisationskonflikte und Timer auf echten Geräten testen.
- [ ] **UI und Accessibility abnehmen:** Native Tastatur, Safe Areas, Touch-Ziele, Schriftvergrößerung, Hell-/Dunkelmodus und Screenreader prüfen.
- [ ] **Release abnehmen:** Betreiber-/Store-Daten, Projektzuordnung, Identifier, Signierung und endgültige Datenschutzangaben ergänzen; reale EAS-Builds sowie Store-Submission prüfen.
