# Manuelle Plattform- und Release-Prüfung

Stand: 16. Oktober 2026. Automatisierte API-/Logiktests und Plattformexport sind separat dokumentiert. Diese Liste ist keine Behauptung, dass Gerätetests bereits stattgefunden haben.

| Ablauf | iOS | Android | Web |
| --- | --- | --- | --- |
| Registrierung, Login, Logout, abgelaufene Session | offen | offen | offen |
| Foto auswählen, Anzeigename und Username ändern; fremdes Bild/Fallback | offen | offen | offen |
| Vorlage erstellen, Ziele ändern, starten und löschen | offen | offen | offen |
| Eigene Übung erstellen/bearbeiten/archivieren | offen | offen | offen |
| Satz einfügen/löschen; Warm-up und verbundene Drop-Sätze | offen | offen | offen |
| Zeitfolge 1 → 12 → 123; ungültige Minute/Sekunde ablehnen | offen | offen | offen |
| Pausentimer, Neustart und vergangenes Timer-Ende | offen | offen | offen |
| Notizen, Form-Cues, Einheitentausch und historische Umrechnung | offen | offen | offen |
| Offline Sätze ändern, App neu starten, wieder verbinden | offen | offen | offen |
| Zweites Gerät: fortsetzen, gleichzeitig ändern, Konflikt bewusst auflösen | offen | offen | offen |
| Übung entfernen/ersetzen/sortieren; Neustart kontrollieren | offen | offen | offen |
| Unfertige Sätze im Abschlussdialog; Ergebnis/Highlights | offen | offen | offen |
| Abbruch bestätigen; kein offenes Training nach Neustart | offen | offen | offen |
| Anfragen senden/annehmen/ablehnen/zurückziehen; Freund entfernen | offen | offen | offen |
| Recent Workouts, Freundesfeed, eigene/fremde Detailberechtigung | offen | offen | offen |
| Leaderboard und eigenen globalen Rang kontrollieren | offen | offen | offen |
| Helles/dunkles/System-Theme samt Dialogen und Systemwechsel | offen | offen | offen |
| Feedback, Passwortwechsel, erneuter Login, Kontolöschung | offen | offen | offen |

## Bedienung und Accessibility

- Kleine Displays und große Systemschrift prüfen; keine überlappenden Eingaben.
- Notch/Home-Indikator, Tastaturöffnung und dauerhaft sichtbare Start-/Finish-/End-Aktionen prüfen.
- VoiceOver/TalkBack und Web-Tastatur: Feldnamen, Fokusfolge, Dialogfokus, Fehlermeldungen, Progressbar.
- Touch-Ziele, Bild-Fallback und Kontraste beider Themes prüfen.
- Langsame/unterbrochene Verbindung und HTTP 401/403/409 getrennt durchspielen.

## Veröffentlichung

- Eigenes EAS-Projekt, iOS Bundle Identifier und Android Package Identifier festlegen.
- Öffentliche HTTPS-API je EAS-Environment konfigurieren und private Backend-Variablen getrennt halten.
- Migrationen auf einer gesicherten Zielinstallation prüfen; Erhalt älterer offener Workouts als pausierte Entwürfe und ihre Wiederaufnahme prüfen.
- Interne Preview-Builds signieren und obige Matrix auf realen Geräten abnehmen.
- Datenschutzhinweise für Profilbilder, Trainingsdaten, Sessions und Feedback sowie Betreiber-/Kontaktinformationen vervollständigen.
- Store-Datenschutzangaben, Screenshots, Signierung und Kontolöschung prüfen.
- Production-Build und Submission erst mit zugeordneten Store-Konten durchführen.
- EAS Update vor OTA-Nutzung gesondert konfigurieren; native Änderungen erfordern neue Builds.
