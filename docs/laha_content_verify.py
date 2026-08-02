import os, re, glob

base = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"
files = sorted(glob.glob(os.path.join(base, "*.md")))
total = 0
print(f"{'file':22s} {'entries':>7s} {'id_range'}")
print("-"*50)
for f in files:
    name = os.path.basename(f)
    if name.startswith("_"):
        print(f"{name:22s}  (stray, skip)")
        continue
    ids = []
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("### "):
                m = re.search(r"([A-Za-z]+-?\d+)", line)
                if m:
                    ids.append(m.group(1))
    n = len(ids)
    total += n
    rng = f"{ids[0]}..{ids[-1]}" if ids else "?"
    # detect duplicate ids
    dup = len(ids) != len(set(ids))
    flag = "  <-- DUP IDs!" if dup else ""
    print(f"{name:22s} {n:7d} {rng:18s}{flag}")
print("-"*50)
print(f"TOTAL entries: {total}")
