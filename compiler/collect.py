# Merges the compiler outputs in data/raw and the exporter's JSON into the one file the site loads.
import json, os

repo = "/repo"
programs = []
for path in open(f"{repo}/compiler/programs.txt").read().split():
    name = os.path.basename(path)[:-2]
    raw = f"{repo}/data/raw/{name}"
    exported = json.load(open(f"/tmp/export/{name}.json"))
    programs.append({
        "id": name,
        "path": f"tests/testfiles/{path}",
        "source": open(f"{raw}.c").read(),
        "dump": open(f"{raw}.ir.txt").read(),
        "functions": exported["functions"],
        "asm": exported["asm"],
        "runs": json.load(open(f"{raw}.runs.json")),
    })

os.makedirs(f"{repo}/src/data", exist_ok=True)
with open(f"{repo}/src/data/programs.json", "w") as f:
    json.dump(programs, f, indent=1)
    f.write("\n")
print(f"wrote src/data/programs.json ({len(programs)} programs)")
