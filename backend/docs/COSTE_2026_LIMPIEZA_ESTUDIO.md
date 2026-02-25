# COSTE 2026 limpieza.xlsx – Estudio para sistema Limpieza

## Fuente
- **Archivo:** `COSTE 2026 limpieza.xlsx`
- **Hoja:** `- LIMP - 2025 - valois`
- **Columnas:** A = Descripción, B = Precio/Cantidad, C = Cantidad, D = Resultado (fórmulas)

---

## Estructura de celdas y fórmulas

| Fila | A (descripción) | B | C | D (fórmula / valor) |
|------|------------------|---|---|---------------------|
| 1 | CONSERJERÍA | | | convenio 2023 |
| 2 | (nombre empleado) | | | **1485** ← convenio base mensual (€) |
| 3 | (detalle horario) | HORAS SEM. | | |
| 4 | SMI ANUAL... 40 H./SEMANA | **40** | | **D4 = D2*12** → 17820 |
| 6 | SALARIO ANUAL 1 CONSERJE PARA 40 H./SEM | | | **D6 = D4/39*B4** → 18276,92 |
| 8 | MES DE VACACIONES CONSERJE (1/12) | | | **D8 = D6/12/30*31** → 1573,85 |
| 10 | VACACIONES SUPLENTE-LIQUIDACION (1/12) | | | **D10 = D8/12** → 131,15 |
| 12 | SERVICIOS EXTRA-VARIOS (HORAS EXTRA ANUAL...) | **B12 = D6/156** | **12** | **D12 = B12*C12** → 1405,92 |
| 14 | TOTAL SALARIOS: | | | **D14 = D6+D8+D10+D12** → 21387,84 |
| 16 | CUOTAS SEGURIDAD SOCIAL ANUAL (**35%**) | | | **D16 = (D6+D8+D10)*0.35** → 6993,67 |
| 18 | TOTAL COSTE SALARIAL POR EMPLEADO AÑO | | | **D18 = D14+D16** → 28381,51 |
| 20 | UNIFORMIDAD ANUAL | 150 | 2 | D20 = B*C → 300 |
| 22 | GESTORÍA ANUAL | 120 | 2 | D22 = B*C → 240 |
| 24 | PRODUCTOS LIMPIEZA ANUAL | 150 | 12 | D24 = B*C → 1800 |
| 26 | LIMPIEZA GAJARE (250 €/LIMPIEZA) | 450 | 2 | D26 = B*C → 900 |
| 28 | ACRISTALADO (125 €/ACRISTALADO) | 250 | 1 | D28 = B*C → 250 |
| 30 | CRISTALERO | 90 | 0 | D30 = B*C |
| 32 | CUBOS | 8 | (vacío) | D32 = B*C |
| 34 | TELEFONO | 22 | 0 | D34 = B*C*12 |
| 36 | VIGILANT | 8.4 | 2 | D36 = B*C*12 → 201,60 |
| 38 | GASTOS FIJO/HORAS SERVICIO (ANUAL) | 1.1 | **C38 = B4** (40) | **D38 = B38*C38*4.33*12** → 2286,24 |
| 40 | BENEFICIO EMPRESARIAL (ANUAL) | 150 | 1 | **D40 = C40*B40*12** → 1800 |
| 42 | SUMA VARIOS | | | **D42 = SUM(D20:D40)** → 7777,84 |
| 44 | IVA (21%) | | | **D44 = (D18+D42)*0.21** → 7593,46 |
| 46 | TOTAL PRESUPUESTO POR AÑO (IVA INCLUIDO) | | | **D46 = D18+D42+D44** → 43752,82 |
| 48 | PRESUPUESTO POR MES SIN IVA | | | **D48 = D46/1.21/12+1.98** → 3015,26 |
| 51 | (mes con IVA) | | | **D51 = D48+D48*21%** → 3648,46 |

---

## Diferencias clave vs Auxiliares

| Concepto | Auxiliares (COSTE 2026 (1).xlsx) | Limpieza (COSTE 2026 limpieza.xlsx) |
|----------|----------------------------------|--------------------------------------|
| Horas referencia | B4 = horas a cubrir/semana (ej. 56) | B4 = 40 (horas/semana) |
| Salario anual 1 empleado | D6 = (D4/40)*B4 (D4 = SMI mensual×12) | D6 = D4/39*B4 (D4 = D2*12) |
| Divisor salario | 40 | **39** |
| Vacaciones | D8 = D6/12/30*31 (igual idea) | D8 = D6/12/30*31 |
| Suplente | D10 = D8/12 | D10 = D8/12 |
| Servicios extra | B12 = D6/156, C12 = horas, D12 = B12*C12 | Igual: B12 = D6/156, D12 = B12*C12 |
| Seguridad Social | **37%** (D16 = (D6+D8+D10)*0.37) | **35%** (D16 = (D6+D8+D10)*0.35) |
| Presupuesto mes sin IVA | D52 = D50/1.21/12 | **D48 = D46/1.21/12+1.98** (ajuste +1.98) |
| Beneficio anual | D40 con otra fórmula | D40 = C40*B40*12 |
| Gastos fijo/horas | Similar | D38 = B38*C38*4.33*12, C38 = B4 |

---

## Inputs necesarios para el formulario Limpieza

1. **Convenio base mensual (€)** → D2 (ej. 1485)
2. **Horas por semana** → B4 (40 en el ejemplo)
3. **Servicios extra (horas anuales)** → C12 (12 en el ejemplo)
4. **Uniformidad:** precio B20, cantidad C20
5. **Gestoría:** B22, C22
6. **Productos limpieza:** B24, C24 (12 meses)
7. **Limpieza Gajare:** B26, C26
8. **Acristalado:** B28, C28
9. **Cristalero:** B30, C30
10. **Cubos:** B32, C32
11. **Teléfono:** B34, C34 (×12)
12. **Vigilancia:** B36, C36 (×12)
13. **Gastos fijo/hora:** B38 (1.1), C38 = B4 (horas/sem)
14. **Beneficio empresarial:** B40 (150), C40 (1) → D40 = B40*C40*12

Constantes a usar:
- Divisor salario anual: **39** (en lugar de 40)
- Seguridad Social: **35%**
- Presupuesto mes sin IVA: **D46/1.21/12 + 1.98**

---

## Resumen para implementación

- Replicar la lógica de **PresupuestosInformesPage** para un bloque **Limpieza** (estado `presupuestoCalculoLimpieza`, `presupuestoResultadoLimpieza` con D2, D4, D6, D8, D10, D12, D14, D16, D18, D20–D42, D44, D46, D48, D51).
- En la tabla Resumen (DESCRIPCION | MENSUALIDAD | ANUALIDAD), cuando el servicio sea tipo `limpieza`, rellenar con D48 (mensual sin IVA), D48×1.21 (mensual con IVA), D46/1.21 o equivalente (anual sin IVA), D46 (anual con IVA).
- Opción: mismo formulario “varios” (uniformidad, gestoría, productos, etc.) que en Auxiliares pero con valores por defecto y fórmulas según este Excel.
