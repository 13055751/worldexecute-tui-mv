#!/usr/bin/env python3
"""SDR sRGB PNG(raw rgb24 in) -> HDR10 (BT.2020 / PQ / yuv420p10le out), frame by frame.

Pipeline (per frame, fully deterministic):
  sRGB decode -> linear (1.0 = SDR white)
  -> highlight lift  v' = v^0.85
  -> luminance gain  v'' = v' * HDR_GAIN   (1.0 -> HDR_GAIN*10000 nits peak)
  -> primaries BT.709 -> BT.2020 (3x3)
  -> ST.2084 PQ encode
  -> Y'CbCr (BT.2020 NC) + 4:2:0 + limited range + 10 bit

stdin : rawvideo rgb24 1920x1080, concatenated frames
stdout: rawvideo yuv420p10le 1920x1080, same frame count
"""
import sys
import numpy as np

W, H = 1920, 1080
HDR_GAIN = 0.035   # SDR white (1.0 linear) -> 350 nits peak
LIFT = 0.85        # midtone lift exponent (applied in linear light)

# sRGB EOTF
def srgb_to_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)

# BT.709 -> BT.2020 primaries (linear RGB)
M709_2020 = np.array([
    [0.6274, 0.3293, 0.0433],
    [0.0691, 0.9195, 0.0114],
    [0.0164, 0.0880, 0.8956],
])

# ST.2084 PQ (normalized: input 0..1 == 0..10000 nits)
M1, M2 = 2610 / 16384, 2523 / 4096 * 128
C1, C2, C3 = 3424 / 4096, 2413 / 4096 * 32, 2392 / 4096 * 32

def pq_encode(l):
    l = np.clip(l, 0.0, 1.0)
    l5 = l ** M1
    return ((C1 + C2 * l5) / (1 + C3 * l5)) ** M2

def convert_frame(buf):
    x = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3).astype(np.float64)
    lin = srgb_to_linear(x / 255.0)
    lin = (lin ** LIFT) * HDR_GAIN
    wide = lin @ M709_2020.T           # -> BT.2020 primaries (still linear)
    pq = pq_encode(wide)               # 0..1 PQ

    # Y'CbCr BT.2020 NC on PQ-encoded RGB, full range 0..1
    r, g, b = pq[..., 0], pq[..., 1], pq[..., 2]
    y = 0.2627 * r + 0.6780 * g + 0.0593 * b
    cb = (b - y) / (2 * (1 - 0.0593))
    cr = (r - y) / (2 * (1 - 0.2627))

    # full -> limited, 8-bit scale then x4 (10 bit): Y 64..940, C 64..960 centered 512
    y10 = np.rint(64 + 876 * y)
    cb10 = np.rint(512 + 896 * cb)
    cr10 = np.rint(512 + 896 * cr)
    y10 = np.clip(y10, 0, 1023).astype(np.uint16)
    cb10 = np.clip(cb10, 0, 1023).astype(np.uint16)
    cr10 = np.clip(cr10, 0, 1023).astype(np.uint16)

    # 4:2:0 subsample (average 2x2)
    cb = ((cb10[0::2, 0::2].astype(np.uint32) + cb10[1::2, 0::2] +
           cb10[0::2, 1::2] + cb10[1::2, 1::2] + 2) >> 2).astype(np.uint16)
    cr = ((cr10[0::2, 0::2].astype(np.uint32) + cr10[1::2, 0::2] +
           cr10[0::2, 1::2] + cr10[1::2, 1::2] + 2) >> 2).astype(np.uint16)

    out = np.empty((H * W + (W // 2) * (H // 2) * 2,), dtype=np.uint16)
    out[: H * W] = y10.reshape(-1)
    off = H * W
    out[off:off + cb.size] = cb.reshape(-1)
    out[off + cb.size:] = cr.reshape(-1)
    return out.tobytes()

FRAME_IN = W * H * 3
def main():
    n = 0
    while True:
        buf = sys.stdin.buffer.read(FRAME_IN)
        if len(buf) < FRAME_IN:
            break
        sys.stdout.buffer.write(convert_frame(buf))
        sys.stdout.buffer.flush()
        n += 1
    print(f"converted {n} frames", file=sys.stderr)

if __name__ == "__main__":
    main()
