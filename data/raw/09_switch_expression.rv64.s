.globl main
main:
    addi sp, sp, -64
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -64
    mv a5, zero
    sw a5, -4(s0)
.BB0:
    li a5, 2
    sw a5, -8(s0)
    li a5, 6
    sw a5, -20(s0)
    li a6, 8
    lw a5, -20(s0)
    beq a5, a6, .BB3
    li a6, 2
    lw a5, -20(s0)
    beq a5, a6, .BB4
    li a6, 7
    lw a5, -20(s0)
    beq a5, a6, .BB5
    li a6, 6
    lw a5, -20(s0)
    beq a5, a6, .BB6
.BB1:
    li a5, 1
    sw a5, -40(s0)
    lw a5, -8(s0)
    lw a6, -40(s0)
    addw a5, a5, a6
    sw a5, -44(s0)
    lw a5, -44(s0)
    sw a5, -4(s0)
    j .main_ret
.BB3:
    li a5, 8
    sw a5, -4(s0)
    j .main_ret
.BB4:
    li a5, 2
    sw a5, -4(s0)
    j .main_ret
.BB5:
    li a5, 7
    sw a5, -4(s0)
    j .main_ret
.BB6:
    li a5, 20
    sw a5, -4(s0)
    j .main_ret
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 64
    jr ra
