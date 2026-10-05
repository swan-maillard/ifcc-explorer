.globl factorial
factorial:
    addi sp, sp, -64
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -64
    mv t1, a0
    sw t1, -4(s0)
.BB0:
    li a5, 1
    sw a5, -12(s0)
    lw a5, -4(s0)
    lw a6, -12(s0)
    sgt a5, a5, a6
    seqz a5, a5
    sw a5, -16(s0)
    lw a5, -16(s0)
    beq a5, zero, .IFELSE2
    j .IFTHEN1
.IFTHEN1:
    li a5, 1
    sw a5, -8(s0)
    j .factorial_ret
.IFELSE2:
    li a5, 1
    sw a5, -24(s0)
    lw a5, -4(s0)
    lw a6, -24(s0)
    subw a5, a5, a6
    sw a5, -28(s0)
    lw a0, -28(s0)
    call factorial
    sw a0, -32(s0)
    lw a5, -4(s0)
    lw a6, -32(s0)
    mulw a5, a5, a6
    sw a5, -36(s0)
    lw a5, -36(s0)
    sw a5, -8(s0)
    j .factorial_ret
.factorial_ret:
    lw a0, -8(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 64
    jr ra
.globl main
main:
    addi sp, sp, -80
    sd ra, 24(sp)
    sd s0, 16(sp)
    addi s0, sp, -80
    mv a5, zero
    sw a5, -4(s0)
.BB4:
    li a5, 4
    sw a5, -8(s0)
    lw a0, -8(s0)
    call factorial
    sw a0, -20(s0)
    lw a5, -20(s0)
    sw a5, -16(s0)
    j .WHCOND5
.WHCOND5:
    li a5, 2
    sw a5, -24(s0)
    lw a5, -16(s0)
    lw a6, -24(s0)
    sgt a5, a5, a6
    sw a5, -28(s0)
    lw a5, -28(s0)
    beq a5, zero, .AND10
    j .AND8
.WHELSE7:
    li a6, 2
    lw a5, -16(s0)
    beq a5, a6, .BB17
    li a6, 120
    lw a5, -16(s0)
    beq a5, a6, .BB17
.AND8:
    li a5, 120
    sw a5, -36(s0)
    lw a5, -16(s0)
    lw a6, -36(s0)
    slt a5, a5, a6
    sw a5, -40(s0)
    lw a5, -40(s0)
    beq a5, zero, .AND10
    j .AND9
.AND9:
    li a5, 1
    sw a5, -32(s0)
    j .ANDFOLLOW11
.AND10:
    li a5, 0
    sw a5, -32(s0)
    j .ANDFOLLOW11
.ANDFOLLOW11:
    lw a5, -32(s0)
    beq a5, zero, .WHELSE7
    j .BB12
.BB12:
    lw a5, -8(s0)
    addi a5, a5, 1
    sw a5, -8(s0)
    sw a5, -8(s0)
    lw a0, -8(s0)
    call factorial
    sw a0, -52(s0)
    lw a5, -52(s0)
    sw a5, -16(s0)
    j .WHCOND5
.BB14:
    li a5, 2
    sw a5, -44(s0)
    lw a5, -8(s0)
    lw a6, -44(s0)
    rem a5, a5, a6
    sw a5, -48(s0)
    lw a5, -48(s0)
    sw a5, -16(s0)
    j .BB15
.BB15:
    lw a5, -16(s0)
    sw a5, -4(s0)
    j .main_ret
.BB17:
    lw a5, -8(s0)
    sw a5, -16(s0)
    j .BB15
.main_ret:
    lw a0, -4(s0)
    ld ra, 24(sp)
    ld s0, 16(sp)
    addi sp, sp, 80
    jr ra
