/**
 * Editor "Horario por periodos" para firmar.html (variantes piscina verano).
 * Misma forma de payload que PresupuestosInformesPage (DD/MM, diasTipo, horario, diasSemana si PERS).
 */
(function (global) {
  'use strict';

  var DIAS_SEMANA_EMPTY = { lun: false, mar: false, mie: false, jue: false, vie: false, sab: false, dom: false };
  var DIAS_ROWS = [
    { key: 'lun', label: 'Lun' }, { key: 'mar', label: 'Mar' }, { key: 'mie', label: 'Mié' },
    { key: 'jue', label: 'Jue' }, { key: 'vie', label: 'Vie' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
  ];
  var JS_DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  var DIAS_TIPOS = ['LV', 'SD', 'LD', 'PERS'];

  function normDias(d) {
    var b = Object.assign({}, DIAS_SEMANA_EMPTY);
    if (!d || typeof d !== 'object') return b;
    Object.keys(b).forEach(function (k) { if (Object.prototype.hasOwnProperty.call(d, k)) b[k] = !!d[k]; });
    return b;
  }
  function diasPreset(tipo) {
    if (tipo === 'LV') return { lun: true, mar: true, mie: true, jue: true, vie: true, sab: false, dom: false };
    if (tipo === 'SD') return { lun: false, mar: false, mie: false, jue: false, vie: false, sab: true, dom: true };
    if (tipo === 'LD') return { lun: true, mar: true, mie: true, jue: true, vie: true, sab: true, dom: true };
    return Object.assign({}, DIAS_SEMANA_EMPTY);
  }
  function emptyPeriod() {
    return {
      fechaDesde: '', fechaHasta: '', diasTipo: 'LV', diasSemana: Object.assign({}, DIAS_SEMANA_EMPTY),
      turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '',
    };
  }
  function toDateInput(val) {
    if (!val || typeof val !== 'string') return '';
    var v = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!m) return '';
    var d = m[1].padStart(2, '0');
    var mo = m[2].padStart(2, '0');
    var y = m[3] || String(new Date().getFullYear());
    return y + '-' + mo + '-' + d;
  }
  function dateToDDMM(yyyyMmDd) {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '';
    var p = yyyyMmDd.trim().split('-');
    if (p.length !== 3) return yyyyMmDd;
    return p[2].padStart(2, '0') + '/' + p[1].padStart(2, '0');
  }
  function buildHorarioString(t1d, t1h, t2d, t2h) {
    var a = [t1d, t1h].filter(Boolean).join(' - ');
    var b = [t2d, t2h].filter(Boolean).join(' - ');
    if (a && b) return a + ' / ' + b;
    return a || b || '';
  }
  function parseHorarioString(s) {
    if (!s || typeof s !== 'string') return { turn1Desde: '', turn1Hasta: '', turn2Desde: '', turn2Hasta: '' };
    var parts = s.split('/').map(function (x) { return x.trim(); });
    function parseTurn(str) {
      var m = (str || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (!m) return { desde: '', hasta: '' };
      var d = m[1].length === 4 ? '0' + m[1] : m[1];
      var h = m[2].length === 4 ? '0' + m[2] : m[2];
      return { desde: d, hasta: h };
    }
    var t1 = parseTurn(parts[0]);
    var t2 = parts[1] ? parseTurn(parts[1]) : { desde: '', hasta: '' };
    return { turn1Desde: t1.desde, turn1Hasta: t1.hasta, turn2Desde: t2.desde, turn2Hasta: t2.hasta };
  }
  function hydrateRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(function (h) {
      var turns = parseHorarioString(h.horario || '');
      var dt = h.diasTipo;
      return {
        fechaDesde: toDateInput(String(h.fechaDesde || '')),
        fechaHasta: toDateInput(String(h.fechaHasta || '')),
        diasTipo: DIAS_TIPOS.indexOf(dt) >= 0 ? dt : 'LV',
        diasSemana: normDias(h.diasSemana),
        turn1Desde: turns.turn1Desde, turn1Hasta: turns.turn1Hasta,
        turn2Desde: turns.turn2Desde, turn2Hasta: turns.turn2Hasta,
      };
    });
  }
  function serializePeriodos(periodos) {
    return (periodos || []).map(function (p) {
      var diasTipo = DIAS_TIPOS.indexOf(p.diasTipo) >= 0 ? p.diasTipo : 'LV';
      var row = {
        fechaDesde: (p.fechaDesde || '').trim()
          ? (String(p.fechaDesde).indexOf('-') >= 0 ? dateToDDMM(p.fechaDesde) : String(p.fechaDesde).trim())
          : '',
        fechaHasta: (p.fechaHasta || '').trim()
          ? (String(p.fechaHasta).indexOf('-') >= 0 ? dateToDDMM(p.fechaHasta) : String(p.fechaHasta).trim())
          : '',
        diasTipo: diasTipo,
        horario: buildHorarioString(p.turn1Desde, p.turn1Hasta, p.turn2Desde, p.turn2Hasta) || '',
      };
      if (diasTipo === 'PERS') row.diasSemana = normDias(p.diasSemana);
      return row;
    }).filter(function (h) { return h.fechaDesde || h.fechaHasta || h.horario; });
  }
  function horasEntreHoras(desde, hasta) {
    if (!desde || !hasta) return null;
    function toMins(h) {
      var parts = String(h).trim().split(':');
      if (parts.length < 2) return null;
      var mm = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      return isNaN(mm) ? null : mm;
    }
    var m1 = toMins(desde);
    var m2 = toMins(hasta);
    if (m1 == null || m2 == null) return null;
    var diff = m2 - m1;
    return diff >= 0 ? Math.round((diff / 60) * 10) / 10 : null;
  }
  function countDiasTipo(fd, fh, dt) {
    if (!fd || !fh) return null;
    var d1 = new Date(fd.trim() + 'T12:00:00');
    var d2 = new Date(fh.trim() + 'T12:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null;
    var t = String(dt || 'LV').toUpperCase();
    var n = 0;
    var cur = new Date(d1);
    while (cur <= d2) {
      var day = cur.getDay();
      if (t === 'LD') n++;
      else if (t === 'LV') { if (day >= 1 && day <= 5) n++; }
      else if (t === 'SD') { if (day === 0 || day === 6) n++; }
      else return null;
      cur.setDate(cur.getDate() + 1);
    }
    return n;
  }
  function countDiasPers(fd, fh, ds) {
    if (!fd || !fh) return null;
    var d1 = new Date(fd.trim() + 'T12:00:00');
    var d2 = new Date(fh.trim() + 'T12:00:00');
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null;
    var dss = normDias(ds);
    var n = 0;
    var cur = new Date(d1);
    while (cur <= d2) {
      var key = JS_DAY_KEYS[cur.getDay()];
      if (dss[key]) n++;
      cur.setDate(cur.getDate() + 1);
    }
    return n;
  }

  var serverByVariant = {};
  var stateByVariant = {};

  function serverPeriodsForVariant(vi) {
    var arr = global.__PISCINA_HORARIOS_FIRMA || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].piscina_variant_index === vi) return arr[i].horario_por_periodos || [];
    }
    return [];
  }
  function getState(vi) {
    if (!stateByVariant[vi]) {
      var hydrated = hydrateRows(serverPeriodsForVariant(vi));
      stateByVariant[vi] = hydrated.length ? hydrated : [emptyPeriod()];
    }
    return stateByVariant[vi];
  }
  function setServerData(arr) {
    global.__PISCINA_HORARIOS_FIRMA = arr || [];
    serverByVariant = {};
    stateByVariant = {};
  }

  function renderVariant(root, vi, label) {
    var box = document.createElement('div');
    box.className = 'ph-variant';
    box.setAttribute('data-ph-vi', String(vi));
    var periods = getState(vi);
    var title = document.createElement('h4');
    title.className = 'ph-variant-title';
    title.textContent = label || ('Horario por periodos — opción ' + (vi + 1));
    box.appendChild(title);
    var note = document.createElement('p');
    note.className = 'ph-note';
    note.textContent = 'Opcional. Periodos, días aplicables y turnos (orientativo para el PDF).';
    box.appendChild(note);

    function renderPeriods() {
      var list = box.querySelector('.ph-periods');
      if (list) list.remove();
      list = document.createElement('div');
      list.className = 'ph-periods';
      periods.forEach(function (periodo, pi) {
        var wrap = document.createElement('div');
        wrap.className = 'ph-period';
        var h1 = horasEntreHoras(periodo.turn1Desde, periodo.turn1Hasta);
        var h2 = horasEntreHoras(periodo.turn2Desde, periodo.turn2Hasta);
        var horasT = (h1 != null ? h1 : 0) + (h2 != null ? h2 : 0);
        var diasC = periodo.diasTipo === 'PERS'
          ? countDiasPers(periodo.fechaDesde, periodo.fechaHasta, periodo.diasSemana)
          : countDiasTipo(periodo.fechaDesde, periodo.fechaHasta, periodo.diasTipo);
        var diasTxt = '';
        if (diasC != null) {
          diasTxt = ' (' + diasC + ' días';
          if (periodo.diasTipo === 'LV') diasTxt += ' L-V';
          else if (periodo.diasTipo === 'SD') diasTxt += ' S-D';
          else if (periodo.diasTipo === 'LD') diasTxt += ' L-D';
          diasTxt += ')';
        }
        var head = document.createElement('div');
        head.className = 'ph-period-head';
        head.innerHTML = '<span class="ph-period-label">Periodo ' + (pi + 1) + '</span>';
        if (periods.length > 1) {
          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'ph-btn-del';
          del.textContent = 'Eliminar';
          del.onclick = function () {
            periods.splice(pi, 1);
            if (periods.length === 0) periods.push(emptyPeriod());
            stateByVariant[vi] = periods;
            renderPeriods();
          };
          head.appendChild(del);
        }
        wrap.appendChild(head);
        var fechas = document.createElement('div');
        fechas.className = 'ph-row';
        fechas.innerHTML = '<label class="ph-lbl">Desde</label>';
        var i1 = document.createElement('input');
        i1.type = 'date';
        i1.className = 'ph-in';
        i1.value = periodo.fechaDesde || '';
        i1.onchange = function () { periodo.fechaDesde = i1.value; renderPeriods(); };
        fechas.appendChild(i1);
        fechas.appendChild(document.createTextNode(' → '));
        var i2 = document.createElement('input');
        i2.type = 'date';
        i2.className = 'ph-in';
        i2.value = periodo.fechaHasta || '';
        i2.onchange = function () { periodo.fechaHasta = i2.value; renderPeriods(); };
        fechas.appendChild(i2);
        var spanD = document.createElement('span');
        spanD.className = 'ph-dias-hint';
        spanD.textContent = diasTxt;
        fechas.appendChild(spanD);
        wrap.appendChild(fechas);
        var selRow = document.createElement('div');
        selRow.className = 'ph-row';
        selRow.innerHTML = '<label class="ph-lbl">Días</label>';
        var sel = document.createElement('select');
        sel.className = 'ph-sel';
        [['LV', 'Lunes a viernes (L-V)'], ['SD', 'Sábado a domingo (S-D)'], ['LD', 'Lunes a domingo (L-D)'], ['PERS', 'Personalizada']].forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o[0];
          opt.textContent = o[1];
          sel.appendChild(opt);
        });
        sel.value = periodo.diasTipo || 'LV';
        sel.onchange = function () {
          var prevTipo = periodo.diasTipo || 'LV';
          var v = sel.value;
          periodo.diasTipo = v;
          if (v === 'PERS') periodo.diasSemana = diasPreset(prevTipo === 'PERS' ? 'LV' : prevTipo);
          renderPeriods();
        };
        selRow.appendChild(sel);
        wrap.appendChild(selRow);
        if (periodo.diasTipo === 'PERS') {
          var pers = document.createElement('div');
          pers.className = 'ph-pers';
          DIAS_ROWS.forEach(function (dr) {
            var lab = document.createElement('label');
            lab.className = 'ph-check';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!periodo.diasSemana[dr.key];
            cb.onchange = function () {
              periodo.diasSemana = normDias(periodo.diasSemana);
              periodo.diasSemana[dr.key] = cb.checked;
              renderPeriods();
            };
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(' ' + dr.label));
            pers.appendChild(lab);
          });
          wrap.appendChild(pers);
        }
        function turnRow(label, pref, hlab) {
          var r = document.createElement('div');
          r.className = 'ph-row ph-turn';
          var lbl = document.createElement('label');
          lbl.className = 'ph-lbl';
          lbl.textContent = label + (hlab != null ? ' (' + hlab + ' h)' : '');
          r.appendChild(lbl);
          var a = document.createElement('input');
          a.type = 'time';
          a.className = 'ph-time';
          a.value = periodo[pref + 'Desde'] || '';
          a.onchange = function () { periodo[pref + 'Desde'] = a.value; renderPeriods(); };
          var b = document.createElement('input');
          b.type = 'time';
          b.className = 'ph-time';
          b.value = periodo[pref + 'Hasta'] || '';
          b.onchange = function () { periodo[pref + 'Hasta'] = b.value; renderPeriods(); };
          r.appendChild(a);
          r.appendChild(document.createTextNode(' – '));
          r.appendChild(b);
          return r;
        }
        wrap.appendChild(turnRow('Turno 1', 'turn1', h1));
        wrap.appendChild(turnRow('Turno 2', 'turn2', h2));
        if (horasT > 0 && diasC != null && diasC > 0) {
          var tot = document.createElement('p');
          tot.className = 'ph-total';
          tot.textContent = 'Total aprox. en periodo: ' + (Math.round(horasT * diasC * 10) / 10) + ' h';
          wrap.appendChild(tot);
        }
        list.appendChild(wrap);
      });
      box.appendChild(list);
    }
    renderPeriods();
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'ph-btn-add';
    addBtn.textContent = '+ Añadir periodo';
    addBtn.onclick = function () {
      periods.push(emptyPeriod());
      stateByVariant[vi] = periods;
      renderPeriods();
    };
    box.appendChild(addBtn);
    root.appendChild(box);
  }

  function sync(rootId, visibleVariantIndices) {
    var root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = '';
    if (!visibleVariantIndices || visibleVariantIndices.length === 0) {
      root.style.display = 'none';
      return;
    }
    root.style.display = 'block';
    var h3 = document.createElement('h3');
    h3.className = 'horario-firma-main-title';
    h3.textContent = 'Horario de la piscina (por periodos)';
    root.appendChild(h3);
    visibleVariantIndices.sort(function (a, b) { return a - b; }).forEach(function (vi) {
      var label = visibleVariantIndices.length > 1 ? 'Opción ' + (vi + 1) + ' (variante elegida)' : 'Su oferta';
      renderVariant(root, vi, label);
    });
  }

  function collectPayload(visibleVariantIndices) {
    var out = [];
    (visibleVariantIndices || []).forEach(function (vi) {
      var periods = stateByVariant[vi] || getState(vi);
      var serialized = serializePeriodos(periods);
      out.push({ piscina_variant_index: vi, horario_por_periodos: serialized });
    });
    return out;
  }

  global.FirmarPiscinaHorario = {
    setServerData: setServerData,
    sync: sync,
    collectPayload: collectPayload,
  };
})(typeof window !== 'undefined' ? window : this);
