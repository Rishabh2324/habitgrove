"""Synthesize the one-shot sound effects: watering (sprinkle + droplets), uprooting (roots tearing + soil thud),
the time-lapse (soil, stretching stems, creaking wood and a canopy of rustling leaves) and the glass crack
behind the uproot confirmation.
Usage: python3 gen-sfx.py <outdir>   (writes water.wav, uproot.wav, timelapse.wav and crack.wav)"""
import numpy as np, wave, sys, os

SR = 44100
rng = np.random.default_rng(11)


def lin(n):
    return np.linspace(0, 1, n)


def bandpass_noise(n, lo, hi):
    f = np.fft.rfftfreq(n, 1 / SR)
    spec = (rng.normal(size=f.size) + 1j * rng.normal(size=f.size)) * ((f > lo) & (f < hi))
    x = np.fft.irfft(spec, n=n)
    return x / np.max(np.abs(x))


def lowpass(x, cutoff):
    f = np.fft.rfftfreq(x.size, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * np.exp(-((f / cutoff) ** 2)), n=x.size)


def droplet(freq, dur=0.07):
    """Classic water-drop 'plink': a sine whose pitch rises quickly as the bubble resonates."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = freq * (1 + 1.8 * t / dur)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.sin(ph) * np.exp(-t * 60) * np.minimum(1, t * SR / 40)


def add(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    sig = sig[: max(0, buf.shape[0] - i)]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + sig.size, 0] += sig * gain * gl
    buf[i:i + sig.size, 1] += sig * gain * gr


def reverb(buf, seconds=0.6, mix=0.15):
    n = int(seconds * SR)
    out = buf.copy()
    for c in range(2):
        ir = rng.normal(size=n) * np.exp(-np.arange(n) / (SR * seconds / 5))
        ir = np.convolve(ir, np.ones(10) / 10, mode="same")
        ir /= np.sqrt(np.sum(ir**2))
        out[:, c] += mix * np.convolve(buf[:, c], ir)[: buf.shape[0]]
    return out


def write(path, buf, peak=0.8):
    fade = int(0.05 * SR)
    buf[-fade:] *= np.linspace(1, 0, fade)[:, None]
    buf = buf / np.max(np.abs(buf)) * peak
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((buf * 32767).astype(np.int16).tobytes())


def water():
    dur = 2.1
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    # Gentle shower hiss from the watering can: swells in, then tapers as the rain animation ends.
    x = lin(n) * dur
    shape = np.clip(x / 0.25, 0, 1) ** 1.5 * np.clip((1.7 - x) / 0.7, 0, 1) ** 1.2
    for c, pan in ((0, -1), (1, 1)):
        hiss = bandpass_noise(n, 1500, 9000) * 0.5 + bandpass_noise(n, 300, 1500) * 0.35
        flutter = 0.75 + 0.25 * lowpass(rng.normal(size=n), 30) / 0.05
        buf[:, c] += hiss * shape * np.clip(flutter, 0.4, 1.2) * 0.22
    # Droplets landing on leaves and soil, densest mid-pour.
    for _ in range(90):
        at = rng.beta(2.2, 2.6) * 1.7
        add(buf, droplet(rng.uniform(900, 2600), rng.uniform(0.04, 0.09)), at, rng.uniform(0.15, 0.45), rng.uniform(-0.8, 0.8))
    # A few last lazy drips after the pour stops.
    for at in (1.62, 1.8, 1.93):
        add(buf, droplet(rng.uniform(1100, 1700), 0.09), at, 0.35, rng.uniform(-0.4, 0.4))
    return reverb(buf, 0.5, 0.18)


def uproot():
    dur = 1.5
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    # 1) Roots straining: low, gritty crackle that builds tension.
    strain_n = int(0.55 * SR)
    grit = bandpass_noise(strain_n, 80, 900)
    crackle = (rng.random(strain_n) < 0.004) * rng.uniform(0.5, 1, strain_n)
    crackle = np.convolve(crackle, np.exp(-np.arange(200) / 25), mode="same")
    strain = (grit * 0.5 + bandpass_noise(strain_n, 600, 3000) * crackle * 1.2) * lin(strain_n) ** 1.6
    add(buf, strain, 0.0, 0.8, -0.1)
    add(buf, strain[::-1] * lin(strain_n) ** 2, 0.02, 0.35, 0.2)
    # 2) The pop: roots tearing free — a sharp, woody snap with a low body.
    rip_n = int(0.22 * SR)
    t = np.arange(rip_n) / SR
    rip = bandpass_noise(rip_n, 200, 5000) * np.exp(-t * 22)
    body = np.sin(2 * np.pi * (140 - 200 * t) * t) * np.exp(-t * 18)
    add(buf, rip * 0.9 + body * 0.7, 0.55, 0.9)
    # 3) Soil scatters: a shower of tiny grains.
    for _ in range(140):
        at = 0.6 + rng.gamma(1.5, 0.13)
        g_n = int(rng.uniform(0.004, 0.012) * SR)
        grain = bandpass_noise(g_n, 1500, 7000) * np.hanning(g_n)
        add(buf, grain, at, rng.uniform(0.05, 0.22) * np.exp(-(at - 0.6) * 2.5), rng.uniform(-0.9, 0.9))
    # 4) Soft thud as the clump of earth lands.
    th_n = int(0.35 * SR)
    t = np.arange(th_n) / SR
    thud = np.sin(2 * np.pi * (90 - 60 * t) * t) * np.exp(-t * 14) + lowpass(rng.normal(size=th_n), 400) * 3 * np.exp(-t * 20)
    thud *= np.minimum(1, t / 0.015)  # soft attack: a landing, not a click
    add(buf, thud, 0.92, 0.55)
    return reverb(buf, 0.5, 0.12)


def resonate(x, modes):
    """Excite a bank of damped resonances (freq, decay/s, gain) — gives impulses a woody body."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    ir = sum(g * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d, g in modes)
    return np.convolve(x, ir)[: x.size]


