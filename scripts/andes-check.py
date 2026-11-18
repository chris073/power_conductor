"""ANDES check for a Conductor study export.

Loads the PSS/E RAW (and DYR when given), runs power flow, asserts convergence and, when a DYR
is given, runs a short flat time-domain simulation. Optionally writes the power-flow solution as
JSON for Conductor's results import (Study page > Import results).

    .venv-study/Scripts/python scripts/andes-check.py case.raw [case.dyr] [--tf 2] [--json out.json]

Exit code 0 when power flow converges (and TDS, if run, completes); 1 otherwise.
"""

import argparse
import datetime
import json
import math
import sys

import andes


def flows(ss):
    """Branch flows (MW / Mvar at each end) from the solved pi model of every ANDES Line."""
    line = ss.Line
    bus_idx = list(ss.Bus.idx.v)
    v = dict(zip(bus_idx, ss.Bus.v.v))
    a = dict(zip(bus_idx, ss.Bus.a.v))
    mva = ss.config.mva
    out = []
    for i, idx in enumerate(line.idx.v):
        b1, b2 = line.bus1.v[i], line.bus2.v[i]
        if line.u.v[i] == 0:
            out.append({'index': i, 'from': b1, 'to': b2, 'pFrom': 0, 'qFrom': 0, 'pTo': 0, 'qTo': 0})
            continue
        r, x = line.r.v[i], line.x.v[i]
        g, b = line.g.v[i] if hasattr(line, 'g') else 0.0, line.b.v[i]
        g1, b1s = line.g1.v[i], line.b1.v[i]
        g2, b2s = line.g2.v[i], line.b2.v[i]
        tap, phi = line.tap.v[i], line.phi.v[i]
        y = 1 / complex(r, x)
        v1 = v[b1] * complex(math.cos(a[b1]), math.sin(a[b1]))
        v2 = v[b2] * complex(math.cos(a[b2]), math.sin(a[b2]))
        m = tap * complex(math.cos(phi), math.sin(phi))
        ysh1 = complex(g1 + g / 2, b1s + b / 2)
        ysh2 = complex(g2 + g / 2, b2s + b / 2)
        i1 = (v1 / m - v2) * y / m.conjugate() + v1 * ysh1 / (tap * tap)
        i2 = (v2 - v1 / m) * y + v2 * ysh2
        s1 = v1 * i1.conjugate() * mva
        s2 = v2 * i2.conjugate() * mva
        out.append({'index': i, 'from': b1, 'to': b2, 'pFrom': s1.real, 'qFrom': s1.imag, 'pTo': s2.real, 'qTo': s2.imag})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('raw')
    ap.add_argument('dyr', nargs='?')
    ap.add_argument('--tf', type=float, default=2.0, help='TDS end time in seconds (default 2)')
    ap.add_argument('--json', help='write the power-flow solution here')
    args = ap.parse_args()

    andes.config_logger(stream_level=30)
    kw = {'addfile': args.dyr} if args.dyr else {}
    # PV.pv2pq: enforce generator Q limits (a PV bus at its limit becomes PQ), as PSS/E does.
    ss = andes.load(args.raw, setup=True, no_output=True, default_config=True, config_option=['PV.pv2pq=1'], **kw)
    if ss is None:
        print('ANDES could not load the case.')
        return 1

    print(f'ANDES {andes.__version__}: {ss.Bus.n} buses, {ss.Line.n} lines/transformers, '
          f'{ss.PQ.n} loads, {ss.PV.n} PV + {ss.Slack.n} slack generators, {ss.Shunt.n} shunts')
    ss.PFlow.run()
    ok = bool(ss.PFlow.converged)
    print(f'Power flow: {"CONVERGED" if ok else "DID NOT CONVERGE"} in {ss.PFlow.niter} iterations '
          f'(mismatch {ss.PFlow.mis[-1] if ss.PFlow.mis else float("nan"):.3e})')
    for idx, name, vm, va in zip(ss.Bus.idx.v, ss.Bus.name.v, ss.Bus.v.v, ss.Bus.a.v):
        print(f'  bus {idx:>6} {str(name):<12} Vm {vm:7.4f} pu  Va {math.degrees(va):8.3f} deg')

    if args.json and ok:
        sol = {
            'format': 'conductor-andes-pf',
            'source': f'ANDES {andes.__version__} power flow',
            'case': args.raw,
            'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'converged': ok,
            'iterations': int(ss.PFlow.niter),
            'mva': ss.config.mva,
            'buses': [{'bus': int(i), 'vm': float(vm), 'va': math.degrees(va)} for i, vm, va in zip(ss.Bus.idx.v, ss.Bus.v.v, ss.Bus.a.v)],
            'branches': flows(ss),
        }
        with open(args.json, 'w', encoding='utf-8') as fh:
            json.dump(sol, fh, indent=1, default=float)
        print(f'Wrote {args.json}')

    if not ok:
        return 1
    if args.dyr:
        ss.TDS.config.tf = args.tf
        ss.TDS.config.no_tqdm = 1
        ss.TDS.init()
        init_ok = bool(ss.TDS.test_init())
        ss.TDS.run()
        done = init_ok and ss.exit_code == 0 and abs(ss.dae.t - args.tf) < 1e-6
        dyn = {m: getattr(ss, m).n for m in ('GENCLS', 'GENROU', 'SEXS', 'IEEET1', 'ESST1A', 'TGOV1', 'GAST', 'IEEEG1', 'REGCA1', 'REECA1', 'REPCA1', 'WTDTA1', 'WTARA1', 'WTPTA1', 'WTTQA1') if getattr(ss, m).n}
        print(f'Dynamic models: {", ".join(f"{k} x{v}" for k, v in dyn.items()) or "none"}')
        print(f'TDS initialization: {"OK" if init_ok else "FAILED (residuals after init)"}')
        print(f'TDS (flat run to {args.tf} s): {"COMPLETED" if done else "FAILED"} at t = {ss.dae.t:.4f} s, exit code {ss.exit_code}')
        vmin, vmax = min(ss.Bus.v.v), max(ss.Bus.v.v)
        print(f'  bus voltages at the end: {vmin:.4f} to {vmax:.4f} pu (flat run: should match the power flow)')
        if not done:
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
