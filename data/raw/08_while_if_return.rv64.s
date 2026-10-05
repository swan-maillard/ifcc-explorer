.globl main
main:
    addi sp, sp, -64
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -64
    mv a5, zero
    sw a5, -4(s0)
.BB0:
    li a5, 5
    sw a5, -8(s0)
    li a5, -4
    sw a5, -16(s0)
    j .WHCOND1
.WHCOND1:
    lw a5, -8(s0)
    beq a5, zero, .WHELSE3
    j .BB4
.WHELSE3:
    lw a5, -8(s0)
    sw a5, -4(s0)
    j .main_ret
.BB4:
    li a5, 1
    sw a5, -28(s0)
    lw a5, -8(s0)
    lw a6, -28(s0)
    subw a5, a5, a6
    sw a5, -32(s0)
    lw a5, -32(s0)
    sw a5, -8(s0)
    lw a5, -16(s0)
    lw a6, -8(s0)
    addw a5, a5, a6
    sw a5, -36(s0)
    lw a5, -36(s0)
    sw a5, -16(s0)
    lw a5, -16(s0)
    beq a5, zero, .BB5
    j .IFTHEN6
.BB5:
    j .WHCOND1
.IFTHEN6:
    lw a5, -8(s0)
    sw a5, -4(s0)
    j .main_ret
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 64
    jr ra