def creak(dur, rate0, rate1, modes):
    """Stick-slip friction, like a branch bending: a train of clicks whose rate drifts, rung through wood modes."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = rate0 + (rate1 - rate0) * (t / dur) + 6 * lowpass(rng.normal(size=n), 4) / 0.02
    ph = np.cumsum(np.clip(rate, 5, None)) / SR
    clicks = np.diff(np.floor(ph), prepend=0) * rng.uniform(0.5, 1, n)
    x = resonate(clicks, modes) + bandpass_noise(n, 800, 3000) * 0.04
    return x * np.sin(np.pi * t / dur) ** 0.7


def rustle(n, density, lo=2000, hi=9000):
    """Leaves brushing: a stream of tiny noise grains, density (grains/s) following a curve."""
    x = np.zeros(n)
    hits = rng.random(n) < density / SR
    for i in np.flatnonzero(hits):
        g_n = int(rng.uniform(0.003, 0.02) * SR)
        g = rng.normal(size=g_n) * np.hanning(g_n) * rng.uniform(0.2, 1)
        x[i:i + g_n] += g[: n - i]
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * ((f > lo) & (f < hi)), n=n)


def timelapse():
    # Mirrors HabitScreen's time-lapse: the tree grows day 0 -> 70 over 9s with an ease-in-out-cubic curve,
    # starting 60ms after the button press. Foley follows the growth: soil cracks as the seed sprouts, stems
    # stretch, the trunk creaks as it thickens, and the canopy fills with rustling leaves and wind.
    start, grow, dur = 0.06, 9.0, 11.0
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    x = lin(n) * dur
    p = np.clip((x - start) / grow, 0, 1)
    eased = np.where(p < 0.5, 4 * p**3, 1 - (-2 * p + 2) ** 3 / 2)
    tail = np.clip((dur - x) / 2.0, 0, 1) ** 2
    wood = ((180, 30, 1), (410, 45, 0.6), (730, 60, 0.35), (1250, 90, 0.2))
    twig = ((900, 70, 1), (1700, 110, 0.5), (2900, 160, 0.25))

    # 1) Seed breaking through: soil crumbling and small grit cracks in the first seconds.
    soil_env = np.clip(x / 0.3, 0, 1) * np.clip((3.2 - x) / 1.4, 0, 1)
    for c in range(2):
        grit = rustle(n, 260, 600, 4000) * soil_env
        buf[:, c] += grit * 0.8 + lowpass(rng.normal(size=n), 250) * soil_env * 0.4
    for _ in range(18):
        at = rng.uniform(0.2, 2.6)
        add(buf, creak(rng.uniform(0.03, 0.08), 400, 300, twig), at, rng.uniform(0.1, 0.3), rng.uniform(-0.5, 0.5))

    # 2) Green stems stretching: short, high fibrous creaks while it's still small.
    for at in (1.6, 2.3, 2.9, 3.6):
        add(buf, creak(rng.uniform(0.25, 0.45), 120, 60, twig), at, 0.35, rng.uniform(-0.6, 0.6))

    # 3) Trunk and branches thickening: longer, deeper woody groans through the fast middle of the growth.
    for at, d, pan in ((3.9, 0.9, -0.2), (4.9, 1.1, 0.3), (5.8, 0.8, -0.4), (6.6, 1.2, 0.1), (7.6, 0.7, 0.5)):
        add(buf, creak(d, rng.uniform(25, 40), rng.uniform(10, 18), wood), at, 0.8, pan)
    for _ in range(6):  # branches cracking outwards
        add(buf, creak(0.05, 500, 400, wood), rng.uniform(4.5, 8.0), rng.uniform(0.3, 0.5), rng.uniform(-0.8, 0.8))

    # 4) Canopy filling in: leaf rustle grows with the tree and gusts with the wind.
    gust = np.clip(0.5 + lowpass(rng.normal(size=n), 0.8) / 0.004, 0.15, 1.3)
    leaf_env = eased**1.3 * tail * gust
    for c, pan in ((0, -1), (1, 1)):
        buf[:, c] += rustle(n, 2500, 2500, 10000) * leaf_env * 0.4
    # 5) Wind through the full crown: a soft breathy swell under the leaves.
    wind_env = (0.1 + 0.9 * eased) * tail * gust
    for c in range(2):
        buf[:, c] += bandpass_noise(n, 150, 1200) * wind_env * 0.12

    # 6) The tree settles: one last long creak and the leaves hushing out.
    add(buf, creak(1.4, 30, 8, wood), start + grow - 0.2, 0.6, 0.1)
    return reverb(buf, 0.9, 0.2)


def crack():
    """Glass giving way: a sharp impact, splintering ticks racing outward, then bright ringing shards."""
    dur = 1.1
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    # 1) Impact: a hard broadband click with a low knock behind it.
    imp_n = int(0.08 * SR)
    t = np.arange(imp_n) / SR
    impact = bandpass_noise(imp_n, 1000, 12000) * np.exp(-t * 90) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 40) * 0.6
    add(buf, impact, 0.0, 1.0)
    # 2) Splintering: dense tiny ticks as the cracks run across the glass (matches the ~0.45s crack animation).
    for _ in range(220):
        at = rng.gamma(1.3, 0.07)
        g_n = int(rng.uniform(0.001, 0.004) * SR)
        tick = bandpass_noise(g_n, 3000, 14000) * np.hanning(g_n)
        add(buf, tick, at, rng.uniform(0.1, 0.5) * np.exp(-at * 4), rng.uniform(-0.9, 0.9))
    # 3) Ringing shards: inharmonic high partials that die away quickly.
    for _ in range(14):
        at = rng.uniform(0.0, 0.3)
        r_n = int(0.5 * SR)
        t = np.arange(r_n) / SR
        f = rng.uniform(2200, 4800)
        ring = sum(np.sin(2 * np.pi * f * m * t) * g for m, g in ((1, 1), (2.32, 0.4), (4.25, 0.15))) * np.exp(-t * rng.uniform(9, 20))
        add(buf, ring, at, rng.uniform(0.04, 0.1), rng.uniform(-0.8, 0.8))
    return reverb(buf, 0.6, 0.18)


out = sys.argv[1]
write(os.path.join(out, "water.wav"), water())
write(os.path.join(out, "uproot.wav"), uproot())
write(os.path.join(out, "timelapse.wav"), timelapse(), peak=0.8)
write(os.path.join(out, "crack.wav"), crack())
print("ok")
