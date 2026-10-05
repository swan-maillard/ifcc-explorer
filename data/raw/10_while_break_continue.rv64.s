.globl main
main:
    addi sp, sp, -48
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -48
    mv a5, zero
    sw a5, -4(s0)
.BB0:
    li a5, 3
    sw a5, -8(s0)
    j .WHTHEN2
.WHTHEN2:
    j .BB4
.WHELSE3:
    lw a5, -8(s0)
    sw a5, -4(s0)
    j .main_ret
.BB4:
    li a5, 1
    sw a5, -20(s0)
    lw a5, -8(s0)
    lw a6, -20(s0)
    subw a5, a5, a6
    sw a5, -24(s0)
    lw a5, -24(s0)
    sw a5, -8(s0)
    lw a5, -8(s0)
    beq a5, zero, .IFFOLLOW8
    j .BB9
.IFFOLLOW8:
    j .BB4
.BB9:
    j .WHELSE3
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 48
    jr ra
