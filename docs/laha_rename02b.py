import os, re

base = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"
p02 = os.path.join(base, "02-rover-b.md")

# Current 02 has R-081..R-135 (was over-shifted by +10). We want R-071..R-125 (i.e. shift current -10).
def dec(m):
    return "R-%03d" % (int(m.group(1)) - 10)

lines = open(p02, encoding="utf-8").read().splitlines(keepends=True)
out = []
for ln in lines:
    if ln.startswith("###"):
        out.append(re.sub(r"R-(\d{3})", dec, ln))
    else:
        out.append(ln)
open(p02, "w", encoding="utf-8").writelines(out)

ids = []
for ln in open(p02, encoding="utf-8"):
    if ln.startswith("###"):
        mm = re.search(r"R-(\d{3})", ln)
        if mm: ids.append(mm.group(1))
print("02 id range:", ids[0], "..", ids[-1], "count:", len(ids))
print("02 overlaps (dup ids):", len(ids) != len(set(ids)))

# cross-file R overlap with 01
r_all = {}
for f in ["01-rover-a.md","02-rover-b.md"]:
    for ln in open(os.path.join(base,f), encoding="utf-8"):
        if ln.startswith("###"):
            mm = re.search(r"R-(\d{3})", ln)
            if mm: r_all.setdefault(mm.group(1), []).append(f)
ov = {k:v for k,v in r_all.items() if len(v)>1}
print("R overlaps 01 vs 02:", ov if ov else "NONE")
