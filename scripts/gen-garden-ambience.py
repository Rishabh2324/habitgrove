"""Synthesize a seamless, loopable garden ambience: soft breeze + distant stream + songbirds.
Everything is built circularly (FFT-shaped noise, wrapped bird placement, circular reverb)
so the file loops with no seam."""
import numpy as np, wave, sys

SR = 44100
DUR = 48.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def shaped_noise(shape_fn):
    """Periodic noise with a given magnitude spectrum (loops perfectly)."""
    f = np.fft.rfftfreq(N, 1 / SR)
    spec = (rng.normal(size=f.size) + 1j * rng.normal(size=f.size)) * shape_fn(f)
    x = np.fft.irfft(spec, n=N)
    return x / np.max(np.abs(x))


def periodic_lfo(periods, phase=0.0):
    return np.sin(2 * np.pi * periods * t_all / DUR + phase)


# --- Breeze through leaves: brown-ish noise, lowpassed, slowly swelling ---
def breeze_shape(f):
    f = np.maximum(f, 20)
    return (1 / f**0.9) * np.exp(-((f / 1800) ** 2)) * (1 - np.exp(-((f / 120) ** 2)))

swell = 0.55 + 0.25 * periodic_lfo(3) + 0.15 * periodic_lfo(7, 1.3) + 0.05 * periodic_lfo(13, 0.4)
breezeL = shaped_noise(breeze_shape) * swell
breezeR = shaped_noise(breeze_shape) * (0.55 + 0.25 * periodic_lfo(3, 0.6) + 0.15 * periodic_lfo(7, 2.1) + 0.05 * periodic_lfo(13, 1.9))

# --- Distant stream: band-limited noise with fast shimmer ---
def stream_shape(f):
    return np.exp(-(((f - 900) / 700) ** 2)) + 0.4 * np.exp(-(((f - 2600) / 1200) ** 2))

shimmer = 0.7 + 0.3 * np.abs(shaped_noise(lambda f: np.exp(-((f / 12) ** 2)) * (f > 1)))
streamL = shaped_noise(stream_shape) * shimmer
streamR = shaped_noise(stream_shape) * shimmer[::-1]


# --- Bird voices ---
def env(n, attack=0.08, release=0.35):
    x = np.linspace(0, 1, n)
    a = np.clip(x / attack, 0, 1)
    r = np.clip((1 - x) / release, 0, 1)
    return np.sin(a * np.pi / 2) ** 2 * np.sin(r * np.pi / 2) ** 2


def tone(freq_curve, amp_curve, harmonics=(1.0, 0.06, 0.015)):
    phase = 2 * np.pi * np.cumsum(freq_curve) / SR
    out = sum(h * np.sin((k + 1) * phase) for k, h in enumerate(harmonics))
    return out * amp_curve


def note(f0, f1, dur, vib_rate=0.0, vib_depth=0.0, curve=1.0, attack=0.08, release=0.35):
    n = int(dur * SR)
    x = np.linspace(0, 1, n) ** curve
    fr = f0 + (f1 - f0) * x
    if vib_depth:
        fr = fr * (1 + vib_depth * np.sin(2 * np.pi * vib_rate * np.arange(n) / SR))
    return tone(fr, env(n, attack, release))


def seq(parts):
    """parts: list of (gap_seconds, signal)."""
    out = []
    for gap, sig in parts:
        out.append(np.zeros(int(gap * SR)))
        out.append(sig)
    return np.concatenate(out)


def robin():  # cheerful phrase of rising/falling whistles
    base = rng.uniform(2300, 3000)
    parts = []
    for _ in range(rng.integers(4, 8)):
        a = base * rng.uniform(0.85, 1.35)
        b = a * rng.uniform(0.75, 1.25)
        parts.append((rng.uniform(0.05, 0.14), note(a, b, rng.uniform(0.12, 0.26), 30, 0.02)))
    return seq(parts)


def chickadee():  # "fee-bee"
    f = rng.uniform(3600, 4100)
    return seq([(0, note(f, f * 0.99, 0.33, 6, 0.004, attack=0.15)),
                (0.07, note(f * 0.84, f * 0.82, 0.38, 6, 0.004, attack=0.1))])


