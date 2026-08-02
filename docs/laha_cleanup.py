import os, re, glob

base = r"C:\Users\lenovo\CURSOR\Snow\docs\lahaylo-content"

# 1) Renumber 02-rover-b.md headings R-061..R-115 -> R-071..R-125 (fix overlap with 01)
p02 = os.path.join(base, "02-rover-b.md")
if os.path.exists(p02):
    lines = open(p02, encoding="utf-8").read().splitlines(keepends=True)
    newlines = []
    for ln in lines:
        m = re.match(r"^(### R-)(\d{3})(\b.*)$", ln)
        if m:
            num = int(m.group(2)) + 10
            newlines.append(f"{m.group(1)}{num:03d}{m.group(3)}\n")
        else:
            newlines.append(ln)
    open(p02, "w", encoding="utf-8").writelines(newlines)
    print("02 renumbered R-061..R-115 -> R-071..R-125")

# 2) Clean stray / backup artifacts
strays = ["_b5.md", "04-aemilis-b.copywriter5-backup-A061-A110.md", "05-lahaylo.md.bak",
          "_b2.md", "_b3.md", "_b4.md", "_test_persist.md"]
for s in strays:
    fp = os.path.join(base, s)
    if os.path.exists(fp):
        os.remove(fp)
        print(f"removed stray: {s}")

# 3) Verify all 9 target files
files = ["01-rover-a.md","02-rover-b.md","03-aemilis-a.md","04-aemilis-b.md",
         "05-lahaylo.md","06-cingjilm.md","07-roi-culture.md","08-supporting.md","09-cross-forum.md"]
total = 0
print("\n%-22s %7s %-16s" % ("file","entries","id_range"))
print("-"*48)
for f in files:
    fp = os.path.join(base, f)
    ids = []
    for ln in open(fp, encoding="utf-8"):
        if ln.startswith("### "):
            mm = re.search(r"([A-Za-z]+-?\d+)", ln)
            if mm: ids.append(mm.group(1))
    n = len(ids)
    total += n
    rng = f"{ids[0]}..{ids[-1]}" if ids else "?"
    # detect duplicate ids within file
    dup = len(ids) != len(set(ids))
    flag = "  <-- DUP!" if dup else ""
    print("%-22s %7d %-16s%s" % (f, n, rng, flag))
print("-"*48)
print("TOTAL entries:", total)

# 4) Cross-file overlap check for R- ids
r_ids = {}
for f in files:
    fp = os.path.join(base, f)
    for ln in open(fp, encoding="utf-8"):
        if ln.startswith("### R-") or re.match(r"### R-", ln):
            mm = re.search(r"R-(\d+)", ln)
            if mm:
                r_ids.setdefault(mm.group(1), []).append(f)
overlap = {k:v for k,v in r_ids.items() if len(v)>1}
print("R-id overlaps across files:", overlap if overlap else "NONE")
