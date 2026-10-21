# Vytor – technischer Datenschutzentwurf

Kein Rechtsgutachten und keine Behauptung von DSGVO-Konformität. Verantwortlicher, Rechtsgrundlagen, Pflichttexte, Auftragsverarbeitung, Betroffenenprozesse und Store-Angaben müssen Betreiber/Rechtsberatung freigeben.

## Verarbeitete Daten und Speicherorte

| Kategorie | Zweck | Speicher |
| --- | --- | --- |
| Username, Anzeigename, Profilbild | Konto/soziale Darstellung | PostgreSQL; App-Cache/API |
| Passwort-Hash | Authentifizierung | PostgreSQL, bcrypt cost 12; nie Klartext |
| Session-Hash, Ablauf, Zeit | Login/Widerruf | PostgreSQL; Token nur SecureStore bzw. Web-Sessionstorage |
| Workouts, Übungen, Sätze, Notizen, Zeiten | Training/Verlauf/Synchronisation | PostgreSQL und kontogetrennter lokaler Draft |
| XP, Level, Rang | Fortschritt/Leaderboard | PostgreSQL; Username/XP/Rang für angemeldete Nutzer sichtbar |
| Freundschaften/Anfragen | Social-Funktion | PostgreSQL |
| Settings/Feedback | Personalisierung/Support | PostgreSQL; Feedback intern, kein Mailversand |
| Request-ID/technische Fehler | Betrieb/Sicherheit | Containerlogs; keine Bodies/Tokens/Passwörter |

## Empfänger und Dienstleister

Vorgesehen: Hetzner für VPS, DNS-Anbieter, verschlüsselter externer Backupanbieter, Git-/CI-Anbieter und Expo/EAS für native Builds. Konkrete Anbieter, Regionen, AV-Verträge und internationale Transfers sind vor Betrieb einzutragen und zu prüfen. Profilbilder liegen als Data-URL in PostgreSQL; kein separates Medien-CDN.

## Sichtbarkeit

Angemeldete Nutzer können Username, Anzeigename, Avatar, XP/Level/Rang anderer Nutzer finden. Exakte Workout-Zeitpunkte und Workout-Details liefert die API nur dem Eigentümer und bestätigten Freunden. Freundeslisten sind nur für den Eigentümer abrufbar. Das globale Leaderboard ist für angemeldete Nutzer sichtbar. Diese Produktentscheidungen müssen Teilnehmerinformationen entsprechen.

## Aufbewahrung und Löschung

- Sessions: 30 Tage Ablauf; abgelaufene Zeilen sollten regelmäßig gelöscht werden (Betriebsjob noch festzulegen).
- Primärdaten: bis Kontolöschung oder Betreiber-Retention. Feedback-Retention ist noch festzulegen.
- Kontolöschung: Sessions, Workouts/Sätze, XP, Vorlagen, Einstellungen, Feedback und Freundschaften werden kaskadiert/gelöscht. Eigene Übungen werden gelöscht, sofern unreferenziert; bei legitimer Fremdreferenz bleiben sie archiviert und mit neutralem Namen ohne Beschreibung/Kategorie/Owner erhalten.
- Backups: geplant 14 tägliche Stände. Gelöschte Daten können bis Ablauf enthalten sein; Restore-Abgleich/Löschjournal ist Betreiberaufgabe.
- Ein Datenexport-Endpunkt existiert nicht. Manueller Exportprozess oder Produktfeature muss vor öffentlichem Release entschieden werden.

## Technische Maßnahmen

TLS über Caddy, feste Proxy-Vertrauenskette, keine öffentlichen DB/API-Ports, gehashte Tokens, bcrypt, Rate Limits, IDOR-Prüfungen, Input-/Bodylimits, transaktionale Datenintegrität, least-privilege DB-Rolle, verschlüsselte Offsite-Backups, reduzierte Fehlerlogs und native sichere Tokenspeicherung. Webtoken bleibt bei XSS zugänglich; CSP/Webhosting und ein späterer HttpOnly-Cookie-Flow sind vor breiter Webveröffentlichung zu bewerten.

## Offene Entscheidungen

Verantwortlicher/Impressum/Kontakt, Rechtsgrundlagen/Einwilligungen, Altersgrenze, Anbieter/AVV, Aufbewahrungsfristen, Auskunft/Portabilität, Backup-Löschabgleich, Incident-Meldeprozess, Store Privacy Labels, öffentliche Ranking-Opt-outs, Profilbildmoderation und Lösch-/Beschwerde-SLA.