def trill():  # rapid descending chips
    f = rng.uniform(4200, 5600)
    n = rng.integers(6, 11)
    rate = rng.uniform(0.07, 0.1)
    parts = [(rate * 0.3, note(f * (1 - 0.01 * i), f * 0.68, rate * 0.75, curve=0.6, attack=0.25, release=0.6))
             for i in range(n)]
    sig = seq(parts)
    return sig * np.linspace(0.6, 1.0, sig.size) ** 0.5


def warbler():  # tumbling warble with strong FM
    n = int(rng.uniform(0.9, 1.5) * SR)
    tt = np.arange(n) / SR
    center = rng.uniform(3000, 4200)
    fr = center * (1 + 0.18 * np.sin(2 * np.pi * rng.uniform(9, 14) * tt) + 0.08 * np.sin(2 * np.pi * 3.1 * tt))
    gate = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * rng.uniform(5, 8) * tt))
    gate = np.convolve(gate, np.hanning(400) / np.hanning(400).sum(), mode="same")
    return tone(fr, env(n, 0.05, 0.25) * gate)


def dove():  # soft, low coo in the distance
    f = rng.uniform(480, 560)
    return seq([(0, note(f, f * 1.1, 0.35, attack=0.3, release=0.5, )),
                (0.12, note(f * 1.1, f * 0.95, 0.7, 4, 0.01, attack=0.2, release=0.6)),
                (0.1, note(f * 0.95, f * 0.9, 0.5, attack=0.2, release=0.6))]) * 0.9


def one_pole_lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(x.size):  # short signals only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


L = np.zeros(N)
R = np.zeros(N)


def place(sig, start, gain, pan, distance):
    """Mix a call into the loop, wrapping around the end so the loop stays seamless."""
    if distance > 0:
        sig = one_pole_lowpass(sig, 9000 - 6000 * distance)
    sig = sig * gain * (1 - 0.55 * distance)
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    idx = (int(start * SR) + np.arange(sig.size)) % N
    np.add.at(L, idx, sig * gl)
    np.add.at(R, idx, sig * gr)


# Each "bird" is a resident with its own spot in the garden and sings on its own rhythm.
residents = [
    (robin, 0.30, -0.6, 0.15, 5.5),
    (robin, 0.24, 0.55, 0.45, 8.0),
    (chickadee, 0.22, 0.2, 0.3, 9.5),
    (trill, 0.16, -0.25, 0.5, 11.0),
    (warbler, 0.18, 0.75, 0.25, 12.0),
    (dove, 0.20, -0.85, 0.7, 16.0),
]
for voice, gain, pan, dist, period in residents:
    tpos = rng.uniform(0, period)
    while tpos < DUR:
        place(voice(), tpos, gain * rng.uniform(0.75, 1.1), pan + rng.uniform(-0.1, 0.1), dist)
        # Occasionally answer itself right away, like real birds do
        tpos += period * rng.uniform(0.6, 1.4) if rng.random() > 0.25 else rng.uniform(1.2, 2.2)


# Circular reverb: short outdoor tail from decaying noise, applied via FFT (keeps the loop seamless)
def circ_reverb(x, seconds=1.4, mix=0.22):
    n = int(seconds * SR)
    ir = rng.normal(size=n) * np.exp(-np.arange(n) / (SR * seconds / 5))
    ir = np.convolve(ir, np.ones(8) / 8, mode="same")  # soften highs
    ir /= np.sqrt(np.sum(ir**2))
    irp = np.zeros(N); irp[:n] = ir
    wet = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(irp), n=N)
    return x + mix * wet

L = circ_reverb(L)
R = circ_reverb(R)

outL = 0.11 * breezeL + 0.045 * streamL + L
outR = 0.11 * breezeR + 0.045 * streamR + R
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
stereo = np.stack([outL, outR], axis=1) / peak * 0.85
pcm = (stereo * 32767).astype(np.int16)

with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", sys.argv[1])
