import os, re

base = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"
p02 = os.path.join(base, "02-rover-b.md")

def inc(m):
    return "R-%03d" % (int(m.group(1)) + 10)

lines = open(p02, encoding="utf-8").read().splitlines(keepends=True)
changed = 0
out = []
for ln in lines:
    if ln.startswith("###"):
        new = re.sub(r"R-(\d{3})", inc, ln)
        if new != ln:
            changed += 1
        out.append(new)
    else:
        out.append(ln)
open(p02, "w", encoding="utf-8").writelines(out)
print("02 heading lines changed:", changed)

# verify
ids = []
for ln in open(p02, encoding="utf-8"):
    if ln.startswith("###"):
        mm = re.search(r"R-(\d{3})", ln)
        if mm: ids.append(mm.group(1))
print("02 id range:", ids[0], "..", ids[-1], "count:", len(ids))
print("02 overlaps (dup ids):", len(ids) != len(set(ids)))
