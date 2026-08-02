import re, os, glob

D = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"

# ---------- 1) Finalize 09-cross-forum.md to clean 92 (first-X-001..X-092) ----------
p09 = os.path.join(D, "09-cross-forum.md")
txt = open(p09, encoding="utf-8").read()
# split into blocks by heading lines
lines = txt.split("\n")
blocks = []  # list of (id, [lines])
cur_id = None
cur = []
for ln in lines:
    m = re.match(r"^###\s+(?:\[)?(X-\d+)", ln)
    if m:
        if cur_id is not None:
            blocks.append((cur_id, cur))
        cur_id = m.group(1)
        cur = [ln]
    else:
        if cur_id is not None:
            cur.append(ln)
if cur_id is not None:
    blocks.append((cur_id, cur))

# keep first occurrence of each id, in order, capped at 92 unique
seen = set()
keep = []
for bid, bl in blocks:
    if bid in seen:
        continue
    seen.add(bid)
    keep.append(bl)
    if len(seen) >= 92:
        break

out = "\n".join("\n".join(bl) for bl in keep)
open(p09, "w", encoding="utf-8").write(out)
print(f"09 finalized: kept {len(seen)} unique entries (X-001..X-{len(seen):03d})")

# ---------- 2) Full verification ----------
files = sorted(glob.glob(os.path.join(D, "*.md")))
files = [f for f in files if not f.endswith(".bak")]
total = 0
perfile = {}
all_ids = {}
overlaps = []
contam = {"黎那汐塔": 0, "七丘": 0, "Rinascita": 0, "Seven Hills": 0}
for f in files:
    t = open(f, encoding="utf-8").read()
    heads = re.findall(r"^###\s+(?:\[)?([A-Za-z]+-?\d+)", t, flags=re.MULTILINE)
    seen2 = {}
    dup_local = []
    for h in heads:
        if h in seen2:
            dup_local.append(h)
        seen2[h] = seen2.get(h, 0) + 1
        if h in all_ids:
            overlaps.append((h, os.path.basename(all_ids[h]), os.path.basename(f)))
        else:
            all_ids[h] = f
    perfile[os.path.basename(f)] = (len(heads), dup_local)
    total += len(heads)
    for k in contam:
        contam[k] += len(re.findall(re.escape(k), t))

print("\n=== PER-FILE (entries, local-dups) ===")
for f, (n, dup) in perfile.items():
    print(f"  {f:28s} {n:4d}  dups={len(dup)}")
print(f"\nTOTAL entries: {total}")
print("\n=== CROSS-FILE OVERLAPS ===")
print("  NONE" if not overlaps else "")
for o in overlaps:
    print("  OVERLAP:", o)
print("\n=== REGION CONTAMINATION (expect 0) ===")
for k, v in contam.items():
    print(f"  {k}: {v}")
