-- Descuento por fidelidad (Legacy presupuestoDescuentoGlobalPct) on V2 drafts/emits.
ALTER TABLE `v2_presupuestos`
  ADD COLUMN `descuento_fidelidad_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00
    AFTER `servicios_digitales_json`;
