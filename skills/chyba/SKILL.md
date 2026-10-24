---
name: chyba
description: Zapíše uznanú chybu agenta do registra, pri druhom výskytu tej istej triedy založí úlohu na kontrolu a vypíše hlásenie pre operátora v štyroch vetách. Spusti vždy, keď ty a operátor uznáte chybu agenta (námietku si prijal, našiel si vlastnú chybu), až po oprave a commite súboru, ktorý správanie riadi.
---

# Uznaná chyba

Mechanické kroky robí skript, ty dodáš len úsudok. Hook `objection_fix.mjs`
zastaví ťah, ktorý chybu uzná a skript nespustil (D0142).

## Postup

1. Oprav súbor, ktorý správanie riadi (`PERSONA.md`, `CLAUDE.md`, hook,
   `check.mjs`, nastavenie). Zápis len do pamäte opravou nie je. Commitni
   a pushni.
2. Pomenuj triedu chyby krátkym kľúčom z malých písmen a pomlčiek
   (`todo-po-komentari`, `neoverene-tvrdenie`). Rovnaká príčina je rovnaká
   trieda aj pri inom konkrétnom prípade.
3. Spusti:

   ```
   /opt/agent-rules/bin/chyba.sh --trieda <trieda> --subor <súbor z kroku 1> [--popis "<čo som tvrdil alebo urobil>"] [--pravda "<čo bola pravda>"] [--kontrola "<čo to nabudúce zastaví>"]
   ```

4. Výpis skriptu sú štyri vety hlásenia. Vlož ho do najbližšej odpovede
   operátorovi, aj keď sa nepýta. Druhý výskyt triedy založí v Taskeri
   úlohu na kontrolu pre správcu agentov, jej číslo je vo štvrtej vete.

Skript odmietne súbor, ktorý nie je commitnutý, aby hlásenie malo číslo
commitu opravy. Register je `~/.local/state/agent-rules/chyby.tsv`.
