#!/usr/bin/env bash
# Runs inside the container: /src is the original compiler, /repo is this repo.
set -euo pipefail

rm -rf /tmp/ifcc
cp -r /src /tmp/ifcc
cd /tmp/ifcc
cat > config.mk <<'EOF'
ANTLRJAR=/opt/antlr/jar/antlr-4.9.2-complete.jar
ANTLRINC=/opt/antlr/include
ANTLRLIB=/opt/antlr/lib/libantlr4-runtime.a
ANTLR=java -cp $(ANTLRJAR) org.antlr.v4.Tool
EOF
make -j8 ifcc > /dev/null
g++ -std=c++17 -Wno-attributes -I/opt/antlr/include -Igenerated -Isrc \
    /repo/compiler/export.cpp $(ls build/*.o | grep -v '/main.o$') \
    /opt/antlr/lib/libantlr4-runtime.a -o ifcc-export

raw=/repo/data/raw
rm -rf "$raw"
mkdir -p "$raw" /tmp/export

run() { # sets $code and $out
    set +e
    out=$("$@")
    code=$?
    set -e
}

while read -r path; do
    [ -z "$path" ] && continue
    src="tests/testfiles/$path"
    name=$(basename "$path" .c)
    dest="$raw/$name"
    cp "$src" "$dest.c"

    ./ifcc -o "$dest.x86.s" "$src" 2> /dev/null
    ./ifcc -trv64 -o "$dest.rv64.s" "$src"
    # -d prints the IR on stderr. The RISC-V backend prints nothing else there.
    ./ifcc -d -trv64 -o /dev/null "$src" 2> "$dest.ir.txt"
    ./ifcc-export "$src" > "/tmp/export/$name.json"

    gcc "$src" -o /tmp/gcc.out
    run /tmp/gcc.out; gcc_code=$code; gcc_out=$out
    gcc "$dest.x86.s" -o /tmp/x86.out
    run /tmp/x86.out; x86_code=$code; x86_out=$out
    riscv64-linux-gnu-gcc "$dest.rv64.s" -o /tmp/rv64.out
    run qemu-riscv64 -L /usr/riscv64-linux-gnu /tmp/rv64.out; rv_code=$code; rv_out=$out

    python3 - "$dest.runs.json" "$gcc_code" "$gcc_out" "$x86_code" "$x86_out" "$rv_code" "$rv_out" <<'EOF'
import json, sys
f, gc, go, xc, xo, rc, ro = sys.argv[1:]
runs = {
    "gcc": {"exit": int(gc), "stdout": go},
    "x86": {"exit": int(xc), "stdout": xo},
    "rv64": {"exit": int(rc), "stdout": ro},
}
open(f, "w").write(json.dumps(runs, indent=2) + "\n")
EOF
    echo "$path: gcc $gcc_code, ifcc x86-64 $x86_code, ifcc RISC-V $rv_code"
done < /repo/compiler/programs.txt

python3 /repo/compiler/collect.py
