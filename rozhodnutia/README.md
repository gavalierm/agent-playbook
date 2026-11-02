# Rozhodnutia

Jeden súbor na rozhodnutie, `D-0001` a ďalej. Píše ich iba skript skillu
uloženia, ručne sa nezapisujú. Index generuje skript lokálne, ručne ho
neupravuj. Opis a dôvody sú v kapitole 4 playbooku.

## Záznam

Hlavička je zoznam `kľúč: hodnota` medzi dvoma riadkami `---`, potom telo.

| pole | význam |
|---|---|
| `id` | `D-` a štyri číslice, pridelí skript |
| `title` | jedna veta, čo sa rozhodlo |
| `what` | čo platí |
| `alternatives` | zamietnuté alternatívy |
| `reason` | dôvod |
| `status` | `platí`, alebo `nahradené` s ID nového záznamu |
| `relates_to` | vec, ktorej sa rozhodnutie týka: cesta súboru, téma alebo názov postupu |
| `supersedes` | ID záznamu, ktorý tento nahrádza |

Telo má najviac päť viet. História je v gite. Súbor sa nemaže, rozhodnutie
sa len nahrádza novým záznamom.

## Pravidlá

- Zapisuje sa rozhodnutie, pri ktorom existovala reálna alternatíva a dôvod
  nie je zrejmý z výsledku.
- Commit, ktorý rozhodnutie realizuje, nesie v správe jeho ID.
- Pred zmenou veci, ktorej sa týka platné rozhodnutie, si ho agent prečíta.
- Poznámka v rozhovore nie je rozhodnutie. Zapíše sa po súhlase operátora
  na text.
