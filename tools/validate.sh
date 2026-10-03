#!/usr/bin/env bash
# tools/validate.sh — final acceptance evidence
set -e
cd "$(dirname "$0")/.."

echo "== duration =="
ffprobe -v error -show_entries format=duration -of csv=p=0 mv.mp4
echo "== streams =="
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate -of compact mv.mp4

echo "== A/V frame sync (PSNR of encoded vs source frames) =="
for idx in 00060 01350 01980 04950 06300; do
  t=$(python3 -c "print(f'{int(\"$idx\")/30:.4f}')")
  ffmpeg -v error -y -i mv.mp4 -ss "$t" -frames:v 1 "/tmp/val_$idx.png"
  p=$(ffmpeg -v error -i "/tmp/val_$idx.png" -i "frames/$idx.png" -lavfi psnr -f null - 2>&1 | grep -o 'average:[0-9.]*' | head -1)
  echo "frame $idx (t=$t) $p"
done

echo "== frame count =="
ffmpeg -v error -i mv.mp4 -map 0:v:0 -c copy -f null - 2>&1 | tail -1 || true
ls frames | wc -l
