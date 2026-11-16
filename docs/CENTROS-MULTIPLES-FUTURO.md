# Centre multiple pe angajat

Partea de horario este în cod din 9 nov 2026. `CENTRO TRABAJO` rămâne centrul principal. Centrele în plus stau în `empleado_centros` și aduc fiecare horarioul săptămânal al aceluiași grup. Cuadrante și `horario_multicentro` nu se amestecă cu horarioul: dacă omul are cuadrante în ziua aia, se folosește doar cuadrante.

Festivii pe zonă rămân separați și merg și cu un singur centru.

## De ce nu acum

La Hera un angajat are un singur centru. `horario_multicentro` și `cuadrante` sunt goale. Orele de azi vin din `horarios`, un șablon pe centru + grup, împărțit de toți oamenii acelui centru (la Timbales sunt 6, la Señorío del Pinar 8).

Dacă i-am pune Mariei două centre și i-am încărca ambele orare, iar amândouă sunt luni–vineri dimineața, apare cu două ture în aceeași oră. Pe o sărbătoare locală nu se mai știe care tură cade.

## Ce vrem când îl facem

1. `CENTRO TRABAJO` rămâne centrul principal, ca ecranele vechi să nu se rupă.
2. Centrele în plus stau într-o listă: angajat + comunitate.
3. Fiecare bloc de ore rămâne al unui centru. Orașul blocului iese din `POBLACION` a comunității, aceeași regulă ca la festivii pe zonă.
4. Dacă orele nu se suprapun (dimineața Madrid, după-amiaza Alcalá), se încarcă toate. Sărbătoarea locală oprește doar blocul din orașul care e liber.
5. Dacă două centre cer același interval, nu se dublează tura. Se vede conflictul și se alege centrul din ziua aia.
6. Cine are un singur centru rămâne pe orarul de acum.
7. Cine nu are niciun centru nu primește orarul tuturor centrelor firmei.

## Ce nu refolosim orbește

`horario_multicentro` este deja un rând pe angajat, lună și client, dar la Hera nu e folosit. Poate deveni programul pe zi după ce există lista de centre. Până atunci, zona din ziua de fichaj (pentru cine nu are centru) rămâne alegerea de la festivos, nu un centru.
