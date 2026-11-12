#!/usr/bin/env python3
"""Aplica una actualización semanal a data.js (conservadora) y data2.js (moderada).

Uso: python3 tools/apply_update.py update.json

update.json:
{
  "asof": "2026-11-13",                       # fecha de valuación (último dato disponible, YYYY-MM-DD)
  "month_ends": ["2026-11-30"],               # opcional: cierres de mes ocurridos desde la última corrida (último día hábil)
  "nav": {                                    # valor cuotaparte por fecha (valor real, ej. 1.0123); diario, incl. fines de semana si los hay
    "short":   {"2026-11-10": 1.0105, "...": 0},
    "income":  {...}, "latam": {...}, "balanced": {...}, "global": {...}
  },
  "prices": {                                 # cierre MEP (USD) por fecha, para asof y para cada month_end nuevo
    "PLC5O": {"2026-11-13": 1.07}, "TTCDO": {...}, "YMCXO": {...},
    "SPYD":  {"2026-11-13": 13.2}, "QQQD": {...}
  }
}
Cada archivo usa solo los fondos/instrumentos que tiene (se ignora el resto).
También mueve a `coupons` los flujos de `flows` con fecha <= asof.
"""
import json, sys, datetime as dt, re

def load(f):
    s = open(f).read()
    m = re.match(r'(const DATA = )(.*?);?\s*$', s, re.S)
    return m.group(1), json.loads(m.group(2))

def save(f, pre, d):
    open(f, 'w').write(pre + json.dumps(d, separators=(',', ':')) + ';\n')

def day(s): return dt.date.fromisoformat(s)

def apply(f, u):
    pre, d = load(f)
    start = day(d['start'])
    asof = u['asof']
    if asof < d['last']:
        sys.exit(f'{f}: asof {asof} es anterior a last {d["last"]}')
    # NAV
    for k, arr in d['nav'].items():
        new = u['nav'].get(k)
        if not new:
            sys.exit(f'{f}: faltan NAV de {k}')
        for ds, v in sorted(new.items()):
            i = (day(ds) - start).days
            val = round(float(v) * 1e5)
            while len(arr) < i: arr.append(arr[-1])   # relleno de huecos con el valor previo
            if i < len(arr): arr[i] = val
            else: arr.append(val)
        if len(arr) - 1 < (day(asof) - start).days:   # NAV publicada con rezago: se arrastra el último valor
            print(f'AVISO {f}: {k} NAV llega a {start + dt.timedelta(len(arr)-1)}, asof {asof}; se arrastra último valor')
    # fechas de corte
    dates = d['dates'][:-1] if d['dates'][-1] == d['last'] and d['last'] not in d['dates'][:-1] else d['dates'][:]
    for me in u.get('month_ends', []):
        if me not in dates: dates.append(me)
    dates = sorted(set(dates))
    dates.append(asof)  # el último siempre es la valuación actual
    d['dates'] = dates; d['last'] = asof
    # precios
    insts = {**d['on'], **d.get('etp', {})}
    for tk, o in insts.items():
        for ds, v in u['prices'].get(tk, {}).items():
            o['price'][ds] = float(v)
        miss = [x for x in dates if x not in o['price']]
        if miss: sys.exit(f'{f}: {tk} sin precio en {miss}')
        # (se podan precios de fechas que ya no son punto de corte, salvo la de inicio)
        for x in list(o['price']):
            if x not in dates and x != d['start']: del o['price'][x]
    # cupones cobrados
    keep = []
    for fl in d['flows']:
        if fl['date'] <= asof:
            ex = fl.get('ex', fl['date'])
            d['on'][fl['tk']]['coupons'].append({'pay': fl['date'], 'ex': ex, 'perVN': round(fl['per100k'] / 1e5, 7)})
        else: keep.append(fl)
    d['flows'] = keep
    save(f, pre, d)
    print(f'{f}: OK asof={asof} dates={len(dates)} flows_restantes={len(keep)}')

if __name__ == '__main__':
    u = json.load(open(sys.argv[1]))
    for f in ('data.js', 'data2.js'):
        apply(f, u)
