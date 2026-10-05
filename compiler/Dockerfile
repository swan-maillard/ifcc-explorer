FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends g++ clang cmake make unzip curl ca-certificates openjdk-17-jre-headless python3 uuid-dev pkg-config git gcc-riscv64-linux-gnu libc6-dev-riscv64-cross qemu-user && rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf git://github.com/
WORKDIR /opt/antlr.tmp
RUN curl -sSLO https://www.antlr.org/download/antlr-4.9.2-complete.jar && curl -sSLO https://www.antlr.org/download/antlr4-cpp-runtime-4.9.2-source.zip && unzip -q *.zip && sed -i "/TEST_AFTER_INSTALL/d" runtime/CMakeLists.txt && sed -i "s|CMAKE_ARGS |CMAKE_ARGS -DUTF8_TESTS=off -DUTF8_SAMPLES=off |" runtime/CMakeLists.txt && mkdir build && cd build && cmake .. -DWITH_DEMO=False -DANTLR4_INSTALL=False >/dev/null && make -j8 antlr4_static >/dev/null
RUN mkdir -p /opt/antlr/jar /opt/antlr/include /opt/antlr/lib && cp /opt/antlr.tmp/*.jar /opt/antlr/jar/ && cd /opt/antlr.tmp/runtime/src && find . -name '*.h' -exec cp --parents '{}' /opt/antlr/include/ ';' && cp /opt/antlr.tmp/dist/libantlr4-runtime.a /opt/antlr/lib/
