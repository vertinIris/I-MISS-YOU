import re, os, glob

d = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"
files = sorted(glob.glob(os.path.join(d, "*.md")))
files = [f for f in files if not f.endswith(".bak")]

total = 0
perfile = {}
all_ids = {}
overlaps = []
contam = {"黎那汐塔": 0, "七丘": 0, "Rinascita": 0, "Seven Hills": 0}

for f in files:
    with open(f, encoding="utf-8") as fh:
        txt = fh.read()
    heads = re.findall(r"^###\s+(?:\[)?([A-Za-z]+-?\d+)", txt, flags=re.MULTILINE)
    seen = {}
    dup_local = []
    for h in heads:
        if h in seen:
            dup_local.append(h)
        seen[h] = seen.get(h, 0) + 1
        if h in all_ids:
            overlaps.append((h, os.path.basename(all_ids[h]), os.path.basename(f)))
        else:
            all_ids[h] = f
    perfile[os.path.basename(f)] = (len(heads), dup_local)
    total += len(heads)
    for k in contam:
        contam[k] += len(re.findall(re.escape(k), txt))

print("=== PER-FILE (entries, local-dups) ===")
for f, (n, dup) in perfile.items():
    print(f"  {f:28s} {n:4d}  dups={len(dup)}")
print(f"\nTOTAL entries: {total}")
print("\n=== CROSS-FILE OVERLAPS ===")
if overlaps:
    for o in overlaps:
        print("  OVERLAP:", o)
else:
    print("  NONE")
print("\n=== REGION CONTAMINATION (expect 0) ===")
for k, v in contam.items():
    print(f"  {k}: {v}")
PYEOF_MARKER = None
