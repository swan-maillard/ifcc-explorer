.globl main
main:
    addi sp, sp, -48
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -48
    mv a5, zero
    sw a5, -4(s0)
.BB0:
    li a5, 0
    sw a5, -8(s0)
    li a6, 0
    lw a5, -8(s0)
    beq a5, a6, .BB2
    li a6, 1
    lw a5, -8(s0)
    beq a5, a6, .BB3
.BB1:
    lw a5, -8(s0)
    sw a5, -4(s0)
    j .main_ret
.BB2:
    li a5, 10
    sw a5, -8(s0)
    j .BB3
.BB3:
    li a5, 20
    sw a5, -8(s0)
    j .BB1
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 48
    jr ra
